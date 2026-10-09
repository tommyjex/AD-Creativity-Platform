const DEFAULT_INTERNAL_BACKEND_BASE_URL = "http://127.0.0.1:8000";

function getInternalBackendBaseUrl() {
  return (
    process.env.BACKEND_INTERNAL_BASE_URL?.trim() ||
    DEFAULT_INTERNAL_BACKEND_BASE_URL
  ).replace(/\/+$/, "");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    proxyClientMaxBodySize: "200mb",
    proxyTimeout: 900_000
  },
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${getInternalBackendBaseUrl()}/api/:path*`
      }
    ];
  },
  typedRoutes: true
};

export default nextConfig;
