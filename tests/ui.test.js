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
      assert.match(html, /class="gems/);
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
  const stats = UI.page(model({ screen: 'stats' }));
  assert.equal(stats.split('class="cal"').length - 1, 2); // в итогах оба всегда
  assert.equal(stats.split('data-act="goal-open"').length - 1, 12); // шесть достижений у каждого
});

test('листы: отметить, план, меню, достижение', () => {
  const m = model({});
  const sheets = [
    UI.logSheet(m, { day: TODAY, who: 0 }),
    UI.logSheet(m, { day: addDays(TODAY, -3), who: 'both', qty: 2 }),
    UI.logSheet(model({ me: 1 }), { day: TODAY, who: 1 }), // у Павла долг: есть строка штрафа
    UI.planSheet(m, { day: addDays(TODAY, 2), who: 0 }),
    UI.menuSheet(m),
    UI.goalSheet(m, { id: 'sport' }),
    UI.goalSheet(m, { id: 'goal' }),
  ];
  for (const html of sheets) {
    assert.ok(html.length > 200);
    assert.doesNotMatch(html, /undefined|NaN|\[object Object\]/);
  }
  assert.match(sheets[2], /data-kind="penalty"/);
  // у Павла висит штраф: его карточка красная, сверху полоса «в штрафе»
  const pavel = UI.page(model({ me: 1 }));
  assert.match(pavel, /class="scene is-me is-owing"/);
  assert.match(pavel, /class="owe"[\s\S]*в штрафе: 1 штраф/);
  assert.doesNotMatch(UI.page(model({ me: 0 })), /is-owing/);
  assert.match(sheets[5], /data-name="goalSport"/); // цель меняется в листе достижения
  assert.doesNotMatch(sheets[6], /data-act="num"/); // у конца лестницы числа нет
});

test('отметить за любой день: сетка месяца, будущие дни закрыты', () => {
  const m = model({});
  const closed = UI.logSheet(m, { day: TODAY, who: 0 });
  assert.doesNotMatch(closed, /class="daypick"/);
  assert.match(closed, /data-act="log-pick"[^>]*>другой день</);

  const open = UI.logSheet(m, { day: addDays(TODAY, -5), who: 0, pick: true });
  assert.match(open, /class="daypick"/);
  assert.match(open, /data-act="log-pick"[^>]*>вт, 6 октября</); // выбранный день виден на кнопке
  const dayBtn = (d) => open.match(new RegExp(`<button class="daypick-day[^>]*data-day="${d}"[^>]*>`))[0];
  assert.match(dayBtn('2026-10-01'), /aria-pressed="false"/);
  assert.doesNotMatch(dayBtn('2026-10-01'), /disabled/);
  assert.match(dayBtn('2026-10-06'), /aria-pressed="true"/);
  assert.match(dayBtn('2026-10-12'), /disabled/); // завтра
  assert.doesNotMatch(dayBtn('2026-09-28'), /disabled/); // конец прошлого месяца из первой строки сетки
  assert.doesNotMatch(open, /undefined|NaN|\[object Object\]/);
});

test('кальян в два шага: сначала вид, потом ×1..×6; у записи число правится', () => {
  const day = addDays(TODAY, -5); // вторник, у Елисея кальян
  const html = UI.logSheet(model({}), { day, who: 0 });
  assert.doesNotMatch(html, /data-kind="hookah" data-n=/); // выбор числа еще не раскрыт
  assert.match(html, /data-kind="hookah" data-key="log-hookah" aria-expanded="false"/);
  const open = UI.logSheet(model({}), { day, who: 0, step: 'hookah' });
  assert.equal(open.split('data-kind="hookah" data-n=').length - 1, 6);
  assert.match(open, /aria-expanded="true"/);
  assert.equal(html.split('data-act="set-qty"').length - 1, 6);
  assert.match(html, /data-act="set-qty"[^>]*data-n="6"/);
  assert.ok(html.indexOf('class="logged"') < html.indexOf('class="opts"')); // записанное стоит над вариантами
});

