// Обновление приложения. GitHub Pages разрешает браузеру держать файлы десять минут,
// а приложение с домашнего экрана живет в памяти еще дольше. Поэтому свежую версию
// подтягиваем сами: перечитываем файлы мимо кеша и перезагружаем страницу.

/** Все файлы приложения. Тест следит, что список полный. */
export const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'config.js',
  'css/tokens.css',
  'css/app.css',
  'js/main.js',
  'js/ui.js',
  'js/rules.js',
  'js/model.js',
  'js/copy.js',
  'js/sprites.js',
  'js/store.js',
  'js/sync.js',
  'js/demo.js',
  'js/update.js',
  'js/build.js',
  'js/merge.js',
];

const KEY = 'fixgaz.version'; // версия, под которую последний раз перечитывали файлы
const STAMP = 'fixgaz.reloadedAt';
const PAUSE = 30000; // не перезагружаемся сами чаще, чем раз в полминуты

/** Версия выложенного сайта. Файл пишет workflow при выкладке; у себя на машине его нет. */
async function latest() {
  try {
    const res = await fetch('version.json', { cache: 'no-store' });
    return res.ok ? (await res.json()).v || null : null;
  } catch {
    return null;
  }
}

/**
 * Перечитать файлы мимо кеша и перезагрузить страницу.
 * Без сети ничего не трогает и возвращает false: перезагрузка без сети оставит пустой экран.
 */
export async function hardReload(version, { auto = false } = {}) {
  const v = version === undefined ? await latest() : version;
  const ok = await Promise.all(APP_FILES.map((f) => fetch(f, { cache: 'reload' }).then((r) => r.ok))).then(
    (all) => all.every(Boolean),
    () => false,
  );
  if (!ok) return false;
  try {
    sessionStorage.setItem(STAMP, String(Date.now()));
    if (v) localStorage.setItem(KEY, v);
  } catch {
    if (auto) return false; // без хранилища сами не перезагружаемся: иначе пойдем по кругу
  }
  location.reload();
  return true;
}

/**
 * Проверка при запуске и при возвращении в приложение: вышла новая версия, значит обновляемся.
 * existing: человек уже бывал здесь (у нового файлы только что с сервера, перезагрузка не нужна).
 * canReload: можно ли перезагрузиться прямо сейчас (например, не открыт лист).
 */
export async function checkVersion({ existing = false, canReload = () => true } = {}) {
  const v = await latest();
  if (!v) return false;
  let seen = null;
  let last = 0;
  try {
    seen = localStorage.getItem(KEY);
    last = Number(sessionStorage.getItem(STAMP)) || 0;
  } catch {
    return false;
  }
  if (seen === v) return false;
  if (seen == null && !existing) {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* без хранилища просто не запоминаем */
    }
    return false;
  }
  if (!canReload() || Date.now() - last < PAUSE) return false;
  return hardReload(v, { auto: true });
}
