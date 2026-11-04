import "./globals.css";
export const metadata = {
  title:"M&A Bridge — Экспобанк | Демоверсия",
  description:"Визуальный прототип внутренней платформы для сопоставления спроса и предложения на корпоративные активы. Без реальных заявок и хранения данных.",
  robots:{index:false,follow:false},
};
export default function RootLayout({children}) {return <html lang="ru"><body>{children}</body></html>;}
