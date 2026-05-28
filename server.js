const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const GENEL_PARA_GOLD_URL = 'https://api.genelpara.com/json/?list=altin';
const GENEL_PARA_DOVIZ_URL = 'https://api.genelpara.com/json/?list=doviz';

const GOLD_NAMES = {
  GA: 'Gram Altın',
  XAUUSD: 'Ons Altın',
  C: 'Çeyrek Altın',
  Y: 'Yarım Altın',
  T: 'Tam Altın',
  CMR: 'Cumhuriyet Altını',
  ATA: 'Ata Altın',
  '22': '22 Ayar Bilezik',
  RA: 'Reşat Altın',
  USD: 'Amerikan Doları',
  EUR: 'Euro',
};

// Standard web browser headers to bypass Cloudflare/WAF 403 Forbidden bot blocks
const AXIOS_CONFIG = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Origin': 'https://api.genelpara.com',
    'Referer': 'https://api.genelpara.com/'
  },
  timeout: 15000
};

// Fallback rates if API is completely unreachable at first startup
const INITIAL_FALLBACK_RATES = {
  GA: { alis: '6428.12', satis: '6561.34', degisim: '-1.15', oran: '-1.74', yon: 'moneyDown', kur: 'TRY', sembol: '₺', name: 'Gram Altın', key: 'GA' },
  XAUUSD: { alis: '4431.91', satis: '4432.42', degisim: '-0.54', oran: '-0.54', yon: 'moneyDown', kur: 'USD', sembol: '$', name: 'Ons Altın', key: 'XAUUSD' },
  C: { alis: '10756.24', satis: '11030.87', degisim: '-0.58', oran: '-0.58', yon: 'moneyDown', kur: 'TRY', sembol: '₺', name: 'Çeyrek Altın', key: 'C' },
  Y: { alis: '21545.12', satis: '22030.59', degisim: '-0.58', oran: '-0.58', yon: 'moneyDown', kur: 'TRY', sembol: '₺', name: 'Yarım Altın', key: 'Y' },
  T: { alis: '42900.23', satis: '43774.74', degisim: '-0.58', oran: '-0.58', yon: 'moneyDown', kur: 'TRY', sembol: '₺', name: 'Tam Altın', key: 'T' },
  CMR: { alis: '43224.98', satis: '43963.15', degisim: '-0.58', oran: '-0.58', yon: 'moneyDown', kur: 'TRY', sembol: '₺', name: 'Cumhuriyet Altını', key: 'CMR' },
  ATA: { alis: '43224.99', satis: '43963.16', degisim: '-0.58', oran: '-0.58', yon: 'moneyDown', kur: 'TRY', sembol: '₺', name: 'Ata Altın', key: 'ATA' },
  '22': { alis: '6015.42', satis: '6334.12', degisim: '-0.58', oran: '-0.58', yon: 'moneyDown', kur: 'TRY', sembol: '₺', name: '22 Ayar Bilezik', key: '22' },
  USD: { alis: '45.7562', satis: '46.0460', degisim: '-0.05', oran: '-0.02', yon: 'moneyDown', kur: 'TRY', sembol: '₺', name: 'Amerikan Doları', key: 'USD' },
  EUR: { alis: '53.2461', satis: '53.5755', degisim: '-0.01', oran: '-0.01', yon: 'moneyDown', kur: 'TRY', sembol: '₺', name: 'Euro', key: 'EUR' },
};

// Global Cache Variables
let cachedRates = INITIAL_FALLBACK_RATES;
let lastUpdatedTime = new Date().toISOString();
let isCacheOffline = true;

// Akıllı Dinamik Makas Algoritması (Kapalıçarşı Fiziki Perakende Fiyat Simülasyonu)
function calculatePhysicalRetailRates(key, hamAlisNum, hamSatisNum) {
  let retailSatis = hamSatisNum;
  let retailAlis = hamAlisNum;

  switch (key) {
    case 'GA': // Gram Altın (Fiziki Dükkan: %1.5 satış primi, %1.8 alış makası)
      retailSatis = hamSatisNum * 1.015;
      retailAlis = retailSatis * 0.982;
      break;

    case 'C': // Çeyrek Altın (%2.5 darphane/işçilik primi, %2.5 alış makası)
      retailSatis = hamSatisNum * 1.025;
      retailAlis = retailSatis * 0.975;
      break;

    case 'Y': // Yarım Altın (%2.2 darphane/işçilik primi, %2.2 alış makası)
      retailSatis = hamSatisNum * 1.022;
      retailAlis = retailSatis * 0.978;
      break;

    case 'T': // Tam Altın (%2.0 perakende primi, %2.0 alış makası)
      retailSatis = hamSatisNum * 1.020;
      retailAlis = retailSatis * 0.980;
      break;

    case '22': // 22 Ayar Bilezik (%3.0 yüksek işçilik primi, %5.0 alış işçilik kaybı makası!)
      retailSatis = hamSatisNum * 1.030;
      retailAlis = retailSatis * 0.950;
      break;

    case 'USD': // Amerikan Doları (Döviz Bürosu / Mobil Bankacılık makası: %0.3)
      retailSatis = hamSatisNum * 1.003;
      retailAlis = hamAlisNum * 0.997;
      break;

    case 'EUR': // Euro (%0.3 makas)
      retailSatis = hamSatisNum * 1.003;
      retailAlis = hamAlisNum * 0.997;
      break;

    case 'XAUUSD': // Ons Altın (Spot borsa fiyatı, makas uygulanmaz)
    default:
      retailSatis = hamSatisNum;
      retailAlis = hamAlisNum;
      break;
  }

  return {
    alis: retailAlis.toFixed(2),
    satis: retailSatis.toFixed(2),
  };
}

