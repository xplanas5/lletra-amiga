/* Lletra Amiga — comptes i sincronització amb el núvol (Supabase).

   Capa independent d'app.js: treballa sobre les claus lletraAmiga.* del localStorage,
   que continua sent la font de dades de l'app. Sense configuració no fa res i l'app
   funciona en mode local, exactament com abans.

   Model de sincronització:
   - Cada perfil d'aprenent és una fila de la taula learner_profiles.
   - Primer inici de sessió en un dispositiu: si el compte és buit, es pugen els perfils
     locals (migració); si ja té perfils, es baixen i s'hi afegeixen els locals amb activitat.
   - Després, cada canvi local (esdeveniment "lletra:canvi" d'app.js) es puja al cap d'uns segons.
   - En obrir l'app, es baixen els perfils que han canviat en un altre dispositiu.
   - Conflictes: guanya el canvi més recent de cada perfil. */
(function(){
  "use strict";

  var PROFILES_KEY = "lletraAmiga.profiles.v1";
  var SETTINGS_PREFIX = "lletraAmiga.settings.v1:";
  var PROGRESS_PREFIX = "lletraAmiga.progress.v1:";
  var SYNC_KEY = "lletraAmiga.sync.v1";
  var RELOAD_GUARD_KEY = "lletraAmiga.syncReload";
  var TABLE = "learner_profiles";
  var SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  var PUSH_DELAY_MS = 2000;

  /* ---------------- Utilitats de localStorage ---------------- */
  function readJSON(key, fallback){
    try{ var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }catch(e){ return fallback; }
  }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} }
  function removeProfileData(id){
    try{ localStorage.removeItem(SETTINGS_PREFIX + id); localStorage.removeItem(PROGRESS_PREFIX + id); }catch(e){}
  }
  function localProfiles(){ return readJSON(PROFILES_KEY, []); }
  function hasActivity(id){
    var p = readJSON(PROGRESS_PREFIX + id, null);
    return !!p && ((p.daily && Object.keys(p.daily).length > 0) || (p.selfEval && p.selfEval.length > 0));
  }
  function time(iso){ return iso ? Date.parse(iso) : 0; }

  /* Estat de sincronització d'aquest dispositiu:
     userId  — compte amb què s'ha sincronitzat
     rows    — {idPerfil: updated_at del servidor a l'última sincronització}
     dirty   — {idPerfil: moment del darrer canvi local pendent de pujar}
     deleted — perfils esborrats localment pendents d'esborrar al núvol */
  function emptySync(userId){ return { userId: userId || null, rows: {}, dirty: {}, deleted: [] }; }
  var sync = Object.assign(emptySync(), readJSON(SYNC_KEY, {}));
  function saveSync(){ writeJSON(SYNC_KEY, sync); }

  /* ---------------- Seguiment de canvis (s'activa abans que app.js) ---------------- */
  var client = null, user = null, ready = false, pushing = false, pushTimer = null;

  document.addEventListener("lletra:canvi", function(e){
    var now = new Date().toISOString();
    var list = localProfiles();
    var profileId = e.detail && e.detail.profileId;
    if (profileId){
      sync.dirty[profileId] = now;
    } else {
      // Canvi a la llista (afegir, reanomenar o esborrar perfils): els perfils que ja no hi són
      // s'esborraran del núvol, i la resta es marquen perquè es pugi el nom actual.
      var current = {};
      list.forEach(function(p){ current[p.id] = true; });
      Object.keys(sync.rows).concat(Object.keys(sync.dirty)).forEach(function(id){
        if (current[id]) return;
        if (sync.rows[id] && sync.deleted.indexOf(id) < 0) sync.deleted.push(id);
        delete sync.rows[id]; delete sync.dirty[id];
      });
      list.forEach(function(p){ sync.dirty[p.id] = now; });
    }
    saveSync();
    schedulePush();
  });

  var cfg = window.LLETRA_CONFIG || {};
  var isLocalhost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  /* ---------------- Interfície ---------------- */
  var el = {};
  function $(id){ return document.getElementById(id); }

  function setStatus(text, isError){
    if (!el.status) return;
    el.status.textContent = text || "";
    el.status.style.color = isError ? "var(--warning)" : "";
  }
  function setSyncState(text){ if (el.syncState) el.syncState.textContent = text; }

  function renderAccount(){
    el.openBtn.hidden = false;
    el.label.textContent = user ? "Compte" : "Inicia sessió";
    el.signedOut.hidden = !!user;
    el.signedIn.hidden = !user;
    if (user) el.email.textContent = user.email || "";
    el.google.hidden = !cfg.googleLogin;
  }

  function wireUI(){
    el.openBtn = $("openAccount");
    el.label = $("accountLabel");
    el.backdrop = $("accountBackdrop");
    el.signedOut = $("accountSignedOut");
    el.signedIn = $("accountSignedIn");
    el.emailInput = $("accountEmail");
    el.adult = $("accountAdult");
    el.send = $("accountSend");
    el.google = $("accountGoogle");
    el.email = $("accountUserEmail");
    el.syncState = $("accountSyncState");
    el.syncNow = $("accountSyncNow");
    el.signOut = $("accountSignOut");
    el.status = $("accountStatus");

    el.openBtn.addEventListener("click", function(){ el.backdrop.hidden = false; });
    $("closeAccount").addEventListener("click", function(){ el.backdrop.hidden = true; });
    el.backdrop.addEventListener("click", function(e){ if (e.target === el.backdrop) el.backdrop.hidden = true; });
    el.send.addEventListener("click", sendMagicLink);
    el.emailInput.addEventListener("keydown", function(e){ if (e.key === "Enter") sendMagicLink(); });
    el.google.addEventListener("click", signInWithGoogle);
    el.syncNow.addEventListener("click", function(){ fullSync(true); });
    el.signOut.addEventListener("click", signOut);
    renderAccount();
  }

  /* ---------------- Autenticació ---------------- */
  function redirectUrl(){ return location.origin + location.pathname; }

  function checkAdult(){
    if (el.adult.checked) return true;
    setStatus("Cal confirmar que ets una persona adulta. Els infants fan servir perfils dins del compte d'un adult.", true);
    el.adult.focus();
    return false;
  }

  async function sendMagicLink(){
    var email = el.emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ setStatus("Escriu una adreça de correu vàlida.", true); return; }
    if (!checkAdult() || !client) return;
    el.send.disabled = true;
    setStatus("Enviant l'enllaç…");
    var res = await client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirectUrl() } });
    el.send.disabled = false;
    if (res.error){ setStatus("No s'ha pogut enviar l'enllaç: " + res.error.message, true); return; }
    setStatus("T'hem enviat un enllaç a " + email + ". Obre'l des d'aquest mateix dispositiu per entrar.");
  }

  async function signInWithGoogle(){
    if (!checkAdult() || !client) return;
    var res = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUrl() } });
    if (res.error) setStatus("No s'ha pogut iniciar la sessió amb Google: " + res.error.message, true);
  }

  async function signOut(){
    var pending = Object.keys(sync.dirty).length > 0 || sync.deleted.length > 0;
    if (pending) await push();
    pending = Object.keys(sync.dirty).length > 0 || sync.deleted.length > 0;
    var msg = pending
      ? "Hi ha canvis que encara no s'han pogut desar al núvol i es perdran. Vols tancar la sessió igualment?"
      : "Es tancarà la sessió i s'esborraran d'aquest dispositiu els perfils i el progrés (continuen desats al teu compte). Vols continuar?";
    if (!confirm(msg)) return;
    await client.auth.signOut();
    try{
      Object.keys(localStorage).forEach(function(k){ if (k.indexOf("lletraAmiga.") === 0) localStorage.removeItem(k); });
    }catch(e){}
    location.reload();
  }

  function onAuthChange(session){
    var next = session ? session.user : null;
    if (next && (!user || user.id !== next.id)){
      user = next;
      renderAccount();
      fullSync(false);
    } else if (!next && user){
      user = null; ready = false;
      renderAccount();
    }
  }

  /* ---------------- Sincronització ---------------- */
  async function fullSync(manual){
    if (!client || !user) return;
    setSyncState("Sincronitzant…");
    try{
      var res = await client.from(TABLE).select("id,name,settings,progress,updated_at");
      if (res.error) throw res.error;
      var cloud = res.data || [];
      var cloudById = {};
      cloud.forEach(function(r){ cloudById[r.id] = r; });

      var list = localProfiles();
      var changed = false;
      var now = new Date().toISOString();

      if (sync.userId !== user.id){
        // Primer cop d'aquest compte en aquest dispositiu.
        sync = emptySync(user.id);
        if (!cloud.length){
          list.forEach(function(p){ sync.dirty[p.id] = now; }); // migració del localStorage
        } else {
          list = list.filter(function(p){
            if (cloudById[p.id] || hasActivity(p.id)){ if (!cloudById[p.id]) sync.dirty[p.id] = now; return true; }
            removeProfileData(p.id); changed = true; return false; // perfil buit per defecte
          });
        }
      }

      // Perfils esborrats en un altre dispositiu.
      list = list.filter(function(p){
        if (!cloudById[p.id] && sync.rows[p.id] && !sync.dirty[p.id]){
          removeProfileData(p.id); delete sync.rows[p.id]; changed = true; return false;
        }
        return true;
      });

      // Baixa els perfils que han canviat al núvol.
      var byId = {};
      list.forEach(function(p){ byId[p.id] = p; });
      cloud.forEach(function(r){
        if (sync.deleted.indexOf(r.id) >= 0) return;
        var localChange = sync.dirty[r.id];
        if (localChange && time(localChange) >= time(r.updated_at)) return; // guanya el local
        if (!localChange && sync.rows[r.id] === r.updated_at) return;        // sense canvis
        writeJSON(SETTINGS_PREFIX + r.id, r.settings || {});
        writeJSON(PROGRESS_PREFIX + r.id, r.progress || {});
        if (byId[r.id]) byId[r.id].name = r.name;
        else { byId[r.id] = { id: r.id, name: r.name }; list.push(byId[r.id]); }
        sync.rows[r.id] = r.updated_at;
        delete sync.dirty[r.id];
        changed = true;
      });

      saveSync();
      if (changed){
        writeJSON(PROFILES_KEY, list);
        if (reloadAllowed()){ location.reload(); return; }
      }
      ready = true;
      await push();
      setSyncState("Tot desat al núvol.");
      if (manual) setStatus("");
    }catch(err){
      setSyncState("No s'ha pogut sincronitzar. Es tornarà a provar quan hi hagi connexió.");
      if (manual) setStatus(err.message || String(err), true);
    }
  }

  // Evita bucles de recàrrega si el localStorage no es pot escriure.
  function reloadAllowed(){
    try{
      var last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
      if (Date.now() - last < 10000) return false;
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    }catch(e){ return false; }
    return true;
  }

  function schedulePush(){
    if (!ready || !user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, PUSH_DELAY_MS);
  }

  async function push(){
    if (!ready || !user || !client || pushing) return;
    var dirtyIds = Object.keys(sync.dirty);
    var toDelete = sync.deleted.slice();
    if (!dirtyIds.length && !toDelete.length) return;
    pushing = true;
    setSyncState("Desant al núvol…");
    try{
      var list = localProfiles();
      var snapshot = Object.assign({}, sync.dirty);
      var rows = list.filter(function(p){ return snapshot[p.id]; }).map(function(p){
        return {
          owner: user.id, id: p.id, name: String(p.name || "Perfil").slice(0, 60),
          settings: readJSON(SETTINGS_PREFIX + p.id, {}),
          progress: readJSON(PROGRESS_PREFIX + p.id, {})
        };
      });
      if (rows.length){
        var up = await client.from(TABLE).upsert(rows, { onConflict: "owner,id" }).select("id,updated_at");
        if (up.error) throw up.error;
        (up.data || []).forEach(function(r){
          sync.rows[r.id] = r.updated_at;
          if (sync.dirty[r.id] === snapshot[r.id]) delete sync.dirty[r.id]; // no ha canviat mentre pujava
        });
      }
      // Ids marcats però que ja no existeixen localment.
      Object.keys(sync.dirty).forEach(function(id){
        if (!list.some(function(p){ return p.id === id; })) delete sync.dirty[id];
      });
      if (toDelete.length){
        var del = await client.from(TABLE).delete().in("id", toDelete);
        if (del.error) throw del.error;
        sync.deleted = sync.deleted.filter(function(id){ return toDelete.indexOf(id) < 0; });
      }
      saveSync();
      setSyncState("Tot desat al núvol.");
    }catch(err){
      saveSync();
      setSyncState("Sense connexió: els canvis es desaran quan es pugui.");
    }finally{
      pushing = false;
      if (Object.keys(sync.dirty).length && navigator.onLine !== false) schedulePush();
    }
  }

  window.addEventListener("online", function(){ if (ready) push(); else if (user) fullSync(false); });
  document.addEventListener("visibilitychange", function(){ if (document.visibilityState === "hidden") push(); });

  /* ---------------- Arrencada ---------------- */
  function loadScript(src){
    return new Promise(function(resolve, reject){
      var s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function start(){
    if (isLocalhost){
      try{ await loadScript("js/config.local.js"); cfg = window.LLETRA_CONFIG || cfg; }catch(e){}
    }
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return; // mode local
    wireUI();
    try{
      await loadScript(SUPABASE_JS);
    }catch(e){
      setSyncState("No s'ha pogut connectar amb el servei de comptes.");
      return;
    }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    // No es fan crides a Supabase dins del callback (recomanació de supabase-js).
    client.auth.onAuthStateChange(function(event, session){
      setTimeout(function(){ onAuthChange(session); }, 0);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
