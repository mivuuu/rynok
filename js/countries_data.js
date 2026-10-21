export const SECTOR_LABELS = {
  tech: { label: 'Высокие технологии', icon: '🔬' },
  industry: { label: 'Тяжелая промышленность', icon: '⚙️' },
  resources: { label: 'Сырьевой гигант', icon: '🛢️' },
  finance: { label: 'Финансовый хаб', icon: '🏦' },
  military: { label: 'Военная машина', icon: '⚔️' },
  autarky: { label: 'Плановая автаркия', icon: '🛡️' },
  agriculture: { label: 'Аграрная житница', icon: '🌾' },
};

export const COUNTRIES = {
  ETH: {
    ticker: 'ETH',
    currencyName: 'Эфириум',
    countryName: 'Люменария',
    basePrice: 250.00,
    sectors: ['tech', 'industry', 'resources', 'finance'],
    stats: {
      gdpText: '$38,6 трлн',
      gdpValueBillionUSD: 38600,
      gdpPerCapitaUSD: 172900,
      populationText: '223,3 млн',
      ranks: { gdp: 1, gdpPerCapita: 2, population: 1, military: 1, lifeExpectancy: 2, happiness: 7, security: 10, education: 1, medicine: 1, iq: 1 }
    },
    sensitivity: { inertia: 0.65, baseVolatility: 0.0009 }
  },
  VYN: {
    ticker: 'VYN',
    currencyName: 'Вейрон',
    countryName: 'Аустра',
    basePrice: 180.00,
    sectors: ['military', 'autarky'],
    stats: {
      gdpText: '$27,5 трлн',
      gdpValueBillionUSD: 27500,
      gdpPerCapitaUSD: 127100,
      populationText: '216,4 млн',
      ranks: { gdp: 2, gdpPerCapita: 4, population: 2, military: 2, lifeExpectancy: 10, happiness: 18, security: 23, education: 12, medicine: 7, iq: 7 }
    },
    sensitivity: { inertia: 0.70, baseVolatility: 0.0014 }
  },
  NEL: {
    ticker: 'NEL',
    currencyName: 'Нельд',
    countryName: 'Негеция',
    basePrice: 175.00,
    sectors: ['tech', 'industry', 'finance', 'resources'],
    stats: {
      gdpText: '$26,3 трлн',
      gdpValueBillionUSD: 26300,
      gdpPerCapitaUSD: 164600,
      populationText: '159,8 млн',
      ranks: { gdp: 3, gdpPerCapita: 3, population: 5, military: 3, lifeExpectancy: 4, happiness: 8, security: 11, education: 2, medicine: 2, iq: 2 }
    },
    sensitivity: { inertia: 0.70, baseVolatility: 0.0010 }
  },
  VNG: {
    ticker: 'VNG',
    currencyName: 'Вонга',
    countryName: 'Вергилия',
    basePrice: 95.00,
    sectors: ['industry'],
    stats: {
      gdpText: '$11,4 трлн',
      gdpValueBillionUSD: 11400,
      gdpPerCapitaUSD: 67700,
      populationText: '168,4 млн',
      ranks: { gdp: 4, gdpPerCapita: 5, population: 4, military: 5, lifeExpectancy: 13, happiness: 14, security: 17, education: 7, medicine: 4, iq: 3 }
    },
    sensitivity: { inertia: 0.85, baseVolatility: 0.0012 }
  },
  YRL: {
    ticker: 'YRL',
    currencyName: 'Ярл',
    countryName: 'Ярландия',
    basePrice: 75.00,
    sectors: ['tech'],
    stats: {
      gdpText: '$4,8 трлн',
      gdpValueBillionUSD: 4800,
      gdpPerCapitaUSD: 58000,
      populationText: '82,7 млн',
      ranks: { gdp: 5, gdpPerCapita: 6, population: 8, military: 9, lifeExpectancy: 3, happiness: 9, security: 9, education: 4, medicine: 3, iq: 5 }
    },
    sensitivity: { inertia: 0.90, baseVolatility: 0.0013 }
  },
  TVR: {
    ticker: 'TVR',
    currencyName: 'Тавер',
    countryName: 'Просперия',
    basePrice: 60.00,
    sectors: ['industry'],
    stats: {
      gdpText: '$3,7 трлн',
      gdpValueBillionUSD: 3700,
      gdpPerCapitaUSD: 20500,
      populationText: '180,6 млн',
      ranks: { gdp: 6, gdpPerCapita: 15, population: 3, military: 7, lifeExpectancy: 17, happiness: 13, security: 12, education: 16, medicine: 11, iq: 16 }
    },
    sensitivity: { inertia: 0.95, baseVolatility: 0.0014 }
  },
  OIL: {
    ticker: 'OIL',
    currencyName: 'Ойл',
    countryName: 'Гросс',
    basePrice: 55.00,
    sectors: ['tech', 'industry'],
    stats: {
      gdpText: '$3,2 трлн',
      gdpValueBillionUSD: 3200,
      gdpPerCapitaUSD: 47700,
      populationText: '67,1 млн',
      ranks: { gdp: 7, gdpPerCapita: 8, population: 9, military: 13, lifeExpectancy: 5, happiness: 1, security: 3, education: 3, medicine: 5, iq: 4 }
    },
    sensitivity: { inertia: 0.95, baseVolatility: 0.0013 }
  },
  VTN: {
    ticker: 'VTN',
    currencyName: 'Витан',
    countryName: 'Критания',
    basePrice: 45.00,
    sectors: ['military'],
    stats: {
      gdpText: '$2,6 трлн',
      gdpValueBillionUSD: 2600,
      gdpPerCapitaUSD: 30800,
      populationText: '84,5 млн',
      ranks: { gdp: 8, gdpPerCapita: 11, population: 7, military: 4, lifeExpectancy: 12, happiness: 23, security: 22, education: 19, medicine: 19, iq: 6 }
    },
    sensitivity: { inertia: 1.00, baseVolatility: 0.0018 }
  },
  RVN: {
    ticker: 'RVN',
    currencyName: 'Ровен',
    countryName: 'Роха',
    basePrice: 35.00,
    sectors: ['resources', 'agriculture'],
    stats: {
      gdpText: '$1,8 трлн',
      gdpValueBillionUSD: 1800,
      gdpPerCapitaUSD: 36700,
      populationText: '49,1 млн',
      ranks: { gdp: 9, gdpPerCapita: 10, population: 14, military: 8, lifeExpectancy: 14, happiness: 10, security: 13, education: 10, medicine: 6, iq: 12 }
    },
    sensitivity: { inertia: 1.05, baseVolatility: 0.0015 }
  },
  SHK: {
    ticker: 'SHK',
    currencyName: 'Шакар',
    countryName: 'Эшкирия',
    basePrice: 30.00,
    sectors: ['resources', 'agriculture'],
    stats: {
      gdpText: '$1,4 трлн',
      gdpValueBillionUSD: 1400,
      gdpPerCapitaUSD: 27300,
      populationText: '51,3 млн',
      ranks: { gdp: 10, gdpPerCapita: 13, population: 13, military: 10, lifeExpectancy: 18, happiness: 15, security: 16, education: 17, medicine: 17, iq: 15 }
    },
    sensitivity: { inertia: 1.10, baseVolatility: 0.0016 }
  },
  KRN: {
    ticker: 'KRN',
    currencyName: 'Кайрен',
    countryName: 'Новая Кайландия',
    basePrice: 22.00,
    sectors: ['industry'],
    stats: {
      gdpText: '$970 млрд',
      gdpValueBillionUSD: 970,
      gdpPerCapitaUSD: 15300,
      populationText: '63,6 млн',
      ranks: { gdp: 11, gdpPerCapita: 19, population: 10, military: 11, lifeExpectancy: 16, happiness: 16, security: 14, education: 11, medicine: 16, iq: 13 }
    },
    sensitivity: { inertia: 1.15, baseVolatility: 0.0015 }
  },
  RSH: {
    ticker: 'RSH',
    currencyName: 'Рашен',
    countryName: 'Расшатай',
    basePrice: 18.00,
    sectors: ['autarky'],
    stats: {
      gdpText: '$925 млрд',
      gdpValueBillionUSD: 925,
      gdpPerCapitaUSD: 8900,
      populationText: '104,3 млн',
      ranks: { gdp: 12, gdpPerCapita: 20, population: 6, military: 6, lifeExpectancy: 19, happiness: 17, security: 15, education: 18, medicine: 18, iq: 19 }
    },
    sensitivity: { inertia: 1.20, baseVolatility: 0.0017 }
  },
  FRT: {
    ticker: 'FRT',
    currencyName: 'Фартмарка',
    countryName: 'Фертенберг',
    basePrice: 16.00,
    sectors: ['agriculture', 'industry'],
    stats: {
      gdpText: '$740 млрд',
      gdpValueBillionUSD: 740,
      gdpPerCapitaUSD: 20200,
      populationText: '36,6 млн',
      ranks: { gdp: 13, gdpPerCapita: 17, population: 16, military: 17, lifeExpectancy: 9, happiness: 6, security: 8, education: 8, medicine: 10, iq: 17 }
    },
    sensitivity: { inertia: 1.20, baseVolatility: 0.0015 }
  },
  VLT: {
    ticker: 'VLT',
    currencyName: 'Вельт',
    countryName: 'Мантия',
    basePrice: 32.00,
    sectors: ['finance'],
    stats: {
      gdpText: '$630 млрд',
      gdpValueBillionUSD: 630,
      gdpPerCapitaUSD: 29600,
      populationText: '21,3 млн',
      ranks: { gdp: 14, gdpPerCapita: 12, population: 17, military: 14, lifeExpectancy: 8, happiness: 5, security: 4, education: 5, medicine: 8, iq: 8 }
    },
    sensitivity: { inertia: 1.15, baseVolatility: 0.0014 }
  },
  ETW: {
    ticker: 'ETW',
    currencyName: 'Этвейн',
    countryName: 'Этрория',
    basePrice: 40.00,
    sectors: ['finance'],
    stats: {
      gdpText: '$315 млрд',
      gdpValueBillionUSD: 315,
      gdpPerCapitaUSD: 175000,
      populationText: '1,8 млн',
      ranks: { gdp: 15, gdpPerCapita: 1, population: 22, military: 22, lifeExpectancy: 7, happiness: 4, security: 2, education: 6, medicine: 9, iq: 11 }
    },
    sensitivity: { inertia: 1.10, baseVolatility: 0.0016 }
  },
  AZM: {
    ticker: 'AZM',
    currencyName: 'Азмар',
    countryName: 'Асмаин',
    basePrice: 12.00,
    sectors: ['tech', 'resources'],
    stats: {
      gdpText: '$280 млрд',
      gdpValueBillionUSD: 280,
      gdpPerCapitaUSD: 15900,
      populationText: '17,6 млн',
      ranks: { gdp: 16, gdpPerCapita: 18, population: 18, military: 18, lifeExpectancy: 11, happiness: 3, security: 7, education: 13, medicine: 13, iq: 9 }
    },
    sensitivity: { inertia: 1.25, baseVolatility: 0.0017 }
  },
  HRN: {
    ticker: 'HRN',
    currencyName: 'Хисолийская крона',
    countryName: 'Хисолия',
    basePrice: 10.00,
    sectors: ['industry'],
    stats: {
      gdpText: '$240 млрд',
      gdpValueBillionUSD: 240,
      gdpPerCapitaUSD: 6300,
      populationText: '38,4 млн',
      ranks: { gdp: 17, gdpPerCapita: 21, population: 15, military: 16, lifeExpectancy: 15, happiness: 12, security: 6, education: 15, medicine: 14, iq: 18 }
    },
    sensitivity: { inertia: 1.30, baseVolatility: 0.0018 }
  },
  URE: {
    ticker: 'URE',
    currencyName: 'Урийский нельд',
    countryName: 'Урия',
    basePrice: 25.00,
    sectors: ['agriculture', 'finance'],
    stats: {
      gdpText: '$190 млрд',
      gdpValueBillionUSD: 190,
      gdpPerCapitaUSD: 44200,
      populationText: '4,3 млн',
      ranks: { gdp: 18, gdpPerCapita: 9, population: 20, military: 19, lifeExpectancy: 1, happiness: 2, security: 1, education: 14, medicine: 12, iq: 10 }
    },
    sensitivity: { inertia: 1.15, baseVolatility: 0.0012 }
  },
  OMY: {
    ticker: 'OMY',
    currencyName: 'Омай',
    countryName: 'Гайяна',
    basePrice: 4.50,
    sectors: ['autarky'],
    stats: {
      gdpText: '$155 млрд',
      gdpValueBillionUSD: 155,
      gdpPerCapitaUSD: 2900,
      populationText: '53,2 млн',
      ranks: { gdp: 19, gdpPerCapita: 22, population: 12, military: 12, lifeExpectancy: 23, happiness: 22, security: 21, education: 23, medicine: 23, iq: 23 }
    },
    sensitivity: { inertia: 1.45, baseVolatility: 0.0024 }
  },
  TGR: {
    ticker: 'TGR',
    currencyName: 'Тангар',
    countryName: 'Пагристан',
    basePrice: 3.00,
    sectors: ['autarky'],
    stats: {
      gdpText: '$105 млрд',
      gdpValueBillionUSD: 105,
      gdpPerCapitaUSD: 1900,
      populationText: '56,4 млн',
      ranks: { gdp: 20, gdpPerCapita: 23, population: 11, military: 15, lifeExpectancy: 22, happiness: 21, security: 20, education: 22, medicine: 22, iq: 22 }
    },
    sensitivity: { inertia: 1.50, baseVolatility: 0.0025 }
  },
  NVR: {
    ticker: 'NVR',
    currencyName: 'Северный велар',
    countryName: 'Северный Сапах',
    basePrice: 5.50,
    sectors: ['industry'],
    stats: {
      gdpText: '$95 млрд',
      gdpValueBillionUSD: 95,
      gdpPerCapitaUSD: 20200,
      populationText: '4,7 млн',
      ranks: { gdp: 21, gdpPerCapita: 16, population: 19, military: 20, lifeExpectancy: 20, happiness: 19, security: 19, education: 20, medicine: 20, iq: 20 }
    },
    sensitivity: { inertia: 1.35, baseVolatility: 0.0020 }
  },
  SVR: {
    ticker: 'SVR',
    currencyName: 'Южный велар',
    countryName: 'Южный Сапах',
    basePrice: 5.00,
    sectors: ['industry'],
    stats: {
      gdpText: '$80 млрд',
      gdpValueBillionUSD: 80,
      gdpPerCapitaUSD: 23500,
      populationText: '3,4 млн',
      ranks: { gdp: 22, gdpPerCapita: 14, population: 21, military: 21, lifeExpectancy: 21, happiness: 20, security: 18, education: 21, medicine: 21, iq: 21 }
    },
    sensitivity: { inertia: 1.35, baseVolatility: 0.0020 }
  },
  FRZ: {
    ticker: 'FRZ',
    currencyName: 'Ферзак',
    countryName: 'Ферондия',
    basePrice: 8.50,
    sectors: ['agriculture'],
    stats: {
      gdpText: '$50 млрд',
      gdpValueBillionUSD: 50,
      gdpPerCapitaUSD: 53800,
      populationText: '930 тыс.',
      ranks: { gdp: 23, gdpPerCapita: 7, population: 23, military: 23, lifeExpectancy: 6, happiness: 11, security: 5, education: 9, medicine: 15, iq: 14 }
    },
    sensitivity: { inertia: 1.25, baseVolatility: 0.0018 }
  }
};
