// ui-project.js
// Project management: buildProjectJSON, importProject, downloadProjectJSON, tone mode conversion, transposeHarmony.
// ======================================================================


//  TONE DEFINITION MODE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Rational number arithmetic helpers
function _gcd(a, b) { a=Math.abs(a); b=Math.abs(b); while(b){let t=b;b=a%b;a=t;} return a||1; }
function _ratReduce(n, d) {
  if (!d) return null;
  const g = _gcd(Math.abs(n), Math.abs(d));
  if (d < 0) { n=-n; d=-d; }
  return {n:n/g, d:d/g};
}
function _ratMul(a, b) { return _ratReduce(a.n*b.n, a.d*b.d); }
function _ratDiv(a, b) { return _ratReduce(a.n*b.d, a.d*b.n); }
function _ratPow(a, exp) {
  const en = exp.n, ed = exp.d;
  if (ed === 1) {
    if (en >= 0) return _ratReduce(Math.pow(a.n,en), Math.pow(a.d,en));
    else return _ratReduce(Math.pow(a.d,-en), Math.pow(a.n,-en));
  }
  const val = Math.pow(a.n/a.d, en/ed);
  return {n: val, d: 1, isFloat: true};
}

// Parse a rational expression string (supports +,-,*,/,^,(,))
function evalRationalExpr(s) {
  s = s.replace(/\s+/g,'');
  let pos = 0;

  function consumeIf(c) { if(s[pos]===c){pos++;return true;}return false; }

  function parseExpr() {
    let left = parseTerm();
    while (pos < s.length) {
      if (s[pos] === '*') { pos++; left = _ratMul(left, parseTerm()); }
      else if (s[pos] === '/' && s[pos+1] !== ')') { pos++; left = _ratDiv(left, parseTerm()); }
      else break;
    }
    return left;
  }

  function parseTerm() {
    let base = parseAtom();
    if (s[pos] === '^') {
      pos++;
      const exp = parseExponent();
      base = _ratPow(base, exp);
    }
    return base;
  }

  function parseAtom() {
    if (s[pos] === '(') {
      pos++;
      const val = parseExpr();
      if (s[pos] !== ')') throw new Error('Expected )');
      pos++;
      return val;
    }
    return parseNumber();
  }

  function parseExponent() {
    if (s[pos] === '(') {
      pos++;
      const neg = consumeIf('-');
      const n = parseIntOrFloat();
      let d = 1;
      if (s[pos] === '/') { pos++; d = parseIntOrFloat(); }
      if (s[pos] !== ')') throw new Error('Expected )');
      pos++;
      return {n: neg ? -n : n, d};
    }
    const neg = consumeIf('-');
    const n = parseIntOrFloat();
    let d = 1;
    if (s[pos] === '/') { pos++; d = parseIntOrFloat(); }
    return {n: neg ? -n : n, d};
  }

  function parseNumber() {
    const neg = consumeIf('-');
    const n = parseIntOrFloat();
    let d = 1;
    if (s[pos] === '/') {
      pos++;
      d = parseIntOrFloat();
    }
    const r = _ratReduce(neg ? -n : n, d);
    return r;
  }

  function parseIntOrFloat() {
    let start = pos;
    while (pos < s.length && (s[pos] >= '0' && s[pos] <= '9' || s[pos] === '.')) pos++;
    const numStr = s.slice(start, pos);
    if (!numStr) throw new Error('Expected number at pos '+pos);
    return parseFloat(numStr);
  }

  const result = parseExpr();
  if (pos < s.length) throw new Error('Unexpected: ' + s[pos]);
  return result;
}

// Format a rational {n,d} as "n/d" or "n" if d=1
function _formatRat(r) {
  if (!r) return '?';
  if (r.isFloat) return r.n.toFixed(6).replace(/\.?0+$/,'');
  if (r.d === 1) return String(r.n);
  return r.n + '/' + r.d;
}

