import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AntdConfigProvider } from "@/components/ui/antd";
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
const themeScript = `(function(){try{var t=localStorage.getItem("dev360theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}else if(t==="auto"){document.documentElement.removeAttribute("data-theme");}if(localStorage.getItem("dev360side")==="mini"){document.documentElement.setAttribute("data-side","mini");}}catch(e){}})();`;

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
          </AntdConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
