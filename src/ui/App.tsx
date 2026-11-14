import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { LOADING } from "../core/figure/poses";
import { Figure } from "./components/Figure";
import { Icon } from "./components/Icon";
import { RestTimerDock } from "./components/RestTimer";
import { Toasts } from "./components/Toasts";
import { go, useRoute } from "./router";
import { useStore } from "./store";
import { ExerciseScreen } from "./screens/ExerciseScreen";
import { HistoryScreen } from "./screens/History";
import { PlanScreen } from "./screens/Plan";
import { ProgressScreen } from "./screens/Progress";
import { SettingsScreen } from "./screens/Settings";
import { SummaryScreen } from "./screens/Summary";
import { TodayScreen } from "./screens/Today";
import { WorkoutScreen } from "./screens/Workout";

const TABS = [
  { id: "today", label: "Today", icon: "today" },
  { id: "plan", label: "Plan", icon: "plan" },
  { id: "history", label: "History", icon: "history" },
  { id: "progress", label: "Progress", icon: "progress" },
  { id: "settings", label: "Settings", icon: "settings" },
];
const TAB_OF: Record<string, string> = { workout: "today", summary: "history", exercise: "plan" };

export function App() {
  const route = useRoute();
  const { ready, settings, toast } = useStore();
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") delete root.dataset.theme; else root.dataset.theme = settings.theme;
    try { localStorage.setItem("bf-theme", JSON.stringify(settings.theme)); } catch { /* ignore */ }
  }, [settings.theme]);

  useEffect(() => {
    if (needRefresh) toast({ kind: "info", title: "Update ready", body: "Open Settings → Update app, or it applies next launch." });
  }, [needRefresh, toast]);

  const [name, id] = route;
  const tab = TAB_OF[name] ?? name;
  let screen;
  if (!ready) screen = (
    <div className="loading"><Figure spec={LOADING} size={120} label="Loading" /><span className="eyebrow">Loading</span></div>
  );
  else if (name === "workout") screen = <WorkoutScreen />;
  else if (name === "exercise") screen = <ExerciseScreen id={id} />;
  else if (name === "summary") screen = <SummaryScreen id={id} />;
  else if (name === "plan") screen = <PlanScreen />;
  else if (name === "history") screen = <HistoryScreen />;
  else if (name === "progress") screen = <ProgressScreen />;
  else if (name === "settings") screen = <SettingsScreen onUpdate={needRefresh ? () => updateServiceWorker(true) : undefined} />;
  else screen = <TodayScreen />;

  return (
    <div className="app">
      <div className="bg-fx" />
      <div key={route.join("/")}>{screen}</div>
      {ready && <RestTimerDock />}
      <nav className="tabbar glass" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <Toasts />
    </div>
  );
}
