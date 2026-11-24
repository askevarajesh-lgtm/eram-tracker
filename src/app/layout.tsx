import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AntdConfigProvider } from "@/components/ui/antd";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

const appName = process.env.APP_NAME || "Dev 360 Tracker";

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ERAM HCM Business Tools` },
  description: "ERAM HCM development, users, licences and issues tracker",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230f766e'/%3E%3Ctext x='16' y='21' font-family='Arial' font-size='11' font-weight='700' fill='white' text-anchor='middle'%3EHCM%3C/text%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// Applies the saved theme (and collapsed-sidebar choice) before first paint, so dark-mode users never see a light flash.
const themeScript = `(function(){try{var t=localStorage.getItem("dev360theme");var isLogin=window.location.pathname.startsWith("/login");if(t==="light"){document.documentElement.setAttribute("data-theme","light");}else if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");}else if(isLogin){document.documentElement.setAttribute("data-theme","dark");}else if(t==="auto"){var d=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.setAttribute("data-theme",d?"dark":"light");}else{document.documentElement.setAttribute("data-theme","dark");}if(localStorage.getItem("dev360side")==="mini"){document.documentElement.setAttribute("data-side","mini");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" />
      </head>
      <body>
        <AntdRegistry>
          <AntdConfigProvider>
            {children}
            <Toaster />
          </AntdConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
