#!/usr/bin/env python3
"""Build the multicam EDL (add_clips payloads) for an episode.

Turns:
  - the kept master-frame ranges (what survives after the intro splice and cuts), and
  - the two lav-mic RMS files (energy diarisation: who is speaking),
into clip placements:
  - base tracks: wide "radio-edit" video + host mic + guest mic (identical cuts),
  - a camera overlay track: shots that cut to whoever is speaking, with wide accents
    for questions, an establishing open and a recurring two-shot in long answers.

No ripple and no undo: every clip is placed by (startFrame, trimStartFrame, durationFrames),
so the whole timeline can be rebuilt from this file alone. The output is plain JSON, so
you can feed it to Palmier's add_clips or read the cut list into another editor.

Usage: python3 build_edl.py <episode-edit.json> [--out final_build.json]
See references/episode-edit.example.json for the config shape.

Coordinate model (all frames):
  M           = frame in the fully-synced master timeline (before any cuts)
  trimStart   = M - offset[media]     (offset = the media's placement frame in the synced master)
  final start = cumulative position after the kept ranges are butted together
"""
import json, argparse
from collections import Counter

def load_rms(path):
    v = []
    for line in open(path):
        if "RMS_level=" in line:
            x = line.strip().split("=")[1]
            try: v.append(float(x))
            except ValueError: v.append(-100.0)
    return v

def runs(seq):
    r = []; i = 0
    while i < len(seq):
        L = seq[i]; j = i
        while i < len(seq) and seq[i] == L: i += 1
        r.append([L, j, i])
    return r

def merge(lst):  # merge adjacent same-label camera shots
    m = []
    for c in lst:
        if m and m[-1][0] == c[0]: m[-1][2] = c[2]
        else: m.append(c[:])
    return m

