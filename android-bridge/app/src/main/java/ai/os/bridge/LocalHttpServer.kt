package ai.os.bridge

import android.util.Log
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.nio.charset.StandardCharsets
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * HTTP/1.1 JSON Server thuần Java (java.net.ServerSocket) không phụ thuộc thư viện nặng.
 * Chỉ bind duy nhất trên loopback 127.0.0.1:8765 để đảm bảo an toàn tuyệt đối khỏi mạng ngoài.
 */
class LocalHttpServer(
    private val host: String = "127.0.0.1",
    private val port: Int = 8765,
    private val screenCapturer: ScreenCapturer,
    private val inputInjector: InputInjector,
    private val uiInfoProvider: UiInfoProvider
) {
    companion object {
        private const val TAG = "AiOsHttpServer"
        private const val MAX_BODY_BYTES = 1024 * 1024 // 1 MB
    }

    private val running = AtomicBoolean(false)
    private var serverSocket: ServerSocket? = null
    private var acceptThread: Thread? = null
    private var workerPool: ExecutorService? = null

    fun start() {
        if (!running.compareAndSet(false, true)) return

        val bindAddr = InetAddress.getByName(host)
        val socket = ServerSocket(port, 32, bindAddr).apply {
            reuseAddress = true
        }
        serverSocket = socket
        workerPool = Executors.newFixedThreadPool(4)

        acceptThread = Thread({
            Log.i(TAG, "LocalHttpServer listening on http://$host:$port")
            while (running.get()) {
                try {
                    val client = socket.accept()
                    workerPool?.execute { handleClient(client) }
                } catch (se: SocketException) {
                    if (running.get()) {
                        Log.w(TAG, "Socket accept error: ${se.message}")
                    }
                } catch (t: Throwable) {
                    Log.e(TAG, "Unexpected accept loop error: ${t.message}", t)
                }
            }
        }, "AiOsHttpAccept").apply {
            isDaemon = true
            start()
        }
    }

    fun stop() {
        if (!running.compareAndSet(true, false)) return
        runCatching { serverSocket?.close() }
        serverSocket = null
        workerPool?.shutdownNow()
        workerPool = null
        acceptThread?.interrupt()
        acceptThread = null
        Log.i(TAG, "LocalHttpServer stopped.")
    }

    private fun handleClient(socket: Socket) {
        socket.use { client ->
            client.soTimeout = 15_000
            val input = BufferedInputStream(client.getInputStream())
            val output = client.getOutputStream()

            try {
                val request = parseHttpRequest(input) ?: return
                val path = request.path.substringBefore('?')

                when {
                    request.method == "GET" && path == "/health" -> {
                        val body = JSONObject().apply {
                            put("ok", true)
                            put("service", "ai.os.bridge")
                            put("listen", "$host:$port")
                            put("timestamp_ms", System.currentTimeMillis())
                        }
                        writeJsonResponse(output, 200, "OK", body)
                    }

                    request.method == "GET" && path == "/screenshot" -> {
                        val json = screenCapturer.captureAsJson()
                        writeJsonResponse(output, 200, "OK", json)
                    }

                    request.method == "GET" && path == "/ui_info" -> {
                        val json = uiInfoProvider.collectUiInfo()
                        writeJsonResponse(output, 200, "OK", json)
                    }

                    request.method == "POST" && path == "/action" -> {
                        val payload = JSONObject(request.body.ifBlank { "{}" })
                        val result = inputInjector.executeAction(payload)
                        writeJsonResponse(output, 200, "OK", result)
                    }

                    path in setOf("/health", "/screenshot", "/ui_info", "/action") -> {
                        writeError(output, 405, "Method Not Allowed", "Method ${request.method} không được hỗ trợ cho $path")
                    }

                    else -> {
                        writeError(output, 404, "Not Found", "Endpoint không tồn tại: $path")
                    }
                }
            } catch (iae: IllegalArgumentException) {
                writeError(output, 400, "Bad Request", iae.message ?: "Payload JSON không hợp lệ")
            } catch (t: Throwable) {
                Log.e(TAG, "Request failed: ${t.message}", t)
                writeError(output, 500, "Internal Server Error", t.message ?: "Lỗi nội bộ cầu nối")
            }
        }
    }

    private data class HttpRequest(
        val method: String,
        val path: String,
        val headers: Map<String, String>,
        val body: String
    )

    private fun parseHttpRequest(input: BufferedInputStream): HttpRequest? {
        val requestLine = readAsciiLine(input) ?: return null
        if (requestLine.isBlank()) return null

        val parts = requestLine.split(" ")
        if (parts.size < 2) return null
        val method = parts[0].uppercase()
        val path = parts[1]

        val headers = LinkedHashMap<String, String>()
        while (true) {
            val line = readAsciiLine(input) ?: break
            if (line.isEmpty()) break
            val idx = line.indexOf(':')
            if (idx > 0) {
                val key = line.substring(0, idx).trim().lowercase()
                val value = line.substring(idx + 1).trim()
                headers[key] = value
            }
        }

        val contentLength = headers["content-length"]?.toIntOrNull()?.coerceIn(0, MAX_BODY_BYTES) ?: 0
        val body = if (contentLength > 0) {
            val buffer = ByteArray(contentLength)
            var totalRead = 0
            while (totalRead < contentLength) {
                val n = input.read(buffer, totalRead, contentLength - totalRead)
                if (n == -1) break
                totalRead += n
            }
            String(buffer, 0, totalRead, StandardCharsets.UTF_8)
        } else {
            ""
        }

        return HttpRequest(method, path, headers, body)
    }

    private fun readAsciiLine(input: BufferedInputStream): String? {
        val baos = ByteArrayOutputStream()
        var prev = -1
        while (true) {
            val b = input.read()
            if (b == -1) {
                return if (baos.size() == 0) null else baos.toString("UTF-8")
            }
            if (b == '\n'.code) {
                val bytes = baos.toByteArray()
                val len = if (prev == '\r'.code && bytes.isNotEmpty()) bytes.size - 1 else bytes.size
                return String(bytes, 0, len, StandardCharsets.UTF_8)
            }
            baos.write(b)
            prev = b
        }
    }

    private fun writeError(output: OutputStream, status: Int, reason: String, message: String) {
        val json = JSONObject().apply {
            put("ok", false)
            put("error", message)
            put("status", status)
        }
        writeJsonResponse(output, status, reason, json)
    }

    private fun writeJsonResponse(output: OutputStream, status: Int, reason: String, json: JSONObject) {
        val bodyBytes = json.toString().toByteArray(StandardCharsets.UTF_8)
        val headers = buildString {
            append("HTTP/1.1 ").append(status).append(' ').append(reason).append("\r\n")
            append("Content-Type: application/json; charset=utf-8\r\n")
            append("Content-Length: ").append(bodyBytes.size).append("\r\n")
            append("Cache-Control: no-store\r\n")
            append("Connection: close\r\n")
            append("\r\n")
        }
        output.write(headers.toByteArray(StandardCharsets.US_ASCII))
        output.write(bodyBytes)
        output.flush()
    }
}
