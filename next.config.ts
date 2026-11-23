import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
    // uploads go to /api/assets as a raw body; allow up to the upload limit
    middlewareClientMaxBodySize: "25mb",
  },
  // links to files from the old app (/_blob/<id>) keep working
  async rewrites() {
    return [{ source: "/_blob/:id", destination: "/api/assets/:id" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
