/* Pont de lectura en veu alta per a l'app Android.
   El WebView d'Android no implementa window.speechSynthesis; aquest fitxer el substitueix
   per una versió que delega en el motor TextToSpeech del sistema (objecte AndroidTTS).
   Pausa/represa s'emulen: s'atura el motor i es torna a llegir des de l'última paraula. */
(function(){
  if (!window.AndroidTTS) return;

  function Utterance(text){
    this.text = text || ""; this.lang = ""; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null;
    this.onstart = this.onend = this.onerror = this.onboundary = this.onpause = this.onresume = null;
  }

  var current = null;   // { utt, offset, lastIndex, nativeId }
  var paused = false;
  var seq = 0;

  function fire(utt, name, data){
    var fn = utt["on" + name];
    if (typeof fn === "function"){
      var ev = data || {}; ev.type = name; ev.utterance = utt;
      try { fn.call(utt, ev); } catch (e) { console.error(e); }
    }
  }

  function startNative(offset){
    var c = current;
    c.offset = offset; c.nativeId = "u" + (++seq);
    AndroidTTS.speak(c.nativeId, c.utt.text.slice(offset), c.utt.lang || "ca-ES",
                     c.utt.voice ? c.utt.voice.name : "", Number(c.utt.rate) || 1);
  }

  // Cridat des de Java: tipus = start | boundary | end | error
  window.__androidTtsEvent = function(id, type, charIndex){
    var c = current;
    if (!c || c.nativeId !== id || paused) return;
    if (type === "boundary"){
      c.lastIndex = c.offset + charIndex;
      fire(c.utt, "boundary", { charIndex: c.lastIndex, name: "word" });
    } else if (type === "start"){
      if (!c.started){ c.started = true; fire(c.utt, "start"); }
    } else if (type === "end"){
      current = null; fire(c.utt, "end");
    } else if (type === "error"){
      current = null; fire(c.utt, "error", { error: "synthesis-failed" });
    }
  };

  var synth = {
    get speaking(){ return !!current; },
    get paused(){ return paused; },
    get pending(){ return false; },
    onvoiceschanged: null,
    getVoices: function(){
      try {
        return JSON.parse(AndroidTTS.getVoices()).map(function(v){
          return { name: v.name, lang: v.lang, voiceURI: v.name, localService: true, default: false };
        });
      } catch (e) { return []; }
    },
    speak: function(utt){
      if (current) synth.cancel();
      paused = false;
      current = { utt: utt, offset: 0, lastIndex: 0, started: false };
      startNative(0);
    },
    cancel: function(){
      var c = current; current = null; paused = false;
      AndroidTTS.stop();
      if (c) fire(c.utt, "error", { error: "interrupted" });
    },
    pause: function(){
      if (!current || paused) return;
      paused = true; AndroidTTS.stop(); fire(current.utt, "pause");
    },
    resume: function(){
      if (!current || !paused) return;
      paused = false; fire(current.utt, "resume");
      startNative(current.lastIndex);
    },
    addEventListener: function(){}, removeEventListener: function(){}
  };

  try {
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true, writable: true });
  } catch (e) {
    window.speechSynthesis = synth; window.SpeechSynthesisUtterance = Utterance;
  }

  window.__androidTtsVoicesChanged = function(){
    if (typeof synth.onvoiceschanged === "function") synth.onvoiceschanged();
  };
})();
