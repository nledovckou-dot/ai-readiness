/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const repo = "ai-readiness";

const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isProd ? `/${repo}` : "",
  assetPrefix: isProd ? `/${repo}/` : "",
};

export default nextConfig;
