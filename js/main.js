// Запуск fixgaz: выбор хранилища, модель для интерфейса, обработка действий.

import { DB_URL } from '../config.js';
import * as R from './rules.js';
import * as C from './copy.js';
import * as UI from './ui.js';
import { demoState } from './demo.js';
import { buildModel, playersOf } from './model.js';
import { createStore, newId, newRoomKey, prefs } from './store.js';
import { firebaseAdapter, localAdapter, memoryAdapter } from './sync.js';

const app = document.getElementById('app');
const sheet = document.getElementById('sheet');
const sheetBody = document.getElementById('sheet-body');
const toastEl = document.getElementById('toast');
const shoutEl = document.getElementById('shout');

const params = new URLSearchParams(location.search);
const isDemo = params.has('demo');

let store = null;
let me = null; // персонаж выбирается при каждом заходе и нигде не запоминается
let screen = 'home'; // home | stats | rules
let homeScroll = 0;
let showOther = false; // на главной по умолчанию только свой персонаж
let viewStart = null;
let mode = prefs.view() === 'month' ? 'month' : 'week'; // вид дневника на главной
let month = null; // месяц календаря на экране итогов, 'YYYY-MM'
let sheetState = null;
let undo = null;
let toastTimer = null;

const roomFromHash = () => (location.hash.match(/room=([A-Za-z0-9]+)/) || [])[1] || null;
const link = () => `${location.origin}${location.pathname}#room=${store.room}`;

function defaultStart(today) {
  return R.dow(today) === 0 ? today : R.addDays(R.weekOf(today), 7);
}

// --- модель ------------------------------------------------------------------

function model() {
  const view = { me, showOther, viewStart, month, mode, screen, status: store.status, pending: store.pending, kind: store.kind };
  const built = buildModel(store.state, R.localDay(), view);
  // границы недели и месяца приводит модель, запоминаем приведенные значения
  viewStart = built.viewStart;
  month = built.month;
  return built;
}

// --- отрисовка ---------------------------------------------------------------

function keepFocus(fn) {
  const active = document.activeElement;
  const key = active && active.dataset ? active.dataset.key : null;
  fn();
  if (key) {
    const el = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (el) el.focus({ preventScroll: true });
  }
}

function renderWelcome(opts = {}) {
  if (app.querySelector('#create')) return;
  app.innerHTML = UI.welcome({ startDay: defaultStart(R.localDay()), local: !DB_URL, ...opts });
}

function renderSheet(m) {
  if (!sheetState) return;
  const active = document.activeElement;
  if (active && active.tagName === 'INPUT' && sheetBody.contains(active)) return; // не сбиваем ввод
  const top = sheetBody.scrollTop;
  if (sheetState.type === 'log') sheetBody.innerHTML = UI.logSheet(m, sheetState);
  else if (sheetState.type === 'plan') sheetBody.innerHTML = UI.planSheet(m, sheetState);
  else if (sheetState.type === 'goal') sheetBody.innerHTML = UI.goalSheet(m, sheetState);
  else sheetBody.innerHTML = UI.menuSheet(m);
  sheetBody.scrollTop = top;
}

function render() {
  if (!store) return renderWelcome();
  const state = store.state;
  if (!state.settings || !state.settings.players || !state.settings.start) {
    if (!store.loaded) {
      app.innerHTML = UI.loading(store.status);
      return;
    }
    return renderWelcome({ missing: true });
  }
  if (me == null) {
    if (sheet.open) sheet.close();
    const weeks = R.timeline(state, R.localDay());
    app.innerHTML = UI.whoAreYou(playersOf(state), { demo: isDemo, levels: [0, 1].map((who) => R.level(weeks, who)) });
    return;
  }
  const m = model();
  keepFocus(() => {
    app.innerHTML = UI.page(m);
    renderSheet(m);
  });
}

function openSheet(state) {
  sheetState = state;
  sheetBody.scrollTop = 0;
  renderSheet(model());
  if (!sheet.open) sheet.showModal();
}

function closeSheet() {
  if (sheet.open) sheet.close();
}

function toast(text, undoFn = null) {
  undo = undoFn;
  toastEl.innerHTML = `<span>${C.esc(text)}</span>${undoFn ? '<button class="link" type="button" data-act="undo">отменить</button>' : ''}`;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
    undo = null;
  }, 6000);
}

