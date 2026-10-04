export const TRUSTED_SOURCES = [
  { domain: "nalog.gov.ru", name: "ФНС России", tier: 3, type: "official" },
  { domain: "cbr.ru", name: "Банк России", tier: 3, type: "official" },
  { domain: "government.ru", name: "Правительство России", tier: 3, type: "official" },
  { domain: "minfin.gov.ru", name: "Минфин России", tier: 3, type: "official" },
  { domain: "minpromtorg.gov.ru", name: "Минпромторг России", tier: 3, type: "official" },
  { domain: "fas.gov.ru", name: "ФАС России", tier: 3, type: "official" },
  { domain: "moex.com", name: "Московская биржа", tier: 3, type: "official" },
  { domain: "e-disclosure.ru", name: "Интерфакс — раскрытие", tier: 3, type: "disclosure" },
  { domain: "fedresurs.ru", name: "Федресурс", tier: 3, type: "registry" },
  { domain: "interfax.ru", name: "Интерфакс", tier: 2, type: "media" },
  { domain: "tass.ru", name: "ТАСС", tier: 2, type: "media" },
  { domain: "rbc.ru", name: "РБК", tier: 2, type: "media" },
  { domain: "kommersant.ru", name: "Коммерсантъ", tier: 2, type: "media" },
  { domain: "vedomosti.ru", name: "Ведомости", tier: 2, type: "media" },
  { domain: "forbes.ru", name: "Forbes Russia", tier: 2, type: "media" },
  { domain: "ria.ru", name: "РИА Новости", tier: 2, type: "media" },
  { domain: "1prime.ru", name: "ПРАЙМ", tier: 2, type: "media" },
  { domain: "banki.ru", name: "Банки.ру", tier: 2, type: "media" },
  { domain: "finam.ru", name: "Финам", tier: 2, type: "media" },
  { domain: "expert.ru", name: "Эксперт", tier: 2, type: "media" }
];

