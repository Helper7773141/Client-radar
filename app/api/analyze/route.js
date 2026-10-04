import { NextResponse } from "next/server";
import { classifyHeadline, detectFactStage } from "../../../lib/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

const LOOKBACK_DAYS = 90;

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

function compactName(name) {
  return String(name || "")
    .replace(/\b(ПАО|АО|ООО|ОАО|ЗАО|НАО|PJSC|JSC|LLC)\b/gi, "")
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

function aliasesFor(profile) {
  const out = [];
  const shortName = compactName(profile.name);
  const fullName = compactName(profile.fullName);

  [shortName, fullName].forEach(function(value) {
    if (value && value.length >= 3) out.push(value);
  });

  const latin = transliterate(shortName);
  if (latin) {
    out.push(latin);
    if (latin.startsWith("fos")) out.push("ph" + latin.slice(1));
  }

  return Array.from(new Set(out.map(function(x) {
    return x.trim();
  }).filter(Boolean))).slice(0, 5);
}

function parseDate(value) {
  const raw = String(value || "");
  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    const iso =
      raw.slice(0,4) + "-" + raw.slice(4,6) + "-" + raw.slice(6,8) +
      "T" + raw.slice(9,11) + ":" + raw.slice(11,13) + ":" + raw.slice(13,15) + "Z";
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function withinLookback(value) {
  const date = parseDate(value);
  if (!date) return false;
  const earliest = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  return date.getTime() >= earliest && date.getTime() <= Date.now() + 24 * 60 * 60 * 1000;
}

async function safeFetch(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function() {
    controller.abort();
  }, timeoutMs || 6500);

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
  const suggestion = (payload.suggestions || []).find(function(item) {
    return item.data && item.data.inn === inn;
  }) || (payload.suggestions || [])[0];

  if (!suggestion || !suggestion.data) {
    const error = new Error("Юридическое лицо с таким ИНН не найдено.");
    error.code = "NOT_FOUND";
    throw error;
  }

  const d = suggestion.data;
  return {
    inn: d.inn,
    kpp: d.kpp || null,
    ogrn: d.ogrn || null,
    name: (d.name && (d.name.short_with_opf || d.name.full_with_opf)) || suggestion.value,
    fullName: (d.name && d.name.full_with_opf) || suggestion.unrestricted_value || suggestion.value,
    status: d.state && d.state.status ? d.state.status : null,
    okved: d.okved || null,
    management: d.management ? {
      name: d.management.name || null,
      post: d.management.post || null
    } : null
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
    try {
      domain = new URL(urlMatch[1]).hostname.replace(/^www\./, "");
    } catch {}
  }

  return { name: name, domain: domain };
}

function stripSourceSuffix(title, sourceName) {
  const value = clean(title);
  const source = clean(sourceName);
  if (!source) return value;

  const suffix = " - " + source;
  if (value.toLowerCase().endsWith(suffix.toLowerCase())) {
    return value.slice(0, -suffix.length).trim();
  }
  return value;
}

async function googleNews(query, locale, scope, searchMode) {
  const localeParams = locale === "en"
    ? "&hl=en-US&gl=US&ceid=US:en"
    : "&hl=ru&gl=RU&ceid=RU:ru";

  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query + " when:" + LOOKBACK_DAYS + "d") +
    localeParams;

  const response = await safeFetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ClientRadar/6.0" }
  }, 6500);

  if (!response.ok) throw new Error("Google News HTTP " + response.status);

  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return blocks.slice(0, 100).map(function(block, index) {
    const source = xmlSource(block);
    const title = stripSourceSuffix(xmlTag(block, "title"), source.name);
    const date = xmlTag(block, "pubDate");

    return {
      id: "gn-" + scope + "-" + index,
      title: title,
      description: xmlTag(block, "description"),
      date: date,
      sourceName: source.name,
      domain: source.domain,
      url: xmlTag(block, "link") || null,
      official: false,
      searchMode: searchMode || "broad"
    };
  }).filter(function(item) {
    return item.title && withinLookback(item.date);
  });
}


