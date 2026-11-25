// Body scan flow (docs/plans/body-scan.md §3, reference flow): weight & height → sound → tutorial (first time)
// → phone height → phone angle → live camera (room check, then 12 hours with voice) → building the 3D body →
// result. Camera frames stay in memory and are dropped right after each photo; only the measurements and the
// 3D body are saved.
import { useCallback, useEffect, useRef, useState } from "react";
import { MEASURE_VERSION } from "../../core/body/measure";
import { fromUnit, toUnit } from "../../core/body/trends";
import { PART_NAMES, type BodyScan, type Sex } from "../../core/body/types";
import { fmtNum, uid } from "../../core/util";
import { openCamera, ScanWorker, type Fitted } from "../../scan/web/client";
import { SCANNER_VERSION } from "../../scan/web/constants";
import { TurnTracker, bodyAngle, framing, hourCue, poseCheck, roomCheck, tiltFromGravity, tiltOk, type Framing, type RoomStats } from "../../scan/web/guide";
import { Seg, Stepper } from "../components/Controls";
import { back, go } from "../router";
import { useStore } from "../store";

type Step = "details" | "sound" | "tutorial" | "placement" | "angle" | "live" | "processing" | "result" | "failed";
const TUTORIAL_KEY = "bf-scan-tutorial-seen";
const seen = () => { try { return localStorage.getItem(TUTORIAL_KEY) === "1"; } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch { /* private mode */ } };
const nowLocal = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

// ── sound: voice + shutter (Web Audio; plays with the silent switch on) ──
let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
    audio ??= new AudioContext();
    void audio.resume();
  } catch { /* no audio */ }
}
function shutter() {
  if (!audio) return;
  const n = audio.createBufferSource(), b = audio.createBuffer(1, audio.sampleRate * 0.08, audio.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * 0.012));
  n.buffer = b;
  const g = audio.createGain(); g.gain.value = 0.6;
  n.connect(g).connect(audio.destination);
  n.start();
}
let lastSaid = "", lastSaidAt = 0;
function say(text: string, force = false) {
  const now = Date.now();
  if (!force && text === lastSaid && now - lastSaidAt < 4500) return;
  lastSaid = text; lastSaidAt = now;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; speechSynthesis.speak(u); } catch { /* no voice */ }
}