// Factorize a ratio n/d into prime exponents [e2,e3,e5,e7,e11,e13]
const PRIMES_LIST = [2,3,5,7,11,13];
function factorizeRatio(n, d) {
  const exps = [0,0,0,0,0,0];
  let nn = Math.round(n), dd = Math.round(d);
  for (let i=0; i<PRIMES_LIST.length; i++) {
    const p = PRIMES_LIST[i];
    while (nn % p === 0) { nn /= p; exps[i]++; }
    while (dd % p === 0) { dd /= p; exps[i]--; }
  }
  if (nn !== 1 || dd !== 1) return null; // has non-13-limit factors
  return exps;
}

// Convert ratio string to exps via evalRationalExpr
function ratioToExpsFromStr(str) {
  try {
    const r = evalRationalExpr(str.trim().replace(/\s+/g,''));
    if (!r || r.isFloat) return null;
    if (r.n <= 0) return null;
    return factorizeRatio(r.n, r.d);
  } catch(e) { return null; }
}

// Simplify a comma-separated list of ratio expressions to canonical form
function simplifyRatioList(text, mode) {
  // Vectors are already in canonical form — no simplification needed; use paren-aware split
  if (mode === 'vectors') {
    const parts = splitToneList(text);
    return parts.join(', ');
  }
  const parts = text.split(',');
  return parts.map(p => {
    p = p.trim();
    if (!p) return p;
    try {
      const r = evalRationalExpr(p.replace(/\s+/g,''));
      if (r && !r.isFloat && r.d > 0) return _formatRat(r);
      if (r && r.isFloat) return _formatRat(r);
      return p;
    } catch(e) { return p; }
  }).join(', ');
}

// Convert prime exponent vector to string representation
function expsToString(exps, mode) {
  if (mode === 'vectors') {
    let last = exps.length-1;
    while (last > 1 && exps[last] === 0) last--;
    return '(' + exps.slice(0, last+1).join(', ') + ')';
  }
  // 'primepowers' mode
  const parts = [];
  for (let i=0; i<PRIMES_LIST.length; i++) {
    if (exps[i] === 0) continue;
    const e = exps[i];
    if (e === 1) parts.push(PRIMES_LIST[i]+'');
    else if (e >= 0) parts.push(`${PRIMES_LIST[i]}^${e}`);
    else parts.push(`${PRIMES_LIST[i]}^(${e})`);
  }
  return parts.length ? parts.join(' * ') : '1';
}

// Parse a single exponent token — supports integers, decimals, and fractions like 1/4 or -3/2
function _parseExpToken(s) {
  s = s.trim();
  const slash = s.indexOf('/');
  if (slash !== -1) {
    const num = parseFloat(s.slice(0, slash).trim());
    const den = parseFloat(s.slice(slash+1).trim());
    if (isNaN(num) || isNaN(den) || den === 0) return NaN;
    return num / den;
  }
  return parseFloat(s);
}

// Parse a vector string "(e2, e3, e5, ...)" → exps array
function parseVectorStr(str) {
  str = str.trim();
  if (str.startsWith('(') && str.endsWith(')')) str = str.slice(1,-1);
  const parts = str.split(',').map(s=>_parseExpToken(s));
  if (parts.some(isNaN)) return null;
  const exps = [0,0,0,0,0,0];
  for (let i=0; i<Math.min(parts.length,6); i++) exps[i] = parts[i];
  return exps;
}

// Parse a prime-powers expression to exps vector
function parsePrimePowersToExps(str) {
  try {
    const r = evalRationalExpr(str.trim().replace(/\s+/g,''));
    if (r && !r.isFloat && r.n > 0) {
      return factorizeRatio(r.n, r.d);
    }
    return null;
  } catch(e) { return null; }
}

