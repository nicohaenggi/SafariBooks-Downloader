// # Safari Downloader
// sets up the safari downloader instance
'use strict';

// # import dependencies
const debug = require('debug')('safari'),
      request = require('request-promise'),
      logger = require('../logger');

/**
* ## Safari Downloader
* sets up the downloader with its base settings
*
* @return {Object} safari - returns a safari object
*/
const Safari = function Safari() {

  // ## prepare base settings
  this.baseUrl = "https://www.safaribooksonline.com";
  this.clientSecret = "f52b3e30b68c1820adb08609c799cb6da1c29975";
  this.clientId = "446a8a270214734f42a7";
  this.books = {};
}

/**
* ## Fetch Stylesheet
* gets the stylesheet for a specified book
*
* @param {String} id - the id of the specified book
*
* @return {String} stylesheet - the content of the stylesheet
*/
Safari.prototype.fetchStylesheet = function fetchStylesheet(id) {
  debug(`fetchStylesheet called with id: ${id}`);
  if(!id) return Promise.reject("id was not specified");
  if(!this.books[id] || !this.books[id].chapters) return Promise.reject("the chapters haven't beeen fetched yet. please call fetchChapters before.");
  // ## sort all stylesheet paths
  var cssSet = new Set();
  this.books[id].chapters.forEach( (chapter) => {
    chapter["stylesheets"].forEach( (style) => {
      cssSet.add(style.url);
    });
  });
  var stylesheetUrl;
  if (cssSet.size > 1) {
    logger.log(`an error occurred while fetching stylesheets. there are ${cssSet.size} different stylesheets. only supporting one. the layout may be different from the one online. sorry for that.`);
    debug(`an error occurred while fetching stylesheets. there are ${cssSet.size} different stylesheets. only supporting one.`);
  } else if(cssSet.size == 1) {
    stylesheetUrl = Array.from(cssSet)[0];
  }
  // ## stylesheet validated
  // ## fetch stylesheet from server and save response
  if(!this.books[id]) this.books[id] = {};
  this.books[id].stylesheet = stylesheetUrl;
  debug(`stylesheet retrieved: ${stylesheetUrl}`);
  Promise.resolve(stylesheetUrl);
}

/**
* ## Authorize User
* authorizes an user with the given credentials and sets the authorization key
*
* @param {String} username - the username of the safaribooksonline account
* @param {String} password - the password of the safaribooksonline account
*
* @return {String} accessToken - returns the access token
*/
Safari.prototype.authorizeUser = function authorizeUser(username, password) {
  debug(`authorizeUser called with user ${username} and password ${password}`);
  if (!username || !password) return Promise.reject("username or password was not specified");
  // ## prepare options for oauth request
  let options = {
    method: 'POST',
    uri: `${this.baseUrl}/oauth2/access_token/`,
    form: {
      "client_id" : this.clientId,
      "client_secret" : this.clientSecret,
      "grant_type" : "password",
      "username" : username,
      "password" : password
    },
    json: true
  };
  // ## make API call in order to retrieve Bearer Authorization Token
  return request(options)
     .then( (body) => {
         // ### the token was successfully generated
         let accessToken = body["access_token"];
         if (!accessToken) {
           debug('the access_token is not present in the server response, even though it returned an 200 OK');
           return Promise.reject("The access_token is not present in the server response. Please contact the developer to fix this problem.")
         }
         this.accessToken = accessToken;
         debug(`the access_token is: ${accessToken}`);
         return Promise.resolve(accessToken);
     })
     .catch( (err) => {
         // ### an error occured
         debug(`an error occured while trying to fetch authorization token (error: ${err})`);
         return Promise.reject(err);
     });
}


/**
* ## Fetch Resource
* fetches a resource with the given url and automatically adds the required authorization token
*
* @param {String} url - the url of the resource to fetch
* @param {Object} options - options for the resource fetch
*
* @return {Object} body - returns the body of the fetched resource
*/
Safari.prototype.fetchResource = function fetchResource(url, options) {
  debug(`fetchResource called with URL: ${url}`);
  if(!url || !this.accessToken) return Promise.reject("url was not specified or user has not been authorized yet");
  // ## prepare options for resource request
  var uri = `${this.baseUrl}/${url}`;
  var json = true;
  var headers = {
    "authorization": `Bearer ${this.accessToken}`
  };
  if(options && options.json == false) json = false;
  if(options && options.uri) uri = options.uri;
  let settings = {
    method: 'GET',
    headers: headers,
    uri: uri,
    json: json
  };
  // ## make request
  return request(settings).then( (body) => {
    // ### the request was successful
    return Promise.resolve(body);
  }).catch( (err) => {
    // ### an error occurred
    debug(`there was an unexpected error fetching the resource (err: ${err})`)
    return Promise.reject(err);
  });
}

/**
* ## Fetch Meta Resource
* fetches the meta resouce of a specific book
*
* @param {String} id - the id of the specified book
*
* @return {Object} body - returns the meta of the fetched  book
*/
Safari.prototype.fetchMeta = function fetchMeta(id) {
  debug(`fetchMeta called with id: ${id}`);
  if(!id) return Promise.reject("id was not specified");
  // ## make meta request
  return this.fetchResource(`api/v1/book/${id}/`).then( (body) => {
    if(!this.books[id]) this.books[id] = {};
    this.books[id].meta = body;
    return Promise.resolve(body);
  });
}


