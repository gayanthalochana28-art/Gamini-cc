/* =================================================================
   SRI GAMINI CENTRAL COLLEGE — public content pages
   Shared renderers (downloads, achievements) + the about, academic,
   contact, downloads and achievements page controllers.
   ================================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const { esc, qs, qsa, formatDate, fileSize, debounce, matches } = SGC.utils;
  const loc = (o, f) => SGC.i18n.loc(o, f);

  /* Google Maps embed needs no API key — a plain query URL is enough. */
  function mapURL(query) {
    return 'https://www.google.com/maps?q=' + encodeURIComponent(query || 'Sri Lanka') + '&output=embed&z=14';
  }

  /* ================= downloads ================= */
  const DL_CATEGORIES = ['Timetables', 'Forms', 'Circulars', 'Exam Papers', 'Prospectus', 'Reports', 'Policies'];

  function kindOf(d) {
    const ext = String(d.fileName || d.url || d.title || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return { icon: '📄', label: 'PDF' };
    if (ext === 'doc' || ext === 'docx') return { icon: '📝', label: 'DOCX' };
    if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return { icon: '📊', label: 'XLSX' };
    if (ext === 'zip' || ext === 'rar') return { icon: '🗜', label: 'ZIP' };
    if (ext === 'jpg' || ext === 'png' || ext === 'jpeg') return { icon: '🖼', label: 'IMG' };
    return { icon: '📎', label: (ext || 'FILE').toUpperCase() };
  }

  function downloadHref(d) {
    /* A record either points at a hosted file or at assets/documents/<fileName>. */
    if (d.url && /^(https?:|\/|\.\.)/.test(d.url)) return d.url;
    if (d.url) return (SGC.base || '') + d.url;
    return (SGC.base || '') + 'assets/documents/' + encodeURIComponent(d.fileName || d.id);
  }

  function dlRow(d) {
    const k = kindOf(d);
    return '<div class="dl">' +
      '<span class="dl__icon" aria-hidden="true">' + k.icon + '</span>' +
      '<div class="dl__info">' +
        '<div class="dl__name">' + esc(d.title) + '</div>' +
        '<div class="dl__meta">' + esc(d.category) + ' · ' + esc(k.label) +
          (d.size ? ' · ' + esc(fileSize(d.size)) : '') + ' · ' + esc(formatDate(d.date)) + '</div>' +
        (d.description ? '<div class="dl__meta" style="margin-top:.25rem;color:var(--text-2)">' + esc(d.description) + '</div>' : '') +
      '</div>' +
      '<div class="row-actions">' +
        '<a class="btn btn--primary btn--sm" href="' + esc(downloadHref(d)) + '" download target="_blank" rel="noopener">' +
          '⬇ <span class="sr-only">Download ' + esc(d.title) + '</span></a>' +
      '</div></div>';
  }

  function renderDownloads(mount, items) {
    if (!mount) return;
    mount.innerHTML = items.length ? items.map(dlRow).join('')
      : SGC.utils.emptyState({ icon: '⬇', title: 'No documents', text: 'Nothing has been published in this category yet.' });
  }

  /* ================= achievements ================= */
  const ACH_CATEGORIES = ['Academic', 'Sports', 'Cultural', 'Arts', 'Service', 'Leadership'];
  const ACH_LEVELS = ['School', 'District', 'Provincial', 'National', 'International'];

  function achCard(a) {
    return '<article class="ach card card--hover" data-reveal>' +
      (a.image
        ? '<div class="ach__media"><img src="' + esc(SGC.utils.rootURL(a.image)) + '" alt="' + esc(a.title) + '" loading="lazy" onerror="this.remove()"></div>'
        : '<div class="ach__media" aria-hidden="true"></div>') +
      '<span class="ach__level">' + esc(a.level || 'School') + '</span>' +
      '<div class="ach__body">' +
        '<span class="badge">' + esc(a.category || 'Academic') + '</span>' +
        '<h4 style="margin:.5rem 0 .25rem">' + esc(a.title) + '</h4>' +
        (a.recipient ? '<p class="muted" style="font-size:.84rem;margin:0">' + esc(a.recipient) + '</p>' : '') +
        (a.description ? '<p style="font-size:.9rem;margin:.6rem 0 0">' + esc(a.description) + '</p>' : '') +
        '<p class="muted" style="font-size:.78rem;margin:.7rem 0 0">' + esc(formatDate(a.date)) + '</p>' +
      '</div></article>';
  }

  function renderAchievements(mount, items) {
    if (!mount) return;
    mount.innerHTML = items.length ? items.map(achCard).join('')
      : SGC.utils.emptyState({ icon: '🏆', title: 'No awards listed', text: 'Achievements added by the administration appear here.' });
    SGC.utils.scrollReveal(mount);
  }

  /* ================= filter wiring (shared by several pages) ================= */
  function wireFilters(opts) {
    const chips = qs(opts.chips), search = qs(opts.search);
    let cat = 'All', term = '';
    function paint() {
      const list = opts.source().filter((x) =>
        (cat === 'All' || String(x[opts.field]) === cat) && (!term || matches(x, term)));
      opts.render(list);
      const c = qs(opts.count);
      if (c) c.textContent = list.length + ' ' + opts.noun + (list.length === 1 ? '' : 's');
    }
    if (chips) {
      const used = opts.cats.filter((c) => opts.source().some((x) => String(x[opts.field]) === c));
      chips.innerHTML = ['All'].concat(used).map((c) =>
        '<button type="button" class="chip' + (c === cat ? ' is-active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('');
      chips.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        cat = b.dataset.cat;
        qsa('[data-cat]', chips).forEach((x) => x.classList.toggle('is-active', x === b));
        paint();
      });
    }
    if (search) search.addEventListener('input', debounce(() => { term = search.value.trim(); paint(); }, 180));
    paint();
    document.addEventListener('sgc:lang', paint);
  }

  /* ================= page controllers ================= */
  SGC.downloads = { CATEGORIES: DL_CATEGORIES, kindOf, downloadHref, dlRow, renderList: renderDownloads, mapURL };
  SGC.achievements = { CATEGORIES: ACH_CATEGORIES, LEVELS: ACH_LEVELS, cardHTML: achCard, renderList: renderAchievements };
  SGC.teachers = { cardHTML: teacherCardHTML, renderList: renderTeachers };
  SGC.principalCard = principalCardHTML;

  /* ---- About ---- */
  SGC.pages.about = {
    init() {
      const st = SGC.db.getSettings();
      const fill = (id, html) => { const n = qs('#' + id); if (n) n.innerHTML = html; };

      fill('aboutLead', '<p class="lead">' + esc(loc(st, 'about')) + '</p>');
      fill('aboutMotto', esc(loc(st, 'motto')));
      fill('aboutFacts', [
        ['Founded', st.founded], ['Status', loc(st, 'schoolTag')], ['School code', st.code],
        ['Grades', '1 – 13'], ['Address', loc(st, 'address')], ['Telephone', st.phone],
      ].map((r) => '<div class="fact"><span class="fact__k">' + esc(r[0]) + '</span><span class="fact__v">' + esc(r[1]) + '</span></div>').join(''));

      const hist = qs('#historyTimeline');
      if (hist) {
        const MILESTONES = [
          ['1951', 'The college opens', 'Two acres given by the village, thirty-one pupils and three teachers on the roll.'],
          ['1962', 'Taken under state control', 'Grades are expanded through to secondary and the first permanent block is built.'],
          ['1974', 'Central college status', 'Gazetted as a central college serving the wider division; the assembly hall opens.'],
          ['1987', 'Science block', 'Dedicated physics, chemistry and biology laboratories come into daily use.'],
          ['1998', 'National school', 'Declared a National School of the Ministry of Education.'],
          ['2004', 'Hall of fame', 'The hall of fame and the redevelopment of the college ground are completed.'],
          ['2019', 'Digital turn', 'The present principal is appointed and the ICT and robotics programme begins.'],
          ['2024', 'Record A/L results', 'Advanced Level passes reach an all-time high of ninety-four per cent.'],
        ];
        hist.innerHTML = MILESTONES.map((m) =>
          '<li><span class="timeline__year">' + esc(m[0]) + '</span>' +
          '<h3 style="font-size:1rem">' + esc(m[1]) + '</h3><p class="muted">' + esc(m[2]) + '</p></li>').join('');
      }

      fill('visionMission',
        '<div class="card card--accent"><div class="card__icon" aria-hidden="true">🔭</div><h3 class="card__title">Our vision</h3>' +
        '<p class="card__text">' + esc(loc(st, 'vision')) + '</p></div>' +
        '<div class="card card--accent"><div class="card__icon" aria-hidden="true">🎯</div><h3 class="card__title">Our mission</h3>' +
        '<p class="card__text">' + esc(loc(st, 'mission')) + '</p></div>');

      const vals = qs('#valuesGrid');
      if (vals) vals.innerHTML = (st.values || []).map((v, i) =>
        '<div class="card card--hover" data-reveal data-delay="' + (i % 4 + 1) + '"><div class="card__icon" aria-hidden="true">' +
        ['📏', '📚', '🤝', '🌱'][i % 4] + '</div><h3 class="card__title">' + esc(v.title) + '</h3>' +
        '<p class="card__text">' + esc(v.text) + '</p></div>').join('');

      const fac = qs('#facilitiesList');
      if (fac) fac.innerHTML = (st.facilities || []).map((f) => '<li>' + esc(f) + '</li>').join('');

      const pr = qs('#principalCard');
      if (pr) { pr.className = 'principal'; pr.innerHTML = principalCardHTML(st, { full: true }); }
    },
  };

  /* Principal's message block — used by home, about and the standalone page. */
  function principalCardHTML(st, opts) {
    const o = opts || {};
    const p = st.principal || {};
    const msg = loc(p, 'message') || '';
    const paras = msg.split('\n\n').filter(Boolean);
    const shown = o.full ? paras : paras.slice(0, 2);
    return '<div class="principal__photo">' +
        (p.photo ? '<img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" onerror="this.remove()">' : '') +
        (p.photo ? '' : '<span class="principal__ph" aria-hidden="true">👤</span>') +
      '</div>' +
      '<div>' +
        '<span class="eyebrow">From the desk of the principal</span>' +
        '<p class="principal__quote">“' + esc(shown[0] || 'Welcome to our college.') + '”</p>' +
        shown.slice(1).map((t) => '<p style="color:var(--text-2)">' + esc(t) + '</p>').join('') +
        (o.full && paras.length > shown.length
          ? '<a class="btn btn--ghost" href="' + (SGC.base || '') + 'pages/about.html#principal">Read the full message →</a>' : '') +
        '<p class="principal__sig" aria-hidden="true">' + esc(String(p.name || '').split(' ').slice(-1)[0] || '') + '</p>' +
        '<p class="principal__name" style="margin-bottom:0">' + esc(loc(p, 'name')) + '</p>' +
        '<p class="principal__role">' + esc(p.position || 'Principal') +
          (p.since ? ' · since ' + esc(p.since) : '') + '</p>' +
      '</div>';
  }

  /* ---- Academic ---- */
  SGC.pages.academics = {
    init() {
      const subs = SGC.db.all('schoolSubjects');
      const classes = SGC.db.all('schoolClasses');
      const st = SGC.db.getSettings();

      const bands = [
        { icon: '🧒', t: 'Primary', d: 'Grades 1 to 5 — literacy, numeracy, activity periods and the first steps in Sinhala, English and science.' },
        { icon: '🏫', t: 'Junior secondary', d: 'Grades 6 to 9 — the common curriculum, with electives opening in grade 7 and house sport for all.' },
        { icon: '🎓', t: 'Senior secondary', d: 'Grades 10 and 11 — taught in the parallel, science, commerce and arts streams, ending in the Ordinary Level examination.' },
        { icon: '📜', t: 'Advanced Level', d: 'Grades 12 and 13 — science, commerce, arts and technology streams with university guidance from the first term.' },
      ];
      const bg = qs('#bandGrid');
      if (bg) bg.innerHTML = bands.map((b, i) =>
        '<div class="card card--hover" data-reveal data-delay="' + (i % 4 + 1) + '"><div class="card__icon" aria-hidden="true">' + b.icon +
        '</div><h3 class="card__title">' + esc(b.t) + '</h3><p class="card__text">' + esc(b.d) + '</p></div>').join('');

      const streams = [
        { t: 'Science stream', d: 'Combined Mathematics, Physics, Chemistry, Biology — plus Computing for candidates sitting the technology options.', s: 'Grades 10–13' },
        { t: 'Commerce stream', d: 'Accounts, Business Studies and Economics, with quantitative ability carried forward from the O/L Mathematics syllabus.', s: 'Grades 10–13' },
        { t: 'Arts stream', d: 'History, Geography, Political Science, Buddhist Civilisation, logic and languages, taught with an island-wide drama and debate record.', s: 'Grades 10–13' },
        { t: 'Parallel stream', d: 'Grades 6–11 with science, mathematics, languages and electives, the common route before stream choice at grade 10.', s: 'Grades 6–11' },
      ];
      const sg = qs('#streamGrid');
      if (sg) sg.innerHTML = streams.map((b, i) =>
        '<article class="card card--accent" data-reveal data-delay="' + (i % 4 + 1) + '">' +
        '<h3 class="card__title">' + esc(b.t) + '</h3><span class="badge badge--gold">' + esc(b.s) + '</span>' +
        '<p class="card__text" style="margin-top:.6rem">' + esc(b.d) + '</p></article>').join('');

      const byDept = {};
      subs.forEach((s) => { (byDept[s.department] = byDept[s.department] || []).push(s); });
      const dg = qs('#deptGrid');
      if (dg) dg.innerHTML = Object.keys(byDept).sort().map((dep, i) =>
        '<div class="card" data-reveal data-delay="' + (i % 6 + 1) + '">' +
        '<h3 class="card__title">' + esc(dep) + '</h3>' +
        '<p class="muted" style="font-size:.8rem;margin:0 0 .6rem">' + byDept[dep].length + ' subject' + (byDept[dep].length === 1 ? '' : 's') + '</p>' +
        '<div class="chips">' + byDept[dep].map((s) =>
          '<span class="chip is-static">' + esc(loc(s, 'name')) + (s.core ? '' : ' · elective') + '</span>').join('') + '</div></div>').join('');

      const sw = qs('#subjectWrap');
      if (sw) sw.innerHTML = '<div class="table-wrap"><table class="table"><caption class="sr-only">Subjects taught at the college</caption><thead><tr>' +
        '<th scope="col">Subject</th><th scope="col">Code</th><th scope="col">Department</th><th scope="col">Band</th><th scope="col">Type</th>' +
        '</tr></thead><tbody>' + subs.map((s) =>
          '<tr><td><strong>' + esc(loc(s, 'name')) + '</strong></td><td>' + esc(s.code) + '</td><td>' + esc(s.department) +
          '</td><td>' + esc(s.band) + '</td><td>' + (s.core ? '<span class="badge">Core</span>' : '<span class="badge badge--gold">Elective</span>') + '</td></tr>').join('') +
        '</tbody></table></div>';

      const cw = qs('#classWrap');
      if (cw) {
        const cls = classes.slice().sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));
        cw.innerHTML = '<div class="table-wrap"><table class="table"><caption class="sr-only">Classes and streams</caption><thead><tr>' +
          '<th scope="col">Class</th><th scope="col">Grade</th><th scope="col">Stream</th><th scope="col">Room</th><th scope="col" class="num">Capacity</th>' +
          '</tr></thead><tbody>' + cls.map((c) =>
            '<tr><td><strong>' + esc(c.name) + '</strong></td><td>' + c.grade + '</td><td>' + esc(c.stream) +
            '</td><td>' + esc(c.room) + '</td><td class="num">' + c.capacity + '</td></tr>').join('') + '</tbody></table></div>';
      }
      const sub = qs('#academicCount');
      if (sub) sub.textContent = subs.length + ' subjects · ' + classes.length + ' classes · ' + loc(st, 'motto');
    },
  };

  /* ---- Downloads ---- */
  SGC.pages.downloads = {
    init() {
      wireFilters({
        chips: '#dlChips', search: '#dlSearch', count: '#dlCount', noun: 'document',
        field: 'category', cats: DL_CATEGORIES,
        source: () => SGC.db.all('schoolDownloads'),
        render: (list) => renderDownloads(qs('#dlList'), list),
      });
    },
  };

  /* ---- Achievements ---- */
  SGC.pages.achievements = {
    init() {
      wireFilters({
        chips: '#achChips', search: '#achSearch', count: '#achCount', noun: 'award',
        field: 'category', cats: ACH_CATEGORIES,
        source: () => SGC.db.all('schoolAchievements').slice().sort((a, b) => String(b.date).localeCompare(String(a.date))),
        render: (list) => renderAchievements(qs('#achGrid'), list),
      });
      const lv = qs('#achStats');
      if (lv) {
        const rows = SGC.db.all('schoolAchievements');
        lv.innerHTML = ACH_LEVELS.map((l) => {
          const n = rows.filter((a) => a.level === l).length;
          return '<div class="stat"><div class="stat__value">' + n + '</div><div class="stat__label">' + l + ' level</div></div>';
        }).join('');
      }
    },
  };

  /* ---- Public staff directory ---- */
  function teacherCardHTML(t) {
    const subjects = (t.subjectIds || []).map((id) => SGC.db.subjectName(id)).filter(Boolean);
    return '<article class="teacher" data-reveal>' +
      '<div class="teacher__top">' +
        '<div class="teacher__avatar">' +
          SGC.utils.avatarHTML({ fullName: t.fullName, photo: t.photo, folder: 'teachers' }, 96) + '</div>' +
        '<h3 class="teacher__name">' + esc(t.fullName) + '</h3>' +
        '<p class="teacher__subj">' + esc(subjects.join(' · ') || t.department || 'General') + '</p>' +
      '</div>' +
      '<div class="teacher__body">' +
        '<span class="badge badge--gold">' + esc(t.position || 'Teacher') + '</span>' +
        '<p class="teacher__bio" style="margin-top:.6rem">' + esc(t.bio || '') + '</p>' +
        '<ul class="teacher__contact">' +
          '<li><span aria-hidden="true">🏛</span><span>' + esc(t.department) + '</span></li>' +
          (t.email ? '<li><span aria-hidden="true">✉</span><a href="mailto:' + esc(t.email) + '">' + esc(t.email) + '</a></li>' : '') +
          (t.phone ? '<li><span aria-hidden="true">☏</span><a href="tel:' + esc(String(t.phone).replace(/[^+\d]/g, '')) + '">' + esc(t.phone) + '</a></li>' : '') +
        '</ul>' +
      '</div></article>';
  }

  function renderTeachers(mount, list) {
    if (!mount) return;
    mount.innerHTML = list.length ? list.map(teacherCardHTML).join('')
      : SGC.utils.noResults('this staff search');
    SGC.utils.scrollReveal(mount);
  }

  SGC.pages.teachers = {
    init() {
      const mount = qs('#teacherGrid'), search = qs('#teacherSearch');
      const fSub = qs('#teacherSubject'), fDep = qs('#teacherDept');
      const count = qs('#teacherCount'), clear = qs('#teacherClear');
      const active = () => SGC.db.all('schoolTeachers').filter((t) => (t.status || 'Active') === 'Active');

      function fillSelect(node, label, values) {
        if (!node) return;
        node.innerHTML = '<option value="">' + label + '</option>' +
          values.map((v) => '<option value="' + esc(v[0]) + '">' + esc(v[1]) + '</option>').join('');
        node.addEventListener('change', paint);
      }
      const subjects = SGC.db.all('schoolSubjects');
      fillSelect(fSub, 'All subjects', subjects.map((s) => [s.id, loc(s, 'name')]));
      fillSelect(fDep, 'All departments', subjects.map((s) => s.department)
        .filter((d, i, a) => a.indexOf(d) === i).sort().map((d) => [d, d]));
      if (search) search.addEventListener('input', debounce(paint, 180));

      function paint() {
        const term = (search ? search.value : '').trim();
        const sub = fSub ? fSub.value : '';
        const dep = fDep ? fDep.value : '';
        const list = active().filter((t) =>
          (!sub || (t.subjectIds || []).indexOf(sub) > -1) &&
          (!dep || t.department === dep) &&
          (!term || matches(t, term) || (t.subjectIds || []).some((id) =>
            String(SGC.db.subjectName(id)).toLowerCase().indexOf(term.toLowerCase()) > -1)));
        renderTeachers(mount, list);
        if (count) count.textContent = list.length + ' of ' + active().length + ' teaching staff';
        if (clear) clear.hidden = !(sub || dep || term);
      }
      if (clear) clear.addEventListener('click', () => {
        if (fSub) fSub.value = '';
        if (fDep) fDep.value = '';
        if (search) search.value = '';
        paint();
      });
      paint();
      document.addEventListener('sgc:lang', paint);
    },
  };

  /* ---- Students (protected: no personal records are published) ---- */
  SGC.pages.students = {
    init() {
      const n = qs('#studentCount');
      if (n) {
        const st = SGC.db.getSettings();
        n.textContent = st.stats && st.stats.students ? Number(st.stats.students).toLocaleString('en-GB') + ' students on roll' : '';
      }
    },
  };

  /* ---- Contact ---- */
  SGC.pages.contact = {
    init() {
      const st = SGC.db.getSettings();
      const cards = qs('#contactCards');
      if (cards) cards.innerHTML = [
        { i: '📍', t: 'Address', v: '<span>' + esc(loc(st, 'address')) + '</span>', h: mapURL(st.mapQuery || st.address), e: 'map' },
        { i: '☏', t: 'Telephone', v: '<a href="tel:' + esc(st.phone.replace(/[^+\d]/g, '')) + '">' + esc(st.phone) + '</a>' +
          (st.phone2 ? '<br><a href="tel:' + esc(st.phone2.replace(/[^+\d]/g, '')) + '">' + esc(st.phone2) + '</a>' : '') },
        { i: '✉', t: 'Email', v: '<a href="mailto:' + esc(st.email) + '">' + esc(st.email) + '</a>' +
          (st.email2 ? '<br><a href="mailto:' + esc(st.email2) + '">' + esc(st.email2) + '</a>' : '') },
        { i: '🕒', t: 'Office hours', v: '<span>' + esc(st.hours) + '</span>' },
      ].map((c) => '<div class="card card--accent" data-reveal><div class="card__icon" aria-hidden="true">' + c.i + '</div>' +
        '<h3 class="card__title">' + c.t + '</h3><p class="card__text">' + c.v + '</p>' +
        (c.h ? '<a class="btn btn--ghost btn--sm" href="' + esc(c.h) + '" target="_blank" rel="noopener">Open in Google Maps ↗</a>' : '') +
        '</div>').join('');

      const map = qs('#contactMap');
      if (map) map.src = mapURL(st.mapQuery || st.address);

      const socials = qs('#socialRow');
      if (socials) {
        const links = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['linkedin', 'LinkedIn']]
          .filter((s) => st[s[0]]);
        socials.innerHTML = links.length
          ? links.map((s) => '<a class="btn btn--outline btn--sm" href="' + esc(st[s[0]]) + '" target="_blank" rel="noopener noreferrer">' + s[1] + ' ↗</a>').join('')
          : '<p class="muted">No social accounts are listed for the college yet.</p>';
      }

      const form = qs('#contactForm');
      if (form) form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(form);
        const data = {};
        ['name', 'email', 'phone', 'subject', 'message'].forEach((k) => { data[k] = String(f.get(k) || '').trim(); });
        let bad = false;
        qsa('[required]', form).forEach((inp) => {
          const ok = inp.value.trim() && (inp.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inp.value));
          inp.classList.toggle('is-invalid', !ok);
          if (!ok && !bad) { bad = true; inp.focus(); }
        });
        if (bad) { SGC.utils.toast('Please complete the marked fields.', 'error'); return; }
        data.id = SGC.utils.uid('MSG');
        /* A public enquiry has no account, so it posts as itself and is
           addressed to the office. replyTo carries the e-mail for a real
           backend to answer on. */
        data.from = data.id;
        data.fromName = data.name;
        data.to = 'admin';
        data.body = data.message;
        data.category = 'Public enquiry';
        data.date = SGC.utils.nowISO();
        data.read = false;
        data.replyTo = data.email;
        SGC.db.insertData('schoolMessages', data);
        form.reset();
        SGC.utils.toast('Message sent. The office will reply within two working days.', 'success');
        const done = qs('#contactDone');
        if (done) done.hidden = false;
      });
    },
  };
})(window);
