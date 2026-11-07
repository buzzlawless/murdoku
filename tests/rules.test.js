// The checker is exercised on a small made-up puzzle whose answer is known,
// so the real puzzle's answer never appears anywhere in this repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, PASS, FAIL, PENDING } from '../js/rules.js';
import { PUZZLE } from '../js/puzzle.js';

const MINI = {
  rows: 4,
  cols: 6,
  roomMap: ['AABBBB', 'AABBBB', 'CCCCCC', 'CCCCCC'],
  rooms: {
    A: { name: 'Lounge' },
    B: { name: 'Study' },
    C: { name: 'Hall' },
  },
  objects: [
    { type: 'plant', r: 1, c: 2 },
    { type: 'chair', r: 2, c: 2 },
    { type: 'chair', r: 1, c: 4 },
    { type: 'table', r: 2, c: 5 },
    { type: 'bed', r: 3, c: 4, w: 2 },
    { type: 'carpet', r: 4, c: 5, w: 2 },
  ],
  occupiable: ['chair', 'bed', 'carpet'],
  people: [
    { id: 'A', name: 'Ann', gender: 'f' },
    { id: 'B', name: 'Bob', gender: 'm' },
    { id: 'C', name: 'Cat', gender: 'f' },
    { id: 'V', name: 'Vic', gender: 'm', victim: true },
  ],
  clues: [
    { person: 'A', text: '', checks: [{ kind: 'beside', person: 'A', object: 'plant' }] },
    {
      person: 'B',
      text: '',
      checks: [
        { kind: 'inRoom', person: 'B', room: 'A' },
        { kind: 'aloneWith', person: 'B', gender: 'f' },
      ],
    },
    {
      person: 'C',
      text: '',
      checks: [
        { kind: 'rowsSouthOf', person: 'C', of: 'B', rows: 1 },
        { kind: 'onlyPersonOn', person: 'C', object: 'bed' },
        { kind: 'notInColumns', person: 'C', cols: [1, 6] },
        { kind: 'adjacentColumnsEmpty', person: 'C' },
      ],
    },
    { person: 'V', text: '', checks: [{ kind: 'victimAlone', person: 'V' }] },
    { person: null, text: '', checks: [{ kind: 'exactlyOneOn', object: 'chair' }] },
    { person: null, text: '', checks: [{ kind: 'exactlyOneOn', object: 'carpet' }] },
  ],
};

const SOLVED = {
  A: { r: 1, c: 1 },
  B: { r: 2, c: 2 },
  C: { r: 3, c: 4 },
  V: { r: 4, c: 6 },
};

const groupOf = (report, person) => report.groups.find((g) => g.person === person);
const ruleGroup = (report, id) => report.groups.find((g) => g.id === id);
const failures = (report) => report.groups.flatMap((g) => g.results).filter((r) => r.status === FAIL);

test('a correct board with the right accusation closes the case', () => {
  const report = evaluate(MINI, SOLVED, { murderer: 'C' });
  assert.deepEqual(failures(report), []);
  assert.ok(report.groups.every((g) => g.status === PASS), JSON.stringify(report.groups.filter((g) => g.status !== PASS)));
  assert.equal(report.summary.status, PASS);
});

test('a correct board without an accusation asks for one', () => {
  const report = evaluate(MINI, SOLVED, {});
  assert.equal(report.contradictions, 0);
  assert.equal(report.summary.status, PENDING);
  assert.equal(ruleGroup(report, 'accusation').status, PENDING);
});

test('accusing the wrong person is a contradiction', () => {
  const report = evaluate(MINI, SOLVED, { murderer: 'A' });
  assert.equal(ruleGroup(report, 'accusation').status, FAIL);
  assert.equal(report.summary.status, FAIL);
});

test('an empty board has nothing to contradict', () => {
  const report = evaluate(MINI, {}, {});
  assert.equal(report.contradictions, 0);
  assert.equal(report.summary.status, PENDING);
  assert.equal(report.placedCount, 0);
});

test('a partial board that fits the clues reports no contradictions', () => {
  const report = evaluate(MINI, { A: SOLVED.A, C: SOLVED.C }, {});
  assert.equal(report.contradictions, 0);
  assert.equal(report.summary.status, PENDING);
  assert.equal(groupOf(report, 'A').status, PASS);
});

test('two people in one row or column', () => {
  let report = evaluate(MINI, { A: { r: 1, c: 1 }, C: { r: 1, c: 3 } }, {});
  assert.equal(ruleGroup(report, 'rows').status, FAIL);
  assert.equal(ruleGroup(report, 'cols').status, PENDING);
  report = evaluate(MINI, { A: { r: 1, c: 1 }, C: { r: 3, c: 1 } }, {});
  assert.equal(ruleGroup(report, 'cols').status, FAIL);
  assert.deepEqual(ruleGroup(report, 'cols').results[0].people.sort(), ['A', 'C']);
});

