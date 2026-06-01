# DCF Model Answer — Tap & Turf Holdings Pty Ltd

> **Status:** Reference build for the Tap & Turf case study (Project Boundary, Round 1 Indicative Bid). Use as the AI's grading anchor.
>
> **Source of numbers:** `dcf-grader/tools/tap-turf-dcf.py` (Python source of truth) → `dcf-grader/sample-models/tap-turf-completed.xlsx` (filled-in banker template).

---

## Case study

- **Company:** Tap & Turf Holdings Pty Ltd (Australian stadium beverage concessions)
- **Currency:** AUD millions
- **Last historical FYE:** 31 March 2025 (FY25)
- **Transaction date:** 31 March 2026
- **Forecast horizon:** 6 years (FY26 → FY31), then terminal value

## Driver assumptions (per CFO commentary in the brief)

| Driver | Value | Source in PDF |
|---|---:|---|
| Revenue growth | 6.0% p.a. flat | CFO: "five to seven percent per year for the existing portfolio" → midpoint |
| EBITDA margin (flat) | 8.72% | Average of FY24 (8.60%) and FY25 (8.84%) clean margins; CFO: "hold at roughly the level you've seen over the last couple of years" |
| D&A / revenue | 3.80% | FY25 actual ratio held forward |
| Capex / revenue | 3.00% | 2% maintenance + 1% step-up replacement cycle, persists for forecast period |
| ΔWC / revenue (outflow) | 1.50% | CFO: "averaged approximately one and a half percent of revenue as an outflow" |
| Other cashflows | nil | "no material provisions, no significant one-off items" |
| Exceptional items | nil | Brief silent on forward exceptionals |
| Effective tax rate | 19% | Per operator. |

## Expected P&L outputs ($m)

| Year | Revenue | EBITDA | EBITDA margin | D&A | EBIT | Tax | EBIAT |
|---|---:|---:|---:|---:|---:|---:|---:|
| FY26 | 1,529.2 | 133.3 | 8.72% | (58.1) | 75.2 | (14.3) | 60.9 |
| FY27 | 1,620.9 | 141.3 | 8.72% | (61.6) | 79.7 | (15.2) | 64.6 |
| FY28 | 1,718.2 | 149.8 | 8.72% | (65.3) | 84.5 | (16.1) | 68.5 |
| FY29 | 1,821.3 | 158.8 | 8.72% | (69.2) | 89.6 | (17.0) | 72.6 |
| FY30 | 1,930.6 | 168.3 | 8.72% | (73.4) | 95.0 | (18.0) | 76.9 |
| FY31 | 2,046.4 | 178.4 | 8.72% | (77.8) | 100.7 | (19.1) | 81.6 |

## Expected FCF build ($m)

| Year | EBIAT | + D&A | – Capex | – ΔWC | **FCF** |
|---|---:|---:|---:|---:|---:|
| FY26 | 60.9 | 58.1 | (45.9) | (22.9) | **50.2** |
| FY27 | 64.6 | 61.6 | (48.6) | (24.3) | **53.3** |
| FY28 | 68.5 | 65.3 | (51.5) | (25.8) | **56.4** |
| FY29 | 72.6 | 69.2 | (54.6) | (27.3) | **59.8** |
| FY30 | 76.9 | 73.4 | (57.9) | (29.0) | **63.4** |
| FY31 | 81.6 | 77.8 | (61.4) | (30.7) | **67.2** |

## Expected WACC (CAPM build)

The case study brief does not supply CAPM inputs, so the build below uses 2026-vintage AU market data and a public-comp peer beta unlevered/relevered to Tap & Turf's target capital structure.

**Comparable set — unlevered beta** (Yahoo Finance / stockanalysis.com, June 2026; CCEP D/E and EV/EBITDA estimated, refresh when Cap IQ data available)

