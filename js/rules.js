// Правила fixgaz. Только чистые функции: без DOM, без текущего времени.
// Дни передаются строками 'YYYY-MM-DD', неделя начинается с понедельника.
// Все числа берутся из настроек дневника, здесь только значения по умолчанию.

/** Уровень лимита кальяна: 7..1 это кальянов в неделю, 0 это один кальян на две недели (цель). */
export const MAX_LEVEL = 7;
export const MAX_CLUB = 7;

export const DEFAULTS = {
  levelStart: 4,
  clubStart: 2,
  baseline: 5,
  penaltyDays: 2,
  // игры: нарушение полегче, один штраф набегает за столько нарушений
  gamesPerPenalty: 2,
  // норма недели для трех бриллиантов
  needSport: 2,
  needCowork: 1,
  // уровень персонажа растет за недели подряд с таким числом бриллиантов
  lvlWeeks: 2,
  lvlGems: 2,
  // цели достижений в итогах
  goalSport: 10,
  goalCowork: 5,
  goalClean: 7,
  goalGems: 1,
  goalLevel: 3,
};

/** Достижения с числом: в какой настройке лежит цель. */
export const GOAL_KEYS = { sport: 'goalSport', cowork: 'goalCowork', clean: 'goalClean', gems: 'goalGems', level: 'goalLevel' };
export const GOAL_MAX = 99;

// --- даты ---------------------------------------------------------------

const DAY_MS = 86400000;
const toUTC = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (day, n) => fromUTC(toUTC(day) + n * DAY_MS);
export const diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / DAY_MS);
/** 0 = понедельник, 6 = воскресенье */
export const dow = (day) => (new Date(toUTC(day)).getUTCDay() + 6) % 7;
export const weekOf = (day) => addDays(day, -dow(day));
export const weekDays = (weekStart) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Недели (понедельники), которые задевают месяц 'YYYY-MM'. */
export function monthWeeks(month) {
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const last = fromUTC(Date.UTC(y, m, 0));
  const out = [];
  for (let w = weekOf(first); w <= last; w = addDays(w, 7)) out.push(w);
  return out;
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  return fromUTC(Date.UTC(y, m - 1 + n, 1)).slice(0, 7);
}

// --- вспомогательное ----------------------------------------------------

const clampInt = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.trunc(n) || 0));
const byTime = (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : (a.at || 0) - (b.at || 0));
const live = (obj) => Object.values(obj || {}).filter((r) => r && !r.del);
/** Виды спорта: зал и бассейн. Считаются одинаково, но отмечаются разными значками. */
export const SPORT = ['gym', 'pool'];
/** Что можно поставить в план на будущий день. */
export const PLAN_KINDS = ['gym', 'pool', 'cowork', 'hookah'];
const KINDS = ['gym', 'pool', 'cowork', 'hookah', 'club', 'penalty'];

/** Сколько кальянов в одной записи: за вечер их бывает два и три. */
export const qty = (e) => (e.kind === 'hookah' ? clampInt(e.n || 1, 1, 9) : 1);
/** Значение на двоих: число для обоих или {p0, p1}. */
const perWho = (v) => (v && typeof v === 'object' ? [v.p0, v.p1] : [v, v]);

export function normalize(settings) {
  const s = { ...DEFAULTS, ...(settings || {}) };
  s.limitSet = s.limitSet || {};
  s.penaltyDays = clampInt(s.penaltyDays, 1, 14);
  s.gamesPerPenalty = clampInt(s.gamesPerPenalty, 1, 5);
  s.needSport = clampInt(s.needSport, 0, 14);
  s.needCowork = clampInt(s.needCowork, 0, 7);
  s.lvlWeeks = clampInt(s.lvlWeeks, 1, 8);
  s.lvlGems = clampInt(s.lvlGems, 1, 3);
  for (const key of Object.values(GOAL_KEYS)) s[key] = clampInt(s[key], 1, GOAL_MAX);
  return s;
}

/** Лимит кальяна по уровню: сколько раз и на сколько недель. */
export const rungOf = (level) => (level >= 1 ? { n: level, weeks: 1 } : { n: 1, weeks: 2 });

