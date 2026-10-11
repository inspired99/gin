// Пиксельная графика fixgaz. Значки и наклейки заданы сетками строк
// (символ задает цвет) и рисуются в SVG: один path на цвет, масштаб без размытия.

const INK = '#171717';
const PAPER = '#fdfbf9';

const BASE = {
  K: INK,
  W: PAPER,
  P: '#2b1a07',
  G: '#d6d4d3', // дым
  D: '#8a8887', // кромка дыма
  O: '#ff6f1e',
  B: '#3b82f6',
  R: '#ff66cf',
  N: '#22c55e',
  Y: '#f5c542',
};

// Герои и джинн нарисованы владельцем: assets/src/sheet.png, нарезка tools/sprites.mjs.
// Индекс героя совпадает с индексом игрока: 0 это Елисей, 1 это Павел.
export const HEROES = ['hero-a', 'hero-b'];
const HERO_STATES = ['idle', 'fit', 'smoke', 'sleep'];
const GENIE_STATES = ['up', 'laugh', 'hurt', 'down'];

// --- значки отметок 12x12 --------------------------------------------------

const ICONS = {
  gym: [
    '............',
    '............',
    '.KK......KK.',
    'KNNK....KNNK',
    'KNNK....KNNK',
    'KNNKKKKKKNNK',
    'KNNKKKKKKNNK',
    'KNNK....KNNK',
    'KNNK....KNNK',
    '.KK......KK.',
    '............',
    '............',
  ],
  pool: [
    '............',
    '.......KK...',
    '......KWWK..',
    '..KKKK.KK...',
    '.K....KK....',
    '............',
    '.BB..BB..BB.',
    'BBBBBBBBBBBB',
    'B..BB..BB..B',
    '.BB..BB..BB.',
    'BBBBBBBBBBBB',
    '............',
  ],
  cowork: [
    '............',
    '..KKKKKKKK..',
    '..KBBBBBBK..',
    '..KBBBBBBK..',
    '..KBBBBBBK..',
    '..KBBBBBBK..',
    '..KKKKKKKK..',
    '.KWWWWWWWWK.',
    'KWKWKWKWKWWK',
    'KKKKKKKKKKKK',
    '............',
    '............',
  ],
  hookah: [
    '...DD.......',
    '..DGGD..DD..',
    '..DGGGDDGGD.',
    '...DGGGGGD..',
    '....DDGGD...',
    '.....KOOK...',
    '......KK....',
    '......KK..K.',
    '.....KKKK.K.',
    '....KBBBBKK.',
    '....KBBBBK..',
    '...KKKKKKKK.',
  ],
  club: [
    '............',
    '............',
    '..KKKKKKKK..',
    '.KWWWWWWWWK.',
    'KWWKWWWWRWWK',
    'KWKKKWWRWRWK',
    'KWWKWWWWRWWK',
    'KWWWKKKKWWWK',
    'KWWK....KWWK',
    '.KK......KK.',
    '............',
    '............',
  ],
  penalty: [
    '............',
    '............',
    '....KKK.....',
    '...KWWWK....',
    '...KWWWK....',
    '...KWWWWKK..',
    '..KWWWOWWWK.',
    '.KWWWOWOWWWK',
    'KWWWWWWWWWWK',
    'KKKKKKKKKKKK',
    '.K.K.K.K.K..',
    '............',
  ],
};

