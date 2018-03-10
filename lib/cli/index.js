// # Command Line Interface
// sets up the Command Line Interface
'use strict';

const program = require('commander');
const logger = require('../logger');
const Safari = require('../safari');
const SafariWeb = require('../safari-web');
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
  .option('-w, --weblogin', 'use web browser to authenticate instead of username/password - useful for Single Sign On (SSO)')
  .option('-c, --clear', 'clear previously cached credentials/cookies')
  .option('-o, --output <output>','output path the epub file should be saved to')
  .parse(process.argv);

const browserDataDir = process.cwd() + '/.browser-data'
const cookiesFile = process.cwd() + '/.cookies-file'
const credentialsFile = process.cwd() + '/.credentials'

if(program.clear) {
  logger.log("Deleting cached credentials/cookies")
  if(fs.existsSync(credentialsFile))
    fs.removeSync(credentialsFile);
  if(fs.existsSync(cookiesFile))
    fs.removeSync(cookiesFile);
  if(fs.existsSync(browserDataDir))
    fs.removeSync(browserDataDir);
  logger.log("Deleted successfully")
}

var username, password, cookies;

// ## see whether .credentials already exists
if (fs.existsSync(credentialsFile)) {
  var credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'));
  username = credentials.username;
  password = credentials.password;
  debug("there is an existing user cached with username: " + username);
}

if (fs.existsSync(cookiesFile)) {
  cookies = JSON.parse(fs.readFileSync(cookiesFile, 'utf-8'));
  debug("there is an existing cached cookie file");
}

// ## overwrite username and password if specified
if(program.username) username = program.username;
if(program.password) password = program.password;

// ## Validate Input
if(!program.bookid) return console.log("error: option '-b' missing. please consider '--help' for more information.");
if(!program.output) return console.log("error: option '-o' missing. please consider '--help' for more information.");
if(!program.weblogin && (!username || !password)) {
  console.log("warning: option '-u' and '-p' missing. please consider '--help' for more information.")
  console.log("Falling back to web login...");
  program.weblogin = true
}

if(program.weblogin) {
  if(cookies) {
    console.log("Using cached cookies")
    start()
  } else {
    var safariWebClient = new SafariWeb(browserDataDir);
    safariWebClient.login().then(fetchedCookies => {
      cookies = fetchedCookies;
      start()
    })
  }
} else {
  start()
}

function start() {
  // ## Starting CLI
  logger.log(`starting application...`);
  // ## writing credentials to file
  if(program.weblogin) {
    let json = JSON.stringify(cookies);
    fs.writeFile(cookiesFile, json).then(() => {
      debug(`cookies were successfully cached`);
    }).catch( (err) => {
      debug(`an error occurred trying to write cookies to the cache file`);
    });
  } else {
    let json = JSON.stringify({ "username": username, "password": password });
    fs.writeFile(credentialsFile, json).then( () => {
      debug(`the username and password were successfully cached`);
    }).catch( (err) => {
      debug(`an error occurred trying to write the username and pass to the cache file`);
    });
  }

  // ## Authorize User
  var safariClient = new Safari();
  safariClient.fetchBookById(program.bookid, username, password, cookies, program.weblogin).then( (bookJSON) => {
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
}
