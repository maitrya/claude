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
| Tax rate | 19% | Template hint Y29 ("same as 2021"); aligns with FY21 effective rate. Australian SME-band ~25% is also defensible. |

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

**Comparable set — unlevered beta**

| Comparable | Ticker | Lev β | D/E | Unlev β |
|---|---|---:|---:|---:|
| Endeavour Group | EDV.AX | 0.85 | 35% | 0.66 |
| Coca-Cola Europacific | CCEP | 0.90 | 50% | 0.64 |
| Compass Group | CPG.L | 0.95 | 30% | 0.76 |
| Aramark | ARMK | 1.10 | 80% | 0.67 |
| Aristocrat Leisure | ALL.AX | 0.95 | 15% | 0.85 |
| **Average unlevered β** | | | | **0.72** |

**Capital structure — all-equity.** Tap & Turf runs **net cash** ($84.6m), is asset-light by design, and the brief mentions no debt facilities. The business is therefore valued on an all-equity basis: **WACC = cost of equity**, using the unlevered peer beta directly (no relevering).

**CAPM**

| Component | Value | Notes |
|---|---:|---|
| Unlevered β (peer average) | 0.72 | Used directly — target D/E = 0 |
| Risk-free rate | 4.25% | AU 10-yr government bond, mid-2026 |
| Equity risk premium | 6.00% | Damodaran AU |
| **CAPM cost of equity** | **8.55%** | Rf + β_u × ERP |
| + Specific risk premium | 1.50% | Top-3 venue concentration (55% rev), illiquidity, contract renewal risk |
| **Adjusted cost of equity** | **10.05%** | |
| **WACC (= cost of equity)** | **10.05%** | No debt → no debt weighting |

> Note: removing debt lowers beta (0.78 → 0.72, ↓ Ke) but removes the cheap after-tax-debt weighting (↑ WACC) — net, WACC rises slightly vs a levered structure. A buyer who intends to gear the business (e.g. PE, 3–4× EBITDA) would use a lower WACC; flag this as a sensitivity.

| Other DCF inputs | Value |
|---|---:|
| Perpetuity growth | 2.5% |
| Exit EBITDA multiple | 8.0× |
| Tax rate | 19% |

Acceptable WACC range: 9.0–11.0% (±100bps). Candidates who build CAPM from comps and document their peer set deserve full marks even at a different point estimate; candidates who hardcode a number without justification should lose marks. A candidate who relevers to an assumed debt structure should justify why (net-cash business → all-equity is the default).

## Expected valuation outputs ($m)

| Component | Perpetuity Growth | Exit EBITDA Multiple |
|---|---:|---:|
| Sum of PV(FCF) | 262.2 | 262.2 |
| Terminal value (undiscounted) | 912.9 | 1,427.6 |
| PV(Terminal Value) | 514.0 | 803.7 |
| **Enterprise Value** | **776.2** | **1,065.9** |
| Net debt & adjustments | +84.6 (net cash) | +84.6 |
| **Equity Value** | **860.8** | **1,150.5** |
| Implied EV / LFY EBITDA | 6.08× | 8.36× |
| Implied TV exit multiple (perpetuity) | 5.12× | n/a |

**Acceptable EV range:** ±10% of expected per methodology.

The perpetuity method implies a 5.12× LFY EBITDA at exit, which is conservative versus quoted F&B/concessions comparables. The exit-multiple method anchored at 8× is more aligned with sector norms; both should be presented and the candidate should comment on the divergence.

## Sensitivity (perpetuity method, EV $m)

| WACC \\ g | 1.5% | 2.0% | 2.5% | 3.0% | 3.5% |
|---:|---:|---:|---:|---:|---:|
| 8.0% | 938.5 | 997.1 | 1,066.5 | 1,149.7 | 1,251.3 |
| 9.0% | 812.0 | 853.7 | 901.7 | 957.7 | 1,023.9 |
| **10.05% (central)** | ~712 | ~743 | **~776** | ~816 | ~862 |
| 10.0% | 715.6 | 746.3 | 781.1 | 820.9 | 866.8 |
| 11.0% | 639.8 | 663.1 | 689.2 | 718.5 | 751.8 |
| 12.0% | 578.5 | 596.7 | 616.8 | 639.1 | 664.0 |

## Common pitfalls to flag

- ❌ Using the template's "<<< note" hints (1% terminal growth, 9% terminal margin, D&A as % of capex) instead of the CFO commentary in the case study text
- ❌ Hardcoded revenue figures in P&L — should drive from Assumptions
- ❌ Forgetting that net debt is NEGATIVE ($84.6m **net cash**), so adds to EV in the equity bridge
- ❌ Using EBITDA *post*-exceptionals as the run-rate margin (brief says clean margin, recent 2yrs)
- ❌ Tax rate inconsistency between WACC build and FCF tax line
- ❌ Treating ΔWC as an inflow (brief explicitly says **outflow** of ~1.5%)
- ❌ Discount factor inconsistency — mid-year for explicit period but end-of-year for TV is conventional; both must be applied consistently
- ❌ Not deducting capex from FCF (or netting capex against D&A)
- ❌ Capex stuck at 2% (maintenance only) — brief says use the combined 3% for the full forecast
- ❌ Forecasting margin expansion to 9%+ — CFO explicitly said "no particular reason margins would move materially"
- ❌ Capitalising the WA/SA expansion — brief instructs base case excludes these

## Notes for the AI grader

- Acceptable EV range: ±10% of expected per methodology.
- Either Gordon Growth or Exit Multiple methodology is acceptable; ideally candidate shows both.
- For commentary, reference SPECIFIC cells (e.g. "Financials!Q13 contains hardcoded 6% growth — acceptable; flag if it links to a wider Assumptions cell").
- Award partial marks generously when structural approach is correct but exact numbers differ — the goal is teaching, not penalising.
- Discount convention: mid-year for explicit FCFs, end-of-year for TV. The template uses days-based discounting via columns I66:S66 — accept either approach.
- The xlsx template intentionally contains broken formulas (`#VALUE!` cascade from `L11=K11*(1+L13)` with `L13=-1`). A strong candidate identifies and fixes these before reporting outputs.
