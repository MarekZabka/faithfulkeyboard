// ui-layout.js
// Layout tab UI. buildWidthControls, width dirty indicator, applyAndDraw.
// ======================================================================


//  DIRTY STATE TRACKING
// ─────────────────────────────────────────────────────────────────────────────

let lastSavedJSON = null;

function markProjectDirty() {
  projectIsDirty = true;
  updateDirtyUI();
}

function updateDirtyUI() {
  // Update panel save button
  const configSave = document.getElementById('btn-config-save');
  if (configSave) {
    configSave.classList.toggle('active-save', projectIsDirty);
  }
  // Update header project name — add asterisk when dirty
  const headerName = document.getElementById('header-project-name');
  if (headerName) {
    const base = projectName;
    headerName.textContent = projectIsDirty ? base + ' *' : base;
  }
  // Update browser tab title
  document.title = projectName + ' — Faithful Keyboard';
}

function revertProject() {
  if (!lastSavedJSON) {
    alert('No saved version to revert to.');
    return;
  }
  importProject(lastSavedJSON);
  markProjectSaved();
}

function markProjectSaved() {
  projectIsDirty = false;
  updateDirtyUI();
  try { lastSavedJSON = buildProjectJSON(); } catch(e) {}
}

function getCurrentViewSnapshot() {
  return {
    zoomFactor,
    panX: Math.round(viewState.panX),
    panY: Math.round(viewState.panY),
    rotation: layout.keyboardRotation || 0,
    stretchX: layout.viewStretchX || 1,
    stretchY: layout.viewStretchY || 1
  };
}

function isViewDirty() {
  if (!layout.savedView) return false;
  const cur = getCurrentViewSnapshot();
  const sv = layout.savedView;
  const svZf = sv.zoomFactor !== undefined ? sv.zoomFactor : 1;
  return Math.abs(cur.zoomFactor - svZf) > 0.001 ||
    Math.abs((cur.panX||0) - (sv.panX||0)) > 0.5 ||
    Math.abs((cur.panY||0) - (sv.panY||0)) > 0.5 ||
    Math.abs((cur.rotation||0) - (sv.rotation||0)) > 0.1 ||
    Math.abs((cur.stretchX||1) - (sv.stretchX||1)) > 0.001 ||
    Math.abs((cur.stretchY||1) - (sv.stretchY||1)) > 0.001;
}

function updateViewDirtyIndicator() {
  const el = document.getElementById('view-dirty-indicator');
  if (el) el.style.display = isViewDirty() ? '' : 'none';
}

function getCurrentLayoutSnapshot() {
  return {
    coordSystem: layout.coordSystem,
    widths: JSON.stringify(layout.widths),
    showOctaveLines: layout.showOctaveLines,
    showSemitoneLines: layout.showSemitoneLines,
    baseFreq: document.getElementById('base-freq') ? document.getElementById('base-freq').value : '261.63',
    baseTone: document.getElementById('base-tone') ? document.getElementById('base-tone').value : 'D',
    octaveEquiv: layout.octaveEquiv
  };
}

function isLayoutDirty() {
  if (!layout.savedLayoutState) return false;
  const cur = JSON.stringify(getCurrentLayoutSnapshot());
  const saved = JSON.stringify(layout.savedLayoutState);
  return cur !== saved;
}

function updateLayoutDirtyIndicator() {
  const el = document.getElementById('layout-dirty-indicator');
  if (el) el.style.display = isLayoutDirty() ? '' : 'none';
}

function getCurrentSoundSnapshot() {
  function v(id, def) { const el = document.getElementById(id); return el ? el.value : def; }
  return {
    waveform:          v('waveform', 'sine'),
    attack:            v('env-attack', '10'),
    release:           v('env-release', '600'),
    sustain:           v('env-sustain', '0.4'),
    volume:            v('master-vol', '0.5'),
    polyphony:         v('polyphony', '8'),
    detuneAmount:      v('synth-detune', '0'),
    vibRate:           v('synth-vib-rate', '5.5'),
    vibDepth:          v('synth-vib-depth', '0'),
    filterType:        v('synth-filter-type', 'none'),
    filterFreq:        v('synth-filter-freq', '2000'),
    filterQ:           v('synth-filter-q', '1.0'),
  };
}

function isSoundDirty() {
  if (!layout.savedSoundState) return false;
  return JSON.stringify(getCurrentSoundSnapshot()) !== JSON.stringify(layout.savedSoundState);
}

function updateSoundDirtyIndicator() {
  // Sound dirty indicator removed
}

// ─────────────────────────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════════════════════
//  WIDTH CONTROLS
// ═════════════════════════════════════════════════════════════════════════════

