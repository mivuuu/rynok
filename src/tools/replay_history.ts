import fs from 'fs';
import path from 'path';
import { COUNTRIES } from '../config/countries.js';
import { MarketAnchor, calculateExactPrice } from '../engine/math.js';
import { analyzeWithRegexFallback, AnalysisResult } from '../engine/analyzer.js';

interface RawRPMessage {
  id: string;
  dateStr: string;
  timestamp: number;
  boldText: string;
  fullText: string;
}

function parseTelegramDate(dateStr: string): number | null {
  // Format: "24.09.2026 19:43:43 UTC+02:00"
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [_, day, month, year, h, m, s] = match;
  // Parse in UTC taking UTC+2 into account
  return new Date(Date.UTC(+year, +month - 1, +day, +h - 2, +m, +s)).getTime();
}

function loadChatExport(chatDir: string): RawRPMessage[] {
  const files = ['messages.html', 'messages2.html', 'messages3.html'];
  const messages: RawRPMessage[] = [];

  for (const fileName of files) {
    const fullPath = path.join(chatDir, fileName);
    if (!fs.existsSync(fullPath)) continue;

    const html = fs.readFileSync(fullPath, 'utf-8');
    const msgRegex = /<div class="message default clearfix[^>]*id="(message\d+)"[\s\S]*?<div class="pull_right date details" title="([^"]+)"[\s\S]*?<div class="text">([\s\S]*?)<\/div>/g;

    let match;
    while ((match = msgRegex.exec(html)) !== null) {
      const id = match[1];
      const dateStr = match[2];
      const rawText = match[3];

      const boldMatch = rawText.match(/<strong[^>]*>([\s\S]*?)<\/strong>|<b[^>]*>([\s\S]*?)<\/b>/i);
      if (boldMatch) {
        const boldText = (boldMatch[1] || boldMatch[2] || '').replace(/<[^>]+>/g, '').trim();
        const fullText = rawText.replace(/<[^>]+>/g, '').trim();

        if (boldText.length >= 15) {
          const timestamp = parseTelegramDate(dateStr);
          if (timestamp) {
            messages.push({ id, dateStr, timestamp, boldText, fullText });
          }
        }
      }
    }
  }

  // Sort strictly chronologically
  messages.sort((a, b) => a.timestamp - b.timestamp);
  return messages;
}

async function runReplay() {
  console.log('🔄 Starting Historical Replay from Telegram Chat Export...\n');

  const chatDir = '/home/setare/Загрузки/Telegram Desktop/ChatExport_2026-10-21';
  const rawEvents = loadChatExport(chatDir);
  console.log(`📦 Loaded ${rawEvents.length} potential bold RP events from chat export.`);

  if (rawEvents.length === 0) {
    console.error('No events found!');
    return;
  }

  const genesisTimestamp = rawEvents[0].timestamp - 3600 * 1000; // 1 hour before first event

  // Initialize market state
  const currencies: Record<string, { current_anchor: MarketAnchor; history_anchors: MarketAnchor[] }> = {};
  for (const [ticker, config] of Object.entries(COUNTRIES)) {
    const genesisAnchor: MarketAnchor = {
      timestamp: genesisTimestamp,
      price: config.basePrice,
      drift: 0,
      volatility: config.sensitivity.baseVolatility,
      decay: 0.95,
      event_id: 'genesis',
      event_title: 'Старт сезона RP'
    };
    currencies[ticker] = {
      current_anchor: genesisAnchor,
      history_anchors: [genesisAnchor]
    };
  }

  const processedEvents: any[] = [];
  let eventsWithImpact = 0;

  for (const rawEvt of rawEvents) {
    const analysis: AnalysisResult = analyzeWithRegexFallback(`${rawEvt.boldText}\n\n${rawEvt.fullText}`);

    if (analysis.impacts.length === 0) {
      continue;
    }

    eventsWithImpact++;
    const eventId = `evt_${rawEvt.timestamp}_${rawEvt.id}`;

    // Apply to affected currencies
    for (const impact of analysis.impacts) {
      const ticker = impact.ticker;
      const country = COUNTRIES[ticker];
      if (!country || !currencies[ticker]) continue;

      const curr = currencies[ticker];
      // Advance price from current anchor timestamp to event timestamp
      const exactPriceAtEvent = calculateExactPrice(
        curr.current_anchor,
        rawEvt.timestamp,
        ticker,
        country.sensitivity.baseVolatility
      );

      const newAnchor: MarketAnchor = {
        timestamp: rawEvt.timestamp,
        price: exactPriceAtEvent,
        drift: impact.drift,
        volatility: impact.volatility,
        decay: impact.decay,
        event_id: eventId,
        event_title: analysis.event_title
      };

      curr.history_anchors.push(curr.current_anchor);
      curr.current_anchor = newAnchor;
    }

    processedEvents.unshift({
      id: eventId,
      timestamp: rawEvt.timestamp,
      title: analysis.event_title,
      raw_text: rawEvt.boldText,
      impacts: analysis.impacts,
      source: 'telegram_history'
    });
  }

  console.log(`✅ Processed ${eventsWithImpact} events with direct currency impacts.`);

  // Trim history anchors per currency to last 150
  for (const ticker of Object.keys(currencies)) {
    if (currencies[ticker].history_anchors.length > 150) {
      currencies[ticker].history_anchors = currencies[ticker].history_anchors.slice(-150);
    }
  }

  const finalMarketState = {
    version: 1,
    last_updated: rawEvents[rawEvents.length - 1].timestamp,
    genesis_timestamp: genesisTimestamp,
    currencies,
    events: processedEvents.slice(0, 150)
  };

  const outputPath = path.resolve(process.cwd(), 'market_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(finalMarketState, null, 2), 'utf-8');
  console.log(`💾 Saved synced market_data.json to ${outputPath}\n`);

  // Report final status of key countries
  console.log('📊 Current Synced Prices after Replay:');
  const now = Date.now();
  for (const ticker of ['ETH', 'VYN', 'NEL', 'VNG', 'OIL', 'VTN']) {
    const config = COUNTRIES[ticker];
    const record = currencies[ticker];
    const livePrice = calculateExactPrice(
      record.current_anchor,
      now,
      ticker,
      config.sensitivity.baseVolatility
    );
    const startPrice = config.basePrice;
    const delta = ((livePrice - startPrice) / startPrice) * 100;
    console.log(`  - [${ticker}] ${config.countryName} (${config.currencyName}): ${livePrice.toFixed(2)} (Старт: ${startPrice.toFixed(2)}, Дельта: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%) | Последний дрифт: ${record.current_anchor.drift}`);
  }
}

runReplay();
