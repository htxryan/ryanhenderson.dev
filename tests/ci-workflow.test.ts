import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = resolve(__dirname, "..");

function read(path: string): string {
  return readFileSync(path, "utf-8");
}

function workflowJob(source: string, jobName: string): string {
  const startMarker = `\n  ${jobName}:\n`;
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Expected workflow job ${jobName}`);

  const rest = source.slice(start + 1);
  const nextJob = rest.slice(startMarker.length - 1).search(/\n  [A-Za-z0-9_-]+:\n/);
  if (nextJob === -1) return rest;
  return rest.slice(0, startMarker.length - 1 + nextJob);
}

describe("ci workflow", () => {
  const ci = read(join(ROOT, ".github", "workflows", "ci.yml"));

  test("Cloudflare deploy opts JavaScript actions into Node 24", () => {
    const deploy = workflowJob(ci, "deploy");
    expect(deploy).toMatch(/uses:\s*cloudflare\/wrangler-action@v3/);
    expect(deploy).toMatch(/FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*"?true"?/);
  });
});