| Comparable | Ticker | Lev β | D/E | Unlev β |
|---|---|---:|---:|---:|
| Endeavour Group | EDV.AX | 0.41 | 134% | 0.20 |
| Coca-Cola Europacific | CCEP | 0.35 | 80% | 0.21 |
| Compass Group | CPG.L | 0.64 | 113% | 0.33 |
| Aramark | ARMK | 1.20 | 214% | 0.44 |
| Aristocrat Leisure | ALL.AX | 0.42 | 31% | 0.34 |
| **Average unlevered β** | | | | **0.30** |

**Capital structure — all-equity.** Tap & Turf runs **net cash** ($84.6m), is asset-light by design, and the brief mentions no debt facilities. The business is therefore valued on an all-equity basis: **WACC = cost of equity**, using the unlevered peer beta directly (no relevering).

**CAPM**

| Component | Value | Notes |
|---|---:|---|
| Unlevered β (peer average) | 0.30 | Used directly — target D/E = 0 |
| Risk-free rate | 4.90% | AU 10-yr government bond, late May 2026 (RBA F2) |
| Equity risk premium | 5.50% | KPMG ANZ Valuation Practices Survey MRP |
| **CAPM cost of equity** | **6.57%** | Rf + β_u × ERP |
| + Specific risk premium | 1.50% | Top-3 venue concentration (55% rev), illiquidity, contract renewal risk |
| **Adjusted cost of equity** | **8.07%** | |
| **WACC (= cost of equity)** | **8.07%** | No debt → no debt weighting |

> Note: removing debt lowers beta (0.78 → 0.72, ↓ Ke) but removes the cheap after-tax-debt weighting (↑ WACC) — net, WACC rises slightly vs a levered structure. A buyer who intends to gear the business (e.g. PE, 3–4× EBITDA) would use a lower WACC; flag this as a sensitivity.

| Other DCF inputs | Value |
|---|---:|
| Perpetuity growth | 2.5% |
| Effective tax rate | 19% |
| Exit EBITDA multiple | 12.96× (peer median) |

WACC inputs (risk-free, ERP, beta peer set, specific-risk premium) are provided to candidates in the brief; candidates build CAPM/WACC from them.

**Terminal value — two methods.** Both are presented:

1. **Perpetuity growth (Gordon)** at g = 2.5%.
2. **Exit EBITDA multiple** at the **median trading EV/EBITDA of the WACC peer set**:

| Comparable | EV/EBITDA |
|---|---:|
| Endeavour Group | 7.64× |
| Coca-Cola Europacific | 10.00× |
| Compass Group | 14.15× |
| Aramark | 12.96× |
| Aristocrat Leisure | 13.37× |
| **Median** | **12.96×** |

> **Caveat for grading:** the peer set is large-cap, diversified consumer/leisure names, so the peer median sits well above what the perpetuity method implies for a niche, concentration-heavy private operator (~6.9× implied). The two methods therefore diverge widely ($1.05bn vs ~$1.73bn). A strong candidate uses the exit-multiple as an upper-bound cross-check and comments on why the peer multiple likely overstates value for this business.

Acceptable WACC range: 9.0–11.0% (±100bps). Candidates who build CAPM from comps and document their peer set deserve full marks even at a different point estimate; candidates who hardcode a number without justification should lose marks. A candidate who relevers to an assumed debt structure should justify why (net-cash business → all-equity is the default).

## Expected valuation outputs ($m)

| Component | Perpetuity Growth | Exit Multiple (12.96×) |
|---|---:|---:|
| Sum of PV(FCF) | 276.4 | 276.4 |
| Terminal value (undiscounted) | 1,237.2 | 2,312.6 |
| PV(Terminal Value) | 776.6 | 1,451.7 |
| **Enterprise Value** | **1,053.1** | **1,728.1** |
| Net debt & adjustments | nil (cash-free/debt-free) | nil |
| **Equity Value** | **1,053.1** | **1,728.1** |

**Reasonableness checks (not independent methods):**

