#!/usr/bin/env node
/**
 * PostToolUse hook: check Next.js dev static assets.
 *
 * Detects common "no CSS" failure modes:
 * - referenced /_next/static/css/... returns 404
 * - CSS still contains @tailwind/@apply (Tailwind/PostCSS not running)
 * - key JS chunks referenced by the page return 404
 *
 * Default target: http://127.0.0.1:3000/login
 *
 * Config via env:
 * - CHECK_NEXT_URL (e.g. http://127.0.0.1:3000/login)
 * - CHECK_NEXT_PORT (e.g. 3002)
 * - CHECK_NEXT_PATH (e.g. /login)
 */
/* eslint-disable no-console */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseJsonStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

function guessPortFromCommand(cmd) {
  if (!cmd) return null;
  const mEnv = cmd.match(/\bPORT=(\d{2,5})\b/);
  if (mEnv) return Number(mEnv[1]);
  const mNext = cmd.match(/\bnext\s+dev\b[\s\S]*?(?:--port|-p)\s+(\d{2,5})\b/);
  if (mNext) return Number(mNext[1]);
  return null;
}

function normalizeTarget() {
  const fromEnvUrl = process.env.CHECK_NEXT_URL;
  if (fromEnvUrl) return fromEnvUrl;

  const port = Number(process.env.CHECK_NEXT_PORT || '') || 3000;
  const path = process.env.CHECK_NEXT_PATH || '/login';
  return `http://127.0.0.1:${port}${path.startsWith('/') ? path : `/${path}`}`;
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  return { status: res.status, text };
}

function extractNextStaticUrls(html) {
  const urls = [];
  const re = /(href|src)="(\/_next\/static\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) urls.push(m[2]);
  return Array.from(new Set(urls));
}

function isTailwindUncompiled(cssText) {
  return /@tailwind\s+(base|components|utilities)\s*;/.test(cssText) || /@apply\s+/.test(cssText);
}

async function waitForPageOk(url, tries = 15, delayMs = 500) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetchText(url);
      if (r.status >= 200 && r.status < 400) return r;
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    await sleep(delayMs);
  }
  throw lastErr || new Error('Unknown error');
}

async function main() {
  const input = await parseJsonStdin();
  const cmd = input?.tool_input?.command || '';

  // Only run when starting dev servers (directly or via tmux).
  const shouldRun =
    /\b(next\s+dev|npm\s+run\s+dev|pnpm(\s+run)?\s+dev|yarn\s+dev|bun(\s+run)?\s+dev)\b/.test(cmd) ||
    /\btmux\b/.test(cmd);
  if (!shouldRun) return;

  const guessedPort = guessPortFromCommand(cmd);
  if (guessedPort && !process.env.CHECK_NEXT_PORT && !process.env.CHECK_NEXT_URL) {
    process.env.CHECK_NEXT_PORT = String(guessedPort);
  }

  const target = normalizeTarget();

  let page;
  try {
    page = await waitForPageOk(target);
  } catch (e) {
    console.error(`[Hook][NextCSS] Could not reach ${target}. (${e?.message || e})`);
    console.error(`[Hook][NextCSS] If dev server is starting, wait a moment then reload.`);
    return;
  }

  const staticUrls = extractNextStaticUrls(page.text);
  const cssUrls = staticUrls.filter((u) => u.includes('/_next/static/css/') && u.endsWith('.css') || u.includes('.css?'));
  const jsUrls = staticUrls.filter((u) => u.includes('/_next/static/chunks/') && (u.endsWith('.js') || u.includes('.js?')));

  const base = new URL(target).origin;
  const problems = [];

  // Check first CSS (usually layout.css)
  const cssToCheck = cssUrls.slice(0, 2);
  for (const path of cssToCheck) {
    const url = base + path;
    try {
      const r = await fetchText(url);
      if (r.status !== 200) {
        problems.push(`CSS ${path} -> HTTP ${r.status}`);
        continue;
      }
      if (isTailwindUncompiled(r.text)) {
        problems.push(`CSS ${path} looks uncompiled (@tailwind/@apply present)`);
      }
    } catch (e) {
      problems.push(`CSS ${path} -> fetch failed (${e?.message || e})`);
    }
  }

  // Check a few key JS chunks
  const jsToCheck = jsUrls
    .filter((u) => /main-app|app-pages-internals|webpack|polyfills|app\/login\/page/.test(u))
    .slice(0, 6);
  for (const path of jsToCheck) {
    const url = base + path;
    try {
      const r = await fetchText(url);
      if (r.status !== 200) problems.push(`JS ${path} -> HTTP ${r.status}`);
    } catch (e) {
      problems.push(`JS ${path} -> fetch failed (${e?.message || e})`);
    }
  }

  if (problems.length === 0) {
    console.error(`[Hook][NextCSS] OK: ${target} static assets look healthy.`);
    return;
  }

  console.error(`[Hook][NextCSS] Potential "no CSS" issue detected for ${target}:`);
  problems.slice(0, 12).forEach((p) => console.error(`- ${p}`));
  if (problems.length > 12) console.error(`- ...and ${problems.length - 12} more`);

  console.error(`[Hook][NextCSS] Quick fixes checklist:`);
  console.error(`- Ensure Tailwind is wired: speckit/postcss.config.(js|cjs|mjs) with tailwindcss + autoprefixer`);
  console.error(`- Ensure globals.css is imported in app/layout.tsx`);
  console.error(`- If /_next/static/* returns 404: check next.config.js custom webpack/aliases (can break dev chunks)`);
  console.error(`- Hard refresh the page after server is ready`);
}

main().catch((e) => {
  console.error(`[Hook][NextCSS] Unexpected error: ${e?.stack || e}`);
});

