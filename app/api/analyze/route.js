import { NextResponse } from "next/server";
import { classifySignal } from "../../../lib/classify";
import { buildDemoEvents, findDemoCompany } from "../../../lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value) {
  return String(value || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(value) {
  return clean(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function safeFetch(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 8000);
  try {
    return await fetch(url, { ...(options || {}), signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveWithDadata(query) {
  const token = process.env.DADATA_TOKEN;
  if (!token) return null;

  const numeric = /^\d{8,15}$/.test(query.trim());
  const endpoint = numeric
    ? "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party"
    : "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party";

  const response = await safeFetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Token " + token,
    },
    body: JSON.stringify({ query, count: 5 }),
  }, 7000);

  if (!response.ok) return null;
  const data = await response.json();
  const first = data.suggestions && data.suggestions[0];
  if (!first) return null;

  const d = first.data || {};
  return {
    name: (d.name && (d.name.short_with_opf || d.name.full_with_opf)) || first.value || query,
    inn: d.inn || null,
    ogrn: d.ogrn || null,
    region: d.address && d.address.data ? (d.address.data.region_with_type || d.address.data.region) : null,
    activity: d.okved || null,
    status: d.state ? d.state.status : null,
  };
}

function tag(block, name) {
  const re = new RegExp("<" + name + "[^>]*>([\\s\\S]*?)<\\/" + name + ">", "i");
  const match = block.match(re);
  return match ? decodeXml(match[1]) : "";
}

async function fetchGoogleNews(companyName) {
  const url = "https://news.google.com/rss/search?q=" + encodeURIComponent('"' + companyName + '"') + "&hl=ru&gl=RU&ceid=RU:ru";
  const response = await safeFetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ClientRadar/1.0" },
  }, 8000);
  if (!response.ok) throw new Error("Google News HTTP " + response.status);
  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return blocks.slice(0, 35).map((block, index) => {
    const title = tag(block, "title");
    const link = tag(block, "link");
    const pubDate = tag(block, "pubDate");
    const source = tag(block, "source");
    return {
      id: "gn-" + index + "-" + Buffer.from(title).toString("base64url").slice(0, 10),
      title,
      date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      sourceName: source || "Google News",
      url: link || null,
      isDemo: false,
    };
  }).filter((item) => item.title);
}

async function fetchGdelt(companyName) {
  const params = new URLSearchParams({
    query: '"' + companyName + '"',
    mode: "ArtList",
    maxrecords: "50",
    format: "json",
    sort: "DateDesc",
  });
  const url = "https://api.gdeltproject.org/api/v2/doc/doc?" + params.toString();
  const response = await safeFetch(url, {
    headers: { "User-Agent": "ClientRadar/1.0" },
  }, 8000);
  if (!response.ok) throw new Error("GDELT HTTP " + response.status);
  const payload = await response.json();
  const articles = Array.isArray(payload.articles) ? payload.articles : [];

  return articles.map((article, index) => ({
    id: "gd-" + index + "-" + Buffer.from(String(article.url || article.title || index)).toString("base64url").slice(0, 10),
    title: clean(article.title),
    date: article.seendate ? new Date(article.seendate).toISOString() : new Date().toISOString(),
    sourceName: article.domain || "GDELT",
    url: article.url || null,
    isDemo: false,
  })).filter((item) => item.title);
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 140);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function enrich(item) {
  const analysis = classifySignal(item.title);
  return {
    ...item,
    ...analysis,
    summary: item.isDemo
      ? "Это демонстрационный сигнал для проверки интерфейса и логики продукта."
      : "Публичное сообщение, найденное в открытом новостном источнике. Перед контактом с клиентом стоит открыть первоисточник и проверить контекст.",
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const query = String(body.query || "").trim();
    if (!query) {
      return NextResponse.json({ error: "Введите название компании или ИНН." }, { status: 400 });
    }

    const demo = findDemoCompany(query);
    let company = demo ? demo.company : null;
    let dadataUsed = false;

    try {
      const resolved = await resolveWithDadata(query);
      if (resolved) {
        company = resolved;
        dadataUsed = true;
      }
    } catch {
      dadataUsed = false;
    }

    if (!company) {
      company = {
        name: query,
        inn: /^\d{8,15}$/.test(query) ? query : null,
        region: null,
        activity: null,
      };
    }

    const searchName = company.name && !/^\d+$/.test(company.name) ? company.name : query;
    const sourceStatus = { googleNews: false, gdelt: false };
    let liveItems = [];

    const settled = await Promise.allSettled([
      fetchGoogleNews(searchName),
      fetchGdelt(searchName),
    ]);

    if (settled[0].status === "fulfilled") {
      sourceStatus.googleNews = true;
      liveItems.push(...settled[0].value);
    }
    if (settled[1].status === "fulfilled") {
      sourceStatus.gdelt = true;
      liveItems.push(...settled[1].value);
    }

    liveItems = dedupe(liveItems)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 24);

    let mode = "live";
    let events = liveItems;

    if (!events.length && demo) {
      mode = "demo";
      events = buildDemoEvents(demo);
    }

    events = events.map(enrich);

    return NextResponse.json({
      company,
      events,
      mode,
      dadataUsed,
      fetchedAt: new Date().toISOString(),
      sourceStatus,
      notice: !dadataUsed && /^\d{8,15}$/.test(query)
        ? "Точный поиск по ИНН станет доступен после добавления DADATA_TOKEN. Сейчас используется доступный fallback."
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Не удалось выполнить анализ. Попробуйте еще раз." }, { status: 500 });
  }
}
