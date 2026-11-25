# Body scan: plan

Goal: scan the body with the phone's front camera, build a 3D body and measurements per part, track them over time, and let them adjust the plan. Camera only, always (no LiDAR: Pro-only; Leo, Nov 24 2026). The web scanner is temporary; the native app swaps in a native camera scanner with the same flow. Measuring, storage, interpretation, Progress and plan effects are permanent.
Reviewed twice by an agent (Nov 24 2026); all findings applied below.
**Supported:** every iPhone from the iPhone 14 on (Leo, Nov 24 2026), **iOS 18.4+** (OffscreenCanvas WebGL in workers; wake lock in home-screen mode fixed in Safari 18.4); checked in `capabilities()`. Tested first on Leo's iPhone 16 Pro. iPhone 17 models have a square 18 MP front sensor with Center Stage → covered by the camera rule (§3.1.2) and tested in spike 2.

## 1. Architecture (swappable scanner)

```
[Scanner: capture + 3D fit]  →  BodyGeometry  →  [core/body/measure]  →  BodyScan  →  [Interpretation]  →  Progress / Plan
        temporary                 contract          permanent            permanent        permanent
```

- **The scanner returns geometry only, never measurements**, so web and native scanners measure the same way.
- **Every scanner must provide the same fixed level keys** (`LEVEL_KEYS`): `neckBase`, `neckTop` (axis for the neck tape), `armpit`, `lowestRib`, `navel`, `hipCrest`, `buttocksMax`, `crotch`, `kneeMid`; limb axes: `shoulderL/R`, `elbowL/R`, `wristL/R`, `hipJointL/R`, `kneeL/R`, `ankleL/R`. The scanner finds them on its own 3D body (web: on the fitted MHR mesh); `measure.ts` picks slices only from these keys.
- `src/core/body/types.ts` (framework-free, portable to Swift):
  - `BodyGeometry { torsoSlices: { yCm: number; polygon: [number, number][] /* x,z in mm, ints */ }[] (1 cm steps, **torso vertices only** — arms/hands excluded by skinning labels), limbSections: { part: LimbPart; axis: [[x,y,z],[x,y,z]] (cm); sections: { tCm: number; polygon: [number, number][] }[] }[] (perpendicular to the bone, 1 cm steps), neckSections: same shape along the neck axis, levels: Record<LevelKey, number /* yCm */>, limbAxes: Record<AxisKey, [number,number,number]>, shape?: { model: "MHR"; version: string; body: number[20]; pose: number[] }, viewQuality: number[12] (0–1), scannerId: string, scannerVersion: string }`
  - `BodyScan { id: string; date: string /* ISO date-time, local */; source: "web-camera" | "native-camera" | "manual"; scannerVersion: string; measureVersion: number; heightCm: number; weightLb?: number; sex: "male" | "female"; geometry?: BodyGeometry; measurements: Partial<Record<BodyPart, number>> /* cm */; bodyFatPct?: number; waistToHeight?: number; confidence: Partial<Record<BodyPart, number>> /* 0–1 */ }`
  - `BodyPart`: neck, chest, waistUpper (narrowest, lowest rib → hip crest), waistLower (navel), hips, upperArmL/R, forearmL/R, thighL/R, calfL/R.
- `src/core/body/measure.ts` (pure maths, `MEASURE_VERSION = 1`): convex-hull perimeter of torso slices (= tape), limb and neck sections, Cauchy cross-check, Navy body fat, waist-to-height, confidence. **When `MEASURE_VERSION` changes, stored geometry is re-measured** (scans with geometry keep one trend line).
- `src/core/body/scanner.ts`: `interface BodyScanner { id; version; capabilities(): Promise<{available, reason?}>; run(input: {heightCm, sex}): Promise<BodyGeometry> }` — no UI types; the scanner owns its capture screens; shared screens (weight & height, results) live outside it.
- `src/scan/web/`: everything web-only (camera, models, guidance, fit). `src/scan/registry.ts` picks the scanner.
- **The real long-term contract** (for a Swift rewrite) is the stored `BodyScan` JSON schema + `LEVEL_KEYS` + the measurement definitions in APP_SPEC; all written down there.
- **Trends never mix methods:** scans compare only within the same `source` (and re-measured to the current `measureVersion`); a source change shows a "method changed" break. When the native scanner arrives: a few same-day overlap scans (web + native) to measure the bias.

