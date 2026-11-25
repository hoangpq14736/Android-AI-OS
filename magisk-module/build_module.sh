#!/usr/bin/env bash
set -euo pipefail

# Script đóng gói Magisk / KernelSU Module chuẩn: ai_os_bridge.zip
# Cách dùng:
#   ./build_module.sh [duong_dan_toi_app-release.apk]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APK="${SCRIPT_DIR}/../android-bridge/app/build/outputs/apk/release/app-release.apk"
APK_SRC="${1:-$DEFAULT_APK}"
OUT_ZIP="${SCRIPT_DIR}/ai_os_bridge.zip"
TARGET_APK_DIR="${SCRIPT_DIR}/system/priv-app/AiOsBridge"
TARGET_APK="${TARGET_APK_DIR}/AiOsBridge.apk"
PERM_XML="${SCRIPT_DIR}/system/etc/permissions/privapp-permissions-ai.os.bridge.xml"

echo "==> [1/5] Kiểm tra APK nguồn..."
if [[ ! -f "$APK_SRC" ]]; then
    echo "LỖI: Không tìm thấy APK tại: $APK_SRC"
    echo "Hãy biên dịch APK trước bằng:"
    echo "  cd ../android-bridge && ./gradlew assembleRelease"
    exit 1
fi

echo "==> [2/5] Kiểm tra file whitelist privapp-permissions để chống bootloop..."
if [[ ! -f "$PERM_XML" ]]; then
    echo "LỖI: Thiếu $PERM_XML"
    exit 1
fi

if command -v xmllint >/dev/null 2>&1; then
    xmllint --noout "$PERM_XML"
    echo "    XML hợp lệ (xmllint passed)."
fi

echo "==> [3/5] Sao chép APK vào system/priv-app/AiOsBridge/AiOsBridge.apk..."
mkdir -p "$TARGET_APK_DIR"
cp -f "$APK_SRC" "$TARGET_APK"

echo "==> [4/5] Chuẩn hóa line-ending LF và cấp quyền thực thi cho script..."
for sh_file in "$SCRIPT_DIR/service.sh" "$SCRIPT_DIR/customize.sh" "$SCRIPT_DIR/META-INF/com/google/android/update-binary"; do
    if [[ -f "$sh_file" ]]; then
        sed -i 's/\r$//' "$sh_file" 2>/dev/null || true
        chmod 755 "$sh_file"
    fi
done

echo "==> [5/5] Đóng gói $OUT_ZIP..."
rm -f "$OUT_ZIP"
(
    cd "$SCRIPT_DIR"
    zip -r9 "$OUT_ZIP" \
        module.prop \
        customize.sh \
        service.sh \
        META-INF \
        system \
        -x "*.DS_Store" -x "__MACOSX/*"
)

echo ""
echo "THÀNH CÔNG! Đã tạo Magisk Module:"
echo "  File : $OUT_ZIP"
if command -v sha256sum >/dev/null 2>&1; then
    echo "  SHA256: $(sha256sum "$OUT_ZIP" | awk '{print $1}')"
fi
echo ""
echo "Lệnh đẩy và flash nhanh lên Xiaomi 12 Pro:"
echo "  adb push \"$OUT_ZIP\" /sdcard/Download/ai_os_bridge.zip"
echo "  adb shell su -c 'magisk --install-module /sdcard/Download/ai_os_bridge.zip'"
echo "  adb reboot"
