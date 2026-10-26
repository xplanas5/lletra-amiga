/* Contingut de Lletra Amiga: bancs per defecte (js/banks.js) + paquets de contingut propis.
   Un paquet és un JSON com aquest (el genera l'editor, editor.html):
     { "format":"lletra-amiga-contingut", "versio":1, "titol":"…", "actualitzat":"2026-10-15",
       "bancs": { "SENTENCES": { "mode":"afegeix", "items":[ "…" ] } } }
   mode "afegeix" suma els ítems als de l'app; "substitueix" fa servir només els del paquet.
   Ordre d'aplicació: contingut.json publicat amb l'app → adreça web configurada → paquet local.
   Les claus no comencen per "lletraAmiga." perquè tancar la sessió del núvol no les esborri. */
(function(){
  "use strict";

  var FORMAT = "lletra-amiga-contingut";
  var LOCAL_KEY = "lletraAmiga-contingut.local.v1";     // paquet desat amb l'editor en aquest dispositiu
  var URL_KEY = "lletraAmiga-contingut.url.v1";         // adreça web d'un paquet compartit
  var CACHE_KEY = "lletraAmiga-contingut.cache.v1";     // { bundled:{pack,at}, remote:{url,pack,at,error} }
  var BUNDLED_URL = "contingut.json";

  var DEFAULTS = window.LLETRA_DEFAULT_BANKS || {};

  function readJSON(key, fallback){
    try{ var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }catch(e){ return fallback; }
  }
  function writeJSON(key, value){
    try{ if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch(e){ return false; }
  }
  function clone(x){ return JSON.parse(JSON.stringify(x)); }

  /* ---------------- Validació ---------------- */
  // Els textos propis es mostren dins l'HTML de les activitats: es treuen < i > per seguretat.
  function clean(v){
    if (typeof v === "string") return v.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim();
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === "object"){
      var o = {}; Object.keys(v).forEach(function(k){ o[k] = clean(v[k]); }); return o;
    }
    return v;
  }
  function kind(v){ return Array.isArray(v) ? "array" : v === null ? "null" : typeof v; }

  // Comprova que l'ítem té la mateixa forma que els exemples per defecte del banc.
  function shapeError(item, sample, path){
    var ks = kind(sample), ki = kind(item);
    if (ks !== ki) return (path || "L'exemple") + " no té el format esperat.";
    if (ks === "string" && !item.trim()) return (path || "El text") + " és buit.";
    if (ks === "array"){
      if (!item.length) return (path || "La llista") + " és buida.";
      if (sample.length){
        for (var i = 0; i < item.length; i++){
          var e = shapeError(item[i], sample[0], (path ? path + " " : "") + "(element " + (i + 1) + ")");
          if (e) return e;
        }
      }
    }
    if (ks === "object"){
      var keys = Object.keys(sample);
      for (var j = 0; j < keys.length; j++){
        var k = keys[j];
        if (!(k in item)) return "Falta el camp «" + k + "».";
        var err = shapeError(item[k], sample[k], "El camp «" + k + "»");
        if (err) return err;
      }
    }
    return null;
  }
  function inList(list, v){ return Array.isArray(list) && list.indexOf(v) !== -1; }
  function hasWord(sentence, w){
    return sentence.toLowerCase().split(/\s+/).some(function(t){
      t = t.replace(/[.,;:!¿?¡"«»()]/g, "");
      return t === w.toLowerCase() || t.split("'").pop() === w.toLowerCase();
    });
  }

  // Regles específiques: el que el format sol no garanteix però l'activitat necessita.
  var RULES = {
    RHYME_GROUPS: function(it){ return it.length < 3 ? "Cal la paraula i almenys dues paraules que hi rimin." : null; },
    SPELLING_PATTERNS: function(it){ return it.words.length < 5 ? "Cal almenys 5 parelles de paraules." : null; },
    DETECTIVE_ITEMS: function(it){ return hasWord(it.sentence, it.wrong) ? null : "La paraula mal escrita ha d'aparèixer a la frase."; },
    DICTAT_PREPARAT_SETS: function(it){
      var miss = it.words.filter(function(w){ return !hasWord(it.sentence, w); });
      return miss.length ? "Aquestes paraules no surten a la frase: " + miss.join(", ") + "." : null;
    },
    ORDENA_SYLLABLE_WORDS: function(it){ return it.syll.join("") === it.word ? null : "Les síl·labes juntes han de formar la paraula."; },
    PHONEME_WORDS: function(it){ return it.phonemes.join("") === it.word ? null : "Els sons junts han de formar la paraula."; },
    COMPLETA_PARAULA_ITEMS: function(it){
      if (it.before + it.correct + it.after !== it.word) return "Inici + fragment correcte + final han de formar la paraula.";
      return inList(it.options, it.correct) ? null : "El fragment correcte ha de ser una de les opcions.";
    },
    LISTEN_CHOOSE_ITEMS: function(it){ return inList(it.options, it.correct) ? null : "La resposta correcta ha de ser una de les opcions."; },
    COMPLETA_FRASE_ITEMS: function(it){ return inList(it.options, it.correct) ? null : "La resposta correcta ha de ser una de les opcions."; },
    FUNCTIONAL_TEXTS: function(it){ return inList(it.options, it.correct) ? null : "La resposta correcta ha de ser una de les opcions."; },
    PREDICTION_ITEMS: function(it){ return inList(it.options, it.correct) ? null : "La predicció correcta ha de ser una de les opcions."; },
    QUESTION_DURING_ITEMS: function(it){ return inList(it.options, it.correct) ? null : "La resposta correcta ha de ser una de les opcions."; },
    INTRUDER_ITEMS: function(it){ return inList(it.words, it.intruder) ? null : "La paraula intrusa ha de ser a la llista."; },
    WORD_FAMILIES: function(it){ return it.others.length < 3 ? "Calen almenys 3 paraules d'una altra família." : null; },
    VOCAB_CONTEXTUAL_ITEMS: function(it){ return it.sentence.toLowerCase().indexOf(it.word.toLowerCase()) === -1 ? "La paraula ha d'aparèixer a la frase." : null; },
    EVIDENCE_ITEMS: function(it){ return it.evidenceIndex >= 0 && it.evidenceIndex < it.sentences.length ? null : "La frase que respon ha de ser una de les frases."; },
    KEY_INFO_ITEMS: function(it){ return it.keyIndex >= 0 && it.keyIndex < it.sentences.length ? null : "La frase clau ha de ser una de les frases."; },
    MISSION_ITEMS: function(it){
      var bad = it.checkCorrect.filter(function(c){ return !inList(it.checkItems, c); });
      return bad.length ? "Els elements que cal marcar han de ser a la llista: " + bad.join(", ") + "." : null;
    },
    ESCAPE_ROOMS: function(it){
      if (it.puzzles.length < 2) return "Cal almenys dos objectes amb prova.";
      for (var i = 0; i < it.puzzles.length; i++){
        var p = it.puzzles[i];
        if (p.kind !== "pregunta" && p.kind !== "errors") return "El tipus de prova ha de ser «pregunta» o «errors».";
        if (it.code.toLowerCase().indexOf(p.piece.toLowerCase()) === -1) return "La peça «" + p.piece + "» no surt al codi del cadenat.";
        if (p.kind === "errors"){
          var miss = p.answers.filter(function(w){ return !hasWord(p.text, w); });
          if (miss.length) return "Aquestes paraules no surten al text de la pista: " + miss.join(", ") + ".";
        }
      }
      return null;
    },
    SUMMARY_ITEMS: function(it){ return it.sentences.some(function(s){ return s.essential; }) ? null : "Marca almenys una frase com a essencial."; }
  };

  // Retorna null si l'ítem és vàlid per al banc, o un missatge d'error.
  function validateItem(name, item){
    var defaults = DEFAULTS[name];
    if (!defaults) return "Banc desconegut.";
    if (!defaults.length) return null;
    var e = shapeError(item, defaults[0], "");
    if (e) return e;
    return RULES[name] ? RULES[name](item) : null;
  }

  // Prepara un ítem propi per mostrar-lo (neteja i, al vocabulari contextual, ressalta la paraula).
  function prepare(name, item){
    item = clean(item);
    if (name === "VOCAB_CONTEXTUAL_ITEMS"){
      var i = item.sentence.toLowerCase().indexOf(item.word.toLowerCase());
      if (i !== -1) item.sentence = item.sentence.slice(0, i) + "<strong>" + item.sentence.slice(i, i + item.word.length) + "</strong>" + item.sentence.slice(i + item.word.length);
    }
    return item;
  }

  function isPack(p){ return p && typeof p === "object" && p.bancs && typeof p.bancs === "object"; }

  /* ---------------- Construcció dels bancs ---------------- */
  var report = { sources: [], skipped: 0 };

  function applyPack(banks, pack, source){
    if (!isPack(pack)) return;
    var added = 0;
    Object.keys(pack.bancs).forEach(function(name){
      if (!Object.prototype.hasOwnProperty.call(banks, name)) return;
      var entry = pack.bancs[name];
      var items = Array.isArray(entry) ? entry : entry && entry.items;
      if (!Array.isArray(items)) return;
      var ok = [];
      items.forEach(function(it){
        var c = clean(it);
        if (validateItem(name, c)) { report.skipped++; return; }
        ok.push(prepare(name, it));
      });
      if (!ok.length) return;
      if (entry && entry.mode === "substitueix") banks[name] = ok; else banks[name] = banks[name].concat(ok);
      added += ok.length;
    });
    report.sources.push({ source: source, titol: pack.titol || "", items: added });
  }

  function build(){
    var banks = clone(DEFAULTS);
    report = { sources: [], skipped: 0 };
    var cache = readJSON(CACHE_KEY, {});
    if (cache.bundled) applyPack(banks, cache.bundled.pack, "publicat");
    if (cache.remote && cache.remote.url === getUrl()) applyPack(banks, cache.remote.pack, "adreça web");
    applyPack(banks, readJSON(LOCAL_KEY, null), "aquest dispositiu");
    return banks;
  }

  /* ---------------- Fonts remotes ---------------- */
  function getUrl(){ try{ return localStorage.getItem(URL_KEY) || ""; }catch(e){ return ""; } }
  function setUrl(url){
    url = (url || "").trim();
    try{ if (url) localStorage.setItem(URL_KEY, url); else localStorage.removeItem(URL_KEY); }catch(e){}
  }

  function fetchPack(url){
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    return fetch(url + sep + "t=" + Date.now(), { cache: "no-store" }).then(function(r){
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(p){
      if (!isPack(p)) throw new Error("El fitxer no és un paquet de contingut de Lletra Amiga.");
      return p;
    });
  }

  // Descarrega les fonts; si alguna ha canviat, la desa i avisa amb l'esdeveniment "lletra:contingut".
  // Retorna una promesa amb { changed, error }.
  function refresh(){
    var cache = readJSON(CACHE_KEY, {});
    var before = JSON.stringify([cache.bundled && cache.bundled.pack, cache.remote && cache.remote.url, cache.remote && cache.remote.pack]);
    var result = { changed: false, error: null };

    var bundled = (location.protocol === "file:") ? Promise.resolve() :
      fetchPack(BUNDLED_URL).then(function(p){ cache.bundled = { pack: p, at: Date.now() }; })
        .catch(function(){ /* fitxer opcional: si no hi és, no passa res */ });

    var url = getUrl();
    var remote = !url ? Promise.resolve().then(function(){ delete cache.remote; }) :
      fetchPack(url).then(function(p){ cache.remote = { url: url, pack: p, at: Date.now() }; })
        .catch(function(e){
          result.error = e.message || String(e);
          cache.remote = Object.assign({}, cache.remote && cache.remote.url === url ? cache.remote : { url: url }, { error: result.error, at: Date.now() });
        });

    return Promise.all([bundled, remote]).then(function(){
      writeJSON(CACHE_KEY, cache);
      var after = JSON.stringify([cache.bundled && cache.bundled.pack, cache.remote && cache.remote.url, cache.remote && cache.remote.pack]);
      result.changed = before !== after;
      if (result.changed){ try{ document.dispatchEvent(new CustomEvent("lletra:contingut", { detail: result })); }catch(e){} }
      return result;
    });
  }

  function status(){
    var cache = readJSON(CACHE_KEY, {});
    var local = readJSON(LOCAL_KEY, null);
    var banks = window.LletraContent.banks;
    var total = 0, base = 0;
    Object.keys(banks).forEach(function(k){ total += banks[k].length; });
    Object.keys(DEFAULTS).forEach(function(k){ base += DEFAULTS[k].length; });
    return {
      total: total, base: base, sources: report.sources.slice(), skipped: report.skipped,
      url: getUrl(),
      remote: cache.remote || null,
      bundled: cache.bundled ? { at: cache.bundled.at, titol: cache.bundled.pack.titol || "" } : null,
      local: isPack(local) ? { titol: local.titol || "", actualitzat: local.actualitzat || "" } : null
    };
  }

  window.LletraContent = {
    FORMAT: FORMAT,
    defaults: DEFAULTS,
    banks: build(),
    validateItem: validateItem,
    getLocalPack: function(){ return readJSON(LOCAL_KEY, null); },
    saveLocalPack: function(pack){ return writeJSON(LOCAL_KEY, pack); },
    clearLocalPack: function(){ writeJSON(LOCAL_KEY, null); },
    getUrl: getUrl, setUrl: setUrl, refresh: refresh, status: status, fetchPack: fetchPack,
    rebuild: function(){ this.banks = build(); return this.banks; }
  };
})();
