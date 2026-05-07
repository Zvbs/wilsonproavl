// Bottom toolbar injected into the VenueDims iframe.
// Provides Undo, Redo, and Measure Clear buttons only.

export const DRAW_TOOLS_JS = `
<script id="draw-tools-engine">
(function() {
  window.addEventListener('load', function() {
    setTimeout(initToolbar, 400);
  });

  const TOOLBAR_ID = 'draw-tools-toolbar';

  // ── Nuke all measure SVG elements + reset venue measure state ──
  function nukeAllMeasureElements() {
    const svg = document.getElementById('venue-svg');
    if (!svg) return;
    svg.querySelectorAll('[data-measure], .measure-line, .measure-label, [id^="meas-"], [class*="measure"]').forEach(el => el.remove());
    const measureLayer = svg.querySelector('#measure-layer') || svg.querySelector('[id*="measure"]');
    if (measureLayer) measureLayer.innerHTML = '';
    if (typeof window.measurePoints !== 'undefined') window.measurePoints = [];
    if (typeof window.measureActive !== 'undefined') window.measureActive = false;
    if (typeof window.setTool === 'function') window.setTool('select');
  }

  function patchMeasureControls() {
    const measureClear = document.getElementById('measure-clear');
    const measureBtn   = document.getElementById('tool-measure');

    if (measureClear) {
      measureClear.style.display = '';
      measureClear.style.removeProperty('display');
      measureClear.onclick = null;
      measureClear.addEventListener('click', (e) => {
        e.stopPropagation();
        const origClear = window._origClearMeasurements || window.clearMeasurements;
        if (typeof origClear === 'function') origClear();
        nukeAllMeasureElements();
        setTimeout(() => { measureClear.style.display = ''; }, 50);
      }, true);
    }

    if (!window._origClearMeasurements && typeof window.clearMeasurements === 'function') {
      window._origClearMeasurements = window.clearMeasurements;
    }
    window.clearMeasurements = function() {
      if (typeof window._origClearMeasurements === 'function') window._origClearMeasurements();
      nukeAllMeasureElements();
    };

    if (measureBtn) {
      measureBtn.addEventListener('click', () => {
        setTimeout(() => { if (measureClear) measureClear.style.display = ''; }, 50);
      });
    }
  }

  function buildToolbar() {
    if (document.getElementById(TOOLBAR_ID)) return;

    // Wait for header-actions to exist, then inject into it
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    function makeBtn(html, title, onClick) {
      const btn = document.createElement('button');
      btn.style.cssText = 'background:transparent;border:1px solid #3a3f42;border-radius:6px;color:#7a8892;padding:5px 12px;font-size:12px;cursor:pointer;font-family:Inter,sans-serif;font-weight:600;display:flex;align-items:center;gap:4px;';
      btn.innerHTML = html;
      btn.title = title;
      btn.addEventListener('click', onClick);
      return btn;
    }

    const wrap = document.createElement('div');
    wrap.id = TOOLBAR_ID;
    wrap.style.cssText = 'display:flex;align-items:center;gap:4px;';

    wrap.appendChild(makeBtn('<span>↩</span><span style="font-size:10px;">Undo</span>', 'Undo', () => {
      const orig = document.getElementById('btn-undo');
      if (orig) orig.click(); else if (typeof window.undo === 'function') window.undo();
    }));

    wrap.appendChild(makeBtn('<span>↪</span><span style="font-size:10px;">Redo</span>', 'Redo', () => {
      const orig = document.getElementById('btn-redo');
      if (orig) orig.click(); else if (typeof window.redo === 'function') window.redo();
    }));

    // Insert at the beginning of the header actions
    headerActions.insertBefore(wrap, headerActions.firstChild);
  }

  function initToolbar() {
    const svg = document.getElementById('venue-svg');
    if (!svg || !document.querySelector('.header-actions')) { setTimeout(initToolbar, 300); return; }

    buildToolbar();

    const tryPatch = () => {
      if (document.querySelector('aside')) {
        patchMeasureControls();
      } else {
        setTimeout(tryPatch, 300);
      }
    };
    tryPatch();

    console.log('[Toolbar] Initialized');
  }
})();
</script>
`;