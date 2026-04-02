// render.js
// SVG keyboard renderer: buildKeyPath, renderSVG, applyAndDraw, resetView, syncScales.
// ======================================================================


// ═════════════════════════════════════════════════════════════════════════════
//  SVG KEYBOARD RENDERER
// ═════════════════════════════════════════════════════════════════════════════

const svgEl = document.getElementById('keyboard-svg');
const axesGroup = document.getElementById('svg-axes');
const connGroup = document.getElementById('svg-connections');
const keysGroup = document.getElementById('svg-keys');

let viewState = { panX: 0, panY: 0, scaleX: 1, scaleY: 1 };
// Base scales are set by resetView auto-compute. zoomFactor multiplies both.
// scaleX = baseScaleX * zoomFactor,  scaleY = baseScaleY * zoomFactor.
let baseScaleX = 1, baseScaleY = 1, zoomFactor = 1;
let baseZoomScale = 1; // baseScaleX * 1 at default fit; key size at zoomFactor=1
let allKeysCache = [];
let activeKeyIds = new Set();
const touchKeyMap = new Map(); // touch.identifier → { key, releaseFunc }

// Release all held keys (called when all fingers lift or on touchcancel)
function releaseAllTouches() {
  for (const entry of touchKeyMap.values()) {
    if (entry.releaseFunc) try { entry.releaseFunc(); } catch(e) {}
  }
  touchKeyMap.clear();
  activeKeyIds.clear();
}

