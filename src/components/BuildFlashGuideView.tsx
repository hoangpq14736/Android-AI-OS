import { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';

type BuildMode = 'github_actions' | 'local_gradle';
type SigningMode = 'release_keystore' | 'platform_key';
type RootMode = 'magisk' | 'kernelsu';

interface CommandStep {
  id: string;
  number: string;
  title: string;
  note: string;
  command: string;
}

export function BuildFlashGuideView() {
  const [buildMode, setBuildMode] = useState<BuildMode>('github_actions');
  const [signingMode, setSigningMode] = useState<SigningMode>('release_keystore');
  const [rootMode, setRootMode] = useState<RootMode>('magisk');
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null);

  const signCommand =
    signingMode === 'release_keystore'
      ? `# Tạo keystore một lần duy nhất
keytool -genkeypair -v \\
  -keystore ai-os-release.jks \\
  -alias ai_os_bridge \\
  -keyalg RSA -keysize 2048 -validity 10000

# Căn chỉnh byte APK trước khi ký
zipalign -f -p 4 \\
  android-bridge/app/build/outputs/apk/release/app-release-unsigned.apk \\
  android-bridge/app/build/outputs/apk/release/app-aligned.apk

# Ký APK (v1 + v2 + v3) và xác minh
apksigner sign \\
  --ks ai-os-release.jks \\
  --ks-key-alias ai_os_bridge \\
  --out android-bridge/app/build/outputs/apk/release/app-release.apk \\
  android-bridge/app/build/outputs/apk/release/app-aligned.apk

apksigner verify --verbose android-bridge/app/build/outputs/apk/release/app-release.apk`
      : `# Ký bằng Platform Key từ cây mã nguồn LineageOS/AOSP (build/target/product/security/)
zipalign -f -p 4 \\
  android-bridge/app/build/outputs/apk/release/app-release-unsigned.apk \\
  android-bridge/app/build/outputs/apk/release/app-aligned.apk

apksigner sign \\
  --key platform.pk8 \\
  --cert platform.x509.pem \\
  --out android-bridge/app/build/outputs/apk/release/app-release.apk \\
  android-bridge/app/build/outputs/apk/release/app-aligned.apk

apksigner verify --verbose android-bridge/app/build/outputs/apk/release/app-release.apk`;

  const flashCommand =
    rootMode === 'magisk'
      ? `adb push ai_os_bridge.zip /sdcard/Download/ai_os_bridge.zip
adb shell su -c "magisk --install-module /sdcard/Download/ai_os_bridge.zip"
adb reboot`
      : `adb push ai_os_bridge.zip /sdcard/Download/ai_os_bridge.zip
adb shell su -c "ksud module install /sdcard/Download/ai_os_bridge.zip"
adb reboot`;

  const githubSteps: CommandStep[] = [
    {
      id: 'gh-push',
      number: '01',
      title: 'Giải nén gói .zip và đẩy lên GitHub (Private hoặc Public)',
      note: 'Gói tải về đã có sẵn .github/workflows/build-magisk-module.yml. Chỉ cần đẩy toàn bộ thư mục android-ai-os-prototype/ lên nhánh main.',
      command: `unzip android-ai-os-prototype.zip
cd android-ai-os-prototype
git init
git branch -M main
git add .
git commit -m "Build Android AI OS Prototype"
git remote add origin https://github.com/<tai-khoan>/<ten-repo>.git
git push -u origin main`,
    },
    {
      id: 'gh-download',
      number: '02',
      title: 'Tải file ai_os_bridge.zip đã biên dịch từ tab Actions',
      note: 'GitHub tự động cài JDK 17 + Android SDK 35 + Gradle 8.11.1, biên dịch APK, ký chữ ký apksigner và đóng gói sẵn Magisk Module (~2 phút). Không cần cấu hình GitHub Secrets.',
      command: `# Mở trình duyệt tại:
# https://github.com/<tai-khoan>/<ten-repo>/actions
#
# 1. Chọn workflow "Build Android AI OS Magisk Module" vừa chạy xong
# 2. Cuộn xuống mục Artifacts -> tải "ai_os_bridge-magisk-module"
# 3. Giải nén để lấy file ai_os_bridge.zip sẵn sàng flash`,
    },
    {
      id: 'gh-flash',
      number: '03',
      title: `Flash ai_os_bridge.zip lên Xiaomi 12 Pro qua ${rootMode === 'magisk' ? 'Magisk' : 'KernelSU'}`,
      note: 'Có thể cài trực tiếp trong ứng dụng Magisk/KernelSU trên điện thoại hoặc chạy lệnh adb bên dưới.',
      command: flashCommand,
    },
    {
      id: 'gh-verify',
      number: '04',
      title: 'Xác minh Cầu nối cục bộ 127.0.0.1:8765 sau khi boot',
      note: 'Kiểm tra package đã mount vào /system/priv-app và HTTP server trả về JSON hợp lệ.',
      command: `adb shell pm path ai.os.bridge
adb shell cat /data/local/tmp/ai_os_bridge_boot.log
adb shell curl -s http://127.0.0.1:8765/health
adb shell curl -s http://127.0.0.1:8765/ui_info`,
    },
    {
      id: 'gh-agent',
      number: '05',
      title: 'Chạy Python Orchestrator Agent trong Termux / Chroot',
      note: 'Chép thư mục python-agent vào điện thoại, cài SDK google-genai rồi khởi chạy vòng lặp.',
      command: `cd python-agent
bash termux_setup.sh
export GEMINI_API_KEY="YOUR_AI_STUDIO_API_KEY"
python agent.py "Mở Shopee, tìm mạch ESP32-S3 SuperMini và sắp xếp theo giá từ thấp đến cao"`,
    },
  ];

  const localSteps: CommandStep[] = [
    {
      id: 'build',
      number: '01',
      title: 'Biên dịch Android Bridge APK (ai.os.bridge)',
      note: 'Sử dụng JDK 17 và Android SDK 35. Dự án không kéo Ktor/Netty nên file APK cuối rất gọn (~1.5 MB).',
      command: `cd android-bridge
gradle assembleRelease`,
    },
    {
      id: 'sign',
      number: '02',
      title:
        signingMode === 'release_keystore'
          ? 'Ký APK bằng Release Keystore chuẩn (apksigner)'
          : 'Ký APK bằng AOSP Platform Key (platform.pk8)',
      note:
        signingMode === 'release_keystore'
          ? 'Phù hợp ngay khi dùng LineageOS phát hành sẵn: kết hợp với privapp-permissions-ai.os.bridge.xml để cấp đầy đủ quyền privileged.'
          : 'Khuyến nghị nếu bạn tự biên dịch LineageOS cho Xiaomi 12 Pro từ nguồn để đạt luôn mức chữ ký signature của hệ thống.',
      command: signCommand,
    },
    {
      id: 'pack',
      number: '03',
      title: 'Đóng gói Magisk / KernelSU Module (ai_os_bridge.zip)',
      note: 'Script tự động chép APK vào system/priv-app/AiOsBridge/AiOsBridge.apk, kiểm tra cú pháp XML whitelist và nén chuẩn LF.',
      command: `cd magisk-module
chmod +x build_module.sh
./build_module.sh ../android-bridge/app/build/outputs/apk/release/app-release.apk`,
    },
    {
      id: 'flash',
      number: '04',
      title: `Đẩy lên Xiaomi 12 Pro và flash qua ${rootMode === 'magisk' ? 'Magisk' : 'KernelSU'}`,
      note: 'Sau khi reboot, Magisk/KernelSU sẽ mount APK vào /system/priv-app và thực thi service.sh khi sys.boot_completed = 1.',
      command:
        rootMode === 'magisk'
          ? `adb push magisk-module/ai_os_bridge.zip /sdcard/Download/ai_os_bridge.zip
adb shell su -c "magisk --install-module /sdcard/Download/ai_os_bridge.zip"
adb reboot`
          : `adb push magisk-module/ai_os_bridge.zip /sdcard/Download/ai_os_bridge.zip
adb shell su -c "ksud module install /sdcard/Download/ai_os_bridge.zip"
adb reboot`,
    },
    {
      id: 'verify',
      number: '05',
      title: 'Xác minh Cầu nối cục bộ 127.0.0.1:8765 sau khi boot',
      note: 'Đảm bảo package đang nằm trong /system/priv-app và endpoint /health, /ui_info phản hồi JSON.',
      command: `adb shell pm path ai.os.bridge
adb shell cat /data/local/tmp/ai_os_bridge_boot.log
adb shell curl -s http://127.0.0.1:8765/health
adb shell curl -s http://127.0.0.1:8765/ui_info`,
    },
    {
      id: 'agent',
      number: '06',
      title: 'Chạy Python Orchestrator Agent trong Termux / Chroot',
      note: 'Cài SDK google-genai, requests, pillow rồi khởi chạy vòng lặp Perception-Action.',
      command: `cd python-agent
bash termux_setup.sh
export GEMINI_API_KEY="YOUR_AI_STUDIO_API_KEY"
python agent.py "Mở Shopee, tìm mạch ESP32-S3 SuperMini và sắp xếp theo giá từ thấp đến cao"`,
    },
  ];

  const steps = buildMode === 'github_actions' ? githubSteps : localSteps;

  const handleCopy = async (step: CommandStep) => {
    try {
      await navigator.clipboard.writeText(step.command);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = step.command;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedStepId(step.id);
    window.setTimeout(() => setCopiedStepId(null), 1800);
  };

  return (
    <main className="max-w-5xl mx-auto px-4 lg:px-6 py-8 space-y-6">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-slate-500 font-mono">
            Xiaomi 12 Pro (zeus) · LineageOS Android 14/15/16
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance] max-w-xl">
            Quy trình Biên dịch, Ký APK và Flash Magisk / KernelSU
          </h1>
          <p className="text-sm text-slate-600">
            Dùng <strong>GitHub Actions</strong> để tự động xuất sẵn <code className="font-mono text-xs text-slate-800">ai_os_bridge.zip</code> không cần cài Android Studio, hoặc tự biên dịch cục bộ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Chọn cách biên dịch"
            className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setBuildMode('github_actions')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                buildMode === 'github_actions'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GitHub Actions (Tự động)
            </button>
            <button
              type="button"
              onClick={() => setBuildMode('local_gradle')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                buildMode === 'local_gradle'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Build cục bộ (Gradle)
            </button>
          </div>

          {buildMode === 'local_gradle' && (
            <div
              role="group"
              aria-label="Chọn phương thức ký APK"
              className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setSigningMode('release_keystore')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  signingMode === 'release_keystore'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Release Keystore
              </button>
              <button
                type="button"
                onClick={() => setSigningMode('platform_key')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  signingMode === 'platform_key'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Platform Key AOSP
              </button>
            </div>
          )}

          <div
            role="group"
            aria-label="Chọn trình quản lý root"
            className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setRootMode('magisk')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                rootMode === 'magisk'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Magisk
            </button>
            <button
              type="button"
              onClick={() => setRootMode('kernelsu')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                rootMode === 'kernelsu'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              KernelSU
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <section
            key={step.id}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900">
                  <span className="font-mono text-emerald-700 mr-1.5 tabular-nums">
                    {step.number}.
                  </span>{' '}
                  {step.title}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">{step.note}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(step)}
                aria-label={`Sao chép lệnh bước ${step.number}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
              >
                {copiedStepId === step.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                    <span>Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-950 px-5 py-4 overflow-x-auto code-scroll">
              <div className="flex items-start gap-2.5">
                <Terminal
                  className="w-4 h-4 text-slate-500 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <pre className="text-xs leading-6 font-mono text-slate-100 whitespace-pre">
                  <code>{step.command}</code>
                </pre>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
