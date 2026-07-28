import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile
} from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CONTENT_MEDIA_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.mp4',
  '.png',
  '.webm',
  '.webp'
]);
const command = process.argv[2] || 'audit';
const options = parseOptions(process.argv.slice(3));
const projectRoot = process.cwd();
const catalogPath = resolve(
  projectRoot,
  options.catalog || 'media/public-asset-release.json'
);
const distPath = resolve(projectRoot, options.dist || 'dist');

if (
  ![
    'assert-build',
    'assert-config',
    'audit',
    'prepare',
    'publish',
    'verify'
  ].includes(command)
) {
  throw new Error(`Unknown asset command: ${command}`);
}

if (command === 'assert-config') {
  await assertConfiguration();
  process.exit(0);
}

if (command === 'assert-build') {
  await assertBuild();
  process.exit(0);
}

const catalog = await readCatalog();
const inventory = await prepareRelease(catalog);

if (command === 'audit' || command === 'prepare') {
  printInventory(inventory, catalog);
  process.exit(0);
}

if (command === 'publish') {
  const bucket = options.bucket || catalog.bucket;

  if (!bucket) {
    throw new Error('An R2 bucket is required.');
  }

  await publishRelease(bucket, inventory);
  await writeCatalogRelease(catalog, inventory);
  console.log(
    `Published ${inventory.files.length} immutable objects to ` +
      `r2://${bucket}/${catalog.prefix}/${inventory.release}/`
  );
  process.exit(0);
}

await verifyRelease(catalog, inventory);

function parseOptions(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith('--')) {
      throw new Error(`Unexpected argument: ${value}`);
    }

    const separator = value.indexOf('=');
    const key = value.slice(2, separator === -1 ? undefined : separator);

    if (separator !== -1) {
      parsed[key] = value.slice(separator + 1);
      continue;
    }

    const nextValue = values[index + 1];

    if (!nextValue || nextValue.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}

async function readCatalog() {
  return JSON.parse(await readFile(catalogPath, 'utf8'));
}

async function prepareRelease(catalog) {
  const stagingRoot = resolve(projectRoot, '.media-assets');
  const preparedFiles = [];

  for (const [key, asset] of Object.entries(catalog.assets)) {
    const sourcePath = resolveProjectPath(asset.source);

    await assertReadable(sourcePath);

    const temporaryPath = resolve(stagingRoot, 'pending', asset.path);
    await mkdir(dirname(temporaryPath), { recursive: true });

    if (asset.type === 'image') {
      await sharp(sourcePath)
        .rotate()
        .avif({
          chromaSubsampling: '4:4:4',
          effort: 7,
          quality: 90
        })
        .toFile(temporaryPath);
    } else if (asset.type === 'binary') {
      await copyFile(sourcePath, temporaryPath);
    } else {
      throw new Error(`Unsupported asset type for ${key}: ${asset.type}`);
    }

    const fileBuffer = await readFile(temporaryPath);
    preparedFiles.push({
      contentType: asset.contentType,
      hash: createHash('sha256').update(fileBuffer).digest('hex'),
      key,
      path: asset.path,
      size: fileBuffer.length,
      sourcePath,
      temporaryPath,
      type: asset.type
    });
  }

  preparedFiles.sort((left, right) => left.path.localeCompare(right.path));
  const releaseHash = createHash('sha256');

  for (const file of preparedFiles) {
    releaseHash.update(file.path);
    releaseHash.update('\0');
    releaseHash.update(file.hash);
    releaseHash.update('\0');
  }

  const contentHash = releaseHash.digest('hex');
  const release = `r${contentHash.slice(0, 20)}`;
  const releaseRoot = resolve(stagingRoot, release);

  for (const file of preparedFiles) {
    const releasePath = resolve(releaseRoot, file.path);
    await mkdir(dirname(releasePath), { recursive: true });
    await copyFile(file.temporaryPath, releasePath);
    file.filePath = releasePath;
  }

  return {
    contentHash,
    files: preparedFiles,
    release,
    releaseRoot,
    totalBytes: preparedFiles.reduce((sum, file) => sum + file.size, 0)
  };
}

function resolveProjectPath(value) {
  const path = resolve(projectRoot, value);

  if (path !== projectRoot && !path.startsWith(`${projectRoot}${sep}`)) {
    throw new Error(`Asset source is outside the project: ${value}`);
  }

  return path;
}

async function assertReadable(filePath) {
  try {
    await access(filePath, constants.R_OK);
  } catch {
    throw new Error(`Asset source is not readable: ${relative(projectRoot, filePath)}`);
  }
}

