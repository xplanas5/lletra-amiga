# Lletra Amiga

Eina web d'entrenament lector i ortogràfic per a persones amb dislèxia: lectura adaptada amb suport auditiu, activitats de fonologia, descodificació, ortografia, vocabulari i comprensió, missions i seguiment del progrés.

## Estructura

```
index.html                  Estructura de la pàgina (marcatge)
css/styles.css              Estils (tokens de color, tema clar/fosc, components)
editor.html                 Editor de contingut (afegir o substituir exemples)
js/banks.js                 Bancs d'exemples per defecte de totes les activitats
js/content.js               Carrega els bancs + contingut propi (editor, adreça web, contingut.json)
js/reports.js               Informes de treball (impressió/PDF i CSV)
js/editor.js, css/editor.css  Lògica i estils de l'editor
js/config.js                Configuració (claus de Supabase; buida = mode local)
js/cloud.js                 Comptes i sincronització amb el núvol (Supabase)
js/app.js                   Lògica de l'aplicació (dades, activitats, perfils, progrés)
supabase/migrations/        Esquema de la base de dades (SQL)
.github/workflows/          Publicació automàtica a GitHub Pages
original/index.html         Versió original en un sol fitxer (referència, no s'edita)
```

L'aplicació és estàtica: no necessita compilació ni dependències. Les dades es desen al `localStorage` del navegador (claus `lletraAmiga.*`). Si hi ha claus de Supabase configurades, `js/cloud.js` afegeix l'inici de sessió i sincronitza aquestes dades amb el compte.

## Executar en local

```
python -m http.server 8000
```

i obrir <http://localhost:8000>. Sense claus, l'app funciona en mode local.

Per provar el núvol en local, crea `js/config.local.js` (està a `.gitignore`, no es puja mai):

```js
window.LLETRA_CONFIG = { supabaseUrl: "https://XXXX.supabase.co", supabaseAnonKey: "eyJ...", googleLogin: false };
```

## Portada

En obrir l'app (web i APK) es mostra una portada amb les seccions i les eines. Cada targeta porta directament a la seva secció. Es pot desactivar amb «No mostris la portada en obrir l'app» i tornar-hi des del logotip «Ll» de la capçalera.

## Navegació

Cada categoria mostra d'entrada la llista de totes les seves activitats (a Lectura, el lector adaptat n'és la primera). Una activitat oberta ocupa la pantalla: s'amaguen les pestanyes i, per canviar d'activitat o de categoria, cal tornar enrere amb el botó «‹ Totes les activitats…» (o el botó enrere d'Android). Funciona igual a la web i a l'APK (`js/app.js`).

## Contingut: exemples i bancs

Els exemples de totes les activitats (paraules, frases, textos i preguntes) són a `js/banks.js`, unes 770 entrades repartides en 40 bancs. Cada perfil rep els exemples d'un banc com una baralla de cartes: no se'n repeteix cap fins que s'han vist tots (l'ordre es desa a `lletraAmiga.decks.v1:<perfil>`).

Per ampliar-los sense tocar el codi hi ha l'**editor de contingut** (`editor.html`, enllaçat des d'*Ajustos de lectura → Exemples i contingut*). Per a cada banc es poden afegir exemples als de l'app o substituir-los, amb validació (p. ex. la resposta correcta ha de ser una de les opcions). El resultat és un paquet JSON (`"format": "lletra-amiga-contingut"`) que:

