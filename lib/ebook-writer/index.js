// # Ebook Writer
// generates an ebook in .epub format
'use strict';

// # import dependencies
const debug = require('debug')('ebook-writer');
const fs = require('fs-promise');
const ejs = require('ejs');
const archiver = require('archiver');
const rimraf = require('rimraf');
/**
* ## eBook Writer
* sets up the ebook writer with its base settings
*
* @param {Object} options - the options for the ebook (e.g. content, title, name, etc.)
*
* @return {Object} ebook - returns a ebook object
*/
const Ebook = function Ebook(options) {

  // ## prepare base settings
  this.tempPath = "books";
  this.options = options || {};
  if(!this.options["uuid"]) return debug("the book is missing a uuuid. can not continue without.");
  this.tempBookPath = `${this.tempPath}/${this.options["uuid"]}/`;

  // ## prepare ebook folders
  if(!_prepareFolder(this)) debug("an error occurred while trying to prepare the folder structure. make sure to have a correct options parameter.");
  if(!_writeMimeType(this)) debug("an error occurred while trying to write the mimetype.");
  if(!_writeContainer(this)) debug("an error occurred while trying to write the container.xml.");
}

/**
* ## eBook Writer
* sets up the ebook writer with its base settings
*
* @param {String} outputPath - the path the ebook should be written to
*
* @return {Promise} success - returns whether the save was successful or not
*/
Ebook.prototype.save = function save(outputPath) {
  let path = outputPath || "ebook.epub";
  // ## write chapters
  let chapterPromise = _writeChapters(this);
  let contentPromise = _writeContentOPF(this);
  let tocPromise = _writeTOC(this);
  return Promise.all([chapterPromise, contentPromise, tocPromise]).then( () => {
    // ## save ebook now
    return _generateEpub(this, path);
  }).then( (sdsd) => {
    // ## ebook saved
    return Promise.resolve("the ebook was successfully created");
  }).catch( (err) => {
    // ## an error occurred writing the epub
    debug(`an error occurred while trying to save the ebook (err ${err})`);
    return Promise.reject(err);
  });
}

function _prepareFolder(that) {
  debug(`folder structure will be prepared in temp folder`);
  fs.existsSync(that.tempPath) || fs.mkdirSync(that.tempPath);
  fs.existsSync(that.tempBookPath) || fs.mkdirSync(that.tempBookPath);
  fs.existsSync(`${that.tempBookPath}/META-INF`) || fs.mkdirSync(`${that.tempBookPath}/META-INF`);
  fs.existsSync(`${that.tempBookPath}/OEBPS`) || fs.mkdirSync(`${that.tempBookPath}/OEBPS`);
  fs.existsSync(`${that.tempBookPath}/OEBPS/images`) || fs.mkdirSync(`${that.tempBookPath}/OEBPS/images`);
  return true;
}

function _writeMimeType(that) {
  fs.writeFileSync(that.tempBookPath + "mimetype", "application/epub+zip");
  debug(`mimetype file was successfully written`);
  return true;
}

function _writeContainer(that) {
  let container = `<?xml version="1.0" encoding="UTF-8" ?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>`
  fs.writeFileSync(that.tempBookPath + "/META-INF/container.xml", container);
  debug(`container.xml file was successfully written`);
  return true;
}

function _writeChapters(that) {
  if(!that.options["chapters"]) return Promise.reject("there is no content to be written.");
  let promises = that.options["chapters"].map( (chapter) => {
    if(!chapter["fileName"]) return Promise.reject("there is no filename for the chapter.");
    let fileContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:m="http://www.w3.org/1998/Math/MathML" xmlns:pls="http://www.w3.org/2005/01/pronunciation-lexicon" xmlns:ssml="http://www.w3.org/2001/10/synthesis" xmlns:svg="http://www.w3.org/2000/svg">
<head>
  <meta charset="UTF-8" />
  <title>${chapter["title"]}</title>
  <link type="text/css" rel="stylesheet" media="all" href="${"stylesheet"}" />
</head>
<body>${chapter["content"]}</body>
</html>`;
    return fs.writeFile(that.tempBookPath + "/OEBPS/" + chapter["fileName"], fileContent).then( () => {
      // ## file was written successfully
      return Promise.resolve();
    }).catch( (err) => {
      debug(`an error occurred writing a chapter file (err: ${err})`);
      return Promise.reject(err);
    });
  });
  // ## waiting for all promised to be finished
  return Promise.all(promises).then( () => {
    // ## all promises finished; writing was successful
    return Promise.resolve();
  }).catch( (err) => {
    // ## there was an error writing the chapter files
    return Promise.reject(err);
  })
}

function _generateEpub(that, path) {
  var archive = archiver("zip", {
    zlib: {
      level: 9
    }
  });
  var output = fs.createWriteStream(path);
  debug("Zipping temp dir to", path);
  archive.file(that.tempBookPath + "/mimetype", {
    store: true,
    name: "mimetype"
  });
  archive.directory(that.tempBookPath + "/META-INF", "META-INF");
  archive.directory(that.tempBookPath + "/OEBPS", "OEBPS");
  archive.pipe(output);
  archive.finalize();
  return new Promise(function(resolve, reject) {
    archive.on("end", function() {
      debug("zipping successfully finished");
      return rimraf(that.tempBookPath, function(err) {
        if (err) return reject(err);
        // ## cleaned without error
        debug("cleaning up temp directory was successful");
        return resolve();
      });
    });
    archive.on("error", function(err) {
      debug(`there was an error generating the epub (err: ${err})`);
      return reject(`there was an error generating the epub (err: ${err})`);
    });
  });
}

function _writeContentOPF(that) {
  return ejs.renderFile(__dirname + '/templates/content.opf.ejs', that.options, null, (err, str) => {
    if(err) return Promise.reject(`an error occurred while trying to write content.opf (err ${err})`);
    return fs.writeFile(that.tempBookPath + "/OEBPS/content.opf", str).then( () => {
      // ## the file was written successfully
      debug(`content.opf file was successfully written`);
      return Promise.resolve();
    }).catch( (err) => {
      debug(`an error occurred writing the content.opf file (err: ${err})`);
      return Promise.reject(err);
    });
  });
}


function _writeTOC(that) {
  return ejs.renderFile(__dirname + '/templates/toc.ncx.ejs', that.options, null, (err, str) => {
    if(err) return Promise.reject(`an error occurred while trying to write toc.ncx (err ${err})`);
    return fs.writeFile(that.tempBookPath + "/OEBPS/toc.ncx", str).then( () => {
      // ## the file was written successfully
      debug(`toc.ncx file was successfully written`);
      return Promise.resolve();
    }).catch( (err) => {
      debug(`an error occurred writing the toc.ncx file (err: ${err})`);
      return Promise.reject(err);
    });
  });
}



// # export for external use
module.exports = Ebook;
