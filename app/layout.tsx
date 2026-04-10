import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CipherScore",
  description:
    "Privacy-first password strength checker and generator with local analysis, actionable feedback, and optional breach awareness."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
