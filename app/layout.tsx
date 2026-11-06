import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bárbara & Felipe — Save the Date",
  description: "Uma data para guardar. Março de 2027. Bárbara e Felipe.",
  openGraph: {
    title: "Bárbara & Felipe · Save the Date",
    description: "Março de 2027. Reserve essa data.",
    type: "website",
    images: [{ url: "/media/ocean-poster-desktop.jpg", width: 1280, height: 720 }],
  },
};
export const viewport: Viewport = { themeColor: "#16343d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
