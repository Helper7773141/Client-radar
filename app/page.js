"use client";

import { useMemo, useState } from "react";

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function statusClass(status) {
  return status === "Подтверждено" ? "verifiedEvent" : "reviewEvent";
}

function stageClass(key) {
  if (key === "enacted") return "stageEnacted";
  if (key === "proposed") return "stageProposed";
  if (key === "denied") return "stageDenied";
  if (key === "conflict") return "stageConflict";
  return "stageReported";
}

function priorityClass(priority) {
  if (priority === "Высокий") return "priorityHigh";
  if (priority === "Средний") return "priorityMedium";
  return "priorityLow";
}

function makeLetter(company, events) {
  const useful = events.filter(function(event) {
    return event.factStageKey !== "denied" && event.factStageKey !== "conflict";
  });
  const topics = useful.slice(0, 4).map(function(event) {
    return event.title.toLowerCase();
  });
  const products = Array.from(new Set(useful.flatMap(function(event) {
    return event.products || [];
  }))).slice(0, 5);

  return [
    "Добрый день.",
    "",
    topics.length
      ? "Обратил внимание на несколько актуальных событий вокруг " + company.name + ": " + topics.join(", ") + "."
      : "Обратил внимание на несколько актуальных публичных событий вокруг " + company.name + ".",
    "",
    products.length
      ? "Хотел уточнить, могут ли в этой связи быть актуальны решения в части " + products.join(", ").toLowerCase() + "."
      : "Хотел уточнить, есть ли сейчас задачи, где мы могли бы быть полезны.",
    "",
    "Если вопрос актуален, предлагаю коротко обсудить возможные варианты."
  ].join("\n");
}

