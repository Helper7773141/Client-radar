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

function makeLetter(company, events) {
  const selected = events.slice(0, 5);
  const topics = selected.map(function(event) {
    return event.isSignal ? event.title.toLowerCase() : event.headline;
  });
  const products = Array.from(new Set(
    selected.flatMap(function(event) {
      return event.products || [];
    })
  )).slice(0, 5);

  return [
    "Добрый день.",
    "",
    "Обратил внимание на несколько актуальных событий вокруг " + company.name + ":",
    topics.map(function(topic) { return "— " + topic; }).join("\n"),
    "",
    products.length
      ? "Хотел уточнить, могут ли в этой связи быть актуальны решения в части " + products.join(", ").toLowerCase() + "."
      : "Хотел уточнить, есть ли сейчас задачи, где мы могли бы быть полезны.",
    "",
    "Если актуально, предлагаю коротко обсудить."
  ].join("\n");
}

export default function Home() {
  const [inn, setInn] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState("all");
  const [letterOpen, setLetterOpen] = useState(false);
  const [letter, setLetter] = useState("");

  const visibleEvents = useMemo(function() {
    if (!data) return [];
    if (filter === "signals") {
      return data.events.filter(function(event) {
        return event.isSignal;
      });
    }
    return data.events;
  }, [data, filter]);

  const selectedEvents = useMemo(function() {
    if (!data) return [];
    return data.events.filter(function(event) {
      return selected.includes(event.id);
    });
  }, [data, selected]);

  function normalizeInn(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 10);
  }

  async function analyze(event) {
    if (event) event.preventDefault();

    const value = normalizeInn(inn);
    if (value.length !== 10) {
      setError("Введите 10-значный ИНН юридического лица.");
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    setSelected([]);
    setFilter("all");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn: value })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Не удалось выполнить поиск.");
      }

      setData(payload);
    } catch (e) {
      setError(e.message || "Не удалось выполнить поиск.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setSelected(function(prev) {
      return prev.includes(id)
        ? prev.filter(function(item) { return item !== id; })
        : prev.concat(id);
    });
  }

  function openLetter() {
    const chosen = selectedEvents.length
      ? selectedEvents
      : data.events.filter(function(event) { return event.isSignal; }).slice(0, 3);

    setLetter(makeLetter(data.company, chosen.length ? chosen : data.events.slice(0, 3)));
    setLetterOpen(true);
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <div className="logo">CLIENT RADAR</div>
          <div className="headerNote">Свежие новости компании по ИНН</div>
        </div>
      </header>

      <section className={data ? "searchSection compactSearch" : "searchSection"}>
        {!data && (
          <>
            <h1>Введите ИНН компании</h1>
            <p>Определяем точное юрлицо и ищем свежие публикации о нём в Google News за последние 90 дней.</p>
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
              aria-label="ИНН"
            />
          </div>
          <button disabled={loading}>
            {loading ? "Ищем новости…" : data ? "Найти другую компанию" : "Найти новости"}
          </button>
        </form>
      </section>

      {loading && (
        <section className="loadingPanel">
          <div className="spinner" />
          <div>
            <strong>Ищем свежие публикации</strong>
            <span>Сначала определяем компанию по ИНН, затем ищем новости по её точному названию.</span>
          </div>
        </section>
      )}

      {error && (
        <section className="errorPanel">
          <strong>Не получилось выполнить поиск</strong>
          <p>{error}</p>
        </section>
      )}

      {data && (
        <>
          <section className="companyCard">
            <div>
              <div className="verifiedBadge">Юрлицо подтверждено</div>
              <h2>{data.company.name}</h2>
              <div className="companyMeta">
                <span>ИНН {data.company.inn}</span>
                {data.company.ogrn && <span>ОГРН {data.company.ogrn}</span>}
                {data.company.okved && <span>ОКВЭД {data.company.okved}</span>}
              </div>
              {data.company.management && data.company.management.name && (
                <div className="director">
                  Руководитель: <b>{data.company.management.name}</b>
                </div>
              )}
            </div>
            <div className="period">Последние {data.lookbackDays} дней</div>
          </section>

          <section className="simpleStats">
            <div><strong>{data.stats.publicationsFound}</strong><span>публикаций найдено</span></div>
            <div><strong>{data.stats.sourcesFound}</strong><span>источников</span></div>
            <div><strong>{data.stats.signalsFound}</strong><span>банковских сигналов</span></div>
          </section>

          <section className="newsHeader">
            <div>
              <h2>Новости</h2>
              <p>{data.methodology}</p>
            </div>
            <div className="viewTabs">
              <button
                className={filter === "all" ? "active" : ""}
                onClick={function() { setFilter("all"); }}
              >
                Все {data.events.length}
              </button>
              <button
                className={filter === "signals" ? "active" : ""}
                onClick={function() { setFilter("signals"); }}
              >
                Сигналы {data.stats.signalsFound}
              </button>
            </div>
          </section>

          {visibleEvents.length === 0 ? (
            <section className="emptyPanel">
              <strong>Свежих публикаций не найдено</strong>
              <p>Попробуйте другую компанию или повторите поиск позже.</p>
            </section>
          ) : (
            <section className="newsList">
              {visibleEvents.map(function(event) {
                return (
                  <article className="newsItem" key={event.id}>
                    <label className="newsCheck">
                      <input
                        type="checkbox"
                        checked={selected.includes(event.id)}
                        onChange={function() { toggle(event.id); }}
                      />
                    </label>

                    <div className="newsContent">
                      <div className="newsTop">
                        <div className="newsBadges">
                          <span className="categoryBadge">{event.category}</span>
                          {event.factStageKey !== "reported" && (
                            <span className={"stageBadge " + event.factStageKey}>{event.factStage}</span>
                          )}
                        </div>
                        <time>{formatDate(event.latestDate)}</time>
                      </div>

                      <h3>{event.headline}</h3>

                      <div className="newsSourceLine">
                        <span>{event.sourceName}</span>
                        {event.url && (
                          <a href={event.url} target="_blank" rel="noreferrer">Открыть источник ↗</a>
                        )}
                      </div>

                      {event.isSignal && (
                        <div className="signalBox">
                          <div>
                            <small>Сигнал</small>
                            <b>{event.title}</b>
                          </div>
                          <p>{event.impact}</p>
                          {event.products.length > 0 && (
                            <div className="productChips">
                              {event.products.map(function(product) {
                                return <span key={product}>{product}</span>;
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {data.events.length > 0 && (
            <div className="letterBar">
              <div>
                <strong>{selected.length ? "Выбрано новостей: " + selected.length : "Выберите новости для письма"}</strong>
                <span>Письмо соберётся из отмеченных публикаций и найденных банковских сигналов.</span>
              </div>
              <button onClick={openLetter}>Составить письмо</button>
            </div>
          )}
        </>
      )}

      <footer>
        Client Radar использует публичные публикации. Банковские выводы являются гипотезами менеджеру и требуют проверки контекста источника.
      </footer>

      {letterOpen && (
        <div className="modalBackdrop" onMouseDown={function() { setLetterOpen(false); }}>
          <div className="modal" onMouseDown={function(e) { e.stopPropagation(); }}>
            <div className="modalHeader">
              <h2>Черновик письма</h2>
              <button onClick={function() { setLetterOpen(false); }}>×</button>
            </div>
            <textarea value={letter} onChange={function(e) { setLetter(e.target.value); }} />
            <div className="modalActions">
              <button onClick={function() { navigator.clipboard.writeText(letter); }}>Копировать</button>
              <a
                href={
                  "mailto:?subject=" +
                  encodeURIComponent("Актуальные направления для обсуждения") +
                  "&body=" +
                  encodeURIComponent(letter)
                }
              >
                Открыть в почте
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
