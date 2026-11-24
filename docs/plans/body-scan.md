# Body scan: plan

Goal: scan the body with the phone's front camera, build a 3D body and measurements per part, track them over time, and let them adjust the plan. Camera only, always (no LiDAR: Pro-only; Leo, Nov 24 2026). The web scanner is temporary; the native app swaps in a native camera scanner with the same flow. Measuring, storage, interpretation, Progress and plan effects are permanent.
Reviewed by an agent Nov 24 2026; all findings applied below.
Must work on every iPhone from the iPhone 14 on (Leo, Nov 24 2026); tested first on Leo's iPhone 16 Pro.

## 1. Architecture (swappable scanner)

```
[Scanner: capture + 3D fit]  →  BodyGeometry  →  [core/body/measure]  →  BodyScan  →  [Interpretation]  →  Progress / Plan
        temporary                 contract          permanent            permanent        permanent
```

- **The scanner returns geometry only, never measurements**, so web and native scanners measure the same way.
- `src/core/body/types.ts` (framework-free, portable to Swift):
  - `BodyGeometry { slices: { yCm, polygon: [x,z][] (quantized mm) }[] (1 cm steps, scanner-neutral), limbs: { part, axis, sections[] }[] (cross-sections perpendicular to each bone), landmarkHeights, shape?: { model: "MHR", coeffs: number[45], pose: number[] } (rebuilds the mesh), viewQuality: number[], scannerId, scannerVersion }`
  - `BodyScan { id, date, source: "web-camera" | "native-camera" | "manual", scannerVersion, measureVersion, heightCm, weight?: { value, unit: "lb" }, sex, geometry?: BodyGeometry, measurements: Partial<Record<BodyPart, number>> (cm), bodyFatPct?, confidence: Partial<Record<BodyPart, number>> }`
  - `BodyPart`: neck, chest, waistUpper, waistLower (navel), hips, upperArmL/R, forearmL/R, thighL/R, calfL/R.
- `src/core/body/measure.ts` (pure maths): convex-hull perimeter of slices (= tape), limb sections, Cauchy cross-check, Navy body fat, confidence. Unit-tested against published worked examples.
- `src/core/body/scanner.ts`: `interface BodyScanner { id; version; capabilities(): Promise<{available, reason?}>; run(input: {heightCm, sex}): Promise<BodyGeometry> }` — no UI types; the scanner owns its own capture screens; shared screens (weight & height, results) live outside it.
- `src/scan/web/`: everything web-only (camera, models, guidance, fit). `src/scan/registry.ts` picks the scanner.
- **The real long-term contract** (for a Swift rewrite) is the stored `BodyScan` JSON schema + the measurement definitions in APP_SPEC; both written down there.
- **Trends never mix methods:** scans compare only within the same `source` + `measureVersion`, or show a "method changed" break. When the native scanner arrives: a few same-day overlap scans (web + native) to measure the bias.

## 2. Storage, settings, backup

- New `bodyScans` table: `Tables`/`TABLE_KEYS` (key `id`), `AppData`, idbAdapter version bump + new object store, Dexie old-data test still opens.
- `exportFormat`: `bodyScans: z.array(...).default([])` so old backups import; Reset clears scans; backup size check (geometry tens of KB per scan).
- Settings: `heightCm`, `sex: "male" | "female"`, `lengthUnit: "in" | "cm"` (default in) with zod defaults; `units` stays lb. Weight stored as typed (lb).
- Export screen note: "Contains body measurements."

## 3. Web scanner

### 3.1 Capture
1. Phone upright on a waist-height surface, front camera, user ~1.5 m away (verify in the spike that a 1.8 m body fits in frame at that distance; else adjust the distance cue).
2. Camera: `getUserMedia({ video: { facingMode: "user", width, height, aspectRatio } })` with an explicit size; check in the spike that Safari doesn't crop, auto-frame or switch lenses; zoom/crop fixed during the scan.
3. Frames to the worker via `createImageBitmap(video)` (transferred). Front-camera frames are unmirrored (preview mirrored by CSS only); anatomical left/right pinned from the first frame and carried through.
4. **Turn tracking:** angle followed continuously, clockwise only (no jumping back), from shoulder/hip yaw in world landmarks + nose/face visibility (front vs back) + silhouette width; never decided from one frame. Too far → "You turned too much"; not enough → repeat the cue. Auto-capture when steady at the hour.
5. **Per capture, right away:** segment, keep only mask + landmarks, `ImageBitmap.close()` the frame (memory: Safari kills the tab at ~1–1.5 GB). Frames never touch IndexedDB, crash-recovery state, the SW cache or logs.
6. Phone tilt: gravity vector from `DeviceMotionEvent.accelerationIncludingGravity` (not Euler angles, unstable near 90°); permission from a tap; 85–95° = green; must stay green during the scan; if it moves → restart. Permission denied → continue with "tilt not checked".