// Convert a harmony's tone string from one mode to another
function convertToneMode(text, fromMode, toMode) {
  if (fromMode === toMode) return {text, warnings:[]};
  // Vectors use parens — split outside parens to avoid splitting inside (e2, e3) vectors
  const parts = (fromMode === 'vectors') ? splitToneList(text) : text.split(',').map(s=>s.trim()).filter(Boolean);
  const warnings = [];
  const out = [];

  for (const part of parts) {
    if (fromMode === 'ratios') {
      const exps = ratioToExpsFromStr(part);
      if (!exps) {
        warnings.push(`Cannot convert "${part}" to prime factorization`);
        out.push(part);
        continue;
      }
      if (toMode === 'primepowers') out.push(expsToString(exps, 'primepowers'));
      else out.push(expsToString(exps, 'vectors'));
    } else if (fromMode === 'primepowers') {
      if (toMode === 'vectors') {
        const exps = parsePrimePowersToExps(part);
        if (!exps) { warnings.push(`Cannot convert "${part}"`); out.push(part); continue; }
        out.push(expsToString(exps, 'vectors'));
      } else { // to ratios
        const exps = parsePrimePowersToExps(part);
        if (!exps) { warnings.push(`Cannot convert "${part}" — non-integer exponents`); out.push(part); continue; }
        if (exps.some(e=>e!==Math.round(e))) { warnings.push(`"${part}" has non-integer exponents — cannot convert to ratio`); out.push(part); continue; }
        let n=1, d=1;
        for(let i=0;i<6;i++) {
          const e=Math.round(exps[i]);
          if (e>0) n*=Math.pow(PRIMES_LIST[i],e);
          else if (e<0) d*=Math.pow(PRIMES_LIST[i],-e);
        }
        out.push(_formatRat(_ratReduce(n,d)));
      }
    } else { // vectors
      const exps = parseVectorStr(part);
      if (!exps) { warnings.push(`Cannot parse vector "${part}"`); out.push(part); continue; }
      if (toMode === 'primepowers') out.push(expsToString(exps, 'primepowers'));
      else { // to ratios
        if (exps.some(e=>e!==Math.round(e))) { warnings.push(`"${part}" has non-integer exponents — cannot convert to ratio`); out.push(part); continue; }
        let n=1, d=1;
        for(let i=0;i<6;i++) {
          const e=Math.round(exps[i]);
          if (e>0) n*=Math.pow(PRIMES_LIST[i],e);
          else if (e<0) d*=Math.pow(PRIMES_LIST[i],-e);
        }
        out.push(_formatRat(_ratReduce(n,d)));
      }
    }
  }
  return {text: out.join(', '), warnings};
}

// Transpose a harmony by multiplying each tone by an interval
function transposeHarmony(h, intervalStr, toneMode) {
  toneMode = toneMode || h.toneMode || 'ratios';
  try {
    if (toneMode === 'ratios') {
      const interval = evalRationalExpr(intervalStr.replace(/\s+/g,''));
      if (!interval || interval.isFloat) { alert('Could not parse interval: ' + intervalStr); return; }
      const parts = h.ratios.split(',').map(s=>s.trim()).filter(Boolean);
      const newParts = parts.map(p => {
        try {
          const r = evalRationalExpr(p.replace(/\s+/g,''));
          if (!r || r.isFloat) return p;
          const mul = _ratMul(r, interval);
          return _formatRat(mul);
        } catch(e) { return p; }
      });
      h.ratios = newParts.join(', ');
    } else if (toneMode === 'vectors') {
      const ivec = parseVectorStr(intervalStr);
      if (!ivec) { alert('Could not parse vector: ' + intervalStr); return; }
      const parts = splitToneList(h.ratios);
      const newParts = parts.map(p => {
        const v = parseVectorStr(p);
        if (!v) return p;
        const res = v.map((e,i) => e + (ivec[i]||0));
        let lastNz = 1; for(let _i=res.length-1;_i>=0;_i--){if(res[_i]!==0){lastNz=_i;break;}} return '(' + res.slice(0, Math.max(2, lastNz+1)+1).join(', ') + ')';
      });
      h.ratios = newParts.join(', ');
    } else {
      // primepowers: convert to exps, add, convert back
      const ivec = ratioToExpsFromStr(intervalStr) || parsePrimePowersToExps(intervalStr);
      if (!ivec) { alert('Could not parse interval: ' + intervalStr); return; }
      const parts = h.ratios.split(',').map(s=>s.trim()).filter(Boolean);
      const newParts = parts.map(p => {
        const exps = parsePrimePowersToExps(p);
        if (!exps) return p;
        const res = exps.map((e,i) => e + (ivec[i]||0));
        return expsToString(res, 'primepowers');
      });
      h.ratios = newParts.join(', ');
    }
  } catch(e) {
    alert('Transpose error: ' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROJECT NAME
// ─────────────────────────────────────────────────────────────────────────────
let projectName = 'My Project';

function initProjectName() {
  const display = document.getElementById('project-name-display');
  const editBtn = document.getElementById('project-name-edit-btn');
  const input = document.getElementById('project-name-input');
  if (!display || !editBtn || !input) return;

  function startEdit() {
    display.style.display = 'none';
    editBtn.style.display = 'none';
    input.style.display = '';
    input.value = projectName;
    input.focus();
    input.select();
  }
  function finishEdit() {
    projectName = input.value.trim() || 'My Project';
    display.textContent = projectName;
    display.style.display = '';
    editBtn.style.display = '';
    input.style.display = 'none';
    // Update header center
    const hdr = document.getElementById('header-project-name');
    if (hdr) hdr.textContent = projectIsDirty ? projectName + ' *' : projectName;
    markProjectDirty();
  }
  editBtn.addEventListener('click', startEdit);
  display.addEventListener('dblclick', startEdit);
  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finishEdit(); }
    if (e.key === 'Escape') { input.value = projectName; finishEdit(); }
  });
}

