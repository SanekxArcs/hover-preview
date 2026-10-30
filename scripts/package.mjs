import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
execFileSync(process.execPath, [path.join(root, "scripts/check.mjs")], {
  stdio: "inherit",
});
const manifest = JSON.parse(
  await readFile(path.join(root, "manifest.json"), "utf8"),
);
const files = [
  "manifest.json",
  "settings.js",
  "content.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "icons/logo.svg",
  ...Object.values(manifest.icons),
];
const entries = [];
const directory = [];
let offset = 0;

const crc32 = (bytes) => {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit++)
      checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
  }
  return (checksum ^ 0xffffffff) >>> 0;
};

for (const file of files) {
  const data = await readFile(path.join(root, file));
  const name = Buffer.from(file);
  const checksum = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(33, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  entries.push(header, name, data);
  const record = Buffer.alloc(46);
  record.writeUInt32LE(0x02014b50, 0);
  record.writeUInt16LE(20, 4);
  record.writeUInt16LE(20, 6);
  record.writeUInt16LE(33, 14);
  record.writeUInt32LE(checksum, 16);
  record.writeUInt32LE(data.length, 20);
  record.writeUInt32LE(data.length, 24);
  record.writeUInt16LE(name.length, 28);
  record.writeUInt32LE(offset, 42);
  directory.push(record, name);
  offset += header.length + name.length + data.length;
}

const centralDirectory = Buffer.concat(directory);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(offset, 16);
await mkdir(path.join(root, "dist"), { recursive: true });
const destination = path.join(
  root,
  "dist",
  `hover-preview-${manifest.version}.zip`,
);
await writeFile(
  destination,
  Buffer.concat([...entries, centralDirectory, end]),
);
console.log(
  `Created ${destination} (${files.length} extension files; no metadata, docs, or development files).`,
);
