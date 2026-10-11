import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  addMonths,
  cleanDays,
  debtInfo,
  dow,
  monthWeeks,
  mood,
  planBlock,
  preview,
  shoutFor,
  stickers,
  streak,
  timeline,
  weekOf,
} from '../js/rules.js';

const START = '2026-10-12'; // понедельник
const day = (n) => addDays(START, n);

let seq = 0;
function make({ settings = {}, events = [], plans = [] } = {}) {
  const state = {
    settings: { start: START, createdDay: '2026-10-11', ...settings },
    events: {},
    plan: {},
  };
  for (const [who, kind, d] of events) {
    const id = `e${++seq}`;
    state.events[id] = { id, who, kind, day: d, at: seq };
  }
  for (const [who, kind, d, madeOn, extra] of plans) {
    const id = `${d}_${who}_${kind}`;
    state.plan[id] = { id, who, kind, day: d, madeOn: madeOn || '2026-10-11', ...(extra || {}) };
  }
  return state;
}

/** Неделя на пятерку для одного человека: три тренировки и коворкинг, нарушений нет. */
function perfect(who, weekIndex) {
  const base = weekIndex * 7;
  return [...[0, 2, 4].map((d) => [who, 'gym', day(base + d)]), [who, 'cowork', day(base + 1)]];
}
const perfectWeek = (weekIndex) => [...perfect(0, weekIndex), ...perfect(1, weekIndex)];

