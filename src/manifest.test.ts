import { describe, expect, it } from 'vitest';
import { createManifest, type TargetBrowser } from '../manifest.config';

type BuiltManifest = {
  background: unknown;
  browser_specific_settings?: {
    gecko: { id: string; strict_min_version: string };
    gecko_android: { strict_min_version: string };
  };
};

// defineManifest passes a plain object through unchanged.
function manifest(browser: TargetBrowser): BuiltManifest {
  return createManifest(browser) as unknown as BuiltManifest;
}

describe('createManifest', () => {
  it('keeps the Chrome manifest free of Firefox keys', () => {
    expect(manifest('chrome').background).toEqual({
      service_worker: 'src/background.ts',
      type: 'module',
    });
    expect(manifest('chrome').browser_specific_settings).toBeUndefined();
  });

  it('runs the Firefox background as an event page', () => {
    expect(manifest('firefox').background).toEqual({ scripts: ['src/background.ts'] });
  });

  // Changing the ID orphans every Firefox user's stored annotations.
  it('pins the Firefox add-on ID', () => {
    expect(manifest('firefox').browser_specific_settings?.gecko.id).toBe(
      'sep-plus@andrewshen.net',
    );
  });
});