## 2. Storage, settings, backup

- `bodyScans` table: add to `TABLES`/`TABLE_KEYS` (key `id`), `Tables`, `AppData`; idbAdapter `DB_VERSION` → next (the `onupgradeneeded` loop creates the store); `exportAll`/`replaceAll` include it; Reset clears it; Dexie old-data test still opens.
- `exportFormat`: `SCHEMA_VERSION` → 2 with a `migrate()` step (`bodyScans: []` for v1), so an older app refuses a newer backup instead of silently dropping scans; `bodyScans: z.array(bodyScanSchema).default([])`.
- Settings: `heightCm: number | null`, `sex: "male" | "female" | null` (asked once on the first scan, editable in Settings), `lengthUnit: "in" | "cm"` (default in). `units` stays lb. Each scan stores the height and weight confirmed on its Step 1 screen; confirming also updates Settings (the scan's own values win for that scan).
- APP_SPEC §4.8 `BodyEntry` (inches, `photoIds`) is replaced by `BodyScan` in step 1.
- Mesh rebuild from `shape` needs the MHR file; if it isn't cached (evicted, or scan imported on another phone), the results view draws the stored slices/sections instead.
- Export screen note: "Contains body measurements."

## 3. Web scanner

### 3.1 Capture
1. Phone upright on a waist-height surface, front camera, user ~1.5 m away. The real field of view is measured live from the body's height in pixels; "Step back" / "Come closer" follow it.
2. **Camera rule:** ask landscape 4:3 (`width: {exact: 4032}, height: {exact: 3024}`, then 1920×1440); **accept only a portrait stream** (iOS swaps it: 3024×4032); if it comes back landscape, try the portrait sizes; if nothing is portrait → "This phone's camera isn't supported yet". Zoom fixed at 1. Spike 2 checks Center Stage (iPhone 17) doesn't crop or follow the user; if it does, the scanner refuses that camera mode.
3. Live guidance frames: `createImageBitmap(video, { resizeWidth: 720, resizeHeight: 960 })`, transferred to the worker. Captures: one full-resolution `createImageBitmap(video)` per hour (no ImageCapture in Safari). Front-camera frames are unmirrored (preview mirrored by CSS only); anatomical left/right pinned from the first frame and carried through.
4. **Turn tracking:** angle followed continuously, clockwise only (no jumping back), from shoulder/hip yaw in world landmarks + nose/face visibility (front vs back) + silhouette width; never decided from one frame. Too far → "You turned too much"; not enough → repeat the cue. Auto-capture when steady at the hour.
5. **Per capture, right away (in the worker):** crop to the person, pose heavy (IMAGE, CPU, ~120 ms) for landmarks + its mask, multiclass segmentation (CPU), refine, keep only the mask (crop size, 1 byte/pixel) + landmarks, `close()` the bitmap. Peak memory budget < 600 MB (measured in spike 2). Frames never touch IndexedDB, crash-recovery state, the SW cache or logs.
6. Phone tilt: gravity vector from `DeviceMotionEvent.accelerationIncludingGravity` (not Euler angles); permission from a tap; 85–95° = green; must stay green during the scan; if it moves → restart. Permission denied → continue with "tilt not checked".
7. **Pre-scan room check** (live, before the countdown; each shows a fix in words + voice, scan waits until green):
   - **Phone:** upright 85–95° (gravity), not moving.
   - **User:** whole body in frame (per-side bars), centered, distance right (body height in frame within a target band; "Step back" / "Come closer"), A-pose matched (arm angle from landmarks), one person only.
   - **Light:** mean brightness on the body high enough, no strong backlight (background much brighter than body), lower body not much darker than upper (shadows).
   - **Background:** plain enough — edge/texture density and color variance in the background area (outside the body mask), no hard-edged objects touching the outline (furniture, door frames), contrast between body and wall; mask confidence high along the whole outline. Messages: "Too busy behind you — stand in front of a plain wall", "Your outline blends into the wall — try a different wall or clothes".
   - Same checks keep running during the rotation; a drop pauses the scan.

### 3.2 Models
- **Live guidance:** MediaPipe Pose Landmarker *full*, VIDEO mode, **GPU delegate in a worker** (40 fps measured); fallback **CPU in a worker** (19 fps). `numPoses: 2` (second person check) verified in spike 2. **Warm-up starts on the Weight & Height step** (first GPU compile can take seconds; the tutorial is skipped after the first scan).
- **Outline per capture:** MediaPipe `selfie_multiclass_256x256` (the only multiclass model; classes background, hair, body-skin, face-skin, clothes, others), **CPU delegate**, on the person crop. 256 px on a ~1300×3500 px crop is ~8 mm per mask pixel, so the edge is refined at full resolution: guided filter on the crop + the heavy pose model's own mask; spike 2 compares this against overlapping vertical tiles (3 tiles head/torso/legs) and keeps the better one. Body = body-skin + face-skin + clothes; whether body hair is tagged "hair" is tested in the synthetic/real checks before deciding to count hair below the neck as body.
- **InstantHMR: not used** (SAM License). Optional later only if Leo accepts that license.

### 3.3 3D fit (worker, CPU)
- **Body model:** MHR from `facebookresearch/MHR` (Apache-2.0, LICENSE + NOTICE shipped). Converted once on the Mac by `scripts/convert-mhr.py` (step 0) to a compact binary: one LOD (picked in step 0 by size/accuracy; target ≤ 8k vertices, file ≤ 10 MB), template, the **20 body identity blendshapes** (the 20 head and 5 hand coefficients fixed at 0), skeleton, linear skinning weights (pose correctives skipped), vertex part labels from skinning (torso / arm / hand / leg / head). Committed if ≤ 10 MB, else downloaded by a pinned, cached CI step.
- **Parameters:** 20 body shape coefficients; shared pose over ~20 joint angles (spine 2, spine 3, neck, shoulders 3+3, elbows 1+1, hips 3+3, knees 1+1) + small per-view arm offsets (shoulder 2+2) for arm drift; per view: body yaw + x/z on the floor; one camera: focal length, height (prior ~1 m), tilt from gravity (prior, small correction). ≈ 20 + 20 + 12×(3+4) + 2 ≈ 126.
- **Start:** yaw = hour × 30°; translation from the landmarks; pose from MediaPipe world landmarks; shape = mean; scale from height.
- **Coarse to fine:** (a) scale, yaw, translation, focal → (b) + pose → (c) + shape.
- **Residuals:** silhouette — per iteration find contour edges (faces flipping facing), held fixed for that iteration; **two-way chamfer**: model contour → mask via distance transform, and mask contour → nearest model contour point; DT at ¼ mask resolution then bilinear. Landmark reprojection (weighted 0.3). Height (head hair excluded) soft term. **Shape prior:** Gaussian on coefficients. Robust (Huber) loss.
- **Jacobians:** analytic through linear blend skinning, sparse rows (each vertex depends on ≤ 4 joints).
- **Levenberg–Marquardt:** λ start 1e-3, ×10 on a rejected step, ÷10 on accept; stop when step < 1e-6 or Δcost < 1e-4 relative; cap 80 iterations.
- **Failure detection → "Let's scan again":** any view IoU < 0.9, RMS edge distance > 3 px (at mask scale), any shape coefficient > 3σ, or torso slices vs visual hull differ > 2 cm.
- **Time:** the bench (36 ms/iteration) skipped skinning, contours and DT, so the real fit is expected at 3–15 s; budget < 20 s, measured in step 3a and on the phone in 3c.

### 3.4 Measurement definitions (in APP_SPEC)
- Torso tapes from torso-only slices (arms excluded by vertex labels): chest at `armpit`, waistUpper = narrowest between `lowestRib` and `hipCrest`, waistLower at `navel`, hips at `buttocksMax` — convex-hull perimeter. Neck: perpendicular to the neck axis just above `neckBase`. Limbs perpendicular to the bone: upper arm mid humerus, forearm widest, thigh just below the gluteal fold and mid femur (report the upper one), calf widest.
- **Cross-check:** visual hull + Cauchy only on torso levels, using only the views where the arms don't overlap the torso (drop 3 and 9 o'clock ±1 if they do).
- **Body fat (Hodgdon–Beckett / U.S. Navy), inches + log10:** men %BF = 86.010·log10(waist − neck) − 70.041·log10(height) + 36.76 (waist at navel = waistLower); women %BF = 163.205·log10(waist + hips − neck) − 97.684·log10(height) − 78.387 (waist = waistUpper). Tested against published worked examples; shown as an estimate (±3–4 %). Waist-to-height ratio shown too (the U.S. military now leans on it).

