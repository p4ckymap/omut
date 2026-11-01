import { createServer } from 'vite';

// Own the server in-process; no shell child/taskkill teardown on Windows.
export default async function setup() {
  const server = await createServer({
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 5187, strictPort: true },
  });
  await server.listen();
  return async () => { await server.close(); };
}
