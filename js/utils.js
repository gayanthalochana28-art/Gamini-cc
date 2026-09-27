/* =============================================================
   SRI GAMINI CENTRAL COLLEGE — utilities
   Pure vanilla ES6+. No dependencies. Loaded first on every page.
   Exposes: window.SGC.utils, window.SGC.charts
   ============================================================= */
(function (global) {
  'use strict';

  const SGC = global.SGC = global.SGC || {};
  /* Per-page controllers register here (app.js dispatches on <body data-page>).
     Declared early because the feature modules load before app.js. */
  SGC.pages = SGC.pages || {};

  /* ---------- tiny DOM helpers ---------- */
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) node.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* Event delegation: on(container, 'click', '.btn', handler) */
  function on(container, type, selector, handler) {
    container.addEventListener(type, (e) => {
      const target = e.target.closest(selector);
      if (target && container.contains(target)) handler(e, target);
    });
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait || 200);
    };
  }

  /* ---------- safety ---------- */
  /* Every dynamic string that reaches innerHTML must pass through esc(). */
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
  const esc = (v) => (v === null || v === undefined ? '' : String(v).replace(/[&<>"']/g, (c) => ESC_MAP[c]));

  /* ---------- formatting ---------- */
  const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_SI = ['ජන', 'පෙබ', 'මාර්', 'අප්‍රේ', 'මැයි', 'ජූනි', 'ජූලි', 'අග', 'සැප්', 'ඔක්', 'නොවැ', 'දෙසැ'];

  function formatDate(iso, lang) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    const m = (lang === 'si' ? MONTHS_SI : MONTHS_EN)[d.getMonth()];
    return d.getDate() + ' ' + m + ' ' + d.getFullYear();
  }

  function formatDateTime(iso, lang) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    const h = d.getHours(), mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return formatDate(iso, lang) + ', ' + ((h % 12) || 12) + ':' + mm + ' ' + ampm;
  }

  function timeAgo(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
    return formatDate(iso);
  }

  const todayISO = () => new Date().toISOString().slice(0, 10);
  const nowISO = () => new Date().toISOString();

  function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  /* Deterministic accent colour per name so avatars look varied but stable. */
  function hueOf(str) {
    let h = 0;
    for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) % 360;
    return h;
  }

  /* Photo if present, otherwise an initials avatar. Never a broken image. */
  function avatarHTML(person, size) {
    const px = size || 48;
    const name = (person && (person.fullName || person.name || person.title)) || '';
    const src = person && person.photo ? assetURL(person.photo, person.folder || 'uploads') : '';
    if (src) {
      return '<img class="avatar" style="width:' + px + 'px;height:' + px + 'px" src="' + esc(src) +
        '" alt="' + esc(name) + '" loading="lazy" ' +
        'onerror="SGC.utils.avatarFallback(this,' + px + ')">';
    }
    return '<span class="avatar avatar--initials" aria-hidden="true" style="width:' + px + 'px;height:' + px +
      'px;font-size:' + Math.round(px * 0.38) + 'px;background:hsl(' + hueOf(name) + ',42%,32%)">' + esc(initials(name)) + '</span>';
  }

  function avatarFallback(img, px) {
    const wrap = el('span', {
      class: 'avatar avatar--initials',
      text: initials(img.alt || '?'),
      style: 'width:' + px + 'px;height:' + px + 'px;font-size:' + Math.round(px * 0.38) + 'px',
    });
    img.replaceWith(wrap);
  }

  function fileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0, n = bytes;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i ? n.toFixed(1) : Math.round(n)) + ' ' + u[i];
  }

  /* Uploads are stored either as a bare file name (served from assets/<folder>/)
     or as a data: URL captured in this browser. Relative paths must also be
     re-based on pages that live inside the pages/ sub directory. */
  function assetURL(ref, folder) {
    if (!ref) return '';
    if (/^(data:|blob:|https?:|\/|\.\.\/|\.\/)/i.test(ref)) return ref;
    const base = global.SGC && global.SGC.base ? global.SGC.base : '';
    return base + 'assets/' + (folder || 'uploads') + '/' + encodeURIComponent(ref);
  }

  /* Seed content stores paths relative to the site root ("assets/…"). Pages that
     live in a sub directory need them re-based, exactly like the nav links. */
  function rootURL(p) {
    if (!p) return '';
    if (/^(data:|blob:|https?:|mailto:|\/)/i.test(p)) return p;
    const base = global.SGC && global.SGC.base ? global.SGC.base : '';
    return base + p;
  }

  /* ---------- toast ---------- */
  let toastHost;
  function toast(message, type, ms) {
    if (!toastHost) {
      toastHost = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastHost);
    }
    const icons = { success: '✓', error: '✕', warning: '!', info: 'i' };
    const node = el('div', { class: 'toast toast--' + (type || 'success'), html:
      '<span class="toast__icon" aria-hidden="true">' + (icons[type] || icons.info) + '</span>' +
      '<span class="toast__msg">' + esc(message) + '</span>' });
    toastHost.appendChild(node);
    requestAnimationFrame(() => node.classList.add('is-in'));
    setTimeout(() => {
      node.classList.remove('is-in');
      setTimeout(() => node.remove(), 320);
    }, ms || 3200);
  }

  /* ---------- modal ---------- */
  let lastFocus = null;
  function modal(opts) {
    const o = opts || {};
    const backdrop = el('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Dialog' });
    const id = 'm' + Math.random().toString(36).slice(2, 8);
    backdrop.innerHTML =
      '<div class="modal' + (o.size ? ' modal--' + o.size : '') + '" tabindex="-1">' +
        '<div class="modal__head">' +
          '<h3 id="' + id + '-t" class="modal__title">' + esc(o.title || '') + '</h3>' +
          '<button type="button" class="modal__x" data-close aria-label="Close dialog">✕</button>' +
        '</div>' +
        '<div class="modal__body" id="' + id + '-b">' + (o.body || '') + '</div>' +
        (o.footer ? '<div class="modal__foot">' + o.footer + '</div>' : '') +
      '</div>';
    backdrop.setAttribute('aria-labelledby', id + '-t');
    document.body.appendChild(backdrop);
    document.body.classList.add('no-scroll');
    lastFocus = document.activeElement;

    const handle = {
      root: backdrop,
      body: () => qs('#' + id + '-b', backdrop),
      close() {
        if (!backdrop.parentNode) return;
        backdrop.classList.add('is-closing');
        setTimeout(() => {
          backdrop.remove();
          if (!qs('.modal-backdrop')) document.body.classList.remove('no-scroll');
          if (lastFocus && lastFocus.focus) lastFocus.focus();
        }, 180);
        if (typeof o.onClose === 'function') o.onClose();
      },
    };

    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop && o.dismissible !== false) handle.close(); });
    on(backdrop, 'click', '[data-close]', () => handle.close());
    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); handle.close(); return; }
      if (e.key !== 'Tab') return;
      const f = qsa('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', backdrop)
        .filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    requestAnimationFrame(() => {
      backdrop.classList.add('is-in');
      const auto = qs('[autofocus]', backdrop) || qs('.modal', backdrop);
      if (auto) auto.focus();
    });
    if (typeof o.onOpen === 'function') o.onOpen(handle);
    return handle;
  }

  /* Promise-based confirmation. Always used before a destructive action. */
  function confirmDialog(opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      let done = false;
      const finish = (v, m) => { if (done) return; done = true; m.close(); resolve(v); };
      const h = modal({
        title: o.title || 'Please confirm',
        size: 'sm',
        body: '<p class="confirm__text">' + esc(o.message || 'Are you sure?') + '</p>' +
          (o.detail ? '<p class="confirm__detail">' + esc(o.detail) + '</p>' : ''),
        footer:
          '<button type="button" class="btn btn--ghost" data-cancel>Cancel</button>' +
          '<button type="button" class="btn ' + (o.danger ? 'btn--danger' : 'btn--primary') + '" data-ok autofocus>' +
            esc(o.confirmText || 'Confirm') + '</button>',
        onClose: () => finish(false, h),
        onOpen(m) {
          on(m.root, 'click', '[data-cancel]', () => finish(false, m));
          on(m.root, 'click', '[data-ok]', () => finish(true, m));
        },
      });
    });
  }

  /* ---------- partial rendering ---------- */
  function skeleton(count, type) {
    let out = '';
    for (let i = 0; i < (count || 3); i++) {
      out += type === 'table'
        ? '<div class="sk-row"><span class="sk sk--w15"></span><span class="sk sk--w40"></span><span class="sk sk--w25"></span><span class="sk sk--w10"></span></div>'
        : '<div class="sk-card"><span class="sk sk--circle"></span><span class="sk sk--w60"></span><span class="sk sk--w80"></span></div>';
    }
    return '<div class="sk-wrap" aria-busy="true" aria-label="Loading">' + out + '</div>';
  }

  function emptyState(o) {
    const d = o || {};
    return '<div class="empty">' +
      '<div class="empty__icon" aria-hidden="true">' + (d.icon || '◈') + '</div>' +
      '<h3 class="empty__title">' + esc(d.title || 'Nothing here yet') + '</h3>' +
      '<p class="empty__text">' + esc(d.text || '') + '</p>' +
      (d.action ? '<button type="button" class="btn btn--primary" data-empty-action="' + esc(d.action) + '">' + esc(d.actionLabel || 'Add') + '</button>' : '') +
      '</div>';
  }

  function noResults(what) {
    return emptyState({ icon: '⌕', title: 'No matches', text: 'Nothing matched your search for ' + (what || '') + '. Try a different term or clear the filters.' });
  }

  /* ---------- counters & scroll reveal ---------- */
  function animateCount(node, to, dur) {
    const target = Number(to) || 0;
    const suffix = node.dataset.suffix || '';
    const start = performance.now();
    const from = 0;
    function step(now) {
      const p = Math.min(1, (now - start) / (dur || 1400));
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(from + (target - from) * eased).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  let io;
  function scrollReveal(root) {
    const nodes = qsa('[data-reveal]', root || document);
    if (!('IntersectionObserver' in global)) { nodes.forEach((n) => n.classList.add('is-visible')); return; }
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-visible');
          if (e.target.hasAttribute('data-count')) animateCount(e.target, e.target.getAttribute('data-count'));
          io.unobserve(e.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    }
    nodes.forEach((n) => io.observe(n));
  }

  /* ---------- file input → data URL (demo-only image storage) ---------- */
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      if (!/^image\//.test(file.type)) return reject(new Error('Please choose an image file.'));
      if (file.size > 1500000) return reject(new Error('Image is larger than 1.5 MB. Please choose a smaller file.'));
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Could not read that file.'));
      r.readAsDataURL(file);
    });
  }

  /* Files are not uploaded anywhere in the demo — we keep name/size/type only. */
  function describeFile(file) {
    if (!file) return null;
    return { name: file.name, size: file.size, type: file.type || '', addedAt: nowISO() };
  }

  const uid = (p) => (p || 'x') + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);

  /* Sort helper for admin tables: sorts a copy, never the source array. */
  function sortBy(list, key, dir) {
    const d = dir === 'desc' ? -1 : 1;
    return list.slice().sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av === bv) return 0;
      if (av === undefined || av === null || av === '') return 1;
      if (bv === undefined || bv === null || bv === '') return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * d;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * d;
    });
  }

  function matches(haystack, term) {
    if (!term) return true;
    const t = String(term).toLowerCase();
    return Object.keys(haystack).some((k) => {
      const v = haystack[k];
      return typeof v === 'string' && v.toLowerCase().includes(t);
    });
  }

  /* ---------- SVG charts (no external chart library) ---------- */
  const charts = {};
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };
  const PALETTE = ['#6E172D', '#D4A842', '#8C3A52', '#C05E2A', '#3F6E63', '#A8823C', '#5B2233', '#E0C070'];

  function chartFrame(title) {
    const wrap = el('div', { class: 'chart' });
    if (title) wrap.appendChild(el('h4', { class: 'chart__title', text: title }));
    const svg = svgEl('svg', { class: 'chart__svg', viewBox: '0 0 480 260', preserveAspectRatio: 'xMidYMid meet', role: 'img' });
    svg.setAttribute('aria-label', title || 'chart');
    wrap.appendChild(svg);
    const legend = el('div', { class: 'chart__legend' });
    wrap.appendChild(legend);
    return { wrap, svg, legend };
  }

  charts.bar = function (mount, data, opts) {
    const o = opts || {};
    const f = chartFrame(o.title);
    const W = 480, H = 260, pad = { t: 18, r: 12, b: 40, l: 40 };
    const max = Math.max(1, ...data.map((d) => d.value));
    const bw = (W - pad.l - pad.r) / data.length;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (H - pad.t - pad.b) * (i / 4);
      f.svg.appendChild(svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, class: 'chart__grid' }));
      f.svg.appendChild(svgEl('text', { x: pad.l - 7, y: y + 4, class: 'chart__tick', 'text-anchor': 'end' }))
        .textContent = Math.round(max * (1 - i / 4));
    }
    data.forEach((d, i) => {
      const h = (d.value / max) * (H - pad.t - pad.b);
      const x = pad.l + i * bw + bw * 0.22, y = H - pad.b - h;
      const r = svgEl('rect', { x, y: H - pad.b, width: bw * 0.56, height: 0, rx: 4, class: 'chart__bar', fill: PALETTE[i % PALETTE.length] });
      const t = svgEl('title'); t.textContent = d.label + ': ' + d.value; r.appendChild(t);
      f.svg.appendChild(r);
      requestAnimationFrame(() => {
        r.style.transition = 'y .7s cubic-bezier(.2,.8,.2,1) ' + (i * 60) + 'ms, height .7s cubic-bezier(.2,.8,.2,1) ' + (i * 60) + 'ms';
        r.setAttribute('y', y); r.setAttribute('height', Math.max(0, h));
      });
      const lab = svgEl('text', { x: pad.l + i * bw + bw / 2, y: H - pad.b + 18, class: 'chart__label', 'text-anchor': 'middle' });
      lab.textContent = d.label.length > 9 ? d.label.slice(0, 8) + '…' : d.label;
      f.svg.appendChild(lab);
    });
    mount.innerHTML = ''; mount.appendChild(f.wrap);
    return f;
  };

  charts.line = function (mount, data, opts) {
    const o = opts || {};
    const f = chartFrame(o.title);
    const W = 480, H = 260, pad = { t: 18, r: 14, b: 36, l: 40 };
    const max = Math.max(1, ...data.map((d) => d.value)) * 1.1;
    const stepX = (W - pad.l - pad.r) / Math.max(1, data.length - 1);
    const pt = (d, i) => [pad.l + i * stepX, pad.t + (H - pad.t - pad.b) * (1 - d.value / max)];
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (H - pad.t - pad.b) * (i / 4);
      f.svg.appendChild(svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, class: 'chart__grid' }));
      f.svg.appendChild(svgEl('text', { x: pad.l - 7, y: y + 4, class: 'chart__tick', 'text-anchor': 'end' }))
        .textContent = Math.round(max * (1 - i / 4));
    }
    const pts = data.map(pt);
    const dLine = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const gid = 'g' + Math.random().toString(36).slice(2, 7);
    const defs = svgEl('defs');
    defs.innerHTML = '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#6E172D" stop-opacity=".30"/><stop offset="100%" stop-color="#6E172D" stop-opacity="0"/></linearGradient>';
    f.svg.appendChild(defs);
    if (pts.length > 1) {
      f.svg.appendChild(svgEl('path', { d: dLine + ' L' + pts[pts.length - 1][0] + ' ' + (H - pad.b) + ' L' + pts[0][0] + ' ' + (H - pad.b) + ' Z', fill: 'url(#' + gid + ')', stroke: 'none' }));
      const path = svgEl('path', { d: dLine, fill: 'none', stroke: '#6E172D', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      f.svg.appendChild(path);
      const len = path.getTotalLength ? path.getTotalLength() : 1000;
      path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
      requestAnimationFrame(() => { path.style.transition = 'stroke-dashoffset 1.1s ease'; path.style.strokeDashoffset = 0; });
    }
    pts.forEach((p, i) => {
      const c = svgEl('circle', { cx: p[0], cy: p[1], r: 4, class: 'chart__dot' });
      const t = svgEl('title'); t.textContent = data[i].label + ': ' + data[i].value; c.appendChild(t);
      f.svg.appendChild(c);
      const lab = svgEl('text', { x: p[0], y: H - pad.b + 18, class: 'chart__label', 'text-anchor': 'middle' });
      lab.textContent = data[i].label.length > 7 ? data[i].label.slice(0, 6) + '…' : data[i].label;
      f.svg.appendChild(lab);
    });
    mount.innerHTML = ''; mount.appendChild(f.wrap);
    return f;
  };

  charts.donut = function (mount, data, opts) {
    const o = opts || {};
    const f = chartFrame(o.title);
    const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
    const cx = 130, cy = 130, R = 92, r = 56;
    let a0 = -Math.PI / 2;
    data.forEach((d, i) => {
      const frac = (Number(d.value) || 0) / total;
      const a1 = a0 + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const p = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
      const [x1, y1] = p(a0, R), [x2, y2] = p(a1 - 0.012, R), [x3, y3] = p(a1 - 0.012, r), [x4, y4] = p(a0, r);
      const path = svgEl('path', {
        d: 'M' + x1 + ' ' + y1 + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 +
           ' L' + x3 + ' ' + y3 + ' A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + x4 + ' ' + y4 + ' Z',
        fill: PALETTE[i % PALETTE.length], class: 'chart__arc',
      });
      const t = svgEl('title'); t.textContent = d.label + ': ' + d.value + ' (' + Math.round(frac * 100) + '%)';
      path.appendChild(t);
      f.svg.appendChild(path);
      f.legend.appendChild(el('span', { class: 'chart__key', html:
        '<i style="background:' + PALETTE[i % PALETTE.length] + '"></i>' + esc(d.label) + ' <b>' + d.value + '</b>' }));
      a0 = a1;
    });
    const c = svgEl('text', { x: cx, y: cy + 6, class: 'chart__center', 'text-anchor': 'middle' });
    c.textContent = o.center !== undefined ? o.center : total;
    f.svg.appendChild(c);
    f.svg.setAttribute('viewBox', '0 0 480 260');
    mount.innerHTML = ''; mount.appendChild(f.wrap);
    return f;
  };

  SGC.utils = {
    qs, qsa, el, on, debounce, esc, formatDate, formatDateTime, timeAgo, todayISO, nowISO,
    initials, avatarHTML, avatarFallback, fileSize, assetURL, rootURL, toast, modal, confirmDialog, skeleton,
    emptyState, noResults, animateCount, scrollReveal, readFileAsDataURL, describeFile, uid,
    sortBy, matches, MONTHS_EN, MONTHS_SI,
  };
  SGC.charts = charts;
  SGC.PALETTE = PALETTE;
})(window);
