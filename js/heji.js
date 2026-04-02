// heji.js
// HEJI tone name engine — correct implementation per Sabat & von Schweinitz (2004).
// Algorithm ported from toneLabelParts[] in Projections.nb (Marek Žabka).
// Public API: getKeyLabel(key, harmony), expsToHEJI(exps), getBaseToneOffset()
// ==========================================================================

// ── Base tone offset (fifths from D) ──────────────────────────────────────
// Each base tone maps to its position in the chain of fifths relative to D=0.
const HEJI_BASE_OFFSETS = { D: 0, A: 1, E: 2, B: 3, C: -2, G: -1, F: -3 };

function getBaseToneOffset() {
  const el = document.getElementById('base-tone');
  const tone = el ? el.value : 'D';
  return HEJI_BASE_OFFSETS[tone] !== undefined ? HEJI_BASE_OFFSETS[tone] : 0;
}

// ── SVG glyph cache and inline renderer ────────────────────────────────────
const HEJI_ASSET_PATH = 'assets/heji/';
const _hejiSVGCache = {};

function hejiImg(name) {
  if (_hejiSVGCache[name] && typeof _hejiSVGCache[name] === 'string') {
    return `<span class="heji-glyph" aria-label="${name}">${_hejiSVGCache[name]}</span>`;
  }
  if (!_hejiSVGCache[name]) {
    _hejiSVGCache[name] = fetch(HEJI_ASSET_PATH + name + '.svg')
      .then(r => r.text())
      .then(svgText => {
        const clean = svgText
          .replace(/<\?xml[^?]*\?>/g, '')
          .replace(/<svg([^>]*)>/, (_m, attrs) => {
            const noWH = attrs
              .replace(/\s*width="[^"]*"/, '')
              .replace(/\s*height="[^"]*"/, '');
            return `<svg${noWH} style="height:1.15em;width:auto;vertical-align:middle;display:inline-block;">`;
          });
        _hejiSVGCache[name] = clean;
        if (typeof renderSVG === 'function') renderSVG();
        return clean;
      })
      .catch(() => { _hejiSVGCache[name] = '?'; });
  }
  return `<span class="heji-glyph heji-loading" style="display:inline-block;width:0.5em;height:1em;"></span>`;
}

// ── Core algorithm (ported from Mathematica toneLabelParts[]) ──────────────
//
// The algorithm works by peeling off prime-limit "correction layers" one by one,
// from the outermost prime (13) inward to 3 (Pythagorean). Each layer subtracts
// the comma vector multiplied by the comma index, leaving a purer set of coords.
//
// Comma vectors (exponent arrays [e2, e3, e5, e7, e11, e13]):
//   syntonicComma    = [-4,  4, -1,  0,  0,  0]  81/80
//   septimalComma    = [ 6, -2,  0, -1,  0,  0]  64/63
//   undecimalComma   = [-5,  1,  0,  0,  1,  0]  33/32
//   tridecimalComma  = [-1,  3,  0,  0,  0, -1]  27/26

