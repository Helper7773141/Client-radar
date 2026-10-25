#!/usr/bin/env python3
"""Incremental, source-attributed Bank of Russia digest. RSS coverage is not comprehensive."""
import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import io
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup
import fitz
from docx import Document

FEEDS=[
 ("updates","Новое на сайте","https://www.cbr.ru/rss/RssNews","news"),
 ("press","Пресс-релизы","https://www.cbr.ru/rss/RssPress","press"),
 ("events","Новости и выступления","https://www.cbr.ru/rss/eventrss","events"),
 ("acts","Нормативные акты","https://www.cbr.ru/rss/navr","acts"),
 ("projects","Проекты актов","https://www.cbr.ru/rss/project","projects"),
]
INDEX_PAGES={"updates":"https://www.cbr.ru/development/RSS/","press":"https://www.cbr.ru/press/","events":"https://www.cbr.ru/news/","acts":"https://www.cbr.ru/analytics/na_vr/","projects":"https://www.cbr.ru/project_na/"}
EXTRA=[
 ("acts-index","Реестр опубликованных актов","https://www.cbr.ru/analytics/na_vr/","acts"),
 ("projects-index","Перечень проектов актов","https://www.cbr.ru/project_na/","projects")
]
FILE=Path("data/feed.json")
UTC=dt.timezone.utc
MAX_BYTES=7_000_000
HEADERS={"User-Agent":"Mozilla/5.0 (compatible; NewProjectPublicMonitoring/2.0)","Accept":"text/html,application/pdf,application/xml,text/xml,*/*"}

def stamp():return dt.datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00","Z")

def safe_url(url):
 p=urlparse(url)
 if p.scheme!="https" or (p.hostname or "").lower() not in ("cbr.ru","www.cbr.ru") or p.username or p.password:raise ValueError("Domain not allowed")
 return url

def fetch(url):
 safe_url(url)
 req=Request(url,headers=HEADERS)
 with urlopen(req,timeout=14) as r:
  safe_url(r.url)
  size=int(r.headers.get("Content-Length") or 0)
  if size>MAX_BYTES:raise ValueError("Oversized source")
  b=r.read(MAX_BYTES+1)
  if len(b)>MAX_BYTES:raise ValueError("Oversized response")
  return b,(r.headers.get("Content-Type") or "").lower(),r.url

def plain(x):return re.sub(r"\s+"," ",BeautifulSoup(x or "","html.parser").get_text(" ",strip=True)).strip()

def parse_time(text):
 if not text:return None
 try:
  d=email.utils.parsedate_to_datetime(text)
  if d.tzinfo is None:d=d.replace(tzinfo=UTC)
  return d.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00","Z")
 except Exception:return None

def kind_for(url,default):
 url=url.lower()
 if "/project_na/" in url:return "projects"
 if "/na_vr/" in url:return "acts"
 if "/hd_base/" in url or "/statistics/" in url:return "data"
 return default

def topic_for(x):
 x=x.lower()
 for words,label in [
  (("ключев","инфляц","денежно-кредит"),"Денежно-кредитная политика"),
  (("платежн","расчет","перевод","цифрового рубл"),"Платежи"),
  (("отмыван","противодейств","финмонитор","идентификац","115-фз"),"Комплаенс"),
  (("кредитн","банковск","ликвидност","капитал","резерв","отчетност"),"Банковский сектор"),
  (("страхов","пенсионн","брокер","инвест","бирж"),"Финансовые рынки"),
  (("валют","своп","ruonia","наличн","статистик"),"Рыночные данные"),
 ]:
  if any(w in x for w in words):return label
 return "Общее"

def importance(title,category):
 if re.search(r"ключев.{0,12}ставк|совет директоров|обязательн|вступ.{0,15}силу|норматив|лицензи|санкци",title,re.I):return "high"
 if category in ("acts","projects"):return "medium"
 return "normal"