export default function Home() {
  const [inn, setInn] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [view, setView] = useState("all");
  const [letterOpen, setLetterOpen] = useState(false);
  const [letter, setLetter] = useState("");

  const selectedEvents = useMemo(function() {
    if (!data) return [];
    return data.events.filter(function(event) {
      return selected.includes(event.id);
    });
  }, [data, selected]);

  const visibleEvents = useMemo(function() {
    if (!data) return [];
    if (view === "high") {
      return data.events.filter(function(event) {
        return event.priority === "Высокий";
      });
    }
    if (view === "verified") {
      return data.events.filter(function(event) {
        return event.status === "Подтверждено";
      });
    }
    return data.events;
  }, [data, view]);

  function normalizeInn(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 10);
  }

  async function analyze(event) {
    if (event) event.preventDefault();
    const value = normalizeInn(inn);

    if (value.length !== 10) {
      setError({
        message: "Введите 10-значный ИНН юридического лица.",
        code: "INVALID_INN"
      });
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    setSelected([]);
    setView("all");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn: value })
      });
      const payload = await response.json();

      if (!response.ok) {
        const problem = new Error(payload.error || "Ошибка анализа");
        problem.code = payload.code;
        throw problem;
      }

      setData(payload);
    } catch (e) {
      setError({
        message: e.message,
        code: e.code || "ERROR"
      });
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setSelected(function(prev) {
      return prev.includes(id)
        ? prev.filter(function(x) { return x !== id; })
        : prev.concat(id);
    });
  }

  function openLetter() {
    const chosen = selectedEvents.length ? selectedEvents : data.events.slice(0, 3);
    setLetter(makeLetter(data.company, chosen));
    setLetterOpen(true);
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <div className="logo">CLIENT RADAR</div>
          <div className="headerNote">Публичные сигналы → повод для контакта</div>
        </div>
        <div className="headerState">ИНН → юрлицо → проверенные события</div>
      </header>

      <section className={data ? "searchSection compactSearch" : "searchSection"}>
        {!data && (
          <>
            <div className="overline">КОРПОРАТИВНАЯ РАЗВЕДКА</div>
            <h1>Радар компании по ИНН</h1>
            <p>Не ищем по названию. Сначала точно определяем юрлицо, затем проверяем новости, связанных лиц и отраслевые события.</p>
          </>
        )}
        <form className="innForm" onSubmit={analyze}>
          <div className="innField">
            <span>ИНН</span>
            <input
              inputMode="numeric"
              value={inn}
              onChange={function(e) { setInn(normalizeInn(e.target.value)); }}
              placeholder="10 цифр"
              aria-label="ИНН юридического лица"
            />
          </div>
          <button disabled={loading}>{loading ? "Анализируем…" : data ? "Проверить другую компанию" : "Проанализировать"}</button>
        </form>
      </section>

      {loading && (
        <section className="loadingPanel">
          <div className="spinner" />
          <div>
            <strong>Собираем профиль и проверяем события</strong>
            <span>Идентификация юрлица → доверенные источники → дедупликация → проверка стадии события.</span>
          </div>
        </section>
      )}

      {error && (
        <section className="errorPanel">
          <strong>{error.code === "CONFIG_REQUIRED" ? "Не подключена идентификация по ИНН" : "Не получилось выполнить анализ"}</strong>
          <p>{error.message}</p>
          {error.code === "CONFIG_REQUIRED" && (
            <p className="setupHint">Проверьте переменную DADATA_TOKEN в Production Environment Variables Vercel и выполните Redeploy.</p>
          )}
        </section>
      )}

      {data && (
        <>
          <section className="companyCard">
            <div className="companyIdentity">
              <div className="verifiedBadge">Юрлицо подтверждено</div>
              <h2>{data.company.name}</h2>
              <div className="companyMeta">
                <span>ИНН {data.company.inn}</span>
                {data.company.ogrn && <span>ОГРН {data.company.ogrn}</span>}
                {data.company.okved && <span>ОКВЭД {data.company.okved}</span>}
                {data.company.status && <span>{data.company.status}</span>}
              </div>
              {data.company.management && data.company.management.name && (
                <div className="director">
                  Руководитель: <b>{data.company.management.name}</b>
                  {data.company.management.post ? " · " + data.company.management.post : ""}
                </div>
              )}
            </div>
            <div className="companyAside">
              <span>Период</span>
              <b>90 дней</b>
            </div>
          </section>

          <section className="radarSummary">
            <div className="summaryMain">
              <span>Требуют внимания</span>
              <strong>{data.stats.highPriorityEvents || 0}</strong>
              <small>событий высокого приоритета</small>
            </div>
            <div className="summaryStat">
              <strong>{data.stats.verifiedEvents || 0}</strong>
              <span>подтверждено</span>
            </div>
            <div className="summaryStat">
              <strong>{data.stats.sourcesWithMatches}</strong>
              <span>источников с совпадениями</span>
            </div>
            <div className="summaryStat">
              <strong>{data.stats.publicationsReviewed}</strong>
              <span>публикаций просмотрено</span>
            </div>
          </section>

          {data.relations && data.relations.length > 0 && (
            <details className="relations">
              <summary>
                <span>Профиль связей</span>
                <small>{data.relations.length} подтвержденных записей</small>
              </summary>
              <div className="relationList">
                {data.relations.map(function(item, index) {
                  return (
                    <div key={index}>
                      <span>{item.type}</span>
                      <b>{item.name}</b>
                      {item.detail && <small>{item.detail}</small>}
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          <section className="eventsHeader">
            <div>
              <h2>События</h2>
              <p>{data.methodology}</p>
            </div>
            <div className="viewTabs">
              <button className={view === "all" ? "active" : ""} onClick={function() { setView("all"); }}>Все {data.events.length}</button>
              <button className={view === "high" ? "active" : ""} onClick={function() { setView("high"); }}>Высокий приоритет</button>
              <button className={view === "verified" ? "active" : ""} onClick={function() { setView("verified"); }}>Подтверждено</button>
            </div>
          </section>

          {visibleEvents.length === 0 ? (
            <section className="emptyPanel">
              <strong>В этой выборке событий нет</strong>
              <p>Сервис не подставляет демонстрационные или непроверенные новости ради заполнения экрана.</p>
            </section>
          ) : (
            <section className="eventList">
              {visibleEvents.map(function(event) {
                return (
                  <article className="eventRow" key={event.id}>
                    <label className="eventCheck" title="Добавить в письмо">
                      <input
                        type="checkbox"
                        checked={selected.includes(event.id)}
                        onChange={function() { toggle(event.id); }}
                      />
                    </label>

                    <details className="eventDetails">
                      <summary>
                        <div className={"priorityMark " + priorityClass(event.priority)} />
                        <div className="eventMain">
                          <div className="eventTitleLine">
                            <h3>{event.title}</h3>
                            {event.scope && <span className="scopeBadge">{event.scope}</span>}
                          </div>
                          <div className="eventMeta">
                            <span className={"factStage " + stageClass(event.factStageKey)}>{event.factStage}</span>
                            <span className={statusClass(event.status)}>{event.status}</span>
                            <span>{event.sourceCount} источн.</span>
                            <span>{formatDate(event.latestDate)}</span>
                          </div>
                        </div>
                        <div className="eventScore">
                          <span>{event.priority}</span>
                          <b>{event.confidence}%</b>
                        </div>
                        <div className="chevron">⌄</div>
                      </summary>

                      <div className="eventBody">
                        <div className="evidence">
                          <small>Что нашли</small>
                          <p>{event.evidenceHeadline}</p>
                        </div>

                        <div className="relationWhy">
                          <small>Почему относится к компании</small>
                          <p>{event.relation}</p>
                        </div>

                        <div className="impact">
                          <small>Почему это важно</small>
                          <p>{event.impact}</p>
                        </div>

                        <div className="products">
                          <small>Что можно обсудить</small>
                          <div>
                            {event.products.map(function(product) {
                              return <span key={product}>{product}</span>;
                            })}
                          </div>
                        </div>

                        <div className="sources">
                          <small>Источники</small>
                          {event.sources.map(function(source, index) {
                            return source.url
                              ? <a href={source.url} target="_blank" rel="noreferrer" key={index}>{source.name || source.domain} <span>↗</span></a>
                              : <span key={index}>{source.name || source.domain}</span>;
                          })}
                        </div>
                      </div>
                    </details>
                  </article>
                );
              })}
            </section>
          )}

          <details className="sourceContour">
            <summary>Контур проверки: {data.stats.sourcesInContour} доверенных источников</summary>
            <div>
              {data.sources.map(function(source) {
                return <span key={source.domain}>{source.name}</span>;
              })}
            </div>
          </details>

          {data.events.length > 0 && (
            <div className="letterBar">
              <div>
                <strong>{selected.length ? "Выбрано: " + selected.length : "Выберите события для письма"}</strong>
                <span>Опровергнутые и спорные события автоматически не используются как утверждения.</span>
              </div>
              <button onClick={openLetter}>Составить письмо</button>
            </div>
          )}
        </>
      )}

      <footer>
        Client Radar использует публично доступные источники. Продуктовые гипотезы требуют проверки менеджером и не являются утверждением о финансовом состоянии клиента.
      </footer>

      {letterOpen && (
        <div className="modalBackdrop" onMouseDown={function() { setLetterOpen(false); }}>
          <div className="modal" onMouseDown={function(e) { e.stopPropagation(); }}>
            <div className="modalHeader">
              <div>
                <small>ЧЕРНОВИК</small>
                <h2>Письмо клиенту</h2>
              </div>
              <button onClick={function() { setLetterOpen(false); }}>×</button>
            </div>
            <textarea value={letter} onChange={function(e) { setLetter(e.target.value); }} />
            <div className="modalActions">
              <button onClick={function() { navigator.clipboard.writeText(letter); }}>Копировать</button>
              <a href={"mailto:?subject=" + encodeURIComponent("Актуальные направления для обсуждения") + "&body=" + encodeURIComponent(letter)}>Открыть в почте</a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
