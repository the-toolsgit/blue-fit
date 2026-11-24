import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { LOADING, LOADING_TIMING } from "../core/figure/poses";
import { Figure } from "./components/Figure";
import { Icon } from "./components/Icon";
import { RestTimerDock } from "./components/RestTimer";
import { Toasts } from "./components/Toasts";
import { Splash } from "./components/Splash";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { go, useRoute } from "./router";
import { useStore } from "./store";
import { localDate } from "../core/util";
import { ACCENTS } from "../core/types";
import { ExerciseScreen } from "./screens/ExerciseScreen";
import { HistoryScreen } from "./screens/History";
import { PlanScreen } from "./screens/Plan";
import { SettingsScreen } from "./screens/Settings";
import { SummaryScreen } from "./screens/Summary";
import { TodayScreen } from "./screens/Today";

// Heavier screens (charts, drag and drop) load on first visit.
// The logger loads when first opened (it brings the drag library); the rest of startup stays smaller
const WorkoutScreen = lazy(() => import("./screens/Workout").then((m) => ({ default: m.WorkoutScreen })));
const ProgressScreen = lazy(() => import("./screens/Progress").then((m) => ({ default: m.ProgressScreen })));
const PlanEditorScreen = lazy(() => import("./screens/PlanEditor").then((m) => ({ default: m.PlanEditorScreen })));
const EditWorkoutScreen = lazy(() => import("./screens/EditWorkout").then((m) => ({ default: m.EditWorkoutScreen })));
// The runner with air streaks behind him (a separate svg, so the CSS animation isn't restarted by the figure's redraws)
const Loading = () => (
  <div className="loading">
    <div className="run-wrap">
      <svg className="run-air" viewBox="0 0 60 120" preserveAspectRatio="none" aria-hidden="true">
        <line x1="10" y1="34" x2="58" y2="34" /><line x1="2" y1="52" x2="54" y2="52" /><line x1="14" y1="68" x2="58" y2="68" /><line x1="4" y1="86" x2="50" y2="86" />
      </svg>
      <Figure spec={LOADING} size={120} label="Loading" timing={LOADING_TIMING} center={false} />
    </div>
    <span className="eyebrow">Loading</span>
  </div>
);

let swReg: ServiceWorkerRegistration | null = null;
/** Manual check (Settings). Resolves true if a new version was found. */
async function checkForUpdate(): Promise<boolean> {
  if (!swReg) return false;
  await swReg.update();
  return !!(swReg.waiting || swReg.installing);
}

const TABS = [
  { id: "today", label: "Today", icon: "today" },
  { id: "plan", label: "Plan", icon: "plan" },
  { id: "history", label: "History", icon: "history" },
  { id: "progress", label: "Progress", icon: "progress" },
  { id: "settings", label: "Settings", icon: "settings" },
];
// Swipe slide-in: once it has played, the page keeps its final state ("done": no animation, so nothing replays and
// jumps); the next navigation clears it so normal page entrances come back. Registered before the router's listener.
if (typeof window !== "undefined") {
  const root = document.documentElement;
  window.addEventListener("animationend", (e) => {
    if ((e.target as Element).classList?.contains("page") && (root.dataset.swipe === "next" || root.dataset.swipe === "prev")) root.dataset.swipe = "done";
  });
  window.addEventListener("hashchange", () => { if (root.dataset.swipe === "done") delete root.dataset.swipe; });
}
const TAB_OF: Record<string, string> = { workout: "today", summary: "history", edit: "history", exercise: "plan", "plan-edit": "plan" };

// The app can sit in the background overnight without reloading (iPhone home-screen apps resume as they were), so
// recheck the date when it comes back and once a minute; tab screens restart on a new day.
function useToday(): string {
  const [day, setDay] = useState(() => localDate(new Date()));
  useEffect(() => {
    const check = () => setDay(localDate(new Date()));
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    const t = setInterval(check, 60_000);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", check); window.removeEventListener("pageshow", check); clearInterval(t); };
  }, []);
  return day;
}

