const sources=[
{id:"updates",name:"Новое на сайте",url:"https://www.cbr.ru/rss/RssNews",page:"https://www.cbr.ru/development/RSS/",type:"news"},
{id:"press",name:"Пресс-релизы",url:"https://www.cbr.ru/rss/RssPress",page:"https://www.cbr.ru/press/",type:"press"},
{id:"events",name:"Новости и выступления",url:"https://www.cbr.ru/rss/eventrss",page:"https://www.cbr.ru/news/",type:"events"},
{id:"acts",name:"Официальные нормативные акты",url:"https://www.cbr.ru/rss/navr",page:"https://www.cbr.ru/analytics/na_vr/",type:"acts"},
{id:"projects",name:"Проекты нормативных актов",url:"https://www.cbr.ru/rss/project",page:"https://www.cbr.ru/project_na/",type:"projects"}
];
const entities={"&nbsp;":" ","&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&laquo;":"«","&raquo;":"»","&mdash;":"—","&ndash;":"–"};
function decode(x){return String(x||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&#x([a-f0-9]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&[a-z]+;/gi,m=>entities[m]||m)}
function clean(x){return decode(x).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()}
function tag(xml,n){const v=xml.match(new RegExp("<"+n+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+n+">","i"));return v?decode(v[1]):""}
function date(x){const n=Date.parse(x||"");return Number.isFinite(n)?new Date(n).toISOString():null}
function effective(x){const m=clean(x).match(/(?:вступа(?:ет|ют)\s+в\s+силу|начина(?:ет|ют)\s+действовать|применя(?:ет|ют)ся\s+с)\s*(?:с\s+)?(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})/i);if(!m)return null;const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));return d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[1]?d.toISOString():null}
function topic(t){if(/ключев.*ставк|инфляци|денежно.кредитн/i.test(t))return "Ставка и экономика";if(/115.фз|противодейств|мошеннич|идентификаци|финмонитор/i.test(t))return "Комплаенс";if(/цифров.*рубл|цифров.*валют/i.test(t))return "Цифровые финансы";if(/капитал|ликвидност|банковск|кредитн|отч[её]тност/i.test(t))return "Банковский сектор";if(/страхов|пенсионн|инвестор|бирж|брокер/i.test(t))return "Финансовые рынки";return "Общее"}
function parse(xml,s){if(!/<rss\b|<rdf:RDF\b|<feed\b/i.test(xml))throw Error("Некорректный RSS");return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,100).map(m=>{const b=m[1],title=clean(tag(b,"title")),raw=clean(tag(b,"link")||tag(b,"guid"));let url;try{url=new URL(raw,"https://www.cbr.ru");if(!/^(www\.)?cbr\.ru$/i.test(url.hostname))return null;url.protocol="https:";url.hash=""}catch{return null}if(!title)return null;const excerpt=clean(tag(b,"description")||tag(b,"content:encoded"));const type=/\/na_vr\//i.test(url.href)?"acts":/\/project_na\//i.test(url.href)?"projects":s.type;return {id:url.href.toLowerCase().replace(/\/$/,""),title,url:url.href,excerpt:excerpt.length>310?excerpt.slice(0,300).replace(/\s+\S*$/,"")+"…":excerpt,publishedAt:date(tag(b,"pubDate")||tag(b,"dc:date")||tag(b,"published")),effectiveAt:effective(excerpt+" "+title),category:type,topic:topic(title),priority:/ключев.*ставк|вступа[ею]т в силу|обязательн|лицензи|антифрод/i.test(title)?"high":type==="acts"||type==="projects"?"medium":"normal",sourceId:s.id,sourceName:s.name}}).filter(Boolean)}
let cache=null,cacheAt=0;
const archiveUrl="https://raw.githubusercontent.com/Helper7773141/Client-radar/cbr-feed-data/data/feed.json";
async function getArchive(){
 try{
   const r=await fetch(archiveUrl,{cache:"no-store",signal:AbortSignal.timeout(5000)});
   if(!r.ok)throw Error("HTTP "+r.status);
   const data=await r.json();
   if(!Array.isArray(data.entries)||!Array.isArray(data.sources))throw Error("Malformed archive");
   return data;
 }catch{return null}
}
export async function collectCbr(){
 if(cache&&Date.now()-cacheAt<15000)return cache;
 const [archive,results]=await Promise.all([
   getArchive(),
   Promise.all(sources.map(async s=>{
     try{
       const r=await fetch(s.url,{cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(9500),headers:{"User-Agent":"Mozilla/5.0 (compatible; NewProject/1.0)","Accept":"application/rss+xml,application/xml,text/xml,*/*"}});
       if(!r.ok)throw Error("HTTP "+r.status);
       const entries=parse(await r.text(),s);
       return {source:{...s,ok:true,count:entries.length},entries};
     }catch(e){return {source:{...s,ok:false,count:0,error:e.message},entries:[]}}
   }))
 ]);
 const map=new Map(),rank={acts:5,projects:4,press:3,events:2,news:1};
 if(archive)for(const item of archive.entries){if(item.id&&item.url)map.set(item.id,item)}
 for(const result of results)for(const item of result.entries){
   const prev=map.get(item.id);
   const best=prev&&rank[prev.category]>rank[item.category]?{...item,category:prev.category}:item;
   if(prev?.summary)best.summary=prev.summary;
   map.set(item.id,{...prev,...best});
 }
 const entries=[...map.values()].sort((a,b)=>Date.parse(b.publishedAt||0)-Date.parse(a.publishedAt||0)||rank[b.category]-rank[a.category]);
 const live=results.some(x=>x.source.ok);
 const archiveFresh=archive?.updatedAt&&Date.now()-Date.parse(archive.updatedAt)<6*3600000;
 const fresh=Boolean(live||archiveFresh);
 const payload={fresh,live,archiveUpdatedAt:archive?.updatedAt||null,archivedCount:archive?.entries?.length||0,
   updatedAt:new Date().toISOString(),entries,sources:results.map(x=>x.source),
   analytics:{total:entries.length,critical:entries.filter(x=>x.priority==="high").length,acts:entries.filter(x=>x.category==="acts").length,projects:entries.filter(x=>x.category==="projects").length}};
 if(fresh){cache=payload;cacheAt=Date.now();return payload}
 return cache?{...cache,fresh:false,live:false,sources:payload.sources,checkedAt:payload.updatedAt}:payload;
}
