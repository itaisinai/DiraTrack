import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {title: "DiraTrack", description: "מעקב מבוסס מקורות אחר פרויקט הדירה שלך"};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}
