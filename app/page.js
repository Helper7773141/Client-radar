"use client";

import { useState } from "react";

const DEMO_REQUESTS = {
  buy: {
    id: "B-001",
    status: "Демо",
    title: "Покупка предприятия пищевой промышленности",
    description: "Интерес к приобретению действующего производства молочной продукции.",
    industry: "Обрабатывающие производства",
    subindustry: "Производство молочной продукции",
    okved: "10.51",
    location: "Центральная Россия",
    amount: "До 3 млрд ₽",
    deal: "100% компании или контрольная доля",
    revenue: "От 1 млрд ₽ в год",
    model: "B2B / B2C",
    applicant: "Компания (условный пример)",
    note: "Рассматривается действующее предприятие с устойчивой выручкой и собственной производственной базой."
  },
  sell: {
    id: "S-001",
    status: "Демо",
    title: "Продажа завода молочной продукции",
    description: "Действующее производственное предприятие, продажа бизнеса целиком.",
    industry: "Обрабатывающие производства",
    subindustry: "Производство молочной продукции",
    okved: "10.51",
    location: "Центральная Россия",
    amount: "2,5 млрд ₽",
    deal: "100% компании",
    revenue: "3 млрд ₽ в год",
    model: "B2B / B2C",
    applicant: "Компания (условный пример)",
    note: "Производственные мощности, готовая продукция и действующие каналы сбыта. Все сведения демонстрационные."
  }
};

const DETAIL_FIELDS = [
  ["Отрасль", "industry"],
  ["Подотрасль", "subindustry"],
  ["Код ОКВЭД-2", "okved"],
  ["География", "location"],
  ["Бюджет / стоимость", "amount"],
  ["Тип сделки", "deal"],
  ["Выручка", "revenue"],
  ["Бизнес-модель", "model"],
  ["От кого заявка", "applicant"]
];

export default function Home() {
  const [tab, setTab] = useState("buy");
  const [expanded, setExpanded] = useState(false);
  const request = DEMO_REQUESTS[tab];

  function selectTab(nextTab) {
    setTab(nextTab);
    setExpanded(false);
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>M&A Bridge</h1>
          <p>Каталог заявок на покупку и продажу активов</p>
        </div>
        <span className="header-label">Демо-версия</span>
      </header>

      <section className="workspace" aria-label="Каталог заявок">
        <div className="tabs" role="tablist" aria-label="Направление заявки">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "buy"}
            className={"tab " + (tab === "buy" ? "active" : "")}
            onClick={() => selectTab("buy")}
          >
            Купить
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sell"}
            className={"tab " + (tab === "sell" ? "active" : "")}
            onClick={() => selectTab("sell")}
          >
            Продать
          </button>
        </div>

        <div className="section-heading">
          <div>
            <h2>{tab === "buy" ? "Заявки на покупку" : "Заявки на продажу"}</h2>
            <p>Нажмите на заявку, чтобы посмотреть подробную информацию.</p>
          </div>
          <span className="request-count">1 заявка</span>
        </div>

        <article className={"request " + (expanded ? "request-expanded" : "")}>
          <button
            className="request-summary"
            type="button"
            aria-expanded={expanded}
            aria-controls="request-details"
            onClick={() => setExpanded(value => !value)}
          >
            <div className="request-main">
              <div className="request-meta">
                <span className="request-id">№ {request.id}</span>
                <span className="demo-pill">{request.status}</span>
              </div>
              <h3>{request.title}</h3>
              <p>{request.description}</p>
            </div>
            <div className="request-side">
              <div className="side-field">
                <span>Отрасль</span>
                <strong>{request.subindustry}</strong>
              </div>
              <div className="side-field">
                <span>{tab === "buy" ? "Бюджет" : "Стоимость"}</span>
                <strong>{request.amount}</strong>
              </div>
              <div className="side-field side-location">
                <span>География</span>
                <strong>{request.location}</strong>
              </div>
            </div>
            <span className="request-action" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={expanded ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"}/>
              </svg>
            </span>
          </button>

          {expanded && (
            <div id="request-details" className="details">
              <div className="details-header">
                <h4>Подробности заявки</h4>
                <span>Демонстрационные данные</span>
              </div>
              <dl className="details-grid">
                {DETAIL_FIELDS.map(([label, key]) => (
                  <div className="detail-item" key={key}>
                    <dt>{label}</dt>
                    <dd>{request[key]}</dd>
                  </div>
                ))}
              </dl>
              <div className="note">
                <span>Дополнительная информация</span>
                <p>{request.note}</p>
              </div>
            </div>
          )}
        </article>
      </section>

      <footer className="footer">
        Все заявки и сведения вымышлены для демонстрации интерфейса. Сайт не сохраняет данные.
      </footer>
    </main>
  );
}
