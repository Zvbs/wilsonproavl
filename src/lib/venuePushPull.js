// SketchUp-style Push/Pull Tool
// Injected into VenueDims iframe. Reads shapes from the draw-tools engine
// (window.__drawShapes) and lets the user click a rect/circle shape then
// drag to set an extrusion height, showing a live 3D isometric preview.
// On release it renders the extruded object as a persistent isometric SVG group.

export const PUSH_PULL_JS = `
<script id="push-pull-engine">
(function() {
  window.addEventListener('load', function() { setTimeout(initPushPull, 600); });

  const PP_LAYER_ID  = 'pushpull-layer';
  const PP_COLOR_TOP  = 'rgba(74,158,255,0.18)';
  const PP_COLOR_FACE = 'rgba(74,158,255,0.10)';
  const PP_STROKE     = '#4a9eff';
  const PP_STROKE_DIM = '#1e5fb8';
  const GRID_SNAP     = 0.5; // ft

  // All extruded objects { id, shape, heightFt, svgEls[] }
  let extrudedObjects = [];
  let ppActive = false;   // is push/pull tool active?
  let hoveredShapeId = null;
  let dragging = false;
  let dragStartY = 0;    // screen Y at drag start
  let dragShape  = null; // shape being extruded
  let liveHeight = 0;    // ft, live during drag

  // ── helpers shared with draw engine ──
  function getBaseScale() {
    const st = window.state;
    if (!st) return 8;
    return (st.scale || 8); // NO zoom — SVG viewBox handles zoom
  }
  function getScale() {
    const st = window.state;
    if (!st) return 8;
    return (st.scale || 8) * (st.zoomLevel || 1);
  }
  function snapFt(v) { return Math.round(v / GRID_SNAP) * GRID_SNAP; }
  function ftToSvg(ft) { const s = getBaseScale(); return { x: ft.x * s, y: ft.y * s }; }
  function getSvgPoint(e) {
    const svg = document.getElementById('venue-svg');
    if (!svg) return { x: 0, y: 0 };
    if (window.svgPoint) return window.svgPoint(e);
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      x: (e.clientX - rect.left) * (vb.width  / rect.width)  + vb.x,
      y: (e.clientY - rect.top)  * (vb.height / rect.height) + vb.y,
    };
  }

  // ── Layer ──
  function getOrCreatePPLayer() {
    const svg = document.getElementById('venue-svg');
    if (!svg) return null;
    let layer = document.getElementById(PP_LAYER_ID);
    if (!layer) {
      layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.id = PP_LAYER_ID;
      svg.appendChild(layer);
    }
    return layer;
  }

  function ensurePPLayer() {
    const svg = document.getElementById('venue-svg');
    if (!svg) return null;
    if (!document.getElementById(PP_LAYER_ID)) {
      const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.id = PP_LAYER_ID;
      svg.appendChild(layer);
      redrawExtruded();
    }
    return document.getElementById(PP_LAYER_ID);
  }

  // ── Isometric projection ──
  // We use a simple cabinet oblique: right+up at 30° for depth, scale 0.5
  // heightFt maps to vertical offset in SVG (upward = negative Y)
  // depthFt  maps to oblique offset (x+, y-)
  const ISO_ANGLE = 30 * Math.PI / 180;
  const ISO_SCALE = 0.5;

  function isoOffset(depthPx) {
    // Used for "depth into screen" — mapped as oblique going top-right
    return {
      dx:  depthPx * Math.cos(ISO_ANGLE) * ISO_SCALE,
      dy: -depthPx * Math.sin(ISO_ANGLE) * ISO_SCALE,
    };
  }

  // Convert heightFt to SVG pixels (vertical lift)
  function heightToPx(hFt) { return hFt * getScale(); }

  // ── Build extruded SVG group for a shape+height ──
  function buildExtrudedGroup(shape, heightFt) {
    const s = getBaseScale();
    const hPx = heightToPx(heightFt);
    const { dx: odx, dy: ody } = isoOffset(hPx);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-extruded', shape.id);

    if (shape.type === 'rect') {
      const x1 = Math.min(shape.a.x, shape.b.x) * s;
      const y1 = Math.min(shape.a.y, shape.b.y) * s;
      const x2 = Math.max(shape.a.x, shape.b.x) * s;
      const y2 = Math.max(shape.a.y, shape.b.y) * s;
      const w  = x2 - x1, h = y2 - y1;

      // Bottom face (2D footprint, brightened)
      const base = makeSvgRect(x1, y1, w, h, PP_COLOR_TOP, PP_STROKE, 2, 'none');
      g.appendChild(base);

      // Left side face (x=x1 vertical edge lifted)
      const leftFace = makeSvgPoly([
        [x1,       y1], [x1,       y2],
        [x1 + odx, y2 + ody], [x1 + odx, y1 + ody],
      ], PP_COLOR_FACE, PP_STROKE_DIM, 1);
      g.appendChild(leftFace);

      // Front side face (y=y2 edge lifted)
      const frontFace = makeSvgPoly([
        [x1,       y2], [x2,       y2],
        [x2 + odx, y2 + ody], [x1 + odx, y2 + ody],
      ], PP_COLOR_FACE, PP_STROKE_DIM, 1);
      g.appendChild(frontFace);

      // Top face (offset copy)
      const topFace = makeSvgRect(x1 + odx, y1 + ody, w, h, PP_COLOR_TOP, PP_STROKE, 2, 'none');
      g.appendChild(topFace);

      // Right side face (x=x2 edge)
      const rightFace = makeSvgPoly([
        [x2,       y1], [x2,       y2],
        [x2 + odx, y2 + ody], [x2 + odx, y1 + ody],
      ], PP_COLOR_FACE, PP_STROKE_DIM, 1);
      g.appendChild(rightFace);

      // Vertical edge lines
      [[x1,y1],[x1,y2],[x2,y1],[x2,y2]].forEach(([ex,ey]) => {
        const line = makeSvgLine(ex, ey, ex + odx, ey + ody, PP_STROKE_DIM, 1);
        g.appendChild(line);
      });

      // Height dimension label on front edge
      const dimEl = makeDimText(
        x1 + (x2-x1)/2 + odx/2 + 6,
        y2 + ody/2 - 6,
        heightFt.toFixed(1) + ' ft'
      );
      g.appendChild(dimEl);

    } else if (shape.type === 'circle') {
      const cSvg  = ftToSvg(shape.c);
      const eSvg  = ftToSvg(shape.edge);
      const r     = Math.hypot(eSvg.x - cSvg.x, eSvg.y - cSvg.y);

      // Bottom circle
      g.appendChild(makeSvgEllipse(cSvg.x, cSvg.y, r, r, PP_COLOR_TOP, PP_STROKE, 2));

      // Top circle (offset)
      g.appendChild(makeSvgEllipse(cSvg.x + odx, cSvg.y + ody, r, r, PP_COLOR_TOP, PP_STROKE, 2));

      // Cylinder side lines (4 tangent lines)
      [-1, 1].forEach(side => {
        g.appendChild(makeSvgLine(
          cSvg.x + side * r, cSvg.y,
          cSvg.x + side * r + odx, cSvg.y + ody,
          PP_STROKE_DIM, 1
        ));
      });

      const dimEl = makeDimText(cSvg.x + r + odx + 6, cSvg.y + ody - 6, heightFt.toFixed(1) + ' ft');
      g.appendChild(dimEl);
    }
    // Lines can't really be extruded into a volume meaningfully — skip
    return g;
  }

  // ── SVG primitive builders ──
  function makeSvgRect(x, y, w, h, fill, stroke, sw, dasharray) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('width', w); el.setAttribute('height', h);
    el.setAttribute('fill', fill); el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', sw);
    if (dasharray && dasharray !== 'none') el.setAttribute('stroke-dasharray', dasharray);
    return el;
  }

  function makeSvgPoly(pts, fill, stroke, sw) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    el.setAttribute('points', pts.map(p => p[0]+','+p[1]).join(' '));
    el.setAttribute('fill', fill); el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', sw);
    return el;
  }

  function makeSvgLine(x1, y1, x2, y2, stroke, sw) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('x1', x1); el.setAttribute('y1', y1);
    el.setAttribute('x2', x2); el.setAttribute('y2', y2);
    el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', sw);
    return el;
  }

  function makeSvgEllipse(cx, cy, rx, ry, fill, stroke, sw) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    el.setAttribute('cx', cx); el.setAttribute('cy', cy);
    el.setAttribute('rx', rx); el.setAttribute('ry', ry);
    el.setAttribute('fill', fill); el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', sw);
    return el;
  }

  function makeDimText(x, y, text) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('fill', '#4a9eff');
    el.setAttribute('font-size', '9');
    el.setAttribute('font-family', 'JetBrains Mono, monospace');
    el.setAttribute('font-weight', '600');
    el.textContent = text;
    return el;
  }

  // ── Redraw all extruded objects ──
  function redrawExtruded() {
    const layer = getOrCreatePPLayer();
    if (!layer) return;
    Array.from(layer.querySelectorAll('[data-extruded]')).forEach(el => el.remove());
    extrudedObjects.forEach(obj => {
      const g = buildExtrudedGroup(obj.shape, obj.heightFt);
      layer.appendChild(g);
    });
  }

  // ── Hover highlight ──
  function highlightShape(shapeId, on) {
    const layer = document.getElementById('draw-tools-layer');
    if (!layer) return;
    const el = layer.querySelector('[data-shape-id="' + shapeId + '"]');
    if (!el) return;
    if (on) {
      el.setAttribute('stroke', '#f0a040');
      el.setAttribute('stroke-width', '3');
      el.setAttribute('filter', 'drop-shadow(0 0 4px #f0a040)');
    } else {
      // Restore by type
      const shape = getShapeById(shapeId);
      if (!shape) return;
      const colors = { rect: '#3dd68c', circle: '#f0a040', line: '#4a9eff' };
      el.setAttribute('stroke', colors[shape.type] || '#4a9eff');
      el.setAttribute('stroke-width', '2');
      el.removeAttribute('filter');
    }
  }

  function getShapes() { return (window.__drawShapes) || []; }
  function getShapeById(id) { return getShapes().find(s => s.id == id) || null; }

  // ── Hit test: which extrudable shape is under cursor? ──
  function hitTestShape(svgPt) {
    const shapes = getShapes().filter(s => s.type === 'rect' || s.type === 'circle');
    const s = getBaseScale(); // use base scale — svgPt is in viewBox coords
    for (const shape of shapes) {
      if (shape.type === 'rect') {
        const x1 = Math.min(shape.a.x, shape.b.x) * s;
        const y1 = Math.min(shape.a.y, shape.b.y) * s;
        const x2 = Math.max(shape.a.x, shape.b.x) * s;
        const y2 = Math.max(shape.a.y, shape.b.y) * s;
        if (svgPt.x >= x1 && svgPt.x <= x2 && svgPt.y >= y1 && svgPt.y <= y2) return shape;
      } else if (shape.type === 'circle') {
        const cSvg = ftToSvg(shape.c);
        const eSvg = ftToSvg(shape.edge);
        const r = Math.hypot(eSvg.x - cSvg.x, eSvg.y - cSvg.y);
        if (Math.hypot(svgPt.x - cSvg.x, svgPt.y - cSvg.y) <= r) return shape;
      }
    }
    return null;
  }

  // ── Live extrusion preview during drag ──
  function renderLiveExtrusion(shape, heightFt) {
    const layer = getOrCreatePPLayer();
    if (!layer) return;
    // Remove any previous live preview
    const prev = layer.querySelector('[data-pp-live]');
    if (prev) prev.remove();
    if (heightFt <= 0) return;
    const g = buildExtrudedGroup(shape, heightFt);
    g.setAttribute('data-pp-live', 'true');
    g.setAttribute('opacity', '0.7');
    layer.appendChild(g);
  }

  // ── Helper: make a labelled number input row ──
  function makeNumField(labelTxt, val, min, max, step) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;font-weight:700;letter-spacing:0.8px;color:#4a5a65;text-transform:uppercase;';
    lbl.textContent = labelTxt;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = min; inp.max = max; inp.step = step;
    inp.value = parseFloat(val).toFixed(2);
    inp.style.cssText = 'background:#1a1d1e;border:1px solid #3a3f42;border-radius:6px;color:#e2e6e8;font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600;padding:5px 8px;width:80px;text-align:right;outline:none;';
    inp.addEventListener('focus', () => { inp.style.borderColor = '#4a9eff'; });
    inp.addEventListener('blur',  () => { inp.style.borderColor = '#3a3f42'; });
    wrap.appendChild(lbl); wrap.appendChild(inp);
    return { wrap, inp };
  }

  // ── Height + Position dialog (shown after drag) ──
  function showHeightDialog(shape, suggestedHeight, onConfirm, onCancel) {
    const existing = document.getElementById('pp-height-dialog');
    if (existing) existing.remove();

    // Compute default position from shape footprint
    let defX = 0, defZ = 0;
    if (shape.type === 'rect') {
      defX = (Math.min(shape.a.x, shape.b.x) + Math.max(shape.a.x, shape.b.x)) / 2;
      defZ = (Math.min(shape.a.y, shape.b.y) + Math.max(shape.a.y, shape.b.y)) / 2;
    } else if (shape.type === 'circle') {
      defX = shape.c.x; defZ = shape.c.y;
    }

    const dlg = document.createElement('div');
    dlg.id = 'pp-height-dialog';
    dlg.style.cssText = \`
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: #232729; border: 1px solid #3a3f42;
      border-radius: 10px; padding: 20px 24px;
      z-index: 99999; box-shadow: 0 8px 40px rgba(0,0,0,0.7);
      font-family: Inter, sans-serif; min-width: 300px; color: #e2e6e8;
    \`;

    const title = document.createElement('div');
    title.style.cssText = 'font-size:12px;font-weight:600;color:#e2e6e8;margin-bottom:4px;';
    title.textContent = '↕ Push / Pull — Extrude & Place';
    dlg.appendChild(title);

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:10px;color:#4a5a65;margin-bottom:14px;';
    sub.textContent = (shape.type === 'circle' ? 'Cylinder' : 'Box') + ' extrusion — set height and 3D position (ft)';
    dlg.appendChild(sub);

    // Height row
    const heightSection = document.createElement('div');
    heightSection.style.cssText = 'margin-bottom:14px;';
    const hLbl = document.createElement('div');
    hLbl.style.cssText = 'font-size:9px;font-weight:700;letter-spacing:0.8px;color:#4a5a65;text-transform:uppercase;margin-bottom:6px;';
    hLbl.textContent = 'Height';
    heightSection.appendChild(hLbl);
    const hRow = document.createElement('div');
    hRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const hInp = document.createElement('input');
    hInp.type='number'; hInp.min='0.5'; hInp.max='200'; hInp.step='0.5';
    hInp.value = suggestedHeight.toFixed(1);
    hInp.style.cssText = 'background:#1a1d1e;border:1px solid #4a9eff;border-radius:6px;color:#e2e6e8;font-family:JetBrains Mono,monospace;font-size:13px;font-weight:600;padding:6px 10px;width:90px;text-align:right;outline:none;';
    const hUnit = document.createElement('span');
    hUnit.style.cssText = 'font-size:11px;color:#7a8892;';
    hUnit.textContent = 'ft';
    hRow.appendChild(hInp); hRow.appendChild(hUnit);
    heightSection.appendChild(hRow);
    dlg.appendChild(heightSection);

    // Position row X Y(elevation) Z
    const posSection = document.createElement('div');
    posSection.style.cssText = 'margin-bottom:18px;';
    const posLbl = document.createElement('div');
    posLbl.style.cssText = 'font-size:9px;font-weight:700;letter-spacing:0.8px;color:#4a5a65;text-transform:uppercase;margin-bottom:6px;';
    posLbl.textContent = '3D Position (ft)';
    posSection.appendChild(posLbl);
    const posRow = document.createElement('div');
    posRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';

    const xF = makeNumField('X (left/right)', defX, -9999, 9999, 0.5);
    const yF = makeNumField('Y (elevation)',  0,    -9999, 9999, 0.5);
    const zF = makeNumField('Z (front/back)', defZ, -9999, 9999, 0.5);
    posRow.appendChild(xF.wrap); posRow.appendChild(yF.wrap); posRow.appendChild(zF.wrap);
    posSection.appendChild(posRow);
    dlg.appendChild(posSection);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'background:transparent;border:1px solid #3a3f42;border-radius:6px;color:#7a8892;padding:6px 14px;font-size:11px;cursor:pointer;font-family:Inter,sans-serif;';
    cancelBtn.addEventListener('click', () => { dlg.remove(); onCancel(); });

    const okBtn = document.createElement('button');
    okBtn.textContent = 'Extrude ↑';
    okBtn.style.cssText = 'background:#4a9eff;border:1px solid #4a9eff;border-radius:6px;color:white;padding:6px 14px;font-size:11px;cursor:pointer;font-family:Inter,sans-serif;font-weight:600;';
    okBtn.addEventListener('click', () => {
      const h = parseFloat(hInp.value);
      const px = parseFloat(xF.inp.value);
      const py = parseFloat(yF.inp.value);
      const pz = parseFloat(zF.inp.value);
      if (!isNaN(h) && h > 0) {
        dlg.remove();
        onConfirm(h, { x: px, y: py, z: pz });
      }
    });

    hInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') okBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });

    btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn);
    dlg.appendChild(btnRow);
    document.body.appendChild(dlg);
    hInp.focus(); hInp.select();
  }

  // ── Mouse events ──
  function onMouseMove(e) {
    if (!ppActive) return;
    const svgPt = getSvgPoint(e);

    if (dragging && dragShape) {
      // Height from vertical mouse delta (upward = positive height)
      const deltaY = dragStartY - e.clientY; // px on screen
      const s = getScale();
      const rawH = Math.max(0, deltaY / s);
      liveHeight = snapFt(Math.max(0.5, rawH));
      renderLiveExtrusion(dragShape, liveHeight);
      // Update cursor label
      setSvgCursor('ns-resize');
      return;
    }

    // Hover hit test
    const hit = hitTestShape(svgPt);
    const newId = hit ? hit.id : null;
    if (newId !== hoveredShapeId) {
      if (hoveredShapeId) highlightShape(hoveredShapeId, false);
      if (newId)          highlightShape(newId, true);
      hoveredShapeId = newId;
      setSvgCursor(newId ? 'ns-resize' : 'default');
    }
  }

  function onMouseDown(e) {
    if (!ppActive || e.button !== 0) return;
    const svgPt = getSvgPoint(e);
    const hit = hitTestShape(svgPt);
    if (!hit) return;
    dragging = true;
    dragShape = hit;
    dragStartY = e.clientY;
    liveHeight = 0;
    e.stopPropagation(); e.preventDefault();
  }

  function onMouseUp(e) {
    if (!ppActive || !dragging) return;
    dragging = false;
    // Remove live preview
    const layer = getOrCreatePPLayer();
    if (layer) { const prev = layer.querySelector('[data-pp-live]'); if (prev) prev.remove(); }

    const shape = dragShape;
    const suggested = Math.max(1, liveHeight);
    dragShape = null;

    // Show confirmation dialog
    showHeightDialog(shape, suggested,
      (heightFt, posOffset) => {
        // Remove existing extrusion for this shape (re-extrude replaces it)
        extrudedObjects = extrudedObjects.filter(o => o.shape.id !== shape.id);
        extrudedObjects.push({ id: Date.now(), shape, heightFt, posOffset });
        redrawExtruded();
        syncThreeMeshes();
      },
      () => { redrawExtruded(); }
    );
  }

  // ── THREE.JS CAPTURE — intercept WebGLRenderer & Scene construction ──
  // This runs before initPushPull so we catch the venue's Three objects
  // the moment they are created, regardless of whether they are globals.
  function installThreeInterceptors() {
    if (window._ppThreeIntercepted) return;
    window._ppThreeIntercepted = true;

    function tryIntercept() {
      const THREE = window.THREE;
      if (!THREE) { setTimeout(tryIntercept, 100); return; }

      // Intercept WebGLRenderer
      const _OrigRenderer = THREE.WebGLRenderer;
      THREE.WebGLRenderer = function(params) {
        const inst = new _OrigRenderer(params);
        window._ppRenderer = inst;
        console.log('[PushPull] Captured WebGLRenderer');
        return inst;
      };
      THREE.WebGLRenderer.prototype = _OrigRenderer.prototype;

      // Intercept Scene
      const _OrigScene = THREE.Scene;
      THREE.Scene = function() {
        const inst = new _OrigScene();
        window._ppScene = inst;
        console.log('[PushPull] Captured Scene');
        return inst;
      };
      THREE.Scene.prototype = _OrigScene.prototype;

      // Intercept PerspectiveCamera
      const _OrigCam = THREE.PerspectiveCamera;
      THREE.PerspectiveCamera = function(fov, aspect, near, far) {
        const inst = new _OrigCam(fov, aspect, near, far);
        window._ppCamera = inst;
        return inst;
      };
      THREE.PerspectiveCamera.prototype = _OrigCam.prototype;
    }
    tryIntercept();
  }
  installThreeInterceptors();

  function findThree() {
    // Prefer intercepted references
    if (window._ppScene)    window.threeScene    = window._ppScene;
    if (window._ppRenderer) window.threeRenderer = window._ppRenderer;
    if (window._ppCamera)   window.threeCamera   = window._ppCamera;
    if (window.threeScene)  return;

    // Fallback: scan globals
    for (const k of Object.keys(window)) {
      try {
        const v = window[k];
        if (!v || typeof v !== 'object') continue;
        if (v.isScene)      window.threeScene    = v;
        if (v.isWebGLRenderer) window.threeRenderer = v;
        if (v.isCamera || v.isPerspectiveCamera || v.isOrthographicCamera) window.threeCamera = v;
      } catch(e) {}
    }
  }

  function syncThreeMeshes() {
    findThree();
    if (!window.THREE || !window.threeScene) {
      console.warn('[PushPull] syncThreeMeshes: no scene found');
      return;
    }
    const THREE = window.THREE;
    const scene = window.threeScene;
    const camera = window.threeCamera;
    const renderer = window.threeRenderer;

    // Remove old sketch meshes
    const toRemove = [];
    scene.traverse(obj => {
      if (obj.userData && obj.userData.sketchExtruded) toRemove.push(obj);
    });
    toRemove.forEach(obj => {
      if (obj.geometry) obj.geometry.dispose();
      scene.remove(obj);
    });

    // Track bounding box across all extruded objects for auto-focus
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    extrudedObjects.forEach(obj => {
      const { shape, heightFt, posOffset } = obj;
      // posOffset.x/y/z override center position if provided
      const po = posOffset || {};
      let mesh;

      if (shape.type === 'rect') {
        const x1 = Math.min(shape.a.x, shape.b.x);
        const z1 = Math.min(shape.a.y, shape.b.y);
        const x2 = Math.max(shape.a.x, shape.b.x);
        const z2 = Math.max(shape.a.y, shape.b.y);
        const w = x2 - x1, d = z2 - z1;
        const cx = po.x !== undefined ? po.x : (x1 + w / 2);
        const cy = po.y !== undefined ? po.y + heightFt / 2 : heightFt / 2;
        const cz = po.z !== undefined ? po.z : (z1 + d / 2);

        minX = Math.min(minX, cx - w/2); maxX = Math.max(maxX, cx + w/2);
        minY = Math.min(minY, cy - heightFt/2); maxY = Math.max(maxY, cy + heightFt/2);
        minZ = Math.min(minZ, cz - d/2); maxZ = Math.max(maxZ, cz + d/2);

        const geo = new THREE.BoxGeometry(w, heightFt, d);
        const mat = new THREE.MeshPhongMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx, cy, cz);
        mesh.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({ color: 0x88ccff })
        ));
      } else if (shape.type === 'circle') {
        const r  = Math.hypot(shape.edge.x - shape.c.x, shape.edge.y - shape.c.y);
        const cx = po.x !== undefined ? po.x : shape.c.x;
        const cy = po.y !== undefined ? po.y + heightFt / 2 : heightFt / 2;
        const cz = po.z !== undefined ? po.z : shape.c.y;

        minX = Math.min(minX, cx - r); maxX = Math.max(maxX, cx + r);
        minY = Math.min(minY, cy - heightFt/2); maxY = Math.max(maxY, cy + heightFt/2);
        minZ = Math.min(minZ, cz - r); maxZ = Math.max(maxZ, cz + r);

        const geo = new THREE.CylinderGeometry(r, r, heightFt, 32);
        const mat = new THREE.MeshPhongMaterial({ color: 0xf0a040, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx, cy, cz);
        mesh.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({ color: 0xffcc88 })
        ));
      }

      if (mesh) {
        mesh.userData.sketchExtruded = true;
        scene.add(mesh);
      }
    });

    // ── Auto-focus camera on extruded objects ──
    if (camera && extrudedObjects.length > 0 && minX !== Infinity) {
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const sizeX = maxX - minX;
      const sizeY = maxY - minY;
      const sizeZ = maxZ - minZ;
      const maxSize = Math.max(sizeX, sizeY, sizeZ, 1);

      // Fix near/far clipping planes to prevent clipping on zoom-in
      if (camera.isPerspectiveCamera) {
        camera.near = Math.max(0.01, maxSize * 0.001);
        camera.far  = Math.max(10000, maxSize * 200);
        camera.updateProjectionMatrix();
      }

      // Position camera to frame the bounding box from an isometric-ish angle
      const fov    = (camera.fov || 45) * (Math.PI / 180);
      const aspect = (camera.aspect || 1);
      const fitDist = (maxSize / 2) / Math.tan(fov / 2) * 1.6;

      camera.position.set(
        centerX + fitDist * 0.7,
        centerY + fitDist * 0.6,
        centerZ + fitDist * 0.7
      );
      camera.lookAt(centerX, centerY, centerZ);

      // If controls exist (OrbitControls), update their target
      const ctrl = window.controls || window.orbitControls || window.cameraControls || window._controls;
      if (ctrl && ctrl.target) {
        ctrl.target.set(centerX, centerY, centerZ);
        if (typeof ctrl.update === 'function') ctrl.update();
      }
    }

    // Force a render frame
    if (renderer && camera) {
      renderer.render(scene, camera);
    }
  }

  // ── Patch the venue's animate loop so our meshes survive re-renders ──
  function patchAnimateLoop() {
    if (window._ppAnimatePatched) return;
    const _origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function(cb) {
      return _origRAF.call(window, function(t) {
        cb(t);
        // Re-inject meshes if the scene cleared them (without re-probing globals)
        if (window.threeScene && extrudedObjects.length) {
          let hasOurs = false;
          window.threeScene.traverse(o => { if (o.userData && o.userData.sketchExtruded) hasOurs = true; });
          if (!hasOurs) {
            // Re-add meshes only — no camera changes, no re-probe
            const THREE = window.THREE;
            extrudedObjects.forEach(obj => {
              const { shape, heightFt, posOffset } = obj;
              const po = posOffset || {};
              let mesh;
              if (shape.type === 'rect') {
                const x1 = Math.min(shape.a.x, shape.b.x), x2 = Math.max(shape.a.x, shape.b.x);
                const z1 = Math.min(shape.a.y, shape.b.y), z2 = Math.max(shape.a.y, shape.b.y);
                const w = x2-x1, d = z2-z1;
                const cx = po.x !== undefined ? po.x : (x1+w/2);
                const cy = po.y !== undefined ? po.y + heightFt/2 : heightFt/2;
                const cz = po.z !== undefined ? po.z : (z1+d/2);
                const geo = new THREE.BoxGeometry(w, heightFt, d);
                mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0x4a9eff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
                mesh.position.set(cx, cy, cz);
                mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x88ccff })));
              } else if (shape.type === 'circle') {
                const r = Math.hypot(shape.edge.x - shape.c.x, shape.edge.y - shape.c.y);
                const cx = po.x !== undefined ? po.x : shape.c.x;
                const cy = po.y !== undefined ? po.y + heightFt/2 : heightFt/2;
                const cz = po.z !== undefined ? po.z : shape.c.y;
                const geo = new THREE.CylinderGeometry(r, r, heightFt, 32);
                mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0xf0a040, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
                mesh.position.set(cx, cy, cz);
                mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffcc88 })));
              }
              if (mesh) { mesh.userData.sketchExtruded = true; window.threeScene.add(mesh); }
            });
          }
        }
      });
    };
    window._ppAnimatePatched = true;
  }

  // ── Toolbar button ──
  let ppBtn = null;
  function addPushPullToToolbar() {
    const toolbar = document.getElementById('draw-tools-toolbar');
    if (!toolbar || document.getElementById('pp-toolbar-btn')) return;

    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px;height:20px;background:#3a3f42;margin:0 4px;';
    toolbar.appendChild(sep);

    const btn = document.createElement('button');
    btn.id = 'pp-toolbar-btn';
    btn.style.cssText = \`
      background: transparent;
      border: 1px solid #3a3f42;
      border-radius: 6px;
      color: #7a8892;
      padding: 5px 10px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.12s;
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 80px;
      justify-content: center;
      font-family: Inter, sans-serif;
    \`;
    btn.innerHTML = '<span>↕</span><span style="font-size:10px;font-weight:500;">Push/Pull</span>';
    btn.title = 'Push/Pull: click a rect/circle shape and drag up to extrude into 3D';
    ppBtn = btn;

    // Hide push/pull button in 3D or Section view
    function updatePPBtnForView() {
      const activeBtn = document.querySelector('.view-toggle button.active');
      const activeTxt = activeBtn ? activeBtn.textContent.trim().toLowerCase() : '';
      const hide = activeTxt.includes('3d') || activeTxt.includes('section');
      btn.style.display = hide ? 'none' : '';
      sep.style.display = hide ? 'none' : '';
    }
    document.querySelectorAll('.view-toggle button').forEach(b => {
      b.addEventListener('click', () => setTimeout(updatePPBtnForView, 50));
    });
    updatePPBtnForView();

    btn.addEventListener('click', () => {
      ppActive = !ppActive;
      if (ppActive) {
        btn.style.background = '#ff6b3522';
        btn.style.borderColor = '#ff6b35';
        btn.style.color = '#ff6b35';
        btn.style.boxShadow = '0 0 0 2px #ff6b3533';
        setSvgCursor('ns-resize');
      } else {
        btn.style.background = 'transparent';
        btn.style.borderColor = '#3a3f42';
        btn.style.color = '#7a8892';
        btn.style.boxShadow = 'none';
        setSvgCursor('default');
        if (hoveredShapeId) { highlightShape(hoveredShapeId, false); hoveredShapeId = null; }
      }
    });

    toolbar.appendChild(btn);
  }

  function setSvgCursor(c) {
    const svg = document.getElementById('venue-svg');
    if (svg) svg.style.cursor = c;
  }

  // ── Patch render ──
  function patchRender() {
    if (typeof window.render === 'function' && !window._ppRenderPatched) {
      const _orig = window.render;
      window.render = function() {
        _orig.apply(this, arguments);
        ensurePPLayer();
      };
      window._ppRenderPatched = true;
    }
  }

  // ── INIT ──
  function initPushPull() {
    const svg = document.getElementById('venue-svg');
    if (!svg) { setTimeout(initPushPull, 500); return; }

    svg.addEventListener('mousemove', onMouseMove, false);
    svg.addEventListener('mousedown', onMouseDown, true);
    svg.addEventListener('mouseup',   onMouseUp,   false);

    getOrCreatePPLayer();

    // Add to the sketch toolbar (may need to wait for it)
    const tryAddBtn = () => {
      if (document.getElementById('draw-tools-toolbar')) {
        addPushPullToToolbar();
      } else {
        setTimeout(tryAddBtn, 200);
      }
    };
    tryAddBtn();

    patchRender();

    // ── Patch the venue's own 3D render/init to discover scene/camera/renderer ──
    // The original app typically exposes these or calls initThree / renderThree.
    // We probe every 500ms until found (max 10s).
    // Probe for Three.js objects repeatedly, then sync
    let threeProbeCount = 0;
    function probeThree() {
      findThree();
      if (window.threeScene) {
        console.log('[PushPull] Three.js scene found — 3D sync enabled');
        if (extrudedObjects.length) syncThreeMeshes();
        // Patch the venue animate loop to keep our meshes alive
        patchAnimateLoop();
      } else if (threeProbeCount++ < 30) {
        setTimeout(probeThree, 500);
      }
    }
    probeThree();

    // Re-sync whenever user clicks view toggle buttons (plan→3D switch).
    // The 3D view may lazy-init its scene AFTER the click, so we poll until found.
    document.addEventListener('click', (e) => {
      // Check if this click is on a view-toggle button
      const isViewBtn = e.target && (
        e.target.closest && e.target.closest('.view-toggle') ||
        (e.target.parentElement && e.target.parentElement.classList && e.target.parentElement.classList.contains('view-toggle'))
      );
      if (!isViewBtn) return; // only act on view-toggle clicks

      // Poll for up to 3 seconds after the click for the 3D scene to appear
      let attempts = 0;
      function trySyncAfterToggle() {
        findThree();
        if (window.threeScene && extrudedObjects.length) {
          syncThreeMeshes();
          patchAnimateLoop();
        } else if (attempts++ < 12) {
          setTimeout(trySyncAfterToggle, 250);
        }
      }
      setTimeout(trySyncAfterToggle, 200);
    }, true);

    console.log('[PushPull] Initialized');
  }
})();
</script>
`;