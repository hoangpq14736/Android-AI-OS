package ai.os.bridge

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.InputDevice
import android.view.InputEvent
import android.view.KeyCharacterMap
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.WindowManager
import org.json.JSONObject
import java.lang.reflect.Method
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Bơm sự kiện cảm ứng, vuốt, nhập liệu tiếng Việt và phím cứng trực tiếp qua
 * InputManagerGlobal / InputManager.getInstance().injectInputEvent(..., INJECT_INPUT_EVENT_MODE_ASYNC).
 * Tọa độ đầu vào luôn ở hệ chuẩn hóa [0..1000] và tự quy đổi sang pixel thực tế của Xiaomi 12 Pro.
 */
class InputInjector(private val context: Context) {

    companion object {
        private const val TAG = "AiOsInputInjector"
        private const val INJECT_INPUT_EVENT_MODE_ASYNC = 0
        private const val INJECT_INPUT_EVENT_MODE_WAIT_FOR_FINISH = 2
        private const val NORMALIZED_MAX = 1000.0
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val injectorPair: Pair<Any, Method> by lazy { resolveInputInjector() }

    fun executeAction(payload: JSONObject): JSONObject {
        val type = payload.optString("type", "").trim().lowercase()
        return when (type) {
            "tap" -> {
                val x = payload.optDouble("x", Double.NaN)
                val y = payload.optDouble("y", Double.NaN)
                require(!x.isNaN() && !y.isNaN()) { "Thiếu tọa độ x/y cho hành động tap." }
                val (px, py) = normalizedToPixel(x, y)
                performTap(px, py)
                JSONObject().apply {
                    put("ok", true)
                    put("type", "tap")
                    put("normalized_x", x)
                    put("normalized_y", y)
                    put("pixel_x", px.roundToInt())
                    put("pixel_y", py.roundToInt())
                }
            }

            "swipe" -> {
                val x1 = payload.optDouble("x1", Double.NaN)
                val y1 = payload.optDouble("y1", Double.NaN)
                val x2 = payload.optDouble("x2", Double.NaN)
                val y2 = payload.optDouble("y2", Double.NaN)
                val duration = payload.optLong("duration", 300L).coerceIn(50L, 3000L)
                require(!x1.isNaN() && !y1.isNaN() && !x2.isNaN() && !y2.isNaN()) {
                    "Thiếu tọa độ x1/y1/x2/y2 cho hành động swipe."
                }
                val (px1, py1) = normalizedToPixel(x1, y1)
                val (px2, py2) = normalizedToPixel(x2, y2)
                performSwipe(px1, py1, px2, py2, duration)
                JSONObject().apply {
                    put("ok", true)
                    put("type", "swipe")
                    put("from_pixel", "${px1.roundToInt()},${py1.roundToInt()}")
                    put("to_pixel", "${px2.roundToInt()},${py2.roundToInt()}")
                    put("duration_ms", duration)
                }
            }

            "text" -> {
                val content = payload.optString("content", "")
                require(content.isNotEmpty()) { "Trường content rỗng cho hành động text." }
                val methodUsed = performTextInput(content)
                JSONObject().apply {
                    put("ok", true)
                    put("type", "text")
                    put("length", content.length)
                    put("method", methodUsed)
                }
            }

            "key" -> {
                val keycode = payload.optInt("keycode", -1)
                require(keycode > 0) { "keycode không hợp lệ cho hành động key." }
                performKeyPress(keycode)
                JSONObject().apply {
                    put("ok", true)
                    put("type", "key")
                    put("keycode", keycode)
                }
            }

            else -> throw IllegalArgumentException("Loại hành động không được hỗ trợ: '$type'")
        }
    }

    private fun resolveInputInjector(): Pair<Any, Method> {
        // Android 14/15/16 ưu tiên android.hardware.input.InputManagerGlobal
        val candidateClasses = listOf(
            "android.hardware.input.InputManagerGlobal",
            "android.hardware.input.InputManager"
        )
        var lastError: Throwable? = null
        for (className in candidateClasses) {
            try {
                val clazz = Class.forName(className)
                val getInstance = clazz.getMethod("getInstance")
                val instance = getInstance.invoke(null)
                val injectMethod = clazz.getMethod(
                    "injectInputEvent",
                    InputEvent::class.java,
                    Int::class.javaPrimitiveType
                )
                if (instance != null) {
                    Log.i(TAG, "Resolved input injector via $className")
                    return Pair(instance, injectMethod)
                }
            } catch (t: Throwable) {
                lastError = t
            }
        }
        throw IllegalStateException("Không thể tìm thấy InputManagerGlobal/InputManager.injectInputEvent", lastError)
    }

    private fun injectEvent(event: InputEvent, mode: Int = INJECT_INPUT_EVENT_MODE_ASYNC): Boolean {
        val (instance, method) = injectorPair
        return (method.invoke(instance, event, mode) as? Boolean) ?: false
    }

    private fun normalizedToPixel(normX: Double, normY: Double): Pair<Float, Float> {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val bounds = wm.currentWindowMetrics.bounds
        val clampedX = normX.coerceIn(0.0, NORMALIZED_MAX)
        val clampedY = normY.coerceIn(0.0, NORMALIZED_MAX)
        val px = ((clampedX / NORMALIZED_MAX) * (bounds.width() - 1)).toFloat()
        val py = ((clampedY / NORMALIZED_MAX) * (bounds.height() - 1)).toFloat()
        return Pair(px, py)
    }

    private fun obtainTouchEvent(
        downTime: Long,
        eventTime: Long,
        action: Int,
        x: Float,
        y: Float,
        pressure: Float
    ): MotionEvent {
        val props = arrayOf(
            MotionEvent.PointerProperties().apply {
                id = 0
                toolType = MotionEvent.TOOL_TYPE_FINGER
            }
        )
        val coords = arrayOf(
            MotionEvent.PointerCoords().apply {
                this.x = x
                this.y = y
                this.pressure = pressure
                this.size = 1.0f
            }
        )
        return MotionEvent.obtain(
            downTime,
            eventTime,
            action,
            1,
            props,
            coords,
            0,
            0,
            1.0f,
            1.0f,
            0,
            0,
            InputDevice.SOURCE_TOUCHSCREEN,
            0
        )
    }

    private fun performTap(x: Float, y: Float) {
        val downTime = SystemClock.uptimeMillis()
        val downEvent = obtainTouchEvent(downTime, downTime, MotionEvent.ACTION_DOWN, x, y, 1.0f)
        try {
            injectEvent(downEvent, INJECT_INPUT_EVENT_MODE_ASYNC)
        } finally {
            downEvent.recycle()
        }

        SystemClock.sleep(35L)

        val upTime = SystemClock.uptimeMillis()
        val upEvent = obtainTouchEvent(downTime, upTime, MotionEvent.ACTION_UP, x, y, 0.0f)
        try {
            injectEvent(upEvent, INJECT_INPUT_EVENT_MODE_WAIT_FOR_FINISH)
        } finally {
            upEvent.recycle()
        }
    }

    private fun performSwipe(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long) {
        val downTime = SystemClock.uptimeMillis()
        val downEvent = obtainTouchEvent(downTime, downTime, MotionEvent.ACTION_DOWN, x1, y1, 1.0f)
        try {
            injectEvent(downEvent, INJECT_INPUT_EVENT_MODE_ASYNC)
        } finally {
            downEvent.recycle()
        }

        val steps = max(8, (durationMs / 16L).toInt())
        val stepDelay = max(1L, durationMs / steps)

        for (i in 1..steps) {
            SystemClock.sleep(stepDelay)
            val t = i.toFloat() / steps.toFloat()
            // Smoothstep easing giúp cử chỉ vuốt tự nhiên trên màn hình 120Hz của Xiaomi 12 Pro
            val eased = t * t * (3f - 2f * t)
            val cx = x1 + (x2 - x1) * eased
            val cy = y1 + (y2 - y1) * eased
            val now = SystemClock.uptimeMillis()
            val moveEvent = obtainTouchEvent(downTime, now, MotionEvent.ACTION_MOVE, cx, cy, 1.0f)
            try {
                injectEvent(moveEvent, INJECT_INPUT_EVENT_MODE_ASYNC)
            } finally {
                moveEvent.recycle()
            }
        }

        val upTime = SystemClock.uptimeMillis()
        val upEvent = obtainTouchEvent(downTime, upTime, MotionEvent.ACTION_UP, x2, y2, 0.0f)
        try {
            injectEvent(upEvent, INJECT_INPUT_EVENT_MODE_WAIT_FOR_FINISH)
        } finally {
            upEvent.recycle()
        }
    }

    /**
     * Hỗ trợ đầy đủ tiếng Việt có dấu (Unicode UTF-8):
     *   - Với chuỗi có dấu/Unicode: ghi vào ClipboardManager trên Main Looper, sau đó bơm KEYCODE_PASTE (279).
     *   - Với chuỗi ASCII thuần ngắn không chứa ký tự đặc biệt: dùng KeyCharacterMap hoặc Clipboard+Paste đồng nhất.
     */
    private fun performTextInput(content: String): String {
        val hasNonAscii = content.any { it.code > 127 }
        if (!hasNonAscii && content.length <= 24) {
            val kcm = KeyCharacterMap.load(KeyCharacterMap.VIRTUAL_KEYBOARD)
            val events = kcm.getEvents(content.toCharArray())
            if (events != null && events.isNotEmpty()) {
                for (event in events) {
                    injectEvent(event, INJECT_INPUT_EVENT_MODE_WAIT_FOR_FINISH)
                }
                return "key_character_map"
            }
        }

        val clipboardReady = setClipboardTextOnMainThread(content)
        if (!clipboardReady) {
            throw IllegalStateException("Không thể ghi văn bản vào ClipboardManager để dán tiếng Việt.")
        }

        SystemClock.sleep(60L)
        // Bơm KEYCODE_PASTE (279) — được EditText/WebView/Compose hỗ trợ chuẩn trên Android 14/15/16
        val pasteSent = performKeyPress(KeyEvent.KEYCODE_PASTE)
        if (!pasteSent) {
            // Fallback Ctrl + V cho ứng dụng tùy biến
            performCtrlV()
            return "clipboard_ctrl_v"
        }
        return "clipboard_keycode_paste"
    }

    private fun setClipboardTextOnMainThread(text: String): Boolean {
        val latch = CountDownLatch(1)
        var success = false
        mainHandler.post {
            try {
                val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("ai_os_input", text)
                cm.setPrimaryClip(clip)
                success = true
            } catch (t: Throwable) {
                Log.e(TAG, "Clipboard write error: ${t.message}", t)
            } finally {
                latch.countDown()
            }
        }
        latch.await(1500L, TimeUnit.MILLISECONDS)
        return success
    }

    private fun performKeyPress(keycode: Int, metaState: Int = 0): Boolean {
        val now = SystemClock.uptimeMillis()
        val down = KeyEvent(
            now,
            now,
            KeyEvent.ACTION_DOWN,
            keycode,
            0,
            metaState,
            KeyCharacterMap.VIRTUAL_KEYBOARD,
            0,
            KeyEvent.FLAG_FROM_SYSTEM,
            InputDevice.SOURCE_KEYBOARD
        )
        val up = KeyEvent(
            now,
            now + 20L,
            KeyEvent.ACTION_UP,
            keycode,
            0,
            metaState,
            KeyCharacterMap.VIRTUAL_KEYBOARD,
            0,
            KeyEvent.FLAG_FROM_SYSTEM,
            InputDevice.SOURCE_KEYBOARD
        )
        val okDown = injectEvent(down, INJECT_INPUT_EVENT_MODE_ASYNC)
        SystemClock.sleep(20L)
        val okUp = injectEvent(up, INJECT_INPUT_EVENT_MODE_WAIT_FOR_FINISH)
        return okDown && okUp
    }

    private fun performCtrlV() {
        val meta = KeyEvent.META_CTRL_ON or KeyEvent.META_CTRL_LEFT_ON
        performKeyPress(KeyEvent.KEYCODE_V, meta)
    }
}
