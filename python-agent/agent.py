#!/usr/bin/env python3
"""
Android AI OS Orchestrator Agent (Termux / Chroot)
Kết nối cầu nối cục bộ ai.os.bridge (http://127.0.0.1:8765) với Google AI Studio API
qua SDK chính thức `google-genai` theo vòng lặp Perception-Action.

Tính năng cốt lõi:
  - Structured JSON Output (response_mime_type="application/json" + response_schema)
  - SafetySetting = BLOCK_NONE trên toàn bộ hạng mục để không bị chặn nhầm UI cá nhân
  - SQLite Memory cục bộ (agent_memory.db) lưu skill cache & nhật ký thực thi
  - Hard RPM Rate Limiter (cửa sổ trượt 60s) chống vượt ngưỡng API
  - Bộ phát hiện treo 3 bước liên tiếp bằng dHash 64-bit (Pillow) tránh đốt credit
"""

from __future__ import annotations

import argparse
import base64
import collections
import hashlib
import io
import json
import os
import sqlite3
import sys
import time
import uuid
from dataclasses import dataclass
from typing import Any, Deque, Dict, List, Optional

import requests
from google import genai
from google.genai import types
from PIL import Image


BRIDGE_BASE_URL = os.environ.get("AI_OS_BRIDGE_URL", "http://127.0.0.1:8765").rstrip("/")
DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
DEFAULT_DB_PATH = os.environ.get("AGENT_MEMORY_DB", "agent_memory.db")
MAX_STEPS_DEFAULT = 15
UI_SETTLE_SECONDS = 1.2
STUCK_FRAME_LIMIT = 3
DHASH_SIMILARITY_THRESHOLD = 2  # Hamming distance <= 2/64 bit coi là màn hình không đổi


SYSTEM_INSTRUCTION = """Bạn là bộ não điều phối Android AI OS đang điều khiển trực tiếp thiết bị Xiaomi 12 Pro (LineageOS).
Ở mỗi bước, bạn nhận ảnh chụp màn hình hiện tại, thông tin ứng dụng foreground, lịch sử các bước đã thực hiện và (nếu có) gợi ý chuỗi thao tác thành công trước đó từ bộ nhớ SQLite.

QUY TẮC BẮT BUỘC:
1. Chỉ trả về DUY NHẤT một đối tượng JSON đúng schema, không giải thích ngoài JSON.
2. Hệ tọa độ chuẩn hóa tuyệt đối từ 0 đến 1000:
   - Góc trên-trái là (0, 0), góc dưới-phải là (1000, 1000).
   - Đặt điểm tap chính xác vào tâm nút, ô tìm kiếm hoặc biểu tượng ứng dụng.
3. Các hành động hợp lệ cho trường `action`:
   - "tap": cần `x`, `y` trong [0..1000].
   - "swipe": cần `x1`, `y1`, `x2`, `y2` trong [0..1000] và `duration` (ms, mặc định 300).
   - "text": cần `content` (hỗ trợ đầy đủ tiếng Việt có dấu qua Clipboard+Paste; chỉ gọi sau khi ô nhập liệu đã được focus).
   - "key": cần `keycode` (Back=4, Home=3, Enter=66, Recents=187).
   - "wait": chờ UI/mạng tải xong thêm một nhịp.
   - "done": chỉ gọi khi mục tiêu người dùng đã hoàn thành rõ ràng trên màn hình hiện tại.
4. Giữ trường `thought` cực kỳ súc tích (1-2 câu tiếng Việt mô tả những gì đang thấy và bước tiếp theo).
5. Tránh lặp lại thao tác vô ích nếu bước trước đó không làm màn hình thay đổi.
"""


