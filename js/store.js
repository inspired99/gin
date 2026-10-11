// Состояние дневника: последний снимок с сервера плюс очередь неотправленных записей.
// То, что видит интерфейс, это снимок с наложенной очередью, поэтому запись без сети видна сразу.

import { setPath } from './sync.js';

const clone = (x) => JSON.parse(JSON.stringify(x ?? {}));

const ls = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* хранилище недоступно или переполнено: работаем из памяти */
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* то же */
    }
  },
};

export const prefs = {
  room: () => ls.get('fixgaz:room'),
  setRoom: (room) => (room ? ls.set('fixgaz:room', room) : ls.del('fixgaz:room')),
  /** Вид дневника на этом устройстве: 'week' или 'month'. */
  view: () => ls.get('fixgaz:view'),
  setView: (view) => ls.set('fixgaz:view', view),
};

export function newRoomKey() {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID().replaceAll('-', '').slice(0, 20);
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {{room: string, adapter: object, persist?: boolean}} opts
 */
export function createStore({ room, adapter, persist = true }) {
  const cacheKey = `fixgaz:cache:${room}`;
  const outboxKey = `fixgaz:outbox:${room}`;
  let remote = persist ? ls.get(cacheKey, {}) : {};
  let outbox = persist ? ls.get(outboxKey, []) : [];
  let status = 'connecting';
  let loaded = false;
  let flushing = false;
  let timer = null;
  const subs = new Set();

  const compose = () => {
    const state = clone(remote);
    for (const w of outbox) setPath(state, w.path, w.value);
    return state;
  };
  let state = compose();

  const save = () => {
    if (!persist) return;
    ls.set(cacheKey, remote);
    ls.set(outboxKey, outbox);
  };
  const emit = () => {
    state = compose();
    for (const fn of subs) fn();
  };

  async function flush() {
    if (flushing || !outbox.length) return;
    flushing = true;
    const batch = outbox.slice();
    try {
      await adapter.push(batch);
      for (const w of batch) setPath(remote, w.path, w.value);
      outbox = outbox.slice(batch.length);
      if (status === 'offline') status = adapter.kind === 'firebase' ? 'online' : status;
      save();
      emit();
    } catch {
      if (adapter.kind === 'firebase') status = 'offline';
      emit();
    } finally {
      flushing = false;
      if (outbox.length && !timer) {
        timer = setTimeout(() => {
          timer = null;
          flush();
        }, 15000);
      }
    }
  }

  const store = {
    room,
    kind: adapter.kind,
    get state() {
      return state;
    },
    get status() {
      return status;
    },
    get loaded() {
      return loaded;
    },
    get pending() {
      return outbox.length;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    /** @param {{path: string, value: any}[]} writes */
    write(writes) {
      outbox = outbox.concat(writes);
      save();
      emit();
      flush();
    },
    flush,
    start() {
      adapter.start(
        (snapshot) => {
          remote = snapshot || {};
          loaded = true;
          save();
          emit();
          flush();
        },
        (next) => {
          status = next;
          if (next === 'online' || next === 'local' || next === 'demo') flush();
          emit();
        },
      );
      window.addEventListener('online', flush);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') flush();
      });
    },
    stop() {
      adapter.stop();
      clearTimeout(timer);
    },
  };
  return store;
}
