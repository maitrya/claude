"""
Slippage analysis on a SlippageOrdersReport xlsx export.

Usage:
    python analyze_slippage.py <path-to-xlsx>            # runs all sections
    python analyze_slippage.py <path> --section pareto   # runs one section
    python analyze_slippage.py <path> --no-charts        # tables only

Charts open in the browser (plotly). Tables print to stdout.
Static PNGs are also written to ./output/ for pasting into decks.

Expected sheet: 'SlippageOrdersReport', header on row 2.
Columns (21): Client Ord Id, Cen Ord Id, Recv Time, Taker, TEM, Symbol, Side,
Ord Type, Fill Volume, Exec Time (ms.mic), Avg Price, Notional, Markup Model,
Expected Price, Filled Price, Slippage, Slippage (USD), Expected Price.1,
Filled Price.1, Slippage.1, Slippage (USD).1
(first slippage block = BC / broker-side, second = MK / client-side)
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import matplotlib.pyplot as plt

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


# ----------------------------- load -----------------------------

def load(path: str) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name="SlippageOrdersReport", header=1)
    df = df.rename(columns={
        "Expected Price": "BC_Expected", "Filled Price": "BC_Filled",
        "Slippage": "BC_Slip", "Slippage (USD)": "BC_SlipUSD",
        "Expected Price.1": "MK_Expected", "Filled Price.1": "MK_Filled",
        "Slippage.1": "MK_Slip", "Slippage (USD).1": "MK_SlipUSD",
    })
    df["Recv Time"] = pd.to_datetime(df["Recv Time"])
    df["hour_utc"] = df["Recv Time"].dt.hour
    df["date"] = df["Recv Time"].dt.date
    return df


# ----------------------------- sections -----------------------------

def headline(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for lbl, col in [("BC (broker)", "BC_SlipUSD"), ("Maker (client)", "MK_SlipUSD")]:
        s = df[col]
        rows.append({
            "Side": lbl,
            "Sum slippage USD": s.sum(),
            "Orders": len(s),
            "% orders slipped": (s != 0).mean() * 100,
            "% positive slip": (s > 0).mean() * 100,
            "% negative slip": (s < 0).mean() * 100,
            "Mean $": s.mean(),
            "Median $": s.median(),
            "Std $": s.std(),
            "Skew": s.skew(),
            "Excess kurt": s.kurt(),
            "Worst single $": s.min(),
        })
    out = pd.DataFrame(rows)
    print("\n=== HEADLINE ===")
    print(out.to_string(index=False, float_format=lambda x: f"{x:,.3f}"))
    return out


def pareto_table(df: pd.DataFrame) -> pd.DataFrame:
    """How concentrated is the pain? What % of orders drive what % of loss."""
    rows = []
    for lbl, col in [("BC", "BC_SlipUSD"), ("MK", "MK_SlipUSD")]:
        neg = df[df[col] < 0][col].sort_values()
        total = neg.sum()
        for pct in [1, 5, 10, 25, 50]:
            n = max(1, int(len(neg) * pct / 100))
            rows.append({
                "Side": lbl,
                "Worst %": f"{pct}%",
                "N orders": n,
                "Sum $": neg.head(n).sum(),
                "% of total loss": neg.head(n).sum() / total * 100 if total else 0,
            })
    out = pd.DataFrame(rows)
    print("\n=== PARETO CONCENTRATION ===")
    print(out.to_string(index=False, float_format=lambda x: f"{x:,.2f}"))
    return out


def pareto_chart(df: pd.DataFrame) -> None:
    """Cumulative-loss curve for BC and MK side. X = orders ranked worst→best."""
    fig = go.Figure()
    for lbl, col in [("BC (broker)", "BC_SlipUSD"), ("Maker (client)", "MK_SlipUSD")]:
        neg = df[df[col] < 0][col].sort_values().values
        if len(neg) == 0:
            continue
        x = np.arange(1, len(neg) + 1) / len(neg) * 100
        y = np.cumsum(neg) / neg.sum() * 100
        fig.add_trace(go.Scatter(x=x, y=y, name=lbl, mode="lines"))
    fig.update_layout(
        title="Pareto — cumulative slippage $ vs. worst-N% of slipped orders",
        xaxis_title="Worst orders (%)",
        yaxis_title="Cumulative slippage (% of total)",
        template="plotly_white",
    )
    fig.write_html(OUTPUT_DIR / "pareto.html")
    fig.show()


def per_symbol(df: pd.DataFrame, top: int = 20) -> pd.DataFrame:
    g = df.groupby("Symbol").agg(
        orders=("Client Ord Id", "count"),
        notional=("Notional", "sum"),
        bc_slip_usd=("BC_SlipUSD", "sum"),
        mk_slip_usd=("MK_SlipUSD", "sum"),
        pct_slipped_bc=("BC_SlipUSD", lambda s: (s != 0).mean() * 100),
        pct_slipped_mk=("MK_SlipUSD", lambda s: (s != 0).mean() * 100),
        worst_mk=("MK_SlipUSD", "min"),
    ).reset_index()
    g["bc_bps"] = g["bc_slip_usd"] / g["notional"] * 10_000
    g["mk_bps"] = g["mk_slip_usd"] / g["notional"] * 10_000
    g["mk_minus_bc"] = g["mk_slip_usd"] - g["bc_slip_usd"]
    g = g.sort_values("mk_slip_usd").reset_index(drop=True)  # worst first
    print(f"\n=== TOP {top} SYMBOLS BY MAKER LOSS ===")
    print(g.head(top).to_string(index=False, float_format=lambda x: f"{x:,.2f}"))
    return g


def per_symbol_chart(g: pd.DataFrame, top: int = 15) -> None:
    top_g = g.head(top).copy()
    fig = go.Figure()
    fig.add_bar(x=top_g["Symbol"], y=top_g["bc_slip_usd"], name="BC (broker)", marker_color="steelblue")
    fig.add_bar(x=top_g["Symbol"], y=top_g["mk_slip_usd"], name="Maker (client)", marker_color="crimson")
    fig.update_layout(
        title=f"Top {top} symbols — BC vs Maker slippage ($ USD)",
        barmode="group",
        xaxis_title="", yaxis_title="Slippage USD",
        template="plotly_white",
    )
    fig.write_html(OUTPUT_DIR / "per_symbol.html")
    fig.show()


def divergence(df: pd.DataFrame, g: pd.DataFrame, top: int = 15) -> pd.DataFrame:
    """Where does the desk absorb more than the broker slippage passed through?"""
    d = g.reindex(g["mk_minus_bc"].abs().sort_values(ascending=False).index).head(top)
    d = d[["Symbol", "orders", "bc_slip_usd", "mk_slip_usd", "mk_minus_bc"]].copy()
    d["ratio_mk_over_bc"] = d["mk_slip_usd"] / d["bc_slip_usd"].replace(0, np.nan)
    print(f"\n=== TOP {top} BC-vs-MAKER DIVERGENCE (desk retention vs pass-through) ===")
    print(d.to_string(index=False, float_format=lambda x: f"{x:,.2f}"))
    return d


def distribution_chart(df: pd.DataFrame) -> None:
    """Log-scaled histogram of |slippage USD| to expose the tail."""
    fig = go.Figure()
    for lbl, col in [("BC", "BC_SlipUSD"), ("MK", "MK_SlipUSD")]:
        s = df[df[col] != 0][col].abs()
        if len(s) == 0:
            continue
        fig.add_trace(go.Histogram(x=s, name=lbl, nbinsx=80, opacity=0.6))
    fig.update_layout(
        title="Distribution of |slippage $| (log-scaled y-axis) — tail visibility",
        xaxis_title="|Slippage USD|",
        yaxis_title="Order count",
        yaxis_type="log",
        barmode="overlay",
        template="plotly_white",
    )
    fig.write_html(OUTPUT_DIR / "distribution.html")
    fig.show()


def outlier_trades(df: pd.DataFrame, n: int = 20) -> pd.DataFrame:
    cols = ["Recv Time", "Taker", "Symbol", "Side", "Fill Volume",
            "Notional", "BC_SlipUSD", "MK_SlipUSD"]
    o = df.nsmallest(n, "MK_SlipUSD")[cols].copy()
    print(f"\n=== {n} WORST INDIVIDUAL MAKER SLIPS ===")
    print(o.to_string(index=False, float_format=lambda x: f"{x:,.2f}"))
    return o


def time_of_day(df: pd.DataFrame) -> pd.DataFrame:
    h = df.groupby("hour_utc").agg(
        orders=("Client Ord Id", "count"),
        bc_slip_usd=("BC_SlipUSD", "sum"),
        mk_slip_usd=("MK_SlipUSD", "sum"),
        worst_mk=("MK_SlipUSD", "min"),
    ).reset_index()
    print("\n=== SLIPPAGE BY HOUR OF DAY (UTC) ===")
    print(h.to_string(index=False, float_format=lambda x: f"{x:,.2f}"))

    fig = go.Figure()
    fig.add_bar(x=h["hour_utc"], y=h["mk_slip_usd"], name="Maker $", marker_color="crimson")
    fig.add_bar(x=h["hour_utc"], y=h["bc_slip_usd"], name="BC $", marker_color="steelblue")
    fig.update_layout(
        title="Slippage by hour of day (UTC) — spot the rollover pain",
        barmode="group",
        xaxis=dict(title="Hour UTC", dtick=1),
        yaxis_title="Slippage USD",
        template="plotly_white",
    )
    fig.write_html(OUTPUT_DIR / "time_of_day.html")
    fig.show()
    return h


def by_taker(df: pd.DataFrame) -> pd.DataFrame:
    t = df.groupby("Taker").agg(
        orders=("Client Ord Id", "count"),
        notional=("Notional", "sum"),
        bc_slip_usd=("BC_SlipUSD", "sum"),
        mk_slip_usd=("MK_SlipUSD", "sum"),
    ).reset_index()
    t["mk_bps"] = t["mk_slip_usd"] / t["notional"] * 10_000
    print("\n=== BY TAKER ===")
    print(t.to_string(index=False, float_format=lambda x: f"{x:,.2f}"))
    return t


def volume_vs_slippage(df: pd.DataFrame, symbol: str = "XAUUSD") -> None:
    """Does bigger fill = bigger slip? Scatter, per symbol."""
    sub = df[df["Symbol"] == symbol].copy()
    if sub.empty:
        print(f"No orders for {symbol}")
        return
    sub["abs_mk"] = sub["MK_SlipUSD"].abs()
    r = sub["Notional"].corr(sub["abs_mk"])
    fig = px.scatter(
        sub, x="Notional", y="MK_SlipUSD",
        color="Side", hover_data=["Recv Time", "Fill Volume"],
        title=f"{symbol}: notional vs maker slippage $  (corr with |slip| = {r:.2f})",
        template="plotly_white",
    )
    fig.write_html(OUTPUT_DIR / f"scatter_{symbol}.html")
    fig.show()


def summary_png(g: pd.DataFrame, headline_df: pd.DataFrame) -> None:
    """One static PNG for pasting into a deck."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    top = g.head(12)
    axes[0].barh(top["Symbol"][::-1], top["mk_slip_usd"][::-1], color="crimson")
    axes[0].set_title("Top 12 symbols — Maker slippage $")
    axes[0].set_xlabel("USD")
    axes[0].grid(True, alpha=0.3)

    # cumulative pareto (Maker)
    neg = g.sort_values("mk_slip_usd")["mk_slip_usd"].values
    cum = np.cumsum(neg) / neg.sum() * 100
    axes[1].plot(range(1, len(cum) + 1), cum, marker="o", color="crimson")
    axes[1].set_title("Cumulative Maker slippage vs symbols ranked worst→best")
    axes[1].set_xlabel("Symbols (worst first)")
    axes[1].set_ylabel("% of total loss")
    axes[1].grid(True, alpha=0.3)
    plt.tight_layout()
    out = OUTPUT_DIR / "summary.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    print(f"\nSaved {out}")


