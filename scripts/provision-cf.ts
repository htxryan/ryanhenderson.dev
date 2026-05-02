#!/usr/bin/env -S node --experimental-strip-types
/**
 * E9 — Idempotent Cloudflare provisioning script (contract C-14).
 *
 * Brings the production hosting + DNS state to a known-good shape:
 *
 *   1. Ensure the CF Pages project named `${CF_PAGES_PROJECT}` exists.
 *   2. Bind the apex (`ryanhenderson.dev`) and the `www.` hostname as
 *      custom domains on that project.
 *   3. Upsert the apex DNS record (CNAME → `${project}.pages.dev`,
 *      proxied) and the `www.` DNS record (CNAME → apex, proxied).
 *
 * Idempotent: a second invocation against an already-good state issues
 * zero `POST` / `PATCH` calls (only `GET`s for the existence probes).
 *
 * Token scope contract (advisory P1 #2 — non-negotiable):
 *   • Zone:DNS:Edit  for the `${CF_APEX_DOMAIN}` zone ONLY
 *   • Account:Cloudflare Pages:Edit  for the `${CF_PAGES_PROJECT}` project ONLY
 *
 * Refuse-to-overwrite policy: the script NEVER deletes a DNS record. If a
 * pre-existing record at the target name has content that conflicts with
 * what we'd write, exit code 4 — the operator resolves the collision in
 * the dashboard.
 *
 * Exit codes:
 *   0  OK — desired state present (no-op or successful apply)
 *   1  Generic error (network, unexpected response shape)
 *   2  Token missing/expired/insufficient scope
 *   3  Zone or account not found / not visible to this token
 *   4  DNS record collision (existing record content disagrees with desired)
 *
 * Usage:
 *   pnpm provision:cf                # apply
 *   pnpm provision:cf -- --dry-run   # plan only, no writes
 *
 * The `--experimental-strip-types` shebang requires Node ≥22.6 (project
 * pins ≥22.18 in package.json#engines).
 */

// Base URL is overridable via env so the IV idempotency test can point
// the script at a local mock server. Production keeps the CF default.
const API = process.env.CF_API_BASE ?? "https://api.cloudflare.com/client/v4";

interface CfEnvelope<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  messages: unknown[];
  result: T;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

interface PagesProject {
  name: string;
  subdomain: string; // `<name>.pages.dev`
  domains: string[];
}

interface PagesDomain {
  name: string;
  status: string;
}

const DRY = process.argv.includes("--dry-run");

function die(code: number, msg: string): never {
  console.error(`[provision-cf] ${msg}`);
  process.exit(code);
}

function need(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    die(2, `missing required env var: ${name} (see .env.example)`);
  }
  return v;
}

function opt(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

const TOKEN = need("CF_API_TOKEN");
const ACCOUNT = need("CF_ACCOUNT_ID");
const ZONE = need("CF_ZONE_ID");
const PROJECT = opt("CF_PAGES_PROJECT", "ryanhenderson-dev");
const APEX = opt("CF_APEX_DOMAIN", "ryanhenderson.dev");
const WWW = opt("CF_WWW_HOSTNAME", `www.${APEX}`);

async function api<T>(
  method: "GET" | "POST" | "PATCH" | "PUT",
  path: string,
  body?: unknown,
): Promise<{ status: number; envelope: CfEnvelope<T> }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Auth failures should map to exit code 2 regardless of which endpoint
  // was hit, so callers can rely on the exit-code contract above.
  if (res.status === 401 || res.status === 403) {
    let detail = "";
    try {
      const j = (await res.json()) as CfEnvelope<unknown>;
      detail = j.errors?.map((e) => `${e.code}:${e.message}`).join(", ") ?? "";
    } catch {
      /* ignore */
    }
    die(2, `auth failed (HTTP ${res.status}): ${detail || "check CF_API_TOKEN scope"}`);
  }
  let envelope: CfEnvelope<T>;
  try {
    envelope = (await res.json()) as CfEnvelope<T>;
  } catch (e) {
    die(1, `non-JSON response from ${method} ${path} (HTTP ${res.status})`);
  }
  return { status: res.status, envelope };
}

function fail(envelope: CfEnvelope<unknown>, label: string): never {
  const msg = envelope.errors
    .map((e) => `${e.code}:${e.message}`)
    .join(", ");
  die(1, `${label} failed: ${msg || "no error detail"}`);
}

// --- Pages project --------------------------------------------------------

async function ensurePagesProject(): Promise<PagesProject> {
  const { status, envelope } = await api<PagesProject>(
    "GET",
    `/accounts/${ACCOUNT}/pages/projects/${PROJECT}`,
  );
  if (status === 404) {
    die(
      3,
      `CF Pages project '${PROJECT}' not found in account ${ACCOUNT}.\n` +
        `  Create it once via the dashboard (it requires a Git connection),\n` +
        `  then re-run this script. The script's job is to bind domains and\n` +
        `  records — not to create the project.`,
    );
  }
  if (!envelope.success) fail(envelope, `lookup pages project ${PROJECT}`);
  return envelope.result;
}

async function ensureCustomDomain(hostname: string): Promise<"created" | "ok"> {
  const list = await api<PagesDomain[]>(
    "GET",
    `/accounts/${ACCOUNT}/pages/projects/${PROJECT}/domains`,
  );
  if (!list.envelope.success) fail(list.envelope, `list pages domains`);
  const existing = list.envelope.result.find((d) => d.name === hostname);
  if (existing) return "ok";
  if (DRY) {
    console.log(`  + would bind custom domain ${hostname} -> ${PROJECT}`);
    return "created";
  }
  const post = await api<PagesDomain>(
    "POST",
    `/accounts/${ACCOUNT}/pages/projects/${PROJECT}/domains`,
    { name: hostname },
  );
  if (!post.envelope.success) fail(post.envelope, `bind domain ${hostname}`);
  return "created";
}

