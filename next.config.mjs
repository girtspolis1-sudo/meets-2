/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const base = process.env.SUPABASE_URL;
    if (!base) return [];
    return [
      { source: '/admin-auth/ready', destination: base + '/rest/v1/rpc/meets_admin_password_ready' },
      { source: '/admin-auth/setup', destination: base + '/rest/v1/rpc/meets_admin_setup_password' },
      { source: '/admin-auth/login', destination: base + '/rest/v1/rpc/meets_admin_password_login' }
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ] }];
  }
};
export default nextConfig;
