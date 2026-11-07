// Contradiction checker. It never searches for a solution: it only tests the
// people you have placed against the board rules and the written clues.

export const PASS = 'pass';
export const FAIL = 'fail';
export const PENDING = 'pending';

const OBJECT_NAMES = {
  chair: ['chair', 'chairs'],
  plant: ['plant', 'plants'],
  shelf: ['shelf', 'shelves'],
  table: ['table', 'tables'],
  tv: ['TV', 'TVs'],
  bed: ['bed', 'beds'],
  carpet: ['carpet', 'carpets'],
  crate: ['crate', 'crates'],
  sink: ['sink', 'sinks'],
};

export function objectName(type, plural = false) {
  const names = OBJECT_NAMES[type];
  return names ? names[plural ? 1 : 0] : type;
}

export function objectCells(o) {
  const cells = [];
  for (let dr = 0; dr < (o.h || 1); dr++) {
    for (let dc = 0; dc < (o.w || 1); dc++) cells.push([o.r + dr, o.c + dc]);
  }
  return cells;
}

export function indexPuzzle(puzzle) {
  const { rows, cols } = puzzle;
  const cells = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const key = puzzle.roomMap[r - 1][c - 1];
      const inside = key !== '.';
      cells.push({ r, c, inside, room: inside ? key : null, object: null, objectIndex: -1 });
    }
  }
  const get = (r, c) =>
    r >= 1 && r <= rows && c >= 1 && c <= cols ? cells[(r - 1) * cols + (c - 1)] : null;

  puzzle.objects.forEach((o, i) => {
    for (const [r, c] of objectCells(o)) {
      const cell = get(r, c);
      if (cell) {
        cell.object = o.type;
        cell.objectIndex = i;
      }
    }
  });

  const occupiable = new Set(puzzle.occupiable);
  for (const cell of cells) {
    cell.free = cell.inside && (cell.object === null || occupiable.has(cell.object));
  }
  return { rows, cols, cells, get };
}

export function neighbours(grid, cell, diagonal = false) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      if (!diagonal && dr && dc) continue;
      const n = grid.get(cell.r + dr, cell.c + dc);
      if (n && n.inside) out.push(n);
    }
  }
  return out;
}

const pass = (text, people = []) => ({ status: PASS, text, people });
const fail = (text, people = []) => ({ status: FAIL, text, people });
const pending = (text, people = []) => ({ status: PENDING, text, people });

function worst(results) {
  if (results.some((r) => r.status === FAIL)) return FAIL;
  if (results.some((r) => r.status === PENDING)) return PENDING;
  return PASS;
}

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Check a draft.
 *
 * @param puzzle  puzzle definition (see puzzle.js)
 * @param placed  { [personId]: { r, c } } for every person on the board
 * @param options { diagonal: 'beside' also counts corner-touching squares,
 *                  murderer: person id of the accused, or '' }
 * @returns {{ groups, summary, placedCount, total, allPlaced }}
 */