/** План кальяна действует, если поставлен до начала дня (или в день создания дневника). */
function hasHookahPlan(plans, s, who, day) {
  return plans.some(
    (p) =>
      p.kind === 'hookah' &&
      p.who === who &&
      p.day === day &&
      !p.del &&
      (p.madeOn < day || p.madeOn === s.createdDay),
  );
}

/** День спорта: спорт или бассейн уже отмечены или стоят в плане. Снятый в тот же день план все равно считается. */
function isSportDay(mine, plans, who, day) {
  if (mine.some((e) => SPORT.includes(e.kind) && e.day === day)) return true;
  return plans.some(
    (p) =>
      SPORT.includes(p.kind) &&
      p.who === who &&
      p.day === day &&
      (!p.del || (p.madeOn < day && p.delOn >= day)),
  );
}

// --- неделя ---------------------------------------------------------------
// Все личное: у каждого свой лимит, свои бриллианты. Поля недели, которые
// зависят от человека, это массивы из двух значений по индексу игрока.

/**
 * Бриллианты недели, от нуля до трех.
 * 3: кальян и клуб в лимите, спорта и коворкинга не меньше нормы.
 * 2: лимиты целы, но нормы нет; или норма есть, но превышен один лимит.
 * 1: превышены оба лимита либо превышен один и нормы нет, но спорт был.
 * 0: лимит превышен, спорта не было.
 */
export function gemsOf({ overHookah, overClub, sport, cowork }, s) {
  const over = (overHookah ? 1 : 0) + (overClub ? 1 : 0);
  const norm = sport >= s.needSport && cowork >= s.needCowork;
  if (!over) return norm ? 3 : 2;
  if (!sport) return 0;
  return over === 1 && norm ? 2 : 1;
}

function summarize(ctx) {
  const { s, events, plans, w, end, levels, clubs, periodStarts, closed, future, today, owed } = ctx;
  const inWeek = events.filter((e) => e.day >= w && e.day <= end);
  const unit = s.gamesPerPenalty;

  const counts = {};
  for (const kind of KINDS) counts[kind] = [0, 0];
  for (const e of inWeek) if (counts[e.kind]) counts[e.kind][e.who] += qty(e);

  const through = closed ? addDays(end, s.penaltyDays) : today;
  const wk = {
    start: w,
    end,
    index: diffDays(w, s.start) / 7 + 1,
    closed,
    future,
    counts,
    fouls: [],
    level: [],
    limit: [],
    periodWeeks: [],
    pStart: [],
    pEnd: [],
    clubLimit: [],
    hearts: [],
    tokens: [],
    debt: [],
    over: [],
    gems: [],
    lvlUp: [false, false],
  };

  for (const who of [0, 1]) {
    const rung = rungOf(levels[who]);
    const clubLimit = clubs[who];
    const k = Math.floor(diffDays(w, periodStarts[who]) / 7 / rung.weeks);
    const pStart = addDays(periodStarts[who], k * rung.weeks * 7);
    const pEnd = addDays(pStart, rung.weeks * 7 - 1);

    const mine = events.filter((e) => e.who === who);
    const hookahs = mine.filter((e) => e.kind === 'hookah' && e.day >= pStart && e.day <= pEnd).sort(byTime);
    const clubsDone = mine.filter((e) => e.kind === 'club' && e.day >= w && e.day <= end).sort(byTime);
    const list = [];
    let used = 0;
    hookahs.forEach((e) => {
      used += qty(e);
      if (e.day < w || e.day > end) return;
      const reasons = [];
      if (used > rung.n) reasons.push('over');
      if (!hasHookahPlan(plans, s, who, e.day)) reasons.push('unplanned');
      if (isSportDay(mine, plans, who, e.day)) reasons.push('gymday');
      if (reasons.length) list.push({ id: e.id, who, day: e.day, at: e.at, kind: 'hookah', reasons });
    });
    // игры: сверх лимита или в плохом режиме. Это легкое нарушение, доля штрафа
    clubsDone.forEach((e, i) => {
      const reasons = [];
      if (i >= clubLimit) reasons.push('over');
      if (e.bad) reasons.push('bad');
      if (reasons.length) list.push({ id: e.id, who, day: e.day, at: e.at, kind: 'club', reasons, light: true });
    });
    // Счет идет в долях: в одном штрафе unit долей. Нарушение в играх это одна доля.
    // Кальян: первое нарушение за неделю стоит один штраф, каждое следующее на один дороже.
    let hard = 0;
    list.sort(byTime).forEach((f) => {
      f.cost = f.light ? 0 : (hard += 1);
      f.units = f.light ? 1 : f.cost * unit;
      wk.fouls.push(f);
      owed[who] += f.units;
    });

    // долг: все начисленное к концу этой недели минус отработанное к сроку
    const paid = events.filter((e) => e.kind === 'penalty' && e.who === who && e.day <= through).length;
    const debt = Math.floor(Math.max(0, owed[who] - paid * unit) / unit);

    wk.level.push(levels[who]);
    wk.limit.push(rung.n);
    wk.periodWeeks.push(rung.weeks);
    wk.pStart.push(pStart);
    wk.pEnd.push(pEnd);
    wk.clubLimit.push(clubLimit);
    wk.hearts.push({ max: rung.n, used, left: Math.max(0, rung.n - used) });
    wk.tokens.push({ max: clubLimit, used: clubsDone.length, left: Math.max(0, clubLimit - clubsDone.length) });
    wk.debt.push(debt);
    const over = { hookah: used > rung.n, club: clubsDone.length > clubLimit };
    wk.over.push(over);
    const sport = counts.gym[who] + counts.pool[who];
    wk.gems.push(future ? null : gemsOf({ overHookah: over.hookah, overClub: over.club, sport, cowork: counts.cowork[who] }, s));
  }
  wk.fouls.sort(byTime);
  return wk;
}

