import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Gacha",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background font-sans text-body text-ink antialiased">
        <div className="flex h-dvh flex-col">
          <main className="flex-1 overflow-y-auto">{children}</main>
          <Nav />
        </div>
      </body>
    </html>
  );
}
