import { NextResponse } from "next/server";
import { classifyHeadline } from "../../../lib/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LOOKBACK_DAYS = 90;

const TRUSTED_DOMAINS = [
  "interfax.ru","tass.ru","rbc.ru","kommersant.ru","vedomosti.ru",
  "1prime.ru","ria.ru","forbes.ru","acra-ratings.ru","raexpert.ru",
  "moex.com","cbr.ru","minfin.gov.ru","government.ru","economy.gov.ru",
  "minpromtorg.gov.ru","fas.gov.ru","e-disclosure.ru","fedresurs.ru","banki.ru"
];

const DIRECTORY_DOMAINS = [
  "rusprofile.ru","checko.ru","list-org.com","audit-it.ru","sbis.ru",
  "zachestnyibiznes.ru","spark-interfax.ru","reputation.ru","companies.rbc.ru"
];

function validCompanyInn(inn) {
  if (!/^\d{10}$/.test(inn)) return false;
  const d = inn.split("").map(Number);
  const w = [2,4,10,3,5,9,4,6,8];
  const c = (w.reduce(function(sum, weight, i) {
    return sum + weight * d[i];
  }, 0) % 11) % 10;
  return c === d[9];
}

function clean(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactLegalName(name) {
  return String(name || "")
    .replace(/\b(ПАО|АО|ООО|ОАО|ЗАО|НАО|PJSC|JSC|LLC)\b/gi, " ")
    .replace(/[«»"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function transliterate(value) {
  const map = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",
    к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
    х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"
  };
  return String(value || "").toLowerCase().split("").map(function(ch) {
    return map[ch] !== undefined ? map[ch] : ch;
  }).join("").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseDate(value) {
  const raw = String(value || "");
  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    const iso =
      raw.slice(0,4) + "-" + raw.slice(4,6) + "-" + raw.slice(6,8) +
      "T" + raw.slice(9,11) + ":" + raw.slice(11,13) + ":" + raw.slice(13,15) + "Z";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function withinLookback(value) {
  const d = parseDate(value);
  if (!d) return false;
  const min = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  return d.getTime() >= min && d.getTime() <= Date.now() + 24 * 60 * 60 * 1000;
}

async function safeFetch(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, timeoutMs || 6000);
  try {
    return await fetch(url, Object.assign({}, options || {}, {
      signal: controller.signal,
      cache: "no-store"
    }));
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCompany(inn) {
  const token = process.env.DADATA_TOKEN;
  if (!token) {
    const e = new Error("Не настроен DADATA_TOKEN.");
    e.code = "CONFIG_REQUIRED";
    throw e;
  }

  const response = await safeFetch(
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Token " + token
      },
      body: JSON.stringify({
        query: inn,
        type: "LEGAL",
        branch_type: "MAIN",
        count: 5
      })
    },
    6500
  );

  if (!response.ok) throw new Error("Не удалось определить компанию по ИНН.");

  const payload = await response.json();
  const item = (payload.suggestions || []).find(function(x) {
    return x.data && x.data.inn === inn;
  }) || (payload.suggestions || [])[0];

  if (!item || !item.data) {
    const e = new Error("Юридическое лицо с таким ИНН не найдено.");
    e.code = "NOT_FOUND";
    throw e;
  }

  const d = item.data;

  const founders = Array.isArray(d.founders)
    ? d.founders.map(function(founder) {
        return {
          name:
            founder.name ||
            (founder.fio
              ? [founder.fio.surname, founder.fio.name, founder.fio.patronymic].filter(Boolean).join(" ")
              : null),
          inn: founder.inn || null
        };
      }).filter(function(x) { return x.name; }).slice(0, 6)
    : [];

  return {
    inn: d.inn,
    kpp: d.kpp || null,
    ogrn: d.ogrn || null,
    name: (d.name && (d.name.short_with_opf || d.name.full_with_opf)) || item.value,
    fullName: (d.name && d.name.full_with_opf) || item.unrestricted_value || item.value,
    okved: d.okved || null,
    status: d.state && d.state.status ? d.state.status : null,
    management: d.management
      ? { name: d.management.name || null, post: d.management.post || null }
      : null,
    founders: founders
  };
}

function xmlTag(block, name) {
  const re = new RegExp("<" + name + "[^>]*>([\\s\\S]*?)<\\/" + name + ">", "i");
  const match = block.match(re);
  return match ? clean(match[1]) : "";
}

function xmlSource(block) {
  const match = block.match(/<source([^>]*)>([\s\S]*?)<\/source>/i);
  if (!match) return { name: "Google News", domain: "" };

  const name = clean(match[2]) || "Источник";
  const urlMatch = match[1].match(/url=["']([^"']+)["']/i);
  let domain = "";

  if (urlMatch) {
    try { domain = new URL(urlMatch[1]).hostname.replace(/^www\./, ""); } catch {}
  }

  return { name: name, domain: domain };
}

function stripSourceSuffix(title, sourceName) {
  const value = clean(title);
  const suffix = " - " + clean(sourceName);
  return suffix.length > 3 && value.toLowerCase().endsWith(suffix.toLowerCase())
    ? value.slice(0, -suffix.length).trim()
    : value;
}

async function googleNews(query, locale, exact) {
  const loc = locale === "en"
    ? "&hl=en-US&gl=US&ceid=US:en"
    : "&hl=ru&gl=RU&ceid=RU:ru";

  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query + " when:" + LOOKBACK_DAYS + "d") +
    loc;

  const response = await safeFetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ClientRadar/8.0" }
  }, 5500);

  if (!response.ok) throw new Error("Google News HTTP " + response.status);

  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return blocks.slice(0, 100).map(function(block, index) {
    const source = xmlSource(block);
    const date = xmlTag(block, "pubDate");

    return {
      id: "google-" + index + "-" + normalize(query).slice(0,20),
      title: stripSourceSuffix(xmlTag(block, "title"), source.name),
      description: xmlTag(block, "description"),
      date: date,
      sourceName: source.name,
      domain: source.domain,
      url: xmlTag(block, "link") || null,
      exact: Boolean(exact),
      channel: "google"
    };
  }).filter(function(x) {
    return x.title && withinLookback(x.date);
  });
}

