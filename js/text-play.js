var TTSPlay = (function (global, EventEmitter) {

    function stringify(obj) {
        return Object.keys(obj).map(function (key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
        }).join('&');
    }

    function BrowserTTSPlay(language, speed) {
        this.language = language
        this.speed = speed;
        this.isSupported = null;

        var self = this;
        var tts = global.speechSynthesis;
        var ttsVoice = null;

        function getVoice() {
            if (ttsVoice) {
                return ttsVoice;
            }
            var lang = self.language;
            var shortLang = lang.substring(0, 2);
            var v = tts.getVoices().filter(function (v) {
                return v.lang == lang;
            });
            if (v.length === 0) {
                v = tts.getVoices().filter(function (v) {
                    return v.lang == shortLang;
                });
            }
            if (v.length > 0) {
                ttsVoice = v[0];
            }
        }

        this.speak = function (text, completedCallback) {
            if (!tts || !self.isSupported) {
                completedCallback({
                    'message': 'Not supported'
                });
                return;
            }
            var texts = ttsTextBreaker(text, 200);

            function errorCallback(e) {
                self.cancel();
                completedCallback(e);
            }

            var utts = texts.map(function (t) {
                var utt = new SpeechSynthesisUtterance(t);
                utt.rate = self.speed;
                utt.voice = getVoice();
                utt.lang = self.language;
                utt.onerror = errorCallback;
                return utt;
            });
            utts[utts.length - 1].onend = function () {
                completedCallback();
            };
            utts.forEach(function (utt) {
                tts.speak(utt);
            });
        };

        this.cancel = function () {
            if (tts) {
                tts.cancel();
            }
        };

        this.setLang = function (lang) {
            this.language = lang;
            this.isSupported = null;
            ttsVoice = null;
        };

        this.canSpeak = function () {
            if (this.isSupported === false || this.isSupported === true) {
                return this.isSupported;
            }
            if (!tts) {
                this.isSupported = false;
            } else {
                var lang = this.language;
                var shortLang = lang.substring(0, 2);
                this.isSupported = tts.getVoices().some(function (v) {
                    return v.lang == lang || v.lang == shortLang;
                });
            }
            return this.isSupported;
        };
    }

    function RemoteTTSPlay(engine, language, speed) {
        this.language = language
        this.speed = speed;

        var playQueue = [];

        this.speak = function (text, completedCallback) {
            this.cancel();
            var lang = this.language;
            var speed = this.speed;
            var self = this;

            function errorCallback(e) {
                self.cancel();
                completedCallback(e);
            }
            var texts = ttsTextBreaker(text, 1000);
            var utts = texts.map(function (text) {
                var tape = new PlayTape(text, lang, speed);
                tape.on('error', errorCallback);
                return tape;
            });
            utts = utts.reduce(function (combined, current, index) {
                var next = combined[index + 1];
                if (next) {
                    current.on('nearlyEnd', function () {
                        next.prepare();
                    });
                    current.on('end', function () {
                        next.play();
                    });
                }
                return combined;
            }, utts);
            utts[utts.length - 1].on('end', function () {
                completedCallback();
            });
            playQueue = utts;
            utts[0].play();
        };

        this.cancel = function () {
            var queue = playQueue.splice(0);
            queue.forEach(function (tape) {
                tape.cancel();
            });
        };

        this.setLang = function (lang) {
            this.language = lang;
        };

        function PlayTape(text, lang, speed) {
            EventEmitter.apply(this);
            lang || 'ja-JP';
            speed = speed || 1;
            var context = {
                self: this,
                audio: null,
                canceled: false,
                lang: lang,
                speed: speed
            };

            var makeAudioUrl = (function () {
                var preparing = false;
                var lastResult = null;
                var callbacks = [];

                function emitResult() {
                    callbacks.splice(0).forEach(function (callback) {
                        if (callback) {
                            if (lastResult.error) {
                                callback(lastResult.error);
                            } else {
                                callback(null, lastResult.url);
                            }
                        }
                    });
                };

                function prepare(callback) {
                    callbacks.push(callback);
                    if (lastResult) {
                        emitResult();
                        return;
                    }
                    if (preparing) {
                        return;
                    }
                    preparing = true;
                    engine.toText(text, lang, speed, function (err, url) {
                        preparing = false;
                        lastResult = {
                            url: url,
                            error: err,
                        };
                        emitResult();
                    });
                }

                return prepare;
            })();

            function prepareAudioPlayer(url) {
                if (context.audio) {
                    return context.audio;
                }
                var audio = new Audio();
                audio.autoplay = false;
                audio.onended = function () {
                    if (context.canceled) {
                        return;
                    }
                    context.self.emit('end');
                };
                audio.onerror = function (e) {
                    if (context.canceled) {
                        return;
                    }
                    context.self.emit('error', err);
                };
                audio.ontimeupdate = function () {
                    var shouldPrepare = audio.currentTime / audio.duration > 0.5;
                    if (shouldPrepare) {
                        audio.ontimeupdate = null;
                        context.self.emit('nearlyEnd');
                    }
                };
                audio.src = url;
                context.audio = audio;
                return context.audio;
            }

            this.play = function () {
                if (context.canceled) {
                    return;
                }
                makeAudioUrl(function (err, url) {
                    if (context.canceled) {
                        return;
                    }
                    if (err) {
                        context.self.emit('error', err);
                        return;
                    }
                    prepareAudioPlayer(url).play();
                });
            };

            this.prepare = function () {
                console.log('prepare');
                makeAudioUrl(function (err, url) {
                    if (context.canceled) {
                        return;
                    }
                    if (err) {
                        context.self.emit('error', err);
                        return;
                    }
                    prepareAudioPlayer(url);
                });
            };

            this.cancel = function () {
                context.canceled = true;
                var audio = context.audio;
                context.audio = null;
                if (audio) {
                    audio.onend = null;
                    audio.onerror = null;
                    audio.onstart = null;
                    audio.pause();
                }
            };
        }

        PlayTape.prototype = EventEmitter.prototype;
        PlayTape.prototype.constructor = PlayTape;
    }

    // function AimeGGEngine() {
    //     this.toText = function (text, lang, speed, callback) {
    //         var url = 'https://aitrainer.gpu02.aimesoft.com/tts';
    //         url = url + '?' + stringify({
    //             q: text,
    //             lang: lang,
    //             speed: speed
    //         });
    //         $.ajax({
    //             url: url,
    //             success: function (res) {
    //                 callback(null, res.url);
    //             },
    //             error: function (err) {
    //                 callback(err);
    //             }
    //         });
    //     }
    // }

    function AimeGGEngine2() {
        this.toText = function (text, lang, speed, callback) {
            var url = 'http://13.59.254.254:16510/tts';
            url = url + '?' + stringify({
                text: text,
                lang: lang,
                speed: speed,
                tonetype: 'female',
                speaktype: 'NOR'
            });
            callback(null, url);
        }
    }

    function TTSPlay(language, speed) {
        EventEmitter.apply(this);
        var self = this;
        this.language = language
        this.speed = speed;
        this.speaking = false;

        var brTTS = new BrowserTTSPlay(language, speed);
        var rmTTS = new RemoteTTSPlay(new AimeGGEngine2(), language, speed);

        this.speak = function (text) {
            function completion(error) {
                self.speaking = false;
                if (error) {
                    self.emit('error', error);
                } else {
                    self.emit('end');
                }
            }

            this.cancel();
            this.speaking = true;
            if (!text) {
                completion();
                return;
            }
            self.emit('start');
            if (brTTS.canSpeak()) {
                brTTS.speak(text, completion);
            } else {
                rmTTS.speak(text, completion);
            }
        };

        this.cancel = function () {
            brTTS.cancel();
            if (self.speaking) {
                self.speaking = false;
                self.emit('end');
            }
        };

        this.setLang = function (lang) {
            this.language = lang;
            this.cancel();
            brTTS.setLang(lang);
            rmTTS.setLang(lang);
        };

        this.setSpeed = function (speed) {
            this.speed = speed;
            brTTS.speed = speed;
            rmTTS.speed = speed;
        }

        this.useNative = function (using) {
            if (!using) {
                brTTS = null;
            } else {
                if (!brTTS) {
                    brTTS = new BrowserTTSPlay(this.language, this.speed);
                }
            }
        }
    }

    TTSPlay.prototype = EventEmitter.prototype;
    TTSPlay.prototype.constructor = TTSPlay;

    return TTSPlay;
})(window || global, EventEmitter);

console.log(TTSPlay)