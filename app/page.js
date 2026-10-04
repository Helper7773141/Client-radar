"use client";

import { useMemo, useState } from "react";

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

function statusClass(status) {
  return status === "Подтверждено" ? "verifiedEvent" : "reviewEvent";
}

function makeLetter(company, events) {
  const topics = events.slice(0, 4).map(function(event) {
    return event.title.toLowerCase();
  });
  const products = Array.from(new Set(events.flatMap(function(event) { return event.products || []; }))).slice(0, 5);
  return [
    "Добрый день.",
    "",
    "Обратил внимание на несколько актуальных событий, которые могут быть релевантны для " + company.name + ": " + topics.join(", ") + ".",
    "",
    "Хотел уточнить, могут ли в этой связи быть актуальны решения в части " + products.join(", ").toLowerCase() + ".",
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
  const [letterOpen, setLetterOpen] = useState(false);
  const [letter, setLetter] = useState("");

  const selectedEvents = useMemo(function() {
    if (!data) return [];
    return data.events.filter(function(event) { return selected.includes(event.id); });
  }, [data, selected]);

  function normalizeInn(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 10);
  }

  async function analyze(event) {
    if (event) event.preventDefault();
    const value = normalizeInn(inn);
    if (value.length !== 10) {
      setError({ message: "Введите 10-значный ИНН юридического лица.", code: "INVALID_INN" });
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
        const e = new Error(payload.error || "Ошибка анализа");
        e.code = payload.code;
        throw e;
      }
      setData(payload);
    } catch (e) {
      setError({ message: e.message, code: e.code || "ERROR" });
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setSelected(function(prev) {
      return prev.includes(id) ? prev.filter(function(x) { return x !== id; }) : prev.concat(id);
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
        <div className="logo">CLIENT RADAR</div>
        <div className="headerNote">Проверенные события для корпоративного менеджера</div>
      </header>

      <section className="searchSection">
        <h1>Введите ИНН компании</h1>
        <p>Сначала идентифицируем юридическое лицо. Только после этого ищем и проверяем новости о компании, связанных лицах и отрасли.</p>
        <form className="innForm" onSubmit={analyze}>
          <input
            inputMode="numeric"
            value={inn}
            onChange={function(e) { setInn(normalizeInn(e.target.value)); }}
            placeholder="10 цифр"
            aria-label="ИНН юридического лица"
          />
          <button disabled={loading}>{loading ? "Проверяем…" : "Найти и проанализировать"}</button>
        </form>
      </section>

      {loading && (
        <section className="loadingPanel">
          <div className="spinner" />
          <div>
            <strong>Идентифицируем компанию и проверяем источники</strong>
            <span>Это может занять несколько секунд: источники опрашиваются независимо.</span>
          </div>
        </section>
      )}

      {error && (
        <section className="errorPanel">
          <strong>{error.code === "CONFIG_REQUIRED" ? "Нужно один раз подключить идентификацию по ИНН" : "Не получилось выполнить анализ"}</strong>
          <p>{error.message}</p>
          {error.code === "CONFIG_REQUIRED" && (
            <p className="setupHint">После добавления DADATA_TOKEN в Vercel этот экран исчезнет и поиск станет реальным. Демонстрационные данные больше не используются.</p>
          )}
        </section>
      )}

      {data && (
        <>
          <section className="companyCard">
            <div className="companyIdentity">
              <div className="verifiedBadge">Юрлицо подтверждено по ИНН</div>
              <h2>{data.company.name}</h2>
              <div className="companyMeta">
                <span>ИНН {data.company.inn}</span>
                {data.company.ogrn && <span>ОГРН {data.company.ogrn}</span>}
                {data.company.kpp && <span>КПП {data.company.kpp}</span>}
                {data.company.okved && <span>ОКВЭД {data.company.okved}</span>}
              </div>
              {data.company.management && data.company.management.name && (
                <div className="director">Руководитель: <b>{data.company.management.name}</b>{data.company.management.post ? " · " + data.company.management.post : ""}</div>
              )}
            </div>
            <div className="period">Анализ: последние 90 дней</div>
          </section>

          <section className="stats">
            <div><strong>{data.stats.sourcesInContour}</strong><span>источников в контуре</span></div>
            <div><strong>{data.stats.sourcesWithMatches}</strong><span>дали релевантные публикации</span></div>
            <div><strong>{data.stats.publicationsReviewed}</strong><span>публикаций просмотрено</span></div>
            <div><strong>{data.stats.eventsFound}</strong><span>значимых событий</span></div>
          </section>

          {data.relations && data.relations.length > 0 && (
            <details className="relations">
              <summary>Связанные лица и учредители, подтвержденные источником</summary>
              <div className="relationList">
                {data.relations.map(function(item, index) {
                  return <div key={index}><span>{item.type}</span><b>{item.name}</b>{item.detail && <small>{item.detail}</small>}</div>;
                })}
              </div>
            </details>
          )}

          <section className="eventsHeader">
            <div>
              <h2>Что произошло</h2>
              <p>{data.methodology}</p>
            </div>
            {data.events.length > 0 && <div className="selectedLabel">Выбрано: {selected.length}</div>}
          </section>

          {data.events.length === 0 ? (
            <section className="emptyPanel">
              <strong>Значимых подтвержденных событий не найдено</strong>
              <p>Это лучше, чем показывать нерелевантный шум. Мы не подставляем вымышленные новости.</p>
            </section>
          ) : (
            <section className="eventList">
              {data.events.map(function(event) {
                return (
                  <article className="eventRow" key={event.id}>
                    <label className="eventCheck">
                      <input type="checkbox" checked={selected.includes(event.id)} onChange={function() { toggle(event.id); }} />
                    </label>
                    <details className="eventDetails">
                      <summary>
                        <div className="eventMain">
                          <div className="eventTitleLine">
                            <h3>{event.title}</h3>
                            {event.scope && <span className="scopeBadge">{event.scope}</span>}
                          </div>
                          <div className="eventMeta">
                            <span className={statusClass(event.status)}>{event.status}</span>
                            <span>{event.confidence}% уверенность</span>
                            <span>{event.sourceCount} источн.</span>
                            <span>{formatDate(event.latestDate)}</span>
                          </div>
                        </div>
                        <div className="chevron">⌄</div>
                      </summary>

                      <div className="eventBody">
                        <div className="evidence">
                          <small>Основание</small>
                          <p>{event.evidenceHeadline}</p>
                        </div>
                        <div className="impact">
                          <small>Почему это важно</small>
                          <p>{event.impact}</p>
                        </div>
                        <div className="products">
                          <small>Что можно обсудить с клиентом</small>
                          <div>{event.products.map(function(product) { return <span key={product}>{product}</span>; })}</div>
                        </div>
                        <div className="sources">
                          <small>Подтверждения</small>
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

          {data.events.length > 0 && (
            <div className="letterBar">
              <div>
                <strong>{selected.length ? "Событий выбрано: " + selected.length : "Выберите нужные события"}</strong>
                <span>Из них можно собрать короткий черновик клиентского письма.</span>
              </div>
              <button onClick={openLetter}>Составить письмо</button>
            </div>
          )}
        </>
      )}

      <footer>
        Система показывает только публичные сигналы. Оценка влияния — аналитическая гипотеза, а не утверждение о финансовом состоянии или потребности клиента.
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
              <a href={"mailto:?subject=" + encodeURIComponent("Актуальные направления для обсуждения") + "&body=" + encodeURIComponent(letter)}>Открыть в почте</a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
