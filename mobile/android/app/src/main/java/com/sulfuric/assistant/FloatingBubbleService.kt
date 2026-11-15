package com.sulfuric.assistant

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Draws a draggable floating bubble on top of other apps. Tapping it opens the
 * chat; the little "x" stops the service.
 */
class FloatingBubbleService : Service() {

    private var windowManager: WindowManager? = null
    private var bubbleView: View? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        } else 0
        ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(), type)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (bubbleView == null) showBubble()
        return START_STICKY
    }

    override fun onDestroy() {
        bubbleView?.let { windowManager?.removeView(it) }
        bubbleView = null
        super.onDestroy()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Sulfuric bubble", NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val tap = PendingIntent.getActivity(
            this, 0,
            Intent(this, ChatActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sulfuric aktif")
            .setContentText("Bubble assistant sedang berjalan")
            .setSmallIcon(R.drawable.ic_bubble)
            .setContentIntent(tap)
            .setOngoing(true)
            .build()
    }

    @SuppressLint("ClickableViewAccessibility", "InflateParams")
    private fun showBubble() {
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        windowManager = wm

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 0
            y = 400
        }

        val view = LayoutInflater.from(this).inflate(R.layout.floating_bubble, null)
        bubbleView = view

        var initialX = 0
        var initialY = 0
        var touchX = 0f
        var touchY = 0f
        var moved = false

        val bubble = view.findViewById<View>(R.id.bubble)
        val closeBtn = view.findViewById<View>(R.id.closeBtn)

        bubble.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    touchX = event.rawX
                    touchY = event.rawY
                    moved = false
                    closeBtn.visibility = View.VISIBLE
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - touchX).toInt()
                    val dy = (event.rawY - touchY).toInt()
                    if (dx * dx + dy * dy > 25) moved = true
                    params.x = initialX + dx
                    params.y = initialY + dy
                    wm.updateViewLayout(view, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    closeBtn.visibility = View.GONE
                    if (!moved) {
                        val intent = Intent(this, ChatActivity::class.java)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent)
                    }
                    true
                }
                else -> false
            }
        }

        closeBtn.setOnClickListener {
            Toast.makeText(this, "Bubble turned off", Toast.LENGTH_SHORT).show()
            stopSelf()
        }

        wm.addView(view, params)
    }

    companion object {
        private const val CHANNEL_ID = "sulfuric_bubble"
        private const val NOTIF_ID = 1001
    }
}
