// state.js
// Global app state: harmonies[], layout{}, viewState{}. makeHarmony, snapshotHarmony.
// ======================================================================


// ═════════════════════════════════════════════════════════════════════════════
//  APP STATE
// ═════════════════════════════════════════════════════════════════════════════

let harmonies = []; // Array of harmony objects
let selectedHarmonyId = null;
let nextHarmonyId = 1;

// New global state
let isViewLocked = false;
let projectIsDirty = false;
let projectDescription = '';
let currentFileHandle = null;

const layout = {
  coordSystem: 'reduced',
  customBasis: null, // for 'other' mode
  widths: [0, 2.0, 4.5, 4.0, 3.5, 1.6],
  savedWidths: [0, 2.0, 4.5, 4.0, 3.5, 1.6],
  widthScopes: [5, 5, 5, 5, 5, 5], // slider range: ±scope per row
  keySize: 80,
  showOctaveLines: true,
  showSemitoneLines: false,
  keyboardRotation: 0,
  viewStretchX: 1.0,
  viewStretchY: 1.0,
  octaveEquiv: true,
  savedView: null,
  savedLayoutState: null,
  octaveLineColor: '#aaaaaa',
  octaveLineWidth: 1,
  semitoneLineColor: '#aaaaaa',
  semitoneLineWidth: 0.5,
  showMajorWidthLines: true,
  majorWidthInterval: 10,
  majorWidthColor: '#aaaaaa',
  majorWidthStroke: 1,
  showMinorWidthLines: false,
  minorWidthInterval: 1,
  minorWidthColor: '#aaaaaa',
  minorWidthStroke: 0.5,
  bgColor: null
};

function makeHarmony(overrides = {}) {
  const id = 'h' + (nextHarmonyId++);
  const h = {
    id,
    name: overrides.name || 'Harmony ' + (harmonies.length + 1),
    visible: true,
    ratios: overrides.ratios !== undefined ? overrides.ratios : '1, 9/8, 5/4, 11/8, 3/2, 13/8, 7/4, 15/8',
    octaveEquiv: overrides.octaveEquiv !== undefined ? overrides.octaveEquiv : true,
    showLabels: overrides.showLabels !== undefined ? overrides.showLabels : true,
    labelFontSize: overrides.labelFontSize || 11,
    labelOffsetX: overrides.labelOffsetX || 0,
    labelOffsetY: overrides.labelOffsetY || 0,
    labelColor: overrides.labelColor || '',
    labelType: overrides.labelType || 'ratio', // 'ratio' or 'heji'
    showLabels2: overrides.showLabels2 !== undefined ? overrides.showLabels2 : false,
    labelFontSize2: overrides.labelFontSize2 || 11,
    labelOffsetX2: overrides.labelOffsetX2 || 0,
    labelOffsetY2: overrides.labelOffsetY2 || 0,
    labelColor2: overrides.labelColor2 || '',
    labelType2: overrides.labelType2 || 'ratio',
    toneMode: overrides.toneMode || 'ratios', // 'ratios' | 'primepowers' | 'vectors'
    keySize: overrides.keySize !== undefined ? overrides.keySize : 120,
    keyShape: overrides.keyShape || 'round',
    keyRotation: overrides.keyRotation || 0,
    keyStretchX: overrides.keyStretchX !== undefined ? overrides.keyStretchX : 1.0,
    keyStretchY: overrides.keyStretchY !== undefined ? overrides.keyStretchY : 1.0,
    keyRounding: overrides.keyRounding !== undefined ? overrides.keyRounding : 0,
    keyEdge: overrides.keyEdge || 'straight',
    keyBulge: overrides.keyBulge !== undefined ? overrides.keyBulge : 0.2,
    keyStrokeWidth: overrides.keyStrokeWidth !== undefined ? overrides.keyStrokeWidth : 0,
    colorMode: overrides.colorMode || 'uniform',
    uniformColor: overrides.uniformColor || '#6490c4',
    edgeColor: overrides.edgeColor || '',
    opacity: overrides.opacity !== undefined ? overrides.opacity : 1.0,
    keyOffsetX: overrides.keyOffsetX !== undefined ? overrides.keyOffsetX : 0,
    keyOffsetY: overrides.keyOffsetY !== undefined ? overrides.keyOffsetY : 0,
    connectTones: overrides.connectTones !== undefined ? overrides.connectTones : true,
    connectStyle: overrides.connectStyle || 'curve',
    connectColor: overrides.connectColor || '#888888',
    connectWidth: overrides.connectWidth !== undefined ? overrides.connectWidth : 2,
    // edit state (null = no unsaved changes)
    editState: null,
    // saved snapshot
    savedState: null
  };
  h.savedState = snapshotHarmony(h);
  return h;
}

function snapshotHarmony(h) {
  return {
    name: h.name, ratios: h.ratios, octaveEquiv: h.octaveEquiv,
    showLabels: h.showLabels, labelFontSize: h.labelFontSize,
    labelOffsetX: h.labelOffsetX, labelOffsetY: h.labelOffsetY,
    labelColor: h.labelColor || '',
    labelType: h.labelType || 'ratio',
    showLabels2: h.showLabels2 !== undefined ? h.showLabels2 : false,
    labelFontSize2: h.labelFontSize2 || 11,
    labelOffsetX2: h.labelOffsetX2 || 0, labelOffsetY2: h.labelOffsetY2 || 0,
    labelColor2: h.labelColor2 || '', labelType2: h.labelType2 || 'ratio',
    toneMode: h.toneMode || 'ratios',
    keySize: h.keySize !== undefined ? h.keySize : 120,
    keyShape: h.keyShape, keyRotation: h.keyRotation,
    keyRounding: h.keyRounding || 0, keyEdge: h.keyEdge || 'straight', keyBulge: h.keyBulge !== undefined ? h.keyBulge : 0.2, keyStrokeWidth: h.keyStrokeWidth !== undefined ? h.keyStrokeWidth : 0,
    keyStretchX: h.keyStretchX, keyStretchY: h.keyStretchY,
    colorMode: h.colorMode, uniformColor: h.uniformColor, edgeColor: h.edgeColor || '',
    opacity: h.opacity !== undefined ? h.opacity : 1.0,
    keyOffsetX: h.keyOffsetX !== undefined ? h.keyOffsetX : 0,
    keyOffsetY: h.keyOffsetY !== undefined ? h.keyOffsetY : 0,
    connectTones: h.connectTones !== undefined ? h.connectTones : true,
    connectStyle: h.connectStyle || 'curve',
    connectColor: h.connectColor || '#888888',
    connectWidth: h.connectWidth !== undefined ? h.connectWidth : 2
  };
}

function harmonyIsDirty(h) {
  if (!h.savedState) return true;
  const snap = snapshotHarmony(h);
  return JSON.stringify(snap) !== JSON.stringify(h.savedState);
}

function saveHarmony(h) {
  h.savedState = snapshotHarmony(h);
  h.editState = null;
}

function revertHarmony(h) {
  if (!h.savedState) return;
  Object.assign(h, h.savedState);
  h.editState = null;
}
