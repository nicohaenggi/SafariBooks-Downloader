'use strict';

const Nightmare = require('nightmare');
const logger = require('../logger');

Nightmare.action(
  'flushCookies',
  (name, options, parent, win, renderer, done) => {
    parent.respondTo('flushCookies', done => {
      win.webContents.session.cookies.flushStore(done)
    })
    done()
  },
  function(done) {
    this.child.call('flushCookies', done)
  }
)

const SafariWeb = function SafariWeb(browserDataDir) {
  this.nightmare = Nightmare({
    show: true,
    waitTimeout: 180 * 1000,
    pollInterval: 5000,
    webPreferences: {partition: null},
    paths: {userData: browserDataDir},
    openDevTools: {mode: 'detach'}
  })
}

SafariWeb.prototype.login = function login() {
  return new Promise(function(resolve) {
    this.nightmare
    .on('console', (log, msg) => {
      logger.log(msg)
    })
    .goto('https://safaribooksonline.com')
    .wait(() => {
      return new Promise(function(resolveWait) {
        console.log("Checking if authenticated...")
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function() {
          if (xmlhttp.readyState == XMLHttpRequest.DONE) {   // XMLHttpRequest.DONE == 4
            if (xmlhttp.status == 200) {
              console.log("Authentication successful")
              resolveWait(this.response)
            } else if (xmlhttp.status == 401) {
              console.log("Not authenticated yet")
              resolveWait(false)
            } else {
              console.log("Error while checking")
              resolveWait(false)
            }
          }
        };
        xmlhttp.open("GET", "https://www.safaribooksonline.com/api/v1", true);
        xmlhttp.send();
      })
    })
    .flushCookies()
    .cookies.get()
    .end()
    .then((fetchedCookies) => {resolve(fetchedCookies)})
  }.bind(this))
}

// # export for external use
module.exports = SafariWeb;