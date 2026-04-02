// tones.js
// computeKeysForHarmony, getAllKeys, allKeysCache, releaseAllTouches.
// ======================================================================


// ═════════════════════════════════════════════════════════════════════════════
//  TONE COMPUTATION
// ═════════════════════════════════════════════════════════════════════════════

function getBaseFreq() { return parseFloat(document.getElementById('base-freq').value) || 261.63; }

// Get the current basis for width computation
function getCurrentBasis() {
  const coordSys = layout.coordSystem;
  if (coordSys === 'other' && layout.customBasis) return layout.customBasis;
  return COORD_SYSTEMS[coordSys].basis;
}

// Parse ratios for a harmony (respecting octaveEquiv flag)
// Returns array of { ratio, cents, freq, limit, x_logical, y_logical, label, harmonyId, harmonyName }
// Split a tone list string on commas that are NOT inside parentheses
function splitToneList(raw) {
  const result = [];
  let depth = 0, cur = '';
  for (const ch of raw) {
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth--; cur += ch; }
    else if (ch === ',' && depth === 0) {
      const t = cur.trim(); if (t) result.push(t);
      cur = '';
    } else { cur += ch; }
  }
  const t = cur.trim(); if (t) result.push(t);
  return result;
}

function computeKeysForHarmony(harmony, baseFreq) {
  const raw = harmony.ratios;
  const toneMode = harmony.toneMode || 'ratios';
  // For vector mode, commas inside () are separators within a vector — split outside parens only
  const parts = (toneMode === 'vectors') ? splitToneList(raw) : raw.split(',').map(s=>s.trim()).filter(Boolean);
  const parsedRatios = [];

  for (const p of parts) {
    if (toneMode === 'vectors') {
      const exps = parseVectorStr(p);
      if (exps) {
        // Keep original string as label (preserves fractions like 1/12)
        parsedRatios.push({expsOverride: exps, rawLabel: p.trim()});
        continue;
      }
      // fallback: try ratio parser
    } else if (toneMode === 'primepowers') {
      const exps = parsePrimePowersToExps(p);
      if (exps) {
        parsedRatios.push({expsOverride: exps});
        continue;
      }
      // fallback: try ratio parser
    }
    // ratios mode (or fallback): try formula evaluation first (handles (3/2)^2 etc.)
    if (toneMode === 'ratios') {
      try {
        const r = evalRationalExpr(p.replace(/\s+/g,''));
        if (r && !r.isFloat && r.n > 0 && r.d > 0) {
          // Push as {num, den} to match parseRatio format
          const g = _gcd(Math.abs(r.n), Math.abs(r.d));
          parsedRatios.push({num: r.n/g, den: r.d/g});
          continue;
        }
      } catch(e2) {}
    }
    const r = parseRatio(p);
    if (!r || r.expsOverride) {
      if (r && r.expsOverride) parsedRatios.push(r);
      continue;
    }
    parsedRatios.push(r);
  }

  const basis = getCurrentBasis();
  const keys = [];
  const seen = new Set();

  for (const r of parsedRatios) {
    const baseRatio = r.expsOverride ? r : (harmony.octaveEquiv ? reduceOctave(r) : r);
    const baseVal = r.expsOverride ? Math.exp(dot(r.expsOverride, H_VEC.map(x=>x/1200))*Math.LN2) : ratioVal(baseRatio);

    if (harmony.octaveEquiv && !r.expsOverride) {
      // Generate all octave transpositions within [20, 4000] Hz
      for (let oct = -10; oct <= 10; oct++) {
        const freq = baseFreq * baseVal * Math.pow(2, oct);
        if (freq < 18 || freq > 4200) continue;
        const ratio_cents = ratioToCents(baseRatio);
        const actual_cents = ratio_cents + oct * 1200;
        const exps = ratioExponents(baseRatio).map((e,i)=>i===0?e+oct:e);
        const width = computeWidth(exps, basis, layout.widths);
        const labelBase = r.expsOverride ? (r.rawLabel || `[${r.expsOverride.join(',')}]`) : formatRatio(baseRatio);
        const label = oct === 0 ? labelBase : `${labelBase}·2^${oct}`;
        const key = `${labelBase}_${oct}`;
        if (seen.has(key)) continue;
        seen.add(key);
        keys.push({
          ratio: baseRatio, label, cents: actual_cents, freq, width,
          limit: jiLimit(baseRatio),
          x_logical: actual_cents, y_logical: width,
          harmonyId: harmony.id, harmonyName: harmony.name,
          oct: oct,
          _exps: exps  // full prime exponent vector for HEJI
        });
      }
    } else {
      // No octave equivalence — use ratio exactly once
      const cents = r.expsOverride ? expsToHeight(r.expsOverride) : ratioToCents(r);
      const exps = r.expsOverride ? r.expsOverride : ratioExponents(r);
      const width = computeWidth(exps, basis, layout.widths);
      const label = r.expsOverride ? (r.rawLabel || `[${r.expsOverride.join(',')}]`) : formatRatio(r);
      if (seen.has(label)) continue;
      seen.add(label);
      keys.push({
        ratio: r.expsOverride ? null : r, label, cents, freq: baseFreq * Math.pow(2, cents/1200),
        width, limit: r.expsOverride ? 13 : jiLimit(r),
        x_logical: cents, y_logical: width,
        harmonyId: harmony.id, harmonyName: harmony.name,
        oct: null,
        _exps: exps  // full prime exponent vector for HEJI
      });
    }
  }

  keys.sort((a,b)=>a.cents-b.cents);
  return keys;
}

function getAllKeys() {
  const baseFreq = getBaseFreq();
  const allKeys = [];
  for (const h of harmonies) {
    if (!h.visible) continue;
    const keys = computeKeysForHarmony(h, baseFreq);
    for (const k of keys) k.harmony = h;
    allKeys.push(...keys);
  }
  return allKeys;
}
