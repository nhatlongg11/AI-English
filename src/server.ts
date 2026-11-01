import { buildApp } from './app.js';
import { loadConfig } from './config.js';
const config = loadConfig();
const app = await buildApp({ config });

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info(
    { aiMode: config.AI_MOCK_MODE ? 'explicit_mock' : 'gemini', port: config.PORT },
    'Backend ready',
  );
} catch (error) {
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'UNKNOWN';
  app.log.error(
    { code, host: config.HOST, port: config.PORT },
    code === 'EADDRINUSE'
      ? 'Backend port is already in use; stop the other server or change PORT in .env'
      : 'Backend could not listen; check the error code, HOST and PORT configuration',
  );
  await app.close();
  process.exitCode = 1;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
