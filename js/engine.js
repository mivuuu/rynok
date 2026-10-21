/**
 * Browser ESM Deterministic Math Engine
 * Mirrors src/engine/math.ts 1:1 for identical browser execution.
 */

export function hash32(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createMulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleSeededNormal(prng) {
  let u1 = prng();
  let u2 = prng();
  while (u1 <= 1e-12) {
    u1 = prng();
  }
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

export function getMinuteStep(ticker, minuteTimestamp, minutesSinceAnchor, anchor, baseVolatility) {
  const seedString = `${ticker}:${minuteTimestamp}`;
  const seed = hash32(seedString);
  const prng = createMulberry32(seed);

  const effectiveDecay = Math.pow(Math.max(0.5, Math.min(0.999, anchor.decay)), Math.max(0, minutesSinceAnchor));
  const shockDrift = anchor.drift * effectiveDecay;
  const totalVol = baseVolatility + anchor.volatility * effectiveDecay;
  const epsilon = sampleSeededNormal(prng);

  const deltaPct = shockDrift + totalVol * epsilon;
  return { deltaPct, prng };
}

export function calculateExactPrice(anchor, targetTimestamp, ticker, baseVolatility = 0.001) {
  if (targetTimestamp <= anchor.timestamp) {
    return anchor.price;
  }

  const ONE_MINUTE_MS = 60 * 1000;
  const startMinute = Math.floor(anchor.timestamp / ONE_MINUTE_MS);
  const endMinute = Math.floor(targetTimestamp / ONE_MINUTE_MS);

  let currentPrice = anchor.price;

  for (let m = startMinute + 1; m <= endMinute; m++) {
    const minuteTimestamp = m * ONE_MINUTE_MS;
    const minutesSinceAnchor = m - startMinute;
    const { deltaPct } = getMinuteStep(ticker, minuteTimestamp, minutesSinceAnchor, anchor, baseVolatility);
    currentPrice = Math.max(0.0001, currentPrice * (1 + deltaPct));
  }

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

export function generateCandles(anchorInput, fromTimestamp, toTimestamp, intervalMinutes = 1, ticker, baseVolatility = 0.001) {
  const ONE_MINUTE_MS = 60 * 1000;
  const intervalMs = intervalMinutes * ONE_MINUTE_MS;

  const anchors = Array.isArray(anchorInput) ? [...anchorInput] : [anchorInput];
  anchors.sort((a, b) => a.timestamp - b.timestamp);

  const earliestAnchor = anchors[0];
  const effectiveFrom = Math.max(earliestAnchor.timestamp, fromTimestamp);

  const startBoundary = Math.floor(effectiveFrom / intervalMs) * intervalMs;
  const endBoundary = Math.floor(toTimestamp / intervalMs) * intervalMs;

  const candles = [];
  if (startBoundary > endBoundary) return candles;

  let anchorIdx = 0;
  while (anchorIdx < anchors.length - 1 && anchors[anchorIdx + 1].timestamp <= startBoundary) {
    anchorIdx++;
  }

  let runningPrice = calculateExactPrice(anchors[anchorIdx], startBoundary, ticker, baseVolatility);

  for (let t = startBoundary; t <= endBoundary; t += intervalMs) {
    const candleOpen = runningPrice;
    let candleHigh = candleOpen;
    let candleLow = candleOpen;

    for (let m = 0; m < intervalMinutes; m++) {
      const stepTime = t + m * ONE_MINUTE_MS;
      if (stepTime > toTimestamp) break;

      while (anchorIdx < anchors.length - 1 && stepTime >= anchors[anchorIdx + 1].timestamp) {
        anchorIdx++;
      }

      const activeAnchor = anchors[anchorIdx];
      const minutesSinceAnchor = Math.max(1, Math.floor((stepTime - activeAnchor.timestamp) / ONE_MINUTE_MS));
      const { deltaPct, prng } = getMinuteStep(ticker, stepTime, minutesSinceAnchor, activeAnchor, baseVolatility);

      runningPrice = Math.max(0.0001, runningPrice * (1 + deltaPct));

      const subVol = baseVolatility * 1.5;
      const wickHigh = runningPrice * (1 + Math.abs(sampleSeededNormal(prng) * subVol));
      const wickLow = runningPrice * (1 - Math.abs(sampleSeededNormal(prng) * subVol));

      if (wickHigh > candleHigh) candleHigh = wickHigh;
      if (wickLow < candleLow) candleLow = wickLow;
      if (runningPrice > candleHigh) candleHigh = runningPrice;
      if (runningPrice < candleLow) candleLow = runningPrice;
    }

    const candleClose = runningPrice;

    const candleSeed = hash32(`vol:${ticker}:${t}`);
    const volPrng = createMulberry32(candleSeed);
    const baseVolume = 10000 + volPrng() * 50000;
    const priceChangePct = Math.abs((candleClose - candleOpen) / candleOpen);
    const volume = Math.round(baseVolume * (1 + priceChangePct * 100));

    candles.push({
      time: Math.floor(t / 1000),
      open: Number(candleOpen.toFixed(4)),
      high: Number(candleHigh.toFixed(4)),
      low: Number(candleLow.toFixed(4)),
      close: Number(candleClose.toFixed(4)),
      volume
    });
  }

  return candles;
}
