package ai.os.bridge

import android.util.Log
import java.lang.reflect.Method

/**
 * Mở khóa giới hạn Non-SDK Hidden API cho tiến trình priv-app trên Android 14/15/16
 * bằng double-reflection vào VMRuntime.setHiddenApiExemptions(["L"]).
 */
object HiddenApiUnblocker {
    private const val TAG = "AiOsHiddenApi"
    @Volatile
    private var initialized = false

    fun unblock() {
        if (initialized) return
        synchronized(this) {
            if (initialized) return
            try {
                val forName: Method = Class::class.java.getDeclaredMethod("forName", String::class.java)
                val getDeclaredMethod: Method = Class::class.java.getDeclaredMethod(
                    "getDeclaredMethod",
                    String::class.java,
                    Array<Class<*>>::class.java
                )

                val vmRuntimeClass = forName.invoke(null, "dalvik.system.VMRuntime") as Class<*>
                val getRuntime = getDeclaredMethod.invoke(
                    vmRuntimeClass,
                    "getRuntime",
                    emptyArray<Class<*>>()
                ) as Method
                val setHiddenApiExemptions = getDeclaredMethod.invoke(
                    vmRuntimeClass,
                    "setHiddenApiExemptions",
                    arrayOf<Class<*>>(Array<String>::class.java)
                ) as Method

                val vmRuntime = getRuntime.invoke(null)
                setHiddenApiExemptions.invoke(vmRuntime, arrayOf("L"))
                initialized = true
                Log.i(TAG, "Hidden API exemptions applied successfully.")
            } catch (t: Throwable) {
                Log.w(TAG, "Failed to apply hidden API exemptions (may already be exempted for priv-app): ${t.message}")
            }
        }
    }
}
