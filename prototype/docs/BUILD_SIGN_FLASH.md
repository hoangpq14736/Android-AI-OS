# Hướng dẫn Biên dịch, Ký APK và Flash Magisk/KernelSU (Xiaomi 12 Pro - LineageOS 14/15/16)

## 1. Biên dịch Android Bridge APK (`ai.os.bridge`)
```bash
cd android-bridge
./gradlew assembleRelease
# File đầu ra: app/build/outputs/apk/release/app-release.apk
```

## 2. Ký APK (Chọn 1 trong 2 phương án)

### Phương án A: Ký bằng Release Keystore chuẩn (Khuyến nghị cho LineageOS đã cài Magisk/KernelSU)
Khi APK nằm trong `/system/priv-app/AiOsBridge/` và có file whitelist `privapp-permissions-ai.os.bridge.xml` hợp lệ, LineageOS cấp đầy đủ quyền `privileged` mà không bắt buộc chữ ký platform cho đa số bản build, ngoại trừ các quyền thuần `signature` (không có cờ `privileged`).

```bash
# Tạo keystore một lần duy nhất
keytool -genkeypair -v \
  -keystore ai-os-release.jks \
  -alias ai_os_bridge \
  -keyalg RSA -keysize 2048 -validity 10000

# Căn chỉnh byte APK trước khi ký
zipalign -f -p 4 \
  android-bridge/app/build/outputs/apk/release/app-release-unsigned.apk \
  android-bridge/app/build/outputs/apk/release/app-aligned.apk

# Ký APK (v1 + v2 + v3)
apksigner sign \
  --ks ai-os-release.jks \
  --ks-key-alias ai_os_bridge \
  --out android-bridge/app/build/outputs/apk/release/app-release.apk \
  android-bridge/app/build/outputs/apk/release/app-aligned.apk

# Xác minh chữ ký
apksigner verify --verbose android-bridge/app/build/outputs/apk/release/app-release.apk
```

### Phương án B: Ký bằng Platform Key của ROM (Nếu bạn tự build LineageOS từ mã nguồn AOSP)
Dùng `platform.pk8` và `platform.x509.pem` trong cây mã nguồn ROM (`build/target/product/security/`):

```bash
apksigner sign \
  --key platform.pk8 \
  --cert platform.x509.pem \
  --out android-bridge/app/build/outputs/apk/release/app-release.apk \
  android-bridge/app/build/outputs/apk/release/app-aligned.apk
```

## 3. Đóng gói Magisk Module (`ai_os_bridge.zip`)
```bash
cd magisk-module
chmod +x build_module.sh
./build_module.sh ../android-bridge/app/build/outputs/apk/release/app-release.apk
```

## 4. Đẩy lên Xiaomi 12 Pro & Flash qua Magisk / KernelSU
```bash
adb push magisk-module/ai_os_bridge.zip /sdcard/Download/ai_os_bridge.zip

# Nếu dùng Magisk:
adb shell su -c "magisk --install-module /sdcard/Download/ai_os_bridge.zip"

# Hoặc nếu dùng KernelSU:
adb shell su -c "ksud module install /sdcard/Download/ai_os_bridge.zip"

# Khởi động lại thiết bị để hệ thống nạp /system/priv-app và privapp-permissions XML
adb reboot
```

## 5. Kiểm tra nhanh sau khi khởi động lại
```bash
# Kiểm tra gói đã nằm trong /system/priv-app chưa
adb shell pm path ai.os.bridge

# Kiểm tra log khởi chạy của service.sh
adb shell cat /data/local/tmp/ai_os_bridge_boot.log

# Kiểm tra HTTP Server nội bộ 127.0.0.1:8765
adb shell curl -s http://127.0.0.1:8765/health
adb shell curl -s http://127.0.0.1:8765/ui_info
```

## 6. Chạy Python Orchestrator Agent trong Termux
```bash
cd python-agent
bash termux_setup.sh
export GEMINI_API_KEY="YOUR_AI_STUDIO_API_KEY"
python agent.py "Mở Shopee, tìm mạch ESP32-S3 SuperMini và sắp xếp theo giá từ thấp đến cao"
```
