"""Flask web UI for the impact-investing portfolio.

Run with:
    python3 app.py

Then open http://127.0.0.1:5000.
"""

from __future__ import annotations

import os

from flask import Flask, jsonify, render_template

from impact_portfolio import Portfolio, _demo_portfolio


SAMPLE_CSV = "sample_portfolio.csv"


def load_portfolio() -> Portfolio:
    if os.path.exists(SAMPLE_CSV):
        return Portfolio.from_csv(SAMPLE_CSV, name="Sample Impact Portfolio")
    return _demo_portfolio()


app = Flask(__name__)
app.config["portfolio"] = load_portfolio()


@app.route("/")
def index():
    return render_template("index.html", name=app.config["portfolio"].name)


@app.route("/api/portfolio")
def api_portfolio():
    return jsonify(app.config["portfolio"].to_payload())


@app.route("/api/refresh", methods=["POST"])
def api_refresh():
    updated = app.config["portfolio"].refresh_prices()
    payload = app.config["portfolio"].to_payload()
    payload["refresh"] = {
        "updated_count": len(updated),
        "tickers": list(updated.keys()),
    }
    return jsonify(payload)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
