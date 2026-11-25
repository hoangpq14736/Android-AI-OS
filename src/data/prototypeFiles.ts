import settingsGradle from '../../prototype/android-bridge/settings.gradle.kts?raw';
import rootBuildGradle from '../../prototype/android-bridge/build.gradle.kts?raw';
import gradleProperties from '../../prototype/android-bridge/gradle.properties?raw';
import appBuildGradle from '../../prototype/android-bridge/app/build.gradle.kts?raw';
import proguardRules from '../../prototype/android-bridge/app/proguard-rules.pro?raw';
import androidManifest from '../../prototype/android-bridge/app/src/main/AndroidManifest.xml?raw';
import hiddenApiUnblocker from '../../prototype/android-bridge/app/src/main/java/ai/os/bridge/HiddenApiUnblocker.kt?raw';
import screenCapturer from '../../prototype/android-bridge/app/src/main/java/ai/os/bridge/ScreenCapturer.kt?raw';
import inputInjector from '../../prototype/android-bridge/app/src/main/java/ai/os/bridge/InputInjector.kt?raw';
import uiInfoProvider from '../../prototype/android-bridge/app/src/main/java/ai/os/bridge/UiInfoProvider.kt?raw';
import localHttpServer from '../../prototype/android-bridge/app/src/main/java/ai/os/bridge/LocalHttpServer.kt?raw';
import aiOsBridgeService from '../../prototype/android-bridge/app/src/main/java/ai/os/bridge/AiOsBridgeService.kt?raw';
import bootReceiver from '../../prototype/android-bridge/app/src/main/java/ai/os/bridge/BootReceiver.kt?raw';
import mainActivity from '../../prototype/android-bridge/app/src/main/java/ai/os/bridge/MainActivity.kt?raw';

import moduleProp from '../../prototype/magisk-module/module.prop?raw';
import privappPermissionsXml from '../../prototype/magisk-module/system/etc/permissions/privapp-permissions-ai.os.bridge.xml?raw';
import serviceSh from '../../prototype/magisk-module/service.sh?raw';
import customizeSh from '../../prototype/magisk-module/customize.sh?raw';
import updateBinary from '../../prototype/magisk-module/META-INF/com/google/android/update-binary?raw';
import updaterScript from '../../prototype/magisk-module/META-INF/com/google/android/updater-script?raw';
import buildModuleSh from '../../prototype/magisk-module/build_module.sh?raw';

import agentPy from '../../prototype/python-agent/agent.py?raw';
import requirementsTxt from '../../prototype/python-agent/requirements.txt?raw';
import termuxSetupSh from '../../prototype/python-agent/termux_setup.sh?raw';

import buildSignFlashMd from '../../prototype/docs/BUILD_SIGN_FLASH.md?raw';
import githubWorkflowYml from '../../prototype/.github/workflows/build-magisk-module.yml?raw';
import rootReadmeMd from '../../prototype/README.md?raw';

export type PrototypeCategory =
  | 'android-bridge'
  | 'magisk-module'
  | 'python-agent'
  | 'docs';

export type CodeLanguage =
  | 'kotlin'
  | 'xml'
  | 'bash'
  | 'python'
  | 'properties'
  | 'markdown'
  | 'yaml'
  | 'text';

export interface PrototypeFile {
  id: string;
  path: string;
  fileName: string;
  category: PrototypeCategory;
  language: CodeLanguage;
  summary: string;
  content: string;
  executable?: boolean;
  lineCount: number;
}

export const CATEGORY_LABELS: Record<PrototypeCategory, { title: string; subtitle: string }> = {
  'android-bridge': {
    title: 'Phần 1: Android Bridge APK',
    subtitle: 'ai.os.bridge · Kotlin · 127.0.0.1:8765',
  },
  'magisk-module': {
    title: 'Phần 2: Magisk / KernelSU Module',
    subtitle: 'ai_os_bridge.zip · /system/priv-app',
  },
  'python-agent': {
    title: 'Phần 3: Python Orchestrator Agent',
    subtitle: 'google-genai · Termux / Chroot',
  },
  docs: {
    title: 'CI/CD GitHub Actions & Tài liệu',
    subtitle: 'Auto-build ai_os_bridge.zip · apksigner · adb',
  },
};

