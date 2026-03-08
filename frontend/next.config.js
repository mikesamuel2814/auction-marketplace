/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com', pathname: '/**' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'}/socket.io/:path*` },
    ];
  },
};

module.exports = nextConfig;
