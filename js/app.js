import { PUZZLE } from './puzzle.js';
import { evaluate, indexPuzzle, objectName, FAIL } from './rules.js';
import { boardSvg, viewBox } from './board.js';

const STORAGE_KEY = `murdoku:${PUZZLE.id}:v1`;
const grid = indexPuzzle(PUZZLE);
const people = PUZZLE.people;
const byId = new Map(people.map((p) => [p.id, p]));
const cellKey = (r, c) => `${r},${c}`;

const els = {
  controls: document.getElementById('controls'),
  paper: document.getElementById('paper'),
  board: document.getElementById('board'),
  people: document.getElementById('people'),
  info: document.getElementById('cell-info'),
  zoom: document.getElementById('zoom'),
  clues: document.getElementById('clues'),
  summary: document.getElementById('summary'),
  murderer: document.getElementById('murderer'),
  check: document.getElementById('check'),
  checkMini: document.getElementById('check-mini'),
  undo: document.getElementById('undo'),
  resets: [document.getElementById('reset'), document.getElementById('reset-2')],
  diagonal: document.getElementById('opt-diagonal'),
  shade: document.getElementById('opt-shade'),
  tools: [...document.querySelectorAll('[data-tool]')],
};

// Matches the CSS breakpoint where the controls become a bottom dock.
const dockQuery = window.matchMedia('(max-width: 760px), (max-height: 520px) and (orientation: landscape)');

// ---- State ----------------------------------------------------------------

function blankState() {
  return {
    placed: {},
    notes: {},
    crosses: {},
    murderer: '',
    settings: { diagonal: false, shade: false, zoom: false },
  };
}

function sanitize(raw) {
  const s = blankState();
  if (!raw || typeof raw !== 'object') return s;
  const validCell = (r, c) => {
    const cell = grid.get(r, c);
    return cell && cell.inside;
  };
  for (const p of people) {
    const pos = raw.placed && raw.placed[p.id];
    if (pos && validCell(pos.r, pos.c)) s.placed[p.id] = { r: pos.r, c: pos.c };
  }
  for (const [k, v] of Object.entries(raw.notes || {})) {
    const [r, c] = k.split(',').map(Number);
    const letters = people.map((p) => p.id).filter((id) => String(v).includes(id)).join('');
    if (validCell(r, c) && letters) s.notes[k] = letters;
  }
  for (const k of Object.keys(raw.crosses || {})) {
    const [r, c] = k.split(',').map(Number);
    if (validCell(r, c)) s.crosses[k] = true;
  }
  if (byId.has(raw.murderer) && !byId.get(raw.murderer).victim) s.murderer = raw.murderer;
  if (raw.settings) {
    s.settings.diagonal = !!raw.settings.diagonal;
    s.settings.shade = !!raw.settings.shade;
    s.settings.zoom = !!raw.settings.zoom;
  }
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : blankState();
  } catch {
    return blankState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: the draft just won't survive a reload */
  }
}

let state = loadState();
const history = [];
const ui = {
  tool: 'place',
  person: 'A',
  report: null,
  stale: false,
  focus: new Set(),
  // { text, status?, details? } shown in the info line until the next action
  notice: null,
};

function commit(mutate) {
  history.push(JSON.stringify(state));
  if (history.length > 300) history.shift();
  mutate(state);
  afterChange();
}

function afterChange() {
  saveState();
  if (ui.report) ui.stale = true;
  ui.focus.clear();
  render();
}

function undo() {
  const prev = history.pop();
  if (!prev) return;
  ui.notice = null;
  state = sanitize(JSON.parse(prev));
  afterChange();
}

function occupantAt(r, c) {
  return people.find((p) => {
    const pos = state.placed[p.id];
    return pos && pos.r === r && pos.c === c;
  });
}

// ---- Board interaction --------------------------------------------------------

function notify(text, extra = {}) {
  ui.notice = { text, ...extra };
  renderInfo();
}

