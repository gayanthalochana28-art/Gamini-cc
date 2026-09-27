/* =================================================================
   SRI GAMINI CENTRAL COLLEGE — backend configuration
   ------------------------------------------------------------------
   This is the ONLY file you edit to connect a real Firebase project.
   Nothing else in the codebase changes.

   HOW TO GO LIVE
     1. Create a project at https://console.firebase.google.com
     2. Add a "Web app" and copy the firebaseConfig object it shows.
     3. Paste those seven string values into `config` below.
     4. Set `enabled: true`.
     5. Turn on Authentication → Sign-in method → Email/Password.
     6. Create a Cloud Firestore database — the console offers a test mode
        first; choose PRODUCTION mode and a region close to Sri Lanka
        (asia-south1, Mumbai). Create the Storage bucket in the same region:
        photographs and attachments are uploaded there. Then deploy
        firestore.rules AND storage.rules — nothing is private until you do.
     7. Create the first administrator with bootstrapAdminId below, then
        clear it again.
     (Full walkthrough: README → "Connecting a real backend".)

   Until you do all of that, `enabled` stays false and the whole site
   runs on the offline localStorage demo exactly as before. When it is
   false this file loads instantly and touches the network zero times,
   so there are no console errors and file:// keeps working.

   IMPORTANT
     • These client keys are NOT secrets — a Firebase web API key is
       public by design and is only safe because firestore.rules decide
       what each request may read or write. Deploy those rules.
     • Live mode must be served over http(s) (hosting, Live Server, or
       any web server). The Firebase SDK is loaded as an ES module from
       Google's CDN, which browsers block on the file:// origin.
   ================================================================= */
(function (global) {
  'use strict';

  global.SGC_FIREBASE = {
    /* Flip to true once the seven values below are your real ones. */
    enabled: false,

    /* Firebase console → Project settings → Your apps → SDK setup and
       configuration (Config). Copy the seven values from that dialog into
       the matching lines below and delete the REPLACE_ text.
       These are project identifiers, not secrets — a web API key identifies
       the project, it does not authorise a request. firestore.rules is what
       decides what any visitor may read or write, and until that file is
       deployed keep `enabled` false. Nothing here is printed on the website. */
    config: {
      apiKey: 'REPLACE_WITH_apiKey',
      authDomain: 'REPLACE_WITH_projectId.firebaseapp.com',
      projectId: 'REPLACE_WITH_projectId',
      storageBucket: 'REPLACE_WITH_projectId.appspot.com',
      messagingSenderId: 'REPLACE_WITH_messagingSenderId',
      appId: 'REPLACE_WITH_appId',
      measurementId: 'REPLACE_WITH_measurementId',
    },

    /* Firebase Auth needs an e-mail; the college identifies people by
       ID instead, so an ID is turned into a synthetic address here.
       "S001" becomes "S001@<emailDomain>". Keep this stable — changing
       the domain later orphans every existing account — and keep it
       identical to ourDomain() in firestore.rules, which checks it. */
    emailDomain: 'sgcc.sch.lk',

    /* Google Sheets is used ONLY to import the student/teacher roster.
       Leave blank to import by pasting CSV in the admin console (the
       safer default — no sheet has to be shared publicly). Set this to
       a sheet published as a CSV URL only if you understand that the
       link can be read by anyone who has it, and revoke it afterwards.

       Use File → Share → Publish to the web → CSV, which gives a
       .../spreadsheets/d/e/<id>/pub?output=csv link. An ordinary
       .../export?format=csv link will NOT work here: it asks the browser
       to send your Google sign-in cookie, which the sheet's host refuses,
       so the fetch fails. Import by pasting instead if that happens. */
    rosterCsvUrl: '',

    /* Firebase JS SDK version pulled from the CDN when enabled. */
    sdkVersion: '10.12.5',

    /* First-run bootstrap. An empty Firestore has no administrator, so the
       rules would refuse to create one. Set this to ONE private Staff ID
       (e.g. "ADM01"), deploy firestore.rules with the same ID in its
       bootstrapId() line, then open
           student-signup.html?role=staff
       and register that account — it is the only registration made Active
       without approval. Sign in once from the Administrator tab, change
       this back to '', delete the bootstrapId() lines from firestore.rules
       and redeploy. Leave it '' the rest of the time. */
    bootstrapAdminId: '',
  };

  /* A config is "real" only when enabled is true AND the placeholders
     have been replaced. This keeps a half-filled file from trying to
     reach a non-existent project and throwing. */
  global.SGC_FIREBASE.isConfigured = function () {
    var f = global.SGC_FIREBASE;
    return !!f.enabled &&
      f.config && f.config.apiKey &&
      !/^REPLACE/.test(f.config.apiKey) &&
      !/^REPLACE/.test(f.config.projectId);
  };
})(window);