async function bingNews(query, exact) {
  const url =
    "https://www.bing.com/news/search?q=" +
    encodeURIComponent(query) +
    "&format=rss&setlang=ru-ru";

  const response = await safeFetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ClientRadar/8.0" }
  }, 5000);

  if (!response.ok) throw new Error("Bing News HTTP " + response.status);

  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return blocks.slice(0, 80).map(function(block, index) {
    const link = xmlTag(block, "link");
    let domain = "";
    try { domain = new URL(link).hostname.replace(/^www\./, ""); } catch {}

    return {
      id: "bing-" + index + "-" + normalize(query).slice(0,20),
      title: xmlTag(block, "title"),
      description: xmlTag(block, "description"),
      date: xmlTag(block, "pubDate"),
      sourceName: domain || "Bing News",
      domain: domain,
      url: link || null,
      exact: Boolean(exact),
      channel: "bing"
    };
  }).filter(function(x) {
    return x.title && withinLookback(x.date);
  });
}

async function gdelt(alias) {
  const params = new URLSearchParams({
    query: '"' + alias + '"',
    mode: "ArtList",
    maxrecords: "100",
    format: "json",
    sort: "DateDesc",
    timespan: "3months"
  });

  const response = await safeFetch(
    "https://api.gdeltproject.org/api/v2/doc/doc?" + params.toString(),
    { headers: { "User-Agent": "ClientRadar/8.0" } },
    6500
  );

  if (!response.ok) throw new Error("GDELT HTTP " + response.status);

  const payload = await response.json();

  return (Array.isArray(payload.articles) ? payload.articles : []).map(function(x, index) {
    return {
      id: "gdelt-" + index,
      title: clean(x.title),
      description: "",
      date: x.seendate || "",
      sourceName: x.domain || "GDELT",
      domain: x.domain || "",
      url: x.url || null,
      exact: false,
      channel: "gdelt"
    };
  }).filter(function(x) {
    return x.title && withinLookback(x.date);
  });
}

