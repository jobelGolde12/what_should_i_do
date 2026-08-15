/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "@xenova/transformers",
      "onnxruntime-node",
      "pdfjs-dist",
    ],
  },
  webpack: (config) => {
    config.externals.push({ 'onnxruntime-node': 'commonjs onnxruntime-node' });
    // pdfjs-dist ships only ESM (.mjs) builds. Bundling them through webpack
    // breaks at module-eval in `next dev` (TypeError: Object.defineProperty
    // called on non-object). Externalizing loads the file via Node's native
    // require() at runtime instead (works on Node >= 22 with require(esm)).
    config.externals.push({
      'pdfjs-dist/legacy/build/pdf.mjs':
        'commonjs pdfjs-dist/legacy/build/pdf.mjs',
    });
    return config;
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push(
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // Inline scripts: theme boot script + inline JSON-LD. 'unsafe-eval'
            // needed by pdfjs/tesseract WASM workers (checked against the live
            // build; see scripts/verify-browser.mjs).
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' https:",
            "worker-src 'self' blob:",
            "frame-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join("; "),
        }
      );
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;