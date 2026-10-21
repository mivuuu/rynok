import { COUNTRIES, SECTOR_LABELS } from './countries_data.js';
import { calculateExactPrice, generateCandles } from './engine.js';

class RynokTerminal {
  constructor() {
    this.marketState = null;
    this.activeTicker = 'ETH';
    this.activeTimeframe = 1; // 1m default
    this.sectorFilter = 'all';
    this.searchQuery = '';
    this.activeMobileView = 'markets';
    
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
    const syncEl = document.getElementById('syncStatus');
    const dotEl = document.getElementById('statusDot');

    try {
      const res = await fetch(`market_data.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.marketState = await res.json();
      
      if (syncEl) syncEl.textContent = 'Синхронизировано';
      if (dotEl) {
        dotEl.classList.remove('syncing');
        dotEl.style.backgroundColor = 'var(--color-positive)';
      }
    } catch (err) {
      console.warn('Could not fetch market_data.json, creating fallback memory state:', err);
      this.createFallbackState();
      if (syncEl) syncEl.textContent = 'Автономный режим';
      if (dotEl) {
        dotEl.style.backgroundColor = 'var(--accent-primary)';
      }
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

    if (typeof LightweightCharts === 'undefined') {
      container.innerHTML = '<div style="padding: 40px; color: var(--text-muted); text-align: center;">Загрузка движка графиков...</div>';
      return;
    }

    // Refined Soft Dark Minimalist options
    this.chart = LightweightCharts.createChart(container, {
      layout: {
        background: { color: '#1C1F1D' },
        textColor: '#929991',
        fontSize: 11,
        fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(48, 52, 48, 0.45)' },
        horzLines: { color: 'rgba(48, 52, 48, 0.45)' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(181, 203, 180, 0.4)',
          width: 1,
          style: LightweightCharts.LineStyle.Dashed,
        },
        horzLine: {
          color: 'rgba(181, 203, 180, 0.4)',
          width: 1,
          style: LightweightCharts.LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: '#303430',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#303430',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Candlestick Series in Soft Dark palette
    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#A4C5A4',
      downColor: '#D5A09A',
      borderVisible: false,
      wickUpColor: '#A4C5A4',
      wickDownColor: '#D5A09A',
    });

    // Volume Series
    this.volumeSeries = this.chart.addHistogramSeries({
      color: 'rgba(181, 203, 180, 0.25)',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    // Auto-resize
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

    // Update mobile active ticker badge
    const mobileTickerBadge = document.getElementById('mobileActiveTicker');
    if (mobileTickerBadge) mobileTickerBadge.textContent = ticker;

    // Update header info
    const badgeEl = document.getElementById('activeTickerBadge');
    if (badgeEl) badgeEl.textContent = ticker;

    const titleEl = document.getElementById('activeCurrencyTitle');
    if (titleEl) titleEl.textContent = `${country.currencyName} / ${country.countryName}`;

    // Update sector tags
    const sectorsEl = document.getElementById('activeSectorTags');
    if (sectorsEl) {
      sectorsEl.innerHTML = country.sectors.map(sec => {
        const info = SECTOR_LABELS[sec] || { label: sec };
        return `<span class="sector-tag">${info.label}</span>`;
      }).join('');
    }

    // Update inertia in toolbar
    const inertiaEl = document.getElementById('statInertia');
    if (inertiaEl) inertiaEl.textContent = `x${country.sensitivity.inertia}`;

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
    if (this.activeTimeframe === 1) historyDuration = 8 * 60 * 60 * 1000;          // 8h for 1m
    else if (this.activeTimeframe === 5) historyDuration = 24 * 60 * 60 * 1000;     // 24h for 5m
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
      color: c.close >= c.open ? 'rgba(164, 197, 164, 0.25)' : 'rgba(213, 160, 154, 0.25)'
    }));
    this.volumeSeries.setData(volumeData);

    // Calculate 24h stats
    if (candles.length > 0) {
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const vols = candles.map(c => c.volume);

      const highEl = document.getElementById('statHigh');
      const lowEl = document.getElementById('statLow');
      const volEl = document.getElementById('statVol');

      if (highEl) highEl.textContent = Math.max(...highs).toFixed(2);
      if (lowEl) lowEl.textContent = Math.min(...lows).toFixed(2);
      if (volEl) volEl.textContent = Math.round(vols.reduce((a, b) => a + b, 0)).toLocaleString();
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
            color: isBull ? '#A4C5A4' : '#D5A09A',
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

    let maxGainTicker = null;
    let maxGainPct = -Infinity;

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

      if (deltaPct > maxGainPct) {
        maxGainPct = deltaPct;
        maxGainTicker = ticker;
      }

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
          heroPriceEl.textContent = livePrice.toFixed(4);
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

    // Update Market Overview Leader
    const leaderEl = document.getElementById('marketLeader');
    if (leaderEl && maxGainTicker) {
      const sign = maxGainPct >= 0 ? '+' : '';
      leaderEl.textContent = `${maxGainTicker} ${sign}${maxGainPct.toFixed(2)}%`;
      leaderEl.style.color = maxGainPct >= 0 ? 'var(--color-positive)' : 'var(--color-negative)';
    }
  }

  renderWatchlist() {
    const listEl = document.getElementById('currencyList');
    if (!listEl) return;

    // Sort by GDP Rank (1 to 23)
    const sorted = Object.values(COUNTRIES).sort((a, b) => a.stats.ranks.gdp - b.stats.ranks.gdp);

    listEl.innerHTML = sorted.map(country => {
      const isVisible = this.filterMatches(country);
      const primarySector = country.sectors[0] ? (SECTOR_LABELS[country.sectors[0]]?.label || country.sectors[0]) : '';

      return `
        <div class="currency-row ${country.ticker === this.activeTicker ? 'active' : ''}" 
             data-ticker="${country.ticker}" 
             id="row-${country.ticker}"
             role="listitem"
             style="display: ${isVisible ? 'flex' : 'none'}">
          <div class="row-left">
            <span class="row-rank">#${country.stats.ranks.gdp}</span>
            <div class="row-names">
              <div class="row-ticker-line">
                <span class="row-ticker">${country.ticker}</span>
                <span class="row-sectors-inline">${primarySector}</span>
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
        if (ticker) {
          this.switchCurrency(ticker);
          // On mobile screens, automatically navigate to the chart view
          if (window.innerWidth <= 768) {
            this.switchMobileView('chart');
          }
        }
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
    const mobileBadgeEl = document.getElementById('mobileEventsCount');
    if (!feedEl || !this.marketState?.events) return;

    const events = this.marketState.events;
    if (badgeEl) badgeEl.textContent = `${events.length} событий`;
    if (mobileBadgeEl) mobileBadgeEl.textContent = events.length;

    // Active shocks count (within last 30 minutes)
    const activeCountEl = document.getElementById('activeShocksCount');
    if (activeCountEl) {
      const now = Date.now();
      const activeShocks = events.filter(e => (now - e.timestamp) < 30 * 60 * 1000).length;
      activeCountEl.textContent = activeShocks;
    }

    feedEl.innerHTML = events.map(evt => {
      const d = new Date(evt.timestamp);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' UTC';
      const sourceLabel = evt.source === 'groq' ? 'Groq AI' : (evt.source === 'admin' ? 'Штаб RP' : 'Автоматика');

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
            <span>${timeStr}</span>
            <span class="source-badge">${sourceLabel}</span>
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

    titleEl.textContent = `${country.countryName} (${country.currencyName} [${country.ticker}])`;

    const sectorsHtml = country.sectors.map(s => {
      const info = SECTOR_LABELS[s] || { label: s };
      return `<span class="sector-tag" style="font-size: 11px;">${info.label}</span>`;
    }).join(' ');

    const stats = country.stats;

    bodyEl.innerHTML = `
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
        ${sectorsHtml}
      </div>

      <div class="dossier-grid">
        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Номинальный ВВП</div>
          <div class="dossier-stat-value">
            <span>${stats.gdpText}</span>
            <span class="dossier-rank-pill">Ранг #${stats.ranks.gdp}</span>
          </div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">ВВП на душу населения</div>
          <div class="dossier-stat-value">
            <span>$${stats.gdpPerCapitaUSD.toLocaleString()}</span>
            <span class="dossier-rank-pill">Ранг #${stats.ranks.gdpPerCapita}</span>
          </div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Население</div>
          <div class="dossier-stat-value">
            <span>${stats.populationText}</span>
            <span class="dossier-rank-pill">Ранг #${stats.ranks.population}</span>
          </div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Военный потенциал</div>
          <div class="dossier-stat-value">
            <span>Вооруженные силы</span>
            <span class="dossier-rank-pill">Ранг #${stats.ranks.military}</span>
          </div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Безопасность граждан</div>
          <div class="dossier-stat-value">
            <span>Правопорядок</span>
            <span class="dossier-rank-pill">Ранг #${stats.ranks.security}</span>
          </div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Уровень образования</div>
          <div class="dossier-stat-value">
            <span>Наука и кадры</span>
            <span class="dossier-rank-pill">Ранг #${stats.ranks.education}</span>
          </div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Здравоохранение</div>
          <div class="dossier-stat-value">
            <span>Медицинская система</span>
            <span class="dossier-rank-pill">Ранг #${stats.ranks.medicine}</span>
          </div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Средний IQ</div>
          <div class="dossier-stat-value">
            <span>Интеллектуальный индекс</span>
            <span class="dossier-rank-pill">Ранг #${stats.ranks.iq}</span>
          </div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Индекс счастья</div>
          <div class="dossier-stat-value">
            <span>Благополучие</span>
            <span class="dossier-rank-pill">Ранг #${stats.ranks.happiness}</span>
          </div>
        </div>

        <div class="dossier-stat-card">
          <div class="dossier-stat-label">Продолжительность жизни</div>
          <div class="dossier-stat-value">
            <span>Долголетие</span>
            <span class="dossier-rank-pill">Ранг #${stats.ranks.lifeExpectancy}</span>
          </div>
        </div>
      </div>

      <div class="dossier-profile-box">
        Финансовый профиль: базовая расчетная котировка валюты зафиксирована на уровне <strong>${country.basePrice.toFixed(2)}</strong>. Сопротивление шокам рынка (инерция котировки): <strong>x${country.sensitivity.inertia}</strong>, базовая волатильность: <strong>${(country.sensitivity.baseVolatility * 1000).toFixed(1)}‰</strong>.
      </div>
    `;

    modal.classList.add('open');
  }

  switchMobileView(view) {
    this.activeMobileView = view;
    const grid = document.getElementById('terminalGrid');
    if (grid) grid.setAttribute('data-active-view', view);

    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === 'chart') {
      setTimeout(() => {
        const container = document.getElementById('chartContainer');
        if (this.chart && container) {
          this.chart.applyOptions({
            width: container.clientWidth,
            height: container.clientHeight,
          });
          this.chart.timeScale().fitContent();
        }
      }, 50);
    }
  }

  initEventListeners() {
    // Mobile navigation tabs
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) this.switchMobileView(view);
      });
    });

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

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
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
