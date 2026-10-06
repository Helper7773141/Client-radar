"use client";

import { useMemo, useState } from "react";

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function makeLetter(company, events) {
  const lines = events.slice(0, 5).map(function(event) {
    return "— " + event.title + (event.details ? ": " + event.details : "");
  });

  return [
    "Добрый день.",
    "",
    "Посмотрел последние события вокруг " + company.name + " и обратил внимание на несколько вещей:",
    lines.join("\n"),
    "",
    "Если что-то из этого сейчас актуально, буду рад коротко обсудить."
  ].join("\n");
}

export default function Home() {
  const [inn, setInn] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letter, setLetter] = useState("");

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

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn: value })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось собрать новости.");
      }

      setData(payload);
    } catch (e) {
      setError(e.message || "Не удалось собрать новости.");
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
      : data.events.slice(0, 3);

    setLetter(makeLetter(data.company, chosen));
    setLetterOpen(true);
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <div className="logo">CLIENT RADAR</div>
          <div className="headerNote">ИНН → компания → до 20 полезных публикаций</div>
        </div>
      </header>

      <section className={data ? "searchSection compactSearch" : "searchSection"}>
        {!data && (
          <>
            <h1>Что реально происходило у компании</h1>
            <p>
              Введите ИНН. Мы определим компанию и её рабочее название,
              найдём содержательные публикации и покажем их обычной лентой — без искусственной склейки.
            </p>
          </>
        )}

        <form className="innForm" onSubmit={analyze}>
          <div className="innField">
            <span>ИНН</span>
            <input
              inputMode="numeric"
              value={inn}
              onChange={function(e) {
                setInn(normalizeInn(e.target.value));
              }}
              placeholder="10 цифр"
              aria-label="ИНН"
            />
          </div>

          <button disabled={loading}>
            {loading ? "Ищем…" : data ? "Другая компания" : "Найти новости"}
          </button>
        </form>
      </section>

      {loading && (
        <section className="loadingPanel">
          <div className="spinner" />
          <div>
            <strong>Ищем нормальные публикации о компании</strong>
            <span>Проверяем название и бренд, собираем широкий пул и убираем дубли и случайные упоминания.</span>
          </div>
        </section>
      )}

      {error && (
        <section className="errorPanel">
          <strong>Не получилось собрать новости</strong>
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

              {data.aliases && data.aliases.length > 0 && (
                <div className="aliases">
                  Ищем как: {data.aliases.join(" · ")}
                </div>
              )}
            </div>

            <div className="period">Последние 12 месяцев</div>
          </section>

          {data.relations && data.relations.length > 0 && (
            <details className="relationsSimple">
              <summary>Подтвержденные лица</summary>
              <div>
                {data.relations.map(function(item, index) {
                  return (
                    <span key={index}>
                      <b>{item.type}:</b> {item.name}
                      {item.post ? " · " + item.post : ""}
                      {item.share ? " · доля " + item.share : ""}
                    </span>
                  );
                })}
              </div>
            </details>
          )}

          <section className="digestLine">
            Найдено <b>{data.stats.collected}</b> кандидатов ·
            в итоговой ленте <b>{data.stats.events}</b>
            {data.newsMode === "web-search" && <> · <b>web-поиск включен</b></>}
          </section>

          <section className="newsHeader">
            <div>
              <h2>Новости компании</h2>
              <p>{data.methodology}</p>
            </div>
          </section>

          {data.events.length === 0 ? (
            <section className="emptyPanel">
              <strong>Содержательных публикаций не нашли</strong>
              <p>Лучше показать пустую ленту, чем новости чужой компании или случайные упоминания.</p>
            </section>
          ) : (
            <section className="timeline">
              {data.events.map(function(event) {
                return (
                  <article className="timelineItem" key={event.id}>
                    <label className="timelineCheck" title="Добавить в письмо">
                      <input
                        type="checkbox"
                        checked={selected.includes(event.id)}
                        onChange={function() {
                          toggle(event.id);
                        }}
                      />
                    </label>

                    <div className="timelineDate">
                      {formatDate(event.date)}
                    </div>

                    <div className="timelineContent">
                      <div className="newsTopline">
                        <div className="eventCategory">{event.category}</div>
                        {event.sourceName && (
                          <div className="sourceName">{event.sourceName}</div>
                        )}
                      </div>

                      <h3>
                        {event.url ? (
                          <a href={event.url} target="_blank" rel="noreferrer">
                            {event.title}
                          </a>
                        ) : (
                          event.title
                        )}
                      </h3>

                      {event.details && <p>{event.details}</p>}

                      {event.url && (
                        <a className="readSource" href={event.url} target="_blank" rel="noreferrer">
                          Открыть источник ↗
                        </a>
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
                <strong>
                  {selected.length
                    ? "Выбрано публикаций: " + selected.length
                    : "Можно отметить нужные публикации"}
                </strong>
                <span>Из отмеченных новостей соберём короткий черновик письма.</span>
              </div>

              <button onClick={openLetter}>Составить письмо</button>
            </div>
          )}
        </>
      )}

      <footer>
        Client Radar ищет публичные материалы о конкретной компании и показывает их в хронологическом порядке.
      </footer>

      {letterOpen && (
        <div
          className="modalBackdrop"
          onMouseDown={function() {
            setLetterOpen(false);
          }}
        >
          <div
            className="modal"
            onMouseDown={function(e) {
              e.stopPropagation();
            }}
          >
            <div className="modalHeader">
              <h2>Черновик письма</h2>
              <button
                onClick={function() {
                  setLetterOpen(false);
                }}
              >
                ×
              </button>
            </div>

            <textarea
              value={letter}
              onChange={function(e) {
                setLetter(e.target.value);
              }}
            />

            <div className="modalActions">
              <button
                onClick={function() {
                  navigator.clipboard.writeText(letter);
                }}
              >
                Копировать
              </button>

              <a
                href={
                  "mailto:?subject=" +
                  encodeURIComponent("Актуальные события компании") +
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
