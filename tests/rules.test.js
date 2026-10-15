import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  addMonths,
  cleanDays,
  debtInfo,
  dow,
  level,
  monthWeeks,
  mood,
  planBlock,
  preview,
  shoutFor,
  stickers,
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
  for (const [who, kind, d, extra] of events) {
    const id = `e${++seq}`;
    state.events[id] = { id, who, kind, day: d, at: seq, ...(extra || {}) };
  }
  for (const [who, kind, d, madeOn, extra] of plans) {
    const id = `${d}_${who}_${kind}`;
    state.plan[id] = { id, who, kind, day: d, madeOn: madeOn || '2026-10-11', ...(extra || {}) };
  }
  return state;
}

/** Неделя на три бриллианта для одного человека: три тренировки и коворкинг, нарушений нет. */
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

test('пустая первая неделя: два бриллианта, лимит 4 и 2', () => {
  const [wk] = timeline(make(), day(2));
  assert.equal(wk.index, 1);
  assert.deepEqual(wk.limit, [4, 4]);
  assert.deepEqual(wk.clubLimit, [2, 2]);
  assert.deepEqual(wk.gems, [2, 2]);
  assert.deepEqual(wk.hearts[0], { max: 4, used: 0, left: 4 });
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
});

test('кальян без плана: нарушение', () => {
  const state = make({ events: [[0, 'hookah', day(1)]] });
  const [wk] = timeline(state, day(1));
  assert.equal(wk.fouls.length, 1);
  assert.deepEqual(wk.fouls[0].reasons, ['unplanned']);
  assert.deepEqual(wk.gems, [2, 2]); // кальян вне плана, но в лимите
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

test('бассейн это тоже спорт: делает день чистым, идет в счет тренировок', () => {
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
  const state = make({ events: [0, 1, 2].map((d) => [1, 'club', day(d)]) });
  const [wk] = timeline(state, day(3));
  assert.equal(wk.fouls.length, 1);
  assert.equal(wk.fouls[0].kind, 'club');
  assert.equal(wk.tokens[1].left, 0);
});

test('игры в плохом режиме: легкое нарушение, штраф набегает за каждые два', () => {
  const bad = (d) => [0, 'club', day(d), { bad: true }];
  const info = (state, today) => debtInfo(state, timeline(state, today), 0, today);

  // одна плохая игра в пределах лимита: нарушение есть, штрафа еще нет
  const one = make({ events: [bad(0)] });
  let [wk] = timeline(one, day(1));
  assert.equal(wk.fouls.length, 1);
  assert.deepEqual(wk.fouls[0].reasons, ['bad']);
  assert.equal(wk.fouls[0].light, true);
  assert.deepEqual(wk.debt, [0, 0]);
  assert.equal(info(one, day(1)).n, 0);
  assert.equal(info(one, day(1)).due, null);

  // вторая плохая игра: набежал целый штраф, срок считается от нее
  const two = make({ events: [bad(0), bad(3)] });
  assert.equal(timeline(two, day(3))[0].debt[0], 1);
  assert.deepEqual(info(two, day(3)), { n: 1, since: day(3), due: day(5) });
  const paid = make({ events: [bad(0), bad(3), [0, 'penalty', day(4)]] });
  assert.equal(info(paid, day(4)).n, 0);

  // нормальная игра в пределах лимита не нарушение
  assert.equal(timeline(make({ events: [[0, 'club', day(0)]] }), day(1))[0].fouls.length, 0);

  // сверх лимита и плохо сразу: одно легкое нарушение, а не два
  const both = make({ events: [[0, 'club', day(0)], [0, 'club', day(1)], bad(2)] });
  [wk] = timeline(both, day(3));
  assert.equal(wk.fouls.length, 1);
  assert.deepEqual(wk.fouls[0].reasons, ['over', 'bad']);
  assert.equal(wk.debt[0], 0);

  // игры не делают кальян дороже: первое нарушение с кальяном все равно один штраф
  const mixed = make({ events: [bad(0), [0, 'hookah', day(1)]] });
  [wk] = timeline(mixed, day(2));
  assert.deepEqual(wk.fouls.map((f) => f.cost), [0, 1]);
  assert.equal(wk.debt[0], 1);
  assert.equal(info(mixed, day(2)).since, day(1));
  // штраф отработан, полштрафа за игры ждет второй половины
  assert.equal(info(make({ events: [bad(0), [0, 'hookah', day(1)], [0, 'penalty', day(2)]] }), day(2)).n, 0);

  // число из настроек: штраф за каждое нарушение в играх
  const strict = make({ settings: { gamesPerPenalty: 1 }, events: [bad(0)] });
  [wk] = timeline(strict, day(1));
  assert.equal(wk.debt[0], 1);

  // до записи видно, чем кончится
  assert.deepEqual(preview(make(), day(1), { who: 0, kind: 'club', day: day(1), bad: true }).foul.reasons, ['bad']);
  assert.equal(preview(make(), day(1), { who: 0, kind: 'club', day: day(1) }).foul, null);
});

test('пока висит штраф, кальян это нарушение и стоит вдвое больше', () => {
  const planned = (d) => [0, 'hookah', d];
  // неделя 1: кальян вне плана, штраф не отработан. Неделя 2: кальян по плану и в лимите
  const owing = make({ events: [[0, 'hookah', day(0)], [0, 'hookah', day(8)]], plans: [planned(day(8))] });
  let weeks = timeline(owing, day(9));
  assert.deepEqual(weeks[1].fouls[0].reasons, ['debt']);
  assert.equal(weeks[1].fouls[0].cost, 2); // не один, а два
  assert.equal(debtInfo(owing, weeks, 0, day(9)).n, 3);

  // штраф отработан накануне или в тот же день раньше: кальян по плану не нарушение
  const paidDay = make({ events: [[0, 'hookah', day(0)], [0, 'penalty', day(7)], [0, 'hookah', day(8)]], plans: [planned(day(8))] });
  assert.equal(timeline(paidDay, day(9))[1].fouls.length, 0);
  const paidSame = make({ events: [[0, 'hookah', day(0)], [0, 'penalty', day(8)], [0, 'hookah', day(8)]], plans: [planned(day(8))] });
  assert.equal(timeline(paidSame, day(9))[1].fouls.length, 0);

  // в ту же неделю: первое нарушение один штраф, следующие кальяны под долгом всегда по два
  const sameWeek = make({ events: [[0, 'hookah', day(0)], [0, 'hookah', day(1)], [0, 'hookah', day(2)]], plans: [planned(day(1))] });
  weeks = timeline(sameWeek, day(3));
  assert.deepEqual(weeks[0].fouls.map((f) => [f.reasons.join('+'), f.cost]), [['unplanned', 1], ['debt', 2], ['unplanned+debt', 2]]);

  // полштрафа за игры это еще не долг
  const half = make({ events: [[0, 'club', day(0), { bad: true }], [0, 'hookah', day(1)]], plans: [planned(day(1))] });
  assert.equal(timeline(half, day(2))[0].fouls.filter((f) => f.kind === 'hookah').length, 0);

  // у друга свой счет: мой долг его кальян не трогает
  const friend = make({ events: [[0, 'hookah', day(0)], [1, 'hookah', day(1)]], plans: [[1, 'hookah', day(1)]] });
  assert.equal(timeline(friend, day(2))[0].fouls.filter((f) => f.who === 1).length, 0);

  // множитель из настроек: при одном кальян под долгом все равно нарушение, но обычной цены
  const mild = make({ settings: { debtX: 1 }, events: [[0, 'hookah', day(0)], [0, 'hookah', day(8)]], plans: [planned(day(8))] });
  assert.equal(timeline(mild, day(9))[1].fouls[0].cost, 1);

  // возглас и предпросмотр
  const say = shoutFor(owing, day(9), { who: 0, kind: 'hookah', day: day(9), n: 1 });
  assert.equal(say, 'debt');
});

test('каждое нарушение один штраф, цена не растет; у каждого свой счет', () => {
  // первый штраф отработан сразу, поэтому второй кальян не под долгом: обычное нарушение
  const state = make({
    events: [
      [0, 'hookah', day(0)],
      [0, 'penalty', day(0)],
      [0, 'hookah', day(1)],
      [1, 'hookah', day(1)],
    ],
  });
  const weeks = timeline(state, day(1));
  const costs = weeks[0].fouls.map((f) => [f.who, f.cost]).sort();
  assert.deepEqual(costs, [
    [0, 1],
    [0, 1],
    [1, 1],
  ]);
  assert.deepEqual(weeks[0].debt, [1, 1]);
  assert.equal(debtInfo(state, weeks, 0, day(1)).n, 1);
  assert.equal(debtInfo(state, weeks, 0, day(1)).due, day(3));
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
  assert.equal(info.n, 1); // первый отработан, второй кальян не под долгом: один штраф
  assert.equal(info.since, day(3));
  assert.equal(info.due, day(5));

  const slow = make({ settings: { penaltyDays: 4 }, events });
  assert.equal(debtInfo(slow, timeline(slow, day(3)), 0, day(3)).due, day(7));
});

test('бриллианты личные: от нуля до трех', () => {
  const gems = (events, settings) => timeline(make({ events, settings }), day(7))[0].gems;
  const clubs3 = [0, 1, 2].map((d) => [0, 'club', day(d)]); // лимит клуба 2
  const hookah5 = [0, 1, 2, 3, 4].map((d) => [0, 'hookah', day(d)]); // лимит кальяна 4

  // норма набрана, лимиты целы: три. У второго пусто: лимиты целы, нормы нет, два
  assert.deepEqual(gems(perfect(0, 0)), [3, 2]);
  // бассейн считается как спорт
  assert.equal(gems([[0, 'pool', day(0)], [0, 'gym', day(2)], [0, 'cowork', day(3)]])[0], 3);
  // лимиты целы, спорт один раз: два
  assert.equal(gems([[0, 'gym', day(0)], [0, 'cowork', day(1)]])[0], 2);
  // норма набрана, превышен один лимит: два
  assert.equal(gems([...perfect(0, 0), ...clubs3])[0], 2);
  assert.equal(gems([...perfect(0, 0), ...hookah5])[0], 2);
  // превышены оба лимита, спорт был: один
  assert.equal(gems([...perfect(0, 0), ...clubs3, ...hookah5])[0], 1);
  // превышен один лимит и нормы нет, но спорт был: один
  assert.equal(gems([[0, 'gym', day(0)], ...clubs3])[0], 1);
  // лимит превышен, спорта не было: ноль
  assert.equal(gems(clubs3)[0], 0);
  assert.equal(gems([[0, 'cowork', day(0)], ...hookah5])[0], 0);
  // штрафное занятие спортом не считается
  assert.equal(gems([[0, 'penalty', day(0)], ...clubs3])[0], 0);
  // норма меняется в настройках
  assert.equal(gems([[0, 'gym', day(0)]], { needSport: 1, needCowork: 0 })[0], 3);
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
  assert.equal(timeline(state, day(9))[0].debt[0], 0);
});

test('лимит личный: падает на один после двух своих недель на три бриллианта, клуб вместе с ним', () => {
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
    [2, 2, 1, 1],
  );
});

test('уровень персонажа: с нуля, плюс один за две недели подряд от двух бриллиантов', () => {
  const clubs3 = (who, from) => [0, 1, 2].map((d) => [who, 'club', day(from + d)]); // лимит клуба 2, спорта нет: ноль бриллиантов
  const state = make({
    events: [
      ...clubs3(0, 0), // неделя 1: у первого ноль
      [0, 'hookah', day(8)], // недели 2 и 3: кальян по плану и в лимите, это два бриллианта
      ...clubs3(1, 14), // неделя 3: у второго ноль, серия прервана
    ],
    plans: [[0, 'hookah', day(8)]],
  });
  assert.equal(level(timeline(state, day(8)), 1), 0); // одной недели мало
  const weeks = timeline(state, day(35));
  assert.deepEqual(weeks.map((w) => w.gems), [[0, 2], [2, 2], [2, 0], [2, 2], [2, 2], [2, 2]]);
  assert.deepEqual(weeks.map((w) => w.lvlUp), [
    [false, false],
    [false, true], // у второго недели 1 и 2
    [true, false], // у первого недели 2 и 3
    [false, false],
    [true, true], // после роста счет недель начинается заново
    [false, false], // текущая неделя не закрыта
  ]);
  // недели на ноль бриллиантов сняли по уровню
  assert.deepEqual(weeks.map((w) => w.lvlDown), [
    [true, false],
    [false, false],
    [false, true],
    [false, false],
    [false, false],
    [false, false],
  ]);
  assert.equal(level(weeks, 0), 1);
  assert.equal(level(weeks, 1), 1);

  // потолок: выше десятого уровень не растет, и отметок о росте больше нет
  const long = timeline(make({ settings: { lvlWeeks: 1 } }), day(7 * 14));
  assert.equal(level(long, 0), 10);
  assert.equal(long[9].lvlUp[0], true);
  assert.equal(long[10].lvlUp[0], false);

  // числа меняются в настройках: каждая неделя на три бриллианта
  const strict = make({ settings: { lvlWeeks: 1, lvlGems: 3 }, events: [...perfect(0, 0), ...perfect(0, 1)] });
  assert.equal(level(timeline(strict, day(21)), 0), 2);
  assert.equal(level(timeline(strict, day(21)), 1), 0);
});

test('плохая неделя снимает уровень, он уходит в минус; неотработанный штраф тоже снимает', () => {
  const clubs3 = (from) => [0, 1, 2].map((d) => [0, 'club', day(from + d)]); // ноль бриллиантов
  const lazy = make({ events: [...clubs3(0), ...clubs3(7), ...clubs3(14)] });
  const weeks = timeline(lazy, day(21));
  assert.deepEqual(weeks.slice(0, 3).map((w) => w.lvlDown[0]), [true, true, true]);
  assert.equal(level(weeks, 0), -3);
  assert.equal(level(weeks, 1), 1); // у второго пустые недели на два бриллианта: подряд две, плюс один

  // неделя на три бриллианта, но кальян вне плана и штраф не отработан
  const owing = make({ events: [...perfect(0, 0), [0, 'hookah', day(5)]] });
  assert.equal(timeline(owing, day(8))[0].lvlDown[0], false); // срок до вторника еще не вышел
  assert.equal(timeline(owing, day(9))[0].lvlDown[0], true);
  assert.equal(level(timeline(owing, day(16)), 0), -2); // штраф не сгорел: следующая неделя тоже минус
  const paid = make({ events: [...perfect(0, 0), [0, 'hookah', day(5)], [0, 'penalty', day(8)]] });
  assert.equal(timeline(paid, day(9))[0].lvlDown[0], false);

  // число из настроек: плохой считается только неделя на ноль
  const soft = make({ settings: { lvlDownGems: 0 }, events: [[0, 'gym', day(0)], ...clubs3(0)] }); // один бриллиант
  assert.equal(timeline(soft, day(7))[0].lvlDown[0], false);
});

test('пороги из настроек: цена нарушения, недели для уровня вниз, потолок, падение лимита', () => {
  const clubs3 = (from) => [0, 1, 2].map((d) => [0, 'club', day(from + d)]); // ноль бриллиантов

  // цена обычного нарушения
  const cost = make({ settings: { foulCost: 2 }, events: [[0, 'hookah', day(0)]] });
  assert.equal(timeline(cost, day(1))[0].fouls[0].cost, 2);

  // вниз только за две плохие недели подряд; хорошая неделя между ними обнуляет счет.
  // Плохой тут считается неделя на два бриллианта и меньше, поэтому пустые недели плохие и без штрафов
  const slow = make({ settings: { lvlDownWeeks: 2, lvlDownGems: 2 }, events: perfect(0, 2) });
  const weeks = timeline(slow, day(35));
  assert.deepEqual(weeks.slice(0, 5).map((w) => w.lvlDown[0]), [false, true, false, false, true]);
  assert.equal(level(weeks, 0), -2);

  // потолок и пол уровня
  const fast = make({ settings: { lvlWeeks: 1, lvlMax: 3 } });
  assert.equal(level(timeline(fast, day(7 * 8)), 0), 3);
  const lazy = make({ settings: { lvlMax: 2 }, events: [...clubs3(0), ...clubs3(7), ...clubs3(14)] });
  assert.equal(level(timeline(lazy, day(21)), 0), -2);

  // лимит падает после одной недели на два бриллианта и больше
  const drop = make({ settings: { dropWeeks: 1, dropGems: 2 } });
  assert.deepEqual(timeline(drop, day(15)).map((w) => w.limit[0]), [4, 3, 2]);
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
  assert.deepEqual(weeks[1].clubLimit, [2, 0]);
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

test('будущая неделя для плана: без бриллиантов, лимит текущего уровня', () => {
  const weeks = timeline(make(), day(3), { through: day(7) });
  assert.equal(weeks.length, 2);
  assert.equal(weeks[1].future, true);
  assert.deepEqual(weeks[1].gems, [null, null]);
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

test('дни без кальяна и достижения с целями из настроек', () => {
  const state = make({
    events: [[0, 'hookah', day(5)], ...perfectWeek(0), ...perfect(0, 1)],
    plans: [[0, 'hookah', day(5)]],
  });
  assert.equal(cleanDays(state, 0, day(13)), 8);
  assert.equal(cleanDays(state, 1, day(8)), 10); // с дня создания дневника, 11 октября

  const weeks = timeline(state, day(14));
  const all = stickers(state, weeks, day(14));
  const of = (id, who) => all.find((x) => x.id === id && x.who === who);
  assert.equal(all.length, 12);
  assert.deepEqual(of('sport', 0), { id: 'sport', who: 0, have: 6, need: 10, got: false });
  assert.equal(of('cowork', 0).have, 2);
  assert.deepEqual(of('clean', 0), { id: 'clean', who: 0, have: 9, need: 7, got: true });
  assert.deepEqual(of('level', 0), { id: 'level', who: 0, have: 1, need: 3, got: false }); // две недели подряд с бриллиантами
  assert.equal(of('gems', 0).have, 2);
  assert.equal(of('gems', 1).have, 1);
  assert.equal(of('gems', 1).got, true);
  assert.equal(of('goal', 0).got, false);

  // цель достижения меняется в настройках
  const easy = { ...state, settings: { ...state.settings, goalSport: 5 } };
  assert.equal(stickers(easy, timeline(easy, day(14)), day(14)).find((x) => x.id === 'sport' && x.who === 0).got, true);
});

test('возглас после отметки', () => {
  const say = (state, ev, today = ev.day) => shoutFor(state, today, { who: 0, n: 1, ...ev });

  assert.equal(say(make(), { kind: 'gym', day: day(1) }), 'good');
  assert.equal(say(make(), { kind: 'cowork', day: day(1) }), 'good');
  assert.equal(say(make({ events: [[0, 'hookah', day(1)]] }), { kind: 'pool', day: day(1) }), 'late');
  // коворкингом набрана норма недели: спорта уже хватало
  const almost = make({ events: [[0, 'gym', day(0)], [0, 'gym', day(1)], [0, 'gym', day(2)]] });
  assert.equal(say(almost, { kind: 'cowork', day: day(3) }), 'norm');
  assert.equal(say(make({ events: [...perfect(0, 0)] }), { kind: 'gym', day: day(5) }), 'good'); // норма уже была

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
  assert.equal(say(make(), { kind: 'club', day: day(1), bad: true }), 'club-bad');

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