async function bingNews(query, scope) {
  const url =
    "https://www.bing.com/news/search?q=" +
    encodeURIComponent(query) +
    "&format=rss&setlang=ru-ru";

  const response = await safeFetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ClientRadar/7.0" }
  }, 5000);

  if (!response.ok) throw new Error("Bing News HTTP " + response.status);

  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return blocks.slice(0, 80).map(function(block, index) {
    const title = xmlTag(block, "title");
    const link = xmlTag(block, "link");
    const description = xmlTag(block, "description");
    const pubDate = xmlTag(block, "pubDate");
    let domain = "";

    try {
      domain = new URL(link).hostname.replace(/^www\./, "");
    } catch {}

    return {
      id: "bing-" + scope + "-" + index,
      title: title,
      description: description,
      date: pubDate,
      sourceName: domain || "Bing News",
      domain: domain,
      url: link || null,
      official: false,
      searchMode: "exact"
    };
  }).filter(function(item) {
    return item.title && withinLookback(item.date);
  });
}

async function gdelt(aliases) {
  const query = "(" + aliases.slice(0, 4).map(function(alias) {
    return '"' + alias + '"';
  }).join(" OR ") + ")";

  const params = new URLSearchParams({
    query: query,
    mode: "ArtList",
    maxrecords: "100",
    format: "json",
    sort: "DateDesc",
    timespan: "3months"
  });

  const response = await safeFetch(
    "https://api.gdeltproject.org/api/v2/doc/doc?" + params.toString(),
    { headers: { "User-Agent": "ClientRadar/6.0" } },
    7000
  );

  if (!response.ok) throw new Error("GDELT HTTP " + response.status);
  const payload = await response.json();

  return (Array.isArray(payload.articles) ? payload.articles : []).map(function(article, index) {
    return {
      id: "gd-" + index,
      title: clean(article.title),
      description: "",
      date: article.seendate || "",
      sourceName: article.domain || "GDELT",
      domain: article.domain || "",
      url: article.url || null,
      official: false,
      searchMode: "discovery"
    };
  }).filter(function(item) {
    return item.title && withinLookback(item.date);
  });
}

function candidateDomainSlugs(profile, aliases) {
  const values = aliases.slice();
  values.push(transliterate(compactName(profile.name)));

  const slugs = [];
  values.forEach(function(value) {
    const slug = String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (slug.length >= 3 && slug.length <= 30) slugs.push(slug);
    if (slug.startsWith("fos")) slugs.push("ph" + slug.slice(1));
  });

  return Array.from(new Set(slugs)).slice(0, 5);
}

function mentionsCompany(text, aliases) {
  const value = normalize(text);
  return aliases.some(function(alias) {
    const a = normalize(alias);
    return a.length >= 3 && value.includes(a);
  });
}

async function discoverOfficialSite(profile, aliases) {
  const slugs = candidateDomainSlugs(profile, aliases);
  const urls = [];

  slugs.forEach(function(slug) {
    urls.push("https://" + slug + ".ru");
    urls.push("https://" + slug + ".com");
  });

  const checks = await Promise.allSettled(urls.slice(0, 8).map(async function(url) {
    const response = await safeFetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 ClientRadar/6.0" },
      redirect: "follow"
    }, 2400);

    if (!response.ok) throw new Error("not ok");

    const html = await response.text();
    const sample = clean(html.slice(0, 220000));
    if (!mentionsCompany(sample, aliases)) throw new Error("wrong domain");

    return {
      origin: new URL(response.url || url).origin,
      html: html
    };
  }));

  for (const result of checks) {
    if (result.status === "fulfilled") return result.value;
  }

  return null;
}

function absoluteUrl(href, origin) {
  try {
    return new URL(href, origin).toString();
  } catch {
    return null;
  }
}

