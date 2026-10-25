import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { PreferencesProvider } from "@/components/preferences-provider";
import { PwaManager } from "@/components/pwa-manager";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const bodyFont = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: {
    default: "Aeris — Weather, in colour",
    template: "%s · Aeris",
  },
  description:
    "A calm, expressive weather app with a 24-hour outlook, seven-day forecast, and honest data from Open-Meteo.",
  applicationName: "Aeris",
  authors: [{ name: "Aeris" }],
  creator: "Aeris",
  keywords: ["weather", "forecast", "hourly forecast", "weather app", "Open-Meteo"],
  openGraph: {
    title: "Aeris — Weather, in colour",
    description:
      "A calm, expressive weather app with real forecasts from Open-Meteo. No account required.",
    type: "website",
    siteName: "Aeris",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Aeris",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1210" },
  ],
};

const themeInitScript = `(function(){try{var raw=localStorage.getItem("aeris:preferences:v1");var prefs=raw?JSON.parse(raw):{};var theme=prefs.theme||"system";var dark=theme==="dark"||(theme!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.classList.toggle("dark",dark);root.style.colorScheme=dark?"dark":"light";root.dataset.theme=theme;root.dataset.effects=prefs.reducedEffects===true?"reduced":"full";}catch(error){}})();`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${displayFont.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        <PreferencesProvider>
          <TooltipProvider delayDuration={450}>{children}</TooltipProvider>
          <PwaManager />
        </PreferencesProvider>
      </body>
    </html>
  );
}