function handleCell(r, c) {
  const cell = grid.get(r, c);
  if (!cell || !cell.inside) return;
  const k = cellKey(r, c);
  const occupant = occupantAt(r, c);
  const person = ui.person ? byId.get(ui.person) : null;
  ui.notice = null;

  switch (ui.tool) {
    case 'place': {
      if (!person) {
        if (occupant) {
          ui.person = occupant.id;
          render();
        } else {
          notify('Pick a person first.');
        }
        return;
      }
      if (occupant && occupant.id === person.id) {
        commit((s) => delete s.placed[person.id]);
        notify(`${person.name} taken off the board.`);
        return;
      }
      commit((s) => {
        if (occupant) delete s.placed[occupant.id];
        s.placed[person.id] = { r, c };
        delete s.crosses[k];
      });
      notify(
        occupant
          ? `${person.name} → row ${r}, column ${c} (${occupant.name} taken off).`
          : `${person.name} → row ${r}, column ${c}, ${PUZZLE.rooms[cell.room].name}.`,
      );
      return;
    }
    case 'note': {
      if (!person) return notify('Pick a person to pencil in.');
      if (occupant) return notify(`${occupant.name} is on that square. Erase it first to add notes.`);
      commit((s) => {
        const current = s.notes[k] || '';
        const next = current.includes(person.id)
          ? current.replace(person.id, '')
          : people.map((p) => p.id).filter((id) => id === person.id || current.includes(id)).join('');
        if (next) s.notes[k] = next;
        else delete s.notes[k];
      });
      return;
    }
    case 'cross': {
      if (occupant) return notify(`${occupant.name} is on that square. Erase it first to cross it out.`);
      commit((s) => {
        if (s.crosses[k]) delete s.crosses[k];
        else s.crosses[k] = true;
      });
      return;
    }
    case 'erase': {
      if (!occupant && !state.notes[k] && !state.crosses[k]) return;
      commit((s) => {
        if (occupant) delete s.placed[occupant.id];
        delete s.notes[k];
        delete s.crosses[k];
      });
      return;
    }
    default:
  }
}

els.board.addEventListener('click', (e) => {
  const hit = e.target.closest('.hit');
  if (!hit) return;
  const r = Number(hit.dataset.r);
  const c = Number(hit.dataset.c);
  handleCell(r, c);
  if (!ui.notice) renderInfo(grid.get(r, c));
});

els.board.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const hit = e.target.closest('.hit');
  if (hit) renderInfo(grid.get(Number(hit.dataset.r), Number(hit.dataset.c)));
});
els.board.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') renderInfo();
});

els.people.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-person]');
  if (!chip) return;
  const id = chip.dataset.person;
  ui.person = ui.person === id ? null : id;
  ui.notice = null;
  render();
});

for (const btn of els.tools) {
  btn.addEventListener('click', () => {
    ui.tool = btn.dataset.tool;
    ui.notice = null;
    render();
  });
}

els.undo.addEventListener('click', undo);

for (const btn of els.resets) {
  btn.addEventListener('click', () => {
    if (!window.confirm('Clear every person, note and cross from the board?')) return;
    commit((s) => {
      s.placed = {};
      s.notes = {};
      s.crosses = {};
      s.murderer = '';
    });
    notify('Board cleared. Undo brings it back.');
  });
}

els.murderer.addEventListener('change', () => {
  commit((s) => {
    s.murderer = els.murderer.value;
  });
});

els.diagonal.addEventListener('change', () => {
  state.settings.diagonal = els.diagonal.checked;
  afterChange();
});

els.shade.addEventListener('change', () => {
  state.settings.shade = els.shade.checked;
  saveState();
  render();
});

els.zoom.addEventListener('click', () => {
  state.settings.zoom = !state.settings.zoom;
  saveState();
  render();
});

function runCheck() {
  ui.report = evaluate(PUZZLE, state.placed, {
    diagonal: state.settings.diagonal,
    murderer: state.murderer,
  });
  ui.stale = false;
  ui.focus.clear();
  const { summary } = ui.report;
  ui.notice = { text: `${ICON[summary.status]} ${summary.title}`, status: summary.status, details: true };
  render();
}

els.check.addEventListener('click', runCheck);
els.checkMini.addEventListener('click', runCheck);

