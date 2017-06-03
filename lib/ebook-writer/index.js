// # Ebook Writer
// generates an ebook in .epub format
'use strict';

// # import dependencies
const debug = require('debug')('ebook-writer');
const fs = require('fs-promise');
const ejs = require('ejs');
const archiver = require('archiver');
const rimraf = require('rimraf');
const download = require('download');
const mime = require('mime');

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
  if(!this.options.uuid) return debug("the book is missing a uuuid. cannot continue without.");
  this.tempBookPath = `${this.tempPath}/${this.options.uuid}`;

  // ## prepare ebook folders
  if(!_prepareFolder(this)) debug("an error occurred while trying to prepare the folder structure. make sure to have a correct options parameter.");
  if(!_writeMimeType(this)) debug("an error occurred while trying to write the mimetype.");
  if(!_writeContainer(this)) debug("an error occurred while trying to write the container.xml.");

  // ## prepare images
  _prepareImages(this);
}

/**
* ## eBook Saver
* saves the epub to the specified path
*
* @param {String} outputPath - the path the ebook should be written to
*
* @return {Promise} success - returns whether the save was successful or not
*/
Ebook.prototype.save = function save(outputPath) {
  let path = outputPath || "ebook.epub";
  // ## save chapter files; generate opf; and create toc file
  let chapterPromise = _writeChapters(this);
  let contentPromise = _writeContentOPF(this);
  let tocPromise = _writeTOC(this);
  let coverPromise = _downloadCoverImage(this);
  let cssPromise = _writeCSS(this);
  let stylesheetPromise = _downloadStylesheet(this);
  let imagesPromises = _downloadImages(this);
  // ## wait until all promises are finished before saving and zipping the ebook
  return Promise.all([chapterPromise, contentPromise, tocPromise, coverPromise, cssPromise, stylesheetPromise, imagesPromises]).then( () => {
    // ## all promises finished; generate and zip ebook
    return _generateEpub(this, path);
  }).then( (sdsd) => {
    // ## the ebook was successfully created
    return Promise.resolve("the ebook was successfully created");
  }).catch( (err) => {
    // ## an error occurred writing the epub
    debug(`an error occurred while trying to save the ebook (err ${err})`);
    return Promise.reject(err);
  });
}

