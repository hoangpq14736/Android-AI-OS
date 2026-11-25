import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildZipArchive, crc32 } from './zipBuilder';
import {
  buildActionPayload,
  calculateResizedCaptureDimensions,
  normalizedToPixel,
  ratioToNormalized,
} from './coordinateMapper';
import { auditPrivAppPermissions } from './permissionAuditor';
import {
  advanceLoopStep,
  createInitialLoopState,
  simulateUnchangedFrame,
} from './loopSimulator';
import { tokenizeCodeLine } from './codeTokenizer';

test('codeTokenizer preserves exact source text with zero HTML/CSS leakage across languages', () => {
  const samples: Array<{ lang: 'kotlin' | 'python' | 'bash' | 'xml'; line: string }> = [
    { lang: 'kotlin', line: 'private val host: String = "127.0.0.1" // local only' },
    { lang: 'python', line: 'if action == "done": return True # finish' },
    { lang: 'bash', line: 'adb shell su -c "magisk --install-module /sdcard/ai_os_bridge.zip"' },
    { lang: 'xml', line: '    <permission name="android.permission.INJECT_EVENTS" />' },
  ];

  for (const s of samples) {
    const tokens = tokenizeCodeLine(s.line, s.lang);
    const reconstructed = tokens.map((t) => t.text).join('');
    assert.equal(reconstructed, s.line);
    assert.ok(!reconstructed.includes('text-sky-300'));
  }
});

test('crc32 produces standard IEEE checksum for "123456789"', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc32(bytes), 0xcbf43926);
});

test('buildZipArchive produces valid PKZIP headers and preserves Unix executable flags', () => {
  const zip = buildZipArchive([
    { path: 'magisk-module/build_module.sh', content: '#!/usr/bin/env bash\necho ok\n', executable: true },
    { path: 'magisk-module/module.prop', content: 'id=ai_os_bridge\n', executable: false },
  ]);

  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // Local file header signature PK\x03\x04
  assert.equal(view.getUint32(0, true), 0x04034b50);
  // EOCD signature PK\x05\x06 at the end (22 bytes)
  const eocdOffset = zip.length - 22;
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);
  // Entry count = 2
  assert.equal(view.getUint16(eocdOffset + 10, true), 2);
});

test('coordinateMapper maps [0..1000] to Xiaomi 12 Pro 1440x3200 pixels and clamps out-of-range inputs', () => {
  const center = normalizedToPixel({ x: 500, y: 500 }, { width: 1440, height: 3200 });
  assert.equal(center.x, 720);
  assert.equal(center.y, 1600);

  const clamped = normalizedToPixel({ x: -50, y: 1500 }, { width: 1440, height: 3200 });
  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 3199);

  const norm = ratioToNormalized(0.25, 0.75);
  assert.deepEqual(norm, { x: 250, y: 750 });

  const resized = calculateResizedCaptureDimensions(1440, 3200, 1280);
  assert.equal(resized.height, 1280);
  assert.equal(resized.width, 576);

  const swipe = buildActionPayload({
    type: 'swipe',
    x1: 500,
    y1: 800,
    x2: 500,
    y2: 200,
    duration: 300,
  });
  assert.deepEqual(swipe, { type: 'swipe', x1: 500, y1: 800, x2: 500, y2: 200, duration: 300 });
});

test('permissionAuditor verifies real AndroidManifest.xml and privapp-permissions XML have zero bootloop risk', () => {
  const manifestXml = fs.readFileSync(
    path.resolve('prototype/android-bridge/app/src/main/AndroidManifest.xml'),
    'utf-8'
  );
  const privappXml = fs.readFileSync(
    path.resolve('prototype/magisk-module/system/etc/permissions/privapp-permissions-ai.os.bridge.xml'),
    'utf-8'
  );

  const report = auditPrivAppPermissions(manifestXml, privappXml);
  assert.equal(report.packageName, 'ai.os.bridge');
  assert.equal(report.bootloopRiskCount, 0);
  assert.equal(report.isSafeToFlash, true);
  assert.equal(report.privilegedCount, report.whitelistedCount);
  assert.ok(report.privilegedCount >= 7);
});

test('permissionAuditor detects bootloop risk when a privileged permission is missing from whitelist', () => {
  const manifest = `<manifest><uses-permission android:name="android.permission.INJECT_EVENTS" /></manifest>`;
  const emptyWhitelist = `<permissions><privapp-permissions package="ai.os.bridge"></privapp-permissions></permissions>`;

  const report = auditPrivAppPermissions(manifest, emptyWhitelist);
  assert.equal(report.bootloopRiskCount, 1);
  assert.equal(report.isSafeToFlash, false);
});

test('loopSimulator completes Shopee scenario, caches skill in SQLite state, and aborts after 3 unchanged frames', () => {
  let state = createInitialLoopState('shopee_esp32');
  assert.equal(state.currentScreen, 'lineage_home');

  for (let i = 0; i < 6; i++) {
    state = advanceLoopStep(state);
  }
  assert.equal(state.status, 'completed');
  assert.equal(state.currentScreen, 'shopee_results_price_asc');
  assert.equal(state.skillCache.length, 1);
  assert.equal(state.skillCache[0].successCount, 1);

  let stuckState = createInitialLoopState('shopee_esp32');
  stuckState = simulateUnchangedFrame(stuckState);
  assert.equal(stuckState.unchangedStreak, 1);
  assert.equal(stuckState.status, 'running');
  stuckState = simulateUnchangedFrame(stuckState);
  stuckState = simulateUnchangedFrame(stuckState);
  assert.equal(stuckState.unchangedStreak, 3);
  assert.equal(stuckState.status, 'aborted_stuck');
});

test('GitHub Actions workflow builds APK, signs with apksigner, and uploads ai_os_bridge.zip artifact', () => {
  const workflow = fs.readFileSync(
    path.resolve('prototype/.github/workflows/build-magisk-module.yml'),
    'utf-8'
  );
  assert.ok(!workflow.includes('android-actions/setup-android'));
  assert.ok(workflow.includes('gradle-version: "8.11.1"'));
  assert.ok(workflow.includes('platforms;android-35'));
  assert.ok(workflow.includes('apksigner'));
  assert.ok(workflow.includes('magisk-module/build_module.sh'));
  assert.ok(workflow.includes('magisk-module/ai_os_bridge.zip'));
  assert.ok(workflow.includes('actions/upload-artifact@v4'));

  const injector = fs.readFileSync(
    path.resolve('prototype/android-bridge/app/src/main/java/ai/os/bridge/InputInjector.kt'),
    'utf-8'
  );
  assert.ok(!injector.includes('KeyEvent.FLAG_FROM_SYSTEM'));

  const manifest = fs.readFileSync(
    path.resolve('prototype/android-bridge/app/src/main/AndroidManifest.xml'),
    'utf-8'
  );
  assert.ok(!manifest.includes('package="ai.os.bridge"'));

  const unblocker = fs.readFileSync(
    path.resolve('prototype/android-bridge/app/src/main/java/ai/os/bridge/HiddenApiUnblocker.kt'),
    'utf-8'
  );
  assert.ok(!unblocker.includes('Array<Class<*>>::class.java'));
  assert.ok(unblocker.includes('java.lang.reflect.Array.newInstance(Class::class.java, 0).javaClass'));
});