function parseRussianDate(text) {
  const value = clean(text);
  const months = {
    "января":0,"февраля":1,"марта":2,"апреля":3,"мая":4,"июня":5,
    "июля":6,"августа":7,"сентября":8,"октября":9,"ноября":10,"декабря":11
  };

  const ru = value.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(20\d{2})/i);
  if (ru) {
    return new Date(Date.UTC(
      Number(ru[3]),
      months[ru[2].toLowerCase()],
      Number(ru[1])
    )).toISOString();
  }

  const numeric = value.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})\b/);
  if (numeric) {
    return new Date(Date.UTC(
      Number(numeric[3]),
      Number(numeric[2]) - 1,
      Number(numeric[1])
    )).toISOString();
  }

  return null;
}

function listingLinks(html, origin) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = re.exec(html))) {
    const href = absoluteUrl(match[1], origin);
    const text = clean(match[2]).toLowerCase();
    if (!href) continue;

    let parsed;
    try {
      parsed = new URL(href);
    } catch {
      continue;
    }

    if (parsed.origin !== origin) continue;

    const path = parsed.pathname.toLowerCase();
    if (
      /(press|news|media|investor)/.test(path) ||
      /(новост|пресс|инвестор|press|news|media)/.test(text)
    ) {
      out.push(href);
    }
  }

  return Array.from(new Set(out)).slice(0, 5);
}

function articleLinks(html, origin) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = re.exec(html))) {
    const href = absoluteUrl(match[1], origin);
    const text = clean(match[2]);

    if (!href || text.length < 18 || text.length > 280) continue;

    let parsed;
    try {
      parsed = new URL(href);
    } catch {
      continue;
    }

    if (parsed.origin !== origin) continue;

    const path = parsed.pathname.toLowerCase();
    if (!/(press|news|media|investor|company|release|publication)/.test(path)) continue;

    const around = html.slice(
      Math.max(0, match.index - 420),
      Math.min(html.length, re.lastIndex + 420)
    );

    out.push({
      title: text,
      url: href,
      date: parseRussianDate(around)
    });
  }

  const seen = new Set();
  return out.filter(function(item) {
    const key = item.url.split("#")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80);
}

function articleQuality(item) {
  let score = 0;
  if (item.official) score += 100;
  if (item.url && !String(item.url).includes("news.google.com")) score += 20;
  if (clean(item.description).length >= 80) score += 10;
  if (item.searchMode === "exact") score += 5;
  return score;
}

function dedupe(items) {
  const byTitle = new Map();

  items.forEach(function(item) {
    const key = normalize(item.title);
    if (!key) return;

    const existing = byTitle.get(key);
    if (!existing || articleQuality(item) > articleQuality(existing)) {
      byTitle.set(key, item);
    }
  });

  return Array.from(byTitle.values());
}

async function officialNews(profile, aliases) {
  const site = await discoverOfficialSite(profile, aliases);
  if (!site) return { articles: [], domain: null };

  const pages = [{ url: site.origin, html: site.html }];
  const paths = [
    "/press/",
    "/press/company/",
    "/news/",
    "/media/news/",
    "/press-center/",
    "/investors/news/"
  ].map(function(path) {
    return site.origin + path;
  });

  const candidates = Array.from(new Set(
    listingLinks(site.html, site.origin).concat(paths)
  )).slice(0, 8);

  const fetched = await Promise.allSettled(candidates.map(async function(url) {
    const response = await safeFetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 ClientRadar/6.0" },
      redirect: "follow"
    }, 3000);

    if (!response.ok) throw new Error("listing unavailable");

    return {
      url: response.url || url,
      html: await response.text()
    };
  }));

  fetched.forEach(function(result) {
    if (result.status === "fulfilled") pages.push(result.value);
  });

  let articles = [];

  pages.forEach(function(page) {
    articleLinks(page.html, site.origin).forEach(function(item, index) {
      articles.push({
        id: "official-" + index + "-" + articles.length,
        title: item.title,
        description: "",
        date: item.date || new Date().toISOString(),
        sourceName: "Официальный сайт",
        domain: new URL(site.origin).hostname.replace(/^www\./, ""),
        url: item.url,
        official: true,
        searchMode: "official"
      });
    });
  });

  articles = dedupe(articles).filter(function(item) {
    return withinLookback(item.date);
  });

  return {
    articles: articles.slice(0, 50),
    domain: new URL(site.origin).hostname.replace(/^www\./, "")
  };
}

