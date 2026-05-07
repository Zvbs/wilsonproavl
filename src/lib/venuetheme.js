// SketchUp-inspired dark theme CSS injected into the VenueDims iframe
export const SKETCHUP_THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #1a1d1e !important;
  --panel-solid: #232729 !important;
  --border: #3a3f42 !important;
  --grid: #232729 !important;
  --grid-major: #2a3035 !important;
  --ink: #e2e6e8 !important;
  --ink-dim: #7a8892 !important;
  --accent: #4a9eff !important;
  --accent-dim: #1e5fb8 !important;
  --warn: #f0a040 !important;
  --danger: #f05060 !important;
  --stage: #1c2c40 !important;
  --audience: #151a1c !important;
  --foh: #18201e !important;
  --backstage: #151e1c !important;
  --ceiling: #f0a040 !important;
}

html, body {
  font-family: 'Inter', system-ui, sans-serif !important;
  background: #1a1d1e !important;
}

/* Remove the old grid gap background bleed */
body {
  background-color: #3a3f42 !important;
  background-image: none !important;
}

/* ── HEADER ── */
header {
  background: #232729 !important;
  border-bottom: 1px solid #3a3f42 !important;
  padding: 0 14px !important;
  gap: 4px !important;
}

.logo {
  font-family: 'Inter', sans-serif !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  letter-spacing: -0.5px !important;
  color: #4a9eff !important;
}
.logo::before { content: "◈ " !important; color: #4a9eff !important; }

.header-meta {
  font-family: 'Inter', sans-serif !important;
  font-size: 11px !important;
  color: #7a8892 !important;
  letter-spacing: 0 !important;
}

/* View toggle pills */
.view-toggle {
  border: 1px solid #3a3f42 !important;
  border-radius: 20px !important;
  overflow: hidden !important;
  background: #1a1d1e !important;
  padding: 2px !important;
  gap: 1px !important;
}
.view-toggle button {
  border-radius: 16px !important;
  border: none !important;
  border-right: none !important;
  padding: 4px 14px !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 10px !important;
  font-weight: 600 !important;
  letter-spacing: 0.3px !important;
  color: #7a8892 !important;
  background: transparent !important;
  transition: all 0.12s !important;
}
.view-toggle button:hover { color: #e2e6e8 !important; background: transparent !important; }
.view-toggle button.active {
  background: #4a9eff !important;
  color: white !important;
  box-shadow: 0 1px 4px rgba(74,158,255,0.4) !important;
}
.view-toggle button:last-child { border-right: none !important; }

/* Header action buttons */
.header-actions button {
  background: #2b2f31 !important;
  border: 1px solid #3a3f42 !important;
  color: #7a8892 !important;
  border-radius: 6px !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 10px !important;
  font-weight: 500 !important;
  padding: 5px 10px !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
}
.header-actions button:hover {
  border-color: #4a5a65 !important;
  background: #333839 !important;
  color: #e2e6e8 !important;
}
.header-actions button.primary {
  background: #4a9eff !important;
  color: white !important;
  border-color: #4a9eff !important;
  font-weight: 600 !important;
}
.header-actions button.primary:hover { background: #3a8eef !important; }
#btn-undo, #btn-redo { display: none !important; }

/* Autosave indicator */
#autosave-indicator {
  color: #3dd68c !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 10px !important;
  letter-spacing: 0 !important;
}

/* ── ASIDE / PANEL ── */
aside {
  background: #232729 !important;
  border-right: 1px solid #3a3f42 !important;
}
aside::-webkit-scrollbar { width: 4px !important; }
aside::-webkit-scrollbar-thumb { background: #3a3f42 !important; border-radius: 2px !important; }
aside::-webkit-scrollbar-track { background: transparent !important; }

.section { border-bottom: 1px solid #3a3f42 !important; }

.section-title {
  padding: 10px 14px !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  letter-spacing: 0.1px !important;
  color: #e2e6e8 !important;
  text-transform: none !important;
}
.section-title:hover { background: #2b2f31 !important; }
.section-title::before {
  content: "" !important;
  width: 6px !important;
  height: 6px !important;
  border-radius: 50% !important;
  display: inline-block !important;
  margin-right: 8px !important;
  flex-shrink: 0 !important;
}
.section-title::after {
  font-size: 9px !important;
  color: #4a5a65 !important;
  font-family: 'Inter', sans-serif !important;
}

.subsection-title {
  font-family: 'Inter', sans-serif !important;
  font-size: 9px !important;
  font-weight: 700 !important;
  letter-spacing: 0.8px !important;
  color: #4a5a65 !important;
  border-bottom: 1px solid #3a3f42 !important;
  padding-bottom: 4px !important;
  margin: 12px 0 6px !important;
  text-transform: uppercase !important;
}

/* ── FIELDS ── */
.field label {
  font-family: 'Inter', sans-serif !important;
  font-size: 10px !important;
  font-weight: 500 !important;
  color: #7a8892 !important;
  letter-spacing: 0.2px !important;
  text-transform: uppercase !important;
  margin-bottom: 4px !important;
}

.field input, .field select {
  background: #1a1d1e !important;
  border: 1px solid #3a3f42 !important;
  color: #e2e6e8 !important;
  border-radius: 6px !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 11px !important;
  padding: 5px 8px !important;
}
.field input:focus, .field select:focus {
  border-color: #4a9eff !important;
  outline: none !important;
  box-shadow: 0 0 0 2px rgba(74,158,255,0.15) !important;
}

/* ── TOGGLE SWITCHES ── */
.toggle-row {
  font-family: 'Inter', sans-serif !important;
  font-size: 11px !important;
  color: #7a8892 !important;
  padding: 5px 0 !important;
}
.toggle {
  width: 30px !important;
  height: 16px !important;
  border-radius: 8px !important;
  background: #3a3f42 !important;
  transition: background 0.15s !important;
}
.toggle.on { background: #1e5fb8 !important; }
.toggle::after {
  width: 12px !important;
  height: 12px !important;
  background: #7a8892 !important;
  top: 2px !important; left: 2px !important;
  transition: left 0.15s, background 0.15s !important;
}
.toggle.on::after { left: 16px !important; background: #4a9eff !important; }

/* ── BUTTONS ── */
button {
  background: #2b2f31 !important;
  border: 1px solid #3a3f42 !important;
  color: #c0c8d0 !important;
  border-radius: 6px !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  padding: 5px 10px !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
  transition: all 0.1s !important;
}
button:hover {
  border-color: #4a5a65 !important;
  background: #333839 !important;
  color: #e2e6e8 !important;
}
button:disabled { opacity: 0.3 !important; }
button:disabled:hover { background: #2b2f31 !important; border-color: #3a3f42 !important; color: #c0c8d0 !important; }

/* ── CANVAS AREA ── */
.canvas-area { background: #1a1d1e !important; }
.canvas-wrapper { padding: 40px !important; }
.canvas-wrapper::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
.canvas-wrapper::-webkit-scrollbar-thumb { background: #3a3f42 !important; border-radius: 4px !important; }

/* ── FLOATING OVERLAYS ── */
.canvas-overlay {
  background: rgba(26,29,30,0.92) !important;
  border: 1px solid #3a3f42 !important;
  border-radius: 8px !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 10px !important;
  color: #7a8892 !important;
  padding: 7px 12px !important;
  backdrop-filter: blur(8px) !important;
  letter-spacing: 0.3px !important;
}
.canvas-overlay span { color: #4a9eff !important; }

.compass {
  background: rgba(26,29,30,0.92) !important;
  border: 1px solid #3a3f42 !important;
  border-radius: 8px !important;
  width: 54px !important;
  height: 54px !important;
  backdrop-filter: blur(8px) !important;
  font-size: 8px !important;
  letter-spacing: 0.5px !important;
  color: #4a5a65 !important;
}
.compass .arrow { color: #4a9eff !important; font-size: 20px !important; }

.section-dir {
  background: rgba(26,29,30,0.92) !important;
  border: 1px solid #3a3f42 !important;
  border-radius: 8px !important;
  backdrop-filter: blur(8px) !important;
  padding: 7px !important;
  gap: 4px !important;
}
.section-dir .label {
  font-family: 'Inter', sans-serif !important;
  font-size: 8px !important;
  color: #4a5a65 !important;
  letter-spacing: 0.8px !important;
  text-transform: uppercase !important;
}
.section-dir button {
  background: #2b2f31 !important;
  border: 1px solid #3a3f42 !important;
  color: #7a8892 !important;
  border-radius: 5px !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 9px !important;
  letter-spacing: 0.5px !important;
  padding: 4px 8px !important;
  text-transform: uppercase !important;
}
.section-dir button:hover { border-color: #4a9eff !important; color: #4a9eff !important; background: #2b2f31 !important; }
.section-dir button.active { background: #4a9eff !important; color: white !important; border-color: #4a9eff !important; }

.zoom-controls {
  background: rgba(26,29,30,0.92) !important;
  border: 1px solid #3a3f42 !important;
  border-radius: 8px !important;
  backdrop-filter: blur(8px) !important;
  padding: 4px !important;
  gap: 1px !important;
}
.zoom-controls button {
  background: transparent !important;
  border: none !important;
  color: #7a8892 !important;
  border-radius: 5px !important;
  font-size: 13px !important;
  padding: 4px 9px !important;
  min-width: 28px !important;
}
.zoom-controls button:hover { background: #333839 !important; color: #e2e6e8 !important; border: none !important; }
#zoom-reset-btn {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 10px !important;
  min-width: 46px !important;
}

.measure-controls {
  background: rgba(26,29,30,0.92) !important;
  border: 1px solid #3a3f42 !important;
  border-radius: 8px !important;
  backdrop-filter: blur(8px) !important;
  padding: 4px !important;
  gap: 2px !important;
}
.measure-controls button {
  background: transparent !important;
  border: none !important;
  color: #7a8892 !important;
  border-radius: 5px !important;
  font-size: 10px !important;
  font-family: 'Inter', sans-serif !important;
  padding: 4px 10px !important;
}
.measure-controls button:hover { background: #333839 !important; color: #e2e6e8 !important; border: none !important; }
.measure-controls button.primary {
  background: rgba(74,158,255,0.12) !important;
  color: #4a9eff !important;
  border: 1px solid #1e5fb8 !important;
}

.three-hint {
  background: rgba(26,29,30,0.92) !important;
  border: 1px solid #3a3f42 !important;
  border-radius: 8px !important;
  backdrop-filter: blur(8px) !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 9px !important;
  color: #4a5a65 !important;
}
.three-hint kbd {
  background: #2b2f31 !important;
  border: 1px solid #3a3f42 !important;
  color: #4a9eff !important;
  border-radius: 3px !important;
}

/* Live drag tooltip */
.live-tip {
  background: #4a9eff !important;
  color: white !important;
  border-radius: 6px !important;
  box-shadow: 0 3px 14px rgba(74,158,255,0.38) !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.2px !important;
  padding: 5px 10px !important;
}

/* ── STATUS BAR / FOOTER ── */
footer {
  background: #232729 !important;
  border-top: 1px solid #3a3f42 !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 10px !important;
  color: #4a5a65 !important;
  padding: 0 14px !important;
  gap: 20px !important;
}
footer .stat { gap: 5px !important; }
footer .stat::before { display: none !important; }
footer .stat strong { color: #4a9eff !important; font-weight: 500 !important; }

/* ── SVG ELEMENTS ── */
.zone-label {
  font-family: 'Inter', sans-serif !important;
  font-weight: 700 !important;
  fill: #2a3538 !important;
}
.dim-label {
  font-family: 'JetBrains Mono', monospace !important;
  fill: #4a9eff !important;
  font-size: 10px !important;
}
.ceiling-label {
  font-family: 'JetBrains Mono', monospace !important;
  fill: #f0a040 !important;
  font-size: 9px !important;
}

/* Drag handles — bigger, glowing blue */
.drag-handle {
  fill: #4a9eff !important;
  stroke: #1a1d1e !important;
  stroke-width: 2 !important;
  filter: drop-shadow(0 0 5px rgba(74,158,255,0.7)) !important;
}
.drag-handle.dragging { fill: #f0a040 !important; }

/* ── CAPACITY READOUT ── */
#capacity-readout {
  background: #1a1d1e !important;
  border: 1px solid #1e5fb8 !important;
  border-radius: 6px !important;
  padding: 10px 12px !important;
  margin-top: 8px !important;
}
#cap-total {
  font-family: 'Inter', sans-serif !important;
  font-size: 26px !important;
  font-weight: 700 !important;
  color: #4a9eff !important;
}
#cap-breakdown {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 9px !important;
  color: #4a5a65 !important;
  line-height: 1.7 !important;
}

/* ── WALL CARDS ── */
[data-wall-card] { border-radius: 6px !important; }

/* ── INLINE ROOMS LIST ── */
#room-list > div { border-radius: 5px !important; }

/* ── ROOF READOUT ── */
#roof-readout {
  background: #1a1d1e !important;
  border: 1px dashed #3a3f42 !important;
  border-radius: 6px !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 9px !important;
  color: #4a5a65 !important;
  line-height: 1.7 !important;
  padding: 8px 10px !important;
}
#roof-peak, #roof-angle { color: #4a9eff !important; }

/* Inline dashed info boxes */
[style*="border: 1px dashed"] {
  border-color: #3a3f42 !important;
  border-radius: 6px !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 10px !important;
  color: #4a5a65 !important;
  background: #1a1d1e !important;
}

/* Section header add button */
.header-add-btn {
  background: transparent !important;
  border-radius: 4px !important;
  font-size: 14px !important;
}

/* ── SNAP INFERENCE LINES (injected by snap engine) ── */
#snap-inference-layer line {
  pointer-events: none;
}
#snap-inference-layer text {
  pointer-events: none;
  font-weight: 500;
  letter-spacing: 0.3px;
}
#snap-inference-layer circle,
#snap-inference-layer rect {
  pointer-events: none;
}
`;