const NS = 'http://www.w3.org/2000/svg';
function svgEl2(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function logicalToPixel(x, y) {
  return {
    px: x * viewState.scaleX + viewState.panX,
    py: -y * viewState.scaleY + viewState.panY
  };
}

function pixelToLogical(px, py) {
  return {
    x: (px - viewState.panX) / viewState.scaleX,
    y: -(py - viewState.panY) / viewState.scaleY
  };
}

// Apply zoom factor and stretch to the base scales.
function syncScales() {
  viewState.scaleX = baseScaleX * zoomFactor * (layout.viewStretchX || 1);
  viewState.scaleY = baseScaleY * zoomFactor * (layout.viewStretchY || 1);
}

function resetView(useAutoCompute) {
  // If we have a saved view and aren't forced to auto-compute, restore it
  if (layout.savedView && !useAutoCompute) {
    const sv = layout.savedView;
    // Restore base scales and zoom factor
    baseScaleX = sv.baseScaleX || baseScaleX;
    baseScaleY = sv.baseScaleY || baseScaleY;
    zoomFactor = sv.zoomFactor !== undefined ? sv.zoomFactor : 1;
    viewState.panX = sv.panX !== undefined ? sv.panX : viewState.panX;
    viewState.panY = sv.panY !== undefined ? sv.panY : viewState.panY;
    layout.keyboardRotation = sv.rotation || 0;
    layout.viewStretchX = sv.stretchX !== undefined ? sv.stretchX : 1;
    layout.viewStretchY = sv.stretchY !== undefined ? sv.stretchY : 1;
    syncScales();
    renderSVG();
    return;
  }
  const keys = allKeysCache;
  if (!keys.length) return;
  const xs = keys.map(k=>k.x_logical);
  const ys = keys.map(k=>k.y_logical);
  const minX=Math.min(...xs), maxX=Math.max(...xs);
  const minY=Math.min(...ys), maxY=Math.max(...ys);
  const wrap = svgEl.parentElement;
  const cw=wrap.clientWidth, ch=wrap.clientHeight;
  const padX=80; // padY removed — Y axis uses fixed scale
  const rangeX=(maxX-minX)||1200;
  // X scale: fit the cents range across the stage width
  baseScaleX = Math.max(0.1, Math.min(8, (cw-2*padX)/rangeX));
  // Y scale: 1 width unit = 100 cents visually (same pixel density as 100¢ on X).
  // This makes ViewStretch 1.0/1.0 the natural default — no manual stretch needed.
  baseScaleY = baseScaleX * 100;
  zoomFactor = 1;
  baseZoomScale = baseScaleX; // record default-fit scale for key size flooring
  layout.viewStretchX = layout.viewStretchX || 1;
  layout.viewStretchY = layout.viewStretchY || 1;
  syncScales();
  const midX=(minX+maxX)/2, midY=(minY+maxY)/2;
  viewState.panX=cw/2-midX*viewState.scaleX;
  viewState.panY=ch/2+midY*viewState.scaleY;
  if (window._syncOverlaySliders) window._syncOverlaySliders();
  renderSVG();
}

function saveCurrentView() {
  layout.savedView = {
    baseScaleX,
    baseScaleY,
    zoomFactor,
    panX: viewState.panX,
    panY: viewState.panY,
    rotation: layout.keyboardRotation || 0,
    stretchX: layout.viewStretchX || 1,
    stretchY: layout.viewStretchY || 1
  };
}

// Build key shape path for SVG
function buildKeyPath(cx, cy, ks, harmony, _isActive) {
  const shape = harmony.keyShape;
  const rotation = harmony.keyRotation || 0;
  const sx = harmony.keyStretchX || 1;
  const sy = harmony.keyStretchY || 1;
  const r = ks / 2;

  let points = [];
  let pathData = '';
  let useCircle = false;
  let circleR = r;

  if (shape === 'round') {
    useCircle = true;
    circleR = r;
  } else if (shape === 'hex') {
    for (let i=0; i<6; i++) {
      const ang = Math.PI/6 + i*Math.PI/3 + rotation*Math.PI/180;
      points.push([r*Math.cos(ang)*sx, r*Math.sin(ang)*sy]);
    }
  } else if (shape === 'diamond') {
    points = [[0,-r*sy],[r*0.75*sx,0],[0,r*sy],[-r*0.75*sx,0]];
    if (rotation) rotatePoints(points, rotation);
  } else if (shape === 'rect') {
    const hw=r*0.6*sx, hh=r*sy;
    points = [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]];
    if (rotation) rotatePoints(points, rotation);
  } else if (shape === 'triangle') {
    const h_t = r*1.1*sy;
    points = [[0,-h_t],[r*0.9*sx,h_t*0.6],[-r*0.9*sx,h_t*0.6]];
    if (rotation) rotatePoints(points, rotation);
  } else if (shape === 'square') {
    const hw = r*sx, hh = r*sy;
    points = [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]];
    if (rotation) rotatePoints(points, rotation);
  } else if (shape === 'pentagon') {
    for (let i=0; i<5; i++) {
      const ang = -Math.PI/2 + i*2*Math.PI/5 + (rotation||0)*Math.PI/180;
      points.push([r*Math.cos(ang)*sx, r*Math.sin(ang)*sy]);
    }
  } else if (shape === 'octagon') {
    for (let i=0; i<8; i++) {
      const ang = Math.PI/8 + i*Math.PI/4 + (rotation||0)*Math.PI/180;
      points.push([r*Math.cos(ang)*sx, r*Math.sin(ang)*sy]);
    }
  } else {
    useCircle = true;
  }

  if (useCircle) {
    if (sx !== 1 || sy !== 1 || rotation) {
      // Use ellipse or rotated circle
      const el = svgEl2('ellipse', {
        cx: cx.toFixed(2), cy: cy.toFixed(2),
        rx: (circleR*sx).toFixed(2), ry: (circleR*sy).toFixed(2),
        transform: rotation ? `rotate(${rotation},${cx.toFixed(2)},${cy.toFixed(2)})` : ''
      });
      return { type: 'ellipse', el };
    }
    return { type: 'circle', cx, cy, r: circleR };
  }

  // Polygon path
  const absPoints = points.map(([px,py])=>[cx+px, cy+py]);
  const rounding = harmony.keyRounding || 0;
  const edgeStyle = harmony.keyEdge || 'straight';
  if (rounding > 0 || edgeStyle !== 'straight') {
    pathData = buildRoundedPolygonPath(absPoints, rounding * r * 0.5, edgeStyle, harmony.keyBulge !== undefined ? harmony.keyBulge : 0.2);
  } else {
    pathData = absPoints.map(([px,py],i)=>`${i===0?'M':'L'}${px.toFixed(2)},${py.toFixed(2)}`).join(' ')+'Z';
  }
  return { type: 'path', d: pathData };
}

