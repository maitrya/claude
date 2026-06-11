"""Build the candidate-facing Tap & Turf template by stripping the corruption
out of Archie's original .xlsx and leaving every other byte untouched.

The original file opens with errors in Excel because of a stale calcChain.xml
plus its [Content_Types].xml and workbook.xml.rels entries. Dropping those and
setting fullCalcOnLoad="1" makes Excel rebuild the calc chain on first open.

No cell values are changed — candidates receive Archie's template exactly as he
designed it (FY15-FY20 historicals pre-filled, forecast/assumption cells blank).

Run from repo root:
    python3 dcf-grader/tools/build-tap-turf-candidate-template.py \\
        --src "/path/to/Tap_Turf_Corrupt.xlsx" \\
        --dst dcf-grader/sample-models/tap-turf-candidate-template.xlsx
"""

import argparse
import pathlib
import tempfile
import zipfile

# Reuse the corruption-repair helper from the completed-model script.
import importlib.util
import sys


def load_module(fname, modname):
    here = pathlib.Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location(modname, here / fname)
    m = importlib.util.module_from_spec(spec)
    sys.modules[modname] = m
    spec.loader.exec_module(m)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    args = ap.parse_args()

    tpl = load_module("build-tap-turf-template.py", "btt")

    tmp = pathlib.Path(tempfile.mkdtemp(prefix="cand_"))
    extracted = tmp / "x"
    with zipfile.ZipFile(args.src) as z:
        names = z.namelist()
        z.extractall(extracted)

    tpl.force_full_recalc(extracted)

    dst = pathlib.Path(args.dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    order = [n for n in names if (extracted / n).exists()]
    if "[Content_Types].xml" in order:
        order.remove("[Content_Types].xml")
        order.insert(0, "[Content_Types].xml")
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        for n in order:
            z.write(extracted / n, n)
    print(f"Wrote {dst} (corruption repaired, no value changes)")


if __name__ == "__main__":
    main()