export function evaluate(puzzle, placed = {}, options = {}) {
  const { diagonal = false, murderer = '' } = options;
  const grid = indexPuzzle(puzzle);
  const people = puzzle.people;
  const byId = new Map(people.map((p) => [p.id, p]));

  const at = new Map();
  for (const p of people) {
    const pos = placed[p.id];
    const cell = pos ? grid.get(pos.r, pos.c) : null;
    if (cell) at.set(p.id, cell);
  }
  const placedIds = people.map((p) => p.id).filter((id) => at.has(id));
  const allPlaced = placedIds.length === people.length;

  const name = (id) => byId.get(id).name;
  const names = (ids) => listNames(ids.map(name));
  const isAre = (ids) => (ids.length === 1 ? 'is' : 'are');
  const roomName = (key) => puzzle.rooms[key].name;
  const where = (cell) => `row ${cell.r}, column ${cell.c}`;
  const company = (id) => {
    const room = at.get(id).room;
    return placedIds.filter((o) => o !== id && at.get(o).room === room);
  };
  const notPlaced = (id) => pending(`${name(id)} isn't on the board yet.`);
  const soFar = `${placedIds.length} of ${people.length} placed`;

  // ---- Board rules -------------------------------------------------------

  function checkSquares() {
    const results = [];
    for (const id of placedIds) {
      const cell = at.get(id);
      if (!cell.inside) {
        results.push(fail(`${name(id)} is off the yacht (${where(cell)}).`, [id]));
      } else if (!cell.free) {
        results.push(
          fail(
            `${name(id)} is on a ${objectName(cell.object)} (${where(cell)}). Nobody can be on a square with a ${objectName(cell.object)}.`,
            [id],
          ),
        );
      }
    }
    if (results.length) return results;
    if (allPlaced) return [pass('Everyone is on a square they can occupy.')];
    if (!placedIds.length) return [pending('Nobody is on the board yet.')];
    return [pending(`Everyone placed so far is on a square they can occupy (${soFar}).`)];
  }

  function checkLines(axis) {
    const word = axis === 'r' ? 'row' : 'column';
    const buckets = new Map();
    for (const id of placedIds) {
      const n = at.get(id)[axis];
      if (!buckets.has(n)) buckets.set(n, []);
      buckets.get(n).push(id);
    }
    const results = [];
    for (const [n, ids] of [...buckets].sort((a, b) => a[0] - b[0])) {
      if (ids.length > 1) results.push(fail(`${names(ids)} share ${word} ${n}.`, ids));
    }
    if (results.length) return results;
    if (allPlaced) return [pass(`Nobody shares a ${word}.`)];
    if (!placedIds.length) return [pending('Nobody is on the board yet.')];
    return [pending(`Nobody shares a ${word} so far (${soFar}).`)];
  }

  // ---- Clue checks ---------------------------------------------------------

  const checkers = {
    beside({ person, object }) {
      const cell = at.get(person);
      if (!cell) return [notPlaced(person)];
      const hit = neighbours(grid, cell, diagonal).find((n) => n.object === object);
      return hit
        ? [pass(`${name(person)} is beside a ${objectName(object)} (${where(hit)}).`, [person])]
        : [fail(`${name(person)} (${where(cell)}) isn't beside a ${objectName(object)}.`, [person])];
    },

    inRoom({ person, room }) {
      const cell = at.get(person);
      if (!cell) return [notPlaced(person)];
      return cell.room === room
        ? [pass(`${name(person)} is in the ${roomName(room)}.`, [person])]
        : [fail(`${name(person)} is in the ${roomName(cell.room)}, not the ${roomName(room)}.`, [person])];
    },

    rowsSouthOf({ person, of, rows }) {
      const a = at.get(person);
      const b = at.get(of);
      if (!a) return [notPlaced(person)];
      if (!b) return [pending(`Waiting for ${name(of)} to be placed.`)];
      const gap = rows === 1 ? 'one row' : `${rows} rows`;
      return a.r - b.r === rows
        ? [pass(`${name(person)} (row ${a.r}) is exactly ${gap} south of ${name(of)} (row ${b.r}).`, [person, of])]
        : [fail(`${name(person)} is in row ${a.r} and ${name(of)} is in row ${b.r}. That isn't exactly ${gap} south.`, [person, of])];
    },

    onlyPersonOn({ person, object }) {
      const obj = objectName(object);
      const results = [];
      const others = placedIds.filter((id) => id !== person && at.get(id).object === object);
      if (others.length) {
        results.push(fail(`${names(others)} ${isAre(others)} on a ${obj}, but only ${name(person)} should be.`, others));
      }
      const cell = at.get(person);
      if (!cell) results.push(notPlaced(person));
      else if (cell.object !== object) {
        results.push(fail(`${name(person)} (${where(cell)}) isn't on a ${obj}.`, [person]));
      } else if (!others.length) {
        results.push(
          allPlaced
            ? pass(`${name(person)} is the only person on a ${obj}.`, [person])
            : pending(`${name(person)} is on a ${obj} and nobody else is, so far.`, [person]),
        );
      }
      return results;
    },

    aloneWith({ person, gender }) {
      const cell = at.get(person);
      if (!cell) return [notPlaced(person)];
      const room = roomName(cell.room);
      const others = company(person);
      const kind = gender === 'f' ? 'a woman' : 'a man';
      if (others.length > 1) {
        return [fail(`${name(person)} isn't alone with one person: ${names(others)} are also in the ${room}.`, [person, ...others])];
      }
      if (others.length === 1) {
        const other = byId.get(others[0]);
        if (other.gender !== gender) {
          return [fail(`${name(person)} is with ${other.name} in the ${room}, and ${other.name} isn't ${kind}.`, [person, other.id])];
        }
        return allPlaced
          ? [pass(`${name(person)} is alone with ${other.name} in the ${room}.`, [person, other.id])]
          : [pending(`${name(person)} is with ${other.name} in the ${room}, and nobody else so far.`, [person, other.id])];
      }
      return allPlaced
        ? [fail(`Nobody else is in the ${room} with ${name(person)}.`, [person])]
        : [pending(`Nobody is in the ${room} with ${name(person)} yet.`, [person])];
    },

    notInColumns({ person, cols }) {
      const cell = at.get(person);
      if (!cell) return [notPlaced(person)];
      return cols.includes(cell.c)
        ? [fail(`${name(person)} is in column ${cell.c}.`, [person])]
        : [pass(`${name(person)} is in column ${cell.c}.`, [person])];
    },

    adjacentColumnsEmpty({ person }) {
      const cell = at.get(person);
      if (!cell) return [notPlaced(person)];
      const results = [];
      const sides = [cell.c - 1, cell.c + 1];
      for (const col of sides) {
        if (col < 1 || col > grid.cols) {
          results.push(fail(`${name(person)} is in column ${cell.c}, which doesn't have a column on both sides.`, [person]));
          continue;
        }
        const there = placedIds.filter((id) => id !== person && at.get(id).c === col);
        if (there.length) {
          results.push(fail(`Column ${col}, next to ${name(person)}, isn't empty: ${names(there)} ${isAre(there)} there.`, [person, ...there]));
        }
      }
      if (results.length) return results;
      return allPlaced
        ? [pass(`Columns ${sides[0]} and ${sides[1]} are both empty.`, [person])]
        : [pending(`Columns ${sides[0]} and ${sides[1]} are empty so far.`, [person])];
    },

    victimAlone({ person }) {
      const cell = at.get(person);
      if (!cell) return [notPlaced(person)];
      const room = roomName(cell.room);
      const others = company(person);
      if (others.length > 1) {
        return [fail(`${name(person)} isn't alone with one person: ${names(others)} are all in the ${room}.`, [person, ...others])];
      }
      if (others.length === 1) {
        return allPlaced
          ? [pass(`${name(person)} is alone with exactly one person in the ${room}.`, [person, ...others])]
          : [pending(`${name(person)} has one person with him in the ${room} so far.`, [person, ...others])];
      }
      return allPlaced
        ? [fail(`Nobody is in the ${room} with ${name(person)}.`, [person])]
        : [pending(`Nobody is in the ${room} with ${name(person)} yet.`, [person])];
    },

    exactlyOneOn({ object }) {
      const obj = objectName(object);
      const on = placedIds.filter((id) => at.get(id).object === object);
      if (on.length > 1) return [fail(`${on.length} people are on ${objectName(object, true)}: ${names(on)}.`, on)];
      if (on.length === 1) {
        return allPlaced
          ? [pass(`${name(on[0])} is the only person on a ${obj}.`, on)]
          : [pending(`Only ${name(on[0])} is on a ${obj} so far.`, on)];
      }
      return allPlaced ? [fail(`Nobody is on a ${obj}.`)] : [pending(`Nobody is on a ${obj} yet.`)];
    },
  };

  function checkAccusation() {
    const victim = people.find((p) => p.victim);
    if (!murderer || !byId.has(murderer)) return [pending('Choose who you think did it.')];
    if (!allPlaced) return [pending('Place everyone to confirm your accusation.')];
    const others = company(victim.id);
    if (others.length === 1 && others[0] === murderer) {
      return [pass(`${name(murderer)} was alone with ${victim.name}.`, [murderer, victim.id])];
    }
    if (others.length === 1) {
      return [fail(`Your board leaves ${victim.name} alone with ${name(others[0])}, not ${name(murderer)}.`, [victim.id, others[0], murderer])];
    }
    return [fail(`${victim.name} isn't alone with exactly one person on your board.`, [victim.id, ...others])];
  }

  // ---- Assemble ------------------------------------------------------------

  const group = (id, section, person, title, text, raw) => {
    // Several checks on one clue can say the same thing ("X isn't on the board yet").
    const results = raw.filter((r, i) => raw.findIndex((o) => o.text === r.text) === i);
    return { id, section, person, title, text, results, status: worst(results) };
  };

  const groups = [
    group('squares', 'rules', null, 'Open squares', 'People stand on open floor or are on a chair, bed or carpet. Nobody is on any other furniture.', checkSquares()),
    group('rows', 'rules', null, 'One per row', 'No two people share a row.', checkLines('r')),
    group('cols', 'rules', null, 'One per column', 'No two people share a column.', checkLines('c')),
    ...puzzle.clues.map((clue, i) =>
      group(
        `clue-${i}`,
        'clues',
        clue.person,
        clue.person ? name(clue.person) : 'Evidence',
        clue.text,
        clue.checks.flatMap((ch) => checkers[ch.kind](ch)),
      ),
    ),
    group('accusation', 'accusation', null, 'The murderer is…', 'The only person alone with the victim.', checkAccusation()),
  ];

  const contradictions = groups.flatMap((g) => g.results).filter((r) => r.status === FAIL).length;
  const clueGroups = groups.filter((g) => g.section !== 'accusation');
  const accusation = groups[groups.length - 1];

  let summary;
  if (contradictions) {
    summary = {
      status: FAIL,
      title: contradictions === 1 ? '1 contradiction found' : `${contradictions} contradictions found`,
      text: 'The clues marked ✗ below explain what is wrong.',
    };
  } else if (!allPlaced) {
    summary = {
      status: PENDING,
      title: 'No contradictions so far',
      text: `${placedIds.length} of ${people.length} people placed. Everything placed so far is consistent with the clues.`,
    };
  } else if (clueGroups.every((g) => g.status === PASS) && accusation.status === PASS) {
    summary = { status: PASS, title: 'Case closed!', text: `Every clue checks out, and ${name(murderer)} is the murderer.` };
  } else {
    summary = { status: PENDING, title: 'Every clue checks out', text: 'Now choose the murderer and check again.' };
  }

  return { groups, summary, placedCount: placedIds.length, total: people.length, allPlaced, contradictions };
}
