package com.sulfuric.assistant

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * Phone control actions the assistant can run.
 *
 * Every action returns a short human-readable result string, so the chat can
 * tell the user what actually happened.
 */
object PhoneControl {

    fun run(context: Context, action: String, arg: String?): String {
        return when (action) {
            "flashlight" -> flashlight(context, arg)
            "open_app" -> openApp(context, arg)
            "volume" -> volume(context, arg)
            "brightness" -> brightness(context, arg)
            "panel" -> openPanel(context, arg)
            "home" -> goHome(context)
            "apps" -> listApps(context)
            else -> "Unknown action: $action"
        }
    }

    /* ---------------- flashlight ---------------- */

    private val torchState = HashMap<String, Boolean>()

    private fun flashlight(context: Context, arg: String?): String {
        return try {
            val manager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
                ?: return "Camera service is unavailable"
            val cameraId = manager.cameraIdList.firstOrNull { id ->
                manager.getCameraCharacteristics(id)
                    .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            } ?: manager.cameraIdList.firstOrNull()
            ?: return "No camera found"

            val want = when (arg?.trim()?.lowercase()) {
                "on", "true", "1", "nyala", "nyalain", "nyalakan", "hidupkan" -> true
                "off", "false", "0", "mati", "matiin", "matikan", "padamkan" -> false
                else -> null
            }
            // Toggle when no explicit state was given.
            val turnOn = want ?: !(torchState[cameraId] ?: false)
            manager.setTorchMode(cameraId, turnOn)
            torchState[cameraId] = turnOn
            if (turnOn) "Flashlight is ON" else "Flashlight is OFF"
        } catch (e: Exception) {
            "Could not switch the flashlight: ${e.message}"
        }
    }

    /* ---------------- open apps ---------------- */

    private fun openApp(context: Context, query: String?): String {
        val q = query?.trim()?.lowercase()?.replace(Regex("[?.!]+$"), "").orEmpty()
        if (q.isEmpty()) return "Tell me which app to open"
        val pm = context.packageManager

        // Exact package match first.
        pm.getLaunchIntentForPackage(q)?.let {
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(it)
            return "Opening $q"
        }

        // Then match by app label.
        val apps = pm.getInstalledApplications(0)
        val match = apps.firstOrNull { info ->
            pm.getApplicationLabel(info).toString().lowercase().contains(q)
        } ?: return "I could not find an app called \"$query\""

        val pkg = match.packageName
        val label = pm.getApplicationLabel(match).toString()
        val intent = pm.getLaunchIntentForPackage(pkg)
        if (intent == null) return "I cannot open $label"
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return "Opening $label"
    }

    private fun listApps(context: Context): String {
        val pm = context.packageManager
        val launchable = pm.getInstalledApplications(0)
            .count { pm.getLaunchIntentForPackage(it.packageName) != null }
        return "$launchable launchable apps on this phone"
    }

    /* ---------------- volume ---------------- */

    private fun volume(context: Context, arg: String?): String {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            ?: return "Audio service is unavailable"
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val current = am.getStreamVolume(AudioManager.STREAM_MUSIC)
        val text = arg?.trim()?.lowercase().orEmpty()

        val target = when {
            text.contains("naik") || text.contains("up") || text.contains("tambah") ->
                (current + 1).coerceAtMost(max)
            text.contains("turun") || text.contains("down") || text.contains("kurang") ->
                (current - 1).coerceAtLeast(0)
            text.contains("bisu") || text.contains("mute") -> 0
            else -> {
                val pct = text.filter { it.isDigit() }.toIntOrNull()
                    ?: return "Volume is $current of $max"
                (max * (pct.coerceIn(0, 100)) / 100)
            }
        }
        am.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
        val pct = if (max > 0) target * 100 / max else 0
        return "Volume set to $pct%"
    }

    /* ---------------- brightness ---------------- */

    private fun brightness(context: Context, arg: String?): String {
        val pct = arg?.filter { it.isDigit() }?.toIntOrNull()?.coerceIn(0, 100)
        if (pct == null) {
            return try {
                val now = Settings.System.getInt(
                    context.contentResolver,
                    Settings.System.SCREEN_BRIGHTNESS
                )
                "Brightness is $now of 255"
            } catch (e: Exception) {
                "Tell me a brightness level, for example: brightness 50"
            }
        }
        if (!Settings.System.canWrite(context)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_WRITE_SETTINGS,
                Uri.parse("package:${context.packageName}")
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            return "I need permission to change system settings - tap Allow"
        }
        return try {
            Settings.System.putInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS,
                pct * 255 / 100
            )
            "Brightness set to $pct%"
        } catch (e: Exception) {
            "Could not set brightness: ${e.message}"
        }
    }

    /* ---------------- system panels ---------------- */

    private fun openPanel(context: Context, arg: String?): String {
        val which = arg?.trim()?.lowercase().orEmpty()
        val label = if (which.isEmpty()) "internet" else which
        val intent = Intent(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                when (which) {
                    "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
                    "nfc" -> Settings.ACTION_NFC_SETTINGS
                    else -> Settings.Panel.ACTION_INTERNET_CONNECTIVITY
                }
            } else {
                when (which) {
                    "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
                    "nfc" -> Settings.ACTION_NFC_SETTINGS
                    else -> Settings.ACTION_WIFI_SETTINGS
                }
            }
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            context.startActivity(intent)
            "Opening $label settings"
        } catch (e: Exception) {
            "Could not open that panel: ${e.message}"
        }
    }

    /* ---------------- navigation ---------------- */

    private fun goHome(context: Context): String {
        val intent = Intent(Intent.ACTION_MAIN)
        intent.addCategory(Intent.CATEGORY_HOME)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return "Going home"
    }
}

/** WebView bridge: window.AndroidControl.run(action, arg) -> result string. */
class ControlBridge(private val context: Context) {
    @android.webkit.JavascriptInterface
    fun run(action: String, arg: String?): String = PhoneControl.run(context, action, arg)
}
