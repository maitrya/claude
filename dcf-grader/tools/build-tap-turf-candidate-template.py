"""Build the candidate-facing Tap & Turf template:
  1. Strip the corruption out of Archie's original .xlsx (drop calcChain,
     set fullCalcOnLoad="1") so it opens cleanly in Excel.
  2. Inject a new "Comps" worksheet at the end of the tab order containing
     the CAPM inputs (Rf, ERP, specific risk) and the 5-name peer set
     (ticker, levered β, D/E, EV/EBITDA) — so every candidate works from
     the same WACC anchor.

No existing cell values are altered. Candidates receive Archie's template
exactly as he designed it, plus one new reference tab.

Run from repo root:
    python3 dcf-grader/tools/build-tap-turf-candidate-template.py \\
        --src "/path/to/Tap_Turf_Corrupt.xlsx" \\
        --dst dcf-grader/sample-models/tap-turf-candidate-template.xlsx
"""

import argparse
import importlib.util
import pathlib
import re
import sys
import tempfile
import zipfile

# CAPM + peer set sourced in dcf-grader/tools/tap-turf-dcf.py. Kept in sync here
# (this script writes a static sheet — no formulas referencing tap-turf-dcf.py).
CAPM_INPUTS = [
    ("Risk-free rate (AU 10Y government bond, RBA F2, late May 2026)", 0.049),
    ("Equity risk premium (KPMG ANZ Valuation Practices Survey MRP)",  0.055),
    ("Specific risk premium (venue concentration + private illiquidity)", 0.015),
]

PEER_SET = [
    # (Company, Ticker, levered β, D/E, EV/EBITDA) — source: stockanalysis.com / yahoo, June 2026
    ("Endeavour Group",       "EDV.AX", 0.41, 1.34, 7.64),
    ("Coca-Cola Europacific", "CCEP",   0.38, 1.41, 13.28),
    ("Compass Group",         "CPG.L",  0.64, 1.13, 14.15),
    ("Aramark",               "ARMK",   1.20, 2.14, 12.96),
    ("Aristocrat Leisure",    "ALL.AX", 0.42, 0.31, 13.37),
]

NOTES = [
    "1. Unlever each peer beta (Hamada: βu = βl / (1 + (1−t)·D/E)), average the unlevered betas, then re-lever to Tap & Turf's target capital structure.",
    "2. Tap & Turf is net cash (asset-light, no debt). For an all-equity capital structure, WACC = cost of equity — use the unlevered peer beta directly; no relevering required.",
    "3. The peer set is large-cap consumer/leisure/hospitality and broadly more diversified than Tap & Turf. Treat the EV/EBITDA median as an upper-bound cross-check; the perpetuity method (g = 2.5% per the brief) is the more grounded primary estimate.",
]


def load_module(fname, modname):
    here = pathlib.Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location(modname, here / fname)
    m = importlib.util.module_from_spec(spec)
    sys.modules[modname] = m
    spec.loader.exec_module(m)
    return m


def xml_escape(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;").replace("'", "&apos;"))


def cell_str(ref: str, text: str) -> str:
    return f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{xml_escape(text)}</t></is></c>'


def cell_num(ref: str, value: float) -> str:
    return f'<c r="{ref}"><v>{value}</v></c>'


def cell_formula(ref: str, formula: str, result: float | None = None) -> str:
    inner = f'<f>{xml_escape(formula)}</f>'
    if result is not None:
        inner += f'<v>{result}</v>'
    return f'<c r="{ref}">{inner}</c>'


def build_comps_sheet_xml() -> str:
    """Build the Comps worksheet XML. Uses inline strings so we don't touch sharedStrings.xml."""
    rows: list[str] = []

    def row(rownum: int, cells: list[str]) -> None:
        rows.append(f'<row r="{rownum}">{"".join(cells)}</row>')

    row(1, [cell_str("A1", "Comparable companies and CAPM inputs")])
    row(2, [cell_str("A2", "Reference data provided for the WACC build (peer-beta CAPM) and the exit-multiple terminal value. Source: Yahoo Finance / stockanalysis.com, June 2026.")])

    row(4, [cell_str("A4", "CAPM inputs")])
    for i, (label, val) in enumerate(CAPM_INPUTS, start=5):
        row(i, [cell_str(f"A{i}", label), cell_num(f"B{i}", val)])

    row(9,  [cell_str("A9", "Comparable peer set")])
    row(10, [cell_str("A10", "Company"), cell_str("B10", "Ticker"),
             cell_str("C10", "Levered β"), cell_str("D10", "D/E"),
             cell_str("E10", "EV / EBITDA")])
    for i, (name, ticker, beta, de, ev) in enumerate(PEER_SET, start=11):
        row(i, [cell_str(f"A{i}", name), cell_str(f"B{i}", ticker),
                cell_num(f"C{i}", beta), cell_num(f"D{i}", de), cell_num(f"E{i}", ev)])

    row(17, [cell_str("A17", "Median EV/EBITDA (for exit-multiple terminal value)"),
             cell_formula("E17", f"MEDIAN(E11:E{10+len(PEER_SET)})")])

    row(19, [cell_str("A19", "Notes")])
    for i, note in enumerate(NOTES, start=20):
        row(i, [cell_str(f"A{i}", note)])

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(rows)}</sheetData>'
        '</worksheet>'
    )


def append_comps_sheet(extracted: pathlib.Path, sheet_file: str, r_id: str, sheet_id: int, sheet_name: str) -> None:
    """Wire up the new sheet in workbook.xml, workbook.xml.rels, and [Content_Types].xml."""
    (extracted / "xl" / "worksheets" / sheet_file).write_text(
        build_comps_sheet_xml(), encoding="utf-8"
    )

    wb_path = extracted / "xl" / "workbook.xml"
    wb = wb_path.read_text(encoding="utf-8")
    new_sheet = f'<sheet name="{sheet_name}" sheetId="{sheet_id}" r:id="{r_id}"/>'
    wb = wb.replace("</sheets>", f"{new_sheet}</sheets>", 1)
    wb_path.write_text(wb, encoding="utf-8")

    rels_path = extracted / "xl" / "_rels" / "workbook.xml.rels"
    rels = rels_path.read_text(encoding="utf-8")
    new_rel = (
        f'<Relationship Id="{r_id}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        f'Target="worksheets/{sheet_file}"/>'
    )
    rels = rels.replace("</Relationships>", f"{new_rel}</Relationships>", 1)
    rels_path.write_text(rels, encoding="utf-8")

    ct_path = extracted / "[Content_Types].xml"
    ct = ct_path.read_text(encoding="utf-8")
    new_override = (
        f'<Override PartName="/xl/worksheets/{sheet_file}" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    )
    ct = ct.replace("</Types>", f"{new_override}</Types>", 1)
    ct_path.write_text(ct, encoding="utf-8")


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
    append_comps_sheet(
        extracted,
        sheet_file="sheet9.xml",
        r_id="rId37",
        sheet_id=46,
        sheet_name="Comps",
    )

    dst = pathlib.Path(args.dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    order = [n for n in names if (extracted / n).exists()]
    if "[Content_Types].xml" in order:
        order.remove("[Content_Types].xml")
        order.insert(0, "[Content_Types].xml")
    order.append("xl/worksheets/sheet9.xml")
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        for n in order:
            z.write(extracted / n, n)
    print(f"Wrote {dst} (corruption repaired + Comps sheet added)")


if __name__ == "__main__":
    main()
