# DCF Model Answer — Reference

> **Status:** Reference numbers extracted from `nba-happy-hour-v2.xlsx` (a senior-banker reference build). Use as the AI's grading anchor.
>
> **Note:** This demo uses a banker-style multi-tab layout (`Assumptions`, `Company fin forecasts`, `Financials`, `DCF input`, `DCF output`).
> Candidates use the prescribed Prepped Talent template with **exactly three tabs** — `P&L`, `Valuation Calculation`, `Assumptions`.
> Numbers below are the expected RESULTS regardless of layout. Operator should refresh these when the case study is updated.

---

## Case study

- **Company:** Happy Hour Co (NBA-listed hospitality)
- **Transaction date:** 31 March 2020
- **Last historical FYE:** 30 March 2019
- **Forecast horizon:** 10 years (FY20 stub → FY30)
- **Currency:** AUD millions

## Expected P&L outputs

Numbers candidates should land within ±5% of (driven from Assumptions tab).

| Year | Revenue | EBITDA | EBITDA margin | D&A | EBIT |
|---|---:|---:|---:|---:|---:|
| FY20 | 1,149 | 94.1 | 8.2% | (36.1) | 58.0 |
| FY21 | 1,256 | 92.6 | 7.4% | (40.5) | 52.2 |
| FY22 | 1,354 | 111.8 | 8.3% | (47.2) | 64.6 |
| FY23 | 1,447 | 124.4 | 8.6% | (51.8) | 72.6 |
| FY24 | 1,443 | 127.6 | 8.8% | (54.8) | 72.8 |
| FY25 | 1,471 | 130.5 | 8.9% | (53.6) | 76.9 |
| FY30 | 1,577 | 142.0 | 9.0% | (47.5) | 94.5 |

**Drivers expected on Assumptions tab:**
- Revenue growth: 9.3% → 7.8% → 6.9% → -0.3% → 2.0% → 1.8% → 1.6% → 1.4% → 1.2% → 1.0%
- EBITDA margin: ramps from 7.4% → 9.0% over forecast period
- Capex: $50m flat from FY21 onward
- Tax rate: 17% (forecast) — note FY20 actual was 19%
- D&A approx in line with capex over time

## Expected WACC

| Component | Value |
|---|---|
| Risk-free rate | (operator: pull from case-study brief) |
| Equity risk premium | (operator: pull from case-study brief) |
| Beta (levered) | (operator) |
| Cost of equity (CAPM) | (operator) |
| Pre-tax cost of debt | (operator) |
| Tax rate | 17% |
| **WACC used in DCF** | **8.5%** |
| Perpetuity growth rate | 0.5% |
| Exit EBITDA multiple | 8.5× |

> **Operator action:** Fill in the CAPM components based on the actual case-study materials given to candidates. The 8.5% WACC output is what a good candidate should land on. Acceptable range: ±50bps.

## Expected Valuation outputs

| Component | Perpetuity Growth | Exit EBITDA Multiple |
|---|---:|---:|
| Sum of PV(FCF) | $409.1m | $409.1m |
| PV(Terminal Value) | $394.0m | $579.1m |
| **Enterprise Value** | **$803.1m** | **$988.2m** |
| Net debt & adjustments | ($84.6m) | ($84.6m) |
| **Equity Value** | **$718.5m** | **$903.5m** |
| Implied share price (199m shares) | 361¢ | 454¢ |
| Premium to 165¢ current | ~119% | ~175% |

**Acceptable EV range:** ±10% of expected per methodology. Candidates may submit either methodology; both are valid.

## Common pitfalls to flag

- ❌ Hardcoded revenue figures in P&L (revenue should drive from Assumptions)
- ❌ Forgetting to tax-effect cost of debt in WACC build
- ❌ Using book value rather than market value for capital weights
- ❌ Discount factor calculation inconsistency (mid-year vs end-year convention — either OK if applied consistently)
- ❌ Not discounting terminal value back to present
- ❌ Tax rate inconsistency (e.g. 17% in WACC but 19% in FCF)
- ❌ Capex not deducted from FCF
- ❌ ΔWC sign convention errors
- ❌ Net debt added to EV instead of deducted in equity bridge
- ❌ Hardcoded EBITDA margin (should be calculated)

## Notes for the AI grader

- Acceptable EV range: ±10% of expected per methodology.
- Either Gordon Growth or Exit Multiple methodology is acceptable as long as inputs come from the Assumptions tab.
- For commentary, reference SPECIFIC cells when flagging issues (e.g. "P&L!D14 contains a hardcoded value formatted in black").
- Award partial marks generously when structural approach is correct but exact numbers differ — the goal is teaching, not penalising.
- Candidates may use either AUD or USD — currency choice doesn't matter, internal consistency does.
