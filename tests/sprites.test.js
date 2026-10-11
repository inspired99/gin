import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { allGrids, genie, hero, HEROES, icon } from '../js/sprites.js';

test('все сетки прямоугольные и нужного размера', () => {
  for (const g of allGrids()) {
    assert.equal(g.rows.length, g.h, `${g.name}: строк ${g.rows.length}, ждали ${g.h}`);
    g.rows.forEach((row, y) => {
      assert.equal(row.length, g.w, `${g.name}: строка ${y} длиной ${row.length}, ждали ${g.w}`);
      assert.match(row, /^[.A-Z]+$/, `${g.name}: строка ${y}`);
    });
  }
});

test('у каждого героя и у джинна есть файл на каждое состояние', () => {
  const src = (html) => html.match(/src="([^"]+)"/)[1];
  HEROES.forEach((_, who) => {
    for (const state of ['idle', 'fit', 'smoke', 'sleep']) {
      assert.ok(fs.existsSync(src(hero(who, state))), `${who} ${state}`);
    }
  });
  for (const state of ['up', 'laugh', 'hurt', 'down']) assert.ok(fs.existsSync(src(genie(state))), state);
  assert.match(hero(0, 'нет такого'), /hero-a-idle/);
});

test('значок рисуется как svg', () => {
  assert.match(icon('gym'), /^<svg class="px"/);
});
