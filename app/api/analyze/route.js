import { NextResponse } from "next/server";
import { classifyHeadline, sectorKeywords } from "../../../lib/intelligence";
import { buildStrategicAnalysis } from "../../../lib/strategic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

function withinLookback(value, lookbackDays) {
  const d = parseDate(value);
  if (!d) return false;
  const days = Number(lookbackDays) > 0 ? Number(lookbackDays) : LOOKBACK_DAYS;
  const min = Date.now() - days * 24 * 60 * 60 * 1000;
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
        let share = null;
        if (founder.share) {
          if (founder.share.type === "PERCENT" && founder.share.value != null) {
            share = String(founder.share.value) + "%";
          } else if (
            founder.share.type === "FRACTION" &&
            founder.share.numerator != null &&
            founder.share.denominator != null
          ) {
            share = founder.share.numerator + "/" + founder.share.denominator;
          } else if (founder.share.value != null) {
            share = String(founder.share.value);
          }
        }

        return {
          name:
            founder.name ||
            (founder.fio
              ? [founder.fio.surname, founder.fio.name, founder.fio.patronymic].filter(Boolean).join(" ")
              : null),
          inn: founder.inn || null,
          ogrn: founder.ogrn || null,
          type: founder.type || null,
          share: share
        };
      }).filter(function(x) { return x.name; }).slice(0, 8)
    : [];

  const managers = Array.isArray(d.managers)
    ? d.managers.map(function(manager) {
        return {
          name:
            manager.name ||
            (manager.fio
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


async function findAffiliated(inn, scope, count) {
  const token = process.env.DADATA_TOKEN;
  if (!token || !inn) return [];

  const response = await safeFetch(
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findAffiliated/party",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Token " + token
      },
      body: JSON.stringify({
        query: inn,
        scope: scope,
        count: count || 20
      })
    },
    6000
  );

  if (!response.ok) throw new Error("DaData affiliated HTTP " + response.status);
  const payload = await response.json();
  return Array.isArray(payload.suggestions) ? payload.suggestions : [];
}

function affiliateFromSuggestion(item, parentInn) {
  const d = item && item.data ? item.data : {};
  const founder = (d.founders || []).find(function(f) {
    return f.inn === parentInn;
  });

  let share = null;
  if (founder && founder.share) {
    if (founder.share.type === "PERCENT" && founder.share.value != null) {
      share = String(founder.share.value) + "%";
    } else if (
      founder.share.type === "FRACTION" &&
      founder.share.numerator != null &&
      founder.share.denominator != null
    ) {
      share = founder.share.numerator + "/" + founder.share.denominator;
    }
  }

  const managerLink = !founder && (d.managers || []).some(function(m) {
    return m.inn === parentInn;
  });

  return {
    inn: d.inn || null,
    name:
      (d.name && (d.name.short_with_opf || d.name.full_with_opf)) ||
      item.value ||
      null,
    status: d.state && d.state.status ? d.state.status : null,
    okved: d.okved || null,
    share: share,
    link: founder ? "Учредитель" : managerLink ? "Руководитель" : null
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

async function resolveCorporateNetwork(profile) {
  const people = exactPeople(profile);
  let subsidiaries = [];
  const relatedCompanies = [];

  const peopleWithInn = people.filter(function(person) {
    return person.inn && person.inn !== profile.inn;
  }).slice(0, 4);

  const jobs = [
    findAffiliated(profile.inn, ["FOUNDERS"], 20),
    ...peopleWithInn.map(function(person) {
      return findAffiliated(person.inn, ["MANAGERS", "FOUNDERS"], 12);
    })
  ];

  const settled = await Promise.allSettled(jobs);

  if (settled[0] && settled[0].status === "fulfilled") {
    subsidiaries = settled[0].value
      .filter(function(item) {
        return item.data && item.data.inn && item.data.inn !== profile.inn;
      })
      .map(function(item) {
        return affiliateFromSuggestion(item, profile.inn);
      })
      .filter(function(item) { return item.name; })
      .slice(0, 12);
  }

  peopleWithInn.forEach(function(person, index) {
    const result = settled[index + 1];
    if (!result || result.status !== "fulfilled") return;

    result.value
      .filter(function(item) {
        return item.data &&
          item.data.inn &&
          item.data.inn !== profile.inn &&
          !subsidiaries.some(function(sub) {
            return sub.inn === item.data.inn;
          });
      })
      .slice(0, 8)
      .forEach(function(item) {
        const company = affiliateFromSuggestion(item, person.inn);
        if (company.name) {
          relatedCompanies.push({
            via: person.name,
            role: person.type,
            company: company
          });
        }
      });
  });

  return {
    people: people,
    subsidiaries: subsidiaries,
    relatedCompanies: relatedCompanies.slice(0, 16)
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

async function googleNews(query, locale, exact, lookbackDays) {
  const loc = locale === "en"
    ? "&hl=en-US&gl=US&ceid=US:en"
    : "&hl=ru&gl=RU&ceid=RU:ru";
  const days = Number(lookbackDays) > 0 ? Number(lookbackDays) : LOOKBACK_DAYS;

  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query + " when:" + days + "d") +
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
    return x.title && withinLookback(x.date, days);
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
    "company","компания","russia","russian","online","official","site","website",
    "internet","resheniya","solutions","group","holding","service","services"
  ]);

  normalize(legalName).split(" ").forEach(function(token) {
    if (token) stop.add(token);
  });
  transliterate(legalName).split(" ").forEach(function(token) {
    if (token) stop.add(token);
  });

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

    if (item.domain && !DIRECTORY_DOMAINS.some(function(domain) {
      return item.domain === domain || item.domain.endsWith("." + domain);
    })) {
      const base = item.domain.split(".")[0];
      add(base, 2);
    }
  });

  return Array.from(scores.entries())
    .sort(function(a,b) { return b[1] - a[1]; })
    .filter(function(item) { return item[1] >= 3; })
    .map(function(item) { return item[0]; })
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
  const text = normalize(cluster.items.map(function(item) {
    return item.title;
  }).join(" "));

  if (text.includes("облигац")) {
    if (text.includes("рейтинг")) return "Рейтинг выпуска облигаций";
    if (text.includes("размещ") || text.includes("выпуск")) return "Выпуск облигаций";
    if (text.includes("купон")) return "Выплата купона по облигациям";
    return "Облигации";
  }
  if (text.includes("дивиденд")) return "Дивиденды";
  if (text.includes("рейтинг")) return "Изменение кредитного рейтинга";
  if (text.includes("экспорт") || text.includes("поставк")) return "Изменение экспортных поставок";
  if (text.includes("контракт") || text.includes("тендер")) return "Новый контракт";
  if (text.includes("инвест") || text.includes("модерниз") || text.includes("строительств")) {
    return "Инвестиционный проект";
  }
  if (text.includes("санкц")) return "Санкционные изменения";
  if (text.includes("налог") || text.includes("ндпи") || text.includes("пошлин")) {
    return "Изменение налоговой нагрузки";
  }
  if (text.includes("прибыл") || text.includes("ebitda") || text.includes("выручк")) {
    return "Финансовые результаты";
  }
  if (text.includes("иск") || text.includes("суд")) return "Судебный спор";
  if (text.includes("директор") || text.includes("руковод")) return "Изменение руководства";

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

    const alternateHeadline = sorted
      .map(function(item) { return clean(item.title); })
      .find(function(title) {
        return normalize(title) !== normalize(eventTitle(c));
      });

    summary = alternative || alternateHeadline || representative.title;
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
    const resolved = await Promise.all([
      discoverIdentity(profile),
      resolveCorporateNetwork(profile).catch(function() {
        return { people: exactPeople(profile), subsidiaries: [], relatedCompanies: [] };
      })
    ]);
    const identity = resolved[0];
    const network = resolved[1];
    const aliases = buildAliases(profile, identity);
    const sectorTerms = sectorKeywords(profile.okved, profile.name).slice(0, 2);

    const mainAlias = aliases[0] || compactLegalName(profile.name);
    const jobs = [];

    aliases.slice(0, 2).forEach(function(alias) {
      jobs.push(googleNews('"' + alias + '"', "ru", true));
      jobs.push(bingNews('"' + alias + '"', true));
      jobs.push(gdelt(alias));
    });

    eventQueries(mainAlias).forEach(function(query) {
      jobs.push(googleNews(query, "ru", true));
    });

    trustedDomainQueries(mainAlias).forEach(function(query) {
      jobs.push(googleNews(query, "ru", true));
    });

    const latinAlias = aliases.find(function(alias) {
      return /^[a-z0-9 .&-]+$/i.test(alias);
    });

    if (latinAlias && latinAlias.toLowerCase() !== mainAlias.toLowerCase()) {
      jobs.push(googleNews('"' + latinAlias + '"', "en", true));
      jobs.push(bingNews('"' + latinAlias + '"', true));
    }

    network.people
      .filter(function(person) {
        return person.inn && person.name;
      })
      .slice(0, 2)
      .forEach(function(person) {
        const query = '"' + person.name + '" "' + mainAlias + '"';
        jobs.push(googleNews(query, "ru", true));
        jobs.push(bingNews(query, true));
      });

    const strategicHistoryJobs = [
      googleNews(
        '"' + mainAlias + '" (приобрел OR приобрела OR купил OR купила OR продал OR продала OR сделка OR доля OR инвестор OR совместное предприятие OR партнерство)',
        "ru",
        true,
        365
      ),
      googleNews(
        '"' + mainAlias + '" (стратегия OR запустил OR запустила OR расширение OR новый рынок OR производство OR завод OR платформа OR сервис OR выручка OR прибыль)',
        "ru",
        true,
        365
      )
    ];

    const benchmarkJobs = [];
    sectorTerms.forEach(function(term) {
      benchmarkJobs.push(
        googleNews(
          '"' + term + '" (сделка OR приобрел OR купил OR продал OR инвестиции OR запуск OR расширение OR производство OR рынок)',
          "ru",
          false
        )
      );
    });

    const searchResults = await Promise.all([
      Promise.allSettled(jobs),
      Promise.allSettled(strategicHistoryJobs),
      Promise.allSettled(benchmarkJobs)
    ]);
    const settled = searchResults[0];
    const strategicHistorySettled = searchResults[1];
    const benchmarkSettled = searchResults[2];

    let all = [];
    settled.forEach(function(result) {
      if (result.status === "fulfilled") all = all.concat(result.value);
    });

    let strategicHistoryAll = [];
    strategicHistorySettled.forEach(function(result) {
      if (result.status === "fulfilled") strategicHistoryAll = strategicHistoryAll.concat(result.value);
    });

    let benchmarkAll = [];
    benchmarkSettled.forEach(function(result) {
      if (result.status === "fulfilled") benchmarkAll = benchmarkAll.concat(result.value);
    });

    const collected = dedupeArticles(all);
    const filtered = collected.filter(function(article) {
      return relevant(article, aliases, profile);
    });

    const strategicHistory = dedupeArticles(strategicHistoryAll)
      .filter(function(article) {
        return relevant(article, aliases, profile);
      })
      .filter(function(article) {
        return !filtered.some(function(current) {
          return articleKey(current) === articleKey(article);
        });
      })
      .slice(0, 24);

    const strategicEvidence = dedupeArticles(filtered.concat(strategicHistory));

    const benchmarkArticles = dedupeArticles(benchmarkAll)
      .filter(function(article) {
        return TRUSTED_DOMAINS.some(function(domain) {
          return article.domain === domain || article.domain.endsWith("." + domain);
        });
      })
      .slice(0, 20);

    const clustered = cluster(filtered);
    const analysisJobs = await Promise.all([
      Promise.all(clustered.map(enrichCluster)),
      buildStrategicAnalysis({
        profile: profile,
        aliases: aliases,
        network: network,
        sectorTerms: sectorTerms,
        companyArticles: strategicEvidence,
        benchmarkArticles: benchmarkArticles
      })
    ]);

    let events = analysisJobs[0];
    const strategicAnalysis = analysisJobs[1];

    events = events
      .sort(function(a,b) {
        return new Date(b.date) - new Date(a.date);
      })
      .slice(0, 20);

    return NextResponse.json({
      company: profile,
      aliases: aliases,
      relations: network.people,
      subsidiaries: network.subsidiaries,
      relatedCompanies: network.relatedCompanies,
      events: events,
      strategicAnalysis: strategicAnalysis,
      stats: {
        collected: collected.length,
        relevant: filtered.length,
        strategicEvidence: strategicEvidence.length,
        benchmarks: benchmarkArticles.length,
        events: events.length
      },
      lookbackDays: LOOKBACK_DAYS,
      methodology:
        "Сначала определяем юрлицо и подтвержденные связи через DaData, затем собираем публикации по рабочим названиям компании и связанным лицам. Отдельно собираем отраслевые сигналы для бенчмаркинга. Хронология остается доказательной базой, а стратегический слой связывает факты в конкретные идеи для бизнеса и банка."
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
