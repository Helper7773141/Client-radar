"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEMO_REQUESTS } from "../lib/demo-requests";

export default function Home() {
  const [tab, setTab] = useState("buy");
  const request = DEMO_REQUESTS[tab];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "sell") setTab("sell");
  }, []);

  function selectTab(nextTab) {
    setTab(nextTab);
    window.history.replaceState(null, "", nextTab === "sell" ? "/?tab=sell" : "/");
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
            <p>Нажмите на заявку, чтобы открыть отдельную страницу с подробностями.</p>
          </div>
          <span className="request-count">1 заявка</span>
        </div>

        <article className="request">
          <Link href={"/requests/" + request.id} className="request-summary" aria-label={"Открыть заявку " + request.id + ": " + request.title}>
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
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </span>
          </Link>
        </article>
      </section>

      <footer className="footer">
        Все заявки и сведения вымышлены для демонстрации интерфейса. Сайт не сохраняет данные.
      </footer>
    </main>
  );
}
