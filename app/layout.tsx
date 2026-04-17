import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tantra — Reservations",
  description: "Tantra Night Club · Aruba",
  icons: {
    icon: "https://i.imgur.com/tEFCuKr.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