test('игры: режим выбирается при отметке и правится у записи', () => {
  const html = UI.logSheet(model({}), { day: '2026-10-04', who: 0 }); // у Елисея в этот день игры
  assert.doesNotMatch(html, /data-kind="club" data-bad=/); // режим выбирается вторым шагом
  assert.equal(html.split('data-act="set-bad"').length - 1, 2);
  // раскрыли игры: два варианта и подсказка, что «плохо» это нарушение полегче
  const open = UI.logSheet(model({}), { day: TODAY, who: 0, step: 'club' });
  assert.match(open, /data-kind="club" data-bad="0"[^>]*>нормально</);
  assert.match(open, /data-kind="club" data-bad="1"[^>]*>плохо</);
  assert.match(open, /плохо: нарушение: плохой режим[^<]*полштрафа/);
});

test('версия сайта видна внизу главной и в меню, а у себя на машине ее нет', () => {
  const build = { v: 'abc1234', at: '2026-10-15T18:40:00Z' };
  assert.match(UI.page(model({ build })), /class="build">версия от \d\d\.\d\d, \d\d:\d\d</);
  assert.match(UI.menuSheet(model({ build })), /Сейчас стоит версия от/);
  assert.doesNotMatch(UI.page(model({})), /class="build"/);
});

test('друга нет в дневнике: подсказка сверить код; когда он зашел, подсказки нет', () => {
  const settings = { players: [{ name: 'Елисей' }, { name: 'Павел' }], start: '2026-10-12', createdDay: TODAY, joined: { p0: true } };
  const view = { me: 0, kind: 'firebase', status: 'online', room: 'NF8mXTz9YDtztuwsuZcAXZEV' };
  const alone = UI.page(buildModel({ settings }, TODAY, view));
  assert.match(alone, /class="alone"[^]*<b>NF8m<\/b>/);
  assert.match(UI.menuSheet(buildModel({ settings }, TODAY, view)), /Код дневника: <b>NF8m<\/b>/);
  const together = { settings: { ...settings, joined: { p0: true, p1: true } } };
  assert.doesNotMatch(UI.page(buildModel(together, TODAY, view)), /class="alone"/);
  assert.doesNotMatch(UI.page(model({})), /class="alone"/); // в примере не нужна
});

test('общий дневник: без ссылок и кодов, другой дневник на устройстве предлагают перенести', () => {
  const fixed = model({ kind: 'firebase', fixed: true, stray: 'Ab12' });
  const page = UI.page(fixed);
  assert.match(page, /другой дневник, код <b>Ab12<\/b>[^]*data-act="stray-merge"[^]*data-act="stray-skip"/);
  const menu = UI.menuSheet(fixed);
  assert.match(menu, /один на двоих/);
  assert.doesNotMatch(menu, /data-act="leave"/);
  assert.doesNotMatch(UI.welcome({ startDay: '2026-10-12', local: false, fixed: true }), /id="join"/);
});

test('меню: правило плана и обнуление', () => {
  const menu = UI.menuSheet(model({}));
  assert.match(menu, /data-act="flag" data-name="planRule" data-v="1"/);
  assert.match(menu, /data-act="reset"/);
  const after = { ...demoState(TODAY) };
  after.settings = { ...after.settings, resetDay: '2026-10-20' };
  assert.match(UI.menuSheet(buildModel(after, TODAY, { me: 0, kind: 'demo' })), /обнулены 20 октября/);
});

test('первый запуск, выбор персонажа, загрузка', () => {
  const players = [{ name: 'Елисей' }, { name: 'Павел' }];
  assert.match(UI.welcome({ startDay: '2026-10-12', local: true }), /id="create"/);
  assert.match(UI.welcome({ startDay: '2026-10-12', local: false }), /id="join"[\s\S]*name="link"/); // можно вставить ссылку на готовый дневник
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
