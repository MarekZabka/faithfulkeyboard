# Faithful Keyboard

An interactive web application for exploring pitch-faithful keyboard layouts
for just-intonation tone systems. Based on the paper:

> Marek Žabka, *Planar Projections of Tone Systems and Faithful Keyboards*,
> MCM 2026. Available at https://www.faithfulkeyboard.com

The app lets you define harmonies as frequency ratios or prime-exponent vectors,
assign pitch widths to basis intervals, and visualise the resulting 2-D keyboard
layout with configurable key shapes, colours, and sound.

---

## Project structure

```
faithful-keyboard/
├── index.html          ← HTML skeleton only. No inline CSS or JS.
├── README.md           ← This file.
│
├── css/
│   └── main.css        ← All application styles (~530 lines).
│
├── js/                 ← 13 JS modules loaded in order by index.html.
│   ├── math.js         ← Pure math: ratios, factorisation, matrix ops.
│   ├── coords.js       ← Coordinate systems table + width computation.
│   ├── state.js        ← Global app state + harmony data model.
│   ├── tones.js        ← Tone computation: keys from ratios/vectors.
│   ├── color.js        ← Key colour functions (limit, pitch, width).
│   ├── heji.js         ← HEJI tone labelling. *** REPLACE IN PART B ***
│   ├── render.js       ← SVG keyboard renderer.
│   ├── touch.js        ← Pan / zoom / touch / mouse interaction.
│   ├── audio.js        ← Polyphonic synth engine (Web Audio API).
│   ├── ui-harmony.js   ← Harmony list + editor panel UI.
│   ├── ui-layout.js    ← Layout tab UI + width controls.
│   ├── ui-project.js   ← Project save/load, tone mode conversion.
│   └── main.js         ← App bootstrap: tabs, event wiring, init().
│
└── assets/
    └── heji/           ← HEJI accidental SVG/PDF assets (for Part B).
        ├── hejiNaturalDown.svg
        ├── hejiSharpDown.svg
        └── ...
```

---

## Load order and dependency graph

Modules must be loaded in this exact order (no bundler, no ES modules):

```
math.js
  └── coords.js
        └── state.js
              └── tones.js
                    └── color.js
                          └── heji.js
                                └── render.js
                                      └── touch.js
                                            └── audio.js
                                                  └── ui-harmony.js
                                                        └── ui-layout.js
                                                              └── ui-project.js
                                                                    └── main.js
```

Each module may reference globals declared in any earlier module.
`main.js` depends on all others and is loaded last.

---

## Key global variables

These are the shared state variables that flow between modules.
Never redeclare them — they are set once and mutated in place.

| Variable            | Set in          | Used by                                  | Description                                      |
|---------------------|-----------------|------------------------------------------|--------------------------------------------------|
| `harmonies`         | `state.js`      | everywhere                               | Array of harmony objects                         |
| `layout`            | `state.js`      | everywhere                               | Layout config object                             |
| `viewState`         | `render.js`     | `touch.js`, `render.js`                  | `{panX, panY, scaleX, scaleY}`                   |
| `zoomFactor`        | `render.js`     | `touch.js`, `render.js`                  | Current zoom multiplier                          |
| `baseScaleX/Y`      | `render.js`     | `render.js`, `touch.js`                  | Base scale at zoom=1                             |
| `allKeysCache`      | `tones.js`      | `render.js`, `touch.js`, `ui-harmony.js` | Flat array of all computed keys                  |
| `activeKeyIds`      | `tones.js`      | `render.js`, `touch.js`, `audio.js`      | Set of `"label_harmonyId"` strings for highlight |
| `touchKeyMap`       | `tones.js`      | `touch.js`, `audio.js`                   | Map: touch identifier → `{key, releaseFunc}`     |
| `svgEl`             | `render.js`     | `touch.js`, `render.js`                  | The `<svg id="keyboard-svg">` element            |
| `keysGroup`         | `render.js`     | `render.js`                              | `<g id="svg-keys">`                              |
| `axesGroup`         | `render.js`     | `render.js`                              | `<g id="svg-axes">`                              |
| `connGroup`         | `render.js`     | `render.js`                              | `<g id="svg-connections">`                       |
| `selectedHarmonyId` | `ui-harmony.js` | `ui-harmony.js`, `main.js`               | Currently open harmony editor                    |
| `projectName`       | `ui-project.js` | `ui-project.js`, `main.js`               | Current project name string                      |
| `projectIsDirty`    | `ui-project.js` | everywhere via `markProjectDirty()`      | Unsaved changes flag                             |
| `lastSavedJSON`     | `ui-project.js` | `ui-project.js`                          | Last explicitly saved JSON string                |
| `isViewLocked`      | `state.js`      | `touch.js`, `render.js`                  | Lock/unlock pan+zoom                             |