const RULES = [
  {
    key: "tax",
    category: "Налоги / регуляторика",
    title: "Изменение налоговой нагрузки",
    patterns: [/налог/i, /ндпи/i, /пошлин/i, /акциз/i, /сбор/i, /налогов.*ставк/i],
    impact: "Изменение налоговой или регуляторной нагрузки может повлиять на денежный поток, себестоимость и потребность компании в оборотном финансировании.",
    products: ["Оборотное финансирование", "Cash management", "Хеджирование"]
  },
  {
    key: "sanctions",
    category: "Санкции / ограничения",
    title: "Новые санкционные ограничения",
    patterns: [/санкц/i, /ограничен/i, /эмбарго/i, /запрет.*экспорт/i, /экспортн.*контрол/i],
    impact: "Ограничения могут менять маршруты расчетов, логистику и доступность отдельных финансовых инструментов.",
    products: ["ВЭД", "Международные расчеты", "Гарантии"]
  },
  {
    key: "ma",
    category: "M&A / собственность",
    title: "Сделка M&A или изменение владения",
    patterns: [/приобрел/i, /приобрела/i, /покупк.*дол/i, /продаж.*дол/i, /поглощ/i, /слиян/i, /акционер/i, /совместн.*предприят/i],
    impact: "Изменение структуры владения или покупка актива может создать потребность в финансировании сделки, расчетах и управлении ликвидностью.",
    products: ["Acquisition finance", "Bridge financing", "Escrow", "Cash management"]
  },
  {
    key: "capex",
    category: "CAPEX / инвестиции",
    title: "Инвестиционная программа / CAPEX",
    patterns: [/строительств/i, /модерниз/i, /инвест.*программ/i, /нов.*мощност/i, /оборудован/i, /капвлож/i, /завод/i],
    impact: "Инвестиционный проект может потребовать длинного финансирования, лизинга оборудования, гарантий и дополнительного оборотного капитала.",
    products: ["Инвестиционный кредит", "Проектное финансирование", "Лизинг", "Гарантии"]
  },
  {
    key: "trade",
    category: "ВЭД",
    title: "Изменения во внешней торговле",
    patterns: [/экспорт/i, /импорт/i, /внешн.*торг/i, /международн.*постав/i, /кита[йя]/i, /инди[яи]/i, /оаэ/i],
    impact: "Изменения во внешней торговле могут повлиять на валютные потоки, маршруты расчетов и потребность в торговом финансировании.",
    products: ["Международные расчеты", "Торговое финансирование", "Хеджирование", "Гарантии"]
  },
  {
    key: "debt",
    category: "Долг / финансирование",
    title: "Новое долговое финансирование",
    patterns: [/кредит/i, /за[её]м/i, /рефинанс/i, /облигац/i, /долг.*финанс/i, /кредитн.*лини/i],
    impact: "Новое привлечение или рефинансирование долга — прямой сигнал для обсуждения стоимости фондирования, лимитов и структуры долгового портфеля.",
    products: ["Кредитная линия", "Рефинансирование", "Облигации", "Хеджирование ставки"]
  },
  {
    key: "contract",
    category: "Контракты",
    title: "Новый крупный контракт",
    patterns: [/контракт/i, /тендер/i, /госконтракт/i, /договор.*постав/i, /заказ.*млрд/i],
    impact: "Крупный контракт может увеличить потребность в гарантиях, оборотном финансировании и управлении расчетами.",
    products: ["Банковские гарантии", "Факторинг", "Оборотный кредит", "Cash management"]
  },
  {
    key: "liquidity",
    category: "Ликвидность",
    title: "Изменение свободной ликвидности",
    patterns: [/дивиденд/i, /свободн.*денеж/i, /денежн.*поток/i, /продаж.*актив/i, /ликвидност/i],
    impact: "Событие может означать появление или перераспределение свободной ликвидности и быть поводом обсудить ее размещение.",
    products: ["Депозит", "Овернайт", "Cash management"]
  },
  {
    key: "logistics",
    category: "Логистика",
    title: "Изменение логистической инфраструктуры",
    patterns: [/логист/i, /порт/i, /терминал/i, /склад/i, /флот/i, /контейнер/i, /железнодорож/i],
    impact: "Логистические изменения могут требовать финансирования инфраструктуры, техники и оборотного капитала.",
    products: ["Лизинг", "Проектное финансирование", "Оборотный кредит"]
  }
];

export function normalizeDomain(value) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return host;
  } catch {
    return String(value || "").toLowerCase().replace(/^www\./, "");
  }
}

export function sourceInfo(urlOrDomain) {
  const domain = normalizeDomain(urlOrDomain);
  const found = TRUSTED_SOURCES.find(function(s) {
    return domain === s.domain || domain.endsWith("." + s.domain);
  });
  return found || { domain: domain || "unknown", name: domain || "Источник", tier: 1, type: "other" };
}

