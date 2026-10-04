import { NextResponse } from "next/server";
import { classifyHeadline, detectFactStage } from "../../../lib/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

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
  const aliases = [];
  const shortName = compactName(profile.name);
  const fullName = compactName(profile.fullName);
  const latin = compactName(profile.latinName);

  [shortName, fullName, latin].forEach(function(value) {
    if (value && value.length >= 3) aliases.push(value);
  });

  const translit = transliterate(shortName);
  if (translit && translit.length >= 3) {
    aliases.push(translit);
    if (translit.startsWith("fos")) {
      aliases.push("ph" + translit.slice(1));
    }
  }

  return Array.from(new Set(aliases.map(function(x) {
    return x.trim();
  }).filter(Boolean))).slice(0, 5);
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
  const date = parseDate(value);
  if (!date) return false;
  const earliest = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  return date.getTime() >= earliest && date.getTime() <= Date.now() + 24 * 60 * 60 * 1000;
}

async function safeFetch(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, timeoutMs || 7000);
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
    latinName: d.name && d.name.latin ? d.name.latin : null,
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
    try { domain = new URL(urlMatch[1]).hostname.replace(/^www\./, ""); } catch {}
  }
  return { name: name, domain: domain };
}

function stripSourceSuffix(title, sourceName) {
  const value = clean(title);
  const source = clean(sourceName);
  if (!source) return value;
  const suffix = " - " + source;
  return value.toLowerCase().endsWith(suffix.toLowerCase())
    ? value.slice(0, -suffix.length).trim()
    : value;
}

async function googleNews(query, locale, scope) {
  const localeParams = locale === "en"
    ? "&hl=en-US&gl=US&ceid=US:en"
    : "&hl=ru&gl=RU&ceid=RU:ru";
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query + " when:" + LOOKBACK_DAYS + "d") +
    localeParams;

  const response = await safeFetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ClientRadar/4.0" }
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
      channel: "Google News"
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
    { headers: { "User-Agent": "ClientRadar/4.0" } },
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
      channel: "GDELT"
    };
  }).filter(function(item) {
    return item.title && withinLookback(item.date);
  });
}

function normalized(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  const stop = new Set([
    "компания","компании","россия","россии","сообщил","сообщила","заявил","заявила",
    "новый","новая","новые","будет","может","после","для","что","как","при","это"
  ]);
  return new Set(normalized(value).split(" ").filter(function(token) {
    return token.length >= 4 && !stop.has(token);
  }));
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

function relevanceScore(article, profile, aliases) {
  const title = normalized(article.title);
  const description = normalized(article.description);
  const text = title + " " + description;
  let score = 0;

  aliases.forEach(function(alias) {
    const a = normalized(alias);
    if (!a) return;
    if (title.includes(a)) score += 6;
    else if (text.includes(a)) score += 3;
  });

  if (profile.inn && text.includes(profile.inn)) score += 10;

  if (profile.management && profile.management.name) {
    const surname = normalized(profile.management.name).split(" ")[0];
    if (surname && surname.length >= 4 && text.includes(surname)) score += 2;
  }

  return score;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];

  items.forEach(function(item) {
    const key = normalized(item.title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });

  return out;
}

const CATEGORY_WEIGHT = {
  "Санкции / ограничения": 100,
  "Налоги / регуляторика": 96,
  "M&A / собственность": 94,
  "CAPEX / инвестиции": 92,
  "Долг / финансирование": 90,
  "Кредитный профиль": 89,
  "Финансовые результаты": 88,
  "Контракты": 85,
  "ВЭД": 84,
  "Регулирование / господдержка": 83,
  "Суды / споры": 80,
  "Производство / продажи": 78,
  "Логистика": 75,
  "Менеджмент / управление": 72,
  "Ликвидность": 70,
  "Новости компании": 45
};

function recencyScore(value) {
  const date = parseDate(value);
  if (!date) return 0;
  const age = Math.max(0, Date.now() - date.getTime());
  const days = age / (24 * 60 * 60 * 1000);
  return Math.max(0, 20 - Math.floor(days / 5));
}

function clusterArticles(articles) {
  const clusters = [];

  articles.forEach(function(article) {
    const analysis = classifyHeadline(article.title + " " + (article.description || ""));
    const category = analysis ? analysis.category : "Новости компании";

    const existing = clusters.find(function(cluster) {
      return cluster.category === category &&
        similarity(cluster.articles[0].title, article.title) >= 0.34;
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

function buildStory(cluster, index) {
  const articles = cluster.articles.slice().sort(function(a,b) {
    return (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0);
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
      url: article.url
    });
  });

  const analysis = cluster.analysis;
  const stage = detectFactStage(articles.map(function(a) {
    return a.title + " " + (a.description || "");
  }).join(" "));
  const categoryWeight = CATEGORY_WEIGHT[cluster.category] || 45;
  const sourceBonus = Math.min(15, Math.max(0, sources.length - 1) * 5);
  const importance = Math.min(
    100,
    categoryWeight + sourceBonus + recencyScore(representative.date)
  );

  return {
    id: "story-" + index,
    category: cluster.category,
    headline: representative.title,
    summary: representative.title,
    date: parseDate(representative.date)?.toISOString() || new Date().toISOString(),
    sourceCount: sources.length,
    sources: sources,
    factStage: stage.label,
    factStageKey: stage.key,
    impact: analysis
      ? analysis.impact
      : "Свежий сюжет о компании. Рекомендуется открыть первоисточник и оценить, создает ли он повод для контакта.",
    products: analysis ? analysis.products : [],
    importance: importance,
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
    const aliases = aliasesFor(profile);
    const primary = aliases[0] || compactName(profile.name);
    const latin = aliases.find(function(alias) {
      return /^[a-z0-9 .&-]+$/i.test(alias);
    });

    const jobs = [
      googleNews('"' + primary + '"', "ru", "ru-exact"),
      googleNews(primary, "ru", "ru-broad"),
      gdelt(aliases)
    ];

    if (latin) {
      jobs.push(googleNews(latin, "en", "en-broad"));
    }

    const settled = await Promise.allSettled(jobs);
    let rawArticles = [];

    settled.forEach(function(result) {
      if (result.status === "fulfilled") {
        rawArticles = rawArticles.concat(result.value);
      }
    });

    const collected = dedupe(rawArticles);
    const relevant = collected.filter(function(article) {
      return relevanceScore(article, profile, aliases) >= 3;
    });

    const stories = clusterArticles(relevant)
      .map(buildStory)
      .sort(function(a,b) {
        if (b.importance !== a.importance) return b.importance - a.importance;
        return new Date(b.date) - new Date(a.date);
      });

    const important = stories.filter(function(story) {
      return story.isSignal || story.importance >= 65;
    }).slice(0, 10);

    const fallback = stories.slice(0, 10);
    const finalStories = important.length >= 4 ? important : fallback;

    return NextResponse.json({
      company: profile,
      stories: finalStories,
      stats: {
        articlesCollected: collected.length,
        relevantArticles: relevant.length,
        storiesFound: stories.length,
        importantStories: finalStories.length,
        sourcesFound: new Set(relevant.map(function(a) {
          return a.domain || a.sourceName;
        }).filter(Boolean)).size
      },
      aliases: aliases,
      lookbackDays: LOOKBACK_DAYS,
      fetchedAt: new Date().toISOString(),
      methodology:
        "Собираем публикации Google News на русском и английском плюс GDELT, объединяем дубли в сюжеты и показываем до 10 самых значимых по типу события, свежести и числу независимых источников."
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
