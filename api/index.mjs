import { logNodeRuntimeVersion } from '../server/node-runtime-version.mjs';
import { captureSourceVersion } from '../server/source-version.mjs';

import { HttpError, sendJson, sendHttpError } from "../server/http.mjs";
import { getStorefrontMode } from "../server/storefront-mode.mjs";
import { getStorefrontFeatures } from "../server/storefront-features.mjs";
import { readSurfStoreAccess } from "../server/surf-store-access.mjs";
import { readSurfStoreMediaUrls } from "../server/surf-store-media.mjs";
import { createSurfStoreRoutes } from '../server/surf-store-routes.mjs';
import {
  normalizeShippingPayload,
  normalizeShippingProfilePayload,
  readJsonBody,
} from "../server/shipping-details.mjs";
import { normalizeClaimEmail } from "../server/claim-email.mjs";
import {
  readMerchProductId,
  readMerchEligibility,
} from "../server/eligibility.mjs";
import { getPool, sqlTables } from "../server/postgres/database.mjs";
import {
  handleAuth,
  readSession,
  sameOrigin,
} from "../server/postgres/auth.mjs";
import { claimStore, subject } from "../server/postgres/claims.mjs";
import { accessStore } from "../server/postgres/access.mjs";
import { askHubAssistant } from "../server/hub/assistant.mjs";
import { readCommunityFeed } from "../server/hub/community-feed.mjs";
import { readHubMemberSbt } from "../server/hub/member-sbt.mjs";
import { validateHubPreferences } from "../shared/hub-preferences.js";
import { getMerchMediaAsset } from "../server/merch-media-assets.mjs";
import { getPublicOrigin } from "../server/config.mjs";
import {
  handleSevenElevenMapStart, handleSevenElevenMapCallback,
  handleSevenElevenSelectionConsume, resolveSevenElevenShippingDetails,
} from "../server/seven-eleven-store-selection.mjs";
import { createPrivateMediaSignedUrl } from "../server/private-media-signed-url.mjs";

import { handleBackupRoute } from "../server/postgres/backup.mjs";
import { handleWorkflowRoutes } from "../server/postgres/workflow-routes.mjs";
import { handleBinderRoutes } from '../server/binder/routes.mjs';
import { createPublicProofRoutes } from '../server/public-proof/routes.mjs';

const tables = sqlTables();
const handleSurfStoreRoutes = createSurfStoreRoutes();
const handlePublicProofRoutes = createPublicProofRoutes();
const runtimeSourceVersion = captureSourceVersion();
const allowedPaths = [
  '/api/public-proofs/worlds-2026/rounds',
  '/api/public-proofs/worlds-2026/:stage/bundle',
  '/api/binder',
  '/api/binder/library',
  "/api/storefront/features",
  "/api/surf-store/access",
  "/api/surf-store/claim",
  "/api/surf-store/inventory",
  "/api/admin/surf-store/claims",
  "/api/surf-store/media",
  "/api/auth/session",
  "/api/auth/renaiss/start",
  "/auth/callback",
  "/api/auth/logout",
  "/api/auth/logout-return",
  "/api/auth/demo",
  "/api/merch-inventory",
  "/api/merch-access-state",
  "/api/merch-eligibility",
  "/api/merch-eligibility/prepare",
  "/api/merch-7-eleven/map",
  "/api/merch-7-eleven/callback",
  "/api/merch-7-eleven/selection",
  "/api/merch-shipping-profile",
  "/api/merch-shipping-claim",
  "/api/merch-vip-ticket-claim",
  "/api/hub/feed",
  "/api/hub/member-sbt",
  "/api/hub/preferences",
  "/api/merch-reveal-thumbnail",
  "/api/merch-reveal-video",
];
function method(req, ...methods) {
  if (!methods.includes(req.method))
    throw new HttpError(405, "method_not_allowed");
}

logNodeRuntimeVersion('merch/api/index');

