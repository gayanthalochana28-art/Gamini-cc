/* =============================================================
   SRI GAMINI CENTRAL COLLEGE — signed-in user profile

   One page for all three roles. It edits the parts of a record
   the individual owns (contact details, photograph, password,
   preferences) and shows — without editing — the parts the college
   office owns (enrolment, class, department, guardian, status).

   DEMO WARNING: as everywhere else in this build the "record" is a
   localStorage object, so any of these restrictions are conveniences,
   not security. A server must reject writes to protected columns.
   ============================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const U = SGC.utils, D = SGC.dash;
  const { esc, qs, formatDate, todayISO, toast } = U;

  let sess = null;   /* session from SGC.auth.getSession() */
  let role = '';     /* admin | teacher | student */
  let user = null;   /* row from schoolUsers — the sign-in */
  let rec = null;    /* row from schoolTeachers / schoolStudents, null for admin */

  const spacer = () => '<div style="height:var(--sp-3)"></div>';

  /* ---------------- preferences ---------------- */
  const prefs = () => SGC.db.loadData('schoolUserPrefs', {}) || {};
  function setPref(key, value) {
    const all = prefs();
    all[sess.userId] = Object.assign({}, all[sess.userId], { [key]: value });
    SGC.db.saveData('schoolUserPrefs', all);
  }

  /* ---------------- what the individual may change ---------------- */
  const PHOTO = { key: 'photo', label: 'Photograph', type: 'image', full: true,
    hint: 'JPG or PNG, close to square. Appears on the public staff page, your dashboard and every notice you sign.' };

  const EDITABLE = {
    student: [
      { key: 'phone', label: 'Mobile telephone', type: 'tel', placeholder: '+94 7X XXX XXXX' },
      { key: 'email', label: 'E-mail', type: 'email' },
      { key: 'address', label: 'Home address', type: 'textarea', rows: 3, full: true },
      PHOTO,
    ],
    teacher: [
      { key: 'phone', label: 'Mobile telephone', type: 'tel', placeholder: '+94 7X XXX XXXX' },
      { key: 'email', label: 'College e-mail', type: 'email' },
      { key: 'address', label: 'Postal address', type: 'textarea', rows: 3, full: true },
      { key: 'bio', label: 'Biography shown on the public staff card', type: 'textarea', rows: 4, full: true },
      PHOTO,
    ],
    admin: [
      { key: 'name', label: 'Name shown in the console', required: true },
      PHOTO,
    ],
  };

  /* ---------------- what only the office may change ---------------- */
  function lockedRows() {
    if (role === 'student') {
      return [
        ['Student identifier', rec.studentId],
        ['Full name', rec.fullName],
        ['Name with initials', rec.nameWithInitials],
        ['Class', SGC.db.className(rec.classId)],
        ['Grade', rec.grade],
        ['Date of birth', rec.dob ? formatDate(rec.dob) : ''],
        ['Guardian', rec.guardianName ? rec.guardianName + ' (' + rec.relationship + ')' : ''],
        ['Enrolment status', rec.status],
      ];
    }
    if (role === 'teacher') {
      return [
        ['Staff number', rec.teacherId],
        ['Full name', rec.fullName],
        ['Department', rec.department],
        ['Position', rec.position],
        ['Subjects', (rec.subjectIds || []).map((id) => SGC.i18n.loc(SGC.db.findData('schoolSubjects', id) || {}, 'name')).join(', ')],
        ['Joined the college', rec.joinedOn ? formatDate(rec.joinedOn) : ''],
        ['Employment status', rec.status],
      ];
    }
    return [
      ['Office', user.name],
      ['Sign-in identifier', user.identifier],
      ['Role', D.ROLE_LABEL[role]],
    ];
  }

  /* ---------------- role-scoped counts for the summary cards ---------------- */
  function stats() {
    if (role === 'student') {
      const att = SGC.db.all('schoolAttendance').filter((a) => a.studentId === rec.id);
      const present = att.filter((a) => a.status === 'Present' || a.status === 'Late').length;
      const res = SGC.db.all('schoolResults').filter((r) => r.studentId === rec.id);
      return [
        { icon: '📅', label: 'Days recorded', value: att.length, foot: att.length ? Math.round((present / att.length) * 100) + '% present or late' : 'No register entries yet' },
        { icon: '📊', label: 'Results published', value: res.length, variant: 'gold' },
        { icon: '🏫', label: 'My class', value: SGC.db.className(rec.classId), foot: rec.status },
        { icon: '✉', label: 'Unread messages', value: SGC.db.all('schoolMessages').filter((m) => m.to === rec.id && !m.read).length, variant: 'ok' },
      ];
    }
    if (role === 'teacher') {
      const slots = SGC.db.all('schoolTimetable').filter((t) => t.teacherId === rec.id);
      const classes = Array.from(new Set(slots.map((t) => t.classId)));
      const students = new Set(SGC.db.all('schoolStudents')
        .filter((s) => classes.includes(s.classId)).map((s) => s.id));
      return [
        { icon: '🏫', label: 'Classes taken', value: classes.length, foot: slots.length + ' periods a week' },
        { icon: '👥', label: 'Students reached', value: students.size, variant: 'gold' },
        { icon: '📝', label: 'Assignments set', value: SGC.db.all('schoolAssignments').filter((a) => a.teacherId === rec.id).length },
        { icon: '✉', label: 'Unread messages', value: SGC.db.all('schoolMessages').filter((m) => m.to === rec.id && !m.read).length, variant: 'ok' },
      ];
    }
    const s = SGC.db.getSettings();
    return [
      { icon: '👥', label: 'Students', value: SGC.db.all('schoolStudents').length, foot: 'Records in the register' },
      { icon: '👤', label: 'Teaching staff', value: SGC.db.all('schoolTeachers').length, variant: 'gold' },
      { icon: '📌', label: 'Published notices', value: SGC.db.all('schoolNotices').filter((n) => n.published).length },
      { icon: '⚙', label: 'Sign-in accounts', value: SGC.db.all('schoolUsers').length, foot: 'Founded ' + s.founded },
    ];
  }

  /* ======================= render ======================= */
  function render() {
    const mount = qs('#profileMain');
    if (!mount) return;
    const st = SGC.db.getSettings();
    const p = prefs()[sess.userId] || {};
    const name = role === 'admin' ? user.name : rec.fullName;
    const folder = role === 'teacher' ? 'teachers' : role === 'student' ? 'students' : 'uploads';
    const photo = (role === 'admin' ? user.photo : rec.photo) || '';
    const home = (SGC.auth.ROLES[role] || {}).home || 'index.html';
    const subtitle = role === 'student'
      ? SGC.db.className(rec.classId) + ' · ' + rec.studentId
      : role === 'teacher' ? rec.department + ' · ' + rec.teacherId : 'Office of the Principal';

    const homeLink = qs('#pfHomeLink');
    if (homeLink) homeLink.href = home;

    let h =
      '<div class="profile-card">' +
        '<div class="profile-card__cover"><img src="' + esc(U.rootURL('assets/school-front.jpg')) + '" alt="' + esc(st.schoolName) + '"></div>' +
        '<div class="profile-card__in">' +
          '<div class="profile-card__av">' + U.avatarHTML({ fullName: name, photo, folder }, 112) + '</div>' +
          '<div class="profile-card__id"><h1>' + esc(name) + '</h1>' +
            '<p>' + esc(subtitle) + '</p>' +
            '<p style="margin-top:.45rem"><span class="badge badge--' + (role === 'admin' ? 'admin' : 'general') + '">' +
              esc((SGC.auth.ROLES[role] || {}).label || D.ROLE_LABEL[role]) + '</span> ' +
              '<span class="badge badge--' + (user.status === 'Active' ? 'live' : 'draft') + '">' + esc(user.status) + '</span></p>' +
          '</div>' +
          '<div class="profile-card__acts">' +
            '<a class="btn btn--ghost btn--sm" href="' + esc(home) + '">▦ My dashboard</a>' +
            '<button type="button" class="btn btn--primary btn--sm" data-edit>Edit my details</button>' +
          '</div>' +
        '</div>' +
      '</div>' + spacer() +
      D.widgets(stats()) + spacer();

    h += '<div class="split">' +
      D.panel({
        title: 'Details you maintain',
        action: '<button type="button" class="btn btn--ghost btn--sm" data-edit>Change</button>',
        body: '<dl class="info-grid">' + infoRows(EDITABLE[role].map((f) => ({
          label: f.label, value: (role === 'admin' ? user : rec)[f.key], field: f,
        }))) + '</dl>' +
        '<p class="muted" style="font-size:.8rem;margin:.9rem 0 0">Changes here are immediate. Anything the college ' +
        'office controls is listed on the right and can only be amended by them.</p>',
      }) +
      D.panel({
        title: 'Held by the college office',
        body: '<dl class="info-grid">' + lockedRows().map((r) =>
          '<dt>' + esc(r[0]) + '</dt><dd>' + esc(String(r[1] === undefined || r[1] === null || r[1] === '' ? '—' : r[1])) + '</dd>').join('') +
          '</dl>' + '<p class="muted" style="font-size:.8rem;margin:.9rem 0 0">Written to the office. Telephone ' +
          esc(st.phone) + ' or e-mail ' + esc(st.email) + ' with any correction.</p>',
      }) +
    '</div>' + spacer();

    h += D.panel({
      title: 'Sign-in and security',
      body: '<dl class="info-grid" style="margin-bottom:var(--sp-3)">' +
          '<dt>Signs in as</dt><dd>' + esc(user.identifier) + '</dd>' +
          '<dt>Account</dt><dd>' + esc(user.id) + '</dd>' +
          '<dt>Status</dt><dd>' + esc(user.status) + '</dd>' +
          '<dt>Created</dt><dd>' + esc(formatDate((user.createdAt || '').slice(0, 10))) + '</dd>' +
          '<dt>Last sign-in</dt><dd>' + esc(user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'this session') + '</dd>' +
        '</dl>' +
        '<form id="pwForm"><div class="form-grid">' +
          '<div class="field"><label class="label" for="pw1">New password</label><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="6"></div>' +
          '<div class="field"><label class="label" for="pw2">Repeat the new password</label><input class="input" id="pw2" type="password" autocomplete="new-password" minlength="6"></div>' +
        '</div><button class="btn btn--primary" type="submit">Change password</button></form>' +
        '<p class="muted" style="font-size:.8rem;margin:.9rem 0 0">This demonstration keeps the password in plain text ' +
        'in this browser so the portals can be tried without a server. It is not secure authentication and must not be ' +
        'presented as such: a real deployment authenticates on a server, stores only a salted hash, and never sends the ' +
        'stored value to the browser.</p>',
    }) + spacer();

    h += D.panel({
      title: 'Preferences',
      body: D.setRow({ title: 'Language', text: 'සිංහල relabels this console and shows the Sinhala version of any content that has one.',
        control: '<div class="row-actions"><button type="button" class="btn btn--ghost btn--sm" data-lang="en">English</button>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-lang="si">සිංහල</button></div>' }) +
        D.setRow({ title: 'Appearance', text: 'Dark mode is remembered on this device and shared with the public website.',
          control: '<button type="button" class="btn btn--ghost btn--sm" data-theme-toggle>Toggle dark mode</button>' }) +
        D.setRow({ title: 'Keep me signed in', text: 'Otherwise the session ends when this browser tab is closed.',
          control: D.switchHTML('pfRemember', 'Keep me signed in', SGC.auth.remembered()) }) +
        (role === 'admin' ? '' : D.setRow({ title: 'E-mail me a weekly summary',
          text: 'In a connected build this asks the server to send notices, results and messages once a week. Held on this device for the demo.',
          control: D.switchHTML('pfDigest', 'Weekly summary', !!p.digest) })),
    }) + spacer();

    h += D.panel({
      title: 'Where my information appears',
      body: '<ul class="mini">' + (role === 'student' ? [
        ['📌', 'Public website', 'Your name is never published. Only your class appears in a timetable, and only to signed-in staff and students.'],
        ['👤', 'Staff and office', 'Teachers and administrators can see your record to mark attendance, enter results and contact your guardian.'],
        ['📊', 'Results', 'Marks and grades appear in your portal as soon as a teacher records them.'],
      ] : role === 'teacher' ? [
        ['👤', 'Public Teachers page', 'Your name, position, department, subjects and biography are published to visitors.'],
        ['🏫', 'Timetables', 'Your name shows beside each period you take, to your students and their guardians.'],
        ['📌', 'Notices', 'Notices and assignments you publish are signed with your name.'],
      ] : [
        ['⚙', 'Administration console', 'This account changes college records. Nothing about it is displayed to visitors.'],
        ['🔏', 'Never published', 'No administrator name, identifier or credential is printed on any page of this website.'],
      ]).map((r) => '<li><span class="mini__i" aria-hidden="true">' + r[0] + '</span><div><b>' + esc(r[1]) + '</b><span>' + esc(r[2]) + '</span></div></li>').join('') +
        '</ul>' + spacer() +
        '<button type="button" class="btn btn--danger btn--sm" data-signout>Sign out of this device</button>',
    });

    mount.innerHTML = h;
    wire(mount);
  }

  function infoRows(list) {
    return list.map((r) => {
      let v = r.value;
      if (r.field.type === 'image') {
        return '<dt>' + esc(r.label) + '</dt><dd>' + (v
          ? '<span style="display:block;width:74px">' + U.avatarHTML({ fullName: 'photograph', photo: v, folder: r.field.folder || (role === 'teacher' ? 'teachers' : role === 'student' ? 'students' : 'uploads') }, 74) + '</span>'
          : 'Not supplied') + '</dd>';
      }
      if (r.field.type === 'checks') v = (v || []).join(', ');
      return '<dt>' + esc(r.label) + '</dt><dd>' + esc(String(v === undefined || v === null || v === '' ? '—' : v)) + '</dd>';
    }).join('');
  }

  /* ---------------- wiring ---------------- */
  let wired = false;
  function wire(mount) {
    const pw = qs('#pwForm');
    if (pw) pw.addEventListener('submit', async (e) => {
      e.preventDefault();
      const a = qs('#pw1').value, b = qs('#pw2').value;
      if (a.length < 6) { toast('Choose at least six characters.', 'error'); return; }
      if (a !== b) { toast('The two passwords do not match.', 'error'); return; }
      const r = await SGC.auth.setPassword(user.id, a);
      toast(r.ok ? 'Password changed. Use it the next time you sign in.' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) { qs('#pw1').value = ''; qs('#pw2').value = ''; }
    });

    const rem = qs('#pfRemember');
    if (rem) rem.addEventListener('change', (e) => {
      SGC.auth.setRemember(e.target.checked);
      toast(e.target.checked ? 'You will stay signed in on this device.' : 'The session now ends when the tab closes.', 'info');
    });
    const dig = qs('#pfDigest');
    if (dig) dig.addEventListener('change', (e) => { setPref('digest', e.target.checked); toast('Preference saved on this device.', 'info'); });

    if (wired) return;
    wired = true;
    U.on(mount, 'click', '[data-edit]', () => editDetails());
    U.on(mount, 'click', '[data-signout]', () => {
      SGC.auth.logout();
      toast('You have been signed out.', 'info');
      setTimeout(() => { global.location.href = 'index.html'; }, 500);
    });
  }

  function editDetails() {
    const source = role === 'admin' ? user : rec;
    D.formModal({
      title: 'My details',
      values: source,
      fields: EDITABLE[role],
      uploadScope: 'profiles',
      submitLabel: 'Save my details',
      onSubmit: (v, m) => {
        if (role === 'admin') SGC.db.updateData('schoolUsers', user.id, v);
        else SGC.db.updateData(role === 'teacher' ? 'schoolTeachers' : 'schoolStudents', rec.id, v);
        m.close();
        toast('Your details are saved and appear across the portals.', 'success');
        refresh();
      },
    });
  }

  function refresh() {
    user = SGC.db.findData('schoolUsers', sess.userId) || user;
    if (role !== 'admin') rec = SGC.db.findData(role === 'teacher' ? 'schoolTeachers' : 'schoolStudents', sess.linkedId);
    D.shell(sess, role === 'admin' ? 'Administration Office' : undefined);
    render();
  }

  /* ---------------- guard + boot ---------------- */
  function boot() {
    sess = SGC.auth.requireAuth(['admin', 'teacher', 'student']);
    if (!sess) return;
    role = sess.role;
    user = SGC.db.findData('schoolUsers', sess.userId);
    if (role !== 'admin') {
      rec = SGC.db.findData(role === 'teacher' ? 'schoolTeachers' : 'schoolStudents', sess.linkedId);
      if (!rec) {
        const mount = qs('#profileMain');
        if (mount) mount.innerHTML = U.emptyState({ icon: '🗂', title: 'No profile record found',
          text: 'This sign-in is not linked to a ' + role + ' record. Ask the college office to check the register.' });
        D.shell(sess, D.ROLE_LABEL[role]);
        return;
      }
    }
    D.shell(sess, role === 'admin' ? 'Administration Office' : undefined);
    render();
    document.addEventListener('sgc:lang', render);
  }

  SGC.pages['profile'] = { init: boot };
}(window));
