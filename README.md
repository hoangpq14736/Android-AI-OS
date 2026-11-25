# Android AI OS Prototype (Xiaomi 12 Pro · LineageOS 14/15/16)

Cấu trúc dự án hoàn chỉnh gồm 3 phân hệ và workflow tự động build không cần cài Android Studio:

- `.github/workflows/build-magisk-module.yml`: GitHub Actions tự động biên dịch APK, ký chữ ký và xuất sẵn `ai_os_bridge.zip`.
- `android-bridge/`: Mã nguồn Kotlin của Priv-App Bridge APK (`ai.os.bridge`), lắng nghe `127.0.0.1:8765`.
- `magisk-module/`: Cấu trúc Magisk/KernelSU Module, whitelist `privapp-permissions-ai.os.bridge.xml` chống bootloop và script `build_module.sh`.
- `python-agent/`: Script `agent.py` chạy trên Termux/Chroot kết nối Google AI Studio (`google-genai`).

## Cách build nhanh nhất (Không cần cài Android Studio)

1. Tạo một repository mới trên GitHub (Private hay Public đều được).
2. Giải nén gói `android-ai-os-prototype.zip`, mở thư mục `android-ai-os-prototype/` rồi đẩy toàn bộ file bên trong (kể cả thư mục ẩn `.github/`) lên nhánh `main`:
   ```bash
   git init
   git branch -M main
   git add .
   git commit -m "Initial Android AI OS Prototype"
   git remote add origin https://github.com/<tai-khoan>/<ten-repo>.git
   git push -u origin main
   ```
3. Mở tab **Actions** trên GitHub -> đợi ~2 phút cho job hoàn tất -> tải Artifact **`ai_os_bridge-magisk-module`**.
4. Giải nén Artifact lấy file **`ai_os_bridge.zip`** bên trong rồi cài trực tiếp trong ứng dụng Magisk hoặc KernelSU và khởi động lại thiết bị.