def parse_rss(feed):
 sid,name,url,category=feed
 try:
  b,_,_=fetch(url)
  root=ET.fromstring(b)
  entries=[]
  for item in root.findall(".//item")[:120]:
   def field(n):
    v=item.find(n)
    return "".join(v.itertext()).strip() if v is not None else ""
   title=plain(field("title"))
   link=urljoin("https://www.cbr.ru",field("link") or field("guid"))
   try:safe_url(link)
   except ValueError:continue
   link=link.split("#",1)[0]
   if not title:continue
   c=kind_for(link,category)
   desc=plain(field("description"))
   entries.append({"id":link.lower().rstrip("/"),"url":link,"title":title,"excerpt":desc[:400],
    "publishedAt":parse_time(field("pubDate")),"effectiveAt":None,"category":c,
    "topic":topic_for(title),"priority":importance(title,c),"sourceId":sid,"sourceName":name})
  return {"id":sid,"name":name,"page":INDEX_PAGES[sid],"ok":True,"count":len(entries)},entries
 except Exception as e:return {"id":sid,"name":name,"page":INDEX_PAGES[sid],"ok":False,"count":0,"error":str(e)[:180]},[]

def parse_index(source):
 sid,name,url,kind=source
 try:
  data,_,_=fetch(url)
  soup=BeautifulSoup(data,"html.parser")
  seen=set();items=[]
  def emit(title,link,date_hint=None):
   title=re.sub(r"\s+"," ",title).strip()
   if len(title)<45 or len(title)>850:return
   try:safe_url(link)
   except ValueError:return
   if link in seen:return
   seen.add(link)
   # Date of discovery is not asserted to be the original publication date.
   entry={"id":link.lower().rstrip("/"),"url":link,"title":title,"excerpt":"",
     "publishedAt":date_hint,"firstSeenAt":stamp(),"effectiveAt":None,"category":kind,
     "topic":topic_for(title),"priority":importance(title,kind),
     "sourceId":sid,"sourceName":name}
   items.append(entry)
  if kind=="acts":
   for anchor in soup.select("a[href]")[:400]:
    title=anchor.get_text(" ",strip=True)
    href=urljoin(url,anchor.get("href",""))
    if not re.search(r"Указани|Положени|Инструкци|нормативн|акт Банка России",title,re.I):continue
    if not re.search(r"/UniDbQuery/File/|/Content/Document/File/|\.pdf(?:\?|$)",href,re.I):continue
    context=anchor.parent.parent.get_text(" ",strip=True) if anchor.parent and anchor.parent.parent else ""
    match=re.search(r"Официально опубликовано\s*(\d{2})\.(\d{2})\.(20\d{2})",context,re.I)
    d="%s-%s-%sT00:00:00Z"%(match.group(3),match.group(2),match.group(1)) if match else None
    emit(title,href,d)
  else:
   # The projects register often uses ordinary div text rather than semantic headings.
   # Anchor text and the nearest preceding project description are both checked.
   for a in soup.select("a[href]"):
    href=urljoin(url,a.get("href",""))
    if not re.search(r"\.pdf(?:\?|$)|\.docx(?:\?|$)|/Content/Document/File/|/UniDbQuery/File/",href,re.I):continue
    anchor_text=a.get_text(" ",strip=True)
    if re.search(r"пояснительн|сводн|таблиц|замечани|предложени",anchor_text,re.I):continue
    if not re.search(r"проект|указани|положени|инструкци|документ",anchor_text,re.I):continue
    prior=a.find_previous(string=re.compile(r"Проект\s+(?:указани|положени|инструкци|нормативн)",re.I))
    title=str(prior).strip() if prior else ""
    title=re.sub(r"\s+"," ",title).strip()
    if len(title)<45 or len(title)>850:
     container=a.parent.parent if a.parent and a.parent.parent else a.parent
     title=container.get_text(" ",strip=True) if container else anchor_text
     title=re.sub(r"\s+"," ",title).strip()[:800]
    if re.search(r"проект",title,re.I):emit(title,href)
   for h in soup.find_all(["h2","h3","h4","h5"]):
    title=h.get_text(" ",strip=True)
    if not re.match(r"^(Проект\s+(?:указани|положени|инструкци|нормативн)|Проекты\s+нормативн)",title,re.I):continue
    anchor=None
    container=h.parent
    for nearby in (container,container.parent if container else None):
     if nearby is None:continue
     links=nearby.find_all("a",href=True,limit=14)
     choices=[]
     for a in links:
      href=urljoin(url,a.get("href",""))
      if re.search(r"\.pdf(?:\?|$)|\.docx(?:\?|$)|/Content/Document/File/|/UniDbQuery/File/",href,re.I):
       choices.append(href)
     if choices:anchor=choices[0];break
    if anchor:emit(title,anchor)
  if not items:raise ValueError("Could not identify any individual documents; index layout may have changed")
  return {"id":sid,"name":name,"page":url,"ok":True,"count":len(items)},items[:65]
 except Exception as e:
  return {"id":sid,"name":name,"page":url,"ok":False,"count":0,"error":str(e)[:160]},[]

