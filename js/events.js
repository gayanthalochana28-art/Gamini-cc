/* =================================================================
   SRI GAMINI CENTRAL COLLEGE — events & calendar
   Shared renderer for home + events page, plus a vanilla JS month calendar.
   ================================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const { esc, formatDate } = SGC.utils;

  const CATEGORIES = ['Sports', 'Cultural', 'Academic', 'Career', 'Administration', 'Religious', 'Examination'];

  const startOfDay = (x) => { const d = new Date(x); d.setHours(0, 0, 0, 0); return d; };
  const isUpcoming = (e) => e.date && startOfDay(e.date) >= startOfDay(new Date());

  function upcoming() {
    return SGC.db.all('schoolEvents').filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date));
  }
  function past() {
    return SGC.db.all('schoolEvents').filter((e) => !isUpcoming(e)).sort((a, b) => b.date.localeCompare(a.date));
  }

  function timeRange(e) {
    if (!e.startTime && !e.endTime) return 'All day';
    return [e.startTime, e.endTime].filter(Boolean).join(' – ');
  }

  function cardHTML(e, opts) {
    const o = opts || {};
    const d = new Date(e.date + 'T00:00:00');
    const ok = !isNaN(d);
    return '<article class="event' + (o.past ? ' event--past' : '') + '">' +
      '<div class="event__date"><span class="event__day">' + (ok ? d.getDate() : '—') + '</span>' +
        '<span class="event__mon">' + (ok ? SGC.utils.MONTHS_EN[d.getMonth()] : '') + '</span></div>' +
      '<div style="flex:1;min-width:0">' +
        '<h3 class="event__title">' + esc(SGC.i18n.loc(e, 'title')) + '</h3>' +
        '<div class="event__meta">' +
          '<span class="badge">' + esc(e.category || 'General') + '</span>' +
          '<span>🕒 ' + esc(timeRange(e)) + '</span>' +
          '<span>📍 ' + esc(SGC.i18n.loc(e, 'venue')) + '</span>' +
        '</div>' +
        (o.full && e.description ? '<p class="muted" style="font-size:.88rem;margin:.5rem 0 0">' + esc(e.description) + '</p>' : '') +
        (o.full && e.image ? '<img class="event__img" src="' + esc(SGC.utils.rootURL(e.image)) +
          '" alt="' + esc(SGC.i18n.loc(e, 'title')) + '" loading="lazy" onerror="this.remove()">' : '') +
        (e.organizer ? '<p class="muted" style="font-size:.8rem;margin:.4rem 0 0">Organised by ' + esc(e.organizer) + '</p>' : '') +
      '</div></article>';
  }

  function renderList(mount, items, opts) {
    if (!mount) return;
    mount.innerHTML = items.length ? items.map((e) => cardHTML(e, opts)).join('')
      : SGC.utils.emptyState({ icon: '🗓', title: 'Nothing scheduled', text: 'There are no events in this period yet.' });
  }

  /* ---------------- month calendar ---------------- */
  let calMonth = new Date();
  calMonth.setDate(1);

  function eventsOn(y, m, dayNum) {
    const iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0');
    return SGC.db.all('schoolEvents').filter((e) => e.date === iso);
  }

  function renderCalendar(mount) {
    if (!mount) return;
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1).getDay();          // 0 = Sunday
    const days = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    const today = new Date();
    const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'][m];

    let cells = '';
    for (let i = first - 1; i >= 0; i--) cells += '<div class="cal__cell is-out"><span class="cal__n">' + (prevDays - i) + '</span></div>';
    for (let day = 1; day <= days; day++) {
      const evs = eventsOn(y, m, day);
      const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
      cells += '<div class="cal__cell' + (isToday ? ' is-today' : '') + (evs.length ? ' is-has' : '') + '"' +
        (evs.length ? ' data-day="' + day + '" role="button" tabindex="0" aria-label="' + evs.length + ' event(s) on ' +
          monthName + ' ' + day : '') + '>' +
        '<span class="cal__n">' + day + '</span>' +
        (evs.length ? '<span class="cal__dots">' + evs.map(() => '<i class="cal__dot"></i>').join('') + '</span>' : '') +
        '</div>';
    }
    const used = first + days;
    for (let i = used % 7; i > 0 && i < 7; i--) cells += '<div class="cal__cell is-out"><span class="cal__n">' + i + '</span></div>';

    mount.innerHTML = '<div class="cal">' +
      '<div class="cal__head">' +
        '<button class="cal__nav" data-cal="-1" aria-label="Previous month">‹</button>' +
        '<h3>' + monthName + ' ' + y + '</h3>' +
        '<button class="cal__nav" data-cal="1" aria-label="Next month">›</button>' +
      '</div>' +
      '<div class="cal__grid">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map((d) => '<div class="cal__dow">' + d + '</div>').join('') + cells + '</div>' +
      '<div class="cal__tip" id="calTip"><span class="muted">Select a highlighted date to see what is happening.</span></div>' +
    '</div>';

    mount.querySelectorAll('[data-cal]').forEach((b) => b.addEventListener('click', () => {
      calMonth = new Date(y, m + Number(b.dataset.cal), 1);
      renderCalendar(mount);
    }));
    const showDay = (day) => {
      const tip = mount.querySelector('#calTip');
      const evs = eventsOn(y, m, day);
      if (!tip) return;
      tip.innerHTML = '<strong>' + formatDate(y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0')) + '</strong>' +
        (evs.length ? '<div class="notice-list" style="margin-top:.6rem">' +
          evs.map((e) => cardHTML(e, { full: true })).join('') + '</div>' : '<p class="muted">No events.</p>');
    };
    mount.querySelectorAll('[data-day]').forEach((c) => {
      c.addEventListener('click', () => showDay(Number(c.dataset.day)));
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter') showDay(Number(c.dataset.day)); });
    });
  }

  SGC.events = { CATEGORIES, upcoming, past, isUpcoming, cardHTML, renderList, renderCalendar, timeRange };

  SGC.pages.events = {
    init() {
      const up = SGC.utils.qs('#evUpcoming'), pv = SGC.utils.qs('#evPast'), cal = SGC.utils.qs('#evCalendar');
      const upList = upcoming(), pastList = past();
      renderList(up, upList, { full: true });
      renderList(pv, pastList);
      renderCalendar(cal);
      const c = SGC.utils.qs('#eventCount');
      if (c) c.textContent = upList.length + ' upcoming · ' + pastList.length + ' past';

      /* tabs */
      const tabs = SGC.utils.qs('#evTabs');
      if (tabs) tabs.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]'); if (!b) return;
        tabs.querySelectorAll('.tab').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', String(x === b)); });
        SGC.utils.qsa('.tab-panel', SGC.utils.qs('#evTabs').parentElement).forEach((p) =>
          p.classList.toggle('is-active', p.dataset.panel === b.dataset.tab));
      });
      document.addEventListener('sgc:lang', () => { renderList(up, upcoming(), { full: true }); renderCalendar(cal); });
    },
  };
})(window);
