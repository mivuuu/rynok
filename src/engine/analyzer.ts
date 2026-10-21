import { COUNTRIES, CountryConfig } from '../config/countries.js';

export interface EventImpact {
  ticker: string;
  drift: number;      // -0.10 to +0.10
  volatility: number; // 0.005 to 0.05
  decay: number;      // 0.80 to 0.95
  reason: string;
}

export interface AnalysisResult {
  event_title: string;
  source: 'groq' | 'regex' | 'admin';
  impacts: EventImpact[];
}

/**
 * Builds the comprehensive geopolitical & economic system prompt for Groq Llama 3.3.
 */
export function buildGroqSystemPrompt(): string {
  const countryBriefs = Object.values(COUNTRIES).map((c: CountryConfig) => {
    return `- ${c.countryName} (Валюта: ${c.currencyName}, Тикер: ${c.ticker}): ВВП ${c.stats.gdpText}, Ранг армии #${c.stats.ranks.military}, Профили: [${c.sectors.join(', ')}]. Чувствительность: x${c.sensitivity.inertia}.`;
  }).join('\n');

  return `Ты — ведущий финансовый аналитик и геополитический казначей в ролевой игре (RP).
Твоя задача — объективно оценить влияние новостей/событий из Telegram-чата на курсы национальных фиатных валют государств.

ВАЖНЕЙШИЕ ПРАВИЛА ЛОРА:
1. "Эфириум" (ETH) — это НЕ криптовалюта, а ОФИЦИАЛЬНАЯ НАЦИОНАЛЬНАЯ ФИАТНАЯ ВАЛЮТА Люменарии (Lumenaria). Любое событие в Люменарии влияет на ETH.
2. В мире существует ровно 23 государства:
${countryBriefs}

ПРАВИЛА ОЦЕНКИ И ДИНАМИКИ:
- Одно событие может влиять СРАЗУ НА НЕСКОЛЬКО стран (например: открытие беспошлинного транзита помогает и организатору, и торговым партнерам; война бьет по обеим сторонам или усиливает военную экономику агрессора).
- "drift": от -0.10 до +0.10 (величина шокового импульса). Для сверхдержав (Люменария, Аустра, Негеция) импульс обычно скромнее (±0.01..±0.035), для малых стран может достигать ±0.08..±0.10.
- "volatility": от 0.005 до 0.04 (рост колебаний рынка при неопределенности, войне, терактах, реформах).
- "decay": от 0.82 до 0.96 (коэффициент угасания шока в минуту. 0.85 — новость быстро отыграет, 0.95 — эффект держится дольше).
- "event_title": емкий заголовок события на русском языке (до 50 символов).

ФОРМАТ ОТВЕТА:
Верни ИСКЛЮЧИТЕЛЬНО валидный JSON без markdown-разметки (\`\`\`json) и без вступительного текста:
{
  "event_title": "Краткое название события",
  "impacts": [
    {
      "ticker": "ETH",
      "drift": 0.025,
      "volatility": 0.012,
      "decay": 0.90,
      "reason": "Краткая причина влияния на русском"
    }
  ]
}`;
}

/**
 * Regex stems for Russian semantic financial analysis
 */
const POSITIVE_STEMS = [
  /договор/i, /альянс/i, /инвестиц/i, /побед/i, /рост/i, /торгов/i, /соглашен/i, /союз/i,
  /открыва/i, /строительств/i, /развити/i, /профицит/i, /реформ/i, /успешн/i, /исследован/i,
  /новы[ех]/i, /модернизац/i, /беспошлин/i, /транзит/i, /выделен/i, /бюджет/i
];

const NEGATIVE_STEMS = [
  /войн/i, /атак/i, /санкц/i, /кризис/i, /взрыв/i, /мобилизац/i, /обвиня/i, /конфликт/i,
  /блокад/i, /эмбарго/i, /паден/i, /дефицит/i, /угроз/i, /теракт/i, /подрыв/i, /ущерб/i,
  /убыт/i, /разрыв/i, /диверси/i, /бунт/i, /госпереворот/i, /протест/i, /рушит/i, /разрушен/i,
  /погиб/i, /удар/i, /беспорядк/i, /поражен/i, /эвакуац/i, /смерт/i, /оборон/i, /подавлен/i,
  /точечн/i, /бпла/i, /ракети/i, /разбомб/i
];

/**
 * Tier 2: Deterministic Keyword & Regex Fallback Analyzer
 */
