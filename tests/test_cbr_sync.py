import unittest
import xml.etree.ElementTree as ET
from unittest.mock import patch
from scripts import sync_cbr as crawler

class CbrCrawlerTests(unittest.TestCase):
    def test_url_restriction(self):
        for bad in ("http://www.cbr.ru/x","https://cbr.ru.evil.example/x","https://user:pass@cbr.ru/x","https://localhost/"):
            with self.assertRaises(ValueError):crawler.safe_url(bad)
        self.assertEqual(crawler.safe_url("https://www.cbr.ru/project_na/"),"https://www.cbr.ru/project_na/")

    def test_article_content(self):
        html='''<html><header>Большая навигация</header><main><h1>Новое решение</h1>
         <p>Банк России принял решение сохранить ставку на уровне четырнадцати процентов годовых.</p>
         <p>Решение действует со дня опубликования, требования адресованы кредитным организациям.</p>
         <p>Показатель инфляции ожидается на уровне четырех процентов по итогам следующего года.</p></main></html>'''
        obj=crawler.html_content(html,"https://www.cbr.ru/press/event/?id=111")
        self.assertNotIn("Большая навигация",obj["text"])
        self.assertIn("кредитным организациям",obj["text"])
        summary=crawler.digest(obj["text"],"html","Решение")
        self.assertGreater(len(summary["short"]),50)
        self.assertEqual(summary["method"],"extractive")

    def test_data_table(self):
        html='''<html><h1>Ставка</h1><table><tr><th>Дата</th><th>Ставка</th><th>Статус расчета</th></tr>
        <tr><td>22.10.2026</td><td>0,31</td><td>Стандартный</td></tr>
        <tr><td>21.10.2026</td><td>0,59</td><td>Стандартный</td></tr></table></html>'''
        obj=crawler.html_content(html,"https://www.cbr.ru/hd_base/ImpliedRateCNY/")
        self.assertEqual(obj["kind"],"data")
        digest=crawler.digest(obj["text"],"data","Вмененная ставка")
        self.assertIn("0,31",digest["short"])
        self.assertIn("22.10.2026",digest["short"])

    def test_rss_parse_and_category(self):
        example="""<rss><channel><item><title>Вмененная ставка валютного свопа овернайт в юанях</title>
        <link>https://www.cbr.ru/hd_base/ImpliedRateCNY/</link>
        <pubDate>Fri, 23 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>""".encode("utf8")
        with patch.object(crawler,"fetch",return_value=(example,"application/rss+xml","https://www.cbr.ru/rss/RssNews")):
            state,items=crawler.parse_rss(crawler.FEEDS[0])
        self.assertTrue(state["ok"])
        self.assertEqual(items[0]["category"],"data")
        self.assertTrue(items[0]["publishedAt"].startswith("2026-10-23"))

    def test_project_index_with_div_header(self):
        html='''<html><section><div>Проект указания Банка России «О новых требованиях к банковской отчетности кредитных организаций»</div>
        <a href="/Content/Document/File/190123/proekt.pdf">Проект указания Банка России</a>
        <a href="/Content/Document/File/190123/note.pdf">Пояснительная записка</a></section></html>'''.encode("utf8")
        with patch.object(crawler,"fetch",return_value=(html,"text/html","https://www.cbr.ru/project_na/")):
            state,items=crawler.parse_index(crawler.EXTRA[1])
        self.assertTrue(state["ok"],state.get("error"))
        self.assertEqual(len(items),1)
        self.assertIn("банковской отчетности",items[0]["title"])
        self.assertEqual(items[0]["category"],"projects")

    def test_xlsx_is_extracted_as_data(self):
        import io, zipfile
        x=io.BytesIO()
        with zipfile.ZipFile(x,"w") as z:
            z.writestr("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"></workbook>')
            z.writestr("xl/sharedStrings.xml", '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Дата</t></si></sst>')
            z.writestr("xl/worksheets/sheet1.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>14.20</v></c></row></sheetData></worksheet>')
        text=crawler.xlsx_content(x.getvalue())
        self.assertIn("Дата",text)
        self.assertIn("14.20",text)

    def test_empty_pdf_is_not_summarized(self):
        import fitz
        doc=fitz.open()
        doc.new_page()
        data=doc.tobytes()
        with self.assertRaisesRegex(ValueError,"PDF без извлекаемого текста"):
            crawler.pdf_content(data)

if __name__=="__main__":unittest.main()
