"use client";

import { useMemo, useState } from "react";

const MODES = { bank: "🏦 Банк", investor: "📈 Инвестор", owner: "🏢 Собственник" };
const QUICK = ["Северсталь", "X5", "Норникель", "Аэрофлот"];

function fmtDate(value) {
  try { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
  catch { return value; }
}

function buildLetter(company, events, recipient, manager, tone) {
  const hello = recipient.trim() ? recipient.trim() + ", добрый день." : "Добрый день.";
  const topics = events.slice(0, 3).map(function(e) {
    return e.title.replace(/^Демонстрационный пример:\s*/i, "").replace(/[.!?]+$/g, "");
  });
  let topicText = "";
  if (topics.length === 1) topicText = topics[0];
  if (topics.length > 1) topicText = topics.slice(0, -1).join(", ") + " и " + topics[topics.length - 1];
  const products = Array.from(new Set(events.flatMap(function(e) { return e.products || []; }))).slice(0, 4);
  const parts = [
    hello,
    "",
    topicText ? "Обратил внимание на публичные сообщения о " + topicText.charAt(0).toLowerCase() + topicText.slice(1) + "." : "Обратил внимание на несколько актуальных публичных событий вокруг " + company.name + ".",
    "",
    tone === "short"
      ? "Хотел уточнить, могут ли в этой связи быть актуальны " + products.join(", ").toLowerCase() + "."
      : "С учетом этих событий хотел уточнить, могут ли быть актуальны решения в части " + products.join(", ").toLowerCase() + ". Со своей стороны можем посмотреть возможную структуру и обсудить, какие инструменты действительно имеют смысл для текущих задач компании.",
    "",
    tone === "friendly" ? "Если тема актуальна, давайте коротко созвонимся и сверим, где мы можем быть полезны." : "Если вопрос актуален, предлагаю коротко обсудить возможные варианты."
  ];
  if (manager.trim()) parts.push("", "С уважением,", manager.trim());
  return parts.join("\n");
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("bank");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Все");
  const [selected, setSelected] = useState([]);
  const [mailOpen, setMailOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [manager, setManager] = useState("");
  const [tone, setTone] = useState("business");
  const [letter, setLetter] = useState("");

  const categories = useMemo(function() {
    if (!data || !data.events || !data.events.length) return ["Все"];
    return ["Все"].concat(Array.from(new Set(data.events.map(function(e) { return e.category; }))));
  }, [data]);

  const visible = useMemo(function() {
    if (!data || !data.events) return [];
    return filter === "Все" ? data.events : data.events.filter(function(e) { return e.category === filter; });
  }, [data, filter]);

  const selectedEvents = useMemo(function() {
    return (data && data.events ? data.events : []).filter(function(e) { return selected.includes(e.id); });
  }, [data, selected]);

  const productSummary = useMemo(function() {
    const src = (data && data.events ? data.events : []).filter(function(e) { return e.confidence !== "Низкая"; });
    const counts = new Map();
    src.flatMap(function(e) { return e.products || []; }).forEach(function(p) { counts.set(p, (counts.get(p) || 0) + 1); });
    return Array.from(counts.entries()).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5).map(function(x) { return x[0]; });
  }, [data]);

  async function analyze(value) {
    const q = String(value !== undefined ? value : query).trim();
    if (!q) return;
    setQuery(q); setLoading(true); setError(""); setData(null); setSelected([]); setFilter("Все");
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Ошибка анализа");
      setData(payload);
    } catch (e) { setError(e.message || "Не удалось получить данные"); }
    finally { setLoading(false); }
  }

  function toggle(id) {
    setSelected(function(prev) { return prev.includes(id) ? prev.filter(function(x) { return x !== id; }) : prev.concat(id); });
  }

  function generateLetter() {
    const events = selectedEvents.length ? selectedEvents : (data && data.events ? data.events.slice(0, 2) : []);
    setLetter(buildLetter(data.company, events, recipient, manager, tone));
  }

  function openMail() { generateLetter(); setMailOpen(true); }

  const strong = data && data.events ? data.events.filter(function(e) { return e.confidence === "Высокая"; }).length : 0;

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brandMark">CR</span><div><b>CLIENT RADAR</b><small>Публичные сигналы → коммерческие возможности</small></div></div>
        <div className="modeSwitch">
          {Object.entries(MODES).map(function(entry) {
            return <button key={entry[0]} className={mode === entry[0] ? "active" : ""} onClick={function() { setMode(entry[0]); }}>{entry[1]}</button>;
          })}
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">CLIENT INTELLIGENCE</div>
        <h1>Поймите, <span>что предложить компании</span> прямо сейчас</h1>
        <p>Введите название или ИНН. Client Radar собирает свежие публичные сигналы и переводит их в понятные поводы для разговора с клиентом.</p>
        <form className="searchBox" onSubmit={function(e) { e.preventDefault(); analyze(); }}>
          <input value={query} onChange={function(e) { setQuery(e.target.value); }} placeholder="Например: Северсталь или 3528000597" />
          <button disabled={loading}>{loading ? "Анализируем…" : "Анализировать"}</button>
        </form>
        <div className="quick"><span>Попробовать:</span>{QUICK.map(function(name) { return <button key={name} onClick={function() { analyze(name); }}>{name}</button>; })}</div>
      </section>

      {error && <div className="alert error">{error}</div>}

      {loading && <section className="loadingCard"><div className="spinner" /><div><b>Ищем свежие сигналы</b><p>Проверяем открытые источники и классифицируем события.</p></div></section>}

      {data && <>
        <section className="company">
          <div>
            <div className="statusRow"><span className={"status " + data.mode}>{data.mode === "live" ? "LIVE" : "DEMO"}</span>{data.dadataUsed && <span className="verified">Юрлицо подтверждено</span>}</div>
            <h2>{data.company.name}</h2>
            <div className="meta">{data.company.inn && <span>ИНН {data.company.inn}</span>}{data.company.ogrn && <span>ОГРН {data.company.ogrn}</span>}{data.company.region && <span>{data.company.region}</span>}{data.company.activity && <span>{data.company.activity}</span>}</div>
            {data.notice && <p className="notice">{data.notice}</p>}
          </div>
          <button className="refresh" onClick={function() { analyze(query); }}>↻ Обновить</button>
        </section>

        <section className="summaryGrid">
          <div className="metric"><strong>{data.events.length}</strong><span>событий найдено</span></div>
          <div className="metric"><strong>{strong}</strong><span>сильных сигналов</span></div>
          <div className="metric"><strong>{productSummary.length}</strong><span>ключевых продуктов</span></div>
          <div className="opportunity"><small>Что стоит обсудить</small><div>{productSummary.length ? productSummary.map(function(p) { return <span key={p}>{p}</span>; }) : <em>Недостаточно сигналов</em>}</div></div>
        </section>

        <section className="controls">
          <div className="filters">{categories.map(function(cat) { return <button key={cat} onClick={function() { setFilter(cat); }} className={filter === cat ? "active" : ""}>{cat}</button>; })}</div>
          <div className="selectedCount">Выбрано: <b>{selected.length}</b></div>
        </section>

        {!data.events.length ? <div className="empty"><h3>Свежих публикаций не найдено</h3><p>Попробуйте другое написание компании. Для известных demo-компаний доступен резервный демонстрационный режим.</p></div> :
          <section className="feed">{visible.map(function(event) {
            return <article className="signal" key={event.id}>
              <div className="signalTop"><div className="tags"><span className="category">{event.category}</span><span className={"confidence c" + event.confidence}>{event.confidence}</span>{event.isDemo && <span className="demoTag">Демонстрационные данные</span>}</div><time>{fmtDate(event.date)}</time></div>
              <h3>{event.title}</h3>
              <p className="summary">{event.summary}</p>
              <div className="analysis"><small>{mode === "bank" ? "Возможный банковский сигнал" : mode === "investor" ? "Взгляд инвестора" : "Взгляд собственника"}</small><p>{event[mode]}</p></div>
              <div className="products"><small>{mode === "bank" ? "Что можно обсудить" : "Ключевые темы"}</small><div>{event.products.map(function(p) { return <span key={p}>{p}</span>; })}</div></div>
              <div className="signalFooter"><label className="check"><input type="checkbox" checked={selected.includes(event.id)} onChange={function() { toggle(event.id); }} /> Использовать в письме</label>{event.url ? <a href={event.url} target="_blank" rel="noreferrer">{event.sourceName} ↗</a> : <span className="source">{event.sourceName}</span>}</div>
            </article>;
          })}</section>
        }

        {data.events.length > 0 && <div className="mailBar"><div><b>{selected.length ? "Выбрано событий: " + selected.length : "Можно выбрать события галочками"}</b><span>Соберём черновик письма без платного AI.</span></div><button onClick={openMail}>✉ Составить письмо</button></div>}
      </>}

      <footer>Client Radar использует публично доступную информацию. Выводы о возможных потребностях компании являются аналитическими гипотезами и требуют проверки клиентским менеджером.</footer>

      {mailOpen && <div className="modalBackdrop" onMouseDown={function() { setMailOpen(false); }}><div className="modal" onMouseDown={function(e) { e.stopPropagation(); }}>
        <div className="modalHead"><div><small>CLIENT RADAR</small><h2>Черновик письма</h2></div><button onClick={function() { setMailOpen(false); }}>×</button></div>
        <div className="mailFields">
          <input value={recipient} onChange={function(e) { setRecipient(e.target.value); }} placeholder="Имя получателя, например Иван Иванович" />
          <input value={manager} onChange={function(e) { setManager(e.target.value); }} placeholder="Ваше имя" />
          <select value={tone} onChange={function(e) { setTone(e.target.value); }}><option value="business">Деловой</option><option value="short">Короткий</option><option value="friendly">Дружелюбный</option></select>
          <button className="secondary" onClick={generateLetter}>Сформировать заново</button>
        </div>
        <textarea value={letter} onChange={function(e) { setLetter(e.target.value); }} />
        <div className="modalActions"><button className="secondary" onClick={function() { navigator.clipboard.writeText(letter); }}>Копировать</button><a className="primaryLink" href={"mailto:?subject=" + encodeURIComponent("Возможные направления сотрудничества") + "&body=" + encodeURIComponent(letter)}>Открыть в почте</a></div>
      </div></div>}
    </main>
  );
}
