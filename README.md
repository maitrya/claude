# Currency Converter

A Python-based currency converter that converts all currency pairs to nominal USD amounts, with Excel file support.

## Features

- Fetch real-time exchange rates from ExchangeRate-API
- Convert any currency amount to USD
- **Handle multiple currency conversions at once**
- **Upload and process Excel files with currency data**
- Get conversion rates between currencies
- Auto-formatted Excel output with color-coded columns
- Clean and simple API

## Requirements

- Python 3.7+
- requests library
- pandas library
- openpyxl library

## Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Basic Usage with Python

```python
from currency_converter import CurrencyConverter

# Create converter instance
converter = CurrencyConverter()

# Convert single amount
usd_amount = converter.convert_to_usd(100, "EUR")
print(f"100 EUR = ${usd_amount:.2f}")

# Convert multiple amounts
pairs = [(100, "EUR"), (1000, "JPY"), (50, "GBP")]
results = converter.convert_multiple(pairs)
for original, usd in results.items():
    print(f"{original}: ${usd:.2f}")

# Get conversion rates
rate = converter.get_conversion_rate("EUR")
print(f"1 EUR = ${rate:.4f}")
```

### Processing Excel Files

The converter can now read Excel files with currency data and output results to a new Excel file.

**Excel Input Format:**
Create an Excel file with at least these columns:
- `Amount`: The numeric amount to convert
- `Currency`: The currency code (EUR, GBP, JPY, etc.)
- Optional: Any other columns you want to keep

**Example:**
```python
from currency_converter import CurrencyConverter

converter = CurrencyConverter()

# Process Excel file
result = converter.process_excel_file(
    file_path='currencies.xlsx',
    amount_col='Amount',
    currency_col='Currency',
    output_file='currencies_converted.xlsx'
)
```

The output file will include:
- `USD_Amount`: The converted amount in USD
- `Exchange_Rate`: The conversion rate used
- All original columns from your input file

### Running the Example

```bash
python currency_converter.py
```

This will:
1. Check for a sample Excel file and process it if found
2. Display manual conversion examples for common currencies
3. Show current exchange rates

## Creating Sample Data

A helper script is included to create sample Excel data:
```bash
python create_sample.py
```

This creates `sample_currencies.xlsx` with 7 different currencies for testing.

## API Reference

### CurrencyConverter Class

#### `fetch_rates(currency: str = "USD") -> Dict[str, float]`
Fetch exchange rates for a given currency from the API.

#### `convert_to_usd(amount: float, from_currency: str) -> float`
Convert an amount from a given currency to USD.

#### `convert_multiple(pairs: List[tuple]) -> Dict[str, float]`
Convert multiple currency amounts to USD at once.

#### `get_conversion_rate(from_currency: str, to_currency: str = "USD") -> float`
Get the conversion rate between two currencies.

#### `process_excel_file(file_path: str, amount_col: str = "Amount", currency_col: str = "Currency", output_file: str = None) -> Dict`
Process an Excel file and convert all currencies to USD, saving results to a new Excel file.

**Parameters:**
- `file_path`: Path to input Excel file
- `amount_col`: Column name containing amounts (default: "Amount")
- `currency_col`: Column name containing currency codes (default: "Currency")
- `output_file`: Path for output file (default: adds "_USD" to input filename)

**Returns:** Dictionary with conversion results and statistics

## Data Source

Exchange rates are fetched from [ExchangeRate-API](https://www.exchangerate-api.com/)

## License

MIT
