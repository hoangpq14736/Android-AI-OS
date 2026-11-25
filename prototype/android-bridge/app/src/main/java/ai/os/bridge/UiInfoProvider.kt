package ai.os.bridge

import android.app.ActivityManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.util.Log
import android.view.WindowManager
import org.json.JSONObject

/**
 * Truy vấn độ phân giải thực tế của màn hình, góc xoay và package/activity đang chạy ở foreground
 * thông qua ActivityTaskManager reflection (nhanh, chuẩn với quyền REAL_GET_TASKS)
 * và fallback UsageStatsManager.
 */
class UiInfoProvider(private val context: Context) {

    companion object {
        private const val TAG = "AiOsUiInfo"
    }

    fun collectUiInfo(): JSONObject {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val bounds = wm.currentWindowMetrics.bounds
        val displayMetrics = context.resources.displayMetrics
        val rotation = runCatching { context.display?.rotation ?: 0 }.getOrDefault(0)
        val orientation = if (context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) {
            "landscape"
        } else {
            "portrait"
        }

        val (fgPackage, fgActivity, source) = detectForegroundApp()

        return JSONObject().apply {
            put("ok", true)
            put("screen_width", bounds.width())
            put("screen_height", bounds.height())
            put("density_dpi", displayMetrics.densityDpi)
            put("rotation", rotation)
            put("orientation", orientation)
            put("foreground_package", fgPackage)
            put("foreground_activity", fgActivity)
            put("detection_source", source)
            put("device_model", Build.MODEL)
            put("device_codename", Build.DEVICE)
            put("android_release", Build.VERSION.RELEASE)
            put("sdk_int", Build.VERSION.SDK_INT)
            put("timestamp_ms", System.currentTimeMillis())
        }
    }

    private fun detectForegroundApp(): Triple<String, String, String> {
        // Tier 1: ActivityTaskManager.getService().getTasks(1) — chuẩn cho priv-app Android 10–16
        queryViaActivityTaskManager()?.let { return Triple(it.first, it.second, "activity_task_manager") }

        // Tier 2: UsageStatsManager (cần PACKAGE_USAGE_STATS / appops GET_USAGE_STATS)
        queryViaUsageStats()?.let { return Triple(it.first, it.second, "usage_stats_manager") }

        return Triple("unknown", "unknown", "unavailable")
    }

    @Suppress("UNCHECKED_CAST")
    private fun queryViaActivityTaskManager(): Pair<String, String>? {
        return try {
            val atmClass = Class.forName("android.app.ActivityTaskManager")
            val getService = atmClass.getMethod("getService")
            val iAtm = getService.invoke(null) ?: return null

            val tasks: List<*>? = runCatching {
                val m = iAtm.javaClass.getMethod("getTasks", Int::class.javaPrimitiveType)
                m.invoke(iAtm, 1) as? List<*>
            }.getOrNull() ?: runCatching {
                // Chữ ký Android 14/15/16 mở rộng: getTasks(int maxNum, boolean filterOnlyVisibleRecents, boolean keepIntentExtra)
                val m = iAtm.javaClass.getMethod(
                    "getTasks",
                    Int::class.javaPrimitiveType,
                    Boolean::class.javaPrimitiveType,
                    Boolean::class.javaPrimitiveType
                )
                m.invoke(iAtm, 1, false, false) as? List<*>
            }.getOrNull()

            val topTask = tasks?.firstOrNull() as? ActivityManager.RunningTaskInfo ?: return null
            val topComp: ComponentName? = topTask.topActivity ?: topTask.baseActivity
            if (topComp != null) {
                Pair(topComp.packageName, topComp.className)
            } else {
                null
            }
        } catch (t: Throwable) {
            Log.d(TAG, "ActivityTaskManager query failed: ${t.message}")
            null
        }
    }

    private fun queryViaUsageStats(): Pair<String, String>? {
        return try {
            val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
            val end = System.currentTimeMillis()
            val begin = end - 120_000L
            val events = usm.queryEvents(begin, end) ?: return null
            val event = UsageEvents.Event()
            var lastPkg: String? = null
            var lastCls: String? = null

            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                    lastPkg = event.packageName
                    lastCls = event.className ?: ""
                }
            }
            if (!lastPkg.isNullOrBlank()) {
                Pair(lastPkg, lastCls ?: "")
            } else {
                null
            }
        } catch (t: Throwable) {
            Log.d(TAG, "UsageStatsManager query failed: ${t.message}")
            null
        }
    }
}
