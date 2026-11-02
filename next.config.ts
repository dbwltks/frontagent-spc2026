import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 다른 기기(Tailscale 등)에서 dev 서버에 접속할 때 HMR/폰트 요청이 막히지 않게 허용한다.
  allowedDevOrigins: ["100.88.184.60"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
