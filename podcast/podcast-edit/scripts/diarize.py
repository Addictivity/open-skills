#!/usr/bin/env python3
"""Energy diarisation for a two-mic multicam edit.

Louder lav mic = active speaker. An interview should come out with the guest
talking well over the host, so the talk split doubles as a sanity check.

Usage:
    python3 diarize.py <host_rms.txt> <guest_rms.txt> [--sil -50] [--margin 4]
                       [--hold 12] [--minseg 0.6] [--window 0.1]
                       [--fps 25] [--mic-offset 0] [--json out.json]

Inputs are the two RMS files from extract-rms.sh (host = the asking voice).
Prints a talk-time check and the first turns. Optionally writes segments
(label H/G, start_s, end_s and master-frame M range) as JSON.
"""
import json, argparse, statistics
from collections import Counter

def load(path):
    vals = []
    for line in open(path):
        if "RMS_level=" in line:
            v = line.strip().split("=")[1]
            try: vals.append(float(v))
            except ValueError: vals.append(-100.0)  # -inf means very quiet
    return vals

def main():
    p = argparse.ArgumentParser(description="Energy diarisation from two mic RMS files.")
    p.add_argument("host_rms"); p.add_argument("guest_rms")
    p.add_argument("--sil", type=float, default=-50.0, help="dB: both below = silence")
    p.add_argument("--margin", type=float, default=4.0, help="dB lead to claim a speaker")
    p.add_argument("--hold", type=int, default=12, help="windows to hold speaker across a brief gap")
    p.add_argument("--minseg", type=float, default=0.6, help="drop speaker turns shorter than this (s)")
    p.add_argument("--window", type=float, default=0.1, help="seconds per RMS window")
    p.add_argument("--fps", type=float, default=25.0)
    p.add_argument("--mic-offset", type=int, default=0, help="mic clip start in master frames (M)")
    p.add_argument("--json", default=None)
    a = p.parse_args()

    H, G = load(a.host_rms), load(a.guest_rms)
    n = min(len(H), len(G))
    if n == 0:
        raise SystemExit("ERROR: no RMS readings found. Run extract-rms.sh first and check its output.")
    print(f"windows: {n}  dur~ {n*a.window:.0f}s")
    hv, gv = H[:n], G[:n]
    for name, v in (("host", hv), ("guest", gv)):
        s = sorted(v)
        print(f"{name:5} RMS dB: min {min(v):.1f} p10 {s[n//10]:.1f} med {statistics.median(v):.1f} "
              f"p90 {s[9*n//10]:.1f} max {max(v):.1f}")

    # per-window label
    lab = []
    for i in range(n):
        th, tg = hv[i], gv[i]
        if th < a.sil and tg < a.sil: lab.append('S')
        elif th > tg + a.margin: lab.append('H')
        elif tg > th + a.margin: lab.append('G')
        else: lab.append('?')
    print("raw window labels:", dict(Counter(lab)))

    # smooth: hold current speaker across brief ambiguity or silence
    sm = lab[:]; cur = None; gap = 0
    for i in range(n):
        if lab[i] in ('H', 'G'): cur = lab[i]; gap = 0; sm[i] = lab[i]
        else:
            gap += 1
            sm[i] = cur if (cur and gap <= a.hold) else 'S'

    # segments, drop tiny speaker turns
    segs = []; i = 0
    while i < n:
        L = sm[i]; j0 = i
        while i < n and sm[i] == L: i += 1
        segs.append([L, j0 * a.window, i * a.window])
    segs = [s for s in segs if not (s[0] in ('H', 'G') and (s[2] - s[1]) < a.minseg)]
    spk = [s for s in segs if s[0] in ('H', 'G')]

    fpw = a.fps * a.window  # master frames per window
    def M(s): return round(a.mic_offset + s / a.window * fpw)
    print(f"\nspeaker turns: {len(spk)}")
    print("first 30 turns (spk  src_s_start-end  M_start-M_end):")
    for s in spk[:30]:
        print(f"  {s[0]}  {s[1]:7.1f}-{s[2]:7.1f}   M {M(s[1])}-{M(s[2])}")
    th = sum(s[2]-s[1] for s in spk if s[0]=='H'); tg = sum(s[2]-s[1] for s in spk if s[0]=='G')
    print(f"\ntalk time: host {th:.0f}s  guest {tg:.0f}s  (expect guest >> host for an interview)")

    if a.json:
        json.dump([{"spk": s[0], "start_s": s[1], "end_s": s[2], "M_start": M(s[1]), "M_end": M(s[2])}
                   for s in spk], open(a.json, "w"), indent=0)
        print("wrote", a.json)

if __name__ == "__main__":
    main()
