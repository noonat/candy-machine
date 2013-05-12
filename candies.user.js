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

  // convenience wrapper for set interval
  var repeating = exports.repeating = {
    delay: 1000,
    intervalId: null,

    start: function() {
      var _this = this;
      this.stop();
      this.intervalId = setInterval(function() {
        if (_this.tick) {
          _this.tick();
        }
      }, this.delay);
    },

    stop: function() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    },

    tick: function() {}
  };

  var autoQuest = exports.autoQuest = extend({}, repeating, {
    eatBeforeQuesting: true,

    tick: function() {
      var button = document.getElementById('quest_button');
      if (!button.disabled) {
        if (this.eatBeforeQuesting && candies.nbrOwned > 0) {
          candies.eat();
        }
        quest.begin(true);
      }
    }
  });

  var autoHeal = exports.autoHeal = extend({}, repeating, {
    tick: function() {
      var character = quest && quest.things[quest.getCharacterIndex()];
      if (character && character.hp < 100 && quest.potionUseCountdown < 1) {
        potions.heal(100);
      }
    }
  });

  var activateCandyConverter = function() {
    if (!candiesConverter.activated) {
      document.getElementById('candies_converter_checkbox').checked = true;
      candiesConverter.checkedValueChange();
    }
  };

  var deactivateCandyConverter = function() {
    if (candiesConverter.activated) {
      document.getElementById('candies_converter_checkbox').checked = false;
      candiesConverter.checkedValueChange();
    }
  };

  var autoBrew = function() {
    var potionsWanted = 100 - potions.list.majorHealth.nbrOwned;
    if (potionsWanted < 80) {
      if (quest.getCharacterMaxHp() >= 600) {
        activateCandyConverter();
      }
      startNextBrew();
      return;
    }

    deactivateCandyConverter();
    var numPotionsCandies = Math.floor(candies.nbrOwned / 100);
    var numPotionsLollipops = Math.floor(lollipops.nbrOwned / 100);
    var numPotions = Math.min(numPotionsCandies, numPotionsLollipops, potionsWanted);
    if (numPotions < 1) {
      startNextBrew();
      return;
    }
    var amountToAdd = numPotions * 100;

    var candiesToAdd = document.getElementById('cauldron_candies_quantity');
    var lollipopsToAdd = document.getElementById('cauldron_lollipops_quantity');

    var candyInterval = null;
    var stopAddingCandy = function() {
      if (candyInterval) {
        clearInterval(candyInterval);
        candyInterval = null;
      }
    };
    var tryAddingCandy = function() {
      if (candies.nbrOwned >= amountToAdd) {
        candiesToAdd.value = amountToAdd;
        lollipopsToAdd.value = 0;
        cauldron.putInTheCauldron();
        stopAddingCandy();
      }
    };

    var startMixing = function() {
      cauldron.setWeAreMixing(true);
      setTimeout(function() {
        candyInterval = setInterval(tryAddingCandy, 1000);
        setTimeout(stopMixing, 20000);
      }, 1000);
    };
    var stopMixing = function() {
      cauldron.stopActions();
      cauldron.putIntoBottles();
      stopAddingCandy();
      startNextBrew();
    };

    candiesToAdd.value = 0;
    lollipopsToAdd.value = amountToAdd;
    cauldron.putInTheCauldron();
    setTimeout(startMixing, 1000);
  };

  var startNextBrew = function() {
    setTimeout(autoBrew, 1000);
  };

  autoQuest.start();
  autoHeal.start();
  startNextBrew();
};

var script = document.createElement('script');
script.appendChild(document.createTextNode('(' + scriptFunction + ')(window);\n'));
document.body.appendChild(script);

