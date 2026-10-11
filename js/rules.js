// Правила fixgaz. Только чистые функции: без DOM, без текущего времени.
// Дни передаются строками 'YYYY-MM-DD', неделя начинается с понедельника.
// Все числа берутся из настроек дневника, здесь только значения по умолчанию.

/** Уровень лимита кальяна: 7..1 это кальянов в неделю, 0 это один кальян на две недели (цель). */
export const MAX_LEVEL = 7;
export const MAX_CLUB = 7;

export const DEFAULTS = {
  levelStart: 4,
  clubStart: 3,
  hpMax: 7,
  hitGym: 2,
  hitCowork: 1,
  foulHeal: 3,
  baseline: 5,
  penaltyDays: 2,
};

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
/** Сколько кальянов в одной записи: за вечер их бывает два и три. */
export const qty = (e) => (e.kind === 'hookah' ? clampInt(e.n || 1, 1, 9) : 1);
/** Значение на двоих: число для обоих или {p0, p1}. */
const perWho = (v) => (v && typeof v === 'object' ? [v.p0, v.p1] : [v, v]);

export function normalize(settings) {
  const s = { ...DEFAULTS, ...(settings || {}) };
  s.limitSet = s.limitSet || {};
  s.hpMax = clampInt(s.hpMax, 1, 40);
  s.hitGym = clampInt(s.hitGym, 0, 10);
  s.hitCowork = clampInt(s.hitCowork, 0, 10);
  s.foulHeal = clampInt(s.foulHeal, 0, 10);
  s.penaltyDays = clampInt(s.penaltyDays, 1, 14);
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

/** День тренировки: тренировка уже отмечена или стоит в плане. Снятый в тот же день план все равно считается. */
function isGymDay(mine, plans, who, day) {
  if (mine.some((e) => e.kind === 'gym' && e.day === day)) return true;
  return plans.some(
    (p) =>
      p.kind === 'gym' &&
      p.who === who &&
      p.day === day &&
      (!p.del || (p.madeOn < day && p.delOn >= day)),
  );
}

// --- неделя ---------------------------------------------------------------
// Все личное: у каждого свой лимит, свой джинн, своя оценка. Поля недели, которые
// зависят от человека, это массивы из двух значений по индексу игрока.

function summarize(ctx) {
  const { s, events, plans, w, end, levels, clubs, periodStarts, closed, future, today, owed } = ctx;
  const inWeek = events.filter((e) => e.day >= w && e.day <= end);
  const hit = { gym: s.hitGym, cowork: s.hitCowork };

  const counts = {};
  for (const kind of ['gym', 'cowork', 'hookah', 'club', 'penalty']) counts[kind] = [0, 0];
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
    hpMax: s.hpMax,
    level: [],
    limit: [],
    periodWeeks: [],
    pStart: [],
    pEnd: [],
    clubLimit: [],
    hearts: [],
    tokens: [],
    damage: [],
    heal: [],
    hp: [],
    debt: [],
    grade: [],
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
      if (isGymDay(mine, plans, who, e.day)) reasons.push('gymday');
      if (reasons.length) list.push({ id: e.id, who, day: e.day, at: e.at, kind: 'hookah', reasons });
    });
    clubsDone.forEach((e, i) => {
      if (i >= clubLimit) list.push({ id: e.id, who, day: e.day, at: e.at, kind: 'club', reasons: ['over'] });
    });
    // каждое следующее нарушение за неделю дороже на один штраф
    list.sort(byTime).forEach((f, i) => {
      f.cost = i + 1;
      wk.fouls.push(f);
      owed[who] += f.cost;
    });

    // удары по своему джинну: не больше одного каждого вида в день
    const seen = new Set();
    let damage = 0;
    for (const e of inWeek) {
      if (e.who !== who || !hit[e.kind]) continue;
      const key = `${e.day}|${e.kind}`;
      if (seen.has(key)) continue;
      // коворкинг считается только без кальяна в этот день
      if (e.kind === 'cowork' && inWeek.some((x) => x.kind === 'hookah' && x.who === who && x.day === e.day)) continue;
      seen.add(key);
      damage += hit[e.kind];
    }
    const heal = list.length * s.foulHeal;
    const hp = Math.max(0, s.hpMax + heal - damage);

    // долг: все начисленное к концу этой недели минус отработанное к сроку
    const paid = events.filter((e) => e.kind === 'penalty' && e.who === who && e.day <= through).length;
    const debt = Math.max(0, owed[who] - paid);

    wk.level.push(levels[who]);
    wk.limit.push(rung.n);
    wk.periodWeeks.push(rung.weeks);
    wk.pStart.push(pStart);
    wk.pEnd.push(pEnd);
    wk.clubLimit.push(clubLimit);
    wk.hearts.push({ max: rung.n, used, left: Math.max(0, rung.n - used) });
    wk.tokens.push({ max: clubLimit, used: clubsDone.length, left: Math.max(0, clubLimit - clubsDone.length) });
    wk.damage.push(damage);
    wk.heal.push(heal);
    wk.hp.push(hp);
    wk.debt.push(debt);
    wk.grade.push(future ? null : debt > 0 ? 2 : hp > 0 ? 3 : list.length ? 4 : 5);
  }
  wk.fouls.sort(byTime);
  return wk;
}