---

## Data models

### Harmony object (from `makeHarmony()` in `state.js`)

```text
{
  id:            String,      // UUID
  name:          String,      // display name
  visible:       Boolean,
  ratios:        String,      // raw tone list text (ratios or vectors)
  toneMode:      String,      // 'ratios' | 'vectors'
  octaveEquiv:   Boolean,
  showLabels:    Boolean,
  labelType:     String,      // 'ratio' | 'heji' | 'cents'
  labelFontSize: Number,
  labelColor:    String,
  labelOffsetX:  Number,
  labelOffsetY:  Number,
  colorMode:     String,      // 'uniform' | 'limit' | 'pitch' | 'width'
  uniformColor:  String,      // CSS colour string
  opacity:       Number,      // 0..1
  keyShape:      String,      // 'round'|'square'|'rect'|'diamond'|'triangle'|'pentagon'|'hexagon'|'octagon'
  keySize:       Number,      // base size in logical units
  keyRotation:   Number,      // degrees
  keyRounding:   Number,      // 0..1 corner rounding
  keyEdge:       String,      // 'straight'|'convex'|'concave'
  keyBulge:      Number,      // 0..1 convex/concave depth
  keyStretchX:   Number,
  keyStretchY:   Number,
  keyOffsetX:    Number,
  keyOffsetY:    Number,
  connectTones:  Boolean,
  connectStyle:  String,      // 'curve' | 'straight'
  connectColor:  String,
  connectWidth:  Number,
  // internal dirty tracking:
  _savedState:   Object|null
}
```

### Key object (entry in `allKeysCache`, from `tones.js`)

```text
{
  label:      String,   // ratio string e.g. "5/4"
  harmonyId:  String,   // parent harmony UUID
  harmonyName:String,
  harmony:    Object,   // reference to parent harmony
  x_logical:  Number,   // cents (pitch position on x axis)
  y_logical:  Number,   // width (position on y axis)
  cents:      Number,   // absolute pitch in cents
  freq:       Number,   // frequency in Hz
  width:      Number,   // pitch width value
  limit:      Number,   // JI prime limit
  oct:        Number,   // octave offset
  ratio:      Object,   // {num, den} or null for vector-mode tones
  _exps:      Array     // [e2, e3, e5, e7, e11, e13] prime exponents
}
```

---

## Module API surface

The functions other modules call on each module (informal public interface):

