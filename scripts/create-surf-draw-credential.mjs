import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashSurfDrawPassword } from '../server/surf-draw/access-credential.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const username = process.argv[2] || 'operator';
if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) throw new Error('Username must be 3–64 letters, digits, dots, underscores or dashes');
const password = randomBytes(24).toString('base64url');
const hash = await hashSurfDrawPassword(password);
const secretDir = path.join(root, '.secrets');
await mkdir(secretDir, { recursive: true, mode: 0o700 });
const secretPath = path.join(secretDir, `surf-draw-access-${Date.now()}-${randomBytes(4).toString('hex')}.txt`);
await writeFile(secretPath, `Surf draw room credential\nUsername: ${username}\nPassword: ${password}\n\nServer environment:\nSURF_DRAW_ACCESS_USERNAME=${username}\nSURF_DRAW_ACCESS_PASSWORD_HASH=${hash}\n`, { mode: 0o600, flag: 'wx' });

// Keep local preview usable. Both files are ignored by Git; no plaintext
// credential is written into the source tree, public media or build output.
const envPath = path.join(root, '.env.local');
let existing = '';
try { existing = await readFile(envPath, 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const lines = existing.split(/\r?\n/).filter(line => !/^SURF_DRAW_ACCESS_(USERNAME|PASSWORD_HASH)=/.test(line));
while (lines.at(-1) === '') lines.pop();
lines.push(`SURF_DRAW_ACCESS_USERNAME=${username}`, `SURF_DRAW_ACCESS_PASSWORD_HASH=${hash}`);
await writeFile(envPath, `${lines.join('\n')}\n`, { mode: 0o600 });
await chmod(envPath, 0o600);
console.log(`Local Surf draw credential written to ${secretPath}`);
console.log('Restart the local server to load the new environment values.');
