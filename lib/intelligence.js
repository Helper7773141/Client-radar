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
  { domain: "expert.ru", name: "Эксперт", tier: 2, type: "media" },
  { domain: "publication.pravo.gov.ru", name: "Официальное опубликование правовых актов", tier: 3, type: "official" },
  { domain: "regulation.gov.ru", name: "Проекты нормативных актов", tier: 3, type: "official" },
  { domain: "economy.gov.ru", name: "Минэкономразвития России", tier: 3, type: "official" },
  { domain: "minenergo.gov.ru", name: "Минэнерго России", tier: 3, type: "official" }
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
    patterns: [/приобрел/i, /приобрела/i, /покупк.*дол/i, /продаж.*дол/i, /поглощ/i, /слиян/i, /измен.*структур.*влад/i, /смен.*акционер/i, /нов.*акционер/i, /контролирующ.*дол/i, /совместн.*предприят/i],
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
  },
  {
    key: "management",
    category: "Менеджмент / управление",
    title: "Изменение руководства или корпоративного управления",
    patterns: [/назначен.*директор/i, /назначил.*директор/i, /генеральн.*директор/i, /смен.*руковод/i, /совет директоров/i, /покинул.*пост/i, /избран.*директор/i],
    impact: "Изменения в руководстве могут означать пересмотр приоритетов, инвестиционных планов, структуры финансирования или банковских партнерств.",
    products: ["Стратегический диалог", "Cash management", "Кредитные решения"]
  },
  {
    key: "regulation",
    category: "Регулирование / господдержка",
    title: "Изменение регулирования или мер господдержки",
    patterns: [/субсиди/i, /господдерж/i, /льгот/i, /квот/i, /тариф/i, /лицензир/i, /нормативн.*акт/i, /регулирован/i],
    impact: "Изменение отраслевого регулирования или мер господдержки может влиять на экономику проектов, оборотный капитал, инвестиции и структуру финансирования.",
    products: ["Проектное финансирование", "Оборотное финансирование", "Гарантии", "Cash management"]
  },
  {
    key: "litigation",
    category: "Суды / споры",
    title: "Судебный или имущественный спор",
    patterns: [/подал.*иск/i, /подали.*иск/i, /иск.*к/i, /суд.*взыск/i, /арбитраж/i, /судебн.*спор/i, /требован.*взыск/i, /euroclear/i, /clearstream/i],
    impact: "Судебный спор может влиять на доступность активов, ликвидность, сроки расчетов и структуру потенциальных банковских решений.",
    products: ["Cash management", "Гарантии", "Расчетные решения"]
  },
  {
    key: "results",
    category: "Финансовые результаты",
    title: "Изменение финансовых результатов",
    patterns: [/выручк/i, /ebitda/i, /чист.*прибыл/i, /финансов.*результ/i, /денежн.*поток/i, /рентабельност/i, /прибыл.*вырос/i, /прибыл.*сниз/i],
    impact: "Изменение финансовых результатов может менять долговую емкость, свободную ликвидность и потребность в кредитных или расчетных продуктах.",
    products: ["Кредитная линия", "Cash management", "Депозит", "Рефинансирование"]
  },
  {
    key: "rating",
    category: "Кредитный профиль",
    title: "Изменение кредитного рейтинга",
    patterns: [/кредитн.*рейтинг/i, /рейтинг.*повыш/i, /рейтинг.*пониж/i, /подтвердил.*рейтинг/i, /акра/i, /эксперт ра/i],
    impact: "Изменение кредитного рейтинга может влиять на стоимость фондирования, доступ к рынку капитала и условия кредитования.",
    products: ["Рефинансирование", "Облигации", "Кредитная линия"]
  },
  {
    key: "operations",
    category: "Производство / продажи",
    title: "Изменение производства или продаж",
    patterns: [/объем.*производ/i, /производств.*вырос/i, /производств.*сниз/i, /продаж.*вырос/i, /продаж.*сниз/i, /увеличил.*выпуск/i, /снизил.*выпуск/i, /нарастил.*постав/i],
    impact: "Изменение объемов производства или продаж может влиять на оборотный капитал, платежный цикл, валютные потоки и потребность в финансировании.",
    products: ["Оборотное финансирование", "Факторинг", "Cash management", "ВЭД"]
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

function specificEventTitle(rule, text) {
  const value = String(text || "");
  if (rule.key === "tax") {
    if (/ндпи/i.test(value)) return "Изменение НДПИ";
    if (/пошлин/i.test(value)) return "Изменение пошлин";
    if (/акциз/i.test(value)) return "Изменение акцизов";
    return "Изменение налоговой нагрузки";
  }
  if (rule.key === "sanctions") {
    if (/экспортн.*контрол|запрет.*экспорт/i.test(value)) return "Новые экспортные ограничения";
    return "Новые санкционные ограничения";
  }
  if (rule.key === "debt" && /облигац/i.test(value)) return "Выпуск или изменение облигационного долга";
  if (rule.key === "trade" && /экспорт/i.test(value)) return "Изменения в экспортных операциях";
  if (rule.key === "litigation" && /euroclear|clearstream/i.test(value)) return "Спор по активам в международном депозитарии";
  if (rule.key === "results" && /ebitda/i.test(value)) return "Изменение EBITDA";
  if (rule.key === "results" && /чист.*прибыл/i.test(value)) return "Изменение чистой прибыли";
  if (rule.key === "rating") return "Изменение кредитного рейтинга";
  return rule.title;
}

export function detectFactStage(text) {
  const value = String(text || "").toLowerCase();

  const denied = [
    /опроверг/, /не планиру/, /не будет/, /не рассматрива/, /отказал.*от/, /информация не соответствует/
  ];
  const enacted = [
    /подписал.*закон/, /закон подписан/, /принят.*закон/, /утвердил/, /утвержден/,
    /вступил.*силу/, /вступает.*силу/, /введен/, /вводится/, /установил/,
    /повысил.*ставк/, /снизил.*ставк/, /опубликован.*закон/
  ];
  const proposed = [
    /предложил/, /предлагает/, /планиру/, /обсужда/, /рассматрива/, /законопроект/,
    /инициатив/, /может повыс/, /может сниз/, /намерен/, /допускает/
  ];

  if (denied.some(function(p) { return p.test(value); })) return { key: "denied", label: "Опровергнуто", rank: 3 };
  if (enacted.some(function(p) { return p.test(value); })) return { key: "enacted", label: "Принято / введено", rank: 4 };
  if (proposed.some(function(p) { return p.test(value); })) return { key: "proposed", label: "Предложено / обсуждается", rank: 2 };
  return { key: "reported", label: "Сообщается", rank: 1 };
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
    shortTitle: specificEventTitle(best, value),
    impact: best.impact,
    products: best.products,
    ruleScore: bestScore
  };
}

