"use client";
import {useEffect,useMemo,useState} from "react";
const sections=[["all","Вся лента"],["acts","Нормативные акты"],["projects","Проекты"],["press","Пресс-релизы"],["events","Новости и события"],["data","Данные и ставки"]];
const labels={acts:"Нормативный акт",projects:"Проект",press:"Пресс-релиз",events:"Новость",news:"Публикация",data:"Данные"};
const fmt=(v,time=false)=>{if(!v)return "Не указана";let d=new Date(v);if(isNaN(+d))return "Не указана";return new Intl.DateTimeFormat("ru-RU",time?{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Moscow"}:{day:"2-digit",month:"long",year:"numeric",timeZone:"Europe/Moscow"}).format(d)+(time?" МСК":"")};
function Mark(){return <span className="brand-mark"><i/><i/><i/><i/></span>}
function Card({item,saved,toggle}){
 const [expanded,setExpanded]=useState(false);
 const [summary,setSummary]=useState(item.summary||null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{if(item.summary?.short)setSummary(item.summary)},[item.summary]);
 const hasSummary=Boolean(summary?.short);
 const usableExcerpt=Boolean(item.excerpt?.length>65);
 const isData=item.category==="data";
 async function load(){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/summary?url="+encodeURIComponent(item.url),{cache:"no-store"});
   const json=await r.json();
   if(!r.ok||!json.short)throw Error(json.error||"Пока не удалось подготовить выдержку");
   setSummary(json);
  }catch(e){setError(e.message||"Источник временно недоступен")}
  finally{setBusy(false)}
 }
 function details(){setExpanded(v=>!v);if(!expanded&&!hasSummary&&!error)load()}
 const type=item.category==="projects"?"Проект — не действует":item.category==="acts"?"Нормативный документ":isData?"Данные и показатели":labels[item.category]||"Публикация";
 return <article className="article digest-card">
  <div className="card-top"><div className="tags">
   <span className={"tag tag-"+item.category}>{labels[item.category]|| (isData?"Данные":"Публикация")}</span>
   <span className="tag-topic">{item.topic}</span>
   {item.priority==="high"&&<span className="tag-hot">● Предварительно важное</span>}
  </div><button className={"save "+(saved?"saved":"")} onClick={()=>toggle(item.id)} aria-label={saved?"Убрать из сохранённого":"Сохранить публикацию"} title={saved?"Убрать из сохранённого":"Сохранить"}>{saved?"★":"☆"}</button></div>
  <div className="digest-date">{item.publishedAt?fmt(item.publishedAt):item.firstSeenAt?"Обнаружено "+fmt(item.firstSeenAt):"Дата публикации не указана"} <span>·</span> {item.sourceName||"Банк России"}</div>
  <h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></h3>
  {hasSummary?<><p className="digest-summary">{summary.short}</p><div className="digest-method">{summary.method==="ai"?"✦ ИИ-конспект":summary.method==="structured-data"?"▤ Показатели из таблицы":"✓ Факты из оригинала"} <span>·</span> {summary.sourceFormat?.toUpperCase()||"HTML"}</div></>:
    usableExcerpt?<><p className="digest-summary digest-pending">{item.excerpt.slice(0,310)}</p><div className="digest-method muted">◷ Пока только анонс · Полный текст в обработке</div></>:
    <p className="digest-summary digest-pending">{isData?"Опубликованы новые показатели. Откройте детали для извлечения значений таблицы.":"Публикация найдена. Конспект готовится — текст источника ещё не обработан."}</p>}
  <div className="digest-info"><span>{type}</span>{item.category==="acts"&&<span>{item.effectiveAt?"Начало действия: "+fmt(item.effectiveAt):"Дата действия требует проверки"}</span>}</div>
  {expanded&&<section className="digest-details" aria-label="Детали и факты">
   <h4>Ключевые факты из первоисточника</h4>
   {busy?<p className="detail-muted">Получаем содержание с сайта Банка России…</p>:
    error?<><p className="detail-muted">Сейчас не удалось прочитать источник: {error}. Ссылка на оригинал доступна ниже.</p><button className="retry" onClick={load}>Попробовать ещё раз</button></>:
    hasSummary?<><ul>{(summary.points||[]).filter(x=>x!==summary.short).slice(0,4).map((text,i)=><li key={i}>{text}</li>)}</ul>
     {summary.effectiveAt&&item.category==="acts"&&<p className="detail-muted">Возможная дата действия: {summary.effectiveAt} — проверьте текст нормативного акта.</p>}{summary.effectiveRule&&(item.category==="acts"||item.category==="projects")&&<p className="detail-note"><b>Условие действия в тексте:</b> {summary.effectiveRule}</p>}
     <p className="detail-note">{summary.method==="ai"?"Сформировано ИИ по найденному тексту. Требуется проверка по источнику.":summary.method==="structured-data"?"Значения извлечены из таблицы первоисточника.":"Факты автоматически выбраны из опубликованного текста, без ИИ-интерпретации."}</p>
    </>:<p className="detail-muted">Содержание ещё не обработано. Исходный документ можно открыть на сайте ЦБ.</p>}
  </section>}
  <div className="digest-actions"><button className="show-more" onClick={details} aria-expanded={expanded}>{expanded?"Свернуть ↑":hasSummary?"Все факты ↓":"Получить конспект ↓"}</button><a href={item.url} target="_blank" rel="noopener noreferrer">Первоисточник ↗</a></div>
 </article>;
}

export default function Home(){
const [data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[last,setLast]=useState(null),[refreshing,setRefreshing]=useState(false);
const [tab,setTab]=useState("all"),[search,setSearch]=useState(""),[topic,setTopic]=useState("all"),[sort,setSort]=useState("newest"),[saved,setSaved]=useState([]),[savedOnly,setSavedOnly]=useState(false),[showSources,setShowSources]=useState(false),[limit,setLimit]=useState(18);
useEffect(()=>{try{setSaved(JSON.parse(localStorage.getItem("new-project-bookmarks")||"[]"))}catch{}},[]);
async function refresh(manual=false){if(manual)setRefreshing(true);try{const r=await fetch("/api/feed",{cache:"no-store"});const j=await r.json();if(!j.entries||!j.sources)throw Error("Недоступен ответ сервера");setData(j);setError(j.fresh?"":"Нет свежего подтверждения получения данных с источников");}catch(e){setError(e.message||"Ошибка получения публикаций")}finally{setLast(new Date().toISOString());setLoading(false);setRefreshing(false)}}
useEffect(()=>{refresh();const i=setInterval(()=>{if(!document.hidden)refresh()},15000);const handler=()=>{if(!document.hidden)refresh()};document.addEventListener("visibilitychange",handler);return()=>{clearInterval(i);document.removeEventListener("visibilitychange",handler)}},[]);
const entries=data?.entries||[], good=data?.sources?.filter(x=>x.ok).length||0, summarized=entries.filter(x=>x.summary?.short).length, topics=[...new Set(entries.map(x=>x.topic))].sort((a,b)=>a.localeCompare(b,"ru"));
const filtered=useMemo(()=>{const q=search.toLocaleLowerCase("ru").trim();const a=entries.filter(x=>(!savedOnly||saved.includes(x.id))&&(tab==="all"||x.category===tab)&&(topic==="all"||x.topic===topic)&&(!q||(x.title+" "+(x.excerpt||"")+" "+x.topic+" "+(x.summary?.short||"")).toLocaleLowerCase("ru").includes(q)));if(sort==="priority")a.sort((a,b)=>({high:0,medium:1,normal:2}[a.priority]-{high:0,medium:1,normal:2}[b.priority])||(Date.parse(b.publishedAt||0)-Date.parse(a.publishedAt||0)));return a},[entries,saved,savedOnly,tab,topic,search,sort]);
function toggle(id){setSaved(old=>{let v=old.includes(id)?old.filter(x=>x!==id):[...old,id];try{localStorage.setItem("new-project-bookmarks",JSON.stringify(v))}catch{}return v})}
function clear(){setTab("all");setSearch("");setTopic("all");setSavedOnly(false);setLimit(18)}
return <div className="site"><header className="nav"><div className="container nav-in"><a href="/" className="logo"><Mark/>new<span>project</span><sup> /β</sup></a><div className="nav-menu"><a href="#feed">Публикации</a><a href="#how">Как работает</a><button onClick={()=>setShowSources(!showSources)}>Источники ↗</button></div><span className="nav-live"><i/>МОНИТОРИНГ ЦБ РФ</span></div></header>
<section className="hero"><div className="container hero-in"><div><p className="overline"><span/> REGULATORY INTELLIGENCE <em>01 / БАНК РОССИИ</em></p><h1>ЦБ России. <b>Главное за минуту.</b></h1><p className="hero-text">Новости, нормативные акты и решения ЦБ — с краткой сутью и прямой ссылкой на документ.</p><div className="hero-actions"><a href="#feed" className="primary">К свежим публикациям <span>→</span></a><button onClick={()=>setShowSources(!showSources)}>Наши источники ↗</button></div></div><aside className="radar-card"><div className="radar-title"><i/> SOURCE STATUS</div><div className="radar-shape"><span/><span/><span/><b/></div><div className="radar-bottom"><small>ПОСЛЕДНЕЕ ОБРАЩЕНИЕ</small><strong>{last?fmt(last,true):"Подключаемся…"}</strong><small>{good}/{data?.sources?.length||5} RSS-источников ответили</small></div></aside></div></section>
<main className="container"><section className="stats"><div><small>ПУБЛИКАЦИИ</small><strong>{data?entries.length:"—"}</strong><span>В ленте и сохранённом архиве</span></div><div><small>ГОТОВЫЕ КОНСПЕКТЫ</small><strong>{data?summarized:"—"}</strong><span>Факты из первоисточников</span></div><div><small>НОРМАТИВНЫЕ АКТЫ</small><strong>{data?data.analytics.acts:"—"}</strong><span>Официальные публикации</span></div><div><small>ПРОЕКТЫ ДОКУМЕНТОВ</small><strong>{data?data.analytics.projects:"—"}</strong><span>В стадии обсуждения</span></div></section>
{showSources&&<section className="sources" id="sources"><div className="sources-top"><div><small>ПРОЗРАЧНОСТЬ ДАННЫХ</small><h2>Подключённые источники</h2></div><button onClick={()=>setShowSources(false)}>Скрыть ×</button></div><div className="source-list">{(data?.sources||[]).map(s=><div className="source" key={s.id}><span className={s.ok?"ok":"bad"}>● {s.ok?"На связи":"Недоступен"}</span><h4>{s.name}</h4><p>{s.ok?s.count+" публикаций в ответе":s.error||"Ошибка подключения"}</p><a href={s.page} target="_blank" rel="noopener noreferrer">Открыть раздел ↗</a></div>)}</div></section>}
<section className="workspace" id="feed"><div className="headline"><div><span className="overlabel">— ЕДИНАЯ ЛЕНТА</span><h2>В центре внимания<span>.</span></h2><p>Официальные публикации, без вымышленных новостей и дат.</p></div><div className="check-status"><i className={data?.fresh&&good?"ok-dot":"warn-dot"}/><div>{data?.fresh&&good?"Источники доступны":entries.length?"Данные могут устареть":"Источники недоступны"}<small>Последняя серверная проверка: {data?.archiveUpdatedAt?new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Moscow"}).format(new Date(data.archiveUpdatedAt))+" МСК":"ещё не подтверждена"}</small></div><button className={refreshing?"spinning":""} title="Проверить сейчас" onClick={()=>refresh(true)} disabled={refreshing}>↻</button></div></div>
{error&&<div className="error">ⓘ {error}. Новые публикации могут появляться с задержкой.</div>}
<div className="control"><div className="tabs">{sections.map(([id,title])=><button key={id} onClick={()=>{setTab(id);setLimit(18)}} className={tab===id?"active":""}>{title}</button>)}</div><div className="filters"><label className="search"><span>⌕</span><input value={search} placeholder="Поиск по публикациям" onChange={e=>{setSearch(e.target.value);setLimit(18)}}/></label><select aria-label="Тема" value={topic} onChange={e=>setTopic(e.target.value)}><option value="all">Все темы</option>{topics.map(x=><option key={x}>{x}</option>)}</select><select aria-label="Сортировка" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Сначала новые</option><option value="priority">Сначала важные</option></select><button className={"favorites "+(savedOnly?"on":"")} onClick={()=>setSavedOnly(!savedOnly)}>☆ Сохранённое</button></div></div>
<div className="results"><span>{loading?"Загружаем публикации…":<>Найдено <b>{filtered.length}</b> публикаций</>}</span><span>● Обновление фонового архива по расписанию (цель — 5 минут)</span></div>
{loading?<div className="empty"><div className="loading-ring"/><h3>Получаем данные Банка России</h3><p>Проверяем официальные RSS-каналы…</p></div>:filtered.length?<><div className="cards">{filtered.slice(0,limit).map(x=><Card key={x.id} item={x} saved={saved.includes(x.id)} toggle={toggle}/>)}</div>{filtered.length>limit&&<div className="more"><button onClick={()=>setLimit(n=>n+18)}>Показать ещё →</button></div>}</>:<div className="empty"><h3>{data?.fresh?"Ничего не найдено":"Источники не ответили"}</h3><p>{data?.fresh?"Попробуйте изменить фильтры.":"Проверьте доступность ЦБ или откройте источник напрямую."}</p><button onClick={clear}>Сбросить фильтры</button></div>}
<p className="disclaimer">ⓘ Краткие факты извлекаются из HTML, таблиц и поддерживаемых вложений. Без подключённого API ИИ это автоматическая выдержка, а не экспертное юридическое заключение. Если дата вступления в силу не подтверждена, она не подставляется автоматически. Принимайте решения только после проверки первоисточника.</p></section></main>
<section className="method" id="how"><div className="container method-in"><div><span className="overlabel">ПРИНЦИП РАБОТЫ</span><h2>Меньше шума.<br/><span>Больше ясности.</span></h2></div><div className="steps"><div><small>01</small><h3>Собираем</h3><p>Официальные RSS-потоки и отдельная проверка реестров нормативных актов и проектов.</p></div><div><small>02</small><h3>Упорядочиваем</h3><p>Сохраняем историю, убираем повторы, извлекаем факты из статей, таблиц и документов PDF/DOCX.</p></div><div><small>03</small><h3>Сверяем</h3><p>Каждый конспект связан с оригиналом ЦБ. Даты и правовой статус без подтверждения не придумываем.</p></div></div></div></section>
<footer><div className="container footer-in"><div className="footer-logo">new<span>project</span><small>Независимый мониторинг. Не является официальным сайтом Банка России.</small></div><div><a href="https://www.cbr.ru/" target="_blank" rel="noopener noreferrer">Банк России ↗</a><small>Время — московское. RSS-ленты не гарантируют полного охвата сайта.</small></div></div></footer></div>
}