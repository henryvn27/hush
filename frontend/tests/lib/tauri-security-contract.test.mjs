import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const frontendRoot = new URL('../../', import.meta.url);
const sourceRoot = new URL('src/', frontendRoot);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) return sourceFiles(url);
    return /\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name) ? [url] : [];
  }));
  return nested.flat();
}

function scriptKind(url) {
  switch (extname(url.pathname)) {
    case '.tsx': return ts.ScriptKind.TSX;
    case '.jsx': return ts.ScriptKind.JSX;
    case '.js':
    case '.mjs': return ts.ScriptKind.JS;
    default: return ts.ScriptKind.TS;
  }
}

async function frontendCommandContract() {
  const files = await sourceFiles(sourceRoot);
  const commands = new Set();
  const dynamicInvocations = [];
  const modules = new Set();

  for (const url of files) {
    const source = await readFile(url, 'utf8');
    const sourceFile = ts.createSourceFile(
      url.pathname,
      source,
      ts.ScriptTarget.Latest,
      true,
      scriptKind(url),
    );
    const invokeAliases = new Set();

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      modules.add(statement.moduleSpecifier.text);
      if (statement.moduleSpecifier.text !== '@tauri-apps/api/core') continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const element of bindings.elements) {
        if ((element.propertyName?.text ?? element.name.text) === 'invoke') {
          invokeAliases.add(element.name.text);
        }
      }
    }

    const visit = (node) => {
      if (ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && invokeAliases.has(node.expression.text)) {
        const command = node.arguments[0];
        if (command && (ts.isStringLiteral(command) || ts.isNoSubstitutionTemplateLiteral(command))) {
          commands.add(command.text);
        } else {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          dynamicInvocations.push(`${url.pathname}:${line + 1}:${character + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return { commands, dynamicInvocations, modules };
}

function stringsInArray(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker}`);
  const assignment = source.indexOf('=', start);
  const open = source.indexOf('[', assignment);
  const close = source.indexOf(']', open);
  assert.ok(assignment > start && open > assignment && close > open, `invalid array after ${marker}`);
  return new Set([...source.slice(open + 1, close).matchAll(/"([a-z][a-z0-9_]*)"/g)]
    .map((match) => match[1]));
}

function registeredCommands(libSource) {
  const marker = '.invoke_handler(tauri::generate_handler![';
  const start = libSource.indexOf(marker);
  const end = libSource.indexOf('])', start);
  assert.ok(start >= 0 && end > start, 'Rust invoke handler registration must be present');
  return new Set([...libSource.slice(start + marker.length, end)
    .matchAll(/^\s*(?:[a-zA-Z_][a-zA-Z0-9_]*::)*([a-zA-Z_][a-zA-Z0-9_]*),\s*$/gm)]
    .map((match) => match[1]));
}

function sorted(values) {
  return [...values].sort();
}

test('the main webview can invoke exactly the custom commands used by shipped source', async () => {
  const [{ commands, dynamicInvocations }, manifestSource, permissionSource, libSource] = await Promise.all([
    frontendCommandContract(),
    readFile(new URL('src-tauri/build/webview_commands.rs', frontendRoot), 'utf8'),
    readFile(new URL('src-tauri/permissions/main-window.toml', frontendRoot), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', frontendRoot), 'utf8'),
  ]);
  const manifestCommands = stringsInArray(manifestSource, 'WEBVIEW_COMMANDS');
  const permissionCommands = stringsInArray(permissionSource, 'commands.allow');
  const registered = registeredCommands(libSource);

  assert.deepEqual(dynamicInvocations, [], 'custom commands must be string literals so the ACL is auditable');
  assert.deepEqual(sorted(manifestCommands), sorted(commands), 'the application manifest must match real frontend callers');
  assert.deepEqual(sorted(permissionCommands), sorted(commands), 'the main-window permission must match real frontend callers');
  assert.deepEqual(
    sorted([...manifestCommands].filter((command) => !registered.has(command))),
    [],
    'every exposed command must be registered by the Rust invoke handler',
  );
  assert.equal(
    registered.has('test_backend_connection'),
    true,
    'the denial fixture must remain a real registered command',
  );
  assert.equal(
    manifestCommands.has('test_backend_connection'),
    false,
    'registered commands without a shipped caller must stay absent from the application manifest',
  );
  assert.equal(
    permissionCommands.has('test_backend_connection'),
    false,
    'registered commands without a shipped caller must stay denied to the main webview',
  );
});

test('the main capability grants only caller-proven core and plugin operations', async () => {
  const [configSource, capabilitySource, packageSource, cargoSource, libSource, { modules }] = await Promise.all([
    readFile(new URL('src-tauri/tauri.conf.json', frontendRoot), 'utf8'),
    readFile(new URL('src-tauri/capabilities/main.json', frontendRoot), 'utf8'),
    readFile(new URL('package.json', frontendRoot), 'utf8'),
    readFile(new URL('src-tauri/Cargo.toml', frontendRoot), 'utf8'),
    readFile(new URL('src-tauri/src/lib.rs', frontendRoot), 'utf8'),
    frontendCommandContract(),
  ]);
  const config = JSON.parse(configSource);
  const main = JSON.parse(capabilitySource);
  const packageJson = JSON.parse(packageSource);
  assert.deepEqual(config.app.security.capabilities, ['main', 'flow-bar']);
  assert.equal(main.identifier, 'main');

  const expectedPermissions = [
    'main-window-commands',
    'core:app:allow-version',
    'core:event:allow-emit',
    'core:event:allow-listen',
    'core:event:allow-unlisten',
    'core:path:allow-resolve-directory',
    'core:resources:allow-close',
    'global-shortcut:allow-is-registered',
    'global-shortcut:allow-register',
    'global-shortcut:allow-unregister',
    'store:allow-load',
    'store:allow-get',
    'store:allow-has',
    'store:allow-set',
    'store:allow-save',
    'updater:allow-check',
    'updater:allow-download',
    'updater:allow-install',
    'updater:allow-download-and-install',
    'process:allow-restart',
    'os:allow-platform',
  ];
  assert.deepEqual(sorted(main.permissions), sorted(expectedPermissions));
  assert.deepEqual(main.windows, ['main']);

  assert.equal(packageJson.dependencies?.['@tauri-apps/plugin-fs'], undefined);
  assert.equal(packageJson.devDependencies?.['@tauri-apps/plugin-fs'], undefined);
  assert.equal(packageJson.dependencies?.['@tauri-apps/plugin-notification'], undefined);
  assert.equal(modules.has('@tauri-apps/plugin-fs'), false);
  assert.equal(modules.has('@tauri-apps/plugin-notification'), false);
  assert.doesNotMatch(cargoSource, /tauri-plugin-fs|macos-private-api|protocol-asset/);
  assert.match(cargoSource, /tauri-plugin-os = "2\.3\.2"/);
  assert.match(libSource, /\.plugin\(tauri_plugin_os::init\(\)\)/);
});

test('production CSP exposes IPC but no web network or asset-protocol surface', async () => {
  const config = JSON.parse(await readFile(new URL('src-tauri/tauri.conf.json', frontendRoot), 'utf8'));
  const { csp, devCsp, assetProtocol } = config.app.security;

  assert.equal(csp['connect-src'], "'self' ipc: http://ipc.localhost");
  assert.equal(csp['object-src'], "'none'");
  assert.equal(csp['frame-ancestors'], "'none'");
  assert.equal(assetProtocol, undefined);
  assert.equal(config.app.macOSPrivateApi, undefined);
  assert.doesNotMatch(JSON.stringify(csp), /api\.ollama\.ai|localhost:(?:5167|8178)|asset:/);
  assert.match(devCsp['connect-src'], /ws:\/\/localhost:3118/);
  assert.doesNotMatch(JSON.stringify(devCsp), /api\.ollama\.ai|localhost:(?:5167|8178)|asset:/);
});