export function App() {
  const route = useRoute();
  const today = useToday();
  const [splash, setSplash] = useState(true); // once per launch
  const endSplash = useCallback(() => setSplash(false), []);
  const { ready, settings, toast } = useStore();
  // iPhone home-screen apps resume without reloading, so check for a new version on launch, whenever the app
  // comes back to the foreground, and every 30 minutes while open.
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      swReg = reg;
      const check = () => { if (navigator.onLine) reg.update().catch(() => undefined); };
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
      setInterval(check, 30 * 60_000);
    },
  });

  // Gray is the only look (Nov 24 2026): index.html sets data-look="gray" and data-theme="dark" on <html>.
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    // Not before the saved settings load: the default would undo what index.html set early (flash)
    if (settings.accent === "blue" || !ACCENTS.includes(settings.accent)) delete root.dataset.accent; else root.dataset.accent = settings.accent;
    try { localStorage.setItem("bf-accent", JSON.stringify(settings.accent)); } catch { /* ignore */ }
  }, [ready, settings.accent]);

  useEffect(() => {
    if (needRefresh) toast({ kind: "info", title: "Update ready", body: "Open Settings → Update app, or it applies next launch." });
  }, [needRefresh, toast]);

  // Compact tab bar: icons only once you scroll down; it stays compact until you're back at the top of the page,
  // tap the bar, or open another screen.
  useEffect(() => {
    const root = document.documentElement;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 60) delete root.dataset.compact;
      else if (y > 80) root.dataset.compact = "";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Swipe left / right on a main tab screen switches to the next / previous tab. Skipped where a sideways swipe
  // already means something: horizontally scrolling rows, charts and the muscle-map caption (touch-action pan-y),
  // sheets, form fields and the plan editor.
  const tabRef = useRef("");
  useEffect(() => {
    let st: { x: number; y: number; t: number; leftOnly: boolean } | null = null;
    /** What a sideways swipe already does under the finger: "both" ways, only "left" (rows that swipe left to delete), or nothing */
    const ownsSwipe = (el: Element | null): "both" | "left" | null => {
      let left = false;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.matches('[data-noswipe="left"]')) { left = true; continue; }
        if (n.matches("input, textarea, select, .sheet, [data-noswipe]")) return "both";
        const cs = getComputedStyle(n);
        if (cs.touchAction === "pan-y" || cs.touchAction === "none") return "both";
        if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 2) return "both";
      }
      return left ? "left" : null;
    };
    // A screen with a back arrow: swipe right goes back (runs that screen's own Back button)
    const backBtn = () => [...document.querySelectorAll<HTMLButtonElement>('.page button[aria-label="Back"]')].find((b) => b.offsetParent !== null);
    const start = (e: TouchEvent) => {
      const name = location.hash.replace(/^#\/?/, "").split("/")[0] || "today";
      const owns = ownsSwipe(e.target as Element);
      st = e.touches.length === 1 && (TABS.some((t) => t.id === name) || !!backBtn()) && owns !== "both"
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now(), leftOnly: owns === "left" } : null;
    };
    const end = (e: TouchEvent) => {
      if (!st) return;
      const dx = e.changedTouches[0].clientX - st.x, dy = e.changedTouches[0].clientY - st.y, ms = performance.now() - st.t, leftOnly = st.leftOnly;
      st = null;
      if (leftOnly && dx < 0) return;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || ms > 700) return;
      const b = dx > 0 ? backBtn() : undefined;
      if (b) { document.documentElement.dataset.swipe = "prev"; b.click(); return; }
      const i = TABS.findIndex((t) => t.id === tabRef.current), j = i + (dx < 0 ? 1 : -1);
      if (i < 0 || j < 0 || j >= TABS.length) return;
      document.documentElement.dataset.swipe = dx < 0 ? "next" : "prev";
      go(TABS[j].id);
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => { window.removeEventListener("touchstart", start); window.removeEventListener("touchend", end); };
  }, []);
  useEffect(() => { delete document.documentElement.dataset.compact; }, [route.join("/")]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapStart = useRef<{ x: number; y: number; id: string } | null>(null);
  const tapHandled = useRef(0); // when a touch already switched tabs (its click, if any, follows right after)
  const [name, id, sub] = route;
  const tab = TAB_OF[name] ?? name;
  tabRef.current = tab;
  let screen;
  if (!ready) screen = <Loading />;
  else if (name === "workout") screen = <WorkoutScreen />;
  else if (name === "exercise") screen = <ExerciseScreen id={id} slotId={sub} />;
  else if (name === "summary") screen = <SummaryScreen id={id} />;
  else if (name === "edit") screen = <EditWorkoutScreen id={id} />;
  else if (name === "plan") screen = <PlanScreen key={today} />;
  else if (name === "plan-edit") screen = <PlanEditorScreen id={id} />;
  else if (name === "history") screen = <HistoryScreen key={today} />;
  else if (name === "progress") screen = <ProgressScreen key={today} />;
  else if (name === "settings") screen = <SettingsScreen onUpdate={needRefresh ? () => updateServiceWorker(true) : undefined} onCheck={checkForUpdate} />;
  else screen = <TodayScreen key={today} />;

  return (
    <div className="app">
      <div className="bg-fx" />
      <main key={route.join("/")}><ErrorBoundary resetKey={route.join("/")}><Suspense fallback={<Loading />}>{screen}</Suspense></ErrorBoundary></main>
      {ready && <RestTimerDock />}
      <div className="bottom-fade" aria-hidden="true" />
      <nav className="tabbar glass" aria-label="Main" onClick={() => { delete document.documentElement.dataset.compact; }}>
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? "page" : undefined}
            // Act on touch end: a tap that stops a scrolling page gets no click (and its pointer events are cancelled) on iOS,
            // but touch events still arrive.
            onTouchStart={(e) => { tapStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, id: t.id }; }}
            onTouchEnd={(e) => {
              const p = tapStart.current; tapStart.current = null;
              const c = e.changedTouches[0];
              if (!p || p.id !== t.id || Math.hypot(c.clientX - p.x, c.clientY - p.y) > 12) return;
              delete document.documentElement.dataset.compact; tapHandled.current = performance.now(); go(t.id);
            }}
            onClick={() => { if (performance.now() - tapHandled.current < 600) return; go(t.id); }}>
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <Toasts />
      {splash && <Splash onDone={endSplash} />}
    </div>
  );
}
