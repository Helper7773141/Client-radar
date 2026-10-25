import "./globals.css";
export const metadata={
  title:"New Project — мониторинг Банка России",
  description:"Нормативные акты, проекты, решения и новости Банка России. Актуальные RSS-публикации, фильтры и ссылки на официальные источники.",
};
export default function RootLayout({children}){
  return <html lang="ru"><body>{children}</body></html>;
}
