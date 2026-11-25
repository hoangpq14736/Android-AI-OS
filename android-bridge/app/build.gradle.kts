plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "ai.os.bridge"
    compileSdk = 35

    defaultConfig {
        applicationId = "ai.os.bridge"
        minSdk = 34
        targetSdk = 35
        versionCode = 100
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Khi build cục bộ nhanh, có thể ký bằng keystore cấu hình qua env vars
            // hoặc ký hậu kỳ bằng apksigner (xem docs/BUILD_SIGN_FLASH.md).
            signingConfig = signingConfigs.getByName("debug")
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        // Bỏ qua cảnh báo quyền chỉ dành cho system/priv-app vì APK sẽ được mount vào /system/priv-app
        disable += setOf("ProtectedPermissions", "MissingPermission")
        abortOnError = false
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Tối giản tuyệt đối: không dùng Ktor/Netty nặng; HTTP server dùng java.net.ServerSocket thuần
    implementation("androidx.core:core-ktx:1.15.0")
}
