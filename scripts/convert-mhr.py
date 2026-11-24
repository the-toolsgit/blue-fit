"""Convert the MHR body model (Meta, Apache-2.0) to Blue Fit's compact binary.

Input: rig.npz + lod<N>.npz from the MHR release (`mhr-assets-v1-common.zip`,
`mhr-assets-v1-lod<N>.zip`, https://github.com/facebookresearch/MHR/releases).
Output: public/mhr/v1/mhr-lod<N>.bin, read by src/core/body/mhr.ts.

Kept: rest mesh, the 20 *body* identity blend shapes (the 20 head and 5 hand
ones and the 72 face expressions are dropped), linear skinning, skeleton, the
parameter transform for the 204 model parameters, parameter limits, and a part
label per vertex (from its strongest skinning joint). Dropped: pose correctives,
texture coordinates. Units: cm, y up.

File layout: "BFMHR1\\0\\0" (8 bytes), uint32 JSON length, JSON header
(arrays: name, dtype, shape, byte offset), padding to 4 bytes, array data.

Run (numpy only): python3 scripts/convert-mhr.py <assets dir> <lod>
"""

import json
import struct
import sys
from pathlib import Path

import numpy as np

BODY_SHAPES = 20
MODEL_PARAMS = 204

# Part labels (see PART_LABELS in src/core/body/mhr.ts).
TORSO, ARM_L, ARM_R, HAND_L, HAND_R, LEG_L, LEG_R, NECK, HEAD = range(9)
HAND_WORDS = ("wrist", "pinky", "ring", "middle", "index", "thumb")
LEG_WORDS = ("upleg", "lowleg", "foot", "talocrural", "subtalar", "transversetarsal", "ball")
HEAD_WORDS = ("head", "jaw", "teeth", "tongue", "eye")


def part_of(joint: str) -> int:
    side = joint[:2]
    if any(w in joint for w in HAND_WORDS):
        return HAND_L if side == "l_" else HAND_R
    if "uparm" in joint or "lowarm" in joint:
        return ARM_L if side == "l_" else ARM_R
    if any(w in joint for w in LEG_WORDS):
        return LEG_L if side == "l_" else LEG_R
    if "neck" in joint:
        return NECK
    if any(w in joint for w in HEAD_WORDS):
        return HEAD
    return TORSO  # body_world, root, spine, clavicle


def main() -> None:
    src = Path(sys.argv[1])
    lod = int(sys.argv[2])
    out = Path(f"public/mhr/v1/mhr-lod{lod}.bin")
    rig = np.load(src / "rig.npz", allow_pickle=False)
    mesh = np.load(src / f"lod{lod}.npz", allow_pickle=False)

    joint_names = [str(n) for n in rig["joint_names"]]
    param_names = [str(n) for n in rig["parameter_names"]][:MODEL_PARAMS]
    skin_i = mesh["skin_indices"]
    skin_w = mesh["skin_weights"].astype(np.float32)
    strongest = skin_i[np.arange(len(skin_i)), np.argmax(skin_w, axis=1)]
    labels = np.array([part_of(joint_names[j]) for j in strongest], dtype=np.uint8)

    pt = rig["parameter_transform"][:, :MODEL_PARAMS]
    rows, cols = np.nonzero(pt)
    lim_idx = rig["limit_parameter_index"]
    keep = lim_idx < MODEL_PARAMS

    arrays = {
        "base_shape": mesh["base_shape"].astype(np.float32),
        "body_shapes": mesh["shape_vectors"][:BODY_SHAPES].astype(np.float32),
        "faces": mesh["faces"].astype(np.uint16 if len(mesh["base_shape"]) < 65536 else np.uint32),
        "skin_indices": skin_i.astype(np.uint8),
        "skin_weights": skin_w,
        "part_labels": labels,
        "joint_offsets": rig["joint_offsets"].astype(np.float32),
        "joint_prerotations": rig["joint_prerotations"].astype(np.float32),
        "joint_parents": rig["joint_parents"].astype(np.int16),
        "inverse_bind_pose": rig["inverse_bind_pose"].astype(np.float32),
        "fk_indices": rig["fk_indices"].astype(np.int16),
        "fk_sizes": rig["fk_sizes"].astype(np.int16),
        "pt_rows": rows.astype(np.int16),
        "pt_cols": cols.astype(np.int16),
        "pt_vals": pt[rows, cols].astype(np.float32),
        "limit_min": rig["limit_min"][keep].astype(np.float32),
        "limit_max": rig["limit_max"][keep].astype(np.float32),
        "limit_index": lim_idx[keep].astype(np.int16),
    }

    header = {"format": 1, "source": "facebookresearch/MHR v1.2.0 (Apache-2.0)", "lod": lod,
              "jointNames": joint_names, "paramNames": param_names, "arrays": []}
    offset = 0
    blobs = []
    for name, a in arrays.items():
        a = np.ascontiguousarray(a)
        pad = (-offset) % 4
        offset += pad
        blobs.append(b"\0" * pad)
        header["arrays"].append({"name": name, "dtype": a.dtype.name, "shape": list(a.shape), "offset": offset})
        blobs.append(a.tobytes())
        offset += a.nbytes
    head = json.dumps(header, separators=(",", ":")).encode()
    head += b" " * ((-(12 + len(head))) % 4)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "wb") as f:
        f.write(b"BFMHR1\0\0" + struct.pack("<I", len(head)) + head + b"".join(blobs))
    print(f"{out}: {out.stat().st_size / 1e6:.2f} MB, {len(arrays['base_shape'])} vertices, "
          f"{len(arrays['faces'])} faces, parts {np.bincount(labels, minlength=9).tolist()}")


if __name__ == "__main__":
    main()
