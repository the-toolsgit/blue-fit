import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { LOADING } from "../core/figure/poses";
import { Figure } from "./components/Figure";
import { Icon } from "./components/Icon";
import { RestTimerDock } from "./components/RestTimer";
import { Toasts } from "./components/Toasts";
import { Splash } from "./components/Splash";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { go, useRoute } from "./router";
import { useStore } from "./store";
import { ExerciseScreen } from "./screens/ExerciseScreen";
import { HistoryScreen } from "./screens/History";
import { PlanScreen } from "./screens/Plan";
import { SettingsScreen } from "./screens/Settings";
import { SummaryScreen } from "./screens/Summary";
import { TodayScreen } from "./screens/Today";
import { WorkoutScreen } from "./screens/Workout";

// Heavier screens (charts, drag and drop) load on first visit.
const ProgressScreen = lazy(() => import("./screens/Progress").then((m) => ({ default: m.ProgressScreen })));
const PlanEditorScreen = lazy(() => import("./screens/PlanEditor").then((m) => ({ default: m.PlanEditorScreen })));
const EditWorkoutScreen = lazy(() => import("./screens/EditWorkout").then((m) => ({ default: m.EditWorkoutScreen })));
const Loading = () => <div className="loading"><Figure spec={LOADING} size={120} label="Loading" /><span className="eyebrow">Loading</span></div>;

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
const TAB_OF: Record<string, string> = { workout: "today", summary: "history", edit: "history", exercise: "plan", "plan-edit": "plan" };

export function App() {
  const route = useRoute();
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

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") delete root.dataset.theme; else root.dataset.theme = settings.theme;
    try { localStorage.setItem("bf-theme", JSON.stringify(settings.theme)); } catch { /* ignore */ }
  }, [settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.accent === "blue") delete root.dataset.accent; else root.dataset.accent = settings.accent;
    try { localStorage.setItem("bf-accent", JSON.stringify(settings.accent)); } catch { /* ignore */ }
  }, [settings.accent]);

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
  useEffect(() => { delete document.documentElement.dataset.compact; }, [route.join("/")]); // eslint-disable-line react-hooks/exhaustive-deps

  const [name, id, sub] = route;
  const tab = TAB_OF[name] ?? name;
  let screen;
  if (!ready) screen = <Loading />;
  else if (name === "workout") screen = <WorkoutScreen />;
  else if (name === "exercise") screen = <ExerciseScreen id={id} slotId={sub} />;
  else if (name === "summary") screen = <SummaryScreen id={id} />;
  else if (name === "edit") screen = <EditWorkoutScreen id={id} />;
  else if (name === "plan") screen = <PlanScreen />;
  else if (name === "plan-edit") screen = <PlanEditorScreen id={id} />;
  else if (name === "history") screen = <HistoryScreen />;
  else if (name === "progress") screen = <ProgressScreen />;
  else if (name === "settings") screen = <SettingsScreen onUpdate={needRefresh ? () => updateServiceWorker(true) : undefined} onCheck={checkForUpdate} />;
  else screen = <TodayScreen />;

  return (
    <div className="app">
      <div className="bg-fx" />
      <main key={route.join("/")}><ErrorBoundary resetKey={route.join("/")}><Suspense fallback={<Loading />}>{screen}</Suspense></ErrorBoundary></main>
      {ready && <RestTimerDock />}
      <div className="bottom-fade" aria-hidden="true" />
      <nav className="tabbar glass" aria-label="Main" onClick={() => { delete document.documentElement.dataset.compact; }}>
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>
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
