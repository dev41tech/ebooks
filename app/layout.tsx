import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./review.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://sambu-online.marcosdiascwb.chatgpt.site"),
  title: "Sambu",
  description:
    "Histórias que ficam em você. Leia, ouça e descubra novas vozes brasileiras.",
  openGraph: {
    title: "Sambu",
    description: "Histórias que ficam em você.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "Sambu — Histórias que ficam em você.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sambu",
    description: "Histórias que ficam em você.",
    images: ["/og.png"],
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#111218",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
