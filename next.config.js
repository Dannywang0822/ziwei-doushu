/** @type {import('next').NextConfig} */
const pages = process.env.GITHUB_PAGES === 'true';
const basePath = '/ziwei-doushu';

const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  ...(pages
    ? {
        output: 'export',
        basePath,
        assetPrefix: basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

module.exports = nextConfig;
