// touch.js
// Pan/zoom/touch handling. initPanZoom IIFE, mouse, touch (locked/unlocked), applyZoom.
// ======================================================================


// ═════════════════════════════════════════════════════════════════════════════
//  PAN / ZOOM (pointer events on stage)
// ═════════════════════════════════════════════════════════════════════════════

(function initPanZoom() {
  const stage = document.getElementById('stage-wrap');

  // Prevent browser scroll/zoom from claiming touch gestures on the stage
  stage.style.touchAction = 'none';
  stage.style.webkitUserSelect = 'none';
  stage.style.userSelect = 'none';

  // ── Coordinate → key lookup ──
  function getKeyAtPixel(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const spx = clientX - rect.left;
    const spy = clientY - rect.top;
    const kbRot = layout.keyboardRotation || 0;
    let rpx = spx, rpy = spy;
    if (kbRot !== 0) {
      const cx = rect.width / 2, cy = rect.height / 2;
      const rad = -kbRot * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const dx = spx - cx, dy = spy - cy;
      rpx = cx + dx * cos - dy * sin;
      rpy = cy + dx * sin + dy * cos;
    }
    let bestKey = null, bestDist = Infinity;
    for (const key of allKeysCache) {
      if (!key.harmony || !key.harmony.visible) continue;
      const { px, py } = logicalToPixel(key.x_logical, key.y_logical);
      const kpx = px + (key.harmony.keyOffsetX || 0);
      const kpy = py + (key.harmony.keyOffsetY || 0);
      const ks = getEffectiveKeySize(key.harmony);
      const hitR = Math.max(ks * 0.7, 8);
      const sx = key.harmony.keyStretchX || 1;
      const sy = key.harmony.keyStretchY || 1;
      const dx = rpx - kpx, dy = rpy - kpy;
      const rx = hitR * sx, ry = hitR * sy;
      const d2 = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (d2 <= 1 && d2 < bestDist) { bestDist = d2; bestKey = key; }
    }
    return bestKey;
  }

  // ── In-place key highlight (NO DOM rebuild — safe during active touches) ──
  // Finds the existing SVG group for a key and toggles active styling directly.
  function getKeyGroup(key) {
    return keysGroup.querySelector(
      `g[data-label="${CSS.escape(key.label)}"][data-hid="${CSS.escape(String(key.harmonyId))}"]`
    );
  }

  function highlightKeyEl(key) {
    const g = getKeyGroup(key);
    if (!g) return;
    const cs = getComputedStyle(document.documentElement);
    const activeColor = cs.getPropertyValue('--color-key-active').trim();
    g.classList.add('key-active');
    g.style.filter = 'drop-shadow(0 0 8px gold)';
    const shape = g.querySelector('circle, ellipse, path');
    if (shape) { shape.setAttribute('fill', activeColor); shape.setAttribute('stroke', '#fff'); shape.setAttribute('stroke-width', '2'); }
    const lbl = g.querySelector('text');
    if (lbl) lbl.setAttribute('fill', '#1a1a1a');
  }

  function unhighlightKeyEl(key) {
    const g = getKeyGroup(key);
    if (!g) return;
    g.classList.remove('key-active');
    g.style.filter = '';
    // Restore original fill/stroke in-place — no DOM rebuild needed
    const cs = getComputedStyle(document.documentElement);
    const strokeColor = cs.getPropertyValue('--color-key-stroke').trim();
    const originalColor = getKeyColor(key, key.harmony, allKeysCache);
    const shape = g.querySelector('circle, ellipse, path');
    if (shape) { shape.setAttribute('fill', originalColor); shape.setAttribute('stroke', strokeColor); shape.setAttribute('stroke-width', '1.5'); }
    const lbl = g.querySelector('text');
    if (lbl) {
      const defaultLblColor = key.harmony && key.harmony.labelColor && key.harmony.labelColor !== ''
        ? key.harmony.labelColor : 'rgba(255,255,255,0.92)';
      lbl.setAttribute('fill', defaultLblColor);
    }
  }

  // ── Mouse wheel zoom ──
  stage.addEventListener('wheel', e => {
    if (isViewLocked) { e.preventDefault(); return; }
    e.preventDefault();
    commitPan(); // fold any pending touch-pan offset into viewState before zooming
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = stage.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    viewState.panX = mx + (viewState.panX - mx) * factor;
    viewState.panY = my + (viewState.panY - my) * factor;
    zoomFactor *= factor;
    syncScales();
    renderSVG();
  }, { passive: false });

  // ══════════════════════════════════════════════════════════
  //  MOUSE HANDLING
  // ══════════════════════════════════════════════════════════

  let mouseMode = 'idle';
  let mouseKeyRelease = null;
  let mouseKeyActive = null;
  let mousePanLastX = 0, mousePanLastY = 0;

  function mouseKeyStop() {
    if (mouseKeyRelease) { try { mouseKeyRelease(); } catch(_) {} mouseKeyRelease = null; }
    if (mouseKeyActive) {
      activeKeyIds.delete(mouseKeyActive.label + '_' + mouseKeyActive.harmonyId);
      mouseKeyActive = null;
      renderSVG();
    }
    mouseMode = 'idle';
    stage.classList.remove('panning');
  }

  stage.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const k = getKeyAtPixel(e.clientX, e.clientY);
    if (k) {
      mouseMode = 'key';
      mouseKeyActive = k;
      mouseKeyRelease = playKeySustained(k);
      activeKeyIds.add(k.label + '_' + k.harmonyId);
      renderSVG();
    } else if (!isViewLocked) {
      mouseMode = 'pan';
      mousePanLastX = e.clientX;
      mousePanLastY = e.clientY;
      stage.classList.add('panning');
    }
  });

  stage.addEventListener('mousemove', e => {
    if (mouseMode !== 'pan') return;
    const dx = e.clientX - mousePanLastX;
    const dy = e.clientY - mousePanLastY;
    mousePanLastX = e.clientX;
    mousePanLastY = e.clientY;
    if (dx !== 0 || dy !== 0) { viewState.panX += dx; viewState.panY += dy; renderSVG(); }
  });

  stage.addEventListener('mouseup', e => { if (e.button === 0) mouseKeyStop(); });
  stage.addEventListener('mouseleave', () => { mouseKeyStop(); hideTooltip(); });

  // ══════════════════════════════════════════════════════════
  //  PAN: CSS transform during gesture, commit to viewState on end
  //  Exposed as window._commitPan so applyZoom can call it before rendering
  // ══════════════════════════════════════════════════════════

  let panTouchId = -1;
  let panLastX = 0, panLastY = 0;
  let panOffsetX = 0, panOffsetY = 0;

  function applyPanTransform() {
    svgEl.style.transform = (panOffsetX === 0 && panOffsetY === 0)
      ? '' : `translate(${panOffsetX}px, ${panOffsetY}px)`;
  }

  function commitPan() {
    if (panOffsetX !== 0 || panOffsetY !== 0) {
      viewState.panX += panOffsetX;
      viewState.panY += panOffsetY;
      panOffsetX = 0;
      panOffsetY = 0;
    }
    svgEl.style.transform = '';
  }
  // Expose for applyZoom (defined later in the file) to call before rendering
  window._commitTouchPan = commitPan;

  // ══════════════════════════════════════════════════════════
  //  TOUCH KEY HELPERS
  // ══════════════════════════════════════════════════════════

  function tkPress(id, key) {
    const cur = touchKeyMap.get(id);
    if (cur && cur.key.label === key.label && cur.key.harmonyId === key.harmonyId) return false;
    if (cur) {
      if (cur.releaseFunc) { try { cur.releaseFunc(); } catch(_) {} }
      const stillHeld = [...touchKeyMap.values()].some(
        v => v !== cur && v.key.label === cur.key.label && v.key.harmonyId === cur.key.harmonyId
      );
      if (!stillHeld) {
        activeKeyIds.delete(cur.key.label + '_' + cur.key.harmonyId);
        // Restore old key's visual state in-place (no DOM rebuild)
        unhighlightKeyEl(cur.key);
      }
    }
    const rf = playKeySustained(key);
    touchKeyMap.set(id, { key, releaseFunc: rf });
    activeKeyIds.add(key.label + '_' + key.harmonyId);
    highlightKeyEl(key); // in-place highlight (no DOM rebuild)
    return true;
  }

  function tkRelease(id) {
    const cur = touchKeyMap.get(id);
    if (!cur) return false;
    touchKeyMap.delete(id);
    if (cur.releaseFunc) { try { cur.releaseFunc(); } catch(_) {} }
    const stillHeld = [...touchKeyMap.values()].some(
      v => v.key.label === cur.key.label && v.key.harmonyId === cur.key.harmonyId
    );
    if (!stillHeld) {
      activeKeyIds.delete(cur.key.label + '_' + cur.key.harmonyId);
    }
    return true;
  }

  function touchCleanup() {
    // Release all sounds immediately (no renderSVG — will be called after)
    for (const entry of touchKeyMap.values()) {
      if (entry.releaseFunc) { try { entry.releaseFunc(); } catch(_) {} }
    }
    touchKeyMap.clear();
    activeKeyIds.clear();
    panTouchId = -1;
    commitPan();
  }

  // ══════════════════════════════════════════════════════════
  //  UNLOCKED TOUCH: single-touch tap-to-play + pan
  // ══════════════════════════════════════════════════════════

  function unlockedStart(t) {
    if (panTouchId === t.identifier) panTouchId = -1; // stale id reset
    if (touchKeyMap.size > 0 || panTouchId !== -1) return;

    const k = getKeyAtPixel(t.clientX, t.clientY);
    if (k) {
      tkPress(t.identifier, k); // tkPress calls highlightKeyEl — in-place, no DOM rebuild
    } else {
      panTouchId = t.identifier;
      panLastX = t.clientX;
      panLastY = t.clientY;
    }
  }

  function unlockedMove(changedTouches) {
    for (const t of changedTouches) {
      if (t.identifier === panTouchId) {
        const dx = t.clientX - panLastX, dy = t.clientY - panLastY;
        panLastX = t.clientX; panLastY = t.clientY;
        panOffsetX += dx; panOffsetY += dy;
        applyPanTransform(); // CSS transform only — no DOM rebuild
      } else {
        const cur = touchKeyMap.get(t.identifier);
        if (cur) {
          const k = getKeyAtPixel(t.clientX, t.clientY);
          if (!k || k.label !== cur.key.label || k.harmonyId !== cur.key.harmonyId) {
            tkRelease(t.identifier);
            unhighlightKeyEl(cur.key); // will call renderSVG
            panTouchId = t.identifier;
            panLastX = t.clientX; panLastY = t.clientY;
          }
        }
      }
    }
  }

  function unlockedEnd(t) {
    const wasPan = (panTouchId === t.identifier);
    if (wasPan) {
      panTouchId = -1;
      commitPan();
      renderSVG();
      return;
    }
    const cur = touchKeyMap.get(t.identifier);
    if (cur) {
      tkRelease(t.identifier);
      unhighlightKeyEl(cur.key); // calls renderSVG
    }
  }

  // ══════════════════════════════════════════════════════════
  //  LOCKED TOUCH: multi-finger play + swipe, no pan
  // ══════════════════════════════════════════════════════════

  function lockedStart(t) {
    const k = getKeyAtPixel(t.clientX, t.clientY);
    if (k) tkPress(t.identifier, k); // in-place highlight, no DOM rebuild
  }

  function lockedMove(changedTouches) {
    for (const t of changedTouches) {
      const prevEntry = touchKeyMap.get(t.identifier);
      const k = getKeyAtPixel(t.clientX, t.clientY);
      if (k) {
        tkPress(t.identifier, k); // handles release of old key + highlight new key in-place
      } else if (prevEntry) {
        tkRelease(t.identifier);
        unhighlightKeyEl(prevEntry.key); // calls renderSVG
      }
    }
  }

  function lockedEnd(t) {
    const cur = touchKeyMap.get(t.identifier);
    if (cur) {
      tkRelease(t.identifier);
      unhighlightKeyEl(cur.key); // calls renderSVG
    }
  }

  // ── Touch event dispatch ──

  stage.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (isViewLocked) lockedStart(t);
      else unlockedStart(t);
    }
  }, { passive: false });

  stage.addEventListener('touchmove', e => {
    e.preventDefault();
    if (isViewLocked) lockedMove(e.changedTouches);
    else unlockedMove(e.changedTouches);
  }, { passive: false });

  // touchend on document — fires even if original touch target element was replaced
  document.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (isViewLocked) lockedEnd(t);
      else unlockedEnd(t);
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    touchCleanup();
    renderSVG();
  }, { passive: true });

})();
