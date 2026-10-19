import { randomUUID } from "node:crypto";
import { HttpError } from "../http.mjs";
import { getPool, insertRow, transaction, sqlTables } from "./database.mjs";

export function subject(session) {
  if (!session) throw new HttpError(401, "unauthenticated");
  const sub =
    typeof session.user?.sub === "string" ? session.user.sub.trim() : "";
  if (!sub) throw new HttpError(409, "identity_not_ready");
  return sub;
}

export function identity(session) {
  const sub = subject(session);
  const wallet = session.user?.safeWalletAddress?.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(wallet || ""))
    throw new HttpError(409, "safe_wallet_not_ready");
  return { wallet, sub };
}

export function claimStore(database = getPool(), schema = "public") {
  const tables = sqlTables(schema);
  const entitlements = async (session, productId = null) => {
    const { wallet } = identity(session);
    return (
      await database.query(
        `SELECT * FROM ${tables.merch_product_entitlements} WHERE wallet_address=$1 AND ($2::text IS NULL OR product_id=$2) ORDER BY product_id`,
        [wallet, productId],
      )
    ).rows;
  };
  const grant = async (client, claim) =>
    insertRow(client, tables.merch_product_entitlements, {
      wallet_address: claim.wallet_address,
      product_id: claim.product_id,
      source_claim_id: claim.id,
      source: "submitted_claim",
      granted_at: claim.submitted_at,
      eligibility_json: claim.eligibility_json,
    });
  const reserve = async (client, session, productId, code) => {
    const { wallet } = identity(session);
    // All claims for a limited product serialize before counting inventory.
    // The transaction-scoped lock releases on commit, rollback or disconnect.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "merch-product:" + productId,
    ]);
    const existing = await client.query(
      `SELECT 1 FROM ${tables.merch_product_entitlements} WHERE wallet_address=$1 AND product_id=$2`,
      [wallet, productId],
    );
    if (existing.rowCount) throw new HttpError(409, code);
    return wallet;
  };
  return {
    entitlements,
    async inventory() {
      const {
        rows: [row],
      } = await database.query(
        `SELECT COUNT(*) AS claimed FROM ${tables.shipping_claims} WHERE product_id='bracelet' AND claim_status='submitted'`,
      );
      const claimed = Number(row.claimed),
        remaining = Math.max(0, 20 - claimed);
      return {
        products: [
          {
            productId: "bracelet",
            limit: 20,
            claimed,
            remaining,
            soldOut: remaining === 0,
          },
        ],
      };
    },
    async readShipping(session, productId) {
      if (!["shirt", "bracelet"].includes(productId))
        throw new HttpError(400, "shipping_product_invalid");
      const { wallet } = identity(session),
        [entitlement] = await entitlements(session, productId);
      const {
        rows: [row],
      } = await database.query(
        `SELECT * FROM ${tables.shipping_claims} WHERE wallet_address=$1 AND product_id=$2
        AND ($3::text IS NULL OR id=$3) ORDER BY created_at DESC,id DESC LIMIT 1`,
        [wallet, productId, entitlement?.source_claim_id || null],
      );
      if (entitlement && !row)
        throw new HttpError(500, "merch_claim_entitlement_source_missing");
      return {
        claim: row
          ? {
              savedAt: row.created_at,
              productId: row.product_id,
              shipping: JSON.parse(row.shipping_json),
              status: entitlement ? "submitted" : row.claim_status,
              submittedAt:
                row.submitted_at || (entitlement ? row.created_at : null),
            }
          : null,
        hasSubmitted: !!entitlement,
      };
    },
    async saveShipping(session, { productId, shipping, eligibility, intent }) {
      if (!["shirt", "bracelet"].includes(productId))
        throw new HttpError(400, "shipping_product_invalid");
      if (eligibility.status !== "eligible")
        throw new HttpError(403, "wallet_not_eligible");
      const { wallet, sub } = identity(session);
      if (eligibility.walletAddress?.toLowerCase() !== wallet)
        throw new HttpError(409, "merch_access_wallet_mismatch");
      const now = new Date().toISOString(),
        submitted = intent === "submit";
      return transaction(async (client) => {
        await reserve(
          client,
          session,
          productId,
          "shipping_claim_already_submitted",
        );
        if (submitted && productId === "bracelet") {
          const {
            rows: [stock],
          } = await client.query(
            `SELECT COUNT(*) AS n FROM ${tables.shipping_claims} WHERE product_id='bracelet' AND claim_status='submitted'`,
          );
          if (Number(stock.n) >= 20)
            throw new HttpError(409, "merch_inventory_sold_out");
        }
        await client.query(
          `DELETE FROM ${tables.shipping_claims} WHERE wallet_address=$1 AND product_id=$2 AND claim_status='draft'`,
          [wallet, productId],
        );
        const row = {
          id: randomUUID(),
          created_at: now,
          submitted_at: submitted ? now : null,
          claim_status: submitted ? "submitted" : "draft",
          product_id: productId,
          wallet_address: wallet,
          user_sub: sub,
          user_email: session.user.email || null,
          sbt_balance: eligibility.sbtBalance,
          sbt_badge_count: eligibility.sbtBadgeCount,
          minimum_sbt_balance: eligibility.minimumSbtBalance,
          sbt_contract: eligibility.sbtContract,
          eligibility_source: eligibility.source,
          eligibility_json: JSON.stringify(eligibility),
          shipping_json: JSON.stringify(shipping),
          user_json: JSON.stringify(session.user),
          gmail: null,
        };
        const names = {
          first_name: "firstName",
          last_name: "lastName",
          email: "email",
          phone: "phone",
          country: "country",
          address_line_1: "addressLine1",
          address_line_2: "addressLine2",
          city: "city",
          region: "region",
          postal_code: "postalCode",
          delivery_notes: "deliveryNotes",
          size: "size",
          color: "color",
        };
        for (const [column, key] of Object.entries(names))
          row[column] = shipping[key] ?? null;
        await insertRow(client, tables.shipping_claims, row);
        if (submitted) await grant(client, row);
        return {
          hasSubmitted: submitted,
          claimId: row.id,
          productId,
          savedAt: now,
          status: row.claim_status,
          submittedAt: row.submitted_at,
        };
      }, database);
    },
    async readTicket(session) {
      const { wallet } = identity(session);
      const {
        rows: [row],
      } = await database.query(
        `SELECT * FROM ${tables.vip_ticket_claims} WHERE wallet_address=$1 AND product_id='ticket' ORDER BY created_at DESC LIMIT 1`,
        [wallet],
      );
      return {
        claim: row
          ? {
              email: row.claim_email,
              productId: "ticket",
              savedAt: row.created_at,
              status: "submitted",
              submittedAt: row.submitted_at,
            }
          : null,
        hasSubmitted: !!row,
      };
    },
    async saveTicket(session, { email, eligibility }) {
      const { wallet, sub } = identity(session);
      if (eligibility.status !== "eligible")
        throw new HttpError(403, "wallet_not_eligible");
      if (eligibility.walletAddress?.toLowerCase() !== wallet)
        throw new HttpError(409, "merch_access_wallet_mismatch");
      const now = new Date().toISOString();
      await transaction(async (client) => {
        await reserve(
          client,
          session,
          "ticket",
          "vip_ticket_claim_already_submitted",
        );
        const row = {
          id: randomUUID(),
          created_at: now,
          submitted_at: now,
          product_id: "ticket",
          wallet_address: wallet,
          user_sub: sub,
          user_email: session.user.email || null,
          claim_email: email,
          eligibility_json: JSON.stringify(eligibility),
          user_json: JSON.stringify(session.user),
        };
        await insertRow(client, tables.vip_ticket_claims, row);
        await grant(client, row);
      }, database);
      return {
        claim: {
          email,
          productId: "ticket",
          savedAt: now,
          status: "submitted",
          submittedAt: now,
        },
        hasSubmitted: true,
      };
    },
    async readProfile(session) {
      const sub = subject(session);
      const {
        rows: [row],
      } = await database.query(
        `SELECT profile_json,updated_at FROM ${tables.shipping_profiles} WHERE user_sub=$1`,
        [sub],
      );
      return {
        profile: row ? JSON.parse(row.profile_json) : null,
        savedAt: row?.updated_at || null,
      };
    },
    async saveProfile(session, profile) {
      const sub = subject(session),
        now = new Date().toISOString();
      const candidate = session.user.safeWalletAddress?.trim().toLowerCase();
      const wallet = /^0x[a-f0-9]{40}$/.test(candidate || "")
        ? candidate
        : null;
      await database.query(
        `INSERT INTO ${tables.shipping_profiles} (user_sub,wallet_address,profile_json,created_at,updated_at) VALUES($1,$2,$3,$4,$4)
        ON CONFLICT(user_sub) DO UPDATE SET wallet_address=excluded.wallet_address,profile_json=excluded.profile_json,updated_at=excluded.updated_at`,
        [sub, wallet, JSON.stringify(profile), now],
      );
      return { profile, savedAt: now };
    },
  };
}
