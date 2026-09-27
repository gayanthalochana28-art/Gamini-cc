/* =============================================================
   SRI GAMINI CENTRAL COLLEGE — administration console

   Full create / read / update / delete over every localStorage
   collection, plus the college settings. This is the only module
   that writes to more than one user's records, so its guard is the
   strictest one in the project.

   DEMO WARNING: the role check below runs in the browser. Anyone who
   can edit localStorage can become an administrator. Real deployments
   must enforce these rules on the server (custom claims, RLS policies
   or a session role checked in every endpoint).
   ============================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const U = SGC.utils, D = SGC.dash;
  const { esc, qs, qsa, formatDate, todayISO, toast, emptyState } = U;

  let sess = null;
  const st = () => SGC.db.getSettings();
  const yesNo = (v) => (v ? '<span class="badge badge--live">Yes</span>' : '<span class="badge">No</span>');
  const money = (n) => (n === undefined || n === null || n === '' ? '—' : String(n));

  /* option lists derived from the data so the console never drifts */
  const classOpts = () => SGC.db.all('schoolClasses').map((c) => ({ value: c.id, label: c.name }));
  const subjectOpts = () => SGC.db.all('schoolSubjects').map((s) => ({ value: s.id, label: s.name }));
  const teacherOpts = () => SGC.db.all('schoolTeachers').map((t) => ({ value: t.id, label: t.fullName }));
  const departments = () => Array.from(new Set(SGC.db.all('schoolSubjects').map((s) => s.department))).sort();
  const streams = () => Array.from(new Set(SGC.db.all('schoolClasses').map((c) => c.stream))).sort();
  const lines = (txt) => String(txt || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const pairs = (txt) => lines(txt).map((l) => {
    const i = l.indexOf('|');
    return i > -1 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { title: l, text: '' };
  });
  const pairsText = (arr) => (arr || []).map((v) => (v.text ? v.title + ' | ' + v.text : v.title)).join('\n');

  /* ---------------- generic CRUD screen ---------------- */
  function crud(mountSel, cfg) {
    const mount = qs(mountSel);
    if (!mount) return null;
    mount.innerHTML = '<div class="dt-mount"></div>';
    const table = D.dataTable(qs('.dt-mount', mount), {
      caption: cfg.caption,
      searchPlaceholder: cfg.searchPlaceholder,
      searchKeys: cfg.searchKeys,
      filters: cfg.filters,
      pageSize: cfg.pageSize,
      rows: () => SGC.db.all(cfg.collection),
      addLabel: cfg.addLabel,
      toolbar: cfg.toolbar,
      empty: { title: 'Nothing recorded yet', text: 'Use ' + cfg.addLabel + ' to create the first entry.' },
      onAdd: () => edit(cfg, null),
      cols: cfg.cols.concat([{ key: '_a', label: '', cell: (r) =>
        D.rowActions(r.id, cfg.view === false ? { view: false } : null) + (cfg.extraActions ? cfg.extraActions(r) : '') }]),
    });
    if (cfg.onToolbar) U.on(table.root, 'click', '[data-toolbar]', (e, b) => cfg.onToolbar(b.dataset.toolbar, table));
    U.on(table.root, 'click', '[data-act]', (e, btn) => {
      const rec = SGC.db.findData(cfg.collection, btn.dataset.id);
      if (!rec) return;
      const act = btn.dataset.act;
      if (cfg.onAction && cfg.onAction(act, rec, table)) return;
      if (act === 'edit') edit(cfg, rec);
      else if (act === 'view') viewRecord(cfg, rec);
      else {
        if (cfg.blockDelete) {
          const why = cfg.blockDelete(rec);
          if (why) { toast(why, 'error', 5000); return; }
        }
        U.confirmDialog({
          title: 'Delete ' + cfg.singular.toLowerCase(),
          message: cfg.titleOf(rec),
          detail: cfg.deleteNote || 'This cannot be undone in the demonstration build.',
          danger: true, confirmText: 'Delete',
        }).then((ok) => {
          if (!ok) return;
          SGC.db.deleteData(cfg.collection, rec.id);
          if (cfg.afterDelete) cfg.afterDelete(rec);
          toast(cfg.singular + ' deleted.', 'info');
          table.refresh();
        });
      }
    });
    return table;
  }

  function edit(cfg, rec) {
    D.formModal({
      title: (rec ? 'Edit ' : 'Add ') + cfg.singular,
      values: rec || (cfg.defaults ? cfg.defaults() : {}),
      fields: cfg.fields,
      uploadScope: cfg.collection,
      submitLabel: rec ? 'Save changes' : 'Create',
      onSubmit: (v, m) => {
        const saved = rec ? SGC.db.updateData(cfg.collection, rec.id, v) : SGC.db.insertData(cfg.collection, v);
        if (cfg.afterSave) cfg.afterSave(saved, rec);
        toast((rec ? cfg.singular + ' updated.' : cfg.singular + ' created.'), 'success');
        m.close();
        if (cfg.refresh) cfg.refresh(); else tableRefresh(cfg);
      },
    });
  }

  /* the table handle lives on the mount so afterSave can refresh it */
  let lastTable = null;
  function tableRefresh(cfg) { if (lastTable) lastTable.refresh(); }

  function viewRecord(cfg, rec) {
    const rows = cfg.fields.filter((f) => f.type !== 'image' || rec[f.key]).map((f) => {
      let v = rec[f.key];
      if (v === undefined || v === null || v === '') v = '—';
      else if (Array.isArray(v)) v = v.map((x) => (f.options ? labelFor(f.options, x) : x)).join(', ') || '—';
      else if (typeof v === 'boolean') v = v ? 'Yes' : 'No';
      else if (f.options) v = labelFor(f.options, v);
      else if (f.type === 'date' && v !== '—') v = formatDate(v);
      else v = String(v);
      return '<dt>' + esc(f.label) + '</dt><dd>' + esc(v.length > 400 ? v.slice(0, 400) + '…' : v) + '</dd>';
    }).join('');
    U.modal({
      title: cfg.singular + ' · ' + cfg.titleOf(rec),
      body: '<dl class="info-grid">' + rows + '<dt>Record ID</dt><dd>' + esc(rec.id) + '</dd></dl>',
      footer: '<button type="button" class="btn btn--ghost" data-close>Close</button>' +
        '<button type="button" class="btn btn--primary" data-edit>Edit</button>',
      onOpen(m) { U.on(m.root, 'click', '[data-edit]', () => { m.close(); edit(cfg, rec); }); },
    });
  }
  function labelFor(options, val) {
    const hit = options.find((o) => String(typeof o === 'string' ? o : o.value) === String(val));
    if (!hit) return String(val);
    return typeof hit === 'string' ? hit : hit.label;
  }

  /* ======================= VIEWS ======================= */

  function adHome() {
    const db = SGC.db;
    const live = db.all('schoolNotices').filter((n) => n.published);
    const unreadMsgs = db.all('schoolMessages').filter((m) => !m.read);
    const w = qs('#adWidgets');
    if (w) w.innerHTML = D.widgets([
      { icon: '🎓', value: String(db.count('schoolStudents')), label: 'Students on roll', variant: 'gold' },
      { icon: '👩‍🏫', value: String(db.count('schoolTeachers')), label: 'Teaching staff' },
      { icon: '📌', value: String(live.length), label: 'Published notices' },
      { icon: '🗓', value: String(SGC.events.upcoming().length), label: 'Upcoming events', variant: 'ok' },
      { icon: '🖼', value: String(db.count('schoolGallery')), label: 'Gallery images' },
      { icon: '✉', value: String(unreadMsgs.length), label: 'Unread messages', variant: unreadMsgs.length ? 'err' : 'ok' },
    ]);
    const sub = qs('#adHomeSub');
    if (sub) sub.textContent = st().schoolName + ' · established ' + st().founded + ' · ' + db.count('schoolClasses') + ' classes';

    /* enrolment by grade, taken from the real student records */
    const byGrade = {};
    db.all('schoolStudents').forEach((s) => { byGrade[s.grade] = (byGrade[s.grade] || 0) + 1; });
    const gEl = qs('#adChartGrades');
    if (gEl) {
      const data = Object.keys(byGrade).sort((a, b) => a - b).map((g) => ({ label: 'Gr ' + g, value: byGrade[g] }));
      gEl.innerHTML = data.length ? '' : '<p class="muted">No students recorded yet.</p>';
      if (data.length) SGC.charts.bar(gEl, data, { title: null });
    }

    const byCat = {};
    live.forEach((n) => { byCat[n.category] = (byCat[n.category] || 0) + 1; });
    const cEl = qs('#adChartCats');
    if (cEl) {
      const data = Object.keys(byCat).map((c) => ({ label: c, value: byCat[c] }));
      cEl.innerHTML = data.length ? '' : '<p class="muted">No published notices yet.</p>';
      if (data.length) SGC.charts.donut(cEl, data, { center: live.length });
    }

    /* attendance marked per day over the last ten days */
    const aEl = qs('#adChartAtt');
    if (aEl) {
      const days = [];
      for (let i = 9; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        days.push({ label: iso.slice(5), value: db.all('schoolAttendance').filter((a) => a.date === iso && a.status !== 'Absent').length });
      }
      SGC.charts.line(aEl, days, { title: null });
    }

    const feed = qs('#adFeed');
    if (feed) {
      const items = [];
      db.all('schoolNotices').slice(0, 3).forEach((n) => items.push({ icon: '📌', title: 'Notice: ' + n.title, meta: (n.published ? 'Published' : 'Draft') + ' · ' + formatDate(n.date) }));
      db.all('schoolUpdates').slice(0, 2).forEach((u) => items.push({ icon: '📰', title: u.title, meta: 'Update · ' + formatDate(u.date) }));
      db.all('schoolStudents').slice(0, 2).forEach((s) => items.push({ icon: '🎓', title: s.fullName + ' added to ' + SGC.db.className(s.classId), meta: 'Student record · ' + s.studentId }));
      feed.innerHTML = D.feedHTML(items.slice(0, 8));
    }

    const quick = qs('#adQuick');
    if (quick) {
      const acts = [
        ['adNotices', '📌', 'Publish a notice'], ['adStudents', '🎓', 'Admit a student'],
        ['adTeachers', '👩‍🏫', 'Add a teacher'], ['adEvents', '🗓', 'Create an event'],
        ['adGallery', '🖼', 'Upload a photo'], ['adSchool', '🏛', 'Edit college details'],
      ];
      quick.innerHTML = '<div class="grid grid-2">' + acts.map((a) =>
        '<button type="button" class="card card--hover" data-goto="' + a[0] + '" style="text-align:left">' +
        '<span class="card__icon" aria-hidden="true">' + a[1] + '</span><b>' + a[2] + '</b></button>').join('') + '</div>';
    }
  }

  /* ---------------- people ---------------- */
  const STUDENT_FIELDS = () => [
    { key: 'studentId', label: 'Student ID', required: true, hint: 'Used to sign in, e.g. S011' },
    { key: 'admissionNo', label: 'Admission number' },
    { key: 'fullName', label: 'Full name', required: true },
    { key: 'nameWithInitials', label: 'Name with initials' },
    { key: 'dob', label: 'Date of birth', type: 'date' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
    { key: 'grade', label: 'Grade', type: 'number', min: 1, max: 13 },
    { key: 'classId', label: 'Class', type: 'select', options: classOpts(), required: true },
    { key: 'guardianName', label: 'Guardian' },
    { key: 'relationship', label: 'Relationship', type: 'select', options: ['Father', 'Mother', 'Guardian'] },
    { key: 'phone', label: 'Telephone', type: 'tel' },
    { key: 'email', label: 'E-mail', type: 'email' },
    { key: 'address', label: 'Address', type: 'textarea', rows: 2 },
    { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending', 'Transferred', 'Left', 'Rejected'], dflt: 'Active' },
    { key: 'photo', label: 'Photograph', type: 'image', hint: 'Shown only inside the portals and on the student profile.' },
  ];

  function adStudents() {
    lastTable = crud('#adStudentsBody', {
      collection: 'schoolStudents', singular: 'Student', addLabel: 'Admit student',
      caption: 'Student admission records', view: true,
      searchPlaceholder: 'Search name, ID, admission number, guardian…',
      searchKeys: ['fullName', 'studentId', 'admissionNo', 'guardianName', 'email'],
      filters: [
        { key: 'classId', label: 'All classes', options: classOpts() },
        { key: 'status', label: 'Any status', options: ['Active', 'Pending', 'Transferred', 'Left', 'Rejected'] },
      ],
      toolbar: '<button type="button" class="btn btn--ghost" data-toolbar="import">⬆ Import roster</button>',
      onToolbar: (which, table) => { if (which === 'import') rosterImport(table); },
      fields: STUDENT_FIELDS(),
      titleOf: (r) => r.fullName + ' (' + r.studentId + ')',
      deleteNote: 'The portal sign-in for this student is removed with the record.',
      blockDelete: (r) => (SGC.db.all('schoolAttendance').some((a) => a.studentId === r.id)
        ? 'This student has attendance records. Remove those first.' : ''),
      cols: [
        { key: 'studentId', label: 'ID', sortable: true },
        { key: 'fullName', label: 'Student', sortable: true, cell: (r) =>
            '<div style="display:flex;align-items:center;gap:.55rem">' + U.avatarHTML({ fullName: r.fullName, photo: r.photo, folder: 'students' }, 32) +
            '<div><b>' + esc(r.fullName) + '</b><div class="muted" style="font-size:.76rem">' + esc(r.admissionNo || '') + '</div></div></div>' },
        { key: 'classId', label: 'Class', sortable: true, cell: (r) => esc(SGC.db.className(r.classId)) },
        { key: 'grade', label: 'Grade', num: true, sortable: true },
        { key: 'guardianName', label: 'Guardian', sortable: true },
        { key: 'phone', label: 'Telephone' },
        { key: 'status', label: 'Status', sortable: true, cell: (r) => '<span class="badge badge--' + statusVariant(r.status) + '">' + esc(r.status) + '</span>' },
      ],
      extraActions: (r) => (r.status === 'Pending'
        ? '<button type="button" class="btn btn--primary btn--icon" data-act="approve" data-id="' + esc(r.id) + '" title="Approve registration" aria-label="Approve ' + esc(r.fullName) + '">✔</button>' +
          '<button type="button" class="btn btn--ghost btn--icon" data-act="reject" data-id="' + esc(r.id) + '" title="Reject registration" aria-label="Reject ' + esc(r.fullName) + '">✕</button>'
        : ''),
      onAction: (act, rec, table) => {
        if (act === 'approve') { setStudentStatus(rec, 'Active'); toast('Student approved — they can now sign in.', 'success'); table.refresh(); return true; }
        if (act === 'reject') { setStudentStatus(rec, 'Rejected'); toast('Registration rejected.', 'info'); table.refresh(); return true; }
        return false;
      },
      afterSave: (rec, prior) => syncUser('student', rec, prior),
      afterDelete: (rec) => {
        const u = SGC.db.findData('schoolUsers', (x) => x.role === 'student' && x.linkedId === rec.id);
        if (u) SGC.db.deleteData('schoolUsers', u.id);
      },
    });
  }

  /* badge colour per student status */
  function statusVariant(s) {
    return s === 'Active' ? 'live' : s === 'Pending' ? 'gold' : s === 'Rejected' ? 'urgent' : 'draft';
  }

  /* Approving or rejecting a self-registered student keeps the admission
     record and its sign-in row in step. */
  function setStudentStatus(rec, status) {
    SGC.db.updateData('schoolStudents', rec.id, { status });
    const u = SGC.db.findData('schoolUsers', (x) => x.role === 'student' && x.linkedId === rec.id);
    if (u) SGC.db.updateData('schoolUsers', u.id, { status });
  }

  /* Google Sheets is import-only: paste the CSV (or fetch a configured
     public sheet), preview, then commit through the normal write path so
     it write-throughs to Firestore when a backend is live. */
  function rosterImport(table) {
    const cfg = global.SGC_FIREBASE || {};
    const hasUrl = !!cfg.rosterCsvUrl;
    U.modal({
      title: 'Import the student roster',
      body:
        '<p class="muted" style="margin-top:0">Paste rows exported from Google Sheets or any spreadsheet as CSV. ' +
        'The first line is a header. Recognised columns: <code>studentId, fullName, class, grade, admissionNo, guardianName, phone, email, status</code>. ' +
        'A row whose Student ID already exists updates that student; new IDs are admitted as Active. ' +
        'Empty cells are left alone, so a partial sheet never blanks a good record.</p>' +
        '<div class="field"><label class="label" for="rosterCsv">CSV data</label>' +
        '<textarea class="input" id="rosterCsv" rows="8" spellcheck="false" placeholder="studentId,fullName,class,admissionNo,guardianName,phone,email"></textarea></div>' +
        (hasUrl ? '<p style="margin:0"><button type="button" class="btn btn--ghost btn--sm" id="rosterFetch">Fetch from configured sheet</button></p>' : '') +
        '<p class="muted" id="rosterMsg" style="font-size:.82rem;margin:.6rem 0 0">Nothing pasted yet.</p>',
      footer: '<button type="button" class="btn btn--ghost" data-close>Cancel</button>' +
        '<button type="button" class="btn btn--primary" data-commit>Import students</button>',
      onOpen(m) {
        const ta = m.root.querySelector('#rosterCsv');
        const msg = m.root.querySelector('#rosterMsg');
        const parse = () => (SGC.backend && SGC.backend.sheets ? SGC.backend.sheets.parseCsv(ta.value) : []);
        ta.addEventListener('input', () => { m._fetched = null; const n = parse().length; msg.textContent = n ? n + ' row(s) ready to import.' : 'Nothing pasted yet.'; });
        const fetchBtn = m.root.querySelector('#rosterFetch');
        if (fetchBtn) fetchBtn.addEventListener('click', async () => {
          fetchBtn.disabled = true; msg.textContent = 'Fetching…';
          try {
            const rows = await SGC.backend.sheets.fetchRoster(cfg.rosterCsvUrl);
            m._fetched = rows;
            msg.textContent = rows.length + ' row(s) fetched from the sheet. Click Import students.';
          } catch (e) { msg.textContent = (e && e.message) || 'Could not fetch the sheet.'; }
          fetchBtn.disabled = false;
        });
        U.on(m.root, 'click', '[data-commit]', () => {
          const rows = (m._fetched && m._fetched.length) ? m._fetched : parse();
          if (!rows.length) { toast('Paste some CSV rows first.', 'error'); return; }
          const res = commitRoster(rows);
          toast(res.summary, 'success');
          m.close();
          if (table) table.refresh();
        });
      },
    });
  }

  function commitRoster(rows) {
    const classes = SGC.db.all('schoolClasses');
    const STATUSES = ['Active', 'Pending', 'Transferred', 'Left', 'Rejected'];
    const findClass = (txt) => {
      const t = String(txt || '').trim().toLowerCase();
      if (!t) return null;
      return classes.find((c) => String(c.id).toLowerCase() === t || String(c.name).toLowerCase() === t
        || t === 'grade ' + c.grade || t === 'grade' + c.grade || String(c.grade) === t) || null;
    };
    let added = 0, updated = 0, skipped = 0, unmatched = 0;
    rows.forEach((r) => {
      const sid = String(r.studentid || '').trim();
      if (!sid) { skipped++; return; }
      const cls = findClass(r.class);
      if (!cls && String(r.class || '').trim()) unmatched++;
      const existing = SGC.db.findData('schoolStudents', (x) => String(x.studentId).toLowerCase() === sid.toLowerCase());

      /* A spreadsheet is rarely complete. Only the cells that actually hold a
         value are written, so refreshing a name from the sheet cannot wipe the
         class, guardian or telephone already recorded for that student. */
      const patch = {};
      const set = (key, raw) => { const v = String(raw || '').trim(); if (v) patch[key] = v; };
      set('fullName', r.fullname);
      set('admissionNo', r.admissionno);
      set('guardianName', r.guardianname);
      set('phone', r.phone);
      set('email', r.email);
      if (cls) { patch.classId = cls.id; patch.grade = cls.grade; }
      else { const g = String(r.grade || '').replace(/\D/g, ''); if (g) { patch.grade = Number(g); } }
      const st = STATUSES.find((s) => s.toLowerCase() === String(r.status || '').trim().toLowerCase());
      if (existing) {
        if (!Object.keys(patch).length) return;
        if (st) patch.status = st;
        const merged = SGC.db.updateData('schoolStudents', existing.id, patch);
        syncUser('student', merged, existing);
        updated++;
      } else {
        patch.studentId = sid;
        if (!patch.fullName) patch.fullName = sid;
        patch.status = st || 'Active';
        const saved = SGC.db.insertData('schoolStudents', patch);
        syncUser('student', saved, null);
        added++;
      }
    });
    const parts = [];
    if (added) parts.push(added + ' added');
    if (updated) parts.push(updated + ' updated');
    if (skipped) parts.push(skipped + ' skipped (no Student ID)');
    if (unmatched) parts.push(unmatched + ' class name(s) not recognised — those rows kept their current class');
    return { added, updated, skipped, unmatched, summary: 'Roster import: ' + (parts.join('; ') || 'no changes') + '.' };
  }

  /* A student or teacher record and its sign-in must never drift apart. */
  function syncUser(role, rec, prior) {
    const id = role === 'student' ? rec.studentId : rec.teacherId;
    const idKey = String(id || '').toLowerCase();
    /* A Pending registration must stay Pending on the sign-in record too —
       editing the student through the form must not silently activate it. */
    const acctStatus = rec.status === 'Active' ? 'Active' : rec.status === 'Pending' ? 'Pending' : 'Inactive';
    const existing = SGC.db.findData('schoolUsers', (x) => x.role === role && x.linkedId === (prior ? prior.id : rec.id));
    const patch = { identifier: id, idKey, name: rec.fullName, linkedId: rec.id, status: acctStatus };
    if (existing) { SGC.db.updateData('schoolUsers', existing.id, patch); return; }
    if (prior) return;
    SGC.db.insertData('schoolUsers', {
      id: 'U-' + idKey, role, identifier: id, idKey, name: rec.fullName, linkedId: rec.id,
      demoPassword: SGC.auth.DEMO_PASSWORDS[role], status: acctStatus,
      createdAt: U.nowISO(), lastLogin: '',
    });
  }

  const TEACHER_FIELDS = () => [
    { key: 'teacherId', label: 'Staff number', required: true, hint: 'Used to sign in, e.g. T006' },
    { key: 'fullName', label: 'Full name', required: true },
    { key: 'department', label: 'Department', type: 'select', options: departments(), required: true },
    { key: 'position', label: 'Position', placeholder: 'e.g. Senior Teacher' },
    { key: 'subjectIds', label: 'Subjects taught', type: 'checks', options: subjectOpts(), full: true },
    { key: 'phone', label: 'Telephone', type: 'tel' },
    { key: 'email', label: 'College e-mail', type: 'email' },
    { key: 'joinedOn', label: 'Joined the college', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: ['Active', 'On leave', 'Retired'], dflt: 'Active' },
    { key: 'address', label: 'Address', type: 'textarea', rows: 2, full: true },
    { key: 'bio', label: 'Biography for the public staff card', type: 'textarea', rows: 4, full: true },
    { key: 'photo', label: 'Photograph', type: 'image', hint: 'Appears on the public Teachers page.' },
  ];

  function adTeachers() {
    lastTable = crud('#adTeachersBody', {
      collection: 'schoolTeachers', singular: 'Teacher', addLabel: 'Add teacher',
      caption: 'Teaching staff records',
      searchPlaceholder: 'Search name, department, position…',
      searchKeys: ['fullName', 'department', 'position', 'email'],
      filters: [
        { key: 'department', label: 'All departments', options: departments() },
        { key: 'status', label: 'Any status', options: ['Active', 'On leave', 'Retired'] },
      ],
      fields: TEACHER_FIELDS(),
      titleOf: (r) => r.fullName + ' (' + r.teacherId + ')',
      cols: [
        { key: 'teacherId', label: 'No.', sortable: true },
        { key: 'fullName', label: 'Teacher', sortable: true, cell: (r) =>
            '<div style="display:flex;align-items:center;gap:.55rem">' + U.avatarHTML({ fullName: r.fullName, photo: r.photo, folder: 'teachers' }, 32) +
            '<div><b>' + esc(r.fullName) + '</b><div class="muted" style="font-size:.76rem">' + esc(r.position || '') + '</div></div></div>' },
        { key: 'department', label: 'Department', sortable: true },
        { key: 'subjectIds', label: 'Subjects', cell: (r) => esc((r.subjectIds || []).map((id) => (SGC.db.findData('schoolSubjects', id) || {}).code || id).join(', ') || '—') },
        { key: 'email', label: 'E-mail' },
        { key: 'status', label: 'Status', sortable: true, cell: (r) => '<span class="badge badge--' + (r.status === 'Active' ? 'live' : 'draft') + '">' + esc(r.status) + '</span>' },
      ],
      afterSave: (rec, prior) => syncUser('teacher', rec, prior),
      afterDelete: (rec) => {
        const u = SGC.db.findData('schoolUsers', (x) => x.role === 'teacher' && x.linkedId === rec.id);
        if (u) SGC.db.deleteData('schoolUsers', u.id);
      },
    });
  }

  /* ---------------- academic structure ---------------- */
  function adClasses() {
    lastTable = crud('#adClassesBody', {
      collection: 'schoolClasses', singular: 'Class', addLabel: 'Add class',
      caption: 'Classes and rooms',
      searchPlaceholder: 'Search class, stream, room…',
      searchKeys: ['name', 'stream', 'room'],
      filters: [{ key: 'grade', label: 'Any grade', options: Array.from(new Set(SGC.db.all('schoolClasses').map((c) => c.grade))).sort((a, b) => a - b).map((g) => ({ value: g, label: 'Grade ' + g })) }],
      fields: [
        { key: 'name', label: 'Class name', required: true, placeholder: 'e.g. Grade 10 - Science' },
        { key: 'grade', label: 'Grade', type: 'number', min: 1, max: 13, required: true },
        { key: 'stream', label: 'Stream', type: 'select', options: streams().concat(['Parallel', 'Science', 'Commerce', 'Arts', 'Technology']) },
        { key: 'room', label: 'Room' },
        { key: 'capacity', label: 'Capacity', type: 'number', min: 1, max: 90 },
      ],
      titleOf: (r) => r.name,
      blockDelete: (r) => (SGC.db.all('schoolStudents').some((s) => s.classId === r.id)
        ? 'Students are still registered in ' + r.name + '. Move them first.' : ''),
      cols: [
        { key: 'name', label: 'Class', sortable: true },
        { key: 'grade', label: 'Grade', num: true, sortable: true },
        { key: 'stream', label: 'Stream', sortable: true },
        { key: 'room', label: 'Room' },
        { key: 'id', label: 'Students', num: true, cell: (r) => esc(String(SGC.db.all('schoolStudents').filter((s) => s.classId === r.id).length)) },
        { key: 'capacity', label: 'Capacity', num: true, sortable: true },
      ],
    });
  }

  function adSubjects() {
    lastTable = crud('#adSubjectsBody', {
      collection: 'schoolSubjects', singular: 'Subject', addLabel: 'Add subject',
      caption: 'Subjects on the curriculum',
      searchPlaceholder: 'Search subject, code, department…',
      searchKeys: ['name', 'nameSi', 'code', 'department'],
      filters: [{ key: 'department', label: 'All departments', options: departments() }],
      fields: [
        { key: 'name', label: 'Subject (English)', required: true },
        { key: 'nameSi', label: 'Subject (Sinhala)', hint: 'Shown when a visitor switches to සිංහල.' },
        { key: 'code', label: 'Code', required: true, maxlength: 4, placeholder: 'ICT' },
        { key: 'band', label: 'Grade band', placeholder: 'e.g. Junior Secondary' },
        { key: 'department', label: 'Department', type: 'select', options: departments().concat(['Languages', 'Mathematics', 'Science', 'Humanities', 'Commerce', 'Arts', 'Technology', 'Religion', 'Sports']) },
        { key: 'core', label: 'Core subject for every student', type: 'switch', dflt: false },
      ],
      titleOf: (r) => r.name,
      blockDelete: (r) => (SGC.db.all('schoolTimetable').some((t) => t.subjectId === r.id)
        ? r.name + ' is still on a period timetable.' : ''),
      cols: [
        { key: 'code', label: 'Code', sortable: true },
        { key: 'name', label: 'Subject', sortable: true, cell: (r) => '<b>' + esc(r.name) + '</b>' + (r.nameSi ? '<div class="muted" style="font-size:.76rem">' + esc(r.nameSi) + '</div>' : '') },
        { key: 'band', label: 'Band' },
        { key: 'department', label: 'Department', sortable: true },
        { key: 'core', label: 'Core', cell: (r) => yesNo(r.core) },
      ],
    });
  }

  /* ---------------- publishing ---------------- */
  function adNotices() {
    const db = SGC.db;
    lastTable = crud('#adNoticesBody', {
      collection: 'schoolNotices', singular: 'Notice', addLabel: 'New notice', view: true,
      caption: 'School notices', pageSize: 12,
      searchPlaceholder: 'Search title or text…',
      searchKeys: ['title', 'titleSi', 'body', 'author'],
      filters: [
        { key: 'category', label: 'All categories', options: SGC.notices.CATEGORIES },
        { key: 'priority', label: 'Any priority', options: SGC.notices.PRIORITIES },
        { key: 'published', label: 'Published and drafts', options: [{ value: 'true', label: 'Published only' }, { value: 'false', label: 'Drafts only' }] },
      ],
      defaults: () => ({ date: todayISO(), category: 'General', priority: 'Normal', audience: ['student'], published: true, author: 'Administration', views: 0 }),
      fields: [
        { key: 'title', label: 'Title (English)', required: true, full: true },
        { key: 'titleSi', label: 'Title (Sinhala)', full: true },
        { key: 'body', label: 'Notice text (English)', type: 'textarea', rows: 5, required: true, full: true },
        { key: 'bodySi', label: 'Notice text (Sinhala)', type: 'textarea', rows: 5, full: true },
        { key: 'date', label: 'Published on', type: 'date', required: true },
        { key: 'expiryDate', label: 'Expires after', type: 'date', hint: 'Leave empty to keep it live until unpublished.' },
        { key: 'category', label: 'Category', type: 'select', options: SGC.notices.CATEGORIES, required: true },
        { key: 'priority', label: 'Priority', type: 'select', options: SGC.notices.PRIORITIES, dflt: 'Normal' },
        { key: 'audience', label: 'Addressed to', type: 'checks', options: SGC.notices.AUDIENCES, full: true },
        { key: 'author', label: 'Author / office' },
        { key: 'published', label: 'Published (visible on the website)', type: 'switch', dflt: true },
        { key: 'attachment', label: 'Attachment (PDF)', type: 'file' },
      ],
      titleOf: (r) => r.title,
      cols: [
        { key: 'date', label: 'Date', sortable: true, cell: (r) => esc(formatDate(r.date)) },
        { key: 'title', label: 'Notice', sortable: true, cell: (r) => '<b>' + esc(r.title) + '</b>' +
            (r.priority === 'Urgent' || r.priority === 'High' ? ' <span class="badge badge--urgent">Important</span>' : '') +
            '<div class="muted" style="font-size:.76rem">' + esc((r.audience || []).join(', ') || 'everyone') + ' · ' + esc(r.author || '') + '</div>' },
        { key: 'category', label: 'Category', sortable: true, cell: (r) => '<span class="badge ' + SGC.notices.catClass(r.category) + '">' + esc(r.category) + '</span>' },
        { key: 'priority', label: 'Priority', sortable: true },
        { key: 'published', label: 'Live', cell: (r) => (r.published ? '<span class="badge badge--live">Published</span>' : '<span class="badge badge--draft">Draft</span>') },
        { key: 'views', label: 'Views', num: true, sortable: true, cell: (r) => esc(money(r.views || 0)) },
        { key: '_t', label: '', cell: (r) => '<button type="button" class="btn btn--ghost btn--sm" data-toggle="' + esc(r.id) + '">' + (r.published ? 'Unpublish' : 'Publish') + '</button>' },
      ],
    });
    if (lastTable) U.on(lastTable.root, 'click', '[data-toggle]', (e, btn) => {
      const n = SGC.db.findData('schoolNotices', btn.dataset.toggle);
      if (!n) return;
      SGC.db.updateData('schoolNotices', n.id, { published: !n.published });
      toast(n.published ? 'Notice moved back to drafts.' : 'Notice published to the website.', 'success');
      lastTable.refresh();
    });
  }

  function adUpdates() {
    lastTable = crud('#adUpdatesBody', {
      collection: 'schoolUpdates', singular: 'Update', addLabel: 'New update',
      caption: 'News and updates',
      searchPlaceholder: 'Search headline or text…',
      searchKeys: ['title', 'titleSi', 'excerpt', 'content', 'author'],
      filters: [{ key: 'category', label: 'All categories', options: SGC.updates.CATEGORIES }],
      defaults: () => ({ date: todayISO(), category: 'General', author: 'Media Unit', views: 0, likes: 0, featured: false, published: true, status: 'Published' }),
      fields: [
        { key: 'title', label: 'Headline (English)', required: true, full: true },
        { key: 'titleSi', label: 'Headline (Sinhala)', full: true },
        { key: 'excerpt', label: 'Standfirst', type: 'textarea', rows: 2, required: true, full: true },
        { key: 'content', label: 'Full article', type: 'textarea', rows: 8, full: true },
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'category', label: 'Category', type: 'select', options: SGC.updates.CATEGORIES },
        { key: 'author', label: 'Written by' },
        { key: 'featured', label: 'Feature on the home page', type: 'switch', dflt: false },
        { key: 'published', label: 'Published', type: 'switch', dflt: true },
        { key: 'image', label: 'Lead photograph', type: 'image' },
      ],
      titleOf: (r) => r.title,
      afterSave: (rec, prior) => { if (!prior) { rec.status = rec.published ? 'Published' : 'Draft'; SGC.db.updateData('schoolUpdates', rec.id, { status: rec.status }); } },
      cols: [
        { key: 'date', label: 'Date', sortable: true, cell: (r) => esc(formatDate(r.date)) },
        { key: 'title', label: 'Headline', sortable: true, cell: (r) => '<b>' + esc(r.title) + '</b>' +
            (r.featured ? ' <span class="badge badge--gold">Featured</span>' : '') +
            '<div class="muted" style="font-size:.76rem">' + esc(r.author || '') + '</div>' },
        { key: 'category', label: 'Category', sortable: true, cell: (r) => '<span class="badge">' + esc(r.category) + '</span>' },
        { key: 'views', label: 'Views', num: true, sortable: true },
        { key: 'likes', label: 'Likes', num: true, sortable: true },
        { key: 'published', label: 'Live', cell: (r) => (r.published === false ? '<span class="badge badge--draft">Draft</span>' : '<span class="badge badge--live">Published</span>') },
      ],
    });
  }

  function adEvents() {
    lastTable = crud('#adEventsBody', {
      collection: 'schoolEvents', singular: 'Event', addLabel: 'New event',
      caption: 'College events',
      searchPlaceholder: 'Search event, venue, organiser…',
      searchKeys: ['title', 'titleSi', 'venue', 'organizer', 'description'],
      filters: [{ key: 'category', label: 'All categories', options: SGC.events.CATEGORIES }],
      defaults: () => ({ date: todayISO(), category: 'General', startTime: '09:00', endTime: '12:00', venue: st().address }),
      fields: [
        { key: 'title', label: 'Title (English)', required: true, full: true },
        { key: 'titleSi', label: 'Title (Sinhala)', full: true },
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'category', label: 'Category', type: 'select', options: SGC.events.CATEGORIES },
        { key: 'startTime', label: 'Starts', type: 'time' },
        { key: 'endTime', label: 'Ends', type: 'time' },
        { key: 'venue', label: 'Venue (English)' },
        { key: 'venueSi', label: 'Venue (Sinhala)' },
        { key: 'organizer', label: 'Organised by' },
        { key: 'description', label: 'Description', type: 'textarea', rows: 4, full: true },
        { key: 'image', label: 'Poster photograph', type: 'image' },
      ],
      titleOf: (r) => r.title,
      cols: [
        { key: 'date', label: 'Date', sortable: true, cell: (r) => esc(formatDate(r.date)) },
        { key: 'title', label: 'Event', sortable: true, cell: (r) => '<b>' + esc(r.title) + '</b>' +
            '<div class="muted" style="font-size:.76rem">' + esc(SGC.events.timeRange(r)) + ' · ' + esc(r.venue || '') + '</div>' },
        { key: 'category', label: 'Category', sortable: true, cell: (r) => '<span class="badge">' + esc(r.category) + '</span>' },
        { key: 'organizer', label: 'Organiser' },
        { key: '_u', label: '', cell: (r) => (SGC.events.isUpcoming(r) ? '<span class="badge badge--live">Upcoming</span>' : '<span class="badge badge--draft">Past</span>') },
      ],
    });
  }

  function adGallery() {
    lastTable = crud('#adGalleryBody', {
      collection: 'schoolGallery', singular: 'Gallery item', addLabel: 'Upload photo', view: true,
      caption: 'Gallery photographs',
      searchPlaceholder: 'Search caption or category…',
      searchKeys: ['title', 'caption', 'category'],
      filters: [{ key: 'category', label: 'All categories', options: SGC.gallery.CATEGORIES }],
      defaults: () => ({ date: todayISO(), category: 'School' }),
      fields: [
        { key: 'title', label: 'Caption title', required: true, full: true },
        { key: 'category', label: 'Category', type: 'select', options: SGC.gallery.CATEGORIES, required: true },
        { key: 'date', label: 'Photographed on', type: 'date' },
        { key: 'src', label: 'Image file', type: 'image', required: true, full: true,
          hint: 'Stored in this browser for the demo. A backend build uploads to Firebase Storage, Supabase Storage or an assets folder.' },
        { key: 'caption', label: 'Long caption', type: 'textarea', rows: 3, full: true },
      ],
      titleOf: (r) => r.title,
      cols: [
        { key: 'src', label: '', cell: (r) => '<img src="' + esc(typeof r.src === 'string' ? U.rootURL(r.src) : '') + '" alt="" style="width:56px;height:40px;object-fit:cover;border-radius:6px" ' +
            'onerror="this.style.opacity=.25">' },
        { key: 'title', label: 'Title', sortable: true },
        { key: 'category', label: 'Category', sortable: true, cell: (r) => '<span class="badge">' + esc(r.category) + '</span>' },
        { key: 'date', label: 'Date', sortable: true, cell: (r) => esc(formatDate(r.date)) },
        { key: 'caption', label: 'Caption', cell: (r) => esc(String(r.caption || '—').slice(0, 60)) },
      ],
    });
  }

  function adAchievements() {
    lastTable = crud('#adAchievementsBody', {
      collection: 'schoolAchievements', singular: 'Achievement', addLabel: 'Record achievement',
      caption: 'Achievements and awards',
      searchPlaceholder: 'Search award, recipient…',
      searchKeys: ['title', 'recipient', 'description', 'level'],
      filters: [
        { key: 'category', label: 'All categories', options: SGC.achievements.CATEGORIES },
        { key: 'level', label: 'Any level', options: SGC.achievements.LEVELS },
      ],
      defaults: () => ({ date: todayISO(), level: 'School', category: 'Academic' }),
      fields: [
        { key: 'title', label: 'Achievement', required: true, full: true },
        { key: 'recipient', label: 'Who achieved it' },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'level', label: 'Level', type: 'select', options: SGC.achievements.LEVELS },
        { key: 'category', label: 'Category', type: 'select', options: SGC.achievements.CATEGORIES },
        { key: 'description', label: 'Description', type: 'textarea', rows: 3, full: true },
        { key: 'image', label: 'Photograph', type: 'image' },
      ],
      titleOf: (r) => r.title,
      cols: [
        { key: 'date', label: 'Date', sortable: true, cell: (r) => esc(formatDate(r.date)) },
        { key: 'title', label: 'Achievement', sortable: true, cell: (r) => '<b>' + esc(r.title) + '</b>' +
            '<div class="muted" style="font-size:.76rem">' + esc(r.recipient || '') + '</div>' },
        { key: 'level', label: 'Level', sortable: true, cell: (r) => '<span class="badge badge--gold">' + esc(r.level) + '</span>' },
        { key: 'category', label: 'Category', sortable: true },
      ],
    });
  }

  function adDownloads() {
    lastTable = crud('#adDownloadsBody', {
      collection: 'schoolDownloads', singular: 'Document', addLabel: 'Publish document',
      caption: 'Downloadable documents',
      searchPlaceholder: 'Search document…',
      searchKeys: ['title', 'fileName', 'description', 'category'],
      filters: [{ key: 'category', label: 'All categories', options: SGC.downloads.CATEGORIES }],
      defaults: () => ({ date: todayISO(), category: 'Circulars' }),
      fields: [
        { key: 'title', label: 'Document title', required: true, full: true },
        { key: 'category', label: 'Category', type: 'select', options: SGC.downloads.CATEGORIES, required: true },
        { key: 'date', label: 'Published on', type: 'date' },
        { key: 'fileName', label: 'File name', placeholder: 'form-2026.pdf',
          hint: 'Leave blank to use the file chosen below. Files served from assets/documents/.' },
        { key: 'file', label: 'Upload a file', type: 'file', full: true },
        { key: 'description', label: 'Short description', type: 'textarea', rows: 2, full: true },
      ],
      titleOf: (r) => r.title,
      afterSave: (rec) => {
        if (rec.file && rec.file.name) {
          SGC.db.updateData('schoolDownloads', rec.id, {
            fileName: rec.fileName || rec.file.name, size: rec.file.size, file: null,
          });
        }
      },
      cols: [
        { key: 'date', label: 'Date', sortable: true, cell: (r) => esc(formatDate(r.date)) },
        { key: 'title', label: 'Document', sortable: true, cell: (r) => '<b>' + esc(r.title) + '</b>' +
            '<div class="muted" style="font-size:.76rem">' + esc(r.fileName || '') + '</div>' },
        { key: 'category', label: 'Category', sortable: true, cell: (r) => '<span class="badge">' + esc(r.category) + '</span>' },
        { key: 'size', label: 'Size', num: true, cell: (r) => esc(r.size ? U.fileSize(r.size) : '—') },
      ],
    });
  }

  /* ---------------- messages ---------------- */
  function adMessages() {
    const mount = qs('#adMessagesBody');
    if (!mount) return;
    const rows = SGC.db.all('schoolMessages');
    const unreadCount = rows.filter((m) => !m.read).length;
    mount.innerHTML =
      D.widgets([
        { icon: '✉', value: String(rows.length), label: 'Messages on file' },
        { icon: '●', value: String(unreadCount), label: 'Unread', variant: unreadCount ? 'err' : 'ok' },
        { icon: '📇', value: String(rows.filter((m) => m.role === 'public' || !m.from).length), label: 'From the contact form' },
      ]) + spacer() + '<div class="dt-mount"></div>';

    const table = D.dataTable(qs('.dt-mount', mount), {
      caption: 'All correspondence', pageSize: 12,
      searchPlaceholder: 'Search subject or body…',
      searchKeys: ['subject', 'body', 'fromName'],
      filters: [{ key: 'read', label: 'Read and unread', options: [{ value: 'false', label: 'Unread only' }, { value: 'true', label: 'Read only' }] }],
      rows: () => SGC.db.all('schoolMessages'),
      empty: { title: 'No messages', text: 'Enquiries sent from the contact page arrive here.' },
      cols: [
        { key: 'date', label: 'Date', sortable: true, cell: (r) => esc(formatDate(r.date || r.createdAt)) },
        { key: 'fromName', label: 'From', sortable: true, cell: (r) => '<b>' + esc(r.fromName || r.from || 'Website visitor') + '</b>' +
            '<div class="muted" style="font-size:.76rem">to ' + esc(resolveName(r.to)) + '</div>' },
        { key: 'subject', label: 'Subject', sortable: true, cell: (r) => esc(r.subject || '—') +
            '<div class="muted" style="font-size:.76rem">' + esc(String(r.body || '').slice(0, 70)) + '…</div>' },
        { key: 'read', label: 'State', cell: (r) => (r.read ? '<span class="badge">Read</span>' : '<span class="badge badge--urgent">Unread</span>') },
        { key: '_a', label: '', cell: (r) => D.rowActions(r.id, { edit: false }) },
      ],
    });
    U.on(table.root, 'click', '[data-act]', (e, btn) => {
      const m = SGC.db.findData('schoolMessages', btn.dataset.id);
      if (!m) return;
      if (btn.dataset.act === 'del') {
        U.confirmDialog({ title: 'Delete message', message: m.subject || 'Untitled message',
          detail: 'Deleting correspondence is a records decision. This cannot be undone.', danger: true, confirmText: 'Delete' })
          .then((ok) => { if (!ok) return; SGC.db.deleteData('schoolMessages', m.id); toast('Message deleted.', 'info'); table.refresh(); refreshPills(); });
        return;
      }
      if (!m.read) SGC.db.updateData('schoolMessages', m.id, { read: true });
      U.modal({
        title: m.subject || 'Message',
        body: '<p class="muted" style="margin-top:0;font-size:.82rem">From ' + esc(resolveName(m.from)) +
          ' → ' + esc(resolveName(m.to)) + ' · ' + esc(formatDate(m.date || m.createdAt)) + '</p>' +
          '<div class="prose"><p style="white-space:pre-wrap">' + esc(m.body) + '</p></div>' +
          '<div class="field"><label class="label" for="ar">Reply from the office</label><textarea class="textarea" id="ar" rows="4"></textarea></div>' +
          '<button type="button" class="btn btn--primary" data-send>Send reply</button>',
        onOpen(modal) {
          U.on(modal.root, 'click', '[data-send]', () => {
            const text = qs('#ar', modal.root).value.trim();
            if (text.length < 5) { toast('Write a reply first.', 'error'); return; }
            SGC.db.insertData('schoolMessages', { from: 'admin', fromName: "Principal's Office", to: m.from,
              subject: 'Re: ' + (m.subject || 'your enquiry'), body: text, date: todayISO(), read: false,
              threadId: m.threadId || U.uid('TH'), role: 'admin' });
            toast('Reply sent to ' + resolveName(m.from) + '.', 'success');
            modal.close();
            table.refresh();
          });
        },
      });
      table.refresh();
      refreshPills();
    });
  }

  function resolveName(id) {
    if (!id) return 'unknown';
    if (id === 'all') return 'Everyone';
    if (id === 'admin') return "Principal's Office";
    const t = SGC.db.findData('schoolTeachers', id);
    if (t) return t.fullName;
    const s = SGC.db.findData('schoolStudents', id);
    if (s) return s.fullName;
    return id;
  }

  /* ---------------- college settings ----------------
     A settings group is [title, fields, from, to, note]:
       from(settings) → flat values for the form
       to(values, settings) → the patch written back to schoolSettings
     so nested objects (announcement, values, highlights) stay one call away. */
  function settingsForm(host, group) {
    const title = group[0], fields = group[1], from = group[2], to = group[3], note = group[4];
    const mount = qs(host);
    if (!mount) return;
    const draw = () => {
      const v = from(st());
      mount.innerHTML = D.panel({
        title,
        action: '<button type="button" class="btn btn--ghost btn--sm" data-open>Change</button>',
        body: (note ? '<p class="muted" style="margin-top:0">' + esc(note) + '</p>' : '') +
          '<dl class="info-grid">' + fields.map((f) => {
            let x = v[f.key];
            if (Array.isArray(x)) x = x.join(' · ');
            else if (typeof x === 'boolean') x = x ? 'Yes' : 'No';
            else if (f.options && x) x = labelFor(f.options, x);
            x = String(x === undefined || x === '' ? '—' : x);
            return '<dt>' + esc(f.label) + '</dt><dd>' + esc(x.length > 170 ? x.slice(0, 170) + '…' : x) + '</dd>';
          }).join('') + '</dl>',
      });
    };
    draw();
    if (mount.dataset.wired) return;
    mount.dataset.wired = '1';
    U.on(mount, 'click', '[data-open]', () => {
      const s = st();
      D.formModal({
        title: 'Edit · ' + title,
        values: from(s),
        fields,
        submitLabel: 'Save to college settings',
        onSubmit: (vals, m) => {
          SGC.db.saveSettings(to(vals, s));
          toast('College settings saved. Every page picks them up on the next load.', 'success');
          m.close();
          draw();
        },
      });
    });
  }

  function adSchool() {
    const mount = qs('#adSchoolBody');
    if (!mount) return;
    const s = st();
    mount.innerHTML =
      '<div class="split" id="schoolPanels"></div>' +
      spacer() +
      D.panel({ title: 'Home page statistics', body:
        '<p class="muted" style="margin-top:0">These four figures drive the animated counters on the home page.</p>' +
        '<div class="grid grid-2">' + Object.keys(s.stats || {}).map((k) =>
          '<div class="mini"><div><b>' + esc(k) + '</b><span>' + esc(String(s.stats[k])) + '</span></div></div>').join('') + '</div>' +
        spacer() + '<button type="button" class="btn btn--ghost btn--sm" data-stats>Change statistics</button>' }) +
      spacer() +
      D.panel({ title: 'Danger zone', body:
        '<p class="muted" style="margin-top:0">This demonstration keeps every record in this browser. Resetting restores the ' +
        'sample college data and removes anything you have added — it does not touch another device.</p>' +
        '<button type="button" class="btn btn--danger btn--sm" data-reset>Reset demonstration data</button>' });

    const panels = qs('#schoolPanels');
    /* Flat keys read and write straight off schoolSettings; the three helpers
       below keep the nested list settings editable in ordinary textareas. */
    const flat = (ks) => (s) => ks.reduce((a, k) => { a[k] = s[k]; return a; }, {});
    const flatTo = (ks) => (v) => ks.reduce((a, k) => { a[k] = v[k]; return a; }, {});
    const hiText = (list) => (list || []).map((h) => (h.icon || '') + ' ' + h.title + ' | ' + h.text).join('\n');
    const hiParse = (txt) => lines(txt).map((l) => {
      const i = l.indexOf('|');
      const left = (i > -1 ? l.slice(0, i) : l).trim();
      /* an emoji is a surrogate pair, so compare whole code points not chars */
      const cp = Array.from(left)[0] || '';
      const hasIcon = /\p{Extended_Pictographic}/u.test(cp);
      return { icon: hasIcon ? cp : '◈', title: hasIcon ? left.slice(cp.length).trim() : left, text: i > -1 ? l.slice(i + 1).trim() : '' };
    });

    const IDENTITY = ['schoolName', 'schoolNameSi', 'schoolTag', 'schoolTagSi', 'shortName', 'founded', 'code', 'motto', 'mottoSi'];
    const CONTACT = ['address', 'addressSi', 'phone', 'phone2', 'email', 'email2', 'hours', 'mapQuery',
      'facebook', 'instagram', 'youtube', 'linkedin', 'footerNote'];
    const ABOUT = ['about', 'aboutSi', 'history', 'historySi', 'vision', 'visionSi', 'mission', 'missionSi'];

    const groups = [
      ['Identity', [
        { key: 'schoolName', label: 'School name (English)', required: true },
        { key: 'schoolNameSi', label: 'School name (Sinhala)' },
        { key: 'schoolTag', label: 'Designation (English)', placeholder: 'National School' },
        { key: 'schoolTagSi', label: 'Designation (Sinhala)' },
        { key: 'shortName', label: 'Short name', maxlength: 8 },
        { key: 'founded', label: 'Founded', maxlength: 6 },
        { key: 'code', label: 'School code' },
        { key: 'motto', label: 'Motto (English)' },
        { key: 'mottoSi', label: 'Motto (Sinhala)' },
      ], flat(IDENTITY), flatTo(IDENTITY),
        'Shown in the navigation bar, the login page, every dashboard and the footer.'],
      ['Contact and location', [
        { key: 'address', label: 'Address (English)', type: 'textarea', rows: 2, full: true },
        { key: 'addressSi', label: 'Address (Sinhala)', type: 'textarea', rows: 2, full: true },
        { key: 'phone', label: 'Telephone' }, { key: 'phone2', label: 'Second line' },
        { key: 'email', label: 'E-mail', type: 'email' }, { key: 'email2', label: 'Second e-mail', type: 'email' },
        { key: 'hours', label: 'Office hours' },
        { key: 'mapQuery', label: 'Google Maps search string', full: true, hint: 'The contact page embeds a map built from this text.' },
        { key: 'facebook', label: 'Facebook' }, { key: 'instagram', label: 'Instagram' },
        { key: 'youtube', label: 'YouTube' }, { key: 'linkedin', label: 'LinkedIn' },
        { key: 'footerNote', label: 'Footer note', type: 'textarea', rows: 2, full: true },
      ], flat(CONTACT), flatTo(CONTACT)],
      ['Announcement bar', [
        { key: 'annActive', label: 'Show the bar', type: 'switch', dflt: true },
        { key: 'annText', label: 'Text (English)', type: 'textarea', rows: 2, full: true },
        { key: 'annTextSi', label: 'Text (Sinhala)', type: 'textarea', rows: 2, full: true },
        { key: 'annLink', label: 'Link target', placeholder: 'pages/notices.html', full: true },
      ], (s) => { const a = s.announcement || {}; return { annActive: !!a.active, annText: a.text, annTextSi: a.textSi, annLink: a.link }; },
        (v) => ({ announcement: { active: !!v.annActive, text: v.annText, textSi: v.annTextSi, link: v.annLink } }),
        'The bar at the very top of every public page. Visitors can dismiss it for the session.'],
      ['About the college', [
        { key: 'about', label: 'Introduction (English)', type: 'textarea', rows: 5, full: true },
        { key: 'aboutSi', label: 'Introduction (Sinhala)', type: 'textarea', rows: 5, full: true },
        { key: 'history', label: 'History (English)', type: 'textarea', rows: 6, full: true },
        { key: 'historySi', label: 'History (Sinhala)', type: 'textarea', rows: 6, full: true },
        { key: 'vision', label: 'Vision', type: 'textarea', rows: 3, full: true },
        { key: 'visionSi', label: 'Vision (Sinhala)', type: 'textarea', rows: 3, full: true },
        { key: 'mission', label: 'Mission', type: 'textarea', rows: 3, full: true },
        { key: 'missionSi', label: 'Mission (Sinhala)', type: 'textarea', rows: 3, full: true },
      ], flat(ABOUT), flatTo(ABOUT)],
      ['Curriculum and character', [
        { key: 'facilities', label: 'Facilities (one per line)', type: 'textarea', rows: 8, full: true },
        { key: 'valuesText', label: 'Values (Title | sentence, one per line)', type: 'textarea', rows: 6, full: true },
        { key: 'highlightsText', label: 'Home highlights (emoji Title | sentence, one per line)', type: 'textarea', rows: 6, full: true },
      ], (s) => ({ facilities: (s.facilities || []).join('\n'), valuesText: pairsText(s.values), highlightsText: hiText(s.highlights) }),
        (v) => ({ facilities: lines(v.facilities), values: pairs(v.valuesText), highlights: hiParse(v.highlightsText) }),
        'Facilities list one item per line. Values and highlights use a title, a pipe, then the sentence.'],
    ];

    panels.innerHTML = '';
    groups.forEach((g, i) => {
      const id = 'schoolPanel' + i;
      const host = document.createElement('div');
      host.id = id;
      panels.appendChild(host);
      settingsForm('#' + id, g);
    });

    U.on(mount, 'click', '[data-stats]', () => {
      const cur = st().stats || {};
      D.formModal({
        title: 'Home page statistics',
        values: Object.keys(cur).reduce((a, k) => { a[k] = cur[k]; return a; }, {}),
        fields: Object.keys(cur).map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), type: 'number', min: 0, max: 99999 })),
        submitLabel: 'Save statistics',
        onSubmit: (v, m) => {
          SGC.db.saveSettings({ stats: Object.assign({}, cur, v) });
          toast('Statistics updated. The home page counters animate to the new values.', 'success');
          m.close(); adSchool();
        },
      });
    });
    U.on(mount, 'click', '[data-reset]', () => {
      U.confirmDialog({
        title: 'Reset demonstration data',
        message: 'Replace every record with the sample college data?',
        detail: 'Students, teachers, notices, uploads and settings you created are removed from this browser. You will be signed out.',
        danger: true, confirmText: 'Reset everything',
      }).then((ok) => {
        if (!ok) return;
        SGC.db.resetDemoData();
        SGC.auth.logout();
        toast('Demonstration data restored. Reloading…', 'info');
        setTimeout(() => { global.location.href = 'index.html'; }, 900);
      });
    });
  }

  function adPrincipal() {
    const mount = qs('#adPrincipalBody');
    if (!mount) return;
    const p = st().principal || {};
    mount.innerHTML = D.panel({
      title: 'Principal\u2019s message',
      action: '<button type="button" class="btn btn--ghost btn--sm" data-open>Change</button>',
      body: '<div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;align-items:flex-start">' +
        '<div style="width:96px;flex:none">' + U.avatarHTML({ fullName: p.name, photo: p.photo, folder: 'uploads' }, 96) + '</div>' +
        '<div style="flex:1;min-width:200px"><b>' + esc(p.name) + '</b>' +
        '<div class="muted" style="font-size:.82rem">' + esc(p.position) + ' since ' + esc(p.since) + '</div>' +
        '<p style="margin-top:.6rem;font-size:.9rem;color:var(--text-2)">' + esc(String(p.message || '').split('\n\n')[0].slice(0, 260)) + '…</p></div></div>',
    });
    const fields = [
      { key: 'name', label: 'Name', required: true },
      { key: 'nameSi', label: 'Name (Sinhala)' },
      { key: 'position', label: 'Position', dflt: 'Principal' },
      { key: 'since', label: 'In post since', maxlength: 6 },
      { key: 'photo', label: 'Portrait', type: 'image', full: true },
      { key: 'message', label: 'Message (blank line between paragraphs)', type: 'textarea', rows: 12, full: true },
      { key: 'messageSi', label: 'Message (Sinhala)', type: 'textarea', rows: 6, full: true },
    ];
    U.on(mount, 'click', '[data-open]', () => {
      D.formModal({
        title: 'Edit the principal\u2019s message', values: p, fields,
        uploadScope: 'schoolSettings',
        submitLabel: 'Publish message',
        onSubmit: (v, m) => {
          SGC.db.saveSettings({ principal: Object.assign({}, p, v) });
          toast('Principal\u2019s message updated on the home and About pages.', 'success');
          m.close(); adPrincipal();
        },
      });
    });
  }

  function adSettings() {
    const mount = qs('#adSettingsBody');
    if (!mount) return;
    mount.innerHTML =
      D.panel({ title: 'Console preferences', body:
        D.setRow({ title: 'Language', text: 'Sinhala labels the console and switches content that carries a Sinhala version.',
          control: '<div class="row-actions"><button type="button" class="btn btn--ghost btn--sm" data-lang="en">English</button>' +
            '<button type="button" class="btn btn--ghost btn--sm" data-lang="si">සිංහල</button></div>' }) +
        D.setRow({ title: 'Appearance', text: 'Dark mode is remembered on this device and shared with the public site.',
          control: '<button type="button" class="btn btn--ghost btn--sm" data-theme-toggle>Toggle dark mode</button>' }) +
        D.setRow({ title: 'Sign-in', text: 'Kept alive for this browser tab; tick "remember me" on the login page to persist it.',
          control: '<button type="button" class="btn btn--ghost btn--sm" data-signout>Sign out</button>' }) }) +
      spacer() +
      D.panel({ title: 'Password', body:
        '<p class="muted" style="margin-top:0">Administrator credentials are never printed anywhere on the website — ' +
        'not on the login page, not in a dashboard, not in the source comments. Change the demo password here.</p>' +
        '<form id="pwForm"><div class="form-grid">' +
          '<div class="field"><label class="label" for="pw1">New password</label><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="6"></div>' +
          '<div class="field"><label class="label" for="pw2">Repeat password</label><input class="input" id="pw2" type="password" autocomplete="new-password" minlength="6"></div>' +
        '</div><button class="btn btn--primary" type="submit">Change password</button></form>' }) +
      spacer() +
      D.panel({ title: 'Accounts', flush: true, body:
        '<div class="panel__body"><p class="muted" style="margin-top:0">Sign-ins exist for every student and teacher record, ' +
        'plus the office account below. Student and teacher accounts are created and removed automatically with their records.</p></div>' +
        D.tableHTML({
          caption: 'Sign-in accounts',
          cols: [
            { key: 'identifier', label: 'Sign-in', sortable: true },
            { key: 'role', label: 'Role', sortable: true, cell: (r) => '<span class="badge badge--' + (r.role === 'admin' ? 'admin' : 'general') + '">' + esc(r.role) + '</span>' },
            { key: 'name', label: 'Name', sortable: true },
            { key: 'status', label: 'Status', cell: (r) => '<span class="badge badge--' + (r.status === 'Active' ? 'live' : 'draft') + '">' + esc(r.status) + '</span>' },
            { key: 'lastLogin', label: 'Last sign-in', cell: (r) => esc(r.lastLogin ? new Date(r.lastLogin).toLocaleString() : 'never') },
          ],
          rows: SGC.db.all('schoolUsers').filter((u) => u.role === 'admin'),
        }) });

    qs('#pwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const a = qs('#pw1').value, b = qs('#pw2').value;
      if (a !== b) { toast('The two passwords do not match.', 'error'); return; }
      const r = await SGC.auth.setPassword(sess.userId, a);
      toast(r.ok ? 'Password changed. Sign in with it next time.' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) { qs('#pw1').value = ''; qs('#pw2').value = ''; }
    });
    if (!mount.dataset.wired) {
      mount.dataset.wired = '1';
      U.on(mount, 'click', '[data-signout]', () => {
        SGC.auth.logout();
        toast('You have been signed out.', 'info');
        setTimeout(() => { global.location.href = 'index.html'; }, 500);
      });
    }
  }

  const spacer = () => '<div style="height:var(--sp-3)"></div>';

  function refreshPills() {
    const m = qs('#pillMessages');
    if (m) { const c = SGC.db.all('schoolMessages').filter((x) => !x.read).length; m.textContent = c ? String(c) : ''; m.hidden = !c; }
  }

  const VIEWS = { adHome, adStudents, adTeachers, adClasses, adSubjects, adNotices, adUpdates,
    adEvents, adGallery, adAchievements, adDownloads, adMessages, adSchool, adPrincipal, adSettings };
  Object.keys(VIEWS).forEach((k) => { SGC.pages[k] = VIEWS[k]; });

  const activeView = () => { const v = qs('.view.is-active'); return v ? v.dataset.view : 'adHome'; };

  SGC.pages['admin-dashboard'] = {
    init() {
      /* The only real protection is a server that refuses the request.
         This check exists so the demo behaves like a protected area. */
      sess = SGC.auth.requireAuth(['admin']);
      if (!sess) return;
      D.shell(sess, 'Administration · full access');
      refreshPills();
      adHome();
      document.addEventListener('sgc:lang', () => { const fn = VIEWS[activeView()]; if (fn) fn(); });
    },
  };
})(window);
