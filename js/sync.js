// Синхронизация. Два адаптера с одним интерфейсом:
//   local    общий «сервер» в localStorage, вкладки одного браузера видят друг друга
//   firebase Realtime Database по REST: запись через PATCH, живые обновления через EventSource

/** Записывает value по пути 'a/b/c'. null удаляет ключ. Меняет объект на месте. */
export function setPath(obj, path, value) {
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return value == null ? {} : value;
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (node[key] == null || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  const last = parts[parts.length - 1];
  if (value == null) delete node[last];
  else node[last] = value;
  return obj;
}

const clone = (x) => JSON.parse(JSON.stringify(x ?? {}));

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {};
  } catch {
    return {};
  }
}

export function localAdapter(room) {
  const key = `fixgaz:remote:${room}`;
  let onSnap = () => {};
  const onStorage = (e) => {
    if (e.key === key) onSnap(readJSON(key));
  };
  return {
    kind: 'local',
    start(onSnapshot, onStatus) {
      onSnap = onSnapshot;
      window.addEventListener('storage', onStorage);
      onSnapshot(readJSON(key));
      onStatus('local');
    },
    async push(writes) {
      const data = readJSON(key);
      for (const w of writes) setPath(data, w.path, w.value);
      localStorage.setItem(key, JSON.stringify(data));
    },
    stop() {
      window.removeEventListener('storage', onStorage);
    },
  };
}

/** Журнал только в памяти: для режима ?demo. */
export function memoryAdapter(seed) {
  let data = clone(seed);
  return {
    kind: 'demo',
    start(onSnapshot, onStatus) {
      onSnapshot(clone(data));
      onStatus('demo');
    },
    async push(writes) {
      for (const w of writes) data = setPath(data, w.path, w.value);
    },
    stop() {},
  };
}

export function firebaseAdapter(room, dbUrl) {
  const base = `${dbUrl.replace(/\/+$/, '')}/rooms/${encodeURIComponent(room)}`;
  let snap = {};
  let es = null;
  let onSnap = () => {};
  let onStat = () => {};
  let stopped = false;

  const apply = (path, data) => {
    snap = path === '/' ? (data ?? {}) : setPath(snap, path, data);
  };

  function open() {
    if (stopped) return;
    if (es) es.close();
    es = new EventSource(`${base}.json`);
    es.addEventListener('put', (e) => {
      const { path, data } = JSON.parse(e.data);
      apply(path, data);
      onSnap(clone(snap));
      onStat('online');
    });
    es.addEventListener('patch', (e) => {
      const { path, data } = JSON.parse(e.data);
      const prefix = path === '/' ? '' : path;
      for (const [k, v] of Object.entries(data || {})) apply(`${prefix}/${k}`, v);
      onSnap(clone(snap));
      onStat('online');
    });
    es.addEventListener('cancel', () => onStat('denied'));
    es.addEventListener('auth_revoked', () => onStat('denied'));
    es.onerror = () => onStat('offline'); // EventSource переподключается сам
  }

  // телефон уснул или сменил сеть: соединение могло тихо умереть, не закрывшись. Переоткрываем всегда,
  // первым событием сервер пришлет весь дневник заново
  const onVisible = () => {
    if (document.visibilityState === 'visible') open();
  };

  return {
    kind: 'firebase',
    start(onSnapshot, onStatus) {
      onSnap = onSnapshot;
      onStat = onStatus;
      onStatus('connecting');
      open();
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', open);
    },
    async push(writes) {
      const body = {};
      for (const w of writes) body[w.path] = w.value;
      const res = await fetch(`${base}.json`, { method: 'PATCH', body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`firebase ${res.status}`);
    },
    stop() {
      stopped = true;
      if (es) es.close();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', open);
    },
  };
}
