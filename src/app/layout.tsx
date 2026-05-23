import type { Metadata } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const themeBootstrapScript = `
(function () {
  var resolved = "dark";
  try {
    var raw = localStorage.getItem("smoke_app_settings");
    var mode = "dark";
    if (raw) {
      var s = JSON.parse(raw);
      if (s.theme === "light" || s.theme === "system") mode = s.theme;
    }
    resolved =
      mode === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
        : mode === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
  try {
    var bg = resolved === "light" ? "#eef1f6" : "#050505";
    var pbo = document.createElement("div");
    pbo.id = "__smoke_pbo";
    pbo.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:" + bg + ";transition:opacity 220ms ease;pointer-events:none;";
    document.documentElement.appendChild(pbo);
  } catch (e) {}
})();
`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smoke",
  description: "A GitHub Desktop-style client for Linux",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-motion="smooth"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} neural-root`}
    >
      <body className="neural-body">
        <Script id="smoke-theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
        <div className="aero-ambient" aria-hidden />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
