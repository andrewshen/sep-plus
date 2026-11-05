// Checks the manifests the build actually ships (dist/chrome, dist/firefox).
// CRXJS rewrites manifest.config.ts, so src/manifest.test.ts can't see these.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function readManifest(dir) {
  const path = join(dir, 'manifest.json');
  assert.ok(existsSync(path), `${path} is missing; run the build first`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertFilesExist(dir, files) {
  for (const file of files) {
    assert.ok(existsSync(join(dir, file)), `${dir}: ${file} is referenced but not built`);
  }
}

function checkCommon(dir, manifest) {
  assert.equal(manifest.manifest_version, 3, `${dir}: manifest_version`);
  const [content] = manifest.content_scripts ?? [];
  assert.ok(content, `${dir}: no content script`);
  assert.equal(content.run_at, 'document_start', `${dir}: content script run_at`);
  // boot.css hides the page before first paint and holds its failsafe reveal,
  // so it has to apply before anything else.
  assert.equal(content.css?.[0], 'src/host/boot.css', `${dir}: boot.css must be first`);

  assertFilesExist(dir, [
    ...content.js,
    ...content.css,
    ...Object.values(manifest.icons ?? {}),
    ...(manifest.declarative_net_request?.rule_resources ?? []).map((rule) => rule.path),
    ...(manifest.web_accessible_resources ?? []).flatMap((entry) => entry.resources),
  ]);
}

const chromeDir = 'dist/chrome';
const chrome = readManifest(chromeDir);
checkCommon(chromeDir, chrome);
assert.equal(typeof chrome.background?.service_worker, 'string', 'chrome: background.service_worker');
assert.equal(chrome.background.scripts, undefined, 'chrome: background.scripts');
assertFilesExist(chromeDir, [chrome.background.service_worker]);
assert.equal(chrome.browser_specific_settings, undefined, 'chrome: browser_specific_settings');

const firefoxDir = 'dist/firefox';
const firefox = readManifest(firefoxDir);
checkCommon(firefoxDir, firefox);
assert.ok(
  Array.isArray(firefox.background?.scripts) && firefox.background.scripts.length > 0,
  'firefox: background.scripts',
);
assert.equal(firefox.background.service_worker, undefined, 'firefox: background.service_worker');
assertFilesExist(firefoxDir, firefox.background.scripts);
const gecko = firefox.browser_specific_settings?.gecko;
assert.equal(typeof gecko?.id, 'string', 'firefox: gecko.id');
assert.ok(gecko.data_collection_permissions, 'firefox: gecko.data_collection_permissions');
for (const entry of firefox.web_accessible_resources ?? []) {
  assert.equal(entry.use_dynamic_url, undefined, 'firefox: use_dynamic_url is unsupported');
}

console.log('Built manifests look right.');
