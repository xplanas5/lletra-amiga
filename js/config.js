/* Configuració de Lletra Amiga.
   En publicar, GitHub Actions regenera aquest fitxer amb els Secrets del repositori
   (SUPABASE_URL i SUPABASE_ANON_KEY). Amb els valors buits, l'app funciona en mode local.
   Per provar el núvol en local, crea js/config.local.js (no es puja a git) amb:
     window.LLETRA_CONFIG = { supabaseUrl: "...", supabaseAnonKey: "...", googleLogin: false }; */
window.LLETRA_CONFIG = window.LLETRA_CONFIG || {
  supabaseUrl: "",
  supabaseAnonKey: "",
  googleLogin: false
};
