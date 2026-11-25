#!/system/bin/sh
# service.sh — Chạy tự động bởi Magisk / KernelSU ở giai đoạn late_start service
MODDIR="${0%/*}"
PKG="ai.os.bridge"
SVC="ai.os.bridge/.AiOsBridgeService"
LOG="/data/local/tmp/ai_os_bridge_boot.log"

log_msg() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ai_os_bridge] $1" >> "$LOG"
}

log_msg "Khởi động script service.sh từ $MODDIR"

# 1. Đợi hệ thống LineageOS hoàn tất boot (sys.boot_completed = 1)
BOOT_WAIT=0
while [ "$(getprop sys.boot_completed)" != "1" ]; do
    sleep 2
    BOOT_WAIT=$((BOOT_WAIT + 2))
    if [ "$BOOT_WAIT" -ge 180 ]; then
        log_msg "Cảnh báo: Hết thời gian chờ sys.boot_completed (180s), tiếp tục thử khởi chạy."
        break
    fi
done

# 2. Đợi PackageManager sẵn sàng và nhận diện gói priv-app ai.os.bridge
PM_WAIT=0
while ! pm path "$PKG" >/dev/null 2>&1; do
    sleep 2
    PM_WAIT=$((PM_WAIT + 2))
    if [ "$PM_WAIT" -ge 60 ]; then
        log_msg "LỖI: Không tìm thấy package $PKG trong PackageManager sau 60s."
        exit 1
    fi
done

# 3. Cấp quyền runtime, AppOps và loại trừ khỏi Doze / tối ưu pin
pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
appops set "$PKG" GET_USAGE_STATS allow >/dev/null 2>&1 || true
appops set "$PKG" RUN_ANY_IN_BACKGROUND allow >/dev/null 2>&1 || true
dumpsys deviceidle whitelist +"$PKG" >/dev/null 2>&1 || true

# 4. Đánh thức Foreground Service AiOsBridgeService
if am start-foreground-service -n "$SVC" >/dev/null 2>&1; then
    log_msg "Đã đánh thức $SVC thành công (http://127.0.0.1:8765)."
else
    # Fallback qua BroadcastReceiver nếu Android chưa mở khóa user storage
    am broadcast -a ai.os.bridge.ACTION_RESTART_BRIDGE -p "$PKG" >/dev/null 2>&1 || true
    log_msg "Đã gửi broadcast đánh thức $PKG."
fi

exit 0
