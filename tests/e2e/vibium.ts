// Thin wrapper around Vibium CLI for use in Vitest.
// Vibium runs as a daemon — `start` launches the browser, subsequent
// commands talk to it via the daemon socket.
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { homedir } from 'node:os';

// Resolve the vibium binary directly to avoid npx overhead on each call
let vibiumBin: string;
try {
  vibiumBin = resolve(process.cwd(), 'node_modules/.bin/vibium');
} catch {
  vibiumBin = 'npx vibium';
}

function run(args: string[], timeoutMs = 30_000): string {
  try {
    return execFileSync(vibiumBin, args, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (e: unknown) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    const detail = err.stderr || err.stdout || err.message || 'unknown error';
    throw new Error(`vibium ${args[0]} failed: ${detail}`);
  }
}

export function start(opts?: { headless?: boolean }): void {
  // Clean up stale daemon socket if present
  const sockPath = join(homedir(), 'Library/Caches/vibium/vibium.sock');
  try { unlinkSync(sockPath); } catch { /* doesn't exist */ }

  const args = ['start'];
  if (opts?.headless !== false) args.push('--headless');
  run(args, 30_000);
}

export function stop(): void {
  try { run(['stop'], 10_000); } catch { /* already stopped */ }
}

/** Navigate to a URL. Uses eval to navigate and confirm page loaded. */
export function go(url: string): void {
  run(['eval', url, 'document.readyState'], 30_000);
}

/** Get all visible text on the page. */
export function text(selector?: string): string {
  return selector ? run(['text', selector]) : run(['text']);
}

/** Get the page title. */
export function title(): string {
  return run(['title']);
}

/** Get the current URL. */
export function url(): string {
  return run(['url']);
}

/** Click an element by CSS selector. */
export function click(selector: string): void {
  run(['click', selector], 10_000);
}

/** Wait for text to appear on the page. */
export function waitForText(content: string, timeoutMs = 10_000): void {
  run(['wait', 'text', content], timeoutMs);
}

/** Wait for an element to appear. */
export function waitForElement(selector: string, timeoutMs = 10_000): void {
  run(['wait', selector], timeoutMs);
}

/** Execute JavaScript and return the result. */
export function evalJs(code: string): string {
  return run(['eval', code]);
}

/** Take a screenshot. */
export function screenshot(path?: string): void {
  const args = ['screenshot'];
  if (path) args.push('-o', path);
  run(args, 10_000);
}

/** Count elements matching a CSS selector. */
export function count(selector: string): number {
  const out = run(['count', selector]);
  return parseInt(out, 10) || 0;
}

/** Set the browser viewport size. */
export function viewport(width: number, height: number): void {
  run(['viewport', String(width), String(height)]);
}