7. **Pre-scan room check** (live, before the countdown; each shows a fix in words + voice, scan waits until green):
   - **Phone:** upright 85–95° (gravity), not moving.
   - **User:** whole body in frame (per-side bars), centered, distance right (body height in frame within a target band; "Step back" / "Come closer"), A-pose matched (arm angle from landmarks), one person only.
   - **Light:** mean brightness on the body high enough, no strong backlight (background much brighter than body), lower body not much darker than upper (shadows).
   - **Background:** plain enough — edge/texture density and color variance in the background area (outside the body mask), no hard-edged objects touching the outline (furniture, door frames), contrast between body and wall; mask confidence high along the whole outline. Messages: "Too busy behind you — stand in front of a plain wall", "Your outline blends into the wall — try a different wall or clothes".
   - Same checks keep running during the rotation; a drop pauses the scan.

### 3.2 Models and the 3D fit
- **Live guidance:** MediaPipe Pose Landmarker (*full*, VIDEO mode, `numPoses: 2` to catch a second person), GPU delegate in a worker, with CPU/main-thread fallback if worker+GPU fails on Safari.
- **Outline per capture:** MediaPipe multiclass segmenter on a crop around the person (from landmarks), 512 px variant if available, **CPU delegate** (GPU returns scrambled classes on iOS Safari), edges refined at full camera resolution (guided filter). Body = body skin + face skin + clothes + "hair" below the neck (body hair); head hair excluded.
- **3D fit:** MHR body model taken straight from `facebookresearch/MHR` (Apache-2.0), converted at build time to a compact binary (template, 45 identity blendshapes, skinning, skeleton; decimated ~6.9k-vertex mesh for the fit; pose correctives skipped). Start: mean MHR body scaled to height. Optimizer: Levenberg–Marquardt on CPU in a worker over ~110 parameters (45 shape + ~20 pose + per view yaw and x/z translation + focal length), residuals = projected mesh outline → mask edge (distance transform, analytic gradient) + landmark reprojection + height constraint; perspective camera, focal length unknown, phone height and tilt as priors. WebGPU not required. Target < 20 s (measured in the spike).
- **InstantHMR: not used by default** (its weights and `mhr-body.onnx` are under the SAM License, not open source). Optional later only if Leo accepts that license (with `LICENSE-SAM` bundled).
- **Cross-check:** visual hull + Cauchy only for neck, chest, waist, hips (torso slices seen cleanly in most views). Arms, forearms, thighs, calves come from the fit only, measured perpendicular to the bone.
- **Measurement levels** (no navel/armpit landmarks in MediaPipe): defined on the fitted mesh — neck just below the larynx level (fraction along head–shoulder), chest at the armpit level, waistUpper = narrowest between lowest rib and hip crest, waistLower = navel level, hips = widest around the buttocks, upper arm mid humerus, forearm widest, thigh mid femur (and widest below glutes), calf widest. Navy: men waist at navel (waistLower) + neck; women narrowest waist (waistUpper) + hips + neck; inches + log10.

### 3.3 Hosting, audio, screen
- All model files and wasm self-hosted: MediaPipe `FilesetResolver` pointed at our own path (default is jsDelivr/Google storage); no onnxruntime unless InstantHMR is added. CSP `connect-src 'self'` so a stray CDN fetch fails loudly.
- Models in a separate runtime cache downloaded on the first scan with a progress screen (not precached: Workbox skips > 2 MiB and every update would re-download). Files < 100 MB for GitHub Pages; MHR binary generated at build time, not committed if large.
- Voice: short bundled clips (generated on the Mac at build time), `speechSynthesis` fallback; `navigator.audioSession.type = "playback"` so the silent switch doesn't mute them; shutter sound via Web Audio. On-screen text mirrors every cue, very large type (readable at 1.5 m), announced to VoiceOver.
- Wake lock held, re-acquired on `visibilitychange`.