test('standing on blocking furniture', () => {
  const report = evaluate(MINI, { A: { r: 2, c: 5 } }, {});
  assert.equal(ruleGroup(report, 'squares').status, FAIL);
  const plantReport = evaluate(MINI, { A: { r: 1, c: 2 } }, {});
  assert.equal(ruleGroup(plantReport, 'squares').status, FAIL);
});

test('beside means sharing an edge unless diagonals are switched on', () => {
  const draft = { A: { r: 2, c: 1 } }; // touches the plant only at a corner
  assert.equal(groupOf(evaluate(MINI, draft, {}), 'A').status, FAIL);
  assert.equal(groupOf(evaluate(MINI, draft, { diagonal: true }), 'A').status, PASS);
});

test('wrong room, and alone with the wrong kind of person', () => {
  let report = evaluate(MINI, { B: { r: 2, c: 3 } }, {});
  assert.equal(groupOf(report, 'B').status, FAIL);
  report = evaluate(MINI, { B: { r: 2, c: 2 }, V: { r: 1, c: 1 } }, {});
  assert.equal(groupOf(report, 'B').status, FAIL);
  report = evaluate(MINI, { ...SOLVED, A: { r: 4, c: 3 }, V: { r: 1, c: 1 } }, {});
  assert.equal(groupOf(report, 'B').status, FAIL);
});

test('alone with someone, but nobody else came', () => {
  const report = evaluate(MINI, { ...SOLVED, A: { r: 4, c: 1 }, V: { r: 1, c: 6 } }, {});
  assert.equal(groupOf(report, 'B').status, FAIL);
});

test('row offset', () => {
  const report = evaluate(MINI, { B: SOLVED.B, C: { r: 4, c: 4 } }, {});
  assert.equal(groupOf(report, 'C').results.find((r) => /row/.test(r.text)).status, FAIL);
  const ok = evaluate(MINI, { B: SOLVED.B, C: SOLVED.C }, {});
  assert.equal(ok.groups.flatMap((g) => g.results).filter((r) => r.status === FAIL).length, 0);
});

test('only person on a bed', () => {
  let report = evaluate(MINI, { C: SOLVED.C, A: { r: 3, c: 5 } }, {});
  assert.equal(groupOf(report, 'C').status, FAIL);
  report = evaluate(MINI, { C: { r: 3, c: 3 } }, {});
  assert.equal(groupOf(report, 'C').status, FAIL);
});

test('excluded columns and neighbouring columns', () => {
  let report = evaluate(MINI, { C: { r: 3, c: 1 } }, {});
  assert.equal(groupOf(report, 'C').status, FAIL);
  report = evaluate(MINI, { C: SOLVED.C, A: { r: 1, c: 3 } }, {});
  const adj = groupOf(report, 'C').results.find((r) => /Column 3/.test(r.text));
  assert.equal(adj.status, FAIL);
  assert.deepEqual(adj.people.sort(), ['A', 'C']);
});

test('exactly one person on a chair / carpet', () => {
  let report = evaluate(MINI, { B: SOLVED.B, A: { r: 1, c: 4 } }, {});
  assert.equal(report.groups.filter((g) => g.person === null && g.section === 'clues')[0].status, FAIL);
  report = evaluate(MINI, { ...SOLVED, V: { r: 4, c: 3 } }, {});
  assert.equal(report.groups.filter((g) => g.person === null && g.section === 'clues')[1].status, FAIL);
});

test('victim must be alone with exactly one person', () => {
  let report = evaluate(MINI, { ...SOLVED, V: { r: 1, c: 6 } }, {});
  assert.equal(groupOf(report, 'V').status, FAIL);
  report = evaluate(MINI, { C: SOLVED.C, V: SOLVED.V, A: { r: 4, c: 1 } }, {});
  assert.equal(groupOf(report, 'V').status, FAIL);
});

// A few arbitrary drafts on the real board, to make sure its clues are wired up.
test('real puzzle: empty board', () => {
  const report = evaluate(PUZZLE, {}, {});
  assert.equal(report.contradictions, 0);
  assert.equal(report.total, 9);
});

test('real puzzle: nobody can sit at the dining table', () => {
  const report = evaluate(PUZZLE, { A: { r: 2, c: 5 } }, {});
  assert.equal(ruleGroup(report, 'squares').status, FAIL);
});

test('real puzzle: column 1 is off limits for Henley', () => {
  const report = evaluate(PUZZLE, { H: { r: 3, c: 1 } }, {});
  assert.equal(groupOf(report, 'H').status, FAIL);
});

test('real puzzle: Gavin outside the Grand Salon', () => {
  const report = evaluate(PUZZLE, { G: { r: 3, c: 2 } }, {});
  assert.match(groupOf(report, 'G').results[0].text, /Sundeck, not the Grand Salon/);
});