export function ScanScreen() {
  const { settings, saveSettings, saveBodyScan, bodyScans, toast } = useStore();
  const unit = settings.lengthUnit ?? "in";
  const [step, setStep] = useState<Step>("details");
  const [page, setPage] = useState(0);
  const [height, setHeight] = useState<number | null>(settings.heightCm != null ? toUnit(settings.heightCm, unit) : null);
  const lastWeight = [...bodyScans].sort((a, b) => (a.date < b.date ? 1 : -1)).find((b) => b.weightLb != null)?.weightLb ?? null;
  const [weight, setWeight] = useState<number | null>(lastWeight);
  const [sex, setSex] = useState<Sex>(settings.sex ?? "male");
  const worker = useRef<ScanWorker | null>(null);
  const ready = useRef<Promise<unknown> | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [result, setResult] = useState<Fitted | null>(null);
  const [failWhy, setFailWhy] = useState("");
  const heightCm = height != null ? (settings.heightCm != null && toUnit(settings.heightCm, unit) === height ? settings.heightCm : Math.round(fromUnit(height, unit) * 10) / 10) : null;

  // models start loading right away (seconds), while the user fills in the first screens
  useEffect(() => {
    const w = new ScanWorker();
    worker.current = w;
    ready.current = w.init().catch((e) => { setLoadErr(e.message); throw e; });
    return () => { w.close(); try { speechSynthesis.cancel(); } catch { /* */ } };
  }, []);

  const close = () => back("progress");
  const startCamera = () => { markSeen(); setStep("placement"); };

  const finish = useCallback(async () => {
    setStep("processing");
    try {
      const r = await worker.current!.fit(heightCm!, sex);
      if (!r.ok) { setFailWhy(r.reason ?? ""); setStep("failed"); return; }
      setResult(r);
      setStep("result");
      say("Done. Here's your scan.", true);
    } catch (e) {
      setFailWhy((e as Error).message);
      setStep("failed");
    }
  }, [heightCm, sex]);

  const save = () => {
    if (!result || heightCm == null) return;
    const scan: BodyScan = {
      id: uid(), date: nowLocal(), source: "web-camera", scannerVersion: SCANNER_VERSION, measureVersion: MEASURE_VERSION,
      heightCm, weightLb: weight ?? undefined, sex, geometry: result.geometry, ...result.measured,
    };
    saveBodyScan(scan);
    if (settings.heightCm !== heightCm || settings.sex !== sex) saveSettings({ ...settings, heightCm, sex });
    toast({ kind: "info", title: "Scan saved" });
    go("progress");
  };

  return (
    <div className="scan" role="dialog" aria-label="Body scan">
      <header className="scan-top">
        {step === "details" || step === "sound" || step === "tutorial"
          ? <button className="scan-x" aria-label="Back" onClick={() => (step === "details" ? close() : step === "sound" ? setStep("details") : page ? setPage(page - 1) : setStep("sound"))}>‹</button>
          : <button className="scan-x" aria-label="Close scan" onClick={close}>×</button>}
        <span className="scan-title">{step === "tutorial" ? "Tutorial" : step === "live" ? "Scan in progress" : step === "angle" ? "Phone angle" : step === "placement" ? "Phone height" : "Body scan"}</span>
      </header>

      {step === "details" && (
        <section className="scan-body stack">
          <span className="eyebrow neon">Step 1 of 2</span>
          <h1 className="title-lg">Weight & height</h1>
          <p className="muted">Confirm them so your measurements and body fat come out right.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <Stepper label="Height" suffix={unit} value={height} step={unit === "in" ? 0.5 : 1} min={0} empty={unit === "in" ? 68 : 173} onChange={setHeight} />
            <Stepper label="Weight" suffix="lb" value={weight} step={0.5} min={0} empty={180} onChange={setWeight} />
          </div>
          <div><span className="eyebrow" style={{ display: "block", margin: "0 2px 8px" }}>Body fat formula</span>
            <Seg label="Sex" value={sex} onChange={setSex} options={[{ v: "male", label: "Male" }, { v: "female", label: "Female" }]} /></div>
          <button className="btn btn-primary btn-block" style={{ minHeight: 56 }} onClick={() => {
            if (heightCm == null || heightCm < 50 || heightCm > 260) { toast({ kind: "warn", title: "Check your height" }); return; }
            if (weight != null && (weight < 20 || weight > 1000)) { toast({ kind: "warn", title: "Check your weight", body: "Between 20 and 1000 lb, or leave it empty." }); return; }
            setStep("sound");
          }}>Continue</button>
          <p className="muted scan-privacy">Private: photos are processed on this phone and deleted right after. They're never saved or sent.</p>
        </section>
      )}

      {step === "sound" && (
        <section className="scan-body stack">
          <span className="eyebrow neon">Step 2 of 2</span>
          <h1 className="title-lg">Turn your volume up</h1>
          <p className="muted">A voice tells you when to turn. Use the volume buttons, then test it.</p>
          <button className="btn btn-ghost btn-block" onClick={() => { unlockAudio(); say("This is the scan voice.", true); shutter(); }}>Test sound</button>
          <button className="scan-start" onClick={() => { unlockAudio(); if (seen()) startCamera(); else { setPage(0); setStep("tutorial"); } }}>Start scan</button>
          <button className="btn btn-quiet btn-block" onClick={() => { setPage(0); setStep("tutorial"); }}>Watch tutorial</button>
        </section>
      )}

      {step === "tutorial" && <Tutorial page={page} setPage={setPage} onDone={startCamera} />}
      {step === "placement" && (
        <section className="scan-body stack">
          <PhoneArt />
          <h1 className="title-md">Put the phone upright at waist height</h1>
          <p className="muted">On a table or shelf, near the edge, screen facing you. Not on the floor.</p>
          <button className="btn btn-primary btn-block" style={{ minHeight: 56 }} onClick={() => setStep("angle")}>Continue</button>
        </section>
      )}
      {step === "angle" && <AngleStep onOk={() => setStep("live")} />}
      {step === "live" && (
        loadErr ? <section className="scan-body stack"><h1 className="title-md">The scanner couldn't start</h1><p className="muted">{loadErr}</p><button className="btn btn-primary btn-block" onClick={close}>Close</button></section>
          : <LiveStep worker={worker} ready={ready} onDone={finish} onFail={(why) => { setFailWhy(why); setStep("failed"); }} />
      )}
      {step === "processing" && (
        <section className="scan-body scan-center stack">
          <div className="scan-spinner" aria-hidden="true" />
          <h1 className="title-md">Building your 3D body…</h1>
          <p className="muted">About half a minute. Keep the app open.</p>
        </section>
      )}
      {step === "failed" && (
        <section className="scan-body stack">
          <h1 className="title-md">Let's scan again</h1>
          <p className="muted">{failWhy ? `The scan didn't come out clean (${failWhy}).` : "The scan didn't come out clean."} Check the light, a plain wall behind you, and keep the same pose while turning.</p>
          <button className="btn btn-primary btn-block" onClick={() => location.reload()}>Scan again</button>
          <button className="btn btn-quiet btn-block" onClick={close}>Close</button>
        </section>
      )}
      {step === "result" && result && (
        <section className="scan-body stack">
          <span className="eyebrow neon">Scan done</span>
          <h1 className="title-lg">Your measurements</h1>
          <div className="glass" style={{ padding: "4px 12px" }}>
            {result.measured.bodyFatPct != null && <div className="list-row body-row"><span className="grow">Body fat</span><span className="mono">{fmtNum(result.measured.bodyFatPct)}%</span></div>}
            {Object.entries(result.measured.measurements).map(([k, v]) => (
              <div key={k} className="list-row body-row"><span className="grow">{PART_NAMES[k as keyof typeof PART_NAMES]}</span><span className="mono">{fmtNum(toUnit(v!, unit))} <small className="muted">{unit}</small></span></div>
            ))}
          </div>
          <button className="btn btn-primary btn-block" style={{ minHeight: 56 }} onClick={save}>Save scan</button>
          <button className="btn btn-quiet btn-block" onClick={close}>Discard</button>
        </section>
      )}
    </div>
  );
}