// Project description change handler (wired after DOM ready)
function initProjectDescription() {
  const descEl = document.getElementById('project-description');
  if (descEl) {
    descEl.value = projectDescription;
    descEl.addEventListener('input', e => {
      projectDescription = e.target.value;
      markProjectDirty();
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════

//  EXPORT / IMPORT
// ═════════════════════════════════════════════════════════════════════════════

function buildProjectJSON() {
  const project = {
    version: 1,
    appName: 'Faithful Keyboard',
    projectName: projectName,
    projectDescription: projectDescription,
    harmonies: harmonies.map(h => ({
      id: h.id, name: h.name, visible: h.visible,
      ratios: h.ratios, octaveEquiv: h.octaveEquiv,
      showLabels: h.showLabels, labelFontSize: h.labelFontSize,
      labelOffsetX: h.labelOffsetX, labelOffsetY: h.labelOffsetY,
      labelColor: h.labelColor || '',
      labelType: h.labelType || 'ratio',
      toneMode: h.toneMode || 'ratios',
      keySize: h.keySize !== undefined ? h.keySize : 120,
      keyShape: h.keyShape, keyRotation: h.keyRotation,
      keyRounding: h.keyRounding || 0, keyEdge: h.keyEdge || 'straight', keyBulge: h.keyBulge !== undefined ? h.keyBulge : 0.2,
      keyStretchX: h.keyStretchX, keyStretchY: h.keyStretchY,
      colorMode: h.colorMode, uniformColor: h.uniformColor,
      opacity: h.opacity !== undefined ? h.opacity : 1.0,
      keyOffsetX: h.keyOffsetX !== undefined ? h.keyOffsetX : 0,
      keyOffsetY: h.keyOffsetY !== undefined ? h.keyOffsetY : 0,
      connectTones: h.connectTones !== undefined ? h.connectTones : true,
      connectStyle: h.connectStyle || 'curve',
      connectColor: h.connectColor || '#888888',
      connectWidth: h.connectWidth !== undefined ? h.connectWidth : 2
    })),
    layout: {
      coordSystem: layout.coordSystem,
      customBasis: layout.customBasis,
      widths: layout.widths,
      savedWidths: layout.savedWidths,
      widthScopes: layout.widthScopes,
      keySize: layout.keySize,
      showOctaveLines: layout.showOctaveLines,
      showSemitoneLines: layout.showSemitoneLines,
      keyboardRotation: layout.keyboardRotation,
      viewStretchX: layout.viewStretchX || 1,
      viewStretchY: layout.viewStretchY || 1,
      savedView: { baseScaleX, baseScaleY, zoomFactor, panX: Math.round(viewState.panX), panY: Math.round(viewState.panY), rotation: layout.keyboardRotation||0, stretchX: layout.viewStretchX||1, stretchY: layout.viewStretchY||1 },
      octaveEquiv: layout.octaveEquiv !== undefined ? layout.octaveEquiv : true,
      octaveLineColor: layout.octaveLineColor || '#aaaaaa',
      octaveLineWidth: layout.octaveLineWidth || 1,
      semitoneLineColor: layout.semitoneLineColor || '#aaaaaa',
      semitoneLineWidth: layout.semitoneLineWidth || 0.5,
      showMajorWidthLines: layout.showMajorWidthLines !== false,
      majorWidthInterval: layout.majorWidthInterval || 10,
      majorWidthColor: layout.majorWidthColor || '#aaaaaa',
      majorWidthStroke: layout.majorWidthStroke || 1,
      showMinorWidthLines: !!layout.showMinorWidthLines,
      minorWidthInterval: layout.minorWidthInterval || 1,
      minorWidthColor: layout.minorWidthColor || '#aaaaaa',
      minorWidthStroke: layout.minorWidthStroke || 0.5,
      bgColor: layout.bgColor || null
    },
    baseFreq: getBaseFreq(),
    baseTone: (document.getElementById('base-tone') ? document.getElementById('base-tone').value : 'D'),
    sound: {
      waveform: document.getElementById('waveform').value,
      attack: parseFloat(document.getElementById('env-attack').value),
      release: parseFloat(document.getElementById('env-release').value),
      sustain: parseFloat(document.getElementById('env-sustain').value),
      volume: parseFloat(document.getElementById('master-vol').value)
    }
  };
  return JSON.stringify(project, null, 2);
}

function downloadProjectJSON(json, filename) {
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename || 'project.json';
  a.click();
  URL.revokeObjectURL(url);
}

function newProject() {
  if (projectIsDirty) {
    const choice = confirm('Unsaved changes. Save before creating new project?\nOK = Save first, Cancel = Discard changes');
    if (choice) {
      saveProject();
      return;
    }
  }
  // Reset to blank
  harmonies = [];
  selectedHarmonyId = null;
  nextHarmonyId = 1;
  projectName = 'My Project';
  projectDescription = '';
  currentFileHandle = null;
  layout.coordSystem = 'reduced';
  layout.widths = [0, 2.0, 4.5, 4.0, 3.5, 1.6];
  layout.savedWidths = [...layout.widths];
  layout.keyboardRotation = 0;
  layout.viewStretchX = 1.0; layout.viewStretchY = 1.0;
  layout.savedView = null;
  layout.octaveEquiv = true;
  document.getElementById('project-name-display').textContent = projectName;
  document.getElementById('project-name-input').value = projectName;
  document.getElementById('header-project-name').textContent = projectName;
  const descEl = document.getElementById('project-description');
  if (descEl) descEl.value = '';
  buildWidthControls();
  renderHarmonyList();
  renderHarmonyEditor();
  allKeysCache = [];
  renderSVG();
  markProjectSaved();
}

async function openProject() {
  if (window.showOpenFilePicker) {
    try {
      const [fh] = await window.showOpenFilePicker({
        types: [{ description: 'Keyboard Project', accept: {'application/json': ['.json']} }]
      });
      currentFileHandle = fh;
      const file = await fh.getFile();
      importProject(await file.text());
    } catch(e) {
      if (e.name !== 'AbortError') alert('Error opening file: ' + e.message);
    }
  } else {
    document.getElementById('import-file').click();
  }
}

async function saveProject() {
  saveCurrentView(); // persist current view into layout.savedView before saving
  const json = buildProjectJSON();
  if (window.showSaveFilePicker && !currentFileHandle) {
    try {
      currentFileHandle = await window.showSaveFilePicker({
        suggestedName: (projectName||'project').replace(/[^a-zA-Z0-9_\-. ]/g,'_') + '.json',
        types: [{ description: 'Keyboard Project', accept: {'application/json': ['.json']} }]
      });
    } catch(e) {
      if (e.name !== 'AbortError') {
        // Fall through to download
        downloadProjectJSON(json, (projectName||'project').replace(/[^a-zA-Z0-9_\-. ]/g,'_') + '.json');
        markProjectSaved();
      }
      return;
    }
  }
  if (currentFileHandle) {
    try {
      const writable = await currentFileHandle.createWritable();
      await writable.write(json);
      await writable.close();
      markProjectSaved();
    } catch(e) {
      alert('Error saving: ' + e.message);
    }
  } else {
    downloadProjectJSON(json, (projectName||'project').replace(/[^a-zA-Z0-9_\-. ]/g,'_') + '.json');
    markProjectSaved();
  }
}

async function saveProjectCopy() {
  const json = buildProjectJSON();
  if (window.showSaveFilePicker) {
    try {
      const fh = await window.showSaveFilePicker({
        suggestedName: (projectName||'project').replace(/[^a-zA-Z0-9_\-. ]/g,'_') + '-copy.json',
        types: [{ description: 'Keyboard Project', accept: {'application/json': ['.json']} }]
      });
      const writable = await fh.createWritable();
      await writable.write(json);
      await writable.close();
    } catch(e) {
      if (e.name !== 'AbortError') {
        downloadProjectJSON(json, (projectName||'project').replace(/[^a-zA-Z0-9_\-. ]/g,'_') + '-copy.json');
      }
    }
  } else {
    downloadProjectJSON(json, (projectName||'project').replace(/[^a-zA-Z0-9_\-. ]/g,'_') + '-copy.json');
  }
}

function importHarmoniesFromFile(jsonStr) {
  try {
    const project = JSON.parse(jsonStr);
    if (!project.harmonies || !Array.isArray(project.harmonies)) {
      alert('No harmonies found in file.'); return;
    }
    const modal = document.getElementById('import-harmonies-modal');
    const listEl = document.getElementById('import-harmonies-list');
    listEl.innerHTML = '';
    project.harmonies.forEach((h, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.5rem;';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = true; cb.id = 'ih-cb-' + i;
      cb.dataset.idx = i;
      cb.style.cssText = 'accent-color:var(--color-primary);width:14px;height:14px;';
      const lbl = document.createElement('label');
      lbl.htmlFor = 'ih-cb-' + i;
      lbl.style.cssText = 'font-size:var(--text-sm);cursor:pointer;';
      lbl.textContent = h.name || ('Harmony ' + (i+1));
      row.appendChild(cb); row.appendChild(lbl);
      listEl.appendChild(row);
    });
    modal._importData = project.harmonies;
    modal.style.display = 'flex';
  } catch(e) {
    alert('Error parsing file: ' + e.message);
  }
}

function importProject(jsonStr) {
  try {
    const project = JSON.parse(jsonStr);
    if (!project.version || project.appName !== 'Faithful Keyboard') {
      alert('Invalid project file.');
      return;
    }
    // Load harmonies
    harmonies = (project.harmonies || []).map(h => {
      const newH = makeHarmony(h);
      newH.id = h.id; // preserve IDs
      newH.visible = h.visible !== false;
      newH.savedState = snapshotHarmony(newH);
      return newH;
    });
    // Update nextHarmonyId to avoid collisions
    const maxNum = harmonies.map(h=>parseInt(h.id.replace('h',''))||0).reduce((a,b)=>Math.max(a,b),0);
    nextHarmonyId = maxNum + 1;
    selectedHarmonyId = harmonies.length ? harmonies[0].id : null;
    if (project.projectName) {
      projectName = project.projectName;
      const d=document.getElementById('project-name-display'); if(d) d.textContent=projectName;
      const inp=document.getElementById('project-name-input'); if(inp) inp.value=projectName;
      const hdr=document.getElementById('header-project-name'); if(hdr) hdr.textContent=projectName;
    }
    if (project.projectDescription !== undefined) {
      projectDescription = project.projectDescription || '';
      const descEl = document.getElementById('project-description');
      if (descEl) descEl.value = projectDescription;
    }

    // Load layout
    if (project.layout) {
      layout.coordSystem = project.layout.coordSystem || 'reduced';
      layout.customBasis = project.layout.customBasis || null;
      layout.widths = project.layout.widths || [0,0.9,4.5,4.0,3.5,1.6];
      layout.savedWidths = project.layout.savedWidths || [...layout.widths];
      layout.widthScopes = project.layout.widthScopes || new Array(6).fill(5);
      layout.keySize = project.layout.keySize || 80;
      layout.showOctaveLines = project.layout.showOctaveLines !== false;
      layout.showSemitoneLines = !!project.layout.showSemitoneLines;
      layout.keyboardRotation = project.layout.keyboardRotation || 0;
      layout.viewStretchX = project.layout.viewStretchX !== undefined ? project.layout.viewStretchX : 1;
      layout.viewStretchY = project.layout.viewStretchY !== undefined ? project.layout.viewStretchY : 1;
      layout.savedView = project.layout.savedView || null;
      layout.octaveEquiv = project.layout.octaveEquiv !== undefined ? project.layout.octaveEquiv : true;
      layout.octaveLineColor = project.layout.octaveLineColor || '#aaaaaa';
      layout.octaveLineWidth = project.layout.octaveLineWidth !== undefined ? project.layout.octaveLineWidth : 1;
      layout.semitoneLineColor = project.layout.semitoneLineColor || '#aaaaaa';
      layout.semitoneLineWidth = project.layout.semitoneLineWidth !== undefined ? project.layout.semitoneLineWidth : 0.5;
      layout.showMajorWidthLines = project.layout.showMajorWidthLines !== false;
      layout.majorWidthInterval = project.layout.majorWidthInterval || 10;
      layout.majorWidthColor = project.layout.majorWidthColor || '#aaaaaa';
      layout.majorWidthStroke = project.layout.majorWidthStroke !== undefined ? project.layout.majorWidthStroke : 1;
      layout.showMinorWidthLines = !!project.layout.showMinorWidthLines;
      layout.minorWidthInterval = project.layout.minorWidthInterval || 1;
      layout.minorWidthColor = project.layout.minorWidthColor || '#aaaaaa';
      layout.minorWidthStroke = project.layout.minorWidthStroke !== undefined ? project.layout.minorWidthStroke : 0.5;
      layout.bgColor = project.layout.bgColor || null;
    }
    if (project.baseFreq) document.getElementById('base-freq').value = project.baseFreq;
    if (project.baseTone) { const el = document.getElementById('base-tone'); if (el) el.value = project.baseTone; }
    if (project.sound) {
      if (project.sound.waveform) document.getElementById('waveform').value = project.sound.waveform;
      if (project.sound.attack !== undefined) document.getElementById('env-attack').value = project.sound.attack;
      if (project.sound.release !== undefined) document.getElementById('env-release').value = project.sound.release;
      if (project.sound.sustain !== undefined) document.getElementById('env-sustain').value = project.sound.sustain;
      if (project.sound.volume !== undefined) document.getElementById('master-vol').value = project.sound.volume;
    }

    // Update UI
    document.getElementById('coord-select').value = layout.coordSystem;
    document.getElementById('custom-basis-wrap').style.display = layout.coordSystem==='other'?'':'none';
    document.getElementById('show-octave-lines').checked = layout.showOctaveLines;
    document.getElementById('show-semitone-lines').checked = layout.showSemitoneLines;
    // Sync new layout line controls
    ['octave-line-color','semitone-line-color','major-width-color','minor-width-color'].forEach(id => {
      const el = document.getElementById(id);
      const propMap = {'octave-line-color':'octaveLineColor','semitone-line-color':'semitoneLineColor','major-width-color':'majorWidthColor','minor-width-color':'minorWidthColor'};
      if (el && layout[propMap[id]]) el.value = layout[propMap[id]];
    });
    ['octave-line-width','semitone-line-width','major-width-interval','major-width-stroke','minor-width-interval','minor-width-stroke'].forEach(id => {
      const el = document.getElementById(id);
      const propMap = {'octave-line-width':'octaveLineWidth','semitone-line-width':'semitoneLineWidth','major-width-interval':'majorWidthInterval','major-width-stroke':'majorWidthStroke','minor-width-interval':'minorWidthInterval','minor-width-stroke':'minorWidthStroke'};
      if (el && layout[propMap[id]] !== undefined) el.value = layout[propMap[id]];
    });
    const mwlCb = document.getElementById('show-major-width-lines');
    if (mwlCb) { mwlCb.checked = layout.showMajorWidthLines !== false; const d = document.getElementById('major-width-line-opts'); if(d) d.style.display = mwlCb.checked ? 'flex' : 'none'; }
    const mnwlCb = document.getElementById('show-minor-width-lines');
    if (mnwlCb) { mnwlCb.checked = !!layout.showMinorWidthLines; const d = document.getElementById('minor-width-line-opts'); if(d) d.style.display = mnwlCb.checked ? 'flex' : 'none'; }
    if (layout.bgColor) { const bgEl = document.getElementById('bg-color'); if(bgEl) bgEl.value = layout.bgColor; }
    document.getElementById('keyboard-rotation').value = layout.keyboardRotation;
    document.getElementById('keyboard-rotation-num').value = layout.keyboardRotation;
    const globalOctEl = document.getElementById('global-octave-equiv');
    if (globalOctEl) globalOctEl.checked = layout.octaveEquiv !== false;
    buildWidthControls();
    renderHarmonyList();
    renderHarmonyEditor();
    allKeysCache = getAllKeys();
    resetView();
    markProjectSaved();
  } catch(e) {
    alert('Error loading project: ' + e.message);
  }
}

// Project tab button handlers
document.addEventListener('click', e => {
  if (e.target.id === 'btn-new-project' || e.target.closest('#btn-new-project')) newProject();
  if (e.target.id === 'btn-open-project' || e.target.closest('#btn-open-project')) openProject();
  if (e.target.id === 'btn-save-project' || e.target.closest('#btn-save-project')) saveProject();
  if (e.target.id === 'btn-save-copy-project' || e.target.closest('#btn-save-copy-project')) saveProjectCopy();
  if (e.target.id === 'btn-config-save' || e.target.closest('#btn-config-save')) saveProject();
  if (e.target.id === 'btn-config-revert' || e.target.closest('#btn-config-revert')) revertProject();
  if (e.target.id === 'btn-import-harmonies-open' || e.target.closest('#btn-import-harmonies-open')) {
    document.getElementById('import-harmonies-file').click();
  }
  if (e.target.id === 'btn-import-harmonies-confirm' || e.target.closest('#btn-import-harmonies-confirm')) {
    const modal = document.getElementById('import-harmonies-modal');
    const checkboxes = modal.querySelectorAll('input[type=checkbox]');
    const toImport = modal._importData || [];
    let added = 0;
    checkboxes.forEach(cb => {
      if (cb.checked) {
        const idx = parseInt(cb.dataset.idx);
        const hData = toImport[idx];
        if (hData) {
          const newH = makeHarmony(hData);
          newH.savedState = snapshotHarmony(newH);
          harmonies.push(newH);
          added++;
        }
      }
    });
    modal.style.display = 'none';
    if (added > 0) {
      selectedHarmonyId = harmonies[harmonies.length-1].id;
      renderHarmonyList();
      renderHarmonyEditor();
      applyAndDraw();
      markProjectDirty();
    }
  }
  if (e.target.id === 'btn-import-harmonies-cancel' || e.target.closest('#btn-import-harmonies-cancel')) {
    document.getElementById('import-harmonies-modal').style.display = 'none';
  }
});

document.getElementById('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => importProject(ev.target.result);
  reader.readAsText(file);
  e.target.value='';
});

document.getElementById('import-harmonies-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => importHarmoniesFromFile(ev.target.result);
  reader.readAsText(file);
  e.target.value='';
});

// ═════════════════════════════════════════════════════════════════════════════