### 3.4 Error states
Camera denied (standalone PWA may ask on every launch) · motion denied · models still downloading / offline · too dark or backlit (brightness/contrast check) · too close / too far / cut off (per-side red bars) · person lost mid-turn → pause, "Step back into the frame" · two people · wrong direction · pose drifting from A-pose · phone moved or tilted → restart · app backgrounded or call → discard frames, restart · cancel anytime · fit failed or low confidence → "Let's scan again" · delete a scan (show it first, then confirm) · edit a scan's weight/height afterwards.

## 4. Validation

- **Spike first, on Leo's iPhone** (hidden test page, report to copy): model load time, live fps, per-capture time, fit time, memory peak, worker+GPU vs CPU, camera crop/lens behavior, field of view at 1.5 m.
- **Synthetic bench (made-up bodies only):** random MHR shapes rendered at the 12 hours with noise (incl. hairy-chest texture, underwear, tight clothes) → full pipeline → error vs exact. Target ≤ 1.5 cm torso, ≤ 1 cm repeat.
- **Real check, local only:** Leo's own tape measurements compared to his scans, kept under `docs/source/` (git-ignored) — never committed.
- Repeat test: two scans back to back must agree within the repeat error, else "scan again".
- Privacy test: nothing image-like is ever stored.

### Spike results — Leo's iPhone, Nov 24 2026 (v0.1.237)
- **Fast enough on the phone; no server needed.** 3D fit benchmark: 36 ms per iteration → ~1 s for 30 iterations.
- **Live pose: run it in a worker on the GPU** (40 fps). The main-thread GPU path spent 13 s compiling shaders (unusable); CPU on the main thread gives 12 fps, CPU in a worker 19 fps (fallback). Warm the models up while the tutorial is shown.
- **Per capture:** segmentation on CPU ~280 ms at 1920×1080 (classes looked right; the GPU gave the same classes but took 11 s the first time → stay on CPU); heavy pose + mask ~120 ms.
- **Model loading:** 0.6–3.4 s each → load during the tutorial / weight & height step.
- **Camera came back landscape (1920×1080) even though portrait was asked**, so the body used only the middle third of the width and was cut off at the bottom at ~1.5 m (tilt was 75°, leaning back). Fix: get real portrait frames (exact constraints, or rotate), then re-check the distance. The tilt check (85–95°) would have caught the lean.
- **Camera fix found (camera check 2, v0.1.240):** iOS Safari swaps the asked size: asking **landscape 4:3** (`width: {exact: 1920}, height: {exact: 1440}`) returns a real **portrait 1440×1920**, upright, with the widest top-to-bottom view (nose→hip 29% of the frame → whole body fits with room at ~1.5 m). Asking 4032×3024 returns full-sensor portrait **3024×4032** (same view, ~0.6 mm per pixel on the body). Asking portrait sizes gives landscape or a cropped 16:9 view; square 4032 shows less top-to-bottom. Rule for the scanner: ask landscape 4:3; if the stream comes back landscape, ask the portrait sizes instead; use whichever is portrait. Live guidance on a downscaled bitmap, captures at full 3024×4032 (process and close right away). The 4:3 front camera is the same on iPhone 14–16, so this should hold for all supported phones (check on others when possible).
- WebGPU adapter OK; wake lock, motion permission, audio session all work. Speech voices list was empty at start (loads late) → bundled voice clips stay the plan.
- No crash / memory problem.

## 5. Interpretation (permanent)

- `src/core/body/trends.ts`: change per part over 4/8/12 weeks, left/right balance, smoothed over the last scans.
- A change counts only if it exceeds the measured repeat error over ≥ 3 scans (arm growth in trained adults is millimetres per month, so arms/forearms/calves will rarely qualify; research before building, nothing guessed).
- Growth vs fat: limb/chest change read together with waist and body-fat change.
- Parts → muscles: chest → chest; upper arm → biceps/triceps; forearm → forearms; thigh → quads/hams/glutes; calf → calves.

## 6. Effect on the plan (permanent)

- Every 4–6 weeks, with ≥ 3 good scans, a suggestion card on Today like the deload card ("Arms haven't grown in 8 weeks: +2 sets a week for biceps and triceps?" Accept / Not now). Accepting raises the weekly target for those muscles and uses the existing volume/plan logic. Limits and steps from research.

## 7. Screens

