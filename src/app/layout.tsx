import type { Metadata } from "next";
import Script from "next/script";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-code",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenClaw Sales Frontend",
  description: "Sales workflow frontend for project/channel/marking management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
