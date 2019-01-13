// # Command Line Interface
// sets up the Command Line Interface
'use strict';

const logger = require('../logger');
const Safari = require('../safari');
const EbookWriter = require('../ebook-writer');
const debug = require('debug')('cli');
const fs = require('fs-promise');


// ## see whether .cookie already exists
if (!fs.existsSync(__dirname + '/../../.config')) {
  logger.log("Please create the configuration file");
  return;
} else {
  var config = JSON.parse(fs.readFileSync(__dirname + '/../../.config', 'utf-8'));
}

const { bookid, cookie } = config;

logger.log(`cookie ${cookie}`);
logger.log(`bookid ${bookid}`);

// ## Authorize User
var safariClient = new Safari(cookie);
safariClient.fetchBookById(bookid).then( (bookJSON) => {
  // console.log(bookJSON);
  var ebook = new EbookWriter(bookJSON);
  logger.log(__dirname + '/../../books/' + bookJSON.title + '.epub');
  return ebook.save(__dirname + '/../../books/' + bookJSON.title + '.epub');
}).then( () => {
  // ## finished saving
  debug("the epub was successfully saved");
  logger.log("epub successfully saved. exiting...");
}).catch( (err) => {
  logger.log(err);
});
