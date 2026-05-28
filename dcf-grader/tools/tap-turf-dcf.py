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

# --- WACC build (CAPM with public-comp peer beta) ---------------------------
# Tap & Turf is private. We unlever betas from listed comps, average, then
# relever at the target capital structure.

RISK_FREE = 0.0425        # AU 10-yr government bond yield, mid-2026
ERP = 0.06                # Australian equity risk premium (Damodaran)
SPECIFIC_RISK = 0.015     # Private illiquidity + venue concentration (top-3 = 55% of rev)

# Comparable set — levered beta and D/E from public filings / Bloomberg-style sources
COMPS = [
    {"name": "Endeavour Group",            "ticker": "EDV.AX",  "lev_beta": 0.85, "de": 0.35},
    {"name": "Coca-Cola Europacific",      "ticker": "CCEP",    "lev_beta": 0.90, "de": 0.50},
    {"name": "Compass Group",              "ticker": "CPG.L",   "lev_beta": 0.95, "de": 0.30},
    {"name": "Aramark",                    "ticker": "ARMK",    "lev_beta": 1.10, "de": 0.80},
    {"name": "Aristocrat Leisure",         "ticker": "ALL.AX",  "lev_beta": 0.95, "de": 0.15},
]

# Target capital structure — the business runs NET CASH and is asset-light by design,
# with no debt facilities mentioned in the brief. We therefore value it on an
# all-equity basis: WACC = cost of equity, beta = unlevered peer beta.
TARGET_DV = 0.0
TARGET_EV_RATIO = 1.0
TARGET_DE = 0.0

COST_OF_DEBT_PRETAX = 0.055   # AU BBB corporate — informational only (zero weight)


def unlever(lev_beta: float, de: float, tax: float) -> float:
    return lev_beta / (1 + (1 - tax) * de)


def relever(unlev_beta: float, de: float, tax: float) -> float:
    return unlev_beta * (1 + (1 - tax) * de)


def build_wacc() -> dict:
    enriched = []
    for c in COMPS:
        ul = unlever(c["lev_beta"], c["de"], TAX_RATE)
        enriched.append({**c, "unlev_beta": ul})
    avg_unlev = sum(c["unlev_beta"] for c in enriched) / len(enriched)
    target_lev_beta = relever(avg_unlev, TARGET_DE, TAX_RATE)
    ke_capm = RISK_FREE + target_lev_beta * ERP
    ke_adj = ke_capm + SPECIFIC_RISK
    kd_after_tax = COST_OF_DEBT_PRETAX * (1 - TAX_RATE)
    wacc = TARGET_EV_RATIO * ke_adj + TARGET_DV * kd_after_tax
    return {
        "comps": enriched,
        "avg_unlev_beta": avg_unlev,
        "target_lev_beta": target_lev_beta,
        "ke_capm": ke_capm,
        "ke_adjusted": ke_adj,
        "kd_after_tax": kd_after_tax,
        "wacc": wacc,
    }


# DCF inputs (WACC overridden after CAPM build below)
PERP_GROWTH = 0.025
EXIT_MULTIPLE = 8.0
NET_DEBT = 0.0                             # cash-free / debt-free deal basis → equity = EV
WACC = build_wacc()["wacc"]

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


def print_wacc_build() -> None:
    w = build_wacc()
    print("\nWACC build (CAPM, public-comp peer beta)")
    print(f"{'Comparable':<28}{'Ticker':<10}{'Lev β':>8}{'D/E':>8}{'Unlev β':>10}")
    for c in w["comps"]:
        print(f"  {c['name']:<26}{c['ticker']:<10}{c['lev_beta']:>8.2f}{c['de']:>8.0%}{c['unlev_beta']:>10.3f}")
    print(f"  {'Average unlevered β':<26}{'':<10}{'':>8}{'':>8}{w['avg_unlev_beta']:>10.3f}")
    print(f"\n  Target D/(D+E)             : {TARGET_DV:.0%}")
    print(f"  Target D/E                  : {TARGET_DE:.2f}")
    print(f"  Re-levered β                : {w['target_lev_beta']:.3f}")
    print(f"  Risk-free rate (AU 10Y)     : {RISK_FREE:.2%}")
    print(f"  Equity risk premium         : {ERP:.2%}")
    print(f"  CAPM cost of equity         : {w['ke_capm']:.2%}")
    print(f"  + Specific risk premium     : {SPECIFIC_RISK:.2%}")
    print(f"  Adjusted cost of equity     : {w['ke_adjusted']:.2%}")
    print(f"  Pre-tax cost of debt        : {COST_OF_DEBT_PRETAX:.2%}")
    print(f"  After-tax cost of debt      : {w['kd_after_tax']:.2%}")
    print(f"  WACC                        : {w['wacc']:.2%}")


def main() -> None:
    print("=" * 80)
    print("Tap & Turf Holdings Pty Ltd — DCF reference build")
    print("=" * 80)
    print_wacc_build()
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
    print("\nValuation — PERPETUITY GROWTH (primary, no comps for an exit multiple) ($m)")
    print(f"  PV of FCF                       {val['pv_fcf']:>10,.1f}")
    print(f"  TV (perpetuity, g={PERP_GROWTH:.1%})        {val['tv_perp']:>10,.1f}")
    print(f"  PV of TV (perpetuity)           {val['pv_tv_perp']:>10,.1f}")
    print(f"  Enterprise value               {val['ev_perp']:>10,.1f}")
    print(f"  Equity value (= EV, debt-free)  {val['equity_perp']:>10,.1f}")
    print()
    print("  Reasonableness check (NOT an independent method):")
    print(f"   Implied EV / LFY EBITDA        {val['ev_perp']/HISTORICAL['FY25']['ebitda_clean']:>10,.2f}x")
    print(f"   Implied exit multiple (TV/FY31 EBITDA){val['implied_exit_multiple_from_perp']:>6,.2f}x")

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
