import "./globals.css";

export const metadata = {
  title: "M&A Bridge — демоверсия",
  description: "Минимальный демонстрационный интерфейс каталога заявок на покупку и продажу активов.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }) {
  return <html lang="ru"><body>{children}</body></html>;
}
