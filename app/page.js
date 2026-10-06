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
    "Обратил внимание на несколько актуальных событий вокруг " + company.name + ":",
    lines.join("\n"),
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
        throw new Error(payload.error || "Не удалось выполнить анализ.");
      }

      setData(payload);
    } catch (e) {
      setError(e.message || "Не удалось выполнить анализ.");
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
          <div className="headerNote">ИНН → компания → события за 90 дней</div>
        </div>
      </header>

      <section className={data ? "searchSection compactSearch" : "searchSection"}>
        {!data && (
          <>
            <h1>Что произошло у компании</h1>
            <p>
              Введите ИНН. Мы определим компанию, найдём её рабочие названия,
              соберём актуальные публикации и сведём их в короткую хронологию.
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
            {loading ? "Собираем…" : data ? "Другая компания" : "Показать события"}
          </button>
        </form>
      </section>

      {loading && (
        <section className="loadingPanel">
          <div className="spinner" />
          <div>
            <strong>Собираем новости за последние 90 дней</strong>
            <span>Определяем рабочие названия компании, ищем публикации и склеиваем дубли.</span>
          </div>
        </section>
      )}

      {error && (
        <section className="errorPanel">
          <strong>Не получилось выполнить анализ</strong>
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

            <div className="period">Последние {data.lookbackDays} дней</div>
          </section>

          {((data.relations && data.relations.length > 0) ||
            (data.subsidiaries && data.subsidiaries.length > 0) ||
            (data.relatedCompanies && data.relatedCompanies.length > 0)) && (
            <details className="relationsSimple">
              <summary>Подтвержденные связи</summary>
              <div>
                {data.relations && data.relations.map(function(item, index) {
                  return (
                    <span key={"person-" + index}>
                      <b>{item.type}:</b> {item.name}
                      {item.post ? " · " + item.post : ""}
                      {item.share ? " · доля " + item.share : ""}
                    </span>
                  );
                })}

                {data.subsidiaries && data.subsidiaries.map(function(item, index) {
                  return (
                    <span key={"sub-" + index}>
                      <b>Связанная компания:</b> {item.name}
                      {item.share ? " · доля " + item.share : ""}
                    </span>
                  );
                })}

                {data.relatedCompanies && data.relatedCompanies.slice(0, 8).map(function(item, index) {
                  return (
                    <span key={"related-" + index}>
                      <b>Через {item.via}:</b> {item.company.name}
                    </span>
                  );
                })}
              </div>
            </details>
          )}

          <section className="digestLine">
            Собрано <b>{data.stats.collected}</b> публикаций ·
            после проверки <b>{data.stats.relevant}</b> ·
            уникальных событий <b>{data.stats.events}</b>
          </section>

          <section className="newsHeader">
            <div>
              <h2>Хронология</h2>
              <p>{data.methodology}</p>
            </div>
          </section>

          {data.events.length === 0 ? (
            <section className="emptyPanel">
              <strong>За последние 90 дней событий не найдено</strong>
              <p>Если это выглядит неправдоподобно, значит нужно дорабатывать именно идентификацию рабочего названия компании.</p>
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
                      <div className="eventCategory">{event.category}</div>
                      <h3>{event.title}</h3>
                      <p>{event.details}</p>

                      {event.mentions > 1 && (
                        <div className="mentions">
                          Найдено в {event.mentions} публикациях
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
                <strong>
                  {selected.length
                    ? "Выбрано событий: " + selected.length
                    : "Выберите события для письма"}
                </strong>
                <span>Письмо будет собрано только из отмеченных событий.</span>
              </div>

              <button onClick={openLetter}>Составить письмо</button>
            </div>
          )}
        </>
      )}

      <footer>
        Client Radar собирает публичные публикации и сводит их в краткую хронологию.
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