/**
 * Все недели от первой до текущей (или до opts.through, если нужна будущая).
 * Лимит кальяна человека падает на один после двух его закрытых недель подряд на три бриллианта,
 * лимит клуба вместе с ним, но не ниже одного. Настройка limitSet задает лимиты с нужной недели.
 * Уровень персонажа растет на один за каждые lvlWeeks закрытых недель подряд, где бриллиантов не меньше lvlGems;
 * неделя, на которой он вырос, помечена lvlUp.
 */
export function timeline(state, today, opts = {}) {
  const s = normalize(state.settings);
  if (!s.start) return [];
  const cur = weekOf(today);
  const last = opts.through && opts.through > cur ? opts.through : cur;
  const events = live(state.events);
  const plans = Object.values(state.plan || {}).filter(Boolean);
  const levels = perWho(s.levelStart).map((v) => clampInt(v ?? DEFAULTS.levelStart, 0, MAX_LEVEL));
  const clubs = perWho(s.clubStart).map((v) => clampInt(v ?? DEFAULTS.clubStart, 0, MAX_CLUB));
  const fives = [0, 0];
  const runs = [0, 0];
  const periodStarts = [s.start, s.start];
  const owed = [0, 0];
  const out = [];
  const applySet = (week, at) => {
    const set = s.limitSet[week];
    if (!set) return;
    for (const who of [0, 1]) {
      const o = set[`p${who}`];
      if (!o) continue;
      if (o.level != null) {
        levels[who] = clampInt(Number(o.level), 0, MAX_LEVEL);
        fives[who] = 0;
        periodStarts[who] = at;
      }
      if (o.club != null) clubs[who] = clampInt(Number(o.club), 0, MAX_CLUB);
    }
  };
  // лимиты, заданные раньше первой недели, действуют с нее: первую неделю могли перенести
  for (const week of Object.keys(s.limitSet).sort()) if (week < s.start) applySet(week, s.start);
  for (let w = s.start; w <= last; w = addDays(w, 7)) {
    applySet(w, w);
    const end = addDays(w, 6);
    const closed = end < today;
    const wk = summarize({ s, events, plans, w, end, levels, clubs, periodStarts, closed, future: w > cur, today, owed });
    out.push(wk);
    if (!closed) continue;
    for (const who of [0, 1]) {
      runs[who] = wk.gems[who] >= s.lvlGems ? runs[who] + 1 : 0;
      if (runs[who] >= s.lvlWeeks) {
        wk.lvlUp[who] = true;
        runs[who] = 0;
      }
      fives[who] = wk.gems[who] === 3 ? fives[who] + 1 : 0;
      if (fives[who] >= 2 && levels[who] > 0) {
        levels[who] -= 1;
        if (clubs[who] > 1) clubs[who] -= 1;
        fives[who] = 0;
        periodStarts[who] = addDays(w, 7);
      }
    }
  }
  return out;
}

