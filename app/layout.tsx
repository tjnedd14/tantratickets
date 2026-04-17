import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tantra — Reservations",
  description: "Tantra Night Club · Aruba",
  icons: {
    icon: "https://i.imgur.com/tEFCuKr.png",
  },
};

// Run before React hydrates to prevent light/dark mode flash
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('tantra_theme') || 'dark';
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
