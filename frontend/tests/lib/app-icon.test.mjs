import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const frontend = new URL('../../', import.meta.url);
const root = new URL('../', frontend);
const icons = new URL('src-tauri/icons/', frontend);

const pngSize = (file) => [file.readUInt32BE(16), file.readUInt32BE(20)];
const digest = (file) => createHash('sha256').update(file).digest('hex');

test('Signal Orange icon assets match the configured desktop packaging contract', async () => {
  const requiredPngs = [
    ['icon.png', 512],
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
  ];
  const [config, macConfig, infoPlist, compileScript, adaptiveIcon, adaptiveBackground, adaptiveMark, svg, ...files] = await Promise.all([
    readFile(new URL('src-tauri/tauri.conf.json', frontend), 'utf8'),
    readFile(new URL('src-tauri/tauri.macos.conf.json', frontend), 'utf8'),
    readFile(new URL('src-tauri/Info.plist', frontend), 'utf8'),
    readFile(new URL('scripts/compile-macos-icon.mjs', frontend), 'utf8'),
    readFile(new URL('MeetilyImproved.icon/icon.json', icons), 'utf8'),
    readFile(new URL('MeetilyImproved.icon/Assets/01-background.svg', icons), 'utf8'),
    readFile(new URL('MeetilyImproved.icon/Assets/02-mark.svg', icons), 'utf8'),
    readFile(new URL('meetily-improved-icon.svg', icons), 'utf8'),
    ...requiredPngs.map(([name]) => readFile(new URL(name, icons))),
  ]);

  assert.match(config, /"icons\/icon\.png"/);
  assert.match(config, /"icons\/app_icon\.icns"/);
  assert.match(config, /"icons\/app_icon\.ico"/);
  assert.match(macConfig, /compile-macos-icon\.mjs/);
  assert.match(macConfig, /\.generated-adaptive-icon\/MeetilyImproved\.icns/);
  assert.match(macConfig, /"Resources\/Assets\.car"/);
  assert.match(infoPlist, /<key>CFBundleIconName<\/key>\s*<string>MeetilyImproved<\/string>/);
  assert.match(infoPlist, /<key>CFBundleExecutable<\/key>\s*<string>hush<\/string>/);
  assert.match(compileScript, /--app-icon', 'MeetilyImproved'/);
  assert.match(compileScript, /requires Xcode 26 or newer/);
  assert.match(adaptiveIcon, /"appearance": "light"/);
  assert.match(adaptiveIcon, /"appearance": "dark"/);
  assert.match(adaptiveIcon, /"glass": false/g);
  assert.match(adaptiveIcon, /extended-srgb:0\.94118,0\.41569,0\.16471,1\.00000/);
  assert.match(adaptiveIcon, /extended-srgb:0\.09020,0\.09020,0\.10196,1\.00000/);
  assert.match(adaptiveBackground, /#FFFFFF/);
  assert.match(adaptiveMark, /#FFFFFF/);
  assert.match(svg, /#F06A2A/);
  assert.match(svg, /#17171A/);
  assert.doesNotMatch(svg, /linearGradient|radialGradient|#E92C78/i);
  assert.equal(digest(Buffer.from(svg)), '8610a87b68597e9833a43cd0d6b9b0a9809396b41bcc67e08ba71377094288a2');

  for (const [index, [, size]] of requiredPngs.entries()) {
    assert.deepEqual(pngSize(files[index]), [size, size]);
  }

  const [icns, ico, publicIcon, sourceIcon] = await Promise.all([
    stat(new URL('app_icon.icns', icons)),
    stat(new URL('app_icon.ico', icons)),
    readFile(new URL('frontend/public/icon_128x128.png', root)),
    readFile(new URL('icon_128x128.png', icons)),
  ]);
  assert.ok(icns.size > 0);
  assert.ok(ico.size > 0);
  assert.equal(digest(await readFile(new URL('icon.png', icons))), 'ea82c1a1da5f9de2a2f73bdf39896629ba7ae0c5895626f3ec12b3d6c9de3227');
  assert.equal(digest(await readFile(new URL('app_icon.icns', icons))), '5ca4c628d6264ec0e727d518b1ab42b4ddd1dc28a2f4e2d7929f62130737c2f3');
  assert.equal(digest(publicIcon), digest(sourceIcon));
});
