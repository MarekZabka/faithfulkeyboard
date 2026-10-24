// Transformer modal: isolated draft, per-harmony persistence, diagram interactions.
const Transformer = (() => {
  const clone = x => JSON.parse(JSON.stringify(x));
  let state = null, dialog = null, previousFocus = null;
  const shapeFields = ['keySize','keyShape','keyRotation','keyStretchX','keyStretchY',
    'keyRounding','keyEdge','keyBulge','keyStrokeWidth','uniformColor','edgeColor',
    'opacity','keyOffsetX','keyOffsetY','labelFontSize','labelColor'];
  const icons = {
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    reset: '<path d="M3 11a9 9 0 1 1 2.6 6.4M3 4v7h7"/>',
    style: '<path d="m4 20 4-1L20 7l-3-3L5 16zM14 7l3 3"/>',
    collapse: '<path d="m9 5 7 7-7 7M20 4v16"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
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
      circle: {size: 300, edgeWidth: 1.2, edgeColor: '#888888', rotation: 0},
      toneLabels: {show: h.showLabels !== false, type: h.labelType || 'ratio',
        fontSize: h.labelFontSize || 10, color: h.labelColor || '#000000',
        offsetX: h.labelOffsetX || 0, offsetY: h.labelOffsetY || 0},
      showSchritts: true, flipSchritts: false, secondarySize: 300,
      showCollapses: false, collapses: {edgeWidth: 1.5, edgeColor: '#b34b4b'},
      ...inherited(h), expanded: [], panelOpen: true
    };
  }
  function hydrate(h) {
    const base = defaults(h), saved = h.transformer || {};
    const result = {...base, ...clone(saved)};
    ['circle','toneLabels','collapses','schritt','wechsel'].forEach(k => {
      result[k] = {...base[k], ...(saved[k] || {})};
    });
    if (!Array.isArray(result.expanded)) result.expanded = [];
    return result;
  }
  function get(path) { return path.split('.').reduce((o,k) => o[k], state.draft.config); }
  function set(path, value) {
    const keys = path.split('.'), last = keys.pop();
    keys.reduce((o,k) => o[k], state.draft.config)[last] = value;
    if (/size|Size|rotation|Rotation|Stretch|Offset|showSchritts|flipSchritts/.test(path)) state.viewport = null;
    updateDirty(); draw();
  }
  function updateDirty() {
    const dirty = JSON.stringify(state.draft) !== JSON.stringify(state.saved);
    dialog.querySelector('#tf-save').classList.toggle('tf-dirty', dirty);
    dialog.querySelector('#tf-title').textContent = `Transformer · ${state.draft.name || 'Unnamed harmony'}${dirty ? ' *' : ''}`;
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
  function section(parent, name, open = false) {
    const el = document.createElement('details'); el.open = open; el.className = 'tf-section';
    const summary = document.createElement('summary'); summary.textContent = name; el.appendChild(summary);
    const body = document.createElement('div'); body.className = 'tf-section-body'; el.appendChild(body);
    parent.appendChild(el); return body;
  }
  function conditional(parent, name, path, build) {
    const wrap = document.createElement('section'); wrap.className = 'tf-section';
    const checkbox = field(wrap, name, path, 'checkbox');
    const body = document.createElement('div'); body.className = 'tf-section-body';
    body.hidden = !get(path); wrap.appendChild(body);
    checkbox.addEventListener('change', () => { body.hidden = !checkbox.checked; });
    build(body); parent.appendChild(wrap);
  }
  function pointControls(parent, label, key) {
    let body = section(parent, `${label} Label`);
    field(body, 'Font Size', `${key}.labelFontSize`, 'number', {min: 4, max: 72, step: 1});
    field(body, 'Color', `${key}.labelColor`, 'color');
    body = section(parent, `${label} Shape`);
    field(body, 'Shape', `${key}.keyShape`, 'select', {values: [
      ['round','Round'],['hex','Hexagon'],['diamond','Diamond'],['rect','Rectangle'],
      ['triangle','Triangle'],['square','Square'],['pentagon','Pentagon'],['octagon','Octagon']]});
    field(body, 'Size', `${key}.keySize`, 'number', {min: 4, max: 400, step: 1});
    field(body, 'Fill Color', `${key}.uniformColor`, 'color');
    field(body, 'Edge Width', `${key}.keyStrokeWidth`, 'number', {min: 0, max: 20, step: 0.5});
    field(body, 'Edge Color', `${key}.edgeColor`, 'color');
    field(body, 'Opacity', `${key}.opacity`, 'number', {min: 0, max: 1, step: 0.05});
    body = section(parent, `${label} Style`);
    field(body, 'Rounding', `${key}.keyRounding`, 'number', {min: 0, max: 1, step: 0.05});
    field(body, 'Edge Form', `${key}.keyEdge`, 'select', {values: [['straight','Straight'],['convex','Convex'],['concave','Concave']]});
    field(body, 'Bulge Amount', `${key}.keyBulge`, 'number', {min: 0, max: 1, step: 0.05});
    body = section(parent, `${label} Rotation`);
    field(body, 'Rotation', `${key}.keyRotation`, 'number', {min: -360, max: 360, step: 1});
    body = section(parent, `${label} Stretch`);
    field(body, 'X', `${key}.keyStretchX`, 'number', {min: 0.1, max: 5, step: 0.05});
    field(body, 'Y', `${key}.keyStretchY`, 'number', {min: 0.1, max: 5, step: 0.05});
    body = section(parent, `${label} Offset`);
    field(body, 'X', `${key}.keyOffsetX`, 'number', {min: -200, max: 200, step: 1});
    field(body, 'Y', `${key}.keyOffsetY`, 'number', {min: -200, max: 200, step: 1});
  }
  function controls() {
    const panel = dialog.querySelector('#tf-options'); panel.innerHTML = '';
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
      state.viewport = null; updateDirty(); draw();
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
    let body = section(panel, 'Circle Style', true);
    field(body, 'Size', 'circle.size', 'number', {min: 50, max: 2000, step: 10});
    field(body, 'Edge Width', 'circle.edgeWidth', 'number', {min: 0, max: 20, step: 0.1});
    field(body, 'Edge Color', 'circle.edgeColor', 'color');
    field(body, 'Rotation', 'circle.rotation', 'number', {min: -360, max: 360, step: 1});
    conditional(panel, 'Show Tone Labels', 'toneLabels.show', b => {
      field(b, 'Type', 'toneLabels.type', 'select', {values: [['ratio','Ratio'],['cents','Cents'],['heji','Tone name (HEJI)']]});
      field(b, 'Font Size', 'toneLabels.fontSize', 'number', {min: 4, max: 72, step: 1});
      field(b, 'Color', 'toneLabels.color', 'color');
      field(b, 'Offset X', 'toneLabels.offsetX', 'number', {min: -200, max: 200, step: 1});
      field(b, 'Offset Y', 'toneLabels.offsetY', 'number', {min: -200, max: 200, step: 1});
    });
    conditional(panel, 'Show Nontrivial Schritts', 'showSchritts', b => {
      field(b, 'Flip Schritts', 'flipSchritts', 'checkbox');
      field(b, 'Secondary Circle Size', 'secondarySize', 'number', {min: 10, max: 2000, step: 10});
    });
    conditional(panel, 'Show Collapses', 'showCollapses', b => {
      field(b, 'Edge Width', 'collapses.edgeWidth', 'number', {min: 0, max: 20, step: 0.5});
      field(b, 'Edge Color', 'collapses.edgeColor', 'color');
    });
    pointControls(panel, 'Schritt', 'schritt'); pointControls(panel, 'Wechsel', 'wechsel');
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
  function draw() {
    if (!state) return;
    dialog.querySelector('#tf-point-menu').hidden = true;
    const diagram = dialog.querySelector('#tf-diagram'), config = state.draft.config;
    let tones;
    try { tones = TransformerMath.parse(state.draft.ratios, state.draft.toneMode); }
    catch (e) { diagram.replaceChildren(); message(e.message, true); state.nodes = []; return; }
    state.tones = tones;
    const scenes = [], nodeMap = new Map();
    function visit(path, parent, origin) {
      const scene = TransformerMath.neighborhood(tones, parent, origin, config);
      scenes.push(scene);
      scene.nodes.forEach(n => {
        n.path = n.origin ? path : [...path, n.slot]; n.id = JSON.stringify(n.path);
        // Secondary origins are the already-drawn point where that neighborhood was opened.
        if (!n.origin || !path.length) nodeMap.set(n.id, n);
      });
      if (path.length >= 8) return;
      const next = config.expanded.filter(p => Array.isArray(p) && p.length === path.length + 1 &&
        path.every((s,i) => p[i] === s));
      next.forEach(p => {
        const anchor = scene.nodes.find(n => n.slot === p[p.length - 1]);
        if (anchor) visit(p, anchor.op, anchor.point);
      });
    }
    try { visit([], TransformerMath.identity(tones.length), [0, 0]); }
    catch (e) { message(e.message, true); return; }
    const nodes = [...nodeMap.values()]; state.nodes = nodes;
    diagram.replaceChildren();
    const circlesLayer = svg('g', {'data-layer':'circles'}, diagram);
    const lineLayer = svg('g', {'data-layer':'collapses'}, diagram);
    const labelLayer = svg('g', {'data-layer':'tone-labels'}, diagram);
    const pointLayer = svg('g', {'data-layer':'points'}, diagram);
    const bounds = [];
    scenes.forEach(scene => scene.circles.forEach(c => {
      const [x, y] = c.center;
      bounds.push([x - c.radius, y - c.radius], [x + c.radius, y + c.radius]);
      svg('circle', {cx: x, cy: y, r: c.radius, fill:'none', stroke:config.circle.edgeColor,
        'stroke-width':config.circle.edgeWidth, 'stroke-dasharray':c.secondary ? '6 4' : '',
        opacity:c.secondary ? 0.4 : 0.65}, circlesLayer);
      if (!c.secondary && config.toneLabels.show) {
        const t = c.tone, opts = config.toneLabels;
        const label = getKeyLabel({label:t.display, cents:t.log * 1200, _exps:t.v}, {labelType:opts.type});
        displayLabel(labelLayer, x + opts.offsetX, y + opts.offsetY, `${t.letter} = ${label}`,
          opts.fontSize * 2, opts.color, opts.type === 'heji');
      }
    }));
    if (config.showCollapses) {
      const groups = new Map();
      nodes.forEach(n => {
        const k = TransformerMath.imageKey(tones, n.op);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(n);
      });
      groups.forEach(group => {
        // A spanning set keeps large collapsed groups readable without quadratic lines.
        for (let i = 1; i < group.length; i++) svg('line', {
          x1:group[0].point[0], y1:group[0].point[1], x2:group[i].point[0], y2:group[i].point[1],
          stroke:config.collapses.edgeColor, 'stroke-width':config.collapses.edgeWidth, opacity:0.65,
          'pointer-events':'none'}, lineLayer);
      });
    }
    nodes.sort((a,b) => Number(a.op.inverted) - Number(b.op.inverted)).forEach(n => {
      const style = n.op.inverted ? config.wechsel : config.schritt;
      const [x,y] = [n.point[0] + (style.keyOffsetX || 0), n.point[1] + (style.keyOffsetY || 0)];
      // Keyboard keySize is in cents-like units; map it to the prototype's diagram scale.
      const markerSize = style.keySize * 0.25;
      const extent = markerSize * Math.max(style.keyStretchX, style.keyStretchY) + 40;
      bounds.push([x - extent, y - extent], [x + extent, y + extent]);
      const group = svg('g', {'class':'tf-point', 'data-node':n.id, 'data-monomial':TransformerMath.monomial(n.op),
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
      displayLabel(group, x, y, label, style.labelFontSize * 2, style.labelColor);
      const show = e => { e.stopPropagation(); pointMenu(n, e); };
      group.addEventListener('click', show);
      group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(e); } });
    });
    if (!state.viewport) {
      const margin = 40;
      const minX = Math.min(...bounds.map(p=>p[0])) - margin, minY = Math.min(...bounds.map(p=>p[1])) - margin;
      const width = Math.max(100, Math.max(...bounds.map(p=>p[0])) - minX + margin);
      const height = Math.max(100, Math.max(...bounds.map(p=>p[1])) - minY + margin);
      state.viewport = [minX, minY, width, height];
    }
    diagram.setAttribute('viewBox', state.viewport.join(' '));
    message(`${tones.length} tones · ${scenes.length} neighborhood${scenes.length === 1 ? '' : 's'} · ${nodes.length} transformations`);
    dialog.querySelector('#tf-panel').hidden = !config.panelOpen;
    dialog.querySelector('#tf-show-panel').hidden = config.panelOpen;
  }
  function pointMenu(node, event) {
    const menu = dialog.querySelector('#tf-point-menu'); menu.replaceChildren();
    const title = document.createElement('div'); title.className = 'tf-menu-title';
    title.textContent = `${node.op.inverted ? 'Wechsel' : 'Schritt'} ${TransformerMath.monomial(node.op)}`;
    menu.appendChild(title);
    const add = document.createElement('button'); add.type = 'button'; add.textContent = 'Add to keyboard';
    add.addEventListener('click', () => {
      try {
        const style = node.op.inverted ? state.draft.config.wechsel : state.draft.config.schritt;
        const h = makeHarmony({...snapshotHarmony(state.source), ...clone(style), colorMode:'uniform',
          name:`${TransformerMath.monomial(node.op)} of ${state.draft.name}`, octaveEquiv:true,
          toneMode:state.draft.toneMode,
          ratios:TransformerMath.imageText(state.tones,node.op,state.draft.toneMode), transformer:null});
        harmonies.push(h); renderHarmonyList(); applyAndDraw(); markProjectDirty();
        menu.hidden = true; message(`Added "${h.name}" to the keyboard.`);
      } catch(e) { message(e.message,true); }
    });
    menu.appendChild(add);
    const toggle = document.createElement('button'); toggle.type = 'button';
    const path = node.path, key = JSON.stringify(path);
    const isOpen = state.draft.config.expanded.some(p=>JSON.stringify(p) === key);
    toggle.textContent = isOpen ? 'Hide neighborhood' : 'Show neighborhood';
    toggle.disabled = !path.length;
    toggle.title = path.length ? '' : 'The initial neighborhood is already shown.';
    toggle.addEventListener('click', () => {
      if (isOpen) state.draft.config.expanded = state.draft.config.expanded.filter(p =>
        !(p.length >= path.length && path.every((s,i)=>p[i] === s)));
      else {
        if (state.draft.config.expanded.length >= 24 || path.length > 8) {
          message('Hide a neighborhood before expanding more (24 neighborhoods / 8 levels).',true); return;
        }
        state.draft.config.expanded.push(path);
      }
      state.viewport = null; updateDirty(); draw();
    });
    menu.appendChild(toggle); menu.hidden = false;
    const rect = dialog.querySelector('.tf-stage').getBoundingClientRect();
    const target = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || target.left + target.width/2, y = event.clientY || target.top + target.height/2;
    menu.style.left = `${Math.max(8,Math.min(x - rect.left,rect.width - 220))}px`;
    menu.style.top = `${Math.max(8,Math.min(y - rect.top,rect.height - 150))}px`;
    add.focus();
  }
  function save() {
    try { TransformerMath.parse(state.draft.ratios,state.draft.toneMode); }
    catch(e) { message(e.message,true); return; }
    state.source.name = state.draft.name; state.source.ratios = state.draft.ratios;
    state.source.toneMode = state.draft.toneMode; state.source.transformer = clone(state.draft.config);
    state.saved = clone(state.draft); updateDirty();
    renderHarmonyList(); renderHarmonyEditor(); applyAndDraw(); markProjectDirty();
    message('Transformer saved to harmony. Save the project to keep it in your project file.');
  }
  function close() {
    if (JSON.stringify(state.draft) !== JSON.stringify(state.saved) &&
      !confirm('Discard unsaved Transformer changes?')) return;
    dialog.close(); dialog.remove(); dialog = null; state = null;
    previousFocus?.focus();
  }
  function open(h) {
    if (!h.octaveEquiv) return;
    if (dialog) return;
    previousFocus = document.activeElement;
    const draft = {name:h.name, ratios:h.ratios, toneMode:h.toneMode || 'ratios', config:hydrate(h)};
    state = {source:h, draft, saved:clone(draft), viewport:null, nodes:[]};
    dialog = document.createElement('dialog'); dialog.id = 'transformer-modal'; dialog.className = 'tf-modal';
    dialog.setAttribute('aria-labelledby','tf-title');
    dialog.innerHTML = `<div class="tf-shell">
      <header class="tf-toolbar">
        <strong id="tf-title">Transformer</strong>
        <div class="tf-toolbar-actions">
          <button type="button" class="btn-icon" id="tf-save" title="Save transformer" aria-label="Save transformer">${icon('save')}</button>
          <button type="button" class="btn-icon" id="tf-reset" title="Reset to last saved" aria-label="Reset to last saved">${icon('reset')}</button>
          <button type="button" class="btn-icon" id="tf-reset-style" title="Reset harmony-inherited styles" aria-label="Reset style">${icon('style')}</button>
        </div>
        <button type="button" class="btn-icon" id="tf-show-panel" title="Show configuration panel" aria-label="Show configuration panel" hidden>${icon('panel')}</button>
        <button type="button" class="btn-icon" id="tf-close" title="Close transformer" aria-label="Close transformer">${icon('close')}</button>
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
          <div class="tf-panel-heading"><strong>Transformer options</strong>
          <button type="button" class="btn-icon" id="tf-collapse" title="Collapse panel" aria-label="Collapse panel">${icon('collapse')}</button></div>
          <div id="tf-options"></div>
        </aside>
      </div>
      <footer id="tf-status" role="status"></footer>
    </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#tf-save').addEventListener('click',save);
    dialog.querySelector('#tf-close').addEventListener('click',close);
    dialog.addEventListener('cancel',e=>{e.preventDefault(); close();});
    dialog.addEventListener('keydown',e=>{
      const menu = dialog.querySelector('#tf-point-menu');
      if (e.key === 'Escape' && !menu.hidden) {
        e.preventDefault(); e.stopPropagation(); menu.hidden = true;
        dialog.querySelector('.tf-point')?.focus();
      }
    });
    dialog.querySelector('#tf-reset').addEventListener('click',()=>{
      state.draft = clone(state.saved); state.viewport = null; controls(); updateDirty(); draw();
    });
    dialog.querySelector('#tf-reset-style').addEventListener('click',()=>{
      Object.assign(state.draft.config,inherited(state.source));
      state.draft.config.toneLabels = defaults(state.source).toneLabels;
      controls(); updateDirty(); draw();
    });
    dialog.querySelector('#tf-collapse').addEventListener('click',()=>set('panelOpen',false));
    dialog.querySelector('#tf-show-panel').addEventListener('click',()=>set('panelOpen',true));
    dialog.querySelector('#tf-fit').addEventListener('click',()=>{state.viewport=null; draw();});
    const stage = dialog.querySelector('.tf-stage'), diagram = dialog.querySelector('#tf-diagram');
    stage.addEventListener('click',e=>{if(!e.target.closest('.tf-point-menu') && !e.target.closest('.tf-point')) dialog.querySelector('#tf-point-menu').hidden=true;});
    diagram.addEventListener('wheel',e=>{
      if (!state.viewport) return; e.preventDefault();
      const [x,y,w,h] = state.viewport, factor = e.deltaY > 0 ? 1.12 : 1/1.12;
      if (w * factor < 30 || w * factor > 100000) return;
      const pt = diagram.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      const p = pt.matrixTransform(diagram.getScreenCTM().inverse());
      state.viewport=[p.x-(p.x-x)*factor,p.y-(p.y-y)*factor,w*factor,h*factor];
      diagram.setAttribute('viewBox',state.viewport.join(' '));
    },{passive:false});
    let drag=null;
    diagram.addEventListener('pointerdown',e=>{
      if (e.target.closest('.tf-point') || e.button !== 0) return;
      const m = diagram.getScreenCTM(); if(!m) return;
      drag={x:e.clientX,y:e.clientY,v:state.viewport.slice(),sx:m.a,sy:m.d};
      diagram.setPointerCapture(e.pointerId);
    });
    diagram.addEventListener('pointermove',e=>{
      if(!drag) return;
      state.viewport=[drag.v[0]-(e.clientX-drag.x)/drag.sx,drag.v[1]-(e.clientY-drag.y)/drag.sy,...drag.v.slice(2)];
      diagram.setAttribute('viewBox',state.viewport.join(' '));
    });
    diagram.addEventListener('pointerup',()=>{drag=null;});
    diagram.addEventListener('pointercancel',()=>{drag=null;});
    controls(); dialog.showModal(); updateDirty(); draw();
  }
  return {open};
})();
