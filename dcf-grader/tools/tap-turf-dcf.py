"""Tap & Turf Holdings — DCF reference calc.

Source of truth for the completed model. Run to print P&L, FCF build,
EV/equity bridge, and a WACC × growth-rate sensitivity table.

Assumptions follow the case-study brief (CFO commentary), not the
"<<< note" hints in the template (which look like scaffolding).
"""

from __future__ import annotations

HISTORICAL = {
    # FYE Mar — actuals from "Company fin forecasts" tab
    "FY21": {"rev": 1149.23, "ebitda_clean": 94.15, "da": 36.13, "capex": 36.0, "tax": -18.06, "pbt": 54.92},
    "FY22": {"rev": 1255.63, "ebitda_clean": 92.62, "da": 40.46, "capex": 51.0, "tax": -8.69,  "pbt": 48.07},
    "FY23": {"rev": 1353.84, "ebitda_clean": 111.80, "da": 47.20, "capex": 50.0, "tax": -10.93, "pbt": 60.50},
    "FY24": {"rev": 1446.98, "ebitda_clean": 124.40, "da": 51.83, "capex": 50.0, "tax": -12.36, "pbt": 68.47},
    "FY25": {"rev": 1442.62, "ebitda_clean": 127.57, "da": 54.80, "capex": 50.0, "tax": -12.42, "pbt": 68.67},
}

# Forecast assumptions (per case-study brief)
REV_GROWTH = 0.06                          # CFO: 5-7%, midpoint
EBITDA_MARGIN = round((124.40 / 1446.98 + 127.57 / 1442.62) / 2, 4)   # avg of FY24-FY25 clean margin
DA_PCT_REV = round(54.80 / 1442.62, 4)     # FY25 D&A / FY25 revenue
CAPEX_PCT_REV = 0.03                       # 2% maint + 1% step-up
WC_PCT_REV = 0.015                         # 1.5% outflow of revenue
OTHER_CF = 0.0
EXCEPTIONALS = 0.0
TAX_RATE = 0.19                            # template Y29 hint: same as FY21 (effective ~18-19%)

# DCF inputs
WACC = 0.10
PERP_GROWTH = 0.025
EXIT_MULTIPLE = 8.0
NET_DEBT = -84.62                          # net CASH per Assumptions D19 (negative = cash)

FORECAST_YEARS = ["FY26", "FY27", "FY28", "FY29", "FY30", "FY31"]


def build_forecast() -> list[dict]:
    rev_prev = HISTORICAL["FY25"]["rev"]
    rows = []
    for i, yr in enumerate(FORECAST_YEARS, start=1):
        rev = rev_prev * (1 + REV_GROWTH)
        ebitda = rev * EBITDA_MARGIN
        da = rev * DA_PCT_REV
        ebit = ebitda - da
        tax = ebit * TAX_RATE
        ebiat = ebit - tax
        capex = rev * CAPEX_PCT_REV
        wc = rev * WC_PCT_REV
        fcf = ebiat + da - capex - wc - OTHER_CF - EXCEPTIONALS
        rows.append({
            "year": yr,
            "t": i - 0.5,             # mid-year discount factor exponent
            "rev": rev, "ebitda": ebitda, "da": da, "ebit": ebit,
            "tax": tax, "ebiat": ebiat, "capex": capex, "wc": wc, "fcf": fcf,
        })
        rev_prev = rev
    return rows


def discount(rows: list[dict]) -> dict:
    pv_fcf = sum(r["fcf"] / (1 + WACC) ** r["t"] for r in rows)
    last = rows[-1]

    # Perpetuity growth method — TV at end of last forecast year
    tv_perp = last["fcf"] * (1 + PERP_GROWTH) / (WACC - PERP_GROWTH)
    pv_tv_perp = tv_perp / (1 + WACC) ** len(rows)

    # Exit-multiple method
    tv_mult = last["ebitda"] * EXIT_MULTIPLE
    pv_tv_mult = tv_mult / (1 + WACC) ** len(rows)

    ev_perp = pv_fcf + pv_tv_perp
    ev_mult = pv_fcf + pv_tv_mult

    return {
        "pv_fcf": pv_fcf,
        "tv_perp": tv_perp, "pv_tv_perp": pv_tv_perp, "ev_perp": ev_perp,
        "tv_mult": tv_mult, "pv_tv_mult": pv_tv_mult, "ev_mult": ev_mult,
        "equity_perp": ev_perp - NET_DEBT,
        "equity_mult": ev_mult - NET_DEBT,
        "implied_exit_multiple_from_perp": tv_perp / last["ebitda"],
    }