export function sectorKeywords(okved, companyName) {
  const code = String(okved || "");
  const prefix = code.slice(0, 2);
  const name = String(companyName || "").toLowerCase();

  if (/фосагро|акрон|уралхим|еврохим/.test(name)) return ["минеральные удобрения", "удобрения", "агрохимия"];
  if (/северсталь|ммк|нлмк|мечел/.test(name)) return ["металлургия", "сталь", "черные металлы"];
  if (/норникел|норильск.*никел/.test(name)) return ["цветная металлургия", "никель", "палладий"];
  if (/роснефть|лукойл|газпром нефть|татнефть/.test(name)) return ["нефть", "нефтегаз", "нефтепродукты"];
  if (/x5|икс 5|магнит|лента/.test(name)) return ["ритейл", "розничная торговля", "продуктовые сети"];
  if (/аэрофлот|s7|авиакомпан/.test(name)) return ["авиация", "авиаперевозки"];

  const map = {
    "01":["сельское хозяйство","агропромышленный комплекс"],
    "03":["рыболовство","рыбная промышленность"],
    "05":["угольная промышленность","уголь"],
    "06":["нефть","газ","нефтегаз"],
    "07":["горнодобывающая промышленность","добыча руды"],
    "10":["пищевая промышленность","производство продуктов питания"],
    "19":["нефтепереработка","нефтепродукты"],
    "20":["химическая промышленность","химия"],
    "21":["фармацевтика","лекарственные препараты"],
    "22":["полимеры","резина и пластмассы"],
    "23":["строительные материалы","цемент"],
    "24":["металлургия","металлы"],
    "25":["металлообработка","металлические изделия"],
    "26":["электроника","компьютерное оборудование"],
    "27":["электрооборудование","электротехника"],
    "28":["машиностроение","промышленное оборудование"],
    "29":["автомобильная промышленность","автопром"],
    "30":["транспортное машиностроение","транспортное оборудование"],
    "35":["электроэнергетика","энергетика"],
    "41":["строительство","девелопмент"],
    "42":["инфраструктурное строительство","строительство"],
    "43":["строительство","подрядные работы"],
    "46":["оптовая торговля","дистрибуция"],
    "47":["ритейл","розничная торговля"],
    "49":["железнодорожный транспорт","автоперевозки","логистика"],
    "50":["морские перевозки","водный транспорт"],
    "51":["авиация","авиаперевозки"],
    "52":["логистика","складская инфраструктура"],
    "55":["гостиничный бизнес","туризм"],
    "56":["общественное питание","ресторанный бизнес"],
    "58":["медиа","издательский бизнес"],
    "61":["телеком","телекоммуникации"],
    "62":["IT","информационные технологии"],
    "64":["финансовый сектор","банковский сектор"],
    "65":["страхование","страховой рынок"],
    "68":["недвижимость","девелопмент"],
    "71":["инжиниринг","проектирование"],
    "72":["исследования и разработки","R&D"],
    "79":["туризм","туроператоры"],
    "86":["здравоохранение","медицинские услуги"]
  };

  return map[prefix] || [];
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

function eventPriority(key, confidence, stageKey) {
  const base = {
    tax: 90,
    sanctions: 92,
    ma: 88,
    capex: 86,
    debt: 84,
    trade: 80,
    contract: 76,
    liquidity: 72,
    logistics: 68,
    management: 74,
    regulation: 78,
    litigation: 73,
    results: 77,
    rating: 79,
    operations: 72
  }[key] || 65;
  let score = Math.round(base * 0.55 + confidence * 0.45);
  if (stageKey === "proposed") score -= 8;
  if (stageKey === "denied") score -= 20;
  const label = score >= 82 ? "Высокий" : score >= 70 ? "Средний" : "Низкий";
  return { score: Math.max(0, Math.min(100, score)), label: label };
}

function chooseStage(articles, sources) {
  const observations = articles.map(function(article) {
    const stage = detectFactStage(article.title + " " + (article.description || ""));
    const info = sourceInfo(article.url || article.domain);
    return { stage: stage, tier: info.tier };
  });
  const official = observations.filter(function(x) { return x.tier >= 3; });
  const basis = official.length ? official : observations;

  const keys = new Set(basis.map(function(x) { return x.stage.key; }));
  if (keys.has("denied") && (keys.has("enacted") || keys.has("proposed"))) {
    return { key: "conflict", label: "Статус расходится по источникам", rank: 0 };
  }
  if (keys.has("enacted")) return { key: "enacted", label: "Принято / введено", rank: 4 };
  if (keys.has("denied")) return { key: "denied", label: "Опровергнуто", rank: 3 };
  if (keys.has("proposed")) return { key: "proposed", label: "Предложено / обсуждается", rank: 2 };
  return { key: "reported", label: "Сообщается", rank: 1 };
}

export function clusterArticles(articles, relationLabel) {
  const clusters = [];
  articles.forEach(function(article) {
    const analysis = classifyHeadline(article.title + " " + (article.description || ""));
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
    const sourceByDomain = new Map();
    cluster.articles.forEach(function(article) {
      const info = sourceInfo(article.domain || article.url);
      const candidate = {
        name: article.sourceName || info.name,
        domain: info.domain,
        url: article.url,
        tier: info.tier,
        type: info.type,
        date: article.date
      };
      const existing = sourceByDomain.get(info.domain);
      const candidateDirect = candidate.url && !String(candidate.url).includes("news.google.com");
      const existingDirect = existing && existing.url && !String(existing.url).includes("news.google.com");
      if (!existing || (candidateDirect && !existingDirect)) sourceByDomain.set(info.domain, candidate);
    });
    sourceByDomain.forEach(function(value) { sources.push(value); });
    const hasOfficial = sources.some(function(s) { return s.tier >= 3; });
    const trustedCount = sources.filter(function(s) { return s.tier >= 2; }).length;
    const stage = chooseStage(cluster.articles, sources);
    const status = stage.key === "conflict" ? "Требует проверки" : (hasOfficial || trustedCount >= 2 ? "Подтверждено" : "Требует проверки");
    let confidence = hasOfficial ? 95 : trustedCount >= 3 ? 90 : trustedCount === 2 ? 82 : 62;
    if (stage.key === "conflict") confidence = Math.min(confidence, 55);
    const latest = cluster.articles.slice().sort(function(a,b) { return new Date(b.date) - new Date(a.date); })[0];
    const priority = eventPriority(cluster.analysis.key, confidence, stage.key);

    return {
      id: "event-" + index + "-" + cluster.analysis.key,
      title: cluster.analysis.shortTitle,
      category: cluster.analysis.category,
      impact: cluster.analysis.impact,
      products: cluster.analysis.products,
      status: status,
      factStage: stage.label,
      factStageKey: stage.key,
      confidence: confidence,
      priority: priority.label,
      priorityScore: priority.score,
      relation: relationLabel || "Прямая связь с компанией",
      latestDate: latest.date,
      evidenceHeadline: latest.title,
      sourceCount: sources.length,
      sources: sources.sort(function(a,b) { return b.tier - a.tier; }),
      articleCount: cluster.articles.length
    };
  }).sort(function(a,b) {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return new Date(b.latestDate) - new Date(a.latestDate);
  });
}
