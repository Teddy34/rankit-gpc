import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoPostcodes Ranking",
  description: "The company pool Elo ladder",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">GPC <span>Ranking</span></Link>
          {user && <nav aria-label="Main navigation">
            <Link href="/">Ranking</Link>
            <Link href="/history">History</Link>
            <Link href="/games">Games</Link>
            <Link href="/settings" aria-label="Settings">{user.avatar} Settings</Link>
            <form action="/logout" method="post"><button className="nav-button">Sign out</button></form>
          </nav>}
        </header>
        {children}
      </body>
    </html>
  );
}
