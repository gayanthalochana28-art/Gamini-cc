/* =================================================================
   SRI GAMINI CENTRAL COLLEGE — Firebase backend layer
   ------------------------------------------------------------------
   This file turns the offline localStorage demo into a real, multi-user
   application WITHOUT rewriting a single page. It does three things:

     1. Loads the Firebase SDK only when js/firebase-config.js says it
        is configured. When it is not, nothing here runs, no network is
        touched, and the site behaves exactly as the pure demo. That is
        the "Firebase + demo fallback" behaviour.

     2. Hydrates the localStorage cache that SGC.db already reads, by
        pulling every collection from Cloud Firestore once at start-up.
        All the existing synchronous reads across the 20 pages keep
        working untouched.

     3. Provides the two swap points the rest of the app calls:
          • SGC.db write functions call .put/.remove/.putSettings so
            local edits are mirrored to Firestore (write-through).
          • SGC.auth.adapter calls .auth.verify/.setPassword/.signup so
            sign-in is real Firebase Authentication, not the demo table.

   SECURITY: the browser is NOT the access-control layer. firestore.rules
   (deployed to your project) decide what each user may read or write.
   The role checks here are for a good UX, nothing more.
   ================================================================= */
(function (global) {
  'use strict';

  const SGC = global.SGC = global.SGC || {};
  const CFG = global.SGC_FIREBASE || {};

  const state = {
    enabled: false,
    ready: false,    // true only once a pull has actually come back
    app: null,
    auth: null,
    fs: null,      // firestore handle
    st: null,      // cloud storage handle
    F: null,       // imported firebase namespaces
    me: null,      // the signed-in user's own schoolUsers row, when live
    writes: Promise.resolve(),
  };

  const COLLECTIONS = () => (SGC.db && SGC.db.COLLECTIONS) || [];

  /* "Live" means the server answered, not merely that a config was pasted.
     While an unreachable project is still retrying, every write-through hook
     and every login attempt stays on the demo path, so the site keeps working
     and never queues writes into a connection that may never resolve. */
  function live() { return state.enabled && state.ready; }

  function toast(msg, type) { try { SGC.utils.toast(msg, type || 'error', 5000); } catch (e) { /* ignore */ } }

  /* Firebase Auth keys accounts on e-mail; the college uses an ID.
     "S001" ⇄ "S001@sgcc.sch.lk". Keep the domain stable forever. */
  function emailFor(identifier) {
    return String(identifier || '').trim().toLowerCase() + '@' + (CFG.emailDomain || 'sgcc.sch.lk');
  }

  /* Firestore rejects `undefined` anywhere in a document. */
  function clean(v) {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') {
      const o = {};
      Object.keys(v).forEach((k) => { if (v[k] !== undefined) o[k] = clean(v[k]); });
      return o;
    }
    return v === undefined ? null : v;
  }

  function authErrorText(e) {
    const code = (e && e.code) || '';
    const map = {
      'auth/invalid-credential': 'Incorrect ID or password.',
      'auth/wrong-password': 'Incorrect ID or password.',
      'auth/user-not-found': 'No account is registered for that ID.',
      'auth/email-already-in-use': 'That ID is already registered. Sign in instead, or contact the office.',
      'auth/weak-password': 'Choose a password of at least 6 characters.',
      'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
      'auth/network-request-failed': 'Network unavailable. Check your connection.',
      'auth/popup-closed-by-user': 'Sign-in was cancelled.',
      'auth/operation-not-allowed': 'Email/password sign-in is switched off in this Firebase project. Enable it under Authentication → Sign-in method.',
      'auth/configuration-not-found': 'Authentication has not been set up in this Firebase project yet.',
      'auth/requires-recent-login': 'Please sign out and sign in again, then change the password.',
      'auth/invalid-email': 'That sign-in address is not valid. Check the ID you entered.',
    };
    /* Firebase's own messages name SDK internals and are written for the
       developer, not for a student at the sign-in form. Anything still
       unmapped is reported as its error code, which is safe to show and is
       what the office needs to quote when something is wrong. */
    if (map[code]) return map[code];
    if (code) return 'The server refused this request (' + code + ').';
    return (e && e.message) || 'Sign in failed.';
  }

  /* ---------------- start-up ---------------- */
  async function loadSdk() {
    const v = CFG.sdkVersion || '10.12.5';
    const base = 'https://www.gstatic.com/firebasejs/' + v + '/';
    const [app, auth, firestore, storage] = await Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-auth.js'),
      import(base + 'firebase-firestore.js'),
      import(base + 'firebase-storage.js'),
    ]);
    return { app, auth, firestore, storage };
  }

  /* Firebase restores the signed-in user asynchronously. Firestore reads that
     happen before that token exists are rejected by the rules, so boot must
     wait for it once. */
  function authReady() {
    const F = state.F;
    if (!state.auth || !F || !F.auth) return Promise.resolve(null);
    if (state.auth.currentUser) return Promise.resolve(state.auth.currentUser);
    return new Promise((resolve) => {
      const off = F.auth.onAuthStateChanged(state.auth, (u) => { off(); resolve(u || null); });
    });
  }

  async function boot() {
    if (!CFG.isConfigured || !CFG.isConfigured()) {
      /* Demo mode. If this device was showing a server last time, put the
         demonstration content back into the collections the server left blank. */
      SGC.db.repairAfterRemote();
      return { enabled: false };
    }
    const F = await loadSdk();
    state.F = F;
    state.app = F.app.initializeApp(CFG.config);
    state.auth = F.auth.getAuth(state.app);
    state.fs = F.firestore.getFirestore(state.app);
    /* Storage is optional: a project that has not switched it on still gets a
       working database, and an upload explains itself instead of breaking
       start-up. */
    try { state.st = F.storage.getStorage(state.app); } catch (e) { state.st = null; }
    state.enabled = true;
    await authReady();
    const pulled = await pullAll();
    /* Nothing at all came back: the project id is wrong, Firestore was never
       created, or the rules were not deployed. Staying "live" would leave a
       site with no content and no way in, so fall back to the demo instead. */
    if (!Object.keys(pulled.map || {}).length) {
      state.enabled = false;
      throw new Error('Firestore could not be read. Check the project id and that firestore.rules was deployed.');
    }
    state.ready = true;
    return { enabled: true, denied: pulled.denied };
  }

  /* Called from app.js boot(). Resolves immediately in demo mode. */
  function init() {
    return boot().catch((err) => {
      state.enabled = false;
      state.ready = false;
      try { SGC.db.repairAfterRemote(); } catch (e) { /* storage not ready */ }
      toast('Backend unavailable — running in local demo mode.', 'error');
      return { enabled: false, error: err };
    });
  }

  /* ---------------- read everything into the local cache ----------------
     Each collection is pulled independently. A visitor who is not signed in is
     refused the private collections by the security rules, and that is the
     expected, correct outcome — it must not be treated as a backend failure,
     or the live site would look broken to everyone who is not an administrator.

     Scope mirrors firestore.rules: an administrator reads whole tables, a
     teacher reads the academic tables, and a student reads only their own rows
     (plus the timetable of their own class). */
  /* Tables any visitor may read. Everything else is refused while signed out,
     so the pull does not even ask — a denied Firestore read logs to the
     console, and the public site must stay clean. */
  const PUBLIC_TABLES = ['schoolSettings', 'schoolClasses', 'schoolSubjects', 'schoolTeachers',
    'schoolNotices', 'schoolUpdates', 'schoolEvents', 'schoolGallery', 'schoolAchievements',
    'schoolDownloads'];

  /* Local-only: a per-device map of interface preferences, never server data. */
  const NEVER_REMOTE = ['schoolUserPrefs'];

  /* Tables that carry a draft state. Only an administrator is allowed to read
     unpublished work, so everyone else asks the server for the published set —
     an unfiltered read would be refused, and refused reads log to the console. */
  const DRAFTED = ['schoolNotices', 'schoolUpdates', 'schoolEvents'];

  async function pullAll() {
    if (!state.enabled) return {};
    const F = state.F, FS = F.firestore;
    const user = state.auth && state.auth.currentUser ? state.auth.currentUser : null;
    const uid = user ? user.uid : null;
    const me = uid ? await readMyDoc().catch(() => null) : null;
    state.me = me;
    const active = !!me && me.status === 'Active';
    const admin = active && me.role === 'admin';
    const staff = active && (admin || me.role === 'teacher');
    const myId = me ? String(me.identifier || '').trim() : null;

    const map = {}, denied = [];
    let myClassId = me && me.classId ? me.classId : '';

    for (const key of COLLECTIONS()) {
      try {
        if (NEVER_REMOTE.indexOf(key) !== -1) continue;
        if (!uid && PUBLIC_TABLES.indexOf(key) === -1) { denied.push(key); continue; }
        if (key === 'schoolSettings') {
          const snap = await FS.getDoc(FS.doc(state.fs, 'schoolSettings', 'settings'));
          if (snap.exists()) map[key] = snap.data();
          continue;
        }
        const coll = FS.collection(state.fs, key);
        let snaps;
        if (admin || staff) {
          snaps = [await FS.getDocs(coll)];
        } else if (key === 'schoolUsers') {
          snaps = [await FS.getDocs(FS.query(coll, FS.where('uid', '==', uid), FS.limit(1)))];
        } else if (key === 'schoolMessages') {
          snaps = await Promise.all([
            FS.getDocs(FS.query(coll, FS.where('to', 'in', [myId, 'all']))),
            FS.getDocs(FS.query(coll, FS.where('from', '==', myId))),
          ]);
        } else if (key === 'schoolStudents') {
          snaps = [await FS.getDocs(FS.query(coll, FS.where('studentId', '==', myId)))];
          const own = snaps[0].docs[0];
          if (own) myClassId = own.data().classId || myClassId;
        } else if (key === 'schoolAttendance' || key === 'schoolResults' || key === 'schoolSubmissions') {
          snaps = [await FS.getDocs(FS.query(coll, FS.where('studentId', '==', myId)))];
        } else if (key === 'schoolAssignments' || key === 'schoolTimetable') {
          snaps = myClassId ? [await FS.getDocs(FS.query(coll, FS.where('classId', '==', myClassId)))] : [[]];
        } else if (!admin && DRAFTED.indexOf(key) !== -1) {
          snaps = [await FS.getDocs(FS.query(coll, FS.where('published', '==', true)))];
        } else {
          snaps = [await FS.getDocs(coll)];
        }
        const seen = {}, rows = [];
        snaps.forEach((snap) => {
          if (!snap || !snap.docs) return;
          snap.docs.forEach((d) => {
            if (seen[d.id]) return;
            seen[d.id] = 1;
            rows.push(Object.assign({ id: d.id }, d.data()));
          });
        });
        map[key] = rows;
      } catch (e) {
        denied.push(key);
      }
    }
    SGC.db.loadRemote(map);
    return { map, denied };
  }

  /* ---------------- write-through (fire-and-forget, never throws) -------- */
  function enqueue(fn) {
    state.writes = state.writes.then(fn).catch(() => {
      toast('A change could not be saved to the server. It is kept on this device.');
    });
    return state.writes;
  }
  /* A person's own college ID is the document id for the two tables that a
     person can write themselves. Otherwise the row the office creates for a
     student and the row that student creates when they register from home
     would be two different documents, and the local demo ids the collections
     generate would leak into the server's keys. */
  function docIdOf(collection, record) {
    if (collection === 'schoolStudents' && record.studentId) return 'S-' + String(record.studentId).trim().toLowerCase();
    if (collection === 'schoolUsers' && record.identifier) return userDocId(record.identifier);
    return String(record.id);
  }
  function put(collection, record) {
    if (!state.enabled || !record || !record.id) return;
    const FS = state.F.firestore;
    const docId = docIdOf(collection, record);
    const data = clean(record);
    /* The offline demonstration stores its password in plain text on the
       sign-in row. Live sign-in is Firebase Authentication, so that field is
       both meaningless and unsafe to copy into a real project. */
    delete data.demoPassword;
    data.id = docId;
    const doc = FS.doc(state.fs, collection, docId);
    enqueue(() => FS.setDoc(doc, data, { merge: true }));
  }
  function remove(collection, record) {
    const id = record && typeof record === 'object' ? record.id : record;
    if (!state.enabled || !id) return;
    const FS = state.F.firestore;
    const docId = record && typeof record === 'object' ? docIdOf(collection, record) : String(id);
    const ref = FS.doc(state.fs, collection, docId);
    enqueue(() => FS.deleteDoc(ref));
  }
  /* ---------------- uploads (Cloud Storage) ----------------
     A photograph kept as a data URL inside a record spends most of
     Firestore's 1 MiB document allowance on one row, and four of them make the
     document unwritable. In live mode the bytes therefore go to the project's
     Storage bucket and the record keeps only the download URL. The offline
     demonstration has no bucket to talk to, so it keeps the data URL exactly
     as it always did. */
  const MAX_UPLOAD_MB = 8;

  function upload(scope, file) {
    if (!live()) return Promise.reject(new Error('No server is connected, so the file cannot be uploaded.'));
    if (!state.st) return Promise.reject(new Error('Cloud Storage is not switched on in this Firebase project.'));
    if (!file) return Promise.reject(new Error('No file was chosen.'));
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return Promise.reject(new Error('That file is larger than ' + MAX_UPLOAD_MB + ' MB.'));
    }
    const F = state.F;
    /* The name is kept for the human reading the console, and stripped of
       everything a path cannot carry. It is never trusted to be unique. */
    const safe = String(file.name || 'file').replace(/[^\w.+-]+/g, '-').slice(-56);
    const path = 'sgc/' + String(scope || 'misc').replace(/[^\w-]+/g, '').slice(0, 24) +
      '/' + SGC.utils.uid('f') + '-' + safe;
    const ref = F.storage.ref(state.st, path);
    return F.storage.uploadBytes(ref, file)
      .then(() => F.storage.getDownloadURL(ref));
  }

  function putSettings(obj) {
    if (!state.enabled) return;
    const FS = state.F.firestore;
    const ref = FS.doc(state.fs, 'schoolSettings', 'settings');
    const data = clean(obj);
    enqueue(() => FS.setDoc(ref, data));
  }

  /* ---------------- authentication ----------------
     The security rules only ever let a signed-in user read the one schoolUsers
     row that carries their own uid, and to read a row by its known id. Every
     lookup here is therefore a single get or a uid-filtered query — a query
     that lists the whole staff/roster table would be refused by design. */
  const userDocId = (identifier) => 'U-' + String(identifier || '').trim().toLowerCase();

  /* Every Firebase account this site creates is <ID>@<emailDomain>, so the
     signed-in user's own row is addressable without listing the table. */
  function myDocId() {
    const u = state.auth && state.auth.currentUser;
    const email = u && u.email ? String(u.email) : '';
    return 'U-' + email.split('@')[0].toLowerCase();
  }
  function readMyDoc() { return readUserByDoc(myDocId()); }

  async function readUserByDoc(id) {
    const FS = state.F.firestore;
    const snap = await FS.getDoc(FS.doc(state.fs, 'schoolUsers', String(id)));
    return snap.exists() ? Object.assign({ id: snap.id }, snap.data()) : null;
  }

  async function findUserByUid(uid) {
    const FS = state.F.firestore;
    const q = FS.query(
      FS.collection(state.fs, 'schoolUsers'),
      FS.where('uid', '==', uid),
      FS.limit(1),
    );
    const snap = await FS.getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return Object.assign({ id: d.id }, d.data());
  }

  async function verify(identifier, password, role) {
    if (!state.enabled) return { ok: false, error: 'Sign in is unavailable.' };
    const id = String(identifier || '').trim();
    const pw = String(password || '');
    if (!id || !pw) return { ok: false, error: 'Enter both your ID and password.' };
    const F = state.F;
    let cred;
    try {
      cred = await F.auth.signInWithEmailAndPassword(state.auth, emailFor(id), pw);
    } catch (e) {
      if (e && e.code === 'auth/user-not-found') {
        return { ok: false, error: id.toLowerCase().startsWith('s')
          ? 'No account exists for that Student ID yet. Register below and the office will approve it.'
          : 'No account is registered for that ID.' };
      }
      return { ok: false, error: authErrorText(e) };
    }
    const uid = cred.user.uid;
    let user = await readUserByDoc(userDocId(id)).catch(() => null);
    if (!user || !user.uid) user = await findUserByUid(uid).catch(() => null);
    if (!user) {
      await F.auth.signOut(state.auth);
      return { ok: false, error: 'No ' + role + ' record is linked to this account. Contact the office.' };
    }
    if (user.uid !== uid) {
      try { await F.firestore.updateDoc(F.firestore.doc(state.fs, 'schoolUsers', user.id), { uid }); }
      catch (e) { /* the rules may not allow it; sign-in still works */ }
    }
    if (user.status === 'Pending') {
      await F.auth.signOut(state.auth);
      return { ok: false, error: 'Your registration is awaiting approval by the college office.' };
    }
    if (user.status !== 'Active') {
      await F.auth.signOut(state.auth);
      return { ok: false, error: user.status === 'Rejected'
        ? 'The office could not approve this registration. Contact the college office.'
        : 'This account is inactive. Contact the office.' };
    }
    if (user.role !== role) {
      await F.auth.signOut(state.auth);
      return { ok: false, error: 'This account is not a ' + role + ' account. Use the matching tab above.' };
    }
    /* Now that a token exists the private collections are readable — refresh
       the local cache so the dashboards open with server data, not a stale
       copy from before sign-in. */
    await pullAll();
    try {
      await F.firestore.updateDoc(F.firestore.doc(state.fs, 'schoolUsers', user.id), { lastLogin: SGC.utils.nowISO() });
    } catch (e) { /* cosmetic */ }
    return { ok: true, userId: user.id, role: user.role, name: user.name, linkedId: user.linkedId };
  }

  async function setPassword(userId, newPassword) {
    if (!newPassword || newPassword.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
    const u = state.auth && state.auth.currentUser;
    if (!u) return { ok: false, error: 'Please sign in again before changing your password.' };
    try { await state.F.auth.updatePassword(u, newPassword); }
    catch (e) { return { ok: false, error: authErrorText(e) }; }
    return { ok: true };
  }

  /* Self-signup. Creates a real Firebase Auth account plus a Pending
     schoolUsers row (and, for students, a Pending schoolStudents row)
     that an administrator then approves. */
  async function signup(payload) {
    const F = state.F, FS = F.firestore;
    const id = String(payload.identifier || '').trim();
    const role = payload.role === 'admin' ? 'admin' : (payload.role === 'teacher' ? 'teacher' : 'student');
    const pw = String(payload.password || '');
    if (!id || !pw) return { ok: false, error: 'Enter an ID and choose a password.' };
    if (pw.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };

    let cred;
    try { cred = await F.auth.createUserWithEmailAndPassword(state.auth, emailFor(id), pw); }
    catch (e) { return { ok: false, error: authErrorText(e) }; }
    const uid = cred.user.uid;
    const now = SGC.utils.nowISO();

    /* If the office already created this person, link the new sign-in to
       that row instead of making a duplicate. The row id is derived from the
       ID itself, so this is a single document read — no roster listing. */
    const docId = userDocId(id);
    const existing = await readUserByDoc(docId).catch(() => null);
    if (existing) {
      await FS.updateDoc(FS.doc(state.fs, 'schoolUsers', existing.id), clean({ uid }));
      await F.auth.signOut(state.auth);
      await pullAll();
      return { ok: true, status: existing.status, userId: existing.id, linked: true };
    }

    /* Everything a stranger can register through the browser is Pending by
       definition. The one exception is the Staff ID written in
       SGC_FIREBASE.bootstrapAdminId, and firestore.rules carries the same ID
       — delete that rule line once the first administrator exists. */
    let status = 'Pending';
    /* The rules compare this ID case-insensitively, so the check here must too —
       otherwise "t001" would be refused locally while Firestore accepted it. */
    const boot = String(CFG.bootstrapAdminId || '').trim();
    if (role === 'admin' && boot && id.toLowerCase() === boot.toLowerCase()) status = 'Active';

    const userDoc = { id: docId, uid, role, identifier: id, idKey: id.toLowerCase(),
      name: payload.name || id, linkedId: null, status, createdAt: now, lastLogin: '' };
    await FS.setDoc(FS.doc(state.fs, 'schoolUsers', docId), clean(userDoc));

    if (role === 'student') {
      const studentId = 'S-' + id.toLowerCase();
      const stu = { id: studentId, studentId: id, admissionNo: payload.admissionNo || '',
        fullName: payload.name || id, classId: payload.classId || '', grade: payload.grade || '',
        guardianName: payload.guardianName || '', phone: payload.phone || '', email: payload.email || '',
        status: 'Pending', createdAt: now };
      await FS.setDoc(FS.doc(state.fs, 'schoolStudents', studentId), clean(stu));
      await FS.updateDoc(FS.doc(state.fs, 'schoolUsers', docId), { linkedId: studentId });
    }

    await F.auth.signOut(state.auth); // wait for approval, then sign in fresh
    await pullAll();                  // refresh the local cache from the server
    return { ok: true, status: status, userId: docId };
  }

  async function signOutLive() {
    state.me = null;
    if (!state.enabled) return;
    try { await state.F.auth.signOut(state.auth); } catch (e) { /* ignore */ }
  }

  /* ---------------- Google Sheets / CSV roster import ----------------
     Import only. The commit is done by the admin console through
     SGC.db.insertData, which already write-throughs to Firestore, so
     there is a single write path. */
  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQ = false;
    const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQ) {
        if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const norm = (h) => String(h).trim().toLowerCase().replace(/[\s_-]+/g, '');
    const header = rows[0].map(norm);
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      if (!rows[r].some((c) => String(c).trim() !== '')) continue;
      const o = {};
      header.forEach((h, idx) => { if (h) o[h] = (rows[r][idx] || '').trim(); });
      out.push(o);
    }
    return out;
  }

  async function fetchRoster(url) {
    let r;
    /* A sheet that was never published refuses the browser's cross-origin read and
       throws before any status arrives, which is why the message below names the
       two things that actually cause it. */
    try { r = await fetch(url, { cache: 'no-store' }); }
    catch (e) {
      throw new Error('The browser could not read that link at all. It must be a ' +
        '"Publish to web" CSV address — a normal sheet URL needs your Google sign-in ' +
        'and is refused. Paste the CSV instead if this continues.');
    }
    if (!r.ok) throw new Error('Could not read the sheet (HTTP ' + r.status + ').');
    return parseCsv(await r.text());
  }

  SGC.backend = {
    init, pullAll,
    get enabled() { return live(); },
    isConfigured: () => !!(CFG.isConfigured && CFG.isConfigured()),
    emailFor,
    put, remove, putSettings, upload,
    auth: { verify, setPassword, signup, signOut: signOutLive },
    sheets: { parseCsv, fetchRoster },
  };
})(window);
