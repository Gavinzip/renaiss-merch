import { AsyncLocalStorage } from 'node:async_hooks';
import { getPool, transaction } from './database.mjs';

const contexts = new AsyncLocalStorage();
const repositories = new WeakMap();
const tableNames = new Set([
  'fulfillment_exports','mission_account_override_events','mission_account_overrides',
  'mission_connections','mission_oauth_challenges','mission_operation_leases',
  'mission_participant_exports','mission_participants','mission_participation_events',
  'mission_result_history','mission_results','mission_social_identity_locks',
  'mission_surf_accounts','mission_x_identity_locks','renaiss_identity_sessions',
  'roster_draw_archives','roster_draw_list','roster_draw_winners',
  'surf_draw_access_sessions','surf_draw_action_locks','surf_draw_active_round',
  'surf_draw_contact_snapshots','surf_draw_lifecycle','surf_draw_local_grants',
  'surf_draw_login_throttle','surf_draw_reset_context','surf_draw_round_history',
  'surf_draw_snapshots','surf_draw_superseded_rounds','surf_draw_transactions',
  'surf_operator_approvals','surf_operator_grants','surf_registration_backoff',
  'surf_registration_requests','shipping_claims','vip_ticket_claims',
]);

// Native PostgreSQL statements with positional/named parameter binding. No
// SQLite driver, runtime DDL, persistent local files, or production proxy.
export function getWorkflowDatabase(pool = getPool(), schema = 'public') {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('invalid_sql_schema');
  let schemas = repositories.get(pool);
  if (!schemas) repositories.set(pool, schemas = new Map());
  if (schemas.has(schema)) return schemas.get(schema);
  const repo = {
    prepare(source) {
      let sql = source.replace(/\b(FROM|JOIN|UPDATE|INTO)\s+([a-z_][a-z0-9_]*)\b/gi, (all, verb, name) =>
        tableNames.has(name) ? `${verb} ${schema}.${name}` : all);
      // PostgreSQL folds unquoted aliases; preserve the existing JSON interface.
      sql = sql.replace(/\bAS\s+([a-z_][a-zA-Z0-9_]*)/g, (all, alias) =>
        /[A-Z]/.test(alias) ? `AS "${alias}"` : all);
      const execute = async args => {
        const values = [], named = args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0]) ? args[0] : null;
        let index = 0;
        const query = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?|@[a-zA-Z_][a-zA-Z0-9_]*/g, token => {
          if (token[0] === "'" || token[0] === '"') return token;
          const value = token === '?' ? args[index++] : named?.[token.slice(1)];
          if (value === undefined) throw new Error('missing_sql_parameter');
          values.push(value);
          return `$${values.length}`;
        });
        const context = contexts.getStore();
        return (context?.repo === repo ? context.client : pool).query(query, values);
      };
      return {
        get: async (...args) => (await execute(args)).rows[0],
        all: async (...args) => (await execute(args)).rows,
        run: async (...args) => ({ changes: (await execute(args)).rowCount }),
      };
    },
    transaction(operation) {
      const run = async (...args) => {
        if (contexts.getStore()?.repo === repo) return operation(...args);
        return transaction(async client => {
          // SQLite BEGIN IMMEDIATE serialized these workflows. Retain that
          // ordering across Vercel instances, with a transaction-scoped lock.
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`merch-workflows:${schema}`]);
          return contexts.run({ repo, client }, () => operation(...args));
        }, pool);
      };
      run.immediate = run;
      return run;
    },
  };
  schemas.set(schema, repo);
  return repo;
}
