"use client";

import {useEffect,useState} from "react";
import {KINDS,INDUSTRIES,REGIONS} from "../lib/requests";

const regions=Array.from(new Set([
  "Москва","Московская область","Санкт-Петербург","Ленинградская область",
  "Центральная Россия","Сибирь","Тульская область","Приволжский ФО",
  "Уральский ФО","Южный ФО","Северо-Западный ФО","Дальневосточный ФО",
  "Северо-Кавказский ФО","Вся Россия",...REGIONS
])).sort((a,b)=>a.localeCompare(b,"ru"));

const byCategory={
  "Компания":[
    ["industry","Отрасль","select"],["subindustry","Подотрасль","text"],
    ["deal","Тип сделки / доля","text"],["revenue","Выручка","text"],
    ["ebitda","EBITDA","text"],["model","Бизнес-модель (B2B / B2C)","text"],
    ["profit","Чистая прибыль","text"]
  ],
  "Земельный участок":[
    ["permittedUse","Разрешённое использование / виды строительства","text"],
    ["area","Площадь участка","text"],["ownership","Право на участок","text"],
    ["utilities","Коммуникации","text"],["permits","Стадия разрешений","text"],
    ["productionType","Вид производства (если применимо)","text"],
    ["hazard","Класс опасности / пожароопасность (если применимо)","text"]
  ],
  "Склад / логистика":[
    ["area","Площадь объекта","text"],["objectClass","Класс объекта","text"],
    ["ceiling","Высота потолков","text"],["loading","Доковые ворота / подъездные пути","text"],
    ["power","Электрическая мощность","text"],["tenants","Заполняемость / арендаторы","text"]
  ],
  "Производственная площадка":[
    ["productionType","Вид производства","text"],["area","Площадь","text"],
    ["hazard","Класс опасности","text"],["fireSafety","Пожарные характеристики","text"],
    ["power","Электрическая мощность","text"],["capacity","Производственная мощность","text"]
  ],
  "Коммерческая недвижимость":[
    ["estateType","Тип объекта (офис, торговля и т. д.)","text"],["area","Площадь","text"],
    ["objectClass","Класс объекта","text"],["tenants","Арендаторы / занятость","text"],
    ["rentIncome","Арендный доход","text"]
  ]
};
const initial={
  direction:"buy",category:"Компания",title:"",summary:"",region:"",regions:[],
  priceMin:"",priceMax:"",industry:"",subindustry:"",deal:"",
  manager:"Демо-менеджер",unit:"БЮ 01",client:"",address:"",notes:""
};
const placeholder={
  "title":"Например, покупка производителя молочной продукции",
  "summary":"Короткое обезличенное описание для общего списка",
  "client":"Например, ООО «Учебный покупатель»",
  "address":"Условный адрес — только для раздела «Мои заявки»"
};

function TextField({title,value,onChange,required=false,placeholder="",type="text",small=false}){
  return <label className={"create-field "+(small?"":"")}>
    <span>{title}{required&&<b className="required-star"> *</b>}</span>
    <input type={type} required={required} min={type==="number"?"0":undefined} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} maxLength={type==="text"?300:undefined}/>
  </label>;
}
function Icon({name}){
  return name==="close"?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
    :<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;
}

