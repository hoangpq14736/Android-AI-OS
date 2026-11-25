#!/usr/bin/env bash
set -euo pipefail

# Cài đặt môi trường chạy Python Orchestrator Agent trên Termux (Xiaomi 12 Pro)
echo "==> Cập nhật gói Termux và cài Python + thư viện xử lý ảnh Pillow..."
pkg update -y
pkg install -y python libjpeg-turbo zlib clang pkg-config

echo "==> Cài đặt SDK google-genai, requests và pillow..."
pip install --upgrade pip
pip install -r "$(dirname "$0")/requirements.txt"

echo ""
echo "Hoàn tất! Thiết lập khóa API trước khi chạy:"
echo "  export GEMINI_API_KEY=\"YOUR_AI_STUDIO_API_KEY\""
echo "  python agent.py \"Mở Shopee, tìm mạch ESP32-S3 SuperMini và sắp xếp theo giá từ thấp đến cao\""
