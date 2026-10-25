#!/usr/bin/env python3
"""Capture official Bank of Russia RSS publications every five minutes.
A separate data branch acts as a lightweight persistent archive; no web request required.
The RSS sources are NOT claimed to cover every document on cbr.ru.
"""
import concurrent.futures
import datetime as dt
import email.utils
import html
from html.parser import HTMLParser
import json
import os
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

SOURCES=[
    ("updates","Новое на сайте","https://www.cbr.ru/rss/RssNews","news"),
    ("press","Пресс-релизы","https://www.cbr.ru/rss/RssPress","press"),
    ("events","Новости и выступления","https://www.cbr.ru/rss/eventrss","events"),
    ("acts","Нормативные акты","https://www.cbr.ru/rss/navr","acts"),
    ("projects","Проекты актов","https://www.cbr.ru/rss/project","projects"),
]
FILE=Path("data/feed.json")
UTC=dt.timezone.utc

def now():
    return dt.datetime.now(UTC).isoformat().replace("+00:00","Z")

def get(url,limit=2200000):
    p=urlparse(url)
    if p.scheme!="https" or p.hostname not in ("www.cbr.ru","cbr.ru"):
        raise ValueError("Unsafe or unsupported source URL")
    req=Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; NewProjectCbrDigest/1.2)","Accept":"application/rss+xml,application/xml,text/html,text/xml,*/ *"})
    with urlopen(req,timeout=12) as resp:
        if urlparse(resp.url).hostname not in ("www.cbr.ru","cbr.ru"):
            raise ValueError("Redirect outside cbr.ru")
        if int(resp.headers.get("Content-Length","0"))>limit:
            raise ValueError("Document too large")
        data=resp.read(limit+1)
        if len(data)>limit: raise ValueError("Document exceeds size limit")
        return data, resp.headers.get("Content-Type","")

def tidy(x):
    x=re.sub(r"<[^>]*>"," ",x or "")
    return re.sub(r"\s+"," ",html.unescape(x)).strip()

def date(s):
    if not s:return None
    try:
        d=email.utils.parsedate_to_datetime(s)
        if d.tzinfo is None:d=d.replace(tzinfo=UTC)
        return d.astimezone(UTC).isoformat().replace("+00:00","Z")
    except Exception:return None

def category(t,u,default):
    lower=u.lower()
    if "/project_na/" in lower:return "projects"
    if "/na_vr/" in lower:return "acts"
    return default

def topic(t):
    if re.search(r"ключев.*ставк|инфляци|денежно.кредит",t,re.I):return "Ставка и экономика"
    if re.search(r"115.фз|противодейств|мошеннич|идентификаци|финмонитор",t,re.I):return "Комплаенс"
    if re.search(r"цифров.*рубл|цифров.*валют",t,re.I):return "Цифровые финансы"
    if re.search(r"капитал|ликвидност|банковск|кредитн|отч[её]тност",t,re.I):return "Банковский сектор"
    if re.search(r"страхов|пенсионн|инвестор|бирж|брокер",t,re.I):return "Финансовые рынки"
    return "Общее"

def parse_source(row):
    source_id, name, endpoint, kind=row
    try:
        b,_=get(endpoint)
        root=ET.fromstring(b)
        entries=[]
        for node in root.findall(".//item")[:100]:
            def field(s):
                el=node.find(s)
                return "".join(el.itertext()).strip() if el is not None else ""
            title=tidy(field("title"))
            link=field("link") or field("guid")
            link=urljoin("https://www.cbr.ru/",link)
            u=urlparse(link)
            if not title or u.scheme!="https" or u.hostname not in ("www.cbr.ru","cbr.ru"):continue
            link=link.split("#",1)[0]
            k=category(title,link,kind)
            description=tidy(field("description"))
            entries.append({"id":link.lower().rstrip("/"),"url":link,"title":title,"excerpt":description[:350],"publishedAt":date(field("pubDate")),"effectiveAt":None,"category":k,"topic":topic(title),"priority":"high" if re.search(r"ключев.*ставк|вступа[ею]т в силу|обязательн|лицензи|антифрод",title,re.I) else "medium" if k in ("acts","projects") else "normal","sourceId":source_id,"sourceName":name})
        return {"id":source_id,"name":name,"ok":True,"count":len(entries)}, entries
    except Exception as e:
        return {"id":source_id,"name":name,"ok":False,"count":0,"error":str(e)[:190]},[]

