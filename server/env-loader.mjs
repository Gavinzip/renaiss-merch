import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadLocalEnv() {
  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(rootDir, fileName);

    if (existsSync(filePath)) {
      loadEnvFile(filePath);
    }
  }
}

function loadEnvFile(filePath) {
  const source = readFileSync(filePath, 'utf8');

  for (const line of source.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(trimmedLine.slice(separatorIndex + 1).trim());

    process.env[key] ??= value;
  }
}

function unquoteEnvValue(value) {
  const first = value[0];
  const last = value[value.length - 1];

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}
