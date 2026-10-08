import { randomUUID } from 'node:crypto';
import { surfCampaign } from '../../shared/surf-campaign.js';
import { getPublicOrigin } from '../config.mjs';
import { requireFulfillmentAdministrator } from '../fulfillment-admin.mjs';
import { HttpError, sendJson } from '../http.mjs';
import { readMissionState } from './service.mjs';
import { createParticipationStore, publicParticipant, TICKET_RULE_VERSION } from './participation-store.mjs';

const ROOT = '/api/admin/missions/surf/participants';

export function createParticipationAdminHandler({ readSession, storeFactory }) {
  return (req, res, url) => {
    if (url.pathname !== ROOT && url.pathname !== `${ROOT}/export`) return false;
    const exporting = url.pathname.endsWith('/export');
    if (req.method !== (exporting ? 'POST' : 'GET')) throw new HttpError(405, 'method_not_allowed');
    const session = readSession(req);
    requireFulfillmentAdministrator(session);
    if (session.user.isDemo) throw new HttpError(403, 'demo_missions_disabled');
    if (exporting && req.headers.origin !== getPublicOrigin(req)) throw new HttpError(403, 'invalid_request_origin');
    const store = storeFactory(), ledger = createParticipationStore(store.database);
    backfillParticipants(req, store, ledger);
    if (exporting) exportParticipants(res, session.user.sub, url.searchParams, ledger.database);
    else sendJson(res, 200, participantOverview(url.searchParams, ledger.database));
    return true;
  };
}

// Upgrade existing verification records using the most recent trusted SSO
// identity. A missing historical profile stays visible with zero tickets;
// signing in supplies the verified wallet/profile and completes synchronization.
function backfillParticipants(req, store, ledger) {
  const candidates = store.database.prepare(`SELECT DISTINCT user_sub FROM mission_results WHERE campaign=?
    UNION SELECT DISTINCT user_sub FROM mission_connections WHERE campaign=?`).all(surfCampaign.id, surfCampaign.id);
  const hasSessions = store.database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='renaiss_identity_sessions'").get();
  for (const { user_sub: sub } of candidates) {
    if (ledger.read(surfCampaign.id, sub)) continue;
    const identity = hasSessions ? store.database.prepare(`SELECT user_json FROM renaiss_identity_sessions
      WHERE json_extract(user_json,'$.sub')=? ORDER BY created_at DESC LIMIT 1`).get(sub) : null;
    const user = identity ? JSON.parse(identity.user_json) : { sub };
    readMissionState(req, { user }, { storeFactory: () => store });
  }
}

function participantOverview(params, db) {
  const page = positiveInteger(params.get('page'), 1), pageSize = 50;
  const search = (params.get('search') || '').trim().slice(0, 120);
  const escaped = search.replace(/[\\%_]/g, '\\$&');
  const clause = search ? ` AND (COALESCE(name,'') LIKE ? ESCAPE '\\' OR COALESCE(wallet_address,'') LIKE ? ESCAPE '\\'
    OR COALESCE(x_username,'') LIKE ? ESCAPE '\\' OR COALESCE(email,'') LIKE ? ESCAPE '\\')` : '';
  const values = [surfCampaign.id, TICKET_RULE_VERSION, ...(search ? Array(4).fill(`%${escaped}%`) : [])];
  const total = db.prepare(`SELECT COUNT(*) AS value FROM mission_participants WHERE campaign=? AND rule_version=?${clause}`).get(...values).value;
  const rows = db.prepare(`SELECT * FROM mission_participants WHERE campaign=? AND rule_version=?${clause}
    ORDER BY updated_at DESC,user_sub LIMIT ? OFFSET ?`).all(...values, pageSize, (page - 1) * pageSize);
  const summary = db.prepare(`SELECT COUNT(*) AS participants,
    COALESCE(SUM(ticket_count>0),0) AS eligibleParticipants,COALESCE(SUM(ticket_count),0) AS tickets
    FROM mission_participants WHERE campaign=? AND rule_version=?`).get(surfCampaign.id, TICKET_RULE_VERSION);
  const latestExport = db.prepare(`SELECT id,created_at AS createdAt,participant_count AS participants,ticket_count AS tickets
    FROM mission_participant_exports WHERE campaign=? AND rule_version=? ORDER BY created_at DESC LIMIT 1`)
    .get(surfCampaign.id, TICKET_RULE_VERSION) || null;
  return { campaignId: surfCampaign.id, ruleVersion: TICKET_RULE_VERSION, summary, rows: rows.map(publicParticipant),
    page, pageSize, total, latestExport };
}

