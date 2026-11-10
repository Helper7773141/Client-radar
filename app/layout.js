import "./globals.css";

export const metadata = {
  title: "M&A Bridge — каталог заявок",
  description: "Демонстрационный каталог заявок на покупку и продажу активов.",
  robots: { index: false, follow: false }
};

export default function RootLayout({children}) {
  return <html lang="ru"><body>{children}</body></html>;
}
