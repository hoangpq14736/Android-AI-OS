#!/system/bin/sh
# customize.sh — Hook cài đặt chuẩn cho Magisk & KernelSU
SKIPUNZIP=0

ui_print "=============================================="
ui_print "  AI OS Priv-App Bridge (ai.os.bridge) v1.0.0 "
ui_print "  Target: LineageOS Android 14/15/16          "
ui_print "=============================================="

API=$(getprop ro.build.version.sdk)
ui_print "- Phát hiện Android SDK: $API"
if [ -n "$API" ] && [ "$API" -lt 34 ]; then
    ui_print "! Cảnh báo: Module tối ưu cho Android 14+ (API 34+)."
fi

APK_PATH="$MODPATH/system/priv-app/AiOsBridge/AiOsBridge.apk"
PERM_XML="$MODPATH/system/etc/permissions/privapp-permissions-ai.os.bridge.xml"

if [ ! -f "$APK_PATH" ]; then
    abort "! Thiếu file $APK_PATH. Hãy chạy build_module.sh kèm app-release.apk trước khi flash."
fi

if [ ! -f "$PERM_XML" ]; then
    abort "! Thiếu file whitelist $PERM_XML — dừng cài đặt để phòng tránh bootloop!"
fi

# Thiết lập phân quyền chuẩn hệ thống & SELinux context
set_perm_recursive "$MODPATH" 0 0 0755 0644
set_perm_recursive "$MODPATH/system/priv-app/AiOsBridge" 0 0 0755 0644
set_perm "$MODPATH/service.sh" 0 0 0755

ui_print "- Đã cài đặt AiOsBridge.apk vào /system/priv-app/AiOsBridge/"
ui_print "- Đã gắn whitelist privapp-permissions-ai.os.bridge.xml"
ui_print "- Khởi động lại thiết bị để kích hoạt cầu nối tại 127.0.0.1:8765"