- **Scan flow:** as in the reference flow below, in Blue Fit's look, the line man as the pose guide.
- **Results:** rotatable 3D body as an **SVG wireframe** in the figure engine's line style (projected in core; drag to turn; no auto-spin with reduced motion), callouts with value + change arrow, body fat and weight, compare with any older scan; color map and side-by-side later. three.js only if SVG is too slow.
- **Progress → Body section:** latest scan, chart per part, left/right balance.
- **Settings:** height, sex, length unit.
- 44 px+ targets, actions at the bottom, reduced motion respected.

## 8. Privacy

Scans live only on the phone (IndexedDB, in the backup JSON). Photos only in memory during the scan. No uploads, no external hosts. Tests use made-up bodies. Never commit screenshots of other apps, real scans or tape values.

## 9. Roadmap (native app)

Native camera scanner (same front-camera flow, native pose/segmentation) producing the same `BodyGeometry`; scans get `source: "native-camera"`; overlap scans to measure the bias. Measuring, storage, interpretation, Progress and plan unchanged. No LiDAR.

## 10. Build order (APP_SPEC updated and version bumped in every step)

0. Spike on the iPhone + MHR conversion check (size, license notice).
1. Core types, `measure.ts` + Navy tests, storage table, export/import, settings.
2. Progress Body section + manual entry (`source: "manual"`, no geometry) for testing.
3. Web scanner: capture flow + guidance, segmentation, fit, synthetic bench.
4. Results screen (SVG 3D), error states.
5. Interpretation + research-based rules, suggestion card.
6. Agent review, push.

## Reference scan process (ZOZOFIT app-only scan)

Sources: help.zozofit.com "Tips for Scanning" articles and "Why is my scan failing?"; zozofit.com "Top 10 FAQs" (Apr 2024); Leo's screenshots (Nov 24 2026). We copy the flow, not their look or text.

- **Modes:** Detailed Scan, 12 angles (more accurate) or Quick Scan, 4 angles (beta). Turntable diagram with clock positions 1–12 under the figure.
- **Camera:** front (selfie) camera, iPhone.
- **Before first scan:** a tutorial video (process + best environment).
- **Phone:** completely upright (90°), not tilted; on a level, stable surface at or slightly above waist height (table/desk, not floor, not couch); at the table's edge so the table doesn't hide the lower body.
- **Where to stand:** about 5 ft (1.5 m) from the camera, further if tall; centered so the on-screen guides turn green; room behind; stay the same distance while turning.
- **Pose:** arms straight, a few inches from the sides (not 90°, not against the body); feet hip-width apart, legs not touching; same pose the whole scan.
- **Environment:** plain wall, no clutter, no art/posters/mirrors/curtains/patterns, no other people or pets, table edge not in frame.
- **Lighting:** bright and even; no window behind; no harsh overhead light, direct sun, or shadows; lower body not darker.
- **Clothing:** skin-tight sportswear, swimwear, underwear or tights, color contrasting with the wall; no baggy shorts, skirts, sweatpants, jeans, shoes or socks; smooth creases.
- **Rotation:** audio prompts tell you to turn to each position; full 360°, done in about 1 minute; results in under 2 minutes.
- **Output:** 3D mesh, 12 measurements (neck, shoulders, arms, waist, hips, thighs, calves…), body fat % by the U.S. Navy method; ~1 cm error without the suit.
- **Scan fails when:** part of the body (often lower body) is out of frame, the background is cluttered or patterned, or the lighting is poor.
- **Consistency:** scan every 2–4 weeks, same time of day, posture and lighting.

### Reference flow screen by screen (Leo's screenshots, Nov 24 2026)

1. **Start Scan · Step 1 of 2 · Weight & Height:** two rows prefilled from last time (tap to edit), "confirm your current weight & height for accurately calculating measurements and body fat". Continue. Below: privacy note (photos processed on the device, deleted right after, never stored or uploaded).
2. **Step 2 of 2 · Set Volume:** "slide the volume bar past halfway to hear the audio instructions"; slider with a halfway mark, fill turns green past it. Big round **Start Scan** button; **Watch Tutorial** link under it.
3. **Tutorial** (4 segments in a progress bar on top, back arrow):
   1. **Pre-Scan Checklist** (green ticks): clear space with uncluttered floor · skin-tight clothes · full body visible, no obstructions · remove all accessories · remove shoes and socks. Next.
   2. **Position Your Phone at Waist Height:** side-view illustration: phone upright on a table edge (mug behind it), green camera cone to the person standing at a distance. Caption cycles, Next stays gray until done: "find a level surface at or slightly above waist height" → "place your phone completely upright near the edge of a surface" → "do not place your phone on the floor".
   3. **Stand in the Frame & Raise Your Arms:** phone mockup of the scan screen (4 green guide bars, person in A-pose). Captions: "step back until you are centered in the frame and the guides turn green" → "keep your arms slightly raised from your sides for the entire scan".
   4. **Rotate Clockwise within the Frame:** person on a floor dial with hours 1–12; a wedge points at the current hour (shown at 3, side view). "Voice instructions will guide you to slowly rotate in place, pausing at each hour." Button: Start Scan.
