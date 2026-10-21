/**
 * Deterministic Financial Math Engine for Geopolitical RP Market
 * 
 * Guarantees 100% identical price trajectories and OHLC candles across:
 * 1. Cloudflare Worker (when anchoring new events)
 * 2. Any client browser on GitHub Pages (in real-time)
 * 
 * Powered by Mulberry32 PRNG + Time-Seeded Geometric Brownian Motion with Shock Decay.
 */

export interface MarketAnchor {
  timestamp: number; // Unix timestamp in milliseconds
  price: number;     // Anchor base price at this timestamp
  drift: number;     // Initial drift shock μ₀ (e.g., +0.035 or -0.040)
  volatility: number;// Event volatility multiplier (e.g. 0.005 to 0.05)
  decay: number;     // Exponential shock decay per minute (e.g. 0.85 to 0.98)
  event_id?: string;
  event_title?: string;
}

export interface CandleOHLC {
  time: number;      // Unix timestamp in seconds (TradingView standard) or ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 32-bit FNV-1a string hashing function
 */
export function hash32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 PRNG: fast, robust 32-bit pseudo-random number generator
 * Returns a function producing floats in [0, 1)
 */
export function createMulberry32(seed: number): () => number {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform: converts uniform randoms to standard normal distribution N(0, 1)
 */
export function sampleSeededNormal(prng: () => number): number {
  let u1 = prng();
  let u2 = prng();
  // Avoid log(0)
  while (u1 <= 1e-12) {
    u1 = prng();
  }
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Calculates deterministic step parameters for a specific 1-minute bucket.
 * 
 * @param ticker Currency ticker (e.g. 'ETH', 'VYN')
 * @param minuteTimestamp Timestamp rounded to 1-minute bucket (in ms)
 * @param minutesSinceAnchor Number of minutes elapsed since the event shock anchor
 * @param anchor Active market shock anchor
 * @param baseVolatility Inherent natural volatility of the currency
 */
export function getMinuteStep(
  ticker: string,
  minuteTimestamp: number,
  minutesSinceAnchor: number,
  anchor: MarketAnchor,
  baseVolatility: number
): { deltaPct: number; prng: () => number } {
  const seedString = `${ticker}:${minuteTimestamp}`;
  const seed = hash32(seedString);
  const prng = createMulberry32(seed);

  // Shock drift decays exponentially with each minute
  // drift_m = μ₀ * (decay ^ m)
  const effectiveDecay = Math.pow(Math.max(0.5, Math.min(0.999, anchor.decay)), Math.max(0, minutesSinceAnchor));
  const shockDrift = anchor.drift * effectiveDecay;

  // Total volatility: inherent baseline + decaying shock volatility
  const totalVol = baseVolatility + anchor.volatility * effectiveDecay;

  // Sample Gaussian noise
  const epsilon = sampleSeededNormal(prng);

  // GBM discrete step: ΔP / P = drift + σ * ε
  const deltaPct = shockDrift + totalVol * epsilon;

  return { deltaPct, prng };
}

/**
 * Deterministically computes the exact price of a currency at any target timestamp
 * starting from its anchor checkpoint.
 * 
 * Time complexity: O(Δ minutes). For realistic RP intervals (e.g. hours to days),
 * computing a few hundred/thousand 1-minute steps takes < 2ms in V8.
 */
export function calculateExactPrice(
  anchor: MarketAnchor,
  targetTimestamp: number,
  ticker: string,
  baseVolatility: number = 0.001
): number {
  if (targetTimestamp <= anchor.timestamp) {
    return anchor.price;
  }

  const ONE_MINUTE_MS = 60 * 1000;
  const startMinute = Math.floor(anchor.timestamp / ONE_MINUTE_MS);
  const endMinute = Math.floor(targetTimestamp / ONE_MINUTE_MS);

  let currentPrice = anchor.price;

  // Step through each whole elapsed minute
  for (let m = startMinute + 1; m <= endMinute; m++) {
    const minuteTimestamp = m * ONE_MINUTE_MS;
    const minutesSinceAnchor = m - startMinute;

    const { deltaPct } = getMinuteStep(ticker, minuteTimestamp, minutesSinceAnchor, anchor, baseVolatility);

    // Apply change with floor protection (price can never go negative or zero)
    currentPrice = Math.max(0.0001, currentPrice * (1 + deltaPct));
  }

  // Fractional minute interpolation (for second-accurate live updates)
  const remainingMs = targetTimestamp - (endMinute * ONE_MINUTE_MS);
  if (remainingMs > 0) {
    const fraction = remainingMs / ONE_MINUTE_MS;
    const nextMinuteTimestamp = (endMinute + 1) * ONE_MINUTE_MS;
    const minutesSinceAnchor = (endMinute + 1) - startMinute;
    const { deltaPct } = getMinuteStep(ticker, nextMinuteTimestamp, minutesSinceAnchor, anchor, baseVolatility);

    currentPrice = Math.max(0.0001, currentPrice * (1 + deltaPct * fraction));
  }

  return Number(currentPrice.toFixed(4));
}

/**
 * Deterministically generates OHLC candles for any interval (e.g. 1m, 5m, 15m, 60m).
 * 
 * @param anchor The active market anchor
 * @param fromTimestamp Start timestamp (ms)
 * @param toTimestamp End timestamp (ms)
 * @param intervalMinutes Candle interval in minutes (default: 1)
 * @param ticker Currency ticker
 * @param baseVolatility Currency base volatility
 */
export function generateCandles(
  anchor: MarketAnchor,
  fromTimestamp: number,
  toTimestamp: number,
  intervalMinutes: number = 1,
  ticker: string,
  baseVolatility: number = 0.001
): CandleOHLC[] {
  const ONE_MINUTE_MS = 60 * 1000;
  const intervalMs = intervalMinutes * ONE_MINUTE_MS;

  // Align start and end to interval boundaries
  const startBoundary = Math.floor(Math.max(anchor.timestamp, fromTimestamp) / intervalMs) * intervalMs;
  const endBoundary = Math.floor(toTimestamp / intervalMs) * intervalMs;

  const candles: CandleOHLC[] = [];

  // First compute price at startBoundary
  let runningPrice = calculateExactPrice(anchor, startBoundary, ticker, baseVolatility);

  for (let t = startBoundary; t <= endBoundary; t += intervalMs) {
    const candleOpen = runningPrice;
    let candleHigh = candleOpen;
    let candleLow = candleOpen;

    // Simulate intra-candle 1-minute steps
    for (let m = 0; m < intervalMinutes; m++) {
      const stepTime = t + m * ONE_MINUTE_MS;
      if (stepTime > toTimestamp) break;

      const minutesSinceAnchor = Math.max(1, Math.floor((stepTime - anchor.timestamp) / ONE_MINUTE_MS));
      const { deltaPct, prng } = getMinuteStep(ticker, stepTime, minutesSinceAnchor, anchor, baseVolatility);

      runningPrice = Math.max(0.0001, runningPrice * (1 + deltaPct));

      // Generate intra-minute wick spikes for authentic look
      const subVol = baseVolatility * 1.5;
      const wickHigh = runningPrice * (1 + Math.abs(sampleSeededNormal(prng) * subVol));
      const wickLow = runningPrice * (1 - Math.abs(sampleSeededNormal(prng) * subVol));

      if (wickHigh > candleHigh) candleHigh = wickHigh;
      if (wickLow < candleLow) candleLow = wickLow;
      if (runningPrice > candleHigh) candleHigh = runningPrice;
      if (runningPrice < candleLow) candleLow = runningPrice;
    }

    const candleClose = runningPrice;

    // Deterministic volume based on price swing & ticker seed
    const candleSeed = hash32(`vol:${ticker}:${t}`);
    const volPrng = createMulberry32(candleSeed);
    const baseVolume = 10000 + volPrng() * 50000;
    const priceChangePct = Math.abs((candleClose - candleOpen) / candleOpen);
    const volume = Math.round(baseVolume * (1 + priceChangePct * 100));

    candles.push({
      time: Math.floor(t / 1000), // TradingView Lightweight Charts uses Unix seconds
      open: Number(candleOpen.toFixed(4)),
      high: Number(candleHigh.toFixed(4)),
      low: Number(candleLow.toFixed(4)),
      close: Number(candleClose.toFixed(4)),
      volume
    });
  }

  return candles;
}
