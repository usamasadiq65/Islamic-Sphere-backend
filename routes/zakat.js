const express = require('express');
const router = express.Router();
const axios = require('axios');

const GOLDAPI_KEY = 'goldapi-5j959sme9yb5e0-io';

const goldApiHeaders = {
  'x-access-token': GOLDAPI_KEY,
  'Content-Type': 'application/json'
};

router.get('/prices', async (req, res) => {
  try {
    // Step 1: Get Gold & Silver prices in USD
    console.log("Fetching gold and silver prices...");
    const [goldRes, silverRes] = await Promise.all([
      axios.get('https://www.goldapi.io/api/XAU/USD', { headers: goldApiHeaders }),
      axios.get('https://www.goldapi.io/api/XAG/USD', { headers: goldApiHeaders }),
    ]);
    console.log("Gold Data:", goldRes.data);
    console.log("Silver Data:", silverRes.data);

    const goldPriceGramUSD = goldRes.data.price_gram_24k;
    const silverPriceOunceUSD = silverRes.data.price;

    // Step 2: Get all currency exchange rates
    const fxRes = await axios.get('https://api.exchangerate.host/live?access_key=5c9698e7b470a2efee7a099c4c252ae5');
    const exchangeRates = fxRes.data.quotes;
    console.log("Exchange rates fetched for", Object.keys(exchangeRates).length, "currencies");

    // Step 3: Calculate prices for all currencies
    const silverPriceGramUSD = silverPriceOunceUSD / 31.1035;
    
    const pricesByCurrency = {};
    
    // Add USD first
    pricesByCurrency['USD'] = {
      currency: 'USD',
      symbol: '$',
      usd: 1,
      gold: {
        perGram: parseFloat(goldPriceGramUSD.toFixed(2)),
        perTola: parseFloat((goldPriceGramUSD * 11.664).toFixed(2))
      },
      silver: {
        perGram: parseFloat(silverPriceGramUSD.toFixed(2)),
        perTola: parseFloat((silverPriceGramUSD * 11.664).toFixed(2))
      }
    };

    // Calculate for other currencies
    Object.keys(exchangeRates).forEach(currencyPair => {
      if (currencyPair.startsWith('USD')) {
        const currency = currencyPair.slice(3); // Remove 'USD' prefix
        const rate = exchangeRates[currencyPair];
        
        const goldPriceGram = goldPriceGramUSD * rate;
        const goldPriceTola = goldPriceGram * 11.664;
        const silverPriceGram = silverPriceGramUSD * rate;
        const silverPriceTola = silverPriceGram * 11.664;

        // Get currency symbol (simplified mapping)
        const currencySymbols = {
          'PKR': '₨',
          'EUR': '€',
          'GBP': '£',
          'JPY': '¥',
          'CNY': '¥',
          'INR': '₹',
          'SAR': 'ر.س',
          'AED': 'د.إ',
          'CAD': 'C$',
          'AUD': 'A$',
          'CHF': 'Fr',
          'SEK': 'kr',
          'NOK': 'kr',
          'DKK': 'kr',
          'BRL': 'R$',
          'MXN': '$',
          'ZAR': 'R',
          'KRW': '₩',
          'SGD': 'S$',
          'HKD': 'HK$',
          'NZD': 'NZ$',
          'THB': '฿',
          'MYR': 'RM',
          'PHP': '₱',
          'IDR': 'Rp',
          'VND': '₫',
          'TRY': '₺',
          'RUB': '₽',
          'PLN': 'zł',
          'CZK': 'Kč',
          'HUF': 'Ft',
          'RON': 'lei',
          'BGN': 'лв',
          'HRK': 'kn',
          'ILS': '₪',
          'EGP': 'E£'
        };

        pricesByCurrency[currency] = {
          currency: currency,
          symbol: currencySymbols[currency] || currency,
          usd: rate,
          gold: {
            perGram: parseFloat(goldPriceGram.toFixed(2)),
            perTola: parseFloat(goldPriceTola.toFixed(2))
          },
          silver: {
            perGram: parseFloat(silverPriceGram.toFixed(2)),
            perTola: parseFloat(silverPriceTola.toFixed(2))
          }
        };
      }
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      baseCurrency: 'USD',
      currencies: pricesByCurrency
    });

  } catch (err) {
    console.error('Error fetching zakat prices:', err.message);
    
    // Fallback data with popular currencies when APIs fail
    const fallbackCurrencies = {
      'USD': { currency: 'USD', symbol: '$', usd: 1, gold: { perGram: 113.66, perTola: 1325.75 }, silver: { perGram: 1.31, perTola: 15.28 } },
      'EUR': { currency: 'EUR', symbol: '€', usd: 0.86, gold: { perGram: 97.75, perTola: 1140.14 }, silver: { perGram: 1.13, perTola: 13.18 } },
      'GBP': { currency: 'GBP', symbol: '£', usd: 0.75, gold: { perGram: 85.25, perTola: 994.31 }, silver: { perGram: 0.98, perTola: 11.43 } },
      'PKR': { currency: 'PKR', symbol: '₨', usd: 281.85, gold: { perGram: 32034.85, perTola: 373654.64 }, silver: { perGram: 369.22, perTola: 4307.00 } },
      'INR': { currency: 'INR', symbol: '₹', usd: 88.02, gold: { perGram: 10004.48, perTola: 116692.26 }, silver: { perGram: 115.31, perTola: 1345.49 } },
      'JPY': { currency: 'JPY', symbol: '¥', usd: 148.63, gold: { perGram: 16892.46, perTola: 197013.69 }, silver: { perGram: 194.71, perTola: 2271.18 } },
      'CAD': { currency: 'CAD', symbol: 'C$', usd: 1.38, gold: { perGram: 156.85, perTola: 1829.84 }, silver: { perGram: 1.81, perTola: 21.11 } },
      'AUD': { currency: 'AUD', symbol: 'A$', usd: 1.53, gold: { perGram: 173.90, perTola: 2028.34 }, silver: { perGram: 2.00, perTola: 23.34 } },
      'CHF': { currency: 'CHF', symbol: 'Fr', usd: 0.81, gold: { perGram: 91.51, perTola: 1067.37 }, silver: { perGram: 1.05, perTola: 12.28 } },
      'CNY': { currency: 'CNY', symbol: '¥', usd: 7.14, gold: { perGram: 811.53, perTola: 9466.54 }, silver: { perGram: 9.35, perTola: 109.11 } },
      'SEK': { currency: 'SEK', symbol: 'kr', usd: 9.46, gold: { perGram: 1075.21, perTola: 12541.45 }, silver: { perGram: 12.39, perTola: 144.56 } },
      'NOK': { currency: 'NOK', symbol: 'kr', usd: 10.03, gold: { perGram: 1139.84, perTola: 13295.87 }, silver: { perGram: 13.14, perTola: 153.31 } },
      'DKK': { currency: 'DKK', symbol: 'kr', usd: 6.42, gold: { perGram: 729.69, perTola: 8511.34 }, silver: { perGram: 8.41, perTola: 98.13 } },
      'BRL': { currency: 'BRL', symbol: 'R$', usd: 5.47, gold: { perGram: 621.52, perTola: 7249.22 }, silver: { perGram: 7.16, perTola: 83.58 } },
      'MXN': { currency: 'MXN', symbol: '$', usd: 18.75, gold: { perGram: 2130.61, perTola: 24850.32 }, silver: { perGram: 24.55, perTola: 286.45 } },
      'ZAR': { currency: 'ZAR', symbol: 'R', usd: 17.71, gold: { perGram: 2012.58, perTola: 23474.71 }, silver: { perGram: 23.19, perTola: 270.61 } },
      'KRW': { currency: 'KRW', symbol: '₩', usd: 1393.22, gold: { perGram: 158388.58, perTola: 1848574.74 }, silver: { perGram: 1825.02, perTola: 21291.73 } },
      'SGD': { currency: 'SGD', symbol: 'S$', usd: 1.29, gold: { perGram: 146.62, perTola: 1710.67 }, silver: { perGram: 1.69, perTola: 19.71 } },
      'HKD': { currency: 'HKD', symbol: 'HK$', usd: 7.81, gold: { perGram: 887.48, perTola: 10352.73 }, silver: { perGram: 10.23, perTola: 119.34 } },
      'NZD': { currency: 'NZD', symbol: 'NZ$', usd: 1.71, gold: { perGram: 194.36, perTola: 2267.46 }, silver: { perGram: 2.24, perTola: 26.12 } },
      'THB': { currency: 'THB', symbol: '฿', usd: 32.43, gold: { perGram: 3685.51, perTola: 43004.36 }, silver: { perGram: 42.49, perTola: 495.65 } },
      'MYR': { currency: 'MYR', symbol: 'RM', usd: 4.23, gold: { perGram: 480.79, perTola: 5609.40 }, silver: { perGram: 5.54, perTola: 64.65 } },
      'PHP': { currency: 'PHP', symbol: '₱', usd: 57.43, gold: { perGram: 6527.98, perTola: 76146.47 }, silver: { perGram: 75.24, perTola: 878.01 } },
      'IDR': { currency: 'IDR', symbol: 'Rp', usd: 16433, gold: { perGram: 1868117.78, perTola: 21795031.21 }, silver: { perGram: 21527.23, perTola: 251137.73 } },
      'VND': { currency: 'VND', symbol: '₫', usd: 26370, gold: { perGram: 2996929.20, perTola: 34960468.85 }, silver: { perGram: 34542.67, perTola: 403157.88 } },
      'TRY': { currency: 'TRY', symbol: '₺', usd: 41.16, gold: { perGram: 4676.98, perTola: 54570.16 }, silver: { perGram: 53.89, perTola: 628.74 } },
      'RUB': { currency: 'RUB', symbol: '₽', usd: 80.55, gold: { perGram: 9152.09, perTola: 106781.36 }, silver: { perGram: 105.50, perTola: 1230.84 } },
      'PLN': { currency: 'PLN', symbol: 'zł', usd: 3.67, gold: { perGram: 417.03, perTola: 4866.85 }, silver: { perGram: 4.81, perTola: 56.08 } },
      'CZK': { currency: 'CZK', symbol: 'Kč', usd: 21.06, gold: { perGram: 2393.30, perTola: 27919.00 }, silver: { perGram: 27.59, perTola: 321.81 } },
      'HUF': { currency: 'HUF', symbol: 'Ft', usd: 340.08, gold: { perGram: 38653.49, perTola: 450996.71 }, silver: { perGram: 445.50, perTola: 5199.16 } },
      'SAR': { currency: 'SAR', symbol: 'ر.س', usd: 3.75, gold: { perGram: 426.23, perTola: 4972.12 }, silver: { perGram: 4.91, perTola: 57.30 } },
      'AED': { currency: 'AED', symbol: 'د.إ', usd: 3.67, gold: { perGram: 417.13, perTola: 4868.01 }, silver: { perGram: 4.81, perTola: 56.10 } },
      'EGP': { currency: 'EGP', symbol: 'E£', usd: 48.52, gold: { perGram: 5514.64, perTola: 64330.74 }, silver: { perGram: 63.57, perTola: 741.77 } },
      'ILS': { currency: 'ILS', symbol: '₪', usd: 3.38, gold: { perGram: 384.17, perTola: 4482.43 }, silver: { perGram: 4.43, perTola: 51.66 } }
    };

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      baseCurrency: 'USD',
      currencies: fallbackCurrencies,
      note: 'Using fallback data - external APIs unavailable'
    });
  }
});

module.exports = router;
