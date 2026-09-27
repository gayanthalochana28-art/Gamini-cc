/* =============================================================
   SRI GAMINI CENTRAL COLLEGE — authentication (DEMO ONLY)

   ⚠ READ THIS BEFORE GOING TO PRODUCTION

   This module is a front-end demonstration. It is NOT secure and must
   never be used to protect real student data:

     • Passwords live in localStorage as plain text (see DEMO_PASSWORDS and
       the seeded accounts in js/storage.js). They are never printed on the
       login page. Anyone with the device, or any script on the page, can
       still read them.
     • Role checks run in the browser, so a user can edit them in DevTools.
       A browser check is a UX convenience, never an access control.
     • localStorage is per-device. There is no server to say "no".

   Real authorisation must be enforced by a server that the browser cannot
   rewrite. Everything that touches identity is funnelled through the
   `adapter` object below, so swapping the implementation is a one-file
   change. See README → "Replacing demo authentication".
   ============================================================= */
(function (global) {
  'use strict';

  const SGC = global.SGC = global.SGC || {};
  const SESSION_KEY = 'sgc.session';
  const REMEMBER_KEY = 'sgc.remember';

  /* ------------------------------------------------------------------
     DEVELOPMENT CREDENTIALS — NOT REAL ACCOUNTS.
     The offline demo has no server, so it can only check a password that
     is present in the page's own code. These values are never printed on
     the website: they are read from here, and the account identifiers live
     in the seeded records in js/storage.js. Delete this line and change
     every password when a backend is connected.
     ------------------------------------------------------------------ */
  const DEMO_PASSWORDS = { teacher: 'teacher123', student: 'student123', admin: 'admin123' };

  const ROLES = {
    admin:   { home: 'admin-dashboard.html',   label: 'Administrator' },
    teacher: { home: 'teacher-dashboard.html', label: 'Teacher' },
    student: { home: 'student-dashboard.html', label: 'Student' },
  };

  /* ---------------- adapter: the single swap point ----------------
     Replace the bodies of verify() and loadProfile() with calls to
     Firebase Auth, Supabase Auth, or a PHP endpoint. Nothing else in
     the codebase needs to change.

     Firebase example:
       async verify(id, pw, role) {
         const cred = await signInWithEmailAndPassword(auth, id + '@sgcc.sch.lk', pw);
         const claimed = (await getIdTokenResult(cred.user)).claims.role;
         return claimed === role ? { ok: true, uid: cred.user.uid } : { ok: false, error: 'Wrong role' };
       }

     PHP + MySQL example:
       async verify(id, pw, role) {
         const r = await fetch(BASE + '/api/login.php', {
           method: 'POST', credentials: 'include',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ id, pw, role })
         });
         return r.json();   // { ok, uid, role, name }
       }
  ------------------------------------------------------------------ */
  const adapter = {
    async verify(identifier, password, role) {
      /* Live mode: real Firebase Authentication + the schoolUsers row. */
      if (SGC.backend && SGC.backend.enabled) {
        return SGC.backend.auth.verify(identifier, password, role);
      }

      await simulateLatency();
      const id = String(identifier || '').trim();
      const pw = String(password || '');
      if (!id || !pw) return { ok: false, error: 'Enter both your ID and password.' };

      const user = SGC.db.findData('schoolUsers', (u) =>
        u.role === role && String(u.identifier).toLowerCase() === id.toLowerCase());

      if (!user) return { ok: false, error: 'No ' + role + ' account found for that ID.' };
      if (user.status === 'Pending') return { ok: false, error: 'Your registration is awaiting approval by the college office.' };
      if (user.status === 'Rejected') return { ok: false, error: 'The office could not approve this registration. Contact the college office.' };
      if (user.status !== 'Active') return { ok: false, error: 'This account is inactive. Contact the office.' };
      if (user.demoPassword !== pw) return { ok: false, error: 'Incorrect password.' };

      return { ok: true, userId: user.id, role: user.role, name: user.name, linkedId: user.linkedId };
    },

    loadProfile(session) {
      if (!session) return null;
      if (session.role === 'admin') {
        return { role: 'admin', id: session.linkedId || 'admin', fullName: session.name,
                 position: "Principal's Office / Administration", department: 'Administration',
                 email: SGC.db.getSettings().email, phone: SGC.db.getSettings().phone };
      }
      if (session.role === 'teacher') return SGC.db.findData('schoolTeachers', session.linkedId);
      return SGC.db.findData('schoolStudents', session.linkedId);
    },

    /* Password change. Live mode updates Firebase Auth (the password is
       never stored by us). Demo mode writes the plain demoPassword and
       is for local testing only. Async in both modes. */
    async setPassword(userId, newPassword) {
      if (SGC.backend && SGC.backend.enabled) {
        return SGC.backend.auth.setPassword(userId, newPassword);
      }
      if (!newPassword || newPassword.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
      SGC.db.updateData('schoolUsers', userId, { demoPassword: newPassword });
      return { ok: true };
    },
  };

  function simulateLatency() {
    return new Promise((r) => setTimeout(r, 420 + Math.random() * 260));
  }

  /* ---------------- session ---------------- */
  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeSession(session, remember) {
    const raw = JSON.stringify(session);
    sessionStorage.setItem(SESSION_KEY, raw);
    if (remember) localStorage.setItem(SESSION_KEY, raw);
    else localStorage.removeItem(SESSION_KEY);
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
  }

  function getSession() {
    const s = readSession();
    if (!s) return null;
    const user = SGC.db.findData('schoolUsers', s.userId);
    if (!user || user.status !== 'Active') { logout(); return null; }
    return Object.assign({}, s, { name: user.name, linkedId: user.linkedId });
  }

  async function login(role, identifier, password, remember) {
    const res = await adapter.verify(identifier, password, role);
    if (!res.ok) return res;
    const session = { userId: res.userId, role: res.role, name: res.name, linkedId: res.linkedId, at: Date.now() };
    writeSession(session, !!remember);
    SGC.db.updateData('schoolUsers', res.userId, { lastLogin: new Date().toISOString() });
    return { ok: true, redirect: homeFor(res.role) };
  }

  function logout() {
    if (SGC.backend && SGC.backend.enabled) { try { SGC.backend.auth.signOut(); } catch (e) { /* ignore */ } }
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  /* ---------------- self-signup (student approval flow) ----------------
     Live mode creates a real Firebase Auth account + a Pending row the
     office approves. Demo mode mirrors the same shape locally so the
     whole flow can be exercised without a server. Returns
     { ok, status, error } — status is 'Pending' unless a bootstrap admin. */
  async function signup(payload) {
    if (SGC.backend && SGC.backend.enabled) {
      return SGC.backend.auth.signup(payload);
    }
    await simulateLatency();
    const role = payload.role === 'admin' ? 'admin' : (payload.role === 'teacher' ? 'teacher' : 'student');
    const id = String(payload.identifier || '').trim();
    const pw = String(payload.password || '');
    if (!id || !pw) return { ok: false, error: 'Enter an ID and choose a password.' };
    if (pw.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
    const taken = SGC.db.findData('schoolUsers', (u) =>
      u.role === role && String(u.identifier).toLowerCase() === id.toLowerCase());
    if (taken) return { ok: false, error: 'That ID is already registered. Sign in instead, or contact the office.' };

    const now = SGC.utils.nowISO();
    let linkedId = null;
    if (role === 'student') {
      const stu = SGC.db.insertData('schoolStudents', {
        studentId: id, fullName: payload.name || id, admissionNo: payload.admissionNo || '',
        classId: payload.classId || '', grade: payload.grade || '', guardianName: payload.guardianName || '',
        phone: payload.phone || '', email: payload.email || '', status: 'Pending',
      });
      linkedId = stu.id;
    }
    SGC.db.insertData('schoolUsers', {
      id: 'U-' + id.toLowerCase(), role, identifier: id, idKey: id.toLowerCase(),
      name: payload.name || id, linkedId, demoPassword: pw, status: 'Pending', createdAt: now, lastLogin: '',
    });
    return { ok: true, status: 'Pending', userId: 'U-' + id.toLowerCase() };
  }

  /* Change how the current session is stored without signing the user out —
     the profile page offers this as "keep me signed in on this device". */
  const remembered = () => localStorage.getItem(SESSION_KEY) !== null;

  function setRemember(on) {
    const raw = readSession();
    if (!raw) return false;
    const text = JSON.stringify(raw);
    if (on) localStorage.setItem(SESSION_KEY, text);
    else localStorage.removeItem(SESSION_KEY);
    localStorage.setItem(REMEMBER_KEY, on ? '1' : '0');
    return true;
  }

  const homeFor = (role) => ROLES[role] ? ROLES[role].home : 'index.html';

  function hasRole(...roles) {
    const s = getSession();
    return !!(s && roles.includes(s.role));
  }

  /* ---------------- route protection ----------------
     Called at the top of every dashboard script. Redirects to the login
     page and records where the user was heading, so a successful login
     returns them there.

     NOTE: this is a front-end guard for demo navigation only. It stops an
     honest user from stumbling into the wrong dashboard; it does NOT stop
     an attacker. Server-side rules are the real protection.
  ---------------------------------------------------- */
  function requireAuth(allowed, base) {
    const s = getSession();
    const b = base || '';
    if (!s) {
      const next = encodeURIComponent(global.location.pathname.split('/').pop() + global.location.search);
      global.location.replace(b + 'login.html?next=' + next);
      return null;
    }
    if (allowed && allowed.length && !allowed.includes(s.role)) {
      SGC.utils.toast('You do not have access to that area.', 'error', 4000);
      global.location.replace(b + homeFor(s.role));
      return null;
    }
    return s;
  }

  /* Convenience predicates used to hide admin-only UI from other roles. */
  const isStaff = () => hasRole('admin', 'teacher');
  const isAdmin = () => hasRole('admin');

  /* Profile for the signed-in user, resolved against students/teachers table. */
  function profile() { return adapter.loadProfile(getSession()); }

  /* ---------------- login page controller ---------------- */
  const ID_LABEL = {
    student: ['Student ID', 'Your student ID', 'Printed on your admission card. Issued by the college office.'],
    teacher: ['Teacher number', 'Your teacher number', 'Issued by the college office with your appointment letter.'],
    admin: ['Office identifier', 'Your office account ID', 'Administration office accounts only.'],
  };

  SGC.pages.login = {
    init() {
      const params = new URLSearchParams(global.location.search);
      const already = getSession();
      if (already) { global.location.replace(homeFor(already.role)); return; }

      const form = SGC.utils.qs('#authForm'), tabs = SGC.utils.qs('#authTabs');
      const idInput = SGC.utils.qs('#identifier'), pwInput = SGC.utils.qs('#password');
      const err = SGC.utils.qs('#authError'), btn = SGC.utils.qs('#authSubmit');
      const label = SGC.utils.qs('#idLabel'), hint = SGC.utils.qs('#idHint');
      let role = ['student', 'teacher', 'admin'].indexOf(params.get('role')) > -1 ? params.get('role') : 'student';

      function setRole(r) {
        role = r;
        tabs.querySelectorAll('.auth-tab').forEach((b) => {
          const on = b.dataset.role === r;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });
        const cfg = ID_LABEL[r];
        label.textContent = cfg[0];
        idInput.placeholder = cfg[1];
        hint.textContent = cfg[2];
        idInput.value = '';
        pwInput.value = '';
        hideError();
      }
      function showError(msg) { err.textContent = msg; err.classList.add('is-on'); }
      function hideError() { err.textContent = ''; err.classList.remove('is-on'); }

      tabs.addEventListener('click', (e) => {
        const b = e.target.closest('[data-role]');
        if (b) setRole(b.dataset.role);
      });

      const toggle = SGC.utils.qs('[data-pw-toggle]');
      if (toggle) toggle.addEventListener('click', () => {
        const show = pwInput.type === 'password';
        pwInput.type = show ? 'text' : 'password';
        toggle.setAttribute('aria-pressed', String(show));
        toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        pwInput.focus();
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        const id = idInput.value.trim(), pw = pwInput.value;
        if (!id || !pw) {
          showError('Enter both your ' + ID_LABEL[role][0].toLowerCase() + ' and your password.');
          (!id ? idInput : pwInput).focus();
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Signing in…';
        const res = await login(role, id, pw, SGC.utils.qs('#remember').checked);
        btn.disabled = false;
        btn.textContent = 'Sign in';
        if (!res.ok) { showError(res.error || 'Sign in failed.'); pwInput.value = ''; idInput.focus(); return; }
        const next = params.get('next');
        global.location.href = next && /^[\w./-]+$/.test(next) ? next : res.redirect;
      });

      setRole(role);
      idInput.focus();
    },
  };

  /* ---------------- student self-signup controller ----------------
     A student registers with their Student ID; the account is created in
     a Pending state and only signs in once an administrator approves it.
     See student-signup.html for the markup this binds to. */
  SGC.pages.signup = {
    init() {
      const U = SGC.utils;
      const already = getSession();
      if (already) { global.location.replace(homeFor(already.role)); return; }

      const form = U.qs('#signupForm');
      const err = U.qs('#signupError');
      const btn = U.qs('#signupSubmit');
      const done = U.qs('#signupDone');
      const classSel = U.qs('#suClass');

      /* One-time bootstrap: ?role=staff turns this page into the register
         screen for the first administrator, and only for the single Staff ID
         written in js/firebase-config.js. It does nothing in the offline demo
         and nothing at all once bootstrapAdminId is back to ''. */
      const q = new URLSearchParams(global.location.search);
      const CFG = global.SGC_FIREBASE || {};
      const bootId = String(CFG.bootstrapAdminId || '').trim();
      const staffMode = q.get('role') === 'staff'
        && !!(global.SGC.backend && global.SGC.backend.isConfigured && global.SGC.backend.isConfigured())
        && !!bootId;
      const idLabel = U.qs('label[for="suId"]');
      const idHint = U.qs('#suIdHint');
      if (staffMode) {
        U.qsa('[data-student-only]').forEach((n) => { n.hidden = true; });
        if (idLabel) idLabel.firstChild.nodeValue = 'Staff ID ';
        if (idHint) idHint.textContent = 'This must match the bootstrapAdminId in js/firebase-config.js.';
        const idIn = U.qs('#suId'); if (idIn) idIn.placeholder = 'e.g. ADM01';
        if (btn) btn.textContent = 'Create the administrator';
        const note = U.qs('#signupTitle');
        if (note) note.textContent = 'First administrator';
      }

      if (classSel) {
        const classes = SGC.db.all('schoolClasses').slice()
          .sort((a, b) => (a.grade - b.grade) || String(a.name).localeCompare(String(b.name)));
        classSel.innerHTML = '<option value="">— Select your class —</option>' +
          classes.map((c) => '<option value="' + U.esc(c.id) + '">' + U.esc(c.name) + '</option>').join('');
      }

      const val = (id) => { const n = U.qs(id); return n ? n.value.trim() : ''; };
      function showErr(m) { if (err) { err.textContent = m; err.classList.add('is-on'); } }
      function clearErr() { if (err) { err.textContent = ''; err.classList.remove('is-on'); } }

      U.qsa('[data-pw-toggle]').forEach((b) => b.addEventListener('click', () => {
        const sel = b.getAttribute('data-pw-toggle');
        const inputs = sel
          ? sel.split(',').map((s) => U.qs(s.trim())).filter(Boolean)
          : [b.closest('.pw-wrap') && b.closest('.pw-wrap').querySelector('input')].filter(Boolean);
        const show = inputs.length && inputs[0].type === 'password';
        inputs.forEach((i) => { i.type = show ? 'text' : 'password'; });
        b.setAttribute('aria-pressed', String(show));
        b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      }));

      if (form) form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErr();
        const id = val('#suId'), name = val('#suName'), pw = U.qs('#suPw').value, pw2 = U.qs('#suPw2').value;
        if (!id) { showErr(staffMode ? 'Enter the Staff ID.' : 'Enter your Student ID.'); U.qs('#suId').focus(); return; }
        if (!name) { showErr('Enter your full name as it appears on your admission card.'); U.qs('#suName').focus(); return; }
        if (pw.length < 6) { showErr('Choose a password of at least 6 characters.'); U.qs('#suPw').focus(); return; }
        if (pw !== pw2) { showErr('The two passwords do not match.'); U.qs('#suPw2').focus(); return; }
        if (staffMode && id.toLowerCase() !== bootId.toLowerCase()) {
          showErr('Only the Staff ID set as bootstrapAdminId can be registered this way.');
          U.qs('#suId').focus(); return;
        }

        const cls = classSel && classSel.value && !staffMode ? SGC.db.findData('schoolClasses', classSel.value) : null;
        btn.disabled = true; btn.textContent = 'Sending…';
        const res = await SGC.auth.signup({
          role: staffMode ? 'admin' : 'student', identifier: id, name,
          admissionNo: val('#suAdmission'),
          classId: cls ? cls.id : '', grade: cls ? cls.grade : '',
          guardianName: val('#suGuardian'), phone: val('#suPhone'), email: val('#suEmail'),
          password: pw,
        });
        btn.disabled = false; btn.textContent = staffMode ? 'Create the administrator' : 'Create my account';
        if (!res.ok) { showErr(res.error || 'Registration failed.'); return; }
        form.hidden = true;
        if (done) {
          const d = U.qs('#doneId'); if (d) d.textContent = id;
          const msg = U.qs('#signupDoneMsg');
          if (staffMode && msg) msg.innerHTML = 'Thank you. The administrator account <strong>' + U.esc(id) +
            '</strong> is now <strong>active</strong>. Sign in from the Administrator tab, then set bootstrapAdminId ' +
            'back to an empty string in js/firebase-config.js.';
          done.hidden = false;
        }
      });
    },
  };

  SGC.auth = {
    DEMO_PASSWORDS, ROLES, adapter,
    login, logout, signup, getSession, hasRole, requireAuth, isStaff, isAdmin, profile, homeFor,
    setRemember, remembered, setPassword: adapter.setPassword,
  };
})(window);
