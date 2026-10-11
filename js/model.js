// Модель для интерфейса: все, что нужно разметке, считается здесь из журнала и состояния экрана.
// Чистая функция без DOM, поэтому отрисовку можно проверять тестом.

import * as R from './rules.js';

const live = (obj) => Object.values(obj || {}).filter((r) => r && !r.del);
const byTime = (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : (a.at || 0) - (b.at || 0));

export function playersOf(state) {
  const p = (state.settings && state.settings.players) || [];
  return [0, 1].map((i) => ({ name: (p[i] && p[i].name) || (i === 0 ? 'Елисей' : 'Павел') }));
}

/**
 * @param {object} state журнал: settings, events, plan
 * @param {string} today 'YYYY-MM-DD'
 * @param {object} view состояние экрана: me, showOther, viewStart, month, mode, screen, status, pending, kind
 * Возвращает модель; viewStart и month в ней уже приведены к допустимым границам.
 */
export function buildModel(state, today, view) {
  const s = R.normalize(state.settings);
  const { me, showOther = false, mode = 'week', screen = 'home' } = view;
  const curStart = R.weekOf(today);
  // вперед можно уйти на одну неделю, чтобы поставить план
  const firstView = today < s.start ? s.start : curStart;
  const weeks = R.timeline(state, today, { through: R.addDays(firstView, 7) });
  const cur = weeks.find((w) => w.start === curStart) || weeks[0];
  const minView = [R.weekOf(s.createdDay || s.start), s.start].sort()[0];
  const maxView = R.addDays(firstView, 7);
  let viewStart = view.viewStart || firstView;
  if (viewStart < minView) viewStart = minView;
  if (viewStart > maxView) viewStart = maxView;
  const weekAt = (w) => weeks.find((x) => x.start === w) || R.preWeek(state, w);
  const other = me === 0 ? 1 : 0;
  const minMonth = minView.slice(0, 7);
  const maxMonth = R.addDays(today, 7).slice(0, 7);
  let month = view.month || today.slice(0, 7);
  if (month < minMonth) month = minMonth;
  if (month > maxMonth) month = maxMonth;
  // лимиты из меню действуют с текущей недели, а до старта с первой
  const limitWeek = weeks.find((w) => w.start === firstView) || weeks[0];
  return {
    state,
    s,
    today,
    curStart,
    weeks,
    cur,
    viewStart,
    view: weekAt(viewStart),
    mode,
    canPrev: viewStart > minView,
    canNext: viewStart < maxView,
    month,
    canPrevMonth: month > minMonth,
    canNextMonth: month < maxMonth,
    limitWeek,
    limitWeekIsFirst: limitWeek.start === s.start,
    foulIds: new Set(weeks.flatMap((w) => w.fouls.map((f) => f.id))),
    me,
    other,
    showOther,
    shown: showOther ? [0, 1] : [me],
    players: playersOf(state),
    events: live(state.events).sort(byTime),
    plans: live(state.plan),
    debts: [0, 1].map((who) => R.debtInfo(state, weeks, who, today)),
    moods: [0, 1].map((who) => R.mood(state, weeks, who, today)),
    screen,
    stickers: R.stickers(state, weeks, today),
    status: view.status || 'local',
    pending: view.pending || 0,
    kind: view.kind || 'local',
    joined: Boolean(s.joined && s.joined[`p${other}`]),
  };
}
