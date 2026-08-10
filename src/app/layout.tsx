import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/context/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/Toast";
import { SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-plex",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s - ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://taskmind.app"),
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#c8102e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="no-js" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var h=document.documentElement;h.classList.remove("no-js");try{var t=localStorage.getItem("taskmind:theme");var resolvedTheme;if(t==="light"||t==="dark"||t==="system"){resolvedTheme=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;}else{resolvedTheme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}h.setAttribute("data-theme",resolvedTheme);h.style.colorScheme=resolvedTheme;}catch(e){h.setAttribute("data-theme","light");h.style.colorScheme="light";}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}