ACTION_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "thought": types.Schema(
            type=types.Type.STRING,
            description="Suy luận ngắn gọn 1-2 câu về trạng thái màn hình và lý do chọn hành động.",
        ),
        "action": types.Schema(
            type=types.Type.STRING,
            enum=["tap", "swipe", "text", "key", "wait", "done"],
            description="Loại hành động điều khiển UI.",
        ),
        "x": types.Schema(type=types.Type.INTEGER, description="Tọa độ X chuẩn hóa [0-1000] cho tap."),
        "y": types.Schema(type=types.Type.INTEGER, description="Tọa độ Y chuẩn hóa [0-1000] cho tap."),
        "x1": types.Schema(type=types.Type.INTEGER, description="Điểm đầu X1 [0-1000] cho swipe."),
        "y1": types.Schema(type=types.Type.INTEGER, description="Điểm đầu Y1 [0-1000] cho swipe."),
        "x2": types.Schema(type=types.Type.INTEGER, description="Điểm cuối X2 [0-1000] cho swipe."),
        "y2": types.Schema(type=types.Type.INTEGER, description="Điểm cuối Y2 [0-1000] cho swipe."),
        "duration": types.Schema(type=types.Type.INTEGER, description="Thời lượng vuốt (ms), mặc định 300."),
        "content": types.Schema(type=types.Type.STRING, description="Văn bản cần nhập cho action=text."),
        "keycode": types.Schema(type=types.Type.INTEGER, description="Android KeyEvent code (Back=4, Home=3, Enter=66, Recents=187)."),
        "status": types.Schema(
            type=types.Type.STRING,
            enum=["in_progress", "completed", "failed", "blocked"],
            description="Trạng thái tiến trình hoàn thành mục tiêu.",
        ),
    },
    required=["thought", "action", "status"],
)


SAFETY_SETTINGS_NONE = [
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold=types.HarmBlockThreshold.BLOCK_NONE,
    ),
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold=types.HarmBlockThreshold.BLOCK_NONE,
    ),
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold=types.HarmBlockThreshold.BLOCK_NONE,
    ),
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold=types.HarmBlockThreshold.BLOCK_NONE,
    ),
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
        threshold=types.HarmBlockThreshold.BLOCK_NONE,
    ),
]


class SlidingWindowRateLimiter:
    """Giới hạn cứng số request Gemini API trên mỗi 60 giây."""

    def __init__(self, max_rpm: int = 12) -> None:
        self.max_rpm = max(1, max_rpm)
        self._timestamps: Deque[float] = collections.deque()

    def acquire(self) -> None:
        now = time.monotonic()
        while self._timestamps and (now - self._timestamps[0]) >= 60.0:
            self._timestamps.popleft()

        if len(self._timestamps) >= self.max_rpm:
            wait_sec = 60.0 - (now - self._timestamps[0]) + 0.1
            if wait_sec > 0:
                print(f"[RateLimit] Đạt trần {self.max_rpm} req/phút — tạm nghỉ {wait_sec:.1f}s...")
                time.sleep(wait_sec)
            now = time.monotonic()
            while self._timestamps and (now - self._timestamps[0]) >= 60.0:
                self._timestamps.popleft()

        self._timestamps.append(time.monotonic())


def compute_dhash(jpeg_bytes: bytes) -> int:
    """Tính 64-bit difference hash (dHash) qua Pillow để phát hiện màn hình đứng yên."""
    with Image.open(io.BytesIO(jpeg_bytes)) as img:
        gray = img.convert("L").resize((9, 8), Image.Resampling.BILINEAR)
        pixels = list(gray.getdata())

    bits = 0
    for row in range(8):
        offset = row * 9
        for col in range(8):
            left_px = pixels[offset + col]
            right_px = pixels[offset + col + 1]
            bits = (bits << 1) | (1 if left_px > right_px else 0)
    return bits


def hamming_distance(h1: int, h2: int) -> int:
    return (h1 ^ h2).bit_count()


