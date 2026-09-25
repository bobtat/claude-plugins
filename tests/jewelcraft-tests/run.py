"""Run the jewelcraft helper tests in background Blender.

    python run.py --blender "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe"
    python run.py --blender <path> ring stones      # only files whose name contains these

The Blender path can also come from the BLENDER environment variable. JewelCraft must be
installed and enabled in that Blender's user preferences (the tests don't use
--factory-startup, which would disable it). Exit code 0 means every file passed.
"""
import argparse
import glob
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blender", default=os.environ.get("BLENDER"))
    ap.add_argument("--helpers", help="jc_helpers.py to test (default: the plugin's copy)")
    ap.add_argument("--verbose", "-v", action="store_true", help="print every check")
    ap.add_argument("filter", nargs="*")
    args = ap.parse_args()
    if not args.blender:
        sys.exit("Pass --blender <path to blender executable> or set BLENDER.")

    env = dict(os.environ)
    if args.helpers:
        env["JC_HELPERS"] = os.path.abspath(args.helpers)
    files = sorted(f for f in glob.glob(os.path.join(HERE, "test_*.py"))
                   if not args.filter or any(k in os.path.basename(f) for k in args.filter))

    failed = []
    for f in files:
        t0 = time.time()
        p = subprocess.run([args.blender, "-b", "--python-exit-code", "1", "--python", f],
                           env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
        lines = p.stdout.splitlines()
        result = next((l for l in lines if l.startswith("RESULT")), None)
        ok = p.returncode == 0 and result == "RESULT ALL PASSED"
        print(f"{'ok  ' if ok else 'FAIL'} {os.path.basename(f):32s} {time.time() - t0:5.1f}s")
        shown = lines if args.verbose else [l for l in lines if l.startswith("FAIL")]
        for l in shown:
            if l.startswith(("PASS", "FAIL")):
                print("     " + l[:300])
        if result is None:
            # The script crashed before done(): show the traceback.
            print("\n".join("     " + l for l in (p.stdout + p.stderr).splitlines()
                            if "Error" in l or "Traceback" in l or l.startswith("  File")))
        if not ok:
            failed.append(os.path.basename(f))
    print(f"\n{len(files) - len(failed)}/{len(files)} files passed" + (f"; failed: {', '.join(failed)}" if failed else ""))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
