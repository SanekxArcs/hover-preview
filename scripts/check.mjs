import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  await readFile(path.join(root, "manifest.json"), "utf8"),
);
const metadata = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, metadata.version);
assert.deepEqual(manifest.permissions, ["storage"]);
assert.equal(manifest.declarative_net_request, undefined);

const assets = [manifest.action.default_popup, "popup.css", "icons/logo.svg"];
for (const contentScript of manifest.content_scripts)
  assets.push(...contentScript.js);
for (const [size, icon] of Object.entries(manifest.icons)) {
  assets.push(icon);
  const bytes = await readFile(path.join(root, icon));
  assert.equal(
    bytes.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    `${icon}: expected PNG`,
  );
  assert.equal(bytes.readUInt32BE(16), Number(size), `${icon}: wrong width`);
  assert.equal(bytes.readUInt32BE(20), Number(size), `${icon}: wrong height`);
}
for (const asset of assets) await access(path.join(root, asset));
for (const script of [
  "settings.js",
  "popup.js",
  "content.js",
  "scripts/check.mjs",
  "scripts/package.mjs",
]) {
  const result = spawnSync(
    process.execPath,
    ["--check", path.join(root, script)],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
}
console.log(
  `Validated Manifest V3, version ${manifest.version}, permissions, ${new Set(assets).size} assets, PNG sizes, and JavaScript syntax.`,
);
