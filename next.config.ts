import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.privy.io https://*.privy.io",
              "style-src 'self' 'unsafe-inline' https://auth.privy.io",
              "frame-src https://auth.privy.io https://*.privy.io https://verify.walletconnect.org https://verify.walletconnect.com https://oauth.telegram.org https://*.telegram.org",
              "connect-src 'self' https://*.privy.io https://auth.privy.io https://sepolia.base.org https://mainnet.base.org https://*.base.org https://*.neon.tech wss://*.walletconnect.org wss://*.walletconnect.com https://*.walletconnect.org https://*.walletconnect.com https://rpc.walletconnect.org https://staging-api.unlink.xyz https://*.pinata.cloud",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
