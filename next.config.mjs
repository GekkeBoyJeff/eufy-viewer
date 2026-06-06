/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // eufy-security-client draait alleen op de server; niet meebundelen in de build.
    serverComponentsExternalPackages: ['eufy-security-client'],
  },
};
export default nextConfig;
