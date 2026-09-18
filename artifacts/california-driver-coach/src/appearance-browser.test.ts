import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

const appOrigin = 'http://127.0.0.1:4173';
const appUrl = `${appOrigin}/`;
const chromiumPath = process.env.CHROMIUM_PATH ?? '/repl/tools/bin/chromium';

type CdpResponse = {
  id: number;
  result?: Record<string, unknown>;
  error?: { message: string };
};

class CdpPage {
  private nextId = 0;
  private readonly pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>();

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as CdpResponse;
      if (!message.id) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result ?? {});
    });
  }

  send(method: string, params: Record<string, unknown> = {}) {
    const id = ++this.nextId;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const response = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    const result = response.result as { type?: string; value?: T; description?: string } | undefined;
    if (result?.type === 'undefined') return undefined as T;
    if (!result || !('value' in result)) {
      throw new Error(`Browser evaluation failed: ${result?.description ?? 'unknown error'}`);
    }
    return result.value as T;
  }

  close() {
    this.socket.close();
  }
}

let viteProcess: ChildProcess;
let browserProcess: ChildProcess;
let profileDir: string;
let page: CdpPage;

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(appUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${appUrl}`);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return response.json() as Promise<T>;
}

async function waitFor<T>(read: () => Promise<T>, expected: T) {
  const deadline = Date.now() + 10_000;
  let lastValue: T;
  do {
    lastValue = await read();
    if (Object.is(lastValue, expected)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert.equal(lastValue, expected);
}

async function clickAppearance(value: 'system' | 'light' | 'dark') {
  await page.evaluate<boolean>(`(() => {
    document.querySelector('[data-testid="button-appearance-${value}"]')?.click();
    return true;
  })()`);
  await waitFor(
    () => page.evaluate<boolean>(`document.querySelector('[data-testid="button-appearance-${value}"]')?.getAttribute('aria-checked') === 'true'`),
    true,
  );
}

async function setColorScheme(value: 'light' | 'dark') {
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value }],
  });
}

async function themeSnapshot() {
  return page.evaluate<{ dark: boolean; colorScheme: string }>(`({
    dark: document.documentElement.classList.contains('dark'),
    colorScheme: document.documentElement.style.colorScheme,
  })`);
}

async function waitForSettings() {
  await waitFor(
    () => page.evaluate<boolean>("Boolean(document.querySelector('[data-testid=\"button-appearance-system\"]'))"),
    true,
  );
}

async function reloadPage() {
  try {
    await page.send('Page.reload', { ignoreCache: true });
  } catch (error) {
    if (!String(error).includes('Inspected target navigated or closed')) throw error;
  }
}

before(async () => {
  profileDir = await mkdtemp(join(tmpdir(), 'california-driver-coach-browser-'));
  viteProcess = spawn('pnpm', ['exec', 'vite', '--config', 'vite.config.ts', '--host', '127.0.0.1'], {
    cwd: process.cwd(),
    env: { ...process.env, BASE_PATH: '/', PORT: '4173', NODE_ENV: 'test' },
    stdio: 'ignore',
  });
  await waitForServer();

  browserProcess = spawn(chromiumPath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  const deadline = Date.now() + 15_000;
  let target: { webSocketDebuggerUrl: string } | undefined;
  while (!target && Date.now() < deadline) {
    try {
      const targets = await getJson<Array<{ type: string; webSocketDebuggerUrl?: string }>>('http://127.0.0.1:9222/json');
      const pageTarget = targets.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
      if (pageTarget?.webSocketDebuggerUrl) target = pageTarget as { webSocketDebuggerUrl: string };
    } catch {
      // Chromium is still starting.
    }
    if (!target) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!target) throw new Error('Timed out waiting for Chromium DevTools');

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve());
    socket.addEventListener('error', () => reject(new Error('Could not connect to Chromium DevTools')));
  });
  page = new CdpPage(socket);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Page.navigate', { url: appUrl });
  await waitFor(() => page.evaluate<boolean>("Boolean(document.querySelector('[data-testid=\"button-header-settings\"]'))"), true);
});

after(async () => {
  page?.close();
  browserProcess?.kill();
  viteProcess?.kill();
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (profileDir) await rm(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

describe('appearance preferences in a real browser', { concurrency: false }, () => {
  it('renders and persists Light and Dark choices', async () => {
    await page.evaluate<boolean>(`(() => {
      document.querySelector('[data-testid="button-header-settings"]')?.click();
      return true;
    })()`);
    await waitForSettings();

    await clickAppearance('light');
    assert.deepEqual(await themeSnapshot(), { dark: false, colorScheme: 'light' });

    await clickAppearance('dark');
    assert.deepEqual(await themeSnapshot(), { dark: true, colorScheme: 'dark' });

    await reloadPage();
    await waitForSettings();
    await waitFor(
      () => page.evaluate<boolean>("document.querySelector('[data-testid=\"button-appearance-dark\"]')?.getAttribute('aria-checked') === 'true'"),
      true,
    );
    assert.deepEqual(await themeSnapshot(), { dark: true, colorScheme: 'dark' });
  });

  it('follows simulated system light and dark preferences in Device mode', async () => {
    await setColorScheme('light');
    await clickAppearance('system');
    await waitFor(() => page.evaluate<boolean>("!document.documentElement.classList.contains('dark')"), true);
    assert.deepEqual(await themeSnapshot(), { dark: false, colorScheme: 'light' });

    await setColorScheme('dark');
    await waitFor(() => page.evaluate<boolean>("document.documentElement.classList.contains('dark')"), true);
    assert.deepEqual(await themeSnapshot(), { dark: true, colorScheme: 'dark' });

    await setColorScheme('light');
    await waitFor(() => page.evaluate<boolean>("!document.documentElement.classList.contains('dark')"), true);
    assert.deepEqual(await themeSnapshot(), { dark: false, colorScheme: 'light' });
  });

  it('defaults an older saved profile without appearance to Device mode', async () => {
    await setColorScheme('dark');
    await page.evaluate<boolean>(`(() => {
      localStorage.setItem('california-driver-coach', ${JSON.stringify(JSON.stringify({
        settings: { parentMode: false, reminders: true, sounds: false },
      }))});
      return true;
    })()`);
    await reloadPage();
    await waitForSettings();

    await waitFor(
      () => page.evaluate<boolean>("document.querySelector('[data-testid=\"button-appearance-system\"]')?.getAttribute('aria-checked') === 'true'"),
      true,
    );
    await waitFor(() => page.evaluate<boolean>("document.documentElement.classList.contains('dark')"), true);
  });
});