def main():
    ap = argparse.ArgumentParser(description="Build a multicam EDL from kept ranges and mic RMS files.")
    ap.add_argument("config")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    cfg = json.load(open(args.config))

    fps = cfg.get("fps", 25.0)
    win = cfg.get("window_s", 0.1)
    fpw = fps * win                       # master frames per RMS window (25fps, 0.1s = 2.5)
    refs = cfg["refs"]; off = cfg["offsets"]
    s = cfg.get("shot", {})
    SIL = s.get("sil", -50.0); MARG = s.get("margin", 4.0); HOLD = s.get("hold", 12)
    sec = lambda k, d: int(round(s.get(k, d) * fps))            # seconds to frames
    MIN_CAM_RUN = int(round(s.get("min_cam_run_s", 2.0) / win)) # windows
    MIN_SHOT    = sec("min_shot_s", 1.6)
    QUESTION    = sec("question_wide_max_s", 5.0)
    BREATH      = sec("breath_s", 2.5)
    ESTABLISH   = sec("establish_push_s", 3.0)
    MIN_WIDE    = sec("min_wide_s", 1.4)       # floor for a two-shot beat (no flashes)
    WIDE_EVERY  = sec("wide_every_s", 16.0)    # recur the two-shot every N s in a long run

    # ---- kept ranges to cumulative final frames ----
    kept = [(int(a), int(b)) for a, b in cfg["kept_M"] if b - a > 1]
    final = []; cur = 0
    for a, b in kept:
        final.append((a, b, cur)); cur += (b - a)
    TOTAL = cur
    if TOTAL == 0:
        raise SystemExit("ERROR: kept_M is empty, nothing to build.")
    print(f"kept segments: {len(kept)}  final duration: {TOTAL}f = {TOTAL/fps/60:.1f} min")

    def base_entries(ref, srcoff):
        return [{"mediaRef": ref, "startFrame": fs, "durationFrames": b - a,
                 "trimStartFrame": int(round(a - srcoff))} for a, b, fs in final]

    wide_e = base_entries(refs["wide"], off["wide"])
    host_mic_e = base_entries(refs["host_mic"], off["host_mic"])
    guest_mic_e = base_entries(refs["guest_mic"], off["guest_mic"])

    # ---- energy diarisation to per-window H/G/S ----
    H = load_rms(cfg["rms"]["host"]); G = load_rms(cfg["rms"]["guest"])
    n = min(len(H), len(G))
    lab = []
    for i in range(n):
        th, tg = H[i], G[i]
        lab.append('S' if (th < SIL and tg < SIL) else 'H' if th > tg + MARG
                   else 'G' if tg > th + MARG else '?')
    sm = lab[:]; c = None; gap = 0
    for i in range(n):
        if lab[i] in ('H', 'G'): c = lab[i]; gap = 0; sm[i] = lab[i]
        else:
            gap += 1; sm[i] = c if (c and gap <= HOLD) else 'S'

    R = runs(sm)
    # de-flicker: a very short opposite turn between two same turns is absorbed
    for k in range(1, len(R) - 1):
        L, a, b = R[k]
        if L in ('H', 'G') and (b - a) < 10 and R[k-1][0] == R[k+1][0] \
           and R[k-1][0] in ('H', 'G') and R[k-1][0] != L:
            R[k][0] = R[k-1][0]
    seq2 = ['S'] * n
    for L, a, b in R:
        for i in range(a, b): seq2[i] = L
    R = runs(seq2)

    # window index to master frame
    mic0 = off["host_mic"]
    Mf = lambda w: mic0 + w * fpw

    # sustained speaker run goes to their cam, anything else to wide
    raw = [[L if (L in ('H', 'G') and (b - a) >= MIN_CAM_RUN) else 'W', Mf(a), Mf(b)]
           for L, a, b in R]
    raw = merge(raw)
    # absorb sub-minimum shots into the previous shot
    tmp = []
    for cc in raw:
        if tmp and (cc[2] - cc[1]) < MIN_SHOT: tmp[-1][2] = cc[2]
        else: tmp.append(cc[:])
    raw = merge(tmp)
    # accent 1: a short host shot that leads into a guest shot is a question, so go wide
    for k in range(len(raw) - 1):
        if raw[k][0] == 'H' and (raw[k][2] - raw[k][1]) < QUESTION and raw[k+1][0] == 'G':
            raw[k][0] = 'W'
    raw = merge(raw)
    # accent 2 (periodic wides): break a long single-speaker run with a two-shot of about
    # BREATH every WIDE_EVERY seconds, so nobody sits on one camera too long.
    res = []
    for L, a, b in raw:
        if L in ('H', 'G') and (b - a) > WIDE_EVERY + BREATH:
            seg = a; pos = a + WIDE_EVERY
            while pos + BREATH < b:
                res += [[L, seg, pos], ['W', pos, pos + BREATH]]
                seg = pos + BREATH; pos = seg + WIDE_EVERY
            res.append([L, seg, b])
        else:
            res.append([L, a, b])
    raw = merge(res)
    # accent 3: establishing wide, so push the first cam shot ESTABLISH frames later
    for cc in raw:
        if cc[0] in ('H', 'G'): cc[1] += ESTABLISH; break
    raw = merge(raw)
    # minimum-duration guard: absorb any shot below its floor into its neighbour,
    # so no cut ever flashes on screen.
    mn = []
    for cc in raw:
        floor = MIN_WIDE if cc[0] == 'W' else MIN_SHOT
        if mn and (cc[2] - cc[1]) < floor: mn[-1][2] = cc[2]
        else: mn.append(cc[:])
    if len(mn) > 1:                              # a too-short leading shot folds into the next
        f0 = MIN_WIDE if mn[0][0] == 'W' else MIN_SHOT
        if (mn[0][2] - mn[0][1]) < f0: mn[1][1] = mn[0][1]; mn = mn[1:]
    raw = merge(mn)

    # ---- map shots through kept ranges to overlay entries in final frames ----
    ov = []
    for L, Ma, Mb in raw:
        if L == 'W': continue
        ref = refs["host_cam"] if L == 'H' else refs["guest_cam"]
        o = off["host_cam"] if L == 'H' else off["guest_cam"]
        for a, b, fs in final:
            lo = max(Ma, a); hi = min(Mb, b)
            if lo < hi - 0.5:
                ov.append({"mediaRef": ref, "startFrame": int(round(fs + (lo - a))),
                           "durationFrames": int(round(hi - lo)),
                           "trimStartFrame": int(round(lo - o)), "cam": L})
    ov.sort(key=lambda e: e["startFrame"])
    # final guard in placed-frame space: clamp overlaps, close any sub-MIN_WIDE wide gap
    # (extend the previous shot to cover it), and fold any sub-MIN_SHOT shot into its
    # predecessor. The cut track ends up with no flashes and no micro-gaps of wide,
    # even after rounding and kept-segment splits.
    clean = []
    for e in ov:
        if not clean:
            clean.append(e); continue
        p = clean[-1]; gap = e["startFrame"] - (p["startFrame"] + p["durationFrames"])
        if gap < MIN_WIDE:                       # overlap or too-thin wide: prev covers up to e
            p["durationFrames"] = e["startFrame"] - p["startFrame"]
        if e["durationFrames"] < MIN_SHOT:       # too-short shot: fold into prev
            p["durationFrames"] = (e["startFrame"] + e["durationFrames"]) - p["startFrame"]
        else:
            clean.append(e)
    ov = [e for e in clean if e["durationFrames"] >= MIN_SHOT]
    # The overlay must reach the final frame. A thin tail would render as a flash of
    # the bare wide track at the very end of the episode.
    if ov:
        tail = TOTAL - (ov[-1]["startFrame"] + ov[-1]["durationFrames"])
        if 0 < tail < MIN_WIDE:
            ov[-1]["durationFrames"] += tail

    covered = sum(e["durationFrames"] for e in ov)
    print(f"camera shots: {len(ov)}  {dict(Counter(e['cam'] for e in ov))}")
    print(f"on-cam {100*covered/TOTAL:.0f}% / wide {100*(TOTAL-covered)/TOTAL:.0f}%")

    out = args.out or "final_build.json"
    json.dump({"total": TOTAL, "fps": fps,
               "wide": wide_e, "host_mic": host_mic_e, "guest_mic": guest_mic_e,
               "overlay": [{k: v for k, v in e.items() if k != "cam"} for e in ov]},
              open(out, "w"))
    print("wrote", out, "-> add_clips: wide", len(wide_e),
          "| host_mic", len(host_mic_e), "| guest_mic", len(guest_mic_e), "| overlay", len(ov))

if __name__ == "__main__":
    main()