/** Уровень персонажа: сколько раз он вырос. Начинается с нуля. */
export function level(weeks, who) {
  return weeks.filter((wk) => wk.lvlUp[who]).length;
}

/** Неотработанные штрафы человека на сегодня и срок самого раннего. */
export function debtInfo(state, weeks, who, today) {
  const s = normalize(state.settings);
  const unit = s.gamesPerPenalty; // долей в одном штрафе
  let paid = live(state.events).filter((e) => e.kind === 'penalty' && e.who === who && e.day <= today).length * unit;
  let rest = 0;
  let since = null;
  for (const wk of weeks) {
    for (const f of wk.fouls) {
      if (f.who !== who || f.day > today) continue;
      const take = Math.min(paid, f.units);
      paid -= take;
      rest += f.units - take;
      // срок идет с того нарушения, на котором набежал целый штраф
      if (!since && rest >= unit) since = f.day;
    }
  }
  return { n: Math.floor(rest / unit), since, due: since ? addDays(since, s.penaltyDays) : null };
}

/** Сколько дней подряд без кальяна (сегодня считается, если кальяна сегодня не было). */
export function cleanDays(state, who, today) {
  const s = normalize(state.settings);
  const days = live(state.events)
    .filter((e) => e.kind === 'hookah' && e.who === who && e.day <= today)
    .map((e) => e.day)
    .sort();
  const from = s.createdDay && s.createdDay < s.start ? s.createdDay : s.start;
  if (!days.length) return from && from <= today ? diffDays(today, from) + 1 : 0;
  return diffDays(today, days[days.length - 1]);
}

function longestCleanRun(state, who, today) {
  const s = normalize(state.settings);
  if (!s.start || s.start > today) return 0;
  const days = [
    ...new Set(
      live(state.events)
        .filter((e) => e.kind === 'hookah' && e.who === who && e.day >= s.start && e.day <= today)
        .map((e) => e.day),
    ),
  ].sort();
  let best = 0;
  let prev = addDays(s.start, -1);
  for (const d of days) {
    best = Math.max(best, diffDays(d, prev) - 1);
    prev = d;
  }
  return Math.max(best, diffDays(today, prev));
}

/** Состояние персонажа: smoke, sleep, fit, idle. */
export function mood(state, weeks, who, today) {
  const events = live(state.events).filter((e) => e.who === who && e.day <= today);
  if (debtInfo(state, weeks, who, today).n > 0) return 'smoke';
  if (events.some((e) => e.kind === 'hookah' && e.day === today)) return 'smoke';
  const yesterday = addDays(today, -1);
  if (events.some((e) => SPORT.includes(e.kind) && (e.day === today || e.day === yesterday))) return 'fit';
  const s = normalize(state.settings);
  const lastDay = events.reduce((m, e) => (e.day > m ? e.day : m), '');
  const quietFrom = lastDay || s.start;
  if (quietFrom && quietFrom <= today && diffDays(today, quietFrom) >= 3) return 'sleep';
  return 'idle';
}

/** Что будет, если отметить событие: нарушение или нет, и остаток после него. */
export function preview(state, today, { who, kind, day, n = 1, bad = false }) {
  const id = '__preview';
  const ev = { id, who, kind, day, n, at: Number.MAX_SAFE_INTEGER, ...(bad ? { bad: true } : {}) };
  const tmp = { ...state, events: { ...(state.events || {}), [id]: ev } };
  const wk = timeline(tmp, today, { through: weekOf(day) }).find((w) => w.start === weekOf(day));
  if (!wk) return { foul: null, week: null };
  return { foul: wk.fouls.find((f) => f.id === id) || null, week: wk };
}

/**
 * Какой возглас показать после отметки. Считается по состоянию до записи события.
 * Возвращает код: danger, foul, treat, hookah-ok, club-over, club-bad, club-ok, paid, paid-part, norm, late, good.
 */
