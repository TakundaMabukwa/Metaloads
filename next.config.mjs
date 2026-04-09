/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ["192.168.0.129"],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
