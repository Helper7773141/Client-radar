function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value, max) {
  const text = clean(value);
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function formatNumber(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(num);
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
  value = value.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  try {
    return JSON.parse(value);
  } catch {}
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(value.slice(start, end + 1));
  }
  throw new Error("Модель вернула ответ не в JSON.");
}

function safeArray(value, max) {
  return (Array.isArray(value) ? value : [])
    .filter(Boolean)
    .slice(0, max || 20);
}

function normalizeEnum(value, allowed, fallback) {
  const raw = clean(value);
  return allowed.includes(raw) ? raw : fallback;
}

function prepareEvidence(items, prefix, kind, limit) {
  return (Array.isArray(items) ? items : [])
    .slice()
    .sort(function(a, b) {
      return new Date(b.date || 0) - new Date(a.date || 0);
    })
    .slice(0, limit)
    .map(function(item, index) {
      return {
        id: prefix + (index + 1),
        kind: kind,
        title: shorten(item.title, 240),
        description: shorten(item.description, 420),
        date: item.date || null,
        sourceName: item.sourceName || item.domain || "Источник",
        domain: item.domain || "",
        url: item.url || null
      };
    });
}

function evidenceLine(item) {
  return [
    "[" + item.id + "]",
    item.date ? String(item.date).slice(0, 10) : "",
    item.sourceName,
    item.title,
    item.description ? "— " + item.description : ""
  ].filter(Boolean).join(" | ");
}

function normalizeInsight(raw, evidenceMap, index) {
  const ids = safeArray(raw && raw.evidence, 6)
    .map(function(x) { return clean(x).toUpperCase(); })
    .filter(function(id) { return evidenceMap.has(id); });

  return {
    id: "insight-" + (index + 1),
    title: shorten(raw && raw.title, 130) || "Стратегический сигнал",
    type: shorten(raw && raw.type, 80) || "Стратегия",
    priority: normalizeEnum(raw && raw.priority, ["Высокий", "Средний", "Низкий"], "Средний"),
    basis: normalizeEnum(raw && raw.basis, ["Факт", "Гипотеза"], "Гипотеза"),
    confidence: normalizeEnum(raw && raw.confidence, ["Высокая", "Средняя", "Низкая"], ids.length >= 2 ? "Высокая" : "Средняя"),
    signal: shorten(raw && raw.signal, 520),
    whyItMatters: shorten(raw && raw.whyItMatters, 520),
    move: shorten(raw && raw.move, 560),
    bankRole: shorten(raw && raw.bankRole, 520),
    bankRevenue: safeArray(raw && raw.bankRevenue, 6).map(function(x) {
      return shorten(x, 80);
    }),
    evidence: ids.map(function(id) { return evidenceMap.get(id); })
  };
}

