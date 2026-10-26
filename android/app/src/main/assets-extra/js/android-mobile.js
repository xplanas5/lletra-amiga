/* Adaptació a mòbil — només s'inclou a l'APK (no a la web).
   Es carrega després de js/app.js: compacta la capçalera i gestiona el botó «enrere» d'Android. */
(function(){
  var root = document.documentElement;
  root.classList.add("android-app");

  /* La navegació es fa des de la pantalla d'Inici (js/app.js): les pestanyes queden amagades. */
  var tabButtons = document.querySelectorAll("#mainTabs .tab-btn");

  /* ---- Capçalera: botons només amb icona ---- */
  function iconOnly(id, icon, label){
    var b = document.getElementById(id);
    if (!b) return;
    b.textContent = icon;
    b.classList.add("icon-only");
    b.setAttribute("aria-label", label);
  }
  iconOnly("openSettings", "Aa", "Ajustos de lectura");
  iconOnly("openHelp", "?", "Ajuda");

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
      var current = document.querySelector('#coverProfiles [data-active="true"]');
      if (current) current.click();
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
    var home = tabButtons[0];   // Inici
    if (home && home.getAttribute("aria-selected") !== "true"){ home.click(); window.scrollTo(0, 0); return true; }
    return false;
  };
})();