class Paragraphs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tag=None;self.level=0;self.hidden=0;self.chunks=[];self.lines=[]
    def handle_starttag(self,tag,attrs):
        if tag in ("script","style","noscript","nav","header","footer","aside"):self.hidden+=1
        if self.hidden:return
        if tag in ("p","li","h2","h3") and self.level==0:self.tag=tag;self.level=1;self.chunks=[]
        elif self.level:self.level+=1
    def handle_data(self,data):
        if self.level and not self.hidden:self.chunks.append(data)
    def handle_endtag(self,tag):
        if tag in ("script","style","noscript","nav","header","footer","aside") and self.hidden:self.hidden-=1
        if self.hidden:return
        if self.level:
            self.level-=1
            if self.level==0:
                text=re.sub(r"\s+"," ","".join(self.chunks)).strip()
                if 45<len(text)<1700:self.lines.append(text)
                self.tag=None;self.chunks=[]

def summarize(text):
    sentences=re.split(r"(?<=[.!?])\s+(?=[А-ЯЁ«])",text.replace("\n"," "))
    terms=["принял решение","ключев","процент","требован","вступ","изменен","изменени","составит","банков","норматив","повышен","снижен","сохран","предлага","закон","срок"]
    options=[]
    for n,s in enumerate(sentences[:140]):
        s=s.strip()
        if not 45<len(s)<640:continue
        score=(max(0,5-n) if n<5 else 0)+sum(1.2 for term in terms if term in s.lower())
        score+=min(2,len(re.findall(r"\d+[.,]?\d*\s*(?:%|руб|млрд|год|процент)",s))*1.5)
        options.append((score,n,s))
    options=sorted(sorted(options,reverse=True)[:4],key=lambda x:x[1])
    points=list(dict.fromkeys(v[2] for v in options))
    return {"short":" ".join(points[:2])[:700],"points":points,"method":"extractive"}

def read_article(item):
    u=item["url"]
    if urlparse(u).path.lower().endswith(".pdf"):return item
    try:
        content,kind=get(u)
        if "pdf" in kind.lower():return item
        parser=Paragraphs()
        parser.feed(content.decode("utf-8","ignore"))
        text="\n".join(parser.lines)[:35000]
        if len(text)<180:return item
        result=summarize(text)
        if len(result["short"])<70:return item
        item={**item,"summary":{**result,"charactersRead":len(text),"processedAt":now(),"url":u}}
    except Exception as e:
        # Don't mark permanently; failed items will be retried in later runs.
        print("Article read failed:",u,str(e)[:90])
    return item

def run():
    FILE.parent.mkdir(parents=True,exist_ok=True)
    try:before=json.loads(FILE.read_text()) if FILE.exists() else {}
    except Exception:before={}
    old={x["id"]:x for x in before.get("entries",[]) if "id" in x}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        results=list(pool.map(parse_source,SOURCES))
    sources=[x[0] for x in results]
    current={}
    for status,items in results:
        for x in items:
            previous=current.get(x["id"])
            if not previous or x["category"] in ("acts","projects"):
                current[x["id"]]=x
    for key,item in current.items():
        if key in old:
            previous=old[key]
            if previous.get("summary"):item["summary"]=previous["summary"]
            # Preserve previously identified date only when linked to this exact entry.
            if previous.get("effectiveAt"):item["effectiveAt"]=previous["effectiveAt"]
            old[key]={**previous,**item}
        else:old[key]=item
    entries=sorted(old.values(),key=lambda x:x.get("publishedAt") or "",reverse=True)[:450]
    todo=[item for item in entries if not item.get("summary")][:12]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        augmented=list(pool.map(read_article,todo))
    augmented_by_id={x["id"]:x for x in augmented}
    entries=[augmented_by_id.get(x["id"],x) for x in entries]
    payload={"updatedAt":now(),"fresh":any(x["ok"] for x in sources),"sources":sources,"entries":entries,"checkedVia":"GitHub Actions / 5-minute schedule","analytics":{"total":len(entries),"critical":sum(x["priority"]=="high" for x in entries),"acts":sum(x["category"]=="acts" for x in entries),"projects":sum(x["category"]=="projects" for x in entries)}}
    FILE.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n")
    print("Official RSS status:",[(x["id"],x["ok"],x["count"]) for x in sources])
    print("Stored:",len(entries),"Summarized:",len([x for x in entries if x.get("summary")]))

if __name__=="__main__":run()
