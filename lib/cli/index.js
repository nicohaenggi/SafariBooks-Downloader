// # Command Line Interface
// sets up the Command Line Interface
'use strict';

const program = require('commander');
const logger = require('../logger');
const Safari = require('../safari');
const EbookWriter = require('../ebook-writer');
const debug = require('debug')('cli');
const fs = require('fs-promise');

// ## Commander Initialization
// specifying CLI options and version
program
  .version("1.0.0")
  .option('-b, --bookid <bookid>','the book id of the SafariBooksOnline ePub to be generated')
  .option('-u, --username <username>','username of the SafariBooksOnline user - must have a **paid/trial membership**, otherwise will not be able to access the books')
  .option('-p, --password <password>','password of the SafariBooksOnline user')
  .option('-o, --output <output>','output path the epub file should be saved to')
  .parse(process.argv);

var username, password;

// ## see whether .credentials already exists
  if (fs.existsSync(__dirname + '/.credentials')) {
    var credentials = JSON.parse(fs.readFileSync(__dirname + '/.credentials', 'utf-8'));
    username = credentials.username;
    password = credentials.password;
    debug("there is an existing user cached with username: " + username);
}

// ## overwrite username and password if specified
if(program.username) username = program.username;
if(program.password) password = program.password;

// ## Validate Input
if(!program.bookid) return console.log("error: option '-b' missing. please consider '--help' for more information.");
if(!username) return console.log("error: option '-u' missing. please consider '--help' for more information.");
if(!password) return console.log("error: option '-p' missing. please consider '--help' for more information.");
if(!program.output) return console.log("error: option '-o' missing. please consider '--help' for more information.");

// ## Starting CLI
logger.log(`starting application...`);

// ## writing credentials to file
let json = JSON.stringify({ "username": username, "password": password });
fs.writeFile(__dirname + '/.credentials', json).then( () => {
  debug(`the username and password were successfully cached`);
}).catch( (err) => {
  debug(`an error occurred trying to write the username and pass to the cache file`);
});

// ## Authorize User
var safariClient = new Safari();
safariClient.fetchBookById(program.bookid, username, password).then( (bookJSON) => {
  // console.log(bookJSON);
  var ebook = new EbookWriter(bookJSON);
  return ebook.save(program.output);
}).then( () => {
  // ## finished saving
  debug("the epub was successfully saved");
  logger.log("epub successfully saved. exiting...");
}).catch( (err) => {
  logger.log(err);
});
