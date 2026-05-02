import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { resolve } from "node:path";

/**
 * IV-5 — provision-cf.ts second-run noop verification (contract C-14).
 *
 * Stands up a local mock that mimics the Cloudflare API surface the script
 * uses. The mock returns a "baseline-good" state — Pages project + custom
 * domains + DNS records all already match the desired shape. Running the
 * script twice MUST produce zero POST/PATCH requests on either run, since
 * the desired state already matches the source of truth.
 *
 * This is the missing piece in the existing test suite: deploy.test.ts
 * asserts the script's source code shape, but only an actual run can prove
 * idempotency. The mock is intentionally minimal: it covers the GET shapes
 * provision-cf actually issues.
 */

interface RecordedRequest {
  method: string;
  path: string;
  body?: unknown;
}

interface MockState {
  // Pages project record.
  project: {
    name: string;
    subdomain: string; // e.g. "ryanhenderson-dev.pages.dev"
    domains: string[];
  };
  // Pages custom domain bindings.
  domains: { name: string; status: string }[];
  // DNS records keyed by name.
  dnsRecords: Map<
    string,
    { id: string; type: string; name: string; content: string; proxied: boolean; ttl: number }
  >;
  requests: RecordedRequest[];
}

const ROOT = resolve(__dirname, "..");
const PROJECT = "ryanhenderson-dev";
const APEX = "ryanhenderson.dev";
const WWW = `www.${APEX}`;

let server: Server;
let port: number;
let state: MockState;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody) => {
    let chunks = "";
    req.on("data", (c) => (chunks += c));
    req.on("end", () => resolveBody(chunks));
  });
}

function envelope<T>(result: T) {
  return { success: true, errors: [], messages: [], result };
}

function freshBaseline(): MockState {
  return {
    project: {
      name: PROJECT,
      subdomain: `${PROJECT}.pages.dev`,
      domains: [APEX, WWW],
    },
    domains: [
      { name: APEX, status: "active" },
      { name: WWW, status: "active" },
    ],
    dnsRecords: new Map([
      [
        APEX,
        {
          id: "rec-apex",
          type: "CNAME",
          name: APEX,
          content: `${PROJECT}.pages.dev`,
          proxied: true,
          ttl: 1,
        },
      ],
      [
        WWW,
        {
          id: "rec-www",
          type: "CNAME",
          name: WWW,
          content: APEX,
          proxied: true,
          ttl: 1,
        },
      ],
    ]),
    requests: [],
  };
}

