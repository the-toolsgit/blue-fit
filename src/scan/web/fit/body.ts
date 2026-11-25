// The body the scan fit moves: MHR (core/body/mhr.ts) with the parameters the fit is allowed
// to change. Body shape = the 20 body identity coefficients; posture = a few joint angles
// (arms, legs, spine); proportions = MHR's bone-length scales (in MHR the identity shapes don't
// move the skeleton). Then one uniform scale, feet on the floor (y = 0).
import { MODEL_PARAMS, poseVertices, skeletonState, type MhrModel } from "../../../core/body/mhr";

export const POSE_PARAMS = [
  "l_uparm_ry", "l_uparm_rz", "r_uparm_ry", "r_uparm_rz", "l_elbow_bend", "r_elbow_bend",
  "l_upleg_ry", "l_upleg_rz", "r_upleg_ry", "r_upleg_rz", "l_knee_bend", "r_knee_bend",
  "spine_lean0", "spine_bend0", "neck_lean",
] as const;
export const SCALE_PARAMS = [
  "scale_spine_length", "scale_neck_length", "scale_shoulder_width", "scale_uparms", "scale_lowarms",
  "scale_hip_width", "scale_hip_height", "scale_uplegs", "scale_lowlegs",
] as const;
/** Joints the camera landmarks map to (MediaPipe has the same points). */
export const LANDMARK_JOINTS = ["c_head", "l_uparm", "r_uparm", "l_lowarm", "r_lowarm", "l_wrist", "r_wrist", "l_upleg", "r_upleg", "l_lowleg", "r_lowleg", "l_talocrural", "r_talocrural"] as const;

/** The scan pose on top of MHR's rest pose: arms hanging about 20° out from the body (rest holds them ~50°
 *  out, wider than the scan asks for). The fitted posture is a small change from this. */
export const POSE_BASE: Partial<Record<(typeof POSE_PARAMS)[number], number>> = { l_uparm_ry: -0.32, l_uparm_rz: -0.56, r_uparm_ry: -0.32, r_uparm_rz: -0.56 };

export interface BodyParams { body: number[]; pose: number[]; scales: number[]; scale: number }

export function zeroParams(): BodyParams {
  return { body: new Array(20).fill(0), pose: new Array(POSE_PARAMS.length).fill(0), scales: new Array(SCALE_PARAMS.length).fill(0), scale: 1 };
}

export class FitBody {
  readonly poseIdx: number[];
  readonly scaleIdx: number[];
  readonly jointIdx: number[];
  constructor(readonly m: MhrModel) {
    const p = (n: string) => { const i = m.paramNames.indexOf(n); if (i < 0) throw new Error(`MHR has no ${n}`); return i; };
    this.poseIdx = POSE_PARAMS.map(p);
    this.scaleIdx = SCALE_PARAMS.map(p);
    this.jointIdx = LANDMARK_JOINTS.map((n) => { const i = m.jointNames.indexOf(n); if (i < 0) throw new Error(`MHR has no joint ${n}`); return i; });
  }
  /** The full 204 MHR model parameters for these fit parameters. */
  modelParams(b: BodyParams): number[] {
    const out = new Array(MODEL_PARAMS).fill(0);
    this.poseIdx.forEach((k, i) => (out[k] = b.pose[i] + (POSE_BASE[POSE_PARAMS[i]] ?? 0)));
    this.scaleIdx.forEach((k, i) => (out[k] = b.scales[i]));
    return out;
  }
  private straightKey = "";
  private straightHeight = 0;
  /** Height of this shape and these proportions standing straight (posture left out): what a height entry means.
   *  Cached: posture changes (most Jacobian columns) don't change it. */
  straight(b: BodyParams): number {
    const key = b.body.join(",") + "|" + b.scales.join(",");
    if (key !== this.straightKey) {
      const v = poseVertices(this.m, b.body, this.modelParams({ ...b, pose: b.pose.map(() => 0) }));
      let lo = Infinity, hi = -Infinity;
      for (let i = 1; i < v.length; i += 3) { if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i]; }
      this.straightKey = key; this.straightHeight = hi - lo;
    }
    return this.straightHeight;
  }
  /** Vertices (scaled, feet on the floor) and landmark joints (same frame). With `heightCm` the size is set so the
   *  body standing straight is exactly that tall (b.scale is ignored; the scale used is returned). */
  evaluate(b: BodyParams, heightCm?: number): { verts: Float32Array; joints: Float64Array; height: number; scale: number } {
    const params = this.modelParams(b);
    const v = poseVertices(this.m, b.body, params);
    const st = skeletonState(this.m, params);
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < v.length; i += 3) { if (v[i] < minY) minY = v[i]; if (v[i] > maxY) maxY = v[i]; }
    const s = heightCm ? heightCm / this.straight(b) : b.scale;
    for (let i = 0; i < v.length; i += 3) { v[i] *= s; v[i + 1] = (v[i + 1] - minY) * s; v[i + 2] *= s; }
    const joints = new Float64Array(this.jointIdx.length * 3);
    this.jointIdx.forEach((j, k) => {
      joints[k * 3] = st[j * 8] * s; joints[k * 3 + 1] = (st[j * 8 + 1] - minY) * s; joints[k * 3 + 2] = st[j * 8 + 2] * s;
    });
    return { verts: v, joints, height: (maxY - minY) * s, scale: s };
  }
}
