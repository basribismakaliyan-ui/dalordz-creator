/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['imapflow', 'mailparser'],
  },
};

export default nextConfig;
