/* Lletra Amiga — gamificació: punts, nivells, ratxa, objectiu diari, repte del dia, insígnies,
   avatars i estrelles per activitat.
   Principis: es premia l'esforç (cada intent suma i l'error no resta), sense límit de temps ni
   rànquings (cadascú es compara amb si mateix) i tot es pot amagar des dels ajustos.
   Les dades es desen dins del progrés de cada perfil (progress.game), així es sincronitzen amb el
   núvol com la resta. app.js crida LletraGame.init() i LletraGame.onActivity() a cada exercici. */
(function(){
  "use strict";

  var api = null;   // accessors que passa app.js

  /* ---------------- Regles ---------------- */
  var XP_INTENT = 3, XP_ENCERT = 7, XP_OBJECTIU = 20, XP_REPTE = 30;
  var GOALS = [5, 10, 20];

  // Nivell n a partir de 50·(n-1)² punts: el primer nivell arriba ràpid i després s'espaia.
  function levelFor(xp){ return Math.floor(Math.sqrt(xp / 50)) + 1; }
  function xpForLevel(n){ return 50 * (n - 1) * (n - 1); }
  var LEVEL_NAMES = [
    "🌱 Llavor", "🌿 Brot", "🍀 Fulla", "🌷 Flor", "🌳 Arbre jove", "🌲 Arbre fort",
    "🍎 Arbre amb fruits", "🏞️ Bosc", "⛰️ Muntanya", "🌈 Arc de Sant Martí", "⭐ Estel", "🌟 Constel·lació"
  ];
  function levelName(n){ return LEVEL_NAMES[Math.min(n, LEVEL_NAMES.length) - 1]; }

  var AVATARS = ["🦊", "🐼", "🐯", "🐸", "🐙", "🦁", "🐨", "🐧", "🐢", "🦉", "🐝", "🐬"];
  var AVATARS_LEVEL = { 3:"🦄", 5:"🐉", 7:"🚀", 9:"🦖", 12:"👑", 15:"🧙" };

  // Lectura i missions: un intent ja és un text sencer; la resta són exercicis curts.
  var CHALLENGE_TARGET = { lectura:1, missions:1, comprensio:2 };

  var DOMAIN_BADGES = {
    fonologia:{ e:"👂", nom:"Orella fina" }, descodificacio:{ e:"🔍", nom:"Ull de linx" },
    ortografia:{ e:"✒️", nom:"Ploma precisa" }, vocabulari:{ e:"💬", nom:"Caçaparaules" },
    lectura:{ e:"📖", nom:"Veu lectora" }, comprensio:{ e:"🧠", nom:"Ment detectiu" }
  };

  /* ---------------- Utilitats ---------------- */
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function dayStr(offset){ var d = new Date(); d.setDate(d.getDate() - offset); return d.toISOString().slice(0,10); }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]; }); }
  function hash(s){ var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function reducedMotion(){ return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

  function progress(){ return api.progress(); }
  function settings(){ return api.settings(); }
  function enabled(){ return settings().game !== false; }
  function dailyGoal(){ return GOALS.indexOf(settings().dailyGoal) !== -1 ? settings().dailyGoal : 10; }

  /* Estat de joc del perfil. Si no n'hi ha (perfil antic), es crea amb els punts que corresponen
     a l'activitat ja feta i les insígnies ja guanyades es marquen sense celebrar-les. */
  function game(){
    var p = progress();
    if (p.game) return p.game;
    var xp = 0;
    Object.keys(p.stats || {}).forEach(function(k){ var s = p.stats[k]; xp += s.a * XP_INTENT + s.c * XP_ENCERT; });
    p.game = { xp:xp, badges:{}, avatar:AVATARS[hash(api.profileId()) % AVATARS.length],
      combo:0, bestCombo:0, recovered:0, failed:{}, reviewsCleared:0, goalDays:{}, challenges:0, challenge:null };
    checkBadges(true);
    return p.game;
  }

  /* ---------------- Ratxa amb comodí ----------------
     Dies seguits amb activitat. Si avui encara no s'ha practicat, la ratxa continua viva.
     Un dia perdut es perdona com a màxim una vegada cada 7 dies (comodí setmanal). */
  function streakInfo(){
    var dates = {};
    (progress().streakDates || []).forEach(function(d){ dates[d] = 1; });
    var start = dates[todayStr()] ? 0 : 1, days = 0, gapAt = null;
    for (var i = start; i < 3660; i++){
      if (dates[dayStr(i)]){ days++; continue; }
      if (days && dates[dayStr(i + 1)] && (gapAt === null || i - gapAt >= 7)){ gapAt = i; continue; }
      break;
    }
    return { days:days, doneToday:!!dates[todayStr()], wildcard: gapAt !== null && gapAt <= 7 };
  }

  /* ---------------- Repte del dia ---------------- */
  function challengeTarget(type){ return CHALLENGE_TARGET[(api.typeInfo[type] || {}).domain] || 3; }
  function todayCount(type){
    var log = progress().log || [], today = todayStr(), n = 0;
    for (var i = log.length - 1; i >= 0; i--){
      if (new Date(log[i].t).toISOString().slice(0,10) !== today) break;
      if (log[i].k === type) n++;
    }
    return n;
  }
  // Prioritat: repàs pendent → activitats que costen → activitats no provades → qualsevol.
  function challenge(){
    var g = game(), today = todayStr();
    if (g.challenge && g.challenge.date === today && api.typeInfo[g.challenge.type]) return g.challenge;
    var p = progress(), types = Object.keys(api.typeInfo), pool;
    pool = types.filter(function(k){ return p.review[k] && p.review[k].due <= today; });
    if (!pool.length) pool = types.filter(function(k){ var s = p.stats[k]; return s && s.a >= 3 && s.c / s.a < 0.8; });
    if (!pool.length) pool = types.filter(function(k){ var s = p.stats[k]; return !s || !s.a; });
    if (!pool.length) pool = types;
    g.challenge = { date:today, type:pool[hash(today + api.profileId()) % pool.length], done:false };
    api.save();
    return g.challenge;
  }

  /* ---------------- Insígnies ---------------- */
  function totals(){
    var a = 0, c = 0, tried = 0, st = progress().stats || {};
    Object.keys(st).forEach(function(k){ a += st[k].a; c += st[k].c; if (st[k].a) tried++; });
    return { a:a, c:c, tried:tried };
  }
  function domainCorrect(domain){
    var c = 0, st = progress().stats || {};
    Object.keys(api.typeInfo).forEach(function(k){ if (api.typeInfo[k].domain === domain && st[k]) c += st[k].c; });
    return c;
  }
  function countKeys(o){ return Object.keys(o || {}).length; }

  var BADGES = [
    { id:"primer", e:"👣", nom:"Primer pas", com:"Fes el primer exercici.", f:function(t){ return t.a >= 1; } },
    { id:"ex25", e:"✏️", nom:"25 exercicis", com:"Fes 25 exercicis.", f:function(t){ return t.a >= 25; } },
    { id:"ex100", e:"📚", nom:"100 exercicis", com:"Fes 100 exercicis.", f:function(t){ return t.a >= 100; } },
    { id:"ex500", e:"🏆", nom:"500 exercicis", com:"Fes 500 exercicis.", f:function(t){ return t.a >= 500; } },
    { id:"ratxa3", e:"🔥", nom:"Ratxa de 3 dies", com:"Practica 3 dies seguits.", f:function(t, g, s){ return s.days >= 3; } },
    { id:"ratxa7", e:"🌋", nom:"Ratxa de 7 dies", com:"Practica 7 dies seguits.", f:function(t, g, s){ return s.days >= 7; } },
    { id:"ratxa30", e:"☀️", nom:"Ratxa de 30 dies", com:"Practica 30 dies seguits.", f:function(t, g, s){ return s.days >= 30; } },
    { id:"objectiu", e:"🎯", nom:"Objectiu complert", com:"Arriba a l'objectiu diari.", f:function(t, g){ return countKeys(g.goalDays) >= 1; } },
    { id:"objectiu10", e:"🗓️", nom:"10 objectius", com:"Arriba a l'objectiu diari 10 dies.", f:function(t, g){ return countKeys(g.goalDays) >= 10; } },
    { id:"repte", e:"🧩", nom:"Repte superat", com:"Supera un repte del dia.", f:function(t, g){ return g.challenges >= 1; } },
    { id:"repte10", e:"🗝️", nom:"10 reptes", com:"Supera 10 reptes del dia.", f:function(t, g){ return g.challenges >= 10; } },
    { id:"combo5", e:"⚡", nom:"5 encerts seguits", com:"Encerta 5 exercicis seguits.", f:function(t, g){ return g.bestCombo >= 5; } },
    { id:"combo15", e:"💫", nom:"15 encerts seguits", com:"Encerta 15 exercicis seguits.", f:function(t, g){ return g.bestCombo >= 15; } },
    { id:"errors", e:"💪", nom:"Aprenc dels errors", com:"Encerta 10 activitats que abans havies fallat.", f:function(t, g){ return g.recovered >= 10; } },
    { id:"repas", e:"🔁", nom:"Repàs a temps", com:"Completa el repàs d'una activitat.", f:function(t, g){ return g.reviewsCleared >= 1; } },
    { id:"tastaolletes", e:"🧭", nom:"Tastaolletes", com:"Prova 15 activitats diferents.", f:function(t){ return t.tried >= 15; } },
    { id:"escapista", e:"🚪", nom:"Escapista", com:"Supera 5 proves de l'escape room.", f:function(){ var s = progress().stats.escapeRoom; return !!s && s.c >= 5; } },
    { id:"emconec", e:"🪞", nom:"Em conec", com:"Valora la teva lectura 5 dies.", f:function(){ return (progress().selfEval || []).length >= 5; } },
    { id:"nivell5", e:"🌳", nom:"Nivell 5", com:"Arriba al nivell 5.", f:function(t, g){ return levelFor(g.xp) >= 5; } },
    { id:"nivell10", e:"🌈", nom:"Nivell 10", com:"Arriba al nivell 10.", f:function(t, g){ return levelFor(g.xp) >= 10; } }
  ];
  Object.keys(DOMAIN_BADGES).forEach(function(d){
    var b = DOMAIN_BADGES[d];
    BADGES.push({ id:"area-" + d, e:b.e, nom:b.nom, com:"Encerta 25 exercicis de " + domainName(d) + ".",
      f:function(){ return domainCorrect(d) >= 25; } });
  });
  function domainName(d){
    return { fonologia:"fonologia", descodificacio:"descodificació", ortografia:"ortografia",
      vocabulari:"vocabulari", lectura:"lectura", comprensio:"comprensió" }[d];
  }

  function checkBadges(silent){
    var g = progress().game, t = totals(), s = streakInfo(), news = [];
    BADGES.forEach(function(b){
      if (!g.badges[b.id] && b.f(t, g, s)){ g.badges[b.id] = Date.now(); news.push(b); }
    });
    if (!silent) news.forEach(function(b){ celebrate(b.e + " Nova insígnia: " + b.nom + "!", true, "badge"); });
    return news.length;
  }

  /* ---------------- Celebracions ---------------- */
  var queue = [], showing = false;
  function toastEl(){
    var el = document.getElementById("gameToast");
    if (!el){
      el = document.createElement("div");
      el.id = "gameToast"; el.className = "game-toast";
      el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }
  function celebrate(msg, big, sound){
    if (!enabled()) return;
    queue.push({ msg:msg, big:big, sound: sound || (big ? "fanfare" : null) });
    if (!showing) nextToast();
  }
  function nextToast(){
    var item = queue.shift(), el = toastEl();
    if (!item){ showing = false; el.classList.remove("on"); return; }
    showing = true;
    el.innerHTML = '<img src="img/' + (item.big ? "guineu-estrella" : "guineu-hola") + '.png" alt="" width="200" height="200"><span></span>';
    el.querySelector("span").textContent = item.msg;
    el.classList.add("on");
    if (item.big) confetti();
    if (item.sound) sfx(item.sound);
    setTimeout(function(){ el.classList.remove("on"); setTimeout(nextToast, 250); }, 2600);
  }
  function confetti(){
    if (reducedMotion()) return;
    var box = document.createElement("div");
    box.className = "game-confetti"; box.setAttribute("aria-hidden", "true");
    var colors = ["var(--accent)", "var(--success)", "var(--warning)", "#C77DBA", "#5B8BD9"];
    for (var i = 0; i < 36; i++){
      var b = document.createElement("i");
      b.style.left = Math.random() * 100 + "%";
      b.style.background = colors[i % colors.length];
      b.style.animationDelay = Math.random() * 0.4 + "s";
      b.style.animationDuration = 1.4 + Math.random() * 1.1 + "s";
      box.appendChild(b);
    }
    document.body.appendChild(box);
    setTimeout(function(){ box.remove(); }, 3000);
  }
  // Efectes sonors (js/sfx.js): només sonen si el joc i el so estan activats.
  function sfx(name, arg){ if (window.LletraSfx) window.LletraSfx.play(name, arg); }
  function bump(xp){
    var hud = document.getElementById("gameHud");
    if (!hud || !enabled()) return;
    var f = document.createElement("span");
    f.className = "game-float"; f.setAttribute("aria-hidden", "true");
    f.textContent = "+" + xp;
    hud.appendChild(f);
    setTimeout(function(){ f.remove(); }, 1200);
  }

  /* ---------------- Esdeveniments ---------------- */
  var lastRecoveryToast = 0;
  function onActivity(type, ok){
    var g = game(), before = levelFor(g.xp), gained = XP_INTENT + (ok ? XP_ENCERT : 0);
    if (ok){
      g.combo += 1;
      if (g.combo > g.bestCombo) g.bestCombo = g.combo;
      if (enabled()){ sfx(g.combo % 5 === 0 ? "combo" : "correct", g.combo); burst(); }
      if (g.combo === 5 || g.combo === 10 || g.combo === 20) celebrate("⚡ " + g.combo + " encerts seguits!", false);
      if (g.failed[type]){
        delete g.failed[type]; g.recovered += 1;
        if (Date.now() - lastRecoveryToast > 120000){ lastRecoveryToast = Date.now(); celebrate("💪 Abans t'havia costat i ara ho has encertat. Així s'aprèn!", false); }
      }
    } else {
      g.combo = 0; g.failed[type] = 1;
      sfx("wrong");
    }

    var today = todayStr(), goal = dailyGoal();
    if (!g.goalDays[today] && (progress().daily[today] || 0) >= goal){
      g.goalDays[today] = 1; gained += XP_OBJECTIU;
      celebrate("🎯 Objectiu d'avui complert: " + goal + " exercicis! +" + XP_OBJECTIU + " punts", true);
    }
    var ch = challenge();
    if (!ch.done && ch.type === type && todayCount(type) >= challengeTarget(type)){
      ch.done = true; g.challenges += 1; gained += XP_REPTE;
      celebrate("🧩 Repte del dia superat! +" + XP_REPTE + " punts", true);
    }

    g.xp += gained;
    var after = levelFor(g.xp);
    if (after > before){
      var unlock = AVATARS_LEVEL[after] ? " Has desbloquejat un avatar nou: " + AVATARS_LEVEL[after] : "";
      celebrate("Has pujat al nivell " + after + ": " + levelName(after) + "!" + unlock, true);
    }
    checkBadges(false);
    bump(gained);
    render();
  }
  function onReviewCleared(){
    game().reviewsCleared += 1;
    celebrate("🎉 Has atrapat un monstre d'errors! Ja no tornarà.", true);
  }

  /* ---------------- «Juice»: esclat petit a cada encert ---------------- */
  function burst(){
    if (reducedMotion()) return;
    var box = document.createElement("div");
    box.className = "game-burst"; box.setAttribute("aria-hidden", "true");
    var colors = ["#F4C842", "#5FCB8B", "#6CB8F0", "#E8709A", "#8E73E3", "#F59152"];
    for (var i = 0; i < 14; i++){
      var b = document.createElement("i"), a = (Math.PI * 2 * i) / 14, d = 60 + Math.random() * 60;
      b.style.background = colors[i % colors.length];
      b.style.setProperty("--dx", Math.round(Math.cos(a) * d) + "px");
      b.style.setProperty("--dy", Math.round(Math.sin(a) * d) + "px");
      box.appendChild(b);
    }
    var star = document.createElement("span"); star.className = "burst-star"; star.textContent = "⭐";
    box.appendChild(star);
    document.body.appendChild(box);
    setTimeout(function(){ box.remove(); }, 900);
  }

  /* ---------------- Vistes ---------------- */
  function stars(type){
    var s = progress().stats[type];
    if (!s || !s.a) return -1;
    var pct = s.c / s.a;
    if (s.a >= 20 && pct >= 0.85) return 3;
    if (s.a >= 10 && pct >= 0.7) return 2;
    if (s.a >= 5 && pct >= 0.5) return 1;
    return 0;
  }
  function starsHtml(n){
    if (n < 0) return '<span class="card-new">✨ Nova</span>';
    return '<span class="card-stars" aria-label="' + n + ' de 3 estrelles">' +
      "★★★".slice(0, n) + '<span class="off">' + "★★★".slice(n) + "</span></span>";
  }
  function renderCards(){
    document.querySelectorAll(".activity-card[data-type]").forEach(function(card){
      var slot = card.querySelector(".card-game");
      if (!slot){ slot = document.createElement("span"); slot.className = "card-game game-only"; card.appendChild(slot); }
      slot.innerHTML = starsHtml(stars(card.dataset.type));
    });
  }

  function summary(){
    var g = game(), lvl = levelFor(g.xp), a = xpForLevel(lvl), b = xpForLevel(lvl + 1);
    return { g:g, lvl:lvl, pct: Math.round(100 * (g.xp - a) / (b - a)), toNext: b - g.xp,
      streak: streakInfo(), goal: dailyGoal(), done: progress().daily[todayStr()] || 0, ch: challenge() };
  }
  function ring(done, goal, size){
    var r = size / 2 - 3, c = 2 * Math.PI * r, f = Math.min(1, done / goal);
    return '<svg class="goal-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" aria-hidden="true">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="4"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (f >= 1 ? "var(--success)" : "var(--accent)") +
      '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + (c * f) + " " + c + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/></svg>';
  }
  function challengeHtml(s){
    var ch = s.ch, info = api.typeInfo[ch.type] || {}, target = challengeTarget(ch.type);
    var n = Math.min(target, todayCount(ch.type));
    var due = progress().review[ch.type] && progress().review[ch.type].due <= todayStr();
    return '<div class="challenge' + (ch.done ? " done" : "") + '">' +
      '<span class="challenge-icon" aria-hidden="true">' + (ch.done ? "✅" : "🧩") + '</span>' +
      '<div class="challenge-text"><b>Repte del dia</b><span>' + esc(info.label || ch.type) + " · " +
      (target === 1 ? "fes-ne 1" : "fes-ne " + target) + " (" + n + "/" + target + ")" +
      (due && !ch.done ? " · toca repassar-la" : "") + " · +" + XP_REPTE + " punts</span></div>" +
      (ch.done ? '<span class="challenge-ok">Superat!</span>' : '<button class="ghost-btn" data-game-go="' + ch.type + '">Fes el repte</button>') +
      "</div>";
  }
  function statusHtml(s){
    var goalOk = s.done >= s.goal;
    return '<div class="game-status">' +
      '<div class="game-level"><span class="game-avatar" aria-hidden="true">' + s.g.avatar + "</span>" +
        '<div class="game-level-text"><b>Nivell ' + s.lvl + " · " + levelName(s.lvl) + "</b>" +
        '<div class="xp-track" role="progressbar" aria-label="Punts per al nivell següent" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + s.pct + '"><i style="width:' + s.pct + '%"></i></div>' +
        '<span class="game-note">' + s.g.xp + " punts · en falten " + s.toNext + " per al nivell " + (s.lvl + 1) + "</span></div></div>" +
      '<div class="game-mini"><span class="game-mini-icon" aria-hidden="true">🔥</span><b>' + s.streak.days + "</b><span>" +
        (s.streak.days === 1 ? "dia seguit" : "dies seguits") + (s.streak.doneToday ? "" : s.streak.days ? " · practica avui per mantenir-la" : " · comença-la avui") +
        (s.streak.wildcard ? " · comodí fet servir" : "") + "</span></div>" +
      '<div class="game-mini">' + ring(s.done, s.goal, 34) + "<b>" + Math.min(s.done, s.goal) + "/" + s.goal + "</b><span>" +
        (goalOk ? "objectiu d'avui complert!" : "exercicis per a l'objectiu d'avui") + "</span></div>" +
      "</div>";
  }

  function renderHud(s){
    var hud = document.getElementById("gameHud");
    if (!hud) return;
    hud.innerHTML = '<span class="hud-part">⭐ <b>' + s.lvl + "</b></span>" +
      '<span class="hud-part">🔥 <b>' + s.streak.days + "</b></span>" +
      '<span class="hud-part hud-goal">' + ring(s.done, s.goal, 20) + "<b>" + Math.min(s.done, s.goal) + "/" + s.goal + "</b></span>";
    hud.setAttribute("aria-label", "Nivell " + s.lvl + ", ratxa de " + s.streak.days + " dies, objectiu d'avui " +
      Math.min(s.done, s.goal) + " de " + s.goal + ". Obre els assoliments.");
    var av = document.getElementById("currentProfileAvatar");
    if (av) av.textContent = enabled() ? s.g.avatar : "👤";
  }
  function renderCard(s){
    var box = document.getElementById("gameCard");
    if (!box) return;
    var g = s.g, got = BADGES.filter(function(b){ return g.badges[b.id]; }).length;
    var avs = AVATARS.map(function(a){ return { a:a, lvl:0 }; }).concat(Object.keys(AVATARS_LEVEL).map(function(n){ return { a:AVATARS_LEVEL[n], lvl:+n }; }));
    box.innerHTML =
      '<div class="progress-head"><p class="section-title">Els teus assoliments</p>' +
        '<span class="score-pill">' + got + " de " + BADGES.length + " insígnies</span></div>" +
      statusHtml(s) + challengeHtml(s) +
      '<details class="game-details"><summary>Tria el teu avatar</summary>' +
        '<div class="avatar-grid">' + avs.map(function(v){
          var locked = v.lvl > s.lvl;
          return '<button type="button" class="avatar-btn" data-avatar="' + v.a + '" aria-pressed="' + (v.a === g.avatar) + '"' +
            (locked ? ' disabled title="Es desbloqueja al nivell ' + v.lvl + '"' : "") + ">" +
            (locked ? "🔒" : v.a) + (locked ? '<small>Nv ' + v.lvl + "</small>" : "") + "</button>";
        }).join("") + "</div></details>" +
      '<div><p class="section-title" style="margin-bottom:8px;">Insígnies</p><div class="badge-grid">' +
        BADGES.map(function(b){
          var when = g.badges[b.id];
          return '<div class="badge' + (when ? "" : " locked") + '" title="' + esc(b.com) + '">' +
            '<span class="badge-e" aria-hidden="true">' + b.e + "</span><b>" + esc(b.nom) + "</b>" +
            '<span class="badge-how">' + (when ? "Aconseguida el " + new Date(when).toLocaleDateString("ca-ES") : esc(b.com)) + "</span></div>";
        }).join("") + "</div></div>" +
      '<p class="section-hint">Cada exercici suma ' + XP_INTENT + " punts per l'esforç i " + XP_ENCERT +
        " més si l'encertes; equivocar-se mai no en resta. Les estrelles de cada activitat (★★★) mostren com la domines.</p>";
  }

  function render(){
    if (!api) return;
    document.documentElement.classList.toggle("game-off", !enabled());
    var s = summary();
    renderHud(s); renderCard(s); renderCards(); syncControls();
  }

  /* ---------------- Ajustos ---------------- */
  function syncControls(){
    var on = document.getElementById("gameToggle"), snd = document.getElementById("gameSoundToggle");
    if (on) on.checked = enabled();
    if (snd) snd.checked = settings().gameSound !== false;
    var seg = document.getElementById("goalSeg");
    if (seg) seg.querySelectorAll("button").forEach(function(b){ b.setAttribute("aria-pressed", +b.dataset.value === dailyGoal() ? "true" : "false"); });
  }
  function wireControls(){
    var on = document.getElementById("gameToggle"), snd = document.getElementById("gameSoundToggle");
    if (on) on.addEventListener("change", function(){ settings().game = on.checked; api.saveSettings(); render(); });
    if (snd) snd.addEventListener("change", function(){ settings().gameSound = snd.checked; api.saveSettings(); });
    var seg = document.getElementById("goalSeg");
    if (seg) seg.querySelectorAll("button").forEach(function(b){
      b.addEventListener("click", function(){ settings().dailyGoal = +b.dataset.value; api.saveSettings(); render(); });
    });

    document.addEventListener("click", function(e){
      var go = e.target.closest("[data-game-go]");
      if (go){ api.openActivity(go.dataset.gameGo); return; }
      var av = e.target.closest(".avatar-btn");
      if (av && !av.disabled){ game().avatar = av.dataset.avatar; api.save(); render(); return; }
      if (e.target.closest("#gameHud")) api.openProgress();
    });
  }

  window.LletraGame = {
    init: function(accessors){
      api = accessors;
      if (window.LletraSfx) window.LletraSfx.setEnabled(function(){ return enabled() && settings().gameSound !== false; });
      // Sons d'interfície: obrir seccions i activitats, i tocs en activitats de seleccionar o muntar.
      document.addEventListener("click", function(e){
        var t = e.target.closest ? e.target.closest("button") : null;
        if (!t || t.disabled) return;
        if (t.matches(".home-section, .activity-card, .home-action")) sfx("open");
        else if (t.matches(".letter-cell, .escape-object, [id$='Pool'] button, #mpChecks button, #srSentences button")) sfx("tap");
      }, true);
      game();
      wireControls();
      render();
    },
    onActivity: onActivity,
    onReviewCleared: onReviewCleared,
    check: function(){ if (api && checkBadges(false)) api.save(); render(); },
    render: render,
    streak: function(){ return streakInfo().days; },
    challengeInfo: function(){
      var ch = challenge(), target = challengeTarget(ch.type);
      return { type:ch.type, label:(api.typeInfo[ch.type] || {}).label || ch.type, done:ch.done,
        n:Math.min(target, todayCount(ch.type)), target:target };
    },
    avatarFor: function(p){ return p && p.game && p.game.avatar; }
  };
})();
