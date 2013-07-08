/**
 * File module plugin for context
 */

/**
 * Module dependencies.
 */

var fs = require('fs');
var mime = require('../mime');
var extname = require("path").extname;
var md5 = require('../crypto').md5;
var extend = require('../util').extend;

/**
 * Module exports
 *
 * @type {{name: String, module: Object}}
 * @public
 */

module.exports = {

  /**
   * Name of the plugin
   */

  name: "File",

  /**
   * File module object
   *
   * @public
   */

  module: {

    /**
     * Reads the file stream and writes data to client
     *
     * @param {String} filePath Absolute path of the file
     * @param {String} [etag] Set the etag other than generate from inode info
     * @param {Function} [errback] Error handling function, default response 404 to the client
     * @public
     */

    staticFile: function (filePath, etag, errback) {
      var self = this;
      if ("function" === typeof etag) {
        errback = etag;
        etag = null;
      }
      var errback_ = function (err) {
        (errback || function (err) {
          self.error(404, 'File not found');
          console.error(err.stack || err);
        }).call(self, err);
      };

      fs.stat(filePath, function (err, stat) {
        if (err || !stat.isFile()) {
          errback_(err || filePath + ' is not a file');
          return;
        }

        var contentType = mime.lookup(extname(filePath));
        self.writeHead(200, {
          'content-type': contentType,
          'content-length': stat.size,
          'etag': '"' + (etag || md5(stat.size + '-' + stat.ino + '-' + Date.parse(stat.mtime))) + '"'
        });

        if (self.response.statusCode !== 200) {
          return;
        }
        // read file only no one alter the status code
        fs.createReadStream(filePath, {'encoding': 'binary'})
          .on('data', function (data) {
            self.write(data, 'binary');
          })
          .on('end', self.end.bind(self))
          .on('error', errback_);
      });
    },

    /**
     * Send content as file
     *
     * @param {String} content The content need to send or a function which can feed the content:
     * @param {Object} [meta] Meta info of file
     *  {
     *      type: 'image/jpeg', // http content type
     *      length: 300, // http content length
     *      ext: '.jpg', // file extension
     *  }
     * @param {Object} [headers] Additional http headers
     * @public
     */

    sendAsFile: function (content, meta, headers) {
      var meta_ = meta || {};
      var encoding = meta_.encoding || 'binary';
      var header = extend({
        'content-type': meta_.type || mime.lookup(meta_.ext || ''),
        'content-length': meta_.length || (Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, encoding)),
        'etag': '"' + (meta_.etag || md5(content)) + '"'
      }, headers);
      // write http header and test if we need to send the content
      this.writeHead(200, header);
      if (this.response.statusCode === 200) {
        this.end(content, encoding);
      }
    }
  }
};


describe('uses file plugin', function () {
    var crypto = genji.crypto;
    var fs = require('fs');
    var FileContext = Context(genji.plugin.file.module);

    it('should be able to serve static file', function (done) {
      router.get('^/test/static/file.js$', function (context) {
        context.staticFile(__filename);
      });

      router.listen(server, FileContext);

      request(server)
        .get('/test/static/file.js')
        .expect('Content-Type', 'application/javascript')
        .expect(200)
        .end(function (err, res) {
          if (err) {
            throw err;
          }
          crypto.md5file(__filename, 'hex', function (err, hash) {
            assert.equal(null, err);
            assert.equal(hash, crypto.md5(res.text, 'hex'));
            done();
          });
        });
    });

    it('should send data as file content', function (done) {
      router.get('^/test/send/as/file.js$', function (context) {
        fs.readFile(__filename, 'utf8', function (err, data) {
          if (!err) {
            context.sendAsFile(data, {ext: '.js'});
          }
        });
      });

      router.listen(server, FileContext);

      request(server)
        .get('/test/send/as/file.js')
        .expect('Content-Type', 'application/javascript')
        .expect(200)
        .end(function (err, res) {
          if (err) {
            throw err;
          }
          crypto.md5file(__filename, 'hex', function (err, hash) {
            assert.equal(err, null);
            assert.equal(crypto.md5(res.text, 'hex'), hash);
            done();
          });
        });
    });
  })