def sensitivity(rows: list[dict], waccs: list[float], gs: list[float]) -> list[list[float]]:
    last = rows[-1]
    out = []
    for w in waccs:
        row = []
        pv_fcf = sum(r["fcf"] / (1 + w) ** r["t"] for r in rows)
        for g in gs:
            if w <= g:
                row.append(float("nan"))
                continue
            tv = last["fcf"] * (1 + g) / (w - g)
            pv_tv = tv / (1 + w) ** len(rows)
            row.append(pv_fcf + pv_tv)
        out.append(row)
    return out


def fmt(x: float, w: int = 9, dp: int = 1) -> str:
    if x != x:
        return f"{'n.m.':>{w}}"
    return f"{x:>{w},.{dp}f}"


def main() -> None:
    print("=" * 80)
    print("Tap & Turf Holdings Pty Ltd — DCF reference build")
    print("=" * 80)
    print(f"Revenue growth        : {REV_GROWTH:.1%}")
    print(f"EBITDA margin (flat)  : {EBITDA_MARGIN:.2%}  (avg FY24-FY25 clean)")
    print(f"D&A / revenue         : {DA_PCT_REV:.2%}    (FY25)")
    print(f"Capex / revenue       : {CAPEX_PCT_REV:.2%}    (2% maint + 1% step-up)")
    print(f"ΔWC / revenue (outflow): {WC_PCT_REV:.2%}")
    print(f"Tax rate              : {TAX_RATE:.1%}")
    print(f"WACC                  : {WACC:.1%}")
    print(f"Perpetuity growth     : {PERP_GROWTH:.1%}")
    print(f"Exit EBITDA multiple  : {EXIT_MULTIPLE:.1f}x")
    print(f"Net cash (–ve = debt) : {NET_DEBT:.1f}")

    rows = build_forecast()

    print("\nForecast P&L / FCF ($m)")
    hdr = f"{'':<10}" + "".join(f"{r['year']:>9}" for r in rows)
    print(hdr)
    for label, key in [
        ("Revenue", "rev"), ("EBITDA", "ebitda"), ("D&A", "da"), ("EBIT", "ebit"),
        ("Tax", "tax"), ("EBIAT", "ebiat"), ("Capex", "capex"), ("Δ NWC", "wc"),
        ("FCF", "fcf"),
    ]:
        print(f"{label:<10}" + "".join(fmt(r[key]) for r in rows))

    val = discount(rows)
    print("\nValuation ($m)")
    print(f"  PV of FCF                       {val['pv_fcf']:>10,.1f}")
    print(f"  TV (perpetuity, g={PERP_GROWTH:.1%})        {val['tv_perp']:>10,.1f}")
    print(f"  PV of TV (perpetuity)           {val['pv_tv_perp']:>10,.1f}")
    print(f"  Enterprise value (perpetuity)   {val['ev_perp']:>10,.1f}")
    print(f"  Equity value (perpetuity)       {val['equity_perp']:>10,.1f}")
    print()
    print(f"  TV (exit multiple, {EXIT_MULTIPLE:.1f}x)        {val['tv_mult']:>10,.1f}")
    print(f"  PV of TV (exit multiple)        {val['pv_tv_mult']:>10,.1f}")
    print(f"  Enterprise value (multiple)     {val['ev_mult']:>10,.1f}")
    print(f"  Equity value (multiple)         {val['equity_mult']:>10,.1f}")
    print()
    print(f"  Implied EV / LFY EBITDA (perp)  {val['ev_perp']/HISTORICAL['FY25']['ebitda_clean']:>10,.2f}x")
    print(f"  Implied EV / LFY EBITDA (mult)  {val['ev_mult']/HISTORICAL['FY25']['ebitda_clean']:>10,.2f}x")
    print(f"  Implied TV multiple (perpetuity){val['implied_exit_multiple_from_perp']:>10,.2f}x")

    print("\nEnterprise value sensitivity — WACC × perpetuity growth ($m)")
    waccs = [0.08, 0.09, 0.10, 0.11, 0.12]
    gs    = [0.015, 0.020, 0.025, 0.030, 0.035]
    table = sensitivity(rows, waccs, gs)
    header_label = "WACC \\ g"
    print(f"{header_label:<10}" + "".join(f"{g:>9.1%}" for g in gs))
    for w, row in zip(waccs, table):
        print(f"{w:<10.1%}" + "".join(fmt(v) for v in row))


if __name__ == "__main__":
    main()
