// Transformer modal: isolated draft, per-harmony persistence, diagram interactions.
const Transformer = (() => {
  const clone = x => JSON.parse(JSON.stringify(x));
  let state = null, dialog = null, previousFocus = null;
  let hoverLeaveTimer = null;
  const hoverTimers = new Set();
  const shapeFields = ['keySize','keyShape','keyRotation','keyStretchX','keyStretchY',
    'keyRounding','keyEdge','keyBulge','keyStrokeWidth','uniformColor','edgeColor',
    'opacity','keyOffsetX','keyOffsetY','labelFontSize','labelColor'];
  const syncGroups = {
    label: ['labelFontSize','labelColor','hideDerivedLabels'],
    shape: ['keyShape','keySize','uniformColor','edgeColor','keyStrokeWidth','opacity'],
    style: ['keyRounding','keyEdge','keyBulge'],
    geometry: ['keyRotation','keyStretchX','keyStretchY','keyOffsetX','keyOffsetY']
  };
  const icons = {
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    reset: '<path d="M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7"/>',
    style: '<path d="m4 20 4-1L20 7l-3-3L5 16zM14 7l3 3"/>',
    collapse: '<path d="m9 5 7 7-7 7M20 4v16"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    layout:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    transformations:'<path d="M3 7h4l10 10h4M3 17h4L17 7h4M17 3l4 4-4 4M17 13l4 4-4 4"/>',
    derived:'<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
    transport:'<path d="M14 3h7v7M21 3l-9 9M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
    pin:'<path d="m16 3 5 5-4 1-4 4-1 5-6-6 5-1 4-4zM9 15l-6 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  function icon(name) { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${icons[name]}</svg>`; }
  function inverseColor(color, fallback) {
    const match = /^#([0-9a-f]{6})$/i.exec(color || fallback);
    return match ? '#' + (0xffffff ^ parseInt(match[1], 16)).toString(16).padStart(6, '0') : '#ffffff';
  }
  function inherited(h) {
    const s = {};
    shapeFields.forEach(k => { s[k] = h[k]; });
    s.keySize = h.keySize ?? 120; s.uniformColor = h.uniformColor || '#ffffff';
    s.edgeColor = h.edgeColor || '#000000'; s.labelColor = h.labelColor || '#000000';
    s.labelFontSize = h.labelFontSize || 10;
    s.hideDerivedLabels = h.hideDerivedLabels ?? false;
    const w = clone(s);
    w.uniformColor = inverseColor(s.uniformColor, '#ffffff');
    w.edgeColor = inverseColor(s.edgeColor, '#000000');
    w.labelColor = inverseColor(s.labelColor, '#000000');
    w.keyRotation = (((s.keyRotation || 0) % 360) + 360) % 360 - 180;
    w.keyOffsetX = -(s.keyOffsetX || 0); w.keyOffsetY = -(s.keyOffsetY || 0);
    return {schritt: s, wechsel: w};
  }
  function defaults(h) {
    return {
      version: 1,
      circle: {size: 300, edgeWidth: 6, edgeColor: '#888888', rotation: 0},
      toneLabels: {show: h.showLabels !== false, type: h.labelType || 'ratio',
        fontSize: h.labelFontSize || 10, color: h.labelColor || '#000000',
        offset:0,
        hideDerived:false, showLetter:true},
      showSchritts: true, flipSchritts: false, secondarySize: 300,
      showCollapses: false, collapses: {edgeWidth: 4, edgeColor: '#b34b4b',hideWeak:false,hideDerived:true},
      ...inherited(h), wechselSync: {label:true,shape:true,style:true,geometry:true},
      expanded: [], panelOpen: true, viewport:[-700,-700,1400,1400],
      hovers:{neighborhoods:true,circles:true}, activeTab:'harmony', window:null,viewLocked:false,camera:null
    };
  }
  function hydrate(h) {
    const base = defaults(h), saved = h.transformer || {};
    const result = {...base, ...clone(saved)};
    ['circle','toneLabels','collapses','schritt','wechsel','wechselSync','hovers'].forEach(k => {
      result[k] = {...base[k], ...(saved[k] || {})};
    });
    if (!Array.isArray(result.expanded)) result.expanded = [];
    if(result.activeTab==='derived') result.activeTab='pinned';
    if(!['harmony','layout','design','transformations','pinned','transported'].includes(result.activeTab))
      result.activeTab='harmony';
    if(!Array.isArray(result.viewport) || result.viewport.length!==4 ||
      !result.viewport.every(Number.isFinite) || result.viewport[2]<=0 || result.viewport[3]<=0)
      result.viewport=base.viewport.slice();
    if(result.window && (!['left','top','width','height'].every(k=>Number.isFinite(result.window[k])) ||
      result.window.width<=0 || result.window.height<=0)) result.window=null;
    if(result.camera && (!['x','y','units'].every(k=>Number.isFinite(result.camera[k])) || result.camera.units<=0))
      result.camera=null;
    return result;
  }
  function get(path) { return path.split('.').reduce((o,k) => o[k], state.draft.config); }
  function set(path, value) {
    const keys = path.split('.'), last = keys.pop();
    keys.reduce((o,k) => o[k], state.draft.config)[last] = value;
    if (path.startsWith('schritt.')) {
      syncWechsel();
      refreshFields();
    }
    updateDirty(); draw();
  }
  function setViewport(viewport) {
    state.viewport=viewport.slice();
    state.draft.config.viewport=viewport.slice();
    dialog.querySelector('#tf-diagram').setAttribute('viewBox',viewport.join(' '));
    rememberCamera();
    updateDirty();
  }
  function rememberCamera() {
    const diagram=dialog?.querySelector('#tf-diagram'),matrix=diagram?.getScreenCTM();
    if(!matrix?.a || !matrix?.d)return;
    const rect=diagram.getBoundingClientRect(),point=diagram.createSVGPoint();point.x=rect.left;point.y=rect.top;
    const origin=point.matrixTransform(matrix.inverse());
    state.cameraFrame={x:origin.x,y:origin.y,ux:1/matrix.a,uy:1/matrix.d,w:rect.width,h:rect.height};
    state.draft.config.camera={x:origin.x,y:origin.y,units:1/matrix.a};
  }
  function preserveCamera(frame) {
    if(!frame)return;
    const rect=dialog.querySelector('#tf-diagram').getBoundingClientRect();
    if(rect.width>0 && rect.height>0 && (Math.abs(rect.width-frame.w)>.5 || Math.abs(rect.height-frame.h)>.5))
      setViewport([frame.x,frame.y,rect.width*frame.ux,rect.height*frame.uy]);
  }
  function syncSplit() {
    const config=state.draft.config,frame=state.cameraFrame;
    ConfigUI.splitPanel({root:dialog.querySelector('.tf-shell'),panel:dialog.querySelector('#tf-panel'),
      toolbarPanel:dialog.querySelector('#tf-toolbar-panel'),open:config.panelOpen,width:360});
    dialog.querySelector('#tf-show-panel').hidden=config.panelOpen;
    const actions=dialog.querySelector(config.panelOpen?'#tf-toolbar-panel':'#tf-stage-actions');
    actions.appendChild(dialog.querySelector('#tf-close'));
    const locked=!!config.viewLocked,button=dialog.querySelector('#tf-lock');
    button.title=locked?'Lock view':'Unlock view';button.setAttribute('aria-label',locked?'Unlock view':'Lock view');
    button.classList.toggle('locked',locked);
    button.setAttribute('aria-pressed',String(locked));
    button.innerHTML=locked?LOCK_ICON_LOCKED:LOCK_ICON_UNLOCKED;
    dialog.querySelector('#tf-fit').disabled=locked;
    preserveCamera(frame);
  }
  function syncWechsel(group, force = false) {
    const config = state.draft.config, inverse = inherited(config.schritt).wechsel;
    Object.entries(syncGroups).forEach(([name, fields]) => {
      if (group && name !== group) return;
      if (!force && !config.wechselSync[name]) return;
      fields.forEach(k => { config.wechsel[k] = inverse[k]; });
    });
  }
  function refreshFields() {
    dialog.querySelectorAll('[data-setting]').forEach(input => {
      const value = get(input.dataset.setting);
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value;
    });
    dialog.querySelectorAll('[data-slider]').forEach(input => {
      input.value = get(input.dataset.slider);
    });
    dialog.querySelectorAll('[data-sync-fields]').forEach(fields => {
      fields.disabled = !!get(`wechselSync.${fields.dataset.syncFields}`);
    });
    dialog.querySelectorAll('[data-sync-toggle]').forEach(button => {
      const on = !!get(`wechselSync.${button.dataset.syncToggle}`);
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('active', on);
    });
  }
  function hasChanges() {
    const current=clone(state.draft),saved=clone(state.saved),a=current.config.viewport,b=saved.config.viewport;
    const ac=current.config.camera,bc=saved.config.camera;
    delete current.config.viewport;delete saved.config.viewport;
    delete current.config.camera;delete saved.config.camera;
    if(JSON.stringify(current)!==JSON.stringify(saved))return true;
    if(ac&&bc)return ['x','y','units'].some(k=>Math.abs(ac[k]-bc[k])>
      Math.max(k==='units'?1e-7:.001,Math.abs(ac[k])*1e-6));
    return a.some((value,i)=>Math.abs(value-b[i])>Math.max(.001,Math.abs(value)*1e-6));
  }
  function updateDirty() {
    const dirty = hasChanges();
    dialog.querySelector('#tf-save').classList.toggle('tf-dirty', dirty);
    dialog.querySelector('#tf-title').textContent = `${state.draft.name || 'Unnamed harmony'}${dirty ? ' *' : ''}`;
  }
  function message(text, error = false) {
    const el = dialog.querySelector('#tf-status');
    el.textContent = text; el.classList.toggle('tf-error', error);
  }
  function svg(tag, attrs, parent) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(([k,v]) => el.setAttribute(k, v));
    if (parent) parent.appendChild(el);
    return el;
  }
  function field(parent, label, path, type = 'number', options = {}) {
    if (type === 'number') {
      const wrap = document.createElement('div'); wrap.className = 'field-row tf-slider';
      const title = document.createElement('label'); title.className = 'field-label sub-label';
      title.textContent = label;
      const row = document.createElement('div'); row.className = 'tf-slider-controls';
      const range = document.createElement('input'); range.type = 'range'; range.className = 'range-sm';
      range.id = `tf-slider-${path.replace(/\./g,'-')}`; title.htmlFor = range.id;
      range.dataset.slider = path;
      const number = document.createElement('input'); number.type = 'number'; number.className = 'field-input tf-slider-value';
      number.dataset.setting = path; number.setAttribute('aria-label', `${label} value`);
      ['min','max','step'].forEach(k => {
        if (options[k] !== undefined) { range[k] = options[k]; number[k] = options[k]; }
      });
      range.value = number.value = get(path);
      range.addEventListener('input', () => {
        number.value = range.value; set(path, range.valueAsNumber);
      });
      number.addEventListener('input', () => {
        if (!Number.isFinite(number.valueAsNumber)) return;
        const value = Math.max(options.min ?? -Infinity, Math.min(options.max ?? Infinity,number.valueAsNumber));
        if(value!==number.valueAsNumber) number.value=value;
        range.value = value; set(path,value);
      });
      row.append(range,number); wrap.append(title,row); parent.appendChild(wrap); return number;
    }
    const wrap = document.createElement('label'); wrap.className = 'tf-field';
    const title = document.createElement('span'); title.textContent = label; wrap.appendChild(title);
    let input;
    if (type === 'select') {
      input = document.createElement('select'); input.className = 'field-select';
      options.values.forEach(([value, text]) => {
        const o = document.createElement('option'); o.value = value; o.textContent = text; input.appendChild(o);
      });
    } else {
      input = document.createElement('input'); input.type = type;
      input.className = type === 'checkbox' ? '' : 'field-input';
      ['min','max','step'].forEach(k => { if (options[k] !== undefined) input[k] = options[k]; });
    }
    input.dataset.setting = path;
    if (type === 'checkbox') input.checked = !!get(path); else input.value = get(path);
    input.addEventListener(type === 'select' || type === 'checkbox' ? 'change' : 'input', () => {
      let value = input.value;
      if (type === 'number') {
        if (!Number.isFinite(input.valueAsNumber)) return;
        value = input.valueAsNumber;
        if (options.min !== undefined) value = Math.max(options.min, value);
        if (options.max !== undefined) value = Math.min(options.max, value);
      } else if (type === 'checkbox') value = input.checked;
      set(path, value);
    });
    wrap.appendChild(input); parent.appendChild(wrap); return input;
  }
  function section(parent, name, open = false, syncGroup = null) {
    const {el,summary,body}=ConfigUI.section(name,{open,className:'tf-section',key:`transformer:${name}`});
    body.classList.add('tf-section-body');
    if (syncGroup) {
      const actions = document.createElement('span'); actions.className = 'tf-sync-actions';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'tf-section-action';
      button.dataset.syncToggle = syncGroup;
      button.title = 'Keep in sync with Schritt';
      button.setAttribute('aria-label', `Sync ${name} with Schritt`);
      button.setAttribute('aria-pressed',String(!!get(`wechselSync.${syncGroup}`)));
      button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 .2l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.2l-3 3a5 5 0 0 0 7 7l2-2"/></svg>';
      button.addEventListener('click',e=>{
        e.preventDefault(); e.stopPropagation();
        state.draft.config.wechselSync[syncGroup] = !get(`wechselSync.${syncGroup}`);
        syncWechsel(syncGroup); refreshFields(); updateDirty(); draw();
      });
      const reset = document.createElement('button'); reset.type='button'; reset.className='tf-section-action';
      reset.dataset.syncReset = syncGroup;
      reset.title='Copy from Schritt';
      reset.setAttribute('aria-label',`Reset ${name} from Schritt`);
      reset.innerHTML=icon('reset');
      reset.addEventListener('click',e=>{
        e.preventDefault(); e.stopPropagation();
        syncWechsel(syncGroup,true); refreshFields(); updateDirty(); draw();
      });
      actions.append(button,reset); summary.insertBefore(actions,summary.lastChild);
      const fields=document.createElement('fieldset'); fields.className='tf-sync-fields';
      fields.dataset.syncFields=syncGroup; fields.disabled=!!get(`wechselSync.${syncGroup}`);
      body.appendChild(fields); parent.appendChild(el); return fields;
    }
    parent.appendChild(el); return body;
  }
  function conditional(parent, name, path, build) {
    const body=section(parent,name,true);
    const summary=body.parentElement.querySelector('summary');
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!!get(path);
    checkbox.dataset.setting=path;checkbox.setAttribute('aria-label',name);
    checkbox.addEventListener('click',e=>e.stopPropagation());
    checkbox.addEventListener('change',()=>set(path,checkbox.checked));
    summary.insertBefore(checkbox,summary.firstChild);
    build(body);
  }
  function pointControls(parent, label, key) {
    const group = name => key === 'wechsel' ? name : null;
    let body = section(parent, `${label} Label`,false,group('label'));
    field(body, 'Font Size', `${key}.labelFontSize`, 'number', {min: 4, max: 72, step: 1});
    field(body, 'Color', `${key}.labelColor`, 'color');
    field(body, 'Hide from pinned', `${key}.hideDerivedLabels`, 'checkbox');
    body = section(parent, `${label} Shape`,false,group('shape'));
    field(body, 'Shape', `${key}.keyShape`, 'select', {values: [
      ['round','Round'],['hex','Hexagon'],['diamond','Diamond'],['rect','Rectangle'],
      ['triangle','Triangle'],['square','Square'],['pentagon','Pentagon'],['octagon','Octagon']]});
    field(body, 'Size', `${key}.keySize`, 'number', {min: 4, max: 400, step: 1});
    field(body, 'Fill Color', `${key}.uniformColor`, 'color');
    field(body, 'Edge Width', `${key}.keyStrokeWidth`, 'number', {min: 0, max: 20, step: 0.5});
    field(body, 'Edge Color', `${key}.edgeColor`, 'color');
    field(body, 'Opacity', `${key}.opacity`, 'number', {min: 0, max: 1, step: 0.05});
    body = section(parent, `${label} Style`,false,group('style'));
    field(body, 'Rounding', `${key}.keyRounding`, 'number', {min: 0, max: 1, step: 0.05});
    field(body, 'Edge Form', `${key}.keyEdge`, 'select', {values: [['straight','Straight'],['convex','Convex'],['concave','Concave']]});
    field(body, 'Bulge Amount', `${key}.keyBulge`, 'number', {min: 0, max: 1, step: 0.05});
    body = section(parent, `${label} Geometry`,false,group('geometry'));
    field(body, 'Rotation', `${key}.keyRotation`, 'number', {min: -360, max: 360, step: 1});
    field(body, 'Stretch X', `${key}.keyStretchX`, 'number', {min: 0.1, max: 5, step: 0.05});
    field(body, 'Stretch Y', `${key}.keyStretchY`, 'number', {min: 0.1, max: 5, step: 0.05});
    field(body, 'Offset X', `${key}.keyOffsetX`, 'number', {min: -200, max: 200, step: 1});
    field(body, 'Offset Y', `${key}.keyOffsetY`, 'number', {min: -200, max: 200, step: 1});
  }
  function controls() {
    const root = dialog.querySelector('#tf-options'); root.innerHTML = '';
    const tabs=dialog.querySelector('#tf-tabs');tabs.replaceChildren();
    const names=[['harmony','Harmony','panel'],['layout','Layout','layout'],['design','Design','style'],
      ['transformations','Transformations','transformations'],['pinned','Pinned neighborhoods','pin'],['transported','Transported harmonies','transport']];
    const panes={};
    for(const [id,label,glyph] of names) {
      const button=document.createElement('button');button.type='button';button.className='tab tf-tab';
      button.dataset.tfTab=id;button.id=`tf-tab-${id}`;button.title=label;button.setAttribute('aria-label',label);
      button.setAttribute('role','tab');button.setAttribute('aria-controls',`tf-pane-${id}`);
      button.innerHTML=icon(glyph);ConfigUI.tab(button,label);tabs.appendChild(button);
      const pane=document.createElement('div');pane.className='tf-tab-pane';pane.id=`tf-pane-${id}`;
      pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);root.appendChild(pane);panes[id]=pane;
      button.addEventListener('click',()=>selectTab(id));
      button.addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
        e.preventDefault();const index=names.findIndex(x=>x[0]===id);
        const next=names[e.key==='Home'?0:e.key==='End'?names.length-1:(index+(e.key==='ArrowRight'?1:-1)+names.length)%names.length][0];
        selectTab(next);dialog.querySelector(`[data-tf-tab="${next}"]`).focus();
      });
    }
    let panel=panes.harmony;
    const nameWrap = document.createElement('label'); nameWrap.className = 'tf-name-field';
    nameWrap.innerHTML = '<span class="field-label">Harmony Name</span>';
    const name = document.createElement('input'); name.className = 'field-input'; name.id = 'tf-name';
    name.value = state.draft.name; nameWrap.appendChild(name); panel.appendChild(nameWrap);
    name.addEventListener('input', () => { state.draft.name = name.value; updateDirty(); });
    const tones = document.createElement('div'); tones.className = 'tf-tones';
    tones.innerHTML = `<div class="tf-tones-heading"><label class="field-label" for="tf-tones">Harmony Tones</label>
      <select id="tf-mode" class="field-select" aria-label="Tone definition format">
      <option value="ratios">Frequency Ratios</option><option value="vectors">Vectors</option></select></div>
      <textarea id="tf-tones" class="field-input" rows="3"></textarea>
      <div class="tf-tone-actions">
      <button type="button" class="btn-sm" data-op="multiply" title="Multiply by a harmony or transpose by one interval">Multiply</button>
      <button type="button" class="btn-sm" data-op="invert" title="Invert every tone">Invert</button>
      <button type="button" class="btn-sm" data-op="reduce" title="Reduce to one octave">Reduce</button>
      <button type="button" class="btn-sm" data-op="simplify" title="Toggle simplified and original expressions">Simplify</button></div>`;
    panel.appendChild(tones);
    const ta = tones.querySelector('textarea'), mode = tones.querySelector('select');
    ta.value = state.draft.ratios; mode.value = state.draft.toneMode;
    const placeholder = () => { ta.placeholder = mode.value === 'vectors' ? 'e.g. (0,0), (-2,0,1), (-1,1)' : 'e.g. 1, 5/4, 3/2'; };
    placeholder();
    let original = null;
    const simplify = tones.querySelector('[data-op="simplify"]');
    function resetSimplify() { original = null; simplify.textContent = 'Simplify'; simplify.classList.remove('active'); }
    function changed() {
      state.draft.ratios = ta.value; state.draft.config.expanded = [];
      state.selectedNode=null;state.menuOpen=false;state.collectionSelection={};
      updateDirty(); draw();
    }
    ta.addEventListener('input', () => { resetSimplify(); changed(); });
    mode.addEventListener('change', () => {
      const result = convertToneMode(ta.value, state.draft.toneMode, mode.value);
      if (result.warnings.length) {
        message(result.warnings.join('; '), true); mode.value = state.draft.toneMode; return;
      }
      state.draft.toneMode = mode.value; ta.value = result.text; placeholder(); resetSimplify(); changed();
    });
    tones.querySelectorAll('[data-op]').forEach(button => button.addEventListener('click', () => {
      const op = button.dataset.op;
      const temp = {ratios: ta.value, toneMode: mode.value};
      if (op === 'multiply') {
        const input = prompt(`Enter a comma-separated harmony in ${mode.value === 'vectors' ? 'vector' : 'frequency ratio'} format.\nEach current tone is multiplied by every input tone. One interval acts as a transposition.`,
          mode.value === 'vectors' ? '(0,1)' : '3/2');
        if (!input) return;
        multiplyHarmony(temp, input, mode.value); resetSimplify();
      } else if (op === 'invert') { invertHarmony(temp); resetSimplify(); }
      else if (op === 'reduce') {
        // Use the same octave-normalization as the diagram (also correct for fractional vectors).
        try {
          const parsed = TransformerMath.parse(temp.ratios, temp.toneMode);
          temp.ratios = TransformerMath.imageText(parsed, TransformerMath.identity(parsed.length), temp.toneMode);
        } catch (e) { message(e.message, true); return; }
        resetSimplify();
      } else if (original === null) {
        original = ta.value; temp.ratios = simplifyRatioList(ta.value, mode.value);
        simplify.textContent = 'Original'; simplify.classList.add('active');
      } else { temp.ratios = original; resetSimplify(); }
      ta.value = temp.ratios; changed();
    }));
    panel=panes.layout;
    const circleWrapper=document.createElement('div');
    let body = section(circleWrapper, 'Circle Style', true);
    field(body, 'Size', 'circle.size', 'number', {min: 50, max: 2000, step: 10});
    field(body, 'Edge Width', 'circle.edgeWidth', 'number', {min: 0, max: 20, step: 0.1});
    field(body, 'Edge Color', 'circle.edgeColor', 'color');
    field(body, 'Rotation', 'circle.rotation', 'number', {min: -360, max: 360, step: 1});
    const toneWrapper=document.createElement('div');
    conditional(toneWrapper, 'Show Tone Labels', 'toneLabels.show', b => {
      field(b, 'Type', 'toneLabels.type', 'select', {values: [['ratio','Ratio'],['cents','Cents'],['heji','Tone name (HEJI)']]});
      field(b, 'Font Size', 'toneLabels.fontSize', 'number', {min: 4, max: 72, step: 1});
      field(b, 'Offset', 'toneLabels.offset', 'number', {min: -200, max: 200, step: 1});
      field(b, 'Show letter', 'toneLabels.showLetter', 'checkbox');
      field(b, 'Hide from pinned', 'toneLabels.hideDerived', 'checkbox');
      field(b, 'Color', 'toneLabels.color', 'color');
    });
    conditional(panel, 'Show Nontrivial Schritts', 'showSchritts', b => {
      const flip=field(b, 'Flip Schritts', 'flipSchritts', 'checkbox');
      const secondary=field(b, 'Secondary Circle Size', 'secondarySize', 'number', {min: 10, max: 2000, step: 10}).closest('.field-row');
      secondary.hidden=!get('flipSchritts');
      flip.addEventListener('change',()=>{secondary.hidden=!flip.checked;});
    });
    conditional(panel, 'Show Collapses', 'showCollapses', b => {
      field(b, 'Edge Width', 'collapses.edgeWidth', 'number', {min: 0, max: 20, step: 0.5});
      field(b, 'Edge Color', 'collapses.edgeColor', 'color');
      field(b, 'Hide weak collapses', 'collapses.hideWeak', 'checkbox');
      field(b, 'Hide from pinned', 'collapses.hideDerived', 'checkbox');
    });
    panel.append(...toneWrapper.childNodes,...circleWrapper.childNodes);
    body=section(panel,'Hovers',true);
    field(body,'Show harmony neighborhoods','hovers.neighborhoods','checkbox');
    field(body,'Show tone circles','hovers.circles','checkbox');
    panel=panes.design;
    pointControls(panel, 'Schritt', 'schritt'); pointControls(panel, 'Wechsel', 'wechsel');
    refreshFields();
    selectTab(get('activeTab'),false);
    renderCollections();
  }
  function selectTab(id,dirty=true) {
    const target=dialog.querySelector(`#tf-pane-${id}`)?id:'harmony';
    state.draft.config.activeTab=target;
    dialog.querySelectorAll('[data-tf-tab]').forEach(button=>{
      const selected=button.dataset.tfTab===target;
      button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
    });
    dialog.querySelectorAll('.tf-tab-pane').forEach(pane=>{pane.hidden=pane.id!==`tf-pane-${target}`;});
    renderCollections();
    if(dirty) updateDirty();
  }
  function displayLabel(parent, x, y, text, size, color, html = false) {
    if (html && text.includes('<')) {
      const fo = svg('foreignObject', {x: x - size * 4, y: y - size * 1.5, width: size * 8, height: size * 3, 'pointer-events': 'none', overflow: 'visible'}, parent);
      const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      div.style.cssText = `display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:${size}px;color:${color};`;
      div.innerHTML = text; fo.appendChild(div);
    } else {
      svg('text', {x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': size, fill: color, 'pointer-events': 'none'}, parent).textContent = text;
    }
  }
  function toneLabelPosition(circle,origin) {
    const dx=circle.center[0]-origin[0],dy=circle.center[1]-origin[1],length=Math.hypot(dx,dy)||1;
    const offset=Number(get('toneLabels.offset'))||0;
    const factor=Math.max(0,length+offset)/length;
    return [origin[0]+dx*factor,origin[1]+dy*factor];
  }
  function draw() {
    if (!state) return;
    dialog.querySelector('#tf-point-menu').hidden = true;
    const diagram = dialog.querySelector('#tf-diagram'), config = state.draft.config;
    clearHighlight();
    syncSplit();
    let tones;
    try { tones = TransformerMath.parse(state.draft.ratios, state.draft.toneMode); }
    catch (e) {
      diagram.replaceChildren(); message(e.message, true); state.nodes=[];state.scenes=[];state.tones=null;
      state.selectedNode=null;state.menuOpen=false;renderCollections();return;
    }
    state.tones = tones;
    const scenes = [], nodeMap = new Map(), catalogMap=new Map();
    function visit(path, parent, origin) {
      const scene = TransformerMath.neighborhood(tones, parent, origin, config);
      scene.path=path; scene.id=JSON.stringify(path); scene.depth=path.length;scene.origin=origin;
      const shown=!path.length || config.expanded.some(p=>JSON.stringify(p)===scene.id);
      if(shown) scenes.push(scene);
      scene.allNodes=config.showSchritts?scene.nodes:
        TransformerMath.neighborhood(tones,parent,origin,{...config,showSchritts:true}).nodes;
      function identify(n) {
        n.path = n.origin ? path : [...path, n.slot]; n.id = JSON.stringify(n.path);
        n.depth=path.length; n.scene=scene.id;
        return n;
      }
      scene.allNodes.forEach(n=>{identify(n);if(shown && !catalogMap.has(n.id))catalogMap.set(n.id,n);});
      scene.nodes.forEach(n=>{identify(n);if(shown && !nodeMap.has(n.id))nodeMap.set(n.id,n);});
      if (path.length >= 8) return;
      // Traverse implicit ancestors for coordinates, without displaying or pinning them.
      const next=[...new Map(config.expanded.filter(p=>Array.isArray(p) && p.length>path.length &&
        path.every((s,i)=>p[i]===s)).map(p=>[JSON.stringify(p.slice(0,path.length+1)),p.slice(0,path.length+1)])).values()];
      next.forEach(p => {
        const anchor = scene.allNodes.find(n => n.slot === p[p.length - 1]);
        if (anchor) visit(p, anchor.op, anchor.point);
      });
    }
    try { visit([], TransformerMath.identity(tones.length), [0, 0]); }
    catch (e) { message(e.message, true); return; }
    const nodes = [...nodeMap.values()]; state.nodes = nodes;
    state.catalogNodes=[...catalogMap.values()].sort((a,b)=>Number(a.op.inverted)-Number(b.op.inverted));
    state.scenes=scenes;
    diagram.replaceChildren();
    const circlesLayer = svg('g', {'data-layer':'circles'}, diagram);
    const lineLayer = svg('g', {'data-layer':'collapses'}, diagram);
    const labelLayer = svg('g', {'data-layer':'tone-labels'}, diagram);
    const pointLayer = svg('g', {'data-layer':'points'}, diagram);
    const bounds = [];
    scenes.forEach(scene => scene.circles.forEach((c, index) => {
      const [x, y] = c.center;
      const toneIndex=index % tones.length;
      const members=scene.nodes.filter(n=>{
        if(n.slot==='origin') return !c.secondary;
        const [kind,i,j]=n.slot.split(':');
        if(kind==='w') return !c.secondary && (+i===toneIndex || +j===toneIndex);
        return +i===toneIndex && !!c.secondary===!!config.flipSchritts;
      }).map(n=>n.id);
      bounds.push([x - c.radius, y - c.radius], [x + c.radius, y + c.radius]);
      const circle=svg('circle', {cx: x, cy: y, r: c.radius, fill:'none', stroke:config.circle.edgeColor,
        class:'tf-circle tf-visual','data-scene':scene.id,'data-depth':scene.depth,'data-tone-index':toneIndex,
        'stroke-width':config.circle.edgeWidth * Math.pow(.6,scene.depth), 'stroke-dasharray':c.secondary ? '6 4' : '',
        opacity:(c.secondary ? 0.4 : 0.65) * Math.pow(.78,scene.depth)}, circlesLayer);
      const highlight=()=>highlightTone(circle,members,scene.id,toneIndex);
      circle.addEventListener('pointerenter',highlight);
      circle.addEventListener('pointerleave',leaveHighlight);
      if (!c.secondary && config.toneLabels.show && !(scene.depth && config.toneLabels.hideDerived)) {
        const t = c.tone, opts = config.toneLabels;
        const [labelX,labelY]=toneLabelPosition(c,scene.origin);
        const label = getKeyLabel({label:t.display, cents:t.log * 1200, _exps:t.v}, {labelType:opts.type});
        const toneGroup=svg('g',{class:'tf-tone-label tf-visual','data-scene':scene.id,'data-tone-index':toneIndex,
          'data-depth':scene.depth,opacity:Math.pow(.85,scene.depth),tabindex:0,role:'img',
          'aria-label':`Tone ${t.letter}: ${t.display}`},labelLayer);
        svg('rect',{x:labelX-opts.fontSize*5,y:labelY-opts.fontSize*1.5,
          width:opts.fontSize*10,height:opts.fontSize*3,fill:'transparent'},toneGroup);
        displayLabel(toneGroup, labelX, labelY, `${opts.showLetter ? t.letter+' = ' : ''}${label}`,
          opts.fontSize * 2, opts.color, opts.type === 'heji');
        toneGroup.addEventListener('pointerenter',highlight);
        toneGroup.addEventListener('pointerleave',leaveHighlight);
        toneGroup.addEventListener('focus',highlight);
        toneGroup.addEventListener('blur',leaveHighlight);
      }
    }));
    if (config.showCollapses) {
      const groups = new Map();
      nodes.forEach(n => {
        if(config.collapses.hideDerived && n.depth>0) return;
        const k = TransformerMath.imageKey(tones, n.op);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(n);
      });
      groups.forEach(group => {
        function link(a,b,kind) {
          if(kind==='sw' && config.collapses.hideWeak)return;
          svg('line',{
            x1:a.point[0],y1:a.point[1],x2:b.point[0],y2:b.point[1],
            class:'tf-visual','data-from':a.id,'data-to':b.id,'data-kind':kind,
            'data-depth':Math.max(a.depth,b.depth),
            stroke:config.collapses.edgeColor,'stroke-width':config.collapses.edgeWidth*(kind==='ww'?1:.5),
            'stroke-dasharray':kind==='sw'?'8 6':'',opacity:.65,'pointer-events':'none'
          },lineLayer);
        }
        // Connected same-kind spanning sets plus one mixed bridge remain linear in group size.
        const w=group.filter(n=>n.op.inverted),s=group.filter(n=>!n.op.inverted);
        for(let i=1;i<w.length;i++) link(w[0],w[i],'ww');
        for(let i=1;i<s.length;i++) link(s[0],s[i],'ss');
        if(w.length && s.length) link(s[0],w[0],'sw');
      });
    }
    nodes.sort((a,b) => Number(a.op.inverted) - Number(b.op.inverted)).forEach(n => {
      const style = n.op.inverted ? config.wechsel : config.schritt;
      const [x,y] = [n.point[0] + (style.keyOffsetX || 0), n.point[1] + (style.keyOffsetY || 0)];
      // Keyboard keySize is in cents-like units; map it to the prototype's diagram scale.
      const markerSize = style.keySize * 0.25 * Math.pow(.85,n.depth);
      const extent = markerSize * Math.max(style.keyStretchX, style.keyStretchY) + 40;
      bounds.push([x - extent, y - extent], [x + extent, y + extent]);
      const group = svg('g', {'class':'tf-point tf-visual', 'data-node':n.id, 'data-monomial':TransformerMath.monomial(n.op),
        'data-op':TransformerMath.opKey(n.op),'data-scene':n.scene,'data-depth':n.depth,opacity:Math.pow(.78,n.depth),
        role:'button', tabindex:'0', 'aria-label':`${n.op.inverted ? 'Wechsel' : 'Schritt'} ${TransformerMath.monomial(n.op)}`}, pointLayer);
      svg('title', {}, group).textContent = `${n.op.inverted ? 'Wechsel' : 'Schritt'} ${TransformerMath.monomial(n.op)} · click for actions`;
      const geometry = buildKeyPath(x, y, markerSize, style, false);
      let shape;
      if (geometry.type === 'circle') shape = svg('circle', {cx:x,cy:y,r:geometry.r}, group);
      else if (geometry.type === 'ellipse') { shape = geometry.el; group.appendChild(shape); }
      else shape = svg('path', {d:geometry.d}, group);
      Object.entries({fill:style.uniformColor, stroke:style.edgeColor, 'stroke-width':style.keyStrokeWidth, opacity:style.opacity}).forEach(([k,v]) => shape.setAttribute(k,v));
      const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
      const label = TransformerMath.monomial(n.op).replace(/\^(\d+)/g, (_, n) => [...n].map(d => superscripts[d]).join(''));
      if(!(n.depth && style.hideDerivedLabels))
        displayLabel(group, x, y, label, style.labelFontSize * 2, style.labelColor);
      const show = e => { e.stopPropagation(); pointMenu(n, e); };
      group.addEventListener('click', show);
      group.addEventListener('pointerenter',()=>highlightNeighborhood(n));
      group.addEventListener('pointerleave',leaveHighlight);
      group.addEventListener('focus',()=>highlightNeighborhood(n));
      group.addEventListener('blur',leaveHighlight);
      group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(e); } });
    });
    if (state.fitRequested) {
      const margin = 40;
      const minX = Math.min(...bounds.map(p=>p[0])) - margin, minY = Math.min(...bounds.map(p=>p[1])) - margin;
      const width = Math.max(100, Math.max(...bounds.map(p=>p[0])) - minX + margin);
      const height = Math.max(100, Math.max(...bounds.map(p=>p[1])) - minY + margin);
      state.fitRequested=false;
      const rect=diagram.getBoundingClientRect();
      const availableWidth=Math.max(1,rect.width);
      const scale=Math.max(.001,Math.min(availableWidth/width,rect.height/height));
      const worldWidth=rect.width/scale,worldHeight=rect.height/scale;
      setViewport([minX+width/2-availableWidth/(2*scale),minY+height/2-worldHeight/2,worldWidth,worldHeight]);
    }
    if(!state.cameraFrame && config.camera) {
      const {x,y,units}=config.camera,r=diagram.getBoundingClientRect();
      state.viewport=[x,y,r.width*units,r.height*units];config.viewport=state.viewport.slice();
    }
    diagram.setAttribute('viewBox', state.viewport.join(' '));
    rememberCamera();
    message(`${tones.length} tones · ${scenes.length} neighborhood${scenes.length === 1 ? '' : 's'} · ${nodes.length} transformations`);
    renderCollections();
    restoreSelection();
    if(state.menuOpen && state.selectedNode) renderPointMenu(state.selectedNode);
  }
  function clearHighlight() {
    if(!dialog) return;
    clearTimeout(hoverLeaveTimer); hoverLeaveTimer=null;
    hoverTimers.forEach(clearTimeout); hoverTimers.clear();
    const diagram=dialog.querySelector('#tf-diagram');
    diagram.classList.remove('tf-has-highlight');
    diagram.querySelectorAll('.tf-emphasized').forEach(e=>e.classList.remove('tf-emphasized'));
    diagram.querySelectorAll('.tf-hover-layer').forEach(e=>e.remove());
  }
  function fadeHighlight() {
    const diagram=dialog?.querySelector('#tf-diagram'); if(!diagram) return;
    diagram.classList.remove('tf-has-highlight');
    diagram.querySelectorAll('.tf-emphasized').forEach(e=>e.classList.remove('tf-emphasized'));
    diagram.querySelectorAll('.tf-hover-layer.tf-hover-visible').forEach(layer=>{
      layer.classList.remove('tf-hover-visible');
      const timer=setTimeout(()=>{layer.remove();hoverTimers.delete(timer);},400);
      hoverTimers.add(timer);
    });
  }
  function leaveHighlight() {
    clearTimeout(hoverLeaveTimer);
    hoverLeaveTimer=setTimeout(()=>{
      hoverLeaveTimer=null;
      if(state?.selectedNode) restoreSelection(); else fadeHighlight();
    },180);
  }
  function hoverLayer(preview=false) {
    clearTimeout(hoverLeaveTimer); hoverLeaveTimer=null;
    fadeHighlight();
    const diagram=dialog.querySelector('#tf-diagram');
    const layer=svg('g',{class:'tf-hover-layer','data-layer':preview?'hover-preview':'hover-highlight',
      'pointer-events':'none'});
    diagram.insertBefore(layer,diagram.firstChild);
    return layer;
  }
  function revealHighlight(layer) {
    // Establish the transparent initial style before starting the CSS transition.
    layer.getBoundingClientRect();
    layer.classList.add('tf-hover-visible');
  }
  function highlightCircle(layer,circle) {
    svg('circle',{cx:circle.getAttribute('cx'),cy:circle.getAttribute('cy'),r:circle.getAttribute('r'),
      fill:'#eadfbd','fill-opacity':.55,stroke:'#b48b32','stroke-width':Number(circle.getAttribute('stroke-width'))+4,
      'stroke-dasharray':circle.getAttribute('stroke-dasharray')||'','stroke-opacity':.45},layer);
  }
  function emphasizeNodes(ids) {
    dialog.querySelectorAll('.tf-point').forEach(e=>{
      if(ids.has(e.dataset.node)) e.classList.add('tf-emphasized');
    });
    dialog.querySelectorAll('[data-layer="collapses"] line').forEach(e=>{
      if(ids.has(e.dataset.from) && ids.has(e.dataset.to)) e.classList.add('tf-emphasized');
    });
  }
  function highlightTone(circle,members,sceneId,toneIndex) {
    if(!get('hovers.circles')) return;
    const layer=hoverLayer();
    highlightCircle(layer,circle);
    const diagram=dialog.querySelector('#tf-diagram'); diagram.classList.add('tf-has-highlight');
    circle.classList.add('tf-emphasized');
    diagram.querySelectorAll('.tf-tone-label').forEach(e=>{
      if(e.dataset.scene===sceneId && +e.dataset.toneIndex===toneIndex) e.classList.add('tf-emphasized');
    });
    emphasizeNodes(new Set(members));
    revealHighlight(layer);
  }
  function paintPreviewPoint(parent,node,depth) {
    const style=node.op.inverted?get('wechsel'):get('schritt');
    const x=node.point[0]+(style.keyOffsetX||0),y=node.point[1]+(style.keyOffsetY||0);
    const group=svg('g',{class:'tf-preview-point','data-monomial':TransformerMath.monomial(node.op)},parent);
    const geometry=buildKeyPath(x,y,style.keySize*.25*Math.pow(.85,depth),style,false);
    let shape;
    if(geometry.type==='circle') shape=svg('circle',{cx:x,cy:y,r:geometry.r},group);
    else if(geometry.type==='ellipse') {shape=geometry.el;group.appendChild(shape);}
    else shape=svg('path',{d:geometry.d},group);
    Object.entries({fill:style.uniformColor,stroke:style.edgeColor,'stroke-width':style.keyStrokeWidth,opacity:style.opacity})
      .forEach(([k,v])=>shape.setAttribute(k,v));
    if(!(depth && style.hideDerivedLabels)) {
      const superscripts='⁰¹²³⁴⁵⁶⁷⁸⁹';
      const label=TransformerMath.monomial(node.op).replace(/\^(\d+)/g,(_,n)=>[...n].map(d=>superscripts[d]).join(''));
      displayLabel(group,x,y,label,style.labelFontSize*2,style.labelColor);
    }
  }
  function paintPreviewTone(parent,circle,depth,origin) {
    const opts=get('toneLabels');
    if(circle.secondary || !opts.show || (depth && opts.hideDerived)) return;
    const t=circle.tone;
    const label=getKeyLabel({label:t.display,cents:t.log*1200,_exps:t.v},{labelType:opts.type});
    const group=svg('g',{class:'tf-preview-tone-label'},parent);
    const [x,y]=toneLabelPosition(circle,origin);
    displayLabel(group,x,y,
      `${opts.showLetter?t.letter+' = ':''}${label}`,opts.fontSize*2,opts.color,opts.type==='heji');
  }
  function highlightNeighborhood(node,force=false) {
    if(!node || (!force && !get('hovers.neighborhoods'))) return;
    const layer=hoverLayer(!state.scenes.some(s=>s.id===node.id));
    const diagram=dialog.querySelector('#tf-diagram'); diagram.classList.add('tf-has-highlight');
    const scene=state.scenes.find(s=>s.id===node.id);
    if(scene) {
      diagram.querySelectorAll('[data-scene]').forEach(e=>{
        if(e.dataset.scene===scene.id) e.classList.add('tf-emphasized');
      });
      diagram.querySelectorAll('.tf-circle').forEach(circle=>{
        if(circle.dataset.scene===scene.id) highlightCircle(layer,circle);
      });
      emphasizeNodes(new Set(scene.nodes.map(n=>n.id)));
      scene.nodes.forEach(n=>paintPreviewPoint(layer,n,scene.depth));
      revealHighlight(layer);
      return;
    }
    // Temporary preview for a neighborhood not yet expanded. It never changes saved state.
    const preview=TransformerMath.neighborhood(state.tones,node.op,node.point,state.draft.config);
    const overlay=layer;
    preview.circles.forEach(c=>{
      svg('circle',{cx:c.center[0],cy:c.center[1],r:c.radius,fill:'#eadfbd','fill-opacity':.35,
        stroke:'#b48b32','stroke-width':3,opacity:.6},overlay);
      paintPreviewTone(overlay,c,node.path.length,node.point);
    });
    const ops=new Set();
    preview.nodes.forEach(n=>{
      ops.add(TransformerMath.opKey(n.op));
      paintPreviewPoint(overlay,n,node.path.length);
    });
    diagram.querySelectorAll('.tf-point').forEach(e=>{
      if(e.dataset.node===node.id || ops.has(e.dataset.op)) e.classList.add('tf-emphasized');
    });
    revealHighlight(layer);
  }
  function highlightPoint(node) {
    if(!node) return;
    const layer=hoverLayer();
    const matches=[...dialog.querySelectorAll('.tf-point')].filter(e=>e.dataset.op===TransformerMath.opKey(node.op));
    matches.forEach(e=>e.classList.add('tf-emphasized'));
    if(!matches.length) paintPreviewPoint(layer,node,node.depth||0);
    revealHighlight(layer);
  }
  function restoreSelection() {
    if(!state?.selectedNode) return;
    const node=state.nodes.find(n=>n.id===state.selectedNode.id)||state.selectedNode;
    state.selectedNode=node;
    dialog.querySelectorAll('.tf-point').forEach(e=>e.classList.toggle('tf-selected',e.dataset.op===TransformerMath.opKey(node.op)));
    if(state.selectionMode==='point') highlightPoint(node); else highlightNeighborhood(node,true);
  }
  function dismissSelection() {
    state.selectedNode=null;state.menuOpen=false;
    dialog.querySelector('#tf-point-menu').hidden=true;
    dialog.querySelectorAll('.tf-selected').forEach(e=>e.classList.remove('tf-selected'));
    clearHighlight();renderCollections();
  }
  function selectNode(node,mode='neighborhood') {
    if(!node) return;
    state.selectedNode=node;state.selectionMode=mode;restoreSelection();renderCollections();
    if(['transformations','transported'].includes(get('activeTab')))
      dialog.querySelector(`#tf-pane-${get('activeTab')} .tf-selected-group`)?.scrollIntoView({block:'nearest'});
  }
  function highlightIncludedTone(node,key) {
    if(!get('hovers.circles')) return;
    const preview=TransformerMath.neighborhood(state.tones,node.op,node.point,state.draft.config);
    const layer=hoverLayer();
    const circle=preview.circles.find(c=>!c.secondary &&
      Math.abs((((c.tone.log*1200-key.cents)%1200)+1800)%1200-600)<.01);
    if(!circle) {revealHighlight(layer);return;}
    const index=preview.circles.indexOf(circle);
    svg('circle',{cx:circle.center[0],cy:circle.center[1],r:circle.radius,fill:'#eadfbd','fill-opacity':.55,
      stroke:'#b48b32','stroke-width':5},layer);
    paintPreviewTone(layer,circle,node.path.length,node.point);
    preview.nodes.filter(n=>{
      if(n.origin) return true;
      const [kind,i,j]=n.slot.split(':');
      return kind==='w'?(+i===index||+j===index):!get('flipSchritts') && +i===index;
    }).forEach(n=>paintPreviewPoint(layer,n,node.path.length));
    revealHighlight(layer);
  }
  function pointMenu(node, event) {
    state.menuOpen=true;
    selectNode(node);
    const rect=dialog.querySelector('.tf-stage').getBoundingClientRect();
    const target=event.currentTarget.getBoundingClientRect();
    state.menuPosition={x:(event.clientX||target.left+target.width/2)-rect.left,
      y:(event.clientY||target.top+target.height/2)-rect.top};
    renderPointMenu(node);
  }
  function imageHarmony(node) {
    const style=node.op.inverted?get('wechsel'):get('schritt');
    const op={inverted:node.op.inverted,q:state.tones.map((_,i)=>node.op.q[i]||0)};
    return {...snapshotHarmony(state.source),...clone(style),colorMode:'uniform',
      name:`${TransformerMath.monomial(node.op)} of ${state.draft.name}`,octaveEquiv:true,
      toneMode:state.draft.toneMode,ratios:TransformerMath.imageText(state.tones,op,state.draft.toneMode),
      transformer:null,transport:null};
  }
  function transportedFor(node) {
    return harmonies.find(h=>h.transport?.sourceId===state.source.id &&
      TransformerMath.opKey(h.transport.op)===TransformerMath.opKey(node.op));
  }
  async function transportNode(node) {
    const existing=transportedFor(node);
    if(existing) {
      harmonies=harmonies.filter(h=>h.id!==existing.id);
      if(selectedHarmonyId===existing.id) selectedHarmonyId=state.source.id;
    } else {
      if(state.source.ratios!==state.draft.ratios || state.source.name!==state.draft.name ||
        state.source.toneMode!==state.draft.toneMode) {
        if(!await confirmAction('Save the source harmony changes before transporting this transformation?','Save and transport')) return;
        if(!save()) return;
      }
      const h=makeHarmony({...imageHarmony(node),
        transport:{sourceId:state.source.id,op:clone(node.op),path:clone(node.path),point:clone(node.point)}});
      harmonies.push(h);
      // A transported harmony must remain reopenable even if the user has not saved this draft yet.
      if(!state.source.transformer) state.source.transformer=clone(state.saved.config);
    }
    renderHarmonyList();renderHarmonyEditor();applyAndDraw();markProjectDirty();
    renderCollections();
    if(state.menuOpen) renderPointMenu(node);
  }
  function toggleNeighborhood(node) {
    if(!node.path.length) return;
    const path=node.path,key=JSON.stringify(path);
    const open=get('expanded').some(p=>JSON.stringify(p)===key);
    if(open) state.draft.config.expanded=get('expanded').filter(p=>JSON.stringify(p)!==key);
    else {
      if(get('expanded').length>=24 || path.length>8) {
        message('Unpin a neighborhood before pinning more (24 neighborhoods / 8 levels).',true);return;
      }
      state.draft.config.expanded.push(clone(path));
    }
    updateDirty();draw();
  }
  function nodeForTransport(h) {
    const ref=h.transport;
    let op=TransformerMath.identity(state.tones.length),point=[0,0],node={op,point,path:[],id:'[]',depth:0};
    for(const slot of ref.path||[]) {
      const scene=TransformerMath.neighborhood(state.tones,op,point,{...state.draft.config,showSchritts:true});
      const next=scene.nodes.find(n=>n.slot===slot);
      if(!next) return {...node,op:{inverted:ref.op.inverted,q:state.tones.map((_,i)=>ref.op.q[i]||0)},
        path:clone(ref.path||[]),id:JSON.stringify(ref.path||[]),point:ref.point||point};
      op=next.op;point=next.point;node={...next,path:[...node.path,slot]};
    }
    node.id=JSON.stringify(node.path);node.depth=Math.max(0,node.path.length-1);
    return node;
  }
  function includedTable(node,parent,transported=false) {
    const h=transported?transportedFor(node)||imageHarmony(node):imageHarmony(node);
    renderToneTable({...h,id:`transformer-${state.source.id}`},parent,{
      onHover:key=>highlightIncludedTone(node,key),onLeave:leaveHighlight
    });
  }
  function actionButton(label,glyph,handler) {
    const button=document.createElement('button');button.type='button';button.className='btn-icon tf-list-action';
    button.title=label;button.setAttribute('aria-label',label);button.innerHTML=icon(glyph);
    button.addEventListener('click',e=>{e.stopPropagation();handler();});return button;
  }
  function renderCollections() {
    if(!dialog) return;
    state.collectionSelection ||= {};
    for(const kind of ['transformations','pinned','transported'].filter(k=>k===get('activeTab'))) {
      const pane=dialog.querySelector(`#tf-pane-${kind}`);if(!pane)continue;
      const scroll=dialog.querySelector('#tf-options').scrollTop;pane.replaceChildren();
      if(!state.tones) {
        const error=document.createElement('p');error.className='tf-empty';error.textContent='Enter a valid harmony in the Harmony tab.';
        pane.appendChild(error);continue;
      }
      const list=document.createElement('div');list.className='tf-collection';pane.appendChild(list);
      let nodes;
      if(kind==='transformations') nodes=(state.catalogNodes||state.nodes).filter(n=>n.scene==='[]');
      else if(kind==='pinned') nodes=state.scenes.filter(s=>s.path.length).map(s=>
        state.catalogNodes.find(n=>n.id===s.id)).filter(Boolean);
      else nodes=harmonies.filter(h=>h.transport?.sourceId===state.source.id).map(nodeForTransport);
      const selected=nodes.find(n=>n.id===(state.collectionSelection[kind]||state.selectedNode?.id));
      if(selected)state.collectionSelection[kind]=selected.id;
      const choose=node=>{
        state.menuOpen=false;dialog.querySelector('#tf-point-menu').hidden=true;
        state.collectionSelection[kind]=node.id;selectNode(node,kind==='transported'?'point':'neighborhood');
      };
      if(!nodes.length) {
        const empty=document.createElement('p');empty.className='tf-empty';
        empty.textContent=kind==='pinned'?'No pinned neighborhoods yet. Use Pin neighborhood on a transformation.':
          'No transported harmonies yet. Use Transport to keyboard on a transformation.';list.appendChild(empty);
      }
      for(const node of nodes) {
        const row=collectionRow(node,kind,node.id===selected?.id,()=>choose(node));
        if(kind==='pinned')list.appendChild(row);
        else {
          const group=document.createElement('div');list.appendChild(group);group.appendChild(row);
          if(node.id===selected?.id) {
            group.className='tf-selected-group';
            const details=document.createElement('div');details.className='tf-selected-tones';group.appendChild(details);
            includedTable(node,details,kind==='transported');
          }
        }
      }
      dialog.querySelector('#tf-options').scrollTop=scroll;
    }
  }
  function collectionName(node,kind) {
    return kind==='transformations'?`${node.op.inverted?'Wechsel':'Schritt'} ${TransformerMath.monomial(node.op)}`:
      kind==='transported'?transportedFor(node)?.name||imageHarmony(node).name:imageHarmony(node).name;
  }
  function collectionIcon(node,kind) {
    const mini=getMiniKeyShapeSVG(kind==='transported'?transportedFor(node)||imageHarmony(node):imageHarmony(node));
    return kind==='pinned'?`<span class="tf-neighborhood-mini">${mini}${mini}</span>`:mini;
  }
  function stateAction(label,glyph,active,handler) {
    const button=actionButton(label,glyph,handler);button.classList.add('tf-state-action');
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));return button;
  }
  function pinAction(node) {
    const pinned=get('expanded').some(p=>JSON.stringify(p)===JSON.stringify(node.path));
    const button=stateAction(pinned?'Unpin neighborhood':'Pin neighborhood','pin',pinned,()=>toggleNeighborhood(node));
    button.dataset.action='pin';button.disabled=!node.path.length;
    if(button.disabled)button.title='The primary neighborhood is always shown.';return button;
  }
  function transportAction(node) {
    const button=stateAction(transportedFor(node)?'Withdraw from keyboard':'Transport to keyboard',
      'transport',!!transportedFor(node),()=>transportNode(node));button.dataset.action='transport';return button;
  }
  function isIdentity(node) { return !node.op.inverted && node.op.q.every(n=>n===0); }
  function collectionRow(node,kind,selected,choose) {
    const row=ConfigUI.listRow(selected);row.classList.add('tf-list-item');row.tabIndex=0;row.setAttribute('role','group');
    row.dataset.node=node.id;row.dataset.monomial=TransformerMath.monomial(node.op);
    const mini=document.createElement('span');mini.className='harmony-vis-dot';mini.innerHTML=collectionIcon(node,kind);
    const name=document.createElement('span');name.className='harmony-name';name.textContent=collectionName(node,kind);
    row.append(mini,name);
    if(kind==='pinned') row.appendChild(actionButton('Unpin neighborhood','pin',()=>{
      if(state.selectedNode?.id===node.id)dismissSelection();toggleNeighborhood(node);
    }));
    else if(kind==='transported' || !isIdentity(node)) {
      if(kind==='transformations')row.appendChild(pinAction(node));
      row.appendChild(transportAction(node));
    }
    row.addEventListener('click',choose);
    row.addEventListener('keydown',e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();choose(e);}});
    const hover=()=>kind==='pinned'?highlightNeighborhood(node):highlightPoint(node);
    row.addEventListener('pointerenter',hover);row.addEventListener('pointerleave',leaveHighlight);
    row.addEventListener('focus',hover);row.addEventListener('blur',leaveHighlight);return row;
  }
  function renderPointMenu(node) {
    const menu = dialog.querySelector('#tf-point-menu'); menu.replaceChildren();
    const title = document.createElement('div'); title.className = 'tf-menu-title';
    title.textContent = `${node.op.inverted ? 'Wechsel' : 'Schritt'} ${TransformerMath.monomial(node.op)}`;
    menu.appendChild(title);
    const closeButton=actionButton('Close actions','close',dismissSelection);closeButton.classList.add('tf-menu-close');
    title.appendChild(closeButton);
    for(const button of isIdentity(node)?[]:[pinAction(node),transportAction(node)]) {
      button.classList.add('tf-menu-action');
      const label=document.createElement('span');label.textContent=button.getAttribute('aria-label');
      button.appendChild(label);menu.appendChild(button);
    }
    menu.hidden = false;
    includedTable(node,menu);
    const rect = dialog.querySelector('.tf-stage').getBoundingClientRect();
    const available=rect.width;
    const width=Math.min(360,Math.max(240,available-16));menu.style.width=`${width}px`;
    const pos=state.menuPosition||{x:20,y:20};
    menu.style.left=`${Math.max(8,Math.min(pos.x,available-width-8))}px`;
    menu.style.top=`${Math.max(8,Math.min(pos.y,rect.height-Math.min(menu.scrollHeight,480)-8))}px`;
  }
  function save() {
    let tones;
    try { tones=TransformerMath.parse(state.draft.ratios,state.draft.toneMode); }
    catch(e) { message(e.message,true); return false; }
    const linked=harmonies.filter(h=>h.transport?.sourceId===state.source.id);
    if(linked.some(h=>h.transport.op.q.slice(tones.length).some(Boolean))) {
      message('Withdraw transported harmonies that use removed tones before saving.',true);return false;
    }
    const rect=dialog.getBoundingClientRect();
    state.draft.config.window={left:rect.left,top:rect.top,width:rect.width,height:rect.height};
    state.source.name = state.draft.name; state.source.ratios = state.draft.ratios;
    state.source.toneMode = state.draft.toneMode; state.source.transformer = clone(state.draft.config);
    state.saved = clone(state.draft); updateDirty();
    linked.forEach(h=>{
      h.transport.op.q=tones.map((_,i)=>h.transport.op.q[i]||0);
      h.name=`${TransformerMath.monomial(h.transport.op)} of ${state.draft.name}`;
      h.toneMode=state.draft.toneMode;
      h.ratios=TransformerMath.imageText(tones,h.transport.op,h.toneMode);
    });
    renderHarmonyList(); renderHarmonyEditor(); applyAndDraw(); markProjectDirty();
    message('Transformer saved to harmony. Save the project to keep it in your project file.');
    renderCollections();return true;
  }
  async function close() {
    if (hasChanges() &&
      !await confirmAction('Discard unsaved Transformer changes?','Discard changes')) return;
    state.windowCleanup?.();
    clearHighlight();
    dialog.close(); dialog.remove(); dialog = null; state = null;
    previousFocus?.focus();
  }
  function setupWindowManipulation() {
    let action=null;
    const toolbar=dialog.querySelector('.tf-toolbar');
    function position(rect) {
      const width=Math.min(rect.width,window.innerWidth),height=Math.min(rect.height,window.innerHeight);
      const x=Math.max(0,Math.min(rect.left,window.innerWidth-width));
      const y=Math.max(0,Math.min(rect.top,window.innerHeight-height));
      dialog.classList.add('tf-positioned');
      Object.assign(dialog.style,{margin:'0',left:`${x}px`,top:`${y}px`,right:'auto',bottom:'auto',
        width:`${width}px`,height:`${height}px`});
    }
    function start(e,type,target) {
      if(e.button!==0) return;
      e.preventDefault(); e.stopPropagation();
      const rect=dialog.getBoundingClientRect();
      position(rect); action={type,rect,x:e.clientX,y:e.clientY};
      target.setPointerCapture(e.pointerId);
      dialog.querySelector('#tf-point-menu').hidden=true;
    }
    function move(e) {
      if(!action) return;
      const {rect,type}=action,dx=e.clientX-action.x,dy=e.clientY-action.y;
      const next={left:rect.left,top:rect.top,width:rect.width,height:rect.height};
      if(type==='move') {next.left+=dx;next.top+=dy;}
      else {
        if(type.includes('e')) next.width=Math.max(Math.min(560,window.innerWidth),Math.min(rect.width+dx,window.innerWidth-rect.left));
        if(type.includes('s')) next.height=Math.max(Math.min(360,window.innerHeight),Math.min(rect.height+dy,window.innerHeight-rect.top));
      }
      position(next);
    }
    function end() {
      if(action) {
        const rect=dialog.getBoundingClientRect();
        state.draft.config.window={left:rect.left,top:rect.top,width:rect.width,height:rect.height};
        updateDirty();
      }
      action=null;
    }
    toolbar.addEventListener('pointerdown',e=>{
      if(e.target.closest('button,input,select,a')) return;
      start(e,'move',toolbar);
    });
    [toolbar,...dialog.querySelectorAll('.tf-resize')].forEach(el=>{
      if(el!==toolbar) el.addEventListener('pointerdown',e=>start(e,el.dataset.axis,el));
      el.addEventListener('pointermove',move); el.addEventListener('pointerup',end);
      el.addEventListener('pointercancel',end); el.addEventListener('lostpointercapture',end);
    });
    const onResize=()=>{if(dialog?.classList.contains('tf-positioned'))position(dialog.getBoundingClientRect());};
    window.addEventListener('resize',onResize);
    state.windowCleanup=()=>window.removeEventListener('resize',onResize);
    state.positionWindow=position;
  }
  function restoreWindow() {
    state.cameraFrame=null;
    const rect=state.draft.config.window;
    if(rect) state.positionWindow(rect);
    else {
      dialog.classList.remove('tf-positioned');
      ['left','top','right','bottom','margin','width','height'].forEach(k=>dialog.style.removeProperty(k));
    }
  }
  function open(h,options={}) {
    if (!h.octaveEquiv) return;
    if (dialog) return;
    previousFocus = document.activeElement;
    const draft = {name:h.name, ratios:h.ratios, toneMode:h.toneMode || 'ratios', config:hydrate(h)};
    if(options.tab) draft.config.activeTab=options.tab;
    state = {source:h, draft, saved:clone(draft), viewport:clone(draft.config.viewport), nodes:[]};
    syncWechsel();
    state.saved=clone(state.draft);
    dialog = document.createElement('dialog'); dialog.id = 'transformer-modal'; dialog.className = 'tf-modal';
    dialog.setAttribute('aria-labelledby','tf-title');
    dialog.innerHTML = `<div class="tf-shell">
      <header class="tf-toolbar top-bar">
        <div class="top-bar-stage">
          <div class="logo" title="Transformer">${icon('derived')}<span class="logo-text">Transformer</span></div>
          <strong id="tf-title" class="top-bar-project-name"></strong>
          <div class="header-actions" id="tf-stage-actions">
            <button type="button" class="btn-icon" id="tf-lock" title="Unlock view" aria-label="Lock view"></button>
            <button type="button" class="btn-icon" id="tf-theme" title="Toggle light/dark mode" aria-label="Toggle theme"></button>
            <button type="button" class="btn-icon" id="tf-show-panel" title="Show configuration panel" aria-label="Show configuration panel" hidden>${document.querySelector('#btn-toggle-config')?.innerHTML || icon('panel')}</button>
          </div>
        </div>
        <div class="top-bar-panel" id="tf-toolbar-panel">
          <button type="button" class="panel-action-btn" id="tf-save" title="Save transformer" aria-label="Save transformer">${document.querySelector('#btn-config-save').innerHTML}</button>
          <button type="button" class="panel-action-btn" id="tf-reset" title="Reset to last saved" aria-label="Reset to last saved">${document.querySelector('#btn-config-revert').innerHTML}</button>
          <div style="flex:1"></div>
          <button type="button" class="panel-action-btn" id="tf-collapse" title="Hide configuration panel" aria-label="Hide configuration panel">${document.querySelector('#panel-toggle')?.innerHTML || icon('collapse')}</button>
          <button type="button" class="panel-action-btn" id="tf-close" title="Close transformer" aria-label="Close transformer">${icon('close')}</button>
        </div>
      </header>
      <div class="tf-content">
        <main class="tf-stage">
          <svg id="tf-diagram" aria-label="Neighborhood of harmony"></svg>
          <div id="tf-point-menu" class="tf-point-menu" hidden></div>
          <div class="tf-navigation">
            <button type="button" class="btn-sm" id="tf-fit" title="Fit all neighborhoods">Fit</button>
            <span>Scroll to zoom · drag to pan · select a point for actions</span>
          </div>
        </main>
        <aside class="tf-panel" id="tf-panel" aria-label="Transformer configuration">
          <nav id="tf-tabs" class="tf-tabs" role="tablist" aria-label="Transformer options"></nav>
          <div id="tf-options"></div>
        </aside>
      </div>
      <footer id="tf-status" role="status"></footer>
      <div class="tf-resize tf-resize-e" data-axis="e" aria-hidden="true"></div>
      <div class="tf-resize tf-resize-s" data-axis="s" aria-hidden="true"></div>
      <div class="tf-resize tf-resize-se" data-axis="se" aria-hidden="true"></div>
    </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#tf-save').addEventListener('click',save);
    dialog.querySelector('#tf-close').addEventListener('click',close);
    dialog.addEventListener('pointerdown',e=>{
      if(state.menuOpen && !e.target.closest('.tf-point-menu,.tf-point')) {
        state.menuOpen=false;dialog.querySelector('#tf-point-menu').hidden=true;
      }
    },true);
    dialog.addEventListener('cancel',e=>{e.preventDefault(); close();});
    dialog.addEventListener('keydown',e=>{
      const menu = dialog.querySelector('#tf-point-menu');
      if (e.key === 'Escape' && !menu.hidden) {
        e.preventDefault(); e.stopPropagation(); dismissSelection();
      }
    });
    dialog.querySelector('#tf-reset').addEventListener('click',()=>{
      state.draft = clone(state.saved); state.viewport = clone(state.draft.config.viewport);
      dismissSelection(); restoreWindow(); controls(); updateDirty(); draw();
    });
    dialog.querySelector('#tf-lock').addEventListener('click',()=>set('viewLocked',!get('viewLocked')));
    const themeButton=dialog.querySelector('#tf-theme'),mainTheme=document.querySelector('[data-theme-toggle]');
    const syncTheme=()=>{themeButton.innerHTML=mainTheme.innerHTML;};
    syncTheme();themeButton.addEventListener('click',()=>{mainTheme.click();syncTheme();});
    dialog.querySelector('#tf-collapse').addEventListener('click',()=>set('panelOpen',false));
    dialog.querySelector('#tf-show-panel').addEventListener('click',()=>set('panelOpen',true));
    dialog.querySelector('#tf-fit').addEventListener('click',()=>{state.fitRequested=true; draw();});
    const stage = dialog.querySelector('.tf-stage'), diagram = dialog.querySelector('#tf-diagram');
    diagram.addEventListener('wheel',e=>{
      if (!state.viewport || get('viewLocked')) return; e.preventDefault();
      if(!state.selectedNode) clearHighlight();
      const [x,y,w,h] = state.viewport, factor = e.deltaY > 0 ? 1.12 : 1/1.12;
      if (w * factor < 30 || w * factor > 100000) return;
      const pt = diagram.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      const p = pt.matrixTransform(diagram.getScreenCTM().inverse());
      setViewport([p.x-(p.x-x)*factor,p.y-(p.y-y)*factor,w*factor,h*factor]);
    },{passive:false});
    let drag=null;
    diagram.addEventListener('pointerdown',e=>{
      if (e.target.closest('.tf-point') || e.button !== 0 || !state.viewport || get('viewLocked')) return;
      if(!state.selectedNode) clearHighlight();
      const m = diagram.getScreenCTM(); if(!m) return;
      drag={x:e.clientX,y:e.clientY,v:state.viewport.slice(),sx:m.a,sy:m.d};
      diagram.setPointerCapture(e.pointerId);
    });
    diagram.addEventListener('pointermove',e=>{
      if(!drag) return;
      setViewport([drag.v[0]-(e.clientX-drag.x)/drag.sx,drag.v[1]-(e.clientY-drag.y)/drag.sy,...drag.v.slice(2)]);
    });
    diagram.addEventListener('pointerup',()=>{drag=null;});
    diagram.addEventListener('pointercancel',()=>{drag=null;});
    controls(); dialog.showModal(); setupWindowManipulation(); restoreWindow(); updateDirty(); draw();
    const initialFrame=state.cameraFrame,initialRect=diagram.getBoundingClientRect();
    if(!state.saved.config.camera && initialFrame && Math.abs(state.viewport[2]/state.viewport[3]-initialRect.width/initialRect.height)>1e-6) {
      setViewport([initialFrame.x,initialFrame.y,initialRect.width*initialFrame.ux,initialRect.height*initialFrame.uy]);
    }
    state.saved.config.viewport=state.viewport.slice();state.saved.config.camera=clone(state.draft.config.camera);updateDirty();
    const canvasObserver=new ResizeObserver(()=>preserveCamera(state?.cameraFrame));
    canvasObserver.observe(diagram);
    const themeObserver=new MutationObserver(syncTheme);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    const cleanup=state.windowCleanup;
    state.windowCleanup=()=>{cleanup?.();canvasObserver.disconnect();themeObserver.disconnect();};
    if(options.transportedId) {
      const transported=harmonies.find(x=>x.id===options.transportedId);
      if(transported) selectNode(nodeForTransport(transported),'point');
    }
  }
  return {open};
})();