def clean_list(items,minlen=28):
 out=[];seen=set()
 for x in items:
  x=re.sub(r"\s+"," ",x).strip()
  if len(x)<minlen or len(x)>2300 or x in seen:continue
  seen.add(x);out.append(x)
 return out

def html_content(data,url):
 soup=BeautifulSoup(data,"html.parser")
 for node in soup(["script","style","noscript","svg","nav","header","footer","form","aside"]):node.decompose()
 for node in soup.select(".b-breadcrumbs,.share,.social,.cookies,.cookie-popup,.sidebar,.navigation,.b-side-menu,.page-nav,.search"):node.decompose()
 selectors=[".landing-text",".b-article__body",".b-article",".b-page__content",".page-content",".content-block","[itemprop=articleBody]","article","main","#content",".content"]
 candidates=[]
 for s in selectors:
  for element in soup.select(s):
   ps=clean_list([p.get_text(" ",strip=True) for p in element.select("p,li,h2,h3")])
   candidates.append((sum(len(x) for x in ps),ps))
 p=max(candidates,key=lambda x:x[0])[1] if candidates else []
 if sum(map(len,p))<210:p=clean_list([n.get_text(" ",strip=True) for n in soup.select("p,li")])
 tables=[]
 for table in soup.select("table")[:4]:
  rows=[]
  for tr in table.select("tr")[:16]:
   cells=clean_list([td.get_text(" ",strip=True) for td in tr.select("th,td")],minlen=1)
   if cells and len(" | ".join(cells))<350:rows.append(" · ".join(cells))
  if rows:tables.extend(rows[:12])
 title=soup.select_one("h1")
 h1=title.get_text(" ",strip=True) if title else ""
 urlpath=urlparse(url).path.lower()
 is_data="/hd_base/" in urlpath or "/statistics/" in urlpath or (tables and sum(map(len,p))<280)
 if is_data and tables:
  lines=tables[:9]+p[:6]
 else:
  lines=p[:100]+(["Таблица показателей:"]+tables[:9] if tables else [])
 text="\n".join(lines)[:42000]
 if len(text)<180:
  candidate=[]
  for a in soup.select("a[href]"):
   href=urljoin(url,a.get("href",""))
   try:safe_url(href)
   except ValueError:continue
   u=urlparse(href).path.lower()
   name=a.get_text(" ",strip=True).lower()
   if any(u.endswith(ext) for ext in (".pdf",".docx")) or "/unidbquery/file/" in u or "/content/document/file/" in u:
    priority=1 if any(word in name for word in ("проект","документ","указани","положени","скачать","pdf","текст")) else 0
    candidate.append((priority,href))
  candidate=sorted(candidate,reverse=True)
  attachment=next((u for _,u in candidate),None)
 else:attachment=None
 return {"text":text,"kind":"data" if is_data else "html","attachment":attachment,"tableRows":tables[:8],"h1":h1}

