import type { Metadata } from "next";
import { content, siteBackground } from "./content";
import "./globals.css";

export const metadata: Metadata = {
  title: content.meta.title,
  description: content.meta.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body data-bg={siteBackground || undefined}>{children}</body>
    </html>
  );
}
