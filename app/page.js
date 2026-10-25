"use client";
import {useEffect,useMemo,useState} from "react";
const sections=[["all","Вся лента"],["acts","Нормативные акты"],["projects","Проекты"],["press","Пресс-релизы"],["events","Новости и события"]];
const labels={acts:"Нормативный акт",projects:"Проект",press:"Пресс-релиз",events:"Новость",news:"Публикация"};
const fmt=(v,time=false)=>{if(!v)return "Не указана";let d=new Date(v);if(isNaN(+d))return "Не указана";return new Intl.DateTimeFormat("ru-RU",time?{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Moscow"}:{day:"2-digit",month:"long",year:"numeric",timeZone:"Europe/Moscow"}).format(d)+(time?" МСК":"")};
function Mark(){return <span className="brand-mark"><i/><i/><i/><i/></span>}
function Card({item,saved,toggle}){
 const [flipped,setFlipped]=useState(false);
 const [summary,setSummary]=useState(item.summary||null);
 const [busy,setBusy]=useState(false);
 const [problem,setProblem]=useState("");
 async function loadSummary(){
   if(!summary&&!busy){
     setBusy(true);setProblem("");
     try{
       const r=await fetch("/api/summary?url="+encodeURIComponent(item.url));
       const j=await r.json();
       if(!r.ok)throw Error(j.error||"Не получилось извлечь текст");
       setSummary(j);
     }catch(e){setProblem(e.message||"Ошибка загрузки")}finally{setBusy(false)}
   }
 }
 function turn(){const next=!flipped;setFlipped(next);if(next&&!summary&&!busy)loadSummary()}
 const ignore=e=>Boolean(e.target.closest("a,button,input,select"));
 return <article className="article flip-card" tabIndex={0} aria-label={"Публикация: "+item.title+". Нажмите Enter, чтобы открыть конспект"}
  onClick={e=>{if(!ignore(e))turn()}}
  onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==="Enter"||e.key===" ")){e.preventDefault();turn()}}}>
 <div className={"flip-inner "+(flipped?"is-flipped":"")}>
  <div className="flip-face flip-front">
   <div className="card-top"><div className="tags"><span className={"tag tag-"+item.category}>{labels[item.category]||"Публикация"}</span><span className="tag-topic">{item.topic}</span>{item.priority==="high"&&<span className="tag-hot">● Важно</span>}</div><button className={"save "+(saved?"saved":"")} onClick={()=>toggle(item.id)} title="Сохранить публикацию" aria-label="Сохранить публикацию">☆</button></div>
   <h3><a target="_blank" rel="noopener noreferrer" href={item.url}>{item.title}</a></h3>
   <p className="excerpt">{item.excerpt||"Анонс отсутствует. Переверните карточку — здесь появится конспект полного текста публикации."}</p>
   <div className="facts"><div><span>ОПУБЛИКОВАНО</span><strong>{fmt(item.publishedAt)}</strong></div><div><span>{item.category==="projects"?"СТАТУС":item.category==="acts"?"НАЧАЛО ДЕЙСТВИЯ":"ТИП МАТЕРИАЛА"}</span><strong>{item.category==="projects"?"Проект · ещё не действует":item.category==="acts"?(item.effectiveAt?fmt(item.effectiveAt):"Не указана в анонсе"):(labels[item.category]||"Публикация")}</strong></div></div>
   <div className="card-foot"><span>↗ {item.sourceName}</span><a href={item.url} target="_blank" rel="noopener noreferrer">Читать оригинал ↗</a></div>
   <button className="flip-button" onClick={turn}><span>↻</span> Перевернуть — краткий конспект</button>
  </div>
  <div className="flip-face flip-back">
   <div className="card-top"><span className="tag tag-acts">КРАТКИЙ КОНСПЕКТ</span><button className="flip-back-button" onClick={turn}>↶ Назад</button></div>
   <h3>{item.title}</h3>
   {busy?<div className="summary-state"><span className="loading-ring"/><b>Читаем текст на сайте ЦБ…</b><p>Извлекаем содержание, выделяем главное.</p></div>:
   problem?<div className="summary-state"><b>Не удалось прочитать публикацию</b><p>{problem}</p><button onClick={loadSummary}>Повторить</button></div>:
   summary?<><div className="summary-meta">{summary.method==="ai"?"✦ ИИ-конспект полного текста":"◈ Автоматическая выдержка из текста"} <span>·</span> {summary.charactersRead?.toLocaleString("ru-RU")} символов</div>
     <div className="summary-body"><h4>Суть</h4><p>{summary.short}</p>{summary.points?.length>0&&<><h4>Главные факты</h4><ul>{summary.points.map((p,i)=><li key={i}>{p}</li>)}</ul></>}{summary.effectiveAt&&<p className="summary-effective">Дата действия по анализу: {summary.effectiveAt}</p>}</div>
   </>:<div className="summary-state"><b>Нажмите, чтобы получить конспект</b></div>}
   <div className="summary-footer"><a href={item.url} target="_blank" rel="noopener noreferrer">Открыть полный документ ЦБ ↗</a><small>{summary?.method==="ai"?"Данные требуют сверки с оригиналом":"Автовыдержка без ИИ; проверьте смысл по первоисточнику"}</small></div>
  </div>
 </div>
 </article>;
}

