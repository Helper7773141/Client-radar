"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DEMO_REQUESTS, KINDS, INDUSTRIES, REGIONS, LABELS, formatMoney, formatDate } from "../lib/requests";

function Icon({ name, size = 18 }) {
  const paths = {
    search:"M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35",
    menu:"M4 6h16 M4 12h16 M4 18h16",
    close:"M18 6 6 18 M6 6l12 12",
    chevron:"m9 18 6-6-6-6",
    right:"M5 12h14m-6-6 6 6-6 6",
    user:"M20 21a8 8 0 0 0-16 0 M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
    archive:"M4 4h16v5H4z M6 9v12h12V9 M10 13h4",
    grid:"M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
    filter:"M4 7h16 M7 12h10 M10 17h4",
    shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    check:"m5 12 4 4L19 6",
    info:"M12 17v-5 M12 8h.01 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    clock:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
    sort:"M8 3v18m0 0-4-4m4 4 4-4 M16 21V3m0 0-4 4m4-4 4 4"
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.info}/></svg>;
}
const emptyFilters={query:"",kind:"",industry:"",region:"",min:"",max:"",date:"",sort:"new"};
function Select({label,value,onChange,options,empty="Все"}) {
  return <label className="filter-control"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}><option value="">{empty}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>;
}
function Badge({status}) {
  return <span className={"status status-"+status}>{status==="realized"&&<Icon name="check" size={13}/>} {LABELS[status]}</span>;
}
function RequestRow({request,view}) {
  const from = view==="mine" ? "mine" : view==="archive" ? "archive" : "catalog";
  const url = "/requests/" + encodeURIComponent(request.id) + "?from=" + from;
  return <Link href={url} className={"request-row "+(view==="mine"?"request-row-owned":"")}>
    <div className="request-main">
      <div className="request-kicker"><span className="category-label">{request.category}</span><span>{request.id}</span>{view!=="catalog"&&<Badge status={request.status}/>}</div>
      <strong className="request-title">{request.title}</strong>
      <p>{request.summary}</p>
      {view==="mine"&&<div className="private-preview"><div><b>Клиент</b><span>{request.client}</span></div><div><b>Точный адрес</b><span>{request.address}</span></div></div>}
    </div>
    <div className="request-column"><small>География</small><span>{request.regions.join(" / ")}</span></div>
    <div className="request-column request-amount"><small>Стоимость</small><strong>{formatMoney(request.priceMin)===formatMoney(request.priceMax)?formatMoney(request.priceMin):formatMoney(request.priceMin)+" — "+formatMoney(request.priceMax)}</strong></div>
    <div className="request-column request-date"><small>{view==="archive"?"Закрыта":"Размещена"}</small><span>{formatDate(view==="archive"?request.closedDate:request.date)}</span><em>{request.unit}</em></div>
    <div className="request-arrow"><Icon name="right" size={19}/></div>
  </Link>;
}