def pdf_content(data):
 pdf=fitz.open(stream=data,filetype="pdf")
 lines=[]
 for p in pdf:
  if p.number>=min(28,len(pdf)):break
  text=p.get_text("text",sort=True)
  if text:lines.append(text)
 out=re.sub(r"[ \t]+"," ","\n".join(lines)).strip()
 if len(out)<200:raise ValueError("PDF без извлекаемого текста — требуется проверка/распознавание")
 return out[:42000]

def docx_content(data):
 doc=Document(io.BytesIO(data))
 lines=[p.text.strip() for p in doc.paragraphs if len(p.text.strip())>25]
 for table in doc.tables[:3]:
  lines.extend(" · ".join(c.text.strip() for c in row.cells) for row in table.rows[:8])
 return "\n".join(lines)[:42000]

def source_text(url):
 b,kind,final=fetch(url)
 if "pdf" in kind or b.startswith(b"%PDF") or urlparse(final).path.lower().endswith(".pdf"):return pdf_content(b),"pdf",final
 if "wordprocessingml" in kind or b.startswith(bytes([80,75,3,4])) or urlparse(final).path.lower().endswith(".docx"):return docx_content(b),"docx",final
 if not ("html" in kind or "text/" in kind or not kind):raise ValueError("Unsupported content type "+kind[:65])
 info=html_content(b.decode("utf-8","replace"),final)
 text,typ=info["text"],info["kind"]
 if len(text)<180 and info["attachment"]:
  attachment=info["attachment"]
  b,k,final=fetch(attachment)
  if "pdf" in k or b.startswith(b"%PDF") or urlparse(final).path.lower().endswith(".pdf"):return pdf_content(b),"pdf",final
  if "wordprocessingml" in k or b.startswith(bytes([80,75,3,4])) or urlparse(final).path.lower().endswith(".docx"):return docx_content(b),"docx",final
 if len(text)<100:raise ValueError("No usable content in HTML/table or attachment")
 return text,typ,final

TERMS=("принял решение","сохранить","установ","измен","составл","планиру","предлага","обязател","следует","вступ","начина","требован","срок","повышен","снижен","будет","применя","распростран","кредитн","банков","период","процент","лимит")
def digest(text,typ,title):
 if typ=="data":
  rows=clean_list(text.split("\n"),1)
  facts=rows[:5]
  header=rows[0] if len(rows)>2 else ""
  values=rows[1:5] if len(rows)>2 and not re.search(r"\d{2}\.\d{2}\.20\d{2}",header) else rows[:4]
  return {"short":"Опубликованные значения: "+"; ".join(values[:3])[:540],"points":facts,"method":"structured-data","sourceFormat":typ,"pipelineVersion":3}
 normalized=re.sub(r"\s+"," ",text)
 sentences=re.split(r"(?<=[.!?])\s+(?=[А-ЯЁ«])",normalized)
 ranked=[]
 for i,s in enumerate(sentences[:190]):
  s=s.strip()
  if not 50<len(s)<590:continue
  sl=s.lower()
  if any(skip in sl for skip in ("персональных данных","при использовании материала ссылка","все права защищены")):continue
  score=(4-i if i<4 else 0)+sum(1.1 for word in TERMS if word in sl)
  score+=min(4,len(re.findall(r"\d[\d\s.,–-]*\s*(?:%|руб|млрд|млн|дн|год|ставк)",sl))*1.8)
  if len(s)>370:score-=1
  ranked.append((score,i,s))
 ranked=sorted(ranked,key=lambda x:(-x[0],x[1]))[:5]
 ranked.sort(key=lambda x:x[1])
 points=clean_list([x[2] for x in ranked],45)[:4]
 if not points:
  paras=clean_list(text.split("\n"),45)
  points=paras[:3]
 if not points:raise ValueError("Text is present but no informative excerpts found")
 return {"short":" ".join(points[:2])[:700],"points":points,"method":"extractive","sourceFormat":typ,"pipelineVersion":3}

