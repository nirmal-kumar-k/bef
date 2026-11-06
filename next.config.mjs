/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Next 16.4+ writes an AGENTS.md (notes for AI coding tools) on every
  // `next dev`. Not used by this team - off, so no stray file reappears.
  agentRules: false,
}

export default nextConfig
