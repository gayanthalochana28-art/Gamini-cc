/* =================================================================
   SRI GAMINI CENTRAL COLLEGE — home page
   Everything here is rendered from localStorage, so the administration
   dashboard edits the same records the public site displays.
   ================================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const { esc, qs, formatDate } = SGC.utils;

  /* ---- hero: crest, name and motto come from School Information ---- */
  function hero(st) {
    const set = (id, nodeHTML) => { const n = qs('#' + id); if (n) n.innerHTML = nodeHTML; };
    set('heroTag', esc(SGC.i18n.loc(st, 'schoolTag')));
    set('heroName', esc(SGC.i18n.loc(st, 'schoolName')));
    set('heroMotto', esc(SGC.i18n.loc(st, 'motto')) + '  ·  est. ' + esc(st.founded));
  }

  /* ---- animated counters ---- */
  function stats(st) {
    const mount = qs('#statGrid');
    if (!mount) return;
    const s = st.stats || {};
    const rows = [
      { icon: '🎒', v: s.students, label: 'Students on roll' },
      { icon: '👩‍🏫', v: s.teachers, label: 'Qualified teachers' },
      { icon: '🏫', v: s.classes, label: 'Classes' },
      { icon: '🏆', v: s.years, label: 'Years of excellence', suffix: '+' },
    ];
    mount.innerHTML = rows.map((r, i) =>
      '<div class="stat" data-reveal data-delay="' + (i + 1) + '">' +
        '<div class="stat__icon" aria-hidden="true">' + r.icon + '</div>' +
        '<div class="stat__value" data-count="' + (r.v || 0) + '">0</div>' +
        '<div class="stat__label">' + esc(r.label) + '</div>' +
      '</div>').join('');
    mount.querySelectorAll('[data-count]').forEach((n) => {
      SGC.utils.animateCount(n, Number(n.dataset.count), 1400);
    });
  }

  /* ---- highlights ---- */
  function highlights(st) {
    const mount = qs('#homeHighlights');
    if (!mount) return;
    const ICONS = ['🎓', '🔬', '💻', '🏉', '🎭', '🤝'];
    mount.innerHTML = (st.highlights || []).map((h, i) =>
      '<div class="card card--hover" data-reveal data-delay="' + (i % 3 + 1) + '">' +
        '<div class="card__icon" aria-hidden="true">' + esc(h.icon || ICONS[i % ICONS.length]) + '</div>' +
        '<h3 class="card__title">' + esc(h.title) + '</h3>' +
        '<p class="card__text">' + esc(h.text) + '</p>' +
      '</div>').join('');
  }

  SGC.pages.home = {
    init() {
      function render() {
        const st = SGC.db.getSettings();
        hero(st);
        stats(st);
        highlights(st);

        const pr = qs('#homePrincipal');
        if (pr) pr.innerHTML = SGC.principalCard(st, { full: false });

        /* important + latest notices, pinned by priority inside SGC.notices.live() */
        const nMount = qs('#homeNotices');
        const liveNotices = SGC.notices.live();
        SGC.notices.renderList(nMount, liveNotices.slice(0, 5), { truncate: 2 });
        const nc = qs('#homeNoticeCount');
        if (nc) nc.textContent = liveNotices.length ? 'Updated ' + formatDate(liveNotices[0].date) : '';

        const uMount = qs('#homeUpdates');
        SGC.updates.renderList(uMount, SGC.updates.live().slice(0, 3));

        const eMount = qs('#homeEvents');
        SGC.events.renderList(eMount, SGC.events.upcoming().slice(0, 4));

        SGC.gallery.grid(qs('#homeGallery'), SGC.gallery.all().slice(0, 8));

        const dl = SGC.db.all('schoolDownloads').slice()
          .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        SGC.downloads.renderList(qs('#homeDownloads'), dl.slice(0, 4));

        const addr = qs('#visitAddr');
        if (addr) addr.innerHTML = esc(SGC.i18n.loc(st, 'address')) + '<br>' +
          '<a href="tel:' + esc(String(st.phone).replace(/[^+\d]/g, '')) + '">' + esc(st.phone) + '</a> · ' +
          '<a href="mailto:' + esc(st.email) + '">' + esc(st.email) + '</a>';
        const map = qs('#visitMap');
        if (map) map.src = SGC.downloads.mapURL(st.mapQuery || st.address);
      }

      render();
      document.addEventListener('sgc:lang', render);
    },
  };
})(window);