export default function Home(){
const [data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[last,setLast]=useState(null),[refreshing,setRefreshing]=useState(false);
const [tab,setTab]=useState("all"),[search,setSearch]=useState(""),[topic,setTopic]=useState("all"),[sort,setSort]=useState("newest"),[saved,setSaved]=useState([]),[savedOnly,setSavedOnly]=useState(false),[showSources,setShowSources]=useState(false),[limit,setLimit]=useState(18);
useEffect(()=>{try{setSaved(JSON.parse(localStorage.getItem("new-project-bookmarks")||"[]"))}catch{}},[]);
async function refresh(manual=false){if(manual)setRefreshing(true);try{const r=await fetch("/api/feed",{cache:"no-store"});const j=await r.json();if(!j.entries||!j.sources)throw Error("Недоступен ответ сервера");setData(j);setError(r.ok?"":"Источники временно не отвечают");}catch(e){setError(e.message||"Ошибка получения публикаций")}finally{setLast(new Date().toISOString());setLoading(false);setRefreshing(false)}}
useEffect(()=>{refresh();const i=setInterval(()=>{if(!document.hidden)refresh()},15000);const handler=()=>{if(!document.hidden)refresh()};document.addEventListener("visibilitychange",handler);return()=>{clearInterval(i);document.removeEventListener("visibilitychange",handler)}},[]);
const entries=data?.entries||[], good=data?.sources?.filter(x=>x.ok).length||0, topics=[...new Set(entries.map(x=>x.topic))].sort((a,b)=>a.localeCompare(b,"ru"));
const filtered=useMemo(()=>{const q=search.toLocaleLowerCase("ru").trim();const a=entries.filter(x=>(!savedOnly||saved.includes(x.id))&&(tab==="all"||x.category===tab)&&(topic==="all"||x.topic===topic)&&(!q||(x.title+" "+x.excerpt+" "+x.topic).toLocaleLowerCase("ru").includes(q)));if(sort==="priority")a.sort((a,b)=>({high:0,medium:1,normal:2}[a.priority]-{high:0,medium:1,normal:2}[b.priority])||(Date.parse(b.publishedAt||0)-Date.parse(a.publishedAt||0)));return a},[entries,saved,savedOnly,tab,topic,search,sort]);
function toggle(id){setSaved(old=>{let v=old.includes(id)?old.filter(x=>x!==id):[...old,id];try{localStorage.setItem("new-project-bookmarks",JSON.stringify(v))}catch{}return v})}
function clear(){setTab("all");setSearch("");setTopic("all");setSavedOnly(false);setLimit(18)}
return <div className="site"><header className="nav"><div className="container nav-in"><a href="/" className="logo"><Mark/>new<span>project</span><sup> /β</sup></a><div className="nav-menu"><a href="#feed">Публикации</a><a href="#how">Как работает</a><button onClick={()=>setShowSources(!showSources)}>Источники ↗</button></div><span className="nav-live"><i/>МОНИТОРИНГ ЦБ РФ</span></div></header>
<section className="hero"><div className="container hero-in"><div><p className="overline"><span/> REGULATORY INTELLIGENCE <em>01 / БАНК РОССИИ</em></p><h1>Изменения, за которыми <b>важно следить.</b></h1><p className="hero-text">Новости, решения, нормативные акты и проекты Банка России в одном пространстве. Самое важное — сразу. Полные документы — всегда по ссылке на первоисточник.</p><div className="hero-actions"><a href="#feed" className="primary">Смотреть публикации <span>→</span></a><button onClick={()=>setShowSources(!showSources)}>Наши источники ↗</button></div></div><aside className="radar-card"><div className="radar-title"><i/> LIVE MONITORING</div><div className="radar-shape"><span/><span/><span/><b/></div><div className="radar-bottom"><small>ПОСЛЕДНЯЯ ПРОВЕРКА</small><strong>{last?fmt(last,true):"Подключаемся…"}</strong><small>{good}/5 официальных источников доступны</small></div></aside></div></section>
<main className="container"><section className="stats"><div><small>ПУБЛИКАЦИИ</small><strong>{data?entries.length:"—"}</strong><span>В доступных RSS-лентах</span></div><div><small>ВАЖНОЕ</small><strong>{data?data.analytics.critical:"—"}</strong><span>По предварительным признакам</span></div><div><small>НОРМАТИВНЫЕ АКТЫ</small><strong>{data?data.analytics.acts:"—"}</strong><span>Официальные публикации</span></div><div><small>ПРОЕКТЫ ДОКУМЕНТОВ</small><strong>{data?data.analytics.projects:"—"}</strong><span>В стадии обсуждения</span></div></section>
{showSources&&<section className="sources" id="sources"><div className="sources-top"><div><small>ПРОЗРАЧНОСТЬ ДАННЫХ</small><h2>Подключённые источники</h2></div><button onClick={()=>setShowSources(false)}>Скрыть ×</button></div><div className="source-list">{(data?.sources||[]).map(s=><div className="source" key={s.id}><span className={s.ok?"ok":"bad"}>● {s.ok?"На связи":"Недоступен"}</span><h4>{s.name}</h4><p>{s.ok?s.count+" публикаций в ответе":s.error||"Ошибка подключения"}</p><a href={s.page} target="_blank" rel="noopener noreferrer">Открыть раздел ↗</a></div>)}</div></section>}
<section className="workspace" id="feed"><div className="headline"><div><span className="overlabel">— ЕДИНАЯ ЛЕНТА</span><h2>В центре внимания<span>.</span></h2><p>Официальные публикации, без вымышленных новостей и дат.</p></div><div className="check-status"><i className={good?"ok-dot":"warn-dot"}/><div>{good?"Источники доступны":"Ожидание источников"}<small>Фоновая проверка: {data?.archiveUpdatedAt?fmt(data.archiveUpdatedAt,true):"ещё не запускалась"}</small></div><button className={refreshing?"spinning":""} title="Проверить сейчас" onClick={()=>refresh(true)} disabled={refreshing}>↻</button></div></div>
{error&&<div className="error">ⓘ {error}. Новые публикации могут появляться с задержкой.</div>}
<div className="control"><div className="tabs">{sections.map(([id,title])=><button key={id} onClick={()=>{setTab(id);setLimit(18)}} className={tab===id?"active":""}>{title}</button>)}</div><div className="filters"><label className="search"><span>⌕</span><input value={search} placeholder="Поиск по публикациям" onChange={e=>{setSearch(e.target.value);setLimit(18)}}/></label><select aria-label="Тема" value={topic} onChange={e=>setTopic(e.target.value)}><option value="all">Все темы</option>{topics.map(x=><option key={x}>{x}</option>)}</select><select aria-label="Сортировка" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Сначала новые</option><option value="priority">Сначала важные</option></select><button className={"favorites "+(savedOnly?"on":"")} onClick={()=>setSavedOnly(!savedOnly)}>☆ Сохранённое</button></div></div>
<div className="results"><span>{loading?"Загружаем публикации…":<>Найдено <b>{filtered.length}</b> публикаций</>}</span><span>● Фоновая проверка: каждые 5 минут · вкладка: 15 секунд</span></div>
{loading?<div className="empty"><div className="loading-ring"/><h3>Получаем данные Банка России</h3><p>Проверяем официальные RSS-каналы…</p></div>:filtered.length?<><div className="cards">{filtered.slice(0,limit).map(x=><Card key={x.id} item={x} saved={saved.includes(x.id)} toggle={toggle}/>)}</div>{filtered.length>limit&&<div className="more"><button onClick={()=>setLimit(n=>n+18)}>Показать ещё →</button></div>}</>:<div className="empty"><h3>{data?.fresh?"Ничего не найдено":"Источники не ответили"}</h3><p>{data?.fresh?"Попробуйте изменить фильтры.":"Проверьте доступность ЦБ или откройте источник напрямую."}</p><button onClick={clear}>Сбросить фильтры</button></div>}
<p className="disclaimer">ⓘ Анонсы на лицевой стороне взяты из RSS. На обратной стороне доступна автовыдержка из полной статьи, а при подключённом API ИИ — смысловой конспект. Если дата вступления в силу не подтверждена, она не подставляется автоматически. Принимайте решения только после проверки первоисточника.</p></section></main>
<section className="method" id="how"><div className="container method-in"><div><span className="overlabel">ПРИНЦИП РАБОТЫ</span><h2>Меньше шума.<br/><span>Больше ясности.</span></h2></div><div className="steps"><div><small>01</small><h3>Собираем</h3><p>Пять официальных RSS-лент: новости, пресс-релизы, новые материалы, нормативные акты и проекты.</p></div><div><small>02</small><h3>Упорядочиваем</h3><p>Удаляем повторы ссылок, определяем темы и отмечаем потенциально важные публикации.</p></div><div><small>03</small><h3>Сверяем</h3><p>Открываем оригинал на сайте Банка России. Не выдумываем даты вступления в силу.</p></div></div></div></section>
<footer><div className="container footer-in"><div className="footer-logo">new<span>project</span><small>Независимый мониторинг. Не является официальным сайтом Банка России.</small></div><div><a href="https://www.cbr.ru/" target="_blank" rel="noopener noreferrer">Банк России ↗</a><small>Время — московское. RSS-ленты не гарантируют полного охвата сайта.</small></div></div></footer></div>
}