/**
 * Все недели от первой до текущей (или до opts.through, если нужна будущая).
 * Лимит кальяна человека падает на один после двух его закрытых недель подряд с оценкой 5,
 * лимит клуба вместе с ним, но не ниже одного. Настройка limitSet задает лимиты с нужной недели.
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
      fives[who] = wk.grade[who] === 5 ? fives[who] + 1 : 0;
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

/** Недели человека подряд с оценкой 4 или 5, считая от последней закрытой. */
export function streak(weeks, who) {
  let n = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const wk = weeks[i];
    if (!wk.closed) continue;
    if (wk.grade[who] >= 4) n += 1;
    else break;
  }
  return n;
}

/** Неотработанные штрафы человека на сегодня и срок самого раннего. */
export function debtInfo(state, weeks, who, today) {
  const s = normalize(state.settings);
  let paid = live(state.events).filter((e) => e.kind === 'penalty' && e.who === who && e.day <= today).length;
  let n = 0;
  let since = null;
  for (const wk of weeks) {
    for (const f of wk.fouls) {
      if (f.who !== who || f.day > today) continue;
      if (paid >= f.cost) {
        paid -= f.cost;
        continue;
      }
      n += f.cost - paid;
      paid = 0;
      if (!since) since = f.day;
    }
  }
  return { n, since, due: since ? addDays(since, s.penaltyDays) : null };
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
  if (events.some((e) => e.kind === 'gym' && (e.day === today || e.day === yesterday))) return 'fit';
  const s = normalize(state.settings);
  const lastDay = events.reduce((m, e) => (e.day > m ? e.day : m), '');
  const quietFrom = lastDay || s.start;
  if (quietFrom && quietFrom <= today && diffDays(today, quietFrom) >= 3) return 'sleep';
  return 'idle';
}

/** Что будет, если отметить событие: нарушение или нет, и остаток после него. */
export function preview(state, today, { who, kind, day, n = 1 }) {
  const id = '__preview';
  const tmp = { ...state, events: { ...(state.events || {}), [id]: { id, who, kind, day, n, at: Number.MAX_SAFE_INTEGER } } };
  const wk = timeline(tmp, today, { through: weekOf(day) }).find((w) => w.start === weekOf(day));
  if (!wk) return { foul: null, week: null };
  return { foul: wk.fouls.find((f) => f.id === id) || null, week: wk };
}

/** Можно ли поставить план на день. Возвращает null или код причины отказа. */
export function planBlock(state, weeks, { who, kind, day }) {
  const plans = live(state.plan).filter((p) => p.who === who);
  if (kind === 'hookah') {
    if (plans.some((p) => p.kind === 'gym' && p.day === day)) return 'gymday';
    const wk = weeks.find((w) => day >= w.start && day <= w.end);
    if (wk) {
      const planned = plans.filter((p) => p.kind === 'hookah' && p.day >= wk.pStart[who] && p.day <= wk.pEnd[who]).length;
      if (planned >= wk.limit[who]) return 'limit';
    }
  }
  if (kind === 'gym' && plans.some((p) => p.kind === 'hookah' && p.day === day)) return 'hookahday';
  return null;
}

/** Наклейки. У каждого свой набор. */
export function stickers(state, weeks, today) {
  const s = normalize(state.settings);
  const events = live(state.events).filter((e) => e.day <= today);
  const closed = weeks.filter((w) => w.closed);
  const start = perWho(s.levelStart).map((v) => clampInt(v ?? DEFAULTS.levelStart, 0, MAX_LEVEL));
  const out = [];
  for (const who of [0, 1]) {
    const mine = events.filter((e) => e.who === who);
    const low = weeks.reduce((m, w) => (w.future ? m : Math.min(m, w.level[who])), start[who]);
    out.push(
      { id: 'first5', who, got: closed.some((w) => w.grade[who] === 5) },
      { id: 'rung3', who, got: low <= 3 },
      { id: 'rung2', who, got: low <= 2 },
      { id: 'rung1', who, got: low <= 1 },
      { id: 'goal', who, got: low <= 0 },
      { id: 'clean7', who, got: longestCleanRun(state, who, today) >= 7 },
      { id: 'gym10', who, got: mine.filter((e) => e.kind === 'gym').length >= 10 },
    );
  }
  return out;
}

/** Счетчики недели до первой: без лимитов и оценок. */
export function preWeek(state, w) {
  const end = addDays(w, 6);
  const counts = {};
  for (const kind of ['gym', 'cowork', 'hookah', 'club', 'penalty']) counts[kind] = [0, 0];
  for (const e of live(state.events)) if (e.day >= w && e.day <= end && counts[e.kind]) counts[e.kind][e.who] += qty(e);
  return { start: w, end, pre: true, counts, fouls: [], grade: [null, null] };
}
