// # Command Line Interface
// sets up the Command Line Interface
'use strict';

const program = require('commander');
const logger = require('../logger');
const Safari = require('../safari');

// ## Commander Initialization
// specifying CLI options and version
program
  .version("1.0.0")
  .option('-b, --bookid <bookid>','input file .xls/.xlsx to be mapped')
  .option('-u, --username <username>','username of the safaribooks account')
  .option('-p, --password <password>','password for the safaribooks user')
  .option('-o, --output <output>','output path to be written to (with or without .epub) - will be automatically added')
  .parse(process.argv);

// ## Validate Input
if(!program.bookid) return console.log("error: option '-b' missing. please consider '--help' for more information.");
if(!program.username) return console.log("error: option '-u' missing. please consider '--help' for more information.");
if(!program.password) return console.log("error: option '-p' missing. please consider '--help' for more information.");
if(!program.output) return console.log("error: option '-o' missing. please consider '--help' for more information.");

// ## Starting CLI
logger.log(`starting application...`);

// ## Authorize User
var safariClient = new Safari();
safariClient.fetchBookById("9780470524527", "johncracker", "johncrackerN*").then( (bookJSON) => {
  console.log(bookJSON);
}).catch( (err) => {
  logger.log(err);
});
