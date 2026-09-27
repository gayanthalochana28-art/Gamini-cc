/* =================================================================
   SRI GAMINI CENTRAL COLLEGE — notices
   Shared renderer (home page + notices page) and the notices page logic.
   Admin CRUD for notices lives in js/admin.js; both read the same store,
   so a notice saved in the dashboard appears here on next load.
   ================================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const { esc, formatDate, el } = SGC.utils;

  const CATEGORIES = ['General', 'Exam', 'Academic', 'Holiday', 'Sports', 'Events', 'Administration', 'Urgent'];
  const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
  const AUDIENCES = ['student', 'teacher', 'parent', 'all'];

  const catClass = (c) => 'badge--' + String(c || 'general').toLowerCase().replace(/[^a-z]/g, '');
  const isLive = (n) => !!n.published && (!n.expiryDate || new Date(n.expiryDate + 'T23:59:59') >= new Date());

  /* Published, unexpired, most recent first; important ones pinned on top. */
  function live() {
    return SGC.db.all('schoolNotices').filter(isLive).sort((a, b) => {
      const pin = (x) => (x.priority === 'Urgent' || x.priority === 'High' ? 0 : 1);
      return pin(a) - pin(b) || new Date(b.date) - new Date(a.date);
    });
  }

  function cardHTML(n, opts) {
    const o = opts || {};
    const d = new Date(n.date);
    const important = n.priority === 'Urgent' || n.priority === 'High';
    const body = SGC.i18n.loc(n, 'body');
    const lines = o.truncate === false ? 99 : 2;
    return '<article class="notice' + (important ? ' notice--important' : '') + '" data-notice="' + esc(n.id) +
      '" tabindex="0" role="button" aria-label="Open notice: ' + esc(SGC.i18n.loc(n, 'title')) + '">' +
      '<div class="notice__date"><span class="notice__day">' + (isNaN(d) ? '—' : d.getDate()) + '</span>' +
        '<span class="notice__mon">' + (isNaN(d) ? '' : SGC.utils.MONTHS_EN[d.getMonth()]) + '</span></div>' +
      '<div class="notice__body">' +
        '<h3 class="notice__title">' + esc(SGC.i18n.loc(n, 'title')) + '</h3>' +
        '<p class="notice__text" style="-webkit-line-clamp:' + lines + '">' + esc(body) + '</p>' +
        '<div class="notice__meta">' +
          (important ? '<span class="notice__pin">📌 Important</span>' : '') +
          '<span class="badge ' + catClass(n.category) + '">' + esc(n.category || 'General') + '</span>' +
          (n.attachment ? '<span title="Has attachment">📎 ' + esc(n.attachment.name) + '</span>' : '') +
          '<span>' + esc(n.author || '') + '</span>' +
          '<span>· ' + formatDate(n.date) + '</span>' +
          (n.expiryDate ? '<span>· until ' + formatDate(n.expiryDate) + '</span>' : '') +
          (o.showViews ? '<span>· ' + (n.views || 0) + ' views</span>' : '') +
        '</div>' +
      '</div></article>';
  }

  function renderList(mount, items, opts) {
    if (!mount) return;
    mount.innerHTML = items.length
      ? items.map((n) => cardHTML(n, opts)).join('')
      : SGC.utils.emptyState({ icon: '📭', title: 'No notices to show',
          text: 'There are no published notices in this selection right now. Check back soon or browse the archive.' });
    bindOpen(mount);
  }

  function bindOpen(mount) {
    const open = (node) => {
      const n = SGC.db.findData('schoolNotices', node.getAttribute('data-notice'));
      if (n) openNotice(n);
    };
    mount.querySelectorAll('[data-notice]').forEach((node) => {
      node.addEventListener('click', () => open(node));
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(node); }
      });
    });
  }

  /* Full notice in a modal; also updates the address bar hash so it can be linked. */
  function openNotice(n) {
    /* The counter is a courtesy on a device that keeps its own copy. Writing it
       through would mean letting an anonymous visitor update a published
       record, which is exactly the kind of surface the rules refuse — and the
       refusal would be reported to that visitor as an error. */
    if (!(SGC.backend && SGC.backend.enabled)) {
      SGC.db.updateData('schoolNotices', n.id, { views: (n.views || 0) + 1 });
    }
    const att = n.attachment
      ? '<div class="dl" style="margin-top:var(--sp-3)"><span class="dl__icon">' +
          esc((n.attachment.name.split('.').pop() || 'file').slice(0, 4)) + '</span>' +
          '<span class="dl__info"><span class="dl__name">' + esc(n.attachment.name) + '</span>' +
          '<span class="dl__meta">' + SGC.utils.fileSize(n.attachment.size) + ' · attachment</span></span>' +
          /* An attachment uploaded to Cloud Storage carries a real address;
             the offline demonstration only ever recorded its name and size. */
          (n.attachment.url
            ? '<a class="btn btn--outline btn--sm" href="' + esc(n.attachment.url) + '" target="_blank" rel="noopener" download>Download</a>'
            : '<button class="btn btn--outline btn--sm" data-attach="' + esc(n.attachment.name) + '">Download</button>') +
          '</div>'
      : '';
    const h = SGC.utils.modal({
      title: SGC.i18n.loc(n, 'title'),
      size: 'lg',
      body: '<div class="meta-row" style="margin-bottom:var(--sp-3)">' +
          '<span class="badge ' + catClass(n.category) + '">' + esc(n.category) + '</span>' +
          '<span>📅 ' + formatDate(n.date) + '</span>' +
          (n.expiryDate ? '<span>⏳ Valid until ' + formatDate(n.expiryDate) + '</span>' : '') +
          '<span>✍ ' + esc(n.author || 'Administration') + '</span>' +
          (n.priority === 'High' || n.priority === 'Urgent' ? '<span class="badge badge--High">' + esc(n.priority) + ' priority</span>' : '') +
        '</div>' +
        '<div class="prose"><p>' + esc(SGC.i18n.loc(n, 'body')).replace(/\n/g, '</p><p>') + '</p></div>' +
        (n.bodySi && SGC.i18n.get() === 'en' && n.bodySi.trim()
          ? '<h4 class="section-h">සිංහල</h4><div class="prose"><p>' + esc(n.bodySi) + '</p></div>' : '') +
        att,
      footer: '<button class="btn btn--ghost" data-close>Close</button>' +
              '<button class="btn btn--primary" data-copy>Copy link</button>',
      onOpen(m) {
        m.root.querySelector('[data-copy]').addEventListener('click', () => {
          const url = global.location.href.split('#')[0] + '#' + n.id;
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(
            () => SGC.utils.toast('Link copied to clipboard.', 'success'),
            () => SGC.utils.toast('Could not copy the link.', 'error'));
          else SGC.utils.toast(url, 'info', 6000);
        });
        const a = m.root.querySelector('[data-attach]');
        if (a) a.addEventListener('click', () => SGC.utils.toast(
          'Demo build: attachments are described but not stored. Connect a backend to serve ' + a.dataset.attach + '.', 'info', 5200));
      },
    });
    if (global.history && history.replaceState) history.replaceState(null, '', '#' + n.id);
    return h;
  }

  /* ---------------- notices page ---------------- */
  const state = { q: '', cat: '', pri: '', page: 1, per: 8 };

  function applyFilters() {
    let list = live();
    if (state.cat) list = list.filter((n) => n.category === state.cat);
    if (state.pri) list = list.filter((n) => n.priority === state.pri);
    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter((n) => (n.title + ' ' + n.body + ' ' + n.author).toLowerCase().includes(q));
    }
    return list;
  }

  function renderPage() {
    const host = SGC.utils.qs('#noticeResults');
    if (!host) return;
    const list = applyFilters();
    const pages = Math.max(1, Math.ceil(list.length / state.per));
    state.page = Math.min(state.page, pages);
    const slice = list.slice((state.page - 1) * state.per, state.page * state.per);

    host.innerHTML = (list.length ? '' : SGC.utils.noResults(state.q)) ;
    if (list.length) {
      host.innerHTML = slice.map((n) => cardHTML(n, { showViews: true })).join('');
      bindOpen(host);
    }
    renderPager(list.length, pages);
    const count = SGC.utils.qs('#noticeCount');
    if (count) count.textContent = list.length + (list.length === 1 ? ' notice' : ' notices');
  }

  function renderPager(total, pages) {
    const host = SGC.utils.qs('#noticePager');
    if (!host) return;
    if (pages <= 1) { host.innerHTML = ''; return; }
    let h = '<button data-p="prev" ' + (state.page === 1 ? 'disabled' : '') + ' aria-label="Previous page">‹</button>';
    for (let i = 1; i <= pages; i++) h += '<button data-p="' + i + '" class="' + (i === state.page ? 'is-active' : '') + '">' + i + '</button>';
    h += '<button data-p="next" ' + (state.page === pages ? 'disabled' : '') + ' aria-label="Next page">›</button>';
    host.innerHTML = h;
    host.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const p = b.dataset.p;
      state.page = p === 'prev' ? Math.max(1, state.page - 1) : p === 'next' ? Math.min(pages, state.page + 1) : Number(p);
      renderPage();
      SGC.utils.qs('#noticeResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  SGC.notices = { CATEGORIES, PRIORITIES, AUDIENCES, live, cardHTML, renderList, openNotice, isLive, catClass };

  SGC.pages.notices = {
    init() {
      const catSel = SGC.utils.qs('#fCat'), priSel = SGC.utils.qs('#fPri'), search = SGC.utils.qs('#fSearch');
      if (catSel) {
        catSel.innerHTML = '<option value="">All categories</option>' +
          CATEGORIES.map((c) => '<option>' + c + '</option>').join('');
      }
      if (priSel) {
        priSel.innerHTML = '<option value="">Any priority</option>' +
          PRIORITIES.map((p) => '<option>' + p + '</option>').join('');
      }
      if (search) search.addEventListener('input', SGC.utils.debounce(() => { state.q = search.value.trim(); state.page = 1; renderPage(); }, 200));
      if (catSel) catSel.addEventListener('change', () => { state.cat = catSel.value; state.page = 1; renderPage(); });
      if (priSel) priSel.addEventListener('change', () => { state.pri = priSel.value; state.page = 1; renderPage(); });

      const chips = SGC.utils.qs('#noticeChips');
      if (chips) {
        chips.innerHTML = ['', ...CATEGORIES].map((c) =>
          '<button class="chip' + (c === '' ? ' is-active' : '') + '" data-cat="' + c + '">' + (c || 'All') + '</button>').join('');
        chips.addEventListener('click', (e) => {
          const b = e.target.closest('[data-cat]'); if (!b) return;
          state.cat = b.dataset.cat; state.page = 1;
          chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('is-active', x === b));
          if (catSel) catSel.value = state.cat;
          renderPage();
        });
      }

      /* Archive (expired / unpublished-but-listed) */
      const arch = SGC.utils.qs('#noticeArchive');
      if (arch) {
        const past = SGC.db.all('schoolNotices').filter((n) => n.published && !isLive(n));
        arch.innerHTML = past.length
          ? past.map((n) => cardHTML(n)).join('')
          : '<p class="muted">No expired notices in the archive.</p>';
        bindOpen(arch);
      }

      renderPage();

      /* Deep link: notices.html#N001 opens that notice */
      if (global.location.hash) {
        const n = SGC.db.findData('schoolNotices', global.location.hash.slice(1));
        if (n) setTimeout(() => openNotice(n), 260);
      }

      document.addEventListener('sgc:lang', renderPage);
    },
  };
})(window);
