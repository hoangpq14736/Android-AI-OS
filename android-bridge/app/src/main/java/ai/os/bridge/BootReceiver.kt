package ai.os.bridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Tự động đánh thức AiOsBridgeService ngay khi LineageOS khởi động xong
 * hoặc khi nhận tín hiệu tự phục hồi.
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "AiOsBootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        Log.i(TAG, "Received broadcast: $action")
        if (
            action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == AiOsBridgeService.ACTION_RESTART_BRIDGE
        ) {
            val serviceIntent = Intent(context, AiOsBridgeService::class.java)
            runCatching {
                ContextCompat.startForegroundService(context, serviceIntent)
            }.onFailure { err ->
                Log.e(TAG, "Failed to start AiOsBridgeService on $action: ${err.message}", err)
            }
        }
    }
}
