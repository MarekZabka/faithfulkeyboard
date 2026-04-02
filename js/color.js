// color.js
// Color functions: limitColor, pitchGradColor, widthGradColor, getKeyColor.
// ======================================================================


// ═════════════════════════════════════════════════════════════════════════════
//  COLOR
// ═════════════════════════════════════════════════════════════════════════════

function limitColor(limit) {
  const cs = getComputedStyle(document.documentElement);
  if (limit <= 3) return cs.getPropertyValue('--color-key-pythagorean').trim();
  if (limit <= 5) return cs.getPropertyValue('--color-key-syntonic').trim();
  if (limit <= 7) return cs.getPropertyValue('--color-key-septimal').trim();
  if (limit <= 11) return cs.getPropertyValue('--color-key-undecimal').trim();
  return cs.getPropertyValue('--color-key-13limit').trim();
}

function pitchGradColor(cents, minC, maxC) {
  const t = maxC > minC ? (cents-minC)/(maxC-minC) : 0.5;
  return `hsl(${240-t*240},70%,55%)`;
}

function widthGradColor(w, minW, maxW) {
  const t = maxW > minW ? (w-minW)/(maxW-minW) : 0.5;
  return `hsl(${120-t*120},65%,50%)`;
}

function getKeyColor(key, harmony, allKeys) {
  const mode = harmony.colorMode || 'uniform';
  if (mode === 'limit') {
    return limitColor(key.limit);
  } else if (mode === 'pitch') {
    // Cycle through octaves using cents
    const octCents = ((key.cents % 1200) + 1200) % 1200;
    return `hsl(${Math.round(octCents / 1200 * 360)},65%,55%)`;
  } else if (mode === 'width') {
    const allW = (allKeys || []).filter(k => k.harmonyId === key.harmonyId).map(k => k.width || 0);
    const minW = allW.length ? Math.min(...allW) : 0;
    const maxW = allW.length ? Math.max(...allW) : 1;
    return widthGradColor(key.width || 0, minW, maxW);
  }
  // uniform (default)
  return harmony.uniformColor || '#6490c4';
}