/**
* ## Fetch Table of Content (TOC)
* fetches the flat table of content of the book
*
* @param {String} id - the id of the specified book
*
* @return {Object} body - returns the toc of the fetched  book
*/
Safari.prototype.fetchTOC = function fetchTOC(id) {
  debug(`fetchTOC called with id: ${id}`);
  if(!id) return Promise.reject("id was not specified");
  // ## make TOC request
  return this.fetchResource(`api/v1/book/${id}/flat-toc/`).then( (body) => {
    if(!this.books[id]) this.books[id] = {};
    // ## make object with the url as key in order for easier retrievement later
    var toc = {};
    body.forEach( (chapToc) => {
      toc[chapToc.url] = chapToc;
    });
    this.books[id].toc = toc;
    return Promise.resolve(toc);
  });
}


/**
* ## Fetch Chapters
* fetches the chapters of the book
*
* @param {String} id - the id of the specified book
*
* @return {Object} body - returns the chapters of the fetched book
*/
Safari.prototype.fetchChapters = function fetchChapters(id) {
  debug(`fetchChapters called with id: ${id}`);
  if(!id) return Promise.reject("id was not specified");
  if(!this.books[id] || !this.books[id].meta || !this.books[id].toc) return Promise.reject("the book meta has not been fetched yet");
  // ## fetch chapter meta data
  let promises = this.books[id].meta.chapters.map( (chapterUrl) => {
    return this.fetchResource(chapterUrl, { uri: chapterUrl }).then( (chapterMeta) => {
      if(!chapterMeta.content) return Promise.reject("the books 'content' key is missing from the response.");
      // ### chapter meta fetched successfully
      // ### fetch chapter content for now
      return this.fetchResource(chapterMeta.content, { uri: chapterMeta.content, json: false }).then( (chapterContent) => {
        chapterMeta["added_chapter_content"] = chapterContent;
        let chapToc = this.books[id].toc[chapterMeta.url];
        // ## ignore if it is not part of the toc file; will not be added to the content
        if(chapToc) {
          chapterMeta["added_order"] = chapToc.order;
          chapterMeta["added_id"] = chapToc.id;
        } else {
          // ## it must be a TOC file, add order 0 and id tocxhtml
          chapterMeta["added_order"] = 0;
          chapterMeta["added_id"] = "tocxhtmlfile";
        }
        return Promise.resolve(chapterMeta);
      });
    });
  });
  return Promise.all(promises).then( (body) => {
    debug('successfully fetched all the chapters content');
    if(!this.books[id]) this.books[id] = {};
    this.books[id].chapters = body;
    return Promise.resolve(body);
  });
}

/**
* ## Get Book
* returns the book
*
* @param {String} id - the id of the specified book
*
* @return {Object} body - returns the book
*/
Safari.prototype.getBookById = function getBookById(id) {
  debug(`getBookById called with id: ${id}`);
  if(!id) return Promise.reject("id was not specified");
  if(!this.books[id]) return Promise.reject("the book you requested was not fetched yet");
  let book = this.books[id];
  if(!book.meta || !book.chapters) return Promise.reject("the book you requested is missing some required information");
  let jsonBook = {
    "title": book.meta.title,
    "uuid": book.meta.identifier,
    "language": book.meta.language,
    "author": book.meta.authors.map( (json) => {
      return json.name;
    }),
    "cover": book.meta.cover,
    "description": book.meta.description,
    "publisher": book.meta.publishers.map( (json) => {
      return json.name;
    }),
    "stylesheet": book.stylesheet,
    "chapters": book.chapters.map( (chapter) => {
      return {
        "fileName": chapter.filename,
        "assetBase": chapter["asset_base_url"],
        "images": chapter["images"],
        "title": chapter.title,
        "content": chapter["added_chapter_content"],
        "id": chapter["added_id"],
        "order": chapter["added_order"]
      };
    })
  }
  return Promise.resolve(jsonBook);
}

/**
* ## Fetch Book
* returns the book content
*
* @param {String} id - the id of the specified book
* @param {String} username - the username of the safaribook user
* @param {String} password - the password of the safaribook user
*
* @return {Object} body - returns the book json
*/
Safari.prototype.fetchBookById = function fetchBookById(id, username, password) {
  debug(`fetchBookById called with id: ${id}`);
  if(!id) return Promise.reject("id was not specified");
  if(!username || !password) return Promise.reject("username or password was not specified");
  // ## validation successful
  // ## fetch required content
  return this.authorizeUser(username, password).then( (accessToken) => {
    // ### user authorized, fetch meta
    logger.log(`the user "${username}" was successfully authorized...`);
    return this.fetchMeta(id);
  }).then( (meta) => {
    // ### meta fetched; fetch flat-toc
    logger.log(`downloaded meta files...`);
    return this.fetchTOC(id);
  }).then( (toc) => {
    // ### TOC fetched; fetch chapters
    logger.log(`downloaded table of content files...`);
    return this.fetchChapters(id);
  }).then( (chapters) => {
    // ### chapters fetched; fetch stylesheet
    logger.log(`downloaded chapter files...`);
    return this.fetchStylesheet(id);
  }).then( (stylesheet) => {
    // ### stylesheet fetched; prepare book json
    logger.log(`downloaded stylesheet files...`);
    return this.getBookById(id);
  }).then( (json) => {
    return Promise.resolve(json);
  }).catch( (err) => {
    return Promise.reject(err);
  });
}

// # export for external use
module.exports = Safari;
