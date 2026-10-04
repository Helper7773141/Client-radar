import { NextResponse } from "next/server";
import {
  TRUSTED_SOURCES,
  classifyHeadline,
  clusterArticles,
  companyRelevanceScore,
  coreCompanyTokens,
  sectorKeywords,
  sourceInfo
} from "../../../lib/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validCompanyInn(inn) {
  if (!/^\d{10}$/.test(inn)) return false;
  const digits = inn.split("").map(Number);
  const weights = [2,4,10,3,5,9,4,6,8];
  const checksum = (weights.reduce(function(sum, w, i) { return sum + w * digits[i]; }, 0) % 11) % 10;
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

async function safeFetch(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, timeoutMs || 9000);
  try {
    return await fetch(url, Object.assign({}, options || {}, { signal: controller.signal, cache: "no-store" }));
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCompany(inn) {
  const token = process.env.DADATA_TOKEN;
  if (!token) {
    const error = new Error("Для реального поиска по ИНН нужно один раз добавить бесплатный DADATA_TOKEN в Vercel.");
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
      body: JSON.stringify({ query: inn, type: "LEGAL", branch_type: "MAIN", count: 10 })
    },
    8000
  );

  if (!response.ok) throw new Error("Сервис идентификации компании временно недоступен.");
  const payload = await response.json();
  const suggestion = (payload.suggestions || []).find(function(item) {
    return item.data && item.data.inn === inn && item.data.branch_type !== "BRANCH";
  }) || (payload.suggestions || [])[0];

  if (!suggestion || !suggestion.data) {
    const error = new Error("Юридическое лицо с таким ИНН не найдено.");
    error.code = "NOT_FOUND";
    throw error;
  }

  const d = suggestion.data;
  const founders = Array.isArray(d.founders) ? d.founders.map(function(f) {
    return {
      name: f.name || (f.fio && [f.fio.surname, f.fio.name, f.fio.patronymic].filter(Boolean).join(" ")) || null,
      inn: f.inn || null,
      ogrn: f.ogrn || null,
      type: f.type || null,
      share: f.share || null
    };
  }).filter(function(x) { return x.name; }) : [];

  return {
    inn: d.inn,
    kpp: d.kpp || null,
    ogrn: d.ogrn || null,
    name: (d.name && (d.name.short_with_opf || d.name.full_with_opf)) || suggestion.value,
    fullName: (d.name && d.name.full_with_opf) || suggestion.unrestricted_value || suggestion.value,
    status: d.state && d.state.status ? d.state.status : null,
    okved: d.okved || null,
    address: d.address && d.address.value ? d.address.value : null,
    management: d.management ? { name: d.management.name || null, post: d.management.post || null } : null,
    founders: founders
  };
}

function sourceTag(block) {
  const match = block.match(/<source([^>]*)>([\s\S]*?)<\/source>/i);
  if (!match) return { name: "Google News", domain: "" };
  const name = clean(match[2]);
  const urlMatch = match[1].match(/url=["']([^"']+)["']/i);
  let domain = "";
  if (urlMatch) {
    try { domain = new URL(urlMatch[1]).hostname.replace(/^www\./, ""); } catch {}
  }
  return { name: name || domain || "Источник", domain: domain };
}

function xmlTag(block, name) {
  const re = new RegExp("<" + name + "[^>]*>([\\s\\S]*?)<\\/" + name + ">", "i");
  const match = block.match(re);
  return match ? clean(match[1]) : "";
}

async function googleNews(query, scope) {
  const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(query) + "&hl=ru&gl=RU&ceid=RU:ru";
  const response = await safeFetch(url, { headers: { "User-Agent": "Mozilla/5.0 ClientRadar/2.0" } }, 9000);
  if (!response.ok) throw new Error("Google News HTTP " + response.status);
  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return blocks.slice(0, 60).map(function(block, index) {
    const source = sourceTag(block);
    const pubDate = xmlTag(block, "pubDate");
    return {
      id: "gn-" + scope + "-" + index,
      title: xmlTag(block, "title"),
      description: xmlTag(block, "description"),
      date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      sourceName: source.name,
      domain: source.domain,
      url: xmlTag(block, "link") || null,
      scope: scope
    };
  }).filter(function(x) { return x.title; });
}

