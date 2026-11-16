"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {DEMO_REQUESTS,KINDS,INDUSTRIES,REGIONS,LABELS,formatMoney,formatDate} from "../lib/requests";
import {loadLocalRequests,loadFavoriteIds,saveLocalRequests,saveFavoriteIds} from "../lib/browser-demo";
import CreateRequestModal from "../components/CreateRequestModal";

function Icon({name,size=18,filled=false}){
 const paths={
  search:"M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35",
  menu:"M4 6h16 M4 12h16 M4 18h16",close:"M18 6 6 18 M6 6l12 12",
  chevron:"m9 18 6-6-6-6",right:"M5 12h14m-6-6 6 6-6 6",
  user:"M20 21a8 8 0 0 0-16 0 M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  archive:"M4 4h16v5H4z M6 9v12h12V9 M10 13h4",
  filter:"M4 7h16 M7 12h10 M10 17h4",
  shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  check:"m5 12 4 4L19 6",plus:"M12 5v14 M5 12h14",
  star:"m12 2 3.1 6.3 7 1-5 4.9 1.2 7-6.3-3.3L5.7 20l1.2-7-5-4.9 7-1L12 2z",
  info:"M12 17v-5 M12 8h.01 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?"currentColor":"none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.info}/></svg>;
}
const emptyFilters={query:"",kind:"",industry:"",region:"",min:"",max:"",date:"",sort:"new"};
function Select({label,value,onChange,options,empty="Все"}){
 return <label className="filter-control"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}><option value="">{empty}</option>{options.map(o=><option key={o} value={o}>{label==="Дата размещения"?"За "+o+" дней":o}</option>)}</select></label>;
}
function StatusBadge({status}){
 return <span className={"status status-"+status}>{status==="realized"&&<Icon name="check" size={13}/>} {LABELS[status]||"Активна"}</span>;
}
function RequestRow({request,view,isFavorite,onFavorite}){
 const from=view==="mine"?"mine":view==="archive"?"archive":view==="favorites"?"favorites":"catalog";
 const url="/requests/"+encodeURIComponent(request.id)+"?from="+from;
 const amount=request.priceMin===request.priceMax?formatMoney(request.priceMin):formatMoney(request.priceMin)+" — "+formatMoney(request.priceMax);
 return <article className={"request-row "+(view==="mine"?"request-row-owned":"")}>
   <Link href={url} className="request-row-link" aria-label={"Открыть заявку "+request.id+": "+request.title}>
     <div className="request-main">
       <div className="request-kicker"><span className="category-label">{request.category}</span><span>{request.id}</span>{view!=="catalog"&&<StatusBadge status={request.status}/>}</div>
       <strong className="request-title">{request.title}</strong>
       <p>{request.summary}</p>
       {view==="mine"&&<div className="private-preview"><div><b>Клиент</b><span>{request.client||"Не указан"}</span></div><div><b>Точный адрес</b><span>{request.address||"Не указан"}</span></div></div>}
     </div>
     <div className="request-column"><small>География</small><span>{request.regions.join(" / ")}</span></div>
     <div className="request-column request-amount"><small>Стоимость</small><strong>{amount}</strong></div>
     <div className="request-column request-date"><small>{request.status!=="active"?"Закрыта":"Размещена"}</small><span>{formatDate(request.status!=="active"&&request.closedDate?request.closedDate:request.date)}</span><em>{request.unit}</em></div>
     <div className="request-arrow"><Icon name="right" size={17}/></div>
   </Link>
   <button type="button" className={"favorite-toggle "+(isFavorite?"is-favorite":"")} onClick={()=>onFavorite(request.id)} aria-pressed={isFavorite} aria-label={isFavorite?"Убрать из избранного":"Добавить в избранное"} title={isFavorite?"Убрать из избранного":"Добавить в избранное"}>
      <Icon name="star" size={19} filled={isFavorite}/>
   </button>
 </article>;
}

