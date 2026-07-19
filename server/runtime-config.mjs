import { dirname, isAbsolute, resolve } from 'node:path';

const DEFAULT_CLAIM_DB_PATH = '.data/merch-shipping-claims.sqlite';
const DEFAULT_BACKUP_TIMEOUT_SECONDS = 1800;
const DEFAULT_KEEP_HOURLY = 48;
const DEFAULT_KEEP_DAILY = 14;
const DEFAULT_KEEP_WEEKLY = 8;
const DEFAULT_KEEP_MONTHLY = 12;
const REQUIRED_RCLONE_KEYS = [
  'RCLONE_CONFIG_GDRIVE_TYPE',
  'RCLONE_CONFIG_GDRIVE_SCOPE',
  'RCLONE_CONFIG_GDRIVE_ROOT_FOLDER_ID',
  'RCLONE_CONFIG_GDRIVE_CLIENT_ID',
  'RCLONE_CONFIG_GDRIVE_CLIENT_SECRET',
  'RCLONE_CONFIG_GDRIVE_TOKEN'
];

export function getClaimDatabasePath(configuredPath) {
  return resolve(
    configuredPath ||
      readOptionalEnv('MERCH_CLAIM_DB_PATH') ||
      readOptionalEnv('DATABASE_PATH') ||
      DEFAULT_CLAIM_DB_PATH
  );
}

export function getRuntimeConfig() {
  const databasePath = getClaimDatabasePath();

  return {
    backup: getBackupConfig(databasePath),
    databasePath
  };
}

function getBackupConfig(databasePath) {
  const repository = readOptionalEnv('BACKUP_REPOSITORY');
  const password = readOptionalEnv('RESTIC_PASSWORD');
  const triggerSecret = readOptionalEnv('BACKUP_TRIGGER_SECRET');
  const configuredCoreValues = [repository, password, triggerSecret].filter(Boolean);
  const hasRcloneValues = REQUIRED_RCLONE_KEYS.some((key) => readOptionalEnv(key));

  if (configuredCoreValues.length === 0 && !hasRcloneValues) {
    return notConfiguredBackup('not_configured');
  }

  if (
    configuredCoreValues.length < 3 ||
    !repository.startsWith('rclone:gdrive:') ||
    triggerSecret.length < 48 ||
    missingRcloneKeys().length > 0
  ) {
    return notConfiguredBackup('incomplete');
  }

  const stagingDir = readOptionalEnv('BACKUP_STAGING_DIR') ||
    resolve(dirname(databasePath), 'backup-staging');

  if (!isAbsolute(stagingDir)) {
    return notConfiguredBackup('incomplete');
  }

  return Object.freeze({
    configured: true,
    password,
    repository,
    retention: Object.freeze({
      daily: readPositiveIntegerEnv('BACKUP_KEEP_DAILY', DEFAULT_KEEP_DAILY),
      hourly: readPositiveIntegerEnv('BACKUP_KEEP_HOURLY', DEFAULT_KEEP_HOURLY),
      monthly: readPositiveIntegerEnv('BACKUP_KEEP_MONTHLY', DEFAULT_KEEP_MONTHLY),
      weekly: readPositiveIntegerEnv('BACKUP_KEEP_WEEKLY', DEFAULT_KEEP_WEEKLY)
    }),
    stagingDir: resolve(stagingDir),
    state: 'ready',
    timeoutMs:
      readPositiveIntegerEnv(
        'BACKUP_TIMEOUT_SECONDS',
        DEFAULT_BACKUP_TIMEOUT_SECONDS
      ) * 1000,
    triggerSecret
  });
}

function notConfiguredBackup(state) {
  return Object.freeze({
    configured: false,
    password: '',
    repository: '',
    retention: Object.freeze({
      daily: DEFAULT_KEEP_DAILY,
      hourly: DEFAULT_KEEP_HOURLY,
      monthly: DEFAULT_KEEP_MONTHLY,
      weekly: DEFAULT_KEEP_WEEKLY
    }),
    stagingDir: '',
    state,
    timeoutMs: 0,
    triggerSecret: ''
  });
}

function missingRcloneKeys() {
  return REQUIRED_RCLONE_KEYS.filter((key) => !readOptionalEnv(key));
}

function readOptionalEnv(name) {
  return process.env[name]?.trim() || '';
}

function readPositiveIntegerEnv(name, fallback) {
  const value = Number.parseInt(readOptionalEnv(name), 10);

  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