function buildWidthControls() {
  const coordSys = layout.coordSystem === 'other' ? 'reduced' : layout.coordSystem;
  const csData = COORD_SYSTEMS[coordSys];
  const labels = layout.coordSystem === 'other' && layout.customBasis
    ? layout.customBasis.map((vec, i) => {
        const s = '[' + vec.join(',') + ']';
        return s.length > 14 ? s.substring(0, 12) + '…' : s;
      })
    : csData.labels;

  // Scope: half-range for each row slider (e.g. scope=5 ⇒ [-5,+5])
  if (!layout.widthScopes) layout.widthScopes = new Array(6).fill(5);

  const container = document.getElementById('width-controls');
  container.innerHTML = '';

  for (let i=0; i<6; i++) {
    const val = layout.widths[i] !== undefined ? layout.widths[i] : 0;
    const scope = layout.widthScopes[i] !== undefined ? layout.widthScopes[i] : 5;
    const clampedVal = Math.max(-scope, Math.min(scope, val));
    if (clampedVal !== val) layout.widths[i] = clampedVal;
    const lbl = labels[i] || `b${i+1}`;

    const row = document.createElement('div');
    row.className = 'width-row';

    // Label
    const labelSpan = document.createElement('span');
    labelSpan.className = 'width-label';
    labelSpan.title = lbl;
    labelSpan.style.cssText = 'min-width:3.2rem;max-width:3.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--text-xs);';
    labelSpan.textContent = lbl;
    row.appendChild(labelSpan);

    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'width-slider';
    slider.min = -scope; slider.max = scope; slider.step = 0.01;
    slider.value = clampedVal;
    slider.dataset.idx = i;
    slider.style.flex = '1';
    row.appendChild(slider);

    // Number input
    const numInp = document.createElement('input');
    numInp.type = 'number';
    numInp.className = 'width-num-input';
    numInp.id = `wv-${i}`;
    numInp.value = clampedVal.toFixed(2);
    numInp.step = 0.01;
    numInp.min = -scope; numInp.max = scope;
    row.appendChild(numInp);

    // Scope button (±N)
    const scopeBtn = document.createElement('button');
    scopeBtn.className = 'width-scope-btn';
    scopeBtn.title = `Slider range: ±${scope}. Click to change.`;
    scopeBtn.textContent = `±${scope}`;
    row.appendChild(scopeBtn);

    // Wire up interactions
    function setWidthValue(v) {
      const s = layout.widthScopes[i] !== undefined ? layout.widthScopes[i] : 5;
      const clamped = Math.max(-s, Math.min(s, v));
      layout.widths[i] = clamped;
      slider.value = clamped;
      numInp.value = clamped.toFixed(2);
      updateWidthsDirtyIndicator();
      applyAndDraw();
    }

    slider.addEventListener('input', () => setWidthValue(parseFloat(slider.value)));
    numInp.addEventListener('input', () => {
      const v = parseFloat(numInp.value);
      if (!isNaN(v)) setWidthValue(v);
    });
    numInp.addEventListener('change', () => {
      const v = parseFloat(numInp.value);
      if (!isNaN(v)) setWidthValue(v);
    });

    // Scope button: click to prompt for new scope
    scopeBtn.addEventListener('click', () => {
      const cur = layout.widthScopes[i] || 5;
      const raw = prompt(`Slider range for "${lbl}":\nEnter the maximum absolute value (scope).\nCurrent: ±${cur}`, cur);
      if (raw === null) return;
      const newScope = parseFloat(raw);
      if (isNaN(newScope) || newScope <= 0) { alert('Please enter a positive number.'); return; }
      layout.widthScopes[i] = newScope;
      slider.min = -newScope; slider.max = newScope;
      numInp.min = -newScope; numInp.max = newScope;
      scopeBtn.textContent = `±${newScope}`;
      scopeBtn.title = `Slider range: ±${newScope}. Click to change.`;
      // Clamp current value to new scope
      const cur2 = layout.widths[i];
      if (Math.abs(cur2) > newScope) setWidthValue(Math.sign(cur2) * newScope);
    });

    container.appendChild(row);
  }
  updateWidthsDirtyIndicator();
}

function updateWidthsDirtyIndicator() {
  // Widths dirty state is now folded into the layout dirty bar at the top of the Layout tab
  updateLayoutDirtyIndicator();
}

document.addEventListener('click', e => {
  if (e.target.id === 'btn-save-widths') {
    layout.savedWidths = [...layout.widths];
    updateWidthsDirtyIndicator();
    markProjectDirty();
    updateLayoutDirtyIndicator();
  }
  if (e.target.id === 'btn-revert-widths') {
    layout.widths = [...layout.savedWidths];
    buildWidthControls();
    applyAndDraw();
    updateLayoutDirtyIndicator();
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  APPLY & DRAW
// ═════════════════════════════════════════════════════════════════════════════

function applyAndDraw() {
  allKeysCache = getAllKeys();
  renderSVG();
  markProjectDirty();
}

// ═════════════════════════════════════════════════════════════════════════════
