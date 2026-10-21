import fs from 'fs';
import path from 'path';
import { COUNTRIES } from '../config/countries.js';
import { MarketAnchor } from '../engine/math.js';

interface MarketDataState {
  version: number;
  last_updated: number;
  genesis_timestamp: number;
  currencies: Record<string, {
    current_anchor: MarketAnchor;
    history_anchors: MarketAnchor[];
  }>;
  events: Array<{
    id: string;
    timestamp: number;
    title: string;
    raw_text: string;
    impacts: Array<{
      ticker: string;
      drift: number;
      volatility: number;
      decay: number;
      reason?: string;
    }>;
  }>;
}

const genesisTimestamp = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago so the chart starts with history

const currencies: MarketDataState['currencies'] = {};

for (const [ticker, config] of Object.entries(COUNTRIES)) {
  const initialAnchor: MarketAnchor = {
    timestamp: genesisTimestamp,
    price: config.basePrice,
    drift: 0.0,
    volatility: config.sensitivity.baseVolatility,
    decay: 0.95,
    event_id: 'genesis',
    event_title: 'Официальный запуск котировок биржи'
  };

  currencies[ticker] = {
    current_anchor: initialAnchor,
    history_anchors: [initialAnchor]
  };
}

const state: MarketDataState = {
  version: 1,
  last_updated: genesisTimestamp,
  genesis_timestamp: genesisTimestamp,
  currencies,
  events: [
    {
      id: 'genesis',
      timestamp: genesisTimestamp,
      title: 'Официальный запуск единой биржи государств',
      raw_text: 'Комитет центральных банков зафиксировал официальные стартовые котировки 23 национальных валют.',
      impacts: []
    }
  ]
};

const outputPath = path.resolve(process.cwd(), 'market_data.json');
fs.writeFileSync(outputPath, JSON.stringify(state, null, 2), 'utf-8');
console.log(`✅ Generated genesis market_data.json at ${outputPath}`);
