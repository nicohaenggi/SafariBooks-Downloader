// # Ebook Writer
// generates an ebook in .epub format
'use strict';

// # import dependencies
const debug = require('debug')('ebook-writer');
const fs = require('fs');

/**
* ## eBook Writer
* sets up the ebook writer with its base settings
*
* @param {Object} options - the options for the ebook (e.g. content, title, name, etc.)
* @param {Object} outputPath - the path the ebook should be written to
*
* @return {Object} ebook - returns a ebook object
*/
const Ebook = function Ebook(options, outputPath) {

  // ## prepare base settings
  this.tempPath = "books";
  this.options = options || {};
  if(!this.options["uuid"]) return debug("the book is missing a uuuid. can not continue without.");
  this.tempBookPath = `${this.tempPath}/${this.options["uuid"]}/`;
  this.outputPath = outputPath || "/ebook.epub";

  // ## prepare ebook folders
  if(!_prepareFolder(this)) debug("an error occurred while trying to prepare the folder structure. make sure to have a correct options parameter.");
  if(!_writeMimeType(this)) debug("an error occurred while trying to write the mimetype.");
}

function _prepareFolder(that) {
  debug(`folder structure will be prepared in temp folder`);
  fs.existsSync(that.tempPath) || fs.mkdirSync(that.tempPath);
  fs.existsSync(that.tempBookPath) || fs.mkdirSync(that.tempBookPath);
  fs.existsSync(`${that.tempBookPath}/META-INF`) || fs.mkdirSync(`${that.tempBookPath}/META-INF`);
  fs.existsSync(`${that.tempBookPath}/OEBPS`) || fs.mkdirSync(`${that.tempBookPath}/OEBPS`);
  return true;
}

function _writeMimeType(that) {
  fs.writeFileSync(that.tempBookPath + "mimetype", "application/epub+zip");
  debug(`mimetype file was successfully written`);
  return true;
}

// # export for external use
module.exports = Ebook;