// значки разделов в шапке, та же сетка 12x12
const NAV = {
  stats: [
    '............',
    '.........KK.',
    '.........KK.',
    '.....KK..KK.',
    '.....KK..KK.',
    '.KK..KK..KK.',
    '.KK..KK..KK.',
    '.KK..KK..KK.',
    '.KK..KK..KK.',
    'KKKKKKKKKKKK',
    '............',
    '............',
  ],
  rules: [
    '............',
    '..KKKKKKKK..',
    '..KOKWWWWK..',
    '..KOKWKKWK..',
    '..KOKWWWWK..',
    '..KOKWKKWK..',
    '..KOKWWWWK..',
    '..KOKWKKWK..',
    '..KOKWWWWK..',
    '..KKKKKKKK..',
    '............',
    '............',
  ],
  menu: [
    '............',
    '............',
    '.KKKKKKKKKK.',
    '.KKKKKKKKKK.',
    '............',
    '.KKKKKKKKKK.',
    '.KKKKKKKKKK.',
    '............',
    '.KKKKKKKKKK.',
    '.KKKKKKKKKK.',
    '............',
    '............',
  ],
};

// --- наклейки 16x16 ---------------------------------------------------------

const STICKERS = {
  first5: [
    '....KKKKKKKK....',
    '...KYYYYYYYYK...',
    '..KYYYYYYYYYYK..',
    '.KYYYKKKKKKYYYK.',
    '.KYYYKYYYYYYYYK.',
    '.KYYYKYYYYYYYYK.',
    '.KYYYKKKKKYYYYK.',
    '.KYYYYYYYYKYYYK.',
    '.KYYYYYYYYKYYYK.',
    '.KYYYKYYYYKYYYK.',
    '.KYYYYKKKKYYYYK.',
    '..KYYYYYYYYYYK..',
    '...KYYYYYYYYK...',
    '....KKKKKKKK....',
    '...KOK....KOK...',
    '...KK......KK...',
  ],
  rung3: stairs('B'),
  rung2: stairs('N'),
  rung1: stairs('R'),
  goal: [
    '................',
    '..KKKKKKKKKKKK..',
    '.KKOOOOOOOOOOKK.',
    'K.KOOOOOOOOOOK.K',
    'K.KOOOOOOOOOOK.K',
    'K.KOOOOOOOOOOK.K',
    '.KKOOOOOOOOOOKK.',
    '...KOOOOOOOOK...',
    '....KOOOOOOK....',
    '.....KKOOKK.....',
    '.......KK.......',
    '.......KK.......',
    '.....KKKKKK.....',
    '....KOOOOOOK....',
    '....KKKKKKKK....',
    '................',
  ],
  clean7: [
    '................',
    '..........KKKK..',
    '........KKNNNK..',
    '......KKNNNNNK..',
    '.....KNNNNKNNK..',
    '....KNNNNKNNNK..',
    '...KNNNNKNNNK...',
    '...KNNNKNNNNK...',
    '..KNNNKNNNNK....',
    '..KNNKNNNNK.....',
    '..KNKNNNKK......',
    '..KKNNKK........',
    '.KKKKK..........',
    '.KK.............',
    'KK..............',
    '................',
  ],
  gym10: [
    '................',
    '................',
    '..KK........KK..',
    '.KOOK......KOOK.',
    'KOOOK......KOOOK',
    'KOOOK......KOOOK',
    'KOOOKKKKKKKKOOOK',
    'KOOOKWWWWWWKOOOK',
    'KOOOKKKKKKKKOOOK',
    'KOOOK......KOOOK',
    'KOOOK......KOOOK',
    '.KOOK......KOOK.',
    '..KK........KK..',
    '................',
    '................',
    '................',
  ],
};

function stairs(fill) {
  return [
    '................',
    '................',
    '..........KKKKK.',
    '..........KFFFK.',
    '..........KFFFK.',
    '......KKKKKFFFK.',
    '......KFFFFFFFK.',
    '......KFFFFFFFK.',
    '..KKKKKFFFFFFFK.',
    '..KFFFFFFFFFFFK.',
    '..KFFFFFFFFFFFK.',
    '..KFFFFFFFFFFFK.',
    '..KKKKKKKKKKKKK.',
    '................',
    '................',
    '................',
  ].map((r) => r.replaceAll('F', fill));
}

// --- отрисовка ---------------------------------------------------------------