export default async function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("X-Merch-Environment", "isolated-migration-pilot");
  try {
    if (getStorefrontMode() !== "production")
      throw new HttpError(503, "pilot_requires_production_storefront_mode");
    const url = new URL(req.url, "http://localhost");
    if (await handlePublicProofRoutes(req, res, url)) return;
    if (await handleBinderRoutes(req, res, url)) return;
    if (url.pathname === "/healthz") {
      method(req, "GET", "HEAD");
      await getPool().query("SELECT 1");
      const ssoClientConfigured = Boolean(
        process.env.RENAISS_CLIENT_ID?.trim() &&
        process.env.RENAISS_CLIENT_SECRET?.trim(),
      );
      sendJson(res, 200, {
        ok: true,
        service: "renaiss-merch-pilot",
        database: "postgres",
        ...runtimeSourceVersion,
        migrationComplete: false,
        productionDataImported: Boolean(process.env.MERCH_PILOT_DATA_IMPORTED_AT),
        productionDataSnapshotAt: process.env.MERCH_PILOT_DATA_IMPORTED_AT || null,
        nonSsoStorageMigrationComplete: true,
        ssoClientConfigured,
        implemented: [...allowedPaths,"/api/hub/assistant","/api/missions/surf","/api/missions/surf/accounts/verify","/api/missions/surf/:provider/:action","/auth/:provider/callback","/api/admin/missions/surf/participants","/api/admin/missions/surf/participants/export","/api/admin/fulfillment","/api/admin/fulfillment/export","/api/auth/surf-draw/:action","/api/draw-room/roster/:action","/api/missions/surf/draw","/api/admin/missions/surf/draw/:action","/api/admin/missions/surf/draw/local-operator/:action","/api/internal/backup","/api/internal/backup/check"],
        pending: [
          ...(ssoClientConfigured ? [] : ["renaiss-sso-client"]),
          "authenticated-browser-acceptance",
        ],
      });
      return;
    }
    if (url.pathname === "/api/storefront/features") {
      method(req, "GET");
      sendJson(res, 200, getStorefrontFeatures());
      return;
    }
    if (url.pathname === "/api/hub/feed") {
      method(req, "GET");
      sendJson(
        res,
        200,
        await readCommunityFeed(url.searchParams.get("lang") || "zh-TW"),
      );
      return;
    }
    if (url.pathname === "/api/hub/assistant") {
      method(req, "POST"); sameOrigin(req);
      const input = await readJsonBody(req), controller = new AbortController();
      const onClose = () => { if (!res.writableEnded) controller.abort(); };
      res.on('close', onClose);
      try { sendJson(res, 200, await askHubAssistant(input, controller.signal)); }
      finally { res.off('close', onClose); }
      return;
    }
    if (url.pathname === "/api/hub/preferences" && req.method === "GET" && !await readSession(req)) {
      sendJson(res, 200, { preferences: null }); return;
    }
    if (await handleBackupRoute(req, res, url)) return;
    if (await handleWorkflowRoutes(req, res, url)) return;
    if (await handleSurfStoreRoutes(req, res, url)) return;
    if (
      url.pathname.startsWith("/api/auth/") ||
      url.pathname === "/auth/callback"
    ) {
      if (await handleAuth(req, res, url)) return;
      throw new HttpError(404, "not_found");
    }
    if (url.pathname === "/api/merch-inventory") {
      method(req, "GET");
      sendJson(res, 200, await claimStore().inventory());
      return;
    }
    if (url.pathname === "/api/merch-7-eleven/callback") {
      method(req, "POST");
      await handleSevenElevenMapCallback(req, res);
      return;
    }
    const session = await readSession(req);
    subject(session);
    if (url.pathname === '/api/surf-store/access') {
      method(req, 'GET');
      sendJson(res, 200, await readSurfStoreAccess(session, url.searchParams.get('rewardId')));
      return;
    }
    if (url.pathname === '/api/surf-store/media') {
      method(req, 'GET');
      sendJson(res, 200, await readSurfStoreMediaUrls(session));
      return;
    }
    if (url.pathname === "/api/merch-7-eleven/map") {
      method(req, "POST"); sameOrigin(req);
      await handleSevenElevenMapStart(req, res, session, { publicOrigin: getPublicOrigin(req) });
      return;
    }
    if (url.pathname === "/api/merch-7-eleven/selection") {
      method(req, "POST"); sameOrigin(req);
      await handleSevenElevenSelectionConsume(req, res, session);
      return;
    }
    const claims = claimStore(),
      access = accessStore();
    if (url.pathname === "/api/hub/member-sbt") {
      method(req, "GET");
      sendJson(
        res,
        200,
        await readHubMemberSbt(session, {
          forceRefresh: url.searchParams.get("refresh") === "1",
        }),
      );
      return;
    }
    if (url.pathname === "/api/hub/preferences") {
      method(req, "GET", "PUT");
      const sub = subject(session);
      if (req.method === "GET") {
        const {
          rows: [row],
        } = await getPool().query(
          `SELECT preferences_json FROM ${tables.hub_preferences} WHERE user_sub=$1`,
          [sub],
        );
        sendJson(res, 200, {
          preferences: row
            ? validateHubPreferences(JSON.parse(row.preferences_json))
            : null,
        });
      } else {
        sameOrigin(req);
        let preferences;
        try {
          preferences = validateHubPreferences(await readJsonBody(req));
        } catch (error) {
          if (error instanceof HttpError) throw error;
          throw new HttpError(400, "invalid_hub_preferences");
        }
        await getPool().query(
          `INSERT INTO ${tables.hub_preferences}(user_sub,preferences_json,updated_at) VALUES($1,$2,$3)
          ON CONFLICT(user_sub) DO UPDATE SET preferences_json=excluded.preferences_json,updated_at=excluded.updated_at`,
          [sub, JSON.stringify(preferences), new Date().toISOString()],
        );
        sendJson(res, 200, { preferences });
      }
      return;
    }
    if (
      ["/api/merch-reveal-thumbnail", "/api/merch-reveal-video"].includes(
        url.pathname,
      )
    ) {
      method(req, "GET", "HEAD");
      const productId = readMerchProductId(url.searchParams.get("productId"));
      if ((await access.check(session, productId)).status !== "eligible")
        throw new HttpError(403, "merch_reveal_forbidden");
      const video = url.pathname.endsWith("video");
      if (video && productId !== "ticket")
        throw new HttpError(400, "merch_private_reveal_product_invalid");
      const variant = url.searchParams.get("variant");
      const key = video
        ? "ticketRevealForward"
        : productId === "shirt"
          ? "shirtProduct"
          : productId === "ticket"
            ? "ticketProduct"
            : variant === "silver"
              ? "braceletProductSilver"
              : variant === "store-cover"
                ? "braceletStoreCover"
                : "braceletProductGold";
      if (
        !process.env.PRIVATE_MEDIA_ORIGIN ||
        !process.env.PRIVATE_MEDIA_PROXY_TOKEN
      )
        throw new HttpError(503, "private_media_not_configured");
      const source = getMerchMediaAsset(key);
      if (source.type !== "signed-remote")
        throw new HttpError(503, "signed_cloudflare_media_required");
      res.writeHead(307, {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        Location: createPrivateMediaSignedUrl(source),
      });
      res.end();
      return;
    }
    if (url.pathname === "/api/merch-access-state") {
      method(req, "GET");
      sendJson(res, 200, await access.read(session));
      return;
    }
    if (url.pathname === "/api/merch-eligibility/prepare") {
      method(req, "GET");
      await readMerchEligibility(session, { productId: "shirt" });
      res.writeHead(204, { "Cache-Control": "no-store" });
      res.end();
      return;
    }
    if (url.pathname === "/api/merch-eligibility") {
      method(req, "GET");
      sendJson(
        res,
        200,
        await access.check(
          session,
          readMerchProductId(url.searchParams.get("productId")),
          { forceRefresh: url.searchParams.get("refresh") === "1" },
        ),
      );
      return;
    }
    if (url.pathname === "/api/merch-shipping-profile") {
      method(req, "GET", "PUT", "POST");
      if (req.method === "GET")
        sendJson(res, 200, await claims.readProfile(session));
      else {
        sameOrigin(req);
        const payload = await readJsonBody(req);
        sendJson(
          res,
          200,
          await claims.saveProfile(
            session,
            await resolveSevenElevenShippingDetails(session,
              normalizeShippingProfilePayload(payload.profile || payload),
            ),
          ),
        );
      }
      return;
    }
    if (url.pathname === "/api/merch-shipping-claim") {
      method(req, "GET", "POST");
      if (req.method === "GET")
        sendJson(
          res,
          200,
          await claims.readShipping(
            session,
            readMerchProductId(url.searchParams.get("productId")),
          ),
        );
      else {
        sameOrigin(req);
        const payload = await readJsonBody(req),
          productId = readMerchProductId(payload.productId);
        const shipping = await resolveSevenElevenShippingDetails(session,
          normalizeShippingPayload(payload.shipping || payload, productId),
        );
        sendJson(
          res,
          201,
          await claims.saveShipping(session, {
            productId,
            shipping,
            intent: payload.intent,
            eligibility: await access.check(session, productId, {
              forceRefresh: true,
            }),
          }),
        );
      }
      return;
    }
    if (url.pathname === "/api/merch-vip-ticket-claim") {
      method(req, "GET", "POST");
      if (
        req.method === "GET" &&
        readMerchProductId(url.searchParams.get("productId") || "ticket") !==
          "ticket"
      )
        throw new HttpError(400, "vip_ticket_product_invalid");
      if (req.method === "GET")
        sendJson(res, 200, await claims.readTicket(session));
      else {
        sameOrigin(req);
        const payload = await readJsonBody(req);
        if (readMerchProductId(payload.productId) !== "ticket")
          throw new HttpError(400, "vip_ticket_product_invalid");
        sendJson(
          res,
          201,
          await claims.saveTicket(session, {
            email: normalizeClaimEmail(payload.email),
            eligibility: await access.check(session, "ticket", {
              forceRefresh: true,
            }),
          }),
        );
      }
      return;
    }
    // Unknown routes remain errors; no SQLite or production-service proxy.
    throw new HttpError(404, "not_found");
  } catch (error) {
    sendHttpError(res, error);
  }
}
