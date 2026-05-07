// AI Layout Suggester + Density Heatmap
// Injected into the VenueDims iframe as a plain string (no template literal).

const AI_SCRIPT_BODY = `
(function() {
  window.addEventListener('load', function() { setTimeout(initVenueAI, 600); });
  if (document.readyState === 'complete') setTimeout(initVenueAI, 600);

  // ── INIT ─────────────────────────────────────────────────────────────────
  function initVenueAI() {
    var headerActions = document.querySelector('.header-actions');
    if (!headerActions) {
      console.log('[VenueAI] header-actions not found');
      return;
    }
    console.log('[VenueAI] Initialized');
  }
})();
`;

export const VENUE_AI_JS = '<script id="venue-ai-engine">' + AI_SCRIPT_BODY + '<' + '/script>';