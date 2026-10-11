// Тексты интерфейса и форматирование. Без буквы «е с точками» и без тире.

import { addDays, dow } from './rules.js';

export const DOW_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const DOW_LONG = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const DOW_GEN = ['понедельника', 'вторника', 'среды', 'четверга', 'пятницы', 'субботы', 'воскресенья'];
const DOW_ACC = ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье'];
const MONTH = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];
const MONTH_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export const KIND = {
  gym: { name: 'спорт', done: 'спорт отмечен' },
  pool: { name: 'бассейн', done: 'бассейн отмечен' },
  cowork: { name: 'коворкинг', done: 'коворкинг отмечен' },
  hookah: { name: 'кальян', done: 'кальян отмечен' },
  club: { name: 'игры', done: 'игры отмечены' },
  penalty: { name: 'штраф отработан', done: 'штраф отработан' },
};

export const MOOD = { idle: 'в порядке', fit: 'в форме', smoke: 'в дыму', sleep: 'спит' };

const REASON = { over: 'сверх лимита', unplanned: 'вне плана', gymday: 'в день спорта' };

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const nDays = (n) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;
export const nWeeks = (n) => `${n} ${plural(n, 'неделя', 'недели', 'недель')}`;
export const nHookah = (n) => `${n} ${plural(n, 'кальян', 'кальяна', 'кальянов')}`;
export const nPenalty = (n) => `${n} ${plural(n, 'штраф', 'штрафа', 'штрафов')}`;

/** Спорт-штраф за одно нарушение. */
export const PENALTY = 'одно занятие спортом';

const parts = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return { y, m, d };
};
export const dayNum = (day) => parts(day).d;
/** 'YYYY-MM' -> «октябрь 2026» */
export const monthTitle = (month) => `${MONTH[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export const dayMonth = (day) => `${parts(day).d} ${MONTH_GEN[parts(day).m - 1]}`;
export const dayLong = (day) => `${DOW_LONG[dow(day)]}, ${dayMonth(day)}`;
export const dayShort = (day) => `${DOW_SHORT[dow(day)]}, ${dayMonth(day)}`;
export const byEndOf = (day) => `до конца ${DOW_GEN[dow(day)]}`;
export const onDay = (day) => DOW_ACC[dow(day)];

/** Диапазон недели коротко: «05.10 - 11.10». */
export function weekRange(start) {
  const short = (day) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
  return `${short(start)} - ${short(addDays(start, 6))}`;
}

/** «4 кальяна в неделю» или «1 кальян на две недели». */
export const hookahLimitText = (level) => (level >= 1 ? `${nHookah(level)} в неделю` : '1 кальян на две недели');

export function foulText(foul) {
  const why = foul.reasons.map((r) => REASON[r]).join(', ');
  return `${KIND[foul.kind].name} ${why}`;
}

export const nGems = (n) => `${n} ${plural(n, 'бриллиант', 'бриллианта', 'бриллиантов')}`;

/** Из чего сложились бриллианты недели: лимиты и норма спорта с коворкингом. */
export function gemsWhy(wk, who, s) {
  const sport = wk.counts.gym[who] + wk.counts.pool[who];
  return [
    wk.over[who].hookah ? 'кальян сверх лимита' : 'кальян в лимите',
    wk.over[who].club ? 'игры сверх лимита' : 'игры в лимите',
    `спорт ${sport} из ${s.needSport}`,
    `коворкинг ${wk.counts.cowork[who]} из ${s.needCowork}`,
  ].join(', ');
}

/** Возгласы после отметки: тон и варианты фразы. Вариант выбирается случайно. */
export const SHOUT = {
  good: { tone: 'good', say: ['красавчик!', 'машина!', 'так держать!', 'джинн в шоке!'] },
  win: { tone: 'good', say: ['джинн повержен!'] },
  paid: { tone: 'good', say: ['долг закрыт!'] },
  'paid-part': { tone: 'good', say: ['минус штраф!'] },
  late: { tone: 'calm', say: ['лучше, чем ничего'] },
  'hookah-ok': { tone: 'calm', say: ['по плану'] },
  treat: { tone: 'calm', say: ['приятного покура!'] },
  'club-ok': { tone: 'calm', say: ['катка засчитана'] },
  foul: { tone: 'bad', say: ['нарушение!'] },
  danger: { tone: 'bad', say: ['опасно!'] },
  'club-over': { tone: 'bad', say: ['перебор!'] },
};

/** Достижения в итогах: название и что считается. Сколько нужно, задается в листе достижения. */
export const STICKER = {
  sport: { name: 'спорт', how: 'Занятия спортом и бассейном за все время. Штрафные не в счет.' },
  cowork: { name: 'коворкинг', how: 'Дни в коворкинге за все время.' },
  clean: { name: 'без кальяна', how: 'Дни подряд без кальяна, лучший отрезок.' },
  genie: { name: 'джинн побежден', how: 'Недели, в которые джинн побежден.' },
  gems: { name: 'три бриллианта', how: 'Недели на три бриллианта.' },
  goal: { name: 'раз в две недели', how: 'Лимит кальяна дошел до одного на две недели. Он падает на один после двух недель подряд на три бриллианта.' },
};

export const SYNC = {
  online: 'на связи',
  connecting: 'подключаюсь',
  offline: 'нет сети',
  local: 'локально',
  demo: 'пример',
  denied: 'нет доступа к базе',
};
