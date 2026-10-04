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

function makeLetter(company, stories) {
  const selected = stories.slice(0, 4);
  const products = Array.from(new Set(
    selected.flatMap(function(story) {
      return story.products || [];
    })
  )).slice(0, 5);

  const lines = selected.map(function(story) {
    return "— " + story.headline;
  });

  return [
    "Добрый день.",
    "",
    "Обратил внимание на несколько актуальных событий вокруг " + company.name + ":",
    lines.join("\n"),
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
  const [letterOpen, setLetterOpen] = useState(false);
  const [letter, setLetter] = useState("");

  const selectedStories = useMemo(function() {
    if (!data) return [];
    return data.stories.filter(function(story) {
      return selected.includes(story.id);
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
    const chosen = selectedStories.length
      ? selectedStories
      : data.stories.slice(0, 3);

    setLetter(makeLetter(data.company, chosen));
    setLetterOpen(true);
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <div className="logo">CLIENT RADAR</div>
          <div className="headerNote">ИНН → компания → главные события</div>
        </div>
      </header>

      <section className={data ? "searchSection compactSearch" : "searchSection"}>
        {!data && (
          <>
            <h1>Что важного произошло у компании</h1>
            <p>
              Введите ИНН. Сервис определит юрлицо, соберёт свежие публикации,
              объединит одинаковые новости и оставит только главные сюжеты.
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
            {loading ? "Собираем новости…" : data ? "Другая компания" : "Показать главное"}
          </button>
        </form>
      </section>

      {loading && (
        <section className="loadingPanel">
          <div className="spinner" />
          <div>
            <strong>Собираем публикации и выделяем главное</strong>
            <span>Проверяем новостные источники и официальный сайт компании, если он находится автоматически.</span>
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

              {data.officialDomain && (
                <div className="officialFound">
                  Официальный сайт найден: <b>{data.officialDomain}</b>
                </div>
              )}
            </div>

            <div className="period">Последние {data.lookbackDays} дней</div>
          </section>

          <section className="digestLine">
            Собрано <b>{data.stats.articlesCollected}</b> публикаций ·
            относятся к компании <b>{data.stats.relevantArticles}</b> ·
            источников <b>{data.stats.sourcesFound}</b> ·
            главных сюжетов <b>{data.stats.storiesFound}</b>
          </section>

          <section className="newsHeader">
            <div>
              <h2>Главное</h2>
              <p>{data.methodology}</p>
            </div>
          </section>

          {data.stories.length === 0 ? (
            <section className="emptyPanel">
              <strong>За последние 90 дней значимых публикаций не найдено</strong>
              <p>Сервис ничего не подставляет искусственно.</p>
            </section>
          ) : (
            <section className="newsList">
              {data.stories.map(function(story, index) {
                return (
                  <article className="storyItem" key={story.id}>
                    <label className="newsCheck" title="Добавить в письмо">
                      <input
                        type="checkbox"
                        checked={selected.includes(story.id)}
                        onChange={function() {
                          toggle(story.id);
                        }}
                      />
                    </label>

                    <div className="storyRank">{index + 1}</div>

                    <div className="newsContent">
                      <div className="newsTop">
                        <div className="newsBadges">
                          <span className="categoryBadge">{story.category}</span>

                          {story.factStageKey !== "reported" && (
                            <span className={"stageBadge " + story.factStageKey}>
                              {story.factStage}
                            </span>
                          )}
                        </div>

                        <time>{formatDate(story.date)}</time>
                      </div>

                      <h3>{story.headline}</h3>

                      {story.summary && (
                        <div className="summaryText">
                          <small>Суть</small>
                          <p>{story.summary}</p>
                        </div>
                      )}

                      {story.isSignal && (
                        <div className="signalBox">
                          <small>Что это может значить для банка</small>
                          <p>{story.impact}</p>

                          {story.products.length > 0 && (
                            <div className="productChips">
                              {story.products.map(function(product) {
                                return <span key={product}>{product}</span>;
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="storyFooter">
                        <span>{story.sourceCount} источн.</span>

                        <div className="sourceList">
                          {story.sources.map(function(source, sourceIndex) {
                            return source.url
                              ? (
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  key={sourceIndex}
                                >
                                  {source.name || source.domain} ↗
                                </a>
                              )
                              : (
                                <span key={sourceIndex}>
                                  {source.name || source.domain}
                                </span>
                              );
                          })}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {data.stories.length > 0 && (
            <div className="letterBar">
              <div>
                <strong>
                  {selected.length
                    ? "Выбрано событий: " + selected.length
                    : "Выберите события для письма"}
                </strong>
                <span>Отметьте только те сюжеты, которые подходят для разговора с клиентом.</span>
              </div>

              <button onClick={openLetter}>Составить письмо</button>
            </div>
          )}
        </>
      )}

      <footer>
        Client Radar агрегирует публичные публикации и делает краткую выжимку.
        Банковские выводы являются гипотезами и требуют проверки первоисточника.
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
