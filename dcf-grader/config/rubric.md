# DCF Grading Rubric

> This file is the source of truth for how submissions are graded.
> Edit this file → redeploy the `grade-dcf` Edge Function → changes take effect immediately.

## Overall

- **Total: 100 points**
- All four components must be graded.
- Score must be reproducible — the same model should receive the same score.
- Use whole numbers only.

## Component 1 — P&L Build (40 points)

Tab assessed: **P&L**

| Criteria | Max points | What earns full marks |
|---|---:|---|
| Revenue assumptions are dynamically driven from the Assumptions tab; no hardcoded revenue figures in the P&L tab | 10 | Each revenue line `=Assumptions!Cell` or formula referencing assumption inputs |
| Cost line items correctly categorised, linked to revenue or assumptions, consistent with case study | 10 | COGS, OPEX, etc. all linked appropriately, no orphan hardcodes |
| EBITDA is correctly derived from revenue minus relevant costs, no manual overrides | 8 | `=Revenue - COGS - OPEX` style; cell formula matches structure above |
| D&A correctly treated, sourced from Assumptions, flows correctly through to EBIT | 6 | D&A pulled from Assumptions; EBIT = EBITDA - D&A |
| Key P&L outputs (revenue trajectory, EBITDA margin) materially match the model answer | 6 | Within ±5% of model answer values |

**Deduct points for:** hardcoded revenue, missing tax line, orphan hardcodes in formulas, EBITDA calculation includes one-offs incorrectly.

## Component 2 — WACC (20 points)

Tab assessed: **Assumptions**

| Criteria | Max points | What earns full marks |
|---|---:|---|
| Cost of equity correctly calculated using CAPM (rf, β, ERP all present and correctly sourced) | 6 | `Ke = rf + β × ERP`; inputs labeled and from credible sources |
| Cost of debt correctly specified and tax-effected | 4 | `Kd × (1 - tax)`; tax rate from Assumptions |
| Capital structure weights applied correctly, sum to 100% | 4 | Debt/EV + Equity/EV = 100% |
| Final WACC correctly assembled, no hardcodes or formula errors | 4 | `WACC = E/V × Ke + D/V × Kd × (1-t)` |
| WACC output materially matches the model answer | 2 | Within ±50 bps |

## Component 3 — Valuation Calculation (20 points)

Tab assessed: **Valuation Calculation**

| Criteria | Max points | What earns full marks |
|---|---:|---|
| FCF correctly derived from P&L (D&A added back, capex deducted, working capital movement) | 5 | `FCF = EBIT(1-t) + D&A - Capex - ΔWC` |
| Discount factors correctly calculated and applied to right periods | 4 | `1/(1+WACC)^t` with mid-year convention if used |
| Terminal value correctly calculated (Gordon Growth or exit multiple), inputs from Assumptions | 4 | `TV = FCF × (1+g) / (WACC - g)` style |
| Sum of discounted CFs + discounted TV produces correct enterprise value | 4 | EV = ΣPV(FCF) + PV(TV) |
| Equity bridge correctly handles net debt and any specified adjustments | 3 | `Equity = EV - Net Debt - Minority Interests + Investments` |

## Component 4 — Formatting & Model Layout (20 points)

Tab assessed: **All tabs**

| Criteria | Max points | What earns full marks |
|---|---:|---|
| Hardcoded input values in **blue** font (RGB ~0,0,255 or theme blue) | 6 | All input cells blue; no hardcodes in black |
| Formula cells in **black** font | 4 | All formulas black; no formulas accidentally blue |
| Formulas dynamic from Assumptions tab — no hardcodes within formula cells in P&L or Valuation Calculation tabs | 4 | Inspecting each formula cell, no embedded numeric literals (other than `1`, `0`, `0.5` etc. for math) |
| Exactly 3 tabs named: **P&L**, **Valuation Calculation**, **Assumptions**. No additional substantive tabs | 4 | All three present, exact names; allow non-substantive scratch tabs only if explicitly noted |
| Layout is clean: labelled sections, consistent rows/columns, no merged cells that block formulas | 2 | Subjective — assess overall cleanliness |

## Commentary requirements (applies to all components)

- Reference **specific cells** when flagging issues (e.g. "Cell D14 on the P&L tab contains a hardcoded value").
- Be **actionable** — say what to fix, not just what's wrong.
- Avoid generic statements ("Improve formatting"). Instead: "5 cells on the Assumptions tab have hardcoded values formatted in black: B12, B17, C5, C8, D22."
- If you can't assess something due to missing tabs / parsing issues, say so explicitly and award partial marks.
