import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Bárbara & Felipe — Save the Date",
  description: "Uma data para guardar. Março de 2027. Bárbara e Felipe.",
  openGraph: {
    title: "Bárbara & Felipe · Save the Date",
    description: "Março de 2027. Reserve essa data.",
    type: "website",
    images: [{ url: "/photos/img_6359.webp", width: 2400, height: 1600 }],
  },
};
export const viewport: Viewport = { themeColor: "#16343d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
