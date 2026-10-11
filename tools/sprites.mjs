// Нарезка нарисованных листов на отдельные картинки.
//   node tools/sprites.mjs heroes [assets/src/sheet.png]   персонажи, 4 на 3
//   node tools/sprites.mjs props  [assets/src/props.png]   декор, 4 на 2
// Лист на пурпурном фоне. Скрипт убирает фон, находит границы ячеек по пустым полосам
// и пишет WebP. Нужны ffmpeg и cwebp (без cwebp останется PNG), зависимостей из npm нет.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LAYOUTS = {
  // ряд 1 Елисей, ряд 2 Павел, ряд 3 джинн: общий квадратный холст, подошвы на одной линии
  heroes: {
    src: 'assets/src/sheet.png',
    out: 'assets/sprites',
    fit: 'square',
    names: [
      ['hero-a-idle', 'hero-a-fit', 'hero-a-smoke', 'hero-a-sleep'],
      ['hero-b-idle', 'hero-b-fit', 'hero-b-smoke', 'hero-b-sleep'],
      ['genie-up', 'genie-laugh', 'genie-hurt', 'genie-down'],
    ],
  },
  // декор: каждая картинка обрезана по содержимому; кадры одной анимации делят общий холст
  props: {
    src: 'assets/src/props.png',
    out: 'assets/props',
    fit: 'trim',
    names: [
      ['torch-1', 'torch-2', 'lantern', 'pumpkin'],
      ['leaf-orange', 'leaf-red', 'leaf-yellow', 'candle'],
    ],
    together: [['torch-1', 'torch-2']],
  },
};

const layoutName = LAYOUTS[process.argv[2]] ? process.argv[2] : 'heroes';
const layout = LAYOUTS[layoutName];
const src = (LAYOUTS[process.argv[2]] ? process.argv[3] : process.argv[2]) || layout.src;
const ROWS = layout.names.length;
const COLS = layout.names[0].length;
const PAD = 6; // поле вокруг содержимого (у персонажей: от нижнего края до подошв)

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixgaz-'));
const ff = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);

const [W, H] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src])
  .toString()
  .trim()
  .split(',')
  .map(Number);
const rawPath = path.join(tmp, 'sheet.raw');
ff(['-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgba', rawPath]);
const img = fs.readFileSync(rawPath);

// цвет фона берем из углов
const corner = (x, y) => {
  const i = (y * W + x) * 4;
  return [img[i], img[i + 1], img[i + 2]];
};
const corners = [corner(2, 2), corner(W - 3, 2), corner(2, H - 3), corner(W - 3, H - 3)];
const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, p) => s + p[c], 0) / corners.length));
const bgKey = Math.min(bg[0], bg[2]) - bg[1];