class SkillMemoryDB:
    """Bộ nhớ SQLite cục bộ (agent_memory.db) lưu skill cache và lịch sử thực thi."""

    def __init__(self, db_path: str = DEFAULT_DB_PATH) -> None:
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS skills (
                goal_hash TEXT PRIMARY KEY,
                goal_normalized TEXT NOT NULL,
                goal_raw TEXT NOT NULL,
                start_package TEXT NOT NULL,
                steps_json TEXT NOT NULL,
                success_count INTEGER NOT NULL DEFAULT 1,
                avg_steps REAL NOT NULL DEFAULT 0,
                updated_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS run_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                goal TEXT NOT NULL,
                step_index INTEGER NOT NULL,
                foreground_package TEXT,
                screen_dhash TEXT,
                thought TEXT,
                action_json TEXT NOT NULL,
                status TEXT,
                latency_ms INTEGER,
                created_at REAL NOT NULL
            );
            """
        )
        self.conn.commit()

    @staticmethod
    def normalize_goal(goal: str) -> str:
        return " ".join(goal.strip().lower().split())

    @classmethod
    def goal_hash(cls, goal: str) -> str:
        return hashlib.sha256(cls.normalize_goal(goal).encode("utf-8")).hexdigest()[:24]

    def find_cached_skill(self, goal: str) -> Optional[Dict[str, Any]]:
        g_hash = self.goal_hash(goal)
        row = self.conn.execute(
            "SELECT goal_raw, start_package, steps_json, success_count FROM skills WHERE goal_hash = ?",
            (g_hash,),
        ).fetchone()

        if row:
            return {
                "exact": True,
                "goal_raw": row["goal_raw"],
                "start_package": row["start_package"],
                "steps": json.loads(row["steps_json"]),
                "success_count": row["success_count"],
            }

        # Tìm gần đúng theo từ khóa nổi bật để gợi ý cho Gemini
        tokens = [t for t in self.normalize_goal(goal).split() if len(t) >= 3]
        if not tokens:
            return None
        rows = self.conn.execute(
            "SELECT goal_raw, goal_normalized, start_package, steps_json, success_count "
            "FROM skills ORDER BY success_count DESC, updated_at DESC LIMIT 30"
        ).fetchall()

        best_row = None
        best_score = 0.0
        token_set = set(tokens)
        for candidate in rows:
            cand_tokens = set(t for t in candidate["goal_normalized"].split() if len(t) >= 3)
            if not cand_tokens:
                continue
            overlap = len(token_set & cand_tokens) / max(1, len(token_set | cand_tokens))
            if overlap >= 0.45 and overlap > best_score:
                best_score = overlap
                best_row = candidate

        if best_row:
            return {
                "exact": False,
                "goal_raw": best_row["goal_raw"],
                "start_package": best_row["start_package"],
                "steps": json.loads(best_row["steps_json"]),
                "success_count": best_row["success_count"],
            }
        return None

    def save_successful_skill(self, goal: str, start_package: str, steps: List[Dict[str, Any]]) -> None:
        g_norm = self.normalize_goal(goal)
        g_hash = self.goal_hash(goal)
        compact_steps = [
            {k: v for k, v in step.items() if k in ("action", "x", "y", "x1", "y1", "x2", "y2", "duration", "content", "keycode")}
            for step in steps
            if step.get("action") != "done"
        ]
        now = time.time()
        existing = self.conn.execute(
            "SELECT success_count, avg_steps FROM skills WHERE goal_hash = ?",
            (g_hash,),
        ).fetchone()

        if existing:
            new_count = existing["success_count"] + 1
            new_avg = ((existing["avg_steps"] * existing["success_count"]) + len(compact_steps)) / new_count
            self.conn.execute(
                """
                UPDATE skills
                SET start_package = ?, steps_json = ?, success_count = ?, avg_steps = ?, updated_at = ?
                WHERE goal_hash = ?
                """,
                (start_package, json.dumps(compact_steps, ensure_ascii=False), new_count, new_avg, now, g_hash),
            )
        else:
            self.conn.execute(
                """
                INSERT INTO skills (goal_hash, goal_normalized, goal_raw, start_package, steps_json, success_count, avg_steps, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (g_hash, g_norm, goal, start_package, json.dumps(compact_steps, ensure_ascii=False), float(len(compact_steps)), now),
            )
        self.conn.commit()

    def log_step(
        self,
        run_id: str,
        goal: str,
        step_index: int,
        foreground_package: str,
        screen_dhash: str,
        decision: Dict[str, Any],
        latency_ms: int,
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO run_logs (run_id, goal, step_index, foreground_package, screen_dhash, thought, action_json, status, latency_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                goal,
                step_index,
                foreground_package,
                screen_dhash,
                decision.get("thought", ""),
                json.dumps(decision, ensure_ascii=False),
                decision.get("status", ""),
                latency_ms,
                time.time(),
            ),
        )
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()


