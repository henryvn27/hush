import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

test('menu bar visibility is persisted, native, and accessible', async () => {
  const [preferences, tray, lib] = await Promise.all([
    readFile(new URL('src/components/PreferenceSettings.tsx', root), 'utf8'),
    readFile(new URL('src-tauri/src/tray.rs', root), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', root), 'utf8'),
  ]);

  assert.match(preferences, /get_menu_bar_enabled/);
  assert.match(preferences, /set_menu_bar_enabled/);
  assert.match(preferences, /Show in menu bar/);
  assert.match(preferences, /aria-label="Show Hush in menu bar"/);
  assert.match(preferences, /role="alert"/);

  assert.match(tray, /APP_PREFERENCES_STORE: &str = "app-preferences\.json"/);
  assert.match(tray, /MENU_BAR_ENABLED_KEY: &str = "showInMenuBar"/);
  assert.match(tray, /cfg\(target_os = "macos"\)[\s\S]*default_menu_bar_enabled\(\) -> bool \{\s*false/);
  assert.match(tray, /tray\.set_visible\(enabled\)/);
  assert.match(tray, /else if enabled \{\s*create_tray\(&app\)/);

  assert.match(lib, /if tray::menu_bar_enabled\(_app\.handle\(\)\)/);
  assert.match(lib, /tray::get_menu_bar_enabled/);
  assert.match(lib, /tray::set_menu_bar_enabled/);
});
