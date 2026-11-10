"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { requests, categories, geographyOptions } from "../lib/requests";

function Arrow({size=18}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>;
}
function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
}
function Select({label,value,onChange,options}) {
  return <label className="filter"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}><option value="">Все</option>{options.map(x=><option key={x} value={x}>{x}</option>)}</select></label>;
}
function formatCount(n){return n+" "+(n===1?"заявка":n>=2&&n<=4?"заявки":"заявок");}
export default function Home() {
  const [direction,setDirection] = useState("buy");
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("");
  const [region,setRegion] = useState("");
  const [min,setMin] = useState("");
  const [max,setMax] = useState("");
  const [showFilters,setShowFilters] = useState(false);
  useEffect(()=>{
    const tab=new URLSearchParams(window.location.search).get("tab");
    if(tab==="sell")setDirection("sell");
  },[]);
  const clear=()=>{setQuery("");setCategory("");setRegion("");setMin("");setMax("");};
  const chooseDirection=(d)=>{setDirection(d);clear();window.history.replaceState(null,"",d==="sell"?"/?tab=sell":"/");};
  const hasFilters=!!(query||category||region||min||max);
  const filtered=useMemo(()=>requests.filter(r=>{
    if(r.direction!==direction)return false;
    if(category && r.category!==category)return false;
    if(region && !r.geography.includes(region))return false;
    if(min!=="" && r.priceTo<Number(min))return false;
    if(max!=="" && r.priceFrom>Number(max))return false;
    const needle=query.trim().toLocaleLowerCase("ru").replace(/ё/g,"е");
    if(needle){
      const hay=[r.id,r.title,r.summary,r.category,r.industry,r.subindustry,r.permittedUse,r.note,...r.geography]
        .filter(Boolean).join(" ").toLocaleLowerCase("ru").replace(/ё/g,"е");
      if(!needle.split(/\s+/).every(x=>hay.includes(x)))return false;
    }
    return true;
  }),[direction,category,region,min,max,query]);

  return <main className="page">
    <header className="site-header">
      <div className="brand-area"><h1>M&A Bridge</h1><p>Единый каталог заявок на покупку и продажу активов</p></div>
      <span className="demo-indicator"><i/>Демонстрационная версия</span>
    </header>

    <section className="workspace">
      <div className="direction-tabs" role="tablist" aria-label="Направление заявки">
        <button type="button" role="tab" aria-selected={direction==="buy"} className={direction==="buy"?"direction-tab active":"direction-tab"} onClick={()=>chooseDirection("buy")}>Купить <span>{requests.filter(x=>x.direction==="buy").length}</span></button>
        <button type="button" role="tab" aria-selected={direction==="sell"} className={direction==="sell"?"direction-tab active":"direction-tab"} onClick={()=>chooseDirection("sell")}>Продать <span>{requests.filter(x=>x.direction==="sell").length}</span></button>
      </div>

      <div className="list-head">
        <div><h2>Заявки на {direction==="buy"?"покупку":"продажу"}</h2><p>Выберите заявку, чтобы открыть полную информацию.</p></div>
        <span className="count">{formatCount(filtered.length)}</span>
      </div>

      <div className="search-toolbar">
        <label className="search-input"><SearchIcon/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по объекту, отрасли, географии…" aria-label="Поиск заявок"/></label>
        <button className={showFilters||category||region||min||max?"filter-button filter-active":"filter-button"} onClick={()=>setShowFilters(v=>!v)} aria-expanded={showFilters}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M7 12h10m-7 5h4"/></svg>Фильтры{category||region||min||max?" •":""}</button>
        {hasFilters&&<button className="clear-link" onClick={clear}>Сбросить</button>}
      </div>
      {showFilters&&<div className="advanced-filters">
        <Select label="Тип актива" value={category} onChange={setCategory} options={categories}/>
        <Select label="География" value={region} onChange={setRegion} options={geographyOptions}/>
        <label className="filter"><span>Стоимость от, млн ₽</span><input type="number" min="0" placeholder="Любая" value={min} onChange={e=>setMin(e.target.value)}/></label>
        <label className="filter"><span>Стоимость до, млн ₽</span><input type="number" min="0" placeholder="Любая" value={max} onChange={e=>setMax(e.target.value)}/></label>
        <p>Фильтр по сумме показывает заявки, чей диапазон пересекается с выбранным.</p>
      </div>}

      <div className="list-table">
        <div className="list-column-head"><span>АКТИВ / ОПИСАНИЕ</span><span>ГЕОГРАФИЯ</span><span>СТОИМОСТЬ</span><span>МЕНЕДЖЕР</span><span/></div>
        {filtered.length>0?filtered.map(r=><Link className="request-row" key={r.id} href={"/requests/"+r.id}>
          <div className="request-identity"><div className="request-type">{r.category} <span>·</span> {r.id}</div><strong>{r.title}</strong><p>{r.summary}</p><div className="request-tags">{r.category==="Компания"?<span>{r.subindustry}</span>:<span>{r.permittedUse}</span>}</div></div>
          <div className="request-cell"><small>География</small><span>{r.geography.join(", ")}</span></div>
          <div className="request-cell request-price"><small>Стоимость</small><strong>{r.priceShort}</strong></div>
          <div className="request-cell"><small>Менеджер</small><span>{r.manager}</span><em>{r.unit}</em></div>
          <div className="row-arrow"><Arrow/></div>
        </Link>):<div className="empty-state"><div className="empty-glyph"><SearchIcon/></div><h3>Ничего не найдено</h3><p>Попробуйте изменить условия поиска или сбросить фильтры.</p><button onClick={clear}>Сбросить фильтры</button></div>}
      </div>
      <p className="list-footnote">Все данные на сайте приведены исключительно как пример. Создание и хранение заявок пока не подключены.</p>
    </section>
  </main>;
}
