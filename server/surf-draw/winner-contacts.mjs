import { keccak256, toUtf8Bytes } from 'ethers';

const text = value => typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '') : '';

export function ensureSurfContactTables(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS surf_draw_contact_snapshots (
    draw_id TEXT NOT NULL, prepared_at TEXT NOT NULL, ledger_hash TEXT NOT NULL,
    contacts_json TEXT NOT NULL, contacts_hash TEXT NOT NULL,
    PRIMARY KEY(draw_id,prepared_at)
  )`);
}

// Keep presentation metadata separate from the approved ticket commitment.
// The companion snapshot is immutable and remains linked to archived rounds.
export function captureSurfWinnerContacts(db, candidate, preparedAt) {
  ensureSurfContactTables(db);
  const read = db.prepare('SELECT email,x_username,renaiss_x_username,discord_username FROM mission_participants WHERE campaign=? AND rule_version=? AND user_sub=?');
  const contacts = Object.fromEntries(candidate.canonical.entries.map(entry => {
    const row = read.get(candidate.canonical.campaignId, candidate.canonical.ruleVersion, entry.userSub);
    if (!row || text(row.email) !== text(entry.email)) throw new Error('Surf draw contact identity changed');
    return [entry.userSub, { email: text(entry.email),
      xUsername: text(row.x_username) || text(row.renaiss_x_username), discordUsername: text(row.discord_username) }];
  }));
  const json = JSON.stringify(contacts);
  db.prepare('INSERT INTO surf_draw_contact_snapshots VALUES(?,?,?,?,?)').run(candidate.canonical.drawId, preparedAt,
    candidate.ledgerHash, json, keccak256(toUtf8Bytes(json)));
}

export function readSurfWinnerContacts(db, snapshot) {
  const record = db.prepare('SELECT * FROM surf_draw_contact_snapshots WHERE draw_id=? AND prepared_at=?').get(snapshot.draw_id, snapshot.prepared_at);
  if (!record || record.ledger_hash !== snapshot.ledger_hash || keccak256(toUtf8Bytes(record.contacts_json)) !== record.contacts_hash)
    throw new Error('Surf draw contact snapshot integrity failed');
  return JSON.parse(record.contacts_json);
}
