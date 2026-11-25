package ai.os.bridge

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.os.IBinder
import android.util.Base64
import android.util.Log
import android.view.WindowManager
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Chụp toàn màn hình không cần MediaProjection popup hay Accessibility Service.
 * Tương thích Android 14 / 15 / 16 (LineageOS):
 *   Tier 1: android.window.ScreenCapture.captureDisplay(DisplayCaptureArgs)
 *   Tier 2: android.view.SurfaceControl.captureDisplay(DisplayCaptureArgs)
 *   Tier 3: android.view.SurfaceControl.screenshot(Rect, w, h, rotation)
 *   Tier 4: Fallback /system/bin/screencap -p khi SELinux/binder chặn display token.
 * Nén kết quả JPEG (quality=70, cạnh dài tối đa 1280px) và mã hóa Base64.
 */
class ScreenCapturer(private val context: Context) {

    companion object {
        private const val TAG = "AiOsScreenCapturer"
        private const val MAX_LONG_EDGE_PX = 1280
        private const val JPEG_QUALITY = 70
    }

    fun captureAsJson(): JSONObject {
        val startedAt = System.currentTimeMillis()
        val rawBitmap = captureViaScreenCaptureApi14Plus()
            ?: captureViaLegacySurfaceControl()
            ?: captureViaScreencapBinary()
            ?: throw IllegalStateException(
                "Không thể chụp màn hình qua ScreenCapture/SurfaceControl hoặc screencap. " +
                    "Kiểm tra privapp-permissions (READ_FRAME_BUFFER, CAPTURE_VIDEO_OUTPUT)."
            )

        val softwareBitmap = ensureSoftwareBitmap(rawBitmap)
        if (softwareBitmap !== rawBitmap) {
            rawBitmap.recycle()
        }

        val originalWidth = softwareBitmap.width
        val originalHeight = softwareBitmap.height
        val resizedBitmap = resizeToMaxEdge(softwareBitmap, MAX_LONG_EDGE_PX)
        if (resizedBitmap !== softwareBitmap) {
            softwareBitmap.recycle()
        }

        val finalWidth = resizedBitmap.width
        val finalHeight = resizedBitmap.height

        val jpegBytes = ByteArrayOutputStream().use { baos ->
            resizedBitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, baos)
            baos.toByteArray()
        }
        resizedBitmap.recycle()