4. **Phone Height** (camera on): same side-view scene with a zoom bubble of the phone upright on the table edge. "Place your phone near the edge of a waist-height surface" → "Once your phone is in position, tap Continue". Continue.
5. **Phone Angle** (motion sensor): live tilt in degrees (e.g. 87°) in green; phone outline inside a dashed target frame; green glow when in range. "Hold your phone upright until the device sits inside the lines and turns green" → "Perfect. Keep it there." (auto-advances).
6. **Scan in Progress** (front camera, live preview in a rounded frame): 4 guide bars (top, bottom, left, right), green when the whole body is in frame, red (coral) when not. Demo first: A-pose example with "Stand with your whole body in frame and match this pose" → "Green is good — any red means you are not fully in the frame yet". Toast on top when the camera starts: "Captured photos are processed on your device and are not stored."
7. **Rotation** (Leo): 12 o'clock = facing the phone (first photo). Voice: "Turn to 1 o'clock" → camera-shutter sound when the photo is taken → "Turn to 2 o'clock" … up to 11 o'clock. Turned too far → "You turned too much"; not far enough → it repeats "Turn to n o'clock". The user never sees the photos.
8. **Results** (no photos shown, only the 3D body):
   - Rotatable 3D wireframe body (grid mesh) filling the screen.
   - Callout lines from points on the body to values in inches: Chest, Upper Arm (R/L), Forearm (R/L), Upper Waist, Lower Waist, Hips, Thigh (R/L). Value color shows the change vs. the previous scan (two colors; up vs. down).
   - Bottom: LATEST body fat % (big) with date; PREVIOUS: difference with arrow and the previous scan's date (tap to pick another scan); "<date> comparing to previous scan"; BMI and weight.
   - Top: close, "Select Body Part" dropdown (focus one part), chart icon (history per part), share.
   - Tabs: Posture, Booty, Measurements, ColorMetric (color map of where the body grew/shrank), Side-By-Side (two scans).

### Our version (same flow, Blue Fit look and words)

- Same order: weight & height → sound check → tutorial (first time; later via a link) → phone height → phone angle → frame + pose → 12-hour rotation → processing → results.
- Clothing in our checklist: "Underwear, swimwear or skin-tight clothes" (underwear first: most men don't own tight clothes; Leo, Nov 24 2026). Skin is segmented as body, so underwear is the most accurate; the wall should contrast with skin tone.
- Weight & height prefilled from the last scan; sex asked once and editable in Settings (the Navy body-fat formula differs for men and women).
- Pose guide = the line man in A-pose (arms slightly out, feet hip-width); the turntable dial uses the line man too.
- Web limits to handle:
  - iOS web can't read or set the volume → "Turn your volume up" + a **Test sound** button instead of the slider.
  - Tilt: motion permission from a tap on the Phone Angle step (see §3.1.6).
  - Voice: see §3.3.
  - Screen wake lock during the scan; front camera via `getUserMedia({ facingMode: "user" })`.
  - Guide bars per side: each bar turns red only on the side the body is cut off (or too close), from the segmentation mask.
- Rotation: same voice cues + shutter sound; the turn angle is checked from the pose landmarks (shoulder/hip width and facing side) and the shoulder line's rotation; too far → "You turned too much, turn back a little", too little → repeat the cue. Auto-capture when steady at the right angle.
- Results in Blue Fit: the 3D body drawn in the app's line style (rotatable, drag to turn), callouts for each part with the value and change arrow, body fat and weight at the bottom, compare with any older scan; a color map (grew/shrank) and side-by-side as later steps. Posture and Booty tabs: not planned unless Leo asks.