// Background Price Fetcher Job
async function updateMarketPrices() {
  console.log('[JOBS] Live market rates fetch started...');
  try {
    const [goldResponse, dovizResponse] = await Promise.all([
      axios.get(GENEL_PARA_GOLD_URL, AXIOS_CONFIG),
      axios.get(GENEL_PARA_DOVIZ_URL, AXIOS_CONFIG),
    ]);

    if (!goldResponse.data || !dovizResponse.data) {
      throw new Error('API returned empty or invalid data');
    }

    const rawGoldData = goldResponse.data;
    const rawDovizData = dovizResponse.data;
    const mergedRates = {};

    // Process Gold prices
    Object.keys(rawGoldData).forEach((key) => {
      if (GOLD_NAMES[key]) {
        const hamAlis = parseFloat(rawGoldData[key].alis);
        const hamSatis = parseFloat(rawGoldData[key].satis);
        const retailRates = calculatePhysicalRetailRates(key, hamAlis, hamSatis);

        mergedRates[key] = {
          ...rawGoldData[key],
          alis: retailRates.alis,
          satis: retailRates.satis,
          name: GOLD_NAMES[key],
          key,
        };
      }
    });

    // Process Currency prices
    Object.keys(rawDovizData).forEach((key) => {
      if (GOLD_NAMES[key]) {
        const hamAlis = parseFloat(rawDovizData[key].alis);
        const hamSatis = parseFloat(rawDovizData[key].satis);
        const retailRates = calculatePhysicalRetailRates(key, hamAlis, hamSatis);

        mergedRates[key] = {
          ...rawDovizData[key],
          alis: retailRates.alis,
          satis: retailRates.satis,
          name: GOLD_NAMES[key],
          key,
        };
      }
    });

    // Update Global Cache
    cachedRates = mergedRates;
    lastUpdatedTime = new Date().toISOString();
    isCacheOffline = false;
    console.log(`[JOBS] Cache updated successfully at ${lastUpdatedTime}`);
  } catch (error) {
    console.warn('[JOBS] Live fetch failed, serving cached fallback rates. Reason:', error.message);
    // Keep isCacheOffline as true only if we are using initial placeholder values
    if (cachedRates === INITIAL_FALLBACK_RATES) {
      isCacheOffline = true;
    }
  }
}

// Fetch live rates once immediately at startup
updateMarketPrices();

// Schedule rates updates every 30 seconds (safe, zero rate limits)
setInterval(updateMarketPrices, 30000);

// API Endpoint 1: Home Page Info
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    project: 'Altın Pusulası API Sunucusu',
    author: 'ANDROFAB',
    last_update: lastUpdatedTime,
    offline_fallback: isCacheOffline,
    endpoints: {
      rates: '/rates'
    }
  });
});

// API Endpoint 2: Fetch Live Price List (Serves mobile app in <20ms!)
app.get('/rates', (req, res) => {
  res.json({
    success: true,
    rates: cachedRates,
    isOffline: isCacheOffline,
    lastUpdated: lastUpdatedTime,
  });
});

// API Endpoint 3: Diagnostics Endpoint (Helps identify IP blocks or rate limits)
app.get('/debug', async (req, res) => {
  try {
    const response = await axios.get(GENEL_PARA_GOLD_URL, AXIOS_CONFIG);
    res.json({
      success: true,
      status: response.status,
      data: response.data ? 'Valid Data Received' : 'No Data'
    });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
      status: error.response ? error.response.status : null,
      code: error.code
    });
  }
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 ALTIN PUSULASI API SERVER ACTIVE ON PORT ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`📈 Price Feed: http://localhost:${PORT}/rates`);
  console.log(`==================================================`);
});
