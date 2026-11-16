// Hash routing (GitHub Pages has no SPA fallback): #/today, #/workout, #/exercise/:id, …
import { useEffect, useState } from "react";

const parse = () => (location.hash.replace(/^#\/?/, "") || "today").split("/").map(decodeURIComponent);

export function useRoute(): string[] {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => { setR(parse()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return r;
}
export const go = (path: string) => { location.hash = "#/" + path; };
export const back = (fallback = "today") => (history.length > 1 ? history.back() : go(fallback));
/** Navigate without adding a history entry */
export const replace = (path: string) => location.replace("#/" + path);
