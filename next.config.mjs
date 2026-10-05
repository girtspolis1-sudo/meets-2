/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const base = process.env.SUPABASE_URL;
    if (!base) return [];
    return [{
      source: '/admin-proxy/rest/v1/rpc/:path*',
      destination: base + '/rest/v1/rpc/:path*'
    }];
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ] }];
  }
};
export default nextConfig;
