function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shorten(value, max) {
  const text = clean(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function outputText(payload) {
  const chunks = [];
  (payload && Array.isArray(payload.output) ? payload.output : []).forEach(function(item) {
    (Array.isArray(item.content) ? item.content : []).forEach(function(part) {
      if (part && part.type === "output_text" && part.text) chunks.push(part.text);
    });
  });
  return chunks.join("\n").trim();
}

function parseJson(text) {
  let value = String(text || "").trim();
  value = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(value);
  } catch {}
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(value.slice(start, end + 1));
  throw new Error("Не удалось разобрать ответ поиска.");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeDate(value) {
  const raw = clean(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function consultedSources(payload) {
  const urls = [];
  (payload && Array.isArray(payload.output) ? payload.output : []).forEach(function(item) {
    if (!item || item.type !== "web_search_call") return;
    const action = item.action || {};
    (Array.isArray(action.sources) ? action.sources : []).forEach(function(source) {
      const url = safeUrl(source && source.url);
      if (url) urls.push(url);
    });
  });
  return Array.from(new Set(urls));
}

function normalizeCategory(value) {
  const allowed = [
    "Сделки / M&A",
    "Инвестиции / развитие",
    "Финансы",
    "Продукт / продажи",
    "Партнерства",
    "Собственники / менеджмент",
    "Регуляторика / суды",
    "Международное развитие",
    "Другое"
  ];
  const raw = clean(value);
  return allowed.includes(raw) ? raw : "Другое";
}

export async function searchCompanyNews(profile, aliases, network) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { status: "disabled", articles: [], sources: [] };

  const model = process.env.OPENAI_NEWS_MODEL || process.env.OPENAI_MODEL || "gpt-6.1-sol";
  const company = {
    name: profile.name,
    fullName: profile.fullName,
    inn: profile.inn,
    ogrn: profile.ogrn,
    okved: profile.okved,
    management: profile.management,
    aliases: Array.isArray(aliases) ? aliases.slice(0, 6) : [],
    people: Array.isArray(network && network.people)
      ? network.people.slice(0, 6).map(function(x) {
          return { type: x.type, name: x.name, post: x.post };
        })
      : [],
    subsidiaries: Array.isArray(network && network.subsidiaries)
      ? network.subsidiaries.slice(0, 8).map(function(x) {
          return { name: x.name, inn: x.inn };
        })
      : []
  };

  const prompt = [
    "Найди в открытом интернете новости и содержательные публикации именно об этой компании.",
    "Нужна лента для корпоративного клиентского менеджера: не анализ и не банковские продукты, а сами лучшие факты, которые потом можно анализировать.",
    "",
    "КОМПАНИЯ:",
    JSON.stringify(company, null, 2),
    "",
    "Что искать:",
    "- последние 12 месяцев; если за 12 месяцев мало материалов, можно аккуратно расшириться до 18 месяцев;",
    "- сделки M&A, покупка/продажа долей, смена владельцев;",
    "- инвестиции, новые производства, проекты, магазины, мощности, география;",
    "- выручка, прибыль, долг, дивиденды, облигации, привлечение финансирования;",
    "- крупные контракты и партнерства;",
    "- новые продукты, бизнес-модели и каналы продаж;",
    "- международная экспансия/сокращение присутствия;",
    "- значимые суды, санкции и регуляторные события;",
    "- изменения топ-менеджмента и собственников;",
    "- важные интервью собственников/CEO, если из них можно извлечь факты о стратегии.",
    "",
    "Правила качества:",
    "1. Ищи широко: официальные сайты, РБК, Коммерсантъ, Ведомости, Интерфакс, ТАСС, Forbes, отраслевые СМИ и другие первичные/сильные источники.",
    "2. Не включай карточки юрлиц, каталоги компаний, SEO-страницы, вакансии, случайные упоминания и новости одноименных компаний.",
    "3. Материал должен реально помогать понять бизнес. Если публикация ничего не добавляет — выброси.",
    "4. Одна публикация = один элемент. НЕ объединяй несколько новостей в одно событие.",
    "5. Старайся вернуть 20 разных полезных публикаций. Если реально качественных меньше — верни меньше, не добивай мусором.",
    "6. Указывай прямую ссылку на сам материал, а не на главную страницу источника и не на поисковую выдачу.",
    "7. Краткое summary — 1–2 предложения, только факты из материала, без советов.",
    "8. Отсортируй от новых к старым.",
    "9. Верни ТОЛЬКО JSON без markdown.",
    "",
    "Формат:",
    JSON.stringify({
      articles: [{
        date: "YYYY-MM-DD",
        title: "реальный содержательный заголовок",
        summary: "кратко, что произошло и почему это существенно; без советов",
        source: "название источника",
        url: "https://...",
        category: "Сделки / M&A | Инвестиции / развитие | Финансы | Продукт / продажи | Партнерства | Собственники / менеджмент | Регуляторика / суды | Международное развитие | Другое"
      }]
    }, null, 2)
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, 38000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        reasoning: { effort: "medium" },
        tools: [{
          type: "web_search",
          search_context_size: "high",
          filters: {
            blocked_domains: [
              "wikipedia.org",
              "reddit.com",
              "quora.com",
              "rusprofile.ru",
              "checko.ru",
              "list-org.com",
              "audit-it.ru",
              "zachestnyibiznes.ru"
            ]
          }
        }],
        tool_choice: "auto",
        include: ["web_search_call.action.sources"],
        input: prompt,
        max_output_tokens: 5200,
        store: false
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        status: "error",
        reason: "OpenAI web search HTTP " + response.status + ": " + shorten(body, 180),
        articles: [],
        sources: []
      };
    }

    const payload = await response.json();
    const parsed = parseJson(outputText(payload));
    const sourceUrls = consultedSources(payload);

    const seen = new Set();
    const articles = (Array.isArray(parsed.articles) ? parsed.articles : [])
      .map(function(item, index) {
        const url = safeUrl(item && item.url);
        const date = normalizeDate(item && item.date);
        const title = shorten(item && item.title, 240);
        if (!url || !title) return null;

        const key = url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);

        return {
          id: "web-news-" + (index + 1),
          title: title,
          details: shorten(item && item.summary, 420),
          date: date || new Date(0).toISOString(),
          category: normalizeCategory(item && item.category),
          sourceName: shorten(item && item.source, 80) || sourceHost(url) || "Источник",
          domain: sourceHost(url),
          url: url,
          verifiedByWebSearch: sourceUrls.some(function(sourceUrl) {
            return sourceUrl === url || sourceUrl.replace(/[?#].*$/, "") === url.replace(/[?#].*$/, "");
          })
        };
      })
      .filter(Boolean)
      .sort(function(a, b) { return new Date(b.date) - new Date(a.date); })
      .slice(0, 20);

    return {
      status: articles.length ? "ok" : "empty",
      model: model,
      articles: articles,
      sources: sourceUrls
    };
  } catch (error) {
    return {
      status: "error",
      reason: error && error.name === "AbortError"
        ? "Web-поиск превысил лимит времени."
        : (error.message || "Не удалось выполнить web-поиск."),
      articles: [],
      sources: []
    };
  } finally {
    clearTimeout(timer);
  }
}
