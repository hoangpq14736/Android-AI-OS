package ai.os.bridge

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat

/**
 * Activity tối giản không cần XML layout phức tạp:
 * xin quyền POST_NOTIFICATIONS nếu thiếu, kích hoạt AiOsBridgeService rồi hiển thị trạng thái ngắn gọn.
 */
class MainActivity : Activity() {

    companion object {
        private const val REQ_POST_NOTIFICATIONS = 1001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_POST_NOTIFICATIONS)
        }

        startBridgeService()

        val statusView = TextView(this).apply {
            text = buildString {
                append("AI OS Bridge (ai.os.bridge)\n\n")
                append("Endpoint nội bộ: http://127.0.0.1:8765\n")
                append("GET /health\n")
                append("GET /ui_info\n")
                append("GET /screenshot\n")
                append("POST /action\n\n")
                append("Trạng thái: Foreground Service đã khởi chạy.")
            }
            setTextColor(Color.parseColor("#E2E8F0"))
            textSize = 14f
            setPadding(48, 64, 48, 64)
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#0F172A"))
            addView(statusView)
        }

        setContentView(container)
    }

    private fun startBridgeService() {
        val intent = Intent(this, AiOsBridgeService::class.java)
        ContextCompat.startForegroundService(this, intent)
    }
}
