// # Ebook Writer
// generates an ebook in .epub format
'use strict';

// # import dependencies
const debug = require('debug')('ebook-writer');

/**
* ## eBook Writer
* sets up the ebook writer with its base settings
*
* @return {Object} ebook - returns a ebook object
*/
const Ebook = function Ebook(options) {

  // ## prepare base settings
  this.tempPath = "../../books/";
}

// # export for external use
module.exports = Ebook;