export function shoutFor(state, today, { who, kind, day, n = 1, bad = false }) {
  const s = normalize(state.settings);
  const mine = live(state.events).filter((e) => e.who === who);
  const hookahs = mine.filter((e) => e.kind === 'hookah');
  const after = preview(state, today, { who, kind, day, n, bad });

  if (kind === 'hookah') {
    const sameDay = hookahs.filter((e) => e.day === day).reduce((sum, e) => sum + qty(e), 0);
    if (sameDay + n > 2) return 'danger';
    if (after.foul) return 'foul';
    // перерыв считаем от прошлого кальяна, а если его не было, от начала дневника
    const before = hookahs.map((e) => e.day).filter((d) => d < day).sort().pop();
    const from = before || (s.createdDay && s.createdDay < s.start ? s.createdDay : s.start);
    if (sameDay === 0 && from && diffDays(day, from) > 5) return 'treat';
    return 'hookah-ok';
  }
  if (kind === 'club') return !after.foul ? 'club-ok' : after.foul.reasons.includes('over') ? 'club-over' : 'club-bad';
  if (kind === 'penalty') {
    const weeks = timeline(state, today);
    return debtInfo(state, weeks, who, today).n <= 1 ? 'paid' : 'paid-part';
  }
  if (kind === 'cowork' || SPORT.includes(kind)) {
    const week = weekOf(day);
    const before = timeline(state, today, { through: week }).find((w) => w.start === week);
    // этой отметкой набрана норма недели по спорту и коворкингу
    const norm = (wk) => wk.counts.gym[who] + wk.counts.pool[who] >= s.needSport && wk.counts.cowork[who] >= s.needCowork;
    if (before && after.week && !norm(before) && norm(after.week)) return 'norm';
    return hookahs.some((e) => e.day === day) ? 'late' : 'good';
  }
  return null;
}

/** Можно ли поставить план на день. Возвращает null или код причины отказа. */
export function planBlock(state, weeks, { who, kind, day }) {
  const plans = live(state.plan).filter((p) => p.who === who);
  if (kind === 'hookah') {
    if (plans.some((p) => SPORT.includes(p.kind) && p.day === day)) return 'gymday';
    const wk = weeks.find((w) => day >= w.start && day <= w.end);
    if (wk) {
      const planned = plans.filter((p) => p.kind === 'hookah' && p.day >= wk.pStart[who] && p.day <= wk.pEnd[who]).length;
      if (planned >= wk.limit[who]) return 'limit';
    }
  }
  if (SPORT.includes(kind) && plans.some((p) => p.kind === 'hookah' && p.day === day)) return 'hookahday';
  return null;
}

/** Наклейки. У каждого свой набор. */
/**
 * Достижения человека. У числовых есть have (сколько набрано) и need (цель из настроек).
 * У последнего числа нет: это конец лестницы, один кальян на две недели.
 */
export function stickers(state, weeks, today) {
  const s = normalize(state.settings);
  const events = live(state.events).filter((e) => e.day <= today);
  const past = weeks.filter((w) => !w.future);
  const start = perWho(s.levelStart).map((v) => clampInt(v ?? DEFAULTS.levelStart, 0, MAX_LEVEL));
  const out = [];
  for (const who of [0, 1]) {
    const count = (kinds) => events.filter((e) => e.who === who && kinds.includes(e.kind)).length;
    const low = past.reduce((m, w) => Math.min(m, w.level[who]), start[who]);
    const have = {
      sport: count(SPORT),
      cowork: count(['cowork']),
      clean: longestCleanRun(state, who, today),
      gems: past.filter((w) => w.closed && w.gems[who] === 3).length,
      level: level(weeks, who),
    };
    for (const [id, key] of Object.entries(GOAL_KEYS)) out.push({ id, who, have: have[id], need: s[key], got: have[id] >= s[key] });
    out.push({ id: 'goal', who, have: null, need: null, got: low <= 0 });
  }
  return out;
}

/** Счетчики недели до первой: без лимитов и оценок. */
export function preWeek(state, w) {
  const end = addDays(w, 6);
  const counts = {};
  for (const kind of KINDS) counts[kind] = [0, 0];
  for (const e of live(state.events)) if (e.day >= w && e.day <= end && counts[e.kind]) counts[e.kind][e.who] += qty(e);
  return { start: w, end, pre: true, counts, fouls: [], gems: [null, null], lvlUp: [false, false] };
}
