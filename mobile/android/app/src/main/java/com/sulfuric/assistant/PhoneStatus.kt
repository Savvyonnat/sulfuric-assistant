package com.sulfuric.assistant

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.StatFs
import android.os.SystemClock
import android.os.Environment
import org.json.JSONObject

/**
 * Reads this phone's state so the assistant can answer "how is my phone?".
 * Everything here is read-only and needs no runtime permission except
 * ACCESS_NETWORK_STATE (declared in the manifest).
 */
object PhoneStatus {

    fun collect(context: Context): JSONObject {
        val json = JSONObject()
        json.put("device", device())
        json.put("battery", battery(context))
        json.put("storage", storage())
        json.put("memory", memory(context))
        json.put("network", network(context))
        json.put("uptimeSeconds", SystemClock.elapsedRealtime() / 1000L)
        return json
    }

    private fun device(): JSONObject = JSONObject().apply {
        put("manufacturer", Build.MANUFACTURER)
        put("model", Build.MODEL)
        put("android", Build.VERSION.RELEASE)
        put("sdk", Build.VERSION.SDK_INT)
    }

    private fun battery(context: Context): JSONObject {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        val percent = if (level >= 0 && scale > 0) (level * 100 / scale) else -1
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING
                || status == BatteryManager.BATTERY_STATUS_FULL
        val source = when (plugged) {
            BatteryManager.BATTERY_PLUGGED_AC -> "ac"
            BatteryManager.BATTERY_PLUGGED_USB -> "usb"
            BatteryManager.BATTERY_PLUGGED_WIRELESS -> "wireless"
            else -> "battery"
        }
        return JSONObject().apply {
            put("level", percent)
            put("charging", charging)
            put("source", source)
        }
    }

    private fun storage(): JSONObject = try {
        val stat = StatFs(Environment.getExternalStorageDirectory().path)
        val total = stat.totalBytes
        val free = stat.availableBytes
        JSONObject().apply {
            put("total", total)
            put("free", free)
            put("used", total - free)
        }
    } catch (e: Exception) {
        JSONObject()
    }

    private fun memory(context: Context): JSONObject {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            ?: return JSONObject()
        val info = ActivityManager.MemoryInfo()
        am.getMemoryInfo(info)
        return JSONObject().apply {
            put("total", info.totalMem)
            put("available", info.availMem)
            put("low", info.lowMemory)
        }
    }

    private fun network(context: Context): JSONObject {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return JSONObject()
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
            ?: return JSONObject().apply { put("online", false) }
        val type = when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
            else -> "other"
        }
        return JSONObject().apply {
            put("online", true)
            put("type", type)
        }
    }
}

/** WebView bridge: window.AndroidPhone.status() -> phone state JSON. */
class PhoneBridge(private val context: Context) {
    @android.webkit.JavascriptInterface
    fun status(): String = PhoneStatus.collect(context).toString()
}