// --- DNS upsert -----------------------------------------------------------

async function listRecordsByName(name: string): Promise<DnsRecord[]> {
  const q = new URLSearchParams({ name });
  const r = await api<DnsRecord[]>("GET", `/zones/${ZONE}/dns_records?${q.toString()}`);
  if (r.status === 404) die(3, `zone ${ZONE} not found / not visible to this token`);
  if (!r.envelope.success) fail(r.envelope, `list dns records for ${name}`);
  return r.envelope.result;
}

async function upsertRecord(opts: {
  name: string;
  content: string;
  type: "CNAME";
  proxied: boolean;
}): Promise<"created" | "updated" | "ok"> {
  const existing = await listRecordsByName(opts.name);

  // Multiple non-CNAME records at the same name OR a CNAME pointing
  // somewhere else: refuse to touch — operator must resolve manually.
  // CNAME RRset rules forbid a CNAME coexisting with any other record at
  // the same owner name, so the only safe upsert path is "exactly one
  // existing CNAME with the same content" (no-op) or "exactly one existing
  // CNAME with the wrong content" (PATCH to fix).
  if (existing.length > 1) {
    die(
      4,
      `record collision at ${opts.name}: ${existing.length} existing records.\n` +
        `  This script will not delete records — resolve in the CF dashboard\n` +
        `  and re-run.`,
    );
  }
  if (existing.length === 1) {
    const e = existing[0];
    if (e.type !== "CNAME") {
      die(
        4,
        `record collision at ${opts.name}: existing type ${e.type} (want CNAME).\n` +
          `  Refusing to convert; resolve in the dashboard and re-run.`,
      );
    }
    const sameContent = e.content.toLowerCase() === opts.content.toLowerCase();
    const sameProxy = e.proxied === opts.proxied;
    if (sameContent && sameProxy) return "ok";
    if (DRY) {
      console.log(
        `  ~ would PATCH ${opts.name} -> ${opts.content} (proxied=${opts.proxied})`,
      );
      return "updated";
    }
    const patch = await api<DnsRecord>(
      "PATCH",
      `/zones/${ZONE}/dns_records/${e.id}`,
      {
        type: opts.type,
        name: opts.name,
        content: opts.content,
        proxied: opts.proxied,
        ttl: 1, // 1 = "automatic" per CF API
      },
    );
    if (!patch.envelope.success) fail(patch.envelope, `patch ${opts.name}`);
    return "updated";
  }

  if (DRY) {
    console.log(
      `  + would POST ${opts.name} CNAME -> ${opts.content} (proxied=${opts.proxied})`,
    );
    return "created";
  }
  const post = await api<DnsRecord>("POST", `/zones/${ZONE}/dns_records`, {
    type: opts.type,
    name: opts.name,
    content: opts.content,
    proxied: opts.proxied,
    ttl: 1,
  });
  if (!post.envelope.success) fail(post.envelope, `create ${opts.name}`);
  return "created";
}

// --- Main -----------------------------------------------------------------

async function main(): Promise<void> {
  console.log(
    `[provision-cf]${DRY ? " (dry-run)" : ""} target: project=${PROJECT}, ` +
      `apex=${APEX}, www=${WWW}, account=${ACCOUNT.slice(0, 6)}…, ` +
      `zone=${ZONE.slice(0, 6)}…`,
  );

  // 1. Pages project
  const project = await ensurePagesProject();
  console.log(`  ✓ pages project: ${project.name} (subdomain=${project.subdomain})`);

  // 2. Custom domains — capture results so the final summary reflects
  //    whether a domain was newly bound (otherwise a fresh-bind run with
  //    pre-existing DNS would mis-report as "no changes").
  const domainResults: ("created" | "ok")[] = [];
  for (const host of [APEX, WWW]) {
    const r = await ensureCustomDomain(host);
    domainResults.push(r);
    console.log(`  ${r === "ok" ? "✓" : "+"} domain bound: ${host}${r === "ok" ? " (already)" : ""}`);
  }

  // 3. DNS records — apex CNAME (CF supports CNAME flattening at apex when
  //    the record is proxied) -> <project>.pages.dev; www CNAME -> apex.
  const apexResult = await upsertRecord({
    name: APEX,
    type: "CNAME",
    content: project.subdomain,
    proxied: true,
  });
  console.log(`  ${apexResult === "ok" ? "✓" : apexResult === "updated" ? "~" : "+"} ${APEX} CNAME -> ${project.subdomain} ${apexResult === "ok" ? "(already)" : `(${apexResult})`}`);

  const wwwResult = await upsertRecord({
    name: WWW,
    type: "CNAME",
    content: APEX,
    proxied: true,
  });
  console.log(`  ${wwwResult === "ok" ? "✓" : wwwResult === "updated" ? "~" : "+"} ${WWW} CNAME -> ${APEX} ${wwwResult === "ok" ? "(already)" : `(${wwwResult})`}`);

  const wrote =
    apexResult !== "ok" ||
    wwwResult !== "ok" ||
    domainResults.some((r) => r !== "ok");
  console.log(
    `[provision-cf] done${DRY ? " (dry-run)" : ""}; ${wrote ? "changes applied" : "no changes (idempotent no-op)"}.`,
  );
}

main().catch((e) => {
  // Any unhandled rejection that escapes the structured exit-code paths
  // above lands here. Route through die() so the `[provision-cf]` prefix
  // is consistent with every other error path in CI logs.
  die(1, `unexpected error: ${e?.message ?? e}`);
});
