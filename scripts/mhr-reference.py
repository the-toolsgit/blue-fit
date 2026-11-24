"""Reference vertices for src/core/body/mhr.test.ts from MHR's own PyTorch rig.

Run once on the Mac (needs torch + numpy<2): python scripts/mhr-reference.py <MHR repo> <assets dir> src/core/body/__fixtures__/mhr-ref.json
Bodies are random made-up shapes and poses (seed 7).
"""
import sys, json, importlib.util, types
import numpy as np, torch
R = sys.argv[1]; A = sys.argv[2]; OUT = sys.argv[3]
# load mhr/_rig_schema.py and mhr/_torch_rig.py without the package __init__
pkg = types.ModuleType("mhr"); pkg.__path__ = [R + "/mhr"]; sys.modules["mhr"] = pkg
def load(name):
    spec = importlib.util.spec_from_file_location("mhr." + name, f"{R}/mhr/{name}.py")
    m = importlib.util.module_from_spec(spec); sys.modules["mhr." + name] = m; spec.loader.exec_module(m); return m
load("_rig_schema"); tr = load("_torch_rig")
from pathlib import Path
out = {}
rng = np.random.default_rng(7)
for lod in (2, 3):
    ch = tr.TorchCharacter.from_files(Path(A + "/rig.npz"), Path(A + f"/lod{lod}.npz"), lod)
    cases = []
    for c in range(3):
        ident = np.zeros(45, np.float32); expr = np.zeros(72, np.float32)
        params = np.zeros(204, np.float32)
        if c > 0:
            ident[:20] = rng.normal(0, 1, 20)
            params[3:6] = rng.normal(0, 0.3, 3)          # root rotation
            params[0:3] = rng.normal(0, 5, 3)            # root translation
            params[6:68] = rng.normal(0, 0.15, 62)       # body joints
            params[136:142] = rng.normal(0, 0.1, 6)      # *_flexible lengths
            params[142:160] = rng.normal(0, 0.1, 18)     # scale_* body
        coeffs = torch.from_numpy(np.concatenate([ident, expr]))[None]
        rest = ch.blend_shape(coeffs)
        jp = ch.model_parameters_to_joint_parameters(torch.cat([torch.from_numpy(params)[None], torch.zeros(1, 117)], 1))
        st = ch.joint_parameters_to_skeleton_state(jp)
        v = ch.skin_points(st, rest)[0].detach().numpy()
        idx = list(range(0, v.shape[0], 97))
        cases.append({"body": ident[:20].tolist(), "params": params.tolist(), "idx": idx, "verts": v[idx].round(4).tolist(),
                      "minY": float(v[:, 1].min()), "maxY": float(v[:, 1].max())})
    out[str(lod)] = cases
json.dump(out, open(OUT, "w"))
print("ok", {k: len(v[0]["idx"]) for k, v in out.items()}, out["3"][0]["minY"], out["3"][0]["maxY"])
