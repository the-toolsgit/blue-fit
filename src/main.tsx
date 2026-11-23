import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/space-mono/latin-400.css";
import "@fontsource/space-mono/latin-700.css";
import "@fontsource/inter-tight/latin-400.css";
import "@fontsource/inter-tight/latin-600.css";
import "@fontsource/inter-tight/latin-900.css";
import "./ui/theme/tokens.css";
import "./ui/theme/app.css";
import "./ui/theme/signal.css";
import { App } from "./ui/App";
import { StoreProvider } from "./ui/store";
import { unlockAudio } from "./ui/device";

unlockAudio();
// Behave like an app, not a web page: no pinch zoom or double-tap zoom (iOS ignores user-scalable=no, so stop the gestures).
for (const ev of ["gesturestart", "gesturechange"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
// (No page-wide touchmove listener: gesturestart already stops pinch, and a non-passive one makes iOS wait on JS to scroll.)
// After an update, a screen's old code file may be gone: reload to get the new version instead of a crash screen
window.addEventListener("vite:preloadError", (e) => {
  // Once a minute at most, so a missing file while offline can't loop
  try { const last = Number(sessionStorage.getItem("bf-reloaded") ?? 0); if (Date.now() - last < 60_000) return; sessionStorage.setItem("bf-reloaded", String(Date.now())); } catch { /* storage blocked */ }
  e.preventDefault(); location.reload();
});
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
