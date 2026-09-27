/* =============================================================
   SRI GAMINI CENTRAL COLLEGE — shared dashboard building blocks
   The student, teacher and admin portals all render through these
   helpers so the three dashboards stay identical without a UI
   framework. Nothing here touches the network or the session.
   ============================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const U = SGC.utils;
  const { esc, qs, qsa, avatarHTML, formatDate, todayISO, emptyState, sortBy, matches } = U;

  const ROLE_LABEL = { admin: 'Administration', teacher: 'Teaching staff', student: 'Student' };
  const firstNameOf = (n) => String(n || '').trim().split(/\s+/)[0] || '';

  /* ---------------- shell: sidebar + top bar identity ---------------- */
  function shell(session, subtitle) {
    const st = SGC.db.getSettings();
    const p = SGC.auth.profile() || {};
    const name = p.fullName || p.name || session.name || 'Member of the college';
    const folder = session.role === 'teacher' ? 'teachers' : session.role === 'student' ? 'students' : 'uploads';
    const person = { fullName: name, photo: p.photo, folder };

    const set = (id, html) => { const n = qs('#' + id); if (n) n.innerHTML = html; };
    const setText = (id, text) => { const n = qs('#' + id); if (n) n.textContent = text; };

    set('sideSchool', esc(st.shortName || 'SGCC'));
    set('sideAvatar', avatarHTML(person, 44));
    set('sideName', esc(name));
    set('sideMeta', esc(subtitle || ROLE_LABEL[session.role] || ''));
    setText('topDate', formatDate(todayISO()));
    const tu = qs('#topUser');
    if (tu) tu.innerHTML = avatarHTML(person, 30) + '<span>' + esc(firstNameOf(name)) + '</span>';

    const nav = qs('#sideNavTitle');
    if (nav) nav.textContent = subtitle || ROLE_LABEL[session.role] || '';
  }

  /* ---------------- small fragments ---------------- */
  function widget(o) {
    return '<div class="widget' + (o.variant ? ' widget--' + o.variant : '') + '">' +
      '<div class="widget__top"><span class="widget__ico" aria-hidden="true">' + (o.icon || '◈') + '</span>' +
        (o.trend ? '<span class="widget__trend' + (o.trendDown ? ' is-down' : '') + '">' + esc(o.trend) + '</span>' : '') +
      '</div>' +
      '<div class="widget__val">' + esc(o.value) + '</div>' +
      '<div class="widget__lbl">' + esc(o.label) + '</div>' +
      (o.foot ? '<p class="muted" style="font-size:.75rem;margin:.4rem 0 0">' + esc(o.foot) + '</p>' : '') +
    '</div>';
  }
  const widgets = (list) => '<div class="widgets">' + list.map(widget).join('') + '</div>';

  const gradeChip = (g) => '<span class="grade grade--' + esc(String(g || 'S').replace('+', 's')) + '" title="Grade ' + esc(g || '—') + '">' + esc(g || '—') + '</span>';

  const bar = (pct, variant) => '<div class="bar' + (variant ? ' bar--' + variant : '') + '" role="img" ' +
    'aria-label="' + esc(String(pct)) + ' percent"><div class="bar__f" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></div></div>';

  function panel(o) {
    return '<section class="panel"' + (o.style ? ' style="' + esc(o.style) + '"' : '') + '>' +
      '<div class="panel__head"><h3>' + esc(o.title) + '</h3>' + (o.action || '') + '</div>' +
      '<div class="panel__body' + (o.flush ? ' panel__body--flush' : '') + '">' + (o.body || '') + '</div>' +
    '</section>';
  }

  const setRow = (o) => '<div class="set-row"><div><h4>' + esc(o.title) + '</h4>' +
    (o.text ? '<p>' + esc(o.text) + '</p>' : '') + '</div>' + (o.control || '') + '</div>';

  const switchHTML = (id, label, checked) => '<label class="switch"><input type="checkbox" id="' + esc(id) +
    '" aria-label="' + esc(label) + '"' + (checked ? ' checked' : '') + '><span aria-hidden="true"></span></label>';

  function feedHTML(items) {
    if (!items.length) return '<p class="muted">Nothing recorded yet.</p>';
    return '<ul class="feed">' + items.map((i) => '<li><span class="feed__d" aria-hidden="true">' + (i.icon || '•') + '</span>' +
      '<div><b>' + esc(i.title) + '</b><span>' + esc(i.meta || '') + '</span></div></li>').join('') + '</ul>';
  }

  function miniHTML(items) {
    if (!items.length) return '<p class="muted">Nothing to list here yet.</p>';
    return '<ul class="mini">' + items.map((i) => '<li><span class="mini__i" aria-hidden="true">' + (i.icon || '•') + '</span>' +
      '<div><b>' + esc(i.title) + '</b><span>' + esc(i.meta || '') + '</span></div>' +
      (i.end ? '<span class="mini__end">' + esc(i.end) + '</span>' : '') + '</li>').join('') + '</ul>';
  }

  /* Notices need their .notice-list grid wrapper before the shared renderer. */
  function noticeList(mount, items, opts) {
    if (!mount) return;
    mount.innerHTML = '<div class="notice-list"></div>';
    SGC.notices.renderList(mount.firstElementChild, items, opts);
  }

  function attGridHTML(rows, opts) {
    const o = opts || {};
    return '<div class="att-grid">' + rows.map((r) => '<div class="att-cell is-' + esc(r.status) + '"' +
      (o.dataAttr ? ' ' + o.dataAttr + '="' + esc(r[o.dataAttr]) + '"' : '') + '>' +
      '<span class="dot" aria-hidden="true"></span><div><b>' + esc(o.showName ? (r.studentName || r.studentId) : (o.dateLabel ? formatDate(r.date) : r.status)) + '</b>' +
      '<span style="display:block;font-size:.72rem;color:var(--text-3)">' +
        esc(o.showName ? (o.dateLabel ? formatDate(r.date) : r.date) : r.status) + '</span></div></div>').join('') + '</div>';
  }

  /* ---------------- tables ---------------- */
  function tableHTML(cfg) {
    const cols = cfg.cols;
    const rows = cfg.rows;
    if (!rows.length) {
      return emptyState({ icon: '▤', title: (cfg.empty && cfg.empty.title) || 'Nothing to show',
        text: (cfg.empty && cfg.empty.text) || 'Records appear here as soon as they are entered.' });
    }
    const sortKey = cfg.sort && cfg.sort.key;
    return '<div class="table-wrap"><table class="table"><caption class="sr-only">' + esc(cfg.caption || 'Data table') + '</caption><thead><tr>' +
      cols.map((c) => '<th scope="col" class="' + (c.num ? 'num ' : '') + (c.sortable ? 'is-sortable' : '') + '"' +
        (c.sortable ? ' data-sort="' + esc(c.key) + '"' : '') +
        (c.sortable && sortKey === c.key ? ' aria-sort="' + (cfg.sort.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '>' +
        esc(c.label) + (c.sortable && sortKey === c.key ? (cfg.sort.dir === 'asc' ? ' ▲' : ' ▼') : '') + '</th>').join('') +
      '</tr></thead><tbody>' +
      rows.map((r) => '<tr>' + cols.map((c) => '<td' + (c.num ? ' class="num"' : '') + '>' +
        (c.cell ? c.cell(r) : esc(r[c.key] === undefined || r[c.key] === '' ? '—' : r[c.key])) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  /* ---------------- data table with search, sort, filters, paging ----------------
     cfg = {
       cols:      [{key,label,cell?,num?,sortable?}],
       rows:      () => [...],                 re-read on every refresh
       searchKeys?:  ['fullName','email']       optional
       filters?:  [{key,label,options:[..] }]   optional
       toolbar?:  '<html>'                       extra buttons appended to toolbar
       addLabel?: 'Add student'  onAdd?: fn
       pageSize?: 10, defaultSort?: {key,dir}, id?: 'uid'
     }
     Returns { root, refresh(), state } — bind row actions once on `root`
     because only the inner body is re-rendered.
  ---------------------------------------------------------------------- */
  function dataTable(mount, cfg) {
    const uid = cfg.id || ('dt' + U.uid(''));
    const state = { q: '', sort: Object.assign({ key: '', dir: 'desc' }, cfg.defaultSort), page: 1, filters: {} };
    const ps = cfg.pageSize || 10;

    mount.innerHTML =
      '<div class="toolbar">' +
        (cfg.searchKeys ? '<div class="toolbar__grow"><label class="sr-only" for="' + uid + '-q">Search</label>' +
          '<input class="input" id="' + uid + '-q" type="search" placeholder="' + esc(cfg.searchPlaceholder || 'Search…') + '"></div>' : '') +
        (cfg.filters || []).map((f, i) => '<label class="sr-only" for="' + uid + '-f' + i + '">' + esc(f.label) + '</label>' +
          '<select class="select" id="' + uid + '-f' + i + '" data-fkey="' + esc(f.key) + '">' +
            '<option value="">' + esc(f.label) + '</option>' +
            f.options.map((o) => '<option value="' + esc(typeof o === 'string' ? o : o.value) + '">' +
              esc(typeof o === 'string' ? o : o.label) + '</option>').join('') +
          '</select>').join('') +
        (cfg.toolbar || '') +
        (cfg.addLabel ? '<button type="button" class="btn btn--primary" data-dt-add>＋ ' + esc(cfg.addLabel) + '</button>' : '') +
      '</div><div class="dt-body"></div>';

    const body = qs('.dt-body', mount);
    if (cfg.onAdd) U.on(mount, 'click', '[data-dt-add]', () => cfg.onAdd());

    function current() {
      let rows = cfg.rows();
      if (state.q && cfg.searchKeys) {
        rows = rows.filter((r) => cfg.searchKeys.some((k) =>
          typeof r[k] === 'string' && r[k].toLowerCase().includes(state.q.toLowerCase())));
      }
      (cfg.filters || []).forEach((f) => {
        const v = state.filters[f.key];
        if (!v) return;
        rows = rows.filter((r) => String(r[f.key] === undefined ? '' : r[f.key]) === v);
      });
      if (state.sort.key) rows = sortBy(rows, state.sort.key, state.sort.dir);
      return rows;
    }

    function draw() {
      const rows = current();
      const pages = Math.max(1, Math.ceil(rows.length / ps));
      if (state.page > pages) state.page = pages;
      const from = (state.page - 1) * ps;
      body.innerHTML = tableHTML({
        cols: cfg.cols, rows: rows.slice(from, from + ps), caption: cfg.caption,
        empty: cfg.empty, sort: state.sort,
      }) + (rows.length > ps
        ? '<div class="toolbar" style="justify-content:space-between;margin:var(--sp-3) 0 0">' +
            '<span class="muted" style="font-size:.82rem">Showing ' + (from + 1) + '–' + Math.min(from + ps, rows.length) + ' of ' + rows.length + '</span>' +
            '<div class="row-actions">' +
              '<button type="button" class="btn btn--ghost btn--sm" data-pager="prev"' + (state.page === 1 ? ' disabled' : '') + '>‹ Newer</button>' +
              '<span class="muted" style="font-size:.82rem;align-self:center">Page ' + state.page + ' / ' + pages + '</span>' +
              '<button type="button" class="btn btn--ghost btn--sm" data-pager="next"' + (state.page === pages ? ' disabled' : '') + '>Older ›</button>' +
            '</div></div>'
        : '<div class="toolbar" style="justify-content:flex-end;margin:var(--sp-3) 0 0"><span class="muted" style="font-size:.82rem">' +
            rows.length + ' record' + (rows.length === 1 ? '' : 's') + '</span></div>');
      if (cfg.afterDraw) cfg.afterDraw(body, rows);
    }

    const q = qs('#' + uid + '-q', mount);
    if (q) q.addEventListener('input', U.debounce(() => { state.q = q.value.trim(); state.page = 1; draw(); }, 200));
    qsa('select[data-fkey]', mount).forEach((s) => s.addEventListener('change', () => {
      state.filters[s.dataset.fkey] = s.value; state.page = 1; draw();
    }));
    U.on(mount, 'click', 'th[data-sort]', (e, th) => {
      const k = th.dataset.sort;
      state.sort = { key: k, dir: state.sort.key === k && state.sort.dir === 'desc' ? 'asc' : 'desc' };
      draw();
    });
    U.on(mount, 'click', '[data-pager]', (e, btn) => {
      const d = btn.dataset.pager === 'next' ? 1 : -1;
      state.page = Math.max(1, state.page + d);
      draw();
    });

    draw();
    return { root: mount, refresh: draw, state, query: () => (q ? q.value.trim() : '') };
  }

  /* Row action trio used by every admin table. */
  function rowActions(id, opts) {
    const o = opts || {};
    return '<div class="row-actions">' +
      (o.view !== false ? '<button type="button" class="btn btn--ghost btn--icon" data-act="view" data-id="' + esc(id) + '" title="View" aria-label="View record ' + esc(id) + '">👁</button>' : '') +
      (o.edit !== false ? '<button type="button" class="btn btn--ghost btn--icon" data-act="edit" data-id="' + esc(id) + '" title="Edit" aria-label="Edit record ' + esc(id) + '">✎</button>' : '') +
      (o.del !== false ? '<button type="button" class="btn btn--ghost btn--icon" data-act="del" data-id="' + esc(id) + '" title="Delete" aria-label="Delete record ' + esc(id) + '">🗑</button>' : '') +
      (o.extra || '') +
    '</div>';
  }

  /* ---------------- declarative modal form ----------------
     One form builder for every admin and teacher record editor.
     Field types: text · textarea · number · date · email · tel · time
                  select · checks · image · file · switch · static
     cfg = { title, fields, values, submitLabel, onSubmit(values, close) }
  ---------------------------------------------------------- */
  function fieldHTML(f, values) {
    const id = 'ff-' + f.key;
    let v = values[f.key] !== undefined && values[f.key] !== null ? values[f.key] : (f.dflt !== undefined ? f.dflt : '');
    /* A date input rejects "2026-09-25T10:48:33.674Z" outright and renders empty,
       which made every seeded notice and gallery item fail its own required check
       on the second save. Records may legitimately hold either shape. */
    if (f.type === 'date' && typeof v === 'string' && v.length > 10 && v.charAt(10) === 'T') v = v.slice(0, 10);
    const req = f.required ? ' <span class="req" aria-hidden="true">*</span>' : '';
    const label = '<label class="label" for="' + id + '">' + esc(f.label) + req + '</label>';
    const hint = f.hint ? '<p class="form-hint">' + esc(f.hint) + '</p>' : '';
    let input = '';
    switch (f.type) {
      case 'textarea':
        input = '<textarea class="textarea" id="' + id + '" data-f="' + esc(f.key) + '" rows="' + (f.rows || 4) + '"' +
          (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + (f.required ? ' required' : '') + '>' + esc(v) + '</textarea>';
        break;
      case 'select':
        input = '<select class="select" id="' + id + '" data-f="' + esc(f.key) + '"' + (f.required ? ' required' : '') + '>' +
          (f.placeholder ? '<option value="">' + esc(f.placeholder) + '</option>' : '') +
          f.options.map((o) => {
            const val = typeof o === 'string' ? o : o.value;
            const lab = typeof o === 'string' ? o : o.label;
            return '<option value="' + esc(val) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(lab) + '</option>';
          }).join('') + '</select>';
        break;
      case 'checks': {
        const arr = Array.isArray(v) ? v.map(String) : (v ? String(v).split(',').map((x) => x.trim()) : []);
        input = '<div style="display:flex;flex-wrap:wrap;gap:.4rem .9rem" data-f="' + esc(f.key) + '" data-type="checks">' +
          f.options.map((o, i) => {
            const val = typeof o === 'string' ? o : o.value;
            const lab = typeof o === 'string' ? o : o.label;
            return '<label class="check"><input type="checkbox" value="' + esc(val) + '"' +
              (arr.indexOf(String(val)) > -1 ? ' checked' : '') + ' id="' + id + '-' + i + '">' + esc(lab) + '</label>';
          }).join('') + '</div>';
        break;
      }
      case 'switch':
        input = '<label class="switch"><input type="checkbox" id="' + id + '" data-f="' + esc(f.key) + '"' +
          (v ? ' checked' : '') + ' aria-label="' + esc(f.label) + '"><span aria-hidden="true"></span></label>';
        break;
      case 'image':
      case 'file':
        input = '<label class="file-drop" for="' + id + '"><input type="file" id="' + id + '" data-f="' + esc(f.key) +
          '" data-type="' + f.type + '" accept="' + esc(f.type === 'image' ? 'image/*' : (f.accept || '.pdf,.doc,.docx,.xls,.xlsx,.zip')) + '">' +
          '<span>' + (v && v.name ? 'Current file: <b>' + esc(v.name) + '</b> — choose another to replace it'
            : (typeof v === 'string' && v ? 'Current image set — choose a file to replace it' : 'Choose a file')) + '</span></label>';
        break;
      case 'static':
        input = '<div class="input" style="background:var(--cream-2)">' + esc(String(v)) + '</div>';
        break;
      default:
        input = '<input class="input" id="' + id + '" data-f="' + esc(f.key) + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '"' +
          (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') +
          (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') +
          (f.step ? ' step="' + f.step + '"' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') +
          (f.required ? ' required' : '') + '>';
    }
    return '<div class="field" data-full="' + (f.full || f.type === 'textarea' || f.type === 'checks' || f.type === 'image' || f.type === 'file' ? '1' : '0') + '">' +
      label + input + hint + '</div>';
  }

  /* An upload can fail for reasons the member of staff can act on (too big,
     Storage switched off, no connection) and reasons they cannot. The rest of
     the form is never lost: the record simply is not saved. */
  function uploadFailure(e) {
    const m = (e && e.message) || 'the upload was refused';
    return 'The file was not uploaded (' + m + '). Nothing has been saved — try again, ' +
      'or ask the office for a smaller picture.';
  }

  function formModal(cfg) {
    const values = Object.assign({}, cfg.values || {});
    const fields = cfg.fields.filter((f) => !f.when || f.when(values));
    const html = (function () {
      let out = '', grid = [];
      const flush = () => { if (grid.length) { out += '<div class="form-grid">' + grid.join('') + '</div>'; grid = []; } };
      fields.forEach((f) => {
        const h = fieldHTML(f, values);
        if (/data-full="1"/.test(h)) { flush(); out += h; } else grid.push(h);
      });
      flush();
      return out;
    }());

    U.modal({
      title: cfg.title,
      size: cfg.size || 'lg',
      body: '<form id="' + 'dtform' + '" novalidate>' + html + '</form>',
      footer: '<button type="button" class="btn btn--ghost" data-close>Cancel</button>' +
        '<button type="button" class="btn btn--primary" data-save>' + esc(cfg.submitLabel || 'Save') + '</button>',
      onOpen(m) {
        const form = qs('form', m.body());
        U.on(m.root, 'click', '[data-save]', async () => {
          const out = {};
          let err = '';
          fields.forEach((f) => {
            if (f.type === 'static') return;
            const node = qs('[data-f="' + f.key + '"]', form);
            if (!node) return;
            if (f.type === 'checks') {
              out[f.key] = qsa('input[type=checkbox]:checked', node).map((x) => x.value);
            } else if (f.type === 'switch') {
              out[f.key] = node.checked;
            } else if (f.type === 'number') {
              out[f.key] = node.value === '' ? '' : Number(node.value);
            } else if (f.type === 'image') {
              out[f.key] = values[f.key] || '';
            } else if (f.type === 'file') {
              out[f.key] = values[f.key] || null;
            } else {
              out[f.key] = node.value.trim ? node.value.trim() : node.value;
            }
            if (f.required && (out[f.key] === '' || out[f.key] === null || (Array.isArray(out[f.key]) && !out[f.key].length))) {
              err = err || (f.label + ' is required.');
              node.classList.add('is-invalid');
            } else {
              node.classList.remove('is-invalid');
            }
            if (f.type === 'number' && out[f.key] !== '' && (isNaN(out[f.key]) ||
              (f.min !== undefined && out[f.key] < f.min) || (f.max !== undefined && out[f.key] > f.max))) {
              err = err || (f.label + ' must be between ' + (f.min !== undefined ? f.min : 0) + ' and ' + (f.max !== undefined ? f.max : 100) + '.');
            }
          });

          /* files are read after the simple checks so the picker can fail first */
          if (!err) {
            const toServer = !!(SGC.backend && SGC.backend.enabled && SGC.backend.upload);
            for (const f of fields) {
              if (f.type !== 'image' && f.type !== 'file') continue;
              const node = qs('[data-f="' + f.key + '"]', form);
              const file = node && node.files && node.files[0];
              if (!file) continue;
              const send = () => SGC.backend.upload(cfg.uploadScope || f.key, file);
              if (f.type === 'image') {
                /* Live mode keeps the photograph in Cloud Storage and stores
                   only its address; the offline demo has no bucket, so the
                   bytes stay in the record as a data URL. */
                try { out[f.key] = toServer ? await send() : await U.readFileAsDataURL(file); }
                catch (e2) { err = uploadFailure(e2); break; }
              } else {
                out[f.key] = U.describeFile(file);
                try { if (toServer) out[f.key].url = await send(); }
                catch (e2) { err = uploadFailure(e2); break; }
              }
            }
          }
          if (!err && cfg.validate) err = cfg.validate(out) || '';
          if (err) { U.toast(err, 'error'); return; }
          cfg.onSubmit(out, m);
        });
        const first = qs('input:not([type=file]):not([type=checkbox]), textarea, select', form);
        if (first) first.focus();
        form.addEventListener('submit', (e) => e.preventDefault());
      },
    });
  }

  SGC.dash = {
    ROLE_LABEL, firstNameOf, shell, widget, widgets, gradeChip, bar, panel, setRow, switchHTML,
    feedHTML, miniHTML, noticeList, attGridHTML, tableHTML, dataTable, rowActions, formModal,
  };
})(window);
