declare const Buffer: any;
import { COUNTRIES, CountryConfig } from '../../src/config/countries.js';
import { MarketAnchor, calculateExactPrice } from '../../src/engine/math.js';
import { analyzeRPEvent, AnalysisResult, EventImpact } from '../../src/engine/analyzer.js';

export interface Env {
  GITHUB_TOKEN?: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH?: string;
  GROQ_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_SECRET_TOKEN?: string;
  ADMIN_USER_IDS?: string;
  MIN_BOLD_LENGTH?: string;
}

interface TelegramEntity {
  type: string;
  offset: number;
  length: number;
}

interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    title?: string;
    type: string;
  };
  date: number;
  text?: string;
  caption?: string;
  entities?: TelegramEntity[];
  caption_entities?: TelegramEntity[];
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_message?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

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
    impacts: EventImpact[];
    source?: string;
  }>;
}

/**
 * Extracts bold text snippets and whole content from a Telegram message
 */
function extractBoldContent(msg: TelegramMessage, minLength: number): { hasBold: boolean; boldText: string; fullText: string } {
  const fullText = (msg.text || msg.caption || '').trim();
  if (!fullText) return { hasBold: false, boldText: '', fullText: '' };

  const entities = msg.entities || msg.caption_entities || [];
  let boldFragments: string[] = [];

  for (const ent of entities) {
    if (ent.type === 'bold') {
      const fragment = fullText.substring(ent.offset, ent.offset + ent.length).trim();
      if (fragment.length >= minLength) {
        boldFragments.push(fragment);
      }
    }
  }

  // Also check markdown **bold** or <b>bold</b> if client sends raw markdown
  if (boldFragments.length === 0) {
    const mdRegex = /\*\*(.+?)\*\*|<b>(.+?)<\/b>/g;
    let match;
    while ((match = mdRegex.exec(fullText)) !== null) {
      const fragment = (match[1] || match[2] || '').trim();
      if (fragment.length >= minLength) {
        boldFragments.push(fragment);
      }
    }
  }

  const hasBold = boldFragments.length > 0;
  const boldText = boldFragments.join(' | ');

  return { hasBold, boldText, fullText };
}

/**
 * Parses and handles Admin Telegram commands (Tier 3 override)
 */
function parseAdminCommand(fullText: string, userId: number, adminIds: number[]): AnalysisResult | null {
  if (!adminIds.includes(userId)) return null;

  const trimmed = fullText.trim();
  if (!trimmed.startsWith('/')) return null;

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  // /impact <TICKER> <DRIFT> [TITLE...]
  // Example: /impact ETH +0.05 Экономическая реформа
  if (cmd === '/impact' && parts.length >= 3) {
    const ticker = parts[1].toUpperCase();
    const drift = parseFloat(parts[2]);
    const title = parts.slice(3).join(' ') || `Административная корректировка ${ticker}`;

    if (COUNTRIES[ticker] && !isNaN(drift)) {
      return {
        event_title: title,
        source: 'admin',
        impacts: [{
          ticker,
          drift: Math.max(-0.15, Math.min(0.15, drift)),
          volatility: 0.015,
          decay: 0.90,
          reason: 'Прямая директива администратора'
        }]
      };
    }
  }

  // /shock <TICKER> <VOLATILITY> [TITLE...]
  // Example: /shock VYN 0.035 Военное обострение
  if (cmd === '/shock' && parts.length >= 3) {
    const ticker = parts[1].toUpperCase();
    const vol = parseFloat(parts[2]);
    const title = parts.slice(3).join(' ') || `Шок волатильности ${ticker}`;

    if (COUNTRIES[ticker] && !isNaN(vol)) {
      return {
        event_title: title,
        source: 'admin',
        impacts: [{
          ticker,
          drift: 0.0,
          volatility: Math.max(0.005, Math.min(0.06, vol)),
          decay: 0.88,
          reason: 'Шок волатильности от администратора'
        }]
      };
    }
  }

  return null;
}

/**
 * Fetches current market_data.json from GitHub, applies new event anchors, and commits back.
 */
