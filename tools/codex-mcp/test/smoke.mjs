// Protocol-level smoke test for the bridge using a fake `codex` binary.
// Run: npm test   (from tools/codex-mcp)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { chmodSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(here, '..', 'server.mjs');
const fake = path.join(here, 'fake-codex.mjs'); chmodSync(fake, 0o755);
const root = realpathSync(path.join(here, '..')); const sub = path.join(root, 'test', 'sub'); mkdirSync(sub, { recursive: true });

async function connect(env) {
  const client = new Client({ name: 'smoke', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server], env: { ...process.env, ...env }, stderr: 'ignore' }));
  return client;
}
const call = (c, name, args) => c.callTool({ name, arguments: args });
const body = r => r.content.map(x => x.text).join('\n');
let n = 0; const ok = (name) => console.log(`ok ${++n} - ${name}`);

const c = await connect({ CODEX_BIN: fake, CODEX_MCP_ROOTS: root });

const tools = (await c.listTools()).tools.map(t => t.name).sort();
assert.deepEqual(tools, ['codex', 'codex_reply', 'codex_status']); ok('lists the three tools');

let r = await call(c, 'codex', { prompt: 'hello world', cwd: root });
assert.ok(!r.isError); assert.match(body(r), /\[codex session: 11111111-2222-3333-4444-555555555555\]/);
assert.match(body(r), /FRESH: hello world/); assert.match(body(r), /sandbox=read-only/); ok('codex: default read-only sandbox, session id returned');

r = await call(c, 'codex', { prompt: 'edit', cwd: sub, sandbox: 'workspace-write', model: 'm-1' });
assert.match(body(r), /sandbox=workspace-write/); assert.match(body(r), /model=m-1/); assert.ok(body(r).includes(`cwd=${sub}`)); ok('codex: sandbox, model and cwd are forwarded');

r = await call(c, 'codex', { prompt: 'x', sandbox: 'danger-full-access' }).catch(e => ({ isError: true, content: [{ text: String(e.message) }] }));
assert.ok(r.isError); ok('danger-full-access is rejected');

r = await call(c, 'codex', { prompt: 'x', cwd: '/etc' });
assert.ok(r.isError); assert.match(body(r), /outside the allowed roots/); ok('cwd outside the allowed roots is rejected');

r = await call(c, 'codex_reply', { prompt: 'more', session_id: '11111111-2222-3333-4444-555555555555', cwd: root });
assert.match(body(r), /RESUMED: more/); assert.match(body(r), /sandbox="read-only"/);
assert.match(body(r), /target=11111111-2222-3333-4444-555555555555/); ok('codex_reply: resumes by session id');

r = await call(c, 'codex_reply', { prompt: 'more', cwd: root });
assert.match(body(r), /RESUMED/); assert.match(body(r), /target=--last/); ok('codex_reply: falls back to --last');

r = await call(c, 'codex_reply', { prompt: 'x', session_id: '--help' }).catch(e => ({ isError: true, content: [{ text: String(e.message) }] }));
assert.ok(r.isError); ok('codex_reply: non-UUID session id is rejected');

r = await call(c, 'codex', { prompt: 'FAIL please', cwd: root });
assert.ok(r.isError); assert.match(body(r), /fake failure/); assert.match(body(r), /codex login/); ok('codex: CLI failure is reported with a login hint');

const t0 = Date.now();
r = await call(c, 'codex', { prompt: 'SLEEP', cwd: root, timeout_sec: 10 });
assert.ok(r.isError); assert.match(body(r), /did not finish within 10s/); assert.ok(Date.now() - t0 < 25_000); ok('codex: timeout stops the process');

r = await call(c, 'codex_status', {});
assert.ok(!r.isError); assert.match(body(r), /Logged in/); ok('codex_status: shows version and login');
await c.close();

const c2 = await connect({ CODEX_BIN: path.join(here, 'does-not-exist'), CODEX_MCP_ROOTS: root });
r = await call(c2, 'codex', { prompt: 'x', cwd: root });
assert.ok(r.isError); assert.match(body(r), /codex CLI not found/); ok('missing codex binary gives an install hint');
await c2.close();

console.log(`\nall ${n} checks passed`);
