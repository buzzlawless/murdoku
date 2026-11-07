// Puzzle 74, "The Yacht", transcribed square by square from the book page.
//
// Coordinates are 1-based: rows run north → south (1–9) and columns run
// west → east (1–12). North is the top of the page.

export const PUZZLE = {
  id: 'yacht-74',
  number: 74,
  title: 'The Yacht',
  tagline: 'Someone went a little overboard on this cruise.',
  rows: 9,
  cols: 12,

  // One letter per square, keyed to `rooms` below. '.' is open water.
  roomMap: [
    'SSSDDDCC....',
    'SJJDDDCCCB..',
    'SSSDDDCCCBB.',
    'SSSDDDKKKKBB',
    'SSSGGGKKKKBB',
    'SSSGGGKKKKBB',
    'SHHGGGMMMBB.',
    'SHHGGGMMMB..',
    'SSSGGGMM....',
  ],

  // `label` is where the room's name tag sits, in square units from the
  // board's top-left corner ([x, y]).
  rooms: {
    S: { name: 'Sundeck', color: '#f3e0bf', label: [1.5, 9] },
    J: { name: 'Jacuzzi', color: '#c6e5e8', label: [2, 2] },
    H: { name: 'Helipad', color: '#dcd9d4', label: [2, 8] },
    D: { name: 'Dining Hall', color: '#e2d6f0', label: [4.5, 4] },
    G: { name: 'Grand Salon', color: '#f1e7b6', label: [4.5, 9] },
    C: { name: 'Crew Quarters', color: '#d8e9d0', label: [7.5, 3] },
    K: { name: 'Galley', color: '#f4d8de', label: [8, 6] },
    M: { name: 'Main Cabin', color: '#d6e1f2', label: [7, 9] },
    B: { name: 'Bridge', color: '#f6d1ad', label: [11.55, 7] },
  },

  // Furniture. `w`/`h` give the size in squares for pieces that span more
  // than one square. `deco` is purely cosmetic.
  objects: [
    // Sundeck
    { type: 'chair', r: 1, c: 2 },
    { type: 'chair', r: 1, c: 3 },
    { type: 'chair', r: 2, c: 1 },
    { type: 'chair', r: 4, c: 2 },
    { type: 'chair', r: 4, c: 3 },
    { type: 'chair', r: 6, c: 2 },
    { type: 'chair', r: 6, c: 3 },
    { type: 'chair', r: 7, c: 1 },
    { type: 'chair', r: 9, c: 3 },
    { type: 'table', r: 9, c: 1 },
    // Helipad
    { type: 'crate', r: 7, c: 2 },
    { type: 'crate', r: 7, c: 3 },
    // Dining Hall
    { type: 'chair', r: 1, c: 5 },
    { type: 'plant', r: 1, c: 6 },
    { type: 'chair', r: 2, c: 4 },
    { type: 'table', r: 2, c: 5, h: 2, deco: 'plate' },
    { type: 'chair', r: 2, c: 6 },
    { type: 'chair', r: 3, c: 4 },
    { type: 'chair', r: 3, c: 6 },
    { type: 'chair', r: 4, c: 6 },
    // Grand Salon
    { type: 'shelf', r: 5, c: 4 },
    { type: 'plant', r: 5, c: 6 },
    { type: 'chair', r: 6, c: 4 },
    { type: 'tv', r: 6, c: 6 },
    { type: 'table', r: 7, c: 4 },
    { type: 'carpet', r: 7, c: 5, h: 2 },
    { type: 'chair', r: 7, c: 6 },
    { type: 'table', r: 8, c: 6, h: 2, deco: 'glass' },
    // Crew Quarters
    { type: 'bed', r: 1, c: 7, w: 2 },
    { type: 'bed', r: 2, c: 8, h: 2 },
    { type: 'table', r: 3, c: 7, deco: 'mug' },
    // Galley
    { type: 'shelf', r: 4, c: 7 },
    { type: 'table', r: 4, c: 8, w: 2 },
    { type: 'shelf', r: 4, c: 10 },
    { type: 'carpet', r: 5, c: 8, w: 3 },
    // Main Cabin
    { type: 'bed', r: 7, c: 7, h: 2 },
    { type: 'sink', r: 7, c: 9 },
    { type: 'plant', r: 8, c: 9 },
    { type: 'table', r: 9, c: 7, w: 2 },
    // Bridge
    { type: 'table', r: 3, c: 11, deco: 'wrench' },
    { type: 'table', r: 4, c: 12 },
    { type: 'tv', r: 5, c: 12 },
    { type: 'table', r: 6, c: 12 },
  ],

  // Furniture a person can be on. Every other piece blocks its square.
  occupiable: ['chair', 'bed', 'carpet'],

  people: [
    { id: 'A', name: 'Aria', gender: 'f', color: '#b5446e' },
    { id: 'B', name: 'Brittney', gender: 'f', color: '#7a4fb0' },
    { id: 'C', name: 'Chelsea', gender: 'f', color: '#c4552b' },
    { id: 'D', name: 'Deborah', gender: 'f', color: '#2d7d8c' },
    { id: 'E', name: 'Evelyn', gender: 'f', color: '#9e6e08' },
    { id: 'F', name: 'Fernando', gender: 'm', color: '#3c6fb8' },
    { id: 'G', name: 'Gavin', gender: 'm', color: '#4a8634' },
    { id: 'H', name: 'Henley', gender: 'm', color: '#7a5a43' },
    { id: 'V', name: 'Viggo', gender: 'm', color: '#2b2530', victim: true },
  ],

  clues: [
    {
      person: 'A',
      text: 'She was beside a plant.',
      checks: [{ kind: 'beside', person: 'A', object: 'plant' }],
    },
    {
      person: 'B',
      text: 'She was beside a chair.',
      checks: [{ kind: 'beside', person: 'B', object: 'chair' }],
    },
    {
      person: 'C',
      text: 'She was on the Bridge. She was exactly one row south of Henley.',
      checks: [
        { kind: 'inRoom', person: 'C', room: 'B' },
        { kind: 'rowsSouthOf', person: 'C', of: 'H', rows: 1 },
      ],
    },
    {
      person: 'D',
      text: 'She was beside a shelf.',
      checks: [{ kind: 'beside', person: 'D', object: 'shelf' }],
    },
    {
      person: 'E',
      text: 'She was beside a TV.',
      checks: [{ kind: 'beside', person: 'E', object: 'tv' }],
    },
    {
      person: 'F',
      text: 'He was the only person on a bed.',
      checks: [{ kind: 'onlyPersonOn', person: 'F', object: 'bed' }],
    },
    {
      person: 'G',
      text: 'He was in the Grand Salon, alone with a woman.',
      checks: [
        { kind: 'inRoom', person: 'G', room: 'G' },
        { kind: 'aloneWith', person: 'G', gender: 'f' },
      ],
    },
    {
      person: 'H',
      text: 'He was not in column 1 or 11. Both columns adjacent to him were empty.',
      checks: [
        { kind: 'notInColumns', person: 'H', cols: [1, 11] },
        { kind: 'adjacentColumnsEmpty', person: 'H' },
      ],
    },
    {
      person: 'V',
      text: 'The victim. He was alone with the murderer.',
      checks: [{ kind: 'victimAlone', person: 'V' }],
    },
    {
      person: null,
      text: 'Exactly one person was on a chair.',
      checks: [{ kind: 'exactlyOneOn', object: 'chair' }],
    },
    {
      person: null,
      text: 'Exactly one person was on a carpet.',
      checks: [{ kind: 'exactlyOneOn', object: 'carpet' }],
    },
  ],
};
