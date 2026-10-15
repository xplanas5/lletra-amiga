/* Adaptació a mòbil — només s'inclou a l'APK (no a la web).
   Es carrega després de js/app.js: reorganitza la capçalera, converteix les pestanyes
   en una barra de navegació inferior i gestiona el botó «enrere» d'Android. */
(function(){
  var root = document.documentElement;
  root.classList.add("android-app");

  /* ---- Navegació inferior amb icones ---- */
  var ICONS = {
    "panel-reader": "📖", "panel-fonologia": "👂", "panel-exercises": "🔤", "panel-dictation": "✏️",
    "panel-vocabulari": "💬", "panel-comprensio": "🧠", "panel-missions": "🎯", "panel-progress": "📈"
  };
  var tabs = document.getElementById("mainTabs");
  var tabButtons = tabs.querySelectorAll(".tab-btn");
  tabs.classList.add("bottom-nav");
  document.body.appendChild(tabs);   // es mou l'element: els escoltadors d'app.js es mantenen
  tabButtons.forEach(function(btn){
    var label = btn.textContent.trim();
    btn.textContent = "";
    var icon = document.createElement("span");
    icon.className = "tab-icon"; icon.setAttribute("aria-hidden", "true");
    icon.textContent = ICONS[btn.dataset.target] || "•";
    var text = document.createElement("span");
    text.className = "tab-label"; text.textContent = label;
    btn.appendChild(icon); btn.appendChild(text);
    btn.addEventListener("click", function(){
      window.scrollTo(0, 0);
      btn.scrollIntoView({ inline: "center", block: "nearest" });
    });
  });

  /* ---- Capçalera: botons només amb icona ---- */
  function iconOnly(id, icon, label){
    var b = document.getElementById(id);
    if (!b) return;
    b.textContent = icon;
    b.classList.add("icon-only");
    b.setAttribute("aria-label", label);
  }
  iconOnly("openSettings", "Aa", "Ajustos de lectura");

  /* ---- Amaga la navegació inferior mentre el teclat és obert ---- */
  function isTextField(el){
    if (!el) return false;
    if (el.tagName === "TEXTAREA" || el.isContentEditable) return true;
    if (el.tagName !== "INPUT") return false;
    return !/^(checkbox|radio|range|button|submit|reset|file|color)$/i.test(el.type);
  }
  document.addEventListener("focusin", function(e){ if (isTextField(e.target)) root.classList.add("kb-open"); });
  document.addEventListener("focusout", function(){
    setTimeout(function(){ if (!isTextField(document.activeElement)) root.classList.remove("kb-open"); }, 50);
  });

  /* ---- Botó «enrere» d'Android ----
     Retorna true si l'app l'ha gestionat; si retorna false, Android tanca l'app. */
  // Portada: en obrir l'app, «enrere» surt; si s'ha reobert des del logotip, la tanca.
  var coverReopened = false;
  var openCover = document.getElementById("openCover");
  if (openCover) openCover.addEventListener("click", function(){ coverReopened = true; });

  window.__androidBack = function(){
    var cover = document.getElementById("cover");
    if (cover && !cover.hidden){
      if (!coverReopened) return false;
      coverReopened = false;
      document.getElementById("coverStart").click();
      return true;
    }
    var open = Array.prototype.find.call(document.querySelectorAll(".drawer-backdrop"), function(b){ return !b.hidden; });
    if (open){
      var close = open.querySelector(".close-btn");
      if (close) close.click(); else open.hidden = true;
      return true;
    }
    var panel = document.querySelector('.panel[role="tabpanel"]:not([hidden])');
    if (panel){
      var detail = Array.prototype.find.call(panel.querySelectorAll('[id$="-detail"]'), function(d){ return !d.hidden; });
      if (detail){
        var back = detail.querySelector(".activity-back");
        if (back){ back.click(); return true; }
      }
    }
    var first = tabButtons[0];
    if (first && first.getAttribute("aria-selected") !== "true"){ first.click(); return true; }
    return false;
  };
})();
