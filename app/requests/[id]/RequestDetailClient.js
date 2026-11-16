"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {byId,LABELS,formatMoney,formatDate} from "../../../lib/requests";
import {loadFavoriteIds,loadLocalRequests,saveFavoriteIds} from "../../../lib/browser-demo";

function Icon({name,size=18,filled=false}){
 const shape=name==="star"?"m12 2 3.1 6.3 7 1-5 4.9 1.2 7-6.3-3.3L5.7 20l1.2-7-5-4.9 7-1L12 2z"
   :"M20 12H4m6-6-6 6 6 6";
 return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?"currentColor":"none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={shape}/></svg>;
}
function Status({status}){
 return <span className={"status status-"+status}>{status==="realized"?"✓ ":""}{LABELS[status]||"Активна"}</span>;
}
function DetailRows({rows}){
 return <dl className="detail-rows">{rows.filter(r=>r[1]!=null&&r[1]!=="").map(([name,value],i)=><div className="detail-field" key={name+"-"+i}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}
export default function RequestDetailClient({id}){
 const [created,setCreated]=useState([]);
 const [favorites,setFavorites]=useState([]);
 const [loaded,setLoaded]=useState(false);
 const [from,setFrom]=useState("catalog");
 const [note,setNote]=useState("");
 useEffect(()=>{
   setCreated(loadLocalRequests());
   setFavorites(loadFavoriteIds());
   const params=new URLSearchParams(window.location.search);
   const nextFrom=params.get("from");
   if(["catalog","mine","archive","favorites"].includes(nextFrom))setFrom(nextFrom);
   setLoaded(true);
 },[]);
 const request=useMemo(()=>byId(id)||created.find(r=>r.id===id),[id,created]);
 const favored=favorites.includes(id);
 const returnHref=from==="mine"?"/?view=mine":from==="archive"?"/?view=archive":from==="favorites"?"/?view=favorites":request?.direction==="sell"?"/?tab=sell":"/";
 const returnTitle=from==="mine"?"Мои заявки":from==="archive"?"Архив заявок":from==="favorites"?"Избранное":request?.direction==="buy"?"Заявки на покупку":"Заявки на продажу";
 const toggleFavorite=()=>{
   const next=favored?favorites.filter(x=>x!==id):[...favorites,id];
   setFavorites(next);
   if(!saveFavoriteIds(next))setNote("Не удалось сохранить избранное в браузере.");
 };
 if(!request){
   return <div className="detail-page-wrapper"><header className="topbar"><div className="topbar-inner"><div className="brand"><Link className="brand-button" href="/">M&A Bridge</Link><span className="site-demo">Демо</span></div></div></header>
     <div className="body-container detail-body"><div className="detail-sheet detail-missing"><h1>{loaded?"Заявка не найдена":"Открываем заявку…"}</h1><p>{loaded?"Возможно, это заявка, созданная в другом браузере. Локальные заявки не синхронизируются.":""}</p><Link href="/">← Вернуться в каталог</Link></div></div></div>;
 }
 const amount=request.priceMin===request.priceMax?formatMoney(request.priceMin):formatMoney(request.priceMin)+" — "+formatMoney(request.priceMax);
 const ownedView=from==="mine"&&request.owned;
 return <div className="detail-page-wrapper">
   <header className="topbar"><div className="topbar-inner"><div className="brand"><Link className="brand-button" href="/">M&A Bridge</Link><span className="site-demo">Демо</span></div><span className="detail-top-label">Карточка заявки</span></div></header>
   <div className="body-container detail-body">
     <nav className="breadcrumbs"><Link href={returnHref}><Icon name="back" size={17}/> Назад: {returnTitle}</Link><span>/</span><span>{request.id}</span></nav>
     <article className="detail-sheet">
       <div className="detail-top">
         <div className="detail-fav-actions">
           <div className="detail-badges"><span className="category-label">{request.direction==="buy"?"Покупка":"Продажа"}</span><span className="detail-id">№ {request.id}</span><Status status={request.status}/></div>
           <button className={"detail-star-toggle "+(favored?"is-favorite":"")} aria-pressed={favored} onClick={toggleFavorite}><Icon name="star" size={17} filled={favored}/>{favored?"В избранном":"В избранное"}</button>
         </div>
         <h1>{request.title}</h1><p>{request.summary}</p>
         <div className="detail-metrics">
           <div><small>Стоимость / бюджет</small><strong>{amount}</strong></div>
           <div><small>География</small><strong>{request.regions.join(" / ")}</strong></div>
           <div><small>Тип актива</small><strong>{request.category}</strong></div>
         </div>
         {request.source==="browser"&&<p className="browser-created-note">Эта заявка создана в текущем браузере. Она не передана в банк и не доступна другим пользователям.</p>}
         {note&&<p className="storage-alert" role="alert">{note}</p>}
       </div>
       <section className="detail-section">
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
       </section>
       <section className="detail-section">
         <h2>Характеристики {request.category==="Компания"?"бизнеса":"объекта"}</h2>
         {Array.isArray(request.info)&&request.info.length?<DetailRows rows={request.info}/>:<p className="detail-comment">Дополнительные характеристики не указаны.</p>}
       </section>
       <section className="detail-section">
         <h2>Сопровождение заявки</h2>
         <DetailRows rows={[
           ["Менеджер",request.manager],
           ["Бизнес-юнит",request.unit],
           ["Дата размещения",formatDate(request.date)],
           ...(request.closedDate?[["Дата закрытия",formatDate(request.closedDate)]]:[]),
           ["Статус",LABELS[request.status]||"Активна"]
         ]}/>
         {request.status==="realized"&&<div className="result-note realized-note">✓ Сделка реализована. Заявка находится в архиве.</div>}
         {request.status==="closed"&&<div className="result-note closed-note">Заявка закрыта без реализации сделки.</div>}
       </section>
       <section className="detail-section"><h2>Дополнительный комментарий</h2><p className="detail-comment">{request.notes||"Не указан"}</p></section>
       {ownedView?<section className="detail-section restricted-section">
          <div className="private-title"><span className="private-lock">◈</span><div><h2>Закрытые сведения — моя заявка</h2><p>Демо: эти поля показываются в разделе «Мои заявки».</p></div></div>
          <DetailRows rows={[["Клиент",request.client||"Не указан"],["Точный адрес",request.address||"Не указан"]]}/>
          <p className="private-disclaimer">Внимание: это только визуальная имитация прав доступа. Для реальных банковских данных необходимы корпоративная авторизация, серверные ACL и согласование ИБ.</p>
       </section>:<div className="detail-hidden"><span className="hidden-symbol">◈</span><p>Клиент и точный адрес не отображаются в общем каталоге. Для собственных заявок они доступны через «Мои заявки».</p></div>}
       <div className="detail-bottom"><Link href={returnHref}><Icon name="back" size={17}/> Вернуться к списку</Link><span>Демо — данные только в браузере</span></div>
     </article>
   </div>
 </div>;
}
