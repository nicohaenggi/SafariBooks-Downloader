// # Ebook Writer
// generates an ebook in .epub format
'use strict';

// # import dependencies
const debug = require('debug')('ebook-writer');
const fs = require('fs-promise');
const ejs = require('ejs');

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
  let chapterPromise = _writeChapters(this).then( () => {

  }).catch( (err) => {
    console.log(err);
  });
  let contentPromise = _writeContentOPF(this);
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

function _writeContentOPF(that) {
  return ejs.renderFile(__dirname + '/templates/content.opf.ejs', that.options, null, (err, str) => {
    if(err) return Promise.reject(`an error occurred while trying to write content.opf (err ${err})`);
    return fs.writeFile(that.tempBookPath + "/OEBPS/content.opf", str).then( () => {
      // ## the file was written successfully
      return Promise.resolve();
    }).catch( (err) => {
      debug(`an error occurred writing the content.opf file (err: ${err})`);
      return Promise.reject(err);
    });
  });
}



// # export for external use
module.exports = Ebook;
