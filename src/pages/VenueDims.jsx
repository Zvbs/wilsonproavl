import { useEffect, useRef, useState } from "react";
import { SKETCHUP_THEME_CSS } from "../lib/venuetheme";
import { SNAP_ENGINE_JS } from "../lib/venueSnapEngine";
import { DRAW_TOOLS_JS } from "../lib/venueDrawTools";
import { VENUE_AI_JS } from "../lib/venueAI";

const ORIGINAL_URL = "https://media.base44.com/files/public/user_690eaaf1c00cbaa22284443b/f6f3e1e3a_e8919850-ca9c-4fdd-81d0-55cc5b394825.html";

export default function VenueDims() {
  const iframeRef = useRef(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let url = null;
    fetch(ORIGINAL_URL)
      .then(r => r.text())
      .then(html => {
        // Inject our SketchUp theme CSS right before </head>
        const themed = html.replace(
          '</style>\n</head>',
          `</style>\n<style id="sketchup-theme">\n${SKETCHUP_THEME_CSS}\n</style>\n</head>`
        ).replace(
          '</style>\n</head>',
          `</style>\n<style id="sketchup-theme">\n${SKETCHUP_THEME_CSS}\n</style>\n</head>`
        );
        // Inject Inter font import at top of <head>
        const withFont = themed.replace(
          '<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono',
          '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono'
        );
        // Inject the snap engine JS right before </body>
        const withSnap = withFont.replace('</body>', SNAP_ENGINE_JS + '\n' + DRAW_TOOLS_JS + '\n' + VENUE_AI_JS + '\n</body>');
        const blob = new Blob([withSnap], { type: 'text/html' });
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setStatus("ready");
      })
      .catch(() => {
        // Fallback to direct URL if fetch fails
        setBlobUrl(ORIGINAL_URL);
        setStatus("ready");
      });

    return () => { if (url) URL.revokeObjectURL(url); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#1a1d1e" }}>
      {status === "loading" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "#1a1d1e", color: "#4a9eff",
          fontFamily: "monospace", fontSize: 13, letterSpacing: 1, gap: 12
        }}>
          <div style={{ fontSize: 24 }}>◈</div>
          <div>LOADING VENUEDIMS...</div>
        </div>
      )}
      {blobUrl && (
        <iframe
          ref={iframeRef}
          src={blobUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Venue Dimensions Tool"
        />
      )}
    </div>
  );
}