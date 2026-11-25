# Giữ lại toàn bộ lớp bridge để đảm bảo Reflection và Service binding không bị đổi tên
-keep class ai.os.bridge.** { *; }
-dontwarn android.view.SurfaceControl
-dontwarn android.window.ScreenCapture
-dontwarn android.hardware.input.InputManager
-dontwarn android.hardware.input.InputManagerGlobal
-dontwarn android.app.ActivityTaskManager
-dontwarn dalvik.system.VMRuntime
