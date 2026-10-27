// Разметка fixgaz. Каждая функция получает модель и возвращает строку HTML.
// Все пользовательские строки проходят через esc(). Состояние показываем картинкой,
// слова остаются только там, где без них непонятно.

import { GOAL_KEYS, GOAL_MAX, MAX_CLUB, MAX_LEVEL, PLAN_KINDS, SPORT, addDays, cleanDays, dow, monthWeeks, planBlock, preview, qty, weekDays } from './rules.js';
import * as C from './copy.js';
import { gem, genieFor, hero, icon, navIcon, prop, sticker, torch } from './sprites.js';

const { esc } = C;

const stroke = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
const svg = (cls, d) => `<svg class="${cls}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${d}" ${stroke}/></svg>`;
const chevron = (dir) => svg('chev', dir === 'left' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5');
const plus = svg('plus', 'M8 3v10M3 8h10');
const minus = svg('minus', 'M3 8h10');

const REASON = { over: 'сверх лимита', unplanned: 'вне плана', gymday: 'день спорта', bad: 'плохой режим', debt: 'штраф не отработан' };
// сколько кальянов за вечер можно выбрать одним касанием
const QTY = [1, 2, 3, 4, 5, 6];

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
  if (m.stray) {
    return `<p class="banner">На этом устройстве был другой дневник, код <b>${esc(m.stray)}</b>. Перенести его отметки в общий?
      <span class="banner-acts"><button class="btn btn-sm" type="button" data-act="stray-merge" data-key="stray-merge">перенести</button>
      <button class="link" type="button" data-act="stray-skip" data-key="stray-skip">не нужно</button></span></p>`;
  }
  if (m.kind === 'demo') {
    return `<p class="banner">Пример с выдуманным журналом, записи не сохраняются. <a href="./">открыть свой дневник</a></p>`;
  }
  if (m.kind === 'local') {
    return `<p class="banner">Синхронизация не подключена: дневник живет только в этом браузере.</p>`;
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
  // джинн это спутник: новая картинка на каждом втором уровне, на нечетном он чуть подрастает
  const lvl = m.levels[who];
  // картинок шесть, до десятого уровня; дальше джинн уже самый большой
  const grow = lvl < 0 ? '0.8' : lvl % 2 && lvl < 10 ? '1.07' : '1';
  const debt = m.debts[who];
  const due = debt.n ? (debt.due < m.today ? 'срок вышел' : C.byEndOf(debt.due)) : '';
  // висит штраф: красная полоса сверху запаса, касание открывает отметку
  const owe = debt.n
    ? `<button class="owe" type="button" data-act="log-open" data-who="${who}" data-key="debt-${who}"
        aria-label="${name}: в штрафе, ${C.nPenalty(debt.n)}, ${due}. отработать">
        <span class="owe-icon">${icon('penalty')}</span>
        <span class="owe-text"><b>в штрафе: ${C.nPenalty(debt.n)}</b><span>${due}</span></span>
        <span class="owe-go">отработать</span></button>`
    : '';
  // полезное за неделю: сколько раз был спорт, бассейн и коворкинг
  const good = ['gym', 'pool', 'cowork']
    .map((kind) => `<span class="good" title="${C.KIND[kind].name}">${icon(kind)}<b>${wk.counts[kind][who]}</b><span class="sr">${C.KIND[kind].name}</span></span>`)
    .join('');
  const used = (x, note = '') => `<b class="${x.used > x.max ? 'is-over' : ''}">${x.used} из ${x.max}</b>${note}`;
  const period = wk.periodWeeks[who] > 1 ? '<span class="stat-note">на две недели</span>' : '';
  // пока висит штраф, кальян нельзя: напоминание прямо у счетчика
  const owing = m.debts[who].n ? '<span class="stat-note is-foul">сначала штраф</span>' : '';
  return `<section class="scene${who === m.me ? ' is-me' : ''}${debt.n ? ' is-owing' : ''}" aria-label="${name}">
    <div class="room" style="--genie: ${grow}">
      ${hero(who, mood, { size: 112, cls: `room-hero${mood === 'sleep' ? '' : ' bob'}`, label: `${name}: ${C.MOOD[mood]}` })}
      ${genieFor(lvl, { size: 160, cls: 'room-genie bob bob-slow', label: `джинн, уровень ${lvl}` })}
    </div>
    <div class="stock">
      ${owe}
      <p class="who"><span class="who-name">${name}</span><span class="lvl" aria-label="уровень ${lvl}">lvl ${lvl}</span></p>
      <dl class="stats">
        <div class="stat"><dt><span>полезное за неделю</span></dt><dd class="goods">${good}</dd></div>
        ${stat('hookah', 'кальян', used(h, `${period}${owing}`))}
        ${stat('club', 'игры', used(t))}
        ${wk.gems[who] == null ? '' : `<div class="stat"><dt>${gem(true)}<span>неделя</span></dt><dd>${gemsMark(m, wk, who)}</dd></div>`}
      </dl>
    </div>
  </section>`;
}

/** По умолчанию на главной только свой персонаж; друга показывает и прячет эта кнопка. */
function otherToggle(m) {
  const name = esc(m.players[m.other].name);
  // друг ни разу не заходил в этот дневник и ничего в нем не отметил: скорее всего у вас два разных дневника
  const alone = m.kind !== 'demo' && !m.fixed && !m.joined[m.other] && !m.events.some((e) => e.who === m.other);
  const note = alone
    ? `<p class="alone">${name} в этом дневнике пока нет: ни входа, ни отметок. Если отметки у него есть, у вас разные дневники: сверьте код дневника в меню${m.roomCode ? `, у тебя <b>${esc(m.roomCode)}</b>` : ''}.</p>`
    : '';
  return `<button class="other-toggle" type="button" data-act="toggle-other" data-key="toggle-other" aria-pressed="${m.showOther}">
    ${hero(m.other, 'idle', { size: 44 })}<span>${name}: ${m.showOther ? 'скрыть' : 'показать'}</span>
  </button>${note}`;
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
  const canLog = day <= m.today;
  const canPlan = day > m.today || (day === m.today && m.today === m.s.createdDay);
  const name = esc(m.players[who].name);
  const what = names.length ? names.join(', ') : 'пусто';
  const add = canPlan
    ? `<button class="plan-add" type="button" data-act="plan-open" data-day="${day}" data-who="${who}" data-key="plan-add-${day}-${who}"
        aria-label="${name}, ${C.dayShort(day)}: ${what}. добавить в план">${plus}</button>`
    : '';
  if (!canLog) return `<td><div class="cell cell-plan">${html}${add}</div></td>`;
  return `<td><button class="cell" type="button" data-act="log-open" data-day="${day}" data-who="${who}" data-key="cell-${day}-${who}"
    aria-label="${name}, ${C.dayShort(day)}: ${what}. отметить">${html}</button>${add ? `<div class="cell cell-plan">${add}</div>` : ''}</td>`;
}

/** Бриллианты недели: три места, цветных столько, сколько получено. */
function gemsMark(m, wk, who, small = false) {
  const n = wk.gems[who];
  const name = esc(m.players[who].name);
  const pics = [0, 1, 2].map((i) => gem(i < n, { scale: small ? 1 : 2 })).join('');
  return `<span class="gems${small ? ' gems-sm' : ''}${wk.closed ? '' : ' is-open'}" role="img"
    aria-label="${name}: ${C.nGems(n)} из 3${wk.closed ? '' : ' пока'}, ${C.gemsWhy(wk, who, m.s)}">${pics}</span>`;
}

/** Неделя трекером: строка на день, в ней отметки. При показе друга столбцов два. */
function weekBlock(m) {
  const wk = m.view;
  const title = wk.pre ? 'до первой недели' : `неделя ${wk.index}`;
  const both = m.shown.length > 1;
  const head = both
    ? `<thead><tr><th scope="col"><span class="sr">день</span></th>${m.shown
        .map((who) => `<th scope="col">${esc(m.players[who].name)}</th>`)
        .join('')}</tr></thead>`
    : '';
  const rows = weekDays(wk.start)
    .map(
      (day) => `<tr class="${day === m.today ? 'is-today' : ''}">
      <th scope="row"><span class="dow">${C.DOW_SHORT[dow(day)]}</span><span class="dnum">${C.dayNum(day)}</span></th>
      ${m.shown.map((who) => diaryCell(m, day, who)).join('')}
    </tr>`,
    )
    .join('');
  const pending = wk.closed ? '' : '<span class="gems-note">пока</span>';
  const up = (who) =>
    wk.lvlUp[who] ? '<span class="lvl lvl-up">lvl up</span>' : wk.lvlDown[who] ? '<span class="lvl lvl-down">lvl down</span>' : '';
  const total =
    wk.pre || wk.future
      ? ''
      : `<tfoot><tr><th scope="row">итог</th>${m.shown.map((who) => `<td>${gemsMark(m, wk, who)}${pending}${up(who)}</td>`).join('')}</tr></tfoot>`;
  return `<div class="week-head">
      <h2 id="week-title">${title}</h2>
      <p class="week-range">${C.weekRange(wk.start)}</p>
    </div>
    <table class="diary">
      ${head}
      <tbody>${rows}</tbody>
      ${total}
    </table>`;
}

/** Сетка месяца, как календарь в заметках: семь столбцов по дням недели, справа бриллианты недели. */
function calendarGrid(m, who) {
  const name = esc(m.players[who].name);
  const head = `${C.DOW_SHORT.map((d) => `<th scope="col">${d}</th>`).join('')}<th scope="col" class="cal-gems"><span class="sr">бриллианты недели</span></th>`;
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
      const gems = wk && !wk.future ? gemsMark(m, wk, who, true) : '';
      return `<tr>${days}<td class="cal-gems">${gems}</td></tr>`;
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

function weekNav(m) {
  return `<div class="week-nav">
      <button class="icon-btn" type="button" data-act="week-prev" data-key="week-prev" aria-label="на неделю назад" ${m.canPrev ? '' : 'disabled'}>${chevron('left')}</button>
      <button class="icon-btn" type="button" data-act="week-next" data-key="week-next" aria-label="на неделю вперед" ${m.canNext ? '' : 'disabled'}>${chevron('right')}</button>
    </div>`;
}

function monthBlock(m) {
  const grids = m.shown
    .map((who) => `${m.shown.length > 1 ? `<h3 class="cal-who">${esc(m.players[who].name)}</h3>` : ''}${calendarGrid(m, who)}`)
    .join('');
  return `<h2 class="month-title" id="week-title">${C.monthTitle(m.month)}</h2>${grids}`;
}

/** Дневник на главной: неделя строками или весь месяц сеткой. Стрелки листают то, что выбрано. */
function diary(m) {
  const modeBtn = (mode, label) =>
    `<button class="seg-btn" type="button" aria-pressed="${m.mode === mode}" data-act="diary-mode" data-mode="${mode}" data-key="mode-${mode}">${label}</button>`;
  const month = m.mode === 'month';
  return `<section class="week" aria-label="дневник">
    <div class="diary-top">
      <div class="seg diary-modes" role="group" aria-label="вид дневника">${modeBtn('week', 'неделя')}${modeBtn('month', 'месяц')}</div>
      ${month ? monthNav(m) : weekNav(m)}
    </div>
    ${month ? monthBlock(m) : weekBlock(m)}
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
    ${m.build ? `<p class="build">${C.buildText(m.build)}</p>` : ''}
  </main>
  <nav class="bar" aria-label="действия">${actions(m, 'actions-bar')}</nav>`;
}

// --- итоги: календарь месяца ---------------------------------------------------

/** Сколько набрано в достижении. У цели числа нет, там текущий лимит кальяна. */
function goalHave(m, st) {
  if (st.need != null) return `${st.have} из ${st.need}`;
  return st.got ? 'достигнуто' : `пока ${m.cur.level[st.who]} в неделю`;
}

function person(m, who) {
  const name = esc(m.players[who].name);
  const slots = m.stickers
    .filter((st) => st.who === who)
    .map((st) => {
      const meta = C.STICKER[st.id];
      const have = goalHave(m, st);
      return `<li class="${st.got ? 'is-got' : ''}"><button class="slot" type="button" data-act="goal-open" data-id="${st.id}" data-key="goal-${who}-${st.id}"
        aria-label="${name}, ${meta.name}: ${have}${st.got ? ', получено' : ''}. открыть">
        <span class="plate">${sticker(st.id)}</span>
        <span class="slot-name">${meta.name}</span>
        <span class="slot-have">${have}</span>
      </button></li>`;
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
    <h3 class="slots-title">достижения</h3>
    <ul class="slots">${slots}</ul>
  </section>`;
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
  // бриллианты закрытых недель из сетки этого месяца
  const inGrid = monthWeeks(m.month);
  const gems = [0, 1].map((who) => m.weeks.filter((w) => w.closed && inGrid.includes(w.start)).reduce((n, w) => n + w.gems[who], 0));
  const head = [0, 1].map((who) => `<th scope="col">${hero(who, 'idle', { size: 48 })}<span>${esc(m.players[who].name)}</span></th>`).join('');
  return `<table class="versus">
    <thead><tr><th scope="col"><span class="sr">что сравниваем</span></th>${head}</tr></thead>
    <tbody>
      ${row(icon('hookah'), 'кальян', count('hookah'), true)}
      ${row(icon('club'), 'игры', count('club'), true)}
      ${row(chip('hookah', 'is-foul', ''), 'нарушения', fouls, true)}
      ${row(icon('gym'), 'спорт и бассейн', count(...SPORT), false)}
      ${row(icon('cowork'), 'коворкинг', count('cowork'), false)}
      ${row(gem(true), 'бриллианты', gems, false)}
      ${row('<span class="lvl">lvl</span>', 'уровень', m.levels, false)}
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
  </main>`;
}

// --- правила -------------------------------------------------------------------

function rules(m) {
  const item = (pic, title, body) => `<li class="rule"><span class="rule-pic">${pic}</span><div><h2>${title}</h2><p>${body}</p></div></li>`;
  const gemRow = (n, text) => `<li><span class="gems">${[0, 1, 2].map((i) => gem(i < n)).join('')}</span><span>${text}</span></li>`;
  const s = m.s;
  const dropRule = `После ${s.dropWeeks > 1 ? `${C.nWeeks(s.dropWeeks)} подряд` : 'недели'}, где бриллиантов ${s.dropGems}${s.dropGems < 3 ? ' или больше' : ''}, лимит кальяна падает на один, пока не дойдет до одного кальяна на две недели.`;
  const downRule = s.lvlDownWeeks > 1 ? `${C.nWeeks(s.lvlDownWeeks)} подряд снимают один уровень` : 'снимает один уровень';
  const lvlRule =
    s.lvlWeeks > 1
      ? `за каждые ${C.nWeeks(s.lvlWeeks)} подряд, в которых бриллиантов ${s.lvlGems}${s.lvlGems < 3 ? ' или больше' : ''}`
      : `за каждую неделю, в которой бриллиантов ${s.lvlGems}${s.lvlGems < 3 ? ' или больше' : ''}`;
  return `<main id="main" class="page">
    <section class="rules-panel">
    <div class="rules-head"><h1 class="page-title">правила</h1>${prop('lantern', 76)}</div>
    <ol class="rule-list">
      ${item(icon('hookah', { scale: 3 }), 'лимит', `У каждого на неделю свой лимит кальянов и игр, он написан под комнатой: «кальян 1 из 3». ${dropRule} Лимиты можно поправить в меню.`)}
      ${s.planRule ? item(chip('hookah', 'is-plan', ''), 'кальян по плану', 'День кальяна ставится в дневнике не позже чем накануне. Без плана это нарушение, даже если лимит не выбран.') : ''}
      ${item(`${chip('gym', 'is-fact', '')}${chip('hookah', 'is-missed', '')}`, 'день спорта чистый', 'Спорт или бассейн стоят в плане или уже были: кальяна в этот день нет. Сорвался: отмечаем как нарушение.')}
      ${item(navIcon('rules'), 'отмечаем все', 'Срыв тоже. Задним числом можно, скрыть нельзя.')}
    </ol>
    <ul class="rule-list">
      ${item(chip('hookah', 'is-foul', ''), 'нарушение', `Кальян сверх лимита${s.planRule ? ', вне плана' : ''} или в день спорта. За каждое ${C.nPenalty(s.foulCost)}, один штраф это ${C.PENALTY}, срок ${C.nDays(s.penaltyDays)}. Цена не растет. Штрафы не сгорают: неотработанные переходят на следующие недели.`)}
      ${item(chip('penalty', 'is-foul', ''), 'сначала штраф', `Пока висит неотработанный штраф, кальян нельзя. Сорвался: это нарушение, и стоит каждый такой кальян ${C.nPenalty(s.debtX)}.`)}
      ${item(chip('club', 'is-foul', ''), 'игры', `При отметке выбираем режим: нормально или плохо. Плохо или сверх лимита это нарушение полегче: ${C.PENALTY_PART[s.gamesPerPenalty]}${s.gamesPerPenalty > 1 ? `, то есть один штраф за каждые ${s.gamesPerPenalty} таких` : ''}.`)}
    </ul>
    <section class="gem-key" aria-labelledby="gem-key-title">
      <h2 id="gem-key-title">бриллианты недели</h2>
      <ul>
        ${gemRow(3, `кальян и игры в лимите, спорт ${s.needSport}+, коворкинг ${s.needCowork}+`)}
        ${gemRow(2, 'лимиты целы, но спорта или коворкинга мало. Или всего хватает, но превышен один лимит')}
        ${gemRow(1, 'превышены оба лимита, или один и спорта мало. Спорт при этом был')}
        ${gemRow(0, 'лимит превышен, спорта не было')}
      </ul>
      <p class="key-note">Бассейн считается как спорт, штрафное занятие не считается. Уровень персонажа начинается с lvl 0 и растет на один ${lvlRule}, до lvl ${s.lvlMax}. Плохая неделя (бриллиантов ${s.lvlDownGems} или меньше, или штраф не отработан к сроку) ${downRule}. Уровень может уйти в минус, до lvl -${s.lvlMax}. Вместе с уровнем растет джинн, а в минусе он чахнет.</p>
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

function noteFor(m, kind, day, who, n = 1, bad = false) {
  const res = preview(m.state, m.today, { who, kind, day, n, bad });
  if (!res.week) return { text: 'до первой недели в счет не идет' };
  if (res.foul) {
    const why = res.foul.reasons.map((r) => REASON[r]).join(', ');
    // игры это нарушение полегче: доля штрафа
    const price = res.foul.light ? C.PENALTY_PART[m.s.gamesPerPenalty] : res.foul.cost > 1 ? `штрафов: ${res.foul.cost}` : 'штраф';
    return { text: `нарушение: ${why}. ${price}`, foul: true };
  }
  // у полезного видно, сколько наберется к норме недели на три бриллианта
  switch (kind) {
    case 'gym':
    case 'pool':
      return { text: `спорт за неделю: ${res.week.counts.gym[who] + res.week.counts.pool[who]} из ${m.s.needSport}` };
    case 'cowork':
      return { text: `коворкинг за неделю: ${res.week.counts.cowork[who]} из ${m.s.needCowork}` };
    case 'hookah':
      return { text: `${m.s.planRule ? 'по плану, ' : ''}будет ${res.week.hearts[who].used} из ${res.week.hearts[who].max}` };
    case 'club':
      return { text: `будет ${res.week.tokens[who].used} из ${res.week.tokens[who].max}` };
    default:
      return { text: `${C.PENALTY}. останется: ${Math.max(0, m.debts[who].n - 1)}` };
  }
}

/** Выбор дня в листе: сетка месяца, доступны дни по сегодня. Точка под числом: в этот день уже есть отметки. */
function dayPicker(m, sel, targets) {
  const month = sel.day.slice(0, 7);
  const head = C.DOW_SHORT.map((d) => `<span class="daypick-dow" aria-hidden="true">${d}</span>`).join('');
  const cells = monthWeeks(month)
    .flatMap(weekDays)
    .map((d) => {
      const has = m.events.some((e) => e.day === d && targets.includes(e.who));
      const cls = `${d.slice(0, 7) === month ? '' : ' is-out'}${d === m.today ? ' is-today' : ''}${has ? ' has-marks' : ''}`;
      return `<button class="daypick-day${cls}" type="button" aria-pressed="${d === sel.day}" data-act="log-day" data-day="${d}" data-key="pick-day-${d}"
        aria-label="${C.dayShort(d)}${has ? ', есть отметки' : ''}" ${d > m.today ? 'disabled' : ''}>${C.dayNum(d)}</button>`;
    })
    .join('');
  return `<div class="daypick" role="group" aria-label="${C.monthTitle(month)}">
      <p class="daypick-title">${C.monthTitle(month)}</p>
      <div class="daypick-grid">${head}${cells}</div>
    </div>`;
}

export function logSheet(m, sel) {
  const yesterday = addDays(m.today, -1);
  // сегодня и вчера одним касанием, любой другой день выбирается в сетке месяца
  const other = sel.day !== m.today && sel.day !== yesterday;
  const dayBtns = `${[m.today, yesterday]
    .map(
      (d) =>
        `<button class="seg-btn" type="button" aria-pressed="${d === sel.day}" data-act="log-day" data-day="${d}" data-key="log-day-${d}">${d === m.today ? 'сегодня' : 'вчера'}</button>`,
    )
    .join('')}<button class="seg-btn" type="button" aria-pressed="${other}" aria-expanded="${Boolean(sel.pick)}" data-act="log-pick" data-key="log-pick">${other ? C.dayShort(sel.day) : 'другой день'}</button>`;
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
  // подсказка под вариантом: что будет после отметки, у каждого свое
  const noteText = (kind, list, bad = false) => {
    const notes = list.map((who) => ({ who, ...noteFor(m, kind, sel.day, who, 1, bad) }));
    const same = notes.every((n) => n.text === notes[0].text);
    return { text: same ? notes[0].text : notes.map((n) => `${esc(m.players[n.who].name)}: ${n.text}`).join('; '), foul: notes.some((n) => n.foul) };
  };
  // кальян и игры отмечаются в два шага: сначала вид, потом сколько или как прошло
  const step = (kind) => {
    if (sel.step !== kind) return '';
    if (kind === 'hookah') {
      const btns = QTY.map(
        (n) => `<button class="seg-btn" type="button" data-act="log" data-kind="hookah" data-n="${n}" data-key="log-hookah-${n}" aria-label="кальянов за вечер: ${n}">×${n}</button>`,
      ).join('');
      return `<div class="opt-step" role="group" aria-label="сколько кальянов за вечер"><p class="opt-step-q">сколько за вечер?</p><div class="seg seg-qty">${btns}</div></div>`;
    }
    const bad = noteText('club', targets, true);
    const btn = (v) => `<button class="seg-btn" type="button" data-act="log" data-kind="club" data-bad="${v ? 1 : 0}" data-key="log-club-${v ? 1 : 0}">${v ? 'плохо' : 'нормально'}</button>`;
    return `<div class="opt-step" role="group" aria-label="как прошли игры"><p class="opt-step-q">как прошло?</p><div class="seg">${btn(false)}${btn(true)}</div><p class="opt-step-note${bad.foul ? ' is-foul' : ''}">плохо: ${bad.text}</p></div>`;
  };
  const row = (kind, only) => {
    const { text, foul } = noteText(kind, only || targets);
    const two = kind === 'hookah' || kind === 'club';
    return `<button class="opt${foul ? ' is-foul' : ''}" type="button" data-act="log" data-kind="${kind}" data-key="log-${kind}"${two ? ` aria-expanded="${sel.step === kind}"` : ''}>
      <span class="opt-icon">${icon(kind, { scale: 3 })}</span>
      <span class="opt-name">${C.KIND[kind].name}</span>
      <span class="opt-note">${text}</span>
    </button>${two ? step(kind) : ''}`;
  };
  const owing = targets.filter((who) => m.debts[who].n > 0);
  const foulById = new Map(m.weeks.flatMap((w) => w.fouls).map((f) => [f.id, f]));
  const logged = m.events.filter((e) => e.day === sel.day && targets.includes(e.who));
  const loggedList = logged.length
    ? `<section class="logged"><h3>уже отмечено</h3><ul>${logged
        .map((e) => {
          const f = foulById.get(e.id);
          const why = f ? `<span class="hand">${f.reasons.map((r) => REASON[r]).join(', ')}</span>` : '';
          const n = qty(e);
          // у кальяна число правится прямо у записи: отметили один, а было три
          let fix = '';
          if (e.kind === 'hookah') {
            fix = `<div class="seg seg-qty" role="group" aria-label="сколько кальянов было">${QTY.map(
              (k) =>
                `<button class="seg-btn" type="button" aria-pressed="${k === n}" data-act="set-qty" data-id="${e.id}" data-n="${k}" data-key="set-qty-${e.id}-${k}" aria-label="кальянов было: ${k}">×${k}</button>`,
            ).join('')}</div>`;
          }
          // у игр так же правится режим
          if (e.kind === 'club') {
            fix = `<div class="seg" role="group" aria-label="режим игр">${[false, true]
              .map(
                (v) =>
                  `<button class="seg-btn" type="button" aria-pressed="${v === Boolean(e.bad)}" data-act="set-bad" data-id="${e.id}" data-bad="${v ? 1 : 0}" data-key="set-bad-${e.id}-${v ? 1 : 0}">${v ? 'плохо' : 'нормально'}</button>`,
              )
              .join('')}</div>`;
          }
          return `<li><div class="logged-row"><span class="logged-what">${icon(e.kind)} ${C.KIND[e.kind].name}${n > 1 ? ` ×${n}` : ''}, ${esc(m.players[e.who].name)} ${why}</span>
              <button class="link" type="button" data-act="unlog" data-id="${e.id}" data-key="unlog-${e.id}">убрать</button></div>${fix}</li>`;
        })
        .join('')}</ul></section>`
    : '';
  return `${sheetHead('отметить')}
    <div class="seg" role="group" aria-label="день">${dayBtns}</div>
    ${sel.pick ? dayPicker(m, sel, targets) : ''}
    <div class="seg" role="group" aria-label="кому">${whoBtns}</div>
    ${loggedList}
    <div class="opts">
      ${row('gym')}${row('pool')}${row('cowork')}
      <div class="opts-gap" aria-hidden="true"></div>
      ${row('hookah')}
      ${row('club')}
      ${owing.length ? `<div class="opts-gap" aria-hidden="true"></div>${row('penalty', owing)}` : ''}
    </div>`;
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
/** Да или нет для правила из настроек. */
function flagRow(label, name, value, off) {
  const btn = (v, text) =>
    `<button class="seg-btn" type="button" aria-pressed="${v === value}" data-act="flag" data-name="${name}" data-v="${v ? 1 : 0}" data-key="flag-${name}-${v ? 1 : 0}" ${off ? 'disabled' : ''}>${text}</button>`;
  return `<div class="set-row">
    <span class="set-label">${label}</span>
    <div class="seg seg-flag" role="group" aria-label="${label}">${btn(false, 'нет')}${btn(true, 'да')}</div>
  </div>`;
}

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
        ${numRow('игры', 'club', wk.clubLimit[who], { min: 0, max: MAX_CLUB, who, off })}
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
      <p class="hint">Лимит кальяна сам падает на один после недель подряд с бриллиантами:</p>
      ${numRow('недель подряд', 'dropWeeks', s.dropWeeks, { min: 1, max: 8, off })}
      ${numRow('бриллиантов в каждой, не меньше', 'dropGems', s.dropGems, { min: 1, max: 3, off })}
    </section>
    <section class="set">
      <h3>три бриллианта за неделю</h3>
      <p class="hint">Кальян и игры в лимите, а еще:</p>
      ${numRow('спорт и бассейн, не меньше', 'needSport', s.needSport, { min: 0, max: 14, off })}
      ${numRow('коворкинг, не меньше', 'needCowork', s.needCowork, { min: 0, max: 7, off })}
    </section>
    <section class="set">
      <h3>уровень персонажа</h3>
      <p class="hint">Растет на один за недели подряд, в которых хватает бриллиантов:</p>
      ${numRow('вверх: недель подряд', 'lvlWeeks', s.lvlWeeks, { min: 1, max: 8, off })}
      ${numRow('бриллиантов за неделю, не меньше', 'lvlGems', s.lvlGems, { min: 1, max: 3, off })}
      <p class="hint">Падает на один за плохие недели подряд: мало бриллиантов или штраф не отработан к сроку.</p>
      ${numRow('вниз: плохих недель подряд', 'lvlDownWeeks', s.lvlDownWeeks, { min: 1, max: 8, off })}
      ${numRow('плохая неделя: бриллиантов не больше', 'lvlDownGems', s.lvlDownGems, { min: 0, max: 2, off })}
      ${numRow('потолок уровня', 'lvlMax', s.lvlMax, { min: 1, max: 50, off })}
    </section>
    <section class="set">
      <h3>штраф</h3>
      <p class="hint">Один штраф это ${C.PENALTY}.</p>
      ${flagRow('кальян без плана это нарушение', 'planRule', s.planRule, off)}
      ${numRow('нарушение с кальяном, штрафов', 'foulCost', s.foulCost, { min: 1, max: 5, off })}
      ${numRow('срок, дней', 'penaltyDays', s.penaltyDays, { min: 1, max: 14, off })}
      ${numRow('кальян при неотработанном штрафе, штрафов', 'debtX', s.debtX, { min: 1, max: 5, off })}
      ${numRow('нарушений в играх на один штраф', 'gamesPerPenalty', s.gamesPerPenalty, { min: 1, max: 5, off })}
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
      ${m.fixed ? '<p class="hint">Дневник у вас один на двоих: любой телефон открывает его по адресу сайта.</p>' : ''}
      ${m.roomCode && !m.fixed ? `<p class="hint">Код дневника: <b>${esc(m.roomCode)}</b>. У второго в меню должен быть такой же, иначе у вас разные дневники.</p>` : ''}
      ${local}
      <button class="btn" type="button" data-act="copy-link" data-key="copy-link-menu" ${readOnly}>скопировать ссылку</button>
    </section>
    <section class="set">
      <h3>приложение</h3>
      <p class="hint">Новая версия подтягивается сама при открытии. Если что-то выглядит по-старому, обнови вручную. В приложении с домашнего экрана то же делает свайп вниз.</p>
      ${m.build ? `<p class="hint">Сейчас стоит ${C.buildText(m.build)}.</p>` : ''}
      <button class="btn" type="button" data-act="reload" data-key="reload">обновить приложение</button>
    </section>
    <section class="set">
      <h3>начать заново</h3>
      <p class="hint">${s.resetDay ? `Штрафы и уровни обнулены ${C.dayMonth(s.resetDay)}. Что было раньше, видно в дневнике, но не считается.` : 'Обнулить штрафы и уровни у обоих с сегодняшнего дня. Отметки и прошлые недели останутся в дневнике.'}</p>
      <button class="btn" type="button" data-act="reset" data-key="reset" ${readOnly}>обнулить штрафы и уровни</button>
    </section>
    <section class="set">
      <h3>журнал</h3>
      <div class="row">
        <button class="btn btn-sm" type="button" data-act="export" data-key="export">скачать журнал (JSON)</button>
        ${off || m.fixed ? '' : `<button class="link" type="button" data-act="leave" data-key="leave">забыть дневник на этом устройстве</button>`}
      </div>
    </section>`;
}

// --- первый запуск и выбор персонажа ---------------------------------------------

/** Лист достижения: что считается, сколько у каждого и сколько нужно. Число меняется здесь же. */
export function goalSheet(m, sel) {
  const id = C.STICKER[sel.id] ? sel.id : 'sport';
  const meta = C.STICKER[id];
  const key = GOAL_KEYS[id];
  const rows = [0, 1]
    .map((who) => {
      const st = m.stickers.find((x) => x.id === id && x.who === who);
      return `<li class="goal-who${st.got ? ' is-got' : ''}">${hero(who, 'idle', { size: 44 })}<span>${esc(m.players[who].name)}</span><b>${goalHave(m, st)}</b></li>`;
    })
    .join('');
  return `${sheetHead(meta.name)}
    <section class="set goal">
      <div class="goal-top"><span class="plate plate-show">${sticker(id)}</span><p>${meta.how}</p></div>
      <ul class="goal-list">${rows}</ul>
      ${key ? numRow('сколько нужно', key, m.s[key], { min: 1, max: id === 'level' ? m.s.lvlMax : GOAL_MAX, off: m.kind === 'demo' }) : ''}
    </section>`;
}

export function welcome({ startDay, local, missing, fixed = false }) {
  const card = (who, name) => `<div class="pick">
      ${hero(who, 'idle', { size: 96 })}
      <label class="field"><span>имя</span><input type="text" name="n${who}" maxlength="20" autocomplete="off" value="${name}" required></label>
    </div>`;
  return `<main class="welcome" id="main">
    <h1 class="line">дневник режима на двоих</h1>
    ${missing ? `<p class="banner">${fixed ? 'Общий дневник еще пустой. Создайте его один раз здесь, второй увидит его сам.' : 'По этой ссылке дневника нет. Проверь ссылку у друга или создай новый дневник.'}</p>` : ''}
    <form id="create" class="create" novalidate>
      <div class="picks">${card(0, 'Елисей')}${card(1, 'Павел')}</div>
      <label class="field field-num"><span>сколько сейчас кальянов в неделю на каждого</span>
        <input type="number" name="baseline" min="1" max="21" value="5" inputmode="numeric" required></label>
      <p class="hint">Первая неделя начнется ${C.onDay(startDay)}, ${C.dayMonth(startDay)}. Стартовый лимит на один кальян меньше, чем сейчас. Все числа потом меняются в меню.</p>
      ${local ? `<p class="hint">Синхронизация еще не подключена: дневник будет жить только в этом браузере.</p>` : ''}
      <p class="form-error" role="alert" hidden></p>
      <button class="btn btn-main" type="submit">создать дневник</button>
    </form>
    ${fixed ? '' : `<form id="join" class="create join" novalidate>
      <label class="field"><span>уже есть дневник? вставь ссылку на него</span>
        <input type="text" name="link" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url" placeholder="https://…#room=…" required></label>
      <p class="form-error" role="alert" hidden></p>
      <button class="btn" type="submit">открыть дневник</button>
    </form>`}
  </main>`;
}

export function whoAreYou(players, { demo = false, levels = [0, 0] } = {}) {
  const btn = (who) => `<button class="pick pick-btn" type="button" data-act="i-am" data-who="${who}">
      ${hero(who, 'idle', { size: 136 })}
      <span class="pick-name">${esc(players[who].name)}</span>
      <span class="lvl">lvl ${levels[who]}</span>
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