test('даты: неделя начинается с понедельника', () => {
  assert.equal(dow('2026-10-12'), 0);
  assert.equal(dow('2026-10-18'), 6);
  assert.equal(weekOf('2026-10-18'), '2026-10-12');
  assert.equal(weekOf('2026-10-19'), '2026-10-19');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('календарь: недели месяца и переход между месяцами', () => {
  assert.deepEqual(monthWeeks('2026-10'), ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  assert.deepEqual(monthWeeks('2027-02'), ['2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22']);
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
});

test('до первой недели недель нет', () => {
  assert.deepEqual(timeline(make(), '2026-10-10'), []);
});

test('пустая первая неделя: у каждого свой джинн на 7, оценка 3, лимит 4 и 3', () => {
  const [wk] = timeline(make(), day(2));
  assert.equal(wk.index, 1);
  assert.deepEqual(wk.limit, [4, 4]);
  assert.deepEqual(wk.clubLimit, [3, 3]);
  assert.equal(wk.hpMax, 7);
  assert.deepEqual(wk.hp, [7, 7]);
  assert.deepEqual(wk.grade, [3, 3]);
  assert.deepEqual(wk.hearts[0], { max: 4, used: 0, left: 4 });
});

test('числа берутся из настроек: здоровье джинна, удары, лечение', () => {
  const state = make({
    settings: { hpMax: 10, hitGym: 3, hitCowork: 2, foulHeal: 5 },
    events: [
      [0, 'gym', day(0)],
      [0, 'cowork', day(1)],
      [1, 'hookah', day(1)],
    ],
  });
  const [wk] = timeline(state, day(2));
  assert.equal(wk.hpMax, 10);
  assert.deepEqual(wk.damage, [5, 0]);
  assert.deepEqual(wk.hp, [5, 15]);
});

test('первую неделю можно перенести в настройках', () => {
  const state = make({ settings: { start: day(7) }, events: [[0, 'hookah', day(1)]] });
  assert.deepEqual(timeline(state, day(3)), []);
  const weeks = timeline(state, day(8));
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].start, day(7));
  assert.equal(weeks[0].index, 1);
  assert.equal(weeks[0].fouls.length, 0); // кальян до первой недели не оценивается
});

test('кальян по плану в пределах лимита не нарушение и тратит сердце', () => {
  const state = make({ events: [[0, 'hookah', day(1)]], plans: [[0, 'hookah', day(1)]] });
  const [wk] = timeline(state, day(1));
  assert.equal(wk.fouls.length, 0);
  assert.equal(wk.hearts[0].left, 3);
  assert.equal(wk.hearts[1].left, 4);
  assert.deepEqual(wk.hp, [7, 7]);
});

test('кальян без плана: нарушение, свой джинн лечится на 3, чужой не трогается', () => {
  const state = make({ events: [[0, 'hookah', day(1)]] });
  const [wk] = timeline(state, day(1));
  assert.equal(wk.fouls.length, 1);
  assert.deepEqual(wk.fouls[0].reasons, ['unplanned']);
  assert.deepEqual(wk.hp, [10, 7]);
  assert.deepEqual(wk.heal, [3, 0]);
  assert.deepEqual(wk.grade, [2, 3]);
});

test('план, поставленный в тот же день, не считается; в день создания дневника считается', () => {
  const late = make({ events: [[0, 'hookah', day(1)]], plans: [[0, 'hookah', day(1), day(1)]] });
  assert.deepEqual(timeline(late, day(1))[0].fouls[0].reasons, ['unplanned']);

  const grace = make({
    settings: { createdDay: day(1) },
    events: [[0, 'hookah', day(1)]],
    plans: [[0, 'hookah', day(1), day(1)]],
  });
  assert.equal(timeline(grace, day(1))[0].fouls.length, 0);
});

test('кальян в день тренировки: нарушение, даже если тренировку только запланировали', () => {
  const done = make({
    events: [
      [0, 'gym', day(0)],
      [0, 'hookah', day(0)],
    ],
    plans: [[0, 'hookah', day(0)]],
  });
  assert.deepEqual(timeline(done, day(0))[0].fouls[0].reasons, ['gymday']);

  const planned = make({
    events: [[1, 'hookah', day(2)]],
    plans: [
      [1, 'hookah', day(2)],
      [1, 'gym', day(2)],
    ],
  });
  assert.deepEqual(timeline(planned, day(2))[0].fouls[0].reasons, ['gymday']);
});

test('срыв в день тренировки это обычное нарушение с одним штрафом', () => {
  const state = make({
    events: [
      [1, 'gym', day(0)],
      [1, 'hookah', day(0)],
    ],
    plans: [[1, 'hookah', day(0)]],
  });
  const [foul] = timeline(state, day(0))[0].fouls;
  assert.deepEqual(foul.reasons, ['gymday']);
  assert.equal(foul.cost, 1);
});

test('бассейн это тоже спорт: бьет джинна, делает день чистым, идет в счет тренировок', () => {
  const state = make({
    events: [
      [0, 'pool', day(0)],
      [0, 'gym', day(0)],
      [0, 'hookah', day(0)],
      [1, 'hookah', day(2)],
    ],
    plans: [
      [0, 'hookah', day(0)],
      [1, 'hookah', day(2)],
      [1, 'pool', day(2)],
    ],
  });
  const weeks = timeline(state, day(2));
  const [wk] = weeks;
  assert.equal(wk.damage[0], 4); // спорт и бассейн в один день считаются оба
  assert.equal(wk.counts.pool[0], 1);
  assert.deepEqual(wk.fouls.map((f) => [f.who, f.reasons.join('+')]), [
    [0, 'gymday'],
    [1, 'gymday'],
  ]);
  assert.equal(mood(make({ events: [[0, 'pool', day(1)]] }), timeline(make(), day(2)), 0, day(2)), 'fit');
  assert.equal(planBlock(state, weeks, { who: 1, kind: 'hookah', day: day(2) }), 'gymday');
  assert.equal(planBlock(make({ plans: [[0, 'hookah', day(3)]] }), weeks, { who: 0, kind: 'pool', day: day(3) }), 'hookahday');
  assert.equal(planBlock(state, weeks, { who: 0, kind: 'cowork', day: day(4) }), null);
});

test('чужая тренировка мой день чистым не делает', () => {
  const state = make({
    events: [
      [1, 'gym', day(0)],
      [0, 'hookah', day(0)],
    ],
    plans: [[0, 'hookah', day(0)]],
  });
  assert.equal(timeline(state, day(0))[0].fouls.length, 0);
});

test('снять план тренировки в тот же день, чтобы покурить, не помогает', () => {
  const state = make({
    events: [[0, 'hookah', day(2)]],
    plans: [
      [0, 'hookah', day(2)],
      [0, 'gym', day(2), '2026-10-11', { del: true, delOn: day(2) }],
    ],
  });
  assert.deepEqual(timeline(state, day(2))[0].fouls[0].reasons, ['gymday']);

  const early = make({
    events: [[0, 'hookah', day(2)]],
    plans: [
      [0, 'hookah', day(2)],
      [0, 'gym', day(2), '2026-10-11', { del: true, delOn: day(1) }],
    ],
  });
  assert.equal(timeline(early, day(2))[0].fouls.length, 0);
});

test('пятый кальян при лимите 4: сверх лимита; одно событие это одно нарушение', () => {
  const days = [0, 1, 2, 3, 4];
  const state = make({
    events: days.map((d) => [0, 'hookah', day(d)]),
    plans: days.slice(0, 4).map((d) => [0, 'hookah', day(d)]),
  });
  const [wk] = timeline(state, day(4));
  assert.equal(wk.fouls.length, 1);
  assert.deepEqual(wk.fouls[0].reasons, ['over', 'unplanned']);
  assert.equal(wk.hearts[0].left, 0);
});

test('два кальяна за вечер: одна запись тратит два сердца, а сверх лимита это одно нарушение', () => {
  const state = make({ plans: [0, 2, 4].map((d) => [0, 'hookah', day(d)]) });
  const add = (d, n) => {
    const id = `n${d}`;
    state.events[id] = { id, who: 0, kind: 'hookah', day: day(d), n, at: d };
  };
  add(0, 2);
  let [wk] = timeline(state, day(0));
  assert.deepEqual(wk.hearts[0], { max: 4, used: 2, left: 2 });
  assert.equal(wk.counts.hookah[0], 2);
  assert.equal(wk.fouls.length, 0);

  add(2, 3);
  [wk] = timeline(state, day(2));
  assert.equal(wk.hearts[0].left, 0);
  assert.equal(wk.fouls.length, 1);
  assert.deepEqual(wk.fouls[0].reasons, ['over']);
  assert.equal(preview(state, day(4), { who: 0, kind: 'hookah', day: day(4), n: 2 }).week.hearts[0].used, 7);
});

test('клуб сверх лимита: нарушение', () => {
  const state = make({ events: [0, 1, 2, 3].map((d) => [1, 'club', day(d)]) });
  const [wk] = timeline(state, day(3));
  assert.equal(wk.fouls.length, 1);
  assert.equal(wk.fouls[0].kind, 'club');
  assert.equal(wk.tokens[1].left, 0);
});

test('эскалация: второе нарушение за неделю стоит два штрафа, у каждого свой счет', () => {
  const state = make({
    events: [
      [0, 'hookah', day(0)],
      [0, 'hookah', day(1)],
      [1, 'hookah', day(1)],
    ],
  });
  const weeks = timeline(state, day(1));
  const costs = weeks[0].fouls.map((f) => [f.who, f.cost]).sort();
  assert.deepEqual(costs, [
    [0, 1],
    [0, 2],
    [1, 1],
  ]);
  assert.deepEqual(weeks[0].debt, [3, 1]);
  assert.equal(debtInfo(state, weeks, 0, day(1)).n, 3);
  assert.equal(debtInfo(state, weeks, 0, day(1)).due, day(2));
});

test('штраф гасит долг, срок считается от самого раннего неотработанного и берется из настроек', () => {
  const events = [
    [0, 'hookah', day(0)],
    [0, 'hookah', day(3)],
    [0, 'penalty', day(1)],
  ];
  const state = make({ events });
  const weeks = timeline(state, day(3));
  const info = debtInfo(state, weeks, 0, day(3));
  assert.equal(info.n, 2);
  assert.equal(info.since, day(3));
  assert.equal(info.due, day(5));

  const slow = make({ settings: { penaltyDays: 4 }, events });
  assert.equal(debtInfo(slow, timeline(slow, day(3)), 0, day(3)).due, day(7));
});

test('джинн: тренировка 2, коворкинг 1, не больше одного вида в день, каждому свое', () => {
  const state = make({
    events: [
      [0, 'gym', day(0)],
      [0, 'gym', day(0)],
      [0, 'cowork', day(1)],
      [0, 'cowork', day(1)],
      [1, 'cowork', day(1)],
    ],
  });
  const [wk] = timeline(state, day(2));
  assert.deepEqual(wk.damage, [3, 1]);
  assert.deepEqual(wk.hp, [4, 6]);
});

test('коворкинг с кальяном в тот же день по джинну не бьет', () => {
  const state = make({
    events: [
      [0, 'cowork', day(1)],
      [0, 'hookah', day(1)],
    ],
    plans: [[0, 'hookah', day(1)]],
  });
  assert.deepEqual(timeline(state, day(1))[0].damage, [0, 0]);
});

test('штрафная тренировка джинна не бьет', () => {
  const state = make({ events: [[0, 'penalty', day(1)]] });
  assert.deepEqual(timeline(state, day(1))[0].damage, [0, 0]);
});

test('оценки личные: 5, 4, 3 и 2', () => {
  // нарушение лечит джинна на 3, поэтому для четверки нужен запас ударов
  const extra = [
    [0, 'gym', day(5)],
    [0, 'gym', day(6)],
  ];

  const four = make({
    events: [...perfectWeek(0), ...extra, [0, 'hookah', day(3)], [0, 'penalty', day(4)]],
  });
  const fourWeek = timeline(four, day(7))[0];
  assert.deepEqual(fourWeek.hp, [0, 0]);
  assert.deepEqual(fourWeek.grade, [4, 5]);

  const three = make({ events: [...perfect(1, 0), [0, 'gym', day(0)]] });
  assert.deepEqual(timeline(three, day(7))[0].grade, [3, 5]);

  const two = make({ events: [...perfectWeek(0), ...extra, [0, 'hookah', day(3)]] });
  assert.deepEqual(timeline(two, day(10))[0].grade, [2, 5]);
});

test('штраф за воскресный срыв можно отработать до вторника', () => {
  const state = make({
    events: [
      ...perfect(0, 0),
      [0, 'cowork', day(3)],
      [0, 'gym', day(5)],
      [0, 'hookah', day(6)],
      [0, 'penalty', day(8)],
    ],
  });
  assert.equal(timeline(state, day(9))[0].grade[0], 4);
});

test('лимит личный: падает на один после двух своих пятерок подряд, клуб вместе с ним', () => {
  const events = [...perfect(0, 0), ...perfect(0, 1), ...perfect(0, 2), ...perfect(1, 0), ...perfect(1, 2)];
  const weeks = timeline(make({ events }), day(21));
  assert.deepEqual(
    weeks.map((w) => w.limit),
    [
      [4, 4],
      [4, 4],
      [3, 4],
      [3, 4],
    ],
  );
  assert.deepEqual(
    weeks.map((w) => w.clubLimit[0]),
    [3, 3, 2, 2],
  );
  assert.equal(streak(weeks, 0), 3);
  assert.equal(streak(weeks, 1), 1);
});

test('лимиты из настроек: стартовые и на конкретную неделю, каждому свои', () => {
  const start = timeline(make({ settings: { levelStart: { p0: 6, p1: 2 }, clubStart: { p0: 1, p1: 5 } } }), day(1));
  assert.deepEqual(start[0].limit, [6, 2]);
  assert.deepEqual(start[0].clubLimit, [1, 5]);

  const set = { [day(7)]: { p1: { level: 2, club: 0 } } };
  const weeks = timeline(make({ settings: { limitSet: set } }), day(15));
  assert.deepEqual(
    weeks.map((w) => w.limit),
    [
      [4, 4],
      [4, 2],
      [4, 2],
    ],
  );
  assert.deepEqual(weeks[1].clubLimit, [3, 0]);
});

test('уровень 0: одно сердце на две недели', () => {
  const state = make({
    settings: { levelStart: 0 },
    events: [
      [0, 'hookah', day(2)],
      [0, 'hookah', day(9)],
    ],
    plans: [
      [0, 'hookah', day(2)],
      [0, 'hookah', day(9)],
    ],
  });
  const weeks = timeline(state, day(9));
  assert.equal(weeks[0].periodWeeks[0], 2);
  assert.equal(weeks[0].fouls.length, 0);
  assert.equal(weeks[1].pStart[0], START);
  assert.deepEqual(weeks[1].fouls[0].reasons, ['over']);
  assert.equal(weeks[1].hearts[0].left, 0);
});

test('будущая неделя для плана: без оценки, лимит текущего уровня', () => {
  const weeks = timeline(make(), day(3), { through: day(7) });
  assert.equal(weeks.length, 2);
  assert.equal(weeks[1].future, true);
  assert.deepEqual(weeks[1].grade, [null, null]);
  assert.deepEqual(weeks[1].limit, [4, 4]);
});

test('preview: показывает последствие до записи и не трогает состояние', () => {
  const state = make({ events: [[0, 'gym', day(1)]], plans: [[0, 'hookah', day(1)]] });
  const res = preview(state, day(1), { who: 0, kind: 'hookah', day: day(1) });
  assert.deepEqual(res.foul.reasons, ['gymday']);
  assert.equal(Object.keys(state.events).length, 1);
  assert.equal(preview(state, day(1), { who: 0, kind: 'gym', day: day(2) }).foul, null);
});

test('planBlock: кальян не ставится на день тренировки и сверх лимита', () => {
  const state = make({
    plans: [
      [0, 'gym', day(0)],
      [0, 'hookah', day(1)],
      [0, 'hookah', day(2)],
      [0, 'hookah', day(3)],
      [0, 'hookah', day(4)],
    ],
  });
  const weeks = timeline(state, '2026-10-11', { through: START });
  assert.equal(planBlock(state, weeks, { who: 0, kind: 'hookah', day: day(0) }), 'gymday');
  assert.equal(planBlock(state, weeks, { who: 0, kind: 'hookah', day: day(5) }), 'limit');
  assert.equal(planBlock(state, weeks, { who: 0, kind: 'gym', day: day(1) }), 'hookahday');
  assert.equal(planBlock(state, weeks, { who: 1, kind: 'hookah', day: day(5) }), null);
});

test('состояние персонажа', () => {
  const m = (state, d, who = 0) => mood(state, timeline(state, d), who, d);
  assert.equal(m(make({ events: [[0, 'gym', day(1)]] }), day(2)), 'fit');
  assert.equal(m(make({ events: [[0, 'hookah', day(1)]] }), day(2)), 'smoke'); // долг
  assert.equal(m(make({ events: [[0, 'hookah', day(1)]] }), day(2), 1), 'idle'); // чужой долг не мой
  assert.equal(m(make({ events: [[0, 'hookah', day(1)]], plans: [[0, 'hookah', day(1)]] }), day(1)), 'smoke');
  assert.equal(m(make({ events: [[0, 'cowork', day(0)]] }), day(1)), 'idle');
  assert.equal(m(make({ events: [[0, 'cowork', day(0)]] }), day(3)), 'sleep');
  assert.equal(m(make(), day(4)), 'sleep');
});

test('дни без кальяна и личные наклейки', () => {
  const state = make({
    events: [[0, 'hookah', day(5)], ...perfectWeek(0), ...perfect(0, 1)],
    plans: [[0, 'hookah', day(5)]],
  });
  assert.equal(cleanDays(state, 0, day(13)), 8);
  assert.equal(cleanDays(state, 1, day(8)), 10); // с дня создания дневника, 11 октября

  const weeks = timeline(state, day(14));
  const all = stickers(state, weeks, day(14));
  const got = (id, who) => all.find((x) => x.id === id && x.who === who).got;
  assert.equal(all.length, 14);
  assert.equal(got('first5', 0), true);
  assert.equal(got('first5', 1), true);
  assert.equal(got('rung3', 0), true);
  assert.equal(got('rung3', 1), false);
  assert.equal(got('rung2', 0), false);
  assert.equal(got('clean7', 0), true);
  assert.equal(got('gym10', 0), false);
});

test('возглас после отметки', () => {
  const say = (state, ev, today = ev.day) => shoutFor(state, today, { who: 0, n: 1, ...ev });

  assert.equal(say(make(), { kind: 'gym', day: day(1) }), 'good');
  assert.equal(say(make(), { kind: 'cowork', day: day(1) }), 'good');
  assert.equal(say(make({ events: [[0, 'hookah', day(1)]] }), { kind: 'pool', day: day(1) }), 'late');
  // третьей тренировкой и коворкингом джинн на 7 добит
  const almost = make({ events: [[0, 'gym', day(0)], [0, 'gym', day(1)], [0, 'gym', day(2)]] });
  assert.equal(say(almost, { kind: 'cowork', day: day(3) }), 'win');

  const planned = make({ plans: [[0, 'hookah', day(1)], [0, 'hookah', day(8)]] });
  assert.equal(say(planned, { kind: 'hookah', day: day(1) }), 'hookah-ok');
  assert.equal(say(make(), { kind: 'hookah', day: day(1) }), 'foul');
  assert.equal(say(planned, { kind: 'hookah', day: day(1), n: 3 }), 'danger');
  const twice = make({ events: [[0, 'hookah', day(1)], [0, 'hookah', day(1)]], plans: [[0, 'hookah', day(1)]] });
  assert.equal(say(twice, { kind: 'hookah', day: day(1) }), 'danger');
  // прошлый кальян был неделю назад
  const rested = make({ events: [[0, 'hookah', day(1)]], plans: [[0, 'hookah', day(1)], [0, 'hookah', day(8)]] });
  assert.equal(say(rested, { kind: 'hookah', day: day(8) }), 'treat');
  // кальянов не было с самого создания дневника, а ему больше пяти дней
  assert.equal(say(planned, { kind: 'hookah', day: day(8) }), 'treat');

  assert.equal(say(make(), { kind: 'club', day: day(1) }), 'club-ok');
  const clubs = make({ events: [0, 1, 2].map((d) => [0, 'club', day(d)]) });
  assert.equal(say(clubs, { kind: 'club', day: day(3) }), 'club-over');

  const owes = make({ events: [[0, 'hookah', day(0)], [0, 'hookah', day(1)]] }); // долг 1 + 2
  assert.equal(say(owes, { kind: 'penalty', day: day(2) }), 'paid-part');
  const owesOne = make({ events: [[0, 'hookah', day(0)]] });
  assert.equal(say(owesOne, { kind: 'penalty', day: day(1) }), 'paid');
});

test('удаленные записи не считаются', () => {
  const state = make({ events: [[0, 'hookah', day(1)]] });
  Object.values(state.events)[0].del = true;
  const [wk] = timeline(state, day(1));
  assert.equal(wk.fouls.length, 0);
  assert.equal(wk.hearts[0].left, 4);
});
