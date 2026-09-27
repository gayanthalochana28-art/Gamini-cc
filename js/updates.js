/* =================================================================
   SRI GAMINI CENTRAL COLLEGE — latest updates (news feed)
   Shared renderer for the home page and updates page + page logic.
   ================================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const { esc, formatDate } = SGC.utils;

  const CATEGORIES = ['Achievement', 'Academic', 'Sports', 'Cultural', 'Facilities', 'Events', 'Exam', 'Announcement'];
  const LIKED_KEY = 'sgc.likedUpdates';

  const liked = () => { try { return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]')); } catch (e) { return new Set(); } };
  const saveLiked = (s) => localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(s)));

  /* Only updates with real content are shown; drafts stay in the admin table. */
  function live() {
    return SGC.db.all('schoolUpdates')
      .filter((u) => u.status !== 'Draft' && u.published !== false)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function imgHTML(u, cls) {
    if (!u.image) {
      return '<div class="' + (cls || 'update__media') + '" role="img" aria-label="Illustration for ' + esc(u.title) + '"></div>';
    }
    return '<div class="' + (cls || 'update__media') + '">' +
      '<img src="' + esc(SGC.utils.rootURL(u.image)) + '" alt="' + esc(u.title) + '" loading="lazy" ' +
      'onerror="this.closest(\'' + (cls || 'update__media') + '\').classList.add(\'is-broken\');this.remove()"></div>';
  }

  function cardHTML(u, opts) {
    const o = opts || {};
    const s = liked();
    return '<article class="update" data-update="' + esc(u.id) + '">' +
      imgHTML(u) +
      (u.category ? '<span class="badge update__cat badge--' + esc(u.category.toLowerCase()) + '">' + esc(u.category) + '</span>' : '') +
      '<div class="update__body">' +
        '<h3 class="update__title"><a href="#' + esc(u.id) + '" data-open="' + esc(u.id) + '">' + esc(SGC.i18n.loc(u, 'title')) + '</a></h3>' +
        '<p class="update__text">' + esc(SGC.i18n.loc(u, 'excerpt')) + '</p>' +
        '<div class="update__foot">' +
          '<span>📅 ' + formatDate(u.date) + '</span>' +
          '<span>👁 ' + (u.views || 0) + '</span>' +
          '<button class="like-btn' + (s.has(u.id) ? ' is-liked' : '') + '" data-like="' + esc(u.id) + '" ' +
            'aria-pressed="' + s.has(u.id) + '" aria-label="Like this update">♥ <span>' + (u.likes || 0) + '</span></button>' +
          '<a href="#' + esc(u.id) + '" data-open="' + esc(u.id) + '" style="margin-left:auto;font-weight:700">' +
            SGC.i18n.t('common.readMore') + ' →</a>' +
        '</div>' +
      '</div></article>';
  }

  function renderList(mount, items) {
    if (!mount) return;
    mount.innerHTML = items.length ? items.map((u) => cardHTML(u)).join('')
      : SGC.utils.emptyState({ icon: '📰', title: 'No updates yet', text: 'School news and achievements will appear here.' });
    bind(mount);
  }

  function bind(mount) {
    mount.querySelectorAll('[data-open]').forEach((n) => n.addEventListener('click', (e) => {
      e.preventDefault();
      const u = SGC.db.findData('schoolUpdates', n.getAttribute('data-open'));
      if (u) openUpdate(u);
    }));
    mount.querySelectorAll('[data-like]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      toggleLike(b.getAttribute('data-like'), b);
    }));
  }

  function toggleLike(id, btn) {
    const s = liked();
    const u = SGC.db.findData('schoolUpdates', id);
    if (!u) return;
    const now = !s.has(id);
    if (now) s.add(id); else s.delete(id);
    saveLiked(s);
    SGC.db.updateData('schoolUpdates', id, { likes: Math.max(0, (u.likes || 0) + (now ? 1 : -1)) });
    if (btn) {
      btn.classList.toggle('is-liked', now);
      btn.setAttribute('aria-pressed', String(now));
      btn.querySelector('span').textContent = u.likes + (now ? 1 : -1);
    }
    SGC.utils.toast(now ? 'Thank you — added to your likes.' : 'Removed from your likes.', 'info', 1800);
  }

  function openUpdate(u) {
    SGC.db.updateData('schoolUpdates', u.id, { views: (u.views || 0) + 1 });
    const paras = String(SGC.i18n.loc(u, 'content') || u.excerpt || '').split(/\n+/);
    SGC.utils.modal({
      title: SGC.i18n.loc(u, 'title'),
      size: 'lg',
      body: (u.image ? '<div class="update__media" style="aspect-ratio:16/7;margin-bottom:var(--sp-3);border-radius:var(--r-md)">' +
              '<img src="' + esc(SGC.utils.rootURL(u.image)) + '" alt="' + esc(u.title) + '"></div>' : '') +
        '<div class="meta-row" style="margin-bottom:var(--sp-3)">' +
          '<span class="badge">' + esc(u.category) + '</span><span>📅 ' + formatDate(u.date) + '</span>' +
          '<span>✍ ' + esc(u.author) + '</span><span>👁 ' + (u.views || 0) + ' views</span></div>' +
        '<div class="prose">' + paras.map((p) => '<p>' + esc(p) + '</p>').join('') + '</div>' +
        (u.titleSi && SGC.i18n.get() === 'en' && u.titleSi.trim() ? '<h4 class="section-h">සිංහල</h4><p class="muted">' + esc(u.titleSi) + '</p>' : ''),
      footer: '<button class="btn btn--ghost" data-close>Close</button>' +
              '<button class="btn btn--primary" data-like-modal="' + esc(u.id) + '">♥ Like</button>',
      onOpen(m) {
        m.root.querySelector('[data-like-modal]').addEventListener('click', (e) => {
          toggleLike(u.id, null);
          const fresh = SGC.db.findData('schoolUpdates', u.id);
          e.target.textContent = '♥ ' + (fresh ? fresh.likes : 0);
        });
      },
    });
    if (global.history && history.replaceState) history.replaceState(null, '', '#' + u.id);
  }

  /* ---------------- updates page ---------------- */
  const state = { q: '', cat: '' };

  function renderPage() {
    const host = SGC.utils.qs('#updateResults');
    if (!host) return;
    let list = live();
    if (state.cat) list = list.filter((u) => u.category === state.cat);
    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter((u) => (u.title + ' ' + u.excerpt + ' ' + u.content).toLowerCase().includes(q));
    }
    host.innerHTML = list.length ? list.map((u) => cardHTML(u)).join('') : SGC.utils.noResults(state.q);
    bind(host);
    const c = SGC.utils.qs('#updateCount');
    if (c) c.textContent = list.length + (list.length === 1 ? ' story' : ' stories');
  }

  SGC.updates = { CATEGORIES, live, cardHTML, renderList, openUpdate, imgHTML };

  SGC.pages.updates = {
    init() {
      const catSel = SGC.utils.qs('#fCat'), search = SGC.utils.qs('#fSearch'), chips = SGC.utils.qs('#updateChips');
      if (catSel) catSel.innerHTML = '<option value="">All categories</option>' + CATEGORIES.map((c) => '<option>' + c + '</option>').join('');
      if (search) search.addEventListener('input', SGC.utils.debounce(() => { state.q = search.value.trim(); renderPage(); }, 200));
      if (catSel) catSel.addEventListener('change', () => { state.cat = catSel.value; syncChips(); renderPage(); });
      if (chips) {
        chips.innerHTML = ['', ...CATEGORIES].map((c) =>
          '<button class="chip' + (c === '' ? ' is-active' : '') + '" data-cat="' + c + '">' + (c || 'All') + '</button>').join('');
        chips.addEventListener('click', (e) => {
          const b = e.target.closest('[data-cat]'); if (!b) return;
          state.cat = b.dataset.cat; syncChips(); renderPage();
        });
      }
      function syncChips() {
        if (!chips) return;
        chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('is-active', x.dataset.cat === state.cat));
      }
      renderPage();
      if (global.location.hash) {
        const u = SGC.db.findData('schoolUpdates', global.location.hash.slice(1));
        if (u) setTimeout(() => openUpdate(u), 260);
      }
      document.addEventListener('sgc:lang', renderPage);
    },
  };
})(window);