class BridgeClient:
    """HTTP client tối giản giao tiếp với ai.os.bridge tại 127.0.0.1:8765."""

    def __init__(self, base_url: str = BRIDGE_BASE_URL, timeout: float = 10.0) -> None:
        self.base_url = base_url
        self.timeout = timeout
        self.session = requests.Session()

    def health(self) -> Dict[str, Any]:
        resp = self.session.get(f"{self.base_url}/health", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def ui_info(self) -> Dict[str, Any]:
        resp = self.session.get(f"{self.base_url}/ui_info", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def screenshot(self) -> tuple[bytes, Dict[str, Any]]:
        resp = self.session.get(f"{self.base_url}/screenshot", timeout=self.timeout)
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok") or not data.get("image_base64"):
            raise RuntimeError(f"Bridge /screenshot lỗi: {data}")
        jpeg_bytes = base64.b64decode(data["image_base64"])
        return jpeg_bytes, data

    def send_action(self, decision: Dict[str, Any]) -> Dict[str, Any]:
        action = decision["action"]
        if action in ("wait", "done"):
            return {"ok": True, "type": action}

        payload: Dict[str, Any] = {"type": action}
        if action == "tap":
            payload["x"] = int(decision.get("x", 500))
            payload["y"] = int(decision.get("y", 500))
        elif action == "swipe":
            payload["x1"] = int(decision.get("x1", 500))
            payload["y1"] = int(decision.get("y1", 800))
            payload["x2"] = int(decision.get("x2", 500))
            payload["y2"] = int(decision.get("y2", 200))
            payload["duration"] = int(decision.get("duration", 300))
        elif action == "text":
            payload["content"] = str(decision.get("content", ""))
        elif action == "key":
            payload["keycode"] = int(decision.get("keycode", 4))

        resp = self.session.post(f"{self.base_url}/action", json=payload, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()


@dataclass
class AgentConfig:
    model: str = DEFAULT_MODEL
    max_steps: int = MAX_STEPS_DEFAULT
    max_rpm: int = 12
    settle_sec: float = UI_SETTLE_SECONDS
    db_path: str = DEFAULT_DB_PATH
    bridge_url: str = BRIDGE_BASE_URL
    replay_cache: bool = False


class AndroidAiAgent:
    def __init__(self, config: AgentConfig) -> None:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise EnvironmentError(
                "Thiếu biến môi trường GEMINI_API_KEY. Hãy chạy: export GEMINI_API_KEY='...'"
            )
        self.config = config
        self.client = genai.Client(api_key=api_key)
        self.bridge = BridgeClient(base_url=config.bridge_url)
        self.memory = SkillMemoryDB(db_path=config.db_path)
        self.limiter = SlidingWindowRateLimiter(max_rpm=config.max_rpm)

    def _query_gemini(
        self,
        goal: str,
        jpeg_bytes: bytes,
        ui_info: Dict[str, Any],
        history: List[Dict[str, Any]],
        cached_skill: Optional[Dict[str, Any]],
        step_index: int,
    ) -> tuple[Dict[str, Any], int]:
        self.limiter.acquire()

        context_lines = [
            f"MỤC TIÊU NGƯỜI DÙNG: {goal}",
            f"BƯỚC HIỆN TẠI: {step_index}/{self.config.max_steps}",
            f"FOREGROUND APP: {ui_info.get('foreground_package', 'unknown')} ({ui_info.get('foreground_activity', '')})",
            f"ĐỘ PHÂN GIẢI: {ui_info.get('screen_width', 0)}x{ui_info.get('screen_height', 0)} ({ui_info.get('orientation', 'portrait')})",
        ]

        if cached_skill:
            context_lines.append(
                "GỢI Ý SKILL CACHE (chuỗi thao tác từng thành công trước đây, hãy đối chiếu với màn hình thực tế trước khi dùng): "
                + json.dumps(cached_skill["steps"], ensure_ascii=False)
            )

        if history:
            recent = history[-6:]
            context_lines.append("LỊCH SỬ BƯỚC GẦN NHẤT:")
            for item in recent:
                context_lines.append(f"  - Bước {item['step']}: {json.dumps(item['decision'], ensure_ascii=False)}")

        prompt_text = "\n".join(context_lines)

        t0 = time.monotonic()
        response = self.client.models.generate_content(
            model=self.config.model,
            contents=[
                types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"),
                types.Part.from_text(text=prompt_text),
            ],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=ACTION_RESPONSE_SCHEMA,
                safety_settings=SAFETY_SETTINGS_NONE,
                temperature=0.1,
            ),
        )
        latency_ms = int((time.monotonic() - t0) * 1000)
        raw_text = (response.text or "").strip()
        if not raw_text:
            raise RuntimeError("Gemini trả về nội dung rỗng.")

        decision = json.loads(raw_text)
        return decision, latency_ms

    def run(self, goal: str) -> bool:
        run_id = uuid.uuid4().hex[:12]
        print(f"=== Android AI OS Agent | Run {run_id} | Model: {self.config.model} ===")
        print(f"Mục tiêu: {goal}")

        health = self.bridge.health()
        print(f"[Bridge] Kết nối OK: {health.get('service')} @ {health.get('listen')}")

        initial_ui = self.bridge.ui_info()
        start_pkg = initial_ui.get("foreground_package", "unknown")
        cached_skill = self.memory.find_cached_skill(goal)

        if cached_skill:
            kind = "KHỚP CHÍNH XÁC" if cached_skill["exact"] else "TƯƠNG TỰ"
            print(
                f"[Memory] Tìm thấy skill cache ({kind}, thành công {cached_skill['success_count']} lần, "
                f"{len(cached_skill['steps'])} bước)."
            )
            if self.config.replay_cache and cached_skill["exact"]:
                print("[Memory] Bật chế độ --replay-cache: thực thi nhanh chuỗi đã lưu...")
                for idx, step in enumerate(cached_skill["steps"], start=1):
                    print(f"  [Replay {idx}/{len(cached_skill['steps'])}] -> {step}")
                    self.bridge.send_action(step)
                    time.sleep(self.config.settle_sec)
                print("[Memory] Hoàn tất replay nhanh!")
                return True

        history: List[Dict[str, Any]] = []
        executed_decisions: List[Dict[str, Any]] = []
        last_dhash: Optional[int] = None
        unchanged_streak = 0

        try:
            for step in range(1, self.config.max_steps + 1):
                ui_info = self.bridge.ui_info()
                jpeg_bytes, meta = self.bridge.screenshot()
                current_dhash = compute_dhash(jpeg_bytes)
                dhash_hex = f"{current_dhash:016x}"

                if last_dhash is not None:
                    dist = hamming_distance(last_dhash, current_dhash)
                    if dist <= DHASH_SIMILARITY_THRESHOLD:
                        unchanged_streak += 1
                        print(f"[Guard] Màn hình gần như không đổi (dHash dist={dist}, streak={unchanged_streak}/{STUCK_FRAME_LIMIT})")
                    else:
                        unchanged_streak = 0
                last_dhash = current_dhash

                if unchanged_streak >= STUCK_FRAME_LIMIT:
                    print(
                        f"[Guard] DỪNG AN TOÀN: Phát hiện {STUCK_FRAME_LIMIT} bước liên tiếp màn hình không thay đổi. "
                        "Hủy vòng lặp để tránh đốt API credit."
                    )
                    return False

                decision, latency_ms = self._query_gemini(
                    goal=goal,
                    jpeg_bytes=jpeg_bytes,
                    ui_info=ui_info,
                    history=history,
                    cached_skill=cached_skill,
                    step_index=step,
                )

                fg_pkg = ui_info.get("foreground_package", "unknown")
                self.memory.log_step(
                    run_id=run_id,
                    goal=goal,
                    step_index=step,
                    foreground_package=fg_pkg,
                    screen_dhash=dhash_hex,
                    decision=decision,
                    latency_ms=latency_ms,
                )

                action = decision.get("action", "wait")
                status = decision.get("status", "in_progress")
                thought = decision.get("thought", "")
                print(
                    f"[Bước {step:02d}/{self.config.max_steps}] ({latency_ms}ms | {meta.get('width')}x{meta.get('height')} | {fg_pkg})\n"
                    f"  Thought : {thought}\n"
                    f"  Action  : {json.dumps({k: v for k, v in decision.items() if k != 'thought'}, ensure_ascii=False)}"
                )

                history.append({"step": step, "decision": decision})
                executed_decisions.append(decision)

                if action == "done" or status == "completed":
                    print(f"[Hoàn thành] Mục tiêu đạt được sau {step} bước! Đang lưu skill vào {self.config.db_path}...")
                    self.memory.save_successful_skill(goal, start_pkg, executed_decisions)
                    return True

                if status in ("failed", "blocked"):
                    print(f"[Dừng] Agent báo trạng thái '{status}': {thought}")
                    return False

                bridge_res = self.bridge.send_action(decision)
                print(f"  Bridge  : {json.dumps(bridge_res, ensure_ascii=False)}")
                time.sleep(self.config.settle_sec)

            print(f"[Hết giới hạn] Đã đạt tối đa {self.config.max_steps} bước mà chưa hoàn thành mục tiêu.")
            return False
        finally:
            self.memory.close()


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Android AI OS Python Orchestrator Agent (Gemini + ai.os.bridge)"
    )
    parser.add_argument("goal", help="Câu lệnh mục tiêu cần thực thi trên thiết bị Android")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Model Gemini (mặc định: gemini-2.5-flash hoặc gemini-3.8-flash)")
    parser.add_argument("--max-steps", type=int, default=MAX_STEPS_DEFAULT, help="Số bước tối đa (mặc định: 15)")
    parser.add_argument("--max-rpm", type=int, default=12, help="Giới hạn cứng số request/phút (mặc định: 12)")
    parser.add_argument("--settle", type=float, default=UI_SETTLE_SECONDS, help="Thời gian chờ UI ổn định sau mỗi lệnh (giây, mặc định: 1.2)")
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help="Đường dẫn SQLite memory (mặc định: agent_memory.db)")
    parser.add_argument("--bridge", default=BRIDGE_BASE_URL, help="URL cầu nối nội bộ (mặc định: http://127.0.0.1:8765)")
    parser.add_argument("--replay-cache", action="store_true", help="Phát lại nhanh nếu mục tiêu khớp chính xác trong SQLite skill cache")
    return parser.parse_args(argv)


def main(argv: List[str]) -> int:
    args = parse_args(argv)
    config = AgentConfig(
        model=args.model,
        max_steps=args.max_steps,
        max_rpm=args.max_rpm,
        settle_sec=args.settle,
        db_path=args.db,
        bridge_url=args.bridge,
        replay_cache=args.replay_cache,
    )
    try:
        agent = AndroidAiAgent(config)
        ok = agent.run(args.goal)
        return 0 if ok else 2
    except requests.RequestException as exc:
        print(f"[Lỗi kết nối Bridge] Không gọi được {args.bridge}: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"[Lỗi thực thi] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
