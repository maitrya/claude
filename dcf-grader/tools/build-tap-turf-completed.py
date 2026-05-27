"""Open the Tap & Turf template xlsx and write in completed numbers.

Source values are computed in tap-turf-dcf.py. We write VALUES (not
formulas) into each input cell — the template formulas downstream
recalculate when opened in Excel.

Run from repo root:
    python3 dcf-grader/tools/build-tap-turf-completed.py \\
        --src "/path/to/Tap_Turf_Corrupt.xlsx" \\
        --dst "dcf-grader/sample-models/tap-turf-completed.xlsx"
"""

import argparse
import importlib.util
import pathlib
import sys

from openpyxl import load_workbook


def load_dcf_module():
    here = pathlib.Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location("tap_turf_dcf", here / "tap-turf-dcf.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["tap_turf_dcf"] = module
    spec.loader.exec_module(module)
    return module


def write(ws, addr: str, value) -> None:
    ws[addr] = value


def fill_financials_tab(ws, hist, fc) -> None:
    """Financials tab: populate L–P (FY21–FY25 historicals) and Q–V (FY26–FY31 forecast)."""
    years_hist = ["FY21", "FY22", "FY23", "FY24", "FY25"]
    cols_hist = ["L", "M", "N", "O", "P"]
    cols_fc   = ["Q", "R", "S", "T", "U", "V"]

    # Row 11 Total revenue: write the actual revenue figure (overrides L11=K11*(1+L13) formula)
    # Row 12 Management case revenue (input row)
    # Row 15 EBITDA (display) and Row 16 management case EBITDA (input)
    for col, yr in zip(cols_hist, years_hist):
        write(ws, f"{col}11", hist[yr]["rev"])
        write(ws, f"{col}12", hist[yr]["rev"])
        write(ws, f"{col}15", hist[yr]["ebitda_clean"])
        write(ws, f"{col}16", hist[yr]["ebitda_clean"])
        write(ws, f"{col}18", hist[yr]["ebitda_clean"] / hist[yr]["rev"])
        write(ws, f"{col}20", -hist[yr]["da"])
        write(ws, f"{col}25", hist[yr]["ebitda_clean"] - hist[yr]["da"])  # EBIT
        write(ws, f"{col}29", 0.19)                                        # tax rate
        write(ws, f"{col}40", -hist[yr]["capex"])
        # change in WC — case-study says ~ -1.5% of revenue is the forward assumption;
        # historical figures aren't directly given as ΔNWC, so we use -1.5% × rev as approximation
        write(ws, f"{col}45", -hist[yr]["rev"] * 0.015)
        write(ws, f"{col}47", -0.015)
        write(ws, f"{col}49", 0)
        write(ws, f"{col}53", 0)

    for col, row in zip(cols_fc, fc):
        write(ws, f"{col}11", row["rev"])
        write(ws, f"{col}12", row["rev"])
        write(ws, f"{col}13", 0.06)                # forecast growth %
        write(ws, f"{col}15", row["ebitda"])
        write(ws, f"{col}16", row["ebitda"])
        write(ws, f"{col}18", row["ebitda"] / row["rev"])  # margin
        write(ws, f"{col}20", -row["da"])
        write(ws, f"{col}25", row["ebit"])
        write(ws, f"{col}29", 0.19)
        write(ws, f"{col}31", row["ebit"] - row["tax"])    # Net income
        write(ws, f"{col}40", -row["capex"])
        write(ws, f"{col}42", row["capex"] / row["rev"])   # % sales (capex)
        write(ws, f"{col}45", -row["wc"])
        write(ws, f"{col}47", -0.015)
        write(ws, f"{col}49", 0)
        write(ws, f"{col}53", 0)


def fill_dcf_input_tab(ws, hist, fc, params) -> None:
    """DCF input tab: assumptions block + FCF build."""
    write(ws, "F9", params["perp_growth"])
    write(ws, "F10", params["exit_multiple"])
    write(ws, "F11", params["wacc"])

    # Column F=FY18, G=FY19, H=FY20, I=FY21, J=FY22, K=FY23, L=FY24, M=FY25, N=FY26..S=FY31
    historicals = {"I": "FY21", "J": "FY22", "K": "FY23", "L": "FY24", "M": "FY25"}
    for col, yr in historicals.items():
        h = hist[yr]
        write(ws, f"{col}24", h["rev"])
        write(ws, f"{col}25", 0)  # leave growth blank for historicals — formulas compute it
        write(ws, f"{col}27", h["ebitda_clean"])
        write(ws, f"{col}28", h["ebitda_clean"] / h["rev"])
        write(ws, f"{col}31", -h["da"])
        write(ws, f"{col}32", h["da"] / h["rev"])
        write(ws, f"{col}33", h["da"] / h["capex"])
        write(ws, f"{col}35", h["ebitda_clean"] - h["da"])
        write(ws, f"{col}36", (h["ebitda_clean"] - h["da"]) / h["rev"])
        write(ws, f"{col}39", -(h["ebitda_clean"] - h["da"]) * 0.19)
        write(ws, f"{col}40", 0.19)
        write(ws, f"{col}42", (h["ebitda_clean"] - h["da"]) * (1 - 0.19))
        write(ws, f"{col}46", h["da"])
        write(ws, f"{col}48", -h["capex"])
        write(ws, f"{col}49", -h["capex"] / h["rev"])
        write(ws, f"{col}50", h["da"] / h["capex"])
        write(ws, f"{col}52", -h["rev"] * 0.015)
        write(ws, f"{col}53", -0.015)
        write(ws, f"{col}55", 0)
        write(ws, f"{col}56", 0)
        write(ws, f"{col}58", 0)
        write(ws, f"{col}59", 0)

    forecast_cols = ["N", "O", "P", "Q", "R", "S"]
    for col, row in zip(forecast_cols, fc):
        write(ws, f"{col}24", row["rev"])
        write(ws, f"{col}25", 0.06)
        write(ws, f"{col}27", row["ebitda"])
        write(ws, f"{col}28", row["ebitda"] / row["rev"])
        write(ws, f"{col}29", 0)
        write(ws, f"{col}31", -row["da"])
        write(ws, f"{col}32", row["da"] / row["rev"])
        write(ws, f"{col}33", row["da"] / row["capex"])
        write(ws, f"{col}35", row["ebit"])
        write(ws, f"{col}36", row["ebit"] / row["rev"])
        write(ws, f"{col}39", -row["tax"])
        write(ws, f"{col}40", 0.19)
        write(ws, f"{col}42", row["ebiat"])
        write(ws, f"{col}43", row["ebiat"] / row["rev"])
        write(ws, f"{col}46", row["da"])
        write(ws, f"{col}48", -row["capex"])
        write(ws, f"{col}49", -row["capex"] / row["rev"])
        write(ws, f"{col}50", row["da"] / row["capex"])
        write(ws, f"{col}52", -row["wc"])
        write(ws, f"{col}53", -0.015)
        write(ws, f"{col}55", 0)
        write(ws, f"{col}56", 0)
        write(ws, f"{col}58", 0)
        write(ws, f"{col}59", 0)
        write(ws, f"{col}61", row["fcf"])
        write(ws, f"{col}64", row["fcf"])

    # Summary block — Row 111 dates, then summary rows 112-127 = same as above. The template
    # has formulas referencing F24/F27 etc. — those will recalc on open. We don't need to write.


def fill_dcf_output_tab(ws, fc, valuation, params) -> None:
    """DCF output tab: explicit forecast period (FY26-FY31) and TV column T."""
    forecast_cols = ["I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S"]
    # The DCF output uses I=FY21, J=FY22, K=FY23, L=FY24, M=FY25, N=FY26..S=FY31
    # Forecast years are N-S
    historicals = {"I": 0, "J": 1, "K": 2, "L": 3, "M": 4}
    forecast_map = {"N": 0, "O": 1, "P": 2, "Q": 3, "R": 4, "S": 5}

    # Historical block in DCF output (rows 9-28) — minimal: revenue, EBITDA, etc.
    hist_data = [
        (1149.23, 94.15, 36.13, 36.0),
        (1255.63, 92.62, 40.46, 51.0),
        (1353.84, 111.80, 47.20, 50.0),
        (1446.98, 124.40, 51.83, 50.0),
        (1442.62, 127.57, 54.80, 50.0),
    ]
    for col, idx in historicals.items():
        rev, ebitda, da, capex = hist_data[idx]
        write(ws, f"{col}9", rev)
        write(ws, f"{col}11", ebitda)
        write(ws, f"{col}14", -da)
        write(ws, f"{col}17", ebitda - da)
        write(ws, f"{col}21", -capex)

    for col, idx in forecast_map.items():
        r = fc[idx]
        write(ws, f"{col}9", r["rev"])
        write(ws, f"{col}11", r["ebitda"])
        write(ws, f"{col}14", -r["da"])
        write(ws, f"{col}17", r["ebit"])
        write(ws, f"{col}19", -r["tax"])
        write(ws, f"{col}20", 0.19)
        write(ws, f"{col}21", -r["capex"])
        write(ws, f"{col}23", -r["wc"])
        write(ws, f"{col}24", 0)
        write(ws, f"{col}26", 0)
        write(ws, f"{col}28", r["fcf"])

    # TV column T (perpetuity method)
    write(ws, "T28", valuation["tv_perp"])

    # Summary valuation
    write(ws, "F37", valuation["pv_fcf"])
    write(ws, "F38", valuation["pv_tv_perp"])
    write(ws, "F39", valuation["ev_perp"])
    # F40 net debt already in template


def fill_assumptions_tab(ws, params) -> None:
    """Assumptions tab: write WACC into D-column comment area."""
    # The template already has share price, NOSH, net debt. Nothing additional needed.
    pass


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="path to Archie's template xlsx")
    ap.add_argument("--dst", required=True, help="output path for completed xlsx")
    args = ap.parse_args()

    dcf = load_dcf_module()
    fc = dcf.build_forecast()
    valuation = dcf.discount(fc)
    params = {
        "wacc": dcf.WACC,
        "perp_growth": dcf.PERP_GROWTH,
        "exit_multiple": dcf.EXIT_MULTIPLE,
    }

    wb = load_workbook(args.src)
    print(f"Sheets: {wb.sheetnames}")

    fill_assumptions_tab(wb["Assumptions"], params)
    fill_financials_tab(wb[" Financials"], dcf.HISTORICAL, fc)
    fill_dcf_input_tab(wb["DCF input"], dcf.HISTORICAL, fc, params)
    fill_dcf_output_tab(wb["DCF output"], fc, valuation, params)

    pathlib.Path(args.dst).parent.mkdir(parents=True, exist_ok=True)
    wb.save(args.dst)
    print(f"Wrote {args.dst}")


if __name__ == "__main__":
    main()
