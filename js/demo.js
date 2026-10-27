// Выдуманный журнал для режима ?demo: пять недель, от тяжелой первой до текущей.
// Нужен, чтобы посмотреть интерфейс с данными, не трогая настоящий дневник.

import { addDays, weekOf } from './rules.js';

export function demoState(today) {
  const cur = weekOf(today);
  const start = addDays(cur, -28);
  const events = {};
  const plan = {};
  let n = 0;
  const at = (w, d) => addDays(start, w * 7 + d);
  const ev = (who, kind, w, d) => {
    const day = at(w, d);
    if (day > today) return;
    n += 1;
    const id = `demo${n}`;
    events[id] = { id, who, kind, day, at: n };
  };
  const both = (kind, w, d) => {
    ev(0, kind, w, d);
    ev(1, kind, w, d);
  };
  const pl = (who, kind, w, d) => {
    const day = at(w, d);
    const id = `${day}_${who}_${kind}`;
    plan[id] = { id, who, kind, day, madeOn: addDays(day, -2), at: n };
  };
  /** кальян по плану */
  const hk = (who, w, d) => {
    pl(who, 'hookah', w, d);
    ev(who, 'hookah', w, d);
  };
  const gym = (who, w, d) => {
    pl(who, 'gym', w, d);
    ev(who, 'gym', w, d);
  };

  // неделя 1: много кальяна, мало зала, у Павла один кальян без плана
  [1, 3, 5, 6].forEach((d) => hk(0, 0, d));
  [1, 3, 5].forEach((d) => hk(1, 0, d));
  ev(1, 'hookah', 0, 6);
  ev(1, 'penalty', 1, 0);
  [0, 2].forEach((d) => gym(0, 0, d));
  gym(1, 0, 0);
  both('cowork', 0, 4);
  [2, 4, 6].forEach((d) => ev(0, 'club', 0, d));
  [2, 6].forEach((d) => ev(1, 'club', 0, d));

  ev(1, 'pool', 0, 4); // не в день кальяна: иначе это лишнее нарушение, и пример уходит в долг

  // неделя 2: первая пятерка
  [1, 3, 5].forEach((d) => hk(0, 1, d));
  [1, 5, 6].forEach((d) => hk(1, 1, d));
  [0, 2, 4].forEach((d) => both('gym', 1, d));
  [0, 2, 4].forEach((d) => {
    pl(0, 'gym', 1, d);
    pl(1, 'gym', 1, d);
  });
  both('cowork', 1, 4);
  ev(0, 'club', 1, 6);
  [2, 3].forEach((d) => ev(1, 'club', 1, d));

  // неделя 3: вторая пятерка, после нее ступень падает
  [1, 5].forEach((d) => hk(0, 2, d));
  [3, 5].forEach((d) => hk(1, 2, d));
  [0, 2, 4].forEach((d) => {
    gym(0, 2, d);
    gym(1, 2, d);
  });
  both('cowork', 2, 6);
  ev(0, 'club', 2, 3);

  // неделя 4: лимит 3, Павел сорвался в день тренировки и отработал
  [1, 5].forEach((d) => hk(0, 3, d));
  [1, 5].forEach((d) => hk(1, 3, d));
  [0, 2, 4].forEach((d) => {
    gym(0, 3, d);
    gym(1, 3, d);
  });
  ev(1, 'hookah', 3, 2);
  ev(1, 'penalty', 3, 3);
  both('cowork', 3, 6);
  ev(0, 'club', 3, 6);
  ev(1, 'club', 3, 3);

  // текущая неделя: идет, у Павла висит штраф за кальян без плана
  gym(0, 4, 0);
  gym(1, 4, 0);
  hk(0, 4, 1);
  hk(1, 4, 1);
  gym(0, 4, 2);
  gym(1, 4, 2);
  ev(1, 'hookah', 4, 3);
  gym(0, 4, 4);
  pl(1, 'gym', 4, 4);
  both('cowork', 4, 5);
  ev(1, 'pool', 4, 4);
  pl(0, 'hookah', 4, 5);
  pl(0, 'gym', 4, 6);
  ev(1, 'club', 4, 5);

  return {
    settings: {
      players: [{ name: 'Елисей' }, { name: 'Павел' }],
      start,
      createdDay: addDays(start, -1),
      baseline: 5,
      levelStart: 4,
      clubStart: 3,
      planRule: true,
    },
    events,
    plan,
  };
}
