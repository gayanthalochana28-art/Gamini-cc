/* =================================================================
   SRI GAMINI CENTRAL COLLEGE — photo gallery
   Grid renderer + keyboard-navigable lightbox, shared by home preview
   and the public gallery page.
   ================================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const { esc, qs, qsa, formatDate } = SGC.utils;

  const CATEGORIES = ['School', 'Events', 'Sports', 'Educational', 'Competitions', 'Cultural', 'Students', 'Teachers'];

  function all() { return SGC.db.all('schoolGallery'); }

  function itemHTML(g, i) {
    return '<button type="button" class="g-item" data-gal="' + i + '" aria-label="Open ' + esc(g.title) + '">' +
      '<img src="' + esc(SGC.utils.rootURL(g.src)) + '" alt="' + esc(g.title) + '" loading="lazy" ' +
        'onerror="this.closest(\'.g-item\').classList.add(\'is-broken\');this.remove()">' +
      '<span class="badge badge--gold g-item__cat">' + esc(g.category || 'School') + '</span>' +
      '<span class="g-item__cap">' + esc(g.title) + '</span>' +
    '</button>';
  }

  function grid(mount, items) {
    if (!mount) return;
    const list = items || all();
    mount.innerHTML = list.length ? list.map(itemHTML).join('')
      : SGC.utils.emptyState({ icon: '🖼', title: 'No photos yet', text: 'Albums appear here once the school uploads them.' });
    mount.querySelectorAll('[data-gal]').forEach((b) => b.addEventListener('click', () => open(list, Number(b.dataset.gal))));
  }

  /* ---------------- lightbox ---------------- */
  let layer = null, queue = [], at = 0;

  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'lightbox';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', 'Photo viewer');
    layer.innerHTML =
      '<span class="lightbox__count" id="lbCount"></span>' +
      '<button type="button" class="lightbox__x" data-lb="close" aria-label="Close (Esc)">✕</button>' +
      '<button type="button" class="lightbox__nav lightbox__prev" data-lb="prev" aria-label="Previous image">‹</button>' +
      '<figure style="margin:0;text-align:center">' +
        '<img id="lbImg" src="" alt="">' +
        '<figcaption class="lightbox__cap" id="lbCap"></figcaption>' +
      '</figure>' +
      '<button type="button" class="lightbox__nav lightbox__next" data-lb="next" aria-label="Next image">›</button>';
    document.body.appendChild(layer);
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lb]');
      if (b) { step(b.dataset.lb); return; }
      if (e.target === layer) close();
    });
    document.addEventListener('keydown', (e) => {
      if (!layer || !layer.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') step('next');
      else if (e.key === 'ArrowLeft') step('prev');
    });
    return layer;
  }

  function step(dir) {
    if (dir === 'close') return close();
    if (dir === 'next') at = (at + 1) % queue.length;
    if (dir === 'prev') at = (at - 1 + queue.length) % queue.length;
    paint();
  }

  function paint() {
    const g = queue[at];
    if (!g) return;
    const img = qs('#lbImg', layer), cap = qs('#lbCap', layer), cnt = qs('#lbCount', layer);
    img.onerror = () => { img.removeAttribute('src'); };
    img.src = SGC.utils.rootURL(g.src);
    img.alt = g.title || '';
    cap.textContent = (g.title || '') + (g.caption ? ' — ' + g.caption : '');
    cnt.textContent = (at + 1) + ' / ' + queue.length + (g.date ? '  ·  ' + formatDate(g.date) : '');
  }

  function open(items, index) {
    queue = items; at = index || 0;
    ensureLayer().classList.add('is-open');
    document.body.style.overflow = 'hidden';
    paint();
    qs('.lightbox__x', layer).focus();
  }

  function close() {
    if (!layer) return;
    layer.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  SGC.gallery = { CATEGORIES, all, grid, itemHTML, open, close };

  /* ---------------- page controller ---------------- */
  SGC.pages.gallery = {
    init() {
      const mount = qs('#galGrid'), search = qs('#galSearch'), chips = qs('#galChips'), count = qs('#galCount');
      let cat = 'All', term = '';

      function current() {
        return all().filter((g) =>
          (cat === 'All' || g.category === cat) &&
          (!term || SGC.utils.matches(g, term)));
      }
      function paintAll() {
        const list = current();
        grid(mount, list);
        if (count) count.textContent = list.length + ' photo' + (list.length === 1 ? '' : 's');
      }
      function paintChips() {
        if (!chips) return;
        const used = CATEGORIES.filter((c) => all().some((g) => g.category === c));
        chips.innerHTML = ['All'].concat(used).map((c) =>
          '<button type="button" class="chip' + (c === cat ? ' is-active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('');
      }

      paintChips();
      paintAll();
      if (chips) chips.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        cat = b.dataset.cat;
        qsa('[data-cat]', chips).forEach((x) => x.classList.toggle('is-active', x === b));
        paintAll();
      });
      if (search) search.addEventListener('input', SGC.utils.debounce(() => { term = search.value.trim(); paintAll(); }, 180));
      document.addEventListener('sgc:lang', paintAll);
    },
  };
})(window);