export default function Home(){
 const [view,setView]=useState("catalog");
 const [direction,setDirection]=useState("buy");
 const [menuOpen,setMenuOpen]=useState(false);
 const [createOpen,setCreateOpen]=useState(false);
 const [created,setCreated]=useState([]);
 const [favorites,setFavorites]=useState([]);
 const [filters,setFilters]=useState(emptyFilters);
 const [moreFilters,setMoreFilters]=useState(false);
 const [archiveStatus,setArchiveStatus]=useState("all");
 const [onlyDirection,setOnlyDirection]=useState("all");
 const [storageNote,setStorageNote]=useState("");

 useEffect(()=>{
   setCreated(loadLocalRequests());
   setFavorites(loadFavoriteIds());
   const params=new URLSearchParams(window.location.search);
   const nextView=params.get("view"),nextTab=params.get("tab");
   if(["catalog","mine","archive","favorites"].includes(nextView))setView(nextView);
   if(["buy","sell"].includes(nextTab))setDirection(nextTab);
 },[]);
 useEffect(()=>{
   if(!menuOpen&&!createOpen)return;
   const onKey=e=>{if(e.key==="Escape"){setMenuOpen(false);setCreateOpen(false);}};
   window.addEventListener("keydown",onKey);
   return ()=>window.removeEventListener("keydown",onKey);
 },[menuOpen,createOpen]);
 const go=(next,tab)=>{
   const dir=tab||direction;
   setView(next);setDirection(dir);setMenuOpen(false);
   setFilters(emptyFilters);setArchiveStatus("all");setOnlyDirection("all");setMoreFilters(false);
   const q=new URLSearchParams();
   if(next!=="catalog")q.set("view",next);
   if(dir==="sell"&&next==="catalog")q.set("tab","sell");
   window.history.replaceState(null,"","/"+(q.size?"?"+q.toString():""));
 };
 const toggleFavorite=id=>{
   const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];
   setFavorites(next);
   if(!saveFavoriteIds(next))setStorageNote("Не удалось сохранить избранное в этом браузере.");
 };
 const saveRequest=r=>{
   const next=[r,...created];
   if(!saveLocalRequests(next)){
      setStorageNote("Хранилище браузера недоступно: заявка останется только до обновления страницы.");
   }else setStorageNote("");
   setCreated(next);setCreateOpen(false);go("mine");
 };
 const openCreate=()=>{setMenuOpen(false);setCreateOpen(true);};
 const setF=(k,v)=>setFilters(s=>({...s,[k]:v}));
 const hasFilter=Object.entries(filters).some(([k,v])=>k!=="sort"&&v!=="");
 const allRequests=useMemo(()=>[...created,...DEMO_REQUESTS],[created]);
 const allForView=useMemo(()=>{
   if(view==="catalog")return allRequests.filter(r=>r.status==="active"&&r.direction===direction);
   if(view==="mine")return allRequests.filter(r=>r.owned);
   if(view==="archive")return allRequests.filter(r=>r.status!=="active");
   return allRequests.filter(r=>favorites.includes(r.id));
 },[allRequests,view,direction,favorites]);
 const kindOptions=useMemo(()=>[...new Set([...KINDS,...created.map(r=>r.category)])].sort((a,b)=>a.localeCompare(b,"ru")),[created]);
 const industryOptions=useMemo(()=>[...new Set([...INDUSTRIES,...created.map(r=>r.industry).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"ru")),[created]);
 const regionOptions=useMemo(()=>[...new Set([...REGIONS,...created.flatMap(r=>r.regions)])].sort((a,b)=>a.localeCompare(b,"ru")),[created]);
 const matches=useMemo(()=>{
   if(filters.min!==""&&filters.max!==""&&Number(filters.min)>Number(filters.max))return [];
   return allForView.filter(r=>{
     if(view==="archive"&&archiveStatus!=="all"&&r.status!==archiveStatus)return false;
     if(view!=="catalog"&&onlyDirection!=="all"&&r.direction!==onlyDirection)return false;
     if(filters.kind&&r.category!==filters.kind)return false;
     if(filters.industry&&r.industry!==filters.industry)return false;
     if(filters.region&&!r.regions.includes(filters.region))return false;
     if(filters.min!==""&&r.priceMax<Number(filters.min))return false;
     if(filters.max!==""&&r.priceMin>Number(filters.max))return false;
     if(filters.date){
       const days=Number(filters.date);
       if((Date.now()-new Date(r.date+"T12:00:00Z").getTime())/86400000>days)return false;
     }
     if(filters.query.trim()){
       const needle=filters.query.toLocaleLowerCase("ru").replace(/ё/g,"е").trim();
       const publicText=[r.title,r.id,r.summary,r.category,r.industry,r.subindustry,r.okved,r.notes,r.unit,...r.regions,...(r.info||[]).flat()].filter(Boolean).join(" ");
       const hay=(view==="mine"?publicText+" "+(r.client||"")+" "+(r.address||""):publicText).toLocaleLowerCase("ru").replace(/ё/g,"е");
       if(!needle.split(/\s+/).every(part=>hay.includes(part)))return false;
     }
     return true;
   }).sort((a,b)=>{
     if(filters.sort==="old")return a.date.localeCompare(b.date);
     if(filters.sort==="priceAsc")return a.priceMin-b.priceMin;
     if(filters.sort==="priceDesc")return b.priceMax-a.priceMax;
     return b.date.localeCompare(a.date);
   });
 },[allForView,filters,view,archiveStatus,onlyDirection]);
 const title=view==="catalog"?(direction==="buy"?"Заявки на покупку":"Заявки на продажу"):view==="mine"?"Мои заявки":view==="archive"?"Архив заявок":"Избранное";
 const subtitle={
   catalog:"Поиск встречного спроса и предложения по активам.",
   mine:"Созданные мной заявки и закрытые сведения о клиентах.",
   archive:"Реализованные сделки и закрытые без реализации запросы.",
   favorites:"Сохранённые заявки из всех разделов. Используй обычные фильтры для поиска."
 }[view];
 const mineCount=allRequests.filter(r=>r.owned).length;
 const archive=allRequests.filter(r=>r.status!=="active");
 const archiveStats=view==="archive"?<div className="archive-stats"><span className="stat-item"><i className="stat-dot green"/>Реализованы <b>{archive.filter(r=>r.status==="realized").length}</b></span><span className="stat-item"><i className="stat-dot grey"/>Закрыты <b>{archive.filter(r=>r.status==="closed").length}</b></span></div>:null;
 return <div className="app">
  <header className="topbar"><div className="topbar-inner">
   <div className="header-left">
    <button type="button" className={"sections-button "+(menuOpen?"sections-active":"")} onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen} aria-controls="sections-menu"><Icon name="menu" size={19}/> Разделы</button>
    <div className="brand"><button type="button" className="brand-button" onClick={()=>go("catalog","buy")}>M&A Bridge</button><span className="site-demo">Демо</span></div>
   </div>
   <div className="header-actions"><span className="demo-person"><span className="demo-avatar">ДМ</span> Демо-менеджер</span></div>
  </div></header>
  <div className="body-container">
   <div className="top-nav"><div className="direction-tabs" role="tablist" aria-label="Покупка или продажа">
    <button role="tab" aria-selected={view==="catalog"&&direction==="buy"} className={view==="catalog"&&direction==="buy"?"tab selected":"tab"} onClick={()=>go("catalog","buy")}>Купить <span>{allRequests.filter(r=>r.status==="active"&&r.direction==="buy").length}</span></button>
    <button role="tab" aria-selected={view==="catalog"&&direction==="sell"} className={view==="catalog"&&direction==="sell"?"tab selected":"tab"} onClick={()=>go("catalog","sell")}>Продать <span>{allRequests.filter(r=>r.status==="active"&&r.direction==="sell").length}</span></button>
   </div></div>
   <main>
    <div className="section-heading"><div><div className="section-kicker">КАТАЛОГ ЗАЯВОК / {view==="catalog"?"АКТИВНЫЕ":view==="mine"?"МОЙ КАБИНЕТ":view==="archive"?"АРХИВ":"ИЗБРАННОЕ"}</div><h1>{title}</h1><p>{subtitle}</p></div>
     <div className="heading-side"><span className="result-count">{matches.length} из {allForView.length}</span>{archiveStats}{view==="mine"&&<button className="my-add-button" onClick={openCreate}><Icon name="plus" size={16}/> Добавить заявку</button>}</div>
    </div>
    {storageNote&&<div className="storage-alert" role="alert">{storageNote}</div>}
    {view==="mine"&&<div className="note-privacy"><Icon name="shield" size={18}/><div><strong>Внутренние поля: клиент и адрес</strong><p>Демо: данные видны в «Моих заявках». В рабочей банковской системе доступ должен проверяться на сервере. Здесь используй только вымышленные данные.</p></div></div>}
    {view==="archive"&&<div className="archive-tabs" role="group" aria-label="Статусы архива">{[["all","Все"],["realized","Реализованы"],["closed","Закрыты"]].map(([key,label])=><button key={key} className={archiveStatus===key?"archive-tab current":"archive-tab"} onClick={()=>setArchiveStatus(key)}>{key==="realized"&&<span className="mini-dot green"/>}{key==="closed"&&<span className="mini-dot grey"/>}{label}</button>)}</div>}
    <div className="filters-box">
     <div className="searchbar">
      <div className="searchinput"><Icon name="search"/><input value={filters.query} onChange={e=>setF("query",e.target.value)} placeholder={view==="mine"?"Поиск по заявке, клиенту, адресу…":"Поиск по заявке, отрасли, региону…"} aria-label="Поиск заявок"/></div>
      {view!=="catalog"&&<label className="direction-select"><span>Тип:</span><select value={onlyDirection} onChange={e=>setOnlyDirection(e.target.value)}><option value="all">Все направления</option><option value="buy">Покупка</option><option value="sell">Продажа</option></select></label>}
      <button className={"filter-toggle "+(moreFilters?"on":"")} onClick={()=>setMoreFilters(v=>!v)} aria-expanded={moreFilters}><Icon name="filter" size={17}/> Фильтры <Icon name="chevron" size={15}/></button>
      {hasFilter&&<button className="reset-button" onClick={()=>setFilters(emptyFilters)}>Сбросить</button>}
     </div>
     {moreFilters&&<div className="filters-grid">
       <Select label="Тип актива" value={filters.kind} onChange={v=>setF("kind",v)} options={kindOptions}/>
       <Select label="Отрасль" value={filters.industry} onChange={v=>setF("industry",v)} options={industryOptions}/>
       <Select label="География" value={filters.region} onChange={v=>setF("region",v)} options={regionOptions}/>
       <label className="filter-control"><span>Стоимость от, млн ₽</span><input type="number" min="0" value={filters.min} placeholder="Любая" onChange={e=>setF("min",e.target.value)}/></label>
       <label className="filter-control"><span>Стоимость до, млн ₽</span><input type="number" min="0" value={filters.max} placeholder="Любая" onChange={e=>setF("max",e.target.value)}/></label>
       <Select label="Дата размещения" value={filters.date} onChange={v=>setF("date",v)} options={["7","30","90"]} empty="За всё время"/>
       <label className="filter-control"><span>Сортировка</span><select value={filters.sort} onChange={e=>setF("sort",e.target.value)}><option value="new">Сначала новые</option><option value="old">Сначала старые</option><option value="priceAsc">Сначала дешёвые</option><option value="priceDesc">Сначала дорогие</option></select></label>
     </div>}
     {filters.min!==""&&filters.max!==""&&Number(filters.min)>Number(filters.max)&&<p className="input-warning">Минимальная стоимость превышает максимальную.</p>}
    </div>
    <div className="results-container"><div className="table-header"><span>ЗАЯВКА / ОПИСАНИЕ</span><span>ГЕОГРАФИЯ</span><span>СТОИМОСТЬ</span><span>РАЗМЕЩЕНА</span><span/></div>
    {matches.length?matches.map(r=><RequestRow key={r.id} request={r} view={view} isFavorite={favorites.includes(r.id)} onFavorite={toggleFavorite}/>):<div className="empty-results"><div className="empty-icon"><Icon name={view==="favorites"?"star":"search"} size={25}/></div><strong>{view==="favorites"&&!favorites.length?"В избранном пока нет заявок":"Заявки не найдены"}</strong><p>{view==="favorites"&&!favorites.length?"Нажимай на звёздочку возле заявки, чтобы добавить её сюда.":"Измени условия поиска или сбрось фильтры."}</p><button onClick={()=>{setFilters(emptyFilters);setArchiveStatus("all");setOnlyDirection("all");if(view==="favorites"&&!favorites.length)go("catalog","buy")}}>{view==="favorites"&&!favorites.length?"Перейти к заявкам":"Сбросить фильтры"}</button></div>}
    </div>
    <p className="footnote">Демоверсия: заявки, имена и адреса — условные. Добавленные тобой заявки и избранное хранятся только в этом браузере; не используй реальные банковские сведения.</p>
   </main>
  </div>

  {menuOpen&&<div className="drawer-cover" onMouseDown={e=>{if(e.target===e.currentTarget)setMenuOpen(false)}}>
   <aside id="sections-menu" className="drawer" aria-label="Разделы">
     <div className="drawer-header"><strong>Разделы</strong><button onClick={()=>setMenuOpen(false)} aria-label="Закрыть меню"><Icon name="close"/></button></div>
     <div className="drawer-my-entry">
       <button className="drawer-link" onClick={()=>go("mine")}><span className="drawer-icon"><Icon name="user" size={20}/></span><span><strong>Мои заявки</strong><small>Мои запросы, клиент и адрес</small></span><em>{mineCount}</em><Icon name="right" size={17}/></button>
       <button className="drawer-add-button" onClick={openCreate}><Icon name="plus" size={15}/> Добавить заявку</button>
     </div>
     <button className="drawer-link" onClick={()=>go("favorites")}><span className="drawer-icon"><Icon name="star" size={20}/></span><span><strong>Избранное</strong><small>Сохранённые заявки и поиск среди них</small></span><em>{favorites.length}</em><Icon name="right" size={17}/></button>
     <button className="drawer-link" onClick={()=>go("archive")}><span className="drawer-icon"><Icon name="archive" size={20}/></span><span><strong>Архив заявок</strong><small>Реализованные и просто закрытые</small></span><em>{archive.length}</em><Icon name="right" size={17}/></button>
     <p className="drawer-caption">Демо без общей базы данных и доступа к банковским системам.</p>
   </aside>
  </div>}
  {createOpen&&<CreateRequestModal onClose={()=>setCreateOpen(false)} onSave={saveRequest}/>}
 </div>;
}
