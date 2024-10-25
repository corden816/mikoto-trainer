const config = {
    apiKey: "fad4e222a3854bb99ed337f837a4e21c",
    region: "koreacentral"
    /** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://aka.ms; connect-src 'self' https://*.microsoft.com wss://*.speech.microsoft.com"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
};