const TUTORIAL = [
  { title: "Before you start", items: ["A clear space with a plain wall behind you", "Underwear, swimwear or skin-tight clothes", "Your whole body in view, nothing in the way", "No accessories, hair tied up", "No shoes or socks"] },
  { title: "Phone at waist height", body: "Put the phone upright on a table or shelf, near the edge, screen facing you. Not on the floor." },
  { title: "Stand in the frame, arms out a little", body: "Step back until you're centered and the guides turn green. Keep your arms straight, a few inches from your sides, feet hip-width apart, for the whole scan." },
  { title: "Turn slowly, hour by hour", body: "A voice tells you to turn to 1 o'clock, 2 o'clock… up to 11. Turn clockwise in place and hold still at each hour until you hear the shutter." },
];
function Tutorial({ page, setPage, onDone }: { page: number; setPage: (n: number) => void; onDone: () => void }) {
  const t = TUTORIAL[page];
  return (
    <section className="scan-body stack">
      <div className="scan-dots" aria-hidden="true">{TUTORIAL.map((_, i) => <i key={i} data-on={i === page || undefined} />)}</div>
      {page === 1 ? <PhoneArt /> : page === 2 ? <PoseArt /> : page === 3 ? <ClockArt /> : null}
      <h1 className="title-md">{t.title}</h1>
      {t.items ? <ul className="scan-check">{t.items.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">{t.body}</p>}
      <button className="btn btn-primary btn-block" style={{ minHeight: 56 }} onClick={() => (page < TUTORIAL.length - 1 ? setPage(page + 1) : onDone())}>{page < TUTORIAL.length - 1 ? "Next" : "Start scan"}</button>
    </section>
  );
}

function AngleStep({ onOk }: { onOk: () => void }) {
  const [deg, setDeg] = useState<number | null>(null);
  const [asked, setAsked] = useState(false);
  const [denied, setDenied] = useState(false);
  const since = useRef<number | null>(null);
  useEffect(() => {
    if (!asked) return;
    const on = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      const d = g ? tiltFromGravity({ y: g.y, z: g.z }) : null;
      setDeg(d);
      if (tiltOk(d)) { since.current ??= Date.now(); if (Date.now() - since.current > 1200) onOk(); } else since.current = null;
    };
    addEventListener("devicemotion", on);
    return () => removeEventListener("devicemotion", on);
  }, [asked, onOk]);
  const ask = async () => {
    try {
      const DME = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
      const r = DME.requestPermission ? await DME.requestPermission() : "granted";
      if (r !== "granted") setDenied(true);
    } catch { setDenied(true); }
    setAsked(true);
  };
  const ok = tiltOk(deg);
  return (
    <section className="scan-body scan-center stack">
      <div className={"scan-angle" + (ok ? " ok" : "")} aria-live="polite">{deg == null ? "—" : `${Math.round(deg)}°`}</div>
      <div className={"scan-phone" + (ok ? " ok" : "")} style={{ transform: `rotateX(${deg == null ? 0 : 90 - deg}deg)` }} aria-hidden="true" />
      <p style={{ fontSize: 18, fontWeight: 600, textAlign: "center" }}>{!asked ? "Let's check the phone's angle." : ok ? "Perfect. Keep it there." : "Stand the phone upright until it turns green."}</p>
      {!asked && <button className="btn btn-primary btn-block" style={{ minHeight: 56 }} onClick={ask}>Check angle</button>}
      {denied && <><p className="muted" style={{ textAlign: "center" }}>Motion access is off, so the angle can't be checked. Make sure the phone stands straight up.</p><button className="btn btn-ghost btn-block" onClick={onOk}>Continue anyway</button></>}
    </section>
  );
}

function LiveStep({ worker, ready, onDone, onFail }: { worker: React.MutableRefObject<ScanWorker | null>; ready: React.MutableRefObject<Promise<unknown> | null>; onDone: () => void; onFail: (why: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [cue, setCue] = useState("Getting the camera ready…");
  const [bars, setBars] = useState<Framing | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [toast, setToast] = useState(true);
  useEffect(() => {
    let alive = true, stream: MediaStream | null = null, wake: { release(): Promise<void> } | null = null;
    let tilt: number | null = 90;
    const onMotion = (e: DeviceMotionEvent) => { const g = e.accelerationIncludingGravity; if (g) tilt = tiltFromGravity({ y: g.y, z: g.z }); };
    addEventListener("devicemotion", onMotion);
    const lockWake = async () => { try { wake = await (navigator as unknown as { wakeLock: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock.request("screen"); } catch { /* not supported */ } };
    const onVis = () => { if (document.visibilityState === "hidden" && alive) { alive = false; onFail("the app went to the background"); } else void lockWake(); };
    document.addEventListener("visibilitychange", onVis);
    setTimeout(() => setToast(false), 4000);
    (async () => {
      try {
        stream = await openCamera(video.current!);
        await lockWake();
        setCue("Loading the scanner…");
        await ready.current;
        await worker.current!.reset();
        const tracker = new TurnTracker(700, 12);
        let room: RoomStats | null = null, roomAt = 0, goodSince: number | null = null, started = false, lastHour = -1;
        while (alive) {
          const v = video.current!;
          const p = await worker.current!.pose(v);
          if (!alive) break;
          const now = performance.now();
          if (now - roomAt > 1500 && !started) { roomAt = now; room = await worker.current!.room(v); }
          const lm = p.landmarks;
          const f = lm ? framing(lm) : null;
          setBars(f);
          // checks, first problem first
          let problem: string | null = null;
          if (!tiltOk(tilt)) problem = started ? "The phone moved. Stand it upright again" : "Stand the phone upright";
          else if (!lm || p.people === 0) problem = "Step into the frame";
          else if (p.people > 1) problem = "Only one person in the frame, please";
          else if (!f!.top || !f!.bottom) problem = f!.distance === "closer" ? "Come a little closer" : "Step back until your whole body shows";
          else if (f!.distance === "back") problem = "Step back a little";
          else if (f!.distance === "closer") problem = "Come a little closer";
          else if (!f!.left || !f!.right || !f!.centered) problem = "Move to the middle of the frame";
          else if (!started) {
            const pc = poseCheck(lm);
            if (!pc.ok) problem = pc.say!;
            else if (room) { const rc = roomCheck(room); if (!rc.ok) problem = rc.say!; }
          }
          if (problem) {
            goodSince = null;
            setCue(problem); say(problem);
            await new Promise((r) => setTimeout(r, 80));
            continue;
          }
          if (!started) {
            goodSince ??= now;
            setCue("Hold still"); say("Great. Hold still.");
            if (now - goodSince < 1500) continue;
            started = true;
          }
          const c = tracker.update(bodyAngle(p.world ?? lm!), now);
          if (c.kind === "capture") {
            shutter();
            const ok = await worker.current!.capture(v, c.hour);
            if (!ok) { tracker.hour = c.hour; say("Hold still", true); continue; }
            setHour(c.hour);
            if (c.hour >= 11) { setCue("Done"); alive = false; break; }
          } else if (c.kind === "tooFar") { setCue("You turned too much. Turn back a little"); say("You turned too much. Turn back a little"); }
          else if (c.kind === "turn" && c.hour !== lastHour) { lastHour = c.hour; setCue(hourCue(c.hour)); say(hourCue(c.hour), true); }
          else if (c.kind === "turn") setCue(hourCue(c.hour));
          else if (c.kind === "hold") setCue("Hold still");
        }
        if (tracker.hour >= 12) { stream?.getTracks().forEach((t) => t.stop()); onDone(); }
      } catch (e) {
        if (alive) onFail((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
      void wake?.release().catch(() => {});
      removeEventListener("devicemotion", onMotion);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [worker, ready, onDone, onFail]);
  // the preview is mirrored like a selfie, so the image's left edge shows on the right
  const bar = (k: keyof Pick<Framing, "top" | "bottom" | "left" | "right">) => (bars ? (bars[k] ? "ok" : "bad") : "");
  return (
    <section className="scan-live">
      {toast && <div className="scan-note">Photos are processed on this phone and aren't saved.</div>}
      <div className="scan-frame">
        <video ref={video} playsInline muted />
        <i className={"scan-bar top " + bar("top")} /><i className={"scan-bar bottom " + bar("bottom")} />
        <i className={"scan-bar left " + bar("right")} /><i className={"scan-bar right " + bar("left")} />
        {hour != null && <ClockArt done={hour + 1} small />}
      </div>
      <div className="scan-cue" aria-live="assertive">{cue}</div>
    </section>
  );
}

// ── simple line drawings in the app's style ──
function PhoneArt() {
  return (
    <svg className="scan-art" viewBox="0 0 240 120" aria-hidden="true">
      <path d="M10 70h90v40M30 70v40" />
      <rect x="78" y="40" width="14" height="30" rx="3" className="hl" />
      <path d="M92 50 L200 30 M92 62 L200 90" className="beam" />
      <circle cx="205" cy="22" r="7" /><path d="M205 29v38M205 67l-8 40M205 67l8 40M205 38l-12 22M205 38l12 22" />
    </svg>
  );
}
function PoseArt() {
  return (
    <svg className="scan-art" viewBox="0 0 240 140" aria-hidden="true">
      <rect x="60" y="6" width="120" height="128" rx="10" className="frame" />
      <circle cx="120" cy="26" r="9" /><path d="M120 35v44M120 79l-11 46M120 79l11 46M120 44l-17 34M120 44l17 34" className="hl" />
    </svg>
  );
}
function ClockArt({ done = 0, small }: { done?: number; small?: boolean }) {
  return (
    <svg className={"scan-clock" + (small ? " small" : "")} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="46" />
      {Array.from({ length: 12 }, (_, h) => {
        const a = (h * 30 - 90) * (Math.PI / 180);
        return <g key={h}><line x1={60 + 40 * Math.cos(a)} y1={60 + 40 * Math.sin(a)} x2={60 + 50 * Math.cos(a)} y2={60 + 50 * Math.sin(a)} className={h < done ? "hl" : ""} />
          {!small && <text x={60 + 32 * Math.cos(a)} y={60 + 32 * Math.sin(a) + 3}>{h === 0 ? 12 : h}</text>}</g>;
      })}
    </svg>
  );
}