# ----------------------------- main -----------------------------

SECTIONS = {
    "headline": lambda df, _g: headline(df),
    "pareto": lambda df, _g: (pareto_table(df), pareto_chart(df)),
    "symbols": lambda df, g: per_symbol_chart(g),
    "divergence": lambda df, g: divergence(df, g),
    "distribution": lambda df, _g: distribution_chart(df),
    "outliers": lambda df, _g: outlier_trades(df),
    "time": lambda df, _g: time_of_day(df),
    "taker": lambda df, _g: by_taker(df),
    "xauusd": lambda df, _g: volume_vs_slippage(df, "XAUUSD"),
}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("file", help="Path to SlippageOrdersReport xlsx")
    ap.add_argument("--section", choices=list(SECTIONS) + ["all"], default="all")
    ap.add_argument("--no-charts", action="store_true", help="tables only")
    ap.add_argument("--symbol", default="XAUUSD", help="symbol for scatter (default XAUUSD)")
    args = ap.parse_args()

    if args.no_charts:
        # monkey-patch plotly show/write_html to no-op
        go.Figure.show = lambda self, *a, **k: None
        go.Figure.write_html = lambda self, *a, **k: None
        px.scatter.__globals__["go"].Figure.show = lambda self, *a, **k: None

    df = load(args.file)
    print(f"Loaded {len(df):,} orders  ({df['Recv Time'].min()} → {df['Recv Time'].max()})")
    print(f"Total notional: ${df['Notional'].sum():,.0f}")

    # Per-symbol table is used by multiple sections; compute once.
    g = per_symbol(df, top=15)

    if args.section == "all":
        headline(df)
        pareto_table(df)
        if not args.no_charts:
            pareto_chart(df)
            per_symbol_chart(g)
        divergence(df, g)
        if not args.no_charts:
            distribution_chart(df)
        outlier_trades(df)
        time_of_day(df)
        by_taker(df)
        if not args.no_charts:
            volume_vs_slippage(df, args.symbol)
        summary_png(g, headline(df))
    else:
        SECTIONS[args.section](df, g)


if __name__ == "__main__":
    sys.exit(main())