function makeFile(
  path: string,
  category: PrototypeCategory,
  language: CodeLanguage,
  summary: string,
  content: string,
  executable = false
): PrototypeFile {
  const parts = path.split('/');
  const baseName = parts[parts.length - 1];
  const fileName =
    path === 'android-bridge/app/build.gradle.kts' ? 'app/build.gradle.kts' : baseName;
  const lineCount = content.split('\n').length;
  return {
    id: path,
    path,
    fileName,
    category,
    language,
    summary,
    content,
    executable,
    lineCount,
  };
}

export const PROTOTYPE_FILES: PrototypeFile[] = [
  // Phần 1: Android Bridge APK
  makeFile(
    'android-bridge/app/src/main/java/ai/os/bridge/LocalHttpServer.kt',
    'android-bridge',
    'kotlin',
    'HTTP/1.1 JSON Server thuần java.net.ServerSocket lắng nghe 127.0.0.1:8765 (/screenshot, /action, /ui_info, /health).',
    localHttpServer
  ),
  makeFile(
    'android-bridge/app/src/main/java/ai/os/bridge/ScreenCapturer.kt',
    'android-bridge',
    'kotlin',
    'Chụp toàn màn hình bằng Reflection (ScreenCapture API 14/15/16 + SurfaceControl), resize max 1280px, JPEG quality 70, Base64.',
    screenCapturer
  ),
  makeFile(
    'android-bridge/app/src/main/java/ai/os/bridge/InputInjector.kt',
    'android-bridge',
    'kotlin',
    'Bơm tap, swipe mượt, text tiếng Việt (ClipboardManager + KEYCODE_PASTE) và phím cứng qua InputManagerGlobal/InputManager.',
    inputInjector
  ),
  makeFile(
    'android-bridge/app/src/main/java/ai/os/bridge/UiInfoProvider.kt',
    'android-bridge',
    'kotlin',
    'Đọc độ phân giải thực tế và foreground package/activity qua ActivityTaskManager reflection + UsageStatsManager fallback.',
    uiInfoProvider
  ),
  makeFile(
    'android-bridge/app/src/main/java/ai/os/bridge/AiOsBridgeService.kt',
    'android-bridge',
    'kotlin',
    'Foreground Service bất tử (foregroundServiceType="specialUse") khởi chạy LocalHttpServer và tự phục hồi khi bị đóng.',
    aiOsBridgeService
  ),
  makeFile(
    'android-bridge/app/src/main/java/ai/os/bridge/BootReceiver.kt',
    'android-bridge',
    'kotlin',
    'BroadcastReceiver tự động đánh thức AiOsBridgeService ngay khi LineageOS khởi động hoàn tất.',
    bootReceiver
  ),
  makeFile(
    'android-bridge/app/src/main/java/ai/os/bridge/HiddenApiUnblocker.kt',
    'android-bridge',
    'kotlin',
    'Mở khóa Non-SDK Hidden API cho tiến trình priv-app Android 14/15/16 qua VMRuntime.setHiddenApiExemptions.',
    hiddenApiUnblocker
  ),
  makeFile(
    'android-bridge/app/src/main/java/ai/os/bridge/MainActivity.kt',
    'android-bridge',
    'kotlin',
    'Activity tối giản kiểm tra quyền POST_NOTIFICATIONS và kích hoạt Foreground Service.',
    mainActivity
  ),
  makeFile(
    'android-bridge/app/src/main/AndroidManifest.xml',
    'android-bridge',
    'xml',
    'Khai báo toàn bộ quyền hệ thống (INJECT_EVENTS, READ_FRAME_BUFFER, CAPTURE_VIDEO_OUTPUT, specialUse FGS) và BootReceiver.',
    androidManifest
  ),
  makeFile(
    'android-bridge/app/build.gradle.kts',
    'android-bridge',
    'kotlin',
    'Cấu hình biên dịch Gradle Kotlin DSL cho compileSdk 36 / minSdk 34 tối giản thư viện.',
    appBuildGradle
  ),
  makeFile(
    'android-bridge/settings.gradle.kts',
    'android-bridge',
    'kotlin',
    'Cấu hình dự án Gradle gốc AiOsBridge.',
    settingsGradle
  ),
  makeFile(
    'android-bridge/build.gradle.kts',
    'android-bridge',
    'kotlin',
    'Khai báo AGP 8.7.3 và Kotlin Android 2.0.21.',
    rootBuildGradle
  ),
  makeFile(
    'android-bridge/gradle.properties',
    'android-bridge',
    'properties',
    'Tham số bộ nhớ JVM và AndroidX cho Gradle.',
    gradleProperties
  ),
  makeFile(
    'android-bridge/app/proguard-rules.pro',
    'android-bridge',
    'text',
    'Quy tắc giữ nguyên chữ ký reflection và lớp trong package ai.os.bridge.',
    proguardRules
  ),

  // Phần 2: Magisk Module
  makeFile(
    'magisk-module/module.prop',
    'magisk-module',
    'properties',
    'Metadata chuẩn cho Magisk / KernelSU Module.',
    moduleProp
  ),
  makeFile(
    'magisk-module/system/etc/permissions/privapp-permissions-ai.os.bridge.xml',
    'magisk-module',
    'xml',
    'Whitelist đầy đủ toàn bộ quyền signature|privileged cho ai.os.bridge nhằm tuyệt đối tránh bootloop trên Android 14/15/16.',
    privappPermissionsXml
  ),
  makeFile(
    'magisk-module/service.sh',
    'magisk-module',
    'bash',
    'Chờ sys.boot_completed=1, cấp quyền runtime/appops, miễn tối ưu pin Doze và đánh thức AiOsBridgeService.',
    serviceSh,
    true
  ),
  makeFile(
    'magisk-module/customize.sh',
    'magisk-module',
    'bash',
    'Hook cài đặt Magisk/KernelSU xác minh APK, whitelist XML và phân quyền 0755/0644.',
    customizeSh,
    true
  ),
  makeFile(
    'magisk-module/build_module.sh',
    'magisk-module',
    'bash',
    'Script tự động sao chép app-release.apk vào /system/priv-app/AiOsBridge/, kiểm tra XML và nén thành ai_os_bridge.zip.',
    buildModuleSh,
    true
  ),
  makeFile(
    'magisk-module/META-INF/com/google/android/update-binary',
    'magisk-module',
    'bash',
    'Bootstrap cài đặt Magisk module chuẩn tương thích Magisk & KernelSU.',
    updateBinary,
    true
  ),
  makeFile(
    'magisk-module/META-INF/com/google/android/updater-script',
    'magisk-module',
    'text',
    'Marker nhận diện gói cài đặt Magisk.',
    updaterScript
  ),

  // Phần 3: Python Orchestrator Agent
  makeFile(
    'python-agent/agent.py',
    'python-agent',
    'python',
    'Vòng lặp Perception-Action dùng google-genai, Structured JSON, BLOCK_NONE, SQLite skill cache, giới hạn RPM và chống treo 3 bước bằng dHash.',
    agentPy,
    true
  ),
  makeFile(
    'python-agent/requirements.txt',
    'python-agent',
    'text',
    'Danh sách thư viện Python cần thiết (google-genai, requests, pillow).',
    requirementsTxt
  ),
  makeFile(
    'python-agent/termux_setup.sh',
    'python-agent',
    'bash',
    'Script cài nhanh Python, Pillow và google-genai trên Termux.',
    termuxSetupSh,
    true
  ),

  // CI/CD & Tài liệu
  makeFile(
    '.github/workflows/build-magisk-module.yml',
    'docs',
    'yaml',
    'GitHub Actions workflow tự động biên dịch APK (JDK 17 + Android SDK 35 + Gradle 8.11.1), ký chữ ký và xuất sẵn Artifact ai_os_bridge.zip.',
    githubWorkflowYml
  ),
  makeFile(
    'README.md',
    'docs',
    'markdown',
    'Hướng dẫn đẩy mã nguồn lên GitHub để tự động build ra file ai_os_bridge.zip không cần Android Studio.',
    rootReadmeMd
  ),
  makeFile(
    'docs/BUILD_SIGN_FLASH.md',
    'docs',
    'markdown',
    'Hướng dẫn biên dịch APK cục bộ, ký Release/Platform key, chạy build_module.sh và flash qua Magisk/KernelSU.',
    buildSignFlashMd
  ),
];

export const RAW_MANIFEST_XML = androidManifest;
export const RAW_PRIVAPP_XML = privappPermissionsXml;
