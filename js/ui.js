// Разметка fixgaz. Каждая функция получает модель и возвращает строку HTML.
// Все пользовательские строки проходят через esc(). Состояние показываем картинкой,
// слова остаются только там, где без них непонятно.

import { MAX_CLUB, MAX_LEVEL, PLAN_KINDS, SPORT, addDays, cleanDays, dow, monthWeeks, planBlock, preview, qty, weekDays } from './rules.js';
import * as C from './copy.js';
import { genie, hero, icon, navIcon, prop, sticker, torch } from './sprites.js';

const { esc } = C;

const stroke = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
const svg = (cls, d) => `<svg class="${cls}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${d}" ${stroke}/></svg>`;
const chevron = (dir) => svg('chev', dir === 'left' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5');
const plus = svg('plus', 'M8 3v10M3 8h10');
const minus = svg('minus', 'M3 8h10');

const REASON = { over: 'сверх лимита', unplanned: 'вне плана', gymday: 'день спорта' };

// --- шапка -------------------------------------------------------------------

function syncMark(m) {
  const label = m.status === 'offline' && m.pending ? `нет сети, в очереди ${m.pending}` : C.SYNC[m.status] || '';
  return `<p class="sync" data-status="${m.status}"><span class="sync-dot" aria-hidden="true"></span>${label}</p>`;
}

function header(m) {
  if (m.screen !== 'home') {
    return `<header class="top">
      <button class="back" type="button" data-act="back" data-key="back">${chevron('left')}назад</button>
      ${syncMark(m)}
    </header>`;
  }
  const tab = (act, view, name, label) =>
    `<button class="tab" type="button" data-act="${act}" ${view ? `data-view="${view}"` : ''} data-key="tab-${name}">${navIcon(name)}<span>${label}</span></button>`;
  return `<header class="top">
    ${syncMark(m)}
    <nav class="tabs" aria-label="разделы">
      ${tab('go', 'stats', 'stats', 'итоги')}
      ${tab('go', 'rules', 'rules', 'правила')}
      ${tab('menu', '', 'menu', 'меню')}
    </nav>
  </header>`;
}

function actions(m, cls) {
  return `<div class="actions ${cls}">
    <button class="btn btn-main" type="button" data-act="log-open" data-key="log-open-${cls}">отметить</button>
  </div>`;
}

function banner(m) {
  if (m.kind === 'demo') {
    return `<p class="banner">Пример с выдуманным журналом, записи не сохраняются. <a href="./">открыть свой дневник</a></p>`;
  }
  if (m.kind === 'local') {
    return `<p class="banner">Синхронизация не подключена: дневник живет только в этом браузере.</p>`;
  }
  if (!m.joined) {
    return `<p class="banner">Отправь ссылку на дневник: ${esc(m.players[m.other].name)} откроет ее и выберет себя.
      <button class="btn btn-sm" type="button" data-act="copy-link" data-key="copy-link">скопировать ссылку</button></p>`;
  }
  return '';
}

// --- сцена: у каждого свой джинн ----------------------------------------------

/** Строка запаса под комнатой: значок, подпись словами и значение справа. */
function stat(kind, label, value, cls = '') {
  return `<div class="stat${cls ? ` ${cls}` : ''}"><dt>${icon(kind)}<span>${label}</span></dt><dd>${value}</dd></div>`;
}

function room(m, who) {
  const wk = m.cur;
  const name = esc(m.players[who].name);
  const h = wk.hearts[who];
  const t = wk.tokens[who];
  const mood = m.moods[who];
  const total = wk.hpMax + wk.heal[who];
  const hp = wk.hp[who];
  const state = hp === 0 ? 'down' : hp <= total / 3 ? 'hurt' : wk.heal[who] ? 'laugh' : 'up';
  const segs = Array.from({ length: total }, (_, i) => `<i class="${i < hp ? 'on' : ''}"></i>`).join('');
  const debt = m.debts[who];
  const due = debt.n ? (debt.due < m.today ? 'срок вышел' : C.byEndOf(debt.due)) : '';
  const debtChip = debt.n
    ? `<button class="debt" type="button" data-act="log-open" data-who="${who}" data-key="debt-${who}"
        aria-label="${name}: ${C.nPenalty(debt.n)} не отработано, ${due}. отметить">
        <span class="chip is-foul">${icon('penalty')}</span><span class="hand">${debt.n > 1 ? `×${debt.n} ` : ''}${due}</span></button>`
    : '';
  const bossLabel = hp === 0 ? 'джинн побежден' : `джинн: здоровье ${hp} из ${total}`;
  // полезное за неделю: сколько раз был спорт, бассейн и коворкинг
  const good = ['gym', 'pool', 'cowork']
    .map((kind) => `<span class="good" title="${C.KIND[kind].name}">${icon(kind)}<b>${wk.counts[kind][who]}</b><span class="sr">${C.KIND[kind].name}</span></span>`)
    .join('');
  const used = (x, note = '') => `<b class="${x.used > x.max ? 'is-over' : ''}">${x.used} из ${x.max}</b>${note}`;
  const period = wk.periodWeeks[who] > 1 ? '<span class="stat-note">на две недели</span>' : '';
  return `<section class="scene${who === m.me ? ' is-me' : ''}" aria-label="${name}">
    <div class="room">
      ${hero(who, mood, { size: 112, cls: `room-hero${mood === 'sleep' ? '' : ' bob'}`, label: `${name}: ${C.MOOD[mood]}` })}
      ${genie(state, { size: 96, cls: `room-genie${state === 'down' ? '' : ' bob bob-slow'}`, label: bossLabel })}
    </div>
    <div class="stock">
      <p class="who">${name}</p>
      <dl class="stats">
        <div class="stat"><dt><span>полезное за неделю</span></dt><dd class="goods">${good}</dd></div>
        ${stat('hookah', 'кальян', used(h, period))}
        ${stat('club', 'клуб', used(t))}
        <div class="stat"><dt>${genie(state === 'down' ? 'down' : 'up', { size: 32 })}<span>джинн</span></dt>
          <dd><span class="hp" role="img" aria-label="${bossLabel}">${segs}</span></dd></div>
      </dl>
      ${debtChip}
    </div>
  </section>`;
}

/** По умолчанию на главной только свой персонаж; друга показывает и прячет эта кнопка. */
function otherToggle(m) {
  const name = esc(m.players[m.other].name);
  return `<button class="other-toggle" type="button" data-act="toggle-other" data-key="toggle-other" aria-pressed="${m.showOther}">
    ${hero(m.other, 'idle', { size: 44 })}<span>${name}: ${m.showOther ? 'скрыть' : 'показать'}</span>
  </button>`;
}

function scene(m) {
  return `${m.shown.map((who) => room(m, who)).join('')}${otherToggle(m)}`;
}

// --- отметки дня: общие для дневника и календаря ---------------------------------

function chip(kind, cls, label, n = 1) {
  const count = n > 1 ? `<b class="chip-n">×${n}</b>` : '';
  return `<span class="chip ${cls}"${label ? ` title="${label}"` : ''}>${icon(kind)}${count}</span>`;
}

function cellParts(m, day, who) {
  const facts = m.events.filter((e) => e.day === day && e.who === who);
  const plans = m.plans.filter((p) => p.day === day && p.who === who);
  const names = [];
  let html = '';
  // один значок на вид отметки: два кальяна за вечер это «кальян ×2»
  const groups = new Map();
  for (const e of facts) {
    const g = groups.get(e.kind) || { n: 0, foul: false };
    g.n += qty(e);
    g.foul = g.foul || m.foulIds.has(e.id);
    groups.set(e.kind, g);
  }
  for (const [kind, g] of groups) {
    const what = `${C.KIND[kind].name}${g.n > 1 ? ` ×${g.n}` : ''}`;
    names.push(g.foul ? `${what}, нарушение` : what);
    html += chip(kind, g.foul ? 'is-foul' : 'is-fact', what, g.n);
  }
  for (const p of plans) {
    if (facts.some((e) => e.kind === p.kind)) continue;
    const missed = day < m.today;
    names.push(`план: ${C.KIND[p.kind].name}${missed ? ', не отмечено' : ''}`);
    html += chip(p.kind, missed ? 'is-missed' : 'is-plan', `${C.KIND[p.kind].name}, план`);
  }
  return { html, names, plans };
}

// --- дневник недели ----------------------------------------------------------

function diaryCell(m, day, who) {
  const { html, names } = cellParts(m, day, who);
  const isToday = day === m.today;
  const canLog = day <= m.today;
  const canPlan = day > m.today || (isToday && m.today === m.s.createdDay);
  const name = esc(m.players[who].name);
  const what = names.length ? names.join(', ') : 'пусто';
  const add = canPlan
    ? `<button class="plan-add" type="button" data-act="plan-open" data-day="${day}" data-who="${who}" data-key="plan-add-${day}-${who}"
        aria-label="${name}, ${C.dayShort(day)}: ${what}. добавить в план">${plus}</button>`
    : '';
  if (!canLog) return `<td><div class="cell cell-plan">${html}${add}</div></td>`;
  const hint = !html && isToday && who === m.me ? `<span class="cell-hint">${plus}</span>` : '';
  return `<td><button class="cell" type="button" data-act="log-open" data-day="${day}" data-who="${who}" data-key="cell-${day}-${who}"
    aria-label="${name}, ${C.dayShort(day)}: ${what}. отметить">${html}${hint}</button>${add ? `<div class="cell cell-plan">${add}</div>` : ''}</td>`;
}

function diaryRows(m, wk) {
  return weekDays(wk.start)
    .map(
      (day) => `<tr class="${day === m.today ? 'is-today' : ''}">
      <th scope="row"><span class="dow">${C.DOW_SHORT[dow(day)]}</span><span class="dnum">${C.dayNum(day)}</span></th>
      ${m.shown.map((who) => diaryCell(m, day, who)).join('')}
    </tr>`,
    )
    .join('');
}

function gradeMark(m, wk, who, cls = '') {
  const g = wk.grade[who];
  const name = esc(m.players[who].name);
  return `<span class="grade hand${wk.closed ? '' : ' is-open'}${cls}" role="img" aria-label="${name}: оценка${wk.closed ? '' : ' пока'} ${g}, ${C.gradeWhy(wk, who)}">${g}</span>`;
}

/** Оценки за неделю стоят под своими столбцами, как в школьном дневнике. */
function gradesRow(m, wk) {
  if (wk.pre || wk.future) return '';
  return `<tfoot><tr class="grades"><th scope="row">оценка</th>${m.shown.map((who) => `<td>${gradeMark(m, wk, who)}</td>`).join('')}</tr></tfoot>`;
}

function legend(full) {
  const kinds = full
    ? ['gym', 'pool', 'cowork', 'hookah', 'club', 'penalty'].map((k) => `<span>${icon(k)} ${k === 'penalty' ? 'штраф' : C.KIND[k].name}</span>`).join('')
    : '';
  return `<p class="legend">
      ${kinds}
      <span>${chip('gym', 'is-fact', '')} было</span>
      <span>${chip('gym', 'is-plan', '')} в плане</span>
      <span>${chip('hookah', 'is-foul', '')} нарушение</span>
    </p>`;
}

function weekBlock(m, wk, lead) {
  const title = wk.pre ? 'до первой недели' : `неделя ${wk.index}`;
  const nav = lead
    ? `<div class="week-nav">
        <button class="icon-btn" type="button" data-act="week-prev" data-key="week-prev" aria-label="предыдущая неделя" ${m.canPrev ? '' : 'disabled'}>${chevron('left')}</button>
        <button class="icon-btn" type="button" data-act="week-next" data-key="week-next" aria-label="следующая неделя" ${m.canNext ? '' : 'disabled'}>${chevron('right')}</button>
      </div>`
    : '';
  return `<div class="week-block">
    <div class="week-head">
      <div>
        <h2 ${lead ? 'id="week-title"' : ''}>${title}</h2>
        <p class="week-range">${C.weekRange(wk.start)}</p>
      </div>
      ${nav}
    </div>
    <table class="diary">
      <thead><tr><th scope="col"><span class="sr">день</span></th>
        ${m.shown.map((who) => `<th scope="col">${esc(m.players[who].name)}</th>`).join('')}</tr></thead>
      <tbody>${diaryRows(m, wk)}</tbody>
      ${gradesRow(m, wk)}
    </table>
  </div>`;
}

/** Сетка месяца, как календарь в заметках: семь столбцов по дням недели, справа оценка недели. */
function calendarGrid(m, who) {
  const name = esc(m.players[who].name);
  const head = `${C.DOW_SHORT.map((d) => `<th scope="col">${d}</th>`).join('')}<th scope="col" class="cal-grade"><span class="sr">оценка недели</span></th>`;
  const rows = monthWeeks(m.month)
    .map((w) => {
      const wk = m.weeks.find((x) => x.start === w);
      const days = weekDays(w)
        .map((day) => {
          const { html, names } = cellParts(m, day, who);
          const cls = `${day.slice(0, 7) === m.month ? '' : ' is-out'}${day === m.today ? ' is-today' : ''}`;
          const what = names.length ? names.join(', ') : 'пусто';
          const future = day > m.today;
          // прошедший день открывает «отметить», будущий открывает план
          return `<td class="cal-day${cls}"><button class="cal-cell" type="button" data-act="${future ? 'plan-open' : 'log-open'}" data-day="${day}" data-who="${who}"
            data-key="cal-${who}-${day}" aria-label="${name}, ${C.dayShort(day)}: ${what}. ${future ? 'добавить в план' : 'отметить'}"><span class="cal-num">${C.dayNum(day)}</span>${html}</button></td>`;
        })
        .join('');
      const grade = wk && !wk.future ? gradeMark(m, wk, who, ' grade-sm') : '';
      return `<tr>${days}<td class="cal-grade">${grade}</td></tr>`;
    })
    .join('');
  return `<table class="cal">
      <thead><tr>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function monthNav(m) {
  return `<div class="week-nav">
      <button class="icon-btn" type="button" data-act="month" data-d="-1" data-key="month-prev" aria-label="предыдущий месяц" ${m.canPrevMonth ? '' : 'disabled'}>${chevron('left')}</button>
      <button class="icon-btn" type="button" data-act="month" data-d="1" data-key="month-next" aria-label="следующий месяц" ${m.canNextMonth ? '' : 'disabled'}>${chevron('right')}</button>
    </div>`;
}

function monthBlock(m) {
  const grids = m.shown
    .map((who) => `${m.shown.length > 1 ? `<h3 class="cal-who">${esc(m.players[who].name)}</h3>` : ''}${calendarGrid(m, who)}`)
    .join('');
  return `<div class="week-block">
    <div class="week-head">
      <h2 id="week-title">${C.monthTitle(m.month)}</h2>
      ${monthNav(m)}
    </div>
    ${grids}
  </div>`;
}

/** Дневник на главной: неделя с соседней или весь месяц сеткой. */
function diary(m) {
  const modeBtn = (mode, label) =>
    `<button class="seg-btn" type="button" aria-pressed="${m.mode === mode}" data-act="diary-mode" data-mode="${mode}" data-key="mode-${mode}">${label}</button>`;
  const body = m.mode === 'month' ? monthBlock(m) : `${weekBlock(m, m.view, true)}${weekBlock(m, m.viewNext, false)}`;
  return `<section class="week" aria-label="дневник">
    <div class="seg diary-modes" role="group" aria-label="вид дневника">${modeBtn('week', 'неделя')}${modeBtn('month', 'месяц')}</div>
    ${body}
    ${legend(false)}
    <span class="leaves" aria-hidden="true">${prop('leaf-orange', 40)}${prop('leaf-yellow', 32)}</span>
  </section>`;
}

function home(m) {
  return `<main id="main">
    <h1 class="sr">дневник режима</h1>
    ${banner(m)}
    ${scene(m)}
    ${actions(m, 'actions-inline')}
    ${diary(m)}
  </main>
  <nav class="bar" aria-label="действия">${actions(m, 'actions-bar')}</nav>`;
}

// --- итоги: календарь месяца ---------------------------------------------------

function person(m, who) {
  const name = esc(m.players[who].name);
  const slots = m.stickers
    .filter((st) => st.who === who)
    .map((st) => {
      const meta = C.STICKER[st.id];
      return `<li class="slot${st.got ? ' is-got' : ''}" title="${st.got ? meta.name : meta.how}">
        <span class="plate">${sticker(st.id)}</span>
        <span class="slot-name">${meta.name}</span>
      </li>`;
    })
    .join('');
  return `<section class="person" aria-label="${name}">
    <div class="person-head">
      ${hero(who, 'idle', { size: 56 })}
      <div>
        <h2>${name}</h2>
        <p class="person-sub">без кальяна ${C.nDays(cleanDays(m.state, who, m.today))}</p>
      </div>
    </div>
    ${calendarGrid(m, who)}
    <ul class="slots">${slots}</ul>
  </section>`;
}

function legendPanel() {
  return `<section class="legend-panel" aria-label="что значат значки">${legend(true)}</section>`;
}

/** Сравнение за месяц: кто сколько, лучший результат подчеркнут. */
function versus(m) {
  const inMonth = m.events.filter((e) => e.day.slice(0, 7) === m.month);
  const count = (...kinds) => [0, 1].map((who) => inMonth.filter((e) => kinds.includes(e.kind) && e.who === who).reduce((n, e) => n + qty(e), 0));
  const fouls = [0, 1].map((who) => m.weeks.flatMap((w) => w.fouls).filter((f) => f.who === who && f.day.slice(0, 7) === m.month).length);
  const row = (pic, label, values, lowerWins) => {
    const best = values[0] === values[1] ? -1 : (values[0] < values[1]) === lowerWins ? 0 : 1;
    const cells = values.map((v, who) => `<td class="${who === best ? 'is-better' : ''}">${v}</td>`).join('');
    return `<tr><th scope="row">${pic}<span>${label}</span></th>${cells}</tr>`;
  };
  const head = [0, 1].map((who) => `<th scope="col">${hero(who, 'idle', { size: 48 })}<span>${esc(m.players[who].name)}</span></th>`).join('');
  return `<table class="versus">
    <thead><tr><th scope="col"><span class="sr">что сравниваем</span></th>${head}</tr></thead>
    <tbody>
      ${row(icon('hookah'), 'кальян', count('hookah'), true)}
      ${row(icon('club'), 'клуб', count('club'), true)}
      ${row(chip('hookah', 'is-foul', ''), 'нарушения', fouls, true)}
      ${row(icon('gym'), 'спорт и бассейн', count(...SPORT), false)}
      ${row(icon('cowork'), 'коворкинг', count('cowork'), false)}
    </tbody>
  </table>`;
}

function stats(m) {
  return `<main id="main" class="page">
    <h1 class="sr">итоги</h1>
    <section class="month-panel" aria-labelledby="month-title">
    <div class="week-head month-head">
      <h2 class="page-title" id="month-title">${prop('candle', 40)}${C.monthTitle(m.month)}</h2>
      ${monthNav(m)}
    </div>
    ${versus(m)}
    </section>
    ${person(m, 0)}
    ${person(m, 1)}
    ${legendPanel()}
  </main>`;
}

// --- правила -------------------------------------------------------------------

function rules(m) {
  const item = (pic, title, body) => `<li class="rule"><span class="rule-pic">${pic}</span><div><h2>${title}</h2><p>${body}</p></div></li>`;
  const grade = (n, text) => `<li><span class="grade grade-sm hand">${n}</span><span>${text}</span></li>`;
  const s = m.s;
  return `<main id="main" class="page">
    <section class="rules-panel">
    <div class="rules-head"><h1 class="page-title">правила</h1>${prop('lantern', 76)}</div>
    <ol class="rule-list">
      ${item(icon('hookah', { scale: 3 }), 'лимит', 'У каждого на неделю свой лимит кальянов и клубов, он написан под комнатой: «кальян 1 из 3». После двух пятерок подряд лимит кальяна падает на один, пока не дойдет до одного кальяна на две недели. Лимиты можно поправить в меню.')}
      ${item(chip('hookah', 'is-plan', ''), 'кальян по плану', 'День кальяна ставится в дневнике не позже чем накануне. Без плана это нарушение, даже если лимит не выбран.')}
      ${item(`${chip('gym', 'is-fact', '')}${chip('hookah', 'is-missed', '')}`, 'день спорта чистый', 'Спорт или бассейн стоят в плане или уже были: кальяна в этот день нет. Сорвался: отмечаем как нарушение.')}
      ${item(navIcon('rules'), 'отмечаем все', 'Срыв тоже. Задним числом можно, скрыть нельзя.')}
    </ol>
    <ul class="rule-list">
      ${item(chip('hookah', 'is-foul', ''), 'нарушение', `Сверх лимита, вне плана или в день спорта. За каждое спорт-штраф: ${C.PENALTY}, срок ${C.nDays(s.penaltyDays)}. Второе за неделю стоит два штрафа, третье три.`)}
      ${item(genie('up', { size: 48 }), 'джинн', `У каждого свой, здоровье ${s.hpMax}. Спорт и бассейн снимают по ${s.hitGym}, коворкинг без кальяна ${s.hitCowork}, каждое раз в день. Нарушение возвращает ${s.foulHeal}. Штрафное занятие не считается.`)}
    </ul>
    <section class="grade-key" aria-labelledby="grade-key-title">
      <h2 id="grade-key-title">оценка недели</h2>
      <ul>
        ${grade(5, 'джинн побежден, нарушений нет')}
        ${grade(4, 'джинн побежден, штраф отработан')}
        ${grade(3, 'джинн не побежден')}
        ${grade(2, 'остался неотработанный штраф')}
      </ul>
    </section>
    </section>
  </main>`;
}

export function page(m) {
  const body = m.screen === 'stats' ? stats(m) : m.screen === 'rules' ? rules(m) : home(m);
  return `${header(m)}${body}`;
}

// --- листы --------------------------------------------------------------------

const sheetHead = (title) =>
  `<header class="sheet-head"><h2>${title}</h2><button class="link" type="button" data-act="close" data-key="close">закрыть</button></header>`;

function noteFor(m, kind, day, who, n = 1) {
  const res = preview(m.state, m.today, { who, kind, day, n });
  if (!res.week) return { text: 'до первой недели в счет не идет' };
  if (res.foul) {
    const why = res.foul.reasons.map((r) => REASON[r]).join(', ');
    return { text: `нарушение: ${why}. ${res.foul.cost > 1 ? `штрафов: ${res.foul.cost}` : 'штраф'}`, foul: true };
  }
  const same = m.events.filter((e) => e.day === day && e.who === who);
  switch (kind) {
    case 'gym':
    case 'pool':
      return { text: same.some((e) => e.kind === kind) ? 'второй раз за день джинна не бьет' : `джинну минус ${m.s.hitGym}` };
    case 'cowork':
      if (same.some((e) => e.kind === 'hookah')) return { text: 'с кальяном в этот день не считается' };
      return { text: same.some((e) => e.kind === 'cowork') ? 'второй за день джинна не бьет' : `джинну минус ${m.s.hitCowork}` };
    case 'hookah':
      return { text: `по плану, будет ${res.week.hearts[who].used} из ${res.week.hearts[who].max}` };
    case 'club':
      return { text: `будет ${res.week.tokens[who].used} из ${res.week.tokens[who].max}` };
    default:
      return { text: `${C.PENALTY}. останется: ${Math.max(0, m.debts[who].n - 1)}` };
  }
}

export function logSheet(m, sel) {
  const yesterday = addDays(m.today, -1);
  const days = [m.today, yesterday];
  if (!days.includes(sel.day)) days.push(sel.day);
  const dayLabel = (d) => (d === m.today ? 'сегодня' : d === yesterday ? 'вчера' : C.dayShort(d));
  const dayBtns = days
    .map(
      (d) =>
        `<button class="seg-btn" type="button" aria-pressed="${d === sel.day}" data-act="log-day" data-day="${d}" data-key="log-day-${d}">${dayLabel(d)}</button>`,
    )
    .join('');
  const whoOpts = [
    [m.me, 'мне'],
    [m.other, esc(m.players[m.other].name)],
    ['both', 'обоим'],
  ];
  const whoBtns = whoOpts
    .map(
      ([v, label]) =>
        `<button class="seg-btn" type="button" aria-pressed="${String(v) === String(sel.who)}" data-act="log-who" data-who="${v}" data-key="log-who-${v}">${label}</button>`,
    )
    .join('');
  const targets = sel.who === 'both' ? [0, 1] : [Number(sel.who)];
  const count = sel.qty || 1;
  const row = (kind, only) => {
    const list = only || targets;
    const notes = list.map((who) => ({ who, ...noteFor(m, kind, sel.day, who, kind === 'hookah' ? count : 1) }));
    const same = notes.every((n) => n.text === notes[0].text);
    const text = same ? notes[0].text : notes.map((n) => `${esc(m.players[n.who].name)}: ${n.text}`).join('; ');
    const foul = notes.some((n) => n.foul);
    return `<button class="opt${foul ? ' is-foul' : ''}" type="button" data-act="log" data-kind="${kind}" data-key="log-${kind}">
      <span class="opt-icon">${icon(kind, { scale: 3 })}</span>
      <span class="opt-name">${C.KIND[kind].name}${kind === 'hookah' && count > 1 ? ` ×${count}` : ''}</span>
      <span class="opt-note">${text}</span>
    </button>`;
  };
  const qtyBtns = [1, 2, 3]
    .map(
      (n) =>
        `<button class="seg-btn" type="button" aria-pressed="${n === count}" data-act="log-qty" data-n="${n}" data-key="log-qty-${n}" aria-label="кальянов за раз: ${n}">×${n}</button>`,
    )
    .join('');
  const owing = targets.filter((who) => m.debts[who].n > 0);
  const foulById = new Map(m.weeks.flatMap((w) => w.fouls).map((f) => [f.id, f]));
  const logged = m.events.filter((e) => e.day === sel.day && targets.includes(e.who));
  const loggedList = logged.length
    ? `<section class="logged"><h3>уже отмечено</h3><ul>${logged
        .map((e) => {
          const f = foulById.get(e.id);
          const why = f ? `<span class="hand">${f.reasons.map((r) => REASON[r]).join(', ')}</span>` : '';
          return `<li><span class="logged-what">${icon(e.kind)} ${C.KIND[e.kind].name}${qty(e) > 1 ? ` ×${qty(e)}` : ''}, ${esc(m.players[e.who].name)} ${why}</span>
              <button class="link" type="button" data-act="unlog" data-id="${e.id}" data-key="unlog-${e.id}">убрать</button></li>`;
        })
        .join('')}</ul></section>`
    : '';
  return `${sheetHead('отметить')}
    <div class="seg" role="group" aria-label="день">${dayBtns}</div>
    <div class="seg" role="group" aria-label="кому">${whoBtns}</div>
    <div class="opts">
      ${row('gym')}${row('pool')}${row('cowork')}
      <div class="opts-gap" aria-hidden="true"></div>
      <div class="opt-qty">${row('hookah')}<div class="seg" role="group" aria-label="сколько кальянов за раз">${qtyBtns}</div></div>
      ${row('club')}
      ${owing.length ? `<div class="opts-gap" aria-hidden="true"></div>${row('penalty', owing)}` : ''}
    </div>
    ${loggedList}`;
}

/** План на будущий день: что стоит, то нажато; повторное касание снимает. */
export function planSheet(m, sel) {
  const who = Number(sel.who);
  const mine = m.plans.filter((p) => p.day === sel.day && p.who === who);
  const why = {
    gymday: 'на день спорта кальян не ставится',
    hookahday: 'на этот день стоит кальян',
    limit: 'лимит кальяна уже расписан',
  };
  const rows = PLAN_KINDS.map((kind) => {
    const on = mine.some((p) => p.kind === kind);
    const block = on ? null : planBlock(m.state, m.weeks, { who, kind, day: sel.day });
    const note = on ? 'стоит в плане, нажми, чтобы убрать' : block ? why[block] : kind === 'hookah' ? 'день кальяна' : 'в план';
    return `<button class="opt" type="button" aria-pressed="${on}" data-act="plan" data-kind="${kind}" data-day="${sel.day}" data-who="${who}"
        data-key="plan-${kind}" ${block ? 'disabled' : ''}>
      <span class="opt-icon">${icon(kind, { scale: 3 })}</span>
      <span class="opt-name">${C.KIND[kind].name}</span>
      <span class="opt-note">${note}</span>
    </button>`;
  }).join('');
  return `${sheetHead('в план')}
    <p class="sheet-sub">${esc(m.players[who].name)}, ${C.dayShort(sel.day)}</p>
    <div class="opts">${rows}</div>
    <button class="btn btn-main sheet-done" type="button" data-act="close" data-key="plan-done">готово</button>`;
}

/** Строка настройки с числом: подпись слева, «меньше, значение, больше» справа. */
function numRow(label, name, value, { min, max, who = '', text = '', off = false }) {
  const key = `num-${name}${who === '' ? '' : `-${who}`}`;
  const attrs = `type="button" data-act="num" data-name="${name}" ${who === '' ? '' : `data-who="${who}"`}`;
  return `<div class="set-row">
    <span class="set-label">${label}</span>
    <div class="num" role="group" aria-label="${label}">
      <button class="icon-btn" ${attrs} data-d="-1" data-key="${key}-down" aria-label="${label}: меньше" ${off || value <= min ? 'disabled' : ''}>${minus}</button>
      <span class="num-value">${text || value}</span>
      <button class="icon-btn" ${attrs} data-d="1" data-key="${key}-up" aria-label="${label}: больше" ${off || value >= max ? 'disabled' : ''}>${plus}</button>
    </div>
  </div>`;
}

export function menuSheet(m) {
  const off = m.kind === 'demo';
  const readOnly = off ? 'disabled' : '';
  const s = m.s;
  const wk = m.limitWeek;
  const limits = [0, 1]
    .map((who) => {
      const level = wk.level[who];
      return `<div class="set-person">
        <p class="set-name">${esc(m.players[who].name)}</p>
        ${numRow('кальян', 'level', level, { min: 0, max: MAX_LEVEL, who, text: level >= 1 ? String(level) : '1 на 2 нед.', off })}
        ${numRow('клуб', 'club', wk.clubLimit[who], { min: 0, max: MAX_CLUB, who, off })}
      </div>`;
    })
    .join('');
  const local =
    m.kind === 'local'
      ? `<p class="hint">Синхронизация не подключена, поэтому ссылка откроет дневник только в этом же браузере.</p>`
      : '';
  return `${sheetHead('меню')}
    <section class="set">
      <h3>сейчас отмечает ${esc(m.players[m.me].name)}</h3>
      <button class="btn" type="button" data-act="switch" data-key="switch">сменить персонажа</button>
    </section>
    <section class="set">
      <h3>лимиты в неделю, начиная ${m.limitWeekIsFirst ? 'с первой' : 'с этой'}</h3>
      ${limits}
      <p class="hint">Лимит кальяна сам падает на один после двух пятерок подряд.</p>
    </section>
    <section class="set">
      <h3>джинн</h3>
      ${numRow('здоровье', 'hpMax', s.hpMax, { min: 1, max: 40, off })}
      ${numRow('спорт и бассейн снимают', 'hitGym', s.hitGym, { min: 0, max: 10, off })}
      ${numRow('коворкинг снимает', 'hitCowork', s.hitCowork, { min: 0, max: 10, off })}
      ${numRow('нарушение возвращает', 'foulHeal', s.foulHeal, { min: 0, max: 10, off })}
    </section>
    <section class="set">
      <h3>штраф</h3>
      <p class="hint">За нарушение ${C.PENALTY}.</p>
      ${numRow('срок, дней', 'penaltyDays', s.penaltyDays, { min: 1, max: 14, off })}
    </section>
    <section class="set">
      <h3>первая неделя</h3>
      <label class="field"><span>любой день этой недели</span><input type="date" value="${s.start}" data-set="start" data-key="start" ${readOnly}></label>
      <p class="hint">Счет идет с понедельника выбранной недели. Все, что раньше, не оценивается.</p>
    </section>
    <section class="set">
      <h3>имена</h3>
      <div class="fields">
        <label class="field"><span>первый</span><input type="text" maxlength="20" autocomplete="off" value="${esc(m.players[0].name)}" data-set="name" data-who="0" data-key="name-0" ${readOnly}></label>
        <label class="field"><span>второй</span><input type="text" maxlength="20" autocomplete="off" value="${esc(m.players[1].name)}" data-set="name" data-who="1" data-key="name-1" ${readOnly}></label>
      </div>
    </section>
    <section class="set">
      <h3>ссылка на дневник</h3>
      <p class="hint">Кто знает ссылку, тот может читать и писать.</p>
      ${local}
      <button class="btn" type="button" data-act="copy-link" data-key="copy-link-menu" ${readOnly}>скопировать ссылку</button>
    </section>
    <section class="set">
      <h3>журнал</h3>
      <div class="row">
        <button class="btn btn-sm" type="button" data-act="export" data-key="export">скачать журнал (JSON)</button>
        ${off ? '' : `<button class="link" type="button" data-act="leave" data-key="leave">забыть дневник на этом устройстве</button>`}
      </div>
    </section>`;
}

// --- первый запуск и выбор персонажа ---------------------------------------------

export function welcome({ startDay, local, missing }) {
  const card = (who, name) => `<div class="pick">
      ${hero(who, 'idle', { size: 96 })}
      <label class="field"><span>имя</span><input type="text" name="n${who}" maxlength="20" autocomplete="off" value="${name}" required></label>
    </div>`;
  return `<main class="welcome" id="main">
    <h1 class="line">дневник режима на двоих</h1>
    ${missing ? `<p class="banner">По этой ссылке дневника нет. Проверь ссылку у друга или создай новый дневник.</p>` : ''}
    <form id="create" class="create" novalidate>
      <div class="picks">${card(0, 'Елисей')}${card(1, 'Павел')}</div>
      <label class="field field-num"><span>сколько сейчас кальянов в неделю на каждого</span>
        <input type="number" name="baseline" min="1" max="21" value="5" inputmode="numeric" required></label>
      <p class="hint">Первая неделя начнется ${C.onDay(startDay)}, ${C.dayMonth(startDay)}. Стартовый лимит на один кальян меньше, чем сейчас. Все числа потом меняются в меню.</p>
      ${local ? `<p class="hint">Синхронизация еще не подключена: дневник будет жить только в этом браузере.</p>` : ''}
      <p class="form-error" role="alert" hidden></p>
      <button class="btn btn-main" type="submit">создать дневник</button>
    </form>
    <p class="hint">Есть ссылка от друга? Открой ее, и дневник подключится сам.</p>
  </main>`;
}

export function whoAreYou(players, { demo = false } = {}) {
  const btn = (who) => `<button class="pick pick-btn" type="button" data-act="i-am" data-who="${who}">
      ${hero(who, 'idle', { size: 136 })}
      <span class="pick-name">${esc(players[who].name)}</span>
    </button>`;
  return `<main class="welcome" id="main">
    <h1 class="line">кто заходит</h1>
    ${demo ? `<p class="lead">Это пример с выдуманным журналом.</p>` : ''}
    <div class="picks">${btn(0)}${btn(1)}</div>
    <div class="torches">${torch(96)}${prop('pumpkin', 52)}${torch(96, 'is-right')}</div>
  </main>`;
}

export function loading(status) {
  const text = status === 'offline' ? 'Нет сети. Дневник загрузится, когда появится связь.' : 'Загружаю дневник.';
  return `<main class="welcome" id="main"><p class="lead">${text}</p></main>`;
}