def enrich(item):
 try:
  text,typ,source=source_text(item["url"])
  # Avoid presenting unrelated attachments or an entire journal as a digest of one news item.
  if typ=="pdf" and re.search(r"вестник банка россии|бюллетень",item["title"],re.I):
   raise ValueError("A document collection needs per-article analysis")
  if typ in ("pdf","docx") and item["category"] not in ("acts","projects"):
   words=[w.lower()[:7] for w in re.findall(r"[А-Яа-яЁё]{7,}",item["title"]) if not re.match(r"(?i)банка|россии|информаци|публикаци|документ|новости",w)]
   if len(words)>=2 and not any(w in text[:7000].lower() for w in words):
    raise ValueError("Attachment subject does not match RSS publication title")
  summary=digest(text,typ,item["title"])
  summary.update({"charactersRead":len(text),"processedAt":stamp(),"url":source,"verification":"Extracts from source, not legal advice"})
  item["summary"]=summary
  item.pop("lastError",None)
 except Exception as e:
  item["lastError"]=str(e)[:180]
 return item

def run():
 FILE.parent.mkdir(parents=True,exist_ok=True)
 try:prior=json.loads(FILE.read_text(encoding="utf8"))
 except Exception:prior={}
 archive={e["id"]:e for e in prior.get("entries",[]) if e.get("id")}
 for item in archive.values():
  if item.get("summary") and item["summary"].get("pipelineVersion")!=3:
   item.pop("summary",None)
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
  results=list(executor.map(parse_rss,FEEDS)) + list(executor.map(parse_index,EXTRA))
 live=[s for s,_ in results]
 current={}
 for state,items in results:
  for item in items:
   previous=current.get(item["id"])
   if not previous or item["category"] in ("acts","projects"):current[item["id"]]=item
 for id,item in current.items():
  if id in archive:
   prev=archive[id]
   # A data page reuses its URL; refresh published rows even when link is unchanged.
   if prev.get("summary") and item["category"]!="data":item["summary"]=prev["summary"]
   archive[id]={**prev,**item,"firstSeenAt":prev.get("firstSeenAt") or item.get("firstSeenAt")}
  else:archive[id]=item
 # Freshest first, preserving previous material during RSS expiry
 entries=sorted(archive.values(),key=lambda x:x.get("publishedAt") or x.get("firstSeenAt") or "",reverse=True)[:1200]
 # Prioritize missing summaries and refresh up to three changing data dashboards.
 candidates=[x for x in entries if x["id"] in current and (not x.get("summary") or x["category"]=="data")]
 other=[x for x in entries if not x.get("summary") and x["id"] not in current]
 todo=(candidates+other)[:36]
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
  processed=list(executor.map(enrich,todo))
 up={x["id"]:x for x in processed}
 entries=[up.get(x["id"],x) for x in entries]
 ready=sum(bool(x.get("summary",{}).get("short")) for x in entries)
 fetched_ok=sum(s["ok"] for s in live)
 previous_success=prior.get("lastSuccessfulAt")
 result={"updatedAt":stamp(),"lastSuccessfulAt":stamp() if fetched_ok else previous_success,
  "fresh":bool(fetched_ok),"sources":live,"entries":entries,"checkedVia":"GitHub Actions — target interval 5 min",
  "analytics":{"total":len(entries),"summarized":ready,"pending":len(entries)-ready,
   "critical":sum(x["priority"]=="high" for x in entries),
   "acts":sum(x["category"]=="acts" for x in entries),
   "projects":sum(x["category"]=="projects" for x in entries)}}
 FILE.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
 print("Sources:",[(s["id"],s["ok"],s["count"]) for s in live], "Ready:",ready,"Pending:",len(entries)-ready)
 if fetched_ok==0:raise SystemExit("No sources reachable; snapshot retained but workflow should show a failure")

if __name__=="__main__":run()
