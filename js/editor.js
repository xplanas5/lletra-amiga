/* Editor de contingut de Lletra Amiga (editor.html).
   Permet afegir exemples propis a cada banc (o substituir els de l'app), desar-los en aquest
   dispositiu i exportar-los o importar-los com a fitxer JSON per compartir-los. */
(function(){
  "use strict";

  var C = window.LletraContent;
  var DEFAULTS = C.defaults;

  /* ---------------- Esquema dels bancs ----------------
     Tipus de camp: text, long (text llarg), number, bool, list (una línia per element),
     choice (opcions fixes), index1 (número de 1 a n que es desa com a índex 0..n-1),
     autoid (identificador intern, es genera sol) i objects (llista de sub-elements). */
  var CORRECT_IN_OPTIONS = "Ha de ser exactament igual que una de les opcions.";
  var SCHEMA = {
    SAMPLES: { group:"Lectura", label:"Textos del lector adaptat", act:"Lector adaptat (pestanya Lectura)",
      fields:[ {k:"title", t:"text", l:"Títol"}, {k:"text", t:"long", l:"Text"} ] },
    GUIDED_SENTENCES: { group:"Lectura", label:"Frases de lectura guiada", act:"Lectura guiada", item:"long" },
    FLUENCY_PARAGRAPHS: { group:"Lectura", label:"Textos de fluïdesa", act:"Lectura repetida, Suport auditiu, Repte de fluïdesa",
      fields:[ {k:"id", t:"autoid"}, {k:"text", t:"long", l:"Text (3-5 frases)"} ] },
    PAUSE_SENTENCES: { group:"Lectura", label:"Frases amb pauses", act:"Lectura amb pauses",
      fields:[ {k:"segments", t:"list", l:"Fragments de la frase", h:"Un per línia; es fa una pausa entre fragments."} ] },
    FUNCTIONAL_TEXTS: { group:"Lectura", label:"Textos funcionals", act:"Text funcional",
      fields:[ {k:"topic", t:"text", l:"Tema", h:"Per exemple: Esports, Música, Cuina."}, {k:"title", t:"text", l:"Títol"},
        {k:"text", t:"long", l:"Text"}, {k:"question", t:"text", l:"Pregunta"},
        {k:"options", t:"list", l:"Opcions de resposta", h:"Una per línia, inclosa la correcta."}, {k:"correct", t:"text", l:"Resposta correcta", h:CORRECT_IN_OPTIONS} ] },

    SYLLABLE_WORDS: { group:"Descodificació", label:"Paraules per comptar síl·labes", act:"Compta les síl·labes",
      fields:[ {k:"w", t:"text", l:"Paraula"}, {k:"n", t:"number", l:"Nombre de síl·labes"} ] },
    RHYME_GROUPS: { group:"Descodificació", label:"Grups de rimes", act:"Rimes", item:"strings",
      itemHelp:"La primera paraula és la que es pregunta; les altres (mínim dues) són les que hi rimen. Una per línia." },
    WORD_OR_PSEUDO_ITEMS: { group:"Descodificació", label:"Paraules i pseudoparaules", act:"Paraula o pseudoparaula",
      fields:[ {k:"text", t:"text", l:"Paraula"}, {k:"real", t:"bool", l:"És una paraula real", h:"Desmarca-ho si és una paraula inventada."} ] },
    ORDENA_SYLLABLE_WORDS: { group:"Descodificació", label:"Paraules per ordenar síl·labes", act:"Ordena síl·labes",
      fields:[ {k:"word", t:"text", l:"Paraula"}, {k:"syll", t:"list", l:"Síl·labes en ordre", h:"Una per línia. Juntes han de formar la paraula."} ] },
    COMPLETA_PARAULA_ITEMS: { group:"Descodificació", label:"Paraules per completar", act:"Completa la paraula",
      fields:[ {k:"word", t:"text", l:"Paraula sencera"}, {k:"before", t:"text", l:"Inici (abans del buit)", h:"Pot quedar buit."},
        {k:"correct", t:"text", l:"Fragment que falta"}, {k:"after", t:"text", l:"Final (després del buit)", h:"Pot quedar buit."},
        {k:"options", t:"list", l:"Opcions", h:"Una per línia, inclòs el fragment correcte."} ] },
    PHONEME_WORDS: { group:"Fonologia", label:"Paraules i els seus sons", act:"Segmentació fonèmica, Construeix la paraula",
      fields:[ {k:"word", t:"text", l:"Paraula"}, {k:"phonemes", t:"list", l:"Sons en ordre", h:"Un per línia. ll, ny, tx… compten com un sol so."} ] },

    SENTENCES: { group:"Ortografia", label:"Frases de dictat", act:"Dictat interactiu", item:"long" },
    SPELLING_WORDS: { group:"Ortografia", label:"Paraules per memoritzar", act:"Memòria ortogràfica", item:"text" },
    SPELLING_PATTERNS: { group:"Ortografia", label:"Patrons ortogràfics", act:"Caça de patrons, Tria la grafia",
      fields:[ {k:"id", t:"autoid"}, {k:"label", t:"text", l:"Nom del patró", h:"Per exemple: b / v."}, {k:"hint", t:"long", l:"Explicació de la norma"},
        {k:"words", t:"objects", l:"Parelles de paraules (mínim 5)", add:"Afegeix una parella",
          fields:[ {k:"correct", t:"text", l:"Forma correcta"}, {k:"wrong", t:"text", l:"Forma incorrecta"} ] } ] },
    DETECTIVE_ITEMS: { group:"Ortografia", label:"Frases amb un error", act:"Detectiu d'errors ortogràfics",
      fields:[ {k:"sentence", t:"long", l:"Frase amb l'error"}, {k:"wrong", t:"text", l:"Paraula mal escrita", h:"Tal com surt a la frase."},
        {k:"correct", t:"text", l:"Forma correcta"}, {k:"distractor", t:"text", l:"Una altra forma incorrecta", h:"Es mostra com a opció falsa."} ] },
    DICTAT_PREPARAT_SETS: { group:"Ortografia", label:"Dictats preparats", act:"Dictat preparat",
      fields:[ {k:"words", t:"list", l:"Paraules per practicar", h:"Una per línia. Han d'aparèixer a la frase."}, {k:"sentence", t:"long", l:"Frase del dictat"} ] },

    SOUND_DELETE_ITEMS: { group:"Fonologia", label:"Elimina un so", act:"Elimina un so",
      fields:[ {k:"word", t:"text", l:"Paraula"}, {k:"sound", t:"text", l:"So que s'elimina"}, {k:"result", t:"text", l:"El que queda"}, {k:"distractor", t:"text", l:"Opció falsa"} ] },
    SOUND_CHANGE_ITEMS: { group:"Fonologia", label:"Canvia un so", act:"Canvia un so",
      fields:[ {k:"word", t:"text", l:"Paraula"}, {k:"from", t:"text", l:"So que es canvia"}, {k:"to", t:"text", l:"So nou"}, {k:"result", t:"text", l:"Paraula que surt"} ] },
    SOUND_DETECT_SETS: { group:"Fonologia", label:"Detecta el so", act:"Detecta el so",
      fields:[ {k:"sound", t:"text", l:"So"}, {k:"words", t:"objects", l:"Paraules", add:"Afegeix una paraula",
        fields:[ {k:"w", t:"text", l:"Paraula"}, {k:"has", t:"bool", l:"Conté el so"} ] } ] },
    LISTEN_CHOOSE_ITEMS: { group:"Fonologia", label:"Escolta i tria", act:"Escolta i tria",
      fields:[ {k:"correct", t:"text", l:"Paraula que se sent"}, {k:"options", t:"list", l:"Opcions escrites", h:"Una per línia, inclosa la correcta."} ] },
    SIMILAR_PAIRS: { group:"Fonologia", label:"Paraules semblants", act:"Paraules semblants",
      fields:[ {k:"a", t:"text", l:"Paraula A"}, {k:"b", t:"text", l:"Paraula B"}, {k:"same", t:"bool", l:"Són iguals"}, {k:"note", t:"text", l:"Explicació"} ] },
    SOUND_PAIR_ITEMS: { group:"Fonologia", label:"Parelles paraula-so", act:"Parelles paraula-so",
      fields:[ {k:"word", t:"text", l:"Paraula que se sent"}, {k:"match", t:"text", l:"Opció correcta"}, {k:"distractor", t:"text", l:"Opció falsa"} ] },
    BINGO_SETS: { group:"Fonologia", label:"Cartrons de bingo", act:"Bingo fonològic",
      fields:[ {k:"syllable", t:"text", l:"Síl·laba inicial"}, {k:"words", t:"list", l:"Paraules del cartró", h:"Una per línia. Barreja'n que comencin per la síl·laba i que no."} ] },

    WORD_FAMILIES: { group:"Vocabulari", label:"Famílies de paraules", act:"Famílies de paraules",
      fields:[ {k:"base", t:"text", l:"Paraula base"}, {k:"members", t:"list", l:"Paraules de la mateixa família", h:"Una per línia."},
        {k:"others", t:"list", l:"Paraules d'altres famílies", h:"Una per línia (mínim 3)."} ] },
    PREFIX_SUFFIX_ITEMS: { group:"Vocabulari", label:"Prefixos i sufixos", act:"Prefixos i sufixos",
      fields:[ {k:"base", t:"text", l:"Paraula base"}, {k:"affix", t:"text", l:"Prefix o sufix", h:"Per exemple: re- o -ment."},
        {k:"correct", t:"text", l:"Paraula que es forma"}, {k:"hint", t:"text", l:"Explicació"} ] },
    VOCAB_CONTEXTUAL_ITEMS: { group:"Vocabulari", label:"Vocabulari en context", act:"Vocabulari contextual",
      fields:[ {k:"sentence", t:"long", l:"Frase", h:"La paraula es ressaltarà automàticament."}, {k:"word", t:"text", l:"Paraula"},
        {k:"correct", t:"text", l:"Significat correcte"}, {k:"distractors", t:"list", l:"Significats falsos", h:"Tres, un per línia."} ] },
    INTRUDER_ITEMS: { group:"Vocabulari", label:"Paraula intrusa", act:"Paraula intrusa",
      fields:[ {k:"words", t:"list", l:"Paraules", h:"Quatre, una per línia, inclosa la intrusa."}, {k:"intruder", t:"text", l:"Paraula intrusa"},
        {k:"hint", t:"text", l:"Pista", h:"Per exemple: Tots són animals excepte un."} ] },
    SYNANT_ITEMS: { group:"Vocabulari", label:"Sinònims i antònims", act:"Sinònims i antònims, Escape room",
      fields:[ {k:"word", t:"text", l:"Paraula"}, {k:"relation", t:"choice", l:"Relació", options:["sinònim", "antònim"]},
        {k:"correct", t:"text", l:"Resposta correcta"}, {k:"distractors", t:"list", l:"Opcions falses", h:"Tres, una per línia."} ] },
    COMPLETA_FRASE_ITEMS: { group:"Vocabulari", label:"Completa la frase", act:"Completa la frase pel context",
      fields:[ {k:"before", t:"text", l:"Text abans del buit", h:"Acaba-ho amb un espai si cal."}, {k:"after", t:"text", l:"Text després del buit"},
        {k:"correct", t:"text", l:"Paraula correcta"}, {k:"options", t:"list", l:"Opcions", h:"Una per línia, inclosa la correcta."} ] },
    WORD_SENTENCE_ITEMS: { group:"Vocabulari", label:"Paraules noves", act:"Paraula + frase",
      fields:[ {k:"word", t:"text", l:"Paraula"}, {k:"def", t:"long", l:"Definició"}, {k:"example", t:"long", l:"Frase d'exemple"} ] },

    PREDICTION_ITEMS: { group:"Comprensió", label:"Prediccions", act:"Predicció abans de llegir",
      fields:[ {k:"title", t:"text", l:"Títol"}, {k:"opening", t:"long", l:"Inici de la història"},
        {k:"options", t:"list", l:"Prediccions possibles", h:"Una per línia."}, {k:"correct", t:"text", l:"Predicció encertada", h:CORRECT_IN_OPTIONS},
        {k:"outcome", t:"long", l:"Com continua la història"} ] },
    QUESTION_DURING_ITEMS: { group:"Comprensió", label:"Preguntes durant la lectura", act:"Pregunta durant la lectura",
      fields:[ {k:"part1", t:"long", l:"Primera part del text"}, {k:"question", t:"text", l:"Pregunta"},
        {k:"options", t:"list", l:"Opcions", h:"Una per línia."}, {k:"correct", t:"text", l:"Resposta correcta", h:CORRECT_IN_OPTIONS},
        {k:"part2", t:"long", l:"Continuació del text"} ] },
    MAIN_IDEA_ITEMS: { group:"Comprensió", label:"Idea principal", act:"Idea principal, Escape room",
      fields:[ {k:"text", t:"long", l:"Text"}, {k:"correct", t:"text", l:"Idea principal"}, {k:"distractors", t:"list", l:"Opcions falses", h:"Tres, una per línia."} ] },
    STORY_ORDER_ITEMS: { group:"Comprensió", label:"Històries per ordenar", act:"Ordena la història",
      fields:[ {k:"fragments", t:"list", l:"Fragments en l'ordre correcte", h:"Un per línia; l'app els desordena."} ] },
    INFERENCE_ITEMS: { group:"Comprensió", label:"Inferències", act:"Què podem deduir?",
      fields:[ {k:"text", t:"long", l:"Text"}, {k:"question", t:"text", l:"Pregunta"}, {k:"correct", t:"text", l:"Resposta correcta"},
        {k:"distractors", t:"list", l:"Opcions falses", h:"Tres, una per línia."} ] },
    EVIDENCE_ITEMS: { group:"Comprensió", label:"Evidència textual", act:"Evidència textual",
      fields:[ {k:"sentences", t:"list", l:"Frases del text", h:"Una per línia."}, {k:"question", t:"text", l:"Pregunta"},
        {k:"evidenceIndex", t:"index1", l:"Número de la frase que respon", h:"1 és la primera frase."} ] },
    KEY_INFO_ITEMS: { group:"Comprensió", label:"Informació important", act:"Informació important",
      fields:[ {k:"sentences", t:"list", l:"Frases", h:"Una per línia."}, {k:"hint", t:"text", l:"Pregunta"},
        {k:"keyIndex", t:"index1", l:"Número de la frase clau", h:"1 és la primera frase."} ] },
    SUMMARY_ITEMS: { group:"Comprensió", label:"Construeix el resum", act:"Construeix el resum",
      fields:[ {k:"sentences", t:"objects", l:"Frases", add:"Afegeix una frase",
        fields:[ {k:"text", t:"text", l:"Frase"}, {k:"essential", t:"bool", l:"És essencial per al resum"} ] } ] },
    ORAL_READING_ITEMS: { group:"Comprensió", label:"Lectura i resposta", act:"Lectura i resposta oral",
      fields:[ {k:"text", t:"long", l:"Text"}, {k:"question", t:"text", l:"Pregunta"},
        {k:"keywords", t:"list", l:"Paraules clau de la resposta", h:"Una per línia. N'hi ha prou que la resposta en contingui una; pots posar només l'inici (p. ex. «endre» per a endreçar/endrecen)."},
        {k:"model", t:"text", l:"Resposta model"} ] },

    MISSION_ITEMS: { group:"Missions", label:"Missions pràctiques", act:"Missió pràctica",
      fields:[ {k:"title", t:"text", l:"Títol", h:"Per exemple: Inscriu-te a l'excursió."},
        {k:"intro", t:"long", l:"Situació", h:"Què ha de fer l'alumne i per què."},
        {k:"doc", t:"long", l:"Document", h:"Cartell, horari, recepta… La primera línia és el títol; cada línia es mostra separada."},
        {k:"fields", t:"objects", l:"Camps de la fitxa", add:"Afegeix un camp",
          fields:[ {k:"label", t:"text", l:"Què cal escriure"}, {k:"answers", t:"list", l:"Respostes acceptades", h:"Una per línia. No compten els accents, les majúscules ni la puntuació; si és un número, només les xifres."} ] },
        {k:"checkQ", t:"text", l:"Pregunta de la llista", h:"Per exemple: Què has de posar a la motxilla?"},
        {k:"checkItems", t:"list", l:"Elements de la llista", h:"Un per línia."},
        {k:"checkCorrect", t:"list", l:"Elements que cal marcar", h:"Un per línia, escrits igual que a la llista."} ] },
    ESCAPE_ROOMS: { group:"Missions", label:"Sales d'escape room", act:"Escape room",
      fields:[ {k:"title", t:"text", l:"Nom de la sala"}, {k:"story", t:"long", l:"Història inicial"},
        {k:"lockHint", t:"long", l:"Nota del cadenat", h:"Ha de dir en quin ordre van les peces, citant els objectes."},
        {k:"code", t:"text", l:"Codi del cadenat", h:"Les peces de les proves, en l'ordre de la nota."},
        {k:"puzzles", t:"objects", l:"Objectes i proves", add:"Afegeix un objecte",
          fields:[ {k:"object", t:"text", l:"Objecte", h:"Amb un emoji davant. Per exemple: 📕 Llibre vermell."},
            {k:"kind", t:"choice", l:"Tipus de prova", options:["pregunta", "errors"]},
            {k:"text", t:"long", l:"Text de la pista"},
            {k:"question", t:"text", l:"Consigna", h:"Per exemple: Quants animals surten a la frase?"},
            {k:"answers", t:"list", l:"Respostes", h:"Pregunta: respostes acceptades. Errors: les paraules mal escrites, tal com surten al text."},
            {k:"piece", t:"text", l:"Peça del codi que dona"} ] } ] }
  };
  var GROUP_ORDER = ["Lectura", "Descodificació", "Fonologia", "Ortografia", "Vocabulari", "Comprensió", "Missions"];

  /* ---------------- Estat ---------------- */
  function emptyPack(){ return { format: C.FORMAT, versio: 1, titol: "", autor: "", actualitzat: "", bancs: {} }; }
  var pack = normalisePack(C.getLocalPack()) || emptyPack();
  var current = Object.keys(SCHEMA)[0];
  var dirty = false;

  function normalisePack(p){
    if (!p || typeof p !== "object" || !p.bancs) return null;
    var out = emptyPack();
    out.titol = p.titol || ""; out.autor = p.autor || ""; out.actualitzat = p.actualitzat || "";
    Object.keys(p.bancs).forEach(function(name){
      if (!SCHEMA[name]) return;
      var e = p.bancs[name];
      var items = Array.isArray(e) ? e : (e && Array.isArray(e.items) ? e.items : []);
      out.bancs[name] = { mode: e && e.mode === "substitueix" ? "substitueix" : "afegeix", items: JSON.parse(JSON.stringify(items)) };
    });
    return out;
  }
  function bank(name){ return pack.bancs[name] || (pack.bancs[name] = { mode: "afegeix", items: [] }); }
  function ownCount(name){ return pack.bancs[name] ? pack.bancs[name].items.length : 0; }
  function setDirty(v){
    dirty = v;
    document.getElementById("saveState").textContent = v ? "Hi ha canvis sense desar." : "";
    document.getElementById("saveBtn").classList.toggle("needs-save", v);
  }
  function uid(){ return "propi-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ---------------- Ítems ---------------- */
  function blankItem(name){
    var s = SCHEMA[name];
    if (s.item === "text" || s.item === "long") return "";
    if (s.item === "strings") return ["", "", ""];
    return blankObject(s.fields);
  }
  function blankObject(fields){
    var o = {};
    fields.forEach(function(f){
      if (f.t === "autoid") o[f.k] = uid();
      else if (f.t === "number") o[f.k] = 1;
      else if (f.t === "index1") o[f.k] = 0;
      else if (f.t === "bool") o[f.k] = f.k === "real" || f.k === "essential" ? true : false;
      else if (f.t === "list") o[f.k] = [];
      else if (f.t === "choice") o[f.k] = f.options[0];
      else if (f.t === "objects") o[f.k] = [blankObject(f.fields)];
      else o[f.k] = "";
    });
    return o;
  }
  // Treu línies buides de les llistes abans de validar o desar.
  function tidy(name, item){
    var s = SCHEMA[name];
    if (s.item === "text" || s.item === "long") return String(item || "").trim();
    if (s.item === "strings") return item.map(function(x){ return String(x).trim(); }).filter(Boolean);
    return tidyObject(s.fields, item);
  }
  function tidyObject(fields, o){
    var out = {};
    fields.forEach(function(f){
      var v = o[f.k];
      if (f.t === "list") out[f.k] = (v || []).map(function(x){ return String(x).trim(); }).filter(Boolean);
      else if (f.t === "objects") out[f.k] = (v || []).map(function(x){ return tidyObject(f.fields, x); });
      else if (f.t === "text" || f.t === "long") out[f.k] = String(v == null ? "" : v).trim();
      else out[f.k] = v;
    });
    return out;
  }
  // Els missatges de validació citen el nom intern del camp: es canvia pel nom que veu l'usuari.
  function fieldLabels(fields, out){
    (fields || []).forEach(function(f){ if (f.l) out[f.k] = f.l; if (f.fields) fieldLabels(f.fields, out); });
    return out;
  }
  function validate(name, item){
    var e = C.validateItem(name, tidy(name, item));
    if (!e) return null;
    var labels = fieldLabels(SCHEMA[name].fields, {});
    return e.replace(/«([A-Za-z0-9]+)»/g, function(m, k){ return labels[k] ? "«" + labels[k] + "»" : m; });
  }
  function labelOf(name, item){
    if (typeof item === "string") return item;
    if (Array.isArray(item)) return item.join(", ");
    var s = SCHEMA[name], f = s.fields.find(function(x){ return x.t === "text" || x.t === "long"; }) || s.fields.find(function(x){ return x.t === "list"; });
    if (!f) return "";
    var v = item[f.k];
    if (Array.isArray(v)) v = v.length && typeof v[0] === "object" ? v[0].text || v[0].q || "" : v.join(", ");
    return String(v || "").replace(/<[^>]+>/g, "");
  }

  /* ---------------- Construcció de formularis ---------------- */
  function el(tag, attrs, children){
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(k){
      if (k === "text") e.textContent = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function(c){ if (c) e.appendChild(c); });
    return e;
  }
  var fieldSeq = 0;
  function fieldControl(f, obj, onChange){
    var id = "f" + (++fieldSeq);
    var wrap = el("div", { class: "ed-field" + (f.t === "long" || f.t === "list" || f.t === "objects" ? " wide" : "") });
    var label = el("label", { class: "field-label", for: id, text: f.l });
    var input;
    if (f.t === "bool"){
      input = el("input", { type: "checkbox", id: id });
      input.checked = !!obj[f.k];
      input.addEventListener("change", function(){ obj[f.k] = input.checked; onChange(); });
      wrap.className += " ed-check";
      wrap.appendChild(input); wrap.appendChild(label);
    } else if (f.t === "objects"){
      wrap.appendChild(el("p", { class: "field-label", text: f.l }));
      var list = el("div", { class: "ed-sublist" });
      var render = function(){
        list.innerHTML = "";
        obj[f.k].forEach(function(sub, i){
          var row = el("div", { class: "ed-subrow" });
          f.fields.forEach(function(sf){ row.appendChild(fieldControl(sf, sub, onChange)); });
          var del = el("button", { class: "mini-btn", type: "button", title: "Treu-ho", "aria-label": "Treu l'element " + (i + 1), text: "✕" });
          del.addEventListener("click", function(){ obj[f.k].splice(i, 1); render(); onChange(); });
          row.appendChild(del);
          list.appendChild(row);
        });
      };
      render();
      var add = el("button", { class: "ghost-btn", type: "button", text: "+ " + (f.add || "Afegeix") });
      add.addEventListener("click", function(){ obj[f.k].push(blankObject(f.fields)); render(); onChange(); });
      wrap.appendChild(list); wrap.appendChild(add);
      return wrap;
    } else {
      if (f.t === "long" || f.t === "list"){
        input = el("textarea", { class: "field", id: id, rows: f.t === "list" ? "3" : "3" });
        input.value = f.t === "list" ? (obj[f.k] || []).join("\n") : obj[f.k] || "";
      } else if (f.t === "choice"){
        input = el("select", { class: "field", id: id });
        f.options.forEach(function(o){ input.appendChild(el("option", { value: o, text: o })); });
        input.value = obj[f.k];
      } else {
        input = el("input", { class: "field", id: id, type: f.t === "number" || f.t === "index1" ? "number" : "text" });
        if (f.t === "number" || f.t === "index1") input.min = "1";
        input.value = f.t === "index1" ? Number(obj[f.k] || 0) + 1 : (obj[f.k] == null ? "" : obj[f.k]);
      }
      input.addEventListener("input", function(){
        var v = input.value;
        if (f.t === "list") obj[f.k] = v.split("\n");
        else if (f.t === "number") obj[f.k] = parseInt(v, 10) || 0;
        else if (f.t === "index1") obj[f.k] = (parseInt(v, 10) || 1) - 1;
        else obj[f.k] = v;
        onChange();
      });
      if (f.t === "choice") input.addEventListener("change", function(){ obj[f.k] = input.value; onChange(); });
      wrap.appendChild(label); wrap.appendChild(input);
    }
    if (f.h) wrap.appendChild(el("p", { class: "field-note", text: f.h }));
    return wrap;
  }

  function itemCard(name, index){
    var s = SCHEMA[name], items = bank(name).items;
    var card = el("div", { class: "ed-item" });
    var head = el("div", { class: "ed-item-head" }, [el("span", { class: "ed-num", text: "Exemple " + (index + 1) })]);
    var del = el("button", { class: "link-btn", type: "button", text: "Elimina" });
    del.addEventListener("click", function(){
      items.splice(index, 1); setDirty(true); renderBank();
    });
    head.appendChild(del);
    card.appendChild(head);
    var msg = el("p", { class: "ed-error", role: "status" });
    var check = function(){
      var e = validate(name, items[index]);
      msg.textContent = e ? "⚠ " + e : "";
      card.classList.toggle("invalid", !!e);
    };
    var changed = function(){ setDirty(true); check(); updateNav(); };
    var body = el("div", { class: "ed-fields" });
    if (s.item === "text" || s.item === "long"){
      var holder = { v: items[index] };
      body.appendChild(fieldControl({ k: "v", t: s.item, l: s.item === "long" ? "Frase" : "Paraula" }, holder, function(){ items[index] = holder.v; changed(); }));
    } else if (s.item === "strings"){
      var h2 = { v: items[index] };
      body.appendChild(fieldControl({ k: "v", t: "list", l: "Paraules", h: s.itemHelp }, h2, function(){ items[index] = h2.v; changed(); }));
    } else {
      s.fields.forEach(function(f){ if (f.t !== "autoid") body.appendChild(fieldControl(f, items[index], changed)); });
    }
    card.appendChild(body);
    card.appendChild(msg);
    check();
    return card;
  }

  /* ---------------- Vista d'un banc ---------------- */
  function renderBank(){
    var s = SCHEMA[current], b = bank(current), defaults = DEFAULTS[current] || [];
    var view = document.getElementById("bankView");
    view.innerHTML = "";
    view.appendChild(el("div", { class: "ed-bank-head" }, [
      el("h2", { class: "section-title", text: s.label }),
      el("p", { class: "section-hint", text: "Es fa servir a: " + s.act + "." })
    ]));

    var modeRow = el("div", { class: "segmented ed-mode", role: "group", "aria-label": "Com es fan servir els exemples propis" });
    [["afegeix", "Afegeix-los als de l'app"], ["substitueix", "Fes servir només els meus"]].forEach(function(m){
      var btn = el("button", { type: "button", "aria-pressed": b.mode === m[0] ? "true" : "false", text: m[1] });
      btn.addEventListener("click", function(){ b.mode = m[0]; setDirty(true); renderBank(); updateNav(); });
      modeRow.appendChild(btn);
    });
    view.appendChild(modeRow);
    view.appendChild(el("p", { class: "field-note", text: b.mode === "substitueix" ?
      "Les activitats només faran servir els teus exemples d'aquest banc (si n'hi ha cap de vàlid)." :
      "L'app ja porta " + defaults.length + " exemples d'aquest banc; els teus s'hi sumaran." }));

    var list = el("div", { class: "ed-items" });
    b.items.forEach(function(_, i){ list.appendChild(itemCard(current, i)); });
    if (!b.items.length) list.appendChild(el("p", { class: "section-hint ed-empty", text: "Encara no hi has afegit cap exemple propi." }));
    view.appendChild(list);

    var actions = el("div", { class: "reader-toolbar" });
    var add = el("button", { class: "play-btn", type: "button", text: "+ Afegeix un exemple" });
    add.addEventListener("click", function(){
      b.items.push(blankItem(current)); setDirty(true); renderBank(); updateNav();
      var cards = document.querySelectorAll(".ed-item");
      var last = cards[cards.length - 1];
      if (last){ last.scrollIntoView({ block: "center", behavior: "smooth" }); var f = last.querySelector("input, textarea, select"); if (f) f.focus({ preventScroll: true }); }
    });
    actions.appendChild(add);
    view.appendChild(actions);

    if (s.item === "text" || s.item === "long"){
      var bulk = el("details", { class: "ed-bulk" });
      bulk.appendChild(el("summary", { text: "Afegeix-ne diversos de cop" }));
      var ta = el("textarea", { class: "field", rows: "5", placeholder: "Un per línia" });
      var go = el("button", { class: "ghost-btn", type: "button", text: "Afegeix-los" });
      go.addEventListener("click", function(){
        var lines = ta.value.split("\n").map(function(x){ return x.trim(); }).filter(Boolean);
        if (!lines.length) return;
        b.items = b.items.concat(lines); setDirty(true); renderBank(); updateNav();
      });
      bulk.appendChild(ta); bulk.appendChild(el("div", { class: "reader-toolbar" }, [go]));
      view.appendChild(bulk);
    }

    var det = el("details", { class: "ed-defaults" });
    det.appendChild(el("summary", { text: "Exemples que ja porta l'app (" + defaults.length + ")" }));
    var ul = el("ul", { class: "ed-default-list" });
    defaults.forEach(function(d){
      var li = el("li", {}, [el("span", { text: labelOf(current, d) })]);
      var copy = el("button", { class: "link-btn", type: "button", text: "Copia per editar" });
      copy.addEventListener("click", function(){
        var c = JSON.parse(JSON.stringify(d));
        if (c && typeof c === "object" && !Array.isArray(c)){
          if (c.sentence) c.sentence = c.sentence.replace(/<[^>]+>/g, "");
          SCHEMA[current].fields.forEach(function(f){ if (f.t === "autoid") c[f.k] = uid(); });
        }
        b.items.push(c); setDirty(true); renderBank(); updateNav();
      });
      li.appendChild(copy);
      ul.appendChild(li);
    });
    det.appendChild(ul);
    view.appendChild(det);
  }

  /* ---------------- Navegació entre bancs ---------------- */
  function updateNav(){
    var sel = document.getElementById("bankSelect");
    Array.prototype.forEach.call(sel.options, function(o){
      var n = ownCount(o.value), inv = pack.bancs[o.value] ? pack.bancs[o.value].items.filter(function(it){ return validate(o.value, it); }).length : 0;
      o.textContent = SCHEMA[o.value].label + " — " + (DEFAULTS[o.value] || []).length + " de l'app" + (n ? " + " + n + " propis" : "") + (inv ? " (⚠ " + inv + ")" : "");
    });
    var total = Object.keys(pack.bancs).reduce(function(s, k){ return s + pack.bancs[k].items.length; }, 0);
    document.getElementById("ownTotal").textContent = total ? total + " exemples propis en total." : "Encara no hi ha cap exemple propi.";
  }
  function buildNav(){
    var sel = document.getElementById("bankSelect");
    sel.innerHTML = "";
    GROUP_ORDER.forEach(function(g){
      var og = el("optgroup", { label: g });
      Object.keys(SCHEMA).filter(function(k){ return SCHEMA[k].group === g; }).forEach(function(k){
        og.appendChild(el("option", { value: k, text: SCHEMA[k].label }));
      });
      sel.appendChild(og);
    });
    sel.value = current;
    sel.addEventListener("change", function(){ current = sel.value; renderBank(); window.scrollTo({ top: document.getElementById("bankView").offsetTop - 80 }); });
    updateNav();
  }

  /* ---------------- Desar, exportar, importar ---------------- */
  function cleanPack(){
    var out = emptyPack();
    out.titol = document.getElementById("packTitle").value.trim();
    out.autor = document.getElementById("packAuthor").value.trim();
    out.actualitzat = new Date().toISOString().slice(0, 10);
    var errors = [];
    Object.keys(pack.bancs).forEach(function(name){
      var b = pack.bancs[name];
      var items = b.items.map(function(it){ return tidy(name, it); });
      b.items.forEach(function(it, i){ var e = validate(name, it); if (e) errors.push(SCHEMA[name].label + ", exemple " + (i + 1) + ": " + e); });
      if (items.length || b.mode === "substitueix") out.bancs[name] = { mode: b.mode, items: items };
    });
    return { pack: out, errors: errors };
  }
  function status(msg, bad){
    var s = document.getElementById("edStatus");
    s.textContent = msg; s.classList.toggle("bad", !!bad);
  }
  function save(){
    var r = cleanPack();
    if (r.errors.length){
      status("No s'ha desat: hi ha " + r.errors.length + " exemple(s) amb errors. " + r.errors.slice(0, 3).join(" · ") + (r.errors.length > 3 ? " …" : ""), true);
      return false;
    }
    if (!C.saveLocalPack(r.pack)){ status("No s'ha pogut desar (l'emmagatzematge del navegador és ple o està bloquejat).", true); return false; }
    pack.actualitzat = r.pack.actualitzat;
    setDirty(false);
    status("Desat. L'app farà servir aquests exemples en aquest dispositiu la propera vegada que s'obri.");
    return true;
  }
  function exportPack(){
    var r = cleanPack();
    if (r.errors.length){ status("Abans d'exportar, corregeix els exemples amb errors: " + r.errors.slice(0, 3).join(" · "), true); return; }
    var text = JSON.stringify(r.pack, null, 2);
    if (window.AndroidBridge && window.AndroidBridge.saveFile){ window.AndroidBridge.saveFile("contingut.json", "application/json", text); }
    else {
      var url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      var a = el("a", { href: url, download: "contingut.json" }); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    }
    status("Fitxer contingut.json exportat.");
  }
  function mergePack(p, label){
    var incoming = normalisePack(p);
    if (!incoming){ status("Aquest fitxer no és un paquet de contingut de Lletra Amiga.", true); return; }
    var n = 0;
    Object.keys(incoming.bancs).forEach(function(name){
      var b = bank(name);
      b.items = b.items.concat(incoming.bancs[name].items);
      if (incoming.bancs[name].mode === "substitueix") b.mode = "substitueix";
      n += incoming.bancs[name].items.length;
    });
    if (!document.getElementById("packTitle").value && incoming.titol) document.getElementById("packTitle").value = incoming.titol;
    if (!document.getElementById("packAuthor").value && incoming.autor) document.getElementById("packAuthor").value = incoming.autor;
    setDirty(true); renderBank(); updateNav();
    status("S'han afegit " + n + " exemples de " + label + ". Revisa'ls i prem «Desa en aquest dispositiu».");
  }

  function init(){
    document.getElementById("packTitle").value = pack.titol;
    document.getElementById("packAuthor").value = pack.autor;
    ["packTitle", "packAuthor"].forEach(function(id){ document.getElementById(id).addEventListener("input", function(){ setDirty(true); }); });
    buildNav();
    renderBank();

    document.getElementById("saveBtn").addEventListener("click", save);
    document.getElementById("exportBtn").addEventListener("click", exportPack);
    var file = document.getElementById("importFile");
    document.getElementById("importBtn").addEventListener("click", function(){ file.click(); });
    file.addEventListener("change", function(){
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function(){
        try{ mergePack(JSON.parse(reader.result), "«" + f.name + "»"); }
        catch(e){ status("No s'ha pogut llegir el fitxer: no és un JSON vàlid.", true); }
        file.value = "";
      };
      reader.readAsText(f);
    });
    document.getElementById("loadUrlBtn").addEventListener("click", function(){
      var url = document.getElementById("loadUrl").value.trim();
      if (!url) return;
      status("Baixant…");
      C.fetchPack(url).then(function(p){ mergePack(p, "l'adreça"); })
        .catch(function(e){ status("No s'ha pogut baixar: " + (e.message || e) + ". Comprova l'adreça i que el servidor permeti l'accés (CORS).", true); });
    });
    document.getElementById("clearBtn").addEventListener("click", function(){
      if (!confirm("Segur que vols esborrar tots els exemples propis d'aquest dispositiu? Els de l'app es mantenen.")) return;
      pack = emptyPack(); C.clearLocalPack();
      document.getElementById("packTitle").value = ""; document.getElementById("packAuthor").value = "";
      setDirty(false); renderBank(); updateNav();
      status("S'han esborrat els exemples propis d'aquest dispositiu.");
    });
    document.getElementById("loadUrl").value = C.getUrl();

    window.addEventListener("beforeunload", function(e){ if (dirty){ e.preventDefault(); e.returnValue = ""; } });
    var back = document.getElementById("backToApp");
    back.addEventListener("click", function(e){
      if (dirty && !confirm("Tens canvis sense desar. Vols sortir igualment?")){ e.preventDefault(); return; }
      dirty = false;
      // Si s'hi ha arribat des de l'app, es torna enrere (l'app es recarrega amb el contingut nou).
      if (document.referrer && /\/index\.html$|\/$/.test(document.referrer.split(/[?#]/)[0]) && history.length > 1){
        e.preventDefault();
        sessionStorage.setItem("lletraAmiga-contingut.reload", "1");
        history.back();
      }
    });
  }

  init();
})();
