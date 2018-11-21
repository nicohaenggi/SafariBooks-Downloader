#!/usr/bin/env node

// # Application Bootup
// boots up the application

// defines that javascript should be executed in 'strict mode' (ECMAScript 5)
'use strict';

// # Initialise CLI
// imports the Command Line Interface (CLI) in order to make the application work
module.exports = require('./lib/cli/index.js');

// # Closing Application
// make sure the manager gets stopped
process.on( 'SIGINT', function() {
  process.exit( );
});