export async function buildStrategicAnalysis(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      status: "disabled",
      reason: "OPENAI_API_KEY не настроен"
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-6-sol";
  const companyEvidence = prepareEvidence(input.companyArticles, "A", "company", 24);
  const benchmarkEvidence = prepareEvidence(input.benchmarkArticles, "B", "benchmark", 14);
  const evidence = companyEvidence.concat(benchmarkEvidence);
  const evidenceMap = new Map(evidence.map(function(item) { return [item.id, item]; }));

  if (!companyEvidence.length) {
    return {
      status: "skipped",
      reason: "Недостаточно релевантных публикаций для глубокого анализа"
    };
  }

  const company = input.profile || {};
  const network = input.network || {};
  const context = {
    company: {
      name: company.name,
      fullName: company.fullName,
      inn: company.inn,
      okved: company.okved,
      revenue: formatNumber(company.revenue),
      income: formatNumber(company.income),
      financeYear: company.financeYear,
      employees: company.employees,
      capital: formatNumber(company.capital),
      management: company.management
    },
    aliases: safeArray(input.aliases, 5),
    sectorTerms: safeArray(input.sectorTerms, 5),
    people: safeArray(network.people, 8).map(function(x) {
      return { type: x.type, name: x.name, post: x.post, share: x.share };
    }),
    subsidiaries: safeArray(network.subsidiaries, 10).map(function(x) {
      return { name: x.name, inn: x.inn, share: x.share, link: x.link };
    }),
    relatedCompanies: safeArray(network.relatedCompanies, 10).map(function(x) {
      return { via: x.via, role: x.role, company: x.company && x.company.name };
    })
  };

  const prompt = [
    "Ты — старший стратег и инвестиционный банкир, который готовит краткий client intelligence memo для relationship manager крупного корпоративного банка.",
    "",
    "Твоя задача — НЕ сопоставлять ключевые слова банковским продуктам. Сначала думай как предприниматель и стратег: что реально происходит с бизнесом, куда он движется, что можно купить/продать/выделить, где масштабироваться, где менять operating model, supply chain, географию, ownership или capital allocation. Только после этого объясни, где банк может встроиться и на чем заработать.",
    "",
    "Жесткие правила:",
    "1. Не выдумывай факты, суммы, собственников, сделки или планы. Факт может опираться на КАРТОЧКУ КОМПАНИИ или evidence A*. Отраслевой benchmark B* нельзя выдавать за факт о компании.",
    "2. Гипотезы разрешены, но помечай basis='Гипотеза' и объясняй, из каких фактов они следуют.",
    "3. Не пиши общие советы вроде 'дать кредит', 'предложить РКО', 'развивать цифровизацию'. Банковский продукт допустим только как часть конкретного бизнес-действия.",
    "4. Приоритет: M&A, JV, carve-out, вертикальная интеграция, новые рынки/каналы, asset-light, производственные/логистические платформы, B2B-экосистемы, embedded finance, capital allocation. Кредит/факторинг/гарантии — второй слой.",
    "5. Если компания cash-rich или почти без долга, не придумывай потребность в обычном кредите.",
    "6. Не предлагай зарубежные структуры, санкционные маршруты или 'разморозку' без прямого основания в фактах.",
    "7. Ищи связи между несколькими публикациями. Один сильный синтез лучше трех пересказов новостей.",
    "8. Для каждого тезиса укажи evidence IDs. Если доказательной базы мало — снизь confidence.",
    "9. Пиши по-русски, коротко, конкретно, с цифрами и названиями там, где они есть в evidence.",
    "10. Выдай 4–6 лучших тезисов, не заполняй количество ради количества.",
    "",
    "КАРТОЧКА КОМПАНИИ:",
    JSON.stringify(context, null, 2),
    "",
    "ПУБЛИКАЦИИ О КОМПАНИИ:",
    companyEvidence.map(evidenceLine).join("\n"),
    "",
    "ОТРАСЛЕВЫЕ СИГНАЛЫ / БЕНЧМАРКИ (это НЕ факты о компании):",
    benchmarkEvidence.length ? benchmarkEvidence.map(evidenceLine).join("\n") : "Нет отдельных бенчмарков.",
    "",
    "Верни ТОЛЬКО валидный JSON без markdown и пояснений в такой структуре:",
    JSON.stringify({
      executiveSummary: "2–3 предложения: что за ситуация у бизнеса и где главный стратегический вопрос",
      strategicRead: "1 короткий абзац: какой переход/конфликт/возможность связывает факты вместе",
      insights: [{
        title: "короткое название идеи",
        type: "M&A / Рост / Operating model / Международка / Capital allocation / Ecosystem / другое",
        priority: "Высокий | Средний | Низкий",
        basis: "Факт | Гипотеза",
        confidence: "Высокая | Средняя | Низкая",
        signal: "что именно увидели в фактах",
        whyItMatters: "почему это важно для бизнеса",
        move: "что конкретно компании можно делать",
        bankRole: "как именно банк/инвестбанк может встроиться; если роли почти нет — так и напиши",
        bankRevenue: ["M&A advisory", "процентный доход", "гарантии", "FX/ВЭД", "transaction banking", "лизинг", "эквайринг", "другое"],
        evidence: ["A1", "A3", "B2"]
      }],
      questions: ["3–5 конкретных вопросов клиенту, которые проверят гипотезы"],
      watchlist: ["2–4 события/метрики, которые стоит отслеживать дальше"]
    }, null, 2)
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, 24000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        input: [{ role: "user", content: prompt }],
        max_output_tokens: 2600,
        store: false
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        status: "error",
        reason: "OpenAI API HTTP " + response.status + ": " + shorten(body, 220)
      };
    }

    const payload = await response.json();
    const parsed = parseJson(outputText(payload));
    const insights = safeArray(parsed.insights, 6)
      .map(function(raw, index) { return normalizeInsight(raw, evidenceMap, index); })
      .filter(function(item) {
        return item.signal || item.move || item.bankRole;
      });

    return {
      status: "ok",
      model: model,
      generatedAt: new Date().toISOString(),
      executiveSummary: shorten(parsed.executiveSummary, 900),
      strategicRead: shorten(parsed.strategicRead, 1000),
      insights: insights,
      questions: safeArray(parsed.questions, 5).map(function(x) { return shorten(x, 260); }),
      watchlist: safeArray(parsed.watchlist, 4).map(function(x) { return shorten(x, 220); })
    };
  } catch (error) {
    return {
      status: "error",
      reason: error && error.name === "AbortError"
        ? "Глубокий анализ не успел завершиться за лимит времени."
        : (error.message || "Не удалось выполнить глубокий анализ.")
    };
  } finally {
    clearTimeout(timer);
  }
}
