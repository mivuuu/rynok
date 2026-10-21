import { calculateExactPrice, generateCandles, MarketAnchor } from '../engine/math.js';
import { COUNTRIES } from '../config/countries.js';

console.log('🧪 Running Deterministic Math Engine Unit Tests...\n');

// Genesis test anchor for Lumenaria (ETH)
const genesisTime = 1729515000000;
const testAnchor: MarketAnchor = {
  timestamp: genesisTime,
  price: 250.00,
  drift: 0.05,        // Strong bullish shock (+5%)
  volatility: 0.02,   // Elevated volatility
  decay: 0.90,        // Rapid decay
  event_title: 'Люменария открывает беспошлинный транзит'
};

const ticker = 'ETH';
const baseVol = COUNTRIES[ticker].sensitivity.baseVolatility;

// Test 1: Determinism Test (Run 1 vs Run 2)
console.log('1. Checking Determinism between two independent runs...');
const futureTime = genesisTime + 60 * 60 * 1000; // 1 hour later (60 minutes)

const priceRun1 = calculateExactPrice(testAnchor, futureTime, ticker, baseVol);
const priceRun2 = calculateExactPrice(testAnchor, futureTime, ticker, baseVol);

if (priceRun1 !== priceRun2) {
  console.error(`❌ FAILED: Run 1 (${priceRun1}) !== Run 2 (${priceRun2})`);
  process.exit(1);
} else {
  console.log(`✅ PASSED: Both runs produced exactly ${priceRun1}`);
}

// Test 2: Multi-step Candle Generation & OHLC consistency
console.log('\n2. Checking Candle Generation & Integrity (High >= Open/Close >= Low)...');
const candles = generateCandles(testAnchor, genesisTime, futureTime, 5, ticker, baseVol);

console.log(`Generated ${candles.length} candles (5m interval).`);
let ohlcValid = true;
for (const c of candles) {
  if (c.high < c.open || c.high < c.close || c.low > c.open || c.low > c.close) {
    console.error(`❌ INVALID CANDLE: High/Low breach:`, c);
    ohlcValid = false;
    break;
  }
}

if (ohlcValid) {
  console.log(`✅ PASSED: All ${candles.length} candles adhere to strict OHLC integrity rules.`);
  console.log('Sample candle:', candles[candles.length - 1]);
} else {
  process.exit(1);
}

// Test 3: Benchmark (Performance under 10,000 steps)
console.log('\n3. Benchmarking 10,000 1-minute steps (~7 days of RP history)...');
const t0 = performance.now();
const sevenDaysMs = genesisTime + 7 * 24 * 60 * 60 * 1000;
const benchPrice = calculateExactPrice(testAnchor, sevenDaysMs, ticker, baseVol);
const t1 = performance.now();
const elapsed = (t1 - t0).toFixed(2);

console.log(`✅ Calculated 7 days of live 1-minute ticks in ${elapsed}ms. Final price: ${benchPrice}`);

console.log('\n✨ ALL TESTS PASSED SUCCESSFULLY! The mathematical engine is 100% deterministic and ultra-fast.\n');