export default function CreateRequestModal({onClose,onSave}){
  const [form,setForm]=useState(initial);
  const [values,setValues]=useState({});
  const [regionChoice,setRegionChoice]=useState("");
  const [custom,setCustom]=useState([]);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    const handler=e=>{if(e.key==="Escape")onClose()};
    document.addEventListener("keydown",handler);
    return ()=>document.removeEventListener("keydown",handler);
  },[onClose]);
  const set=(key,val)=>{setMessage("");setForm(prev=>({...prev,[key]:val}));};
  const categoryFields=byCategory[form.category]||[];
  const addRegion=value=>{
    if(!value)return;
    setForm(prev=>({...prev,regions:prev.regions.includes(value)?prev.regions:[...prev.regions,value]}));
    setRegionChoice("");
  };
  const save=e=>{
    e.preventDefault();
    if(!form.regions.length){setMessage("Добавь хотя бы один регион.");return;}
    if(Number(form.priceMin)<=0){setMessage("Укажи стоимость больше нуля.");return;}
    const hi=form.priceMax===""?Number(form.priceMin):Number(form.priceMax);
    if(hi<Number(form.priceMin)){setMessage("Максимальная стоимость не может быть меньше минимальной.");return;}
    if(form.category==="Компания"&&!values.industry){setMessage("Для компании необходимо указать отрасль.");return;}
    if(form.category==="Земельный участок"&&!values.permittedUse?.trim()){setMessage("Для участка укажи разрешённое использование.");return;}
    const incomplete=custom.find(row=>Boolean(row.label.trim())!==Boolean(row.value.trim()));
    if(incomplete){setMessage("Для дополнительного параметра необходимо заполнить и название, и значение.");return;}
    const entries=custom.filter(row=>row.label.trim()&&row.value.trim());
    if(new Set(entries.map(x=>x.label.trim().toLocaleLowerCase("ru"))).size!==entries.length){setMessage("Названия дополнительных параметров не должны повторяться.");return;}
    const info=categoryFields.filter(([key])=>key!=="industry"&&key!=="subindustry"&&key!=="deal")
      .filter(([key])=>values[key]?.trim())
      .map(([key,label])=>[label,values[key].trim()]);
    const customInfo=entries.map(x=>[x.label.trim(),x.value.trim()]);
    const id="MY-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
    const newRequest={
      id,direction:form.direction,status:"active",owned:true,source:"browser",
      title:form.title.trim(),category:form.category,summary:form.summary.trim(),
      industry:(values.industry||"").trim(),subindustry:(values.subindustry||"").trim(),okved:"",
      regions:form.regions,priceMin:Number(form.priceMin),priceMax:hi,
      date:new Date().toISOString().slice(0,10),manager:form.manager.trim()||"Демо-менеджер",
      unit:form.unit.trim()||"БЮ 01",client:form.client.trim(),address:form.address.trim(),
      deal:(values.deal||"").trim()||(form.direction==="buy"?"Покупка":"Продажа"),
      notes:form.notes.trim(),info:[...info,...customInfo]
    };
    onSave(newRequest);
  };
  return <div className="create-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div className="create-heading">
        <div><span className="create-eyebrow">МОИ ЗАЯВКИ · ДЕМО</span><h2 id="create-title">Добавить заявку</h2><p>Поля формы меняются в зависимости от типа актива.</p></div>
        <button className="create-close" type="button" onClick={onClose} aria-label="Закрыть"><Icon name="close"/></button>
      </div>
      <div className="create-warning"><strong>Только для демонстрации.</strong> Не вводи реальные данные клиентов банка. Заявка сохраняется лишь в этом браузере, без передачи в общую базу.</div>
      <form onSubmit={save} className="create-form">
        <div className="create-section">
          <h3>1. Направление и объект</h3>
          <div className="create-switch" role="group" aria-label="Направление">
            <button type="button" className={form.direction==="buy"?"active":""} onClick={()=>set("direction","buy")}>Купить</button>
            <button type="button" className={form.direction==="sell"?"active":""} onClick={()=>set("direction","sell")}>Продать</button>
          </div>
          <div className="create-grid">
            <label className="create-field"><span>Тип актива <b className="required-star">*</b></span><select value={form.category} onChange={e=>{set("category",e.target.value);setValues({});}}>{KINDS.map(c=><option key={c}>{c}</option>)}</select></label>
            <TextField title="Название заявки" required value={form.title} onChange={v=>set("title",v)} placeholder={placeholder.title}/>
            <label className="create-field create-span-2"><span>Краткое описание <b className="required-star">*</b></span><textarea required maxLength={600} rows={2} value={form.summary} onChange={e=>set("summary",e.target.value)} placeholder={placeholder.summary}/></label>
          </div>
        </div>
        <div className="create-section">
          <h3>2. География и стоимость</h3>
          <div className="create-grid">
            <div className="create-field create-span-2"><span>География <b className="required-star">*</b></span><div className="region-chooser"><select aria-label="Добавить регион" value={regionChoice} onChange={e=>{setRegionChoice(e.target.value);addRegion(e.target.value)}}><option value="">Выбрать регион…</option>{regions.filter(r=>!form.regions.includes(r)).map(r=><option key={r}>{r}</option>)}</select><div className="region-chips">{form.regions.map(r=><button key={r} type="button" onClick={()=>setForm(p=>({...p,regions:p.regions.filter(x=>x!==r)}))}>{r} ×</button>)}</div></div></div>
            <TextField type="number" title="Стоимость от, млн ₽" required value={form.priceMin} onChange={v=>set("priceMin",v)} placeholder="Например, 450"/>
            <TextField type="number" title="Стоимость до, млн ₽ (если диапазон)" value={form.priceMax} onChange={v=>set("priceMax",v)} placeholder="Можно не заполнять"/>
          </div>
        </div>
        <div className="create-section">
          <h3>3. Параметры: {form.category.toLocaleLowerCase("ru")}</h3>
          <div className="create-grid">
            {categoryFields.map(([key,label,type])=>
              type==="select"?<label className="create-field" key={key}><span>{label} <b className="required-star">*</b></span><select value={values[key]||""} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}><option value="">Выбрать отрасль…</option>{INDUSTRIES.map(x=><option key={x}>{x}</option>)}</select></label>:
              <TextField key={key} title={label} value={values[key]||""} required={form.category==="Земельный участок"&&key==="permittedUse"} onChange={v=>setValues(prev=>({...prev,[key]:v}))}/>
            )}
          </div>
        </div>
        <div className="create-section">
          <div className="create-section-title"><h3>4. Дополнительные параметры</h3><button className="create-add-param" type="button" onClick={()=>setCustom(x=>[...x,{id:Date.now()+Math.random(),label:"",value:""}])}><Icon name="plus"/> Добавить параметр</button></div>
          <p className="create-hint">Добавь любое поле, которого нет в стандартной форме: например, мощность, обременения или сроки сделки.</p>
          {custom.length===0&&<p className="create-not-added">Дополнительных параметров пока нет.</p>}
          {custom.map((row,i)=><div className="create-custom-row" key={row.id}>
            <input aria-label={"Название дополнительного параметра "+(i+1)} value={row.label} onChange={e=>setCustom(list=>list.map(x=>x.id===row.id?{...x,label:e.target.value}:x))} placeholder="Название параметра" maxLength={80}/>
            <input aria-label={"Значение дополнительного параметра "+(i+1)} value={row.value} onChange={e=>setCustom(list=>list.map(x=>x.id===row.id?{...x,value:e.target.value}:x))} placeholder="Значение" maxLength={250}/>
            <button type="button" onClick={()=>setCustom(list=>list.filter(x=>x.id!==row.id))} aria-label="Удалить параметр"><Icon name="close"/></button>
          </div>)}
        </div>
        <div className="create-section">
          <h3>5. Ответственный и закрытые сведения</h3>
          <div className="create-grid">
            <TextField title="Менеджер заявки" value={form.manager} onChange={v=>set("manager",v)}/>
            <TextField title="Бизнес-юнит" value={form.unit} onChange={v=>set("unit",v)}/>
            <TextField title="Клиент (видно в «Моих заявках»)" required value={form.client} onChange={v=>set("client",v)} placeholder={placeholder.client}/>
            <TextField title="Точный адрес (видно в «Моих заявках»)" value={form.address} onChange={v=>set("address",v)} placeholder={placeholder.address}/>
            <label className="create-field create-span-2"><span>Дополнительные комментарии</span><textarea rows={3} maxLength={2000} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Только обезличенные сведения, которые можно показывать в общей карточке"/></label>
          </div>
        </div>
        {message&&<p className="create-error" role="alert">{message}</p>}
        <div className="create-footer">
          <p>Поля со звёздочкой обязательны. Новая заявка будет активной.</p>
          <div><button className="create-cancel" type="button" onClick={onClose}>Отмена</button><button className="create-save" type="submit">Добавить заявку</button></div>
        </div>
      </form>
    </section>
  </div>;
}
