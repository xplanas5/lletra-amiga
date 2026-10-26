/* Efectes sonors de Lletra Amiga, sintetitzats amb Web Audio (sense fitxers, funcionen igual al web i a l'APK).
   Cadena: veus → bus → compressor → sortida, amb un enviament a una reverberació curta generada.
   Ús: LletraSfx.play("correct"). game.js decideix si el so està activat (LletraSfx.setEnabled). */
(function(){
  "use strict";

  var ctx = null, bus = null, verb = null;
  var enabledFn = function(){ return true; };

  function init(){
    if (ctx){ if (ctx.state === "suspended") ctx.resume(); return ctx; }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.18;
    var master = ctx.createGain(); master.gain.value = 0.95;
    bus = ctx.createGain();
    bus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    verb = ctx.createConvolver(); verb.buffer = impulse(1.8, 3.4);
    var wet = ctx.createGain(); wet.gain.value = 0.25;
    verb.connect(wet); wet.connect(comp);
    return ctx;
  }
  // Resposta d'impuls de soroll que s'apaga: una sala petita i brillant.
  function impulse(seconds, decay){
    var rate = ctx.sampleRate, len = Math.floor(rate * seconds), buf = ctx.createBuffer(2, len, rate);
    for (var c = 0; c < 2; c++){
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function out(node, send){
    node.connect(bus);
    if (send){ var s = ctx.createGain(); s.gain.value = send; node.connect(s); s.connect(verb); }
  }
  function env(param, t, attack, dur, vol){
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(vol, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  /* ---------------- Veus ---------------- */
  // Campana FM: el modulador s'apaga més de pressa que la nota i dona l'atac metàl·lic.
  function bell(f, t, dur, vol, ratio, index, send){
    var car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * (ratio || 3.5);
    mg.gain.setValueAtTime(f * (index || 1.5), t);
    mg.gain.exponentialRampToValueAtTime(f * 0.02, t + dur * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    env(g.gain, t, 0.004, dur, vol);
    car.connect(g); out(g, send == null ? 0.6 : send);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  function tone(type, f, t, attack, dur, vol, send, fEnd){
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    env(g.gain, t, attack, dur, vol);
    o.connect(g); out(g, send || 0);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // Marimba: fonamental curta i un parcial agut de fusta que s'apaga de seguida.
  function marimba(f, t, vol){
    tone("sine", f, t, 0.003, 0.55, vol, 0.3);
    tone("sine", f * 4, t, 0.002, 0.07, vol * 0.4, 0.2);
  }
  function noise(t, dur, vol, type, f0, f1, q, send){
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var flt = ctx.createBiquadFilter(); flt.type = type || "bandpass"; flt.Q.value = q || 1;
    flt.frequency.setValueAtTime(f0, t);
    if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain(); env(g.gain, t, Math.min(0.02, dur * 0.3), dur, vol);
    src.connect(flt); flt.connect(g); out(g, send || 0);
    src.start(t); src.stop(t + dur);
  }
  // Espurnes: notes agudes i curtes a l'atzar, amb molta reverberació.
  function sparkle(t, n, vol){
    for (var i = 0; i < n; i++) tone("sine", 2200 + Math.random() * 3200, t + i * 0.035 + Math.random() * 0.02, 0.002, 0.2, vol, 0.9);
  }
  function fanfare(t){
    [523.25, 659.25, 783.99, 1046.5].forEach(function(f, i){
      bell(f, t + i * 0.11, 1.1, 0.26, 3.5, 1.4);
      tone("triangle", f / 2, t + i * 0.11, 0.01, 0.35, 0.12, 0.3);
    });
    [523.25, 659.25, 783.99, 1046.5].forEach(function(f){
      tone("triangle", f, t + 0.46, 0.05, 1.5, 0.07, 0.7);
      tone("sine", f * 2, t + 0.46, 0.05, 1.3, 0.04, 0.7);
    });
    sparkle(t + 0.46, 14, 0.045);
  }

  /* ---------------- Sons ---------------- */
  var SOUNDS = {
    // Encert: dues campanes brillants sobre una marimba i unes espurnes.
    correct: function(t){
      marimba(523.25, t, 0.3);
      bell(1046.5, t, 0.9, 0.3, 3.5, 1.2);
      bell(1567.98, t + 0.085, 1.1, 0.27, 3.5, 1.2);
      sparkle(t + 0.12, 5, 0.035);
    },
    // Error: un «bloop» suau i descendent, gens castigador.
    wrong: function(t){
      tone("sine", 392, t, 0.01, 0.22, 0.19, 0.25, 330);
      tone("sine", 311.13, t + 0.15, 0.01, 0.36, 0.17, 0.25, 262);
      tone("triangle", 155.56, t + 0.15, 0.01, 0.3, 0.08);
    },
    // Toc d'interfície: un «pop» curt.
    tap: function(t){
      tone("sine", 880, t, 0.002, 0.08, 0.24, 0.05, 520);
      noise(t, 0.025, 0.04, "highpass", 3500);
    },
    // Obrir una secció o activitat: «whoosh» amb una nota que puja.
    open: function(t){
      noise(t, 0.3, 0.22, "bandpass", 400, 3800, 1.3, 0.3);
      tone("sine", 587.33, t + 0.1, 0.006, 0.22, 0.16, 0.4, 880);
    },
    // Pas de la guineu pel mapa.
    step: function(t){
      tone("triangle", 500 + Math.random() * 90, t, 0.003, 0.1, 0.38, 0.1, 360);
      noise(t, 0.04, 0.05, "lowpass", 900);
    },
    // Trobar una pista o una peça: arpegi ràpid ascendent.
    pickup: function(t){
      [783.99, 1046.5, 1318.51, 1567.98].forEach(function(f, i){ bell(f, t + i * 0.06, 0.55, 0.2, 2, 0.8); });
      sparkle(t + 0.22, 6, 0.035);
    },
    // Cadenat que s'obre: dos clics metàl·lics i fanfàrria.
    unlock: function(t){
      noise(t, 0.05, 0.45, "bandpass", 2400, 0, 6);
      noise(t + 0.13, 0.07, 0.4, "bandpass", 1500, 0, 5);
      tone("square", 98, t + 0.13, 0.002, 0.09, 0.07);
      fanfare(t + 0.32);
    },
    // Ratxa d'encerts: com més llarga, més aguda.
    combo: function(t, n){
      var base = 523.25 * Math.pow(2, Math.min(n || 5, 20) / 24);
      [0, 4, 7, 12].forEach(function(s, i){ bell(base * Math.pow(2, s / 12), t + i * 0.07, 0.6, 0.22, 3.5, 1); });
      sparkle(t + 0.28, 6, 0.035);
    },
    // Nivell, objectiu o repte complert.
    fanfare: function(t){ fanfare(t); },
    // Insígnia nova: glissando màgic de campanes.
    badge: function(t){
      for (var i = 0; i < 10; i++) bell(783.99 * Math.pow(2, i / 6), t + i * 0.045, 0.7, 0.12, 3.5, 0.8);
      sparkle(t + 0.35, 12, 0.045);
    }
  };

  window.LletraSfx = {
    setEnabled: function(fn){ enabledFn = fn; },
    play: function(name, arg){
      if (!SOUNDS[name] || !enabledFn()) return;
      try{ if (init()) SOUNDS[name](ctx.currentTime + 0.01, arg); }catch(e){}
    }
  };

  // Els navegadors no deixen sonar res fins al primer gest: s'aprofita per preparar l'àudio.
  ["pointerdown", "keydown"].forEach(function(ev){
    document.addEventListener(ev, function once(){
      document.removeEventListener(ev, once, true);
      try{ init(); }catch(e){}
    }, true);
  });
})();
