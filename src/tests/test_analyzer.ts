import { analyzeWithRegexFallback } from '../engine/analyzer.js';

console.log('🧪 Testing Tier 2 Regex Analyzer on Real RP Examples...\n');

const testCases = [
  '**Люменария обвиняет Негецию в подрыве суверенитета, а также в подмене институтов суверенного государства**',
  '**Люменария накладывает санкции на ФРВ**',
  '**Люменария открывает беспошлинный проход для торговых судов Гросса и Хисолии**',
  '**Негеция начала постройку новых экономических центров и мегаполисов по всей стране. На слаборазвитые регионы было выделено намного больше денег с федерального бюджета чем на высокоразвитые**',
  '**Негеция начала глубоководные изучения океанов. Для таких операций началось строительство новейших современных аппаратов**'
];

for (let i = 0; i < testCases.length; i++) {
  const text = testCases[i];
  console.log(`--- Тест ${i + 1} ---`);
  console.log(`Текст: "${text}"`);
  const result = analyzeWithRegexFallback(text);
  console.log(`Заголовок: ${result.event_title}`);
  console.log(`Влияние:`);
  for (const imp of result.impacts) {
    console.log(`  - [${imp.ticker}] Дрифт: ${imp.drift > 0 ? '+' : ''}${imp.drift}, Волатильность: ${imp.volatility}, Затухание: ${imp.decay} (${imp.reason})`);
  }
  console.log('');
}