// Helper: build rounded polygon SVG path with optional convex/concave edges
// edgeStyle: 'straight'|'convex'|'concave', bulgeAmount: 0..1 controls deformation depth
function buildRoundedPolygonPath(pts, cornerR, edgeStyle, bulgeAmount) {
  const n = pts.length;
  if (n < 3) return '';

  // Compute tangent points for each vertex
  const tangents = pts.map((curr, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const dx1 = prev[0]-curr[0], dy1 = prev[1]-curr[1];
    const dx2 = next[0]-curr[0], dy2 = next[1]-curr[1];
    const len1 = Math.sqrt(dx1*dx1+dy1*dy1);
    const len2 = Math.sqrt(dx2*dx2+dy2*dy2);
    const cr = Math.min(cornerR, len1*0.45, len2*0.45);
    // t1: point on edge coming INTO this vertex
    const t1 = [curr[0] + (dx1/len1)*cr, curr[1] + (dy1/len1)*cr];
    // t2: point on edge going OUT of this vertex
    const t2 = [curr[0] + (dx2/len2)*cr, curr[1] + (dy2/len2)*cr];
    return { t1, t2, v: curr };
  });

  let d = `M${tangents[0].t2[0].toFixed(2)},${tangents[0].t2[1].toFixed(2)}`;

  for (let i = 0; i < n; i++) {
    const curr = tangents[i];
    const nextIdx = (i + 1) % n;
    const next = tangents[nextIdx];

    // Edge from curr.t2 to next.t1
    const ex = next.t1[0], ey = next.t1[1];
    const sx = curr.t2[0], sy = curr.t2[1];

    if (edgeStyle === 'convex' || edgeStyle === 'concave') {
      // Compute outward normal for this edge
      const edx = ex - sx, edy = ey - sy;
      const edLen = Math.sqrt(edx*edx + edy*edy);
      if (edLen > 0.001) {
        // Outward normal: for a CCW polygon, outward is (-edy, edx)
        const amount = (bulgeAmount !== undefined ? bulgeAmount : 0.2);
        const bulge = edLen * amount; // always positive; sign controls direction
        // Find centroid to determine "outward"
        const centX = pts.reduce((s,p)=>s+p[0],0)/n;
        const centY = pts.reduce((s,p)=>s+p[1],0)/n;
        const midX = (sx+ex)/2, midY = (sy+ey)/2;
        const normX = -edy/edLen, normY = edx/edLen;
        // dot > 0 means normal points toward centroid (inward)
        const toCentX = centX - midX, toCentY = centY - midY;
        const dot = normX*toCentX + normY*toCentY;
        // convex: push away from centroid; concave: push toward centroid
        const sign = (edgeStyle === 'convex') ? (dot < 0 ? 1 : -1) : (dot > 0 ? 1 : -1);
        const cpx = midX + normX*bulge*sign;
        const cpy = midY + normY*bulge*sign;
        d += ` Q${cpx.toFixed(2)},${cpy.toFixed(2)} ${ex.toFixed(2)},${ey.toFixed(2)}`;
      } else {
        d += ` L${ex.toFixed(2)},${ey.toFixed(2)}`;
      }
    } else {
      d += ` L${ex.toFixed(2)},${ey.toFixed(2)}`;
    }

    // Corner arc: from next.t1 to next.t2 through the vertex
    d += ` Q${next.v[0].toFixed(2)},${next.v[1].toFixed(2)} ${next.t2[0].toFixed(2)},${next.t2[1].toFixed(2)}`;
  }

  return d + 'Z';
}

function rotatePoints(points, degrees) {
  const rad = degrees * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  for (let i=0; i<points.length; i++) {
    const [x,y] = points[i];
    points[i] = [x*cos-y*sin, x*sin+y*cos];
  }
}

