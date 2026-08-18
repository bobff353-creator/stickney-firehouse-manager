import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  ALLOWED_MIME_TYPES,
  assetCategoryLabel,
  isAllowedMimeType,
  isValidAssetSize,
  safeFilename,
  sortAssetsForDisplay,
  verifyFileSignature,
} from "../app/preplans/assets.ts";

test("only JPG, PNG, WebP, and PDF are allowed — no HTML/SVG or executable types", () => {
  assert.deepEqual([...ALLOWED_MIME_TYPES], ["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  assert.equal(isAllowedMimeType("image/jpeg"), true);
  assert.equal(isAllowedMimeType("application/pdf"), true);
  assert.equal(isAllowedMimeType("text/html"), false);
  assert.equal(isAllowedMimeType("image/svg+xml"), false);
  assert.equal(isAllowedMimeType("application/x-msdownload"), false);
});

test("file size validation rejects zero, negative, and oversized files", () => {
  assert.equal(isValidAssetSize(1024), true);
  assert.equal(isValidAssetSize(0), false);
  assert.equal(isValidAssetSize(-5), false);
  assert.equal(isValidAssetSize(21 * 1024 * 1024), false, "over the 20 MB cap");
  assert.equal(isValidAssetSize(20 * 1024 * 1024), true, "exactly at the cap is fine");
});

test("verifyFileSignature checks actual magic bytes, not the declared MIME type alone", () => {
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
  const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(verifyFileSignature("image/jpeg", jpegBytes), true);
  assert.equal(verifyFileSignature("image/png", pngBytes), true);
  assert.equal(verifyFileSignature("application/pdf", pdfBytes), true);
  assert.equal(verifyFileSignature("image/webp", webpBytes), true);
});

test("a renamed executable claiming to be a JPG fails signature verification even though the extension/MIME looks right", () => {
  const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ header
  assert.equal(verifyFileSignature("image/jpeg", exeBytes), false);
  assert.equal(verifyFileSignature("application/pdf", exeBytes), false);
});

test("verifyFileSignature rejects a MIME type outside the allowlist outright", () => {
  assert.equal(verifyFileSignature("text/html", new Uint8Array([0x3c, 0x68, 0x74, 0x6d])), false);
});

test("safeFilename strips path separators and unsafe characters so a stored key can't escape its prefix", () => {
  assert.equal(safeFilename("../../etc/passwd"), "passwd");
  assert.equal(safeFilename("C:\\Users\\evil\\payload.pdf"), "payload.pdf");
  assert.equal(safeFilename("Sprinkler Plan (2026).pdf"), "Sprinkler Plan _2026_.pdf");
  assert.equal(safeFilename(""), "attachment");
  assert.equal(safeFilename("<script>.pdf"), "_script_.pdf");
});

test("category labels are human readable", () => {
  assert.equal(assetCategoryLabel("sds"), "SDS");
  assert.equal(assetCategoryLabel("interior_floor_plan"), "Interior Floor Plan");
});

test("pinned attachments sort ahead of unpinned ones, then by sort order", () => {
  const assets = [
    { pinToRespond: false, sortOrder: 0 },
    { pinToRespond: true, sortOrder: 2 },
    { pinToRespond: true, sortOrder: 1 },
  ];
  const sorted = sortAssetsForDisplay(assets);
  assert.deepEqual(sorted, [
    { pinToRespond: true, sortOrder: 1 },
    { pinToRespond: true, sortOrder: 2 },
    { pinToRespond: false, sortOrder: 0 },
  ]);
});

test("bootstrap creates field_preplan_assets linked to preplan/feature/hazmat/level with no public object key exposure", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_assets/);
  assert.match(bootstrap, /feature_id TEXT REFERENCES field_preplan_features\(id\)/);
  assert.match(bootstrap, /hazmat_id TEXT REFERENCES field_preplan_hazmat\(id\)/);
  assert.match(bootstrap, /object_key TEXT NOT NULL/);
});

test("the attachment API never selects object_key into a client-facing response", async () => {
  const listApi = await readFile(new URL("../app/api/field-preplans/route.ts", import.meta.url), "utf8");
  assert.equal(/SELECT[^;]*object_key[^;]*field_preplan_assets/s.test(listApi), false, "the list endpoint must not expose the private storage key");
  assert.match(listApi, /url:`\/api\/field-preplans\/attachments\/\$\{/);
});

test("the attachment upload route verifies the file signature server-side before storing it", async () => {
  const uploadApi = await readFile(new URL("../app/api/field-preplans/attachments/route.ts", import.meta.url), "utf8");
  assert.match(uploadApi, /verifyFileSignature/);
  assert.match(uploadApi, /isAllowedMimeType/);
  assert.match(uploadApi, /manage_attachments/);
});

test("the attachment download route requires view permission and sets safe response headers", async () => {
  const downloadApi = await readFile(new URL("../app/api/field-preplans/attachments/[assetId]/route.ts", import.meta.url), "utf8");
  assert.match(downloadApi, /hasPermission\(request, db, "field_preplans\.view"\)/);
  assert.match(downloadApi, /x-content-type-options/);
  assert.match(downloadApi, /content-disposition/);
  // Deleting an attachment must clean up the storage object, not just the row.
  assert.match(downloadApi, /BUCKET\?\.delete/);
});
