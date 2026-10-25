// Transformer algebra and geometry. No DOM or keyboard view state.
// A transformation is (q, inverted): x -> q*x or q/x.
// q is a formal exponent vector over the original harmony's tone letters.
const TransformerMath = (() => {
  const primes = [2, 3, 5, 7, 11, 13];
  const eps = 1e-10;
  function bgcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
  function rational(n, d = 1n) {
    if (n <= 0n || d <= 0n) throw new Error('Tones must be positive.');
    const g = bgcd(n, d); return { n: n / g, d: d / g };
  }
  function mul(a, b) { return rational(a.n * b.n, a.d * b.d); }
  function inv(a) { return { n: a.d, d: a.n }; }
  function pow(a, e) {
    if (!Number.isSafeInteger(e) || Math.abs(e) > 256) throw new Error('Transformation is too large.');
    const b = e < 0 ? inv(a) : a;
    return rational(b.n ** BigInt(Math.abs(e)), b.d ** BigInt(Math.abs(e)));
  }
  function normRat(a) {
    let {n, d} = a;
    while (n < d) n *= 2n;
    while (n >= 2n * d) d *= 2n;
    return rational(n, d);
  }
  function ratText(a) { return a.d === 1n ? String(a.n) : `${a.n}/${a.d}`; }
  function vectorLog(v) { return v.reduce((s, e, i) => s + e * Math.log2(primes[i]), 0); }
  function normVector(v) {
    const out = v.slice(), log = vectorLog(out);
    out[0] -= Math.floor(log + eps);
    return out.map(x => Math.abs(x) < eps ? 0 : x);
  }
  function ratVector(a) {
    let n = a.n, d = a.d;
    const v = primes.map(p => {
      const b = BigInt(p); let e = 0;
      while (n % b === 0n) { n /= b; e++; }
      while (d % b === 0n) { d /= b; e--; }
      return e;
    });
    return n === 1n && d === 1n ? v : null;
  }
  function vectorRat(v) {
    if (!v.every(Number.isSafeInteger) || v.some(e => Math.abs(e) > 256)) return null;
    return v.reduce((a, e, i) => mul(a, pow(rational(BigInt(primes[i])), e)), rational(1n));
  }
  function parse(text, mode) {
    const parts = splitToneList(text);
    if (!parts.length) throw new Error('Enter at least one tone to generate a neighborhood.');
    const tones = [], seen = new Set();
    for (const part of parts) {
      let r = null, v = null;
      if (mode === 'vectors') {
        v = parseVectorStr(part);
        if (!v || !v.every(Number.isFinite) || v.some(e => Math.abs(e) > 256))
          throw new Error(`Invalid vector: ${part}`);
        v = normVector(v); r = vectorRat(v);
      } else if (mode === 'primepowers') {
        v = parsePrimePowersToExps(part);
        if (!v || !v.every(Number.isFinite)) throw new Error(`Invalid tone: ${part}`);
        v = normVector(v); r = vectorRat(v);
      } else {
        const a = evalRationalExpr(part);
        if (!a || a.isFloat || !Number.isSafeInteger(a.n) || !Number.isSafeInteger(a.d))
          throw new Error(`Enter a positive exact frequency ratio: ${part}`);
        r = normRat(rational(BigInt(a.n), BigInt(a.d))); v = ratVector(r);
      }
      const log = r ? Math.log2(Number(r.n) / Number(r.d)) : vectorLog(v);
      const key = r ? ratText(r) : log.toFixed(10);
      if (seen.has(key)) continue;
      seen.add(key); tones.push({r, v, log, display: r ? ratText(r) : expsToString(v, 'vectors')});
    }
    if (tones.length > 16) throw new Error('Use at most 16 distinct octave-equivalent tones per neighborhood.');
    tones.sort((a, b) => a.log - b.log);
    tones.forEach((t, i) => { t.letter = String.fromCharCode(97 + i); });
    return tones;
  }
  function identity(n) { return { q: Array(n).fill(0), inverted: false }; }
  function local(n, i, j, inverted) {
    const q = Array(n).fill(0); q[i]++; q[j] += inverted ? 1 : -1;
    return { q, inverted };
  }
  // local # parent. Equivalent to parent ∘ local on original tones:
  // s#s=s*s, w#s=w*s, s#w=w/s, w#w=w/w.
  function compose(localOp, parent) {
    return {
      q: parent.q.map((e, i) => e + (parent.inverted ? -1 : 1) * localOp.q[i]),
      inverted: localOp.inverted !== parent.inverted
    };
  }
  function monomial(op) {
    const top = [], bottom = [];
    op.q.forEach((e, i) => {
      if (!e) return;
      (e > 0 ? top : bottom).push(String.fromCharCode(97 + i) + (Math.abs(e) === 1 ? '' : `^${Math.abs(e)}`));
    });
    return (top.join('') || '1') + (bottom.length ? '/' + bottom.join('') : '');
  }
  function opKey(op) { return `${op.inverted ? 'w' : 's'}:${op.q.join(',')}`; }
  function image(tones, op) {
    return tones.map(t => {
      let r = tones.every(x => x.r) ? rational(1n) : null;
      let v = tones.every(x => x.v) ? Array(6).fill(0) : null;
      tones.forEach((x, i) => {
        if (r) r = mul(r, pow(x.r, op.q[i]));
        if (v) v = v.map((e, k) => e + x.v[k] * op.q[i]);
      });
      if (r) r = normRat(mul(r, op.inverted ? inv(t.r) : t.r));
      if (v) v = normVector(v.map((e, k) => e + (op.inverted ? -1 : 1) * t.v[k]));
      const log = r ? Math.log2(Number(r.n) / Number(r.d)) : vectorLog(v);
      return {r, v, log, letter: t.letter, display: r ? ratText(r) : expsToString(v, 'vectors')};
    });
  }
  function imageKey(tones, op) {
    return [...new Set(image(tones, op).map(t => t.r ? ratText(t.r) : t.log.toFixed(10)))].sort().join('|');
  }
  function imageText(tones, op, mode) {
    const out = image(tones, op).sort((a, b) => a.log - b.log), seen = new Set();
    return out.map(t => {
      let text;
      if (mode === 'vectors' || mode === 'primepowers') {
        if (!t.v) throw new Error('This tone contains primes beyond the supported vector basis.');
        text = expsToString(t.v, mode);
      } else text = t.r ? ratText(t.r) : expsToString(t.v, 'primepowers');
      if (seen.has(text)) return null;
      seen.add(text); return text;
    }).filter(Boolean).join(', ');
  }
  // Use one geometric basis for the original tone letters. For unflipped
  // Schritts, P(q) = sum(q_i * p_i), so composing an operation must add the
  // local displacement with exactly the same sign used by compose().
  // Transformed frequencies are circle labels, not a new angular basis:
  // reusing their phases rotates/reverses each neighborhood a second time.
  function neighborhood(tones, parent, origin, settings) {
    const radius = settings.circle.size, rot = settings.circle.rotation * Math.PI / 180;
    const transformed = image(tones, parent);
    const direction = parent.inverted ? -1 : 1;
    const p = tones.map(t => {
      const angle = 2 * Math.PI * t.log + rot;
      return [direction * radius * Math.sin(angle), -direction * radius * Math.cos(angle)];
    });
    const addOrigin = v => [v[0] + origin[0], v[1] + origin[1]];
    const circles = p.map((v, i) => ({center: addOrigin(v), radius, tone: transformed[i], secondary: false}));
    if (settings.showSchritts && settings.flipSchritts) p.forEach(v => {
      circles.push({center: addOrigin(v.map(x => x * (2 + settings.secondarySize / radius))),
        radius: settings.secondarySize, secondary: true});
    });
    const nodes = [{slot: 'origin', op: parent, point: origin, origin: true}];
    for (let i = 0; i < tones.length; i++) {
      for (let j = i; j < tones.length; j++) {
        nodes.push({slot: `w:${i}:${j}`, op: compose(local(tones.length, i, j, true), parent),
          point: addOrigin([p[i][0] + p[j][0], p[i][1] + p[j][1]])});
      }
      if (settings.showSchritts) for (let j = 0; j < tones.length; j++) {
        if (i === j) continue;
        let v = [p[i][0] - p[j][0], p[i][1] - p[j][1]];
        if (settings.flipSchritts) v = v.map((x, k) => 2 * p[i][k] + (2 * p[i][k] - x) * settings.secondarySize / radius);
        nodes.push({slot: `s:${i}:${j}`, op: compose(local(tones.length, i, j, false), parent), point: addOrigin(v)});
      }
    }
    return {circles, nodes};
  }
  return {parse, identity, local, compose, monomial, opKey, image, imageKey, imageText, neighborhood};
})();
