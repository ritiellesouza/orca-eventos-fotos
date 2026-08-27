/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lean, self-contained production build for the Docker image (no need to
  // ship node_modules) — see web/Dockerfile.
  output: 'standalone',
};

export default nextConfig;