function getEffectiveKeySize(h) {
  const base = (h && h.keySize !== undefined) ? h.keySize : layout.keySize;
  // Scale proportionally with zoom, no upper cap so zooming in grows keys.
  // Floor = base*0.4 keeps keys readable at very small zoom levels.
  const zoomScale = baseScaleX * zoomFactor;
  return Math.max(base * 0.4, base * zoomScale);
}

// Update view controls display (called after any pan/zoom)
function syncViewControls() {
  const zoomEl = document.getElementById('view-zoom');
  const zoomSlider = document.getElementById('view-zoom-slider');
  const panxEl = document.getElementById('view-panx');
  const panyEl = document.getElementById('view-pany');
  // Display the zoom factor (1.0 = default fit), not the raw scale in px/cent
  if (zoomEl) zoomEl.value = zoomFactor.toFixed(3);
  if (zoomSlider) zoomSlider.value = Math.log10(Math.max(0.001, zoomFactor)).toFixed(4);
  if (panxEl) panxEl.value = Math.round(viewState.panX);
  if (panyEl) panyEl.value = Math.round(viewState.panY);
  // Sync stretch sliders
  const sxSlider = document.getElementById('view-stretch-x-slider');
  const sxNum = document.getElementById('view-stretch-x-num');
  const sySlider = document.getElementById('view-stretch-y-slider');
  const syNum = document.getElementById('view-stretch-y-num');
  if (sxSlider) sxSlider.value = (layout.viewStretchX || 1).toFixed(2);
  if (sxNum) sxNum.value = (layout.viewStretchX || 1).toFixed(2);
  if (sySlider) sySlider.value = (layout.viewStretchY || 1).toFixed(2);
  if (syNum) syNum.value = (layout.viewStretchY || 1).toFixed(2);
  // Sync rotation
  const rotSlider2 = document.getElementById('keyboard-rotation');
  const rotNum2 = document.getElementById('keyboard-rotation-num');
  if (rotSlider2) rotSlider2.value = layout.keyboardRotation || 0;
  if (rotNum2) rotNum2.value = Math.round(layout.keyboardRotation || 0);
  updateViewDirtyIndicator();
}