function expsToHEJI(exps) {
  // Pad exps to at least 6 elements
  const e = [];
  for (let i = 0; i < 6; i++) e.push(exps[i] || 0);

  // ── Step 1: 13-limit layer ──
  // tridecimalCommaIndex = -e[5]
  // Sign convention: negative e13 → positive index → TridecimalSharp
  //                  positive e13 → negative index → TridecimalFlat
  const tridecimalIdx = -e[5];
  // tridecimal comma = [-1, 3, 0, 0, 0, -1]
  const c13 = e.map((v, i) => v - tridecimalIdx * (i === 0 ? -1 : i === 1 ? 3 : i === 5 ? -1 : 0));

  // ── Step 2: 11-limit layer ──
  // undecimalCommaIndex = c13[4]  (e11 of the 13-corrected coords)
  const undecimalIdx = c13[4];
  // undecimal comma = [-5, 1, 0, 0, 1, 0]
  const c11 = c13.map((v, i) => v - undecimalIdx * (i === 0 ? -5 : i === 1 ? 1 : i === 4 ? 1 : 0));

  // ── Step 3: 7-limit layer ──
  // septimalCommaIndex = -c11[3]  (note the minus sign)
  const septimalIdx = -c11[3];
  // septimal comma = [6, -2, 0, -1, 0, 0]
  const c7 = c11.map((v, i) => v - septimalIdx * (i === 0 ? 6 : i === 1 ? -2 : i === 3 ? -1 : 0));

  // ── Step 4: 5-limit (syntonic) layer ──
  // syntonicCommaIndex = -c7[2]  (note the minus sign)
  const syntonicIdx = -c7[2];
  // syntonic comma = [-4, 4, -1, 0, 0, 0]
  const c5 = c7.map((v, i) => v - syntonicIdx * (i === 0 ? -4 : i === 1 ? 4 : i === 2 ? -1 : 0));

  // ── Step 5: Pythagorean spine ──
  // fifthIndex = c5[1]  (e3 of fully corrected coords — now purely Pythagorean)
  const fifthIndex = c5[1];

  // Shift by base tone: add the offset so the chosen base tone maps to fifthIndex=0
  // E.g. baseTone=E (offset=+2): 1/1 has fifthIndex=0, fi=0+2=2 → CHAIN[5]='E' ✓
  const fi = fifthIndex + getBaseToneOffset();

  // Letter name: {F,C,G,D,A,E,B} indexed by Mod[fi-3, 7, 1] (Mathematica 1-based)
  // JavaScript equivalent: ((fi + 3) % 7 + 7) % 7  gives 0-based index into:
  const CHAIN = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const letterIdx = ((fi + 3) % 7 + 7) % 7;
  const letter = CHAIN[letterIdx];

  // ── Step 6: Apotomic (sharp/flat) count ──
  // apotomicCommaIndex: number of apotomic (7-comma) steps needed to reach fifthIndex
  //   fi > 3:  Quotient[fi+4, 7, 1]  (Mathematica Quotient with offset 1)
  //   fi < -3: -Quotient[-fi+4, 7, 1]
  //   else:    0
  let apotomicIdx;
  if (fi > 3) {
    apotomicIdx = Math.floor((fi + 4 - 1) / 7);  // equivalent to Quotient[fi+4, 7, 1]
  } else if (fi < -3) {
    apotomicIdx = -Math.floor((-fi + 4 - 1) / 7);
  } else {
    apotomicIdx = 0;
  }

  // apotomicPreAccidentalCount: sharps/flats shown BEFORE the 5-limit glyph
  // When syntonicIdx !== 0, the 5-limit glyph "absorbs" one apotomic sign
  const absApotomic = Math.abs(apotomicIdx);
  const signApotomic = apotomicIdx > 0 ? 1 : apotomicIdx < 0 ? -1 : 0;
  const preAccidentalCount = signApotomic * (syntonicIdx === 0 ? absApotomic : Math.max(0, absApotomic - 1));

  // ── Step 7: Assemble glyph names ──
  const glyphs = []; // ordered: [preAccidentals..., fiveLimitMainAccidental, septimal, undecimal, tridecimal]

  // Pre-accidentals (plain hejiSharp / hejiFlat, repeated)
  const preAccGlyph = preAccidentalCount > 0 ? 'hejiSharp' : preAccidentalCount < 0 ? 'hejiFlat' : null;
  for (let i = 0; i < Math.abs(preAccidentalCount); i++) {
    if (preAccGlyph) glyphs.push(preAccGlyph);
  }

  // 5-limit main accidental (combines Pythagorean type with syntonic arrows)
  // When syntonicIdx === 0 AND the 5-limit base is "natural" (no apotomic) → no glyph (emptyToken)
  // When syntonicIdx !== 0, OR apotomicIdx !== 0 → show the composite glyph
  const fiveLimitGlyph = getFiveLimitGlyph(signApotomic, syntonicIdx);
  if (fiveLimitGlyph) glyphs.push(fiveLimitGlyph);

  // 7-limit: septimalIdx > 0 → SeptimalUp, < 0 → SeptimalDown
  if (septimalIdx > 0)      glyphs.push('hejiSeptimalUp');
  else if (septimalIdx < 0) glyphs.push('hejiSeptimalDown');
  if (Math.abs(septimalIdx) >= 2) {
    // Two septimal commas → use TwoSeptimal glyph instead of single
    // Remove the single we just added and replace with TwoSeptimal
    glyphs.pop();
    glyphs.push(septimalIdx > 0 ? 'hejiTwoSeptimalUp' : 'hejiTwoSeptimalDown');
  }

  // 11-limit: undecimalIdx > 0 → UndecimalSharp, < 0 → UndecimalFlat
  if (undecimalIdx > 0)      glyphs.push('hejiUndecimalSharp');
  else if (undecimalIdx < 0) glyphs.push('hejiUndecimalFlat');

  // 13-limit: tridecimalIdx > 0 → TridecimalSharp, < 0 → TridecimalFlat
  if (tridecimalIdx > 0)      glyphs.push('hejiTridecimalSharp');
  else if (tridecimalIdx < 0) glyphs.push('hejiTridecimalFlat');

  // ── Step 8: Build HTML ──
  if (glyphs.length === 0) {
    // Plain Pythagorean natural — just the letter, no glyph
    return `<span class="heji-label">`
         + `<span class="heji-letter">${letter}</span>`
         + `</span>`;
  }

  const glyphHTML = glyphs.map(name => hejiImg(name)).join('');
  return `<span class="heji-label" style="display:inline-flex;align-items:center;gap:1px;">`
       + `<span class="heji-letter" style="font-size:1em;line-height:1;">${letter}</span>`
       + glyphHTML
       + `</span>`;
}

