/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@stratus/shared-types"],
  env: { NEXT_PUBLIC_STRATUS_API_URL: process.env.NEXT_PUBLIC_STRATUS_API_URL ?? "http://localhost:4000" },
};

export default nextConfig;
