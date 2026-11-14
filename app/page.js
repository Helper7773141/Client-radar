"use client";
import {useEffect,useMemo,useState} from "react";
const today="2026-11-15";
const initial={start:today,months:24,assetYield:17.5,assetUtil:95,asv:0.48,reserve:4.5,reserveCost:14,depPlatform:0.2,cfaPlatform:0.3,cfaSetup:250000,cfaAnnual:0.05,depOps:0.04,cfaOps:0.08,depRunoff:0,cfaRunoff:0,lossRate:0,stressYield:0,stressRunoff:0};
const cohorts0=[{id:1,date:"2026-12-01",amount:500,months:6,depRate:13.5,cfaRate:13.8,depFee:0,cfaFee:0},{id:2,date:"2027-02-01",amount:350,months:12,depRate:13,cfaRate:13.4,depFee:0,cfaFee:0},{id:3,date:"2027-06-01",amount:250,months:9,depRate:12.5,cfaRate:13,depFee:0,cfaFee:0}];
const addMonths=(s,n)=>{const d=new Date(s+"T00:00:00Z");d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10)};
const monthKey=s=>s.slice(0,7);
const money=n=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
const pct=n=>money(n)+"%";
const num=v=>Number(v)||0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function Input({label,value,onChange,step="0.1",min="0",suffix="",type="number"}){return <label className="field"><span>{label}</span><div className="inputWrap"><input type={type} min={type==="number"?min:undefined} step={step} value={value} onChange={e=>onChange(type==="number"?num(e.target.value):e.target.value)}/>{suffix&&<small>{suffix}</small>}</div></label>}
function Metric({name,value,detail,tone}){return <div className={"metric "+(tone||"")}><span>{name}</span><strong>{value}</strong><small>{detail}</small></div>}
export default function Home(){
 const [tab,setTab]=useState("overview"),[cfg,setCfg]=useState(initial),[cohorts,setCohorts]=useState(cohorts0),[ready,setReady]=useState(false),[scenario,setScenario]=useState("base");
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("funding-lab-v1")||"null");if(saved){if(saved.cfg)setCfg({...initial,...saved.cfg});if(saved.cohorts)setCohorts(saved.cohorts)}}catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)localStorage.setItem("funding-lab-v1",JSON.stringify({cfg,cohorts}))},[cfg,cohorts,ready]);
 const set=(key,value)=>setCfg(c=>({...c,[key]:value}));
 const update=(id,key,v)=>setCohorts(c=>c.map(x=>x.id===id?{...x,[key]:v}:x));
 const data=useMemo(()=>{
 const start=new Date(cfg.start+"T00:00:00Z"),horizon=clamp(num(cfg.months),1,120),end=new Date(addMonths(cfg.start,horizon)+"T00:00:00Z");
 const rows=[], totals={dep:{interest:0,asv:0,reserve:0,platform:0,ops:0,asset:0,loss:0,balanceDays:0,peak:0},cfa:{interest:0,asv:0,reserve:0,platform:0,ops:0,asset:0,loss:0,balanceDays:0,peak:0}};
 const activeCohorts=cohorts.filter(x=>x.date&&x.amount>0&&x.months>0);
 const horizonDays=Math.max(1,(end-start)/86400000);
 for(let m=0;m<horizon;m++){
 const mStart=new Date(addMonths(cfg.start,m)+"T00:00:00Z"),mEnd=new Date(addMonths(cfg.start,m+1)+"T00:00:00Z");
 const entry={month:monthKey(mStart.toISOString()),dep:0,cfa:0,depCost:0,cfaCost:0,depMargin:0,cfaMargin:0,asset:0};
 for(const type of ["dep","cfa"]){
 let interest=0,asv=0,reserve=0,platform=0,ops=0,asset=0,loss=0,balanceDays=0,peak=0;
 for(const x of activeCohorts){
 const orig=new Date(x.date+"T00:00:00Z"),mat=new Date(addMonths(x.date,num(x.months))+"T00:00:00Z");
 const from=Math.max(mStart.getTime(),orig.getTime()),to=Math.min(mEnd.getTime(),mat.getTime());
 if(to<=from)continue;
 const days=(to-from)/86400000,amount=num(x.amount)*1e6;
 const runoff=clamp(type==="dep"?num(cfg.depRunoff)+ (scenario==="stress"?num(cfg.stressRunoff):0):num(cfg.cfaRunoff),0,100)/100;
 const age=(from-orig.getTime())/86400000;
 const effective=amount*Math.pow(1-runoff,age/365);
 const avg=effective*(runoff>0?(1-Math.pow(1-runoff,days/365))/(-Math.log(1-runoff)*days/365):1);
 const exposure=avg*days/365;
 const rate=num(type==="dep"?x.depRate:x.cfaRate)/100;
 interest+=exposure*rate;
 asv+=type==="dep"?exposure*num(cfg.asv)/100:0;
 reserve+=exposure*num(cfg.reserve)/100*num(cfg.reserveCost)/100;
 const feeRate=(type==="dep"?num(cfg.depPlatform)+num(x.depFee):num(cfg.cfaPlatform)+num(cfg.cfaAnnual)+num(x.cfaFee))/100;
 platform+=exposure*feeRate;
 ops+=exposure*num(type==="dep"?cfg.depOps:cfg.cfaOps)/100;
 asset+=exposure*num(cfg.assetUtil)/100*(num(cfg.assetYield)+(scenario==="stress"?num(cfg.stressYield):0))/100;
 loss+=exposure*num(cfg.lossRate)/100;
 balanceDays+=avg*days;peak+=effective;
 }
 const total=totals[type];for(const [k,v] of Object.entries({interest,asv,reserve,platform,ops,asset,loss,balanceDays}))total[k]+=v;total.peak=Math.max(total.peak,peak);
 const cost=interest+asv+reserve+platform+ops+(type==="cfa"&&m===0?num(cfg.cfaSetup):0);
 const margin=asset-loss-cost;
 entry[type]=balanceDays/((mEnd-mStart)/86400000)/1e6;entry[type+"Cost"]=cost/1e6;entry[type+"Margin"]=margin/1e6;
 if(type==="cfa")entry.asset=asset/1e6;
 }
 rows.push(entry);
 }
 const summary={};
 for(const type of ["dep","cfa"]){
 const t=totals[type],setup=type==="cfa"?num(cfg.cfaSetup):0,expenses=t.interest+t.asv+t.reserve+t.platform+t.ops+setup;
 summary[type]={...t,setup,expenses,margin:t.asset-t.loss-expenses,avgBalance:t.balanceDays/horizonDays,weightedCost:t.balanceDays>0?expenses/t.balanceDays*365*100:0,marginRate:t.balanceDays>0?(t.asset-t.loss-expenses)/t.balanceDays*365*100:0};
 }
 return {rows,summary,volume:activeCohorts.reduce((s,x)=>s+num(x.amount),0),horizonDays};
 },[cfg,cohorts,scenario]);
 const dep=data.summary.dep,cfa=data.summary.cfa,diff=cfa.margin-dep.margin;
 const exportCsv=()=>{const head="Месяц;Остаток вклада млн;Остаток ЦФА млн;Расход вклада млн;Расход ЦФА млн;Маржа вклада млн;Маржа ЦФА млн";const lines=data.rows.map(r=>[r.month,r.dep,r.cfa,r.depCost,r.cfaCost,r.depMargin,r.cfaMargin].join(";"));const blob=new Blob(["\uFEFF"+[head,...lines].join("\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="expobank-funding-model.csv";a.click();URL.revokeObjectURL(url)};
 const reset=()=>{if(window.confirm("Сбросить все параметры к демонстрационным?")){setCfg(initial);setCohorts(cohorts0);setScenario("base")}};
 const row=(x)=><tr key={x.id}><td><input aria-label="Дата привлечения" type="date" value={x.date} onChange={e=>update(x.id,"date",e.target.value)}/></td><td><input aria-label="Объем, млн" type="number" min="0" step="10" value={x.amount} onChange={e=>update(x.id,"amount",num(e.target.value))}/></td><td><input aria-label="Срок, мес" type="number" min="1" max="120" value={x.months} onChange={e=>update(x.id,"months",num(e.target.value))}/></td><td><input aria-label="Ставка вклада" type="number" min="0" step=".1" value={x.depRate} onChange={e=>update(x.id,"depRate",num(e.target.value))}/></td><td><input aria-label="Ставка ЦФА" type="number" min="0" step=".1" value={x.cfaRate} onChange={e=>update(x.id,"cfaRate",num(e.target.value))}/></td><td><button className="remove" onClick={()=>setCohorts(v=>v.filter(a=>a.id!==x.id))}>×</button></td></tr>;
 const configFields=(fields)=>fields.map(([key,label,step,suffix])=><Input key={key} label={label} value={cfg[key]} onChange={v=>set(key,v)} step={step||"0.1"} suffix={suffix||"%"}/>);
 return <main className="shell"><header className="top"><div><div className="eyebrow">EXPOBANK · TREASURY & RISK ANALYTICS</div><h1>Funding Lab <span> / Вклад vs ЦФА</span></h1><p>Сценарная модель стоимости привлечения, ликвидности и процентной маржи</p></div><div className="actions"><button onClick={exportCsv}>↓ Экспорт CSV</button><button onClick={reset}>Сбросить</button></div></header>
 <div className="notice"><b>Модель, не фактический P&L.</b> Все ставки и комиссии — редактируемые допущения. «Доход» означает условный процентный доход от размещения привлеченных средств, а «маржа» — доход минус стоимость фондирования, резерва, кредитные потери и заданные расходы. Не учтены налоги, капитал, нормативы ликвидности и детальная методика ФОР.</div>
 <nav className="tabs">{[["overview","Обзор"],["flows","Транши и сроки"],["deposit","Вклад"],["cfa","ЦФА"],["risk","Риски и стресс"],["monthly","Помесячный расчет"]].map(([k,t])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{t}</button>)}</nav>
 <section className="main">
 {tab==="overview"&&<><div className="sectionHead"><div><h2>Экономика фондирования</h2><p>Суммарный результат за расчетный горизонт · {cfg.months} мес.</p></div><div className="switch"><button className={scenario==="base"?"selected":""} onClick={()=>setScenario("base")}>База</button><button className={scenario==="stress"?"selected":""} onClick={()=>setScenario("stress")}>Стресс</button></div></div><div className="metrics"><Metric name="Объем привлечения" value={money(data.volume)+" млн ₽"} detail={cohorts.length+" траншей"}/><Metric name="Средняя стоимость вклада" value={pct(dep.weightedCost)} detail="все заданные расходы, годовых"/><Metric name="Средняя стоимость ЦФА" value={pct(cfa.weightedCost)} detail="включая запуск и обслуживание"/><Metric name="Разница маржи ЦФА − вклад" value={money(diff/1e6)+" млн ₽"} detail={diff>=0?"ЦФА выгоднее в модели":"Вклад выгоднее в модели"} tone={diff>=0?"positive":"negative"}/></div><div className="two"><article className="panel"><h3>Вклад</h3><div className="big">{money(dep.margin/1e6)} <small>млн ₽</small></div><p>Расчетная маржа за горизонт</p><dl><div><dt>Проценты клиентам</dt><dd>{money(dep.interest/1e6)} млн</dd></div><div><dt>АСВ</dt><dd>{money(dep.asv/1e6)} млн</dd></div><div><dt>Стоимость ФОР</dt><dd>{money(dep.reserve/1e6)} млн</dd></div><div><dt>Платформа + операции</dt><dd>{money((dep.platform+dep.ops)/1e6)} млн</dd></div><div><dt>Доход от активов</dt><dd>{money(dep.asset/1e6)} млн</dd></div></dl></article><article className="panel"><h3>ЦФА</h3><div className="big">{money(cfa.margin/1e6)} <small>млн ₽</small></div><p>Расчетная маржа за горизонт</p><dl><div><dt>Выплаты инвесторам</dt><dd>{money(cfa.interest/1e6)} млн</dd></div><div><dt>АСВ</dt><dd>0 млн</dd></div><div><dt>Стоимость ФОР</dt><dd>{money(cfa.reserve/1e6)} млн</dd></div><div><dt>Платформа + операции + запуск</dt><dd>{money((cfa.platform+cfa.ops+cfa.setup)/1e6)} млн</dd></div><div><dt>Доход от активов</dt><dd>{money(cfa.asset/1e6)} млн</dd></div></dl></article></div><article className="panel"><h3>Динамика остатков по месяцам, млн ₽</h3><div className="bars">{data.rows.map((r,i)=><div key={i} className="barGroup" title={r.month+" · вклад "+money(r.dep)+" · ЦФА "+money(r.cfa)}><div className="bar dep" style={{height:(r.dep/Math.max(1,...data.rows.map(x=>x.dep))*100)+"%"}}/><div className="bar cfa" style={{height:(r.cfa/Math.max(1,...data.rows.map(x=>x.cfa))*100)+"%"}}/></div>)}</div><div className="legend"><span>■ Вклад</span><span>■ ЦФА</span><small>Наведите на столбец для значений</small></div></article></>}
 {tab==="flows"&&<><div className="sectionHead"><div><h2>График привлечения</h2><p>Добавляйте транши с разными датами, сроками, суммами и ставками. В расчет включаются только дни внутри горизонта.</p></div><button className="primary" onClick={()=>setCohorts(v=>[...v,{id:Math.max(0,...v.map(x=>x.id))+1,date:cfg.start,amount:100,months:12,depRate:13,cfaRate:13.4,depFee:0,cfaFee:0}])}>+ Добавить транш</button></div><div className="panel tableScroll"><table><thead><tr><th>Дата</th><th>Объем, млн ₽</th><th>Срок, мес.</th><th>Вклад, %</th><th>ЦФА, %</th><th></th></tr></thead><tbody>{cohorts.map(row)}</tbody><tfoot><tr><td>Всего</td><td>{money(data.volume)}</td><td colSpan="4">млн ₽ заявленного привлечения</td></tr></tfoot></table></div><div className="panel"><h3>Горизонт модели</h3><div className="fields"><Input type="date" label="Начало расчета" value={cfg.start} onChange={v=>set("start",v)}/><Input label="Горизонт, месяцев" value={cfg.months} onChange={v=>set("months",clamp(v,1,120))} step="1" suffix="мес."/></div></div></>}
 {tab==="deposit"&&<><h2>Параметры вклада</h2><p className="intro">Ставки и объемы задаются для каждого транша во вкладке «Транши и сроки».</p><div className="panel"><div className="fields">{configFields([["asv","Взносы АСВ, годовых"],["depPlatform","Комиссия витрины, эквивалент годовых"],["depOps","Операционные расходы, годовых"],["depRunoff","Досрочный отток, годовых"]])}</div></div><div className="notice">Досрочный отток здесь моделируется как постепенное сокращение остатка; пересчет процентов при фактическом досрочном расторжении не моделируется. Комиссии платформы заданы как процент от среднего остатка за год, а не как разовый тариф за привлечение.</div><div className="metrics"><Metric name="Процентные расходы" value={money(dep.interest/1e6)+" млн ₽"}/><Metric name="АСВ" value={money(dep.asv/1e6)+" млн ₽"}/><Metric name="Платформа" value={money(dep.platform/1e6)+" млн ₽"}/><Metric name="Маржа" value={money(dep.margin/1e6)+" млн ₽"}/></div></>}
 {tab==="cfa"&&<><h2>Параметры ЦФА</h2><p className="intro">Отдельная экономика выпуска: ставка каждого транша, инфраструктура, отсутствие АСВ и ликвидность.</p><div className="panel"><div className="fields">{configFields([["cfaPlatform","Комиссия платформы, годовых"],["cfaAnnual","Доп. комиссия, годовых"],["cfaOps","Операционные расходы, годовых"],["cfaRunoff","Досрочное погашение/выкуп, годовых"]])}<Input label="Разовые затраты на запуск, ₽" value={cfg.cfaSetup} onChange={v=>set("cfaSetup",v)} step="10000" suffix="₽"/></div></div><div className="notice"><b>Регуляторные ограничения:</b> лимит для неквалифицированных инвесторов зависит от структуры ЦФА, рейтинга обязанного лица и актуальных требований Банка России. В модели не заложено автоматическое право инвестора на досрочный возврат. Значение «досрочное погашение» используется только если это разрешено условиями выпуска.</div><div className="metrics"><Metric name="Выплаты инвесторам" value={money(cfa.interest/1e6)+" млн ₽"}/><Metric name="АСВ" value="0 ₽"/><Metric name="Инфраструктура и запуск" value={money((cfa.platform+cfa.ops+cfa.setup)/1e6)+" млн ₽"}/><Metric name="Маржа" value={money(cfa.margin/1e6)+" млн ₽"}/></div></>}
 {tab==="risk"&&<><h2>Риски, ФОР и стресс-параметры</h2><div className="panel"><h3>Общие параметры</h3><div className="fields">{configFields([["assetYield","Доходность размещения средств, годовых"],["assetUtil","Доля средств, размещенная в доходные активы"],["reserve","Норматив резервирования ФОР"],["reserveCost","Альтернативная стоимость ФОР, годовых"],["lossRate","Ожидаемые кредитные потери, годовых"]])}</div></div><div className="panel"><h3>Стресс-сценарий</h3><div className="fields">{configFields([["stressYield","Изменение доходности активов, п. п.","0.1","п. п."],["stressRunoff","Дополнительный отток вкладов, п. п.","1","п. п."]])}</div><div className="switch"><button className={scenario==="base"?"selected":""} onClick={()=>setScenario("base")}>Базовый расчет</button><button className={scenario==="stress"?"selected":""} onClick={()=>setScenario("stress")}>Применить стресс</button></div></div><div className="notice">ФОР: в модели показана <b>стоимость отвлеченной ликвидности</b> = средний остаток × норматив × альтернативная ставка × доля года. Это упрощение, не расчет фактических обязательных резервов по методике Банка России. Стресс оттока влияет на объем и маржу, но не на потребность в ликвидных активах или нормативы Н2/Н3/Н4.</div></>}
 {tab==="monthly"&&<><div className="sectionHead"><div><h2>Помесячный расчет</h2><p>Все значения в млн ₽. Остаток — средний за месяц, расходы и маржа — за месяц.</p></div><button onClick={exportCsv}>↓ Скачать CSV</button></div><div className="panel tableScroll"><table><thead><tr><th>Месяц</th><th>Вклад: остаток</th><th>ЦФА: остаток</th><th>Вклад: расход</th><th>ЦФА: расход</th><th>Вклад: маржа</th><th>ЦФА: маржа</th></tr></thead><tbody>{data.rows.map(r=><tr key={r.month}><td>{r.month}</td>{["dep","cfa","depCost","cfaCost","depMargin","cfaMargin"].map(k=><td key={k}>{money(r[k])}</td>)}</tr>)}</tbody></table></div></>}
 </section><footer>Funding Lab · Демонстрационная аналитическая модель · Параметры сохраняются локально в браузере. Проверяйте тарифы, учет и регуляторные нормативы перед принятием решений.</footer></main>
}