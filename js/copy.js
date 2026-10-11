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
  club: { name: 'клуб', done: 'клуб отмечен' },
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
export const nClub = (n) => `${n} ${plural(n, 'клуб', 'клуба', 'клубов')}`;
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

export function weekRange(start) {
  const end = addDays(start, 6);
  const a = parts(start);
  const b = parts(end);
  return a.m === b.m ? `с ${a.d} по ${dayMonth(end)}` : `с ${dayMonth(start)} по ${dayMonth(end)}`;
}

/** «4 кальяна в неделю» или «1 кальян на две недели». */
export const hookahLimitText = (level) => (level >= 1 ? `${nHookah(level)} в неделю` : '1 кальян на две недели');

export function foulText(foul) {
  const why = foul.reasons.map((r) => REASON[r]).join(', ');
  return `${KIND[foul.kind].name} ${why}`;
}

export function gradeWhy(wk, who) {
  const g = wk.grade[who];
  if (g === 5) return 'джинн побежден, нарушений нет';
  if (g === 4) return 'джинн побежден, штраф отработан';
  if (g === 3) return `у джинна осталось ${wk.hp[who]} из ${wk.hpMax + wk.heal[who]}`;
  return 'есть неотработанный штраф';
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

export const STICKER = {
  first5: { name: 'первая пятерка', how: 'неделя без нарушений и с побежденным джинном' },
  rung3: { name: 'лимит 3', how: 'лимит кальяна 3 в неделю' },
  rung2: { name: 'лимит 2', how: 'лимит кальяна 2 в неделю' },
  rung1: { name: 'лимит 1', how: 'лимит кальяна 1 в неделю' },
  goal: { name: 'цель', how: 'один кальян на две недели' },
  clean7: { name: '7 дней без кальяна', how: 'семь дней подряд без кальяна' },
  gym10: { name: '10 тренировок', how: 'десять занятий спортом или бассейном с начала дневника' },
};

export const SYNC = {
  online: 'на связи',
  connecting: 'подключаюсь',
  offline: 'нет сети',
  local: 'локально',
  demo: 'пример',
  denied: 'нет доступа к базе',
};
