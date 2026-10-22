#!/usr/bin/env node
// Stand-in for the `codex` binary, used only by test/smoke.mjs.
// It mimics the parts of the CLI the bridge relies on; it does not talk to OpenAI.
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (...names) => { const i = args.findIndex(a => names.includes(a)); return i >= 0 ? args[i + 1] : undefined; };

if (args[0] === '--version') { console.log('codex-cli 0.0.0-fake'); process.exit(0); }
if (args[0] === 'login' && args[1] === 'status') { console.log('Logged in using ChatGPT (fake)'); process.exit(0); }
if (args[0] !== 'exec') { console.error('unsupported'); process.exit(2); }

let prompt = ''; for await (const c of process.stdin) prompt += c;
const resume = args[1] === 'resume';
const outFile = flag('-o');
const sandbox = resume ? (args.find(a => a.startsWith('sandbox_mode=')) || '').replace(/^sandbox_mode=/, '') : flag('-s');
const model = flag('-m') || 'default';

if (prompt.includes('SLEEP')) { await new Promise(r => setTimeout(r, 60_000)); process.exit(0); }
if (prompt.includes('FAIL')) { console.error('fake failure: not logged in'); process.exit(1); }

const answer = `${resume ? 'RESUMED' : 'FRESH'}: ${prompt.slice(0, 40)} | sandbox=${sandbox} | model=${model} | cwd=${process.cwd()} | target=${args[args.length - 2]}`;
if (outFile) writeFileSync(outFile, answer);
const id = '11111111-2222-3333-4444-555555555555';
console.log(JSON.stringify({ type: 'thread.started', thread_id: id }));
console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: answer } }));
console.log(JSON.stringify({ type: 'turn.completed' }));