// "Details" in the info line jumps to the first clue that needs attention.
els.info.addEventListener('click', (e) => {
  if (!e.target.closest('[data-details]')) return;
  const target = els.clues.querySelector('.clue.status-fail') || document.getElementById('check-panel');
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

els.clues.addEventListener('click', (e) => {
  const msg = e.target.closest('[data-people]');
  if (!msg || !msg.dataset.people) return;
  const ids = msg.dataset.people.split(',').filter(Boolean);
  const same = ids.length === ui.focus.size && ids.every((id) => ui.focus.has(id));
  ui.focus = same ? new Set() : new Set(ids);
  render();
  // On a phone the board is out of view by now: bring it back so the
  // highlighted people can be seen.
  if (ui.focus.size && dockQuery.matches) {
    els.paper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

els.clues.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-people][role="button"]')) {
    e.preventDefault();
    e.target.click();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const upper = e.key.toUpperCase();
  if (byId.has(upper)) {
    ui.person = upper;
    ui.notice = null;
    render();
  } else if (['1', '2', '3', '4'].includes(e.key)) {
    ui.tool = ['place', 'note', 'cross', 'erase'][Number(e.key) - 1];
    ui.notice = null;
    render();
  } else if (e.key === 'Escape') {
    ui.person = null;
    render();
  }
});

// Keep page content clear of the bottom dock on phones.
function syncDockSpace() {
  const h = dockQuery.matches ? Math.ceil(els.controls.getBoundingClientRect().height) : 0;
  document.documentElement.style.setProperty('--dock-h', `${h}px`);
}
if ('ResizeObserver' in window) new ResizeObserver(syncDockSpace).observe(els.controls);
dockQuery.addEventListener('change', syncDockSpace);

// ---- Rendering ----------------------------------------------------------------

const ICON = { pass: '✓', fail: '✗', pending: '…' };
const STATUS_LABEL = { pass: 'Checks out', fail: 'Contradiction', pending: 'Not decided yet' };

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

function describeCell(cell) {
  const parts = [`Row ${cell.r} · Col ${cell.c}`, PUZZLE.rooms[cell.room].name];
  if (!cell.object) parts.push('open floor');
  else if (cell.free) parts.push(`on a ${objectName(cell.object)}`);
  else parts.push(`${objectName(cell.object)} (blocked)`);
  const occupant = occupantAt(cell.r, cell.c);
  if (occupant) parts.push(`${occupant.name} is here`);
  return parts.join(' · ');
}

function toolHint() {
  const person = ui.person ? byId.get(ui.person) : null;
  const who = person ? `<strong style="color:${person.color}">${esc(person.name)}</strong>` : '';
  return {
    place: person ? `Tap a square to place ${who}. Tap again to remove.` : 'Pick a person, then tap a square.',
    note: person ? `Tap squares to pencil in ${who}.` : 'Pick a person to pencil in.',
    cross: 'Tap a square to cross it out. Tap again to clear it.',
    erase: 'Tap a square to clear it.',
  }[ui.tool];
}

function renderInfo(cell = null) {
  els.info.className = 'cell-info';
  if (cell) {
    els.info.textContent = describeCell(cell);
    return;
  }
  const n = ui.notice;
  if (n) {
    els.info.classList.add('is-notice');
    if (n.status) els.info.classList.add(`status-${n.status}`);
    els.info.innerHTML = `<span>${esc(n.text)}</span>${n.details ? ' <button type="button" class="details-link" data-details>Details ↓</button>' : ''}`;
    return;
  }
  els.info.innerHTML = toolHint();
}

function renderTools() {
  for (const btn of els.tools) btn.setAttribute('aria-pressed', String(btn.dataset.tool === ui.tool));
  els.undo.disabled = history.length === 0;
  els.zoom.setAttribute('aria-pressed', String(state.settings.zoom));
  els.paper.classList.toggle('is-zoomed', state.settings.zoom);
}

function renderPeople() {
  els.people.innerHTML = people
    .map((p) => {
      const pos = state.placed[p.id];
      const selected = ui.person === p.id;
      const where = pos ? `row ${pos.r}, column ${pos.c}` : 'not placed';
      return `<button type="button" class="chip${selected ? ' is-selected' : ''}${p.victim ? ' is-victim' : ''}${pos ? ' is-placed' : ''}"
        data-person="${p.id}" aria-pressed="${selected}" style="--c:${p.color}"
        aria-label="${esc(p.name)}${p.victim ? ' (victim)' : ''}, ${where}">
        <span class="chip-av" aria-hidden="true">${p.id}</span>
        <span class="chip-name" aria-hidden="true">${esc(p.name)}</span>
        <span class="chip-pos" aria-hidden="true">${pos ? `R${pos.r} C${pos.c}` : p.victim ? 'victim' : 'not placed'}</span>
      </button>`;
    })
    .join('');
}

function renderBoard() {
  const showReport = ui.report && !ui.stale;
  const failing = new Set();
  if (showReport) {
    for (const g of ui.report.groups) {
      for (const r of g.results) if (r.status === FAIL) r.people.forEach((id) => failing.add(id));
    }
  }
  els.board.setAttribute('viewBox', viewBox(PUZZLE));
  els.board.innerHTML = boardSvg(PUZZLE, grid, {
    placed: state.placed,
    notes: state.notes,
    crosses: state.crosses,
    selected: ui.person,
    shade: state.settings.shade,
    failing,
    focus: ui.focus,
  });
}

function renderSummary() {
  if (!ui.report) {
    els.summary.className = 'summary';
    els.summary.innerHTML = `<p>Draft your answer on the board, then check it against every clue. The check never reveals anything you haven't placed.</p>`;
    return;
  }
  const { summary } = ui.report;
  els.summary.className = `summary status-${summary.status}${ui.stale ? ' is-stale' : ''}`;
  els.summary.innerHTML = `
    <p class="summary-title"><span class="icon" aria-hidden="true">${ICON[summary.status]}</span> ${esc(summary.title)}</p>
    <p>${esc(summary.text)}</p>
    ${ui.stale ? '<p class="stale-note">The board has changed since this check.</p>' : ''}`;
}

function avatar(personId) {
  if (!personId) return `<span class="av av-evidence" aria-hidden="true">?</span>`;
  const p = byId.get(personId);
  return `<span class="av" style="--c:${p.color}" aria-hidden="true">${p.id}</span>`;
}

const skeleton = evaluate(PUZZLE, {}, {});

function renderClues() {
  const report = ui.report;
  const source = report || skeleton;
  const groups = source.groups.filter((g) => g.section !== 'accusation');
  const showStatus = Boolean(report);

  const rules = groups.filter((g) => g.section === 'rules');
  const clues = groups.filter((g) => g.section === 'clues');

  const resultList = (g) =>
    showStatus
      ? `<ul class="msgs">${g.results
          .map(
            (r) => `<li class="msg status-${r.status}" data-people="${r.people.join(',')}"${r.people.length ? ' role="button" tabindex="0"' : ''}>
              <span class="icon" aria-hidden="true">${ICON[r.status]}</span><span>${esc(r.text)}</span></li>`,
          )
          .join('')}</ul>`
      : '';

  const badge = (g) =>
    showStatus
      ? `<span class="badge status-${g.status}" title="${STATUS_LABEL[g.status]}"><span aria-hidden="true">${ICON[g.status]}</span><span class="sr">${STATUS_LABEL[g.status]}</span></span>`
      : '';

  const card = (g, extraClass = '') => `
    <li class="clue ${extraClass} ${showStatus ? `status-${g.status}` : ''} ${ui.stale ? 'is-stale' : ''}">
      <div class="clue-head">
        ${g.section === 'rules' ? `<span class="av av-rule" aria-hidden="true">#</span>` : avatar(g.person)}
        <div class="clue-body">
          <p class="clue-name">${esc(g.title)}${g.person && byId.get(g.person).victim ? ' <span class="tag">victim</span>' : ''}</p>
          <p class="clue-text">${esc(g.text)}</p>
        </div>
        ${badge(g)}
      </div>
      ${resultList(g)}
    </li>`;

  const accusation = report ? report.groups.find((g) => g.section === 'accusation') : null;
  const accusationHtml = accusation
    ? card(
        {
          ...accusation,
          title: 'Accusation',
          text: state.murderer ? `You named ${byId.get(state.murderer).name}.` : 'Nobody named yet.',
        },
        'is-accusation',
      )
    : '';

  els.clues.innerHTML =
    clues.map((g) => card(g)).join('') +
    accusationHtml +
    `<li class="clue-divider">Board rules</li>` +
    rules.map((g) => card(g, 'is-rule')).join('');
}

function renderMurderer() {
  const suspects = people.filter((p) => !p.victim);
  els.murderer.innerHTML =
    `<option value="">Choose a suspect</option>` +
    suspects
      .map((p) => `<option value="${p.id}"${state.murderer === p.id ? ' selected' : ''}>${esc(p.name)}</option>`)
      .join('');
}

function render() {
  renderTools();
  renderPeople();
  renderBoard();
  renderInfo();
  renderSummary();
  renderClues();
  renderMurderer();
  els.diagonal.checked = state.settings.diagonal;
  els.shade.checked = state.settings.shade;
}

render();
syncDockSpace();
