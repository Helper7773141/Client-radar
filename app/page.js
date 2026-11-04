"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SECTIONS = [
  ["A","СЕЛЬСКОЕ, ЛЕСНОЕ ХОЗЯЙСТВО, ОХОТА, РЫБОЛОВСТВО И РЫБОВОДСТВО"],
  ["B","ДОБЫЧА ПОЛЕЗНЫХ ИСКОПАЕМЫХ"],
  ["C","ОБРАБАТЫВАЮЩИЕ ПРОИЗВОДСТВА"],
  ["D","ОБЕСПЕЧЕНИЕ ЭЛЕКТРИЧЕСКОЙ ЭНЕРГИЕЙ, ГАЗОМ И ПАРОМ; КОНДИЦИОНИРОВАНИЕ ВОЗДУХА"],
  ["E","ВОДОСНАБЖЕНИЕ; ВОДООТВЕДЕНИЕ, ОРГАНИЗАЦИЯ СБОРА И УТИЛИЗАЦИИ ОТХОДОВ, ДЕЯТЕЛЬНОСТЬ ПО ЛИКВИДАЦИИ ЗАГРЯЗНЕНИЙ"],
  ["F","СТРОИТЕЛЬСТВО"],
  ["G","ТОРГОВЛЯ ОПТОВАЯ И РОЗНИЧНАЯ; РЕМОНТ АВТОТРАНСПОРТНЫХ СРЕДСТВ И МОТОЦИКЛОВ"],
  ["H","ТРАНСПОРТИРОВКА И ХРАНЕНИЕ"],
  ["I","ДЕЯТЕЛЬНОСТЬ ГОСТИНИЦ И ПРЕДПРИЯТИЙ ОБЩЕСТВЕННОГО ПИТАНИЯ"],
  ["J","ДЕЯТЕЛЬНОСТЬ В ОБЛАСТИ ИНФОРМАЦИИ И СВЯЗИ"],
  ["K","ДЕЯТЕЛЬНОСТЬ ФИНАНСОВАЯ И СТРАХОВАЯ"],
  ["L","ДЕЯТЕЛЬНОСТЬ ПО ОПЕРАЦИЯМ С НЕДВИЖИМЫМ ИМУЩЕСТВОМ"],
  ["M","ДЕЯТЕЛЬНОСТЬ ПРОФЕССИОНАЛЬНАЯ, НАУЧНАЯ И ТЕХНИЧЕСКАЯ"],
  ["N","ДЕЯТЕЛЬНОСТЬ АДМИНИСТРАТИВНАЯ И СОПУТСТВУЮЩИЕ ДОПОЛНИТЕЛЬНЫЕ УСЛУГИ"],
  ["O","ГОСУДАРСТВЕННОЕ УПРАВЛЕНИЕ И ОБЕСПЕЧЕНИЕ ВОЕННОЙ БЕЗОПАСНОСТИ; СОЦИАЛЬНОЕ ОБЕСПЕЧЕНИЕ"],
  ["P","ОБРАЗОВАНИЕ"],
  ["Q","ДЕЯТЕЛЬНОСТЬ В ОБЛАСТИ ЗДРАВООХРАНЕНИЯ И СОЦИАЛЬНЫХ УСЛУГ"],
  ["R","ДЕЯТЕЛЬНОСТЬ В ОБЛАСТИ КУЛЬТУРЫ, СПОРТА, ОРГАНИЗАЦИИ ДОСУГА И РАЗВЛЕЧЕНИЙ"],
  ["S","ПРЕДОСТАВЛЕНИЕ ПРОЧИХ ВИДОВ УСЛУГ"],
  ["T","ДЕЯТЕЛЬНОСТЬ ДОМАШНИХ ХОЗЯЙСТВ КАК РАБОТОДАТЕЛЕЙ; НЕДИФФЕРЕНЦИРОВАННАЯ ДЕЯТЕЛЬНОСТЬ ЧАСТНЫХ ДОМАШНИХ ХОЗЯЙСТВ ПО ПРОИЗВОДСТВУ ТОВАРОВ И ОКАЗАНИЮ УСЛУГ ДЛЯ СОБСТВЕННОГО ПОТРЕБЛЕНИЯ"],
  ["U","ДЕЯТЕЛЬНОСТЬ ЭКСТЕРРИТОРИАЛЬНЫХ ОРГАНИЗАЦИЙ И ОРГАНОВ"]
];
const ASSETS = ["Компания / доля в бизнесе","Производственный комплекс","Завод / предприятие","Коммерческая недвижимость","Склад / логистический объект","Земельный участок","Оборудование","Инфраструктурный актив","Инвестиционный проект","Другой актив"];
const REGIONS = ["Центральный ФО","Северо-Западный ФО","Южный ФО","Северо-Кавказский ФО","Приволжский ФО","Уральский ФО","Сибирский ФО","Дальневосточный ФО","Вся Россия","За пределами РФ"];
const TYPES = ["100% компании","Контрольная доля","Миноритарная доля","Продажа актива","Аренда / продажа прав","Другой формат"];
const INITIAL = {asset:"",region:"",type:"",min:"",max:"",period:"",unit:""};
const CLASSIFIER_URL = "https://raw.githubusercontent.com/prog815/okved2/main/okved2.json";
const SOURCE_URL = "https://rosstat.gov.ru/classification";