function printInventory(inventory, catalog) {
  console.log(
    `Merch media: ${inventory.files.length} files, ` +
      `${formatBytes(inventory.totalBytes)}, release ${inventory.release}`
  );

  for (const file of inventory.files) {
    const exactCopy = file.type === 'binary' ? 'exact copy' : 'AVIF';
    console.log(
      `${file.path}\t${formatBytes(file.size)}\t${file.contentType}\t${exactCopy}`
    );
  }

  const releaseState =
    catalog.release === inventory.release
      ? 'matches the checked-in release'
      : catalog.release === 'unpublished'
        ? 'has not been published'
        : `differs from checked-in release ${catalog.release}`;
  console.log(`Release state: ${releaseState}.`);
}

async function publishRelease(bucket, inventory) {
  let completed = 0;
  const queue = [...inventory.files];
  const concurrency = Math.min(3, queue.length || 1);
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const file = queue.shift();
      const objectKey = `${inventory.release}/${file.path}`;
      const bucketPath = `${bucket}/${objectKeyWithPrefix(objectKey)}`;

      await runWrangler([
        '--yes',
        'wrangler@4.114.0',
        'r2',
        'object',
        'put',
        bucketPath,
        '--file',
        file.filePath,
        '--content-type',
        file.contentType,
        '--cache-control',
        IMMUTABLE_CACHE_CONTROL,
        '--remote'
      ]);
      completed += 1;
      console.log(`Uploaded ${completed}/${inventory.files.length}: ${objectKey}`);
    }
  });

  await Promise.all(workers);
}

function objectKeyWithPrefix(objectKey) {
  return `${catalogPrefix()}/${objectKey}`.replace(/\/+/g, '/');
}

function catalogPrefix() {
  const prefix = String(catalog.prefix || '').replace(/^\/+|\/+$/g, '');

  if (!prefix) {
    throw new Error('The asset catalog prefix is required.');
  }

  return prefix;
}

function runWrangler(args, attempt = 1) {
  return runWranglerOnce(args).catch(async (error) => {
    const message = String(error?.message || error);
    const retryable =
      /\b(429|500|502|503|504)\b|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
        message
      );

    if (!retryable || attempt >= 3) {
      throw error;
    }

    const delayMs = attempt * 1500;
    console.warn(
      `Transient Cloudflare failure; retrying in ${delayMs}ms ` +
        `(attempt ${attempt + 1}/3).`
    );
    await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
    return runWrangler(args, attempt + 1);
  });
}

function runWranglerOnce(args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('npx', args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.once('error', rejectPromise);
    child.once('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(`Wrangler upload failed (${code}): ${output.trim()}`)
      );
    });
  });
}

