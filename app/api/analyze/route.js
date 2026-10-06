import { NextResponse } from "next/server";
import { searchCompanyNews } from "../../../lib/news-radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOOKBACK_DAYS = 365;

const TRUSTED_DOMAINS = [
  "interfax.ru","tass.ru","rbc.ru","kommersant.ru","vedomosti.ru",
  "1prime.ru","ria.ru","forbes.ru","acra-ratings.ru","raexpert.ru",
  "moex.com","cbr.ru","government.ru","minfin.gov.ru","fas.gov.ru",
  "e-disclosure.ru","fedresurs.ru","vc.ru","retailer.ru","adindex.ru"
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

function shorten(value, max) {
  const text = clean(value);
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
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
    const error = new Error("Не настроен DADATA_TOKEN.");
    error.code = "CONFIG_REQUIRED";
    throw error;
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
    const error = new Error("Юридическое лицо с таким ИНН не найдено.");
    error.code = "NOT_FOUND";
    throw error;
  }

  const d = item.data;
  const founders = Array.isArray(d.founders)
    ? d.founders.map(function(founder) {
        let share = null;
        if (founder.share && founder.share.value != null) {
          share = founder.share.type === "PERCENT"
            ? String(founder.share.value) + "%"
            : String(founder.share.value);
        }
        return {
          name: founder.name || (founder.fio
            ? [founder.fio.surname, founder.fio.name, founder.fio.patronymic].filter(Boolean).join(" ")
            : null),
          inn: founder.inn || null,
          type: founder.type || null,
          share: share
        };
      }).filter(function(x) { return x.name; }).slice(0, 8)
    : [];

  const managers = Array.isArray(d.managers)
    ? d.managers.map(function(manager) {
        return {
          name: manager.name || (manager.fio
            ? [manager.fio.surname, manager.fio.name, manager.fio.patronymic].filter(Boolean).join(" ")
            : null),
          inn: manager.inn || null,
          type: manager.type || null,
          post: manager.post || null
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
    founders: founders,
    managers: managers,
    employees: d.employee_count ?? null,
    capital: d.capital && d.capital.value != null ? d.capital.value : null,
    revenue: d.finance && d.finance.revenue != null ? d.finance.revenue : null,
    income: d.finance && d.finance.income != null ? d.finance.income : null,
    financeYear: d.finance && d.finance.year != null ? d.finance.year : null,
    branchCount: d.branch_count ?? 0
  };
}

function exactPeople(profile) {
  const people = [];
  const seen = new Set();

  function add(person) {
    if (!person || !person.name) return;
    const key = (person.inn || person.name) + "|" + person.type;
    if (seen.has(key)) return;
    seen.add(key);
    people.push(person);
  }

  (profile.managers || []).forEach(function(manager) {
    add({
      type: "Руководитель",
      name: manager.name,
      inn: manager.inn || null,
      post: manager.post || null,
      share: null
    });
  });

  if (!people.length && profile.management && profile.management.name) {
    add({
      type: "Руководитель",
      name: profile.management.name,
      inn: null,
      post: profile.management.post || null,
      share: null
    });
  }

  (profile.founders || []).forEach(function(founder) {
    add({
      type: "Учредитель",
      name: founder.name,
      inn: founder.inn || null,
      post: null,
      share: founder.share || null
    });
  });

  return people;
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

async function googleNews(query, locale) {
  const loc = locale === "en"
    ? "&hl=en-US&gl=US&ceid=US:en"
    : "&hl=ru&gl=RU&ceid=RU:ru";
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query + " when:" + LOOKBACK_DAYS + "d") +
    loc;

  const response = await safeFetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ClientRadar/10.0" }
  }, 5500);
  if (!response.ok) return [];

  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return blocks.slice(0, 100).map(function(block, index) {
    const source = xmlSource(block);
    return {
      id: "google-" + index,
      title: stripSourceSuffix(xmlTag(block, "title"), source.name),
      description: xmlTag(block, "description"),
      date: xmlTag(block, "pubDate"),
      sourceName: source.name,
      domain: source.domain,
      url: xmlTag(block, "link") || null
    };
  }).filter(function(x) {
    return x.title && withinLookback(x.date);
  });
}

