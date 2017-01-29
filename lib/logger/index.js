// # Logger Instance
// sets up the logging instance for the application
'use strict';

const name = "safari-downloader";

var log = function log(message) {
  console.log(`[${name}] ${message}`);
}

// # export for use elsewhere
module.exports = {
  log: log
}
