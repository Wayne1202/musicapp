/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@musicapp/shared"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }],
  },
};

export default nextConfig;