function relevanceScore(article, profile, aliases) {
  if (article.official) return 100;

  const title = normalize(article.title);
  const description = normalize(article.description);
  const text = title + " " + description;

  let score = 0;

  aliases.forEach(function(alias) {
    const value = normalize(alias);
    if (!value) return;

    if (title.includes(value)) score += 6;
    else if (text.includes(value)) score += 3;
  });

  if (profile.inn && text.includes(profile.inn)) score += 10;

  return score;
}

function tokenSet(value) {
  const stop = new Set([
    "компания","компании","россия","россии","сообщил","сообщила",
    "заявил","заявила","новый","новая","новые","будет","может",
    "после","для","что","как","при","это"
  ]);

  return new Set(
    normalize(value)
      .split(" ")
      .filter(function(token) {
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

function clusterArticles(articles) {
  const clusters = [];

  articles.forEach(function(article) {
    const analysis = classifyHeadline(
      article.title + " " + (article.description || "")
    );
    const category = analysis ? analysis.category : "Новости компании";

    const existing = clusters.find(function(cluster) {
      return cluster.category === category &&
        similarity(cluster.articles[0].title, article.title) >= 0.30;
    });

    if (existing) {
      existing.articles.push(article);
    } else {
      clusters.push({
        category: category,
        analysis: analysis,
        articles: [article]
      });
    }
  });

  return clusters;
}

function storyWeight(cluster) {
  const weights = {
    "Санкции / ограничения":100,
    "Налоги / регуляторика":98,
    "M&A / собственность":96,
    "CAPEX / инвестиции":94,
    "Долг / финансирование":92,
    "Кредитный профиль":91,
    "Финансовые результаты":90,
    "Контракты":88,
    "ВЭД":86,
    "Регулирование / господдержка":85,
    "Суды / споры":82,
    "Производство / продажи":80,
    "Логистика":78,
    "Менеджмент / управление":76,
    "Ликвидность":74,
    "Новости компании":50
  };

  return weights[cluster.category] || 50;
}

function buildStory(cluster, index) {
  const articles = cluster.articles.slice().sort(function(a, b) {
    const aa = parseDate(a.date);
    const bb = parseDate(b.date);
    return (bb ? bb.getTime() : 0) - (aa ? aa.getTime() : 0);
  });

  const representative = articles[0];
  const sources = [];
  const sourceSet = new Set();

  articles.forEach(function(article) {
    const key = (article.domain || article.sourceName || "").toLowerCase();
    if (!key || sourceSet.has(key)) return;

    sourceSet.add(key);
    sources.push({
      name: article.sourceName,
      domain: article.domain,
      url: article.url,
      official: article.official
    });
  });

  const analysis = cluster.analysis;
  const stage = detectFactStage(
    articles.map(function(article) {
      return article.title + " " + (article.description || "");
    }).join(" ")
  );

  return {
    id: "story-" + index,
    category: cluster.category,
    headline: representative.title,
    summary: clean(representative.description) || representative.title,
    date: (parseDate(representative.date) || new Date()).toISOString(),
    sourceCount: sources.length,
    sources: sources,
    factStage: stage.label,
    factStageKey: stage.key,
    impact: analysis
      ? analysis.impact
      : "Свежий сюжет о компании. Откройте источник, чтобы оценить его коммерческую значимость.",
    products: analysis ? analysis.products : [],
    isSignal: Boolean(analysis),
    weight: storyWeight(cluster) + Math.min(15, sources.length * 4)
  };
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
    if (match) {
      const value = clean(match[1]);
      if (value.length >= 45) return value;
    }
  }

  return "";
}

function shorten(value, maxLength) {
  let text = clean(value);
  if (text.length <= maxLength) return text;
  text = text.slice(0, maxLength - 1).replace(/\s+\S*$/, "");
  return text + "…";
}

async function enrichStory(story) {
  const direct = story.sources.find(function(source) {
    return source.url && !String(source.url).includes("news.google.com");
  });

  if (!direct) {
    story.summary = shorten(story.summary, 360);
    return story;
  }

  try {
    const response = await safeFetch(direct.url, {
      headers: { "User-Agent": "Mozilla/5.0 ClientRadar/6.0" },
      redirect: "follow"
    }, 3200);

    if (!response.ok) {
      story.summary = shorten(story.summary, 360);
      return story;
    }

    const html = await response.text();
    const description = extractMetaDescription(html);
    story.summary = shorten(description || story.summary, 360);
  } catch {
    story.summary = shorten(story.summary, 360);
  }

  return story;
}


function eventQueries(primary) {
  const name = '"' + primary + '"';
  return [
    name + " (облигации OR кредит OR рейтинг OR рефинансирование OR дивиденды OR прибыль OR EBITDA)",
    name + " (инвестиции OR строительство OR модернизация OR производство OR продажи OR экспорт OR импорт)",
    name + " (контракт OR тендер OR сделка OR акционер OR директор OR санкции OR налог OR суд)"
  ];
}

function likelyOfficialDomains(profile, aliases) {
  const slugs = candidateDomainSlugs(profile, aliases);
  const out = [];
  slugs.slice(0, 3).forEach(function(slug) {
    out.push(slug + ".ru");
    out.push(slug + ".com");
  });
  return Array.from(new Set(out)).slice(0, 4);
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
    const aliases = aliasesFor(profile);
    const primary = aliases[0] || compactName(profile.name);
    const latin = aliases.find(function(alias) {
      return /^[a-z0-9 .&-]+$/i.test(alias);
    });

    const searchJobs = [
      googleNews('"' + primary + '"', "ru", "ru-exact", "exact"),
      googleNews(primary, "ru", "ru-broad", "broad"),
      bingNews('"' + primary + '"', "exact"),
      gdelt(aliases)
    ];

    eventQueries(primary).forEach(function(query, index) {
      searchJobs.push(googleNews(query, "ru", "ru-event-" + index, "exact"));
    });

    likelyOfficialDomains(profile, aliases).slice(0, 2).forEach(function(domain, index) {
      searchJobs.push(
        googleNews('"' + primary + '" site:' + domain, "ru", "ru-site-" + index, "exact")
      );
    });

    if (latin) {
      searchJobs.push(googleNews('"' + latin + '"', "en", "en-exact", "exact"));
      searchJobs.push(bingNews('"' + latin + '"', "en-exact"));
    }

    const results = await Promise.all([
      officialNews(profile, aliases).catch(function() {
        return { articles: [], domain: null };
      }),
      Promise.allSettled(searchJobs)
    ]);

    const official = results[0];
    const searchResults = results[1];

    let raw = official.articles.slice();

    searchResults.forEach(function(result) {
      if (result.status === "fulfilled") {
        raw = raw.concat(result.value);
      }
    });

    const collected = dedupe(raw);

    const relevant = collected.filter(function(article) {
      if (article.official) return true;
      if (article.searchMode === "exact") return true;
      return relevanceScore(article, profile, aliases) >= 1;
    });

    let stories = clusterArticles(relevant)
      .map(buildStory)
      .sort(function(a, b) {
        if (b.weight !== a.weight) return b.weight - a.weight;
        return new Date(b.date) - new Date(a.date);
      })
      .slice(0, 10);

    stories = await Promise.all(stories.map(enrichStory));

    return NextResponse.json({
      company: profile,
      stories: stories,
      stats: {
        articlesCollected: collected.length,
        relevantArticles: relevant.length,
        storiesFound: stories.length,
        sourcesFound: new Set(relevant.map(function(article) {
          return article.domain || article.sourceName;
        }).filter(Boolean)).size
      },
      officialDomain: official.domain,
      lookbackDays: LOOKBACK_DAYS,
      fetchedAt: new Date().toISOString(),
      methodology:
        "Собираем точные и тематические запросы по установленной компании из нескольких новостных каналов, добавляем официальный сайт, если он найден, склеиваем дубли и показываем до 10 главных сюжетов с короткой выжимкой."
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