function renderSVG() {
  const cs = getComputedStyle(document.documentElement);
  const wrap = svgEl.parentElement;
  const cw = wrap.clientWidth, ch = wrap.clientHeight;
  svgEl.setAttribute('viewBox', `0 0 ${cw} ${ch}`);

  const bgColor = cs.getPropertyValue('--color-bg').trim();
  const divColor = cs.getPropertyValue('--color-divider').trim();
  const textFaint = cs.getPropertyValue('--color-text-faint').trim();
  const activeColor = cs.getPropertyValue('--color-key-active').trim();

  // Clear groups
  axesGroup.innerHTML = '';
  connGroup.innerHTML = '';
  keysGroup.innerHTML = '';

  const keys = allKeysCache;

  if (!keys.length) {
    const txt = svgEl2('text', {
      x: (cw/2).toFixed(0), y: (ch/2).toFixed(0),
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: textFaint, 'font-size': '14', 'font-family': cs.getPropertyValue('--font-body').trim()
    });
    txt.textContent = 'Configure your Harmonies';
    axesGroup.appendChild(txt);
    return;
  }

  // Background
  const bg = svgEl2('rect', { x:0, y:0, width:cw, height:ch, fill:layout.bgColor || bgColor });
  axesGroup.appendChild(bg);

  // Octave and semitone lines (horizontal, across full width)
  const showOct = layout.showOctaveLines;
  const showSemi = layout.showSemitoneLines;
  if (showOct || showSemi) {
    const minCents = Math.min(...keys.map(k=>k.cents));
    const maxCents = Math.max(...keys.map(k=>k.cents));
    const step = showSemi ? 100 : 1200;
    const startC = Math.floor(minCents/1200)*1200 - 1200;
    const endC = Math.ceil(maxCents/1200)*1200 + 1200;
    for (let c=startC; c<=endC; c+=step) {
      const isOct = c%1200===0;
      if (!showSemi && !isOct) continue;
      if (!showOct && isOct) continue;
      const {py} = logicalToPixel(0, 0);
      // Horizontal line at width=0 is at py. But lines should span y-axis for a given cent value.
      // Actually octave/semitone lines are HORIZONTAL lines across the stage (width axis)
      // representing constant pitch heights.
      // We draw them as vertical lines (constant cent = constant x position)
      const {px} = logicalToPixel(c, 0);
      if (px < -200 || px > cw+200) continue;
      if (isOct) {
        if (!showOct) continue;
        const octColor = layout.octaveLineColor || divColor;
        const octW = layout.octaveLineWidth || 2;
        const line = svgEl2('line', {
          x1: px.toFixed(1), y1: 0, x2: px.toFixed(1), y2: ch,
          stroke: octColor, 'stroke-width': octW, opacity: '0.55'
        });
        axesGroup.appendChild(line);
      } else {
        if (!showSemi) continue;
        const semiColor = layout.semitoneLineColor || divColor;
        const semiW = layout.semitoneLineWidth || 1;
        const line = svgEl2('line', {
          x1: px.toFixed(1), y1: 0, x2: px.toFixed(1), y2: ch,
          stroke: semiColor, 'stroke-width': semiW, opacity: '0.35'
        });
        axesGroup.appendChild(line);
      }
    }
  }

  // Major/Minor width lines (horizontal lines at constant y positions)
  if (layout.showMajorWidthLines || layout.showMinorWidthLines) {
    const allW = keys.map(k=>k.y_logical);
    if (allW.length) {
      const minWL = Math.min(...allW), maxWL = Math.max(...allW);
      const drawWidthLines = (interval, color, strokeW, opacity) => {
        if (!interval || interval <= 0) return;
        const startW2 = Math.floor(minWL/interval)*interval - interval;
        const endW2 = Math.ceil(maxWL/interval)*interval + interval;
        for (let w=startW2; w<=endW2; w+=interval) {
          const {py: wy} = logicalToPixel(0, w);
          if (wy < -50 || wy > ch+50) continue;
          const line = svgEl2('line', {
            x1: 0, y1: wy.toFixed(1), x2: cw, y2: wy.toFixed(1),
            stroke: color, 'stroke-width': strokeW, opacity: opacity
          });
          axesGroup.appendChild(line);
        }
      };
      if (layout.showMajorWidthLines) {
        drawWidthLines(layout.majorWidthInterval||10, layout.majorWidthColor||'#aaaaaa', layout.majorWidthStroke||1, '0.45');
      }
      if (layout.showMinorWidthLines) {
        drawWidthLines(layout.minorWidthInterval||1, layout.minorWidthColor||'#aaaaaa', layout.minorWidthStroke||0.5, '0.25');
      }
    }
  }

  // Zero-width horizontal axis line
  const {py: y0} = logicalToPixel(0, 0);
  const axisLine = svgEl2('line', {
    x1: 0, y1: y0.toFixed(1), x2: cw, y2: y0.toFixed(1),
    stroke: divColor, 'stroke-width': 1, opacity: '0.18'
  });
  axesGroup.appendChild(axisLine);

  // Draw connect-tones connections for each harmony
  for (const harm of harmonies) {
    if (!harm.visible) continue;
    if (harm.connectTones === false) continue;
    const harmKeys = keys.filter(k => k.harmonyId === harm.id);
    if (harmKeys.length < 2) continue;
    // Sort by x_logical (cents)
    const sorted = harmKeys.slice().sort((a, b) => a.x_logical - b.x_logical);
    const strokeColor = harm.connectColor || '#888888';
    const strokeW = harm.connectWidth !== undefined ? harm.connectWidth : 2;
    const style = harm.connectStyle || 'curve';
    // Collect all pixel positions
    const pxPts = sorted.map(k => {
      const p = logicalToPixel(k.x_logical, k.y_logical);
      return [p.px + (harm.keyOffsetX || 0), p.py + (harm.keyOffsetY || 0)];
    });
    let pathD;
    if (style === 'curve' && pxPts.length >= 2) {
      // Catmull-Rom spline through all points — smooth, no kinks at tone positions
      // Convert to cubic bezier segments
      const tension = 0.5;
      let d = `M${pxPts[0][0].toFixed(2)},${pxPts[0][1].toFixed(2)}`;
      for (let ci = 0; ci < pxPts.length - 1; ci++) {
        const p0 = pxPts[Math.max(0, ci - 1)];
        const p1 = pxPts[ci];
        const p2 = pxPts[ci + 1];
        const p3 = pxPts[Math.min(pxPts.length - 1, ci + 2)];
        // Catmull-Rom to cubic bezier control points
        const cp1x = p1[0] + (p2[0] - p0[0]) * tension / 3;
        const cp1y = p1[1] + (p2[1] - p0[1]) * tension / 3;
        const cp2x = p2[0] - (p3[0] - p1[0]) * tension / 3;
        const cp2y = p2[1] - (p3[1] - p1[1]) * tension / 3;
        d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
      }
      pathD = d;
    } else {
      // Straight lines
      pathD = pxPts.map(([x,y],i) => `${i===0?'M':'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    }
    const connPath = svgEl2('path', {
      d: pathD, fill: 'none', stroke: strokeColor,
      'stroke-width': strokeW, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.7'
    });
    connGroup.appendChild(connPath);
  }

  // Overall keyboard rotation
  const kbRot = layout.keyboardRotation || 0;
  if (kbRot !== 0) {
    const rotTransform = `rotate(${kbRot},${(cw/2).toFixed(1)},${(ch/2).toFixed(1)})`;
    keysGroup.setAttribute('transform',  rotTransform);
    axesGroup.setAttribute('transform',  rotTransform);
    connGroup.setAttribute('transform',  rotTransform);
  } else {
    keysGroup.removeAttribute('transform');
    axesGroup.removeAttribute('transform');
    connGroup.removeAttribute('transform');
  }

  // Keys
  const allCents = keys.map(k=>k.cents);
  const allWidths = keys.map(k=>k.width);
  const minC=Math.min(...allCents), maxC=Math.max(...allCents);
  const minW=Math.min(...allWidths), maxW=Math.max(...allWidths);

  for (const key of keys) {
    const h = key.harmony;
    const ks = getEffectiveKeySize(h);
    const {px: px0, py: py0} = logicalToPixel(key.x_logical, key.y_logical);
    const px = px0 + (h.keyOffsetX || 0);
    const py = py0 + (h.keyOffsetY || 0);
    const isActive = activeKeyIds.has(key.label+'_'+key.harmonyId);
    const color = isActive ? activeColor : getKeyColor(key, h, keys);
    const strokeColor = isActive ? '#fff' : cs.getPropertyValue('--color-key-stroke').trim();
    const strokeW = isActive ? 2 : 1.5;

    const g = svgEl2('g', {
      class: 'svg-key' + (isActive ? ' key-active' : ''),
      'data-label': key.label,
      'data-hid': h.id,
      style: isActive ? 'filter:drop-shadow(0 0 8px gold)' : ''
    });
    if (h.opacity !== undefined && h.opacity < 1) {
      g.setAttribute('opacity', h.opacity);
    }

    const shape = buildKeyPath(px, py, ks, h, isActive);
    let shapeEl;
    if (shape.type === 'circle') {
      shapeEl = svgEl2('circle', {
        cx: px.toFixed(2), cy: py.toFixed(2), r: shape.r.toFixed(2),
        fill: color, stroke: strokeColor, 'stroke-width': strokeW
      });
    } else if (shape.type === 'ellipse') {
      shapeEl = shape.el;
      shapeEl.setAttribute('fill', color);
      shapeEl.setAttribute('stroke', strokeColor);
      shapeEl.setAttribute('stroke-width', strokeW);
    } else {
      shapeEl = svgEl2('path', {
        d: shape.d, fill: color, stroke: strokeColor, 'stroke-width': strokeW
      });
    }
    g.appendChild(shapeEl);

    // Label — when octave equivalence is on, only show in base octave (oct===0)
    const showLabel = h.showLabels &&
      (h.octaveEquiv ? key.oct === 0 : true);
    if (showLabel) {
      const fontSize = Math.max(8, Math.min(h.labelFontSize || 11, ks * 0.5));
      const defaultLblColor = isActive ? '#1a1a1a' : 'rgba(255,255,255,0.92)';
      const lblColor = isActive ? '#1a1a1a' : (h.labelColor && h.labelColor !== '' ? h.labelColor : defaultLblColor);
      const lx = (px + (h.labelOffsetX||0)).toFixed(2);
      const ly = (py + (h.labelOffsetY||0)).toFixed(2);
      const lbl = svgEl2('text', {
        x: lx, y: ly,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: lblColor,
        'font-size': fontSize,
        'font-family': cs.getPropertyValue('--font-body').trim(),
        'font-weight': '600',
        'pointer-events': 'none'
      });
      // Counter-rotate label so it always reads upright
      if (kbRot !== 0) {
        lbl.setAttribute('transform', `rotate(${-kbRot},${lx},${ly})`);
      }
      const labelContent = getKeyLabel(key, h);
      if (h.labelType === 'heji' && labelContent.includes('<')) {
        // HEJI label is HTML — use foreignObject to embed it in SVG
        lbl.remove(); // don't use the text element
        const fsize = fontSize;
        const fw = fsize * 5;  // estimated width
        const fh = fsize * 2.2;
        const fo = svgEl2('foreignObject', {
          x: (parseFloat(lx) - fw/2).toFixed(1),
          y: (parseFloat(ly) - fh/2).toFixed(1),
          width: fw.toFixed(1), height: fh.toFixed(1),
          'pointer-events': 'none'
        });
        if (kbRot !== 0) {
          fo.setAttribute('transform', `rotate(${-kbRot},${lx},${ly})`);
        }
        const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        div.style.cssText = `display:flex;align-items:center;justify-content:center;`
          + `width:100%;height:100%;font-size:${fsize}px;color:${lblColor};`
          + `font-family:${cs.getPropertyValue('--font-body').trim()};font-weight:600;`
          + `overflow:visible;pointer-events:none;`;
        div.innerHTML = labelContent;
        fo.appendChild(div);
        g.appendChild(fo);
      } else {
        lbl.textContent = labelContent;
        g.appendChild(lbl);
      }
    }

    // Invisible hit area — ellipse to match key stretch
    const hitR = Math.max(ks * 0.7, 8);
    const hitSx = h.keyStretchX || 1;
    const hitSy = h.keyStretchY || 1;
    const hitRot = h.keyRotation || 0;
    let hit;
    if (Math.abs(hitSx - 1) > 0.01 || Math.abs(hitSy - 1) > 0.01 || hitRot !== 0) {
      hit = svgEl2('ellipse', {
        cx: px.toFixed(2), cy: py.toFixed(2),
        rx: (hitR * hitSx).toFixed(2), ry: (hitR * hitSy).toFixed(2),
        fill: 'transparent', stroke: 'none',
        style: 'cursor:pointer'
      });
      if (hitRot !== 0) hit.setAttribute('transform', `rotate(${hitRot},${px.toFixed(2)},${py.toFixed(2)})`);
    } else {
      hit = svgEl2('circle', {
        cx: px.toFixed(2), cy: py.toFixed(2),
        r: hitR.toFixed(2),
        fill: 'transparent', stroke: 'none',
        style: 'cursor:pointer'
      });
    }
    // Mouse play handled at stage level (mousedown/mouseup)
    // Store key reference on element — stage touch handlers use elementFromPoint to find this
    hit._fkKey = key;
    hit.addEventListener('mouseover', e => showTooltip(e.clientX, e.clientY, key));
    hit.addEventListener('mousemove', e => showTooltip(e.clientX, e.clientY, key));
    hit.addEventListener('mouseout', hideTooltip);
    g.appendChild(hit);

    keysGroup.appendChild(g);
  }

  syncViewControls();
}
