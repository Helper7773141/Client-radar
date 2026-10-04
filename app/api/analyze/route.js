import { NextResponse } from "next/server";
import { classifyHeadline, detectFactStage } from "../../../lib/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const LOOKBACK_DAYS = 90;

function validCompanyInn(inn) {
  if (!/^\d{10}$/.test(inn)) return false;
  const digits = inn.split("").map(Number);
  const weights = [2,4,10,3,5,9,4,6,8];
  const checksum = (weights.reduce(function(sum, w, i) {
    return sum + w * digits[i];
  }, 0) % 11) % 10;
  return checksum === digits[9];
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

function compactName(name) {
  return String(name || "")
    .replace(/\b(ПАО|АО|ООО|ОАО|ЗАО|НАО)\b/gi, "")
    .replace(/[«»"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function importantTokens(name) {
  const stop = new Set([
    "пао","ао","ооо","оао","зао","нао","публичное","акционерное",
    "общество","компания","группа","холдинг"
  ]);
  return compactName(name)
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/i)
    .filter(function(token) {
      return token.length >= 3 && !stop.has(token);
    })
    .slice(0, 6);
}

function parseDate(value) {
  const parsed = new Date(String(value || ""));
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

  if (!response.ok) {
    throw new Error("Не удалось определить компанию по ИНН.");
  }

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
    address: d.address && d.address.value ? d.address.value : null,
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

async function googleNews(query, scope) {
  const boundedQuery = query + " when:" + LOOKBACK_DAYS + "d";
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(boundedQuery) +
    "&hl=ru&gl=RU&ceid=RU:ru";

  const response = await safeFetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 ClientRadar/3.0"
    }
  }, 6500);

  if (!response.ok) {
    throw new Error("Google News временно недоступен.");
  }

  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return blocks.slice(0, 80).map(function(block, index) {
    const source = xmlSource(block);
    const rawTitle = xmlTag(block, "title");
    const title = stripSourceSuffix(rawTitle, source.name);
    const pubDate = xmlTag(block, "pubDate");

    return {
      id: "gn-" + scope + "-" + index,
      title: title,
      description: xmlTag(block, "description"),
      date: pubDate,
      sourceName: source.name,
      domain: source.domain,
      url: xmlTag(block, "link") || null,
      scope: scope
    };
  }).filter(function(item) {
    return item.title && withinLookback(item.date);
  });
}

function newsQueries(profile) {
  const exact = compactName(profile.name);
  const full = compactName(profile.fullName);
  const queries = [];

  if (exact) queries.push('"' + exact + '"');
  if (full && full.toLowerCase() !== exact.toLowerCase()) {
    queries.push('"' + full + '"');
  }

  const tokens = importantTokens(profile.name);
  if (tokens.length >= 2) {
    queries.push(tokens.slice(0, 3).map(function(token) {
      return '"' + token + '"';
    }).join(" "));
  }

  return Array.from(new Set(queries)).slice(0, 3);
}

function relevantToCompany(item, profile) {
  const text = (
    String(item.title || "") + " " +
    String(item.description || "")
  ).toLowerCase();

  const exact = compactName(profile.name).toLowerCase();
  if (exact && text.includes(exact)) return true;

  const tokens = importantTokens(profile.name);
  if (!tokens.length) return true;

  const matches = tokens.filter(function(token) {
    return text.includes(token);
  }).length;

  if (tokens.length === 1) return matches === 1;
  return matches >= Math.min(2, tokens.length);
}

function normalizedTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(items) {
  const seen = new Set();

  return items.filter(function(item) {
    const key = normalizedTitle(item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildEvent(article, index) {
  const analysis = classifyHeadline(
    article.title + " " + (article.description || "")
  );
  const stage = detectFactStage(
    article.title + " " + (article.description || "")
  );

  return {
    id: "event-" + index,
    title: analysis ? analysis.shortTitle : article.title,
    headline: article.title,
    category: analysis ? analysis.category : "Новости компании",
    factStage: stage.label,
    factStageKey: stage.key,
    latestDate: new Date(article.date).toISOString(),
    sourceName: article.sourceName,
    domain: article.domain,
    url: article.url,
    impact: analysis
      ? analysis.impact
      : "Свежая публикация о компании. Откройте источник, чтобы понять контекст и решить, есть ли повод для контакта.",
    products: analysis ? analysis.products : [],
    isSignal: Boolean(analysis)
  };
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
    const queries = newsQueries(profile);

    const settled = await Promise.allSettled(
      queries.map(function(query, index) {
        return googleNews(query, "q" + index);
      })
    );

    let articles = [];
    settled.forEach(function(result) {
      if (result.status === "fulfilled") {
        articles = articles.concat(result.value);
      }
    });

    articles = dedupe(articles)
      .filter(function(item) {
        return relevantToCompany(item, profile);
      })
      .sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
      })
      .slice(0, 40);

    const events = articles.map(buildEvent);
    const sources = Array.from(new Set(
      events.map(function(event) {
        return event.sourceName;
      }).filter(Boolean)
    ));

    return NextResponse.json({
      company: profile,
      events: events,
      stats: {
        publicationsFound: events.length,
        sourcesFound: sources.length,
        signalsFound: events.filter(function(event) {
          return event.isSignal;
        }).length
      },
      fetchedAt: new Date().toISOString(),
      lookbackDays: LOOKBACK_DAYS,
      methodology:
        "Сначала показываем свежие новости Google News по точно определенному юрлицу. Категория и банковский смысл добавляются поверх новости и не могут скрыть саму публикацию."
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
