// Page scroll lock for sheets and full-screen overlays. A counter, not "save and restore the old value": two sheets
// closing out of order used to leave the page at overflow: hidden for good, and on iPhone the page then still scrolls
// but the sticky workout header, tab bar and bottom fade draw in the wrong place (Leo, Nov 23 2026).
let locks = 0;

/** Lock page scrolling; call the returned function to release (once). */
export function lockScroll(): () => void {
  locks++;
  document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (!locks) document.body.style.overflow = "";
  };
}
