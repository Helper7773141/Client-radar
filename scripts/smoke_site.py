"""Daily real-browser smoke test of the public banking-regulation dashboard."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE="https://client-radar-zeta.vercel.app"
ART=Path("artifacts")
ART.mkdir(exist_ok=True)

def check(browser,label,viewport,device_scale=1):
    page=browser.new_page(viewport=viewport,device_scale_factor=device_scale,is_mobile=(label=="mobile"),has_touch=(label=="mobile"))
    errors=[]
    page.on("pageerror",lambda error:errors.append(str(error)))
    try:
        response=page.goto(BASE,wait_until="domcontentloaded",timeout=60000)
        assert response and response.status<500,f"Homepage HTTP {response.status if response else 'unavailable'}"
        page.locator(".digest-card").first.wait_for(timeout=65000)
        assert "New Project" in page.title(),f"Unexpected title: {page.title()}"
        cards=page.locator(".digest-card")
        count=cards.count()
        assert count>=1,"No publication cards"
        card=cards.first
        title=card.locator("h3").inner_text()
        summary=card.locator(".digest-summary").inner_text()
        assert summary.strip(),"No preview on first card"
        link=card.locator(".digest-actions a").get_attribute("href")
        assert link and ("www.cbr.ru" in link or "cbr.ru/" in link),f"Missing CBR primary source: {link}"
        button=card.locator(".show-more")
        button.click()
        page.locator(".digest-details").first.wait_for(timeout=15000)
        assert not errors,"Browser errors: "+" | ".join(errors[:3])
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 3"),"Horizontal overflow"
        print(json.dumps({"screen":label,"cards":count,"firstTitle":title[:100],"hasSummary":len(summary)>90,"source":link},ensure_ascii=False))
    finally:
        page.screenshot(path=str(ART/f"{label}.png"),full_page=True,timeout=30000)
        page.close()

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        try:
            check(browser,"mobile",{"width":390,"height":844},2)
            check(browser,"desktop",{"width":1365,"height":950})
            context=browser.new_context()
            response=context.request.get(BASE+"/api/feed",timeout=40000)
            data=response.json()
            print(json.dumps({"apiStatus":response.status,"fresh":data.get("fresh"),"sources":len(data.get("sources",[])),"entries":len(data.get("entries",[])),"summarized":data.get("analytics",{}).get("summarized")},ensure_ascii=False))
            assert response.ok,f"Feed returned HTTP {response.status}"
            assert data.get("entries"),"No official publications"
        finally:
            browser.close()

if __name__=="__main__":main()
