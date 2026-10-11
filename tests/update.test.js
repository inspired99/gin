// Обновление приложения: список файлов полный, проверка версии не перезагружает лишний раз.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_FILES, checkVersion, hardReload } from '../js/update.js';

test('список файлов для обновления полный и без лишнего', () => {
  const need = [
    'index.html',
    'manifest.webmanifest',
    'config.js',
    ...fs.readdirSync('js').filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...fs.readdirSync('css').filter((f) => f.endsWith('.css')).map((f) => `css/${f}`),
  ];
  for (const f of need) assert.ok(APP_FILES.includes(f), `нет в списке: ${f}`);
  for (const f of APP_FILES) if (f !== './') assert.ok(fs.existsSync(f), `нет файла: ${f}`);
});

/** Подменяет окружение браузера: сеть, хранилища и перезагрузку. */
function fakeBrowser({ version = 'v2', seen = null, online = true, lastReload = 0 } = {}) {
  const calls = { reloads: 0, fetched: [] };
  const storage = (init) => {
    const data = new Map(Object.entries(init));
    return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
  };
  globalThis.localStorage = storage(seen == null ? {} : { 'fixgaz.version': seen });
  globalThis.sessionStorage = storage(lastReload ? { 'fixgaz.reloadedAt': String(lastReload) } : {});
  globalThis.location = { reload: () => (calls.reloads += 1) };
  globalThis.fetch = async (url, opts = {}) => {
    calls.fetched.push([url, opts.cache]);
    if (!online) throw new Error('offline');
    if (url === 'version.json') return { ok: version != null, json: async () => ({ v: version }) };
    return { ok: true };
  };
  return calls;
}

test('новая версия: файлы перечитаны мимо кеша, версия запомнена, страница перезагружена', async () => {
  const calls = fakeBrowser({ version: 'v2', seen: 'v1' });
  assert.equal(await checkVersion({ existing: true }), true);
  assert.equal(calls.reloads, 1);
  assert.equal(localStorage.getItem('fixgaz.version'), 'v2');
  const reread = calls.fetched.filter(([, cache]) => cache === 'reload').map(([url]) => url);
  assert.deepEqual(reread, APP_FILES);
});

test('та же версия, первый заход, открытый лист, недавняя перезагрузка: не трогаем', async () => {
  let calls = fakeBrowser({ version: 'v2', seen: 'v2' });
  assert.equal(await checkVersion({ existing: true }), false);
  assert.equal(calls.reloads, 0);

  calls = fakeBrowser({ version: 'v2', seen: null });
  assert.equal(await checkVersion({ existing: false }), false); // новый человек: файлы и так свежие
  assert.equal(calls.reloads, 0);
  assert.equal(localStorage.getItem('fixgaz.version'), 'v2');

  calls = fakeBrowser({ version: 'v2', seen: 'v1' });
  assert.equal(await checkVersion({ existing: true, canReload: () => false }), false);
  assert.equal(calls.reloads, 0);
  assert.equal(localStorage.getItem('fixgaz.version'), 'v1'); // проверим снова в следующий раз

  calls = fakeBrowser({ version: 'v2', seen: 'v1', lastReload: Date.now() - 5000 });
  assert.equal(await checkVersion({ existing: true }), false);
  assert.equal(calls.reloads, 0);
});

test('давно не заходил и версии еще не знает: один раз обновляемся', async () => {
  const calls = fakeBrowser({ version: 'v2', seen: null });
  assert.equal(await checkVersion({ existing: true }), true);
  assert.equal(calls.reloads, 1);
});

test('без сети и без файла версии не перезагружаемся', async () => {
  let calls = fakeBrowser({ online: false, seen: 'v1' });
  assert.equal(await checkVersion({ existing: true }), false);
  assert.equal(await hardReload(), false); // свайп вниз без сети: страница остается как есть
  assert.equal(calls.reloads, 0);

  calls = fakeBrowser({ version: null, seen: 'v1' }); // у себя на машине файла версии нет
  assert.equal(await checkVersion({ existing: true }), false);
  assert.equal(calls.reloads, 0);
  assert.equal(await hardReload(), true); // а руками обновить можно
  assert.equal(calls.reloads, 1);
});
