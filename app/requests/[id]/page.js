import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_REQUESTS, LABELS, byId, formatMoney, formatDate } from "../../../lib/requests";

export function generateStaticParams(){return DEMO_REQUESTS.map(r=>({id:r.id}));}

function BackArrow(){return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H4m6-6-6 6 6 6"/></svg>;}
function Status({status}){return <span className={"status status-"+status}>{status==="realized"&&<span aria-hidden="true">✓ </span>}{LABELS[status]}</span>;}
function DetailRows({rows}){return <dl className="detail-rows">{rows.filter(row=>row[1]).map(([label,value])=><div className="detail-field" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;}

export default async function RequestDetail({params,searchParams}){
  const {id}=await params;
  const qs=await searchParams;
  const request=byId(id);
  if(!request)notFound();
  const from=["mine","archive"].includes(qs?.from)?qs.from:"catalog";
  const ownView=from==="mine"&&request.owned;
  const backHref=from==="mine"?"/?view=mine":from==="archive"?"/?view=archive":request.direction==="sell"?"/?tab=sell":"/";
  const returnTitle=from==="mine"?"Мои заявки":from==="archive"?"Архив заявок":request.direction==="buy"?"Заявки на покупку":"Заявки на продажу";
  const amount=request.priceMin===request.priceMax?formatMoney(request.priceMin):formatMoney(request.priceMin)+" — "+formatMoney(request.priceMax);
  return <main className="detail-page-wrapper">
    <header className="topbar">
      <div className="topbar-inner"><div className="brand"><Link className="brand-button" href="/">M&A Bridge</Link><span className="site-demo">Демо</span></div><span className="detail-top-label">Карточка заявки</span></div>
    </header>
    <div className="body-container detail-body">
      <nav className="breadcrumbs"><Link href={backHref}><BackArrow/> Назад: {returnTitle}</Link><span>/</span><span>{request.id}</span></nav>
      <article className="detail-sheet">
        <div className="detail-top">
          <div className="detail-badges"><span className="category-label">{request.direction==="buy"?"Покупка":"Продажа"}</span><span className="detail-id">№ {request.id}</span><Status status={request.status}/></div>
          <h1>{request.title}</h1>
          <p>{request.summary}</p>
          <div className="detail-metrics">
            <div><small>Стоимость / бюджет</small><strong>{amount}</strong></div>
            <div><small>География</small><strong>{request.regions.join(" / ")}</strong></div>
            <div><small>Тип актива</small><strong>{request.category}</strong></div>
          </div>
        </div>

        <div className="detail-section">
          <h2>Основные параметры</h2>
          <DetailRows rows={[
            ["Направление",request.direction==="buy"?"Покупка":"Продажа"],
            ["Категория актива",request.category],
            ["Отрасль",request.industry],
            ["Подотрасль",request.subindustry],
            ["Код ОКВЭД",request.okved],
            ["Тип сделки",request.deal],
            ["География",request.regions.join(" / ")],
            ["Стоимость / бюджет",amount]
          ]}/>
        </div>
        <div className="detail-section">
          <h2>Характеристики {request.category==="Компания"?"бизнеса":"объекта"}</h2>
          <DetailRows rows={request.info}/>
        </div>
        <div className="detail-section">
          <h2>Сопровождение заявки</h2>
          <DetailRows rows={[
            ["Менеджер",request.manager],
            ["Бизнес-юнит",request.unit],
            ["Дата размещения",formatDate(request.date)],
            ...(request.closedDate?[["Дата закрытия",formatDate(request.closedDate)]]:[]),
            ["Статус",LABELS[request.status]]
          ]}/>
          {request.status==="realized"&&<div className="result-note realized-note">✓ Сделка реализована. Заявка находится в архиве.</div>}
          {request.status==="closed"&&<div className="result-note closed-note">Заявка закрыта без реализации сделки.</div>}
        </div>
        <div className="detail-section">
          <h2>Дополнительный комментарий</h2>
          <p className="detail-comment">{request.notes}</p>
        </div>

        {ownView?<div className="detail-section restricted-section">
          <div className="private-title"><span className="private-lock">◈</span><div><h2>Закрытые сведения — моя заявка</h2><p>В демоверсии эти поля показываются при переходе из раздела «Мои заявки».</p></div></div>
          <DetailRows rows={[["Клиент",request.client],["Точный адрес",request.address]]}/>
          <p className="private-disclaimer">Демонстрация интерфейса, не механизм защиты. В рабочей системе доступ должен проверяться на сервере и через корпоративную авторизацию.</p>
        </div>:<div className="detail-hidden"><span className="hidden-symbol">◈</span><p>Клиент и точный адрес скрыты в общем доступе. Они показываются только владельцу заявки в разделе «Мои заявки».</p></div>}

        <div className="detail-bottom"><Link href={backHref}><BackArrow/> Вернуться к списку</Link><span>Демонстрационные данные · сохранение отключено</span></div>
      </article>
    </div>
  </main>;
}
