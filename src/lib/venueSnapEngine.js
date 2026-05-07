// SketchUp-style Inference & Snap Engine
// Injected into the VenueDims iframe via blob URL patching.
// This script patches the existing drag handlers to:
// 1. Collect snap targets from all objects (stage, rooms, walls, building, grid)
// 2. Draw inference lines when dragged object aligns with a target on X or Y
// 3. Show snap indicator dots at lock points
// 4. Display tooltip with what was snapped and to what

export const SNAP_ENGINE_JS = `
<script id="snap-engine">
(function() {
  // Wait until the app's own JS has run and state/svg are initialized
  window.addEventListener('load', function() {
    setTimeout(initSnapEngine, 300);
  });

  // ──────────────────────────────────────────────────────────
  // CONFIG
  // ──────────────────────────────────────────────────────────
  const SNAP_THRESHOLD_FT = 1.2;   // ft — proximity to snap
  const GRID_SNAP_FT = 0.5;        // ft — baseline grid snap granularity
  const INFERENCE_COLOR_X = '#ff4d9e';  // magenta — horizontal alignment (matching X)
  const INFERENCE_COLOR_Y = '#3dd68c';  // green — vertical alignment (matching Y)
  const INFERENCE_COLOR_BOTH = '#f0a040'; // orange — both axes locked
  const SNAP_DOT_R = 5;
  const INFERENCE_DASH = '4,3';
  const SNAP_LAYER_ID = 'snap-inference-layer';

  // ──────────────────────────────────────────────────────────
  // INFERENCE LINE LAYER (SVG group injected on top of venue-svg)
  // ──────────────────────────────────────────────────────────
  function getOrCreateSnapLayer() {
    const svg = document.getElementById('venue-svg');
    if (!svg) return null;
    let layer = document.getElementById(SNAP_LAYER_ID);
    if (!layer) {
      layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.id = SNAP_LAYER_ID;
      layer.style.pointerEvents = 'none';
      svg.appendChild(layer);
    }
    return layer;
  }

  function clearSnapLayer() {
    const layer = document.getElementById(SNAP_LAYER_ID);
    if (layer) layer.innerHTML = '';
  }

  // Draw a horizontal inference line at a given SVG-pixel Y
  function drawInferenceH(layer, yPx, xStart, xEnd, color, label) {
    const svg = document.getElementById('venue-svg');
    if (!svg || !layer) return;
    const vb = svg.viewBox.baseVal;
    const x1 = vb ? vb.x - 60 : xStart - 60;
    const x2 = vb ? vb.x + vb.width + 60 : xEnd + 60;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', yPx);
    line.setAttribute('x2', x2); line.setAttribute('y2', yPx);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.2');
    line.setAttribute('stroke-dasharray', INFERENCE_DASH);
    line.setAttribute('opacity', '0.85');
    layer.appendChild(line);

    if (label) {
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', x1 + 4);
      txt.setAttribute('y', yPx - 4);
      txt.setAttribute('fill', color);
      txt.setAttribute('font-size', '9');
      txt.setAttribute('font-family', 'JetBrains Mono, monospace');
      txt.setAttribute('opacity', '0.9');
      txt.textContent = label;
      layer.appendChild(txt);
    }
  }

  // Draw a vertical inference line at a given SVG-pixel X
  function drawInferenceV(layer, xPx, yStart, yEnd, color, label) {
    const svg = document.getElementById('venue-svg');
    if (!svg || !layer) return;
    const vb = svg.viewBox.baseVal;
    const y1 = vb ? vb.y - 60 : yStart - 60;
    const y2 = vb ? vb.y + vb.height + 60 : yEnd + 60;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', xPx); line.setAttribute('y1', y1);
    line.setAttribute('x2', xPx); line.setAttribute('y2', y2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.2');
    line.setAttribute('stroke-dasharray', INFERENCE_DASH);
    line.setAttribute('opacity', '0.85');
    layer.appendChild(line);

    if (label) {
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', xPx + 4);
      txt.setAttribute('y', y1 + 14);
      txt.setAttribute('fill', color);
      txt.setAttribute('font-size', '9');
      txt.setAttribute('font-family', 'JetBrains Mono, monospace');
      txt.setAttribute('opacity', '0.9');
      txt.textContent = label;
      layer.appendChild(txt);
    }
  }

  // Draw a snap indicator dot at given SVG-pixel (x, y)
  function drawSnapDot(layer, xPx, yPx, color) {
    if (!layer) return;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', xPx);
    dot.setAttribute('cy', yPx);
    dot.setAttribute('r', SNAP_DOT_R);
    dot.setAttribute('fill', 'none');
    dot.setAttribute('stroke', color);
    dot.setAttribute('stroke-width', '2');
    layer.appendChild(dot);

    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    inner.setAttribute('cx', xPx);
    inner.setAttribute('cy', yPx);
    inner.setAttribute('r', 2.5);
    inner.setAttribute('fill', color);
    layer.appendChild(inner);
  }

  // Draw a snap square (for edge snaps)
  function drawSnapSquare(layer, xPx, yPx, color) {
    if (!layer) return;
    const sq = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const sz = 8;
    sq.setAttribute('x', xPx - sz/2);
    sq.setAttribute('y', yPx - sz/2);
    sq.setAttribute('width', sz);
    sq.setAttribute('height', sz);
    sq.setAttribute('fill', 'none');
    sq.setAttribute('stroke', color);
    sq.setAttribute('stroke-width', '2');
    layer.appendChild(sq);
  }

  // ──────────────────────────────────────────────────────────
  // COLLECT SNAP TARGETS from current state
  // Returns { xTargets: [{v, label, type}], yTargets: [{v, label, type}] }
  // All values in FEET (plan coordinates)
  // ──────────────────────────────────────────────────────────
  function collectSnapTargets(ignoreRoomId, ignoreWallId) {
    const st = window.state;
    if (!st) return { xTargets: [], yTargets: [] };

    const W = st.building.w;
    const D = st.building.d;

    const xT = []; // X snap targets (vertical inference lines)
    const yT = []; // Y snap targets (horizontal inference lines)

    // ── Building walls & center ──
    xT.push({ v: 0,     label: 'SR Wall',    type: 'wall' });
    xT.push({ v: W,     label: 'SL Wall',    type: 'wall' });
    xT.push({ v: W/2,   label: 'Bldg Ctr',  type: 'center' });
    yT.push({ v: 0,     label: 'Back Wall',  type: 'wall' });
    yT.push({ v: D,     label: 'Front Wall', type: 'wall' });
    yT.push({ v: D/2,   label: 'Bldg Ctr',  type: 'center' });

    // ── Stage ──
    if (st.stage.height >= 0) {
      const sW = st.stage.w;
      const sX1 = (W - sW) / 2;
      const sX2 = sX1 + sW;
      const sY1 = st.backstage;
      const sY2 = st.backstage + st.stage.d;
      xT.push({ v: sX1,          label: 'Stage SR',   type: 'edge' });
      xT.push({ v: sX2,          label: 'Stage SL',   type: 'edge' });
      xT.push({ v: (sX1+sX2)/2,  label: 'Stage Ctr',  type: 'center' });
      yT.push({ v: sY1,          label: 'Stage Back',  type: 'edge' });
      yT.push({ v: sY2,          label: 'Stage Front', type: 'edge' });
      yT.push({ v: (sY1+sY2)/2,  label: 'Stage Ctr',  type: 'center' });
    }

    // ── Backstage / FOH zone lines ──
    yT.push({ v: st.backstage,               label: 'Backstage', type: 'zone' });
    yT.push({ v: D - st.foh,                 label: 'FOH',       type: 'zone' });

    // ── Thrust ──
    if (st.thrust && st.thrust.enabled) {
      const tCx = st.thrust.x;
      const tw = st.thrust.w;
      const td = st.thrust.depth;
      const tY1 = st.backstage + st.stage.d;
      const tY2 = tY1 + td;
      xT.push({ v: tCx - tw/2, label: 'Thrust SR', type: 'edge' });
      xT.push({ v: tCx + tw/2, label: 'Thrust SL', type: 'edge' });
      xT.push({ v: tCx,        label: 'Thrust Ctr', type: 'center' });
      yT.push({ v: tY2,        label: 'Thrust Front', type: 'edge' });
    }

    // ── B-Stage ──
    if (st.bstage && st.bstage.enabled) {
      const bx = st.bstage.x;
      const by = st.bstage.y;
      const brx = st.bstage.w / 2;
      const bry = st.bstage.d / 2;
      xT.push({ v: bx - brx, label: 'B-Stage L',   type: 'edge' });
      xT.push({ v: bx + brx, label: 'B-Stage R',   type: 'edge' });
      xT.push({ v: bx,       label: 'B-Stage Ctr', type: 'center' });
      yT.push({ v: by - bry, label: 'B-Stage Back',  type: 'edge' });
      yT.push({ v: by + bry, label: 'B-Stage Front', type: 'edge' });
      yT.push({ v: by,       label: 'B-Stage Ctr',   type: 'center' });
    }

    // ── Rooms ──
    if (st.rooms) {
      st.rooms.forEach(rm => {
        if (rm.id === ignoreRoomId) return;
        const lbl = (rm.label || 'Room').substring(0, 8);
        xT.push({ v: rm.x,          label: lbl + ' L',   type: 'room-edge' });
        xT.push({ v: rm.x + rm.w,   label: lbl + ' R',   type: 'room-edge' });
        xT.push({ v: rm.x + rm.w/2, label: lbl + ' Ctr', type: 'room-center' });
        yT.push({ v: rm.y,          label: lbl + ' Top',  type: 'room-edge' });
        yT.push({ v: rm.y + rm.d,   label: lbl + ' Bot',  type: 'room-edge' });
        yT.push({ v: rm.y + rm.d/2, label: lbl + ' Ctr',  type: 'room-center' });
      });
    }

    // ── Custom Walls ──
    if (st.walls) {
      st.walls.forEach(wall => {
        if (wall.id === ignoreWallId) return;
        const lbl = (wall.label || 'Wall').substring(0, 8);
        // Get endpoints from getWallGeo if available
        const wg = (window.getWallGeo && window.getWallGeo(wall)) || null;
        if (wg) {
          if (wg.thin) {
            xT.push({ v: wg.endA[0], label: lbl + ' A',   type: 'wall-end' });
            xT.push({ v: wg.endB[0], label: lbl + ' B',   type: 'wall-end' });
            yT.push({ v: wg.endA[1], label: lbl + ' A',   type: 'wall-end' });
            yT.push({ v: wg.endB[1], label: lbl + ' B',   type: 'wall-end' });
          } else {
            wg.corners.forEach((c, i) => {
              xT.push({ v: c[0], label: lbl + ' C' + i, type: 'wall-corner' });
              yT.push({ v: c[1], label: lbl + ' C' + i, type: 'wall-corner' });
            });
          }
        }
        xT.push({ v: wall.x, label: lbl + ' Ctr', type: 'wall-center' });
        yT.push({ v: wall.y, label: lbl + ' Ctr', type: 'wall-center' });
      });
    }

    // ── Balcony ──
    if (st.balcony && st.balcony.enabled) {
      const balcXL = st.balcony.xLeft || 0;
      const balcXR = st.balcony.xRight || W;
      const balcYFront = D - st.balcony.depth;
      xT.push({ v: balcXL,         label: 'Balcony L',   type: 'balcony' });
      xT.push({ v: balcXR,         label: 'Balcony R',   type: 'balcony' });
      xT.push({ v: (balcXL+balcXR)/2, label: 'Balcony Ctr', type: 'balcony' });
      yT.push({ v: balcYFront,     label: 'Balcony Front', type: 'balcony' });
      yT.push({ v: D,              label: 'Balcony Back',  type: 'balcony' });
    }

    return { xTargets: xT, yTargets: yT };
  }

  // ──────────────────────────────────────────────────────────
  // SNAP LOGIC
  // Returns { x: snappedX, y: snappedY, snapX: target|null, snapY: target|null }
  // ──────────────────────────────────────────────────────────
  function applySnap(rawX, rawY, ignoreRoomId, ignoreWallId) {
    const { xTargets, yTargets } = collectSnapTargets(ignoreRoomId, ignoreWallId);

    // Grid snap first (coarse)
    let x = Math.round(rawX / GRID_SNAP_FT) * GRID_SNAP_FT;
    let y = Math.round(rawY / GRID_SNAP_FT) * GRID_SNAP_FT;
    let snapX = null, snapY = null;

    // Fine snap: find closest target within threshold
    let bestXDist = SNAP_THRESHOLD_FT;
    for (const t of xTargets) {
      const d = Math.abs(rawX - t.v);
      if (d < bestXDist) { bestXDist = d; snapX = t; x = t.v; }
    }

    let bestYDist = SNAP_THRESHOLD_FT;
    for (const t of yTargets) {
      const d = Math.abs(rawY - t.v);
      if (d < bestYDist) { bestYDist = d; snapY = t; y = t.v; }
    }

    return { x, y, snapX, snapY };
  }

  // ──────────────────────────────────────────────────────────
  // RENDER INFERENCE LINES for current snap state
  // cx, cy = current object center in feet
  // snapX, snapY = snap targets (or null)
  // s = scale (px per ft)
  // ──────────────────────────────────────────────────────────
  function renderInference(cx, cy, snapX, snapY, s) {
    clearSnapLayer();
    const layer = getOrCreateSnapLayer();
    if (!layer) return;

    const cxPx = cx * s;
    const cyPx = cy * s;

    const bothSnapped = snapX && snapY;
    const colorX = bothSnapped ? INFERENCE_COLOR_BOTH : INFERENCE_COLOR_X;
    const colorY = bothSnapped ? INFERENCE_COLOR_BOTH : INFERENCE_COLOR_Y;

    if (snapX) {
      const xPx = snapX.v * s;
      drawInferenceV(layer, xPx, 0, 10000, colorX, snapX.label);
      drawSnapSquare(layer, xPx, cyPx, colorX);
    }

    if (snapY) {
      const yPx = snapY.v * s;
      drawInferenceH(layer, yPx, 0, 10000, colorY, snapY.label);
      drawSnapSquare(layer, cxPx, yPx, colorY);
    }

    if (snapX && snapY) {
      const xPx = snapX.v * s;
      const yPx = snapY.v * s;
      drawSnapDot(layer, xPx, yPx, INFERENCE_COLOR_BOTH);
    }
  }

  // ──────────────────────────────────────────────────────────
  // PATCH: intercept onRoomDrag / onWallDrag to add inference
  // We monkey-patch the original functions after the page loads.
  // ──────────────────────────────────────────────────────────
  function initSnapEngine() {
    const win = window;

    // ── ROOM DRAG PATCH ──
    if (typeof win.onRoomDrag === 'function') {
      const _origRoomDrag = win.onRoomDrag;
      win.onRoomDrag = function(e) {
        // Run original first (it updates rm.x, rm.y)
        _origRoomDrag(e);
        try {
          const st = win.state;
          if (!st || !win.roomDragState) return;
          const rm = st.rooms.find(r => r.id === win.roomDragState.id);
          if (!rm) return;
          const s = st.scale * st.zoomLevel;
          const pt = win.svgPoint ? win.svgPoint(e) : null;
          if (!pt) return;

          // Current raw position after original handler
          const rawX = rm.x;
          const rawY = rm.y;

          const { xTargets, yTargets } = collectSnapTargets(rm.id, null);

          // Try snapping left edge, center, right edge against all X targets
          let bestXDist = SNAP_THRESHOLD_FT, snapX = null, snapXOffset = 0;
          const candidatesX = [
            { v: rawX,           offset: 0 },
            { v: rawX + rm.w/2,  offset: rm.w/2 },
            { v: rawX + rm.w,    offset: rm.w },
          ];
          for (const c of candidatesX) {
            for (const t of xTargets) {
              const d = Math.abs(c.v - t.v);
              if (d < bestXDist) { bestXDist = d; snapX = t; snapXOffset = c.offset; }
            }
          }

          // Try snapping top edge, center, bottom edge against all Y targets
          let bestYDist = SNAP_THRESHOLD_FT, snapY = null, snapYOffset = 0;
          const candidatesY = [
            { v: rawY,           offset: 0 },
            { v: rawY + rm.d/2,  offset: rm.d/2 },
            { v: rawY + rm.d,    offset: rm.d },
          ];
          for (const c of candidatesY) {
            for (const t of yTargets) {
              const d = Math.abs(c.v - t.v);
              if (d < bestYDist) { bestYDist = d; snapY = t; snapYOffset = c.offset; }
            }
          }

          // Apply snap: override rm.x / rm.y so the room actually locks
          if (snapX) rm.x = snapX.v - snapXOffset;
          if (snapY) rm.y = snapY.v - snapYOffset;

          // Re-render so the room SVG reflects the snapped position
          if (typeof win.render === 'function') win.render();

          // Render inference lines from room center
          const roomCx = rm.x + rm.w / 2;
          const roomCy = rm.y + rm.d / 2;
          renderInference(roomCx, roomCy, snapX, snapY, s);
        } catch(err) {}
      };
    }

    // ── WALL DRAG PATCH ──
    if (typeof win.onWallDrag === 'function') {
      const _origWallDrag = win.onWallDrag;
      win.onWallDrag = function(e) {
        _origWallDrag(e);
        try {
          const st = win.state;
          if (!st || !win.wallDragState) return;
          const wall = st.walls.find(w => w.id === win.wallDragState.id);
          if (!wall) return;
          const s = st.scale * st.zoomLevel;

          const { xTargets, yTargets } = collectSnapTargets(null, wall.id);
          let snapX = null, snapY = null;
          let bestX = SNAP_THRESHOLD_FT;
          for (const t of xTargets) {
            const d = Math.abs(wall.x - t.v);
            if (d < bestX) { bestX = d; snapX = t; }
          }
          let bestY = SNAP_THRESHOLD_FT;
          for (const t of yTargets) {
            const d = Math.abs(wall.y - t.v);
            if (d < bestY) { bestY = d; snapY = t; }
          }

          // Apply snap: lock wall center to snapped position
          if (snapX) wall.x = snapX.v;
          if (snapY) wall.y = snapY.v;

          if (typeof win.render === 'function') win.render();
          renderInference(wall.x, wall.y, snapX, snapY, s);
        } catch(err) {}
      };
    }

    // ── BUILDING/STAGE DRAG PATCH ──
    if (typeof win.onDrag === 'function') {
      const _origDrag = win.onDrag;
      win.onDrag = function(e) {
        _origDrag(e);
        try {
          const st = win.state;
          if (!st || !win.dragState) return;
          const s = st.scale * st.zoomLevel;
          const W = st.building.w;
          const D = st.building.d;
          const handle = win.dragState.handle;

          // Show inference lines for the edges being dragged
          const { xTargets, yTargets } = collectSnapTargets(null, null);
          let snapX = null, snapY = null;

          if (handle && handle.includes('right')) {
            let bestX = SNAP_THRESHOLD_FT;
            for (const t of xTargets) {
              if (t.v === 0 || t.v === W) continue; // skip building self
              const d = Math.abs(W - t.v);
              if (d < bestX) { bestX = d; snapX = t; }
            }
          }
          if (handle && handle.includes('bottom')) {
            let bestY = SNAP_THRESHOLD_FT;
            for (const t of yTargets) {
              if (t.v === 0 || t.v === D) continue;
              const d = Math.abs(D - t.v);
              if (d < bestY) { bestY = d; snapY = t; }
            }
          }
          if (handle && handle.includes('stage')) {
            const stX = (W - st.stage.w) / 2;
            const stY = st.backstage + st.stage.d;
            let bestX = SNAP_THRESHOLD_FT;
            for (const t of xTargets) {
              const d = Math.abs(stX - t.v);
              if (d < bestX) { bestX = d; snapX = t; }
            }
            let bestY = SNAP_THRESHOLD_FT;
            for (const t of yTargets) {
              const d = Math.abs(stY - t.v);
              if (d < bestY) { bestY = d; snapY = t; }
            }
            renderInference(W/2, stY, snapX, snapY, s);
            return;
          }

          renderInference(W, D, snapX, snapY, s);
        } catch(err) {}
      };
    }

    // ── CLEAR INFERENCE LINES on drag end ──
    const clearOnEnd = () => { setTimeout(clearSnapLayer, 60); };

    if (typeof win.endRoomDrag === 'function') {
      const _orig = win.endRoomDrag;
      win.endRoomDrag = function(e) { _orig(e); clearOnEnd(); };
    }
    if (typeof win.endWallDrag === 'function') {
      const _orig = win.endWallDrag;
      win.endWallDrag = function(e) { _orig(e); clearOnEnd(); };
    }
    if (typeof win.endDrag === 'function') {
      const _orig = win.endDrag;
      win.endDrag = function(e) { _orig(e); clearOnEnd(); };
    }

    // ── CLEAR INFERENCE LINES when render() is called (view change, rebuild) ──
    // The original render() rebuilds svg.innerHTML which wipes our layer.
    // We patch render() to re-attach the layer after each redraw.
    if (typeof win.render === 'function') {
      const _origRender = win.render;
      win.render = function() {
        _origRender.apply(this, arguments);
        // Re-create the snap layer (svg.innerHTML was replaced)
        getOrCreateSnapLayer();
      };
    }

    // ── SUPPRESS inference lines during measure tool ──
    // When the measure tool is active the user is clicking on the canvas to
    // place measure endpoints.  The snap-engine inference crosshairs appear
    // because mousemove fires and our patched drag handlers still run.
    // We patch the measure mousemove / mousedown handlers to clear the snap
    // layer immediately so they never show during measurement.
    const measureBtn = document.getElementById('tool-measure');
    if (measureBtn) {
      measureBtn.addEventListener('click', () => {
        // Give the venue time to activate the tool, then watch for the flag
        const checkInterval = setInterval(() => {
          // The venue typically sets window.activeTool or a measure flag
          const active = window.activeTool === 'measure'
            || window.measureMode === true
            || (document.getElementById('tool-measure') && document.getElementById('tool-measure').classList.contains('active'));
          if (active) {
            clearInterval(checkInterval);
            // Patch SVG mousemove to suppress snap layer during measure
            const svg = document.getElementById('venue-svg');
            if (svg && !svg._snapMeasurePatch) {
              svg._snapMeasurePatch = true;
              svg.addEventListener('mousemove', () => {
                const stillMeasuring = window.activeTool === 'measure'
                  || window.measureMode === true
                  || (document.getElementById('tool-measure') && document.getElementById('tool-measure').classList.contains('active'));
                if (stillMeasuring) clearSnapLayer();
              }, true); // capture phase — runs before other listeners
            }
          }
        }, 100);
        // Stop checking after 3s regardless
        setTimeout(() => clearInterval(checkInterval), 3000);
      });
    }

    // Also: always clear snap layer on any SVG click when measure is active
    const svg = document.getElementById('venue-svg');
    if (svg) {
      svg.addEventListener('mousedown', () => {
        const measuring = window.activeTool === 'measure'
          || window.measureMode === true
          || (document.getElementById('tool-measure') && document.getElementById('tool-measure').classList.contains('active'));
        if (measuring) clearSnapLayer();
      }, true);
    }

    win.__snapEngine = { applySnap, collectSnapTargets, renderInference, clearSnapLayer };

    console.log('[SnapEngine] Initialized — inference lines active');
  }
})();
</script>
`;