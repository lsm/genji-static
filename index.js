/**
 * Module dependencies.
 */

var debug = require('debug')('genji:static');
var fs = require('fs');
var mime = require('mime');
var path = require('path');
var genji = require('genji');
var md5 = genji.crypto.md5;

/**
 * Exports the middleware.
 *
 * @public
 */

module.exports = {

  /**
   * Name of the middleware.
   *
   * @public
   */

  name: 'Static',

  /**
   * Attach a function to the core.
   *
   * @param {Object} core Genji core instance object.
   * @param {Object} options Options for this middleware.
   * @returns {Function}
   * @public
   */

  attach: function (core, options) {
    var staticRoot = options.staticRoot;
    var filter = options.filter;
    if ('string' === typeof filter) {
      filter = new RegExp('^' + filter);
    }
    var filterFn = 'function' === typeof filter ? filter : function (url) {
      return filter.test(url);
    };
    return function (req, res, go) {
      if (!filterFn(req.url)) {
        go();
        return;
      }

      this.addHeader('X-GenjiStatic', 'v1.0');
      var filePath = urlToPath(staticRoot, req.url);

      serveFile(this, filePath, req.headers['if-none-match'], function (error) {
        var statusCode = error.code;
        var ip = req.connection.remoteAddress;
        var msg = '';
        res.writeHead(statusCode, {'Content-Type': 'text/plain'});
        switch (statusCode) {
          case 403:
            msg = 'Permission Denied';
            break;
          case 404:
            msg = 'File Not Found';
            break;
          case 502:
            msg = 'Internal Server Error';
            break;
        }
        res.end(msg);
        log(statusCode, req.url, ip, msg);
      });
    };
  }
};

/**
 * Private functions
 */


/**
 * Convert request url to local file path.
 *
 * @param {String} rootPath Root path of resource directory.
 * @param {String} url Request url.
 * @returns {String}
 *
 * @private
 */

function urlToPath(rootPath, url) {
  if (!rootPath) {
    throw new Error("Path of static root can not be empty.");
  }
  url = decodeURIComponent(url);
  url = url.replace(/\0/g, '');
  url = path.resolve(url);
  var filePath = path.join(rootPath, url);
  return filePath;
}

/**
 * Reads the file stream and writes data to client
 *
 * @param {Context} context genji.Context instance object.
 * @param {String} filePath Absolute path of the file.
 * @param {String} etag The etag string from request header.
 * @param {Function} callback Error handling function.
 * @private
 */

function serveFile(context, filePath, etag, callback) {
  fs.stat(filePath, function (err, stat) {
    if (err) {
      callback({code: 404, error: err});
      return;
    }

    if (!stat.isFile()) {
      callback({code: 403, error: filePath + ' is not a file'});
      return;
    }

    etag = etag || '';
    var _etag = '"' + md5(stat.size + '-' + stat.ino + '-' + Date.parse(stat.mtime)) + '"';

    if (_etag === etag) {
      context.writeHead(304);
      context.end();
      return;
    }

    var contentType = mime.lookup(filePath);
    context.writeHead(200, {
      'content-type': contentType,
      'content-length': stat.size,
      'etag': '"' + _etag + '"'
    });

    // read file only no one alter the status code
    fs.createReadStream(filePath, {'encoding': 'binary'})
      .on('data', function (data) {
        context.write(data, 'binary');
      })
      .on('end', context.end.bind(context))
      .on('error', function (err) {
        callback({code: 502, error: err});
      });
  });
}

function log(statCode, url, ip, err) {
  var logStr = statCode + ' - ' + url + ' - ' + ip;
  if (err) {
    logStr += ' - ' + err;
    debug(logStr);
  }
}