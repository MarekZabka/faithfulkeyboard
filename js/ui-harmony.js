// ui-harmony.js
// Harmony list and editor UI. renderHarmonyList, renderHarmonyEditor, getMiniKeyShapeSVG, tooltip.
// ======================================================================


//  TOOLTIP
// ═════════════════════════════════════════════════════════════════════════════

const tooltip=document.getElementById('tooltip');
function showTooltip(cx,cy,key) {
  document.getElementById('tt-ratio').textContent = key.label;
  document.getElementById('tt-cents').textContent = `${key.cents.toFixed(1)} ¢`;
  document.getElementById('tt-freq').textContent = `${key.freq.toFixed(2)} Hz`;
  document.getElementById('tt-harmony').textContent = key.harmonyName || '';
  const ttWidth = document.getElementById('tt-width');
  if (ttWidth) ttWidth.textContent = key.width !== undefined ? `w: ${key.width.toFixed(3)}` : '';
  const w=tooltip.offsetWidth||200, h=tooltip.offsetHeight||70;
  let tx=cx+14, ty=cy-10;
  if(tx+w>window.innerWidth) tx=cx-w-10;
  if(ty+h>window.innerHeight) ty=cy-h-10;
  tooltip.style.left=tx+'px'; tooltip.style.top=ty+'px';
  tooltip.classList.add('visible');
}
function hideTooltip() { tooltip.classList.remove('visible'); }

// ═════════════════════════════════════════════════════════════════════════════
//  HARMONY EDITOR UI
// ═════════════════════════════════════════════════════════════════════════════

