// Node-directory staleness sweep (run monthly by
// .github/workflows/staleness-sweep.yml; needs the `gh` CLI and GH_TOKEN).
// Operational hygiene, not a protocol event — nothing on the wire depends on
// the directory, so partners of a delisted node notice nothing.
//
// For each entry in registry/nodes.json, fetch the domain's live well-known
// document. Consecutive-failure state lives in labelled GitHub issues, not in
// the repo:
//   - first failing sweep  → open a `staleness-sweep` issue for the domain;
//   - failing again with that issue >= 25 days old (i.e. a second consecutive
//     monthly sweep, ~60 days unreachable in total) → open a delisting PR for
//     maintainer review — removal, not tombstoning; history stays in git;
//   - healthy again → close the issue. Re-listing later is the normal flow.
// No-op while the directory is empty.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nodesPath = join(root, "registry", "nodes.json");
const LABEL = "staleness-sweep";
const SECOND_STRIKE_MIN_AGE_DAYS = 25; // guards against back-to-back manual runs counting as two months

const registry = JSON.parse(readFileSync(nodesPath, "utf8"));
if (registry.nodes.length === 0) {
  console.log("ok    node directory is empty — nothing to sweep");
  process.exit(0);
}

const gh = (...args) => execFileSync("gh", args, { cwd: root, encoding: "utf8" }).trim();
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const issueTitle = (domain) => `[Staleness] ${domain}: well-known document unreachable`;
const openIssues = JSON.parse(
  gh("issue", "list", "--label", LABEL, "--state", "open", "--json", "number,title,createdAt", "--limit", "200"),
);
const issueFor = (domain) => openIssues.find((i) => i.title === issueTitle(domain));

async function fetchWellKnown(domain) {
  const res = await fetch(`https://${domain}/.well-known/openyacht`, {
    signal: AbortSignal.timeout(30_000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const doc = await res.json();
  if (typeof doc.openyacht !== "string" || !Array.isArray(doc.keys) || doc.keys.length === 0) {
    throw new Error("response is not a well-known document (missing openyacht/keys)");
  }
}

function bumpVersion(current) {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (current.startsWith(`${ym}.`)) return `${ym}.${Number(current.slice(ym.length + 1)) + 1}`;
  return `${ym}.0`;
}

function openDelistingPr(domain, issueNumber) {
  const branch = `staleness-delist/${domain}`;
  const existing = gh("pr", "list", "--head", branch, "--state", "open", "--json", "number");
  if (JSON.parse(existing).length > 0) {
    console.log(`skip  ${domain}: delisting PR already open (${branch})`);
    return;
  }
  const base = git("rev-parse", "--abbrev-ref", "HEAD");
  const fresh = JSON.parse(readFileSync(nodesPath, "utf8"));
  fresh.nodes = fresh.nodes.filter((e) => e.domain !== domain);
  fresh.version = bumpVersion(fresh.version);
  git("checkout", "-b", branch);
  try {
    writeFileSync(nodesPath, JSON.stringify(fresh, null, "\t") + "\n");
    git("add", "registry/nodes.json");
    git("-c", "user.name=github-actions[bot]",
      "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
      "commit", "-m", `Delist ${domain}: well-known unreachable for two consecutive monthly sweeps`);
    git("push", "-u", "origin", branch);
    gh("pr", "create", "--head", branch,
      "--title", `Delist ${domain} from the node directory (staleness)`,
      "--body",
      `Automated staleness sweep: \`https://${domain}/.well-known/openyacht\` has failed two consecutive ` +
      `monthly sweeps (#${issueNumber}). This PR removes the entry — removal, not tombstoning; history stays ` +
      `in git, and nothing on the wire depends on the directory, so partners of the node notice nothing.\n\n` +
      `**Maintainer review**: merge if the node is really gone; close if this is a known outage. ` +
      `The operator can re-list at any time via the normal signed-request flow.`);
    console.log(`ok    ${domain}: opened delisting PR (${branch})`);
  } finally {
    git("checkout", base);
  }
}

let failures = 0;
for (const { domain } of registry.nodes) {
  const issue = issueFor(domain);
  try {
    await fetchWellKnown(domain);
    if (issue) {
      gh("issue", "close", String(issue.number), "--comment",
        `Sweep: \`https://${domain}/.well-known/openyacht\` is reachable again — closing.`);
      console.log(`ok    ${domain}: recovered, closed #${issue.number}`);
    } else {
      console.log(`ok    ${domain}: well-known reachable`);
    }
  } catch (e) {
    failures++;
    if (!issue) {
      gh("issue", "create", "--label", LABEL,
        "--title", issueTitle(domain),
        "--body",
        `The monthly staleness sweep could not fetch \`https://${domain}/.well-known/openyacht\`: ${e.message}\n\n` +
        `No action needed yet — this issue is the first-strike marker. If the domain is still failing at the ` +
        `next monthly sweep, a delisting PR will be opened for maintainer review. It closes automatically if ` +
        `the domain recovers.`);
      console.log(`warn  ${domain}: unreachable (${e.message}) — opened first-strike issue`);
    } else {
      const ageDays = (Date.now() - Date.parse(issue.createdAt)) / 86_400_000;
      if (ageDays >= SECOND_STRIKE_MIN_AGE_DAYS) {
        console.log(`warn  ${domain}: unreachable for a second consecutive sweep (#${issue.number}, ${ageDays.toFixed(0)} days)`);
        openDelistingPr(domain, issue.number);
      } else {
        gh("issue", "comment", String(issue.number), "--body",
          `Sweep: still unreachable (${e.message}) — but this run is under ${SECOND_STRIKE_MIN_AGE_DAYS} days ` +
          `since the first strike, so it does not count as a second monthly failure.`);
        console.log(`warn  ${domain}: still unreachable, first strike too recent to escalate`);
      }
    }
  }
}
console.log(`ok    sweep complete: ${registry.nodes.length} listed, ${failures} unreachable`);
