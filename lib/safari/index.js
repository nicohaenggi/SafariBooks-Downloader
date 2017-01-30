// # Safari Downloader
// sets up the safari downloader instance
'use strict';

// # import dependencies
const debug = require('debug')('safari'),
      request = require('request-promise');

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
  request(options)
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
*
* @return {Object} body - returns the body of the fetched resource
*/
Safari.prototype.fetchResource = function fetchResource(url) {
  debug(`fetchResource called with URL: ${url}`);
  if(!url || !this.accessToken) return Promise.reject("url was not specified or user has not been authorized yet");
  // ## prepare options for resource request
  let options = {
    method: 'GET',
    headers: {
      "authorization": `Bearer ${this.accessToken}`
    },
    uri: `${this.baseUrl}/${url}`
  }
  // ## make request
  request(options).then( (body) => {
    // ### the request was successful
    return Promise.resolve(body);
  }).catch( (err) => {
    // ### an error occurred
    debug(`there was an unexpected error fetching the resource (err: ${err})`)
    return Promise.reject(err);
  });
}

// # export for external use
module.exports = Safari;
