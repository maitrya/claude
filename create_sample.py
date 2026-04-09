import pandas as pd

# Create sample data
data = {
    'Amount': [100, 250, 500, 1000, 50, 75, 150],
    'Currency': ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SEK'],
    'Description': [
        'European Euro',
        'British Pound',
        'Japanese Yen',
        'Canadian Dollar',
        'Australian Dollar',
        'Swiss Franc',
        'Swedish Krona'
    ]
}

df = pd.DataFrame(data)
df.to_excel('sample_currencies.xlsx', index=False, sheet_name='Currencies')
print('Sample Excel file created: sample_currencies.xlsx')