- es pot **desar en el dispositiu** (l'app el fa servir en obrir-se);
- es pot **exportar/importar** com a fitxer `contingut.json`;
- es pot **publicar a una adreça web** (amb CORS, p. ex. GitHub Pages o un *gist* «raw») i posar l'adreça als ajustos de cada dispositiu: l'app en baixa les novetats cada vegada que s'obre i avisa quan n'hi ha;
- si es desa com a `contingut.json` a l'arrel del repositori, s'inclou automàticament a la web publicada i a l'APK.

Ordre d'aplicació: `contingut.json` publicat → adreça web → paquet del dispositiu. Els textos propis es netegen d'etiquetes HTML i els ítems invàlids es descarten.

## Gamificació

`js/game.js` afegeix elements de joc pensats per a la dislèxia: es premia l'esforç, l'error no resta mai, no hi ha límit de temps ni rànquings (cadascú es compara amb si mateix).

- **Punts i nivells**: cada exercici suma 3 punts per l'esforç i 7 més si s'encerta. Els nivells segueixen una metàfora de creixement (🌱 Llavor → 🌳 Arbre → 🌟 Constel·lació).
- **Ratxa diària** amb un comodí setmanal: un dia perdut cada 7 dies no la trenca.
- **Objectiu diari** (5, 10 o 20 exercicis, als ajustos): en arribar-hi, +20 punts.
- **Repte del dia**: una activitat triada per a cada perfil (primer el repàs pendent, després el que costa i després el que no s'ha provat). Superar-lo dona +30 punts.
- **26 insígnies**: constància, exercicis, una per àrea, «Aprenc dels errors» (encertar el que abans s'havia fallat), «Tastaolletes», «Repàs a temps»…
- **Avatars**: 12 d'inicials i 6 que es desbloquegen pujant de nivell.
- **Estrelles** (★★★) a cada targeta d'activitat segons el domini, i «✨ Nova» a les no provades.

Es veu a la capçalera (nivell, ratxa i objectiu; obre els assoliments), a la portada i a la targeta *Els teus assoliments* de *Progrés*. Les celebracions respecten «reduir moviment» i el so no sona mentre parla la veu. Als *Ajustos de lectura* es pot amagar tot (les dades es continuen desant) i treure el so. L'estat es desa a `progress.game` de cada perfil, de manera que es sincronitza amb el núvol; els perfils anteriors reben d'entrada els punts i les insígnies que corresponen a l'activitat que ja havien fet.

## Informes de treball

A la pestanya *Progrés*, el botó **Informe de treball** genera un informe per perfil i període (7 o 30 dies, 3 mesos, curs, tot o personalitzat) amb: resum (dies, exercicis, encerts, temps estimat), observacions automàtiques, resultats per àrees i per activitat, activitat diària, elements a reforçar (paraules i frases fallades), velocitat lectora, autoavaluació, repàs pendent i un camp d'observacions per al professional o la família. Amb diversos perfils hi ha també un **resum de grup**. Es pot imprimir o desar en PDF i baixar en CSV (separat per `;`, s'obre amb Excel). Els detalls depenen del registre d'activitat (`progress.log`), que comença amb aquesta versió; l'activitat anterior només surt en el recompte d'exercicis.

## App Android (APK)

La carpeta `android/` conté un projecte Android natiu que mostra l'app web en un WebView. Cada compilació copia `index.html`, `css/` i `js/` de l'arrel, de manera que només s'edita una còpia. Com que el WebView d'Android no té `speechSynthesis`, `android/app/src/main/assets-extra/js/android-tts.js` el substitueix i fa servir el motor de veu del sistema (`TtsBridge.java`). La maquetació per a mòbil (barra de navegació inferior, capçalera compacta, ajustos i perfils com a fulls inferiors, controls més grans, botó «enrere») és a `assets-extra/css/android.css` i `assets-extra/js/android-mobile.js`. Només s'injecten a l'`index.html` de l'APK en compilar, així que la web no canvia. Per tenir veu en català, cal la veu catalana de *Serveis de veu de Google* (o un altre motor) instal·lada al mòbil.

Compilar (cal JDK 17 i l'Android SDK):

```
cd android
./gradlew assembleDebug
```

L'APK queda a `android/app/build/outputs/apk/debug/app-debug.apk`. Per publicar-la a Google Play cal una versió *release* signada amb una clau pròpia (`./gradlew bundleRelease`).

A l'APK també hi ha l'editor; imprimir obre el diàleg del sistema (des d'on es pot desar en PDF) i els CSV i paquets exportats es desen a *Baixades* (Android 10 o posterior) i s'obre el menú per compartir-los (`AppBridge.java`).

L'app arrenca en mode local; l'inici de sessió per enllaç màgic encara no s'ha adaptat a l'app (caldria un *deep link*).

## Posada en marxa dels comptes (Fase 2)

### 1. Supabase (base de dades i comptes)
1. Crea un projecte a <https://supabase.com> a la regió **EU Central (Frankfurt)**.
2. **SQL Editor** → enganxa `supabase/migrations/20260923000000_learner_profiles.sql` → *Run*.
3. **Authentication → URL Configuration**:
   - *Site URL*: l'adreça pública (p. ex. `https://USUARI.github.io/lletra-amiga/`).
   - *Redirect URLs*: la mateixa adreça i `http://localhost:8000/`.
4. **Authentication → Emails**: tradueix al català la plantilla *Magic Link* (opcional però recomanat).
5. **Project Settings → API**: copia la *Project URL* i la clau **anon / publishable**.
   La clau **service_role / secret** no s'ha de posar mai a la web ni a GitHub Pages.

### 2. GitHub (codi, claus i publicació)
1. Crea un repositori i puja-hi el projecte (branca `main`).
2. **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_URL` — la Project URL
   - `SUPABASE_ANON_KEY` — la clau anon / publishable
   - (opcional) a la pestanya *Variables*: `GOOGLE_LOGIN` = `true` si actives Google a Supabase.
3. **Settings → Pages → Source: GitHub Actions**.
4. Cada `push` a `main` publica la web i genera `js/config.js` amb les claus dels Secrets.

### Com funciona la sincronització
- El compte el crea una persona adulta (enllaç màgic per correu, sense contrasenya). Els infants són **perfils dins del compte**, sense correu ni dades identificatives.
- Primer inici de sessió: si el compte és buit, es pugen els perfils locals (no es perd cap progrés); si ja en té, es baixen i s'hi afegeixen els locals que tinguin activitat.
- Cada canvi es desa al núvol al cap de 2 segons; sense connexió, es desa quan torna.
- Si el mateix perfil es modifica en dos dispositius alhora, guanya el canvi més recent.
- En tancar la sessió, les dades s'esborren del dispositiu (útil en ordinadors compartits) però continuen al compte.

## Full de ruta

El pla d'acció de monetització és un document intern i no es publica en aquest repositori.

- [x] **Fase 1** — Separar el fitxer únic en HTML, CSS i JS; control de versions.
- [x] **Fase 2 (codi)** — Comptes amb Supabase, sincronització i migració del `localStorage`.
- [ ] **Fase 2 (posada en marxa)** — Crear el projecte Supabase, els Secrets de GitHub i publicar.
- [ ] Política de privacitat i avís legal (enllaçats des del panell de compte).
- [ ] **Fase 3** — Subscripcions amb Stripe (o Paddle) i contingut premium servit des del backend.
- [ ] **Fase 4** — Pilot, pàgina per a centres i llicències B2B.
