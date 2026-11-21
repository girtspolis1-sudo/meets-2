import {PRIVATE_PATHS} from './lib/seo.js';

// Accounts, admin, forms and private-token links are never indexed, also when
// the page itself is a client component without metadata.
const noindexHeaders=PRIVATE_PATHS.filter(p=>p!=='/api/').map(p=>({
 source:p.replace(/\/$/,'')+'/:path*',
 headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]
}));

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/iegult-vietu/:id', headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors https: http://localhost:*" },
        { key: 'X-Content-Type-Options', value: 'nosniff' }
      ] },
      { source: '/iegult/:id', headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors https: http://localhost:*" },
        { key: 'X-Content-Type-Options', value: 'nosniff' }
      ] },
      ...noindexHeaders,
      { source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ] }];
  }
};
export default nextConfig;