function exportParticipants(res, administrator, params, db) {
  const scope = params.get('scope') || 'eligible';
  if (!['eligible', 'all'].includes(scope)) throw new HttpError(400, 'participant_export_scope_invalid');
  const snapshot = db.transaction(() => {
    const rows = db.prepare(`SELECT * FROM mission_participants WHERE campaign=? AND rule_version=?
      ${scope === 'eligible' ? 'AND ticket_count>0' : ''} ORDER BY created_at,user_sub`)
      .all(surfCampaign.id, TICKET_RULE_VERSION).map(publicParticipant);
    const id = randomUUID(), createdAt = new Date().toISOString(), tickets = rows.reduce((sum, row) => sum + row.ticketCount, 0);
    db.prepare('INSERT INTO mission_participant_exports VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id, surfCampaign.id, TICKET_RULE_VERSION, administrator, scope, rows.length, tickets, JSON.stringify(rows), createdAt);
    return { id, createdAt, tickets, rows };
  }).immediate();
  const csv = participantCsv(snapshot), body = Buffer.from(csv, 'utf8');
  res.writeHead(200, {
    'Cache-Control': 'no-store, private', 'Content-Type': 'text/csv; charset=utf-8', 'Content-Length': body.byteLength,
    'Content-Disposition': `attachment; filename="renaiss-surf-${scope}-${snapshot.createdAt.replace(/[:.]/g, '-')}.csv"`,
    'X-Participant-Export-Id': snapshot.id, 'X-Participant-Count': String(snapshot.rows.length), 'X-Ticket-Count': String(snapshot.tickets),
  });
  res.end(body);
}

function participantCsv(snapshot) {
  const columns = ['export_id', 'campaign', 'rule_version', 'renaiss_user_id', 'name', 'safe_wallet_address', 'email',
    'renaiss_x_username', 'x_user_id', 'x_username', 'discord_user_id', 'discord_username', 'accounts_verified', 'x_verified',
    'discord_verified', 'tickets', 'status', 'accounts_verified_at', 'x_verified_at', 'discord_verified_at',
    'accounts_last_checked_at', 'x_last_checked_at', 'discord_last_checked_at',
    'accounts_latest_outcome', 'x_latest_outcome', 'discord_latest_outcome',
    'accounts_latest_reason', 'x_latest_reason', 'discord_latest_reason', 'created_at', 'updated_at'];
  const lines = [columns.map(csvCell).join(',')];
  for (const p of snapshot.rows) {
    lines.push([snapshot.id, p.campaignId, p.ruleVersion, p.userSub, p.name, p.walletAddress, p.email,
      p.renaissXUsername, p.xUserId, p.xUsername, p.discordUserId, p.discordUsername,
      p.tasks.accounts.verified, p.tasks.x.verified, p.tasks.discord.verified, p.ticketCount, p.status,
      p.tasks.accounts.verifiedAt, p.tasks.x.verifiedAt, p.tasks.discord.verifiedAt,
      p.tasks.accounts.checkedAt, p.tasks.x.checkedAt, p.tasks.discord.checkedAt,
      p.tasks.accounts.outcome, p.tasks.x.outcome, p.tasks.discord.outcome,
      p.tasks.accounts.reason, p.tasks.x.reason, p.tasks.discord.reason, p.createdAt, p.updatedAt].map(csvCell).join(','));
  }
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function positiveInteger(value, defaultValue) {
  if (value === null) return defaultValue;
  if (!/^[1-9]\d{0,6}$/.test(value)) throw new HttpError(400, 'participant_page_invalid');
  return Number(value);
}