### 3.5 Hosting, audio, screen
- All model files and wasm self-hosted. `fetch-models.mjs` uses **pinned model versions** (no `/latest/`), versioned paths (`models/v1/…`). Inside the worker, `fetch` is wrapped to reject other origins (a page CSP doesn't cover workers); a test checks every model/wasm path is same-origin. Page CSP `<meta>` with `connect-src 'self'`.
- Models in a separate runtime cache downloaded on the first scan with a progress screen (not precached).
- Voice: short clips generated **locally** by `scripts/make-voice.ts` and committed (CI is Ubuntu). Voice source: an open-licensed TTS (e.g. Piper with a CC-licensed voice) unless the macOS voice license allows publishing; `speechSynthesis` fallback; `navigator.audioSession.type = "playback"`; shutter via Web Audio. On-screen text mirrors every cue, very large type, announced to VoiceOver.
- Wake lock held, re-acquired on `visibilitychange`.

### 3.6 Error states
Camera denied (standalone PWA may ask on every launch) · unsupported camera / iOS < 18.4 · motion denied · models still downloading / offline · too dark or backlit · too close / too far / cut off · person lost mid-turn → pause, "Step back into the frame" · two people · wrong direction · pose drifting from A-pose · phone moved or tilted → restart · app backgrounded or call → discard frames, restart · cancel anytime · fit failed → "Let's scan again" · delete a scan (show it first, then confirm) · edit a scan's weight/height afterwards.

## 4. Validation

- **Spike 1 (done, below).** **Spike 2** (before step 3b, on the iPhone; newest iPhone and an iPhone 14 if available): 3024×4032 stream fps with live pose on downscaled bitmaps; peak memory with 12 captures processed + fit arrays; mask quality (guided filter vs tiles); worker GPU first-compile time; `numPoses: 2` on GPU; Center Stage behavior on iPhone 17.
- **Synthetic bench (made-up bodies only, Node/Vitest):** random MHR shapes rendered at the 12 hours with noise → fit + measure → error vs exact. Target ≤ 1.5 cm torso, ≤ 1 cm repeat. Optimistic by design (MHR fitting MHR renders): real validation is Leo's tape check.
- **Real check, local only:** Leo's tape measurements vs his scans, kept under `docs/source/` (git-ignored).
- **Repeatability:** back-to-back scans give SEM per part; MDC95 = 1.96·√2·SEM per part (stored locally, used by §5).
- **Debug export (dev only, localhost only):** masks + landmarks saved to the Mac for tuning; never in production, never committed.
- Privacy test: nothing image-like is ever stored.

### Spike 1 results — Leo's iPhone 16 Pro, Nov 24 2026 (v0.1.237–0.1.240)
- **Fast enough on the phone; no server needed.** Simplified fit benchmark: 36 ms per iteration (real fit expected 3–15 s, §3.3).
- **Live pose: worker + GPU** (40 fps). Main-thread GPU spent 13 s compiling shaders (unusable); CPU main thread 12 fps; CPU worker 19 fps (fallback).
- **Per capture:** segmentation on CPU ~280 ms at 1920×1080 (GPU same classes but 11 s first time → CPU); heavy pose + mask ~120 ms.
- **Model loading:** 0.6–3.4 s each → load during the Weight & Height step.
- **Camera:** asking portrait sizes gave landscape or a cropped 16:9 view; asking **landscape 4:3 returns real portrait 3:4** (1440×1920 or full 3024×4032), upright, widest top-to-bottom view (nose→hip 29% of the frame → whole body fits at ~1.5 m; ~0.6 mm per pixel at full size). Square 4032 shows less top-to-bottom. → §3.1.2.
- WebGPU adapter OK; wake lock, motion permission, audio session work. Speech voices load late → bundled clips.
- No crash / memory problem.

### Step 3a results (Nov 24 2026, made-up bodies, Intel Mac)
- 12 of 12 random bodies converge. Errors vs the true body: chest ≤ 0.8 cm, upper waist ≤ 1.3, lower waist ≤ 1.8, hips ≤ 0.7, limbs ≤ 1.4, neck ≤ 2.5 (most under 1 cm). 9–19 s per fit here (the iPhone ran the fit benchmark 3× faster).
- What made it work: fit on **LOD 2** (LOD 3 inflated the body ~1 cm to match), size **locked to the entered height** (otherwise it traded size for distance), outline distances to the **true pixel edge** (edge pixels' centers shrank the body half a pixel), the **scan pose** as the base pose (MHR's rest pose holds the arms ~50° out), hip cuts **include the legs** (a hip tape goes around both buttocks), measuring in the **standard pose** (posture changes don't move tapes), waist levels from **front-midline surface points**, and a robust edge check (90th percentile ≤ 2 px).
- Known weak spot: the neck (±2.5 cm). Lower waist depends on where the navel sits on the fitted body.

### Fit review fixes (Nov 24 2026, v0.1.248)
Edge distance now true size (was ~½); size locked to the height **standing straight** (posture left out); Huber on both outline terms; masks cleaned (biggest blob + blobs ≥ 5% of it, small holes filled, real gaps like arm–hip kept); edge points on the image border ignored; camera **tilt fitted** with a prior from the phone's gravity reading; landmark trust per joint (hips/shoulders/head weaker); left/right swap only for hours 4–8; each photo's turn bounded to ±34° of its hour and **picked by outline overlap** at the start and again after each stage for photos matching < 0.95; hands left out of the quality check; the camera model is no longer mirrored (user's left = image right, like the real front camera); the turn direction is tried both ways.
Tests: normal, turning the other way with a 6° tilt and ±10° sloppy turns, both pass (torso ≤ 1.5 cm, limbs ≤ 2 cm). Fit time grew to 20–35 s on the Intel Mac (iPhone ~3× faster).

### Open items (next session)
1. Quality-check false alarm: a good fit (overlap 0.985) can still show a 90th-percentile edge distance of ~18 px in one photo (seed 6). Find which points and fix the metric.
2. Damaged masks (floor shadow at the feet, ragged edges): fit misses by 2–4 cm; cut the mask below the feet / handle shadows, then re-enable `damage: true` in the tests.
3. Dev server: the worker can't import MediaPipe's runtime from `public/` (Vite blocks it); load it as an asset (`@mediapipe/tasks-vision/vision_wasm_module_internal.js?url` + `.wasm?url` as a WasmFileset). Production works.
4. Speed: reuse Jacobian/column buffers, no allocations in `viewRes`/`stateMul`/`poseVertices`, grid nearest search (review #16–18).
5. Neck cuts: keep only the loop around the neck axis (±8 cm); thigh cuts start below the crotch; exact cuts at armpit/navel height (review #12–14).
6. Step 3b screens are written (`src/ui/screens/Scan.tsx`, worker, client, guide) but untested on a phone → spike 2 + first real scan with Leo; then step 4 (3D results), step 5 (research note for Leo's OK).

## 5. Interpretation (permanent)

- `src/core/body/trends.ts`: change per part over 4/8/12 weeks, left/right balance, smoothed over the last scans.
- A change is real only if it exceeds that part's **MDC95** (from repeat scans) and holds over ≥ 3 scans. Arm growth in trained adults is millimetres per month, so arms/forearms/calves will rarely qualify.
- Growth vs fat: limb/chest change read together with waist and body-fat change.
- Parts → muscles: chest → chest; upper arm → biceps/triceps; forearm → forearms; thigh → quads/hams/glutes; calf → calves.

## 6. Effect on the plan (permanent)

- Suggestion card on Today like the deload card ("Arms haven't grown in 8 weeks: +2 sets a week for biceps and triceps?" Accept / Not now). Accepting raises the weekly target for those muscles via the existing volume/plan logic.
- **Gates (all required):** ≥ 3 good scans over ≥ 6 weeks; not in a cutting phase (`profile.phase`); the logged weekly sets actually met the current target for those muscles; waist and body fat stable (within MDC); cooldown 6 weeks per muscle after a suggestion.
- **Step sizes, maximum target and cooldown come from a short research note** (dose-response meta-analyses, e.g. Schoenfeld 2017, Pelland 2024) written before step 5 and **approved by Leo**; nothing guessed.

## 7. Screens

- **Scan flow:** as in the reference flow below, in Blue Fit's look, the line man as the pose guide.
- **Results:** rotatable 3D body as an **SVG wireframe** in the figure engine's line style (projected in core; drag to turn; no auto-spin with reduced motion), callouts with value + change arrow, body fat, waist-to-height and weight, compare with any older scan; color map and side-by-side later. three.js only if SVG is too slow.
- **Progress → Body section:** latest scan, chart per part, left/right balance.
- **Settings:** height, sex, length unit.
- 44 px+ targets, actions at the bottom, reduced motion respected.

## 8. Privacy

Scans live only on the phone (IndexedDB, in the backup JSON). Photos only in memory during the scan. No uploads, no external hosts (worker fetch guard). Tests use made-up bodies. Never commit screenshots of other apps, real scans, debug exports or tape values.

## 9. Roadmap (native app)

Native camera scanner (same front-camera flow, native pose/segmentation) producing the same `BodyGeometry` + `LEVEL_KEYS`; scans get `source: "native-camera"`; overlap scans to measure the bias. Measuring, storage, interpretation, Progress and plan unchanged. No LiDAR.

## 10. Build order (APP_SPEC updated and version bumped in every push)

0. ✅ **MHR conversion (done Nov 24 2026, v0.1.243).** `scripts/convert-mhr.py` (numpy only) → `public/mhr/v1/mhr-lod3.bin` (1.5 MB, 4,899 vertices: **used for the fit**) and `mhr-lod2.bin` (3.3 MB, 10,661 vertices: **used for measuring** — LOD 3 reads torso tapes ~0.3 cm short of LOD 2, LOD 4 ~1 cm). `src/core/body/mhr.ts` rebuilds the body (rest shape, skeleton, skinning) and matches MHR's own PyTorch rig to < 0.01 cm (`mhr.test.ts`, fixture from `scripts/mhr-reference.py`). Mean body 172.5 cm, cm units, y up, rest pose = T-pose. Note: in MHR the identity shapes don't move the skeleton; height and limb lengths come from the `scale_*` / `*_flexible` model parameters (fitted with the pose). Part labels per vertex (torso/arm/hand/leg/neck/head). LICENSE + NOTICE in `public/mhr/`. Not precached (runtime cache on first scan).
1. ✅ (v0.1.244) **Core data:** types, `LEVEL_KEYS`, `measure.ts` + Navy tests, storage table, `SCHEMA_VERSION` 2 + migrate, settings, APP_SPEC §4.8 replaced. Done when: Navy worked examples pass, an old v1 backup imports, old DBs open.
2. ✅ (v0.1.245) **Progress Body section + manual entry** (`source: "manual"`, no geometry). Done when: manual scans show, chart, delete (shown first), edit.
3a. ✅ (v0.1.247) **Fit + measure in Node/Vitest** on synthetic masks from random MHR bodies. Done when: torso error ≤ 1.5 cm, limbs ≤ 2 cm, fit converges on 95% of cases, time measured.
3b. 🟡 (code written, v0.1.248; needs the phone) **Spike 2** on the iPhone (§4). Then **capture flow + guidance** in the app (tutorial, Weight & Height, sound check, phone height, tilt, room check, 12-hour rotation with voice). Done when: a full rotation captures 12 good masks on the phone.
3c. **Integrate on the phone:** masks → fit → measure → save. Done when: two back-to-back scans agree within 1 cm on torso, fit < 20 s.
4. **Results screen** (SVG 3D) + all error states. Done when: every §3.6 state is reachable and shown.
5. **Research note → Leo's OK → interpretation + suggestion card.** Done when: gates tested with made-up scan histories.
6. **Agent review, remove `spike.html` from the build, push.**

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
  - Voice: see §3.5.
  - Screen wake lock during the scan; front camera via `getUserMedia({ facingMode: "user" })`.
  - Guide bars per side: each bar turns red only on the side the body is cut off (or too close), from the segmentation mask.
- Rotation: same voice cues + shutter sound; the turn angle is checked from the pose landmarks (shoulder/hip width and facing side) and the shoulder line's rotation; too far → "You turned too much, turn back a little", too little → repeat the cue. Auto-capture when steady at the right angle.
- Results in Blue Fit: the 3D body drawn in the app's line style (rotatable, drag to turn), callouts for each part with the value and change arrow, body fat and weight at the bottom, compare with any older scan; a color map (grew/shrank) and side-by-side as later steps. Posture and Booty tabs: not planned unless Leo asks.