function parseExternalDate(value) {
  const raw = String(value || "");
  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    const iso = raw.slice(0,4) + "-" + raw.slice(4,6) + "-" + raw.slice(6,8) + "T" + raw.slice(9,11) + ":" + raw.slice(11,13) + ":" + raw.slice(13,15) + "Z";
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function gdelt(query, scope) {
  const params = new URLSearchParams({
    query: query,
    mode: "ArtList",
    maxrecords: "75",
    format: "json",
    sort: "DateDesc",
    timespan: "3months"
  });
  const response = await safeFetch("https://api.gdeltproject.org/api/v2/doc/doc?" + params.toString(), { headers: { "User-Agent": "ClientRadar/2.0" } }, 10000);
  if (!response.ok) throw new Error("GDELT HTTP " + response.status);
  const payload = await response.json();
  const articles = Array.isArray(payload.articles) ? payload.articles : [];
  return articles.map(function(a, index) {
    return {
      id: "gd-" + scope + "-" + index,
      title: clean(a.title),
      description: "",
      date: parseExternalDate(a.seendate),
      sourceName: a.domain || "GDELT",
      domain: a.domain || "",
      url: a.url || null,
      scope: scope
    };
  }).filter(function(x) { return x.title; });
}

function dedupeArticles(items) {
  const seen = new Set();
  return items.filter(function(item) {
    const normalized = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 170);
    const domain = sourceInfo(item.domain || item.url || "").domain;
    const key = normalized + "|" + domain;
    if (!normalized || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function trustedOnly(item) {
  return sourceInfo(item.domain || item.url || "").tier >= 2;
}

function compactName(name) {
  return String(name || "")
    .replace(/\b(ПАО|АО|ООО|ОАО|ЗАО)\b/gi, "")
    .replace(/[«»"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCompanyQuery(profile) {
  const name = compactName(profile.name);
  const tokens = coreCompanyTokens(profile.name);
  if (name.length >= 4) return '"' + name + '"';
  return tokens.map(function(t) { return '"' + t + '"'; }).join(" OR ");
}

function domainGroups() {
  const domains = TRUSTED_SOURCES.map(function(x) { return x.domain; });
  const groups = [];
  for (let i = 0; i < domains.length; i += 5) groups.push(domains.slice(i, i + 5));
  return groups;
}

function siteQuery(base, domains) {
  return "(" + base + ") (" + domains.map(function(d) { return "site:" + d; }).join(" OR ") + ")";
}

function buildSectorQuery(profile) {
  const keywords = sectorKeywords(profile.okved, profile.name);
  if (!keywords.length) return null;
  const sector = "(" + keywords.map(function(k) { return '"' + k + '"'; }).join(" OR ") + ")";
  const events = "(налог OR НДПИ OR пошлина OR санкции OR экспорт OR импорт OR субсидии OR тарифы OR регулирование)";
  return sector + " " + events;
}

function profileRelations(profile) {
  const relations = [];
  if (profile.management && profile.management.name) {
    relations.push({ type: "Руководитель", name: profile.management.name, detail: profile.management.post || "" });
  }
  (profile.founders || []).slice(0, 8).forEach(function(f) {
    relations.push({ type: "Учредитель", name: f.name, detail: f.inn ? "ИНН " + f.inn : "" });
  });
  return relations;
}

function filterCompanyItems(items, profile) {
  return items.filter(function(item) {
    if (!trustedOnly(item)) return false;
    if (item.scope === "sector") {
      const info = sourceInfo(item.domain || item.url || "");
      return info.tier >= 2 && !!classifyHeadline(item.title);
    }
    return companyRelevanceScore(item, profile) >= 2 && !!classifyHeadline(item.title);
  });
}

function filterSectorClusters(events) {
  return events.filter(function(event) {
    const hasOfficial = event.sources.some(function(s) { return s.tier >= 3; });
    const trustedCount = event.sources.filter(function(s) { return s.tier >= 2; }).length;
    return hasOfficial || trustedCount >= 2 || event.status === "Подтверждено";
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const inn = String(body.inn || "").replace(/\D/g, "");

    if (!validCompanyInn(inn)) {
      return NextResponse.json({ error: "Введите корректный 10-значный ИНН юридического лица.", code: "INVALID_INN" }, { status: 400 });
    }

    const profile = await resolveCompany(inn);
    const baseQuery = buildCompanyQuery(profile);
    const groups = domainGroups();
    const sectorQuery = buildSectorQuery(profile);

    const jobs = [
      googleNews(baseQuery, "company"),
      gdelt(baseQuery, "company")
    ];

    groups.forEach(function(group) {
      jobs.push(googleNews(siteQuery(baseQuery, group), "company"));
    });

    if (sectorQuery) {
      jobs.push(googleNews(sectorQuery, "sector"));
      jobs.push(gdelt(sectorQuery, "sector"));
    }

    const settled = await Promise.allSettled(jobs);
    let articles = [];
    settled.forEach(function(result) {
      if (result.status === "fulfilled") articles = articles.concat(result.value);
    });

    articles = dedupeArticles(articles);
    const relevant = filterCompanyItems(articles, profile);
    const companyArticles = relevant.filter(function(x) { return x.scope === "company"; });
    const sectorArticles = relevant.filter(function(x) { return x.scope === "sector"; });

    let events = clusterArticles(companyArticles);
    const sectorEvents = filterSectorClusters(clusterArticles(sectorArticles));

    const existingKeys = new Set(events.map(function(e) { return e.category + "|" + e.title; }));
    sectorEvents.forEach(function(e) {
      const key = e.category + "|" + e.title;
      if (!existingKeys.has(key)) {
        e.scope = "Отраслевое событие";
        events.push(e);
      }
    });

    events = events.sort(function(a,b) {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return new Date(b.latestDate) - new Date(a.latestDate);
    }).slice(0, 20);

    const matchedDomains = new Set();
    relevant.forEach(function(item) {
      const info = sourceInfo(item.domain || item.url || "");
      if (info.tier >= 2) matchedDomains.add(info.domain);
    });

    return NextResponse.json({
      company: profile,
      relations: profileRelations(profile),
      events: events,
      stats: {
        sourcesInContour: TRUSTED_SOURCES.length,
        sourcesWithMatches: matchedDomains.size,
        publicationsReviewed: articles.length,
        relevantPublications: relevant.length,
        eventsFound: events.length
      },
      sources: TRUSTED_SOURCES,
      fetchedAt: new Date().toISOString(),
      methodology: "Событие считается подтвержденным, если найден официальный/реестровый источник или независимые подтверждения минимум из двух доверенных источников."
    });
  } catch (error) {
    const code = error && error.code ? error.code : "ANALYSIS_ERROR";
    const status = code === "CONFIG_REQUIRED" ? 503 : code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: error.message || "Не удалось выполнить анализ.", code: code }, { status: status });
  }
}
