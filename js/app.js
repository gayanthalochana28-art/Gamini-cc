/* =================================================================
   SRI GAMINI CENTRAL COLLEGE — site chrome & page controller
   Exposes: window.SGC.app, window.SGC.pages, window.SGC.i18n

   Every page sets <body data-page="home" data-base="" data-chrome="site">.
   This file renders the shared chrome (announcement bar, navbar, mobile
   drawer, footer, search overlay, loading screen), applies the saved
   language + theme, and then calls SGC.pages[page].init() if defined.
   ================================================================= */
(function (global) {
  'use strict';

  const SGC = global.SGC = global.SGC || {};
  const { qs, qsa, esc, el } = SGC.utils;
  SGC.pages = SGC.pages || {};

  /* ---------------- navigation model ----------------
     `opt:true` items collapse into the "More" menu on mid-size screens
     and appear inline from 1280px up. */
  const NAV = [
    { k: 'home',        href: 'index.html',                page: 'home' },
    { k: 'about',       href: 'pages/about.html',          page: 'about' },
    { k: 'academics',   href: 'pages/academics.html',      page: 'academics' },
    { k: 'teachers',    href: 'pages/teachers.html',       page: 'teachers' },
    { k: 'notices',     href: 'pages/notices.html',        page: 'notices' },
    { k: 'updates',     href: 'pages/updates.html',        page: 'updates', opt: true },
    { k: 'events',      href: 'pages/events.html',         page: 'events' },
    { k: 'gallery',     href: 'pages/gallery.html',        page: 'gallery' },
    { k: 'achievements',href: 'pages/achievements.html',   page: 'achievements', opt: true },
    { k: 'downloads',   href: 'pages/downloads.html',      page: 'downloads' },
    { k: 'students',    href: 'pages/students.html',       page: 'students', opt: true },
    { k: 'contact',     href: 'pages/contact.html',        page: 'contact' },
  ];

  /* ---------------- i18n ---------------- */
  const I18N = {
    en: {
      'nav.home':'Home','nav.about':'About','nav.academics':'Academic','nav.teachers':'Teachers',
      'nav.students':'Students','nav.notices':'Notices','nav.updates':'Updates','nav.events':'Events',
      'nav.gallery':'Gallery','nav.achievements':'Achievements','nav.downloads':'Downloads',
      'nav.contact':'Contact','nav.more':'More','nav.login':'Login','nav.logout':'Logout',
      'nav.search':'Search','nav.profile':'Profile','nav.dashboard':'Dashboard',
      'hero.welcome':'Welcome to','hero.studentLogin':'Student Login','hero.teacherLogin':'Teacher Login',
      'hero.notices':'School Notices','hero.updates':'Latest Updates','hero.scroll':'Scroll',
      'home.stats':'By the numbers','home.notices':'Latest Notices','home.updates':'Latest Updates',
      'home.events':'Upcoming Events','home.principal':"Principal's Message",'home.highlights':'School Highlights',
      'home.quick':'Quick Links','home.gallery':'Photo Gallery','home.downloads':'Important Downloads',
      'home.viewAll':'View all','common.readMore':'Read more','common.view':'View','common.download':'Download',
      'common.search':'Search','common.filter':'Filter','common.all':'All','common.date':'Date',
      'common.category':'Category','common.priority':'Priority','common.title':'Title','common.close':'Close',
      'common.save':'Save Changes','common.cancel':'Cancel','common.delete':'Delete','common.edit':'Edit',
      'common.add':'Add','common.actions':'Actions','common.status':'Status','common.submit':'Submit',
      'common.loading':'Loading','common.required':'Required','common.yes':'Yes','common.no':'No',
      'footer.about':'About the College','footer.links':'Quick Links','footer.contact':'Contact Us',
      'footer.follow':'Follow Us','footer.rights':'All rights reserved.','footer.built':'A national school under the Ministry of Education.',
      'contact.form':'Send us a message','contact.name':'Full name','contact.email':'Email address',
      'contact.phone':'Telephone','contact.subject':'Subject','contact.message':'Message',
      'search.placeholder':'Search notices, updates, teachers, events, documents…',
      'search.hint':'Press Enter to search, Esc to close',
      'login.admin':'Admin','login.teacher':'Teacher','login.student':'Student',
    },
    si: {
      'nav.home':'මුල් පිටුව','nav.about':'අප ගැන','nav.academics':'අධ්‍යාපනය','nav.teachers':'ගුරුවරු',
      'nav.students':'සිසුන්','nav.notices':'නිවේදන','nav.updates':'පුවත්','nav.events':'වැඩසටහන්',
      'nav.gallery':'ඡායාරූප','nav.achievements':'ජයග්‍රහණ','nav.downloads':'බාගත කිරීම්',
      'nav.contact':'සම්බන්ධ වන්න','nav.more':'තව','nav.login':'පිවිසෙන්න','nav.logout':'ඉවත් වන්න',
      'nav.search':'සොයන්න','nav.profile':'පැතිකඩ','nav.dashboard':'උපකරණ පුවරුව',
      'hero.welcome':'සාදරයෙන් පිළිගනිමු','hero.studentLogin':'සිසු පිවිසුම','hero.teacherLogin':'ගුරු පිවිසුම',
      'hero.notices':'පාසල් නිවේදන','hero.updates':'නවතම පුවත්','hero.scroll':'පහළට',
      'home.stats':'සංඛ්‍යාලේචන','home.notices':'නවතම නිවේදන','home.updates':'නවතම පුවත්',
      'home.events':'ඉදිරි වැඩසටහන්','home.principal':'ප්‍රධාන ආචාර්ය වචනය','home.highlights':'පාසල් විශේෂාංග',
      'home.quick':'ක්ෂණික සම්බන්ධක','home.gallery':'ඡායාරූප තෙරුව','home.downloads':'වැදගත් බාගත කිරීම්',
      'home.viewAll':'සියල්ල බලන්න','common.readMore':'තව කියවන්න','common.view':'බලන්න','common.download':'බාගන්න',
      'common.search':'සොයන්න','common.filter':'පෙරහන','common.all':'සියල්ල','common.date':'දිනය',
      'common.category':'ප්‍රවර්ගය','common.priority':'ප්‍රමුඛතාව','common.title':'මාතෘකාව','common.close':'වසන්න',
      'common.save':'සුරකින්න','common.cancel':'අවලංගු','common.delete':'මකන්න','common.edit':'සංශෝධනය',
      'common.add':'එක් කරන්න','common.actions':'ක්‍රියා','common.status':'තත්ත්වය','common.submit':'යොමු කරන්න',
      'common.loading':'පූරණය වෙමින්','common.required':'අවශ්‍යයි','common.yes':'ඔව්','common.no':'නැත',
      'footer.about':'පාසල ගැන','footer.links':'ක්ෂණික සම්බන්ධක','footer.contact':'අප හා සම්බන්ධ වන්න',
      'footer.follow':'අපව අනුගමනය කරන්න','footer.rights':'සියලුම හිමිකම් ඇවිරිණි.','footer.built':'අධ්‍යාපන අමාත්‍යාංශය යටතේ ජාතික පාසලකි.',
      'contact.form':'අපට පණිවිඩයක් එවන්න','contact.name':'සම්පූර්ණ නම','contact.email':'විද්‍යුත් තැපෑල',
      'contact.phone':'දුරකථන','contact.subject':'මාතෘකාව','contact.message':'පණිවිඩය',
      'search.placeholder':'නිවේදන, පුවත්, ගුරුවරු, වැඩසටහන් සොයන්න…',
      'search.hint':'සොයන්න Enter ඔබන්න · වැසීමට Esc ඔබන්න',
      'login.admin':'පරිපාලක','login.teacher':'ගුරු','login.student':'සිසු',
    },
  };

  let lang = 'en';
  const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;

  function setLang(next) {
    lang = next === 'si' ? 'si' : 'en';
    localStorage.setItem('sgc.lang', lang);
    document.documentElement.lang = lang === 'si' ? 'si' : 'en';
    document.documentElement.classList.toggle('is-si', lang === 'si');
    qsa('[data-i18n]').forEach((n) => { n.textContent = t(n.getAttribute('data-i18n')); });
    qsa('[data-i18n-ph]').forEach((n) => { n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph'))); });
    qsa('.lang-switch button').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === lang));
    qsa('[data-lang-block]').forEach((n) => { n.hidden = n.dataset.langBlock !== lang; });
    document.dispatchEvent(new CustomEvent('sgc:lang', { detail: { lang } }));
  }
  const getLang = () => lang;

  /* Pick the Sinhala variant of a record when it exists, else English. */
  function loc(obj, field) {
    if (!obj) return '';
    if (lang === 'si') {
      const v = obj[field + 'Si'];
      if (v && String(v).trim()) return v;
    }
    return obj[field] || '';
  }

  /* ---------------- theme ---------------- */
  function applyTheme(mode) {
    document.documentElement.dataset.theme = mode;
    localStorage.setItem('sgc.theme', mode);
    qsa('[data-theme-toggle]').forEach((b) => { b.textContent = mode === 'dark' ? '☀' : '☾'; });
  }

  /* ---------------- chrome markup ---------------- */
  function chromeHTML(base) {
    const st = SGC.db.getSettings();
    const s = SGC.auth.getSession();
    const page = document.body.dataset.page;

    const link = (item, cls) =>
      '<li><a class="' + (cls || 'nav__link') + (item.page === page ? ' is-active' : '') +
      (item.opt ? ' nav__opt' : '') + '" href="' + base + item.href + '" data-i18n="nav.' + item.k + '">' +
      esc(item.label || item.k) + '</a></li>';

    const mainItems = NAV.filter((i) => !i.opt);
    const moreItems = NAV.filter((i) => i.opt);

    const authBtn = s
      ? '<a class="btn btn--outline btn--sm" href="' + base + SGC.auth.homeFor(s.role) + '">' +
        '<span>' + esc(SGC.auth.ROLES[s.role].label) + '</span></a>'
      : '<a class="btn btn--primary btn--sm btn-login" href="' + base + 'login.html">' + t('nav.login') + '</a>';

    return {
      announce: st.announcement && st.announcement.active
        ? '<div class="announce" id="announce"><div class="container announce__inner">' +
            '<span class="announce__tag">' + (lang === 'si' ? 'දැනුම්දීම' : 'Notice') + '</span>' +
            '<span>' + esc(loc(st.announcement, 'text')) +
            (st.announcement.link ? ' <a href="' + base + st.announcement.link + '">' + t('common.view') + ' →</a>' : '') +
            '</span></div><button class="announce__x" data-announce-x aria-label="Dismiss announcement">✕</button></div>'
        : '',

      nav:
        '<header class="nav" id="siteNav"><div class="container nav__inner">' +
          '<a class="brand" href="' + base + 'index.html" aria-label="' + esc(st.schoolName) + ' home">' +
            '<img class="brand__logo" src="' + base + 'assets/logo.png" alt="' + esc(st.schoolName) + ' crest" width="52" height="52">' +
            '<span class="brand__text"><span class="brand__name">' + esc(loc(st, 'schoolName')) + '</span>' +
            '<span class="brand__sub">' + esc(loc(st, 'schoolTag')) + '</span></span></a>' +
          '<nav aria-label="Main navigation"><ul class="nav__menu">' +
            mainItems.map((i) => link(i)).join('') +
            '<li class="nav__more-wrap"><button class="nav__link nav__more" aria-expanded="false" aria-haspopup="true">' +
              t('nav.more') + ' <span aria-hidden="true">▾</span></button>' +
              '<ul class="nav__dropdown" role="menu">' +
              moreItems.map((i) => '<li role="menuitem"><a href="' + base + i.href + '" class="nav__link' +
                (i.page === page ? ' is-active' : '') + '" data-i18n="nav.' + i.k + '">' + esc(t('nav.' + i.k)) + '</a></li>').join('') +
              '</ul></li>' +
          '</ul></nav>' +
          '<div class="nav__actions">' +
            '<div class="nav__utility">' +
              '<button class="icon-btn" data-search-open aria-label="' + t('nav.search') + '" title="' + t('nav.search') + '">⌕</button>' +
              '<span class="lang-switch" role="group" aria-label="Language">' +
                '<button data-lang="en" class="' + (lang === 'en' ? 'is-active' : '') + '" aria-pressed="' + (lang === 'en') + '">EN</button>' +
                '<button data-lang="si" class="' + (lang === 'si' ? 'is-active' : '') + '" aria-pressed="' + (lang === 'si') + '">සිං</button>' +
              '</span>' +
              '<button class="icon-btn" data-theme-toggle aria-label="Toggle dark mode">☾</button>' +
            '</div>' +
            authBtn +
            '<button class="nav__burger" data-burger aria-label="Open menu" aria-expanded="false"><span></span></button>' +
          '</div>' +
        '</div></header>',

      drawer:
        '<nav class="mobile-nav" id="mobileNav" aria-label="Mobile navigation">' +
          '<div class="mobile-nav__head"><img src="' + base + 'assets/logo.png" alt="">' +
            '<div><strong>' + esc(loc(st, 'schoolName')) + '</strong><small>' + esc(loc(st, 'schoolTag')) + '</small></div>' +
            '<button class="mobile-nav__x" data-drawer-x aria-label="Close menu">✕</button></div>' +
          NAV.map((i) => '<a href="' + base + i.href + '" class="' + (i.page === page ? 'is-active' : '') +
            '" data-i18n="nav.' + i.k + '">' + esc(t('nav.' + i.k)) + '</a>').join('') +
          '<div class="mobile-nav__sep"></div>' +
          (s
            ? '<a href="' + base + 'profile.html"><span data-i18n="nav.profile">' + esc(s.name) + '</span></a>' +
              '<button class="btn btn--gold" data-logout><span>' + t('nav.logout') + '</span></button>'
            : '<a class="btn btn--gold" href="' + base + 'login.html">' + t('nav.login') + '</a>') +
        '</nav><div class="scrim" id="navScrim" data-drawer-x></div>',

      footer: footerHTML(base, st),
    };
  }

  function footerHTML(base, st) {
    const y = new Date().getFullYear();
    const socials = [['facebook', 'f'], ['instagram', 'ig'], ['youtube', 'yt'], ['linkedin', 'in']]
      .filter(([k]) => st[k]).map(([k, lab]) =>
        '<a href="' + esc(st[k]) + '" target="_blank" rel="noopener noreferrer" aria-label="' + k + '">' + lab + '</a>').join('');

    return '<footer class="footer" id="siteFooter">' +
      '<div class="container footer__grid">' +
        '<div class="footer__col">' +
          '<div class="footer__brand"><img src="' + base + 'assets/logo.png" alt="' + esc(st.schoolName) + ' crest">' +
            '<div><strong>' + esc(loc(st, 'schoolName')) + '</strong><small>' + esc(loc(st, 'schoolTag')) + ' • ' + esc(st.motto) + '</small></div></div>' +
          '<p>' + esc(loc(st, 'about')) + '</p>' +
          (socials ? '<h4>' + t('footer.follow') + '</h4><div class="socials">' + socials + '</div>' : '') +
        '</div>' +
        '<div><h4>' + t('footer.links') + '</h4><ul class="footer__links">' +
          NAV.map((i) => '<li><a href="' + base + i.href + '" data-i18n="nav.' + i.k + '">' + esc(t('nav.' + i.k)) + '</a></li>').join('') +
          (SGC.auth.getSession() ? '' : '<li><a href="' + base + 'login.html">' + t('nav.login') + '</a></li>') +
        '</ul></div>' +
        '<div><h4>' + t('footer.about') + '</h4><ul class="footer__links">' +
          '<li><a href="' + base + 'pages/about.html#vision">' + (lang === 'si' ? 'දැක්ම' : 'Vision & Mission') + '</a></li>' +
          '<li><a href="' + base + 'pages/about.html#history">' + (lang === 'si' ? 'ඉතිහාසය' : 'School History') + '</a></li>' +
          '<li><a href="' + base + 'pages/about.html#principal">' + (lang === 'si' ? 'ප්‍රධාන ආචාර්ය' : "Principal's Message") + '</a></li>' +
          '<li><a href="' + base + 'pages/academics.html">' + (lang === 'si' ? 'විෂය ධාරා' : 'Academic Streams') + '</a></li>' +
          '<li><a href="' + base + 'pages/achievements.html">' + (lang === 'si' ? 'ජයග්‍රහණ' : 'Achievements') + '</a></li>' +
          '<li><a href="' + base + 'pages/contact.html">' + (lang === 'si' ? 'සම්බන්ධ වන්න' : 'Contact') + '</a></li>' +
        '</ul></div>' +
        '<div><h4>' + t('footer.contact') + '</h4><ul class="footer__contact">' +
          '<li><span>⌂</span><span>' + esc(loc(st, 'address')) + '</span></li>' +
          '<li><span>☏</span><a href="tel:' + esc(st.phone.replace(/\s/g, '')) + '">' + esc(st.phone) + '</a></li>' +
          '<li><span>✉</span><a href="mailto:' + esc(st.email) + '">' + esc(st.email) + '</a></li>' +
          '<li><span>⏱</span><span>' + esc(st.hours) + '</span></li>' +
        '</ul></div>' +
      '</div>' +
      '<div class="footer__bottom container"><p>© ' + y + ' ' + esc(st.schoolName) +
        ' (' + esc(st.schoolTag) + '). ' + t('footer.rights') + '</p>' +
        '<p>' + esc(st.footerNote) + '</p></div>' +
      '<button class="to-top" id="toTop" aria-label="Back to top">↑</button>' +
    '</footer>';
  }

  /* ---------------- global search ---------------- */
  function buildIndex() {
    const db = SGC.db;
    const groups = [
      { key: 'notices', label: lang === 'si' ? 'නිවේදන' : 'Notices', icon: '📌', href: 'pages/notices.html',
        rows: db.all('schoolNotices').filter((n) => n.published).map((n) => ({
          id: n.id, title: n.title, sub: (n.category || '') + ' • ' + SGC.utils.formatDate(n.date),
          text: (n.title + ' ' + n.body + ' ' + n.author).toLowerCase(), body: n.body })) },
      { key: 'updates', label: lang === 'si' ? 'පුවත්' : 'Latest Updates', icon: '📰', href: 'pages/updates.html',
        rows: db.all('schoolUpdates').map((u) => ({ id: u.id, title: u.title,
          sub: (u.category || '') + ' • ' + SGC.utils.formatDate(u.date),
          text: (u.title + ' ' + u.excerpt + ' ' + u.content).toLowerCase(), body: u.excerpt })) },
      { key: 'teachers', label: lang === 'si' ? 'ගුරුවරු' : 'Teachers', icon: '👤', href: 'pages/teachers.html',
        rows: db.all('schoolTeachers').filter((x) => x.status === 'Active').map((x) => ({ id: x.id, title: x.fullName,
          sub: x.position + ' • ' + x.department,
          text: (x.fullName + ' ' + x.position + ' ' + x.department + ' ' + x.bio).toLowerCase(), body: x.bio })) },
      { key: 'events', label: lang === 'si' ? 'වැඩසටහන්' : 'Events', icon: '📅', href: 'pages/events.html',
        rows: db.all('schoolEvents').map((e) => ({ id: e.id, title: e.title,
          sub: SGC.utils.formatDate(e.date) + ' • ' + e.venue,
          text: (e.title + ' ' + e.description + ' ' + e.venue + ' ' + e.category).toLowerCase(), body: e.description })) },
      { key: 'downloads', label: lang === 'si' ? 'බාගත කිරීම්' : 'Downloads', icon: '⬇', href: 'pages/downloads.html',
        rows: db.all('schoolDownloads').map((x) => ({ id: x.id, title: x.title,
          sub: x.category + ' • ' + x.fileName,
          text: (x.title + ' ' + x.description + ' ' + x.category + ' ' + x.fileName).toLowerCase(), body: x.description })) },
      { key: 'achievements', label: lang === 'si' ? 'ජයග්‍රහණ' : 'Achievements', icon: '🏆', href: 'pages/achievements.html',
        rows: db.all('schoolAchievements').map((x) => ({ id: x.id, title: x.title,
          sub: x.level + ' • ' + x.recipient,
          text: (x.title + ' ' + x.recipient + ' ' + x.description + ' ' + x.category).toLowerCase(), body: x.description })) },
    ];
    return groups;
  }

  function highlight(text, term) {
    const safe = esc(text);
    if (!term) return safe;
    const rx = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return safe.replace(rx, '<mark class="sr-mark">$1</mark>');
  }

  function searchHTML(term) {
    if (!term || term.length < 2) {
      const st = SGC.db.getSettings();
      const chips = ['Admission', 'Exam timetable', 'Sports', st.principal.name.split(' ').slice(-1)[0], 'Bus route']
        .map((c) => '<button class="chip" data-suggest="' + esc(c) + '">' + esc(c) + '</button>').join('');
      return '<div class="search-suggest"><span class="sr-item__s" style="width:100%;margin-bottom:.3rem">' +
        (lang === 'si' ? 'ජනප්‍රිය සෙවීම්' : 'Popular searches') + '</span>' + chips + '</div>';
    }
    const q = term.toLowerCase();
    let out = '', total = 0;
    buildIndex().forEach((g) => {
      const hits = g.rows.filter((r) => r.text.includes(q)).slice(0, 4);
      if (!hits.length) return;
      total += hits.length;
      out += '<div class="sr-group"><div class="sr-group__h"><span>' + esc(g.label) + '</span><span>' + hits.length + '</span></div>' +
        hits.map((h) => '<a class="sr-item" href="' + BASE + g.href + (g.key === 'notices' || g.key === 'updates' ? '#' + encodeURIComponent(h.id) : '') + '">' +
          '<span class="sr-item__i" aria-hidden="true">' + g.icon + '</span>' +
          '<span><span class="sr-item__t">' + highlight(h.title, term) + '</span>' +
          '<span class="sr-item__s">' + highlight(h.sub, term) + '</span></span></a>').join('') + '</div>';
    });
    if (!total) out = SGC.utils.emptyState({ icon: '⌕', title: lang === 'si' ? 'ප්‍රතිඵල නැත' : 'No results',
      text: 'Nothing matched "' + term + '". Try a shorter word, or check the Notices and Downloads pages.' });
    return out;
  }

  let BASE = '';
  function openSearch() {
    const ov = qs('#searchOverlay');
    if (!ov) return;
    ov.classList.add('is-open');
    document.body.classList.add('no-scroll');
    const inp = qs('#searchInput', ov);
    inp.value = ''; qs('#searchResults', ov).innerHTML = searchHTML('');
    setTimeout(() => inp.focus(), 40);
  }
  function closeSearch() {
    const ov = qs('#searchOverlay');
    if (!ov) return;
    ov.classList.remove('is-open');
    if (!qs('.modal-backdrop')) document.body.classList.remove('no-scroll');
  }

  function searchOverlayHTML() {
    return '<div class="search-overlay" id="searchOverlay" role="dialog" aria-modal="true" aria-label="Site search">' +
      '<div class="search-box"><div class="search-box__top">' +
        '<span class="sr-item__i" aria-hidden="true">⌕</span>' +
        '<input id="searchInput" type="search" autocomplete="off" placeholder="' + esc(t('search.placeholder')) +
        '" aria-label="' + esc(t('search.placeholder')) + '">' +
        '<span class="search-box__esc">Esc</span>' +
        '<button class="icon-btn" data-search-close aria-label="Close search">✕</button>' +
      '</div><div class="search-results" id="searchResults" aria-live="polite"></div></div></div>';
  }

  /* ---------------- chrome wiring ---------------- */
  function mountChrome() {
    const base = BASE;
    const parts = chromeHTML(base);
    const frag = document.createDocumentFragment();
    const tmp = el('div');

    tmp.innerHTML = parts.announce + parts.nav;
    while (tmp.firstChild) frag.appendChild(tmp.firstChild);
    document.body.insertBefore(frag, document.body.firstChild);

    document.body.insertAdjacentHTML('beforeend', parts.drawer + parts.footer + searchOverlayHTML());
  }

  /* Language, theme and sign-out work identically on the public site and inside
     the dashboards, so the delegation is bound once for every chrome. */
  function wireUtility() {
    document.addEventListener('click', (e) => {
      const lb = e.target.closest('[data-lang]');
      if (lb) { setLang(lb.dataset.lang); return; }
      if (e.target.closest('[data-theme-toggle]')) {
        applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      }
      const lo = e.target.closest('[data-logout]');
      if (lo) {
        e.preventDefault();
        SGC.auth.logout();
        SGC.utils.toast('You have been signed out.', 'info');
        setTimeout(() => { global.location.href = BASE + 'index.html'; }, 500);
      }
    });
  }

  function wireChrome() {
    const drawer = qs('#mobileNav'), scrim = qs('#navScrim'), burger = qs('[data-burger]');

    const setDrawer = (open) => {
      if (!drawer) return;
      drawer.classList.toggle('is-open', open);
      scrim.classList.toggle('is-open', open);
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('no-scroll', open);
    };
    if (burger) burger.addEventListener('click', () => setDrawer(!drawer.classList.contains('is-open')));
    qsa('[data-drawer-x]').forEach((n) => n.addEventListener('click', () => setDrawer(false)));

    /* More dropdown */
    qsa('.nav__more').forEach((btn) => {
      const dd = btn.nextElementSibling;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = dd.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', () => { dd.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); });
    });

    /* announcement dismiss (remembered per session) */
    const ax = qs('[data-announce-x]');
    if (ax) ax.addEventListener('click', () => {
      qs('#announce').classList.add('is-hidden');
      sessionStorage.setItem('sgc.announceClosed', '1');
    });
    if (sessionStorage.getItem('sgc.announceClosed') === '1' && qs('#announce')) qs('#announce').classList.add('is-hidden');

    /* language + theme + logout are handled by wireUtility(), bound for every chrome */

    /* sticky nav shadow + back to top */
    const nav = qs('#siteNav'), toTop = qs('#toTop');
    const onScroll = () => {
      if (nav) nav.classList.toggle('is-scrolled', global.scrollY > 8);
      if (toTop) toTop.classList.toggle('is-on', global.scrollY > 600);
    };
    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (toTop) toTop.addEventListener('click', () => global.scrollTo({ top: 0, behavior: 'smooth' }));

    /* search */
    const inp = qs('#searchInput');
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-search-open]')) openSearch();
      if (e.target.closest('[data-search-close]')) closeSearch();
      const sug = e.target.closest('[data-suggest]');
      if (sug) { inp.value = sug.dataset.suggest; qs('#searchResults').innerHTML = searchHTML(inp.value); inp.focus(); }
    });
    qs('#searchOverlay').addEventListener('mousedown', (e) => { if (e.target.id === 'searchOverlay') closeSearch(); });
    if (inp) inp.addEventListener('input', SGC.utils.debounce(() => {
      qs('#searchResults').innerHTML = searchHTML(inp.value.trim());
    }, 160));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSearch(); setDrawer(false); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
    });

    /* page transition on internal navigation */
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a || a.target === '_blank' || a.dataset.noTrans !== undefined) return;
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') ||
          a.hasAttribute('download') || a.dataset.emptyAction !== undefined) return;
      if (global.location.protocol === 'file:') return; // avoid racing file:// navigation
      document.body.classList.add('is-navigating');
    });
    global.addEventListener('pageshow', () => document.body.classList.remove('is-navigating'));
  }

  /* ---------------- loading screen ---------------- */
  function mountLoader() {
    const st = SGC.db.getSettings();
    const l = el('div', { class: 'loader-screen', id: 'loaderScreen', html:
      '<div class="loader-screen__in"><img src="' + BASE + 'assets/logo.png" alt="">' +
      '<div class="loader-bar"></div><p>' + esc(st.shortName || 'SGCC') + '</p></div>' });
    document.body.appendChild(l);
    const hide = () => { l.classList.add('is-done'); setTimeout(() => l.remove(), 600); };
    setTimeout(hide, 700);
    if (document.readyState === 'complete') setTimeout(hide, 500);
    else global.addEventListener('load', () => setTimeout(hide, 350));
  }

  /* ---------------- boot ---------------- */

  /* When a live backend is configured, every collection is pulled into the
     local cache before a single page reads it — so the whole synchronous data
     layer keeps working unchanged. A slow or misconfigured project must never
     leave the site blank, hence the hard cap before rendering. */
  async function hydrate() {
    if (!global.SGC || !SGC.backend || !SGC.backend.init) return;
    const pending = SGC.backend.init();
    const cap = new Promise((res) => setTimeout(() => res({ timedOut: true }), 6000));
    const r = await Promise.race([pending, cap]);
    if (r && r.timedOut) {
      SGC.utils.toast('The server is taking too long — this page is showing the data cached on this device.', 'error', 6000);
      /* The pull carries on in the background. Saying so beats the page
         quietly disagreeing with the server a minute later. */
      pending.then((res) => {
        if (res && res.enabled) SGC.utils.toast('Server data has now arrived. Reload this page to use it.', 'info', 9000);
      });
    }
  }

  async function boot() {
    await hydrate();
    const body = document.body;
    BASE = body.dataset.base || '';
    SGC.base = BASE;
    const page = body.dataset.page || '';
    const chrome = body.dataset.chrome || 'site';

    lang = localStorage.getItem('sgc.lang') || SGC.db.getSettings().lang || 'en';
    applyTheme(localStorage.getItem('sgc.theme') || SGC.db.getSettings().theme || 'light');

    if (chrome === 'site') { mountChrome(); }
    if (body.dataset.loader !== 'off') mountLoader();

    setLang(lang);
    wireUtility();

    if (chrome === 'site') wireChrome();

    /* sidebar / drawer behaviour for dashboard shells */
    if (chrome === 'dash') {
      const side = qs('.side'), scrim = qs('#navScrim');
      const btn = qs('[data-burger]');
      if (btn && side) btn.addEventListener('click', () => {
        side.classList.toggle('is-open');
        if (scrim) scrim.classList.toggle('is-open', side.classList.contains('is-open'));
      });
      if (scrim) scrim.addEventListener('click', () => {
        side.classList.remove('is-open'); scrim.classList.remove('is-open');
      });
      qsa('.side__link[data-view], [data-goto]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view || b.dataset.goto)));
      const collapse = qs('[data-side-collapse]');
      if (collapse && side) collapse.addEventListener('click', () => {
        side.classList.toggle('is-collapsed');
        collapse.setAttribute('aria-pressed', String(side.classList.contains('is-collapsed')));
      });
    }

    if (SGC.pages[page] && typeof SGC.pages[page].init === 'function') {
      try { SGC.pages[page].init(); }
      catch (err) { console.error('[SGC] page init failed for "' + page + '"', err); }
    }

    SGC.utils.scrollReveal();
    document.dispatchEvent(new CustomEvent('sgc:ready', { detail: { page } }));
  }

  /* Dashboard view switching — one page, many panels (SPA-style). */
  function showView(name) {
    const views = qsa('.view');
    views.forEach((v) => v.classList.toggle('is-active', v.dataset.view === name));
    qsa('.side__link').forEach((b) => b.classList.toggle('is-active', b.dataset.view === name));
    const active = qs('.view.is-active');
    if (active) {
      const h = qs('h2', active);
      const slot = qs('[data-view-title]');
      if (h && slot) slot.textContent = h.textContent;
      document.title = (h ? h.textContent : 'Dashboard') + ' — ' + (SGC.db.getSettings().shortName || 'SGCC') + ' Dashboard';
      if (typeof SGC.pages[active.dataset.view] === 'function') SGC.pages[active.dataset.view]();
    }
    const side = qs('.side'); if (side) side.classList.remove('is-open');
    const scrim = qs('#navScrim'); if (scrim) scrim.classList.remove('is-open');
    global.scrollTo({ top: 0, behavior: 'smooth' });
  }

  SGC.app = { boot, showView, setLang, getLang, applyLang: setLang, t, loc, NAV, openSearch, closeSearch, buildIndex };
  SGC.i18n = { t, loc, setLang, get: getLang, I18N };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
