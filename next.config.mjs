const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. `connect-src 'self'` is the privacy-relevant part: the page may only
 * make requests to its own origin (the optional breach check goes through /api/breach-check),
 * so even injected script could not send a password to a third-party host.
 *
 * 'unsafe-inline' for scripts is a known compromise: Next.js emits small inline bootstrap
 * scripts, and a nonce-based policy would force every page to render dynamically.
 * 'unsafe-eval' and websockets are only allowed in development (React Refresh / HMR).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  }
};

export default nextConfig;
