import { COUNTRIES, SECTOR_LABELS } from './countries_data.js';
import { calculateExactPrice, generateCandles } from './engine.js';

class RynokTerminal {
  constructor() {
    this.marketState = null;
    this.activeTicker = 'ETH';
    this.activeTimeframe = 1; // 1m default
    this.sectorFilter = 'all';
    this.searchQuery = '';
    
    this.chart = null;
    this.candleSeries = null;
    this.volumeSeries = null;
    
    this.lastPrices = {};
    this.cachedCandles = [];
  }

  async init() {
    this.initClock();
    this.initEventListeners();
    await this.loadMarketData();
    this.renderWatchlist();
    this.initChart();
    this.switchCurrency(this.activeTicker);
    this.renderEventFeed();

    // Start 1-second live sync loop
    setInterval(() => this.tick(), 1000);

    // Periodically poll market_data.json for fresh Telegram updates
    setInterval(() => this.pollForUpdates(), 25000);
  }

  initClock() {
    const clockEl = document.getElementById('serverClock');
    const updateTime = () => {
      const now = new Date();
      if (clockEl) {
        clockEl.textContent = now.toISOString().replace('T', ' ').substring(11, 19) + ' UTC';
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  async loadMarketData() {
    try {
      const res = await fetch(`market_data.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.marketState = await res.json();
      
      const syncEl = document.getElementById('syncStatus');
      if (syncEl) {
        syncEl.textContent = 'СИНХРОНИЗИРОВАНО';
        syncEl.style.color = 'var(--color-cyan)';
      }
    } catch (err) {
      console.warn('Could not fetch market_data.json, creating fallback memory state:', err);
      this.createFallbackState();
    }
  }

  createFallbackState() {
    const genesis = Date.now() - 24 * 60 * 60 * 1000;
    const currencies = {};
    for (const [ticker, config] of Object.entries(COUNTRIES)) {
      currencies[ticker] = {
        current_anchor: {
          timestamp: genesis,
          price: config.basePrice,
          drift: 0,
          volatility: config.sensitivity.baseVolatility,
          decay: 0.95
        },
        history_anchors: []
      };
    }
    this.marketState = {
      version: 1,
      last_updated: genesis,
      genesis_timestamp: genesis,
      currencies,
      events: []
    };
  }

  async pollForUpdates() {
    try {
      const res = await fetch(`market_data.json?t=${Date.now()}`);
      if (!res.ok) return;
      const freshData = await res.json();

      if (freshData.last_updated !== this.marketState?.last_updated) {
        console.log('⚡ New market event detected! Synchronizing state...');
        this.marketState = freshData;
        this.renderEventFeed();
        this.renderChartData();
      }
    } catch (e) {
      // Quietly ignore network blips
    }
  }

  initChart() {
    const container = document.getElementById('chartContainer');
    if (!container) return;

    // Check if LightweightCharts is available from CDN
    if (typeof LightweightCharts === 'undefined') {
      container.innerHTML = '<div style="padding: 40px; color: var(--text-muted); text-align: center;">Загрузка движка графиков...</div>';
      return;
    }

    this.chart = LightweightCharts.createChart(container, {
      layout: {
        background: { color: '#090b10' },
        textColor: '#828c9b',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Candlestick Series
    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#00f59b',
      downColor: '#ff3b69',
      borderVisible: false,
      wickUpColor: '#00f59b',
      wickDownColor: '#ff3b69',
    });

    // Volume Series
    this.volumeSeries = this.chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    // Handle auto-resize
    const resizeObserver = new ResizeObserver(() => {
      if (this.chart && container) {
        this.chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    });
    resizeObserver.observe(container);
  }

  switchCurrency(ticker) {
    if (!COUNTRIES[ticker]) return;
    this.activeTicker = ticker;
    const country = COUNTRIES[ticker];

    // Update active highlight in watchlist
    document.querySelectorAll('.currency-row').forEach(row => {
      row.classList.toggle('active', row.dataset.ticker === ticker);
    });

    // Update header info
    document.getElementById('activeTickerBadge').textContent = ticker;
    document.getElementById('activeCurrencyTitle').textContent = `${country.currencyName} / ${country.countryName}`;

    // Update sector tags
    const sectorsEl = document.getElementById('activeSectorTags');
    if (sectorsEl) {
      sectorsEl.innerHTML = country.sectors.map(sec => {
        const info = SECTOR_LABELS[sec] || { label: sec, icon: '🏷️' };
        return `<span class="sector-tag">${info.icon} ${info.label}</span>`;
      }).join('');
    }

    // Update inertia in toolbar
    document.getElementById('statInertia').textContent = `x${country.sensitivity.inertia}`;

    // Render chart data for selected currency
    this.renderChartData();
  }

  renderChartData() {
    if (!this.candleSeries || !this.marketState) return;

    const currRecord = this.marketState.currencies[this.activeTicker];
    const country = COUNTRIES[this.activeTicker];
    if (!currRecord || !country) return;

    const now = Date.now();
    const allAnchors = [...(currRecord.history_anchors || []), currRecord.current_anchor];

    // Adaptive history duration based on selected timeframe
    let historyDuration = 24 * 60 * 60 * 1000;
    if (this.activeTimeframe === 1) historyDuration = 8 * 60 * 60 * 1000;       // 8h for 1m
    else if (this.activeTimeframe === 5) historyDuration = 24 * 60 * 60 * 1000;  // 24h for 5m
    else if (this.activeTimeframe === 15) historyDuration = 4 * 24 * 60 * 60 * 1000; // 4d for 15m
    else if (this.activeTimeframe === 60) historyDuration = 30 * 24 * 60 * 60 * 1000; // 30d for 1h

    const fromTime = Math.max(this.marketState.genesis_timestamp, now - historyDuration);

    const candles = generateCandles(
      allAnchors,
      fromTime,
      now,
      this.activeTimeframe,
      this.activeTicker,
      country.sensitivity.baseVolatility
    );

    this.cachedCandles = candles;

    this.candleSeries.setData(candles);

    const volumeData = candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(0, 245, 155, 0.25)' : 'rgba(255, 59, 105, 0.25)'
    }));
    this.volumeSeries.setData(volumeData);

    // Calculate 24h stats
    if (candles.length > 0) {
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const vols = candles.map(c => c.volume);

      document.getElementById('statHigh').textContent = Math.max(...highs).toFixed(2);
      document.getElementById('statLow').textContent = Math.min(...lows).toFixed(2);
      document.getElementById('statVol').textContent = Math.round(vols.reduce((a, b) => a + b, 0)).toLocaleString();
    }

    // Set markers for RP events affecting this ticker
    const markers = [];
    if (this.marketState.events) {
      for (const evt of this.marketState.events) {
        const hasImpact = evt.impacts?.some(i => i.ticker === this.activeTicker);
        if (hasImpact) {
          const impact = evt.impacts.find(i => i.ticker === this.activeTicker);
          const isBull = (impact?.drift || 0) >= 0;
          markers.push({
            time: Math.floor(evt.timestamp / 1000),
            position: isBull ? 'belowBar' : 'aboveBar',
            color: isBull ? '#00f59b' : '#ff3b69',
            shape: isBull ? 'arrowUp' : 'arrowDown',
            text: `${this.activeTicker}: ${isBull ? '+' : ''}${((impact?.drift || 0) * 100).toFixed(1)}%`
          });
        }
      }
    }

    if (markers.length > 0) {
      this.candleSeries.setMarkers(markers.sort((a, b) => a.time - b.time));
    }

    this.chart.timeScale().fitContent();
  }

  tick() {
    if (!this.marketState) return;
    const now = Date.now();

    // 1. Calculate live prices for ALL 23 currencies
    for (const [ticker, country] of Object.entries(COUNTRIES)) {
      const record = this.marketState.currencies[ticker];
      if (!record) continue;

      const livePrice = calculateExactPrice(
        record.current_anchor,
        now,
        ticker,
        country.sensitivity.baseVolatility
      );

      const genesisPrice = country.basePrice;
      const deltaPct = ((livePrice - genesisPrice) / genesisPrice) * 100;

      // Update row in watchlist
      const rowPriceEl = document.getElementById(`price-${ticker}`);
      const rowDeltaEl = document.getElementById(`delta-${ticker}`);

      if (rowPriceEl) {
        rowPriceEl.textContent = livePrice.toFixed(4);
      }
      if (rowDeltaEl) {
        const sign = deltaPct >= 0 ? '+' : '';
        rowDeltaEl.textContent = `${sign}${deltaPct.toFixed(2)}%`;
        rowDeltaEl.className = `row-delta ${deltaPct >= 0 ? 'delta-pos' : 'delta-neg'}`;
      }

      // If active ticker, update hero display
      if (ticker === this.activeTicker) {
        const heroPriceEl = document.getElementById('activeLivePrice');
        const heroDeltaEl = document.getElementById('activePriceDelta');

        if (heroPriceEl) {
          const prev = this.lastPrices[ticker] || livePrice;
          heroPriceEl.textContent = livePrice.toFixed(4);

          if (livePrice > prev) {
            heroPriceEl.style.color = 'var(--color-green)';
            setTimeout(() => { if (heroPriceEl) heroPriceEl.style.color = ''; }, 400);
          } else if (livePrice < prev) {
            heroPriceEl.style.color = 'var(--color-red)';
            setTimeout(() => { if (heroPriceEl) heroPriceEl.style.color = ''; }, 400);
          }
        }

        if (heroDeltaEl) {
          const sign = deltaPct >= 0 ? '+' : '';
          heroDeltaEl.textContent = `${sign}${deltaPct.toFixed(2)}%`;
          heroDeltaEl.className = `price-delta ${deltaPct >= 0 ? 'text-green' : 'text-red'}`;
        }

        // Incrementally update current active candle
        if (this.candleSeries && this.cachedCandles.length > 0) {
          const lastCandle = { ...this.cachedCandles[this.cachedCandles.length - 1] };
          const intervalSec = this.activeTimeframe * 60;
          const currentCandleTime = Math.floor(now / (intervalSec * 1000)) * intervalSec;

          if (lastCandle.time === currentCandleTime) {
            lastCandle.close = livePrice;
            if (livePrice > lastCandle.high) lastCandle.high = livePrice;
            if (livePrice < lastCandle.low) lastCandle.low = livePrice;
            this.candleSeries.update(lastCandle);
          } else if (currentCandleTime > lastCandle.time) {
            // New candle boundary reached
            const newCandle = {
              time: currentCandleTime,
              open: livePrice,
              high: livePrice,
              low: livePrice,
              close: livePrice,
              volume: 15000
            };
            this.cachedCandles.push(newCandle);
            this.candleSeries.update(newCandle);
          }
        }
      }

      this.lastPrices[ticker] = livePrice;
    }
  }

  renderWatchlist() {
    const listEl = document.getElementById('currencyList');
    if (!listEl) return;

    // Sort by GDP Rank (1 to 23)
    const sorted = Object.values(COUNTRIES).sort((a, b) => a.stats.ranks.gdp - b.stats.ranks.gdp);

    listEl.innerHTML = sorted.map(country => {
      const isVisible = this.filterMatches(country);
      const sectorIcons = country.sectors.map(s => SECTOR_LABELS[s]?.icon || '').join(' ');

      return `
        <div class="currency-row ${country.ticker === this.activeTicker ? 'active' : ''}" 
             data-ticker="${country.ticker}" 
             id="row-${country.ticker}"
             style="display: ${isVisible ? 'flex' : 'none'}">
          <div class="row-left">
            <span class="row-rank">#${country.stats.ranks.gdp}</span>
            <div class="row-names">
              <div class="row-ticker-line">
                <span class="row-ticker">${country.ticker}</span>
                <span class="row-sectors">${sectorIcons}</span>
              </div>
              <span class="row-country">${country.countryName}</span>
            </div>
          </div>
          <div class="row-right">
            <span class="row-price" id="price-${country.ticker}">${country.basePrice.toFixed(4)}</span>
            <span class="row-delta delta-pos" id="delta-${country.ticker}">+0.00%</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to rows
    listEl.querySelectorAll('.currency-row').forEach(row => {
      row.addEventListener('click', () => {
        const ticker = row.dataset.ticker;
        if (ticker) this.switchCurrency(ticker);
      });
    });
  }

  filterMatches(country) {
    if (this.sectorFilter !== 'all' && !country.sectors.includes(this.sectorFilter)) {
      return false;
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      const inTicker = country.ticker.toLowerCase().includes(q);
      const inName = country.countryName.toLowerCase().includes(q);
      const inCurr = country.currencyName.toLowerCase().includes(q);
      if (!inTicker && !inName && !inCurr) return false;
    }
    return true;
  }

  updateWatchlistVisibility() {
    for (const [ticker, country] of Object.entries(COUNTRIES)) {
      const row = document.getElementById(`row-${ticker}`);
      if (row) {
        row.style.display = this.filterMatches(country) ? 'flex' : 'none';
      }
    }
  }

  renderEventFeed() {
    const feedEl = document.getElementById('eventsFeed');
    const badgeEl = document.getElementById('eventCountBadge');
    if (!feedEl || !this.marketState?.events) return;

    const events = this.marketState.events;
    if (badgeEl) badgeEl.textContent = `${events.length} событий`;

    // Active shocks count
    const activeCountEl = document.getElementById('activeShocksCount');
    if (activeCountEl) {
      const now = Date.now();
      const activeShocks = events.filter(e => (now - e.timestamp) < 30 * 60 * 1000).length;
      activeCountEl.textContent = activeShocks;
    }

    feedEl.innerHTML = events.map(evt => {
      const d = new Date(evt.timestamp);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const sourceIcon = evt.source === 'groq' ? '🧠 Groq Llama' : (evt.source === 'admin' ? '🛡️ Admin' : '⚙️ Regex');

      const impactsHtml = (evt.impacts || []).map(imp => {
        const isBull = imp.drift >= 0;
        const colorClass = isBull ? 'delta-pos' : 'delta-neg';
        const sign = isBull ? '+' : '';
        return `
          <span class="impact-pill ${colorClass}">
            ${imp.ticker} ${sign}${(imp.drift * 100).toFixed(1)}%
          </span>
        `;
      }).join('');

      return `
        <div class="event-card" data-event-id="${evt.id}">
          <div class="event-card-header">
            <span>⏱️ ${timeStr}</span>
            <span class="source-badge">${sourceIcon}</span>
          </div>
          <div class="event-title">${evt.title}</div>
          <div class="event-impacts">${impactsHtml}</div>
          <div class="event-raw">${evt.raw_text}</div>
        </div>
      `;
    }).join('');
  }

  openDossier(ticker) {
    const country = COUNTRIES[ticker];
    if (!country) return;

    const modal = document.getElementById('dossierModal');
    const titleEl = document.getElementById('modalCountryTitle');
    const bodyEl = document.getElementById('modalDossierBody');

    titleEl.textContent = `🏛️ ${country.countryName} (${country.currencyName} [${country.ticker}])`;

    const sectorsHtml = country.sectors.map(s => {
      const info = SECTOR_LABELS[s] || { label: s, icon: '🏷️' };
      return `<span class="sector-tag" style="font-size: 13px;">${info.icon} ${info.label}</span>`;
    }).join(' ');

    bodyEl.innerHTML = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${sectorsHtml}
      </div>

      <div class="dossier-grid">
        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Номинальный ВВП</div>
          <div class="dossier-stat-value">${country.stats.gdpText} <span class="dossier-rank-pill">Ранг #${country.stats.ranks.gdp}</span></div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">ВВП на душу населения</div>
          <div class="dossier-stat-value">$${country.stats.gdpPerCapitaUSD.toLocaleString()} <span class="dossier-rank-pill">Ранг #${country.stats.ranks.gdpPerCapita}</span></div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Население</div>
          <div class="dossier-stat-value">${country.stats.populationText} <span class="dossier-rank-pill">Ранг #${country.stats.ranks.population}</span></div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Мощь армии</div>
          <div class="dossier-stat-value">Ранг #${country.stats.ranks.military}</div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Безопасность граждан</div>
          <div class="dossier-stat-value">Ранг #${country.stats.ranks.security}</div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Уровень образования</div>
          <div class="dossier-stat-value">Ранг #${country.stats.ranks.education}</div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Медицина и здравоохранение</div>
          <div class="dossier-stat-value">Ранг #${country.stats.ranks.medicine}</div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Средний IQ</div>
          <div class="dossier-stat-value">Ранг #${country.stats.ranks.iq}</div>
        </div>
      </div>

      <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6; background: var(--bg-core); padding: 12px; border-radius: 6px;">
        💡 <strong>Финансовый профиль:</strong> Базовая цена валюты зафиксирована на уровне <strong>${country.basePrice.toFixed(2)}</strong>. Сопротивление шокам рынка (инерция): <strong>x${country.sensitivity.inertia}</strong>.
      </div>
    `;

    modal.classList.add('open');
  }

  initEventListeners() {
    // Sector filter pills
    document.querySelectorAll('.filter-pills .pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-pills .pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.sectorFilter = btn.dataset.sector || 'all';
        this.updateWatchlistVisibility();
      });
    });

    // Search input
    const searchInput = document.getElementById('currencySearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.updateWatchlistVisibility();
      });
    }

    // Timeframe selector
    document.querySelectorAll('.timeframe-buttons .tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.timeframe-buttons .tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTimeframe = parseInt(btn.dataset.tf || '1', 10);
        this.renderChartData();
      });
    });

    // Dossier modal open / close
    document.getElementById('btnOpenDossier')?.addEventListener('click', () => {
      this.openDossier(this.activeTicker);
    });

    document.getElementById('btnCloseDossier')?.addEventListener('click', () => {
      document.getElementById('dossierModal')?.classList.remove('open');
    });

    document.getElementById('dossierModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'dossierModal') {
        document.getElementById('dossierModal')?.classList.remove('open');
      }
    });
  }
}

// Bootstrap application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  const terminal = new RynokTerminal();
  terminal.init();
});