export default function Home() {
  const [view,setView]=useState("catalog");
  const [direction,setDirection]=useState("buy");
  const [menuOpen,setMenuOpen]=useState(false);
  const [filters,setFilters]=useState(emptyFilters);
  const [moreFilters,setMoreFilters]=useState(false);
  const [archiveStatus,setArchiveStatus]=useState("all");
  const [onlyDirection,setOnlyDirection]=useState("all");

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const nextView=params.get("view");
    const nextTab=params.get("tab");
    if(["catalog","mine","archive"].includes(nextView))setView(nextView);
    if(["buy","sell"].includes(nextTab))setDirection(nextTab);
    function onKey(e){if(e.key==="Escape")setMenuOpen(false);}
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[]);
  const go=(next,tab)=>{
    const dir=tab||direction;
    setView(next);setDirection(dir);setMenuOpen(false);
    setFilters(emptyFilters);setArchiveStatus("all");setOnlyDirection("all");setMoreFilters(false);
    const q=new URLSearchParams();
    if(next!=="catalog")q.set("view",next);
    if(dir==="sell"&&next==="catalog")q.set("tab","sell");
    window.history.replaceState(null,"","/"+(q.size?"?"+q.toString():""));
  };
  const setF=(k,v)=>setFilters(s=>({...s,[k]:v}));
  const hasFilter=Object.entries(filters).some(([k,v])=>k!=="sort"&&v!=="");
  const allForView=useMemo(()=>{
    if(view==="catalog")return DEMO_REQUESTS.filter(r=>r.status==="active"&&r.direction===direction);
    if(view==="mine")return DEMO_REQUESTS.filter(r=>r.owned);
    return DEMO_REQUESTS.filter(r=>r.status!=="active");
  },[view,direction]);
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
        const ref=new Date("2026-11-16T12:00:00Z").getTime();
        if((ref-new Date(r.date+"T12:00:00Z").getTime())/86400000>days)return false;
      }
      if(filters.query.trim()){
        const needle=filters.query.toLocaleLowerCase("ru").replace(/ё/g,"е").trim();
        const publicText=[r.title,r.id,r.summary,r.category,r.industry,r.subindustry,r.okved,r.notes,r.unit,...r.regions].join(" ");
        const searchText=view==="mine"?publicText+" "+r.client+" "+r.address:publicText;
        const hay=searchText.toLocaleLowerCase("ru").replace(/ё/g,"е");
        if(!needle.split(/\s+/).every(part=>hay.includes(part)))return false;
      }
      return true;
    }).sort((a,b)=>{
      if(filters.sort==="old")return a.date.localeCompare(b.date);
      if(filters.sort==="priceAsc")return a.priceMin-b.priceMin;
      if(filters.sort==="priceDesc")return b.priceMax-a.priceMax;
      return b.date.localeCompare(a.date);
    });
  },[view,allForView,filters,archiveStatus,onlyDirection]);
  const title=view==="catalog"?(direction==="buy"?"Заявки на покупку":"Заявки на продажу"):view==="archive"?"Архив заявок":"Мои заявки";
  const subtitle=view==="catalog"?"Поиск встречного спроса и предложения по активам.":view==="archive"?"Завершённые сделки и заявки, закрытые без реализации.":"Заявки демо-менеджера. Здесь дополнительно видны клиент и точный адрес.";
  const mineCount=DEMO_REQUESTS.filter(r=>r.owned).length;
  const archive=DEMO_REQUESTS.filter(r=>r.status!=="active");
  const stats=view==="archive"?
    <div className="archive-stats"><span className="stat-item"><i className="stat-dot green"/>Реализованы <b>{archive.filter(r=>r.status==="realized").length}</b></span><span className="stat-item"><i className="stat-dot grey"/>Закрыты <b>{archive.filter(r=>r.status==="closed").length}</b></span></div>
  :null;
  return <div className="app">
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand"><button type="button" className="brand-button" onClick={()=>go("catalog","buy")}>M&A Bridge</button><span className="site-demo">Демо</span></div>
        <div className="header-actions">
          <span className="demo-person"><span className="demo-avatar">ДМ</span> Демо-менеджер</span>
          <button type="button" className={"sections-button "+(menuOpen?"sections-active":"")} onClick={()=>setMenuOpen(x=>!x)} aria-expanded={menuOpen} aria-controls="sections-menu"><Icon name="menu" size={19}/> Разделы</button>
        </div>
      </div>
    </header>

    <div className="body-container">
      <div className="top-nav">
        <div className="direction-tabs" role="tablist" aria-label="Покупка или продажа">
          <button role="tab" aria-selected={view==="catalog"&&direction==="buy"} className={view==="catalog"&&direction==="buy"?"tab selected": "tab"} onClick={()=>go("catalog","buy")}>Купить <span>{DEMO_REQUESTS.filter(r=>r.status==="active"&&r.direction==="buy").length}</span></button>
          <button role="tab" aria-selected={view==="catalog"&&direction==="sell"} className={view==="catalog"&&direction==="sell"?"tab selected": "tab"} onClick={()=>go("catalog","sell")}>Продать <span>{DEMO_REQUESTS.filter(r=>r.status==="active"&&r.direction==="sell").length}</span></button>
        </div>
        <div className="nav-links">
          <button className={view==="mine"?"sub-nav active":"sub-nav"} onClick={()=>go("mine")}><Icon name="user" size={16}/> Мои заявки <span>{mineCount}</span></button>
          <button className={view==="archive"?"sub-nav active":"sub-nav"} onClick={()=>go("archive")}><Icon name="archive" size={16}/> Архив <span>{archive.length}</span></button>
        </div>
      </div>

      <main>
        <div className="section-heading">
          <div><div className="section-kicker">КАТАЛОГ ЗАЯВОК / {view==="catalog"?"АКТИВНЫЕ":view==="mine"?"МОЙ КАБИНЕТ":"АРХИВ"}</div><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="heading-side"><span className="result-count">{matches.length} из {allForView.length}</span>{stats}</div>
        </div>

        {view==="mine"&&<div className="note-privacy"><Icon name="shield" size={18}/><div><strong>Внутренние поля: клиент и адрес</strong><p>В этом демонстрационном разделе они видны только для «моих» заявок. В общем каталоге и архиве других менеджеров эти данные скрыты. В реальной системе права потребуется проверять на сервере.</p></div></div>}

        {view==="archive"&&<div className="archive-tabs" role="group" aria-label="Статусы архива">
          {[["all","Все"],["realized","Реализованы"],["closed","Закрыты"]].map(([key,label])=><button key={key} className={archiveStatus===key?"archive-tab current":"archive-tab"} onClick={()=>setArchiveStatus(key)}>{key==="realized"&&<span className="mini-dot green"/>}{key==="closed"&&<span className="mini-dot grey"/>}{label}</button>)}
        </div>}

        <div className="filters-box">
          <div className="searchbar">
            <div className="searchinput"><Icon name="search"/><input value={filters.query} onChange={e=>setF("query",e.target.value)} placeholder={view==="mine"?"Поиск по заявкам, клиенту или адресу…":"Поиск по названию, отрасли или региону…"} aria-label="Поиск заявок"/></div>
            {view!=="catalog"&&<label className="direction-select"><span>Тип:</span><select value={onlyDirection} onChange={e=>setOnlyDirection(e.target.value)}><option value="all">Все направления</option><option value="buy">Покупка</option><option value="sell">Продажа</option></select></label>}
            <button className={"filter-toggle "+(moreFilters?"on":"")} onClick={()=>setMoreFilters(x=>!x)} aria-expanded={moreFilters}><Icon name="filter" size={17}/> Фильтры <Icon name="chevron" size={15}/></button>
            {hasFilter&&<button className="reset-button" onClick={()=>setFilters(emptyFilters)}>Сбросить</button>}
          </div>
          {moreFilters&&<div className="filters-grid">
            <Select label="Тип актива" value={filters.kind} onChange={v=>setF("kind",v)} options={KINDS}/>
            <Select label="Отрасль" value={filters.industry} onChange={v=>setF("industry",v)} options={INDUSTRIES}/>
            <Select label="География" value={filters.region} onChange={v=>setF("region",v)} options={REGIONS}/>
            <label className="filter-control"><span>Стоимость от, млн ₽</span><input type="number" min="0" value={filters.min} placeholder="Любая" onChange={e=>setF("min",e.target.value)}/></label>
            <label className="filter-control"><span>Стоимость до, млн ₽</span><input type="number" min="0" value={filters.max} placeholder="Любая" onChange={e=>setF("max",e.target.value)}/></label>
            <Select label="Дата размещения" value={filters.date} onChange={v=>setF("date",v)} options={["7","30","90"]} empty="За всё время"/>
            <label className="filter-control"><span>Сортировка</span><select value={filters.sort} onChange={e=>setF("sort",e.target.value)}><option value="new">Сначала новые</option><option value="old">Сначала старые</option><option value="priceAsc">Сначала дешёвые</option><option value="priceDesc">Сначала дорогие</option></select></label>
          </div>}
          {filters.min!==""&&filters.max!==""&&Number(filters.min)>Number(filters.max)&&<p className="input-warning">Минимальная стоимость больше максимальной — результаты не найдены.</p>}
        </div>

        <div className="results-container">
          <div className="table-header"><span>ЗАЯВКА / ОПИСАНИЕ</span><span>ГЕОГРАФИЯ</span><span>СТОИМОСТЬ</span><span>РАЗМЕЩЕНА</span><span/></div>
          {matches.length?matches.map(r=><RequestRow key={r.id} request={r} view={view}/>):<div className="empty-results"><div className="empty-icon"><Icon name="search" size={25}/></div><strong>Заявки не найдены</strong><p>Измени параметры фильтрации или сбрось фильтры.</p><button onClick={()=>{setFilters(emptyFilters);setArchiveStatus("all");setOnlyDirection("all");}}>Сбросить фильтры</button></div>}
        </div>
        <p className="footnote">Все заявки, клиенты и адреса — вымышленные примеры. Нет авторизации, базы данных и сохранения изменений. Дата демонстрационного набора: 16.11.2026.</p>
      </main>
    </div>

    {menuOpen&&<div className="drawer-cover" onMouseDown={e=>{if(e.target===e.currentTarget)setMenuOpen(false)}}>
      <aside id="sections-menu" className="drawer" aria-label="Дополнительные разделы">
        <div className="drawer-header"><strong>Разделы</strong><button onClick={()=>setMenuOpen(false)} aria-label="Закрыть меню"><Icon name="close"/></button></div>
        <button className="drawer-link" onClick={()=>go("mine")}><span className="drawer-icon"><Icon name="user" size={20}/></span><span><strong>Мои заявки</strong><small>Мои запросы, клиент и точный адрес</small></span><em>{mineCount}</em><Icon name="right" size={17}/></button>
        <button className="drawer-link" onClick={()=>go("archive")}><span className="drawer-icon"><Icon name="archive" size={20}/></span><span><strong>Архив заявок</strong><small>Реализованные и просто закрытые</small></span><em>{archive.length}</em><Icon name="right" size={17}/></button>
        <p className="drawer-caption">Демонстрация механики M&A Bridge. Данные вымышлены и не сохраняются.</p>
      </aside>
    </div>}
  </div>;
}
