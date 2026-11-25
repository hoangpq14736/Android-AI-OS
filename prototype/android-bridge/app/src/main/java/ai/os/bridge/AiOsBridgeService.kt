package ai.os.bridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

/**
 * Foreground Service chạy ngầm bất tử trên Android 14/15/16 (foregroundServiceType="specialUse").
 * Tự động mở khóa Hidden API và khởi chạy LocalHttpServer tại 127.0.0.1:8765.
 */
class AiOsBridgeService : Service() {

    companion object {
        private const val TAG = "AiOsBridgeService"
        private const val CHANNEL_ID = "ai_os_bridge_channel"
        private const val NOTIFICATION_ID = 8765
        const val ACTION_RESTART_BRIDGE = "ai.os.bridge.ACTION_RESTART_BRIDGE"
    }

    private var httpServer: LocalHttpServer? = null

    override fun onCreate() {
        super.onCreate()
        HiddenApiUnblocker.unblock()
        createNotificationChannel()
        promoteToForeground()

        val capturer = ScreenCapturer(applicationContext)
        val injector = InputInjector(applicationContext)
        val uiInfo = UiInfoProvider(applicationContext)

        httpServer = LocalHttpServer(
            host = "127.0.0.1",
            port = 8765,
            screenCapturer = capturer,
            inputInjector = injector,
            uiInfoProvider = uiInfo
        ).also { server ->
            runCatching { server.start() }
                .onFailure { err -> Log.e(TAG, "Không thể mở cổng 127.0.0.1:8765: ${err.message}", err) }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        promoteToForeground()
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val restartIntent = Intent(ACTION_RESTART_BRIDGE).apply {
            setPackage(packageName)
        }
        sendBroadcast(restartIntent)
    }

    override fun onDestroy() {
        httpServer?.stop()
        httpServer = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "AI OS Bridge Service",
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = "Dịch vụ cầu nối hệ thống chạy cục bộ tại 127.0.0.1:8765"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun promoteToForeground() {
        val notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("AI OS Bridge đang hoạt động")
            .setContentText("Lắng nghe cục bộ tại 127.0.0.1:8765")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }
}
