// ==UserScript==
// @match http://candies.aniwey.net/*
// ==/UserScript==

var scriptFunction = function(exports, undefined) {
  var slice = Array.prototype.slice;

  var extend = function(destination) {
    var args = slice.call(arguments, 1);
    for (var i = 0, il = args.length; i < il; ++i) {
      var source = args[i];
      if (!source) {
        continue;
      }
      for (var prop in source) {
        if (source.hasOwnProperty(prop)) {
          destination[prop] = source[prop];
        }
      }
    }
    return destination;
  };

  // write save messages to the page instead of in an alert
  (function() {
    var oldSave = save;
    var saveCallback = function(msg) {
      var code = msg.substring(0, 5);
      var span = $('span#save');
      if (msg === 'Erreur' || code === '<br /') {
        span.html('Error saving');
      } else {
        span.html('You can load your save later <a href="' +
                  'http://candies.aniwey.net/index.php?pass=' +
                  code + '">here</a>.');
      }
    };
    window.save = function() {
      var oldAjax = $.ajax;
      try {
        $.ajax = function(options) {
          if (options && options.url === 'scripts/save.php') {
            options.success = saveCallback;
          }
          oldAjax.call($, options);
        };
        $('span#save').html('Saving...');
        oldSave.apply(null, arguments);
      } finally {
        $.ajax = oldAjax;
      }
    };
  })();
};

var script = document.createElement('script');
script.appendChild(document.createTextNode('(' + scriptFunction + ')(window);\n'));
document.body.appendChild(script);