async function commitMarketUpdate(
  env: Env,
  analysis: AnalysisResult,
  rawText: string
): Promise<void> {
  if (!env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not configured in Worker secrets');
  }

  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || 'main';
  const filePath = 'market_data.json';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  // 1. Fetch current market_data.json
  const getRes = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'CloudflareWorker-Rynok-Engine',
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!getRes.ok) {
    const err = await getRes.text();
    throw new Error(`GitHub GET failed (${getRes.status}): ${err}`);
  }

  const fileInfo = (await getRes.json()) as { sha: string; content: string; encoding: string };
  const rawJson = Buffer.from(fileInfo.content, 'base64').toString('utf-8');
  const state: MarketDataState = JSON.parse(rawJson);

  const now = Date.now();
  const eventId = `evt_${now}_${Math.random().toString(36).substring(2, 7)}`;

  // 2. Advance and anchor affected currencies
  for (const impact of analysis.impacts) {
    const ticker = impact.ticker;
    const country = COUNTRIES[ticker];
    if (!country) continue;

    if (!state.currencies[ticker]) {
      state.currencies[ticker] = {
        current_anchor: {
          timestamp: state.genesis_timestamp || now,
          price: country.basePrice,
          drift: 0,
          volatility: country.sensitivity.baseVolatility,
          decay: 0.95
        },
        history_anchors: []
      };
    }

    const currRecord = state.currencies[ticker];
    // Calculate exact continuous price at this exact second
    const exactCurrentPrice = calculateExactPrice(
      currRecord.current_anchor,
      now,
      ticker,
      country.sensitivity.baseVolatility
    );

    const newAnchor: MarketAnchor = {
      timestamp: now,
      price: exactCurrentPrice,
      drift: impact.drift,
      volatility: impact.volatility,
      decay: impact.decay,
      event_id: eventId,
      event_title: analysis.event_title
    };

    currRecord.history_anchors.push(currRecord.current_anchor);
    // Keep max 100 historical anchors per currency to avoid unbound file size
    if (currRecord.history_anchors.length > 100) {
      currRecord.history_anchors = currRecord.history_anchors.slice(-100);
    }
    currRecord.current_anchor = newAnchor;
  }

  // 3. Append to global events list
  state.events.unshift({
    id: eventId,
    timestamp: now,
    title: analysis.event_title,
    raw_text: rawText,
    impacts: analysis.impacts,
    source: analysis.source
  });

  if (state.events.length > 150) {
    state.events = state.events.slice(0, 150);
  }

  state.last_updated = now;

  // 4. Commit updated state back to GitHub REST API
  const updatedJson = JSON.stringify(state, null, 2);
  const updatedBase64 = Buffer.from(updatedJson, 'utf-8').toString('base64');

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'CloudflareWorker-Rynok-Engine',
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `[Market Event] ${analysis.event_title}`,
      content: updatedBase64,
      sha: fileInfo.sha,
      branch
    })
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub PUT commit failed (${putRes.status}): ${err}`);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return new Response(JSON.stringify({
        status: 'online',
        service: 'Rynok Geopolitical RP Market Worker',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        activeCountries: Object.keys(COUNTRIES).length
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Telegram Webhook endpoint
    if (request.method === 'POST') {
      // Secret token verification if configured
      if (env.TELEGRAM_SECRET_TOKEN) {
        const headerSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (headerSecret !== env.TELEGRAM_SECRET_TOKEN) {
          return new Response('Unauthorized webhook token', { status: 403 });
        }
      }

      let update: TelegramUpdate;
      try {
        update = await request.json() as TelegramUpdate;
      } catch {
        return new Response('Invalid JSON payload', { status: 400 });
      }

      const msg = update.message || update.channel_post || update.edited_message || update.edited_channel_post;
      if (!msg) {
        return new Response(JSON.stringify({ ok: true, skipped: 'no_message' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const minBoldLen = parseInt(env.MIN_BOLD_LENGTH || '1', 10);
      let { hasBold, boldText, fullText } = extractBoldContent(msg, minBoldLen);

      console.log(`[Update ${update.update_id}] Chat: ${msg.chat?.id} (${msg.chat?.type}), Text: "${fullText.substring(0, 80)}"`);

      // If user sends in private chat with bot or mentions bot, trigger automatically
      const isPrivate = msg.chat?.type === 'private';
      const mentionsBot = /@rynokrpbot/i.test(fullText);
      if (isPrivate || mentionsBot) {
        hasBold = true;
        if (!boldText) boldText = fullText;
      }

      // Check admin commands
      const adminIds = (env.ADMIN_USER_IDS || '')
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id));

      const senderId = msg.from?.id || 0;
      const adminAnalysis = parseAdminCommand(fullText, senderId, adminIds);

      let targetAnalysis: AnalysisResult | null = null;
      let eventPayloadText = '';

      if (adminAnalysis) {
        targetAnalysis = adminAnalysis;
        eventPayloadText = fullText;
      } else if (hasBold) {
        // Trigger condition satisfied!
        eventPayloadText = boldText.length >= fullText.length ? boldText : `${boldText}\n\n${fullText}`;
        console.log(`[Triggered Event] Analyzing: "${eventPayloadText.substring(0, 80)}..."`);
        targetAnalysis = await analyzeRPEvent(eventPayloadText, env.GROQ_API_KEY);
      } else {
        // Silent ignore normal chatter
        console.log(`[Skipped] No bold text and not private/mention`);
        return new Response(JSON.stringify({ ok: true, skipped: 'no_trigger' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (targetAnalysis && targetAnalysis.impacts.length > 0) {
        try {
          await commitMarketUpdate(env, targetAnalysis, eventPayloadText);
          // Return silent HTTP 200 (stealth mode)
          return new Response(JSON.stringify({
            ok: true,
            status: 'committed',
            title: targetAnalysis.event_title,
            impacts: targetAnalysis.impacts
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          console.error('Error committing market update to GitHub:', err);
          return new Response(JSON.stringify({ ok: false, error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({ ok: true, skipped: 'no_impact' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
};
