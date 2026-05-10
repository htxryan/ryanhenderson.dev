---
title: DNS & token runbook — ryanhenderson.dev
epic: E9
contracts:
- C-14
ears:
- U-22
- U-23
- S-13
permalink: ryanhenderson.dev/runbooks/dns
---

# DNS & API token runbook

The `ryanhenderson.dev` zone and the `ryanhenderson-dev` Cloudflare Pages
project share a CF account. This document covers the API token used by
`scripts/provision-cf.ts`, the script's behaviour, and the token-rotation
flow (S-13).

## Token scope (non-negotiable — advisory P1 #2)

The CF API token used for provisioning MUST be scoped to exactly two
permissions, on exactly two resources:

| Permission | Resource scope |
|---|---|
| **Zone → DNS → Edit** | Zone: `ryanhenderson.dev` (this zone only) |
| **Account → Cloudflare Pages → Edit** | Account: the single account holding the project |

Plus the implicit Account → "Read" for token validation. Do NOT add:

- `Zone:Read` for "All zones" (the picker tries to default to this).
- `Account:Workers Scripts:Edit`, `Account:R2:Edit`, anything else.
- "User → Memberships → Read" or any user-level grant.

A leaked broad-scope token can rewrite DNS or deploy code to every site on
the account. A correctly-scoped token can only damage the one site this
repo describes — which is the entire point.

### Creating the token

1. CF dashboard → My Profile → API Tokens → Create Token → "Get started"
   from "Custom token".
2. Permissions:
   - **Zone** | **DNS** | **Edit**
   - **Account** | **Cloudflare Pages** | **Edit**
3. Zone Resources: **Include → Specific zone → `ryanhenderson.dev`**.
4. Account Resources: **Include → Specific account → `<account name>`**.
5. (Optional) Client IP filter: limit to your home/office IP.
6. (Optional) TTL: ~90 days. Rotation flow is below.
7. Continue → Create → copy the token ONCE. Paste into `.env.local`:

   ```
   CF_API_TOKEN=<paste here>
   ```

8. Verify scope before using it:

   ```bash
   curl -sS -H "Authorization: Bearer $CF_API_TOKEN" \
     https://api.cloudflare.com/client/v4/user/tokens/verify | jq .
   ```

   The response should list exactly the two permission groups above.

## Provisioning script (C-14)

`scripts/provision-cf.ts` brings DNS + custom-domain bindings to a
known-good shape. It is **idempotent** — a second invocation against an
already-good state issues zero `POST` / `PATCH` calls (only `GET`s for
existence probes).

### What it does, in order

1. `GET /accounts/$ACCOUNT/pages/projects/$PROJECT` — confirms the Pages
   project exists. The script does NOT create it (Pages projects need a
   Git connection that's nicer to set up in the dashboard).
2. `GET …/pages/projects/$PROJECT/domains` → if `ryanhenderson.dev` and
   `www.ryanhenderson.dev` aren't bound, `POST` to bind them.
3. `GET /zones/$ZONE/dns_records?name=ryanhenderson.dev` → upsert apex
   `CNAME` → `<project>.pages.dev`, proxied (CF flattens the apex CNAME).
4. Same for `www.ryanhenderson.dev` → apex.

### What it never does

- **Never deletes a record.** Destructive ops are out of scope. If a
  conflicting record exists, the script exits with code 4 and a message;
  the operator resolves the collision in the dashboard.
- **Never creates the Pages project.** Exit code 3 if the project is
  missing.
- **Never escalates a stale token.** Auth failures (401/403) exit with
  code 2 and a "check token scope" hint.

### Exit codes

| Code | Meaning | Common cause |
|---|---|---|
| `0` | OK — desired state present (no-op or successful apply) | Steady state. |
| `1` | Generic error (network, malformed response) | Transient — retry. |
| `2` | Token missing, expired, or insufficient scope | `.env.local` not loaded; token rotated; scope too narrow. |
| `3` | Zone or Pages project not found / not visible | Project not yet created; wrong `CF_ACCOUNT_ID` / `CF_ZONE_ID`; token doesn't include this resource. |
| `4` | DNS record collision (existing content disagrees with desired) | Manual record left from a previous host; resolve in dashboard. |

### Usage

```bash
# Dry run (planning only, no writes):
pnpm provision:cf -- --dry-run

# Apply:
pnpm provision:cf

# Re-run to confirm idempotence (should report "no changes"):
pnpm provision:cf
```

The two prefixes you'll see in apply output:

- `+` created (POST was issued)
- `~` updated (PATCH was issued — record existed but content drifted)
- `✓` already correct (no API write)

The runbook bar for "successfully provisioned" is the second-invocation
output ending with `no changes (idempotent no-op)`.

## Token rotation (S-13)

The deploy gate is `pnpm install --frozen-lockfile && pnpm build`. None
of those steps need a CF API token — only `provision-cf.ts` does. So
rotation is a workstation operation, not a deploy operation:

1. Create a new token following "Creating the token" above.
2. Update `.env.local`: replace `CF_API_TOKEN`.
3. Verify with the `tokens/verify` curl above.
4. Run `pnpm provision:cf` — should report no changes.
5. CF dashboard → My Profile → API Tokens → revoke the old token.

Rotation does NOT require a code change, a redeploy, or any change in CF
Pages settings. The `CF_WEB_ANALYTICS_TOKEN` (separate, lives in CF Pages
env vars) is rotated by editing the env var in the dashboard and
re-deploying the latest commit. There is no other long-lived secret.

## Manual setup (one-time, before the script can run)

1. Transfer the `ryanhenderson.dev` zone to Cloudflare DNS.
2. Create the CF Pages project `ryanhenderson-dev` with a Git connection
   to this repo (production branch `master`, build command per
   `deploy.md`).
3. Set the production env vars in the Pages dashboard:
   - `CF_WEB_ANALYTICS_TOKEN` (from CF Web Analytics → site → Snippet).
4. Create the scoped token; paste into local `.env.local`.
5. Run `pnpm provision:cf` to bind domains + write DNS records.
6. Verify in a browser: `https://ryanhenderson.dev/` resolves to the
   site, `https://www.ryanhenderson.dev/` redirects to apex (CF Pages
   does this automatically for the canonical custom domain).

After step 6, the script is rarely needed again — only after a custom
domain change or to confirm steady state.

## Related

- `docs/runbooks/deploy.md` — build pipeline + dashboard settings.
- `.env.example` — full env-var inventory.
- `scripts/provision-cf.ts` — implementation.