// пурпурность пикселя: 0 у любых цветов спрайта, bgKey у фона, между ними на сглаженной кромке
const LO = 36;
const HI = bgKey * 0.82;
for (let i = 0; i < img.length; i += 4) {
  const key = Math.min(img[i], img[i + 2]) - img[i + 1];
  let a = key <= LO ? 1 : key >= HI ? 0 : 1 - (key - LO) / (HI - LO);
  if (a < 0.08) a = 0;
  if (a > 0 && a < 1) {
    // вычитаем долю фона, чтобы кромка не отдавала пурпурным
    for (let c = 0; c < 3; c++) {
      const v = (img[i + c] - (1 - a) * bg[c]) / a;
      img[i + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  if (a === 0) img[i] = img[i + 1] = img[i + 2] = 0;
  img[i + 3] = Math.round(a * 255);
}

// Границы ячеек ищем по пустым полосам: генератор не обязан держать ровную сетку,
// подошвы верхнего ряда могут зайти за линию между рядами.
const opaque = (x, y) => img[(y * W + x) * 4 + 3] > 96;

function cuts(length, parts, countAt) {
  const out = [0];
  for (let k = 1; k < parts; k++) {
    const ideal = Math.round((length * k) / parts);
    const reach = Math.round(length / parts / 3);
    let best = ideal;
    let bestRun = -1;
    let run = 0;
    for (let i = ideal - reach; i <= ideal + reach; i++) {
      if (countAt(i) === 0) {
        run += 1;
        if (run > bestRun) {
          bestRun = run;
          best = i - Math.floor(run / 2);
        }
      } else run = 0;
    }
    out.push(best);
  }
  out.push(length);
  return out;
}

const rowCount = (y) => {
  let n = 0;
  for (let x = 0; x < W; x++) if (opaque(x, y)) n += 1;
  return n;
};
const ys = cuts(H, ROWS, rowCount);

// рамка содержимого каждой ячейки
const cells = [];
for (let r = 0; r < ROWS; r++) {
  const y0 = ys[r];
  const y1 = ys[r + 1];
  const colCount = (x) => {
    let n = 0;
    for (let y = y0; y < y1; y++) if (opaque(x, y)) n += 1;
    return n;
  };
  const xs = cuts(W, COLS, colCount);
  for (let c = 0; c < COLS; c++) {
    const box = { name: layout.names[r][c], top: y1, bottom: y0, left: xs[c + 1], right: xs[c] };
    for (let y = y0; y < y1; y++) {
      for (let x = xs[c]; x < xs[c + 1]; x++) {
        if (!opaque(x, y)) continue;
        if (y < box.top) box.top = y;
        if (y > box.bottom) box.bottom = y;
        if (x < box.left) box.left = x;
        if (x > box.right) box.right = x;
      }
    }
    box.w = box.right - box.left + 1;
    box.h = box.bottom - box.top + 1;
    cells.push(box);
  }
}

// размер холста и место содержимого на нем
const side = Math.max(Math.ceil(W / COLS), Math.ceil(H / ROWS)) + 16;
for (const box of cells) {
  if (layout.fit === 'square') {
    // общий квадрат: по центру, подошвами к нижнему полю
    box.cw = side;
    box.ch = side;
    box.dx = Math.round((side - box.w) / 2);
    box.dy = side - PAD - box.h;
    continue;
  }
  // по содержимому; кадры одной анимации получают общий холст и общий левый нижний угол
  const group = (layout.together || []).find((g) => g.includes(box.name)) || [box.name];
  const mates = cells.filter((x) => group.includes(x.name));
  box.cw = Math.max(...mates.map((x) => x.w)) + PAD * 2;
  box.ch = Math.max(...mates.map((x) => x.h)) + PAD * 2;
  box.dx = PAD;
  box.dy = box.ch - PAD - box.h;
}

fs.mkdirSync(layout.out, { recursive: true });
let hasCwebp = true;
try {
  execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
} catch {
  hasCwebp = false;
}

for (const box of cells) {
  const out = Buffer.alloc(box.cw * box.ch * 4);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const si = ((box.top + y) * W + box.left + x) * 4;
      const di = ((box.dy + y) * box.cw + box.dx + x) * 4;
      out[di] = img[si];
      out[di + 1] = img[si + 1];
      out[di + 2] = img[si + 2];
      out[di + 3] = img[si + 3];
    }
  }
  const cellRaw = path.join(tmp, `${box.name}.raw`);
  const cellPng = path.join(tmp, `${box.name}.png`);
  fs.writeFileSync(cellRaw, out);
  ff(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${box.cw}x${box.ch}`, '-i', cellRaw, cellPng]);
  if (hasCwebp) {
    execFileSync('cwebp', ['-quiet', '-q', '90', '-alpha_q', '100', '-m', '6', cellPng, '-o', path.join(layout.out, `${box.name}.webp`)]);
  } else {
    fs.copyFileSync(cellPng, path.join(layout.out, `${box.name}.png`));
  }
  console.log(`${box.name}: содержимое ${box.w}x${box.h}, холст ${box.cw}x${box.ch}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${layoutName}: фон ${bg.join(',')}, ${hasCwebp ? 'webp' : 'png'}, готово: ${layout.out}`);