async function writeCatalogRelease(catalog, inventory) {
  const nextCatalog = {
    ...catalog,
    contentHash: inventory.contentHash,
    fileCount: inventory.files.length,
    release: inventory.release,
    totalBytes: inventory.totalBytes
  };

  await writeFile(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`);
}

async function verifyRelease(catalog, inventory) {
  const base = normalizeBase(requiredOption('base'));
  const authorization = String(
    process.env.PRIVATE_MEDIA_PROXY_TOKEN || ''
  ).trim();
  const requestHeaders = authorization
    ? { Authorization: `Bearer ${authorization}` }
    : undefined;

  if (catalog.release !== inventory.release) {
    throw new Error(
      `Prepared release ${inventory.release} does not match ` +
        `checked-in release ${catalog.release}. Publish before verifying.`
    );
  }

  const failures = [];

  for (const file of inventory.files) {
    const url = mediaUrl(base, catalog, file.path);
    const startedAt = performance.now();
    const response = await fetchWithTransientRetry(url, {
      headers: requestHeaders,
      method: 'HEAD'
    });
    const coldMs = performance.now() - startedAt;
    const cacheControl = response.headers.get('cache-control') || '';
    const contentType = response.headers.get('content-type') || '';
    const etag = response.headers.get('etag') || '';

    const expectedCachePolicy =
      catalog.access === 'private'
        ? cacheControl.includes('private') && cacheControl.includes('no-store')
        : cacheControl.includes('max-age=31536000') &&
          cacheControl.includes('immutable');

    if (
      !response.ok ||
      contentType.split(';')[0] !== file.contentType ||
      !expectedCachePolicy ||
      !etag
    ) {
      failures.push(
        `${file.path}: HTTP ${response.status}, Content-Type ${contentType || '[missing]'}, ` +
          `Cache-Control ${cacheControl || '[missing]'}, ETag ${etag || '[missing]'}`
      );
      continue;
    }

    const warmStartedAt = performance.now();
    await fetchWithTransientRetry(url, {
      headers: requestHeaders,
      method: 'HEAD'
    });
    const warmMs = performance.now() - warmStartedAt;
    console.log(
      `Verified ${file.path}: ${response.status}, ${contentType}, ` +
        `${coldMs.toFixed(0)}ms cold / ${warmMs.toFixed(0)}ms warm`
    );

    if (file.contentType === 'video/mp4') {
      const rangeResponse = await fetchWithTransientRetry(url, {
        headers: {
          ...requestHeaders,
          Range: 'bytes=0-1023'
        }
      });

      if (
        rangeResponse.status !== 206 ||
        rangeResponse.headers.get('accept-ranges') !== 'bytes' ||
        !rangeResponse.headers.get('content-range')
      ) {
        failures.push(
          `${file.path}: byte range verification returned HTTP ` +
            `${rangeResponse.status}`
        );
      }
    }
  }

  if (failures.length) {
    throw new Error(`CDN verification failed:\n${failures.join('\n')}`);
  }

  console.log(
    `Verified release ${catalog.release} at ${base}/${catalog.prefix}/.`
  );
}

async function fetchWithTransientRetry(url, init, attempt = 1) {
  try {
    const response = await fetch(url, init);

    if (
      attempt < 3 &&
      (response.status === 429 || response.status >= 500)
    ) {
      await response.body?.cancel();
      await new Promise((resolvePromise) =>
        setTimeout(resolvePromise, attempt * 500)
      );
      return fetchWithTransientRetry(url, init, attempt + 1);
    }

    return response;
  } catch (error) {
    if (attempt >= 3) {
      throw error;
    }

    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, attempt * 500)
    );
    return fetchWithTransientRetry(url, init, attempt + 1);
  }
}

async function assertConfiguration() {
  const catalog = await readCatalog();
  const base = normalizeBase(
    String(process.env.VITE_STATIC_ASSET_CDN_BASE_URL || '')
  );

  if (catalog.release === 'unpublished') {
    throw new Error('Publish the media release before a production build.');
  }

  console.log(
    `Production media configuration: ${base}/${catalog.prefix}/${catalog.release}/`
  );
}

async function assertBuild() {
  const catalog = await readCatalog();
  const files = await collectFiles(distPath);
  const forbiddenMedia = files.filter((filePath) => {
    const extension = extname(filePath).toLowerCase();
    const fileName = relative(distPath, filePath).toLowerCase();

    return (
      CONTENT_MEDIA_EXTENSIONS.has(extension) &&
      (fileName.includes('sealed-drop') ||
        fileName.includes('store-static-background') ||
        fileName.includes('store-background') ||
        fileName.includes('bracelet') ||
        fileName.includes('shirt-product') ||
        extension === '.mp4' ||
        extension === '.avif')
    );
  });

  if (forbiddenMedia.length) {
    throw new Error(
      `Production build still contains offloaded media:\n${forbiddenMedia
        .map((filePath) => relative(projectRoot, filePath))
        .join('\n')}`
    );
  }

  const textFiles = files.filter((filePath) =>
    ['.css', '.html', '.js'].includes(extname(filePath).toLowerCase())
  );
  const combinedText = (
    await Promise.all(textFiles.map((filePath) => readFile(filePath, 'utf8')))
  ).join('\n');
  const configuredBase = String(
    process.env.VITE_STATIC_ASSET_CDN_BASE_URL || ''
  )
    .trim()
    .replace(/\/+$/, '');

  if (
    !configuredBase ||
    !combinedText.includes(configuredBase) ||
    !combinedText.includes(catalog.release)
  ) {
    throw new Error(
      'Built output does not contain the configured media base and release.'
    );
  }

  console.log(
    'Build asset check passed: offloaded media is absent and the CDN release is embedded.'
  );
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filePath = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(filePath);
      }

      return entry.isFile() ? [filePath] : [];
    })
  );

  return nested.flat();
}

function mediaUrl(base, catalog, path) {
  return `${base}/${catalog.prefix}/${catalog.release}/${path}`;
}

function requiredOption(name) {
  const value = options[name];

  if (!value || value === true) {
    throw new Error(`--${name} is required.`);
  }

  return value;
}

function normalizeBase(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    throw new Error('VITE_STATIC_ASSET_CDN_BASE_URL is required.');
  }

  const url = new URL(trimmed);

  if (url.protocol !== 'https:') {
    throw new Error('The static asset base must use HTTPS.');
  }

  return url.toString().replace(/\/$/, '');
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}
