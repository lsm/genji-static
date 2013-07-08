genji-static
============

A static file serving middleware for genji framework.

### Usage

```javascript
var genji = require('genji');

// Create a genji site instance
var site = genji.site();

// Use this plugin
site.use(require('genji-static'), {
  staticRoot: '/home/www/public', // Root path of the static resources
  filter: '/public' // This tell the plugin to handle only the url which starts with '/public'
});

// Start handling request
site.start();
```
