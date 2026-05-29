"""Deliver the completed model INSIDE Archie's original template.

openpyxl's full rewrite of this template corrupts it (FactSet sheets, styles,
external-link bookkeeping). Instead we edit only the specific cells we need
directly in the worksheet XML, leaving every other byte of the template
untouched, then drop calcChain and force a full recalc on open.

Cell edits are sourced from the same fill_* logic used by the openpyxl build
(build-tap-turf-completed.py) via a CellSink, so the model content is identical
— only the delivery mechanism changes.

Run from repo root:
    python3 dcf-grader/tools/build-tap-turf-template.py \\
        --src "/path/to/Tap_Turf_Corrupt.xlsx" \\
        --dst dcf-grader/sample-models/tap-turf-template-completed.xlsx
"""

import argparse
import importlib.util
import pathlib
import re
import sys
import tempfile
import zipfile

from lxml import etree as LET

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"

# Tabs → worksheet part (from workbook.xml.rels)
SHEET_FILE = {
    "Assumptions": "sheet4.xml",
    "Company fin forecasts": "sheet5.xml",
    " Financials": "sheet6.xml",
    "DCF input": "sheet7.xml",
    "DCF output": "sheet8.xml",
}


def load_module(fname, modname):
    here = pathlib.Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location(modname, here / fname)
    m = importlib.util.module_from_spec(spec)
    sys.modules[modname] = m
    spec.loader.exec_module(m)
    return m


class CellSink:
    """Mimics an openpyxl worksheet for the fill_* functions: ws[addr] = value."""

    def __init__(self):
        self.cells = {}

    def __setitem__(self, addr, value):
        self.cells[addr] = value


def col_to_idx(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n


def split_ref(ref: str):
    m = re.match(r"([A-Z]+)(\d+)", ref)
    return m.group(1), int(m.group(2))


def q(tag: str) -> str:
    return f"{{{MAIN}}}{tag}"


def get_or_make_row(sheet_data, rownum: int):
    rows = sheet_data.findall(q("row"))
    for row in rows:
        if int(row.get("r")) == rownum:
            return row
    new = LET.SubElement(sheet_data, q("row"))
    new.set("r", str(rownum))
    for row in rows:
        if int(row.get("r")) > rownum:
            row.addprevious(new)
            break
    return new


def get_or_make_cell(row, ref: str):
    col, _ = split_ref(ref)
    cidx = col_to_idx(col)
    for c in row.findall(q("c")):
        if c.get("r") == ref:
            return c
    new = LET.SubElement(row, q("c"))
    new.set("r", ref)
    for c in row.findall(q("c")):
        if c is new:
            continue
        ccol, _ = split_ref(c.get("r"))
        if col_to_idx(ccol) > cidx:
            c.addprevious(new)
            break
    return new


def set_cell(sheet_data, ref: str, value):
    _, rownum = split_ref(ref)
    row = get_or_make_row(sheet_data, rownum)
    c = get_or_make_cell(row, ref)
    style = c.get("s")            # preserve cell style index
    c.attrib.clear()
    c.set("r", ref)
    if style is not None:
        c.set("s", style)
    for child in list(c):
        c.remove(child)

    if isinstance(value, str) and value.startswith("="):
        LET.SubElement(c, q("f")).text = value[1:]
    elif isinstance(value, str):
        c.set("t", "inlineStr")
        is_el = LET.SubElement(c, q("is"))
        LET.SubElement(is_el, q("t")).text = value
    else:  # number
        LET.SubElement(c, q("v")).text = repr(value) if isinstance(value, float) else str(value)


def apply_edits_to_sheet(path: pathlib.Path, edits: dict):
    tree = LET.parse(str(path))
    sheet_data = tree.getroot().find(q("sheetData"))
    for ref, value in edits.items():
        set_cell(sheet_data, ref, value)
    tree.write(str(path), xml_declaration=True, encoding="UTF-8", standalone=True)


def force_full_recalc(extracted: pathlib.Path):
    """Drop calcChain and set fullCalcOnLoad so Excel recomputes every formula."""
    cc = extracted / "xl" / "calcChain.xml"
    cc.unlink(missing_ok=True)
    ct = extracted / "[Content_Types].xml"
    ctext = ct.read_text(encoding="utf-8")
    ctext = re.sub(r'<Override[^>]*calcChain[^>]*/>', "", ctext)
    ct.write_text(ctext, encoding="utf-8")
    rels = extracted / "xl" / "_rels" / "workbook.xml.rels"
    rtext = rels.read_text(encoding="utf-8")
    rtext = re.sub(r'<Relationship[^>]*calcChain[^>]*/>', "", rtext)
    rels.write_text(rtext, encoding="utf-8")

    wb = extracted / "xl" / "workbook.xml"
    wtext = wb.read_text(encoding="utf-8")
    if "<calcPr" in wtext:
        wtext = re.sub(r"<calcPr[^/]*/>",
                       '<calcPr calcId="0" fullCalcOnLoad="1"/>', wtext, count=1)
    else:
        wtext = wtext.replace("</workbook>",
                              '<calcPr calcId="0" fullCalcOnLoad="1"/></workbook>')
    wb.write_text(wtext, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    args = ap.parse_args()

    dcf = load_module("tap-turf-dcf.py", "tap_turf_dcf")
    bld = load_module("build-tap-turf-completed.py", "btc")

    fc = dcf.build_forecast()
    valuation = dcf.discount(fc)
    params = {
        "wacc": dcf.WACC,
        "perp_growth": dcf.PERP_GROWTH,
        "exit_multiple": round(valuation["implied_exit_multiple_from_perp"], 2),
    }

    sinks = {name: CellSink() for name in SHEET_FILE}
    bld.fill_assumptions_tab(sinks["Assumptions"], params)
    bld.fill_company_fin_forecasts_tab(sinks["Company fin forecasts"])
    bld.fill_financials_tab(sinks[" Financials"], dcf.HISTORICAL, fc)
    bld.fill_dcf_input_tab(sinks["DCF input"], dcf.HISTORICAL, fc, params)
    # DCF output is left to recalc from DCF input (its template formulas are intact).

    tmp = pathlib.Path(tempfile.mkdtemp(prefix="tpl_"))
    extracted = tmp / "x"
    with zipfile.ZipFile(args.src) as z:
        names = z.namelist()
        z.extractall(extracted)

    for name, sink in sinks.items():
        if sink.cells:
            apply_edits_to_sheet(extracted / "xl" / "worksheets" / SHEET_FILE[name], sink.cells)

    force_full_recalc(extracted)

    dst = pathlib.Path(args.dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    # Re-zip preserving original part order; [Content_Types].xml first.
    order = [n for n in names if (extracted / n).exists()]
    if "[Content_Types].xml" in order:
        order.remove("[Content_Types].xml")
        order.insert(0, "[Content_Types].xml")
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        for n in order:
            z.write(extracted / n, n)
    print(f"Wrote {dst} (edited {sum(1 for s in sinks.values() if s.cells)} sheets)")


if __name__ == "__main__":
    main()