async function bingWeb(query) {
  const url =
    "https://www.bing.com/search?q=" +
    encodeURIComponent(query) +
    "&format=rss&setlang=ru-ru";

  const response = await safeFetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ClientRadar/8.0" }
  }, 5000);

  if (!response.ok) return [];

  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return blocks.slice(0, 20).map(function(block) {
    const link = xmlTag(block, "link");
    let domain = "";
    try { domain = new URL(link).hostname.replace(/^www\./, ""); } catch {}

    return {
      title: xmlTag(block, "title"),
      description: xmlTag(block, "description"),
      url: link,
      domain: domain
    };
  });
}

function looksGeneric(name) {
  const generic = new Set([
    "интернет","решения","технологии","сервис","сервисы","группа","компания",
    "торговый","дом","развитие","инвестиции","управление","ресурс","ресурсы",
    "система","системы","проект","проекты","финанс","логистик"
  ]);

  const tokens = normalize(name).split(" ").filter(function(x) { return x.length >= 3; });
  return tokens.length > 0 && tokens.every(function(x) { return generic.has(x); });
}

function extractBrandCandidates(items, legalName) {
  const stop = new Set([
    "rusprofile","checko","sbis","audit","wikipedia","spark","инн","ооо","пао",
    "company","компания","россия","россии","телефон","адрес","реквизиты"
  ]);
  const legalTokens = new Set(normalize(legalName).split(" "));
  const counts = new Map();

  items.forEach(function(item) {
    const text = clean(item.title + " " + item.description);
    const tokens = text.match(/\b[A-Za-z][A-Za-z0-9.-]{2,}\b/g) || [];

    const unique = new Set(tokens.map(function(x) { return x.replace(/[.,:;!?]+$/g, ""); }));
    unique.forEach(function(token) {
      const key = token.toLowerCase();
      if (stop.has(key) || legalTokens.has(key)) return;
      counts.set(token, (counts.get(token) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort(function(a,b) { return b[1] - a[1]; })
    .filter(function(x) { return x[1] >= 2; })
    .map(function(x) { return x[0]; })
    .slice(0, 3);
}

async function discoverIdentity(profile) {
  const legal = compactLegalName(profile.name);
  const webResults = await bingWeb('"' + profile.inn + '" "' + legal + '"');

  const brands = extractBrandCandidates(webResults, legal);
  const officialCandidates = webResults.filter(function(item) {
    return item.url &&
      item.domain &&
      !DIRECTORY_DOMAINS.some(function(domain) {
        return item.domain === domain || item.domain.endsWith("." + domain);
      });
  });

  return {
    brands: brands,
    webResults: webResults,
    officialCandidate:
      officialCandidates.length > 0 ? officialCandidates[0] : null
  };
}

function buildAliases(profile, identity) {
  const legal = compactLegalName(profile.name);
  const translit = transliterate(legal);
  const aliases = [];

  (identity.brands || []).forEach(function(x) {
    if (x && x.length >= 3) aliases.push(x);
  });

  if (!looksGeneric(legal) || aliases.length === 0) aliases.push(legal);
  if (translit && translit.length >= 3) aliases.push(translit);

  if (translit.startsWith("fos")) aliases.push("ph" + translit.slice(1));

  return Array.from(new Set(
    aliases.map(function(x) { return String(x || "").trim(); }).filter(Boolean)
  )).slice(0, 4);
}

function trustedDomainQueries(alias) {
  const groups = [];
  for (let i = 0; i < TRUSTED_DOMAINS.length; i += 5) {
    groups.push(TRUSTED_DOMAINS.slice(i, i + 5));
  }

  return groups.map(function(group) {
    return '"' + alias + '" (' +
      group.map(function(domain) { return "site:" + domain; }).join(" OR ") +
      ")";
  });
}

function eventQueries(alias) {
  const q = '"' + alias + '"';
  return [
    q + " (облигации OR кредит OR рейтинг OR рефинансирование OR дивиденды OR EBITDA OR прибыль)",
    q + " (инвестиции OR строительство OR модернизация OR производство OR продажи OR экспорт OR импорт)",
    q + " (контракт OR тендер OR сделка OR акционер OR директор OR санкции OR налог OR суд)"
  ];
}

function articleKey(article) {
  return normalize(article.title);
}

function articleQuality(article) {
  let score = 0;
  if (article.exact) score += 20;
  if (article.url && !String(article.url).includes("news.google.com")) score += 10;
  if (clean(article.description).length >= 80) score += 8;
  if (TRUSTED_DOMAINS.some(function(domain) {
    return article.domain === domain || article.domain.endsWith("." + domain);
  })) score += 12;
  return score;
}

function dedupeArticles(items) {
  const map = new Map();

  items.forEach(function(item) {
    const key = articleKey(item);
    if (!key) return;

    const old = map.get(key);
    if (!old || articleQuality(item) > articleQuality(old)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
}

function relevant(article, aliases, profile) {
  if (article.exact) return true;

  const text = normalize(
    article.title + " " + article.description
  );

  if (profile.inn && text.includes(profile.inn)) return true;

  return aliases.some(function(alias) {
    const a = normalize(alias);
    return a.length >= 3 && text.includes(a);
  });
}

function tokenSet(value) {
  const stop = new Set([
    "компания","компании","россия","россии","сообщил","сообщила",
    "заявил","заявила","новый","новая","новые","будет","может",
    "после","для","что","как","при","это"
  ]);

  return new Set(
    normalize(value).split(" ").filter(function(token) {
      return token.length >= 4 && !stop.has(token);
    })
  );
}

function similarity(a, b) {
  const aa = tokenSet(a);
  const bb = tokenSet(b);
  if (!aa.size || !bb.size) return 0;

  let common = 0;
  aa.forEach(function(token) {
    if (bb.has(token)) common += 1;
  });

  return common / Math.max(aa.size, bb.size);
}

function cluster(items) {
  const clusters = [];

  items
    .slice()
    .sort(function(a,b) {
      return (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0);
    })
    .forEach(function(article) {
      const analysis = classifyHeadline(article.title + " " + article.description);
      const category = analysis ? analysis.category : "Новости компании";

      const existing = clusters.find(function(c) {
        return c.category === category &&
          similarity(c.items[0].title, article.title) >= 0.28;
      });

      if (existing) {
        existing.items.push(article);
      } else {
        clusters.push({
          category: category,
          analysis: analysis,
          items: [article]
        });
      }
    });

  return clusters;
}

function eventTitle(cluster) {
  if (cluster.analysis && cluster.analysis.shortTitle) {
    return cluster.analysis.shortTitle;
  }
  return cluster.items[0].title;
}

function stripBoilerplate(text, title) {
  let value = clean(text);
  if (!value) return "";

  const titleNorm = normalize(title);
  if (normalize(value) === titleNorm) return "";

  value = value
    .replace(/Read more.*$/i, "")
    .replace(/Читать далее.*$/i, "")
    .replace(/\s+\S+\.(ru|com|org|net)\s*$/i, "")
    .trim();

  return value;
}

function extractMetaDescription(html) {
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && clean(match[1]).length >= 50) return clean(match[1]);
  }

  return "";
}

function shorten(text, max) {
  const value = clean(text);
  if (value.length <= max) return value;
  return value.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

async function enrichCluster(c) {
  const sorted = c.items.slice().sort(function(a,b) {
    return articleQuality(b) - articleQuality(a);
  });

  const representative = sorted[0];
  let summary = stripBoilerplate(representative.description, representative.title);

  const direct = sorted.find(function(item) {
    return item.url && !String(item.url).includes("news.google.com");
  });

  if (direct) {
    try {
      const response = await safeFetch(direct.url, {
        headers: { "User-Agent": "Mozilla/5.0 ClientRadar/8.0" },
        redirect: "follow"
      }, 3200);

      if (response.ok) {
        const html = await response.text();
        const meta = extractMetaDescription(html);
        if (meta) summary = meta;
      }
    } catch {}
  }

  if (!summary) {
    const alternative = sorted
      .map(function(item) { return stripBoilerplate(item.description, item.title); })
      .find(function(x) { return x.length >= 50; });
    summary = alternative || representative.title;
  }

  const newest = c.items.slice().sort(function(a,b) {
    return (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0);
  })[0];

  return {
    id: "event-" + Math.random().toString(36).slice(2),
    title: eventTitle(c),
    details: shorten(summary, 380),
    date: (parseDate(newest.date) || new Date()).toISOString(),
    category: c.category,
    mentions: c.items.length
  };
}

function relations(profile) {
  const out = [];
  if (profile.management && profile.management.name) {
    out.push({
      type: "Руководитель",
      name: profile.management.name
    });
  }

  (profile.founders || []).forEach(function(founder) {
    out.push({
      type: "Учредитель",
      name: founder.name
    });
  });

  return out;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const inn = String(body.inn || "").replace(/\D/g, "");

    if (!validCompanyInn(inn)) {
      return NextResponse.json({
        error: "Введите корректный 10-значный ИНН юридического лица.",
        code: "INVALID_INN"
      }, { status: 400 });
    }

    const profile = await resolveCompany(inn);
    const identity = await discoverIdentity(profile);
    const aliases = buildAliases(profile, identity);

    const mainAlias = aliases[0] || compactLegalName(profile.name);
    const jobs = [];

    aliases.slice(0, 2).forEach(function(alias) {
      jobs.push(googleNews('"' + alias + '"', "ru", true));
      jobs.push(bingNews('"' + alias + '"', true));
      jobs.push(gdelt(alias));

      eventQueries(alias).forEach(function(query) {
        jobs.push(googleNews(query, "ru", true));
      });

      trustedDomainQueries(alias).forEach(function(query) {
        jobs.push(googleNews(query, "ru", true));
      });
    });

    const latinAlias = aliases.find(function(alias) {
      return /^[a-z0-9 .&-]+$/i.test(alias);
    });

    if (latinAlias) {
      jobs.push(googleNews('"' + latinAlias + '"', "en", true));
      jobs.push(bingNews('"' + latinAlias + '"', true));
    }

    const settled = await Promise.allSettled(jobs);

    let all = [];
    settled.forEach(function(result) {
      if (result.status === "fulfilled") all = all.concat(result.value);
    });

    const collected = dedupeArticles(all);
    const filtered = collected.filter(function(article) {
      return relevant(article, aliases, profile);
    });

    const clustered = cluster(filtered);
    let events = await Promise.all(clustered.map(enrichCluster));

    events = events
      .sort(function(a,b) {
        return new Date(b.date) - new Date(a.date);
      })
      .slice(0, 20);

    return NextResponse.json({
      company: profile,
      aliases: aliases,
      relations: relations(profile),
      events: events,
      stats: {
        collected: collected.length,
        relevant: filtered.length,
        events: events.length
      },
      lookbackDays: LOOKBACK_DAYS,
      methodology:
        "Собираем точные запросы по рабочим названиям компании из нескольких новостных каналов и доверенных доменов, склеиваем одинаковые публикации в одно событие и выводим их по времени."
    });
  } catch (error) {
    const code = error && error.code ? error.code : "ANALYSIS_ERROR";
    const status =
      code === "CONFIG_REQUIRED" ? 503 :
      code === "NOT_FOUND" ? 404 :
      500;

    return NextResponse.json({
      error: error.message || "Не удалось выполнить анализ.",
      code: code
    }, { status: status });
  }
}
