import "./globals.css";

export const metadata = {
  title: "Client Radar",
  description: "Публичные сигналы компаний → коммерческие возможности для корпоративного банка",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
