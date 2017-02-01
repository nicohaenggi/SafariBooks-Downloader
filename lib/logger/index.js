// # Logger Instance
// sets up the logging instance for the application
'use strict';

const name = "safari-downloader";

/**
* ## Log message
* logs a specified message to the console
*
* @param {String} message - the message to be logged to the console
*/
var log = function log(message) {
  console.log(`[${name}] ${message}`);
}

// # export for use elsewhere
module.exports = {
  log: log
}