/** Возглас по центру экрана, как в старых играх: появляется рывками, мигает и уходит вверх. */
let shoutTimer = null;
function shout(code) {
  const item = C.SHOUT[code];
  if (!item) return;
  shoutEl.textContent = item.say[Math.floor(Math.random() * item.say.length)];
  shoutEl.dataset.tone = item.tone;
  shoutEl.hidden = true;
  void shoutEl.offsetWidth; // перезапуск анимации, если возглас еще на экране
  shoutEl.hidden = false;
  clearTimeout(shoutTimer);
  shoutTimer = setTimeout(() => {
    shoutEl.hidden = true;
  }, 2200);
}

// --- действия ----------------------------------------------------------------

function logEvents(kind, day, targets, n = 1) {
  const m = model();
  const fouls = targets.some((who) => R.preview(m.state, m.today, { who, kind, day, n }).foul);
  // возглас считаем до записи и про того, кто отмечает (или про первого из отмеченных)
  const cry = R.shoutFor(m.state, m.today, { who: targets.includes(me) ? me : targets[0], kind, day, n });
  const now = Date.now();
  const ids = [];
  const writes = targets.map((who, i) => {
    const id = newId();
    ids.push(id);
    return { path: `events/${id}`, value: { id, who, kind, day, at: now + i, ...(n > 1 ? { n } : {}) } };
  });
  store.write(writes);
  const text = `${C.KIND[kind].done}${n > 1 ? ` ×${n}` : ''}${targets.length > 1 ? ' обоим' : ''}${fouls ? ': нарушение' : ''}`;
  toast(text, () => store.write(ids.map((id) => ({ path: `events/${id}/del`, value: true }))));
  shout(cry);
}

function togglePlan(kind, day, who) {
  const m = model();
  const id = `${day}_${who}_${kind}`;
  const existing = m.state.plan && m.state.plan[id];
  if (existing && !existing.del) {
    store.write([{ path: `plan/${id}`, value: { ...existing, del: true, delOn: m.today } }]);
    return;
  }
  const block = R.planBlock(m.state, m.weeks, { who, kind, day });
  if (block) {
    const wk = m.weeks.find((w) => day >= w.start && day <= w.end);
    const why = {
      gymday: 'На этот день стоит спорт, кальян на него не ставится.',
      hookahday: 'На этот день стоит кальян. Сначала убери его из плана.',
      limit: `Лимит уже расписан: ${wk ? C.hookahLimitText(wk.level[who]) : ''}.`,
    }[block];
    toast(why);
    return;
  }
  store.write([{ path: `plan/${id}`, value: { id, who, kind, day, madeOn: m.today, at: Date.now() } }]);
}

function createDiary(form) {
  const data = new FormData(form);
  const names = [String(data.get('n0') || '').trim(), String(data.get('n1') || '').trim()];
  const baseline = Number(data.get('baseline'));
  const error = form.querySelector('.form-error');
  let problem = '';
  if (!names[0] || !names[1]) problem = 'Нужны оба имени.';
  else if (!Number.isInteger(baseline) || baseline < 1 || baseline > 21) problem = 'Число кальянов в неделю: от 1 до 21.';
  if (problem) {
    error.textContent = problem;
    error.hidden = false;
    return;
  }
  const today = R.localDay();
  const level = Math.min(R.MAX_LEVEL, Math.max(1, baseline - 1)); // на один кальян меньше, чем сейчас
  const room = newRoomKey();
  if (store) store.stop();
  store = createStore({ room, adapter: DB_URL ? firebaseAdapter(room, DB_URL) : localAdapter(room) });
  prefs.setRoom(room);
  history.replaceState(null, '', `#room=${room}`);
  store.subscribe(render);
  store.start();
  store.write([
    {
      path: 'settings',
      value: {
        v: 1,
        players: [{ name: names[0] }, { name: names[1] }],
        start: defaultStart(today),
        createdDay: today,
        baseline,
        levelStart: { p0: level, p1: level },
        clubStart: { p0: R.DEFAULTS.clubStart, p1: R.DEFAULTS.clubStart },
        hpMax: R.DEFAULTS.hpMax,
        hitGym: R.DEFAULTS.hitGym,
        hitCowork: R.DEFAULTS.hitCowork,
        foulHeal: R.DEFAULTS.foulHeal,
        penaltyDays: R.DEFAULTS.penaltyDays,
      },
    },
  ]);
  app.innerHTML = '';
  render();
}