const paths = {
  grid:"M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z",
  search:"M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35",
  book:"M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  layers:"M12 2 2 7l10 5 10-5-10-5z M2 12l10 5 10-5 M2 17l10 5 10-5",
  chevron:"m6 9 6 6 6-6",
  right:"M5 12h14 m-6-6 6 6-6 6",
  back:"M19 12H5 m6-6-6 6 6 6",
  sliders:"M4 7h10 m4 0h2 M4 17h2 m4 0h10 M14 4v6 M8 14v6",
  close:"M18 6 6 18 M6 6l12 12",
  check:"M20 6 9 17l-5-5",
  shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  info:"M12 16v-4 M12 8h.01 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  plus:"M12 5v14 M5 12h14",
  reset:"M3 12a9 9 0 1 0 2.7-6.4 M3 4v5h5",
  spark:"m12 3 1.9 5.9L20 11l-6.1 2.1L12 19l-1.9-5.9L4 11l6.1-2.1L12 3z",
  building:"M3 22h18 M5 22V5l7-3 7 3v17 M9 9h.01 M15 9h.01 M9 13h.01 M15 13h.01 M10 22v-5h4v5",
  clock:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  funnel:"M4 4h16l-6 7v8l-4 2V11L4 4z",
  external:"M14 3h7v7 M10 14 21 3 M21 13v8H3V3h8"
};
function Icon({name,size=18}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.info}/></svg>;
}
function ExpobankLogo({light=false}) {
  return <div className={"brand "+(light?"brand-light":"")}>
    <span className="brand-mark" aria-hidden="true"><i/><i/><i/><b/></span>
    <span className="brand-type">ЭКСПОБАНК</span>
  </div>;
}
function Select({label,value,onChange,items,placeholder="Все",disabled=false}) {
  return <label className="field"><span className="field-label">{label}</span><span className="select-wrap"><select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}><option value="">{placeholder}</option>{items.map(item=><option key={item} value={item}>{item}</option>)}</select><Icon name="chevron" size={15}/></span></label>;
}
function IndustryPicker({all,loading,error,onSelect,onClose}) {
  const [q,setQ]=useState("");
  const [section,setSection]=useState("");
  const [parent,setParent]=useState("");
  const inputRef=useRef(null);
  useEffect(()=>{inputRef.current?.focus()},[]);
  const childrenMap=useMemo(()=>{const map=new Map(); all.forEach(x=>{if(x.p)map.set(String(x.p),(map.get(String(x.p))||0)+1)});return map;},[all]);
  const matches=useMemo(()=>{
    const term=q.toLocaleLowerCase("ru").replace(/ё/g,"е").trim();
    if(term) return all.filter(x=>Number(x.v)!==0 && (String(x.c).toLocaleLowerCase("ru").includes(term) || String(x.n).toLocaleLowerCase("ru").replace(/ё/g,"е").includes(term))).slice(0,90);
    if(!section) return [];
    if(parent) return all.filter(x=>String(x.p)===parent).slice(0,120);
    return all.filter(x=>String(x.p)===section || Number(x.v)===2&&x.s===section).slice(0,120);
  },[all,section,parent,q]);
  const goBack=()=>{
    if(q){setQ("");return;}
    if(parent){
      const item=all.find(x=>x.c===parent);
      if(item && item.p && String(item.p)!==section){setParent(String(item.p))} else setParent("");
    } else setSection("");
  };
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} role="presentation">
    <section className="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div className="picker-head"><div><p className="eyebrow">ЕДИНЫЙ СПРАВОЧНИК</p><h2 id="picker-title">Отрасли и подотрасли</h2><p>Выберите код ОКВЭД-2 — формулировка всегда будет одинаковой.</p></div><button className="icon-button" onClick={onClose} aria-label="Закрыть"><Icon name="close"/></button></div>
      <div className="picker-controls">
        <div className="picker-search"><Icon name="search" size={18}/><input ref={inputRef} placeholder="Поиск по названию или коду, например 10.51" value={q} onChange={e=>setQ(e.target.value)}/>{q&&<button onClick={()=>setQ("")} aria-label="Очистить поиск"><Icon name="close" size={16}/></button>}</div>
        <div className="pathline"><button onClick={()=>{setSection("");setParent("");setQ("")}}>Все отрасли</button>{section&&<><span>/</span><button onClick={()=>{setParent("");setQ("")}}>Раздел {section}</button></>}{parent&&<><span>/</span><b>{parent}</b></>}</div>
      </div>
      <div className="picker-list">
        {!section&&!q&&SECTIONS.map(([code,title])=><button className="industry-row" key={code} onClick={()=>setSection(code)}><span className="industry-code section-code">{code}</span><span className="industry-name">{title}</span><span className="industry-action"><Icon name="right" size={17}/></span></button>)}
        {(section||q)&&matches.map(item=><div className="industry-row" key={item.c}>
          <button className="industry-browse" onClick={()=>{if(childrenMap.get(String(item.c))){setSection(item.s);setParent(String(item.c));setQ("");}else onSelect(item)}}><span className="industry-code">{item.c}</span><span className="industry-name">{item.n}{q&&<small>Раздел {item.s}</small>}</span>{childrenMap.get(String(item.c))>0&&<Icon name="right" size={17}/>}</button>
          <button className="choose-code" onClick={()=>onSelect(item)}>Выбрать</button>
        </div>)}
        {(section||q)&&matches.length===0&&<div className="picker-empty">{loading?"Загружаем полный классификатор…":error?"Не удалось загрузить подотрасли. Проверьте подключение.":"По выбранным условиям записей нет."}</div>}
      </div>
      <div className="picker-footer"><div className="source-dot"/><span>{loading?"Загрузка классификатора…":error?"Справочник временно недоступен":all.length.toLocaleString("ru-RU")+" кодов и разделов"} · ОКВЭД-2 · Росстат, 01.10.2026</span><a href={SOURCE_URL} target="_blank" rel="noreferrer">Первоисточник <Icon name="external" size={13}/></a></div>
    </section>
  </div>;
}

