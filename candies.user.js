// ==UserScript==
// @name Candy Machine
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

    setStarted: function(started) {
      if (started) {
        if (!this.intervalId) {
          this.start();
        }
      } else {
        this.stop();
      }
    },

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
    eatBeforeQuesting: false,

    tick: function() {
      var button = document.getElementById('quest_button');
      if (!$('#quest_button').is(':disabled')) {
        if (this.eatBeforeQuesting && candies.nbrOwned > 0) {
          candies.eat();
        }
        quest.begin(true);
      }
    }
  });

  // auto heal when the character health gets too low
  var autoHeal = exports.autoHeal = extend({}, repeating, {
    minHealth: 100,

    tick: function() {
      var character = quest && quest.things[quest.getCharacterIndex()];
      if (character && character.hp < this.minHealth && quest.potionUseCountdown < 1) {
        if (potions.list.majorHealth.nbrOwned > 0) {
          potions.heal(100);
        } else if (potions.list.health.nbrOwned > 0) {
          potions.heal(50);
        }
      }
    }
  });

  var autoConvert = extend({}, repeating, {
    delay: 250,
    minHealth: 600,
    paused: false,

    activate: function() {
      if (!candiesConverter.activated) {
        $('#candies_converter_checkbox').prop('checked', true);
        candiesConverter.checkedValueChange();
      }
    },

    deactivate: function() {
      if (candiesConverter.activated) {
        $('#candies_converter_checkbox').prop('checked', false);
        candiesConverter.checkedValueChange();
      }
    },

    stop: function() {
      repeating.stop.call(this);
      this.deactivate();
    },

    tick: function() {
      if (this.paused || quest.getCharacterMaxHp() < this.minHealth) {
        this.deactivate();
      } else {
        this.activate();
      }
    }
  });

  // auto brew major health potions
  var autoBrew = {
    minPotions: 20,
    maxPotions: 100,

    finish: function() {
      var _this = this;
      setTimeout(function() {
        _this.update();
      }, 1000);
    },

    brew: function() {
      var _this = this;

      var potionsWanted = this.maxPotions - potions.list.majorHealth.nbrOwned;
      if (potionsWanted < (this.maxPotions - this.minPotions)) {
        autoConvert.paused = false;
        this.finish();
        return;
      }

      autoConvert.paused = true;
      var numPotionsCandies = Math.floor(candies.nbrOwned / 100);
      var numPotionsLollipops = Math.floor(lollipops.nbrOwned / 100);
      var numPotions = Math.min(numPotionsCandies, numPotionsLollipops, potionsWanted);
      if (numPotions < 1) {
        this.finish();
        return;
      }
      var amountToAdd = numPotions * 100;

      var candiesToAdd = $('#cauldron_candies_quantity');
      var lollipopsToAdd = $('#cauldron_lollipops_quantity');

      var candyInterval = null;
      var stopAddingCandy = function() {
        if (candyInterval) {
          clearInterval(candyInterval);
          candyInterval = null;
        }
      };
      var tryAddingCandy = function() {
        if (candies.nbrOwned >= amountToAdd) {
          candiesToAdd.val(amountToAdd);
          lollipopsToAdd.val(0);
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
        _this.finish();
      };

      candiesToAdd.val(0);
      lollipopsToAdd.val(amountToAdd);
      cauldron.putInTheCauldron();
      setTimeout(startMixing, 1000);
    },

    noBrew: function() {
      this.finish();
    }
  };
  autoBrew.update = autoBrew.noBrew;
  autoBrew.finish();

  // add a ui tab
  (function() {
    $('#tabs').append($(
      '<li><button class="tab-5" tab="tab_auto" ' +
      'style="display: inline;">Auto</button></li>'));
    $('#tab_computer').after($('<div id="tab_auto" style="display: none;"></div>'));
    $('#tab_auto').html(
      '<input type="checkbox" id="auto_quest" checked> Auto quest<br>' +
      '<input type="checkbox" id="auto_eat"> Eat candies before questing<br>' +
      '<input type="checkbox" id="auto_heal"> Use health potions when health is less than ' +
        '<input type="text" id="auto_heal_min" value="100" size="3"><br>' +
      '<input type="checkbox" id="auto_brew"> Brew up to ' +
        '<input type="text" id="auto_brew_max" value="100" size="3"> major health potions ' +
        'when you have less than <input type="text" id="auto_brew_min" value="20" size="3"> of them' +
        '<br>' +
      '<input type="checkbox" id="auto_convert"> Convert candy when ' +
        'max health is at least <input type="text" id="auto_convert_min" value="600">' +
        '<br></div>');
    $('#auto_heal_min').val(autoHeal.minHealth);
    $('#auto_brew_min').val(autoBrew.minPotions);
    $('#auto_brew_max').val(autoBrew.maxPotions);
    $('#auto_convert_min').val(autoConvert.minHealth);

    var updateCheckboxes = function() {
      autoQuest.setStarted($('#auto_quest').is(':checked'));
      autoQuest.eatBeforeQuesting = $('#auto_eat').is(':checked');
      autoHeal.setStarted($('#auto_heal').is(':checked'));
      autoBrew.update = $('#auto_brew').is(':checked') ? autoBrew.brew : autoBrew.noBrew;
      autoConvert.setStarted($('#auto_convert').is(':checked'));
    };
    $('#tab_auto input[type=checkbox]').keypress(updateCheckboxes);
    $('#tab_auto').click(updateCheckboxes);
    $('#tab_auto').change(function() {
      updateCheckboxes();
      autoHeal.minHealth = parseInt($('#auto_heal_min').val(), 10) || 0;
      autoBrew.minPotions = parseInt($('#auto_brew_min').val(), 10) || 0;
      autoBrew.maxPotions = parseInt($('#auto_brew_max').val(), 10) || 0;
      autoConvert.minHealth = Math.floor(parseFloat($('#auto_convert_min').val()));
    });

    tabs.length++;
    tabs.list.push({button: $('.tab-5'), enabled: true});
    tabs.list[5].button.bind('click', tabs.select.bind(tabs, 5));
    tabs.disable(5);
    tabs.enable(5);
  })();

  autoQuest.start();
};

var script = document.createElement('script');
script.appendChild(document.createTextNode('(' + scriptFunction + ')(window);\n'));
document.body.appendChild(script);