function paths(rows, palette) {
  const byColor = new Map();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x += 1;
        continue;
      }
      let run = 1;
      while (row[x + run] === ch) run += 1;
      const d = `M${x} ${y}h${run}v1h-${run}z`;
      byColor.set(ch, (byColor.get(ch) || '') + d);
      x += run;
    }
  });
  let out = '';
  for (const [ch, d] of byColor) out += `<path fill="${palette[ch] || INK}" d="${d}"/>`;
  return out;
}

/**
 * @param {string[][]} frames один или два кадра
 * @param {object} palette символ -> цвет
 * @param {{scale?: number, cls?: string, label?: string}} opts
 */
function render(frames, palette, { scale = 4, cls = '', label = '' } = {}) {
  const h = frames[0].length;
  const w = frames[0][0].length;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  const body =
    frames.length > 1
      ? frames.map((f, i) => `<g class="px-f px-f${i + 1}">${paths(f, palette)}</g>`).join('')
      : paths(frames[0], palette);
  const anim = frames.length > 1 ? ' px-anim' : '';
  return `<svg class="px${anim}${cls ? ` ${cls}` : ''}" ${a11y} viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${body}</svg>`;
}

function picture(name, { size = 72, cls = '', label = '' } = {}) {
  const alt = label ? `alt="${label}"` : 'alt=""';
  return `<img class="pic${cls ? ` ${cls}` : ''}" src="assets/sprites/${name}.webp" width="${size}" height="${size}" ${alt} decoding="async" draggable="false">`;
}

/** state: idle, fit, smoke, sleep */
export function hero(who, state = 'idle', opts = {}) {
  const st = HERO_STATES.includes(state) ? state : 'idle';
  return picture(`${HEROES[who] || HEROES[0]}-${st}`, opts);
}

/** state: up (жив), laugh (подлечился на нарушении), hurt (осталось мало), down (побежден) */
export function genie(state = 'up', opts = {}) {
  const st = GENIE_STATES.includes(state) ? state : 'up';
  return picture(`genie-${st}`, opts);
}

// Декор замка нарисован владельцем: assets/src/props.png, нарезка tools/sprites.mjs props.
const PROPS = {
  'torch-1': [217, 399],
  'torch-2': [217, 399],
  lantern: [220, 440],
  pumpkin: [244, 237],
  'leaf-orange': [306, 331],
  'leaf-red': [305, 331],
  'leaf-yellow': [264, 311],
  candle: [268, 372],
};

/** Картинка декора заданной высоты. Декор только украшает, поэтому всегда без подписи. */
export function prop(name, height, cls = '') {
  const [w, h] = PROPS[name];
  const width = Math.round((height * w) / h);
  return `<img class="prop${cls ? ` ${cls}` : ''}" src="assets/props/${name}.webp" width="${width}" height="${height}" alt="" decoding="async" draggable="false">`;
}

/** Факел с пламенем в два кадра. */
export function torch(height, cls = '') {
  return `<span class="torch${cls ? ` ${cls}` : ''}" aria-hidden="true">${prop('torch-1', height)}${prop('torch-2', height, 'torch-b')}</span>`;
}

export function icon(kind, opts = {}) {
  return render([ICONS[kind]], BASE, { scale: 2, ...opts });
}

export function navIcon(name, opts = {}) {
  return render([NAV[name]], BASE, { scale: 2, ...opts });
}

export function sticker(id, opts = {}) {
  return render([STICKERS[id]], BASE, { scale: 3, ...opts });
}

/** Для тестов: все сетки с их ожидаемой шириной. */
export function allGrids() {
  const out = [];
  for (const [k, rows] of Object.entries(ICONS)) out.push({ name: `icon ${k}`, rows, w: 12, h: 12 });
  for (const [k, rows] of Object.entries(NAV)) out.push({ name: `nav ${k}`, rows, w: 12, h: 12 });
  for (const [k, rows] of Object.entries(STICKERS)) out.push({ name: `sticker ${k}`, rows, w: 16, h: 16 });
  return out;
}
