/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/iegult/:id', headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors https: http://localhost:*" },
        { key: 'X-Content-Type-Options', value: 'nosniff' }
      ] },
      { source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ] }];
  }
};
export default nextConfig;
