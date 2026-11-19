import { createHash } from 'node:crypto';

/** Applied only to production HTML: Vite HMR needs a different policy in dev. */
export function secureHtml(html: string): string {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes]) => !/\bsrc\s*=/i.test(attributes))
    .map(([, , body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  const policy = [
    "default-src 'none'",
    ["script-src 'self'", ...hashes].join(' '),
    "style-src 'self'",
    "img-src 'self' https: data:",
    "font-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  const charset = /<meta\s+charset=["']UTF-8["']\s*\/?>/i;
  if (!charset.test(html)) throw new Error('Missing early UTF-8 charset for production CSP');
  return html.replace(charset, (tag) => `${tag}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
}
