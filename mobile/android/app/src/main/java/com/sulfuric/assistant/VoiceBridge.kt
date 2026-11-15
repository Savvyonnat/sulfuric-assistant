package com.sulfuric.assistant

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * Bridges the WebView mic button to Android's SpeechRecognizer, because
 * WebView does not implement the Web Speech API.
 *
 * JS side (app.js):
 *   window.AndroidVoice.isAvailable() -> Boolean
 *   window.AndroidVoice.start()
 *   window.onAndroidVoiceResult(text)
 *   window.onAndroidVoiceError(message)
 */
class VoiceBridge(private val activity: Activity, private val webView: WebView) {

    private val handler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null

    @JavascriptInterface
    fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(activity)

    @JavascriptInterface
    fun start() {
        handler.post {
            if (recognizer == null) {
                val sr = SpeechRecognizer.createSpeechRecognizer(activity)
                sr.setRecognitionListener(object : RecognitionListener {
                    override fun onResults(results: Bundle?) {
                        val text = results
                            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull()
                        emit("window.onAndroidVoiceResult", text)
                    }

                    override fun onError(error: Int) {
                        emit("window.onAndroidVoiceError", "code $error")
                    }

                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onPartialResults(partialResults: Bundle?) {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
                recognizer = sr
            }
            recognizer?.cancel()
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "id-ID")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "id-ID")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            }
            recognizer?.startListening(intent)
        }
    }

    private fun emit(jsFunction: String, arg: String?) {
        val js = "$jsFunction(${JSONObject.quote(arg)})"
        handler.post { webView.evaluateJavascript(js, null) }
    }
}
