// main.js
// App bootstrap: tab switching, panel, all event listeners, init().
// Loaded last — depends on all other modules.
// ======================================================================


//  TABS & PANEL
// ═════════════════════════════════════════════════════════════════════════════

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===target));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${target}`));
  });
});

function setPanelOpen(open) {
  const panel = document.getElementById('side-panel');
  if (open) {
    panel.classList.add('open');
  } else {
    panel.classList.remove('open');
  }
  // Update btn-toggle-config icon
  const toggleBtn = document.getElementById('btn-toggle-config');
  if (toggleBtn) {
    toggleBtn.title = open ? 'Hide configuration panel' : 'Show configuration panel';
  }
  // Panel is now overlay — no layout shift, but SVG might need re-centering
  setTimeout(()=>renderSVG(), 300);
}

document.getElementById('panel-toggle').addEventListener('click', () => {
  setPanelOpen(false);
});

document.getElementById('btn-toggle-config').addEventListener('click', () => {
  const panel = document.getElementById('side-panel');
  setPanelOpen(!panel.classList.contains('open'));
});

// Coordinate system change — recalculate widths to preserve tone positions
document.getElementById('coord-select').addEventListener('change', e => {
  const oldSys = layout.coordSystem;
  const newSys = e.target.value;
  const isOther = newSys === 'other';
  document.getElementById('custom-basis-wrap').style.display = isOther ? '' : 'none';

  // Preserve w^T * B^{-1} * e across basis changes.
  // Old formula: width = w_old^T * B_old^{-1} * e
  // New formula: width = w_new^T * B_new^{-1} * e
  // Equating: w_new = B_new^T * (B_old^T)^{-1} * w_old
  const oldBasis = (oldSys === 'other' && layout.customBasis) ? layout.customBasis : COORD_SYSTEMS[oldSys === 'other' ? 'reduced' : oldSys].basis;
  const wOld = layout.widths.slice(0,6);

  const newBasisKey = isOther ? 'reduced' : newSys;
  const newBasis = COORD_SYSTEMS[newBasisKey].basis;

  // Preserve w^T * (B^T)^{-1} * e across basis changes.
  // This means: w_old^T*(B_old^T)^{-1} = w_new^T*(B_new^T)^{-1}
  // Equivalently: B_old^{-1}*w_old = B_new^{-1}*w_new
  // So: w_new = B_new * B_old^{-1} * w_old
  const invBold = invertMatrix6(oldBasis);
  let newWidths;
  if (invBold) {
    const wInter = invBold.map(row => dot(row, wOld));
    // Step 2: w_new = B_new * wInter
    newWidths = newBasis.map(row => dot(row, wInter));
    newWidths = newWidths.map(w => Math.max(-99, Math.min(99, w)));
  } else {
    newWidths = [...COORD_SYSTEMS[newBasisKey].defaults];
  }

  layout.coordSystem = newSys;
  layout.widths = newWidths;
  layout.savedWidths = [...newWidths];
  // Ensure scope is wide enough to show new values
  if (!layout.widthScopes) layout.widthScopes = new Array(6).fill(5);
  layout.widthScopes = newWidths.map((w,i) => Math.max(layout.widthScopes[i]||5, Math.ceil(Math.abs(w))+1));
  buildWidthControls();
  applyAndDraw();
  markProjectDirty();
  updateLayoutDirtyIndicator();
});

// Custom basis input
document.getElementById('custom-basis-input').addEventListener('change', () => {
  const lines = document.getElementById('custom-basis-input').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const newBasis = [];
  for (const line of lines) {
    const r = parseRatio(line);
    if (r && r.expsOverride) { newBasis.push(r.expsOverride); continue; }
    if (r) { newBasis.push(ratioExponents(r)); continue; }
  }
  // Pad to 6
  while (newBasis.length < 6) newBasis.push([0,0,0,0,0,0]);
  layout.customBasis = newBasis.slice(0,6);
  applyAndDraw();
});

// Display option toggles
document.getElementById('show-octave-lines').addEventListener('change', e => {
  layout.showOctaveLines = e.target.checked;
  renderSVG();
  markProjectDirty();
  updateLayoutDirtyIndicator();
});
document.getElementById('show-semitone-lines').addEventListener('change', e => {
  layout.showSemitoneLines = e.target.checked;
  renderSVG();
  markProjectDirty();
  updateLayoutDirtyIndicator();
});

// Keyboard rotation
(function(){
  const slider = document.getElementById('keyboard-rotation');
  const numInput = document.getElementById('keyboard-rotation-num');
  function setRot(v) {
    v = Math.max(-180, Math.min(180, parseFloat(v)||0));
    layout.keyboardRotation = v;
    slider.value = v;
    numInput.value = v;
    if (window._syncOverlaySliders) window._syncOverlaySliders();
    renderSVG();
    updateViewDirtyIndicator();
    markProjectDirty();
  }
  slider.addEventListener('input', () => setRot(slider.value));
  numInput.addEventListener('change', () => setRot(numInput.value));
})();

// Zoom toward screen center by a zoom factor
function applyZoom(newZoomFactor) {
  // Commit any in-progress touch pan into viewState before zooming
  if (window._commitTouchPan) window._commitTouchPan();
  const zf = Math.max(0.001, newZoomFactor);
  const wrap = svgEl.parentElement;
  const cx = wrap.clientWidth / 2, cy = wrap.clientHeight / 2;
  const factor = zf / zoomFactor;
  viewState.panX = cx + (viewState.panX - cx) * factor;
  viewState.panY = cy + (viewState.panY - cy) * factor;
  zoomFactor = zf;
  syncScales();
  const zoomEl = document.getElementById('view-zoom');
  const zoomSlider = document.getElementById('view-zoom-slider');
  if (zoomEl) zoomEl.value = zf.toFixed(3);
  if (zoomSlider) zoomSlider.value = Math.log10(zf).toFixed(4);
  if (window._syncOverlaySliders) window._syncOverlaySliders();
  renderSVG();
}

// View zoom/pan inputs
(function(){
  const zoomEl = document.getElementById('view-zoom');
  const zoomSlider = document.getElementById('view-zoom-slider');
  const panxEl = document.getElementById('view-panx');
  const panyEl = document.getElementById('view-pany');

  // Zoom slider: log scale, slider position = log10(zoom)
  if (zoomSlider) {
    zoomSlider.addEventListener('input', () => {
      const z = Math.pow(10, parseFloat(zoomSlider.value));
      applyZoom(z);
    });
  }

  // Zoom number input: type the exact zoom value
  if (zoomEl) {
    zoomEl.addEventListener('input', () => {
      const v = parseFloat(zoomEl.value);
      if (v > 0) applyZoom(v);
    });
    zoomEl.addEventListener('change', () => {
      const v = parseFloat(zoomEl.value);
      if (v > 0) applyZoom(v);
    });
  }

  panxEl.addEventListener('change', () => {
    viewState.panX = parseFloat(panxEl.value)||0;
    renderSVG();
    updateViewDirtyIndicator();
    markProjectDirty();
  });
  panyEl.addEventListener('change', () => {
    viewState.panY = parseFloat(panyEl.value)||0;
    renderSVG();
    updateViewDirtyIndicator();
    markProjectDirty();
  });
})();

// New layout line controls
(function() {
  function wireLayoutColor(id, propName) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = layout[propName] || el.value;
    el.addEventListener('input', () => { layout[propName] = el.value; renderSVG(); markProjectDirty(); });
  }
  function wireLayoutNum(id, propName) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = layout[propName] !== undefined ? layout[propName] : el.value;
    el.addEventListener('input', () => { layout[propName] = parseFloat(el.value)||0; renderSVG(); markProjectDirty(); });
    el.addEventListener('change', () => { layout[propName] = parseFloat(el.value)||0; renderSVG(); markProjectDirty(); });
  }
  function wireLayoutCheck(id, propName, optsDivId) {
    const el = document.getElementById(id);
    const optsDiv = optsDivId ? document.getElementById(optsDivId) : null;
    if (!el) return;
    el.checked = layout[propName] !== undefined ? layout[propName] : el.checked;
    if (optsDiv) optsDiv.style.display = el.checked ? 'flex' : 'none';
    el.addEventListener('change', () => {
      layout[propName] = el.checked;
      if (optsDiv) optsDiv.style.display = el.checked ? 'flex' : 'none';
      renderSVG(); markProjectDirty();
    });
  }

  wireLayoutColor('octave-line-color', 'octaveLineColor');
  wireLayoutNum('octave-line-width', 'octaveLineWidth');
  wireLayoutColor('semitone-line-color', 'semitoneLineColor');
  wireLayoutNum('semitone-line-width', 'semitoneLineWidth');
  wireLayoutCheck('show-major-width-lines', 'showMajorWidthLines', 'major-width-line-opts');
  wireLayoutColor('major-width-color', 'majorWidthColor');
  wireLayoutNum('major-width-interval', 'majorWidthInterval');
  wireLayoutNum('major-width-stroke', 'majorWidthStroke');
  wireLayoutCheck('show-minor-width-lines', 'showMinorWidthLines', 'minor-width-line-opts');
  wireLayoutColor('minor-width-color', 'minorWidthColor');
  wireLayoutNum('minor-width-interval', 'minorWidthInterval');
  wireLayoutNum('minor-width-stroke', 'minorWidthStroke');

  // octave-line-opts visibility
  const octCb = document.getElementById('show-octave-lines');
  const octOpts = document.getElementById('octave-line-opts');
  if (octCb && octOpts) {
    octOpts.style.display = octCb.checked ? 'flex' : 'none';
    octCb.addEventListener('change', () => { octOpts.style.display = octCb.checked ? 'flex' : 'none'; });
  }
  // semitone-line-opts visibility
  const semiCb = document.getElementById('show-semitone-lines');
  const semiOpts = document.getElementById('semitone-line-opts');
  if (semiCb && semiOpts) {
    semiOpts.style.display = semiCb.checked ? 'flex' : 'none';
    semiCb.addEventListener('change', () => { semiOpts.style.display = semiCb.checked ? 'flex' : 'none'; });
  }

  // Background color
  const bgColorEl = document.getElementById('bg-color');
  const bgResetBtn = document.getElementById('btn-bg-color-reset');
  if (bgColorEl) {
    if (layout.bgColor) bgColorEl.value = layout.bgColor;
    bgColorEl.addEventListener('input', () => { layout.bgColor = bgColorEl.value; renderSVG(); markProjectDirty(); });
  }
  if (bgResetBtn) {
    bgResetBtn.addEventListener('click', () => { layout.bgColor = null; if (bgColorEl) bgColorEl.value = '#13120f'; renderSVG(); markProjectDirty(); });
  }
})();

document.getElementById('base-freq').addEventListener('input', ()=>{
  allKeysCache = getAllKeys();
  renderSVG();
  if (selectedHarmonyId) renderHarmonyEditor();
  markProjectDirty();
  updateLayoutDirtyIndicator();
});

document.getElementById('base-tone').addEventListener('change', ()=>{
  allKeysCache = getAllKeys();
  renderSVG();
  if (selectedHarmonyId) renderHarmonyEditor();
  markProjectDirty();
  updateLayoutDirtyIndicator();
});

// View tab buttons
document.addEventListener('click', e => {

  if (e.target.id === 'btn-save-view-tab' || e.target.closest('#btn-save-view-tab')) {
    saveCurrentView();
    updateViewDirtyIndicator();
    syncViewControls();
  }
  if (e.target.id === 'btn-revert-view' || e.target.closest('#btn-revert-view')) {
    resetView(); // resets to savedView
    updateViewDirtyIndicator();
  }
  if (e.target.id === 'btn-save-layout' || e.target.closest('#btn-save-layout')) {
    layout.savedLayoutState = getCurrentLayoutSnapshot();
    layout.savedWidths = [...layout.widths];
    updateLayoutDirtyIndicator();
    updateWidthsDirtyIndicator();
    markProjectDirty();
  }
  if (e.target.id === 'btn-revert-layout' || e.target.closest('#btn-revert-layout')) {
    if (!layout.savedLayoutState) return;
    layout.coordSystem = layout.savedLayoutState.coordSystem || 'reduced';
    layout.widths = JSON.parse(layout.savedLayoutState.widths);
    layout.showOctaveLines = layout.savedLayoutState.showOctaveLines !== false;
    layout.showSemitoneLines = !!layout.savedLayoutState.showSemitoneLines;
    layout.octaveEquiv = layout.savedLayoutState.octaveEquiv !== false;
    document.getElementById('coord-select').value = layout.coordSystem;
    document.getElementById('show-octave-lines').checked = layout.showOctaveLines;
    document.getElementById('show-semitone-lines').checked = layout.showSemitoneLines;
    document.getElementById('base-freq').value = layout.savedLayoutState.baseFreq || '261.63';
    const baseToneEl = document.getElementById('base-tone');
    if (baseToneEl) baseToneEl.value = layout.savedLayoutState.baseTone || 'D';
    const globalOctEl = document.getElementById('global-octave-equiv');
    if (globalOctEl) globalOctEl.checked = layout.octaveEquiv;
    buildWidthControls();
    applyAndDraw();
    updateLayoutDirtyIndicator();
  }
  if (e.target.id === 'btn-save-sound' || e.target.closest('#btn-save-sound')) {
    layout.savedSoundState = getCurrentSoundSnapshot();
    updateSoundDirtyIndicator();
    markProjectDirty();
  }
  if (e.target.id === 'btn-revert-sound' || e.target.closest('#btn-revert-sound')) {
    if (!layout.savedSoundState) return;
    const ss = layout.savedSoundState;
    function setV(id, val) { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; }
    setV('waveform', ss.waveform);
    setV('env-attack',        ss.attack);
    setV('env-release',       ss.release);
    setV('env-sustain',       ss.sustain);
    setV('master-vol',        ss.volume);
    setV('polyphony',         ss.polyphony);
    setV('synth-detune',      ss.detuneAmount);
    setV('synth-vib-rate',    ss.vibRate);
    setV('synth-vib-depth',   ss.vibDepth);
    setV('synth-filter-type', ss.filterType);
    setV('synth-filter-freq', ss.filterFreq);
    setV('synth-filter-q',    ss.filterQ);
    // Refresh all live value displays
    _soundSliders.forEach(({ id, valId, fmt }) => {
      const el = document.getElementById(id); const valEl = document.getElementById(valId);
      if (el && valEl) valEl.textContent = fmt(el.value);
    });
    updateSoundDirtyIndicator();
  }
});

// Wire View stretch sliders
(function(){
  const sxSlider = document.getElementById('view-stretch-x-slider');
  const sxNum = document.getElementById('view-stretch-x-num');
  const sySlider = document.getElementById('view-stretch-y-slider');
  const syNum = document.getElementById('view-stretch-y-num');
  function setStretchX(v) {
    v = Math.max(0.1, Math.min(5, parseFloat(v)||1));
    layout.viewStretchX = v;
    if (sxSlider) sxSlider.value = v.toFixed(2);
    if (sxNum) sxNum.value = v.toFixed(2);
    syncScales(); // recompute scaleX/Y with new stretch
    renderSVG();
    updateViewDirtyIndicator();
    markProjectDirty();
  }
  function setStretchY(v) {
    v = Math.max(0.1, Math.min(5, parseFloat(v)||1));
    layout.viewStretchY = v;
    if (sySlider) sySlider.value = v.toFixed(2);
    if (syNum) syNum.value = v.toFixed(2);
    syncScales(); // recompute scaleX/Y with new stretch
    renderSVG();
    updateViewDirtyIndicator();
    markProjectDirty();
  }
  if (sxSlider) sxSlider.addEventListener('input', () => setStretchX(sxSlider.value));
  if (sxNum) { sxNum.addEventListener('input', () => setStretchX(sxNum.value)); sxNum.addEventListener('change', () => setStretchX(sxNum.value)); }
  if (sySlider) sySlider.addEventListener('input', () => setStretchY(sySlider.value));
  if (syNum) { syNum.addEventListener('input', () => setStretchY(syNum.value)); syNum.addEventListener('change', () => setStretchY(syNum.value)); }
})();

// Global Octave Equivalence toggle
document.getElementById('global-octave-equiv').addEventListener('change', e => {
  layout.octaveEquiv = e.target.checked;
  harmonies.forEach(h => { h.octaveEquiv = layout.octaveEquiv; });
  applyAndDraw();
  markProjectDirty();
  updateLayoutDirtyIndicator();
});

// Sound settings — mark dirty
// Sound sliders: wire live value display + dirty state
const _soundSliders = [
  { id: 'master-vol',       valId: 'master-vol-val',      fmt: v => parseFloat(v).toFixed(2) },
  { id: 'env-attack',       valId: 'env-attack-val',       fmt: v => v + ' ms' },
  { id: 'env-sustain',      valId: 'env-sustain-val',      fmt: v => parseFloat(v).toFixed(2) },
  { id: 'env-release',      valId: 'env-release-val',      fmt: v => v + ' ms' },
  { id: 'synth-detune',     valId: 'synth-detune-val',     fmt: v => v + ' ¢' },
  { id: 'synth-vib-rate',   valId: 'synth-vib-rate-val',   fmt: v => parseFloat(v).toFixed(1) + ' Hz' },
  { id: 'synth-vib-depth',  valId: 'synth-vib-depth-val',  fmt: v => parseFloat(v).toFixed(1) + '%' },
  { id: 'synth-filter-freq',valId: 'synth-filter-freq-val',fmt: v => parseInt(v) + ' Hz' },
  { id: 'synth-filter-q',   valId: 'synth-filter-q-val',   fmt: v => parseFloat(v).toFixed(1) },
  { id: 'polyphony',        valId: 'polyphony-val',         fmt: v => v },
];
_soundSliders.forEach(({ id, valId, fmt }) => {
  const el = document.getElementById(id);
  const valEl = document.getElementById(valId);
  if (!el) return;
  function update() { if (valEl) valEl.textContent = fmt(el.value); markProjectDirty(); updateSoundDirtyIndicator(); }
  el.addEventListener('input',  update);
  el.addEventListener('change', update);
});
// Wire waveform and filter type selects too
['waveform', 'synth-filter-type'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => { markProjectDirty(); updateSoundDirtyIndicator(); });
});

// Add harmony button
document.getElementById('btn-add-harmony').addEventListener('click', () => {
  const h = makeHarmony({ name: `Harmony ${harmonies.length+1}`, ratios: '' });
  harmonies.push(h);
  selectedHarmonyId = h.id;
  renderHarmonyList();
  renderHarmonyEditor();
  applyAndDraw();
});

// Reset/Save View header buttons removed

// Lock/Unlock view
// Locked = closed padlock, Unlocked = open padlock
const LOCK_ICON_LOCKED   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
const LOCK_ICON_UNLOCKED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';

document.getElementById('btn-lock-view').addEventListener('click', ()=>{
  isViewLocked = !isViewLocked;
  const btn = document.getElementById('btn-lock-view');
  if (isViewLocked) {
    btn.classList.add('locked');
    btn.title = 'View locked — click to unlock pan/zoom/rotate';
    btn.innerHTML = LOCK_ICON_LOCKED;
  } else {
    btn.classList.remove('locked');
    btn.title = 'Unlock view (enable pan/zoom/rotate)';
    btn.innerHTML = LOCK_ICON_UNLOCKED;
  }
  if (window._updateOverlayVisibility) window._updateOverlayVisibility();
});
// Init with unlocked icon
(()=>{ document.getElementById('btn-lock-view').innerHTML = LOCK_ICON_UNLOCKED; })();

// Test sound
document.getElementById('btn-test-sound').addEventListener('click', ()=>{
  playKey({ freq: getBaseFreq(), label:'1', harmonyId:'test' });
});

// Theme toggle
(function(){
  const t=document.querySelector('[data-theme-toggle]');
  const r=document.documentElement;
  let d=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  r.setAttribute('data-theme',d);
  function updateIcon() {
    if(d==='light'){t.innerHTML=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;}
    else{t.innerHTML=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;}
  }
  if(t){
    updateIcon();
    t.addEventListener('click',()=>{
      d=d==='dark'?'light':'dark';
      r.setAttribute('data-theme',d);
      updateIcon();
      renderSVG();
    });
  }
})();

// Resize observer
new ResizeObserver(()=>{ renderSVG(); }).observe(document.getElementById('stage-wrap'));

// Panel resize handle
(function(){
  const handle = document.getElementById('panel-resize-handle');
  const panel = document.getElementById('side-panel');
  if (!handle || !panel) return;
  let resizing = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', e => {
    resizing = true;
    startX = e.clientX;
    startW = panel.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!resizing) return;
    const dx = startX - e.clientX; // panel is on right, so moving left increases width
    const newW = Math.max(260, Math.min(600, startW + dx));
    panel.style.width = newW + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    renderSVG();
  });
})();

// ── Floating overlay buttons: zoom + rotation ──
(function() {
  const overlayEl = document.getElementById('view-overlay-controls');
  const ZOOM_STEP = 1.10;  // 10% per click
  const ROT_STEP  = 5;     // 5 degrees per click
  let repeatTimer = null;

  function doZoom(dir) {
    if (window._commitTouchPan) window._commitTouchPan();
    applyZoom(zoomFactor * (dir > 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
  }

  function doRotate(dir) {
    const v = Math.max(-180, Math.min(180, (layout.keyboardRotation || 0) + dir * ROT_STEP));
    layout.keyboardRotation = v;
    const rs = document.getElementById('keyboard-rotation');
    const rn = document.getElementById('keyboard-rotation-num');
    if (rs) rs.value = v;
    if (rn) rn.value = v;
    renderSVG();
    updateViewDirtyIndicator();
    markProjectDirty();
  }

  function startRepeat(fn) {
    fn();
    repeatTimer = setInterval(fn, 120);
  }
  function stopRepeat() {
    clearInterval(repeatTimer); repeatTimer = null;
  }

  function wireBtn(id, fn) {
    const btn = document.getElementById(id);
    // Mouse
    btn.addEventListener('mousedown',  e => { e.preventDefault(); e.stopPropagation(); startRepeat(fn); });
    // Touch
    btn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); startRepeat(fn); }, {passive:false});
    btn.addEventListener('touchend',   e => { e.preventDefault(); stopRepeat(); }, {passive:false});
    btn.addEventListener('touchcancel',() => stopRepeat(), {passive:true});
  }

  wireBtn('btn-zoom-in',   () => doZoom(1));
  wireBtn('btn-zoom-out',  () => doZoom(-1));
  wireBtn('btn-rot-left',  () => doRotate(-1));
  wireBtn('btn-rot-right', () => doRotate(1));

  document.addEventListener('mouseup',    stopRepeat);
  document.addEventListener('mouseleave', stopRepeat);

  // Show/hide based on lock state
  function updateOverlayVisibility() {
    if (isViewLocked) overlayEl.classList.add('hidden');
    else              overlayEl.classList.remove('hidden');
  }
  window._updateOverlayVisibility = updateOverlayVisibility;
  // Remove stale ref (no longer needed)
  window._syncOverlaySliders = null;
})();

// (Feedback section now shows email address directly)

// ═════════════════════════════════════════════════════════════════════════════
//  INIT — Default project: Natural Scale harmony
// ═════════════════════════════════════════════════════════════════════════════

(function init() {
  const natural = makeHarmony({
    name: 'Natural Scale 8–15',
    ratios: '1, 9/8, 5/4, 11/8, 3/2, 13/8, 7/4, 15/8',
    octaveEquiv: true,
    keyShape: 'round',
    colorMode: 'limit',
    showLabels: true
  });
  harmonies.push(natural);
  selectedHarmonyId = natural.id;

  layout.coordSystem = 'reduced';
  layout.widths = [0, 2.0, 4.5, 4.0, 3.5, 1.6];
  layout.savedWidths = [...layout.widths];

  buildWidthControls();
  renderHarmonyList();
  renderHarmonyEditor();

  allKeysCache = getAllKeys();
  // Wait for layout to stabilize before computing view
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      // Load default project
      resetView(true); // force auto-compute on initial load
      saveCurrentView();
      // Save initial layout + sound state
      layout.savedLayoutState = getCurrentLayoutSnapshot();
      layout.savedSoundState = getCurrentSoundSnapshot();
      updateViewDirtyIndicator();
      updateLayoutDirtyIndicator();
      updateSoundDirtyIndicator();
    });
  });

  // Mobile: start with panel closed
  if (window.innerWidth < 960) {
    setPanelOpen(false);
  }

  initProjectName();
  initProjectDescription();
})();