const actions = {
  'log-open'(el) {
    const m = model();
    openSheet({ type: 'log', day: el.dataset.day || m.today, who: el.dataset.who != null ? Number(el.dataset.who) : me });
  },
  'log-day'(el) {
    const picked = sheetState.pick;
    sheetState.day = el.dataset.day;
    sheetState.pick = false; // день выбран, сетка сворачивается, чтобы сразу были видны отметки
    keepFocus(() => renderSheet(model()));
    if (picked) sheetBody.querySelector('[data-key="log-pick"]')?.focus({ preventScroll: true });
  },
  'log-pick'() {
    sheetState.pick = !sheetState.pick;
    keepFocus(() => renderSheet(model()));
  },
  'log-who'(el) {
    sheetState.who = el.dataset.who === 'both' ? 'both' : Number(el.dataset.who);
    keepFocus(() => renderSheet(model()));
  },
  'log-qty'(el) {
    sheetState.qty = Number(el.dataset.n);
    keepFocus(() => renderSheet(model()));
  },
  log(el) {
    const { day, who, qty } = sheetState;
    const kind = el.dataset.kind;
    let targets = who === 'both' ? [0, 1] : [who];
    // штраф отмечается только тому, за кем он числится
    if (kind === 'penalty') targets = targets.filter((w) => model().debts[w].n > 0);
    closeSheet();
    if (targets.length) logEvents(kind, day, targets, kind === 'hookah' ? qty || 1 : 1);
  },
  /** Поправить число кальянов в уже сделанной записи. Лист остается открытым: видно, что получилось. */
  'set-qty'(el) {
    const id = el.dataset.id;
    const ev = (store.state.events || {})[id];
    if (!ev) return;
    const was = R.qty(ev);
    const n = Number(el.dataset.n);
    if (n === was) return;
    const m = model();
    const write = (v) => store.write([{ path: `events/${id}/n`, value: v > 1 ? v : null }]);
    write(n);
    toast(`кальян ×${n}`, () => write(was));
    // стало больше, и за день вышло три и больше: тот же возглас, что при отметке
    const dayTotal = m.events.filter((e) => e.kind === 'hookah' && e.who === ev.who && e.day === ev.day).reduce((sum, e) => sum + R.qty(e), 0) - was + n;
    if (n > was && dayTotal > 2) shout('danger');
  },
  unlog(el) {
    const id = el.dataset.id;
    store.write([{ path: `events/${id}/del`, value: true }]);
    closeSheet();
    toast('запись убрана', () => store.write([{ path: `events/${id}/del`, value: null }]));
  },
  'plan-open'(el) {
    openSheet({ type: 'plan', day: el.dataset.day, who: Number(el.dataset.who) });
  },
  plan(el) {
    togglePlan(el.dataset.kind, el.dataset.day, Number(el.dataset.who));
  },
  'toggle-other'() {
    showOther = !showOther;
    render();
  },
  'diary-mode'(el) {
    mode = el.dataset.mode === 'month' ? 'month' : 'week';
    prefs.setView(mode);
    render();
  },
  'week-prev'() {
    viewStart = R.addDays(viewStart, -7);
    render();
  },
  'week-next'() {
    viewStart = R.addDays(viewStart, 7);
    render();
    document.getElementById('week-title').scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
  month(el) {
    month = R.addMonths(month, Number(el.dataset.d));
    render();
  },
  menu() {
    openSheet({ type: 'menu' });
  },
  'goal-open'(el) {
    openSheet({ type: 'goal', id: el.dataset.id });
  },
  close: closeSheet,
  switch() {
    closeSheet();
    me = null;
    screen = 'home';
    showOther = false;
    viewStart = null;
    render();
    window.scrollTo(0, 0);
  },
  'i-am'(el) {
    me = Number(el.dataset.who);
    render();
    window.scrollTo(0, 0);
  },
  async 'copy-link'() {
    try {
      await navigator.clipboard.writeText(link());
      closeSheet();
      toast('ссылка скопирована');
    } catch {
      closeSheet();
      toast('Скопировать не вышло. Ссылка целиком стоит в адресной строке.');
    }
  },
  /** Числа из настроек: общие пишутся как есть, лимиты на человека и с нужной недели. */
  num(el) {
    const m = model();
    const name = el.dataset.name;
    const d = Number(el.dataset.d);
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const common = {
      hpMax: [1, 40],
      hitGym: [0, 10],
      hitCowork: [0, 10],
      foulHeal: [0, 10],
      penaltyDays: [1, 14],
      needSport: [0, 14],
      needCowork: [0, 7],
      lvlWeeks: [1, 8],
      lvlGems: [1, 3],
    };
    for (const key of Object.values(R.GOAL_KEYS)) common[key] = [1, R.GOAL_MAX];
    if (common[name]) {
      const [lo, hi] = common[name];
      store.write([{ path: `settings/${name}`, value: clamp(m.s[name] + d, lo, hi) }]);
      return;
    }
    const who = Number(el.dataset.who);
    const week = m.limitWeek.start;
    if (name === 'level') {
      store.write([{ path: `settings/limitSet/${week}/p${who}/level`, value: clamp(m.limitWeek.level[who] + d, 0, R.MAX_LEVEL) }]);
    }
    if (name === 'club') {
      store.write([{ path: `settings/limitSet/${week}/p${who}/club`, value: clamp(m.limitWeek.clubLimit[who] + d, 0, R.MAX_CLUB) }]);
    }
  },
  go(el) {
    if (screen === 'home') homeScroll = window.scrollY;
    screen = el.dataset.view;
    history.pushState({ screen }, '');
    render();
    window.scrollTo(0, 0);
  },
  back() {
    if (history.state && history.state.screen) history.back();
    else showHome();
  },
  export() {
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fixgaz-${R.localDay()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  leave() {
    const ok = window.confirm(
      'Ссылка на дневник пропадет с этого устройства. Вернуться можно будет только по ссылке. Забыть дневник?',
    );
    if (!ok) return;
    prefs.setRoom(null);
    location.href = location.pathname;
  },
  undo() {
    if (undo) undo();
    undo = null;
    toastEl.hidden = true;
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-set]');
  if (!el || !store) return;
  const value = el.value.trim();
  if (!value) {
    render();
    return;
  }
  if (el.dataset.set === 'name') store.write([{ path: `settings/players/${el.dataset.who}/name`, value }]);
  if (el.dataset.set === 'start' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const settings = store.state.settings || {};
    const next = R.weekOf(value);
    const writes = [{ path: 'settings/start', value: next }];
    // лимиты, заданные «с первой недели», переезжают вместе с ней, если она стала раньше
    const moved = settings.limitSet && settings.limitSet[settings.start];
    if (moved && next < settings.start && !settings.limitSet[next]) {
      writes.push({ path: `settings/limitSet/${next}`, value: moved }, { path: `settings/limitSet/${settings.start}`, value: null });
    }
    viewStart = null;
    month = null;
    store.write(writes);
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'create') return;
  e.preventDefault();
  createDiary(e.target);
});

function showHome() {
  screen = 'home';
  render();
  window.scrollTo(0, homeScroll);
}

// системная кнопка «назад» возвращает с экрана итогов или правил на главную
window.addEventListener('popstate', (e) => {
  if (sheet.open) sheet.close();
  if (e.state && e.state.screen) {
    screen = e.state.screen;
    render();
    window.scrollTo(0, 0);
  } else showHome();
});

sheet.addEventListener('click', (e) => {
  if (e.target === sheet) closeSheet(); // касание по затемнению
});
sheet.addEventListener('close', () => {
  sheetState = null;
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store) render(); // мог смениться день
});

// --- запуск ------------------------------------------------------------------

function boot() {
  if (isDemo) {
    store = createStore({ room: 'demo', adapter: memoryAdapter(demoState(R.localDay())), persist: false });
    const who = params.get('me');
    if (who === '0' || who === '1') me = Number(who);
    // в примере можно открыть нужный экран ссылкой: ?demo&me=0&open=stats|rules|log|plan|menu|goal, &other показывает друга, &view=month включает месяц
    const open = params.get('open');
    if (open === 'stats' || open === 'rules') screen = open;
    if (open === 'goal') screen = 'stats';
    if (params.has('other')) showOther = true;
    if (['week', 'month'].includes(params.get('view'))) mode = params.get('view');
    if (me != null && ['log', 'menu', 'plan', 'goal'].includes(open)) {
      const day = R.localDay();
      const state = { log: { type: 'log', day, who: me }, plan: { type: 'plan', day: R.addDays(day, 1), who: me }, menu: { type: 'menu' }, goal: { type: 'goal', id: 'sport' } }[open];
      queueMicrotask(() => openSheet(state));
    }
  } else {
    const room = roomFromHash() || prefs.room();
    if (!room) {
      renderWelcome();
      return;
    }
    prefs.setRoom(room);
    if (!roomFromHash()) history.replaceState(null, '', `#room=${room}`);
    store = createStore({ room, adapter: DB_URL ? firebaseAdapter(room, DB_URL) : localAdapter(room) });
  }
  store.subscribe(render);
  store.start();
  render();
}

boot();
