// ui-harmony.js
// Harmony list and editor UI. renderHarmonyList, renderHarmonyEditor, getMiniKeyShapeSVG, tooltip.
// ======================================================================


//  TOOLTIP
// ═════════════════════════════════════════════════════════════════════════════

const tooltip=document.getElementById('tooltip');
function showTooltip(cx,cy,key) {
  document.getElementById('tt-harmony').textContent = key.harmonyName || '';
  document.getElementById('tt-ratio').textContent = key.label;
  // HEJI name
  const ttName = document.getElementById('tt-name');
  if (ttName) {
    let hejiHtml = '';
    try {
      hejiHtml = key._exps ? expsToHEJI(key._exps) : (key.ratio ? expsToHEJI(ratioExponents(key.ratio)) : '');
    } catch(e) { hejiHtml = ''; }
    ttName.innerHTML = hejiHtml;
  }
  document.getElementById('tt-cents').textContent = `${key.cents.toFixed(1)} ¢`;
  document.getElementById('tt-freq').textContent = `${key.freq.toFixed(2)} Hz`;
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
//  EDIT MODE STATE
// ═════════════════════════════════════════════════════════════════════════════

let harmonyEditMode = false;  // toggled by the Edit button

function setHarmonyEditMode(on) {
  harmonyEditMode = on;
  const btn = document.getElementById('btn-edit-harmony-toggle');
  if (btn) {
    btn.classList.toggle('active', on);
    btn.style.background = on ? 'var(--color-primary)' : '';
    btn.style.color = on ? '#fff' : '';
    btn.style.borderColor = on ? 'var(--color-primary)' : '';
  }
  // Show New button only in edit mode
  const newBtn = document.getElementById('btn-add-harmony');
  if (newBtn) newBtn.style.display = on ? '' : 'none';
  renderHarmonyList();
  if (!on) {
    const ed = document.getElementById('harmony-editor');
    if (ed) ed.style.display = 'none';
  } else {
    renderHarmonyEditor();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  HARMONY LIST
// ═════════════════════════════════════════════════════════════════════════════

function getMiniKeyShapeSVG(h) {
  const color = h.uniformColor || '#6490c4';
  const opacity = h.opacity !== undefined ? h.opacity : 1;
  const shape = h.keyShape || 'round';
  const strokeW = h.keyStrokeWidth !== undefined ? h.keyStrokeWidth : 0;
  const strokeColor = strokeW > 0 && h.edgeColor ? h.edgeColor : (strokeW > 0 ? 'rgba(0,0,0,0.5)' : 'none');
  const rounding = h.keyRounding || 0;
  const edgeStyle = h.keyEdge || 'straight';
  const bulge = h.keyBulge !== undefined ? h.keyBulge : 0.2;
  // Clamp stroke so the mini icon doesn't get swallowed
  const sw = Math.min(strokeW, 2);
  const s = 18;
  // Keep effective radius so stroke doesn't clip
  const r = Math.max(3, 7 - sw * 0.5);
  const cx = s/2, cy = s/2;
  const strokeAttrs = `stroke="${strokeColor}" stroke-width="${sw}"`;

  let shapeHTML = '';
  if (shape === 'round') {
    shapeHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" ${strokeAttrs}/>`;
  } else {
    // Build polygon points matching buildKeyPath logic
    let points = [];
    if (shape === 'hex') {
      for (let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3;points.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
    } else if (shape === 'diamond') {
      points = [[cx,cy-r],[cx+r*0.75,cy],[cx,cy+r],[cx-r*0.75,cy]];
    } else if (shape === 'rect') {
      const hw=r*0.8,hh=r*0.5;points=[[cx-hw,cy-hh],[cx+hw,cy-hh],[cx+hw,cy+hh],[cx-hw,cy+hh]];
    } else if (shape === 'triangle') {
      points=[[cx,cy-r],[cx+r*0.87,cy+r*0.5],[cx-r*0.87,cy+r*0.5]];
    } else if (shape === 'square') {
      points=[[cx-r,cy-r],[cx+r,cy-r],[cx+r,cy+r],[cx-r,cy+r]];
    } else if (shape === 'pentagon') {
      for (let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;points.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
    } else if (shape === 'octagon') {
      for (let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;points.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
    } else {
      // fallback circle
      shapeHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" ${strokeAttrs}/>`;
    }
    if (!shapeHTML && points.length) {
      if (rounding > 0 || edgeStyle !== 'straight') {
        try {
          const d = buildRoundedPolygonPath(points, rounding * r * 0.5, edgeStyle, bulge);
          shapeHTML = `<path d="${d}" fill="${color}" ${strokeAttrs}/>`;
        } catch(e) {
          shapeHTML = `<polygon points="${points.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="${color}" ${strokeAttrs}/>`;
        }
      } else {
        shapeHTML = `<polygon points="${points.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="${color}" ${strokeAttrs}/>`;
      }
    }
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="display:block;overflow:visible;" opacity="${opacity}">${shapeHTML}</svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TONE TABLE HELPER — shared by editor (edit mode) and list (view mode)
// ─────────────────────────────────────────────────────────────────────────────
function renderToneTable(h, container) {
  try {
    let keys = computeKeysForHarmony(h, getBaseFreq());
    if (h.octaveEquiv) keys = keys.filter(k => k.oct === 0);
    if (!keys.length) return;
    const sep = document.createElement('hr'); sep.className='section-sep'; container.appendChild(sep);
    const lbl = document.createElement('div'); lbl.className='field-label'; lbl.style.marginBottom='0.25rem';
    lbl.textContent=`Included Tones (${keys.length})`; container.appendChild(lbl);
    const tbl = document.createElement('table'); tbl.className='tone-table';
    tbl.innerHTML='<thead><tr><th></th><th>Tone</th><th>Name</th><th>¢</th><th>Hz</th><th>W</th></tr></thead>';
    const tbody=document.createElement('tbody');
    for (const k of keys.slice(0,30)) {
      const tr=document.createElement('tr');
      const ratioDisplay=escHtml(k.label);
      // HEJI name — always from exps/ratio regardless of harmony label type
      let hejiName='';
      try {
        hejiName = k._exps ? expsToHEJI(k._exps) : (k.ratio ? expsToHEJI(ratioExponents(k.ratio)) : '');
      } catch(e2) { hejiName=''; }
      const miniSvg=getMiniKeyShapeSVG(h);
      tr.innerHTML=`<td style="padding:0 2px;">${miniSvg}</td><td>${ratioDisplay}</td><td class="tone-name-cell">${hejiName}</td><td>${k.cents.toFixed(1)}</td><td>${k.freq.toFixed(2)}</td><td>${k.width!==undefined?k.width.toFixed(2):'–'}</td>`;
      // Hover highlight matching SVG keys
      const hid = h.id;
      const klabel = k.label;
      tr.addEventListener('mouseenter', () => {
        document.querySelectorAll(`.svg-key[data-hid="${hid}"][data-label="${CSS.escape(klabel)}"]`)
          .forEach(el => el.classList.add('key-row-hover'));
      });
      tr.addEventListener('mouseleave', () => {
        document.querySelectorAll(`.svg-key[data-hid="${hid}"][data-label="${CSS.escape(klabel)}"]`)
          .forEach(el => el.classList.remove('key-row-hover'));
      });
      tbody.appendChild(tr);
    }
    if (keys.length>30) {
      const tr=document.createElement('tr');
      tr.innerHTML=`<td colspan="6" style="color:var(--color-text-faint);font-size:0.7rem;">…and ${keys.length-30} more</td>`;
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody); container.appendChild(tbl);
  } catch(e) {}
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

    // Visibility toggle (always shown)
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

    // Clone + Delete icon buttons — only in Edit mode
    if (harmonyEditMode) {
      const cloneBtn = document.createElement('button');
      cloneBtn.className = 'harmony-vis-toggle';
      cloneBtn.title = 'Clone';
      cloneBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      cloneBtn.addEventListener('click', e => {
        e.stopPropagation();
        const cloned = makeHarmony(snapshotHarmony(h));
        cloned.name = h.name + ' (Clone)';
        cloned.savedState = snapshotHarmony(cloned);
        harmonies.push(cloned);
        selectedHarmonyId = cloned.id;
        renderHarmonyList();
        if (harmonyEditMode) renderHarmonyEditor();
        applyAndDraw();
        markProjectDirty();
      });
      item.appendChild(cloneBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'harmony-vis-toggle';
      delBtn.title = 'Delete';
      delBtn.style.color = 'var(--color-danger)';
      delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`Delete "${h.name}"?`)) return;
        harmonies = harmonies.filter(x => x.id !== h.id);
        selectedHarmonyId = harmonies.length ? harmonies[harmonies.length-1].id : null;
        renderHarmonyList();
        renderHarmonyEditor();
        applyAndDraw();
        markProjectDirty();
      });
      item.appendChild(delBtn);
    }

    // Click to select (in edit mode also shows editor)
    item.addEventListener('click', e => {
      if (e.target === visBtn || visBtn.contains(e.target)) return;
      selectedHarmonyId = h.id;
      renderHarmonyList();
      if (harmonyEditMode) renderHarmonyEditor();
    });

    // Drag & drop for reordering
    item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', h.id); });
    item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault(); item.classList.remove('drag-over');
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

  // When NOT in edit mode, show the Included Tones table for the selected harmony below the list
  if (!harmonyEditMode && selectedHarmonyId) {
    const selH = harmonies.find(x => x.id === selectedHarmonyId);
    if (selH) {
      const toneWrap = document.getElementById('harmony-list-tone-table');
      if (toneWrap) {
        toneWrap.innerHTML = '';
        renderToneTable(selH, toneWrap);
      }
    }
  } else {
    const toneWrap = document.getElementById('harmony-list-tone-table');
    if (toneWrap) toneWrap.innerHTML = '';
  }
}

function getHarmonyRepColor(h) {
  return h.uniformColor || '#6490c4';
}

// ═════════════════════════════════════════════════════════════════════════════
//  HARMONY EDITOR — rebuilt with grouped collapsible sections
// ═════════════════════════════════════════════════════════════════════════════

function renderHarmonyEditor() {
  const editor = document.getElementById('harmony-editor');
  const h = harmonies.find(x=>x.id===selectedHarmonyId);
  if (!h || !harmonyEditMode) { editor.style.display = 'none'; return; }
  editor.style.display = 'flex';
  editor.innerHTML = '';

  // ── Helper: slider field ──
  function makeSliderField(label, id, min, max, step, value, fmt) {
    const div = document.createElement('div');
    div.className = 'field-row';
    div.style.marginTop = '0.15rem';
    const disp = fmt ? fmt(value) : value;
    div.innerHTML = `<label class="field-label sub-label">${label}</label>
      <div style="display:flex;align-items:center;gap:0.4rem;">
        <input type="range" class="range-sm" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="flex:1;">
        <span id="${id}-val" style="font-size:var(--text-xs);color:var(--color-text-muted);min-width:2.5rem;text-align:right;">${disp}</span>
      </div>`;
    return div;
  }

  // ── Helper: collapsible section ──
  function makeSection(title, open) {
    const wrap = document.createElement('div');
    const hdr = document.createElement('div');
    hdr.className = 'editor-section-header' + (open ? ' open' : '');
    hdr.innerHTML = `<span class="section-title">${title}</span><svg class="section-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
    const body = document.createElement('div');
    body.className = 'editor-section-body' + (open ? '' : ' collapsed');
    hdr.addEventListener('click', () => {
      hdr.classList.toggle('open');
      body.classList.toggle('collapsed');
    });
    wrap.appendChild(hdr);
    wrap.appendChild(body);
    editor.appendChild(wrap);
    return body;
  }

  // ── Helper: check row ──
  function makeCheckRow(label, id, checked, isMain) {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:0.5rem;';
    const labelStyle = isMain
      ? 'font-size:var(--text-xs);font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.06em;cursor:pointer;flex:1;'
      : 'font-size:var(--text-xs);font-weight:500;color:var(--color-text-muted);cursor:pointer;flex:1;';
    div.innerHTML = `
      <input type="checkbox" id="${id}" ${checked?'checked':''} style="accent-color:var(--color-primary);width:13px;height:13px;">
      <label for="${id}" style="${labelStyle}">${label}</label>
    `;
    return div;
  }

  // ── NAME ──
  addEditorField(editor, 'Name', `<input class="field-input" id="he-name" value="${escHtml(h.name)}" style="margin-top:2px;">`);
  editor.querySelector('#he-name').addEventListener('input', e => {
    h.name = e.target.value;
    renderHarmonyList();
    refreshEditorDirtyState();
  });

  // ── TONES ──
  const tonesSection = document.createElement('div');
  tonesSection.className = 'field-row';
  const toneMode = h.toneMode || 'ratios';
  tonesSection.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.25rem;">
      <label class="field-label" style="margin:0;">Tones</label>
      <select class="field-select" id="he-tone-mode" style="font-size:var(--text-xs);padding:0.15rem 0.3rem;width:auto;">
        <option value="ratios" ${toneMode==='ratios'?'selected':''}>Frequency Ratios</option>
        <option value="vectors" ${toneMode==='vectors'?'selected':''}>Vectors</option>
      </select>
    </div>
    <textarea class="field-input" id="he-ratios" rows="3">${escHtml(h.ratios)}</textarea>
    <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.2rem;">
      <button id="he-simplify-btn" style="font-size:var(--text-xs);padding:0.15rem 0.5rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface-dynamic);cursor:pointer;">Simplify</button>
      <button id="he-transpose-btn" style="font-size:var(--text-xs);padding:0.15rem 0.5rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface-dynamic);cursor:pointer;" title="Transpose all tones">Transpose</button>
    </div>
  `;
  editor.appendChild(tonesSection);

  let _originalRatios = null;
  const simplifyBtn = tonesSection.querySelector('#he-simplify-btn');
  const ratiosTA = tonesSection.querySelector('#he-ratios');
  const modeSelect = tonesSection.querySelector('#he-tone-mode');

  simplifyBtn.addEventListener('click', () => {
    if (simplifyBtn.textContent === 'Simplify') {
      _originalRatios = ratiosTA.value;
      ratiosTA.value = simplifyRatioList(ratiosTA.value, h.toneMode || 'ratios');
      h.ratios = ratiosTA.value;
      simplifyBtn.textContent = 'Original';
    } else {
      if (_originalRatios !== null) { ratiosTA.value = _originalRatios; h.ratios = _originalRatios; }
      simplifyBtn.textContent = 'Simplify';
      _originalRatios = null;
    }
    refreshEditorDirtyState(); applyAndDraw();
  });

  tonesSection.querySelector('#he-transpose-btn').addEventListener('click', () => {
    const tm = h.toneMode || 'ratios';
    const prompt_text = tm === 'ratios' ? 'Enter transpose interval (ratio, e.g. 3/2 or 2/1):' : 'Enter transpose vector (e.g. (1,0) for octave):';
    const intervalStr = prompt(prompt_text, tm === 'ratios' ? '2/1' : '(1,0)');
    if (!intervalStr) return;
    transposeHarmony(h, intervalStr.trim(), tm);
    ratiosTA.value = h.ratios;
    refreshEditorDirtyState(); applyAndDraw(); markProjectDirty();
  });

  ratiosTA.addEventListener('input', e => {
    h.ratios = e.target.value;
    if (_originalRatios !== null) { _originalRatios = null; simplifyBtn.textContent = 'Simplify'; }
    refreshEditorDirtyState(); applyAndDraw();
  });

  modeSelect.addEventListener('change', e => {
    const newMode = e.target.value, oldMode = h.toneMode || 'ratios';
    if (newMode === oldMode) return;
    const {text, warnings} = convertToneMode(h.ratios, oldMode, newMode);
    if (warnings.length && !confirm(`Some tones could not be converted:\n\n${warnings.slice(0,3).join('\n')}\n\nProceed?`)) {
      modeSelect.value = oldMode; return;
    }
    h.toneMode = newMode; h.ratios = text; ratiosTA.value = text;
    _originalRatios = null; simplifyBtn.textContent = 'Simplify';
    refreshEditorDirtyState(); applyAndDraw();
  });

  editor.appendChild(document.createElement('hr')).className = 'section-sep';

  // ── KEY SHAPE (flat, non-collapsible header) ─────────────────────────────
  // Static section label
  const shapeSectionHdr = document.createElement('div');
  shapeSectionHdr.className = 'editor-section-header';
  shapeSectionHdr.style.cursor = 'default';
  shapeSectionHdr.innerHTML = '<span class="section-title">Key Shape</span>';
  editor.appendChild(shapeSectionHdr);

  const shapeSectionBody = document.createElement('div');
  shapeSectionBody.className = 'editor-section-body';
  editor.appendChild(shapeSectionBody);

  function appendSub(parent, el) { parent.appendChild(el); return el; }

  // Shape select
  const shapeSel = document.createElement('div');
  shapeSel.className = 'field-row';
  shapeSel.innerHTML = `<label class="field-label sub-label">Shape</label>
    <select class="field-select" id="he-shape">
      <option value="round" ${h.keyShape==='round'?'selected':''}>Circle</option>
      <option value="square" ${h.keyShape==='square'?'selected':''}>Square</option>
      <option value="rect" ${h.keyShape==='rect'?'selected':''}>Rectangle</option>
      <option value="diamond" ${h.keyShape==='diamond'?'selected':''}>Diamond</option>
      <option value="triangle" ${h.keyShape==='triangle'?'selected':''}>Triangle</option>
      <option value="pentagon" ${h.keyShape==='pentagon'?'selected':''}>Pentagon</option>
      <option value="hex" ${h.keyShape==='hex'?'selected':''}>Hexagon</option>
      <option value="octagon" ${h.keyShape==='octagon'?'selected':''}>Octagon</option>
    </select>`;
  appendSub(shapeSectionBody, shapeSel);
  shapeSel.querySelector('#he-shape').addEventListener('change', e=>{h.keyShape=e.target.value;refreshEditorDirtyState();renderSVG();markProjectDirty();});

  // Size
  const keySizeVal = h.keySize !== undefined ? h.keySize : 120;
  const keySizeDiv = makeSliderField('Size', 'he-key-size', 8, 400, 1, keySizeVal, v=>v);
  appendSub(shapeSectionBody, keySizeDiv);
  keySizeDiv.querySelector('#he-key-size').addEventListener('input', e=>{
    h.keySize = parseInt(e.target.value)||120;
    keySizeDiv.querySelector('#he-key-size-val').textContent = h.keySize;
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });

  // Edge Width (new)
  const edgeWidthVal = h.keyStrokeWidth !== undefined ? h.keyStrokeWidth : 0;
  const edgeWidthDiv = makeSliderField('Edge Width', 'he-edge-width', 0, 8, 0.5, edgeWidthVal, v=>parseFloat(v).toFixed(1));
  appendSub(shapeSectionBody, edgeWidthDiv);
  edgeWidthDiv.querySelector('#he-edge-width').addEventListener('input', e=>{
    h.keyStrokeWidth = parseFloat(e.target.value);
    edgeWidthDiv.querySelector('#he-edge-width-val').textContent = h.keyStrokeWidth.toFixed(1);
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });

  // Color Mode
  const colorModeVal = h.colorMode || 'uniform';
  const cmDiv = document.createElement('div');
  cmDiv.className = 'field-row'; cmDiv.style.marginTop = '0.2rem';
  cmDiv.innerHTML = `<label class="field-label sub-label">Color Mode</label>
    <select class="field-select" id="he-color-mode">
      <option value="uniform" ${colorModeVal==='uniform'?'selected':''}>Uniform</option>
      <option value="limit" ${colorModeVal==='limit'?'selected':''}>JI Limit</option>
      <option value="pitch" ${colorModeVal==='pitch'?'selected':''}>Pitch</option>
      <option value="width" ${colorModeVal==='width'?'selected':''}>Width</option>
    </select>`;
  appendSub(shapeSectionBody, cmDiv);

  // Fill Color + Edge Color on one line
  const colorPairDiv = document.createElement('div');
  colorPairDiv.id = 'he-color-pair';
  colorPairDiv.className = 'color-pair-row';
  colorPairDiv.style.display = colorModeVal === 'uniform' ? '' : 'none';
  colorPairDiv.style.marginTop = '0.2rem';
  const edgeColorVal = h.edgeColor || '#ffffff';
  colorPairDiv.innerHTML = `
    <div class="color-pair-item">
      <label style="font-size:var(--text-xs);color:var(--color-text-muted);">Fill</label>
      <label class="color-swatch"><input type="color" id="he-color" value="${h.uniformColor}"></label>
      <span id="he-color-hex" style="font-size:var(--text-xs);color:var(--color-text-muted);">${h.uniformColor}</span>
    </div>
    <div class="color-pair-item" style="margin-left:0.5rem;">
      <label style="font-size:var(--text-xs);color:var(--color-text-muted);">Edge</label>
      <label class="color-swatch"><input type="color" id="he-edge-color" value="${edgeColorVal}"></label>
      <span id="he-edge-color-hex" style="font-size:var(--text-xs);color:var(--color-text-muted);">${edgeColorVal}</span>
    </div>`;
  appendSub(shapeSectionBody, colorPairDiv);

  cmDiv.querySelector('#he-color-mode').addEventListener('change', e=>{
    h.colorMode = e.target.value;
    colorPairDiv.style.display = h.colorMode === 'uniform' ? '' : 'none';
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  colorPairDiv.querySelector('#he-color').addEventListener('input', e=>{
    h.uniformColor = e.target.value; h.colorMode = 'uniform';
    colorPairDiv.querySelector('#he-color-hex').textContent = e.target.value;
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  colorPairDiv.querySelector('#he-edge-color').addEventListener('input', e=>{
    h.edgeColor = e.target.value;
    colorPairDiv.querySelector('#he-edge-color-hex').textContent = e.target.value;
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });

  // Opacity
  const opacityVal = h.opacity !== undefined ? h.opacity : 1.0;
  const opacityDiv = makeSliderField('Opacity', 'he-opacity', 0, 1, 0.05, opacityVal, v=>parseFloat(v).toFixed(2));
  appendSub(shapeSectionBody, opacityDiv);
  opacityDiv.querySelector('#he-opacity').addEventListener('input', e=>{
    h.opacity = parseFloat(e.target.value);
    opacityDiv.querySelector('#he-opacity-val').textContent = h.opacity.toFixed(2);
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });

  // KEY STYLE checkbox → Rounding, Edge Form, Bulge Amount
  // Uncheck resets all style values to defaults
  const keyStyleActive = h.keyRounding > 0 || (h.keyEdge && h.keyEdge !== 'straight');
  const keyStyleCheck = makeCheckRow('Key Style', 'he-key-style', keyStyleActive, true);
  appendSub(shapeSectionBody, keyStyleCheck);
  const keyStyleOpts = document.createElement('div');
  keyStyleOpts.style.cssText = `padding-left:1.2rem;margin-top:0.1rem;display:${keyStyleActive ? 'flex' : 'none'};flex-direction:column;gap:0.1rem;`;
  appendSub(shapeSectionBody, keyStyleOpts);

  const roundingVal = h.keyRounding !== undefined ? h.keyRounding : 0;
  const roundingDiv = makeSliderField('Rounding', 'he-rounding', 0, 1, 0.05, roundingVal, v=>parseFloat(v).toFixed(2));
  keyStyleOpts.appendChild(roundingDiv);
  roundingDiv.querySelector('#he-rounding').addEventListener('input', e=>{
    h.keyRounding = parseFloat(e.target.value)||0;
    roundingDiv.querySelector('#he-rounding-val').textContent = h.keyRounding.toFixed(2);
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });

  const edgeVal = h.keyEdge || 'straight';
  const edgeFormDiv = document.createElement('div');
  edgeFormDiv.className = 'field-row'; edgeFormDiv.style.marginTop='0.1rem';
  edgeFormDiv.innerHTML = `<label class="field-label sub-label">Edge Form</label>
    <select class="field-select" id="he-edge">
      <option value="straight" ${edgeVal==='straight'?'selected':''}>Straight</option>
      <option value="convex" ${edgeVal==='convex'?'selected':''}>Convex</option>
      <option value="concave" ${edgeVal==='concave'?'selected':''}>Concave</option>
    </select>`;
  keyStyleOpts.appendChild(edgeFormDiv);

  const bulgeVal = h.keyBulge !== undefined ? h.keyBulge : 0.2;
  const bulgeDiv = makeSliderField('Bulge Amount', 'he-bulge', 0.02, 0.8, 0.02, bulgeVal, v=>parseFloat(v).toFixed(2));
  bulgeDiv.style.display = (edgeVal === 'straight') ? 'none' : '';
  keyStyleOpts.appendChild(bulgeDiv);

  edgeFormDiv.querySelector('#he-edge').addEventListener('change', e=>{
    h.keyEdge = e.target.value;
    bulgeDiv.style.display = (e.target.value === 'straight') ? 'none' : '';
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  bulgeDiv.querySelector('#he-bulge').addEventListener('input', e=>{
    h.keyBulge = parseFloat(e.target.value);
    bulgeDiv.querySelector('#he-bulge-val').textContent = h.keyBulge.toFixed(2);
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  keyStyleCheck.querySelector('#he-key-style').addEventListener('change', e=>{
    keyStyleOpts.style.display = e.target.checked ? 'flex' : 'none';
    if (!e.target.checked) {
      // Reset style to defaults
      h.keyRounding = 0; h.keyEdge = 'straight'; h.keyBulge = 0.2;
      roundingDiv.querySelector('#he-rounding').value = 0;
      roundingDiv.querySelector('#he-rounding-val').textContent = '0.00';
      edgeFormDiv.querySelector('#he-edge').value = 'straight';
      bulgeDiv.style.display = 'none';
      refreshEditorDirtyState(); renderSVG(); markProjectDirty();
    }
  });

  // KEY ROTATION checkbox → Rotation slider
  const rotActive = h.keyRotation !== 0;
  const rotCheck = makeCheckRow('Key Rotation', 'he-key-rotation-check', rotActive, true);
  appendSub(shapeSectionBody, rotCheck);
  const rotOpts = document.createElement('div');
  rotOpts.style.cssText = `padding-left:1.2rem;margin-top:0.1rem;display:${rotActive ? 'flex' : 'none'};flex-direction:column;gap:0.1rem;`;
  appendSub(shapeSectionBody, rotOpts);

  const rotDiv = makeSliderField('Rotation (°)', 'he-rot', -180, 180, 1, h.keyRotation, v=>v+'°');
  rotOpts.appendChild(rotDiv);
  rotDiv.querySelector('#he-rot').addEventListener('input', e=>{
    h.keyRotation = parseFloat(e.target.value)||0;
    rotDiv.querySelector('#he-rot-val').textContent = h.keyRotation+'°';
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  rotCheck.querySelector('#he-key-rotation-check').addEventListener('change', e=>{
    rotOpts.style.display = e.target.checked ? 'flex' : 'none';
    if (!e.target.checked) {
      h.keyRotation = 0;
      rotDiv.querySelector('#he-rot').value = 0;
      rotDiv.querySelector('#he-rot-val').textContent = '0°';
      refreshEditorDirtyState(); renderSVG(); markProjectDirty();
    }
  });

  // KEY STRETCH checkbox → X, Y (uncheck resets to 1)
  const stretchCheck = makeCheckRow('Key Stretch', 'he-key-stretch', h.keyStretchX !== 1 || h.keyStretchY !== 1, true);
  appendSub(shapeSectionBody, stretchCheck);
  const stretchOpts = document.createElement('div');
  stretchOpts.style.cssText = `padding-left:1.2rem;margin-top:0.1rem;display:${(h.keyStretchX !== 1 || h.keyStretchY !== 1) ? 'flex' : 'none'};flex-direction:column;gap:0.1rem;`;
  appendSub(shapeSectionBody, stretchOpts);

  const sxDiv = makeSliderField('X', 'he-sx', 0.1, 5, 0.05, h.keyStretchX, v=>parseFloat(v).toFixed(2));
  stretchOpts.appendChild(sxDiv);
  sxDiv.querySelector('#he-sx').addEventListener('input', e=>{
    h.keyStretchX = parseFloat(e.target.value)||1;
    sxDiv.querySelector('#he-sx-val').textContent = h.keyStretchX.toFixed(2);
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  const syDiv = makeSliderField('Y', 'he-sy', 0.1, 5, 0.05, h.keyStretchY, v=>parseFloat(v).toFixed(2));
  stretchOpts.appendChild(syDiv);
  syDiv.querySelector('#he-sy').addEventListener('input', e=>{
    h.keyStretchY = parseFloat(e.target.value)||1;
    syDiv.querySelector('#he-sy-val').textContent = h.keyStretchY.toFixed(2);
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  stretchCheck.querySelector('#he-key-stretch').addEventListener('change', e=>{
    stretchOpts.style.display = e.target.checked ? 'flex' : 'none';
    if (!e.target.checked) {
      h.keyStretchX = 1; h.keyStretchY = 1;
      sxDiv.querySelector('#he-sx').value = 1; sxDiv.querySelector('#he-sx-val').textContent = '1.00';
      syDiv.querySelector('#he-sy').value = 1; syDiv.querySelector('#he-sy-val').textContent = '1.00';
      refreshEditorDirtyState(); renderSVG(); markProjectDirty();
    }
  });

  // KEY OFFSET checkbox → X, Y (uncheck resets to 0)
  const keyOffXVal = h.keyOffsetX !== undefined ? h.keyOffsetX : 0;
  const keyOffYVal = h.keyOffsetY !== undefined ? h.keyOffsetY : 0;
  const offsetCheck = makeCheckRow('Key Offset', 'he-key-offset', keyOffXVal !== 0 || keyOffYVal !== 0, true);
  appendSub(shapeSectionBody, offsetCheck);
  const offsetOpts = document.createElement('div');
  offsetOpts.style.cssText = `padding-left:1.2rem;margin-top:0.1rem;display:${(keyOffXVal !== 0 || keyOffYVal !== 0) ? 'flex' : 'none'};flex-direction:column;gap:0.1rem;`;
  appendSub(shapeSectionBody, offsetOpts);

  const koffxDiv = makeSliderField('X', 'he-koffx', -50, 50, 1, keyOffXVal, v=>v);
  offsetOpts.appendChild(koffxDiv);
  koffxDiv.querySelector('#he-koffx').addEventListener('input', e=>{
    h.keyOffsetX = parseInt(e.target.value)||0;
    koffxDiv.querySelector('#he-koffx-val').textContent = h.keyOffsetX;
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  const koffyDiv = makeSliderField('Y', 'he-koffy', -50, 50, 1, keyOffYVal, v=>v);
  offsetOpts.appendChild(koffyDiv);
  koffyDiv.querySelector('#he-koffy').addEventListener('input', e=>{
    h.keyOffsetY = parseInt(e.target.value)||0;
    koffyDiv.querySelector('#he-koffy-val').textContent = h.keyOffsetY;
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  offsetCheck.querySelector('#he-key-offset').addEventListener('change', e=>{
    offsetOpts.style.display = e.target.checked ? 'flex' : 'none';
    if (!e.target.checked) {
      h.keyOffsetX = 0; h.keyOffsetY = 0;
      koffxDiv.querySelector('#he-koffx').value = 0; koffxDiv.querySelector('#he-koffx-val').textContent = '0';
      koffyDiv.querySelector('#he-koffy').value = 0; koffyDiv.querySelector('#he-koffy-val').textContent = '0';
      refreshEditorDirtyState(); renderSVG(); markProjectDirty();
    }
  });

  editor.appendChild(document.createElement('hr')).className = 'section-sep';

  // ── CONNECT TONES ──
  const connectMain = makeCheckRow('Connect Tones', 'he-connect-tones', h.connectTones !== false, true);
  editor.appendChild(connectMain);
  const connectOpts = document.createElement('div');
  connectOpts.style.cssText = `padding-left:1.2rem;margin-top:0.2rem;display:${h.connectTones !== false ? 'flex' : 'none'};flex-direction:column;gap:0.2rem;`;
  editor.appendChild(connectOpts);

  const connectStyleDiv = document.createElement('div');
  connectStyleDiv.className = 'field-row';
  const connectStyleVal = h.connectStyle || 'curve';
  connectStyleDiv.innerHTML = `<label class="field-label sub-label">Style</label>
    <select class="field-select" id="he-connect-style">
      <option value="curve" ${connectStyleVal==='curve'?'selected':''}>Bezier</option>
      <option value="straight" ${connectStyleVal==='straight'?'selected':''}>Straight</option>
    </select>`;
  connectOpts.appendChild(connectStyleDiv);

  const connectColorVal = h.connectColor || '#888888';
  const connectColorRow = document.createElement('div');
  connectColorRow.className = 'color-picker-row';
  connectColorRow.innerHTML = `
    <label style="font-size:var(--text-xs);color:var(--color-text-muted);">Color</label>
    <label class="color-swatch"><input type="color" id="he-connect-color" value="${connectColorVal}"></label>
    <span id="he-connect-color-hex" style="font-size:var(--text-xs);color:var(--color-text-muted);">${connectColorVal}</span>`;
  connectOpts.appendChild(connectColorRow);

  const connectWidthVal = h.connectWidth !== undefined ? h.connectWidth : 2;
  const connectWidthDiv = makeSliderField('Width', 'he-connect-width', 0.5, 30, 0.5, connectWidthVal, v=>parseFloat(v).toFixed(1));
  connectOpts.appendChild(connectWidthDiv);

  connectMain.querySelector('#he-connect-tones').addEventListener('change', e=>{
    h.connectTones = e.target.checked;
    connectOpts.style.display = h.connectTones ? 'flex' : 'none';
    refreshEditorDirtyState(); renderSVG(); markProjectDirty();
  });
  connectStyleDiv.querySelector('#he-connect-style').addEventListener('change', e=>{h.connectStyle=e.target.value;refreshEditorDirtyState();renderSVG();markProjectDirty();});
  connectColorRow.querySelector('#he-connect-color').addEventListener('input', e=>{
    h.connectColor=e.target.value;
    connectColorRow.querySelector('#he-connect-color-hex').textContent=e.target.value;
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });
  connectWidthDiv.querySelector('#he-connect-width').addEventListener('input', e=>{
    h.connectWidth=parseFloat(e.target.value)||2;
    connectWidthDiv.querySelector('#he-connect-width-val').textContent=h.connectWidth.toFixed(1);
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // ── SHOW LABELS ──
  const lblMain = makeCheckRow('Show Labels', 'he-labels', h.showLabels, true);
  editor.appendChild(lblMain);
  const lblOpts = document.createElement('div');
  lblOpts.style.cssText = `padding-left:1.2rem;margin-top:0.2rem;display:${h.showLabels ? 'flex' : 'none'};flex-direction:column;gap:0.2rem;`;
  editor.appendChild(lblOpts);

  // Label Type
  const lblTypeDiv = document.createElement('div');
  lblTypeDiv.className = 'field-row';
  lblTypeDiv.innerHTML = `<label class="field-label sub-label">Type</label>
    <select class="field-select" id="he-label-type">
      <option value="ratio" ${(h.labelType||'ratio')==='ratio'?'selected':''}>Ratio (e.g. 5/4)</option>
      <option value="cents" ${h.labelType==='cents'?'selected':''}>Cents</option>
      <option value="heji" ${h.labelType==='heji'?'selected':''}>Tone name (HEJI)</option>
    </select>`;
  lblOpts.appendChild(lblTypeDiv);
  lblTypeDiv.querySelector('#he-label-type').addEventListener('change', e=>{h.labelType=e.target.value;refreshEditorDirtyState();renderSVG();markProjectDirty();});

  // Font size
  const fontDiv = makeSliderField('Font Size', 'he-font', 6, 48, 1, h.labelFontSize, v=>v);
  lblOpts.appendChild(fontDiv);
  fontDiv.querySelector('#he-font').addEventListener('input', e=>{
    h.labelFontSize=parseInt(e.target.value)||11;
    fontDiv.querySelector('#he-font-val').textContent=h.labelFontSize;
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // Label color
  const currentLblColor = h.labelColor || '#ffffff';
  const lblColorRow = document.createElement('div');
  lblColorRow.className = 'color-picker-row';
  lblColorRow.innerHTML = `
    <label style="font-size:var(--text-xs);color:var(--color-text-muted);">Color</label>
    <label class="color-swatch"><input type="color" id="he-lbl-color" value="${currentLblColor}"></label>
    <span id="he-lbl-color-hex" style="font-size:var(--text-xs);color:var(--color-text-muted);">${h.labelColor||'auto'}</span>
    <button id="he-lbl-color-clear" style="font-size:var(--text-xs);padding:0.1rem 0.3rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface-dynamic);cursor:pointer;">Auto</button>`;
  lblOpts.appendChild(lblColorRow);
  lblColorRow.querySelector('#he-lbl-color').addEventListener('input', e=>{h.labelColor=e.target.value;lblColorRow.querySelector('#he-lbl-color-hex').textContent=e.target.value;refreshEditorDirtyState();renderSVG();markProjectDirty();});
  lblColorRow.querySelector('#he-lbl-color-clear').addEventListener('click', ()=>{h.labelColor='';lblColorRow.querySelector('#he-lbl-color-hex').textContent='auto';refreshEditorDirtyState();renderSVG();markProjectDirty();});

  // Offsets
  const offXDiv = makeSliderField('Offset X', 'he-offx', -50, 50, 1, h.labelOffsetX, v=>v);
  lblOpts.appendChild(offXDiv);
  offXDiv.querySelector('#he-offx').addEventListener('input', e=>{h.labelOffsetX=parseInt(e.target.value)||0;offXDiv.querySelector('#he-offx-val').textContent=h.labelOffsetX;refreshEditorDirtyState();renderSVG();markProjectDirty();});

  const offYDiv = makeSliderField('Offset Y', 'he-offy', -50, 50, 1, h.labelOffsetY, v=>v);
  lblOpts.appendChild(offYDiv);
  offYDiv.querySelector('#he-offy').addEventListener('input', e=>{h.labelOffsetY=parseInt(e.target.value)||0;offYDiv.querySelector('#he-offy-val').textContent=h.labelOffsetY;refreshEditorDirtyState();renderSVG();markProjectDirty();});

  lblMain.querySelector('#he-labels').addEventListener('change', e=>{
    h.showLabels=e.target.checked;
    lblOpts.style.display=h.showLabels?'flex':'none';
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // ── SHOW SECONDARY LABELS ──
  const lbl2Main = makeCheckRow('Show Secondary Labels', 'he-labels2', h.showLabels2 || false, true);
  editor.appendChild(lbl2Main);
  const lbl2Opts = document.createElement('div');
  lbl2Opts.style.cssText = `padding-left:1.2rem;margin-top:0.2rem;display:${h.showLabels2 ? 'flex' : 'none'};flex-direction:column;gap:0.2rem;`;
  editor.appendChild(lbl2Opts);

  // Label Type 2
  const lbl2TypeDiv = document.createElement('div');
  lbl2TypeDiv.className = 'field-row';
  lbl2TypeDiv.innerHTML = `<label class="field-label sub-label">Type</label>
    <select class="field-select" id="he-label-type2">
      <option value="ratio" ${(h.labelType2||'ratio')==='ratio'?'selected':''}>Ratio (e.g. 5/4)</option>
      <option value="cents" ${h.labelType2==='cents'?'selected':''}>Cents</option>
      <option value="heji" ${h.labelType2==='heji'?'selected':''}>Tone name (HEJI)</option>
    </select>`;
  lbl2Opts.appendChild(lbl2TypeDiv);
  lbl2TypeDiv.querySelector('#he-label-type2').addEventListener('change', e=>{h.labelType2=e.target.value;refreshEditorDirtyState();renderSVG();markProjectDirty();});

  // Font size 2
  const font2Div = makeSliderField('Font Size', 'he-font2', 6, 48, 1, h.labelFontSize2||11, v=>v);
  lbl2Opts.appendChild(font2Div);
  font2Div.querySelector('#he-font2').addEventListener('input', e=>{
    h.labelFontSize2=parseInt(e.target.value)||11;
    font2Div.querySelector('#he-font2-val').textContent=h.labelFontSize2;
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // Label color 2
  const currentLblColor2 = h.labelColor2 || '#ffffff';
  const lblColorRow2 = document.createElement('div');
  lblColorRow2.className = 'color-picker-row';
  lblColorRow2.innerHTML = `
    <label style="font-size:var(--text-xs);color:var(--color-text-muted);">Color</label>
    <label class="color-swatch"><input type="color" id="he-lbl-color2" value="${currentLblColor2}"></label>
    <span id="he-lbl-color2-hex" style="font-size:var(--text-xs);color:var(--color-text-muted);">${h.labelColor2||'auto'}</span>
    <button id="he-lbl-color2-clear" style="font-size:var(--text-xs);padding:0.1rem 0.3rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface-dynamic);cursor:pointer;">Auto</button>`;
  lbl2Opts.appendChild(lblColorRow2);
  lblColorRow2.querySelector('#he-lbl-color2').addEventListener('input', e=>{h.labelColor2=e.target.value;lblColorRow2.querySelector('#he-lbl-color2-hex').textContent=e.target.value;refreshEditorDirtyState();renderSVG();markProjectDirty();});
  lblColorRow2.querySelector('#he-lbl-color2-clear').addEventListener('click', ()=>{h.labelColor2='';lblColorRow2.querySelector('#he-lbl-color2-hex').textContent='auto';refreshEditorDirtyState();renderSVG();markProjectDirty();});

  // Offsets 2
  const offX2Div = makeSliderField('Offset X', 'he-offx2', -50, 50, 1, h.labelOffsetX2||0, v=>v);
  lbl2Opts.appendChild(offX2Div);
  offX2Div.querySelector('#he-offx2').addEventListener('input', e=>{h.labelOffsetX2=parseInt(e.target.value)||0;offX2Div.querySelector('#he-offx2-val').textContent=h.labelOffsetX2;refreshEditorDirtyState();renderSVG();markProjectDirty();});

  const offY2Div = makeSliderField('Offset Y', 'he-offy2', -50, 50, 1, h.labelOffsetY2||0, v=>v);
  lbl2Opts.appendChild(offY2Div);
  offY2Div.querySelector('#he-offy2').addEventListener('input', e=>{h.labelOffsetY2=parseInt(e.target.value)||0;offY2Div.querySelector('#he-offy2-val').textContent=h.labelOffsetY2;refreshEditorDirtyState();renderSVG();markProjectDirty();});

  lbl2Main.querySelector('#he-labels2').addEventListener('change', e=>{
    h.showLabels2=e.target.checked;
    lbl2Opts.style.display=h.showLabels2?'flex':'none';
    refreshEditorDirtyState();renderSVG();markProjectDirty();
  });

  // ── TONE PREVIEW TABLE ──
  renderToneTable(h, editor);
}

function refreshEditorDirtyState() {
  const h = harmonies.find(x=>x.id===selectedHarmonyId);
  if (!h) return;
  const item = document.querySelector(`.harmony-item[data-id="${h.id}"]`);
  if (item) { const nm = item.querySelector('.harmony-name'); if (nm) nm.textContent = h.name; }
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
