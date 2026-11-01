import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { loadConfig } from '../src/config.js';

// Start both services with one command; reuse healthy services already running locally.
const config = loadConfig();
const openBrowser = process.argv.includes('--open');
const children: ChildProcess[] = [];
let closing = false;
async function stop(code: number) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      await new Promise<void>(done => {
        const kill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        kill.once('exit', () => done());
        kill.once('error', () => done());
      });
    } else child.kill('SIGTERM');
  }
  process.exit(code);
}
function launch(args: string[]) {
  const child = spawn(process.execPath, args, { cwd: resolve('.'), stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.once('error', error => { console.error(error.message); void stop(1); });
  child.once('exit', code => { if (!closing) void stop(code ?? 1); });
}
async function healthy(url: string, accept: (response: Response) => Promise<boolean>) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok && await accept(response);
  } catch { return false; }
}
process.on('SIGINT', () => { void stop(0); });
process.on('SIGTERM', () => { void stop(0); });

const backend = `http://${config.HOST}:${config.PORT}`;
if (await healthy(`${backend}/api/v1/health`, async r => {
  const body = await r.json() as { status?: string; aiMode?: string };
  return body.status === 'ok' && ['gemini', 'explicit_mock'].includes(body.aiMode ?? '');
})) console.log(`Using running backend: ${backend}`);
else launch([resolve('node_modules/tsx/dist/cli.mjs'), 'watch', 'src/server.ts']);

const frontend = 'http://127.0.0.1:5173';
if (await healthy(`${frontend}/@vite/client`, async r => (await r.text()).includes('vite'))) {
  console.log(`Using running frontend: ${frontend}`);
} else launch([resolve('node_modules/vite/bin/vite.js'), '--config', 'frontend/vite.config.ts']);

console.log(`Open ${frontend} · Ctrl+C stops only services started by this command.`);
if (!children.length) console.log('Both services already running.');

// The Vite process can listen before the API is ready. Check the proxied API too.
const deadline = Date.now() + 60000;
let ready = false;
while (!closing && Date.now() < deadline) {
  const [page, backendReady] = await Promise.all([
    healthy(`${frontend}/@vite/client`, async r => (await r.text()).includes('vite')),
    healthy(`${backend}/api/v1/health`, async r => {
      const body = await r.json() as {status?:string;aiMode?:string};
      return body.status === 'ok' && ['gemini','explicit_mock'].includes(body.aiMode ?? '');
    }),
  ]);
  if (page && backendReady && await healthy(`${frontend}/api/v1/health`, async r => {
    const body = await r.json() as {status?:string};
    return body.status === 'ok';
  })) { ready = true; break; }
  await delay(1000);
}
if (!ready) {
  console.error('TenseLab did not become ready within 60 seconds. Check the service errors above, database migrations, and ports 3000/5173.');
  await stop(1);
} else {
  console.log(`TenseLab is ready: ${frontend}`);
  if (openBrowser) {
    const [command, args] = process.platform === 'win32'
      ? ['rundll32.exe', ['url.dll,FileProtocolHandler', frontend]] as const
      : process.platform === 'darwin'
        ? ['open', [frontend]] as const
        : ['xdg-open', [frontend]] as const;
    const browser = spawn(command, [...args], {detached:true,stdio:'ignore',windowsHide:true});
    const fallback = () => console.log(`Open ${frontend} in your browser.`);
    browser.once('error', fallback);
    browser.once('exit', code => { if (code !== null && code !== 0) fallback(); });
    browser.unref();
  }
}
