import { fileURLToPath } from "node:url"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["http://192.168.1.10:4000"],
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      // Hotel/room images can be uploaded to any host, so allow http(s) broadly.
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
}

export default nextConfig