export function classifyHeadline(text) {
  const value = String(text || "");
  let best = null;
  let bestScore = 0;
  RULES.forEach(function(rule) {
    const score = rule.patterns.reduce(function(sum, pattern) {
      return sum + (pattern.test(value) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  });
  if (!best) return null;
  return {
    key: best.key,
    category: best.category,
    shortTitle: best.title,
    impact: best.impact,
    products: best.products,
    ruleScore: bestScore
  };
}

export function sectorKeywords(okved, companyName) {
  const code = String(okved || "");
  const name = String(companyName || "").toLowerCase();
  if (code.startsWith("20") || /фосагро|акрон|уралхим|еврохим/.test(name)) return ["минеральные удобрения", "удобрения", "химическая промышленность"];
  if (code.startsWith("24") || /северсталь|ммк|нлмк/.test(name)) return ["металлургия", "сталь", "металлы"];
  if (code.startsWith("05") || code.startsWith("06") || /роснефть|лукойл|газпром нефть/.test(name)) return ["нефть", "газ", "нефтегаз"];
  if (code.startsWith("47") || /x5|магнит|лента/.test(name)) return ["ритейл", "розничная торговля"];
  if (code.startsWith("51") || /аэрофлот|s7/.test(name)) return ["авиация", "авиаперевозки"];
  if (code.startsWith("64")) return ["банковский сектор", "финансовый сектор"];
  if (code.startsWith("49")) return ["транспорт", "логистика"];
  return [];
}

export function coreCompanyTokens(name) {
  const stop = new Set(["пао","ао","ооо","оао","зао","нко","банк","компания","группа","публичное","акционерное","общество"]);
  return String(name || "")
    .toLowerCase()
    .replace(/[«»"'()]/g, " ")
    .split(/[^a-zа-яё0-9]+/i)
    .filter(function(x) { return x.length >= 3 && !stop.has(x); })
    .slice(0, 5);
}

export function companyRelevanceScore(item, profile) {
  const text = (String(item.title || "") + " " + String(item.description || "")).toLowerCase();
  const inn = String(profile.inn || "");
  const tokens = coreCompanyTokens(profile.name);
  let score = 0;
  if (inn && text.includes(inn)) score += 8;
  tokens.forEach(function(token) {
    if (text.includes(token)) score += token.length >= 6 ? 3 : 2;
  });
  if (profile.management && profile.management.name) {
    const surname = String(profile.management.name).toLowerCase().split(/\s+/)[0];
    if (surname.length > 3 && text.includes(surname)) score += 2;
  }
  return score;
}

export function tokensForCluster(text) {
  const stop = new Set(["компания","сообщил","сообщила","заявил","заявила","россия","россии","будет","может","новый","новые","новая","после","из-за","для","что","как","при","это"]);
  return Array.from(new Set(String(text || "").toLowerCase().split(/[^a-zа-яё0-9]+/i).filter(function(x) {
    return x.length >= 4 && !stop.has(x);
  }))).slice(0, 16);
}

function similarity(a, b) {
  const aa = tokensForCluster(a);
  const bb = new Set(tokensForCluster(b));
  if (!aa.length || !bb.size) return 0;
  const common = aa.filter(function(x) { return bb.has(x); }).length;
  return common / Math.max(aa.length, bb.size);
}

export function clusterArticles(articles) {
  const clusters = [];
  articles.forEach(function(article) {
    const analysis = classifyHeadline(article.title);
    if (!analysis) return;
    const candidate = clusters.find(function(cluster) {
      return cluster.analysis.key === analysis.key && similarity(cluster.articles[0].title, article.title) >= 0.25;
    });
    if (candidate) {
      candidate.articles.push(article);
    } else {
      clusters.push({ analysis: analysis, articles: [article] });
    }
  });

  return clusters.map(function(cluster, index) {
    const sources = [];
    const seenDomains = new Set();
    cluster.articles.forEach(function(article) {
      const info = sourceInfo(article.url || article.domain);
      if (!seenDomains.has(info.domain)) {
        seenDomains.add(info.domain);
        sources.push({
          name: article.sourceName || info.name,
          domain: info.domain,
          url: article.url,
          tier: info.tier,
          type: info.type,
          date: article.date
        });
      }
    });
    const hasOfficial = sources.some(function(s) { return s.tier >= 3; });
    const trustedCount = sources.filter(function(s) { return s.tier >= 2; }).length;
    const status = hasOfficial || trustedCount >= 2 ? "Подтверждено" : "Требует проверки";
    const confidence = hasOfficial ? 95 : trustedCount >= 3 ? 90 : trustedCount === 2 ? 82 : 62;
    const latest = cluster.articles.slice().sort(function(a,b) { return new Date(b.date) - new Date(a.date); })[0];

    return {
      id: "event-" + index + "-" + cluster.analysis.key,
      title: cluster.analysis.shortTitle,
      category: cluster.analysis.category,
      impact: cluster.analysis.impact,
      products: cluster.analysis.products,
      status: status,
      confidence: confidence,
      latestDate: latest.date,
      evidenceHeadline: latest.title,
      sourceCount: sources.length,
      sources: sources.sort(function(a,b) { return b.tier - a.tier; }),
      articleCount: cluster.articles.length
    };
  }).sort(function(a,b) {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return new Date(b.latestDate) - new Date(a.latestDate);
  });
}