export function analyzeWithRegexFallback(text: string): AnalysisResult {
  const detectedTickers = new Set<string>();

  const lowerText = text.toLowerCase();

  // Check aliases for each country with Unicode boundary check
  for (const [ticker, config] of Object.entries(COUNTRIES)) {
    for (const alias of config.aliases) {
      const lowerAlias = alias.toLowerCase();
      const escaped = lowerAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^а-яёa-z0-9])${escaped}`, 'iu');
      if (regex.test(lowerText)) {
        detectedTickers.add(ticker);
        break;
      }
    }
  }

  // If no countries explicitly detected, default to neutral
  if (detectedTickers.size === 0) {
    return {
      event_title: text.replace(/[*_#`]/g, '').trim().substring(0, 45),
      source: 'regex',
      impacts: []
    };
  }

  let posScore = 0;
  for (const stem of POSITIVE_STEMS) {
    if (stem.test(text)) posScore++;
  }

  let negScore = 0;
  for (const stem of NEGATIVE_STEMS) {
    if (stem.test(text)) negScore++;
  }

  // Check for severe catastrophe triggers (civil war, collapsing fronts, embassy bombings, massive riots)
  const isSevereCatastrophe = /рушит.*фронт|подавлен.*протест|взрыв.*посольств|точечн.*удар|разрушен.*здан|массовые.*беспорядк|госпереворот|тяжел.*войн/i.test(text);
  const isMinorDiplomacy = /обвиня|бойкот|заявил|сборная|хокке|спорт|мнение/i.test(text);

  const netSentiment = posScore - negScore;
  const impacts: EventImpact[] = [];

  for (const ticker of detectedTickers) {
    const config = COUNTRIES[ticker];
    const inertia = config.sensitivity.inertia;

    let baseDrift = 0;
    let volatility = 0.008;
    let decay = 0.90;

    if (isSevereCatastrophe && netSentiment < 0) {
      // Severe geopolitical crisis (e.g. collapsing front in Austra)
      baseDrift = -0.065 / inertia;
      volatility = 0.035;
      decay = 0.94;
    } else if (isMinorDiplomacy) {
      // Small diplomatic friction
      baseDrift = (netSentiment >= 0 ? 0.004 : -0.004) / inertia;
      volatility = 0.006;
      decay = 0.85;
    } else if (netSentiment > 0) {
      // Normal positive development
      baseDrift = Math.min(0.025, 0.006 * netSentiment) / inertia;
      volatility = 0.007 + 0.002 * netSentiment;
      decay = 0.88;
    } else if (netSentiment < 0) {
      // Moderate negative event
      baseDrift = Math.max(-0.035, 0.007 * netSentiment) / inertia;
      volatility = 0.012 + 0.003 * Math.abs(netSentiment);
      decay = 0.91;
    } else {
      // Neutral
      baseDrift = 0.0005;
      volatility = 0.005;
    }

    impacts.push({
      ticker,
      drift: Number(baseDrift.toFixed(4)),
      volatility: Number(Math.min(0.045, volatility).toFixed(4)),
      decay: Number(decay.toFixed(2)),
      reason: netSentiment >= 0 ? 'Позитивные геополитические или экономические факторы' : 'Военные удары, разрушения, протесты или конфликтный фон'
    });
  }

  // Generate short title from text
  const cleanTitle = text.replace(/[*_#`]/g, '').trim();
  const event_title = cleanTitle.length > 50 ? cleanTitle.substring(0, 47) + '...' : cleanTitle;

  return {
    event_title: event_title || 'Событие в Telegram-канале',
    source: 'regex',
    impacts
  };
}

/**
 * Tier 1: GroqCloud API Analyst with Llama 3.3 70B
 */
export async function analyzeWithGroq(
  text: string,
  groqApiKey: string
): Promise<AnalysisResult> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: buildGroqSystemPrompt() },
        { role: 'user', content: `Оцени RP-событие:\n"${text}"` }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API returned ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned empty response');
  }

  const parsed = JSON.parse(content);
  if (!parsed.impacts || !Array.isArray(parsed.impacts)) {
    throw new Error('Invalid JSON structure from Groq');
  }

  // Validate tickers
  const validatedImpacts: EventImpact[] = [];
  for (const imp of parsed.impacts) {
    const upperTicker = (imp.ticker || '').toUpperCase();
    if (COUNTRIES[upperTicker]) {
      const config = COUNTRIES[upperTicker];
      // Apply inertia bounds
      const rawDrift = typeof imp.drift === 'number' ? imp.drift : 0;
      const boundedDrift = Math.max(-0.12, Math.min(0.12, rawDrift / config.sensitivity.inertia));

      validatedImpacts.push({
        ticker: upperTicker,
        drift: Number(boundedDrift.toFixed(4)),
        volatility: Number(Math.max(0.005, Math.min(0.05, imp.volatility || 0.01)).toFixed(4)),
        decay: Number(Math.max(0.75, Math.min(0.98, imp.decay || 0.90)).toFixed(2)),
        reason: imp.reason || 'Влияние RP-события'
      });
    }
  }

  if (validatedImpacts.length === 0) {
    throw new Error('No valid currency tickers identified in Groq response');
  }

  return {
    event_title: parsed.event_title || 'Геополитическое событие',
    source: 'groq',
    impacts: validatedImpacts
  };
}

/**
 * Master Pipeline: Tier 1 (Groq) -> Tier 2 (Regex fallback)
 */
export async function analyzeRPEvent(
  text: string,
  groqApiKey?: string
): Promise<AnalysisResult> {
  if (groqApiKey && groqApiKey.trim().length > 0) {
    try {
      return await analyzeWithGroq(text, groqApiKey);
    } catch (err) {
      console.warn('⚠️ Groq Tier 1 failed or rate-limited. Falling back to Tier 2 (Regex):', err);
    }
  }

  return analyzeWithRegexFallback(text);
}