        val base64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP)
        val elapsedMs = System.currentTimeMillis() - startedAt

        return JSONObject().apply {
            put("ok", true)
            put("format", "jpeg")
            put("quality", JPEG_QUALITY)
            put("original_width", originalWidth)
            put("original_height", originalHeight)
            put("width", finalWidth)
            put("height", finalHeight)
            put("bytes", jpegBytes.size)
            put("capture_ms", elapsedMs)
            put("timestamp_ms", System.currentTimeMillis())
            put("image_base64", base64)
        }
    }

    private fun resolvePrimaryDisplayToken(): IBinder? {
        // 1. Thử android.view.SurfaceControl (LineageOS / AOSP)
        val surfaceControlCandidates = listOf(
            "android.view.SurfaceControl",
            "com.android.server.display.DisplayControl"
        )

        for (className in surfaceControlCandidates) {
            try {
                val clazz = Class.forName(className)

                // Thử getPhysicalDisplayIds() + getPhysicalDisplayToken(long)
                try {
                    val getIds = clazz.getDeclaredMethod("getPhysicalDisplayIds")
                    getIds.isAccessible = true
                    val ids = getIds.invoke(null) as? LongArray
                    if (ids != null && ids.isNotEmpty()) {
                        val getToken = clazz.getDeclaredMethod("getPhysicalDisplayToken", Long::class.javaPrimitiveType)
                        getToken.isAccessible = true
                        val token = getToken.invoke(null, ids[0]) as? IBinder
                        if (token != null) return token
                    }
                } catch (_: Throwable) {
                    // Thử chữ ký khác bên dưới
                }

                // Thử getInternalDisplayToken() (một số bản build Android 14/LineageOS)
                try {
                    val getInternal = clazz.getDeclaredMethod("getInternalDisplayToken")
                    getInternal.isAccessible = true
                    val token = getInternal.invoke(null) as? IBinder
                    if (token != null) return token
                } catch (_: Throwable) {
                    // Tiếp tục
                }
            } catch (_: ClassNotFoundException) {
                // Class không nằm trong bootclasspath của tiến trình hiện tại
            }
        }
        return null
    }

    /**
     * Android 14 / 15 / 16: android.window.ScreenCapture$DisplayCaptureArgs$Builder
     * và ScreenCapture.captureDisplay(DisplayCaptureArgs).
     */
    private fun captureViaScreenCaptureApi14Plus(): Bitmap? {
        return try {
            val token = resolvePrimaryDisplayToken() ?: return null
            val screenCaptureClass = Class.forName("android.window.ScreenCapture")
            val argsClass = Class.forName("android.window.ScreenCapture\$DisplayCaptureArgs")
            val builderClass = Class.forName("android.window.ScreenCapture\$DisplayCaptureArgs\$Builder")

            val builderCtor = builderClass.getDeclaredConstructor(IBinder::class.java)
            builderCtor.isAccessible = true
            val builder = builderCtor.newInstance(token)

            val (w, h) = getRealDisplaySize()
            runCatching {
                val setSize = builderClass.getMethod("setSize", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType)
                setSize.invoke(builder, w, h)
            }
            runCatching {
                val setSourceCrop = builderClass.getMethod("setSourceCrop", Rect::class.java)
                setSourceCrop.invoke(builder, Rect(0, 0, w, h))
            }
            runCatching {
                val setSecure = builderClass.getMethod("setCaptureSecureLayers", Boolean::class.javaPrimitiveType)
                setSecure.invoke(builder, true)
            }

            val buildMethod = builderClass.getMethod("build")
            val captureArgs = buildMethod.invoke(builder)

            val captureDisplay = screenCaptureClass.getMethod("captureDisplay", argsClass)
            val hwBufferObj = captureDisplay.invoke(null, captureArgs) ?: return null

            val asBitmap = hwBufferObj.javaClass.getMethod("asBitmap")
            asBitmap.invoke(hwBufferObj) as? Bitmap
        } catch (t: Throwable) {
            Log.d(TAG, "Tier 1 (android.window.ScreenCapture) unavailable: ${t.message}")
            null
        }
    }

    /**
     * Fallback Android 12/13 hoặc ROM patch giữ SurfaceControl.captureDisplay / SurfaceControl.screenshot.
     */
    private fun captureViaLegacySurfaceControl(): Bitmap? {
        return try {
            val scClass = Class.forName("android.view.SurfaceControl")
            val token = resolvePrimaryDisplayToken()

            if (token != null) {
                try {
                    val argsClass = Class.forName("android.view.SurfaceControl\$DisplayCaptureArgs")
                    val builderClass = Class.forName("android.view.SurfaceControl\$DisplayCaptureArgs\$Builder")
                    val builder = builderClass.getDeclaredConstructor(IBinder::class.java).newInstance(token)
                    val (w, h) = getRealDisplaySize()
                    runCatching {
                        builderClass.getMethod("setSize", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType)
                            .invoke(builder, w, h)
                    }
                    val args = builderClass.getMethod("build").invoke(builder)
                    val hwBuf = scClass.getMethod("captureDisplay", argsClass).invoke(null, args)
                    if (hwBuf != null) {
                        return hwBuf.javaClass.getMethod("asBitmap").invoke(hwBuf) as? Bitmap
                    }
                } catch (_: Throwable) {
                    // Thử SurfaceControl.screenshot
                }
            }

            val (w, h) = getRealDisplaySize()
            val screenshotMethod = scClass.getMethod(
                "screenshot",
                Rect::class.java,
                Int::class.javaPrimitiveType,
                Int::class.javaPrimitiveType,
                Int::class.javaPrimitiveType
            )
            screenshotMethod.invoke(null, Rect(0, 0, w, h), w, h, 0) as? Bitmap
        } catch (t: Throwable) {
            Log.d(TAG, "Tier 2 (SurfaceControl legacy) unavailable: ${t.message}")
            null
        }
    }

    /**
     * Fallback cuối cho thiết bị đã root (Magisk/KernelSU) nếu OEM ROM giới hạn DisplayToken trong priv-app.
     */
    private fun captureViaScreencapBinary(): Bitmap? {
        return try {
            val process = ProcessBuilder("/system/bin/screencap", "-p").start()
            val bytes = process.inputStream.use { it.readBytes() }
            val exitCode = process.waitFor()
            if (exitCode == 0 && bytes.isNotEmpty()) {
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            } else {
                null
            }
        } catch (t: Throwable) {
            Log.w(TAG, "Tier 3 (screencap fallback) failed: ${t.message}")
            null
        }
    }

    private fun getRealDisplaySize(): Pair<Int, Int> {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val bounds = wm.currentWindowMetrics.bounds
        return Pair(bounds.width(), bounds.height())
    }

    private fun ensureSoftwareBitmap(bitmap: Bitmap): Bitmap {
        return if (bitmap.config == Bitmap.Config.HARDWARE) {
            bitmap.copy(Bitmap.Config.ARGB_8888, false) ?: bitmap
        } else {
            bitmap
        }
    }

    private fun resizeToMaxEdge(source: Bitmap, maxEdge: Int): Bitmap {
        val longEdge = max(source.width, source.height)
        if (longEdge <= maxEdge) return source
        val scale = maxEdge.toFloat() / longEdge.toFloat()
        val targetWidth = max(1, (source.width * scale).roundToInt())
        val targetHeight = max(1, (source.height * scale).roundToInt())
        return Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
    }
}
