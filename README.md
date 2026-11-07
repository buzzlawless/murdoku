# murdoku

A drafting board for puzzle 74, **The Yacht**. Place the suspects and the victim, pencil in candidates, cross out squares, then press **Check for contradictions** to test the draft against every clue.

The checker never solves the puzzle and holds no stored answer. It only tests the squares you have filled in against the board rules and the written clues. Each clue card then shows ✓ (checks out), ✗ (contradiction, with the reason), or … (not decided yet).

## Using it

- **Place**: pick a person, then tap a square. Tap them again to take them off the board.
- **Note**: pencil a person's letter into a square. Each person always uses the same spot in the square.
- **Cross**: mark a square as ruled out.
- **Erase**: clear a square.
- **Murderer**: choose a suspect before your final check. When the board is complete and every clue checks out, the page says “Case closed!”
- **Options** (under *Rules & options*):
  - Count corner-touching squares as "beside". Off by default, so "beside" means sharing an edge.
  - Shade rows and columns that already hold someone.

On a phone, the tools, people and a **Check** button sit in a dock at the bottom of the screen, or on the right when the phone is sideways. The **⤢** button zooms the board so the squares are easier to tap; swipe sideways to pan. After a check, **Details ↓** jumps to the first clue with a problem, and tapping a reason brings you back to the board with those people highlighted.

Keyboard shortcuts: A–H and V pick a person, 1–4 switch tools, Esc deselects, Ctrl/⌘ Z undoes.

Your draft is saved in the browser's local storage.

## Publishing on GitHub Pages

The site is plain static files at the repository root, with no build step. In the repository's **Settings → Pages**, set *Source* to **Deploy from a branch**, then pick the branch and the **/ (root)** folder. The site then appears at `https://<user>.github.io/murdoku/`.

## Development

```sh
npm run serve   # http://localhost:8000 (ES modules need a web server, not file://)
npm test        # transcription sanity checks + checker tests (Node 18+)
```

- `js/puzzle.js`: the board, transcribed square by square. Rooms, furniture, people and clues all live here.
- `js/rules.js`: the contradiction checker.
- `js/board.js`: draws the SVG floor plan.
- `js/app.js`: drafting state, interactions and rendering.

The checker's tests use a small made-up puzzle, so the real puzzle's answer appears nowhere in this repository.
