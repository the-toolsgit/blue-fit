// Pinhole camera + per-view body placement for the scan fit (docs/plans/body-scan.md §3.3).
// World: cm, y up, floor y = 0. The phone sits at (0, h, 0) looking along +z, pitched by
// `pitch` (radians, + = tilted up, from gravity). For each photo the body (model space: y up,
// front = +z) is turned by `yaw` about the vertical axis and stands at (tx, 0, tz).
// Image: u right, v down, pixels, as the camera sees it (not mirrored): the user's left shows on the image's right.

export interface Cam { f: number; cx: number; cy: number; h: number; pitch: number }
export interface View { yaw: number; tx: number; tz: number }

/** Project n points (xyz triples, model space, already scaled) into one view. */
export function project(pts: ArrayLike<number>, n: number, view: View, cam: Cam, out: Float64Array) {
  const c = Math.cos(view.yaw), s = Math.sin(view.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    const wx = c * x + s * z + view.tx;
    const wz = -s * x + c * z + view.tz;
    const yc = y - cam.h;
    // pitch about the camera's x axis
    const Y = cp * yc - sp * wz;
    const Z = sp * yc + cp * wz;
    const iz = 1 / Math.max(1, Z);
    out[i * 2] = cam.cx - cam.f * wx * iz;
    out[i * 2 + 1] = cam.cy - cam.f * Y * iz;
  }
}

/** Depth along the view direction (for sorting / back-face tests). */
export function viewDir(view: View): [number, number] {
  return [Math.sin(view.yaw), Math.cos(view.yaw)];
}