| Module          | Public functions                                                                                                                                          |
|-----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `math.js`       | `parseRatio`, `ratioVal`, `ratioToCents`, `ratioExponents`, `jiLimit`, `factorize`, `expsToHeight`, `expsToWidth`, `invertMatrix6`, `formatRatio`         |
| `coords.js`     | `COORD_SYSTEMS`, `getBasisInvT`, `computeWidth`, `PRIMES`                                                                                                 |
| `state.js`      | `makeHarmony`, `snapshotHarmony`, `harmonyIsDirty`, `saveHarmony`, `revertHarmony`, `harmonies[]`, `layout{}`, `isViewLocked`                             |
| `tones.js`      | `computeKeysForHarmony`, `getAllKeys`, `getBaseFreq`, `getCurrentBasis`, `releaseAllTouches`, `allKeysCache`, `touchKeyMap`, `activeKeyIds`               |
| `color.js`      | `getKeyColor`, `getHarmonyRepColor`, `limitColor`                                                                                                         |
| `heji.js`       | `getKeyLabel(key, harmony)`, `expsToHEJI(exps)`, `getBaseToneOffset()`                                                                                    |
| `render.js`     | `renderSVG()`, `applyAndDraw()`, `resetView(useAuto)`, `syncScales()`, `logicalToPixel(x,y)`, `getEffectiveKeySize(h)`, `svgEl`, `keysGroup`, `connGroup` |
| `touch.js`      | `applyZoom(factor)`                                                                                                                                       |
| `audio.js`      | `playKeySustained(key)` → `releaseFunc`, `playKey(key)`, `handleKeyClick(key)`                                                                            |
| `ui-harmony.js` | `renderHarmonyList()`, `renderHarmonyEditor()`, `showTooltip()`, `hideTooltip()`                                                                          |
| `ui-layout.js`  | `buildWidthControls()`, `updateWidthsDirtyIndicator()`                                                                                                    |
| `ui-project.js` | `buildProjectJSON()`, `importProject(json)`, `markProjectDirty()`, `markProjectSaved()`, `revertProject()`                                                |
| `main.js`       | `init()` (called once on DOMContentLoaded)                                                                                                                |

---

## HEJI labelling — Part B extension point

`js/heji.js` is intentionally isolated. Its current implementation produces
text-only labels using Unicode arrows and superscripts (a usable approximation
but not the correct HEJI notation).

**Part B will replace `heji.js` entirely** with an SVG-asset version that:
1. Loads the 64 PDF/SVG accidental glyphs from `assets/heji/`
2. Composes labels as inline SVG or `<img>` elements
3. Implements the full HEJI accidental logic per Sabat (2005):
   - Pythagorean base (e₃) → letter name relative to `baseTone`
   - e₅ → syntonic comma arrows (↑/↓, variant per Pythagorean accidental)
   - e₇ → septimal comma (hejiSeptimalUp/Down)
   - e₁₁ → undecimal (hejiUndecimalSharp/Flat)
   - e₁₃ → tridecimal (hejiTridecimalSharp/Flat)
   - e₁₇, e₁₉, e₂₃/₂₉, e₃₁, e₅₃ → schisma accidentals

The stable API (`getKeyLabel`, `expsToHEJI`, `getBaseToneOffset`) will not change.
All callers in `render.js` and `ui-harmony.js` will continue to work unchanged.

---

## Deployment

The app is a static multi-file site — no build step, no bundler.

```
deploy_website(
  project_path="/home/user/workspace/faithful-keyboard-v2",
  site_name="faithful-keyboard",
  entry_point="index.html"
)
```

To update: edit the relevant file, re-deploy with the same `project_path` and
`site_name`. The deployed URL stays the same.

The permanent public URL is:
https://www.perplexity.ai/computer/a/faithful-keyboard-fi7lR8igQnSOxNTvfbgaBw

---

## Adding a new waveform

1. Write `patchMySound(ctx, freq, vol, attack, now, masterGain)` in `audio.js`
2. Add a `case 'mysound':` in `playKeySustained` switch
3. Add `case 'mysound':` in `playKey` switch
4. Add `mysound: () => 0.55` to `PATCH_GAIN` (tune the base gain)
5. Add `<option value="mysound">My Sound</option>` to the waveform select in `index.html`

## Adding a new coordinate system

1. Add an entry to `COORD_SYSTEMS` in `coords.js`
2. Add `<option value="mycoord">...</option>` to `#coord-select` in `index.html`
3. No other changes needed — `buildWidthControls` and `getCurrentBasis` read `COORD_SYSTEMS` dynamically

## Adding a new key shape

1. Add a case to `buildKeyPath` in `render.js` that computes `points[]`
2. Add `<option value="myshape">My Shape</option>` to the key shape select in `ui-harmony.js` (`renderHarmonyEditor`)