export default function Home() {
  const [tab,setTab]=useState("buy");
  const [view,setView]=useState("requests");
  const [filters,setFilters]=useState(INITIAL);
  const [industry,setIndustry]=useState(null);
  const [picker,setPicker]=useState(false);
  const [all,setAll]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [search,setSearch]=useState("");
  const [mobileNav,setMobileNav]=useState(false);
  const doLoad=()=>{
    setLoading(true);setError(false);
    fetch(CLASSIFIER_URL,{cache:"force-cache"})
      .then(response=>{if(!response.ok)throw new Error("Источник недоступен");return response.json()})
      .then(records=>{if(!Array.isArray(records)||records.length<1000)throw new Error("Неполный справочник");setAll(records.map(item=>({...item,c:String(item.c||""),n:String(item.n||""),p:String(item.p||""),s:String(item.s||""),v:Number(item.v||0)})));setLoading(false)})
      .catch(()=>{setLoading(false);setError(true)});
  };
  useEffect(()=>{doLoad()},[]);
  useEffect(()=>{function key(e){if(e.key==="Escape")setPicker(false)}window.addEventListener("keydown",key);return ()=>window.removeEventListener("keydown",key)},[]);
  const setF=(name,value)=>setFilters(prev=>({...prev,[name]:value}));
  const reset=()=>{setFilters(INITIAL);setIndustry(null);setSearch("")};
  const fList=Object.entries(filters).filter(([,v])=>!!v);
  const filterCount=fList.length+(industry?1:0)+(search?1:0);
  const labelMap={asset:"Тип актива",region:"География",type:"Формат сделки",min:"От, млн ₽",max:"До, млн ₽",period:"Дата публикации",unit:"Бизнес-юнит"};
  const navigate=(v)=>{setView(v);setMobileNav(false)};
  const openPicker=()=>setPicker(true);
  const keyText=tab==="buy"?"покупку":"продажу";
  const ready=all.length>1000;
  return <div className="shell">
    <aside className={"sidebar "+(mobileNav?"sidebar-open":"")}>
      <div className="sidebar-logo"><ExpobankLogo light/><span className="sidebar-subbrand">M&A Bridge <em>демо</em></span></div>
      <p className="nav-label">РАБОЧЕЕ ПРОСТРАНСТВО</p>
      <nav className="side-nav">
        <button className={view==="requests"?"active":""} onClick={()=>navigate("requests")}><Icon name="grid" size={19}/> Витрина заявок <span className="nav-count">0</span></button>
        <button className={view==="directory"?"active":""} onClick={()=>navigate("directory")}><Icon name="book" size={19}/> Справочник отраслей</button>
        <button className={view==="about"?"active":""} onClick={()=>navigate("about")}><Icon name="layers" size={19}/> О платформе</button>
      </nav>
      <div className="sidebar-bottom"><div className="side-info"><span className="pulse-dot"/><span>Демонстрационный режим</span></div><p>Только интерфейс. Без реальных заявок, авторизации и хранения данных.</p><div className="sidebar-footer">EXPOBANK · M&A BRIDGE</div></div>
    </aside>
    <div className="main-wrap">
      <header className="topbar"><button className="mobile-menu" aria-label="Открыть меню" onClick={()=>setMobileNav(v=>!v)}><Icon name="grid" size={21}/></button><div className="crumb">Внутренние решения <span>/</span> <b>{view==="requests"?"Витрина заявок":view==="directory"?"Справочник отраслей":"О платформе"}</b></div><div className="topbar-right"><span className="top-tag"><span className="pulse-dot"/> ДЕМО-ВЕРСИЯ</span><span className="top-avatar">EX</span></div></header>
      <main className="content">
        {view==="requests"&&<>
          <div className="hero"><div className="hero-copy"><span className="hero-kicker"><span className="hero-kicker-dot"/> ВНУТРЕННЯЯ ПЛАТФОРМА ЭКСПОБАНКА</span><h1>Сделки начинаются<br/>с правильного <span>совпадения.</span></h1><p>M&A Bridge объединяет запросы на покупку и продажу корпоративных активов в едином пространстве.</p><div className="hero-badges"><span><Icon name="shield" size={15}/> Внутренний инструмент</span><span><Icon name="spark" size={15}/> ОКВЭД-2</span></div></div><div className="hero-graphic" aria-hidden="true"><div className="hero-node node-a"><span className="node-emblem">↑</span><div><b>ПОКУПАТЕЛЬ</b><small>Запрос на приобретение</small></div></div><div className="hero-connection"><span/><i>↔</i><span/></div><div className="hero-node node-b"><span className="node-emblem">↓</span><div><b>ПРОДАВЕЦ</b><small>Предложение актива</small></div></div></div></div>
          <div className="section-top"><div><p className="eyebrow">РАБОЧАЯ ПАНЕЛЬ</p><h2>Витрина возможностей</h2><p>Единая точка поиска запросов по всей сети банка.</p></div><span className="no-store"><Icon name="info" size={15}/> Данные не сохраняются</span></div>
          <div className="metrics"><div className="metric"><div className="metric-icon orange"><Icon name="right" size={20}/></div><div><span>Заявок на покупку</span><strong>0</strong></div><small>Нет данных</small></div><div className="metric"><div className="metric-icon teal"><Icon name="layers" size={20}/></div><div><span>Заявок на продажу</span><strong>0</strong></div><small>Нет данных</small></div><div className="metric"><div className="metric-icon muted"><Icon name="book" size={20}/></div><div><span>В справочнике отраслей</span><strong>{ready?all.length.toLocaleString("ru-RU"):loading?"…":"—"}</strong></div><small>{ready?"ОКВЭД-2":error?"Ошибка загрузки":"Загрузка"}</small></div></div>
          <div className="work-area">
            <div className="board-title"><div className="board-tabs" role="tablist"><button role="tab" aria-selected={tab==="buy"} className={tab==="buy"?"selected":""} onClick={()=>setTab("buy")}>Купить <span>0</span></button><button role="tab" aria-selected={tab==="sell"} className={tab==="sell"?"selected":""} onClick={()=>setTab("sell")}>Продать <span>0</span></button></div><span className="tab-hint"><Icon name="funnel" size={15}/> Поиск и фильтрация</span></div>
            <div className="filter-panel"><div className="filter-heading"><strong><Icon name="sliders" size={18}/> Фильтры</strong><button onClick={reset}><Icon name="reset" size={15}/> Сбросить все</button></div>
              <div className="filters-grid">
                <label className="field field-wide"><span className="field-label">Поиск по заявкам</span><span className="search-field"><Icon name="search" size={17}/><input placeholder="Компания, объект, ключевое слово…" value={search} onChange={e=>setSearch(e.target.value)}/></span></label>
                <Select label="Тип актива" value={filters.asset} onChange={v=>setF("asset",v)} items={ASSETS} placeholder="Все типы"/>
                <label className="field field-industry"><span className="field-label">Отрасль / подотрасль (ОКВЭД-2)</span><button className={"industry-input "+(industry?"has-value":"")} onClick={openPicker}><Icon name="book" size={17}/><span>{industry?industry.c+" · "+industry.n:"Выбрать из справочника"}</span><Icon name="chevron" size={15}/></button></label>
                <Select label="География" value={filters.region} onChange={v=>setF("region",v)} items={REGIONS}/>
                <Select label="Тип сделки" value={filters.type} onChange={v=>setF("type",v)} items={TYPES}/>
                <label className="field field-slim"><span className="field-label">Сумма от, млн ₽</span><input className="basic-input" type="number" min="0" placeholder="От" value={filters.min} onChange={e=>setF("min",e.target.value)}/></label>
                <label className="field field-slim"><span className="field-label">Сумма до, млн ₽</span><input className="basic-input" type="number" min="0" placeholder="До" value={filters.max} onChange={e=>setF("max",e.target.value)}/></label>
                <Select label="Дата размещения" value={filters.period} onChange={v=>setF("period",v)} items={["За 7 дней","За 30 дней","За 90 дней","За год"]}/>
                <Select label="Бизнес-юнит" value={filters.unit} onChange={v=>setF("unit",v)} items={["Корпоративный бизнес (демо)","Региональная сеть (демо)","Прочие подразделения (демо)"]}/>
              </div>
              {filterCount>0&&<div className="active-filters"><span>Применено: {filterCount}</span>{industry&&<button onClick={()=>setIndustry(null)}>ОКВЭД {industry.c} <Icon name="close" size={13}/></button>}{fList.map(([k,v])=><button key={k} onClick={()=>setF(k,"")}>{labelMap[k]}: {v} <Icon name="close" size={13}/></button>)}{search&&<button onClick={()=>setSearch("")}>Поиск: {search}<Icon name="close" size={13}/></button>}</div>}
            </div>
            <div className="results-heading"><div><strong>Заявки на {keyText}</strong><span>0 результатов</span></div><span className="results-view"><Icon name="grid" size={16}/> Список</span></div>
            <div className="result-cols"><span>ОБЪЕКТ / ОТРАСЛЬ</span><span>ГЕОГРАФИЯ</span><span>СТОИМОСТЬ</span><span>РАЗМЕЩЕНИЕ</span></div>
            <div className="empty-state"><div className="empty-illustration"><div className="empty-card card-back"/><div className="empty-card card-front"><Icon name="search" size={31}/><span className="empty-lines"><i/><i/><i/></span></div><div className="empty-star">+</div></div><h3>Заявок пока нет</h3><p>Это визуальная версия платформы. Здесь будут отображаться реальные запросы на {keyText}, когда появятся база данных и доступ для менеджеров.</p>{filterCount>0?<button className="button-outline" onClick={reset}><Icon name="reset" size={16}/> Сбросить фильтры</button>:<button className="button-outline" onClick={openPicker}><Icon name="book" size={16}/> Посмотреть справочник отраслей</button>}</div>
          </div>
          <div className="bottom-note"><Icon name="shield" size={18}/><div><b>Демо без клиентских данных</b><span>Все фильтры работают в браузере, но ничего не отправляют и не записывают. Реальные сделки здесь не размещаются.</span></div></div>
        </>}
        {view==="directory"&&<><div className="section-top directory-top"><div><p className="eyebrow">ЕДИНАЯ КЛАССИФИКАЦИЯ</p><h1>Справочник отраслей</h1><p>Единые официальные коды и названия ОКВЭД-2 вместо свободных формулировок.</p></div><span className="directory-count">{ready?all.length.toLocaleString("ru-RU"):"21+"} позиций</span></div><div className="directory-hero"><div><h2>Отрасль → класс → подотрасль → вид деятельности</h2><p>Иерархическая навигация, поиск по коду или названию, выбор нужного уровня детализации.</p><button className="button-primary" onClick={openPicker}><Icon name="search" size={17}/> Открыть классификатор <Icon name="right" size={16}/></button></div><div className="directory-flow"><span>A–U</span><i>→</i><span>10</span><i>→</i><span>10.5</span><i>→</i><span>10.51</span></div></div><div className="directory-grid">{SECTIONS.map(([letter,name])=><button key={letter} onClick={()=>{setPicker(true)}}><strong>{letter}</strong><span>{name}</span><Icon name="right" size={16}/></button>)}</div><p className="directory-foot">Источник: <a href={SOURCE_URL} target="_blank" rel="noreferrer">Росстат, ОКВЭД-2, редакция на 01.10.2026</a>. {error?<button onClick={doLoad}>Повторить загрузку кодов</button>:null}</p></>}
        {view==="about"&&<><div className="section-top directory-top"><div><p className="eyebrow">КОНЦЕПЦИЯ ВНУТРЕННЕГО ПРОДУКТА</p><h1>О M&A Bridge</h1><p>Внутренняя витрина спроса и предложения на корпоративные активы.</p></div></div><div className="about-panel"><div><span className="about-num">01</span><Icon name="layers" size={26}/><h2>Два направления</h2><p>Отдельные вкладки «Купить» и «Продать», одинаковые параметры поиска.</p></div><div><span className="about-num">02</span><Icon name="book" size={26}/><h2>Единые отрасли</h2><p>Стандартизированный ОКВЭД-2, чтобы менеджеры не теряли совпадения из-за разных формулировок.</p></div><div><span className="about-num">03</span><Icon name="sliders" size={26}/><h2>Быстрые фильтры</h2><p>По отраслям, типу актива, географии, сумме, формату сделки и дате размещения.</p></div></div><div className="about-disclaimer"><Icon name="info" size={21}/><div><h3>Ограничения этой версии</h3><p>Прототип не имеет базы данных, авторизации, клиентских заявок и интеграций. Выбранные фильтры существуют только в текущей вкладке браузера.</p></div></div></>}
      </main>
    </div>
    {picker&&<IndustryPicker all={all} loading={loading} error={error} onSelect={item=>{setIndustry(item);setPicker(false);setView("requests")}} onClose={()=>setPicker(false)}/>}
  </div>;
}