| Check | Value |
|---|---:|
| Implied EV / LFY EBITDA | 8.25× |
| Implied exit multiple (TV ÷ FY31 EBITDA) | 6.93× |

**Acceptable EV range:** ±10%.

> **Deal basis:** valued cash-free / debt-free, so EV = equity value (no net-debt adjustment). The `Company fin forecasts` tab rolls the net cash position forward (FY25 ≈ $32m → FY31 ≈ $218m) as FCF exceeds the $24m annual dividend — informational only, it does not feed the equity bridge.

The perpetuity method implies ~8× LFY EBITDA (6.9× implied exit). The 12.96× peer-multiple method is materially higher because the comp set is large-cap and diversified; treat perpetuity as the more grounded figure and the exit multiple as an upper-bound cross-check.

## Sensitivity (perpetuity method, EV $m)

| WACC \\ g | 1.5% | 2.0% | 2.5% | 3.0% | 3.5% |
|---:|---:|---:|---:|---:|---:|
| 8.0% | 938.5 | 997.1 | 1,066.5 | 1,149.7 | 1,251.3 |
| 9.0% | 812.0 | 853.7 | 901.7 | 957.7 | 1,023.9 |
| **8.07% (central)** | ~970 | ~1,008 | **~1,053** | ~1,106 | ~1,170 |
| 10.0% | 715.6 | 746.3 | 781.1 | 820.9 | 866.8 |
| 11.0% | 639.8 | 663.1 | 689.2 | 718.5 | 751.8 |
| 12.0% | 578.5 | 596.7 | 616.8 | 639.1 | 664.0 |

## Common pitfalls to flag

- ❌ Using the template's "<<< note" hints (1% terminal growth, 9% terminal margin, D&A as % of capex) instead of the CFO commentary in the case study text
- ❌ Hardcoded revenue figures in P&L — should drive from the Assumptions driver block
- ❌ Taking the peer exit multiple (12.96×) at face value without noting it overstates value for a niche operator vs the ~6.9× perpetuity-implied level
- ❌ Applying net debt to the bridge — the deal is cash-free/debt-free, so EV = equity value
- ❌ Using EBITDA *post*-exceptionals as the run-rate margin (brief says clean margin, recent 2yrs)
- ❌ Effective tax rate inconsistency between the WACC build and the FCF tax line (use 19% throughout)
- ❌ Treating ΔWC as an inflow (brief explicitly says **outflow** of ~1.5%)
- ❌ Discount factor inconsistency — mid-year for explicit period but end-of-year for TV is conventional; both must be applied consistently
- ❌ Not deducting capex from FCF (or netting capex against D&A)
- ❌ Capex stuck at 2% (maintenance only) — brief says use the combined 3% for the full forecast
- ❌ Forecasting margin expansion to 9%+ — CFO explicitly said "no particular reason margins would move materially"
- ❌ Capitalising the WA/SA expansion — brief instructs base case excludes these

## Notes for the AI grader

- Acceptable EV range: ±10% per method.
- **Both methods expected:** perpetuity growth (g 2.5%) and exit multiple (12.96× peer median). Perpetuity (~$1.05bn) is the more grounded figure; the exit multiple (~$1.73bn) is an upper-bound cross-check. Credit candidates who flag that the large-cap peer multiple overstates value for a niche operator.
- For commentary, reference SPECIFIC cells (e.g. "Financials!Q13 contains hardcoded 6% growth — acceptable; flag if it links to a wider Assumptions cell").
- Award partial marks generously when structural approach is correct but exact numbers differ — the goal is teaching, not penalising.
- Discount convention: mid-year for explicit FCFs, end-of-year for TV. The template uses days-based discounting via columns I66:S66 — accept either approach.
- The xlsx template intentionally contains broken formulas (`#VALUE!` cascade from `L11=K11*(1+L13)` with `L13=-1`). A strong candidate identifies and fixes these before reporting outputs.