function startServer(): Promise<void> {
  return new Promise((res) => {
    server = createServer(async (req, response) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      const path = url.pathname + (url.search ? url.search : "");
      const method = req.method ?? "GET";
      const raw = await readBody(req);
      const body = raw.length ? safeJson(raw) : undefined;
      state.requests.push({ method, path, body });

      // Auth check — reject if no bearer token.
      const auth = req.headers["authorization"];
      if (!auth || !auth.startsWith("Bearer ")) {
        response.statusCode = 401;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({ success: false, errors: [{ code: 10000, message: "no auth" }], messages: [], result: null }),
        );
        return;
      }

      // Pages project
      if (
        method === "GET" &&
        url.pathname.match(/^\/accounts\/[^/]+\/pages\/projects\/[^/]+$/)
      ) {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(envelope(state.project)));
        return;
      }

      // Pages domains list
      if (
        method === "GET" &&
        url.pathname.match(/^\/accounts\/[^/]+\/pages\/projects\/[^/]+\/domains$/)
      ) {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(envelope(state.domains)));
        return;
      }

      // Pages domain bind (POST) — should NOT happen during a noop test
      if (
        method === "POST" &&
        url.pathname.match(/^\/accounts\/[^/]+\/pages\/projects\/[^/]+\/domains$/)
      ) {
        const b = body as { name: string };
        state.domains.push({ name: b.name, status: "pending" });
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(envelope({ name: b.name, status: "pending" })));
        return;
      }

      // DNS list by name (GET ?name=…)
      if (
        method === "GET" &&
        url.pathname.match(/^\/zones\/[^/]+\/dns_records$/)
      ) {
        const wanted = url.searchParams.get("name");
        const all = Array.from(state.dnsRecords.values());
        const matching = wanted ? all.filter((r) => r.name === wanted) : all;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(envelope(matching)));
        return;
      }

      // DNS record create (POST)
      if (
        method === "POST" &&
        url.pathname.match(/^\/zones\/[^/]+\/dns_records$/)
      ) {
        const b = body as { name: string; type: string; content: string; proxied: boolean };
        const id = `rec-${b.name}`;
        const rec = { id, ...b, ttl: 1 };
        state.dnsRecords.set(b.name, rec);
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(envelope(rec)));
        return;
      }

      // DNS record patch (PATCH)
      if (
        method === "PATCH" &&
        url.pathname.match(/^\/zones\/[^/]+\/dns_records\/[^/]+$/)
      ) {
        const id = url.pathname.split("/").pop() ?? "";
        const existing = Array.from(state.dnsRecords.values()).find((r) => r.id === id);
        if (existing) {
          const b = body as Record<string, unknown>;
          Object.assign(existing, b);
        }
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(envelope(existing ?? {})));
        return;
      }

      response.statusCode = 404;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          success: false,
          errors: [{ code: 7003, message: `unhandled: ${method} ${path}` }],
          messages: [],
          result: null,
        }),
      );
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("no address");
      port = addr.port;
      res();
    });
  });
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function runProvision(): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
  writeRequests: RecordedRequest[];
}> {
  const before = state.requests.length;
  // Use async spawn — spawnSync blocks the event loop and the in-process
  // mock HTTP server stops responding, so the child hangs on fetch().
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "scripts/provision-cf.ts"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        CF_API_BASE: `http://127.0.0.1:${port}`,
        CF_API_TOKEN: "test-token",
        CF_ACCOUNT_ID: "acct-test",
        CF_ZONE_ID: "zone-test",
        CF_PAGES_PROJECT: PROJECT,
        CF_APEX_DOMAIN: APEX,
        CF_WWW_HOSTNAME: WWW,
      },
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stderr.on("data", (d) => (stderr += d));

  const status: number | null = await new Promise((res) => {
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      res(null);
    }, 15_000);
    child.on("close", (code) => {
      clearTimeout(t);
      res(code);
    });
  });
  const newRequests = state.requests.slice(before);
  const writeRequests = newRequests.filter(
    (r) => r.method === "POST" || r.method === "PATCH" || r.method === "PUT",
  );
  return { status, stdout, stderr, writeRequests };
}

beforeAll(async () => {
  await startServer();
});

afterAll(() => {
  server.close();
});

describe("IV-5 / C-14 — provision-cf.ts is idempotent", () => {
  test("first run against baseline-good state issues zero writes", async () => {
    state = freshBaseline();
    const r = await runProvision();
    expect(r.status, `provision-cf failed: ${r.stderr}`).toBe(0);
    expect(
      r.writeRequests,
      `expected zero writes on first run against baseline state, got ${JSON.stringify(r.writeRequests)}`,
    ).toEqual([]);
    expect(r.stdout).toMatch(/no changes \(idempotent no-op\)/);
  }, 30_000);

  test("second run is also a no-op (zero writes)", async () => {
    state = freshBaseline();
    const r1 = await runProvision();
    expect(r1.status).toBe(0);
    const r2 = await runProvision();
    expect(r2.status).toBe(0);
    expect(
      r2.writeRequests,
      `expected zero writes on second run, got ${JSON.stringify(r2.writeRequests)}`,
    ).toEqual([]);
  }, 30_000);

  test("starting from drift (missing www DNS), first run creates it; second run is no-op", async () => {
    state = freshBaseline();
    state.dnsRecords.delete(WWW);

    const r1 = await runProvision();
    expect(r1.status).toBe(0);
    expect(
      r1.writeRequests.some(
        (w) => w.method === "POST" && w.path.includes("/dns_records"),
      ),
    ).toBe(true);

    const r2 = await runProvision();
    expect(r2.status).toBe(0);
    expect(
      r2.writeRequests,
      `second run after self-heal must be a no-op, got ${JSON.stringify(r2.writeRequests)}`,
    ).toEqual([]);
  }, 30_000);
});
