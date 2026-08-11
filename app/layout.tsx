import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexa AP",
  description: "Accounts payable intelligence for Al Rayyan Trading & Contracting.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
