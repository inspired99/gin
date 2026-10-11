// Дымовой тест разметки: каждый экран и каждый лист отрисовываются на демо-журнале без ошибок.
// Ловит то, что не видит проверка синтаксиса: забытую функцию, опечатку в имени поля.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoState } from '../js/demo.js';
import { buildModel } from '../js/model.js';
import { addDays } from '../js/rules.js';
import * as UI from '../js/ui.js';

const TODAY = '2026-10-11'; // воскресенье
const state = demoState(TODAY);
const model = (view) => buildModel(state, TODAY, { me: 0, kind: 'demo', status: 'demo', ...view });

test('главная: неделя и месяц, один и вдвоем', () => {
  for (const mode of ['week', 'month']) {
    for (const showOther of [false, true]) {
      const html = UI.page(model({ mode, showOther }));
      assert.match(html, /class="scene/);
      assert.match(html, mode === 'week' ? /class="diary"/ : /class="cal"/);
      assert.equal(html.split('class="scene').length - 1, showOther ? 2 : 1);
      assert.doesNotMatch(html, /undefined|NaN|\[object Object\]/);
    }
  }
});

test('главная от лица Павла и на прошлой неделе', () => {
  const html = UI.page(model({ me: 1, viewStart: addDays(TODAY, -13) }));
  assert.match(html, /Павел/);
  assert.doesNotMatch(html, /undefined|NaN|\[object Object\]/);
});

test('итоги и правила', () => {
  for (const screen of ['stats', 'rules']) {
    const html = UI.page(model({ screen }));
    assert.match(html, /data-act="back"/);
    assert.doesNotMatch(html, /undefined|NaN|\[object Object\]/);
  }
  assert.equal(UI.page(model({ screen: 'stats' })).split('class="cal"').length - 1, 2); // в итогах оба всегда
});

test('листы: отметить, план, меню', () => {
  const m = model({});
  const sheets = [
    UI.logSheet(m, { day: TODAY, who: 0 }),
    UI.logSheet(m, { day: addDays(TODAY, -3), who: 'both', qty: 2 }),
    UI.logSheet(model({ me: 1 }), { day: TODAY, who: 1 }), // у Павла долг: есть строка штрафа
    UI.planSheet(m, { day: addDays(TODAY, 2), who: 0 }),
    UI.menuSheet(m),
  ];
  for (const html of sheets) {
    assert.ok(html.length > 200);
    assert.doesNotMatch(html, /undefined|NaN|\[object Object\]/);
  }
  assert.match(sheets[2], /data-kind="penalty"/);
});

test('первый запуск, выбор персонажа, загрузка', () => {
  const players = [{ name: 'Елисей' }, { name: 'Павел' }];
  assert.match(UI.welcome({ startDay: '2026-10-12', local: true }), /id="create"/);
  assert.match(UI.whoAreYou(players), /data-act="i-am"/);
  assert.match(UI.loading('offline'), /Нет сети/);
});

test('дневник до первой недели и пустой дневник', () => {
  const empty = { settings: { players: [{ name: 'А' }, { name: 'Б' }], start: '2026-10-19', createdDay: TODAY } };
  for (const mode of ['week', 'month']) {
    const html = UI.page(buildModel(empty, TODAY, { me: 0, mode }));
    assert.match(html, /class="scene/);
    assert.doesNotMatch(html, /undefined|NaN|\[object Object\]/);
  }
});
