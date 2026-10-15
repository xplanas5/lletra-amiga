/* Informes de treball de Lletra Amiga.
   app.js hi passa el context (perfils, progrés, mapa d'activitats) amb LletraReports.init().
   L'informe es mostra a #reportBackdrop i es pot imprimir / desar en PDF o baixar en CSV.
   A l'APK, imprimir i desar fitxers passen pel pont natiu AndroidBridge. */
(function(){
  "use strict";

  var ctx = null;
  var NOTES_KEY = "lletraAmiga.reportNotes.v1";
  var ALL = "__all";
  var state = { profile: null, period: "30", from: "", to: "" };
  var EVAL_EMOJI = { 1:"😞", 2:"🙁", 3:"😐", 4:"🙂", 5:"😄" };
  var PERIODS = [
    ["7", "Últims 7 dies"], ["30", "Últims 30 dies"], ["90", "Últims 3 mesos"],
    ["curs", "Aquest curs (des de l'1 de setembre)"], ["tot", "Tot el període"], ["custom", "Personalitzat…"]
  ];

  /* ---------------- Utilitats ---------------- */
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  // Les dates de l'app (progress.daily) es desen amb toISOString: es fa servir el mateix criteri.
  function dayKey(d){ return new Date(d).toISOString().slice(0, 10); }
  function addDays(key, n){ var d = new Date(key + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return dayKey(d); }
  function fmtDate(key){ return new Date(key + "T12:00:00Z").toLocaleDateString("ca-ES", { day:"numeric", month:"short", year:"numeric" }); }
  function fmtDateShort(key){ return new Date(key + "T12:00:00Z").toLocaleDateString("ca-ES", { day:"numeric", month:"numeric" }); }
  function pct(c, a){ return a ? Math.round((c / a) * 100) : null; }
  function pctText(c, a){ var p = pct(c, a); return p === null ? "—" : p + "%"; }
  function fmtMinutes(m){
    if (!m) return "—";
    var h = Math.floor(m / 60), r = Math.round(m % 60);
    return h ? h + " h " + (r ? r + " min" : "") : r + " min";
  }
  function slug(s){ return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "perfil"; }
  function readNotes(id){ try{ return localStorage.getItem(NOTES_KEY + ":" + id) || ""; }catch(e){ return ""; } }
  function writeNotes(id, v){ try{ localStorage.setItem(NOTES_KEY + ":" + id, v); }catch(e){} }

  function typeLabel(k){ return (ctx.typeInfo[k] && ctx.typeInfo[k].label) || k; }
  function typeDomain(k){ return (ctx.typeInfo[k] && ctx.typeInfo[k].domain) || "altres"; }
  function domainLabel(d){ return ctx.domainLabels[d] || (d === "missions" ? "Missions" : "Altres"); }
  function domainOrder(){ return ctx.domains.concat(["missions"]); }

  /* ---------------- Període ---------------- */
  function range(){
    var today = dayKey(Date.now());
    if (state.period === "custom"){
      var f = state.from || addDays(today, -29), t = state.to || today;
      return f <= t ? { from: f, to: t } : { from: t, to: f };
    }
    if (state.period === "tot") return { from: "0000-01-01", to: today, all: true };
    if (state.period === "curs"){
      var now = new Date(), y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      return { from: y + "-09-01", to: today };
    }
    return { from: addDays(today, -(Number(state.period) - 1)), to: today };
  }
  function inRange(key, r){ return key >= r.from && key <= r.to; }

  /* ---------------- Anàlisi d'un perfil ---------------- */
  function levelFor(stats, domain){
    var a = 0, c = 0;
    Object.keys(ctx.typeInfo).forEach(function(k){
      if (ctx.typeInfo[k].domain !== domain || !stats[k]) return;
      a += stats[k].a; c += stats[k].c;
    });
    var p = a ? (c / a) * 100 : 0;
    if (a < 3 || p < 40) return 1;
    if (p < 55) return 2;
    if (p < 70) return 3;
    if (p < 85) return 4;
    return 5;
  }

  // Temps estimat: suma dels intervals entre respostes seguides (com a màxim 5 minuts),
  // més un minut per cada sessió per comptar el temps de la primera resposta.
  function estimateMinutes(entries){
    var ms = 0, sessions = 0, prev = null;
    entries.forEach(function(e){
      if (prev === null || e.t - prev > 5 * 60000) sessions++;
      else ms += e.t - prev;
      prev = e.t;
    });
    return Math.round(ms / 60000) + sessions;
  }

  function analyse(progress, r){
    var log = (progress.log || []).filter(function(e){ return inRange(dayKey(e.t), r); }).sort(function(a, b){ return a.t - b.t; });
    var firstLog = (progress.log || []).reduce(function(m, e){ return m === null || e.t < m ? e.t : m; }, null);
    var daily = progress.daily || {};
    var days = Object.keys(daily).filter(function(k){ return inRange(k, r) && daily[k] > 0; }).sort();
    var exercises = days.reduce(function(s, k){ return s + daily[k]; }, 0);

    var byType = {}, byDomain = {}, items = {};
    var correct = 0;
    log.forEach(function(e){
      var t = byType[e.k] || (byType[e.k] = { a:0, c:0 });
      t.a++; if (e.ok) { t.c++; correct++; }
      var d = typeDomain(e.k);
      var dd = byDomain[d] || (byDomain[d] = { a:0, c:0 });
      dd.a++; if (e.ok) dd.c++;
      if (e.i){
        var key = e.k + "|" + e.i;
        var it = items[key] || (items[key] = { k: e.k, i: e.i, a:0, miss:0, last: 0 });
        it.a++; if (!e.ok) it.miss++; it.last = e.t;
      }
    });
    var errorItems = Object.keys(items).map(function(k){ return items[k]; })
      .filter(function(it){ return it.miss > 0; })
      .sort(function(a, b){ return (b.miss - a.miss) || (b.miss / b.a - a.miss / a.a) || (b.last - a.last); });

    var wpm = [];
    Object.keys(progress.wpm || {}).forEach(function(k){
      (progress.wpm[k] || []).forEach(function(e){ if (inRange(e.date, r)) wpm.push({ k: k, date: e.date, wpm: e.wpm }); });
    });
    wpm.sort(function(a, b){ return a.date < b.date ? -1 : 1; });

    var stats = progress.stats || {};
    var levels = {};
    ctx.domains.forEach(function(d){ levels[d] = levelFor(stats, d); });

    var review = Object.keys(progress.review || {}).map(function(k){
      return { k: k, due: progress.review[k].due, misses: progress.review[k].misses || 0 };
    }).sort(function(a, b){ return a.due < b.due ? -1 : 1; });

    return {
      log: log, days: days, daily: daily, exercises: Math.max(exercises, log.length),
      answered: log.length, correct: correct, minutes: estimateMinutes(log),
      byType: byType, byDomain: byDomain, errorItems: errorItems, wpm: wpm,
      selfEval: (progress.selfEval || []).filter(function(e){ return inRange(e.date, r); }),
      levels: levels, review: review, stats: stats,
      partialLog: firstLog === null ? days.length > 0 : dayKey(firstLog) > r.from && days.some(function(k){ return k < dayKey(firstLog); })
    };
  }

  function recommendations(a){
    var out = [];
    domainOrder().forEach(function(d){
      var s = a.byDomain[d];
      if (s && s.a >= 5 && pct(s.c, s.a) < 60) out.push("Convé reforçar <b>" + esc(domainLabel(d)) + "</b>: " + pct(s.c, s.a) + "% d'encerts en " + s.a + " respostes.");
    });
    domainOrder().forEach(function(d){
      var s = a.byDomain[d];
      if (s && s.a >= 8 && pct(s.c, s.a) >= 85) out.push("Bon domini de <b>" + esc(domainLabel(d)) + "</b> (" + pct(s.c, s.a) + "%): es pot augmentar la dificultat.");
    });
    var practised = ctx.domains.filter(function(d){ return a.byDomain[d]; });
    var missing = ctx.domains.filter(function(d){ return !a.byDomain[d]; });
    if (practised.length && missing.length) out.push("No s'ha practicat: " + missing.map(function(d){ return esc(domainLabel(d)); }).join(", ") + ".");
    if (a.errorItems.length) out.push("Hi ha " + a.errorItems.length + " element(s) amb errors: es poden repassar amb la llista de més avall.");
    return out;
  }

  /* ---------------- HTML de l'informe ---------------- */
  function bar(p){
    if (p === null) return "";
    return '<span class="r-bar"><span class="r-bar-fill" style="width:' + p + '%"></span></span>';
  }
  function dailyChart(a, r){
    var start = r.all ? (a.days[0] || r.to) : r.from;
    var keys = [];
    for (var k = start; k <= r.to && keys.length < 400; k = addDays(k, 1)) keys.push(k);
    if (!keys.length) return "";
    var groups = [];
    if (keys.length <= 31){
      groups = keys.map(function(k){ return { label: fmtDateShort(k), value: a.daily[k] || 0 }; });
    } else {
      for (var i = 0; i < keys.length; i += 7){
        var wk = keys.slice(i, i + 7);
        groups.push({ label: fmtDateShort(wk[0]), value: wk.reduce(function(s, x){ return s + (a.daily[x] || 0); }, 0) });
      }
    }
    var max = Math.max.apply(null, groups.map(function(g){ return g.value; }).concat([1]));
    return '<div class="r-chart" role="img" aria-label="Exercicis per ' + (keys.length <= 31 ? "dia" : "setmana") + '">' +
      groups.map(function(g){
        return '<div class="r-col" title="' + esc(g.label) + ': ' + g.value + '"><span class="r-col-v">' + (g.value || "") + '</span>' +
          '<span class="r-col-bar" style="height:' + Math.round((g.value / max) * 100) + '%"></span><span class="r-col-l">' + esc(g.label) + '</span></div>';
      }).join("") + '</div>' +
      '<p class="r-note">' + (keys.length <= 31 ? "Exercicis per dia." : "Exercicis per setmana (la data és el primer dia de la setmana).") + '</p>';
  }

  function profileReportHTML(profile, a, r){
    var notes = readNotes(profile.id);
    var h = [];
    h.push('<header class="r-head"><div class="r-brand">Ll</div><div><h1>Informe de treball</h1>' +
      '<p class="r-sub">Lletra Amiga · Entrenament lector i ortogràfic</p></div></header>');
    h.push('<dl class="r-meta"><div><dt>Perfil</dt><dd>' + esc(profile.name) + '</dd></div>' +
      '<div><dt>Període</dt><dd>' + (r.all ? "Tot el període registrat" : fmtDate(r.from) + " – " + fmtDate(r.to)) + '</dd></div>' +
      '<div><dt>Data de l\'informe</dt><dd>' + new Date().toLocaleDateString("ca-ES", { day:"numeric", month:"long", year:"numeric" }) + '</dd></div></dl>');

    h.push('<section><h2>Resum</h2><div class="r-tiles">' +
      tile(a.days.length, "Dies amb activitat") + tile(a.exercises, "Exercicis fets") +
      tile(pctText(a.correct, a.answered), "Encerts") + tile(fmtMinutes(a.minutes), "Temps estimat de pràctica") +
      '</div>');
    if (!a.exercises) h.push('<p class="r-empty">No hi ha activitat registrada en aquest període.</p>');
    if (a.partialLog) h.push('<p class="r-note">Una part de l\'activitat d\'aquest període és anterior al registre detallat: el nombre d\'exercicis és complet, però els encerts, el temps i el detall per activitat només inclouen l\'activitat registrada.</p>');
    h.push('</section>');

    var rec = recommendations(a);
    if (rec.length) h.push('<section><h2>Observacions automàtiques</h2><ul class="r-list">' + rec.map(function(x){ return "<li>" + x + "</li>"; }).join("") + '</ul></section>');

    h.push('<section><h2>Resultats per àrees</h2><div class="r-scroll"><table class="r-table"><thead><tr><th>Àrea</th><th class="n">Respostes</th><th class="n">Encerts</th><th>% d\'encerts</th><th class="n">Nivell actual</th></tr></thead><tbody>' +
      domainOrder().map(function(d){
        var s = a.byDomain[d] || { a:0, c:0 };
        if (d === "missions" && !s.a) return "";
        var p = pct(s.c, s.a);
        return '<tr><td>' + esc(domainLabel(d)) + '</td><td class="n">' + s.a + '</td><td class="n">' + s.c + '</td><td>' + (p === null ? "—" : bar(p) + " " + p + "%") + '</td><td class="n">' +
          (a.levels[d] ? a.levels[d] + "/5" : "—") + '</td></tr>';
      }).join("") + '</tbody></table></div>' +
      '<p class="r-note">El nivell (1-5) s\'estima a partir de la precisió acumulada des del principi a cada àrea.</p></section>');

    var types = Object.keys(a.byType).sort(function(x, y){
      return domainOrder().indexOf(typeDomain(x)) - domainOrder().indexOf(typeDomain(y)) || a.byType[y].a - a.byType[x].a;
    });
    if (types.length){
      h.push('<section><h2>Detall per activitat</h2><div class="r-scroll"><table class="r-table"><thead><tr><th>Activitat</th><th>Àrea</th><th class="n">Respostes</th><th class="n">Encerts</th><th class="n">%</th></tr></thead><tbody>' +
        types.map(function(k){
          var s = a.byType[k];
          return '<tr><td>' + esc(typeLabel(k)) + '</td><td>' + esc(domainLabel(typeDomain(k))) + '</td><td class="n">' + s.a + '</td><td class="n">' + s.c + '</td><td class="n">' + pctText(s.c, s.a) + '</td></tr>';
        }).join("") + '</tbody></table></div></section>');
    }

    if (a.exercises) h.push('<section class="r-break-avoid"><h2>Activitat al llarg del període</h2>' + dailyChart(a, r) + '</section>');

    if (a.errorItems.length){
      h.push('<section><h2>Elements a reforçar</h2><p class="r-note">Paraules, frases o textos en què hi ha hagut errors, dels més fallats als menys.</p>' +
        '<div class="r-scroll"><table class="r-table"><thead><tr><th>Element</th><th>Activitat</th><th class="n">Errors</th><th class="n">Intents</th></tr></thead><tbody>' +
        a.errorItems.slice(0, 25).map(function(it){
          return '<tr><td>' + esc(it.i) + '</td><td>' + esc(typeLabel(it.k)) + '</td><td class="n">' + it.miss + '</td><td class="n">' + it.a + '</td></tr>';
        }).join("") + '</tbody></table></div>' +
        (a.errorItems.length > 25 ? '<p class="r-note">Es mostren els 25 primers de ' + a.errorItems.length + '. La llista completa és al CSV.</p>' : '') + '</section>');
    }

    if (a.wpm.length){
      h.push('<section><h2>Velocitat lectora</h2><div class="r-scroll"><table class="r-table"><thead><tr><th>Data</th><th>Activitat</th><th class="n">Paraules per minut</th></tr></thead><tbody>' +
        a.wpm.map(function(e){ return '<tr><td>' + fmtDate(e.date) + '</td><td>' + esc(typeLabel(e.k)) + '</td><td class="n">' + e.wpm + '</td></tr>'; }).join("") +
        '</tbody></table></div></section>');
    }

    if (a.selfEval.length){
      h.push('<section><h2>Autoavaluació («Com t\'ha anat llegir avui?»)</h2><p class="r-evals">' +
        a.selfEval.map(function(e){ return '<span class="r-eval"><span aria-hidden="true">' + (EVAL_EMOJI[e.rating] || "") + '</span> ' + fmtDateShort(e.date) + ' · ' + e.rating + '/5</span>'; }).join("") +
        '</p></section>');
    }

    if (a.review.length){
      h.push('<section><h2>Repàs pendent</h2><div class="r-scroll"><table class="r-table"><thead><tr><th>Activitat</th><th>Proper repàs</th><th class="n">Errors acumulats</th></tr></thead><tbody>' +
        a.review.map(function(e){ return '<tr><td>' + esc(typeLabel(e.k)) + '</td><td>' + fmtDate(e.due) + '</td><td class="n">' + e.misses + '</td></tr>'; }).join("") +
        '</tbody></table></div></section>');
    }

    h.push('<section class="r-break-avoid"><h2>Observacions del professional o de la família</h2>' +
      '<textarea class="field r-notes no-print" id="reportNotes" placeholder="Escriu aquí observacions, objectius o acords. Es desen en aquest dispositiu i surten a l\'informe imprès.">' + esc(notes) + '</textarea>' +
      '<div class="r-notes-print print-only">' + (notes ? esc(notes).replace(/\n/g, "<br>") : "&nbsp;") + '</div></section>');
    return h.join("");
  }
  function tile(v, label){ return '<div class="r-tile"><span class="r-tile-v">' + esc(v) + '</span><span class="r-tile-l">' + esc(label) + '</span></div>'; }

  function groupReportHTML(rows, r){
    var h = [];
    h.push('<header class="r-head"><div class="r-brand">Ll</div><div><h1>Resum de grup</h1><p class="r-sub">Lletra Amiga · Tots els perfils d\'aquest dispositiu</p></div></header>');
    h.push('<dl class="r-meta"><div><dt>Perfils</dt><dd>' + rows.length + '</dd></div>' +
      '<div><dt>Període</dt><dd>' + (r.all ? "Tot el període registrat" : fmtDate(r.from) + " – " + fmtDate(r.to)) + '</dd></div>' +
      '<div><dt>Data de l\'informe</dt><dd>' + new Date().toLocaleDateString("ca-ES", { day:"numeric", month:"long", year:"numeric" }) + '</dd></div></dl>');
    h.push('<section><h2>Activitat per perfil</h2><div class="r-scroll"><table class="r-table"><thead><tr><th>Perfil</th><th class="n">Dies</th><th class="n">Exercicis</th><th class="n">Encerts</th><th class="n">Temps</th>' +
      ctx.domains.map(function(d){ return '<th class="n">' + esc(domainLabel(d)) + '</th>'; }).join("") + '</tr></thead><tbody>' +
      rows.map(function(row){
        var a = row.a;
        return '<tr><td>' + esc(row.profile.name) + '</td><td class="n">' + a.days.length + '</td><td class="n">' + a.exercises + '</td><td class="n">' + pctText(a.correct, a.answered) + '</td><td class="n">' + fmtMinutes(a.minutes) + '</td>' +
          ctx.domains.map(function(d){ var s = a.byDomain[d]; return '<td class="n">' + (s ? pctText(s.c, s.a) : "—") + '</td>'; }).join("") + '</tr>';
      }).join("") + '</tbody></table></div>' +
      '<p class="r-note">Les columnes de cada àrea mostren el percentatge d\'encerts del període. Per veure el detall d\'un perfil, tria\'l a la llista de dalt.</p></section>');
    return h.join("");
  }

  /* ---------------- CSV ---------------- */
  function csvCell(v){ v = String(v == null ? "" : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function csv(rows){ return "﻿" + rows.map(function(r){ return r.map(csvCell).join(";"); }).join("\r\n") + "\r\n"; }

  function profileCSV(profile, a){
    var rows = [["Data", "Hora", "Perfil", "Àrea", "Activitat", "Element", "Resultat"]];
    a.log.forEach(function(e){
      var d = new Date(e.t);
      rows.push([d.toLocaleDateString("ca-ES"), d.toLocaleTimeString("ca-ES", { hour:"2-digit", minute:"2-digit" }), profile.name,
        domainLabel(typeDomain(e.k)), typeLabel(e.k), e.i || "", e.ok ? "Encert" : "Error"]);
    });
    return csv(rows);
  }
  function groupCSV(rows){
    var out = [["Perfil", "Dies amb activitat", "Exercicis", "Respostes registrades", "Encerts", "% encerts", "Temps estimat (min)"].concat(ctx.domains.map(function(d){ return "% " + domainLabel(d); }))];
    rows.forEach(function(row){
      var a = row.a;
      out.push([row.profile.name, a.days.length, a.exercises, a.answered, a.correct, pct(a.correct, a.answered) === null ? "" : pct(a.correct, a.answered), a.minutes]
        .concat(ctx.domains.map(function(d){ var s = a.byDomain[d]; return s ? pct(s.c, s.a) : ""; })));
    });
    return csv(out);
  }

  /* ---------------- Desa i imprimeix ---------------- */
  function saveFile(name, mime, text){
    if (window.AndroidBridge && window.AndroidBridge.saveFile){ window.AndroidBridge.saveFile(name, mime, text); return; }
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }
  function printReport(title){
    var old = document.title;
    document.title = title;   // el navegador el fa servir com a nom del PDF
    if (window.AndroidBridge && window.AndroidBridge.print) window.AndroidBridge.print(title);
    else window.print();
    setTimeout(function(){ document.title = old; }, 1000);
  }

  /* ---------------- Interfície ---------------- */
  var backdrop, toolbar, doc;

  function currentData(){
    var r = range();
    var profiles = ctx.profiles();
    if (state.profile === ALL){
      return { group: true, r: r, rows: profiles.map(function(p){ return { profile: p, a: analyse(ctx.loadProgress(p.id), r) }; }) };
    }
    var p = profiles.find(function(x){ return x.id === state.profile; }) || profiles[0];
    state.profile = p.id;
    return { group: false, r: r, profile: p, a: analyse(ctx.loadProgress(p.id), r) };
  }
  function fileBase(data){
    var r = data.r, when = r.all ? "tot" : r.from + "_" + r.to;
    return "informe-" + (data.group ? "grup" : slug(data.profile.name)) + "-" + when;
  }

  function renderToolbar(){
    var profiles = ctx.profiles();
    toolbar.innerHTML =
      '<div class="report-bar-head"><p class="section-title">Informe de treball</p>' +
        '<button class="close-btn" id="reportClose" aria-label="Tanca l\'informe">✕</button></div>' +
      '<div class="report-controls">' +
        '<label class="field-group"><span class="field-label">Perfil</span><select class="field" id="reportProfile">' +
          profiles.map(function(p){ return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join("") +
          (profiles.length > 1 ? '<option value="' + ALL + '">Tots els perfils (resum de grup)</option>' : '') +
        '</select></label>' +
        '<label class="field-group"><span class="field-label">Període</span><select class="field" id="reportPeriod">' +
          PERIODS.map(function(p){ return '<option value="' + p[0] + '">' + p[1] + '</option>'; }).join("") +
        '</select></label>' +
        '<div class="report-custom" id="reportCustom" hidden>' +
          '<label class="field-group"><span class="field-label">Des de</span><input class="field" type="date" id="reportFrom"></label>' +
          '<label class="field-group"><span class="field-label">Fins a</span><input class="field" type="date" id="reportTo"></label>' +
        '</div>' +
      '</div>' +
      '<div class="reader-toolbar report-actions">' +
        '<button class="play-btn" id="reportPrint">🖨 Imprimeix o desa en PDF</button>' +
        '<button class="ghost-btn" id="reportCsv">⬇ Baixa les dades (CSV)</button>' +
      '</div>';
    var selP = toolbar.querySelector("#reportProfile"), selR = toolbar.querySelector("#reportPeriod");
    selP.value = state.profile; selR.value = state.period;
    toolbar.querySelector("#reportFrom").value = state.from;
    toolbar.querySelector("#reportTo").value = state.to;
    toolbar.querySelector("#reportCustom").hidden = state.period !== "custom";

    selP.addEventListener("change", function(){ state.profile = selP.value; renderDoc(); });
    selR.addEventListener("change", function(){
      state.period = selR.value;
      if (state.period === "custom" && !state.from){
        var r = { to: dayKey(Date.now()) }; r.from = addDays(r.to, -29);
        state.from = r.from; state.to = r.to;
        toolbar.querySelector("#reportFrom").value = state.from; toolbar.querySelector("#reportTo").value = state.to;
      }
      toolbar.querySelector("#reportCustom").hidden = state.period !== "custom";
      renderDoc();
    });
    ["reportFrom", "reportTo"].forEach(function(id){
      toolbar.querySelector("#" + id).addEventListener("change", function(e){
        if (id === "reportFrom") state.from = e.target.value; else state.to = e.target.value;
        renderDoc();
      });
    });
    toolbar.querySelector("#reportClose").addEventListener("click", close);
    toolbar.querySelector("#reportPrint").addEventListener("click", function(){
      var data = currentData();
      printReport(fileBase(data));
    });
    toolbar.querySelector("#reportCsv").addEventListener("click", function(){
      var data = currentData();
      saveFile(fileBase(data) + ".csv", "text/csv", data.group ? groupCSV(data.rows) : profileCSV(data.profile, data.a));
    });
  }

  function renderDoc(){
    var data = currentData();
    doc.innerHTML = data.group ? groupReportHTML(data.rows, data.r) : profileReportHTML(data.profile, data.a, data.r);
    var notes = doc.querySelector("#reportNotes");
    if (notes){
      notes.addEventListener("input", function(){
        writeNotes(data.profile.id, notes.value);
        doc.querySelector(".r-notes-print").innerHTML = notes.value ? esc(notes.value).replace(/\n/g, "<br>") : "&nbsp;";
      });
    }
  }

  function open(){
    if (!ctx) return;
    if (!state.profile || (state.profile !== ALL && !ctx.profiles().some(function(p){ return p.id === state.profile; }))) state.profile = ctx.activeProfileId();
    renderToolbar();
    renderDoc();
    backdrop.hidden = false;
    document.body.classList.add("report-open");
    backdrop.scrollTop = 0;
  }
  function close(){
    backdrop.hidden = true;
    document.body.classList.remove("report-open");
  }

  function init(context){
    ctx = context;
    backdrop = document.getElementById("reportBackdrop");
    toolbar = document.getElementById("reportToolbar");
    doc = document.getElementById("reportDoc");
    if (!backdrop) return;
    backdrop.addEventListener("click", function(e){ if (e.target === backdrop) close(); });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && !backdrop.hidden) close(); });
  }

  window.LletraReports = { init: init, open: open, close: close, saveFile: saveFile };
})();