/**
* ## Create Chapters
* saves the chapter files to the OEBPS directory
*
* @param {Object} that - the ebook object
*
* @return {Promise} success - returns whether the save was successful or not
*/
function _writeChapters(that) {
  // ## validate input
  if(!that.options.chapters) return Promise.reject("there is no content to be written.");
  // ## create a promise for each individual chapter file to be saved
  let promises = that.options.chapters.map( (chapter) => {
    if(!chapter.fileName) return Promise.reject("there is no filename for the chapter.");
    // ### prepare the wrapper that encloses the chapter html content
    // ### replace the image source with the new local source
    var chapterContent = chapter.content;
    chapter.images.forEach( (image) => {
      var re = new RegExp(`"[^"]*${image}"`, 'g');
      let pathArray = image.split('/');
      var newLocation = image;
      if(pathArray.length > 1) {
        // ### overwriting new path
        newLocation = pathArray[pathArray.length -1];
      }
      chapterContent = chapterContent.replace(re, `"images/${newLocation}"`);
    });
    var coreCSS = "";
    if(that.options.stylesheet) {
      coreCSS = `<link type="text/css" rel="stylesheet" media="all" href="core.css" />`;
    }
    // ## purify html
    chapterContent = _purifyHTML(chapterContent);
    let fileContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:m="http://www.w3.org/1998/Math/MathML" xmlns:pls="http://www.w3.org/2005/01/pronunciation-lexicon" xmlns:ssml="http://www.w3.org/2001/10/synthesis" xmlns:svg="http://www.w3.org/2000/svg">
<head>
  <meta charset="UTF-8" />
  <title>${chapter.title}</title>
  <link type="text/css" rel="stylesheet" media="all" href="style.css" />
  ${coreCSS}
</head>
<body>
  ${chapterContent}
</body>
</html>`;
    // ### write the chapter file into the OEBPS directory with the chapter fileName
    return fs.writeFile(that.tempBookPath + "/OEBPS/" + chapter.fileName, fileContent).then( () => {
      // #### the file was successfully written to the directory
      return Promise.resolve();
    }).catch( (err) => {
      // #### an error occurred writing a chapter file
      debug(`an error occurred writing a chapter file (err: ${err})`);
      return Promise.reject(err);
    });
  });
  // ## waiting for all chapter files to be saved
  return Promise.all(promises).then( () => {
    // ## all promises finished; saving was successful
    debug('all chapter files have been saved successfully');
    return Promise.resolve();
  }).catch( (err) => {
    // ## there was an error writing the chapter files
    debug(`an error occurred writing the chapter files (err: ${err})`);
    return Promise.reject(err);
  })
}

/**
* ## Generate and save epub
* generates and saves the epub book
*
* @param {Object} that - the ebook object
* @param {String} path - the path the ebook should be saved to
*
* @return {Promise} success - returns whether the save was successful or not
*/
function _generateEpub(that, path) {
  // ## prepare the archiver for the epub
  var archive = archiver("zip", {
    zlib: {
      level: 9
    }
  });
  var output = fs.createWriteStream(path);
  debug("Zipping temp dir to", path);
  // ## zip the mimetype to come first in the archive
  archive.file(that.tempBookPath + "/mimetype", {
    store: true,
    name: "mimetype"
  });
  // ## zip the remaining directories
  archive.directory(that.tempBookPath + "/META-INF", "META-INF");
  archive.directory(that.tempBookPath + "/OEBPS", "OEBPS");
  archive.pipe(output);
  archive.finalize();
  return new Promise(function(resolve, reject) {
    archive.on("end", function() {
      // ## the zipping was successfull; clean temp directory now
      debug("zipping successfully finished");
      return rimraf(that.tempBookPath, function(err) {
        if (err) return reject(err);
        // ## cleaned without error
        debug("cleaning up temp directory was successful");
        return resolve();
      });
    });
    archive.on("error", function(err) {
      // ## an unknown error occurred zipping the epub
      debug(`there was an error generating the epub (err: ${err})`);
      return reject(`there was an error generating the epub (err: ${err})`);
    });
  });
}

/**
* ## Prepares folder structure
* prepares the temporary folder structure
*
* @param {String} that - the ebook object
*
* @return {Boolean} success - returns whether the creation was successful or not
*/
function _prepareFolder(that) {
  debug(`folder structure will be prepared in temp folder`);
  // ## create temp folder
  // ## using existsSync and mkdirSync on purpose; might consider using async in the future
  fs.existsSync(that.tempPath) || fs.mkdirSync(that.tempPath);
  fs.existsSync(that.tempBookPath) || fs.mkdirSync(that.tempBookPath);
  // ## create temp book folder with subfolders
  fs.existsSync(`${that.tempBookPath}/META-INF`) || fs.mkdirSync(`${that.tempBookPath}/META-INF`);
  fs.existsSync(`${that.tempBookPath}/OEBPS`) || fs.mkdirSync(`${that.tempBookPath}/OEBPS`);
  fs.existsSync(`${that.tempBookPath}/OEBPS/images`) || fs.mkdirSync(`${that.tempBookPath}/OEBPS/images`);
  return true;
}

/**
* ## Mimetype creator
* creates the required mimetype file for the ebook in the primary folder
*
* @param {String} that - the ebook object
*
* @return {Boolean} success - returns whether the creation was successful or not
*/
function _writeMimeType(that) {
  // ## using writeFileSync on purpose; might consider using async in the future
  fs.writeFileSync(that.tempBookPath + "/mimetype", "application/epub+zip");
  debug(`mimetype file was successfully written`);
  return true;
}

/**
* ## Container.xml creator
* creates the container.xml file in the META-INF directory
*
* @param {String} that - the ebook object
*
* @return {Boolean} success - returns whether the creation was successful or not
*/
function _writeContainer(that) {
  // ## prepare the container.xml string
  let container = `<?xml version="1.0" encoding="UTF-8" ?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>`
  // ## write the container.xml file to the META-INF directory
  // ## using writeFileSync on purpose; might consider using async in the future
  fs.writeFileSync(that.tempBookPath + "/META-INF/container.xml", container);
  debug(`container.xml file was successfully written`);
  return true;
}

/**
* ## Content.opf creator
* creates the content.opf file in the OEBPS directory
*
* @param {String} that - the ebook object
*
* @return {Promise} success - returns whether the creation was successful or not
*/
function _writeContentOPF(that) {
  // ## render ejs content.opf file
  return ejs.renderFile(__dirname + '/templates/content.opf.ejs', that.options, null, (err, str) => {
    if(err) return Promise.reject(`an error occurred while trying to write content.opf (err ${err})`);
    return fs.writeFile(that.tempBookPath + "/OEBPS/content.opf", str).then( () => {
      // ## the file was written successfully
      debug(`content.opf file was successfully written`);
      return Promise.resolve();
    }).catch( (err) => {
      // ## there was an error writing the content.opf file
      debug(`an error occurred writing the content.opf file (err: ${err})`);
      return Promise.reject(err);
    });
  });
}

/**
* ## Toc.ncx creator
* creates the toc.ncx file in the OEBPS directory
*
* @param {String} that - the ebook object
*
* @return {Promise} success - returns whether the creation was successful or not
*/
function _writeTOC(that) {
  // ## render the ejs toc.ncx file
  return ejs.renderFile(__dirname + '/templates/toc.ncx.ejs', that.options, null, (err, str) => {
    if(err) return Promise.reject(`an error occurred while trying to write toc.ncx (err ${err})`);
    return fs.writeFile(that.tempBookPath + "/OEBPS/toc.ncx", str).then( () => {
      // ## the file was written successfully
      debug(`toc.ncx file was successfully written`);
      return Promise.resolve();
    }).catch( (err) => {
      // ## there was an error writing the toc.ncx file
      debug(`an error occurred writing the toc.ncx file (err: ${err})`);
      return Promise.reject(err);
    });
  });
}

/**
* ## style.css creator
* creates the style.css file in the OEBPS directory
*
* @param {String} that - the ebook object
*
* @return {Promise} success - returns whether the creation was successful or not
*/
function _writeCSS(that) {
  // ## render the style.css.ejs file
  return ejs.renderFile(__dirname + '/templates/style.css.ejs', that.options, null, (err, str) => {
    if(err) return Promise.reject(`an error occurred while trying to write style.css (err ${err})`);
    return fs.writeFile(that.tempBookPath + "/OEBPS/style.css", str).then( () => {
      // ## the file was written successfully
      debug(`style.css file was successfully written`);
      return Promise.resolve();
    }).catch( (err) => {
      // ## there was an error writing the style.css file
      debug(`an error occurred writing the style.css file (err: ${err})`);
      return Promise.reject(err);
    });
  });
}

/**
* ## Cover downloader
* downloads and saves the cover image
*
* @param {String} that - the ebook object
*
* @return {Promise} success - returns whether the creation was successful or not
*/
function _downloadCoverImage(that) {
  return download(that.options.cover).then( (data) => {
    debug(`cover image successfully fetched`);
    // ## writing the file to the images directory
    // ## using writeFileSync on purpose; might be using async in the future
    fs.writeFileSync(that.tempBookPath + "/OEBPS/images/cover.jpg", data);
    return Promise.resolve();
  }).catch( (err) => {
    debug(`an error occurred while trying to download the cover image (err: ${err})`);
    return Promise.reject(err);
  });
}

/**
* ## Stylesheet downloader
* downloads and saves the stylesheet
*
* @param {String} that - the ebook object
*
* @return {Promise} success - returns whether the creation was successful or not
*/
function _downloadStylesheet(that) {
  if(!that.options.stylesheet) return Promise.resolve();
  return download(that.options.stylesheet).then( (data) => {
    debug(`stylesheet successfully fetched`);
    // ## writing the file to the OEBPS directory
    // ## using writeFileSync on purpose; might be using async in the future
    fs.writeFileSync(that.tempBookPath + "/OEBPS/core.css", data);
    return Promise.resolve();
  }).catch( (err) => {
    debug(`an error occurred while trying to download the stylesheet (err: ${err})`);
    return Promise.reject(err);
  });
}

/**
* ## Prepare images
* prepares all the images to be fetched
*
* @param {String} that - the ebook object
*
* @return {Boolean} success - returns whether the creation was successful or not
*/
function _prepareImages(that) {
  var images = [];
  that.options.chapters.forEach( (chapter) => {
    let baseUrl = chapter.assetBase;
    chapter.images.forEach( (image) => {
      // ## see whether there is a need for creating additional directories
      let pathArray = image.split('/');
      var newLocation = image;
      if(pathArray.length > 1) {
        // ### overwriting new path
        newLocation = pathArray[pathArray.length -1];
      }
      images.push({ baseUrl: baseUrl, file: image, media: mime.lookup(image), path: newLocation });
    });
  });
  that.options.imagesToFetch = images;
  return true;
}

/**
* ## Download images
* downloads all the image assets
*
* @param {String} that - the ebook object
*
* @return {Promise} success - returns whether the creation was successful or not
*/
function _downloadImages(that) {
  if(!that.options.imagesToFetch) return Promise.reject("there are no images to be fetched yet; prepare first");
  return Promise.all(that.options.imagesToFetch.map( (image) => {
    return download(image.baseUrl + image.file).then( (data) => {
      // ## the image was successfully downloded, writing to image path
      debug(`${image.file} successfully fetched`);
      // ## writing the file to the images directory
      // ## using writeFileSync on purpose; might be using async in the future
      let path = that.tempBookPath + "/OEBPS/images/" + image.path;
      fs.writeFileSync(path, data);
      return Promise.resolve();
    });
  })).then( () => {
    // ## the downloading was successfully finished
    debug('all assets were successfully downloaded');
    return Promise.resolve();
  }).catch( (err) => {
    // ## there was an error fetching all images
    debug(`an error occurred trying to download all the image assets (err: ${err})`);
    return Promise.reject(`an error occurred while trying to download all the image assets (err: ${err})`);
  });
}

/**
* ## Purify HTML
* returns a purified version of html
*
* @param {String} that - the ebook object
*
* @return {Promise} success - returns whether the creation was successful or not
*/
function _purifyHTML(string) {
  // area,base,basefont,br,col,frame,hr,img,input,isindex,keygen,link,meta,menuitem,source,track,param,embed,wbr
  // <(\s?img[^>]*[^\/])>
  ["img"].forEach( (tag) => {
    var re = new RegExp("<(\s?" + tag + "[^>]*[^\/])>", 'g');
    string = string.replace(re, "<$1 />");
  });
  ["br", "hr"].forEach( (tag) => {
    var re = new RegExp("<\s?" + tag + "[^>]*>", "g");
    string = string.replace(re, `<${tag}/>`);
  });
  return string;
}

// # export for external use
module.exports = Ebook;
