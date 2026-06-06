/** @type {import('next').NextConfig} */
const nextConfig = {
  // eufy-security-client draait alleen op de server; niet meebundelen in de build.
  serverExternalPackages: ['eufy-security-client'],
};

export default nextConfig;