// Returns the glyph name for the 5-limit main accidental, or null for emptyToken.
// signApotomic: -1 | 0 | 1  (flat / natural / sharp base)
// syntonicIdx:  integer (syntonic comma count, negative = down arrows)
function getFiveLimitGlyph(signApotomic, syntonicIdx) {
  if (syntonicIdx === 0) {
    // No 5-limit adjustment — the main accidental IS the Pythagorean one,
    // but since pre-accidental already covers it, nothing more to show.
    // Exception: if apotomicIdx != 0 and syntonicIdx = 0, the "absorbed" sharp/flat
    // shows as the main glyph type without arrows.
    // In the Mathematica code this returns emptyToken.
    return null;
  }

  const ARROW_SUFFIX = {
    3: 'UpUpUp', 2: 'UpUp', 1: 'Up', 0: null, [-1]: 'Down', [-2]: 'DownDown', [-3]: 'DownDownDown'
  };
  const suffix = ARROW_SUFFIX[syntonicIdx] || (syntonicIdx > 0 ? 'UpUpUp' : 'DownDownDown');
  if (!suffix) return null; // syntonicIdx === 0, already handled

  if (signApotomic === 1)       return 'hejiSharp'   + suffix;
  else if (signApotomic === -1) return 'hejiFlat'    + suffix;
  else                          return 'hejiNatural' + suffix;
}

// ── Public entry point ────────────────────────────────────────────────────
function getKeyLabel(key, h) {
  const type = h.labelType || 'ratio';
  if (type === 'cents') {
    return key.cents.toFixed(1) + '¢';
  }
  if (type === 'heji') {
    if (key._exps) {
      return expsToHEJI(key._exps);
    }
    if (key.ratio) {
      return expsToHEJI(ratioExponents(key.ratio)); // ratioExponents from math.js
    }
    return key.label;
  }
  return key.label;
}
