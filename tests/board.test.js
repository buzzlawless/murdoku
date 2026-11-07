// Sanity checks on the transcription of the printed board.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PUZZLE } from '../js/puzzle.js';
import { indexPuzzle, objectCells } from '../js/rules.js';

const grid = indexPuzzle(PUZZLE);

test('room map is 9 rows by 12 columns and uses known rooms', () => {
  assert.equal(PUZZLE.roomMap.length, PUZZLE.rows);
  for (const line of PUZZLE.roomMap) {
    assert.equal(line.length, PUZZLE.cols);
    for (const ch of line) assert.ok(ch === '.' || PUZZLE.rooms[ch], `unknown room ${ch}`);
  }
});

test('hull outline matches the printed grid', () => {
  const widths = PUZZLE.roomMap.map((line) => line.replace(/\.+$/, '').length);
  assert.deepEqual(widths, [8, 10, 11, 12, 12, 12, 11, 10, 8]);
  for (const line of PUZZLE.roomMap) assert.ok(!/\.[^.]/.test(line), 'no gaps inside a row');
});

test('every room is one connected area', () => {
  for (const key of Object.keys(PUZZLE.rooms)) {
    const cells = grid.cells.filter((c) => c.room === key);
    assert.ok(cells.length > 0, `${key} has squares`);
    const seen = new Set();
    const stack = [cells[0]];
    while (stack.length) {
      const cur = stack.pop();
      const id = `${cur.r},${cur.c}`;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = grid.get(cur.r + dr, cur.c + dc);
        if (n && n.room === key) stack.push(n);
      }
    }
    assert.equal(seen.size, cells.length, `${PUZZLE.rooms[key].name} is connected`);
  }
});

test('furniture sits inside the hull, one piece per square, each piece in one room', () => {
  const used = new Set();
  for (const o of PUZZLE.objects) {
    const cells = objectCells(o).map(([r, c]) => grid.get(r, c));
    for (const cell of cells) {
      assert.ok(cell && cell.inside, `${o.type} at ${o.r},${o.c} is inside`);
      const id = `${cell.r},${cell.c}`;
      assert.ok(!used.has(id), `square ${id} has only one piece`);
      used.add(id);
    }
    assert.equal(new Set(cells.map((c) => c.room)).size, 1, `${o.type} at ${o.r},${o.c} stays in one room`);
  }
});

test('furniture counts match the page', () => {
  const count = (type) => PUZZLE.objects.filter((o) => o.type === type).length;
  assert.equal(count('chair'), 17);
  assert.equal(count('plant'), 3);
  assert.equal(count('shelf'), 3);
  assert.equal(count('tv'), 2);
  assert.equal(count('bed'), 3);
  assert.equal(count('carpet'), 2);
  assert.equal(count('crate'), 2);
});

test('every person has a clue and every clue refers to real people and rooms', () => {
  const ids = new Set(PUZZLE.people.map((p) => p.id));
  for (const p of PUZZLE.people) {
    assert.ok(PUZZLE.clues.some((c) => c.person === p.id), `${p.name} has a clue`);
  }
  for (const clue of PUZZLE.clues) {
    for (const ch of clue.checks) {
      if (ch.person) assert.ok(ids.has(ch.person));
      if (ch.of) assert.ok(ids.has(ch.of));
      if (ch.room) assert.ok(PUZZLE.rooms[ch.room]);
    }
  }
  assert.equal(PUZZLE.people.filter((p) => p.victim).length, 1);
});
