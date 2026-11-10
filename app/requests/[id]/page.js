import Link from "next/link";
import { notFound } from "next/navigation";
import { requests,getRequest,getDetailGroups } from "../../../lib/requests";

export function generateStaticParams() {
  return requests.map((r)=>({id:r.id}));
}

function ArrowLeft() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H4m6-6-6 6 6 6"/></svg>;
}

export default async function RequestPage({params}) {
  const {id}=await params;
  const request=getRequest(id);
  if(!request)notFound();
  const groups=getDetailGroups(request);
  const backHref=request.direction==="buy"?"/":"/?tab=sell";
  return <main className="page detail-page">
    <header className="site-header">
      <div className="brand-area"><Link href="/" className="brand-link">M&A Bridge</Link><p>Единый каталог заявок на покупку и продажу активов</p></div>
      <span className="demo-indicator"><i/>Демонстрационная версия</span>
    </header>

    <div className="breadcrumbs"><Link href={backHref}><ArrowLeft/> Назад к списку</Link><span className="crumb-divider">/</span><span>{request.direction==="buy"?"Покупка":"Продажа"} · {request.id}</span></div>

    <article className="detail-card">
      <div className="detail-intro">
        <div className="detail-labels"><span className="kind-label">{request.direction==="buy"?"Покупка":"Продажа"}</span><span className="request-id-label">{request.id}</span><span className="demo-label">Демо</span></div>
        <h1>{request.title}</h1>
        <p>{request.summary}</p>
      </div>
      <div className="quickfacts">
        <div><span>{request.direction==="buy"?"Бюджет":"Стоимость"}</span><strong>{request.priceLabel}</strong></div>
        <div><span>География</span><strong>{request.geography.join(" / ")}</strong></div>
        <div><span>Тип актива</span><strong>{request.category}</strong></div>
      </div>

      <div className="detail-content">
        {groups.map(group=><section className="detail-group" key={group.title}>
          <h2>{group.title}</h2>
          <dl className="detail-fields">{group.fields.map(([name,value])=><div className="field-row" key={name}><dt>{name}</dt><dd>{value||"Не указано"}</dd></div>)}</dl>
        </section>)}
        <section className="detail-group">
          <h2>Дополнительные комментарии</h2>
          <p className="comment-content">{request.note}</p>
        </section>
        {request.category==="Земельный участок"&&<section className="detail-group optional-group">
          <h2>Дополнительные параметры</h2>
          <p>Для земельных участков промышленного назначения форма может включать эти поля. Для данного участка под ИЖС значения не указаны.</p>
          <dl className="detail-fields">
            <div className="field-row"><dt>Вид производства</dt><dd className="not-filled">Не указано</dd></div>
            <div className="field-row"><dt>Класс опасности / пожароопасность</dt><dd className="not-filled">Не указано</dd></div>
          </dl>
        </section>}
      </div>
      <div className="detail-bottom"><Link href={backHref}><ArrowLeft/> Вернуться к заявкам</Link><small>Демонстрационная заявка · данные не сохраняются</small></div>
    </article>
  </main>;
}
