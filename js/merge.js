// Перенос отметок из другого дневника в этот. Журнал только пополняется, поэтому перенос это объединение:
// добавляем то, чего здесь нет. Чистая функция, проверяется тестом.

const live = (obj) => Object.values(obj || {}).filter((r) => r && !r.del);

/**
 * Записи для store.write: отметки и планы из source, которых нет в target.
 * Отметку того же человека того же вида в тот же день не переносим: это почти наверняка одно и то же событие.
 */
export function mergeWrites(target, source) {
  const writes = [];
  const ids = new Set(Object.keys((target && target.events) || {}));
  const same = new Set(live(target && target.events).map((e) => `${e.who}|${e.kind}|${e.day}`));
  for (const e of live(source && source.events)) {
    const key = `${e.who}|${e.kind}|${e.day}`;
    if (!e.id || ids.has(e.id) || same.has(key)) continue;
    same.add(key);
    writes.push({ path: `events/${e.id}`, value: e });
  }
  const plans = new Set(live(target && target.plan).map((p) => p.id));
  for (const p of live(source && source.plan)) {
    if (!p.id || plans.has(p.id)) continue;
    writes.push({ path: `plan/${p.id}`, value: p });
  }
  return writes;
}
