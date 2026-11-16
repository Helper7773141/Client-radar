import "./globals.css";

export const metadata = {
  title: "M&A Bridge — демонстрационный каталог заявок",
  description: "Прототип M&A Bridge: заявки на покупку и продажу активов, поиск, фильтры, мои заявки и архив. Все данные вымышлены.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return <html lang="ru"><body>{children}</body></html>;
}
