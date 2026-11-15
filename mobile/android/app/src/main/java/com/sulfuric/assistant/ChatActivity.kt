package com.sulfuric.assistant

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.sulfuric.assistant.databinding.ActivityChatBinding

/**
 * Full-screen chat. Loads the bundled PWA (assets/www) so the same chat UI
 * and settings work inside the native app.
 */
class ChatActivity : AppCompatActivity() {

    private lateinit var binding: ActivityChatBinding
    private var voiceBridge: VoiceBridge? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityChatBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.closeChat.setOnClickListener { finish() }

        val web = binding.webView
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.databaseEnabled = true
        web.settings.allowFileAccess = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.webViewClient = WebViewClient()
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                // The bundled UI asks for mic access through the native bridge;
                // grant so WebView-level prompts do not block.
                request.grant(request.resources)
            }
        }

        voiceBridge = VoiceBridge(this, web)
        web.addJavascriptInterface(voiceBridge!!, "AndroidVoice")
        web.addJavascriptInterface(PhoneBridge(this), "AndroidPhone")

        web.loadUrl("file:///android_asset/www/index.html")
    }

    override fun onDestroy() {
        (binding.webView.parent as? ViewGroup)?.removeView(binding.webView)
        binding.webView.destroy()
        super.onDestroy()
    }
}
