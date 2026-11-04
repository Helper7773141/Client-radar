import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_REQUESTS, DETAIL_FIELDS } from "../../../lib/demo-requests";

export function generateStaticParams() {
  return Object.values(DEMO_REQUESTS).map((request) => ({ id: request.id }));
}

export default async function RequestDetails({ params }) {
  const { id } = await params;
  const tab = Object.keys(DEMO_REQUESTS).find((key) => DEMO_REQUESTS[key].id === id);
  if (!tab) notFound();

  const request = DEMO_REQUESTS[tab];

  return (
    <main className="page detail-page">
      <header className="header">
        <div>
          <Link href="/" className="home-link">M&A Bridge</Link>
          <p>Каталог заявок на покупку и продажу активов</p>
        </div>
        <span className="header-label">Демо-версия</span>
      </header>

      <nav className="detail-navigation">
        <Link href={tab === "buy" ? "/" : "/?tab=sell"} className="back-link">
          <span aria-hidden="true">←</span> Назад к заявкам
        </Link>
        <span>№ {request.id}</span>
      </nav>

      <article className="detail-sheet">
        <div className="detail-hero">
          <div className="request-meta">
            <span className="detail-category">{tab === "buy" ? "Покупка" : "Продажа"}</span>
            <span className="demo-pill">Демо</span>
          </div>
          <h1>{request.title}</h1>
          <p>{request.description}</p>
        </div>

        <div className="detail-body">
          <h2>Параметры заявки</h2>
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
      </article>

      <footer className="footer">Демонстрационная заявка. Все сведения вымышлены. Сайт не сохраняет данные.</footer>
    </main>
  );
}
