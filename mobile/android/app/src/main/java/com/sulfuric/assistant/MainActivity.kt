package com.sulfuric.assistant

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.sulfuric.assistant.databinding.ActivityMainBinding

/**
 * Launcher screen: asks for the two permissions the floating bubble needs,
 * then starts the overlay service.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private val audioPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private val cameraPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.openChat.setOnClickListener {
            startActivity(Intent(this, ChatActivity::class.java))
        }

        binding.enableOverlay.setOnClickListener {
            if (Settings.canDrawOverlays(this)) {
                startBubble()
            } else {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
                startActivity(intent)
                Toast.makeText(this, "Allow 'Display over other apps'", Toast.LENGTH_LONG).show()
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        audioPermission.launch(Manifest.permission.RECORD_AUDIO)
        cameraPermission.launch(Manifest.permission.CAMERA)

        updateStatus()
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
        // If the permission was just granted, start the bubble automatically.
        if (Settings.canDrawOverlays(this) && binding.enableOverlay.tag == "asked") {
            binding.enableOverlay.tag = null
            startBubble()
        }
    }

    private fun updateStatus() {
        val granted = Settings.canDrawOverlays(this)
        binding.status.text = if (granted) {
            "Overlay permission: GRANTED. The bubble is ready."
        } else {
            "Overlay permission: NOT GRANTED. Tap the button above."
        }
        binding.enableOverlay.tag = if (granted) null else "asked"
    }

    private fun startBubble() {
        val intent = Intent(this, FloatingBubbleService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        Toast.makeText(this, "Sulfuric bubble active", Toast.LENGTH_SHORT).show()
    }
}
