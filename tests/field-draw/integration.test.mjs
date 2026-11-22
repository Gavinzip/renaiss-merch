import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createDatabasePool } from "../../server/postgres/database.mjs";
import { getWorkflowDatabase } from "../../server/postgres/statements.mjs";
import { createDrawRoomAccess } from "../../server/draw-room/access.mjs";
import { hashSurfDrawPassword } from "../../server/surf-draw/access-credential.mjs";
import { createRosterDrawRoute } from "../../server/roster-draw/routes.mjs";
import { createRosterStore } from "../../server/roster-draw/store.mjs";
import { sendHttpError } from "../../server/http.mjs";
import { parseRoster } from "../../shared/roster-draw.js";
import { readJsonBody } from "../../server/request-json.mjs";

// Explicit disposable PostgreSQL owner URL only. Never uses MERCH_DATABASE_URL.
const ownerFile = process.env.FIELD_DRAW_TEST_DATABASE_URL_FILE;
const hosted = process.env.FIELD_DRAW_TEST_HOSTED === '1';
test(
  `${hosted ? 'Vercel request shape' : 'Node stream'}: isolated draw-room auth, persisted rounds and concurrent exclusion`,
  { skip: !ownerFile },
  async (t) => {
    const url = (await readFile(ownerFile, "utf8")).trim();
    const pool = createDatabasePool(url);
    t.after(() => pool.end());
    const schemas = hosted
      ? ["field_draw_hosted_test_20261122", "legacy_draw_hosted_test_20261122"]
      : ["field_draw_test_20261122", "legacy_draw_test_20261122"];
    const originalVercel = process.env.VERCEL;
    if (hosted) process.env.VERCEL = '1';
    else delete process.env.VERCEL;
    t.after(() => {
      if (originalVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = originalVercel;
    });
    for (const schema of schemas) {
      assert.equal(
        (
          await pool.query("SELECT 1 FROM pg_namespace WHERE nspname=$1", [
            schema,
          ])
        ).rowCount,
        0,
        "Test schema already exists; do not overwrite it",
      );
      const migration = await readFile(
        new URL(
          "../../server/postgres/migrations/20261122-field-draw.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await pool.query(migration.replaceAll("field_draw", schema));
    }
    const db = getWorkflowDatabase(pool, schemas[0]),
      legacyDb = getWorkflowDatabase(pool, schemas[1]);
    const password = "test-only-" + randomUUID();
    process.env.FIELD_TEST_USERNAME = "field-operator";
    process.env.FIELD_TEST_PASSWORD_HASH = await hashSurfDrawPassword(password);
    const access = createDrawRoomAccess({
      root: "/api/auth/test-field",
      cookie: "field_test",
      envPrefix: "FIELD_TEST",
      codePrefix: "field_draw",
      sessionTable: "draw_room_access_sessions",
      throttleTable: "draw_room_login_throttle",
      database: () => db,
      fingerprintScope: "field:",
    });
    const legacy = createDrawRoomAccess({
      root: "/api/auth/test-legacy",
      cookie: "legacy_test",
      envPrefix: "FIELD_TEST",
      codePrefix: "surf_draw",
      sessionTable: "draw_room_access_sessions",
      throttleTable: "draw_room_login_throttle",
      database: () => legacyDb,
    });
    const roster = createRosterDrawRoute({
      root: "/api/test-field/roster",
      requireAccess: access.requireAccess,
      database: () => db,
      storeOptions: { allowedKinds: ["other"] },
    });
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost");
        const request = hosted ? {
          method: req.method,
          headers: {...req.headers, 'x-forwarded-for':'203.0.113.23', 'x-forwarded-proto':'https'},
          body: req.method === 'POST' ? await readJsonBody(req,4_000_000) : undefined,
        } : req;
        if (
          (await access.handleRoute(request, res, url)) ||
          (await legacy.handleRoute(request, res, url)) ||
          (await roster(request, res, url))
        )
          return;
        res.writeHead(404);
        res.end();
      } catch (error) {
        sendHttpError(res, error);
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const originalOrigin = process.env.PUBLIC_APP_ORIGIN;
    process.env.PUBLIC_APP_ORIGIN = origin;
    t.after(() => {
      if (originalOrigin) process.env.PUBLIC_APP_ORIGIN = originalOrigin;
      else delete process.env.PUBLIC_APP_ORIGIN;
    });
    const call = (path, body, cookie, requestOrigin = origin) =>
      fetch(origin + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(body
            ? { "Content-Type": "application/json", Origin: requestOrigin }
            : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    let cookie, state;
    await t.test(
      "paste/files share validation; duplicates and invalid UTF-8-size content rejected",
      () => {
        assert.deepEqual(
          parseRoster(" 甲\n乙\n甲\n", "txt").map((x) => x.name),
          ["甲", "乙", "甲"],
        );
        assert.equal(
          parseRoster('id,name\n01,"王,小明"\n02,小華', "csv")[0].id,
          "01",
        );
        assert.equal(
          parseRoster("姓名\t編號\n小美\t0001", "tsv")[0].id,
          "0001",
        );
        assert.throws(() => parseRoster("id,name\n1,A\n1,B", "csv"), /重複/);
        assert.throws(() => parseRoster("甲".repeat(333334), "txt"), /1 MB/);
      },
    );
    await t.test(
      "real login, CSRF, API protection and cookie isolation",
      async () => {
        assert.equal((await call("/api/test-field/roster")).status, 401);
        assert.equal(
          (
            await call(
              "/api/auth/test-field/login",
              { username: "field-operator", password },
              null,
              "https://untrusted.example",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call("/api/auth/test-field/login", {
              username: "field-operator",
              password: "wrong",
            })
          ).status,
          401,
        );
        const response = await call("/api/auth/test-field/login", {
          username: "field-operator",
          password,
        });
        assert.equal(response.status, 200);
        assert.match(response.headers.get("set-cookie"), /HttpOnly/);
        assert.match(response.headers.get("set-cookie"), /SameSite=Lax/);
        cookie = response.headers.get("set-cookie").split(";")[0];
        assert.equal(
          (
            await (
              await call("/api/auth/test-field/session", null, cookie)
            ).json()
          ).authenticated,
          true,
        );
        assert.equal(
          (
            await (
              await call("/api/auth/test-legacy/session", null, cookie)
            ).json()
          ).authenticated,
          false,
        );
        const legacyLogin = await call("/api/auth/test-legacy/login", {
          username: "field-operator",
          password,
        });
        const legacyCookie = legacyLogin.headers
          .get("set-cookie")
          .split(";")[0];
        assert.equal(
          (await call("/api/test-field/roster", null, legacyCookie)).status,
          401,
        );
        assert.equal(
          (
            await call(
              "/api/test-field/roster/upload",
              { text: "A", format: "txt", title: "x", previousId: null },
              cookie,
              "https://untrusted.example",
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "persistent actual server random draw; retries and simultaneous requests cannot consume two entries",
      async () => {
        const response = await call(
          "/api/test-field/roster/upload",
          {
            text: "QA-甲\nQA-乙\nQA-甲",
            format: "txt",
            title: "QA round one",
            previousId: null,
          },
          cookie,
        );
        assert.equal(response.status, 200);
        state = await response.json();
        const input = {
          requestId: randomUUID(),
          rosterId: state.roster.id,
          expectedCount: 0,
          kind: "other",
          prize: "QA prize",
        };
        const responses = await Promise.all([
          call("/api/test-field/roster/draw", input, cookie),
          call("/api/test-field/roster/draw", input, cookie),
        ]);
        assert.deepEqual(
          responses.map((x) => x.status),
          [200, 200],
        );
        const [a, b] = await Promise.all(responses.map((x) => x.json()));
        assert.equal(a.result.entryId, b.result.entryId);
        assert.equal(b.winners.length, 1);
        state = b;
        const competing = await Promise.all(
          [1, 2].map(() =>
            call(
              "/api/test-field/roster/draw",
              { ...input, requestId: randomUUID(), expectedCount: 1 },
              cookie,
            ),
          ),
        );
        assert.deepEqual(competing.map((x) => x.status).sort(), [200, 409]);
        state = await (
          await call("/api/test-field/roster", null, cookie)
        ).json();
        assert.equal(state.winners.length, 2);
        assert.equal(
          (
            await call(
              "/api/test-field/roster/upload",
              {
                text: "Replacement",
                format: "txt",
                title: "bad",
                previousId: state.roster.id,
              },
              cookie,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await call(
              "/api/test-field/roster/draw",
              {
                ...input,
                requestId: randomUUID(),
                kind: "charizard",
                expectedCount: 2,
              },
              cookie,
            )
          ).status,
          400,
        );
        state = await (
          await call(
            "/api/test-field/roster/draw",
            { ...input, requestId: randomUUID(), expectedCount: 2 },
            cookie,
          )
        ).json();
        assert.equal(new Set(state.winners.map((x) => x.entryId)).size, 3);
        assert.equal(
          (
            await call(
              "/api/test-field/roster/draw",
              { ...input, requestId: randomUUID(), expectedCount: 3 },
              cookie,
            )
          ).status,
          409,
        );
        const secondPool = createDatabasePool(url);
        try {
          assert.deepEqual(
            await createRosterStore(
              getWorkflowDatabase(secondPool, schemas[0]),
            ).state(),
            stateWithoutResult(state),
          );
        } finally {
          await secondPool.end();
        }
        assert.equal(
          (await createRosterStore(legacyDb).state()).winners.length,
          0,
        );
      },
    );
    await t.test(
      "archived rounds retained; stale clear cannot erase a new round",
      async () => {
        const clear = { rosterId: state.roster.id, expectedCount: 3 };
        assert.equal(
          (
            await call(
              "/api/test-field/roster/clear",
              { ...clear, expectedCount: 2 },
              cookie,
            )
          ).status,
          409,
        );
        state = await (
          await call("/api/test-field/roster/clear", clear, cookie)
        ).json();
        assert.equal(state.roster, null);
        assert.equal(state.history.length, 3);
        assert.equal(
          (await call("/api/test-field/roster/clear", clear, cookie)).status,
          200,
        );
        state = await (
          await call(
            "/api/test-field/roster/upload",
            {
              text: "New name",
              format: "txt",
              title: "Round two",
              previousId: null,
            },
            cookie,
          )
        ).json();
        assert.equal(state.winners.length, 0);
        assert.equal(state.history.length, 3);
        assert.equal(
          (await call("/api/test-field/roster/clear", clear, cookie)).status,
          409,
        );
        assert.equal(
          (
            await pool.query(
              `SELECT count(*)::int AS count FROM ${schemas[0]}.roster_draw_archives`,
            )
          ).rows[0].count,
          1,
        );
      },
    );
    await t.test(
      "logout revokes token, password rotation invalidates sessions and repeated failures throttle",
      async () => {
        await call("/api/auth/test-field/logout", {}, cookie);
        assert.equal(
          (await call("/api/test-field/roster", null, cookie)).status,
          401,
        );
        const login = await call("/api/auth/test-field/login", {
          username: "field-operator",
          password,
        });
        cookie = login.headers.get("set-cookie").split(";")[0];
        process.env.FIELD_TEST_PASSWORD_HASH = await hashSurfDrawPassword(
          "rotated-test-" + randomUUID(),
        );
        assert.equal(
          (await call("/api/test-field/roster", null, cookie)).status,
          401,
        );
        for (let i = 0; i < 5; i++)
          assert.equal(
            (
              await call("/api/auth/test-field/login", {
                username: "field-operator",
                password: "wrong",
              })
            ).status,
            401,
          );
        assert.equal(
          (
            await call("/api/auth/test-field/login", {
              username: "field-operator",
              password: "wrong",
            })
          ).status,
          429,
        );
      },
    );
  },
);
function stateWithoutResult({ result, ...state }) {
  return state;
}
