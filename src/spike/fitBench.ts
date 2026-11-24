// Spike: cost of one Levenberg–Marquardt iteration of the planned multi-view
// MHR silhouette fit (plan §3.2), on random data of the real sizes.
const V = 6890; // vertices in the decimated fit mesh
const S = 45; // MHR identity (shape) coefficients
const P = 110; // all parameters (shape + pose + per-view yaw/x/z + focal)
const VIEWS = 12;
const PTS = 400; // outline points per view

export function fitBenchmark() {
  const rnd = () => Math.random() - 0.5;
  const template = Float32Array.from({ length: V * 3 }, rnd);
  const basis = Float32Array.from({ length: V * 3 * S }, rnd);
  const beta = Float32Array.from({ length: S }, rnd);
  const verts = new Float32Array(V * 3);
  const R = VIEWS * PTS * 2;
  const J = new Float32Array(R * P);
  const r = new Float32Array(R);
  const JtJ = new Float64Array(P * P);
  const Jtr = new Float64Array(P);

  const iterate = () => {
    // 1. shape: verts = template + basis · beta
    for (let i = 0; i < V * 3; i++) {
      let s = template[i];
      const o = i * S;
      for (let k = 0; k < S; k++) s += basis[o + k] * beta[k];
      verts[i] = s;
    }
    // 2. project into each view (rotation about y + perspective)
    let acc = 0;
    for (let v = 0; v < VIEWS; v++) {
      const a = (v / VIEWS) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      for (let i = 0; i < V; i++) {
        const x = verts[i * 3], y = verts[i * 3 + 1], z = verts[i * 3 + 2];
        const zz = 3 + (-s * x + c * z);
        acc += (c * x + s * z) / zz + y / zz;
      }
    }
    // 3. residuals + Jacobian rows for the outline points
    for (let i = 0; i < R; i++) {
      r[i] = Math.sin(i + acc);
      const o = i * P;
      for (let p = 0; p < P; p++) J[o + p] = verts[(i * 7 + p * 13) % (V * 3)];
    }
    // 4. normal equations JᵀJ and Jᵀr
    JtJ.fill(0);
    Jtr.fill(0);
    for (let i = 0; i < R; i++) {
      const o = i * P;
      const ri = r[i];
      for (let a = 0; a < P; a++) {
        const ja = J[o + a];
        Jtr[a] += ja * ri;
        const row = a * P;
        for (let b = a; b < P; b++) JtJ[row + b] += ja * J[o + b];
      }
    }
    // 5. damped solve (Cholesky)
    for (let a = 0; a < P; a++) JtJ[a * P + a] += 1e-3 + JtJ[a * P + a] * 1e-3;
    const L = new Float64Array(P * P);
    for (let i = 0; i < P; i++)
      for (let j = 0; j <= i; j++) {
        let sum = j <= i ? JtJ[j * P + i] : 0;
        for (let k = 0; k < j; k++) sum -= L[i * P + k] * L[j * P + k];
        L[i * P + j] = i === j ? Math.sqrt(Math.max(sum, 1e-12)) : sum / L[j * P + j];
      }
    for (let k = 0; k < S; k++) beta[k] += 1e-6 * Jtr[k] / L[k * P + k];
  };

  iterate(); // warm-up (JIT)
  const n = 3;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) iterate();
  return { iterMs: (performance.now() - t0) / n };
}