function getMiniKeyShapeSVG(h) {
  const color = h.uniformColor || '#6490c4';
  const opacity = h.opacity !== undefined ? h.opacity : 1;
  const shape = h.keyShape || 'round';
  const s = 18, r = 7;
  const cx = s/2, cy = s/2;
  let shapeHTML = '';
  if (shape === 'round') {
    shapeHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}" stroke="none"/>`;
  } else if (shape === 'hex') {
    const pts = [];
    for (let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3;pts.push(`${(cx+r*Math.cos(a)).toFixed(1)},${(cy+r*Math.sin(a)).toFixed(1)}`);}
    shapeHTML = `<polygon points="${pts.join(' ')}" fill="${color}" opacity="${opacity}" stroke="none"/>`;
  } else if (shape === 'diamond') {
    shapeHTML = `<polygon points="${cx},${cy-r} ${cx+r*0.75},${cy} ${cx},${cy+r} ${cx-r*0.75},${cy}" fill="${color}" opacity="${opacity}" stroke="none"/>`;
  } else if (shape === 'rect') {
    shapeHTML = `<rect x="${cx-r*0.8}" y="${cy-r*0.5}" width="${r*1.6}" height="${r}" fill="${color}" opacity="${opacity}" stroke="none"/>`;
  } else if (shape === 'triangle') {
    shapeHTML = `<polygon points="${cx},${cy-r} ${cx+r*0.87},${cy+r*0.5} ${cx-r*0.87},${cy+r*0.5}" fill="${color}" opacity="${opacity}" stroke="none"/>`;
  } else if (shape === 'square') {
    shapeHTML = `<rect x="${cx-r}" y="${cy-r}" width="${r*2}" height="${r*2}" fill="${color}" opacity="${opacity}" stroke="none"/>`;
  } else if (shape === 'pentagon') {
    const pts = [];
    for (let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;pts.push(`${(cx+r*Math.cos(a)).toFixed(1)},${(cy+r*Math.sin(a)).toFixed(1)}`);}
    shapeHTML = `<polygon points="${pts.join(' ')}" fill="${color}" opacity="${opacity}" stroke="none"/>`;
  } else if (shape === 'octagon') {
    const pts = [];
    for (let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;pts.push(`${(cx+r*Math.cos(a)).toFixed(1)},${(cy+r*Math.sin(a)).toFixed(1)}`);}
    shapeHTML = `<polygon points="${pts.join(' ')}" fill="${color}" opacity="${opacity}" stroke="none"/>`;
  } else {
    shapeHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}" stroke="none"/>`;
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="display:block;">${shapeHTML}</svg>`;
}

function renderHarmonyList() {
  const list = document.getElementById('harmony-list');
  list.innerHTML = '';
  for (const h of harmonies) {
    const item = document.createElement('div');
    item.className = 'harmony-item' + (h.id===selectedHarmonyId?' selected':'');
    item.draggable = true;
    item.dataset.id = h.id;

    // Drag handle
    const dragH = document.createElement('span');
    dragH.className = 'harmony-drag-handle';
    dragH.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`;
    item.appendChild(dragH);

    // Mini key shape SVG
    const dot = document.createElement('div');
    dot.className = 'harmony-vis-dot';
    dot.innerHTML = getMiniKeyShapeSVG(h);
    item.appendChild(dot);

    // Name
    const name = document.createElement('span');
    name.className = 'harmony-name';
    name.textContent = h.name;
    item.appendChild(name);

    // Visibility toggle
    const visBtn = document.createElement('button');
    visBtn.className = 'harmony-vis-toggle' + (h.visible ? '' : ' hidden');
    visBtn.title = h.visible ? 'Hide' : 'Show';
    visBtn.innerHTML = h.visible
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    visBtn.addEventListener('click', e => {
      e.stopPropagation();
      h.visible = !h.visible;
      renderHarmonyList();
      applyAndDraw();
    });
    item.appendChild(visBtn);

    // Clone icon button
    const cloneItemBtn = document.createElement('button');
    cloneItemBtn.className = 'harmony-vis-toggle';
    cloneItemBtn.title = 'Clone';
    cloneItemBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    cloneItemBtn.addEventListener('click', e => {
      e.stopPropagation();
      const cloned = makeHarmony(snapshotHarmony(h));
      cloned.name = h.name + ' (Clone)';
      cloned.savedState = snapshotHarmony(cloned);
      harmonies.push(cloned);
      selectedHarmonyId = cloned.id;
      renderHarmonyList();
      renderHarmonyEditor();
      applyAndDraw();
    });
    item.appendChild(cloneItemBtn);

    // Delete icon button
    const delItemBtn = document.createElement('button');
    delItemBtn.className = 'harmony-vis-toggle';
    delItemBtn.title = 'Delete';
    delItemBtn.style.color = 'var(--color-danger)';
    delItemBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    delItemBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Delete "${h.name}"?`)) return;
      harmonies = harmonies.filter(x => x.id !== h.id);
      selectedHarmonyId = harmonies.length ? harmonies[harmonies.length-1].id : null;
      renderHarmonyList();
      renderHarmonyEditor();
      applyAndDraw();
    });
    item.appendChild(delItemBtn);

    // Click to select
    item.addEventListener('click', e => {
      if (e.target === visBtn || visBtn.contains(e.target)) return;
      if (e.target === cloneItemBtn || cloneItemBtn.contains(e.target)) return;
      if (e.target === delItemBtn || delItemBtn.contains(e.target)) return;
      selectedHarmonyId = h.id;
      renderHarmonyList();
      renderHarmonyEditor();
    });

    // Drag & drop for reordering
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', h.id);
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const fromId = e.dataTransfer.getData('text/plain');
      const fromIdx = harmonies.findIndex(x=>x.id===fromId);
      const toIdx = harmonies.findIndex(x=>x.id===h.id);
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        const [moved] = harmonies.splice(fromIdx, 1);
        harmonies.splice(toIdx, 0, moved);
        renderHarmonyList();
        applyAndDraw();
      }
    });

    list.appendChild(item);
  }
}

function getHarmonyRepColor(h) {
  return h.uniformColor || '#6490c4';
}

function renderHarmonyEditor() {
  const editor = document.getElementById('harmony-editor');
  const h = harmonies.find(x=>x.id===selectedHarmonyId);
  if (!h) { editor.style.display = 'none'; return; }
  editor.style.display = 'flex';

  editor.innerHTML = '';

  // Header — just the name, no dirty state
  const hdr = document.createElement('div');
  hdr.className = 'harmony-editor-header';
  hdr.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    <span style="flex:1;">${escHtml(h.name)}</span>
  `;
  editor.appendChild(hdr);

  // Name field
  addEditorField(editor, 'Name', `<input class="field-input" id="he-name" value="${escHtml(h.name)}" style="margin-top:2px;">`);
  editor.querySelector('#he-name').addEventListener('input', e => {
    h.name = e.target.value;
    renderHarmonyList();
    refreshEditorDirtyState();
  });

  // Tones definition with mode switcher
  const toneMode = h.toneMode || 'ratios';
  const tonesSection = document.createElement('div');
  tonesSection.className = 'field-row';

  const modeHints = {
    ratios: 'e.g. 1, 9/8, 5/4, 3/2 — or formulas like (3/2)^2',
    vectors: 'e.g. (0), (-3,2), (-2,0,1) — exponents of primes 2,3,5,7,11,13'
  };
  tonesSection.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.3rem;">
      <label class="field-label" style="margin:0;">Tones</label>
      <select class="field-select" id="he-tone-mode" style="font-size:var(--text-xs);padding:0.15rem 0.3rem;width:auto;">
        <option value="ratios" ${toneMode==='ratios'?'selected':''}>Frequency Ratios</option>
        <option value="vectors" ${toneMode==='vectors'?'selected':''}>Vectors</option>
      </select>
    </div>
    <textarea class="field-input" id="he-ratios" rows="3" placeholder="${modeHints[toneMode]}">${escHtml(h.ratios)}</textarea>
    <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.25rem;">
      <span id="he-tone-hint" style="font-size:var(--text-xs);color:var(--color-text-faint);flex:1;">${modeHints[toneMode]}</span>
      <button id="he-simplify-btn" style="font-size:var(--text-xs);padding:0.15rem 0.5rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface-dynamic);cursor:pointer;">Simplify</button>
      <button id="he-transpose-btn" style="font-size:var(--text-xs);padding:0.15rem 0.5rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface-dynamic);cursor:pointer;" title="Transpose all tones by an interval">Transpose</button>
    </div>
  `;
  editor.appendChild(tonesSection);

  let _originalRatios = null;
  const simplifyBtn = tonesSection.querySelector('#he-simplify-btn');
  const ratiosTA = tonesSection.querySelector('#he-ratios');
  const modeSelect = tonesSection.querySelector('#he-tone-mode');

  function doSimplify() {
    if (simplifyBtn.textContent === 'Simplify') {
      _originalRatios = ratiosTA.value;
      const simplified = simplifyRatioList(ratiosTA.value, h.toneMode || 'ratios');
      ratiosTA.value = simplified;
      h.ratios = simplified;
      simplifyBtn.textContent = 'Original';
      simplifyBtn.title = 'Revert to original (before simplification)';
    } else {
      if (_originalRatios !== null) {
        ratiosTA.value = _originalRatios;
        h.ratios = _originalRatios;
      }
      simplifyBtn.textContent = 'Simplify';
      simplifyBtn.title = 'Simplify tone expressions to canonical form';
      _originalRatios = null;
    }
    refreshEditorDirtyState();
    applyAndDraw();
  }
  simplifyBtn.addEventListener('click', doSimplify);

  // Transpose button
  const transposeBtn = tonesSection.querySelector('#he-transpose-btn');
  if (transposeBtn) {
    transposeBtn.addEventListener('click', () => {
      const toneMode = h.toneMode || 'ratios';
      let intervalStr;
      if (toneMode === 'ratios') intervalStr = prompt('Enter transpose interval (ratio, e.g. 3/2 or 2/1):', '2/1');
      else if (toneMode === 'vectors') intervalStr = prompt('Enter transpose vector (e.g. (1,0) for octave):', '(1,0)');
      else intervalStr = prompt('Enter transpose interval (prime powers, e.g. 3/2):', '3/2');
      if (!intervalStr) return;
      transposeHarmony(h, intervalStr.trim(), toneMode);
      ratiosTA.value = h.ratios;
      refreshEditorDirtyState();
      applyAndDraw();
      markProjectDirty();
    });
  }

  ratiosTA.addEventListener('input', e => {
    h.ratios = e.target.value;
    if (_originalRatios !== null) { _originalRatios = null; simplifyBtn.textContent = 'Simplify'; }
    refreshEditorDirtyState();
    applyAndDraw();
  });

  modeSelect.addEventListener('change', e => {
    const newMode = e.target.value;
    const oldMode = h.toneMode || 'ratios';
    if (newMode === oldMode) return;

    const {text, warnings} = convertToneMode(h.ratios, oldMode, newMode);
    if (warnings.length) {
      const msg = warnings.slice(0,3).join('\n');
      if (!confirm(`Some tones could not be converted:\n\n${msg}\n\nProceed?`)) {
        modeSelect.value = oldMode; return;
      }
    }
    h.toneMode = newMode;
    h.ratios = text;
    ratiosTA.value = text;
    tonesSection.querySelector('#he-tone-hint').textContent = modeHints[newMode];
    ratiosTA.placeholder = modeHints[newMode];
    _originalRatios = null; simplifyBtn.textContent = 'Simplify';
    refreshEditorDirtyState();
    applyAndDraw();
  });

  // Octave equivalence (hidden — controlled globally in Layout tab)
  // h.octaveEquiv is still used in rendering but not shown in per-harmony editor

  editor.appendChild(document.createElement('hr')).className='section-sep';

  // ─── COLOR MODE ───
  const colorModeDiv = document.createElement('div');
  colorModeDiv.className = 'field-row';
  colorModeDiv.style.marginTop = '0.35rem';
  const colorModeVal = h.colorMode || 'uniform';
  colorModeDiv.innerHTML = `
    <label class="field-label">Color Mode</label>
    <select class="field-select" id="he-color-mode">
      <option value="uniform" ${colorModeVal==='uniform'?'selected':''}>Uniform</option>
      <option value="limit" ${colorModeVal==='limit'?'selected':''}>JI Limit</option>
      <option value="pitch" ${colorModeVal==='pitch'?'selected':''}>Pitch</option>
      <option value="width" ${colorModeVal==='width'?'selected':''}>Width</option>
    </select>
  `;
  editor.appendChild(colorModeDiv);

  // ─── COLOR PICKER (for uniform mode) ───
  const uniformRow = document.createElement('div');
  uniformRow.className = 'color-picker-row';
  uniformRow.id = 'he-uniform-row';
  uniformRow.style.display = colorModeVal === 'uniform' ? '' : 'none';
  uniformRow.innerHTML = `
    <label class="field-label" style="text-transform:none;font-size:var(--text-xs);color:var(--color-text-muted);">Color:</label>
    <label class="color-swatch">
      <input type="color" id="he-color" value="${h.uniformColor}">
    </label>
    <span id="he-color-hex" style="font-size:var(--text-xs);color:var(--color-text-muted);">${h.uniformColor}</span>
  `;
  editor.appendChild(uniformRow);

  colorModeDiv.querySelector('#he-color-mode').addEventListener('change', e=>{
    h.colorMode = e.target.value;
    uniformRow.style.display = h.colorMode === 'uniform' ? '' : 'none';
    refreshEditorDirtyState();
    renderSVG();
    markProjectDirty();
  });

  uniformRow.querySelector('#he-color').addEventListener('input', e=>{
    h.uniformColor=e.target.value;
    h.colorMode='uniform';
    uniformRow.querySelector('#he-color-hex').textContent=e.target.value;
    refreshEditorDirtyState();
    renderSVG();
    markProjectDirty();
  });

  // ─── OPACITY ───
  function makeSliderField(label, id, min, max, step, value, fmt) {
    const div = document.createElement('div');
    div.className = 'field-row';
    div.style.marginTop = '0.2rem';
    const disp = fmt ? fmt(value) : value;
    div.innerHTML = `<label class="field-label">${label}</label>
      <div style="display:flex;align-items:center;gap:0.4rem;">
        <input type="range" class="range-sm" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="flex:1;">
        <span id="${id}-val" style="font-size:var(--text-xs);color:var(--color-text-muted);min-width:2.5rem;text-align:right;">${disp}</span>
      </div>`;
    return div;
  }

  const opacityVal = h.opacity !== undefined ? h.opacity : 1.0;
  const opacityDiv = makeSliderField('Opacity', 'he-opacity', 0, 1, 0.05, opacityVal, v=>parseFloat(v).toFixed(2));
  editor.appendChild(opacityDiv);
  opacityDiv.querySelector('#he-opacity').addEventListener('input', e=>{
    h.opacity=parseFloat(e.target.value);
    opacityDiv.querySelector('#he-opacity-val').textContent=h.opacity.toFixed(2);
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // ─── KEY SHAPE ───
  const shapeDiv = document.createElement('div');
  shapeDiv.className = 'field-row';
  shapeDiv.style.marginTop = '0.35rem';
  shapeDiv.innerHTML = `
    <label class="field-label">Key Shape</label>
    <select class="field-select" id="he-shape">
      <option value="round" ${h.keyShape==='round'?'selected':''}>Circle</option>
      <option value="square" ${h.keyShape==='square'?'selected':''}>Square</option>
      <option value="rect" ${h.keyShape==='rect'?'selected':''}>Rectangle</option>
      <option value="diamond" ${h.keyShape==='diamond'?'selected':''}>Diamond</option>
      <option value="triangle" ${h.keyShape==='triangle'?'selected':''}>Triangle</option>
      <option value="pentagon" ${h.keyShape==='pentagon'?'selected':''}>Pentagon</option>
      <option value="hex" ${h.keyShape==='hex'?'selected':''}>Hexagon</option>
      <option value="octagon" ${h.keyShape==='octagon'?'selected':''}>Octagon</option>
    </select>
  `;
  editor.appendChild(shapeDiv);
  shapeDiv.querySelector('#he-shape').addEventListener('change', e=>{h.keyShape=e.target.value;refreshEditorDirtyState();renderSVG();markProjectDirty();});

  // ─── KEY ROUNDING ───
  const roundingVal = h.keyRounding !== undefined ? h.keyRounding : 0;
  const roundingDiv = makeSliderField('Key Rounding', 'he-rounding', 0, 1, 0.05, roundingVal, v=>parseFloat(v).toFixed(2));
  editor.appendChild(roundingDiv);
  roundingDiv.querySelector('#he-rounding').addEventListener('input', e=>{
    h.keyRounding=parseFloat(e.target.value)||0;
    roundingDiv.querySelector('#he-rounding-val').textContent=h.keyRounding.toFixed(2);
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // ─── EDGE STYLE ───
  const edgeDiv = document.createElement('div');
  edgeDiv.className = 'field-row';
  edgeDiv.style.marginTop = '0.2rem';
  const edgeVal = h.keyEdge || 'straight';
  edgeDiv.innerHTML = `
    <label class="field-label">Edge Style</label>
    <select class="field-select" id="he-edge">
      <option value="straight" ${edgeVal==='straight'?'selected':''}>Straight</option>
      <option value="convex" ${edgeVal==='convex'?'selected':''}>Convex</option>
      <option value="concave" ${edgeVal==='concave'?'selected':''}>Concave</option>
    </select>
  `;
  editor.appendChild(edgeDiv);
  edgeDiv.querySelector('#he-edge').addEventListener('change', e=>{h.keyEdge=e.target.value;refreshEditorDirtyState();renderSVG();markProjectDirty();});

  // ─── EDGE BULGE AMOUNT ─── (only relevant for convex/concave)
  const bulgeVal = h.keyBulge !== undefined ? h.keyBulge : 0.2;
  const bulgeDiv = makeSliderField('Bulge Amount', 'he-bulge', 0.02, 0.8, 0.02, bulgeVal, v=>parseFloat(v).toFixed(2));
  bulgeDiv.style.display = (h.keyEdge === 'straight' || !h.keyEdge) ? 'none' : '';
  editor.appendChild(bulgeDiv);
  bulgeDiv.querySelector('#he-bulge').addEventListener('input', e=>{
    h.keyBulge=parseFloat(e.target.value);
    bulgeDiv.querySelector('#he-bulge-val').textContent=h.keyBulge.toFixed(2);
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });
  // Show/hide bulge slider based on edge style
  edgeDiv.querySelector('#he-edge').addEventListener('change', e=>{
    bulgeDiv.style.display = (e.target.value === 'straight') ? 'none' : '';
  });

  // ─── KEY SIZE ───
  const keySizeVal = h.keySize !== undefined ? h.keySize : 120;
  const keySizeDiv = makeSliderField('Key Size', 'he-key-size', 8, 400, 1, keySizeVal, v=>v);
  editor.appendChild(keySizeDiv);
  keySizeDiv.querySelector('#he-key-size').addEventListener('input', e=>{
    h.keySize=parseInt(e.target.value)||120;
    keySizeDiv.querySelector('#he-key-size-val').textContent=h.keySize;
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // ─── KEY ROTATION ───
  const rotDiv = makeSliderField('Key Rotation (°)', 'he-rot', -180, 180, 1, h.keyRotation, v=>v+'°');
  editor.appendChild(rotDiv);
  rotDiv.querySelector('#he-rot').addEventListener('input', e=>{
    h.keyRotation=parseFloat(e.target.value)||0;
    rotDiv.querySelector('#he-rot-val').textContent=h.keyRotation+'°';
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // ─── KEY STRETCH X / Y ───
  const sxDiv = makeSliderField('Key Stretch X', 'he-sx', 0.1, 5, 0.05, h.keyStretchX, v=>parseFloat(v).toFixed(2));
  editor.appendChild(sxDiv);
  sxDiv.querySelector('#he-sx').addEventListener('input', e=>{
    h.keyStretchX=parseFloat(e.target.value)||1;
    sxDiv.querySelector('#he-sx-val').textContent=h.keyStretchX.toFixed(2);
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  const syDiv = makeSliderField('Key Stretch Y', 'he-sy', 0.1, 5, 0.05, h.keyStretchY, v=>parseFloat(v).toFixed(2));
  editor.appendChild(syDiv);
  syDiv.querySelector('#he-sy').addEventListener('input', e=>{
    h.keyStretchY=parseFloat(e.target.value)||1;
    syDiv.querySelector('#he-sy-val').textContent=h.keyStretchY.toFixed(2);
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // ─── KEY OFFSET X / Y ───
  const keyOffXVal = h.keyOffsetX !== undefined ? h.keyOffsetX : 0;
  const keyOffXDiv = makeSliderField('Key Offset X', 'he-koffx', -50, 50, 1, keyOffXVal, v=>v);
  editor.appendChild(keyOffXDiv);
  keyOffXDiv.querySelector('#he-koffx').addEventListener('input', e=>{
    h.keyOffsetX=parseInt(e.target.value)||0;
    keyOffXDiv.querySelector('#he-koffx-val').textContent=h.keyOffsetX;
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  const keyOffYVal = h.keyOffsetY !== undefined ? h.keyOffsetY : 0;
  const keyOffYDiv = makeSliderField('Key Offset Y', 'he-koffy', -50, 50, 1, keyOffYVal, v=>v);
  editor.appendChild(keyOffYDiv);
  keyOffYDiv.querySelector('#he-koffy').addEventListener('input', e=>{
    h.keyOffsetY=parseInt(e.target.value)||0;
    keyOffYDiv.querySelector('#he-koffy-val').textContent=h.keyOffsetY;
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  editor.appendChild(document.createElement('hr')).className='section-sep';

  // ─── CONNECT TONES ───
  const connectRow = makeCheckRow('Connect Tones', 'he-connect-tones', h.connectTones !== false);
  editor.appendChild(connectRow);

  const connectOptsDiv = document.createElement('div');
  connectOptsDiv.id = 'he-connect-opts';
  connectOptsDiv.style.display = h.connectTones !== false ? '' : 'none';
  connectOptsDiv.style.paddingLeft = '1.2rem';
  connectOptsDiv.style.marginTop = '0.25rem';

  // Style select
  const connectStyleDiv = document.createElement('div');
  connectStyleDiv.className = 'field-row';
  connectStyleDiv.style.marginTop = '0.2rem';
  const connectStyleVal = h.connectStyle || 'curve';
  connectStyleDiv.innerHTML = `
    <label class="field-label">Style</label>
    <select class="field-select" id="he-connect-style">
      <option value="curve" ${connectStyleVal==='curve'?'selected':''}>Bezier</option>
      <option value="straight" ${connectStyleVal==='straight'?'selected':''}>Straight</option>
    </select>
  `;
  connectOptsDiv.appendChild(connectStyleDiv);

  // Color picker
  const connectColorRow = document.createElement('div');
  connectColorRow.className = 'color-picker-row';
  connectColorRow.style.marginTop = '0.25rem';
  const connectColorVal = h.connectColor || '#888888';
  connectColorRow.innerHTML = `
    <label class="field-label" style="text-transform:none;font-size:var(--text-xs);color:var(--color-text-muted);">Color:</label>
    <label class="color-swatch">
      <input type="color" id="he-connect-color" value="${connectColorVal}">
    </label>
    <span id="he-connect-color-hex" style="font-size:var(--text-xs);color:var(--color-text-muted);">${connectColorVal}</span>
  `;
  connectOptsDiv.appendChild(connectColorRow);

  // Width slider
  const connectWidthVal = h.connectWidth !== undefined ? h.connectWidth : 2;
  const connectWidthDiv = makeSliderField('Width', 'he-connect-width', 0.5, 30, 0.5, connectWidthVal, v=>parseFloat(v).toFixed(1));
  connectWidthDiv.style.marginTop = '0.2rem';
  connectOptsDiv.appendChild(connectWidthDiv);

  editor.appendChild(connectOptsDiv);

  connectRow.querySelector('#he-connect-tones').addEventListener('change', e => {
    h.connectTones = e.target.checked;
    connectOptsDiv.style.display = h.connectTones ? '' : 'none';
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  connectStyleDiv.querySelector('#he-connect-style').addEventListener('change', e => {
    h.connectStyle = e.target.value;
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  connectColorRow.querySelector('#he-connect-color').addEventListener('input', e => {
    h.connectColor = e.target.value;
    connectColorRow.querySelector('#he-connect-color-hex').textContent = e.target.value;
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  connectWidthDiv.querySelector('#he-connect-width').addEventListener('input', e => {
    h.connectWidth = parseFloat(e.target.value) || 2;
    connectWidthDiv.querySelector('#he-connect-width-val').textContent = h.connectWidth.toFixed(1);
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });

  // ─── LABEL SETTINGS ───
  const lblRow = makeCheckRow('Show Labels', 'he-labels', h.showLabels);
  editor.appendChild(lblRow);
  lblRow.querySelector('#he-labels').addEventListener('change', e => {
    h.showLabels = e.target.checked;
    refreshEditorDirtyState();
    renderSVG();
    markProjectDirty();
  });

  // ─── LABEL TYPE ───
  const lblTypeDiv = document.createElement('div');
  lblTypeDiv.className = 'field-row';
  lblTypeDiv.style.marginTop='0.35rem';
  lblTypeDiv.innerHTML = `
    <label class="field-label">Label Type</label>
    <select class="field-select" id="he-label-type">
      <option value="ratio" ${(h.labelType||'ratio')==='ratio'?'selected':''}>Ratio (e.g. 5/4)</option>
      <option value="cents" ${h.labelType==='cents'?'selected':''}>Cents</option>
      <option value="heji" ${h.labelType==='heji'?'selected':''}>Tone name (HEJI)</option>
    </select>
  `;
  editor.appendChild(lblTypeDiv);
  lblTypeDiv.querySelector('#he-label-type').addEventListener('change', e=>{
    h.labelType=e.target.value;
    refreshEditorDirtyState();
    renderSVG();
    markProjectDirty();
  });

  // ─── LABEL FONT SIZE ───
  const fontRow = document.createElement('div');
  fontRow.className = 'field-row';
  fontRow.style.marginTop = '0.25rem';
  fontRow.innerHTML = `<label class="field-label">Label Font Size</label>
    <div style="display:flex;align-items:center;gap:0.4rem;">
      <input type="range" class="range-sm" id="he-font" min="6" max="48" step="1" value="${h.labelFontSize}" style="flex:1;">
      <span id="he-font-val" style="font-size:var(--text-xs);color:var(--color-text-muted);min-width:1.5rem;text-align:right;">${h.labelFontSize}</span>
    </div>`;
  editor.appendChild(fontRow);
  fontRow.querySelector('#he-font').addEventListener('input', e=>{
    h.labelFontSize=parseInt(e.target.value)||11;
    fontRow.querySelector('#he-font-val').textContent=h.labelFontSize;
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // ─── LABEL FONT COLOR ───
  const lblColorRow = document.createElement('div');
  lblColorRow.className = 'color-picker-row';
  lblColorRow.style.marginTop='0.25rem';
  const currentLblColor = h.labelColor || '#ffffff';
  lblColorRow.innerHTML = `
    <label class="field-label" style="text-transform:none;font-size:var(--text-xs);color:var(--color-text-muted);">Label Font Color:</label>
    <label class="color-swatch">
      <input type="color" id="he-lbl-color" value="${currentLblColor}">
    </label>
    <span id="he-lbl-color-hex" style="font-size:var(--text-xs);color:var(--color-text-muted);">${h.labelColor||'auto'}</span>
    <button id="he-lbl-color-clear" style="font-size:var(--text-xs);padding:0.1rem 0.3rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface-dynamic);cursor:pointer;">Auto</button>
  `;
  editor.appendChild(lblColorRow);
  lblColorRow.querySelector('#he-lbl-color').addEventListener('input', e=>{
    h.labelColor=e.target.value;
    lblColorRow.querySelector('#he-lbl-color-hex').textContent=e.target.value;
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });
  lblColorRow.querySelector('#he-lbl-color-clear').addEventListener('click', ()=>{
    h.labelColor='';
    lblColorRow.querySelector('#he-lbl-color-hex').textContent='auto';
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // ─── LABEL OFFSET X / Y ───
  const offXRow = document.createElement('div');
  offXRow.className = 'field-row';
  offXRow.style.marginTop = '0.2rem';
  offXRow.innerHTML = `<label class="field-label">Label Offset X</label>
    <div style="display:flex;align-items:center;gap:0.4rem;">
      <input type="range" class="range-sm" id="he-offx" min="-50" max="50" step="1" value="${h.labelOffsetX}" style="flex:1;">
      <span id="he-offx-val" style="font-size:var(--text-xs);color:var(--color-text-muted);min-width:2rem;text-align:right;">${h.labelOffsetX}</span>
    </div>`;
  editor.appendChild(offXRow);
  offXRow.querySelector('#he-offx').addEventListener('input', e=>{
    h.labelOffsetX=parseInt(e.target.value)||0;
    offXRow.querySelector('#he-offx-val').textContent=h.labelOffsetX;
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  const offYRow = document.createElement('div');
  offYRow.className = 'field-row';
  offYRow.style.marginTop = '0.2rem';
  offYRow.innerHTML = `<label class="field-label">Label Offset Y</label>
    <div style="display:flex;align-items:center;gap:0.4rem;">
      <input type="range" class="range-sm" id="he-offy" min="-50" max="50" step="1" value="${h.labelOffsetY}" style="flex:1;">
      <span id="he-offy-val" style="font-size:var(--text-xs);color:var(--color-text-muted);min-width:2rem;text-align:right;">${h.labelOffsetY}</span>
    </div>`;
  editor.appendChild(offYRow);
  offYRow.querySelector('#he-offy').addEventListener('input', e=>{
    h.labelOffsetY=parseInt(e.target.value)||0;
    offYRow.querySelector('#he-offy-val').textContent=h.labelOffsetY;
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // (Actions are added at top — see above)

  // Tone preview table — when octave equiv is on, show only base octave (oct===0)
  try {
    let keys = computeKeysForHarmony(h, getBaseFreq());
    if (h.octaveEquiv) keys = keys.filter(k => k.oct === 0);
    if (keys.length) {
      const sep = document.createElement('hr');
      sep.className='section-sep';
      editor.appendChild(sep);
      const lbl = document.createElement('div');
      lbl.className='field-label';
      lbl.style.marginBottom='0.3rem';
      lbl.textContent=`Computed tones (${keys.length})`;
      editor.appendChild(lbl);
      const tbl = document.createElement('table');
      tbl.className='tone-table';
      tbl.innerHTML='<thead><tr><th>Tone</th><th>¢</th><th>Hz</th><th>W</th></tr></thead>';
      const tbody=document.createElement('tbody');
      for (const k of keys.slice(0,30)) {
        const tr=document.createElement('tr');
        const toneDisplay = (h.labelType === 'heji') ? getKeyLabel(k, h) : escHtml(k.label);
        tr.innerHTML=`<td><span class="tone-dot" style="background:${limitColor(k.limit)}"></span>${toneDisplay}</td><td>${k.cents.toFixed(1)}</td><td>${k.freq.toFixed(2)}</td><td>${k.width !== undefined ? k.width.toFixed(2) : '–'}</td>`;
        tbody.appendChild(tr);
      }
      if (keys.length>30) {
        const tr=document.createElement('tr');
        tr.innerHTML=`<td colspan="4" style="color:var(--color-text-faint);font-size:0.7rem;">…and ${keys.length-30} more</td>`;
        tbody.appendChild(tr);
      }
      tbl.appendChild(tbody);
      editor.appendChild(tbl);
    }
  } catch(e) {}
}

function refreshEditorDirtyState() {
  // No per-harmony dirty tracking — just keep list item name in sync
  const h = harmonies.find(x=>x.id===selectedHarmonyId);
  if (!h) return;
  const item = document.querySelector(`.harmony-item[data-id="${h.id}"]`);
  if (item) {
    const nm = item.querySelector('.harmony-name');
    if (nm) nm.textContent = h.name;
  }
}

function addEditorField(parent, label, inputHTML) {
  const div = document.createElement('div');
  div.className = 'field-row';
  div.innerHTML = `<label class="field-label">${label}</label>${inputHTML}`;
  parent.appendChild(div);
  return div;
}

function makeCheckRow(label, id, checked, hint) {
  const div = document.createElement('div');
  div.style.cssText='display:flex;align-items:center;gap:0.5rem;';
  div.innerHTML = `
    <input type="checkbox" id="${id}" ${checked?'checked':''} style="accent-color:var(--color-primary);width:14px;height:14px;">
    <label for="${id}" style="font-size:var(--text-sm);cursor:pointer;flex:1;">${label}</label>
    ${hint?`<span style="font-size:var(--text-xs);color:var(--color-text-faint);" title="${escHtml(hint)}">ⓘ</span>`:''}
  `;
  return div;
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
