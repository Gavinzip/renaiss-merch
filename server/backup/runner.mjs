import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const BACKUP_TAG = 'renaiss-merch';

class BackupCommandError extends Error {
  constructor(command, code, timedOut) {
    super(
      timedOut
        ? `${command} timed out.`
        : `${command} exited with status ${code ?? 'unknown'}.`
    );
    this.command = command;
    this.name = 'BackupCommandError';
  }
}

let activeOperation = null;

export async function runDatabaseBackup(config) {
  requireAvailable(config);

  const operation = (async () => {
    await mkdir(config.backup.stagingDir, { recursive: true });
    const temporaryDirectory = await mkdtemp(
      join(config.backup.stagingDir, 'snapshot-')
    );
    const snapshotPath = join(temporaryDirectory, 'merch-shipping-claims.sqlite');
    const childEnv = resticEnvironment(config);

    try {
      const repositoryInitialized = await ensureRepository(config, childEnv);
      await run(
        'sqlite3',
        [config.databasePath, sqliteBackupInstruction(snapshotPath)],
        {
          env: childEnv,
          timeoutMs: config.backup.timeoutMs
        }
      );

      const snapshot = await stat(snapshotPath);
      if (!snapshot.isFile() || snapshot.size === 0) {
        throw new Error('SQLite snapshot was not created.');
      }

      await run(
        'restic',
        [
          'backup',
          '--tag',
          BACKUP_TAG,
          '--tag',
          'sqlite',
          '--host',
          BACKUP_TAG,
          snapshotPath
        ],
        {
          env: childEnv,
          timeoutMs: config.backup.timeoutMs
        }
      );
      await run(
        'restic',
        [
          'forget',
          '--prune',
          '--tag',
          BACKUP_TAG,
          '--keep-hourly',
          String(config.backup.retention.hourly),
          '--keep-daily',
          String(config.backup.retention.daily),
          '--keep-weekly',
          String(config.backup.retention.weekly),
          '--keep-monthly',
          String(config.backup.retention.monthly)
        ],
        {
          env: childEnv,
          timeoutMs: config.backup.timeoutMs
        }
      );

      return {
        bytes: snapshot.size,
        completedAt: new Date().toISOString(),
        repositoryInitialized
      };
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  })();

  return runExclusive(operation);
}

export async function runRepositoryCheck(config) {
  requireAvailable(config);

  const operation = run(
    'restic',
    ['check', '--read-data-subset=5%'],
    {
      env: resticEnvironment(config),
      timeoutMs: config.backup.timeoutMs
    }
  ).then(() => ({
    checkedAt: new Date().toISOString()
  }));

  return runExclusive(operation);
}

function requireAvailable(config) {
  if (!config.backup.configured) {
    throw new Error(`Backup configuration is ${config.backup.state}.`);
  }

  if (activeOperation) {
    const error = new Error('A backup operation is already running.');
    error.code = 'backup_in_progress';
    throw error;
  }
}

function resticEnvironment(config) {
  return {
    ...process.env,
    RESTIC_PASSWORD: config.backup.password,
    RESTIC_REPOSITORY: config.backup.repository
  };
}

async function runExclusive(operation) {
  activeOperation = operation;

  try {
    return await operation;
  } finally {
    if (activeOperation === operation) {
      activeOperation = null;
    }
  }
}

function sqliteBackupInstruction(destination) {
  return `.backup '${destination.replaceAll("'", "''")}'`;
}

async function ensureRepository(config, environment) {
  try {
    await run('restic', ['cat', 'config'], {
      env: environment,
      timeoutMs: config.backup.timeoutMs
    });
    return false;
  } catch (error) {
    if (!repositoryIsMissing(error)) {
      throw error;
    }
  }

  await run('restic', ['init'], {
    env: environment,
    timeoutMs: config.backup.timeoutMs
  });
  return true;
}

function repositoryIsMissing(error) {
  const detail = String(error?.stderr || '');

  return (
    detail.includes('unable to open config file') ||
    detail.includes('Is there a repository at the following location?')
  );
}

function run(command, args, { env, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    const child = spawn(command, args, {
      env,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4096);
    });

    function finish(error) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);

      if (error) {
        reject(error);
        return;
      }

      resolve();
    }

    child.once('error', () => {
      finish(new BackupCommandError(command, null, timedOut));
    });
    child.once('close', (code) => {
      if (code === 0 && !timedOut) {
        finish();
        return;
      }

      const error = new BackupCommandError(command, code, timedOut);
      error.stderr = stderr;
      finish(error);
    });
  });
}
