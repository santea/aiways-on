import type { NextConfig } from 'next';

const config: NextConfig = {
  // 워크스페이스 패키지를 소스로 직접 트랜스파일한다 (빌드 산출물 없이 사용).
  transpilePackages: ['@aiways/contracts', '@aiways/lib'],
  // SECURITY-04 — HTTP 보안 헤더
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default config;