async function bingNews(query) {
  const url =
    "https://www.bing.com/news/search?q=" +
    encodeURIComponent(query) +
    "&format=rss&setlang=ru-ru";

  const response = await safeFetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ClientRadar/10.0" }
  }, 5000);
  if (!response.ok) return [];

  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return blocks.slice(0, 80).map(function(block, index) {
    const link = xmlTag(block, "link");
    let domain = "";
    try { domain = new URL(link).hostname.replace(/^www\./, ""); } catch {}
    return {
      id: "bing-" + index,
      title: xmlTag(block, "title"),
      description: xmlTag(block, "description"),
      date: xmlTag(block, "pubDate"),
      sourceName: domain || "Bing News",
      domain: domain,
      url: link || null
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
    headers: { "User-Agent": "Mozilla/5.0 ClientRadar/10.0" }
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

function extractBrandCandidates(items, legalName) {
  const stop = new Set([
    "rusprofile","checko","sbis","audit","wikipedia","spark","инн","ооо","пао",
    "company","компания","russia","russian","online","official","site","website",
    "group","holding","service","services"
  ]);
  normalize(legalName).split(" ").forEach(function(token) { if (token) stop.add(token); });
  transliterate(legalName).split(" ").forEach(function(token) { if (token) stop.add(token); });

  const scores = new Map();
  function add(token, points) {
    const cleaned = String(token || "").replace(/[.,:;!?()[\]{}]+$/g, "");
    const key = cleaned.toLowerCase();
    if (cleaned.length < 3 || cleaned.length > 30 || stop.has(key)) return;
    scores.set(cleaned, (scores.get(cleaned) || 0) + points);
  }

  items.forEach(function(item) {
    const titleTokens = clean(item.title).match(/\b[A-Za-z][A-Za-z0-9.-]{2,}\b/g) || [];
    const bodyTokens = clean(item.description).match(/\b[A-Za-z][A-Za-z0-9.-]{2,}\b/g) || [];
    new Set(titleTokens).forEach(function(token) { add(token, 3); });
    new Set(bodyTokens).forEach(function(token) { add(token, 1); });
    if (item.domain && !DIRECTORY_DOMAINS.includes(item.domain)) {
      add(item.domain.split(".")[0], 2);
    }
  });

  return Array.from(scores.entries())
    .sort(function(a,b) { return b[1] - a[1]; })
    .filter(function(item) { return item[1] >= 3; })
    .map(function(item) { return item[0]; })
    .slice(0, 3);
}

async function buildAliases(profile) {
  const legal = compactLegalName(profile.name);
  const web = await bingWeb('"' + profile.inn + '" "' + legal + '"').catch(function() {
    return [];
  });
  const aliases = extractBrandCandidates(web, legal);
  aliases.push(legal);
  const translit = transliterate(legal);
  if (translit) aliases.push(translit);

  return Array.from(new Set(
    aliases.map(function(x) { return clean(x); }).filter(function(x) { return x.length >= 3; })
  )).slice(0, 5);
}

function articleKey(article) {
  return normalize(article.title);
}

function articleQuality(article) {
  let score = 0;
  if (article.url && !String(article.url).includes("news.google.com")) score += 10;
  if (clean(article.description).length >= 80) score += 6;
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
    if (!old || articleQuality(item) > articleQuality(old)) map.set(key, item);
  });
  return Array.from(map.values());
}

function relevanceScore(article, aliases, profile) {
  const title = normalize(article.title);
  const body = normalize(article.title + " " + article.description);

  if (DIRECTORY_DOMAINS.some(function(domain) {
    return article.domain === domain || article.domain.endsWith("." + domain);
  })) return -100;

  let score = 0;
  if (profile.inn && body.includes(profile.inn)) score += 100;

  aliases.forEach(function(alias) {
    const a = normalize(alias);
    if (a.length < 3) return;
    if (title.includes(a)) score += 60;
    else if (body.includes(a)) score += 26;
  });

  const legalTokens = normalize(compactLegalName(profile.name))
    .split(" ")
    .filter(function(token) { return token.length >= 4; });
  legalTokens.forEach(function(token) {
    if (title.includes(token)) score += 12;
    else if (body.includes(token)) score += 4;
  });

  if (profile.management && profile.management.name) {
    const surname = normalize(profile.management.name).split(" ")[0];
    if (surname && surname.length >= 4 && body.includes(surname)) score += 5;
  }

  if (TRUSTED_DOMAINS.some(function(domain) {
    return article.domain === domain || article.domain.endsWith("." + domain);
  })) score += 8;

  if (article.url && !String(article.url).includes("news.google.com")) score += 5;
  return score;
}

function category(text) {
  const value = normalize(text);
  if (/приобрел|приобрела|купил|купила|продал|продала|сделк|дол[яи]|m a|поглощ/.test(value)) return "Сделки / M&A";
  if (/инвест|завод|строител|мощност|расшир|открыл|запустил|запустила/.test(value)) return "Инвестиции / развитие";
  if (/выручк|прибыл|ebitda|облигац|кредит|долг|дивиденд|финансирован/.test(value)) return "Финансы";
  if (/партнер|соглашен|совместн|контракт|тендер/.test(value)) return "Партнерства";
  if (/директор|гендиректор|акционер|владелец|собственник/.test(value)) return "Собственники / менеджмент";
  if (/суд|иск|санкц|штраф|фас|регулятор/.test(value)) return "Регуляторика / суды";
  if (/экспорт|импорт|международ|зарубеж|китай|оаэ|казахстан|узбекистан/.test(value)) return "Международное развитие";
  if (/продукт|бренд|продаж|сервис|приложен|платформ|магазин/.test(value)) return "Продукт / продажи";
  return "Другое";
}

function toEvent(article, index) {
  let summary = clean(article.description);
  if (normalize(summary) === normalize(article.title)) summary = "";
  summary = summary
    .replace(/Read more.*$/i, "")
    .replace(/Читать далее.*$/i, "")
    .trim();

  return {
    id: "news-" + index + "-" + normalize(article.title).slice(0, 24),
    title: clean(article.title),
    details: shorten(summary || article.title, 420),
    date: (parseDate(article.date) || new Date(0)).toISOString(),
    category: category(article.title + " " + summary),
    sourceName: article.sourceName || article.domain || "Источник",
    domain: article.domain || "",
    url: article.url || null,
    mentions: 1
  };
}

function titleTokens(text) {
  const stop = new Set(["компания","компании","россия","россии","новый","новая","новые","сообщил","заявил","будет","может"]);
  return new Set(normalize(text).split(" ").filter(function(x) {
    return x.length >= 4 && !stop.has(x);
  }));
}

function similarTitles(a, b) {
  const aa = titleTokens(a);
  const bb = titleTokens(b);
  if (!aa.size || !bb.size) return false;
  let common = 0;
  aa.forEach(function(token) { if (bb.has(token)) common += 1; });
  return common / Math.max(aa.size, bb.size) >= 0.72;
}

function mergeNews(webArticles, fallbackArticles) {
  const result = [];
  const urls = new Set();

  function add(item) {
    if (!item || !item.title) return;
    const urlKey = item.url
      ? String(item.url).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase()
      : "";
    if (urlKey && urls.has(urlKey)) return;
    if (result.some(function(existing) { return similarTitles(existing.title, item.title); })) return;
    if (urlKey) urls.add(urlKey);
    result.push(item);
  }

  (webArticles || []).forEach(add);
  (fallbackArticles || []).forEach(add);

  return result
    .sort(function(a,b) { return new Date(b.date) - new Date(a.date); })
    .slice(0, 20);
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
    const aliases = await buildAliases(profile);
    const people = exactPeople(profile);
    const network = { people: people, subsidiaries: [], relatedCompanies: [] };
    const mainAlias = aliases[0] || compactLegalName(profile.name);

    const jobs = [];
    aliases.slice(0, 4).forEach(function(alias) {
      jobs.push(googleNews('"' + alias + '"', "ru"));
      jobs.push(bingNews('"' + alias + '"'));
    });

    jobs.push(googleNews('"' + profile.inn + '"', "ru"));
    jobs.push(googleNews('"' + mainAlias + '" (сделка OR инвестиции OR выручка OR прибыль OR партнерство OR запуск OR производство OR акционер OR директор OR суд)', "ru"));
    jobs.push(googleNews('"' + mainAlias + '" (купил OR приобрел OR продал OR доля OR завод OR рынок OR экспорт OR импорт OR облигации OR кредит)', "ru"));

    people.slice(0, 2).forEach(function(person) {
      jobs.push(googleNews('"' + person.name + '" "' + mainAlias + '"', "ru"));
    });

    const results = await Promise.all([
      Promise.allSettled(jobs),
      searchCompanyNews(profile, aliases, network).catch(function(error) {
        return { status: "error", reason: error.message, articles: [], sources: [] };
      })
    ]);

    let collected = [];
    results[0].forEach(function(result) {
      if (result.status === "fulfilled") collected = collected.concat(result.value);
    });
    collected = dedupeArticles(collected);

    const fallback = collected
      .map(function(article) {
        return { article: article, score: relevanceScore(article, aliases, profile) };
      })
      .filter(function(item) { return item.score >= 24; })
      .sort(function(a,b) {
        if (b.score !== a.score) return b.score - a.score;
        return (parseDate(b.article.date)?.getTime() || 0) - (parseDate(a.article.date)?.getTime() || 0);
      })
      .slice(0, 30)
      .map(function(item, index) { return toEvent(item.article, index); });

    const webNews = results[1];
    const events = mergeNews(
      webNews && webNews.status === "ok" ? webNews.articles : [],
      fallback
    );

    return NextResponse.json({
      company: profile,
      aliases: aliases,
      relations: people,
      subsidiaries: [],
      relatedCompanies: [],
      events: events,
      stats: {
        collected: collected.length,
        relevant: fallback.length,
        webSelected: webNews && webNews.status === "ok" ? webNews.articles.length : 0,
        events: events.length
      },
      newsMode: webNews && webNews.status === "ok" ? "web-search" : "aggregators",
      newsSearchStatus: webNews ? webNews.status : "disabled",
      lookbackDays: LOOKBACK_DAYS,
      methodology:
        "До 20 наиболее релевантных публикаций именно об этой компании за последние 12 месяцев. Каждая статья показывается отдельно и лента отсортирована строго по дате — от новых к старым."
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

export async function GET(request) {
  const url = new URL(request.url);
  const inn = String(url.searchParams.get("inn") || "");
  return POST({
    json: async function() {
      return { inn: inn };
    }
  });
}
