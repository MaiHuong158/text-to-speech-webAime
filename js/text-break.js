"use strict";

var ttsTextBreaker = function () {
  var J_PERIOD = '。';
  var J_COMMA = '、';
  var NEW_LINE = '\n';
  var EMPTY = '';
  var PERIOD = '.';
  var COMMA = ',';
  var SPACE = ' ';
  var PERIOD_SPLIT_RE = /[.?!]/;
  var COMMA_SPLIT_RE = /[,;:]/;

  function ttsTextBreaker(longtext, limit) {
    if (!limit || limit <= 0) {
      return [longtext];
    }

    longtext = dedent(longtext);
    var lastSentence = EMPTY;
    var breakList = [];
    var lastToken = undefined;

    _lineWrap({
      text: longtext,
      delimiter: EMPTY
    }, limit).forEach(function (l) {
      _periodWrap(l, limit).forEach(function (p) {
        _commaWrap(p, limit).forEach(function (c) {
          _wordWrap(c, limit).forEach(function (w) {
            var t = lastToken || w;

            if (lastSentence.length === 0) {
              lastSentence = w.text;
            } else if (lastSentence.length + w.text.length + t.delimiter.length <= limit) {
              lastSentence = lastSentence + t.delimiter + w.text;
            } else {
              breakList.push(lastSentence.trim());
              lastSentence = w.text;
            }

            lastToken = w;
          });
        });
      });
    });

    lastSentence = lastSentence.trim();

    if (lastSentence.length > 0) {
      breakList.push(lastSentence);
    }

    return breakList.filter(function (s) {
      return s.length > 0;
    });
  }

  function dedent(text) {
    return text.split(/\r?\n/).map(function (line) {
      return line.trim();
    }).join('\n');
  }

  function _lineWrap(textToken, limit) {
    if (textToken.text.length < limit) {
      return [textToken];
    }

    return textToken.text.split(NEW_LINE).map(function (line) {
      return {
        text: line,
        delimiter: NEW_LINE
      };
    });
  }

  function _periodWrap(textToken, limit) {
    if (textToken.text.length < limit) {
      return [textToken];
    }

    return textToken.text.split(PERIOD_SPLIT_RE).reduce(function (combined, token) {
      var chunks = _japanPeriodWrap({
        text: token,
        delimiter: PERIOD
      }, limit);

      combined.push.apply(combined, chunks);
      return combined;
    }, []);
  }

  function _japanPeriodWrap(textToken, limit) {
    if (textToken.text.length < limit) {
      return [textToken];
    }

    return textToken.text.split(J_PERIOD).map(function (line) {
      return {
        text: line,
        delimiter: J_PERIOD
      };
    });
  }

  function _commaWrap(textToken, limit) {
    if (textToken.text.length < limit) {
      return [textToken];
    }

    return textToken.text.split(COMMA_SPLIT_RE).reduce(function (combined, token) {
      var chunks = _japanCommaWrap({
        text: token,
        delimiter: COMMA
      }, limit);

      combined.push.apply(combined, chunks);
      return combined;
    }, []);
  }

  function _japanCommaWrap(textToken, limit) {
    if (textToken.text.length < limit) {
      return [textToken];
    }

    return textToken.text.split(J_COMMA).map(function (line) {
      return {
        text: line,
        delimiter: J_COMMA
      };
    });
  }

  function _wordWrap(textToken, limit) {
    if (textToken.text.length < limit) {
      return [textToken];
    }

    var lastSentence = EMPTY;
    var wordList = [];
    textToken.text.split(SPACE).forEach(function (w) {
      if (lastSentence.length === 0) {
        lastSentence = w;
      } else if (w.length + lastSentence.length < limit) {
        lastSentence = lastSentence + SPACE + w;
      } else {
        wordList.push({
          text: lastSentence,
          delimiter: SPACE
        });
        lastSentence = w;
      }
    });

    if (lastSentence.length > 0) {
      wordList.push({
        text: lastSentence,
        delimiter: SPACE
      });
    }

    return wordList;
  }

  return ttsTextBreaker;
}();