(function(){
  "use strict";

  /* ---------------- Data ----------------
     Els exemples són a js/banks.js; js/content.js hi afegeix el contingut propi (editor.html). */
  var BANKS = window.LletraContent ? window.LletraContent.banks : window.LLETRA_DEFAULT_BANKS;
  var SAMPLES = BANKS.SAMPLES;

  var SYLLABLE_WORDS = BANKS.SYLLABLE_WORDS;

  var RHYME_GROUPS = BANKS.RHYME_GROUPS;

  var SENTENCES = BANKS.SENTENCES;

  var SPELLING_WORDS = BANKS.SPELLING_WORDS;

  var LETTERS = ["b","d","p","q"];
  var NEUTRAL_LETTERS = ["m","n","u","w","h"];

  var SPELLING_PATTERNS = BANKS.SPELLING_PATTERNS;

  var DETECTIVE_ITEMS = BANKS.DETECTIVE_ITEMS;

  var DICTAT_PREPARAT_SETS = BANKS.DICTAT_PREPARAT_SETS;

  /* ---------------- Storage ---------------- */
  var SETTINGS_KEY = "lletraAmiga.settings.v1";
  var PROGRESS_KEY = "lletraAmiga.progress.v1";
  var PROFILES_KEY = "lletraAmiga.profiles.v1";
  var ACTIVE_PROFILE_KEY = "lletraAmiga.activeProfile.v1";

  function loadJSON(key, fallback){
    try{ var v = JSON.parse(localStorage.getItem(key)); return v || fallback; }catch(e){ return fallback; }
  }
  function uid(){ return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function settingsKeyFor(id){ return SETTINGS_KEY + ":" + id; }
  function progressKeyFor(id){ return PROGRESS_KEY + ":" + id; }
  // Avisa la capa de núvol (js/cloud.js) que hi ha dades noves per sincronitzar.
  function notifyChange(profileId){
    try{ document.dispatchEvent(new CustomEvent("lletra:canvi", { detail: { profileId: profileId || null } })); }catch(e){}
  }
  function saveProfilesList(){ try{ localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); }catch(e){} notifyChange(); }

  /* ---------------- Profiles ---------------- */
  var profiles = loadJSON(PROFILES_KEY, []);
  var activeProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY);

  if (!profiles.length){
    // First run: migrate any pre-existing single-profile data into a default profile.
    var legacySettings = loadJSON(SETTINGS_KEY, null);
    var legacyProgress = loadJSON(PROGRESS_KEY, null);
    activeProfileId = uid();
    profiles = [{ id: activeProfileId, name: "Perfil 1" }];
    saveProfilesList();
    if (legacySettings) localStorage.setItem(settingsKeyFor(activeProfileId), JSON.stringify(legacySettings));
    if (legacyProgress) localStorage.setItem(progressKeyFor(activeProfileId), JSON.stringify(legacyProgress));
  } else if (!activeProfileId || !profiles.some(function(p){ return p.id === activeProfileId; })){
    activeProfileId = profiles[0].id;
  }
  localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);

  var settings, progress;
  function loadProfileData(){
    settings = Object.assign({
      theme:"system", font:"lexend", fontSize:20, lineHeight:1.8, tracking:0.02,
      bionic:false, tint:"none", rate:0.9
    }, loadJSON(settingsKeyFor(activeProfileId), {}));

    progress = Object.assign({
      daily:{}, streakDates:[],
      review:{}, selfEval:[], wpm:{lecturaRepetida:[], repteFluidesa:[]},
      log:[],   // registre detallat per als informes: { t:mil·lisegons, k:tipus, ok:1|0, i:element }
      stats:{
        letters:{a:0,c:0}, syllables:{a:0,c:0}, rhymes:{a:0,c:0},
        dictation:{a:0,c:0}, dictatPreparat:{a:0,c:0}, memoria:{a:0,c:0},
        patrons:{a:0,c:0}, detectiu:{a:0,c:0}, grafia:{a:0,c:0},
        segmentacio:{a:0,c:0}, eliminaSo:{a:0,c:0}, canviaSo:{a:0,c:0}, detectaSo:{a:0,c:0},
        escoltaTria:{a:0,c:0}, semblants:{a:0,c:0}, parelles:{a:0,c:0}, bingo:{a:0,c:0},
        pseudoparaula:{a:0,c:0}, construeix:{a:0,c:0}, ordenaSillabes:{a:0,c:0}, completaParaula:{a:0,c:0},
        familia:{a:0,c:0}, prefixSufix:{a:0,c:0}, vocabContextual:{a:0,c:0}, intrusa:{a:0,c:0},
        sinantonim:{a:0,c:0}, completaFrase:{a:0,c:0}, paraulaFrase:{a:0,c:0},
        lecturaGuiada:{a:0,c:0}, lecturaRepetida:{a:0,c:0}, suportAuditiu:{a:0,c:0},
        lecturaPauses:{a:0,c:0}, repteFluidesa:{a:0,c:0}, textFuncional:{a:0,c:0},
        prediccio:{a:0,c:0}, preguntaDurant:{a:0,c:0}, ideaPrincipal:{a:0,c:0}, ordenaHistoria:{a:0,c:0},
        quePodemDeduir:{a:0,c:0}, evidenciaTextual:{a:0,c:0}, informacioImportant:{a:0,c:0},
        construeixResum:{a:0,c:0}, respostaOral:{a:0,c:0},
        missioLectura:{a:0,c:0}, escapeRoom:{a:0,c:0}
      }
    }, loadJSON(progressKeyFor(activeProfileId), {}));
    decks = loadJSON(decksKeyFor(activeProfileId), {});
  }
  /* Baralles d'exemples: cada banc es reparteix com una baralla de cartes, de manera que
     no es repeteix cap exemple fins que s'han vist tots. L'ordre es desa per perfil. */
  var DECKS_KEY = "lletraAmiga.decks.v1";
  var decks = {};
  function decksKeyFor(id){ return DECKS_KEY + ":" + id; }
  function saveDecks(){ try{ localStorage.setItem(decksKeyFor(activeProfileId), JSON.stringify(decks)); }catch(e){} }
  loadProfileData();

  function saveSettings(){ try{ localStorage.setItem(settingsKeyFor(activeProfileId), JSON.stringify(settings)); }catch(e){} notifyChange(activeProfileId); }
  function saveProgress(){ try{ localStorage.setItem(progressKeyFor(activeProfileId), JSON.stringify(progress)); }catch(e){} notifyChange(activeProfileId); }

  function switchProfile(id){
    activeProfileId = id;
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    loadProfileData();
    applySettings();
    renderProgress();
  }

  function renderProfileUI(){
    var active = profiles.find(function(p){ return p.id === activeProfileId; });
    document.getElementById("currentProfileName").textContent = active ? active.name : "";

    var list = document.getElementById("profileList");
    list.innerHTML = "";
    profiles.forEach(function(p){
      var row = document.createElement("div");
      row.className = "profile-row";
      row.setAttribute("data-active", p.id === activeProfileId ? "true" : "false");

      var nameBtn = document.createElement("button");
      nameBtn.className = "name";
      nameBtn.textContent = p.name + (p.id === activeProfileId ? " (actiu)" : "");
      nameBtn.addEventListener("click", function(){
        if (p.id !== activeProfileId){ switchProfile(p.id); renderProfileUI(); }
      });

      var renameBtn = document.createElement("button");
      renameBtn.className = "mini-btn"; renameBtn.type = "button";
      renameBtn.textContent = "✎"; renameBtn.title = "Canvia el nom";
      renameBtn.addEventListener("click", function(){
        var name = prompt("Nou nom per al perfil:", p.name);
        if (name && name.trim()){ p.name = name.trim(); saveProfilesList(); renderProfileUI(); }
      });

      var delBtn = document.createElement("button");
      delBtn.className = "mini-btn"; delBtn.type = "button";
      delBtn.textContent = "🗑"; delBtn.title = "Esborra el perfil";
      delBtn.disabled = profiles.length <= 1;
      delBtn.addEventListener("click", function(){
        if (profiles.length <= 1) return;
        if (!confirm('Segur que vols esborrar el perfil "' + p.name + '" i tot el seu progrés? Aquesta acció no es pot desfer.')) return;
        localStorage.removeItem(settingsKeyFor(p.id));
        localStorage.removeItem(progressKeyFor(p.id));
        localStorage.removeItem(decksKeyFor(p.id));
        profiles = profiles.filter(function(x){ return x.id !== p.id; });
        saveProfilesList();
        if (p.id === activeProfileId) switchProfile(profiles[0].id);
        renderProfileUI();
      });

      row.appendChild(nameBtn); row.appendChild(renameBtn); row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  var profileBackdrop = document.getElementById("profileBackdrop");
  document.getElementById("openProfiles").addEventListener("click", function(){ renderProfileUI(); profileBackdrop.hidden = false; });
  document.getElementById("closeProfiles").addEventListener("click", function(){ profileBackdrop.hidden = true; });
  profileBackdrop.addEventListener("click", function(e){ if (e.target === profileBackdrop) profileBackdrop.hidden = true; });

  function addProfileFromInput(){
    var input = document.getElementById("newProfileName");
    var name = input.value.trim() || ("Perfil " + (profiles.length + 1));
    var id = uid();
    profiles.push({ id: id, name: name });
    saveProfilesList();
    input.value = "";
    switchProfile(id);
    renderProfileUI();
  }
  document.getElementById("addProfile").addEventListener("click", addProfileFromInput);
  document.getElementById("newProfileName").addEventListener("keydown", function(e){
    if (e.key === "Enter") addProfileFromInput();
  });

  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function futureDateStr(days){ var d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10); }

  /* ---------------- Motor d'adaptació: mapa d'activitats ---------------- */
  var TYPE_INFO = {
    letters:{label:"Lletres", domain:"descodificacio", tab:"panel-exercises"},
    syllables:{label:"Síl·labes", domain:"descodificacio", tab:"panel-exercises"},
    rhymes:{label:"Rimes", domain:"descodificacio", tab:"panel-exercises"},
    pseudoparaula:{label:"Paraula o pseudoparaula", domain:"descodificacio", tab:"panel-exercises"},
    construeix:{label:"Construeix la paraula", domain:"descodificacio", tab:"panel-exercises"},
    ordenaSillabes:{label:"Ordena síl·labes", domain:"descodificacio", tab:"panel-exercises"},
    completaParaula:{label:"Completa la paraula", domain:"descodificacio", tab:"panel-exercises"},

    dictation:{label:"Dictat interactiu", domain:"ortografia", tab:"panel-dictation"},
    dictatPreparat:{label:"Dictat preparat", domain:"ortografia", tab:"panel-dictation"},
    memoria:{label:"Memòria ortogràfica", domain:"ortografia", tab:"panel-dictation"},
    patrons:{label:"Caça de patrons", domain:"ortografia", tab:"panel-dictation"},
    detectiu:{label:"Detectiu d'errors", domain:"ortografia", tab:"panel-dictation"},
    grafia:{label:"Tria la grafia", domain:"ortografia", tab:"panel-dictation"},

    segmentacio:{label:"Segmentació fonèmica", domain:"fonologia", tab:"panel-fonologia"},
    eliminaSo:{label:"Elimina un so", domain:"fonologia", tab:"panel-fonologia"},
    canviaSo:{label:"Canvia un so", domain:"fonologia", tab:"panel-fonologia"},
    detectaSo:{label:"Detecta el so", domain:"fonologia", tab:"panel-fonologia"},
    escoltaTria:{label:"Escolta i tria", domain:"fonologia", tab:"panel-fonologia"},
    semblants:{label:"Paraules semblants", domain:"fonologia", tab:"panel-fonologia"},
    parelles:{label:"Parelles paraula-so", domain:"fonologia", tab:"panel-fonologia"},
    bingo:{label:"Bingo fonològic", domain:"fonologia", tab:"panel-fonologia"},

    familia:{label:"Famílies de paraules", domain:"vocabulari", tab:"panel-vocabulari"},
    prefixSufix:{label:"Prefixos i sufixos", domain:"vocabulari", tab:"panel-vocabulari"},
    vocabContextual:{label:"Vocabulari contextual", domain:"vocabulari", tab:"panel-vocabulari"},
    intrusa:{label:"Paraula intrusa", domain:"vocabulari", tab:"panel-vocabulari"},
    sinantonim:{label:"Sinònims i antònims", domain:"vocabulari", tab:"panel-vocabulari"},
    completaFrase:{label:"Completa la frase pel context", domain:"vocabulari", tab:"panel-vocabulari"},
    paraulaFrase:{label:"Paraula + frase", domain:"vocabulari", tab:"panel-vocabulari"},

    lecturaGuiada:{label:"Lectura guiada", domain:"lectura", tab:"panel-reader"},
    lecturaRepetida:{label:"Lectura repetida", domain:"lectura", tab:"panel-reader"},
    suportAuditiu:{label:"Suport auditiu opcional", domain:"lectura", tab:"panel-reader"},
    lecturaPauses:{label:"Lectura amb pauses", domain:"lectura", tab:"panel-reader"},
    repteFluidesa:{label:"Repte de fluïdesa", domain:"lectura", tab:"panel-reader"},
    textFuncional:{label:"Text funcional", domain:"lectura", tab:"panel-reader"},

    prediccio:{label:"Predicció abans de llegir", domain:"comprensio", tab:"panel-comprensio"},
    preguntaDurant:{label:"Pregunta durant la lectura", domain:"comprensio", tab:"panel-comprensio"},
    ideaPrincipal:{label:"Idea principal", domain:"comprensio", tab:"panel-comprensio"},
    ordenaHistoria:{label:"Ordena la història", domain:"comprensio", tab:"panel-comprensio"},
    quePodemDeduir:{label:"Què podem deduir?", domain:"comprensio", tab:"panel-comprensio"},
    evidenciaTextual:{label:"Evidència textual", domain:"comprensio", tab:"panel-comprensio"},
    informacioImportant:{label:"Informació important", domain:"comprensio", tab:"panel-comprensio"},
    construeixResum:{label:"Construeix el resum", domain:"comprensio", tab:"panel-comprensio"},
    respostaOral:{label:"Lectura i resposta oral", domain:"comprensio", tab:"panel-comprensio"},

    missioLectura:{label:"Missió de lectura", domain:"missions", tab:"panel-missions"},
    escapeRoom:{label:"Escape room textual", domain:"missions", tab:"panel-missions"}
  };
  var DOMAINS = ["fonologia", "descodificacio", "ortografia", "vocabulari", "lectura", "comprensio"];
  var DOMAIN_LABELS = {
    fonologia:"Consciència fonològica", descodificacio:"Descodificació", ortografia:"Ortografia",
    vocabulari:"Vocabulari", lectura:"Lectura i fluïdesa", comprensio:"Comprensió"
  };

  function domainAccuracy(domain){
    var a = 0, c = 0;
    Object.keys(TYPE_INFO).forEach(function(k){
      if (TYPE_INFO[k].domain !== domain) return;
      var st = progress.stats[k];
      if (st){ a += st.a; c += st.c; }
    });
    return { a:a, c:c, pct: a ? Math.round((c / a) * 100) : 0 };
  }
  function domainLevel(domain){
    var acc = domainAccuracy(domain);
    if (acc.a < 3) return 1;
    if (acc.pct < 40) return 1;
    if (acc.pct < 55) return 2;
    if (acc.pct < 70) return 3;
    if (acc.pct < 85) return 4;
    return 5;
  }
  function fluencyScore(){
    var entries = (progress.wpm.lecturaRepetida || []).concat(progress.wpm.repteFluidesa || []);
    if (!entries.length) return domainAccuracy("lectura").pct;
    var recent = entries.slice(-6);
    var avg = recent.reduce(function(sum, e){ return sum + e.wpm; }, 0) / recent.length;
    var targetWpm = 110; // velocitat de referència orientativa per a lectura en veu alta
    return Math.max(0, Math.min(100, Math.round((avg / targetWpm) * 100)));
  }
  function progressProfile(){
    return [
      { label:"Precisió", value: Math.round((domainAccuracy("fonologia").pct + domainAccuracy("descodificacio").pct) / 2) },
      { label:"Ortografia", value: domainAccuracy("ortografia").pct },
      { label:"Vocabulari", value: domainAccuracy("vocabulari").pct },
      { label:"Fluïdesa", value: fluencyScore() },
      { label:"Comprensió", value: domainAccuracy("comprensio").pct }
    ];
  }

  /* ---------------- Repàs espaiat ---------------- */
  var REVIEW_INTERVALS = [1, 3, 7, 16, 30];
  function nextReviewInterval(cur){
    var idx = REVIEW_INTERVALS.indexOf(cur);
    if (idx === -1 || idx >= REVIEW_INTERVALS.length - 1) return REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
    return REVIEW_INTERVALS[idx + 1];
  }
  function updateReview(type, wasCorrect){
    var r = progress.review[type];
    if (!wasCorrect){
      progress.review[type] = { interval:1, due:futureDateStr(1), misses:(r ? r.misses : 0) + 1 };
    } else if (r){
      if (r.interval >= REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1]){
        delete progress.review[type];
      } else {
        var next = nextReviewInterval(r.interval);
        progress.review[type] = { interval:next, due:futureDateStr(next), misses:r.misses };
      }
    }
  }
  function applyDifficultyRating(type, level){
    var r = progress.review[type] || { interval:1, due:todayStr(), misses:0 };
    if (level === "facil"){
      var next = nextReviewInterval(r.interval);
      progress.review[type] = { interval:next, due:futureDateStr(next), misses:r.misses };
    } else if (level === "dificil"){
      progress.review[type] = { interval:1, due:futureDateStr(2), misses:r.misses + 1 };
    } else {
      progress.review[type] = { interval:1, due:todayStr(), misses:r.misses + 1 };
    }
    saveProgress();
    renderReviewSection();
  }
  function goToActivityTab(type){
    var info = TYPE_INFO[type];
    if (!info) return;
    var btn = document.querySelector('#mainTabs [data-target="' + info.tab + '"]');
    if (btn) btn.click();
  }

  function submitSelfEval(rating){
    var t = todayStr();
    progress.selfEval = progress.selfEval.filter(function(e){ return e.date !== t; });
    progress.selfEval.push({ date:t, rating:rating });
    if (progress.selfEval.length > 60) progress.selfEval.shift();
    saveProgress();
    renderSelfEval();
  }
  function logWpm(type, wpm){
    var arr = progress.wpm[type] || (progress.wpm[type] = []);
    arr.push({ date: todayStr(), wpm: wpm });
    if (arr.length > 20) arr.shift();
  }

  var LOG_MAX = 3000;
  function recordActivity(type, wasCorrect){
    var s = progress.stats[type] || (progress.stats[type] = {a:0,c:0});
    s.a += 1; if (wasCorrect) s.c += 1;
    var entry = { t: Date.now(), k: type, ok: wasCorrect ? 1 : 0 };
    var label = TYPE_BANK[type] && pickedLabels[TYPE_BANK[type]];
    if (label) entry.i = label;
    (progress.log || (progress.log = [])).push(entry);
    if (progress.log.length > LOG_MAX) progress.log.splice(0, progress.log.length - LOG_MAX);
    var t = todayStr();
    progress.daily[t] = (progress.daily[t] || 0) + 1;
    if (progress.streakDates.indexOf(t) === -1) progress.streakDates.push(t);
    updateReview(type, wasCorrect);
    saveProgress();
  }

  /* ---------------- Tabs ---------------- */
  function wireTabs(container, panelLookup, onActivate){
    var buttons = container.querySelectorAll("[role=tab]");
    buttons.forEach(function(btn){
      btn.addEventListener("click", function(){
        buttons.forEach(function(b){ b.setAttribute("aria-selected", b === btn ? "true" : "false"); });
        Object.keys(panelLookup).forEach(function(key){
          panelLookup[key].hidden = (key !== btn.dataset[Object.keys(btn.dataset)[0]]);
        });
        if (onActivate) onActivate(btn);
      });
    });
  }

  wireTabs(document.getElementById("mainTabs"), {
    "panel-reader": document.getElementById("panel-reader"),
    "panel-fonologia": document.getElementById("panel-fonologia"),
    "panel-exercises": document.getElementById("panel-exercises"),
    "panel-dictation": document.getElementById("panel-dictation"),
    "panel-vocabulari": document.getElementById("panel-vocabulari"),
    "panel-comprensio": document.getElementById("panel-comprensio"),
    "panel-missions": document.getElementById("panel-missions"),
    "panel-progress": document.getElementById("panel-progress")
  }, function(btn){ if (btn.dataset.target === "panel-progress") renderProgress(); });

  /* ---------------- Settings drawer ---------------- */
  var drawer = document.getElementById("drawerBackdrop");
  document.getElementById("openSettings").addEventListener("click", function(){ drawer.hidden = false; });
  document.getElementById("closeSettings").addEventListener("click", function(){ drawer.hidden = true; });
  drawer.addEventListener("click", function(e){ if (e.target === drawer) drawer.hidden = true; });

  function segWire(id, key, extra){
    var seg = document.getElementById(id);
    seg.querySelectorAll("button").forEach(function(b){
      b.addEventListener("click", function(){
        seg.querySelectorAll("button").forEach(function(x){ x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        settings[key] = b.dataset.value;
        saveSettings(); applySettings(); if (extra) extra();
      });
    });
  }
  segWire("themeSeg", "theme");
  segWire("fontSeg", "font");

  document.getElementById("sizeRange").addEventListener("input", function(e){
    settings.fontSize = +e.target.value; document.getElementById("sizeValue").textContent = settings.fontSize + "px";
    saveSettings(); applySettings();
  });
  document.getElementById("lineRange").addEventListener("input", function(e){
    settings.lineHeight = +e.target.value; document.getElementById("lineValue").textContent = settings.lineHeight.toFixed(1);
    saveSettings(); applySettings();
  });
  document.getElementById("trackRange").addEventListener("input", function(e){
    settings.tracking = +e.target.value; document.getElementById("trackValue").textContent = settings.tracking.toFixed(2) + "em";
    saveSettings(); applySettings();
  });
  document.getElementById("rateRange").addEventListener("input", function(e){
    settings.rate = +e.target.value; document.getElementById("rateValue").textContent = settings.rate.toFixed(2) + "×";
    saveSettings();
  });
  document.getElementById("bionicToggle").addEventListener("change", function(e){
    settings.bionic = e.target.checked; saveSettings(); renderReadingText(currentText);
  });
  document.getElementById("tintRow").querySelectorAll(".swatch").forEach(function(sw){
    sw.addEventListener("click", function(){
      document.getElementById("tintRow").querySelectorAll(".swatch").forEach(function(x){ x.setAttribute("aria-pressed", "false"); });
      sw.setAttribute("aria-pressed", "true");
      settings.tint = sw.dataset.tint; saveSettings(); applySettings();
    });
  });

  function applySettings(){
    var root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", settings.theme);
    root.style.setProperty("--font-reading", settings.font === "lexend" ? "'Lexend','Segoe UI',sans-serif" : "'Atkinson Hyperlegible','Segoe UI',sans-serif");
    root.style.setProperty("--reading-size", settings.fontSize + "px");
    root.style.setProperty("--reading-line", settings.lineHeight);
    root.style.setProperty("--reading-tracking", settings.tracking + "em");
    document.getElementById("readingSurface").setAttribute("data-tint", settings.tint);

    document.getElementById("themeSeg").querySelectorAll("button").forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.value === settings.theme ? "true":"false"); });
    document.getElementById("fontSeg").querySelectorAll("button").forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.value === settings.font ? "true":"false"); });
    document.getElementById("sizeRange").value = settings.fontSize; document.getElementById("sizeValue").textContent = settings.fontSize + "px";
    document.getElementById("lineRange").value = settings.lineHeight; document.getElementById("lineValue").textContent = settings.lineHeight.toFixed(1);
    document.getElementById("trackRange").value = settings.tracking; document.getElementById("trackValue").textContent = settings.tracking.toFixed(2) + "em";
    document.getElementById("rateRange").value = settings.rate; document.getElementById("rateValue").textContent = settings.rate.toFixed(2) + "×";
    document.getElementById("bionicToggle").checked = settings.bionic;
    document.getElementById("tintRow").querySelectorAll(".swatch").forEach(function(x){ x.setAttribute("aria-pressed", x.dataset.tint === settings.tint ? "true":"false"); });
  }

  /* ---------------- Speech synthesis ---------------- */
  var hasTTS = "speechSynthesis" in window;
  if (!hasTTS){ document.getElementById("ttsNote").textContent = "La lectura en veu alta no és disponible en aquest navegador."; }

  function pickVoice(){
    var voices = window.speechSynthesis.getVoices();
    return voices.find(function(v){ return /^ca/i.test(v.lang); }) ||
           voices.find(function(v){ return /^es/i.test(v.lang); }) || voices[0];
  }

  function speak(text, opts){
    if (!hasTTS) return;
    opts = opts || {};
    window.speechSynthesis.cancel();
    var utt = new SpeechSynthesisUtterance(text);
    utt.lang = "ca-ES";
    utt.rate = settings.rate;
    var v = pickVoice(); if (v) utt.voice = v;
    if (opts.highlight) utt.onboundary = function(e){ if (e.charIndex !== undefined) highlightAt(e.charIndex); };
    else if (opts.onBoundary) utt.onboundary = function(e){ if (e.charIndex !== undefined) opts.onBoundary(e.charIndex); };
    utt.onend = function(){ setPlayState(false); if (opts.onEnd) opts.onEnd(); };
    utt.onerror = function(){ setPlayState(false); };
    window.speechSynthesis.speak(utt);
    if (opts.highlight) setPlayState(true);
  }

  var playBtn = document.getElementById("playBtn");
  function setPlayState(playing){ playBtn.textContent = playing ? "⏸ Llegint…" : "▶ Llegeix en veu alta"; }
  playBtn.addEventListener("click", function(){
    if (!hasTTS) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused){
      window.speechSynthesis.pause(); setPlayState(false); return;
    }
    if (window.speechSynthesis.paused){
      window.speechSynthesis.resume(); setPlayState(true); return;
    }
    speak(currentText, {highlight:true});
  });
  document.getElementById("stopBtn").addEventListener("click", function(){
    if (hasTTS) window.speechSynthesis.cancel();
    setPlayState(false);
    document.querySelectorAll(".word.active").forEach(function(w){ w.classList.remove("active"); });
  });

  /* ---------------- Reader ---------------- */
  function sampleText(s){ return typeof s === "string" ? s : s.text; }
  var currentText = sampleText(SAMPLES[0]);
  (function fillSampleSelect(){
    var sel = document.getElementById("sampleSelect");
    sel.innerHTML = '<option value="">Tria un text d\'exemple…</option>';
    SAMPLES.forEach(function(s, i){
      var o = document.createElement("option");
      o.value = i; o.textContent = typeof s === "string" ? s.slice(0, 40) + "…" : s.title;
      sel.appendChild(o);
    });
  })();
  var currentWordSpans = [], currentWordOffsets = [];

  function renderReadingText(text){
    currentText = text;
    var container = document.getElementById("readingText");
    container.innerHTML = "";
    currentWordSpans = []; currentWordOffsets = [];
    var re = /\S+/g, m, lastIndex = 0;
    while ((m = re.exec(text))){
      if (m.index > lastIndex) container.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      var word = m[0];
      var span = document.createElement("span");
      span.className = "word";
      if (settings.bionic){
        var boldLen = Math.max(1, Math.ceil(word.length * 0.5));
        var strong = document.createElement("strong");
        strong.textContent = word.slice(0, boldLen);
        span.appendChild(strong);
        span.appendChild(document.createTextNode(word.slice(boldLen)));
      } else {
        span.textContent = word;
      }
      container.appendChild(span);
      currentWordSpans.push(span); currentWordOffsets.push(m.index);
      lastIndex = m.index + word.length;
    }
    if (lastIndex < text.length) container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  function highlightAt(charIndex){
    var idx = -1;
    for (var i = 0; i < currentWordOffsets.length; i++){
      if (currentWordOffsets[i] <= charIndex) idx = i; else break;
    }
    if (idx >= 0){
      currentWordSpans.forEach(function(s){ s.classList.remove("active"); });
      currentWordSpans[idx].classList.add("active");
      currentWordSpans[idx].scrollIntoView({block:"nearest", behavior:"smooth"});
    }
  }

  function buildWordSpans(container, text){
    container.innerHTML = "";
    var spans = [], offsets = [];
    var re = /\S+/g, m, lastIndex = 0;
    while ((m = re.exec(text))){
      if (m.index > lastIndex) container.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      var span = document.createElement("span");
      span.className = "word";
      span.textContent = m[0];
      container.appendChild(span);
      spans.push(span); offsets.push(m.index);
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length) container.appendChild(document.createTextNode(text.slice(lastIndex)));
    return { spans: spans, offsets: offsets };
  }
  function highlightWordAt(spans, offsets, charIndex){
    var idx = -1;
    for (var i = 0; i < offsets.length; i++){ if (offsets[i] <= charIndex) idx = i; else break; }
    spans.forEach(function(s){ s.classList.remove("active"); });
    if (idx >= 0){ spans[idx].classList.add("active"); spans[idx].scrollIntoView({block:"nearest", behavior:"smooth"}); }
  }

  document.getElementById("loadSample").addEventListener("click", function(){
    var idx = document.getElementById("sampleSelect").value;
    if (idx === "") return;
    document.getElementById("ownText").value = sampleText(SAMPLES[+idx]);
    renderReadingText(sampleText(SAMPLES[+idx]));
  });
  document.getElementById("updateText").addEventListener("click", function(){
    var t = document.getElementById("ownText").value.trim();
    if (t) renderReadingText(t);
  });

  /* ---------------- Descodificació: dades noves ---------------- */
  var WORD_OR_PSEUDO_ITEMS = BANKS.WORD_OR_PSEUDO_ITEMS;
  var ORDENA_SYLLABLE_WORDS = BANKS.ORDENA_SYLLABLE_WORDS;
  var COMPLETA_PARAULA_ITEMS = BANKS.COMPLETA_PARAULA_ITEMS;

  /* ---- Lletres b · d · p · q ---- */
  var letterState = { target:"b", found:0, total:0, wrong:0, container:null };
  function renderLletresBDPQ(container){
    container.innerHTML =
      '<div class="reader-toolbar" style="justify-content:space-between;">' +
        '<p class="section-hint">Fes clic a totes les lletres «<b id="letterTarget">b</b>» de la graella abans que no quedi cap més.</p>' +
        '<span class="score-pill" id="letterScore">0 / 0</span>' +
      '</div>' +
      '<div class="letters-grid" id="lettersGrid"></div>' +
      '<div id="letterFeedback"></div>' +
      '<div><button class="ghost-btn" id="newLetterRound">Nova ronda</button></div>';
    container.querySelector("#newLetterRound").addEventListener("click", function(){ newLetterRound(container); });
    newLetterRound(container);
  }
  function newLetterRound(container){
    var target = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    letterState = { target: target, found:0, total:0, wrong:0, container: container };
    container.querySelector("#letterTarget").textContent = target;
    container.querySelector("#letterFeedback").innerHTML = "";
    var size = 36, targetCount = 7 + Math.floor(Math.random() * 3);
    var pool = LETTERS.concat(NEUTRAL_LETTERS);
    var cells = [];
    for (var i = 0; i < targetCount; i++) cells.push(target);
    while (cells.length < size){
      var c = pool[Math.floor(Math.random() * pool.length)];
      cells.push(c);
    }
    cells.sort(function(){ return Math.random() - 0.5; });
    letterState.total = targetCount;
    var grid = container.querySelector("#lettersGrid");
    grid.innerHTML = "";
    cells.forEach(function(ch){
      var btn = document.createElement("button");
      btn.className = "letter-cell";
      btn.textContent = ch;
      btn.addEventListener("click", function(){
        if (btn.disabled) return;
        if (ch === letterState.target){
          btn.classList.add("found"); btn.disabled = true;
          letterState.found += 1;
          updateLetterScore();
          if (letterState.found === letterState.total) finishLetterRound();
        } else {
          btn.classList.add("wrong"); btn.disabled = true;
          letterState.wrong += 1;
          updateLetterScore();
        }
      });
      grid.appendChild(btn);
    });
    updateLetterScore();
  }
  function updateLetterScore(){
    letterState.container.querySelector("#letterScore").textContent = letterState.found + " / " + letterState.total + (letterState.wrong ? " · " + letterState.wrong + " errors" : "");
  }
  function finishLetterRound(){
    var perfect = letterState.wrong === 0;
    recordActivity("letters", perfect);
    letterState.container.querySelector("#letterFeedback").innerHTML =
      '<div class="feedback-banner ' + (perfect ? "ok" : "bad") + '">' +
      (perfect ? "Molt bé! Les has trobat totes sense errors." : "Ronda completa amb " + letterState.wrong + " error(s). Segueix practicant!") +
      "</div>";
  }

  // Quatre opcions numèriques diferents al voltant de n (sempre ≥ 1). Amb n = 1 només hi ha
  // valors per sobre, per això els candidats s'amplien cap amunt.
  function numberOptions(n){
    var candidates = [];
    for (var v = Math.max(1, n - 2); candidates.length < 6; v++) if (v !== n) candidates.push(v);
    candidates.sort(function(){ return Math.random() - 0.5; });
    return new Set([n].concat(candidates.slice(0, 3)));
  }

  /* ---- Compta les síl·labes ---- */
  var lastSyllableWord = null;
  function renderComptaSillabes(container){
    container.innerHTML =
      '<p class="section-hint">Quantes síl·labes té aquesta paraula?</p>' +
      '<p class="prompt-word adaptive-text" id="syllableWord">casa</p>' +
      '<div class="choice-row" id="syllableChoices"></div>' +
      '<div id="syllableFeedback"></div>' +
      '<div><button class="ghost-btn" id="newSyllableRound">Següent paraula</button></div>';
    container.querySelector("#newSyllableRound").addEventListener("click", function(){ newSyllableRound(container); });
    newSyllableRound(container);
  }
  function newSyllableRound(container){
    var pick = pickRandom(SYLLABLE_WORDS, function(w){ return w === lastSyllableWord; });
    lastSyllableWord = pick;
    container.querySelector("#syllableWord").textContent = pick.w;
    container.querySelector("#syllableFeedback").innerHTML = "";
    var options = numberOptions(pick.n);
    var opts = Array.from(options).sort(function(){ return Math.random() - 0.5; });
    var row = container.querySelector("#syllableChoices");
    row.innerHTML = "";
    opts.forEach(function(n){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = n;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (+b.textContent === pick.n) b.classList.add("correct"); });
        var correct = n === pick.n;
        if (!correct) btn.classList.add("incorrect");
        recordActivity("syllables", correct);
        container.querySelector("#syllableFeedback").innerHTML =
          '<div class="feedback-banner ' + (correct ? "ok" : "bad") + '">' +
          (correct ? "Correcte, «" + pick.w + "» té " + pick.n + " síl·labes." : "«" + pick.w + "» té " + pick.n + " síl·labes.") +
          "</div>";
      });
      row.appendChild(btn);
    });
  }

  /* ---- Rimes ---- */
  function renderRimes(container){
    container.innerHTML =
      '<p class="section-hint" id="rhymePrompt">Quina paraula rima amb «estrella»?</p>' +
      '<div class="choice-row" id="rhymeChoices"></div>' +
      '<div id="rhymeFeedback"></div>' +
      '<div><button class="ghost-btn" id="newRhymeRound">Següent paraula</button></div>';
    container.querySelector("#newRhymeRound").addEventListener("click", function(){ newRhymeRound(container); });
    newRhymeRound(container);
  }
  function newRhymeRound(container){
    var group = pickRandom(RHYME_GROUPS);
    var target = group[0];
    var correct = group[1 + Math.floor(Math.random() * (group.length - 1))];
    var distractors = [];
    while (distractors.length < 2){
      var og = RHYME_GROUPS[Math.floor(Math.random() * RHYME_GROUPS.length)];
      if (og === group) continue;
      var w = og[Math.floor(Math.random() * og.length)];
      if (distractors.indexOf(w) === -1) distractors.push(w);
    }
    var opts = [correct].concat(distractors).sort(function(){ return Math.random() - 0.5; });
    container.querySelector("#rhymePrompt").innerHTML = 'Quina paraula rima amb «' + target + '»?';
    container.querySelector("#rhymeFeedback").innerHTML = "";
    var row = container.querySelector("#rhymeChoices");
    row.innerHTML = "";
    opts.forEach(function(word){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = word;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === correct) b.classList.add("correct"); });
        var ok = word === correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("rhymes", ok);
        container.querySelector("#rhymeFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' +
          (ok ? "Exacte, riment totes dues!" : "«" + target + "» rima amb «" + correct + "».") + "</div>";
      });
      row.appendChild(btn);
    });
  }

  /* ---- Paraula o pseudoparaula ---- */
  var lastWordPseudo = null;
  function renderParaulaOPseudoparaula(container){
    var item = pickRandom(WORD_OR_PSEUDO_ITEMS, function(it){ return it === lastWordPseudo; });
    lastWordPseudo = item;
    container.innerHTML =
      '<p class="section-hint">Llegeix la paraula en veu alta i digues si és real o inventada.</p>' +
      '<p class="prompt-word adaptive-text">' + item.text + '</p>' +
      '<div class="choice-row" id="wpChoices"></div>' +
      '<div id="wpFeedback"></div>' +
      '<div><button class="ghost-btn" id="wpNext">Nova paraula</button></div>';
    var row = container.querySelector("#wpChoices");
    [["Paraula real", true], ["Paraula inventada", false]].forEach(function(opt){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = opt[0];
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; });
        var ok = opt[1] === item.real;
        btn.classList.add(ok ? "correct" : "incorrect");
        recordActivity("pseudoparaula", ok);
        container.querySelector("#wpFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">«' + item.text + '» és ' + (item.real ? "una paraula real." : "una paraula inventada (pseudoparaula).") + "</div>";
      });
      row.appendChild(btn);
    });
    container.querySelector("#wpNext").addEventListener("click", function(){ renderParaulaOPseudoparaula(container); });
  }

  /* ---- Construeix la paraula ---- */
  var lastConstrueix = null;
  function renderConstrueixLaParaula(container){
    var item = pickRandom(PHONEME_WORDS, function(it){ return it === lastConstrueix; });
    lastConstrueix = item;
    var pool = item.phonemes.slice().sort(function(){ return Math.random() - 0.5; });
    var picked = [];
    container.innerHTML =
      '<p class="section-hint">Fes clic als fragments en l\'ordre correcte per formar la paraula.</p>' +
      '<div class="reader-toolbar" id="buildAssembly" style="min-height:52px;"></div>' +
      '<div class="choice-row" id="buildPool"></div>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="buildCheck">Comprova</button><button class="ghost-btn" id="buildReset">Reinicia</button></div>' +
      '<div id="buildFeedback"></div>' +
      '<div><button class="ghost-btn" id="buildNext">Nova paraula</button></div>';
    var assembly = container.querySelector("#buildAssembly");
    var poolEl = container.querySelector("#buildPool");
    function renderPool(){
      poolEl.innerHTML = "";
      pool.forEach(function(frag, idx){
        var btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.textContent = frag;
        btn.disabled = picked.indexOf(idx) !== -1;
        btn.addEventListener("click", function(){ picked.push(idx); renderAssembly(); renderPool(); });
        poolEl.appendChild(btn);
      });
    }
    function renderAssembly(){
      assembly.innerHTML = picked.map(function(idx){ return '<span class="choice-btn" style="cursor:default;">' + pool[idx] + "</span>"; }).join("");
    }
    renderPool(); renderAssembly();
    container.querySelector("#buildReset").addEventListener("click", function(){ picked = []; renderAssembly(); renderPool(); });
    container.querySelector("#buildCheck").addEventListener("click", function(){
      var assembled = picked.map(function(idx){ return pool[idx]; }).join("");
      var ok = assembled === item.phonemes.join("");
      recordActivity("construeix", ok);
      container.querySelector("#buildFeedback").innerHTML =
        '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "Molt bé! Has format «" + item.word + "». " : "Encara no hi és. La paraula és «" + item.word + "». ") +
        '<button class="ghost-btn" id="buildSpeak" style="margin-left:8px;">🔊 Llegeix-la</button></div>';
      container.querySelector("#buildSpeak").addEventListener("click", function(){ speak(item.word, {}); });
    });
    container.querySelector("#buildNext").addEventListener("click", function(){ renderConstrueixLaParaula(container); });
  }

  /* ---- Ordena síl·labes ---- */
  var lastOrdenaWord = null;
  function renderOrdenaSillabes(container){
    var item = pickRandom(ORDENA_SYLLABLE_WORDS, function(it){ return it === lastOrdenaWord; });
    lastOrdenaWord = item;
    var pool = item.syll.slice().sort(function(){ return Math.random() - 0.5; });
    var picked = [];
    container.innerHTML =
      '<p class="section-hint">Fes clic a les síl·labes en l\'ordre correcte per formar la paraula.</p>' +
      '<div class="reader-toolbar" id="syllAssembly" style="min-height:52px;"></div>' +
      '<div class="choice-row" id="syllPool"></div>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="syllCheck">Comprova</button><button class="ghost-btn" id="syllReset">Reinicia</button></div>' +
      '<div id="syllFeedback"></div>' +
      '<div><button class="ghost-btn" id="syllNext">Nova paraula</button></div>';
    var assembly = container.querySelector("#syllAssembly");
    var poolEl = container.querySelector("#syllPool");
    function renderPool(){
      poolEl.innerHTML = "";
      pool.forEach(function(frag, idx){
        var btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.textContent = frag;
        btn.disabled = picked.indexOf(idx) !== -1;
        btn.addEventListener("click", function(){ picked.push(idx); renderAssembly(); renderPool(); });
        poolEl.appendChild(btn);
      });
    }
    function renderAssembly(){
      assembly.innerHTML = picked.map(function(idx){ return '<span class="choice-btn" style="cursor:default;">' + pool[idx] + "</span>"; }).join("");
    }
    renderPool(); renderAssembly();
    container.querySelector("#syllReset").addEventListener("click", function(){ picked = []; renderAssembly(); renderPool(); });
    container.querySelector("#syllCheck").addEventListener("click", function(){
      var assembled = picked.map(function(idx){ return pool[idx]; }).join("");
      var ok = assembled === item.syll.join("");
      recordActivity("ordenaSillabes", ok);
      container.querySelector("#syllFeedback").innerHTML =
        '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "Molt bé! Has format «" + item.word + "»." : "Encara no hi és. La paraula és «" + item.word + "».") + "</div>";
    });
    container.querySelector("#syllNext").addEventListener("click", function(){ renderOrdenaSillabes(container); });
  }

  /* ---- Completa la paraula ---- */
  var lastCompletaItem = null;
  function renderCompletaLaParaula(container){
    var item = pickRandom(COMPLETA_PARAULA_ITEMS, function(it){ return it === lastCompletaItem; });
    lastCompletaItem = item;
    var opts = item.options.slice().sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Quin fragment completa correctament la paraula?</p>' +
      '<p class="prompt-word adaptive-text">' + item.before + '<span style="color:var(--ink-muted);">___</span>' + item.after + '</p>' +
      '<div class="choice-row" id="completaChoices"></div>' +
      '<div id="completaFeedback"></div>' +
      '<div><button class="ghost-btn" id="completaNext">Nova paraula</button></div>';
    var row = container.querySelector("#completaChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = w === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("completaParaula", ok);
        container.querySelector("#completaFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">La paraula és «' + item.word + '».</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#completaNext").addEventListener("click", function(){ renderCompletaLaParaula(container); });
  }

  var DESCODIFICACIO_ACTIVITIES = [
    { id:"lletres", name:"Lletres b · d · p · q", desc:"Troba totes les lletres iguals en una graella.", render: renderLletresBDPQ },
    { id:"sillabes-compte", name:"Compta les síl·labes", desc:"Quantes síl·labes té la paraula?", render: renderComptaSillabes },
    { id:"rimes", name:"Rimes", desc:"Troba la paraula que rima.", render: renderRimes },
    { id:"pseudoparaula", name:"Paraula o pseudoparaula", desc:"Decideix si el que llegeixes és una paraula real o inventada.", render: renderParaulaOPseudoparaula },
    { id:"construeix", name:"Construeix la paraula", desc:"Ordena els fragments d'una paraula i llegeix-la.", render: renderConstrueixLaParaula },
    { id:"ordena-sillabes", name:"Ordena síl·labes", desc:"Ordena les síl·labes desordenades d'una paraula.", render: renderOrdenaSillabes },
    { id:"completa", name:"Completa la paraula", desc:"Escull el fragment que falta.", render: renderCompletaLaParaula }
  ];
  var descoGrid = document.getElementById("grid-descodificacio");
  var descoDetail = document.getElementById("descodificacio-detail");
  var descoView = document.getElementById("descodificacio-view");
  function showDescodificacioGrid(){ descoDetail.hidden = true; descoGrid.hidden = false; }
  function openDescodificacioActivity(a){ descoGrid.hidden = true; descoDetail.hidden = false; descoView.innerHTML = ""; a.render(descoView); }
  renderActivityGrid(descoGrid, DESCODIFICACIO_ACTIVITIES, openDescodificacioActivity);
  document.getElementById("descodificacio-back").addEventListener("click", showDescodificacioGrid);

  /* ---------------- Ortografia: helpers compartits ---------------- */
  function normalizeWord(w){ return w.toLowerCase().replace(/[.,;:!¿?"']/g, ""); }
  /* Tria un element. Si la llista és un banc d'exemples, es treu de la baralla del perfil
     (sense repeticions fins acabar-la); si no, es tria a l'atzar com sempre. */
  var bankRegistry = null;
  var pickedLabels = {};   // últim element tret de cada banc (per al registre dels informes)
  function bankNameOf(arr){
    if (!bankRegistry){
      bankRegistry = new Map();
      Object.keys(BANKS).forEach(function(k){ bankRegistry.set(BANKS[k], { name:k, label:k }); });
      bankRegistry.set(MEMORY_WORDS, { name:"MEMORY_WORDS", label:"MEMORY_WORDS" });
      SPELLING_PATTERNS.forEach(function(p){ bankRegistry.set(p.words, { name:"SPELLING_PATTERNS/" + p.id, label:"SPELLING_PAIRS" }); });
    }
    return bankRegistry.get(arr) || null;
  }
  function shuffledIndices(n, avoidFirst){
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    for (var j = n - 1; j > 0; j--){ var r = Math.floor(Math.random() * (j + 1)); var t = order[j]; order[j] = order[r]; order[r] = t; }
    if (n > 1 && order[0] === avoidFirst){ var s = order[0]; order[0] = order[1]; order[1] = s; }
    return order;
  }
  var LABEL_FIELD = { MAIN_IDEA_ITEMS:"text", INFERENCE_ITEMS:"text", QUESTION_DURING_ITEMS:"question" };
  function itemLabel(item, bankLabel){
    if (typeof item === "string") return item;
    if (item && LABEL_FIELD[bankLabel] && item[LABEL_FIELD[bankLabel]]) return item[LABEL_FIELD[bankLabel]];
    if (Array.isArray(item)) return item.filter(function(x){ return typeof x === "string"; }).slice(0, 3).join(", ");
    if (!item || typeof item !== "object") return "";
    if (item.a && item.b) return item.a + " / " + item.b;
    var keys = ["title","word","w","label","correct","base","syllable","sound","question","hint","sentence","text"];
    for (var i = 0; i < keys.length; i++){ if (typeof item[keys[i]] === "string" && item[keys[i]]) return item[keys[i]]; }
    if (item.fragments) return item.fragments[0];
    if (item.segments) return item.segments.join(" ");
    if (item.sentences) return typeof item.sentences[0] === "string" ? item.sentences[0] : item.sentences[0].text;
    return "";
  }
  function pickRandom(arr, excludeFn){
    var item, bank = bankNameOf(arr);
    if (!bank || arr.length < 2){
      do { item = arr[Math.floor(Math.random() * arr.length)]; } while (arr.length > 1 && excludeFn && excludeFn(item));
    } else {
      var d = decks[bank.name];
      if (!d || d.n !== arr.length || !Array.isArray(d.order)) d = decks[bank.name] = { n: arr.length, order: shuffledIndices(arr.length), pos: 0 };
      for (var tries = 0; tries <= arr.length; tries++){
        if (d.pos >= d.order.length){ d.order = shuffledIndices(arr.length, d.order[d.order.length - 1]); d.pos = 0; }
        item = arr[d.order[d.pos++]];
        if (!(excludeFn && excludeFn(item))) break;
      }
      saveDecks();
    }
    if (bank){ var l = itemLabel(item, bank.label); pickedLabels[bank.label] = l.length > 80 ? l.slice(0, 77) + "…" : l; }
    return item;
  }
  // Activitat → banc del qual surt l'element que es practica (per saber què s'ha encertat o fallat).
  var TYPE_BANK = {
    syllables:"SYLLABLE_WORDS", rhymes:"RHYME_GROUPS", pseudoparaula:"WORD_OR_PSEUDO_ITEMS", construeix:"PHONEME_WORDS",
    ordenaSillabes:"ORDENA_SYLLABLE_WORDS", completaParaula:"COMPLETA_PARAULA_ITEMS",
    dictation:"SENTENCES", dictatPreparat:"DICTAT_PREPARAT_SETS", memoria:"MEMORY_WORDS", patrons:"SPELLING_PATTERNS",
    detectiu:"DETECTIVE_ITEMS", grafia:"SPELLING_PAIRS",
    segmentacio:"PHONEME_WORDS", eliminaSo:"SOUND_DELETE_ITEMS", canviaSo:"SOUND_CHANGE_ITEMS", detectaSo:"SOUND_DETECT_SETS",
    escoltaTria:"LISTEN_CHOOSE_ITEMS", semblants:"SIMILAR_PAIRS", parelles:"SOUND_PAIR_ITEMS", bingo:"BINGO_SETS",
    familia:"WORD_FAMILIES", prefixSufix:"PREFIX_SUFFIX_ITEMS", vocabContextual:"VOCAB_CONTEXTUAL_ITEMS", intrusa:"INTRUDER_ITEMS",
    sinantonim:"SYNANT_ITEMS", completaFrase:"COMPLETA_FRASE_ITEMS", paraulaFrase:"WORD_SENTENCE_ITEMS",
    lecturaGuiada:"GUIDED_SENTENCES", lecturaRepetida:"FLUENCY_PARAGRAPHS", suportAuditiu:"FLUENCY_PARAGRAPHS",
    lecturaPauses:"PAUSE_SENTENCES", repteFluidesa:"FLUENCY_PARAGRAPHS", textFuncional:"FUNCTIONAL_TEXTS",
    prediccio:"PREDICTION_ITEMS", preguntaDurant:"QUESTION_DURING_ITEMS", ideaPrincipal:"MAIN_IDEA_ITEMS",
    ordenaHistoria:"STORY_ORDER_ITEMS", quePodemDeduir:"INFERENCE_ITEMS", evidenciaTextual:"EVIDENCE_ITEMS",
    informacioImportant:"KEY_INFO_ITEMS", construeixResum:"SUMMARY_ITEMS", respostaOral:"ORAL_READING_ITEMS",
    missioLectura:"MISSION_ITEMS"
  };
  function letterDiffHTML(typed, correct){
    var html = "";
    for (var i = 0; i < correct.length; i++){
      var ok = typed[i] && typed[i].toLowerCase() === correct[i].toLowerCase();
      html += '<span class="' + (ok ? "match" : "miss") + '">' + correct[i] + "</span>";
    }
    return html;
  }

  /* ---- Dictat interactiu ---- */
  function renderDictatInteractiu(container){
    container.innerHTML =
      '<p class="section-hint">Escolta la frase i escriu-la tal com l\'has sentida.</p>' +
      '<div class="reader-toolbar"><button class="play-btn" id="oiPlay">▶ Escolta la frase</button></div>' +
      '<textarea class="field" id="oiInput" placeholder="Escriu aquí el que has escoltat…"></textarea>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="oiCheck">Comprova</button><button class="ghost-btn" id="oiNew">Nova frase</button></div>' +
      '<div id="oiResult"></div>';
    var active = pickRandom(SENTENCES);
    container.querySelector("#oiPlay").addEventListener("click", function(){ speak(active, {}); });
    container.querySelector("#oiNew").addEventListener("click", function(){
      active = pickRandom(SENTENCES, function(s){ return s === active; });
      container.querySelector("#oiInput").value = "";
      container.querySelector("#oiResult").innerHTML = "";
    });
    container.querySelector("#oiCheck").addEventListener("click", function(){
      var typed = container.querySelector("#oiInput").value.trim();
      var originalWords = active.split(/\s+/);
      var typedWords = typed.split(/\s+/).filter(Boolean);
      var matches = 0, mistakes = [];
      var html = originalWords.map(function(w, i){
        var ok = typedWords[i] && normalizeWord(typedWords[i]) === normalizeWord(w);
        if (ok) matches++; else mistakes.push({ typed: typedWords[i] || "—", correct: w });
        return '<span class="' + (ok ? "match" : "miss") + '">' + w + "</span>";
      }).join(" ");
      var accuracy = Math.round((matches / originalWords.length) * 100);
      recordActivity("dictation", accuracy === 100);
      var detail = mistakes.length ? '<ul style="margin:8px 0 0; padding-left:18px; font-size:13px; color:var(--ink-secondary);">' +
        mistakes.map(function(m){ return "<li>Has escrit «" + m.typed + "», la paraula correcta és «" + m.correct + "».</li>"; }).join("") + "</ul>" : "";
      container.querySelector("#oiResult").innerHTML =
        '<div class="feedback-banner ' + (accuracy === 100 ? "ok" : "bad") + '">Precisió: ' + accuracy + "%</div>" +
        '<div class="diff-line" style="margin-top:10px;">' + html + "</div>" + detail;
    });
  }

  /* ---- Dictat preparat ---- */
  var dictatPreparatState = null;
  function renderDictatPreparat(container){
    var set = pickRandom(DICTAT_PREPARAT_SETS);
    dictatPreparatState = { set: set, step: 0 };
    renderDictatPreparatStep(container);
  }
  function renderDictatPreparatStep(container){
    var st = dictatPreparatState;
    if (st.step < st.set.words.length){
      var word = st.set.words[st.step];
      container.innerHTML =
        '<p class="section-hint">Pas ' + (st.step + 1) + ' de ' + (st.set.words.length + 1) + ': practica aquesta paraula abans del dictat.</p>' +
        '<div class="reader-toolbar"><button class="play-btn" id="dpPlay">▶ Escolta la paraula</button></div>' +
        '<textarea class="field" id="dpInput" style="min-height:44px;" placeholder="Escriu la paraula…"></textarea>' +
        '<div class="reader-toolbar"><button class="ghost-btn" id="dpCheck">Comprova</button></div>' +
        '<div id="dpResult"></div>';
      container.querySelector("#dpPlay").addEventListener("click", function(){ speak(word, {}); });
      container.querySelector("#dpCheck").addEventListener("click", function(){
        var typed = container.querySelector("#dpInput").value.trim();
        var ok = typed.toLowerCase() === word.toLowerCase();
        recordActivity("dictatPreparat", ok);
        container.querySelector("#dpResult").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "Ben escrit!" : "Gairebé — la forma correcta és «" + word + "».") + '</div>' +
          '<div class="reader-toolbar" style="margin-top:10px;"><button class="ghost-btn" id="dpNext">Continua</button></div>';
        container.querySelector("#dpNext").addEventListener("click", function(){
          st.step += 1;
          renderDictatPreparatStep(container);
        });
      });
    } else {
      container.innerHTML =
        '<p class="section-hint">Ara escolta la frase sencera i escriu-la.</p>' +
        '<div class="reader-toolbar"><button class="play-btn" id="dpPlaySentence">▶ Escolta la frase</button></div>' +
        '<textarea class="field" id="dpSentenceInput" placeholder="Escriu aquí la frase…"></textarea>' +
        '<div class="reader-toolbar"><button class="ghost-btn" id="dpCheckSentence">Comprova</button><button class="ghost-btn" id="dpRestart">Nova ronda</button></div>' +
        '<div id="dpSentenceResult"></div>';
      container.querySelector("#dpPlaySentence").addEventListener("click", function(){ speak(st.set.sentence, {}); });
      container.querySelector("#dpCheckSentence").addEventListener("click", function(){
        var typed = container.querySelector("#dpSentenceInput").value.trim();
        var originalWords = st.set.sentence.split(/\s+/);
        var typedWords = typed.split(/\s+/).filter(Boolean);
        var matches = 0;
        var html = originalWords.map(function(w, i){
          var ok = typedWords[i] && normalizeWord(typedWords[i]) === normalizeWord(w);
          if (ok) matches++;
          return '<span class="' + (ok ? "match" : "miss") + '">' + w + "</span>";
        }).join(" ");
        var accuracy = Math.round((matches / originalWords.length) * 100);
        recordActivity("dictatPreparat", accuracy === 100);
        container.querySelector("#dpSentenceResult").innerHTML =
          '<div class="feedback-banner ' + (accuracy === 100 ? "ok" : "bad") + '">Precisió: ' + accuracy + "%</div>" +
          '<div class="diff-line" style="margin-top:10px;">' + html + "</div>";
      });
      container.querySelector("#dpRestart").addEventListener("click", function(){ renderDictatPreparat(container); });
    }
  }

  /* ---- Memòria ortogràfica ---- */
  var MEMORY_WORDS = SPELLING_WORDS.concat(SPELLING_PATTERNS.reduce(function(acc, p){
    return acc.concat(p.words.map(function(w){ return w.correct; }));
  }, []));
  function renderMemoriaOrtografica(container){
    var word = pickRandom(MEMORY_WORDS);
    container.innerHTML =
      '<p class="section-hint">Memoritza la paraula: apareixerà 3 segons i després s\'amagarà.</p>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="memShow">Mostra la paraula</button></div>' +
      '<p class="prompt-word adaptive-text" id="memWord" style="min-height:48px;"></p>' +
      '<div id="memInputArea" hidden>' +
        '<textarea class="field" id="memInput" style="min-height:44px;" placeholder="Escriu la paraula de memòria…"></textarea>' +
        '<div class="reader-toolbar" style="margin-top:10px;"><button class="ghost-btn" id="memCheck">Comprova</button><button class="ghost-btn" id="memNext">Nova paraula</button></div>' +
      '</div>' +
      '<div id="memResult"></div>';
    container.querySelector("#memShow").addEventListener("click", function(){
      container.querySelector("#memShow").disabled = true;
      container.querySelector("#memWord").textContent = word;
      setTimeout(function(){
        container.querySelector("#memWord").textContent = new Array(word.length + 1).join("•");
        container.querySelector("#memInputArea").hidden = false;
      }, 3000);
    });
    container.querySelector("#memCheck").addEventListener("click", function(){
      var typed = container.querySelector("#memInput").value.trim();
      var ok = typed.toLowerCase() === word.toLowerCase();
      recordActivity("memoria", ok);
      container.querySelector("#memResult").innerHTML =
        '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "Memòria perfecta!" : "Gairebé, mira la comparació:") + '</div>' +
        '<div class="diff-line" style="margin-top:10px;">' + letterDiffHTML(typed, word) + "</div>";
    });
    container.querySelector("#memNext").addEventListener("click", function(){ renderMemoriaOrtografica(container); });
  }

  /* ---- Caça de patrons ---- */
  function renderCacaDePatrons(container){
    var pattern = pickRandom(SPELLING_PATTERNS);
    var examples = pattern.words.slice(0, 4).map(function(w){ return w.correct; });
    var otherLabels = SPELLING_PATTERNS.filter(function(p){ return p.id !== pattern.id; }).map(function(p){ return p.label; });
    otherLabels.sort(function(){ return Math.random() - 0.5; });
    var options = [pattern.label].concat(otherLabels.slice(0, 3)).sort(function(){ return Math.random() - 0.5; });

    container.innerHTML =
      '<p class="section-hint">Aquestes paraules comparteixen una dificultat ortogràfica. Quina és?</p>' +
      '<div class="letters-grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr));">' +
        examples.map(function(w){ return '<div class="letter-cell" style="font-size:16px;">' + w + '</div>'; }).join("") +
      '</div>' +
      '<div class="choice-row" id="patternChoices"></div>' +
      '<div id="patternFeedback"></div>' +
      '<div id="patternStep2"></div>' +
      '<div><button class="ghost-btn" id="patternNext">Nou patró</button></div>';

    var row = container.querySelector("#patternChoices");
    options.forEach(function(label){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = label;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === pattern.label) b.classList.add("correct"); });
        var ok = label === pattern.label;
        if (!ok) btn.classList.add("incorrect");
        container.querySelector("#patternFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + pattern.hint + "</div>";
        showPatternStep2();
      });
      row.appendChild(btn);
    });

    function showPatternStep2(){
      var newFromPattern = pattern.words[4] ? pattern.words[4].correct : pattern.words[0].correct;
      var otherPattern = pickRandom(SPELLING_PATTERNS.filter(function(p){ return p.id !== pattern.id; }));
      var newFromOther = otherPattern.words[0].correct;
      var choices = [newFromPattern, newFromOther].sort(function(){ return Math.random() - 0.5; });
      var step2 = container.querySelector("#patternStep2");
      step2.innerHTML =
        '<p class="section-hint" style="margin-top:12px;">I ara: quina d\'aquestes paraules segueix el mateix patró («' + pattern.label + '»)?</p>' +
        '<div class="choice-row" id="patternChoices2"></div>';
      var row2 = step2.querySelector("#patternChoices2");
      choices.forEach(function(w){
        var btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.textContent = w;
        btn.addEventListener("click", function(){
          row2.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === newFromPattern) b.classList.add("correct"); });
          var ok = w === newFromPattern;
          if (!ok) btn.classList.add("incorrect");
          recordActivity("patrons", ok);
        });
        row2.appendChild(btn);
      });
    }

    container.querySelector("#patternNext").addEventListener("click", function(){ renderCacaDePatrons(container); });
  }

  /* ---- Detectiu d'errors ortogràfics ---- */
  var lastDetectiveItem = null;
  function renderDetectiuDerrors(container){
    var item = pickRandom(DETECTIVE_ITEMS, function(it){ return it === lastDetectiveItem; });
    lastDetectiveItem = item;
    container.innerHTML =
      '<p class="section-hint">Troba la paraula mal escrita en aquesta frase i fes-hi clic.</p>' +
      '<div class="diff-line" id="detectiveSentence"></div>' +
      '<div id="detectiveStep2"></div>' +
      '<div id="detectiveFeedback"></div>' +
      '<div><button class="ghost-btn" id="detectiveNext">Nova frase</button></div>';
    var wordsEl = container.querySelector("#detectiveSentence");
    function showSpellingChoice(){
      var opts = [item.correct, item.distractor].sort(function(){ return Math.random() - 0.5; });
      var step2 = container.querySelector("#detectiveStep2");
      step2.innerHTML = '<p class="section-hint" style="margin-top:12px;">Molt bé! Ara, com s\'escriu correctament?</p><div class="choice-row" id="detectiveChoices"></div>';
      var row = step2.querySelector("#detectiveChoices");
      opts.forEach(function(w){
        var btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.textContent = w;
        btn.addEventListener("click", function(){
          row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
          var ok = w === item.correct;
          if (!ok) btn.classList.add("incorrect");
          recordActivity("detectiu", ok);
          container.querySelector("#detectiveFeedback").innerHTML =
            '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">La forma correcta és «' + item.correct + '».</div>';
        });
        row.appendChild(btn);
      });
    }
    item.sentence.split(/\s+/).forEach(function(tok){
      var clean = tok.replace(/[.,;:!¿?]/g, "");
      var span = document.createElement("span");
      span.textContent = tok;
      span.style.cursor = "pointer";
      span.addEventListener("click", function(){
        if (span.dataset.done) return;
        if (clean === item.wrong || clean.split("'").pop() === item.wrong){
          span.classList.add("match");
          wordsEl.querySelectorAll("span").forEach(function(s){ s.dataset.done = "1"; s.style.cursor = "default"; });
          showSpellingChoice();
        } else {
          span.classList.add("miss");
          span.dataset.done = "1"; span.style.cursor = "default";
        }
      });
      wordsEl.appendChild(span);
      wordsEl.appendChild(document.createTextNode(" "));
    });
    container.querySelector("#detectiveNext").addEventListener("click", function(){ renderDetectiuDerrors(container); });
  }

  /* ---- Tria la grafia correcta ---- */
  var lastGrafiaWord = null;
  function renderTriaLaGrafia(container){
    var pattern = pickRandom(SPELLING_PATTERNS);
    var wordPair = pickRandom(pattern.words, function(w){ return w === lastGrafiaWord; });
    lastGrafiaWord = wordPair;
    var opts = [wordPair.correct, wordPair.wrong].sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Quina és la forma correcta d\'aquesta paraula?</p>' +
      '<div class="choice-row" id="grafiaChoices"></div>' +
      '<div id="grafiaFeedback"></div>' +
      '<div><button class="ghost-btn" id="grafiaNext">Següent paraula</button></div>';
    var row = container.querySelector("#grafiaChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === wordPair.correct) b.classList.add("correct"); });
        var ok = w === wordPair.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("grafia", ok);
        container.querySelector("#grafiaFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + pattern.hint + "</div>";
      });
      row.appendChild(btn);
    });
    container.querySelector("#grafiaNext").addEventListener("click", function(){ renderTriaLaGrafia(container); });
  }

  /* ---------------- Graella d'activitats (genèrica) ---------------- */
  function renderActivityGrid(grid, activities, onOpen){
    grid.innerHTML = "";
    activities.forEach(function(a){
      var btn = document.createElement("button");
      btn.className = "activity-card";
      btn.disabled = !a.render;
      btn.innerHTML = '<span class="name">' + a.name + '</span><span class="desc">' + a.desc + '</span>' +
        (a.render ? "" : '<span class="soon">Properament</span>');
      if (a.render) btn.addEventListener("click", function(){ onOpen(a); });
      grid.appendChild(btn);
    });
  }

  var ORTOGRAFIA_ACTIVITIES = [
    { id:"dictat-interactiu", name:"Dictat interactiu", desc:"Escolta una frase i escriu-la; el sistema mostra on has fallat.", render: renderDictatInteractiu },
    { id:"dictat-preparat", name:"Dictat preparat", desc:"Practica unes paraules soles i després en un dictat de frase.", render: renderDictatPreparat },
    { id:"memoria", name:"Memòria ortogràfica", desc:"Memoritza una paraula, s'amaga i l'has d'escriure de memòria.", render: renderMemoriaOrtografica },
    { id:"patrons", name:"Caça de patrons", desc:"Descobreix quina dificultat ortogràfica comparteixen unes paraules.", render: renderCacaDePatrons },
    { id:"detectiu", name:"Detectiu d'errors ortogràfics", desc:"Troba la paraula mal escrita en una frase i corregeix-la.", render: renderDetectiuDerrors },
    { id:"grafia", name:"Tria la grafia correcta", desc:"Tria com s'escriu correctament cada paraula.", render: renderTriaLaGrafia }
  ];
  var ortoGrid = document.getElementById("grid-ortografia");
  var ortoDetail = document.getElementById("ortografia-detail");
  var ortoView = document.getElementById("ortografia-view");
  function showOrtografiaGrid(){ ortoDetail.hidden = true; ortoGrid.hidden = false; }
  function openOrtografiaActivity(a){ ortoGrid.hidden = true; ortoDetail.hidden = false; ortoView.innerHTML = ""; a.render(ortoView); }
  renderActivityGrid(ortoGrid, ORTOGRAFIA_ACTIVITIES, openOrtografiaActivity);
  document.getElementById("ortografia-back").addEventListener("click", showOrtografiaGrid);

  /* ---------------- Fonologia: dades ---------------- */
  var PHONEME_WORDS = BANKS.PHONEME_WORDS;
  var SOUND_DELETE_ITEMS = BANKS.SOUND_DELETE_ITEMS;
  var SOUND_CHANGE_ITEMS = BANKS.SOUND_CHANGE_ITEMS;
  var SOUND_DETECT_SETS = BANKS.SOUND_DETECT_SETS;
  var LISTEN_CHOOSE_ITEMS = BANKS.LISTEN_CHOOSE_ITEMS;
  var SIMILAR_PAIRS = BANKS.SIMILAR_PAIRS;
  var SOUND_PAIR_ITEMS = BANKS.SOUND_PAIR_ITEMS;
  var BINGO_SETS = BANKS.BINGO_SETS;

  /* ---- Segmentació fonèmica ---- */
  var lastPhonemeWord = null;
  function renderSegmentacioFonemica(container){
    var item = pickRandom(PHONEME_WORDS, function(it){ return it === lastPhonemeWord; });
    lastPhonemeWord = item;
    var correctN = item.phonemes.length;
    var options = numberOptions(correctN);
    var opts = Array.from(options).sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Quants sons (fonemes) té aquesta paraula?</p>' +
      '<p class="prompt-word adaptive-text">' + item.word + '</p>' +
      '<div class="choice-row" id="phonemeChoices"></div>' +
      '<div id="phonemeFeedback"></div>' +
      '<div><button class="ghost-btn" id="phonemeNext">Nova paraula</button></div>';
    var row = container.querySelector("#phonemeChoices");
    opts.forEach(function(n){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = n;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (+b.textContent === correctN) b.classList.add("correct"); });
        var ok = n === correctN;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("segmentacio", ok);
        container.querySelector("#phonemeFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">«' + item.word + '» es divideix en: ' +
          item.phonemes.map(function(p){ return "<b>" + p + "</b>"; }).join(" · ") + "</div>";
      });
      row.appendChild(btn);
    });
    container.querySelector("#phonemeNext").addEventListener("click", function(){ renderSegmentacioFonemica(container); });
  }

  /* ---- Elimina un so ---- */
  var lastDeleteItem = null;
  function renderEliminaUnSo(container){
    var item = pickRandom(SOUND_DELETE_ITEMS, function(it){ return it === lastDeleteItem; });
    lastDeleteItem = item;
    var opts = [item.result, item.distractor].sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Digues «' + item.word + '» sense el so /' + item.sound + '/. Quina paraula queda?</p>' +
      '<div class="choice-row" id="deleteChoices"></div>' +
      '<div id="deleteFeedback"></div>' +
      '<div><button class="ghost-btn" id="deleteNext">Nova paraula</button></div>';
    var row = container.querySelector("#deleteChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.result) b.classList.add("correct"); });
        var ok = w === item.result;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("eliminaSo", ok);
        container.querySelector("#deleteFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">«' + item.word + '» sense /' + item.sound + '/ és «' + item.result + '».</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#deleteNext").addEventListener("click", function(){ renderEliminaUnSo(container); });
  }

  /* ---- Canvia un so ---- */
  var lastChangeItem = null;
  function renderCanviaUnSo(container){
    var item = pickRandom(SOUND_CHANGE_ITEMS, function(it){ return it === lastChangeItem; });
    lastChangeItem = item;
    var otherResults = SOUND_CHANGE_ITEMS.filter(function(it){ return it !== item; }).map(function(it){ return it.result; });
    var distractor = otherResults[Math.floor(Math.random() * otherResults.length)];
    var opts = [item.result, distractor].sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">A «' + item.word + '», canvia el so /' + item.from + '/ pel so /' + item.to + '/. Quina paraula surt?</p>' +
      '<div class="choice-row" id="changeChoices"></div>' +
      '<div id="changeFeedback"></div>' +
      '<div><button class="ghost-btn" id="changeNext">Nova paraula</button></div>';
    var row = container.querySelector("#changeChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.result) b.classList.add("correct"); });
        var ok = w === item.result;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("canviaSo", ok);
        container.querySelector("#changeFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">«' + item.word + '» canviant /' + item.from + '/ per /' + item.to + '/ dona «' + item.result + '».</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#changeNext").addEventListener("click", function(){ renderCanviaUnSo(container); });
  }

  /* ---- Detecta el so ---- */
  var lastDetectSet = null;
  function renderDetectaElSo(container){
    var set = pickRandom(SOUND_DETECT_SETS, function(s){ return s === lastDetectSet; });
    lastDetectSet = set;
    var shuffled = set.words.slice().sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Selecciona totes les paraules que contenen el so /' + set.sound + '/ i després comprova.</p>' +
      '<div class="letters-grid" id="detectGrid" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr));"></div>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="detectCheck">Comprova</button><button class="ghost-btn" id="detectNext">Nova ronda</button></div>' +
      '<div id="detectFeedback"></div>';
    var grid = container.querySelector("#detectGrid");
    shuffled.forEach(function(item){
      var btn = document.createElement("button");
      btn.className = "letter-cell";
      btn.style.fontSize = "15px";
      btn.textContent = item.w;
      btn.addEventListener("click", function(){ btn.classList.toggle("selected"); });
      grid.appendChild(btn);
    });
    container.querySelector("#detectCheck").addEventListener("click", function(){
      var buttons = grid.querySelectorAll("button");
      var allOk = true;
      buttons.forEach(function(btn, i){
        var item = shuffled[i];
        var selected = btn.classList.contains("selected");
        btn.classList.remove("selected");
        btn.disabled = true;
        if (item.has){
          btn.classList.add(selected ? "found" : "wrong");
          if (!selected) allOk = false;
        } else if (selected){
          btn.classList.add("wrong");
          allOk = false;
        }
      });
      recordActivity("detectaSo", allOk);
      container.querySelector("#detectFeedback").innerHTML =
        '<div class="feedback-banner ' + (allOk ? "ok" : "bad") + '">' + (allOk ? "Molt bé, les has trobat totes!" : "Revisa-ho: en verd les correctes, en vermell les errades.") + "</div>";
    });
    container.querySelector("#detectNext").addEventListener("click", function(){ renderDetectaElSo(container); });
  }

  /* ---- Escolta i tria ---- */
  var lastListenItem = null;
  function renderEscoltaITria(container){
    var item = pickRandom(LISTEN_CHOOSE_ITEMS, function(it){ return it === lastListenItem; });
    lastListenItem = item;
    var opts = item.options.slice().sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Escolta la paraula i tria com s\'escriu.</p>' +
      '<div class="reader-toolbar"><button class="play-btn" id="listenPlay">▶ Escolta la paraula</button></div>' +
      '<div class="choice-row" id="listenChoices"></div>' +
      '<div id="listenFeedback"></div>' +
      '<div><button class="ghost-btn" id="listenNext">Nova paraula</button></div>';
    container.querySelector("#listenPlay").addEventListener("click", function(){ speak(item.correct, {}); });
    var row = container.querySelector("#listenChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = w === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("escoltaTria", ok);
      });
      row.appendChild(btn);
    });
    container.querySelector("#listenNext").addEventListener("click", function(){ renderEscoltaITria(container); });
  }

  /* ---- Paraules semblants ---- */
  var lastSimilarPair = null;
  function renderParaulesSemblants(container){
    var pair = pickRandom(SIMILAR_PAIRS, function(p){ return p === lastSimilarPair; });
    lastSimilarPair = pair;
    container.innerHTML =
      '<p class="section-hint">Aquestes dues paraules són iguals o diferents?</p>' +
      '<div class="reader-toolbar" style="gap:24px;">' +
        '<span class="prompt-word adaptive-text">' + pair.a + '</span>' +
        '<span class="prompt-word adaptive-text">' + pair.b + '</span>' +
      '</div>' +
      '<div class="choice-row" id="similarChoices"></div>' +
      '<div id="similarFeedback"></div>' +
      '<div><button class="ghost-btn" id="similarNext">Nova parella</button></div>';
    var row = container.querySelector("#similarChoices");
    [["Iguals", true], ["Diferents", false]].forEach(function(opt){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = opt[0];
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; });
        var ok = opt[1] === pair.same;
        btn.classList.add(ok ? "correct" : "incorrect");
        recordActivity("semblants", ok);
        container.querySelector("#similarFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + pair.note + "</div>";
      });
      row.appendChild(btn);
    });
    container.querySelector("#similarNext").addEventListener("click", function(){ renderParaulesSemblants(container); });
  }

  /* ---- Joc de parelles paraula-so ---- */
  var lastPairItem = null;
  function renderJocParellesParaulaSo(container){
    var item = pickRandom(SOUND_PAIR_ITEMS, function(it){ return it === lastPairItem; });
    lastPairItem = item;
    var opts = [{ label:"So A", word:item.match }, { label:"So B", word:item.distractor }].sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Aquesta és la paraula escrita. Escolta els dos sons i tria quin hi correspon.</p>' +
      '<p class="prompt-word adaptive-text">' + item.word + '</p>' +
      '<div class="reader-toolbar">' +
        '<button class="ghost-btn" id="pairPlayA">🔊 So A</button>' +
        '<button class="ghost-btn" id="pairPlayB">🔊 So B</button>' +
      '</div>' +
      '<p class="section-hint" style="margin-top:6px;">Quin so és el correcte?</p>' +
      '<div class="choice-row" id="pairChoices"></div>' +
      '<div id="pairFeedback"></div>' +
      '<div><button class="ghost-btn" id="pairNext">Nova paraula</button></div>';
    container.querySelector("#pairPlayA").addEventListener("click", function(){ speak(opts[0].word, {}); });
    container.querySelector("#pairPlayB").addEventListener("click", function(){ speak(opts[1].word, {}); });
    var row = container.querySelector("#pairChoices");
    opts.forEach(function(opt, idx){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = idx === 0 ? "So A" : "So B";
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; });
        var ok = opt.word === item.match;
        btn.classList.add(ok ? "correct" : "incorrect");
        recordActivity("parelles", ok);
        container.querySelector("#pairFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "Exacte, aquest era el so correcte!" : "No, la paraula correcta sonava a l'altre botó.") + "</div>";
      });
      row.appendChild(btn);
    });
    container.querySelector("#pairNext").addEventListener("click", function(){ renderJocParellesParaulaSo(container); });
  }

  /* ---- Bingo fonològic ---- */
  var lastBingoSet = null;
  function renderBingoFonologic(container){
    var set = pickRandom(BINGO_SETS, function(s){ return s === lastBingoSet; });
    lastBingoSet = set;
    var shuffled = set.words.slice().sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Selecciona totes les paraules que comencen per la síl·laba «' + set.syllable + '» i després comprova.</p>' +
      '<div class="letters-grid" id="bingoGrid" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr));"></div>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="bingoCheck">Comprova</button><button class="ghost-btn" id="bingoNext">Nova carta</button></div>' +
      '<div id="bingoFeedback"></div>';
    var grid = container.querySelector("#bingoGrid");
    shuffled.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "letter-cell";
      btn.style.fontSize = "14px";
      btn.textContent = w;
      btn.addEventListener("click", function(){ btn.classList.toggle("selected"); });
      grid.appendChild(btn);
    });
    container.querySelector("#bingoCheck").addEventListener("click", function(){
      var buttons = grid.querySelectorAll("button");
      var allOk = true;
      buttons.forEach(function(btn, i){
        var w = shuffled[i];
        var has = w.toLowerCase().indexOf(set.syllable) === 0;
        var selected = btn.classList.contains("selected");
        btn.classList.remove("selected");
        btn.disabled = true;
        if (has){
          btn.classList.add(selected ? "found" : "wrong");
          if (!selected) allOk = false;
        } else if (selected){
          btn.classList.add("wrong");
          allOk = false;
        }
      });
      recordActivity("bingo", allOk);
      container.querySelector("#bingoFeedback").innerHTML =
        '<div class="feedback-banner ' + (allOk ? "ok" : "bad") + '">' + (allOk ? "Bingo complet!" : "Revisa-ho: en verd les correctes, en vermell les errades.") + "</div>";
    });
    container.querySelector("#bingoNext").addEventListener("click", function(){ renderBingoFonologic(container); });
  }

  var FONOLOGIA_ACTIVITIES = [
    { id:"segmentacio", name:"Segmentació fonèmica", desc:"Separa una paraula en els seus sons.", render: renderSegmentacioFonemica },
    { id:"elimina-so", name:"Elimina un so", desc:"Digues la paraula resultant si en trèieu un so.", render: renderEliminaUnSo },
    { id:"canvia-so", name:"Canvia un so", desc:"Substitueix un fonema per formar una paraula nova.", render: renderCanviaUnSo },
    { id:"detecta-so", name:"Detecta el so", desc:"Tria quines paraules contenen un so determinat.", render: renderDetectaElSo },
    { id:"escolta-tria", name:"Escolta i tria", desc:"Escolta una paraula i tria'n l'escriptura correcta.", render: renderEscoltaITria },
    { id:"semblants", name:"Paraules semblants", desc:"Distingeix parelles de paraules que sonen semblant.", render: renderParaulesSemblants },
    { id:"parelles-so", name:"Joc de parelles paraula-so", desc:"Associa una paraula escrita amb el so que li correspon.", render: renderJocParellesParaulaSo },
    { id:"bingo", name:"Bingo fonològic", desc:"Selecciona paraules segons una condició fonològica.", render: renderBingoFonologic }
  ];
  var fonoGrid = document.getElementById("grid-fonologia");
  var fonoDetail = document.getElementById("fonologia-detail");
  var fonoView = document.getElementById("fonologia-view");
  function showFonologiaGrid(){ fonoDetail.hidden = true; fonoGrid.hidden = false; }
  function openFonologiaActivity(a){ fonoGrid.hidden = true; fonoDetail.hidden = false; fonoView.innerHTML = ""; a.render(fonoView); }
  renderActivityGrid(fonoGrid, FONOLOGIA_ACTIVITIES, openFonologiaActivity);
  document.getElementById("fonologia-back").addEventListener("click", showFonologiaGrid);

  /* ---------------- Vocabulari i morfologia: dades ---------------- */
  var WORD_FAMILIES = BANKS.WORD_FAMILIES;

  var PREFIX_SUFFIX_ITEMS = BANKS.PREFIX_SUFFIX_ITEMS;

  var VOCAB_CONTEXTUAL_ITEMS = BANKS.VOCAB_CONTEXTUAL_ITEMS;

  var INTRUDER_ITEMS = BANKS.INTRUDER_ITEMS;

  var SYNANT_ITEMS = BANKS.SYNANT_ITEMS;

  var COMPLETA_FRASE_ITEMS = BANKS.COMPLETA_FRASE_ITEMS;

  var WORD_SENTENCE_ITEMS = BANKS.WORD_SENTENCE_ITEMS;

  /* ---- Famílies de paraules ---- */
  var lastFamilia = null;
  function renderFamiliaDeParaules(container){
    var item = pickRandom(WORD_FAMILIES, function(it){ return it === lastFamilia; });
    lastFamilia = item;
    var correct = pickRandom(item.members);
    var distractors = item.others.slice().sort(function(){ return Math.random() - 0.5; }).slice(0, 3);
    var opts = [correct].concat(distractors).sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Quina d\'aquestes paraules pertany a la mateixa família que «' + item.base + '»?</p>' +
      '<div class="choice-row" id="familiaChoices"></div>' +
      '<div id="familiaFeedback"></div>' +
      '<div><button class="ghost-btn" id="familiaNext">Nova paraula</button></div>';
    var row = container.querySelector("#familiaChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === correct) b.classList.add("correct"); });
        var ok = w === correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("familia", ok);
        container.querySelector("#familiaFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">«' + correct + '» és de la família de «' + item.base + '».</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#familiaNext").addEventListener("click", function(){ renderFamiliaDeParaules(container); });
  }

  /* ---- Prefixos i sufixos ---- */
  var lastPrefixSufix = null;
  function renderPrefixosSufixos(container){
    var item = pickRandom(PREFIX_SUFFIX_ITEMS, function(it){ return it === lastPrefixSufix; });
    lastPrefixSufix = item;
    var others = PREFIX_SUFFIX_ITEMS.filter(function(it){ return it !== item; }).map(function(it){ return it.correct; });
    others.sort(function(){ return Math.random() - 0.5; });
    var opts = [item.correct].concat(others.slice(0, 3)).sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Afegeix «' + item.affix + '» a «' + item.base + '». Quina paraula es forma?</p>' +
      '<div class="choice-row" id="pfChoices"></div>' +
      '<div id="pfFeedback"></div>' +
      '<div><button class="ghost-btn" id="pfNext">Següent</button></div>';
    var row = container.querySelector("#pfChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = w === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("prefixSufix", ok);
        container.querySelector("#pfFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + item.hint + '</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#pfNext").addEventListener("click", function(){ renderPrefixosSufixos(container); });
  }

  /* ---- Vocabulari contextual ---- */
  var lastVocabContextual = null;
  function renderVocabulariContextual(container){
    var item = pickRandom(VOCAB_CONTEXTUAL_ITEMS, function(it){ return it === lastVocabContextual; });
    lastVocabContextual = item;
    var opts = [item.correct].concat(item.distractors).sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="prompt-word adaptive-text" style="font-size:18px;">' + item.sentence + '</p>' +
      '<p class="section-hint">Què vol dir «' + item.word + '» en aquesta frase?</p>' +
      '<div class="choice-row" id="vcChoices"></div>' +
      '<div id="vcFeedback"></div>' +
      '<div><button class="ghost-btn" id="vcNext">Nova frase</button></div>';
    var row = container.querySelector("#vcChoices");
    opts.forEach(function(def){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = def;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = def === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("vocabContextual", ok);
        container.querySelector("#vcFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">La resposta correcta és: «' + item.correct + '».</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#vcNext").addEventListener("click", function(){ renderVocabulariContextual(container); });
  }

  /* ---- Paraula intrusa ---- */
  var lastIntruder = null;
  function renderParaulaIntrusa(container){
    var item = pickRandom(INTRUDER_ITEMS, function(it){ return it === lastIntruder; });
    lastIntruder = item;
    var words = item.words.slice().sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">' + item.hint + ' Fes clic a la paraula que no hi encaixa.</p>' +
      '<div class="choice-row" id="intruderChoices"></div>' +
      '<div id="intruderFeedback"></div>' +
      '<div><button class="ghost-btn" id="intruderNext">Nou grup</button></div>';
    var row = container.querySelector("#intruderChoices");
    words.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.intruder) b.classList.add("correct"); });
        var ok = w === item.intruder;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("intrusa", ok);
        container.querySelector("#intruderFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">La paraula intrusa és «' + item.intruder + '».</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#intruderNext").addEventListener("click", function(){ renderParaulaIntrusa(container); });
  }

  /* ---- Sinònims i antònims ---- */
  var lastSynAnt = null;
  function renderSinonimsAntonims(container){
    var item = pickRandom(SYNANT_ITEMS, function(it){ return it === lastSynAnt; });
    lastSynAnt = item;
    var opts = [item.correct].concat(item.distractors).sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Quin és el ' + item.relation + ' de «' + item.word + '»?</p>' +
      '<div class="choice-row" id="saChoices"></div>' +
      '<div id="saFeedback"></div>' +
      '<div><button class="ghost-btn" id="saNext">Següent paraula</button></div>';
    var row = container.querySelector("#saChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = w === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("sinantonim", ok);
        container.querySelector("#saFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">El ' + item.relation + ' de «' + item.word + '» és «' + item.correct + '».</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#saNext").addEventListener("click", function(){ renderSinonimsAntonims(container); });
  }

  /* ---- Completa la frase pel context ---- */
  var lastCompletaFrase = null;
  function renderCompletaFrasePelContext(container){
    var item = pickRandom(COMPLETA_FRASE_ITEMS, function(it){ return it === lastCompletaFrase; });
    lastCompletaFrase = item;
    var opts = item.options.slice().sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Quina paraula completa millor la frase?</p>' +
      '<p class="prompt-word adaptive-text">' + item.before + '<span style="color:var(--ink-muted);">___</span>' + item.after + '</p>' +
      '<div class="choice-row" id="cfChoices"></div>' +
      '<div id="cfFeedback"></div>' +
      '<div><button class="ghost-btn" id="cfNext">Nova frase</button></div>';
    var row = container.querySelector("#cfChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = w === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("completaFrase", ok);
        container.querySelector("#cfFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">La frase completa és: «' + item.before + item.correct + item.after + '»</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#cfNext").addEventListener("click", function(){ renderCompletaFrasePelContext(container); });
  }

  /* ---- Paraula + frase ---- */
  function renderParaulaMesFrase(container){
    var item = pickRandom(WORD_SENTENCE_ITEMS);
    container.innerHTML =
      '<p class="section-hint">Aprèn aquesta paraula nova i escriu-hi una frase.</p>' +
      '<p class="prompt-word adaptive-text">' + item.word + '</p>' +
      '<p class="section-hint">' + item.def + '</p>' +
      '<div class="reader-toolbar"><button class="play-btn" id="pfSpeak">▶ Escolta la paraula</button></div>' +
      '<textarea class="field" id="pfInput" placeholder="Escriu una frase amb aquesta paraula…"></textarea>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="pfCheck">Comprova</button><button class="ghost-btn" id="pfNext">Nova paraula</button></div>' +
      '<div id="pfResult"></div>';
    container.querySelector("#pfSpeak").addEventListener("click", function(){ speak(item.word, {}); });
    container.querySelector("#pfCheck").addEventListener("click", function(){
      var typed = container.querySelector("#pfInput").value.trim();
      var ok = typed.length > 0 && normalizeWord(typed).indexOf(normalizeWord(item.word)) !== -1;
      recordActivity("paraulaFrase", ok);
      container.querySelector("#pfResult").innerHTML =
        '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "Molt bé, has fet servir la paraula correctament!" : "Assegura't d'incloure la paraula «" + item.word + "» a la frase.") + '</div>' +
        '<p class="section-hint" style="margin-top:8px;">Exemple: «' + item.example + '»</p>';
    });
    container.querySelector("#pfNext").addEventListener("click", function(){ renderParaulaMesFrase(container); });
  }

  var VOCABULARI_ACTIVITIES = [
    { id:"familia", name:"Famílies de paraules", desc:"Agrupa paraules segons la seva família lèxica.", render: renderFamiliaDeParaules },
    { id:"prefix-sufix", name:"Prefixos i sufixos", desc:"Forma paraules noves afegint prefixos i sufixos.", render: renderPrefixosSufixos },
    { id:"vocab-contextual", name:"Vocabulari contextual", desc:"Relaciona paraules d'una frase amb el seu significat.", render: renderVocabulariContextual },
    { id:"intrusa", name:"Paraula intrusa", desc:"Troba la paraula que no encaixa en un grup.", render: renderParaulaIntrusa },
    { id:"sinantonim", name:"Sinònims i antònims", desc:"Identifica sinònims o antònims d'una paraula.", render: renderSinonimsAntonims },
    { id:"completa-frase", name:"Completa la frase pel context", desc:"Tria la paraula que encaixa millor en una frase.", render: renderCompletaFrasePelContext },
    { id:"paraula-frase", name:"Paraula + frase", desc:"Aprèn una paraula nova i construeix-hi una frase.", render: renderParaulaMesFrase }
  ];
  var vocabGrid = document.getElementById("grid-vocabulari");
  var vocabDetail = document.getElementById("vocabulari-detail");
  var vocabView = document.getElementById("vocabulari-view");
  function showVocabulariGrid(){ vocabDetail.hidden = true; vocabGrid.hidden = false; }
  function openVocabulariActivity(a){ vocabGrid.hidden = true; vocabDetail.hidden = false; vocabView.innerHTML = ""; a.render(vocabView); }
  renderActivityGrid(vocabGrid, VOCABULARI_ACTIVITIES, openVocabulariActivity);
  document.getElementById("vocabulari-back").addEventListener("click", showVocabulariGrid);

  /* ---------------- Comprensió lectora: dades ---------------- */
  var PREDICTION_ITEMS = BANKS.PREDICTION_ITEMS;

  var QUESTION_DURING_ITEMS = BANKS.QUESTION_DURING_ITEMS;

  var MAIN_IDEA_ITEMS = BANKS.MAIN_IDEA_ITEMS;

  var STORY_ORDER_ITEMS = BANKS.STORY_ORDER_ITEMS;

  var INFERENCE_ITEMS = BANKS.INFERENCE_ITEMS;

  var EVIDENCE_ITEMS = BANKS.EVIDENCE_ITEMS;

  var KEY_INFO_ITEMS = BANKS.KEY_INFO_ITEMS;

  var SUMMARY_ITEMS = BANKS.SUMMARY_ITEMS;

  var ORAL_READING_ITEMS = BANKS.ORAL_READING_ITEMS;

  /* ---- Predicció abans de llegir ---- */
  var lastPrediccio = null;
  function renderPrediccio(container){
    var item = pickRandom(PREDICTION_ITEMS, function(it){ return it === lastPrediccio; });
    lastPrediccio = item;
    var opts = item.options.slice().sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Llegeix l\'inici de la història i prediu què creus que passarà.</p>' +
      '<p class="prompt-word adaptive-text" style="font-size:18px;">' + item.title + '</p>' +
      '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text">' + item.opening + '</div></div>' +
      '<p class="section-hint" style="margin-top:10px;">Què creus que passarà?</p>' +
      '<div class="choice-row" id="pdChoices"></div>' +
      '<div id="pdFeedback"></div>' +
      '<div><button class="ghost-btn" id="pdNext">Nova història</button></div>';
    var row = container.querySelector("#pdChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = w === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("prediccio", ok);
        container.querySelector("#pdFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">Això és el que va passar: ' + item.outcome + '</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#pdNext").addEventListener("click", function(){ renderPrediccio(container); });
  }

  /* ---- Pregunta durant la lectura ---- */
  var lastQuestionDuring = null;
  function renderPreguntaDurant(container){
    var item = pickRandom(QUESTION_DURING_ITEMS, function(it){ return it === lastQuestionDuring; });
    lastQuestionDuring = item;
    var opts = item.options.slice().sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">Llegeix aquest fragment i respon la pregunta abans de continuar.</p>' +
      '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text">' + item.part1 + '</div></div>' +
      '<p class="section-hint" style="margin-top:10px;">' + item.question + '</p>' +
      '<div class="choice-row" id="qdChoices"></div>' +
      '<div id="qdFeedback"></div>' +
      '<div><button class="ghost-btn" id="qdNext">Nou fragment</button></div>';
    var row = container.querySelector("#qdChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = w === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("preguntaDurant", ok);
        container.querySelector("#qdFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">Així continua la història: ' + item.part2 + '</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#qdNext").addEventListener("click", function(){ renderPreguntaDurant(container); });
  }

  /* ---- Idea principal ---- */
  var lastMainIdea = null;
  function renderIdeaPrincipal(container){
    var item = pickRandom(MAIN_IDEA_ITEMS, function(it){ return it === lastMainIdea; });
    lastMainIdea = item;
    var opts = [item.correct].concat(item.distractors).sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text">' + item.text + '</div></div>' +
      '<p class="section-hint" style="margin-top:10px;">Quina és la idea principal del text?</p>' +
      '<div class="choice-row" id="miChoices"></div>' +
      '<div id="miFeedback"></div>' +
      '<div><button class="ghost-btn" id="miNext">Nou text</button></div>';
    var row = container.querySelector("#miChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = w === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("ideaPrincipal", ok);
        container.querySelector("#miFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">La idea principal és: «' + item.correct + '».</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#miNext").addEventListener("click", function(){ renderIdeaPrincipal(container); });
  }

  /* ---- Ordena la història ---- */
  var lastStoryOrder = null;
  function renderOrdenaHistoria(container){
    var item = pickRandom(STORY_ORDER_ITEMS, function(it){ return it === lastStoryOrder; });
    lastStoryOrder = item;
    var pool = item.fragments.map(function(f, i){ return { text: f, idx: i }; }).sort(function(){ return Math.random() - 0.5; });
    var picked = [];
    container.innerHTML =
      '<p class="section-hint">Fes clic als fragments en l\'ordre correcte perquè la història tingui sentit.</p>' +
      '<div class="stack" id="ohAssembly" style="min-height:60px;"></div>' +
      '<div class="stack" id="ohPool"></div>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="ohCheck">Comprova</button><button class="ghost-btn" id="ohReset">Reinicia</button></div>' +
      '<div id="ohFeedback"></div>' +
      '<div><button class="ghost-btn" id="ohNext">Nova història</button></div>';
    var assembly = container.querySelector("#ohAssembly");
    var poolEl = container.querySelector("#ohPool");
    function renderPool(){
      poolEl.innerHTML = "";
      pool.forEach(function(frag){
        var btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.style.display = "block";
        btn.style.textAlign = "left";
        btn.textContent = frag.text;
        btn.disabled = picked.indexOf(frag) !== -1;
        btn.addEventListener("click", function(){ picked.push(frag); renderAssembly(); renderPool(); });
        poolEl.appendChild(btn);
      });
    }
    function renderAssembly(){
      assembly.innerHTML = picked.map(function(frag, i){ return '<div class="reading-text adaptive-text">' + (i + 1) + ". " + frag.text + "</div>"; }).join("");
    }
    renderPool(); renderAssembly();
    container.querySelector("#ohReset").addEventListener("click", function(){ picked = []; renderAssembly(); renderPool(); });
    container.querySelector("#ohCheck").addEventListener("click", function(){
      var ok = picked.length === item.fragments.length && picked.every(function(frag, i){ return frag.idx === i; });
      recordActivity("ordenaHistoria", ok);
      container.querySelector("#ohFeedback").innerHTML =
        '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "Molt bé, l'ordre és correcte!" : "Encara no és l'ordre correcte. Torna-ho a provar o reinicia.") + '</div>';
    });
    container.querySelector("#ohNext").addEventListener("click", function(){ renderOrdenaHistoria(container); });
  }

  /* ---- Què podem deduir? ---- */
  var lastInference = null;
  function renderQuePodemDeduir(container){
    var item = pickRandom(INFERENCE_ITEMS, function(it){ return it === lastInference; });
    lastInference = item;
    var opts = [item.correct].concat(item.distractors).sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text">' + item.text + '</div></div>' +
      '<p class="section-hint" style="margin-top:10px;">' + item.question + '</p>' +
      '<div class="choice-row" id="infChoices"></div>' +
      '<div id="infFeedback"></div>' +
      '<div><button class="ghost-btn" id="infNext">Nou text</button></div>';
    var row = container.querySelector("#infChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = w === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("quePodemDeduir", ok);
        container.querySelector("#infFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">La deducció més encertada és: «' + item.correct + '».</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#infNext").addEventListener("click", function(){ renderQuePodemDeduir(container); });
  }

  /* ---- Evidència textual ---- */
  var lastEvidence = null;
  function renderEvidenciaTextual(container){
    var item = pickRandom(EVIDENCE_ITEMS, function(it){ return it === lastEvidence; });
    lastEvidence = item;
    container.innerHTML =
      '<p class="section-hint">' + item.question + ' Fes clic a la frase que ho justifica.</p>' +
      '<div class="stack" id="evSentences"></div>' +
      '<div id="evFeedback"></div>' +
      '<div><button class="ghost-btn" id="evNext">Nou text</button></div>';
    var wrap = container.querySelector("#evSentences");
    item.sentences.forEach(function(s, i){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.style.display = "block";
      btn.style.textAlign = "left";
      btn.textContent = s;
      btn.addEventListener("click", function(){
        wrap.querySelectorAll("button").forEach(function(b, bi){ b.disabled = true; if (bi === item.evidenceIndex) b.classList.add("correct"); });
        var ok = i === item.evidenceIndex;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("evidenciaTextual", ok);
        container.querySelector("#evFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">La frase que ho justifica és: «' + item.sentences[item.evidenceIndex] + '».</div>';
      });
      wrap.appendChild(btn);
    });
    container.querySelector("#evNext").addEventListener("click", function(){ renderEvidenciaTextual(container); });
  }

  /* ---- Detecta la informació important ---- */
  var lastKeyInfo = null;
  function renderInformacioImportant(container){
    var item = pickRandom(KEY_INFO_ITEMS, function(it){ return it === lastKeyInfo; });
    lastKeyInfo = item;
    container.innerHTML =
      '<p class="section-hint">' + item.hint + ' Fes clic a la frase amb la informació essencial.</p>' +
      '<div class="stack" id="kiSentences"></div>' +
      '<div id="kiFeedback"></div>' +
      '<div><button class="ghost-btn" id="kiNext">Nou text</button></div>';
    var wrap = container.querySelector("#kiSentences");
    item.sentences.forEach(function(s, i){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.style.display = "block";
      btn.style.textAlign = "left";
      btn.textContent = s;
      btn.addEventListener("click", function(){
        wrap.querySelectorAll("button").forEach(function(b, bi){ b.disabled = true; if (bi === item.keyIndex) b.classList.add("correct"); });
        var ok = i === item.keyIndex;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("informacioImportant", ok);
        container.querySelector("#kiFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">La informació essencial és: «' + item.sentences[item.keyIndex] + '».</div>';
      });
      wrap.appendChild(btn);
    });
    container.querySelector("#kiNext").addEventListener("click", function(){ renderInformacioImportant(container); });
  }

  /* ---- Construeix el resum ---- */
  var lastSummary = null;
  function renderConstrueixResum(container){
    var item = pickRandom(SUMMARY_ITEMS, function(it){ return it === lastSummary; });
    lastSummary = item;
    var order = item.sentences.map(function(s, i){ return i; }).sort(function(){ return Math.random() - 0.5; });
    var selected = {};
    container.innerHTML =
      '<p class="section-hint">Selecciona només les frases que caldria incloure en un bon resum del text.</p>' +
      '<div class="stack" id="srSentences"></div>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="srCheck">Comprova</button></div>' +
      '<div id="srFeedback"></div>' +
      '<div><button class="ghost-btn" id="srNext">Nou text</button></div>';
    var wrap = container.querySelector("#srSentences");
    order.forEach(function(i){
      var s = item.sentences[i];
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.style.display = "block";
      btn.style.textAlign = "left";
      btn.textContent = s.text;
      btn.addEventListener("click", function(){
        selected[i] = !selected[i];
        btn.classList.toggle("selected", !!selected[i]);
      });
      wrap.appendChild(btn);
    });
    container.querySelector("#srCheck").addEventListener("click", function(){
      var ok = item.sentences.every(function(s, i){ return !!selected[i] === !!s.essential; });
      recordActivity("construeixResum", ok);
      wrap.querySelectorAll("button").forEach(function(b, idx){
        var i = order[idx];
        b.disabled = true;
        b.classList.remove("selected");
        if (item.sentences[i].essential) b.classList.add("correct");
        else if (selected[i]) b.classList.add("incorrect");
      });
      container.querySelector("#srFeedback").innerHTML =
        '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "Perfecte, has triat exactament les frases essencials." : "Revisa-ho: en verd, les frases que calia incloure.") + '</div>';
    });
    container.querySelector("#srNext").addEventListener("click", function(){ renderConstrueixResum(container); });
  }

  /* ---- Lectura i resposta oral (resolta com a resposta escrita) ---- */
  var lastOralReading = null;
  function renderLecturaRespostaOral(container){
    var item = pickRandom(ORAL_READING_ITEMS, function(it){ return it === lastOralReading; });
    lastOralReading = item;
    container.innerHTML =
      '<p class="section-hint">Llegeix el text (o escolta\'l) i respon la pregunta amb les teves paraules, per escrit.</p>' +
      '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text">' + item.text + '</div></div>' +
      '<div class="reader-toolbar"><button class="play-btn" id="orPlay">▶ Escolta el text</button></div>' +
      '<p class="section-hint" style="margin-top:10px;">' + item.question + '</p>' +
      '<textarea class="field" id="orInput" placeholder="Escriu la teva resposta…"></textarea>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="orCheck">Comprova</button><button class="ghost-btn" id="orNext">Nou text</button></div>' +
      '<div id="orResult"></div>';
    container.querySelector("#orPlay").addEventListener("click", function(){ speak(item.text, {}); });
    container.querySelector("#orCheck").addEventListener("click", function(){
      var typed = normalizeWord(container.querySelector("#orInput").value.trim());
      var ok = typed.length > 0 && item.keywords.some(function(k){ return typed.indexOf(normalizeWord(k)) !== -1; });
      recordActivity("respostaOral", ok);
      container.querySelector("#orResult").innerHTML =
        '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "Molt bé, la teva resposta inclou la informació clau!" : "Revisa-ho: potser et falta algun detall important.") + '</div>' +
        '<p class="section-hint" style="margin-top:8px;">Resposta model: «' + item.model + '»</p>';
    });
    container.querySelector("#orNext").addEventListener("click", function(){ renderLecturaRespostaOral(container); });
  }

  var COMPRENSIO_ACTIVITIES = [
    { id:"prediccio", name:"Predicció abans de llegir", desc:"Prediu de què tractarà un text abans de llegir-lo.", render: renderPrediccio },
    { id:"pregunta-durant", name:"Pregunta durant la lectura", desc:"Respon preguntes de comprensió mentre llegeixes.", render: renderPreguntaDurant },
    { id:"idea-principal", name:"Idea principal", desc:"Tria la idea principal d'un paràgraf.", render: renderIdeaPrincipal },
    { id:"ordena-historia", name:"Ordena la història", desc:"Ordena els fragments d'un text perquè tingui sentit.", render: renderOrdenaHistoria },
    { id:"que-podem-deduir", name:"Què podem deduir?", desc:"Fes una inferència a partir del que diu el text.", render: renderQuePodemDeduir },
    { id:"evidencia-textual", name:"Evidència textual", desc:"Assenyala la frase que justifica una resposta.", render: renderEvidenciaTextual },
    { id:"informacio-important", name:"Detecta la informació important", desc:"Ressalta la informació essencial d'un text.", render: renderInformacioImportant },
    { id:"construeix-resum", name:"Construeix el resum", desc:"Tria les frases necessàries per fer un resum.", render: renderConstrueixResum },
    { id:"resposta-oral", name:"Lectura i resposta oral", desc:"Respon per escrit preguntes sobre un text llegit.", render: renderLecturaRespostaOral }
  ];
  var comprensioGrid = document.getElementById("grid-comprensio");
  var comprensioDetail = document.getElementById("comprensio-detail");
  var comprensioView = document.getElementById("comprensio-view");
  function showComprensioGrid(){ comprensioDetail.hidden = true; comprensioGrid.hidden = false; }
  function openComprensioActivity(a){ comprensioGrid.hidden = true; comprensioDetail.hidden = false; comprensioView.innerHTML = ""; a.render(comprensioView); }
  renderActivityGrid(comprensioGrid, COMPRENSIO_ACTIVITIES, openComprensioActivity);
  document.getElementById("comprensio-back").addEventListener("click", showComprensioGrid);

  /* ---------------- Missions i gamificació: dades ---------------- */
  var MISSION_ITEMS = BANKS.MISSION_ITEMS;

  /* ---- Missió de lectura ---- */
  function renderMissioDeLectura(container){
    var item = pickRandom(MISSION_ITEMS);
    renderMissioView(container, item, 0);
  }
  function renderMissioView(container, item, qIndex){
    if (qIndex >= item.questions.length){
      container.innerHTML =
        '<p class="section-hint">' + item.title + '</p>' +
        '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text">' + item.text + '</div></div>' +
        '<div class="feedback-banner ok" style="margin-top:10px;">🏁 Missió complerta! Has trobat totes les dades que necessitaves.</div>' +
        '<div><button class="ghost-btn" id="msNext">Nova missió</button></div>';
      container.querySelector("#msNext").addEventListener("click", function(){ renderMissioDeLectura(container); });
      return;
    }
    var q = item.questions[qIndex];
    var opts = q.options.slice().sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">' + item.title + ' — pregunta ' + (qIndex + 1) + ' de ' + item.questions.length + '</p>' +
      '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text">' + item.text + '</div></div>' +
      '<p class="section-hint" style="margin-top:10px;">' + q.q + '</p>' +
      '<div class="choice-row" id="msChoices"></div>' +
      '<div id="msFeedback"></div>';
    var row = container.querySelector("#msChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === q.correct) b.classList.add("correct"); });
        var ok = w === q.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("missioLectura", ok);
        container.querySelector("#msFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "Correcte!" : "La resposta correcta és: «" + q.correct + "».") + '</div>' +
          '<div class="reader-toolbar" style="margin-top:10px;"><button class="ghost-btn" id="msContinue">Continua</button></div>';
        container.querySelector("#msContinue").addEventListener("click", function(){ renderMissioView(container, item, qIndex + 1); });
      });
      row.appendChild(btn);
    });
  }

  /* ---- Escape room textual (combina proves d'altres categories) ---- */
  function buildSpellingDoor(){
    var pattern = pickRandom(SPELLING_PATTERNS);
    var pair = pickRandom(pattern.words);
    var opts = [pair.correct, pair.wrong].sort(function(){ return Math.random() - 0.5; });
    return { category:"Ortografia", prompt:"Quina és la forma correcta d'aquesta paraula?", options:opts, correct:pair.correct, explain:pattern.hint };
  }
  function buildVocabDoor(){
    var item = pickRandom(SYNANT_ITEMS);
    var opts = [item.correct].concat(item.distractors).sort(function(){ return Math.random() - 0.5; });
    return { category:"Vocabulari", prompt:"Quin és el " + item.relation + " de «" + item.word + "»?", options:opts, correct:item.correct, explain:"El " + item.relation + " de «" + item.word + "» és «" + item.correct + "»." };
  }
  function buildComprensioDoor(){
    var item = pickRandom(MAIN_IDEA_ITEMS);
    var opts = [item.correct].concat(item.distractors).sort(function(){ return Math.random() - 0.5; });
    return { category:"Comprensió", prompt:"Quina és la idea principal d'aquest text? «" + item.text + "»", options:opts, correct:item.correct, explain:"La idea principal és: «" + item.correct + "»." };
  }
  function buildDescoDoor(){
    var item = pickRandom(WORD_OR_PSEUDO_ITEMS);
    return { category:"Descodificació", prompt:"«" + item.text + "» és una paraula real o inventada?", options:["Real","Inventada"], correct: item.real ? "Real" : "Inventada", explain: "«" + item.text + "» " + (item.real ? "és una paraula real." : "és una pseudoparaula (inventada).") };
  }
  var ESCAPE_DOOR_BUILDERS = [buildSpellingDoor, buildVocabDoor, buildComprensioDoor, buildDescoDoor];

  function renderEscapeRoom(container){
    var doors = ESCAPE_DOOR_BUILDERS.map(function(fn){ return fn(); });
    renderEscapeDoor(container, doors, 0);
  }
  function renderEscapeDoor(container, doors, index){
    if (index >= doors.length){
      recordActivity("escapeRoom", true);
      container.innerHTML =
        '<p class="section-hint">Has superat totes les portes!</p>' +
        '<div class="feedback-banner ok">🎉 Escape room superat! Has demostrat el que saps d\'ortografia, vocabulari, comprensió i descodificació.</div>' +
        '<div><button class="ghost-btn" id="erRestart">Torna a jugar</button></div>';
      container.querySelector("#erRestart").addEventListener("click", function(){ renderEscapeRoom(container); });
      return;
    }
    var door = doors[index];
    container.innerHTML =
      '<p class="section-hint">Porta ' + (index + 1) + ' de ' + doors.length + ' — ' + door.category + '</p>' +
      '<p class="prompt-word adaptive-text" style="font-size:20px;">' + door.prompt + '</p>' +
      '<div class="choice-row" id="erChoices"></div>' +
      '<div id="erFeedback"></div>';
    var row = container.querySelector("#erChoices");
    door.options.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        var ok = w === door.correct;
        recordActivity("escapeRoom", ok);
        if (ok){
          row.querySelectorAll("button").forEach(function(b){ b.disabled = true; });
          btn.classList.add("correct");
          container.querySelector("#erFeedback").innerHTML =
            '<div class="feedback-banner ok">Porta oberta! ' + door.explain + '</div>' +
            '<div class="reader-toolbar" style="margin-top:10px;"><button class="ghost-btn" id="erNextDoor">Següent porta</button></div>';
          container.querySelector("#erNextDoor").addEventListener("click", function(){ renderEscapeDoor(container, doors, index + 1); });
        } else {
          btn.disabled = true;
          btn.classList.add("incorrect");
          container.querySelector("#erFeedback").innerHTML =
            '<div class="feedback-banner bad">Aquesta clau no encaixa. Torna-ho a provar.</div>';
        }
      });
      row.appendChild(btn);
    });
  }

  var MISSIONS_ACTIVITIES = [
    { id:"missio-lectura", name:"Missió de lectura", desc:"Llegeix un text amb una finalitat concreta: trobar una dada, resoldre un problema…", render: renderMissioDeLectura },
    { id:"escape-room", name:"Escape room textual", desc:"Supera petites proves de lectura i ortografia per avançar.", render: renderEscapeRoom }
  ];
  var missionsGrid = document.getElementById("grid-missions");
  var missionsDetail = document.getElementById("missions-detail");
  var missionsView = document.getElementById("missions-view");
  function showMissionsGrid(){ missionsDetail.hidden = true; missionsGrid.hidden = false; }
  function openMissionsActivity(a){ missionsGrid.hidden = true; missionsDetail.hidden = false; missionsView.innerHTML = ""; a.render(missionsView); }
  renderActivityGrid(missionsGrid, MISSIONS_ACTIVITIES, openMissionsActivity);
  document.getElementById("missions-back").addEventListener("click", showMissionsGrid);

  /* ---------------- Lectura i fluïdesa: dades ---------------- */
  var GUIDED_SENTENCES = BANKS.GUIDED_SENTENCES;

  var FLUENCY_PARAGRAPHS = BANKS.FLUENCY_PARAGRAPHS;

  var PAUSE_SENTENCES = BANKS.PAUSE_SENTENCES;

  var FUNCTIONAL_TEXTS = BANKS.FUNCTIONAL_TEXTS;

  /* ---- Lectura guiada amb ressaltat progressiu ---- */
  var lastGuided = null;
  function renderLecturaGuiada(container){
    var sentence = pickRandom(GUIDED_SENTENCES, function(s){ return s === lastGuided; });
    lastGuided = sentence;
    container.innerHTML =
      '<p class="section-hint">Escolta el model amb ressaltat paraula per paraula i després llegeix tu la mateixa frase en veu alta.</p>' +
      '<div class="reader-toolbar"><button class="play-btn" id="lgPlay">▶ Escolta el model</button></div>' +
      '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text" id="lgText"></div></div>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="lgDone">Ja l\'he llegida en veu alta</button><button class="ghost-btn" id="lgNext">Nova frase</button></div>' +
      '<div id="lgResult"></div>';
    var built = buildWordSpans(container.querySelector("#lgText"), sentence);
    container.querySelector("#lgPlay").addEventListener("click", function(){
      speak(sentence, { onBoundary: function(ci){ highlightWordAt(built.spans, built.offsets, ci); } });
    });
    container.querySelector("#lgDone").addEventListener("click", function(){
      recordActivity("lecturaGuiada", true);
      container.querySelector("#lgResult").innerHTML = '<div class="feedback-banner ok">Molt bé! Continua practicant amb el ressaltat com a guia.</div>';
    });
    container.querySelector("#lgNext").addEventListener("click", function(){ renderLecturaGuiada(container); });
  }

  /* ---- Lectura repetida amb comptador de precisió ---- */
  var lecturaRepetidaState = null;
  function renderLecturaRepetida(container){
    var para = pickRandom(FLUENCY_PARAGRAPHS, function(p){ return lecturaRepetidaState && p === lecturaRepetidaState.para; });
    lecturaRepetidaState = { para: para, attempts: [] };
    renderLecturaRepetidaView(container);
  }
  function renderLecturaRepetidaView(container){
    var st = lecturaRepetidaState;
    var wordCount = st.para.text.split(/\s+/).length;
    container.innerHTML =
      '<p class="section-hint">Llegeix aquest text en veu alta tantes vegades com vulguis. Prem «Comença» just abans de llegir i «He acabat» quan arribis al final.</p>' +
      '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text">' + st.para.text + '</div></div>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="lrStart">Comença a llegir</button><button class="ghost-btn" id="lrStop" disabled>He acabat</button></div>' +
      '<div id="lrResult"></div><div id="lrHistory"></div>' +
      '<div><button class="ghost-btn" id="lrNext">Nou text</button></div>';
    var startTime = null;
    function renderHistory(){
      var hist = container.querySelector("#lrHistory");
      if (!st.attempts.length){ hist.innerHTML = ""; return; }
      hist.innerHTML = '<p class="section-hint" style="margin-top:8px;">Les teves lectures d\'aquest text:</p>' +
        '<ul style="margin:4px 0 0; padding-left:18px; font-size:13px; color:var(--ink-secondary);">' +
        st.attempts.map(function(a, i){ return "<li>Lectura " + (i + 1) + ": " + a.seconds + " s (" + a.wpm + " paraules/min)</li>"; }).join("") + "</ul>";
    }
    container.querySelector("#lrStart").addEventListener("click", function(){
      startTime = Date.now();
      container.querySelector("#lrStart").disabled = true;
      container.querySelector("#lrStop").disabled = false;
      container.querySelector("#lrResult").innerHTML = '<div class="feedback-banner ok">Endavant, llegeix en veu alta…</div>';
    });
    container.querySelector("#lrStop").addEventListener("click", function(){
      var seconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      var wpm = Math.round((wordCount / seconds) * 60);
      st.attempts.push({ seconds: seconds, wpm: wpm });
      logWpm("lecturaRepetida", wpm);
      recordActivity("lecturaRepetida", true);
      container.querySelector("#lrStart").disabled = false;
      container.querySelector("#lrStop").disabled = true;
      container.querySelector("#lrResult").innerHTML = '<div class="feedback-banner ok">Ho has llegit en ' + seconds + ' segons (' + wpm + ' paraules per minut).</div>';
      renderHistory();
    });
    container.querySelector("#lrNext").addEventListener("click", function(){ renderLecturaRepetida(container); });
    renderHistory();
  }

  /* ---- Lectura amb suport auditiu opcional ---- */
  var lastSuportAuditiu = null;
  function renderLecturaSuportAuditiu(container){
    var para = pickRandom(FLUENCY_PARAGRAPHS, function(p){ return p === lastSuportAuditiu; });
    lastSuportAuditiu = para;
    var sentences = para.text.match(/[^.!?]+[.!?]*/g) || [para.text];
    container.innerHTML =
      '<p class="section-hint">Llegeix el text a la teva manera. Si et cal ajuda amb alguna frase, prem el seu botó d\'àudio.</p>' +
      '<div class="stack" id="saSentences"></div>' +
      '<div class="reader-toolbar" style="margin-top:10px;"><button class="ghost-btn" id="saDone">Ja l\'he llegit</button><button class="ghost-btn" id="saNext">Nou text</button></div>' +
      '<div id="saResult"></div>';
    var wrap = container.querySelector("#saSentences");
    sentences.forEach(function(s){
      var trimmed = s.trim();
      if (!trimmed) return;
      var row = document.createElement("div");
      row.className = "reader-toolbar";
      row.style.alignItems = "flex-start";
      var span = document.createElement("span");
      span.className = "reading-text adaptive-text";
      span.style.flex = "1";
      span.textContent = trimmed;
      var btn = document.createElement("button");
      btn.className = "play-btn";
      btn.textContent = "🔊";
      btn.title = "Escolta aquesta frase";
      btn.addEventListener("click", function(){ speak(trimmed, {}); });
      row.appendChild(span); row.appendChild(btn);
      wrap.appendChild(row);
    });
    container.querySelector("#saDone").addEventListener("click", function(){
      recordActivity("suportAuditiu", true);
      container.querySelector("#saResult").innerHTML = '<div class="feedback-banner ok">Molt bé!</div>';
    });
    container.querySelector("#saNext").addEventListener("click", function(){ renderLecturaSuportAuditiu(container); });
  }

  /* ---- Lectura amb pauses intel·ligents ---- */
  var lastPauseItem = null;
  function renderLecturaPauses(container){
    var item = pickRandom(PAUSE_SENTENCES, function(it){ return it === lastPauseItem; });
    lastPauseItem = item;
    container.innerHTML =
      '<p class="section-hint">Fes una petita pausa a cada barra ( / ) mentre llegeixes en veu alta. Pots escoltar el model amb les pauses marcades.</p>' +
      '<div class="text-surface" style="min-height:auto; padding:18px;"><p class="reading-text adaptive-text">' + item.segments.join(' <span style="color:var(--accent); font-weight:700;">/</span> ') + '</p></div>' +
      '<div class="reader-toolbar"><button class="play-btn" id="ppPlay">▶ Escolta amb pauses</button></div>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="ppDone">Ja l\'he llegida</button><button class="ghost-btn" id="ppNext">Nova frase</button></div>' +
      '<div id="ppResult"></div>';
    container.querySelector("#ppPlay").addEventListener("click", function(){
      var i = 0;
      function playNext(){
        if (i >= item.segments.length) return;
        var seg = item.segments[i];
        i++;
        speak(seg, { onEnd: function(){ setTimeout(playNext, 450); } });
      }
      playNext();
    });
    container.querySelector("#ppDone").addEventListener("click", function(){
      recordActivity("lecturaPauses", true);
      container.querySelector("#ppResult").innerHTML = '<div class="feedback-banner ok">Molt bé, marcar les pauses ajuda a llegir amb més entonació!</div>';
    });
    container.querySelector("#ppNext").addEventListener("click", function(){ renderLecturaPauses(container); });
  }

  /* ---- Repte de fluïdesa ---- */
  var lastRepteText = null;
  function renderRepteFluidesa(container){
    var frag = pickRandom(FLUENCY_PARAGRAPHS, function(p){ return p === lastRepteText; });
    lastRepteText = frag;
    var wordCount = frag.text.split(/\s+/).length;
    renderRepteRound(container, frag, wordCount, [], 1);
  }
  function renderRepteRound(container, frag, wordCount, rounds, roundNum){
    container.innerHTML =
      '<p class="section-hint">Llegeix aquest mateix fragment 3 vegades seguides i mira com millores el temps. Ronda ' + roundNum + ' de 3.</p>' +
      '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text">' + frag.text + '</div></div>' +
      '<div class="reader-toolbar"><button class="ghost-btn" id="rfStart">Comença</button><button class="ghost-btn" id="rfStop" disabled>He acabat</button></div>' +
      '<div id="rfResult"></div>';
    var startTime = null;
    container.querySelector("#rfStart").addEventListener("click", function(){
      startTime = Date.now();
      container.querySelector("#rfStart").disabled = true;
      container.querySelector("#rfStop").disabled = false;
    });
    container.querySelector("#rfStop").addEventListener("click", function(){
      var seconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      var wpm = Math.round((wordCount / seconds) * 60);
      rounds.push({ seconds: seconds, wpm: wpm });
      if (roundNum < 3){
        container.querySelector("#rfResult").innerHTML =
          '<div class="feedback-banner ok">Ronda ' + roundNum + ': ' + seconds + ' s (' + wpm + ' paraules/min).</div>' +
          '<div class="reader-toolbar" style="margin-top:10px;"><button class="ghost-btn" id="rfContinue">Següent ronda</button></div>';
        container.querySelector("#rfContinue").addEventListener("click", function(){ renderRepteRound(container, frag, wordCount, rounds, roundNum + 1); });
      } else {
        var maxWpm = Math.max.apply(null, rounds.map(function(r){ return r.wpm; }));
        logWpm("repteFluidesa", maxWpm);
        recordActivity("repteFluidesa", true);
        container.innerHTML =
          '<p class="section-hint">Repte acabat! Aquesta és la teva evolució:</p>' +
          '<ul style="margin:4px 0 0; padding-left:18px;">' +
          rounds.map(function(r, i){ return "<li>Ronda " + (i + 1) + ": " + r.seconds + " s — " + r.wpm + " paraules/min</li>"; }).join("") + "</ul>" +
          '<div class="feedback-banner ok" style="margin-top:10px;">Millor marca: ' + maxWpm + ' paraules per minut.</div>' +
          '<div class="reader-toolbar" style="margin-top:10px;"><button class="ghost-btn" id="rfNext">Nou repte</button></div>';
        container.querySelector("#rfNext").addEventListener("click", function(){ renderRepteFluidesa(container); });
      }
    });
  }

  /* ---- Text funcional ---- */
  var lastFunctional = null;
  function renderTextFuncional(container){
    var item = pickRandom(FUNCTIONAL_TEXTS, function(it){ return it === lastFunctional; });
    lastFunctional = item;
    var opts = item.options.slice().sort(function(){ return Math.random() - 0.5; });
    container.innerHTML =
      '<p class="section-hint">' + item.topic + '</p>' +
      '<p class="prompt-word adaptive-text" style="font-size:18px;">' + item.title + '</p>' +
      '<div class="text-surface" style="min-height:auto; padding:18px;"><div class="reading-text adaptive-text">' + item.text + '</div></div>' +
      '<div class="reader-toolbar"><button class="play-btn" id="tfPlay">▶ Escolta el text</button></div>' +
      '<p class="section-hint" style="margin-top:10px;">' + item.question + '</p>' +
      '<div class="choice-row" id="tfChoices"></div>' +
      '<div id="tfFeedback"></div>' +
      '<div><button class="ghost-btn" id="tfNext">Nou text</button></div>';
    container.querySelector("#tfPlay").addEventListener("click", function(){ speak(item.text, {}); });
    var row = container.querySelector("#tfChoices");
    opts.forEach(function(w){
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = w;
      btn.addEventListener("click", function(){
        row.querySelectorAll("button").forEach(function(b){ b.disabled = true; if (b.textContent === item.correct) b.classList.add("correct"); });
        var ok = w === item.correct;
        if (!ok) btn.classList.add("incorrect");
        recordActivity("textFuncional", ok);
        container.querySelector("#tfFeedback").innerHTML =
          '<div class="feedback-banner ' + (ok ? "ok" : "bad") + '">La resposta és: «' + item.correct + '».</div>';
      });
      row.appendChild(btn);
    });
    container.querySelector("#tfNext").addEventListener("click", function(){ renderTextFuncional(container); });
  }

  var LECTURA_ACTIVITIES = [
    { id:"lectura-guiada", name:"Lectura guiada amb ressaltat progressiu", desc:"Escolta un model amb ressaltat i repeteix la lectura en veu alta.", render: renderLecturaGuiada },
    { id:"lectura-repetida", name:"Lectura repetida amb comptador de precisió", desc:"Llegeix el mateix text diverses vegades i mira la teva evolució.", render: renderLecturaRepetida },
    { id:"suport-auditiu", name:"Lectura amb suport auditiu opcional", desc:"Tu decideixes quan escoltar cada frase.", render: renderLecturaSuportAuditiu },
    { id:"lectura-pauses", name:"Lectura amb pauses intel·ligents", desc:"Practica pauses i entonació en frases llargues.", render: renderLecturaPauses },
    { id:"repte-fluidesa", name:"Repte de fluïdesa", desc:"Repeteix el mateix fragment 3 vegades i mira la teva millora.", render: renderRepteFluidesa },
    { id:"text-funcional", name:"Text funcional", desc:"Textos propers als interessos de l'alumne: esports, videojocs, música…", render: renderTextFuncional }
  ];
  var lecturaGrid = document.getElementById("grid-lectura");
  var lecturaDetail = document.getElementById("lectura-detail");
  var lecturaView = document.getElementById("lectura-view");
  function showLecturaGrid(){ lecturaDetail.hidden = true; lecturaGrid.hidden = false; }
  function openLecturaActivity(a){ lecturaGrid.hidden = true; lecturaDetail.hidden = false; lecturaView.innerHTML = ""; a.render(lecturaView); }
  renderActivityGrid(lecturaGrid, LECTURA_ACTIVITIES, openLecturaActivity);
  document.getElementById("lectura-back").addEventListener("click", showLecturaGrid);

  // El lector adaptat és la primera activitat de la llista de lectura.
  var lectorDetail = document.getElementById("lector-detail");
  (function(){
    var card = document.createElement("button");
    card.className = "activity-card";
    card.innerHTML = '<span class="name">Lector adaptat</span><span class="desc">Tria o enganxa un text i escolta’l amb les paraules ressaltades.</span>';
    card.addEventListener("click", function(){ lecturaGrid.hidden = true; lectorDetail.hidden = false; });
    lecturaGrid.insertBefore(card, lecturaGrid.firstChild);
  })();
  document.getElementById("lector-back").addEventListener("click", function(){
    document.getElementById("stopBtn").click();
    lectorDetail.hidden = true; lecturaGrid.hidden = false;
  });

  /* ---------------- Progress view ---------------- */
  var DAY_LABELS = ["dg","dl","dt","dc","dj","dv","ds"];
  function renderProgress(){
    var totalAttempts = 0, totalCorrect = 0;
    Object.keys(progress.stats).forEach(function(k){ totalAttempts += progress.stats[k].a; totalCorrect += progress.stats[k].c; });
    var avgAcc = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    var streak = 0, d = new Date();
    while (true){
      var s = d.toISOString().slice(0,10);
      if (progress.streakDates.indexOf(s) !== -1){ streak++; d.setDate(d.getDate() - 1); } else break;
    }

    document.getElementById("progressTiles").innerHTML = [
      tile(streak, "Dies seguits practicant"),
      tile(totalAttempts, "Exercicis completats"),
      tile(avgAcc + "%", "Precisió mitjana")
    ].join("");

    var chart = document.getElementById("weekChart");
    chart.innerHTML = "";
    var counts = [];
    for (var i = 6; i >= 0; i--){
      var dt = new Date(); dt.setDate(dt.getDate() - i);
      var key = dt.toISOString().slice(0,10);
      counts.push({label: DAY_LABELS[dt.getDay()], count: progress.daily[key] || 0, isToday: i === 0});
    }
    var max = Math.max(1, Math.max.apply(null, counts.map(function(c){ return c.count; })));
    counts.forEach(function(c){
      var col = document.createElement("div");
      col.className = "week-col" + (c.isToday ? " today" : "");
      col.innerHTML = '<span class="week-count">' + c.count + '</span>' +
        '<div class="week-bar" style="height:' + Math.max(4, Math.round((c.count / max) * 100)) + '%"></div>' +
        '<span class="week-label">' + c.label + "</span>";
      chart.appendChild(col);
    });

    document.getElementById("accuracyBars").innerHTML = Object.keys(TYPE_INFO).map(function(k){
      var name = TYPE_INFO[k].label, st = progress.stats[k] || {a:0,c:0};
      var pct = st.a ? Math.round((st.c / st.a) * 100) : 0;
      var valueText = st.a ? pct + "%" : "—";
      return '<div class="bar-row"><span class="label">' + name + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="value">' + valueText + "</span></div>";
    }).join("");

    renderProgressProfile();
    renderSelfEval();
    renderReviewSection();
  }
  function tile(value, label){
    return '<div class="tile"><div class="tile-value">' + value + '</div><div class="tile-label">' + label + "</div></div>";
  }

  /* ---- Perfil de progrés: radar SVG + nivells per domini ---- */
  function renderRadarChart(axes){
    var size = 260, center = size / 2, radius = 88, n = axes.length;
    function pt(i, frac){
      var angle = (-90 + i * (360 / n)) * Math.PI / 180;
      return [center + radius * frac * Math.cos(angle), center + radius * frac * Math.sin(angle)];
    }
    var grid = [0.25, 0.5, 0.75, 1].map(function(f){
      var pts = axes.map(function(_, i){ return pt(i, f).join(","); }).join(" ");
      return '<polygon points="' + pts + '" fill="none" stroke="var(--border)" stroke-width="1"/>';
    }).join("");
    var axisLines = axes.map(function(_, i){
      var p = pt(i, 1);
      return '<line x1="' + center + '" y1="' + center + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="var(--border)" stroke-width="1"/>';
    }).join("");
    var dataPts = axes.map(function(a, i){ return pt(i, Math.max(0.04, a.value / 100)).join(","); }).join(" ");
    var labels = axes.map(function(a, i){
      var p = pt(i, 1.24);
      return '<text x="' + p[0] + '" y="' + p[1] + '" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="var(--ink-secondary)">' + a.label + '</text>';
    }).join("");
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:100%; max-width:280px; display:block; margin:0 auto;">' +
      grid + axisLines +
      '<polygon points="' + dataPts + '" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2"/>' +
      labels + '</svg>';
  }
  function renderProgressProfile(){
    document.getElementById("progressRadar").innerHTML = '<div class="radar-wrap">' + renderRadarChart(progressProfile()) + '</div>';
    document.getElementById("domainLevels").innerHTML = DOMAINS.map(function(d){
      return '<div class="level-card"><span class="name">' + DOMAIN_LABELS[d] + '</span><span class="level-pill">Nivell ' + domainLevel(d) + '/5</span></div>';
    }).join("");
  }

  /* ---- Autoavaluació lectora ---- */
  var EVAL_OPTIONS = [ {v:1,e:"😞"}, {v:2,e:"🙁"}, {v:3,e:"😐"}, {v:4,e:"🙂"}, {v:5,e:"😄"} ];
  function renderSelfEval(){
    var today = todayStr();
    var todays = progress.selfEval.filter(function(e){ return e.date === today; })[0];
    var wrap = document.getElementById("selfEvalWidget");
    wrap.innerHTML = '<div class="eval-row">' + EVAL_OPTIONS.map(function(o){
      return '<button type="button" class="eval-btn' + (todays && todays.rating === o.v ? " active" : "") + '" data-v="' + o.v + '">' + o.e + '</button>';
    }).join("") + '</div>' +
      '<p class="eval-note">' + (todays ? "Gràcies! Ja has valorat la lectura d'avui." : "Tria com t'ha semblat la lectura d'avui.") + '</p>';
    wrap.querySelectorAll(".eval-btn").forEach(function(btn){
      btn.addEventListener("click", function(){ submitSelfEval(parseInt(btn.dataset.v, 10)); });
    });
  }

  /* ---- Repàs espaiat i quadern d'errors ---- */
  function renderReviewSection(){
    var today = todayStr();
    var entries = Object.keys(progress.review).map(function(k){
      var r = progress.review[k];
      return { type:k, label:(TYPE_INFO[k] || {}).label || k, due:r.due, misses:r.misses };
    });
    entries.sort(function(a, b){ return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0); });
    var container = document.getElementById("reviewSection");
    if (!entries.length){
      container.innerHTML = '<p class="review-empty">Encara no tens cap exercici pendent de repàs. Quan et costi alguna activitat, apareixerà aquí per practicar-la de nou en el moment just.</p>';
      return;
    }
    container.innerHTML = '<div class="review-list">' + entries.map(function(e){
      var isDue = e.due <= today;
      return '<div class="review-item" data-type="' + e.type + '">' +
        '<span class="name">' + e.label + '</span>' +
        '<span class="due-badge ' + (isDue ? "today" : "upcoming") + '">' + (isDue ? "Toca repassar" : "Repàs " + e.due) + '</span>' +
        '<div class="sema-row">' +
        '<button type="button" class="sema-btn" data-rate="facil">🙂 Fàcil</button>' +
        '<button type="button" class="sema-btn" data-rate="dificil">😐 Difícil</button>' +
        '<button type="button" class="sema-btn" data-rate="molt-dificil">😖 Molt difícil</button>' +
        '</div>' +
        '<button type="button" class="ghost-btn practice-btn">Practica ara</button>' +
        '</div>';
    }).join("") + '</div>';

    container.querySelectorAll(".practice-btn").forEach(function(btn){
      btn.addEventListener("click", function(){ goToActivityTab(btn.closest(".review-item").dataset.type); });
    });
    container.querySelectorAll(".sema-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        applyDifficultyRating(btn.closest(".review-item").dataset.type, btn.dataset.rate);
      });
    });
  }

  document.getElementById("resetProgress").addEventListener("click", function(){
    if (!confirm("Segur que vols esborrar tot el progrés desat? Aquesta acció no es pot desfer.")) return;
    progress = { daily:{}, streakDates:[], review:{}, selfEval:[], wpm:{lecturaRepetida:[], repteFluidesa:[]}, log:[], stats:{
      letters:{a:0,c:0}, syllables:{a:0,c:0}, rhymes:{a:0,c:0},
      dictation:{a:0,c:0}, dictatPreparat:{a:0,c:0}, memoria:{a:0,c:0},
      patrons:{a:0,c:0}, detectiu:{a:0,c:0}, grafia:{a:0,c:0},
      segmentacio:{a:0,c:0}, eliminaSo:{a:0,c:0}, canviaSo:{a:0,c:0}, detectaSo:{a:0,c:0},
      escoltaTria:{a:0,c:0}, semblants:{a:0,c:0}, parelles:{a:0,c:0}, bingo:{a:0,c:0},
      pseudoparaula:{a:0,c:0}, construeix:{a:0,c:0}, ordenaSillabes:{a:0,c:0}, completaParaula:{a:0,c:0},
      familia:{a:0,c:0}, prefixSufix:{a:0,c:0}, vocabContextual:{a:0,c:0}, intrusa:{a:0,c:0},
      sinantonim:{a:0,c:0}, completaFrase:{a:0,c:0}, paraulaFrase:{a:0,c:0},
      lecturaGuiada:{a:0,c:0}, lecturaRepetida:{a:0,c:0}, suportAuditiu:{a:0,c:0},
      lecturaPauses:{a:0,c:0}, repteFluidesa:{a:0,c:0}, textFuncional:{a:0,c:0},
      prediccio:{a:0,c:0}, preguntaDurant:{a:0,c:0}, ideaPrincipal:{a:0,c:0}, ordenaHistoria:{a:0,c:0},
      quePodemDeduir:{a:0,c:0}, evidenciaTextual:{a:0,c:0}, informacioImportant:{a:0,c:0},
      construeixResum:{a:0,c:0}, respostaOral:{a:0,c:0},
      missioLectura:{a:0,c:0}, escapeRoom:{a:0,c:0}
    } };
    saveProgress(); renderProgress();
  });

  /* ---------------- Contingut (bancs d'exemples) ---------------- */
  var Content = window.LletraContent;
  function renderContentStatus(message){
    if (!Content) return;
    var st = Content.status();
    var own = st.total - st.base;
    var parts = [st.total + " exemples disponibles"];
    if (st.sources.length) parts.push(st.sources.map(function(src){
      return src.items + " de " + (src.titol ? "«" + src.titol + "» (" + src.source + ")" : src.source);
    }).join(", "));
    document.getElementById("contentSummary").textContent = parts.join(" · ") + (own < 0 ? " (alguns bancs s'han substituït)." : ".");
    var urlField = document.getElementById("contentUrl");
    if (document.activeElement !== urlField) urlField.value = st.url;
    var note = message || "";
    if (!note && st.url && st.remote){
      note = st.remote.error ? "No s'ha pogut baixar el paquet: " + st.remote.error + "." :
        "Última actualització: " + new Date(st.remote.at).toLocaleString("ca-ES") + ".";
    }
    document.getElementById("contentStatus").textContent = note;
  }
  if (Content){
    renderContentStatus();
    document.getElementById("contentRefresh").addEventListener("click", function(){
      var btn = this;
      Content.setUrl(document.getElementById("contentUrl").value);
      btn.disabled = true;
      renderContentStatus("Comprovant si hi ha contingut nou…");
      Content.refresh().then(function(r){
        btn.disabled = false;
        renderContentStatus(r.error ? "No s'ha pogut baixar el paquet: " + r.error + "." :
          r.changed ? "Hi ha contingut nou: recarrega l'app per fer-lo servir." : "El contingut ja està al dia.");
      });
    });
    document.addEventListener("lletra:contingut", function(){ document.getElementById("contentBanner").hidden = false; });
    document.getElementById("contentReload").addEventListener("click", function(){ location.reload(); });
    window.addEventListener("pageshow", function(){
      try{
        if (sessionStorage.getItem("lletraAmiga-contingut.reload")){ sessionStorage.removeItem("lletraAmiga-contingut.reload"); location.reload(); }
      }catch(e){}
    });
    // Comprova les novetats en segon pla un cop carregada l'app.
    setTimeout(function(){ Content.refresh().then(function(){ renderContentStatus(); }); }, 1500);
  } else {
    document.querySelector(".content-group").hidden = true;
  }

  /* ---------------- Informes de treball (js/reports.js) ---------------- */
  if (window.LletraReports){
    window.LletraReports.init({
      profiles: function(){ return profiles; },
      activeProfileId: function(){ return activeProfileId; },
      loadProgress: function(id){
        if (id === activeProfileId) return progress;
        return Object.assign({ daily:{}, streakDates:[], review:{}, selfEval:[], wpm:{}, log:[], stats:{} }, loadJSON(progressKeyFor(id), {}));
      },
      typeInfo: TYPE_INFO, domains: DOMAINS, domainLabels: DOMAIN_LABELS
    });
    document.getElementById("openReport").addEventListener("click", function(){ window.LletraReports.open(); });
  } else {
    document.getElementById("openReport").hidden = true;
  }

  /* ---------------- Navegació dins de les categories ----------------
     En entrar a una categoria es veu la llista d'activitats. Una activitat oberta ocupa la pantalla
     (s'amaguen les pestanyes i la presentació de la categoria): per canviar-ne cal tornar enrere. */
  var activityDetails = document.querySelectorAll('.panel [id$="-detail"]');
  function closeActivities(){
    Array.prototype.forEach.call(activityDetails, function(d){
      if (d.hidden) return;
      var back = d.querySelector(".activity-back");
      if (back) back.click(); else d.hidden = true;
    });
  }
  function updateActivityMode(){
    var open = Array.prototype.some.call(activityDetails, function(d){ return !d.hidden; });
    document.documentElement.classList.toggle("in-activity", open);
  }
  var activityObserver = new MutationObserver(function(muts){
    updateActivityMode();
    muts.forEach(function(m){ if (!m.target.hidden) window.scrollTo(0, 0); });
  });
  Array.prototype.forEach.call(activityDetails, function(d){ activityObserver.observe(d, { attributes: true, attributeFilter: ["hidden"] }); });
  document.querySelectorAll("#mainTabs [role=tab]").forEach(function(btn){
    btn.addEventListener("click", closeActivities);
  });

  /* ---------------- Portada ---------------- */
  var COVER_KEY = "lletraAmiga-portada.amaga";
  var cover = document.getElementById("cover");
  function showCover(){
    try{ document.getElementById("coverSkip").checked = localStorage.getItem(COVER_KEY) === "1"; }catch(e){}
    cover.hidden = false; cover.scrollTop = 0;
    document.body.classList.add("cover-open");
  }
  function hideCover(){
    cover.hidden = true;
    document.body.classList.remove("cover-open");
    window.scrollTo(0, 0);
  }
  cover.querySelectorAll(".cover-card").forEach(function(card){
    card.addEventListener("click", function(){
      var tab = document.querySelector('#mainTabs [data-target="' + card.dataset.go + '"]');
      hideCover();
      if (tab) tab.click();
    });
  });
  document.getElementById("coverStart").addEventListener("click", hideCover);
  document.getElementById("openCover").addEventListener("click", showCover);
  document.getElementById("coverSkip").addEventListener("change", function(e){
    try{ if (e.target.checked) localStorage.setItem(COVER_KEY, "1"); else localStorage.removeItem(COVER_KEY); }catch(err){}
  });
  document.addEventListener("keydown", function(e){ if (e.key === "Escape" && !cover.hidden) hideCover(); });
  var skipCover = false;
  try{ skipCover = localStorage.getItem(COVER_KEY) === "1"; }catch(e){}
  if (!skipCover) showCover();

  /* ---------------- Init ---------------- */
  renderProfileUI();
  applySettings();
  renderReadingText(currentText);
  if (hasTTS && window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = function(){};
})();
