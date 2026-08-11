package com.drmvyz.receiver

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import java.net.URI

class MainActivity : Activity(), ReceiverRuntime.Listener {
    private val runtime: ReceiverRuntime
        get() = (application as DrmvyzReceiverApplication).runtime

    private val uiHandler = Handler(Looper.getMainLooper())
    private lateinit var root: FrameLayout
    private lateinit var statusPanel: LinearLayout
    private lateinit var stateLabel: TextView
    private lateinit var messageLabel: TextView
    private lateinit var identityLabel: TextView
    private lateinit var discoveryLabel: TextView
    private lateinit var pairingPanel: LinearLayout
    private lateinit var pairingSender: TextView
    private lateinit var allowButton: Button
    private lateinit var denyButton: Button
    private lateinit var webView: WebView
    private var loadedCastId: String? = null
    private var pollingCastId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enterImmersiveMode()
        buildUi()
    }

    override fun onStart() {
        super.onStart()
        runtime.attachListener(this)
        runtime.start()
    }

    override fun onStop() {
        if (!isChangingConfigurations) {
            onSessionChanged(null)
            runtime.stop()
        }
        runtime.detachListener(this)
        super.onStop()
    }

    override fun onDestroy() {
        stopPlaybackPolling()
        if (isChangingConfigurations && runtime.snapshot().activeSession != null) runtime.disconnectLocally()
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_UP && event.keyCode == KeyEvent.KEYCODE_BACK && runtime.snapshot().activeSession != null) {
            runtime.disconnectLocally()
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersiveMode()
    }

    override fun onSnapshot(snapshot: ReceiverRuntime.Snapshot) {
        stateLabel.text = snapshot.state.name.uppercase()
        stateLabel.setTextColor(if (snapshot.state == ReceiverState.Error) getColor(R.color.receiver_error) else getColor(R.color.receiver_accent))
        messageLabel.text = snapshot.message ?: ""
        identityLabel.text = "${snapshot.receiverName}\nID ${snapshot.deviceId}  •  PORT ${snapshot.port.takeIf { it > 0 } ?: "—"}"
        discoveryLabel.text = snapshot.discoveryNote ?: "Visible to DRMVYZ senders on this local network"
        discoveryLabel.setTextColor(if (snapshot.discoveryNote?.startsWith("Receiver discovery unavailable") == true) getColor(R.color.receiver_error) else getColor(R.color.receiver_muted))
    }

    override fun onPairingRequest(request: PairingRequest?) {
        pairingPanel.visibility = if (request == null) View.GONE else View.VISIBLE
        if (request == null) return
        pairingSender.text = "Allow ${request.senderName} to cast to this TV?\n\nSender ID: ${request.senderDeviceId}"
        allowButton.requestFocus()
    }

    override fun onSessionChanged(session: ReceiverSession?) {
        if (session == null) {
            loadedCastId = null
            stopPlaybackPolling()
            webView.stopLoading()
            webView.loadUrl("about:blank")
            webView.visibility = View.GONE
            statusPanel.visibility = View.VISIBLE
            return
        }
        if (loadedCastId == session.castId) return
        loadedCastId = session.castId
        statusPanel.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.loadUrl(session.sourceUrl)
        startPlaybackPolling(session.castId)
    }

    private fun buildUi() {
        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        setContentView(root)

        webView = createReceiverWebView()
        root.addView(webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        statusPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(54), dp(42), dp(54), dp(42))
            setBackgroundColor(getColor(R.color.receiver_panel))
        }
        val panelParams = FrameLayout.LayoutParams(dp(660), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER)
        root.addView(statusPanel, panelParams)

        val title = TextView(this).apply {
            text = getString(R.string.ready_title)
            setTextColor(getColor(R.color.receiver_text))
            textSize = 34f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        statusPanel.addView(title, linearMatchWrap(bottom = 26))

        stateLabel = TextView(this).apply {
            text = getString(R.string.ready_state)
            setTextColor(getColor(R.color.receiver_accent))
            textSize = 16f
            letterSpacing = .16f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        statusPanel.addView(stateLabel, linearMatchWrap(bottom = 12))

        messageLabel = TextView(this).apply {
            setTextColor(getColor(R.color.receiver_text))
            textSize = 18f
            gravity = Gravity.CENTER
        }
        statusPanel.addView(messageLabel, linearMatchWrap(bottom = 28))

        identityLabel = TextView(this).apply {
            setTextColor(getColor(R.color.receiver_muted))
            textSize = 13f
            gravity = Gravity.CENTER
        }
        statusPanel.addView(identityLabel, linearMatchWrap(bottom = 18))

        discoveryLabel = TextView(this).apply {
            setTextColor(getColor(R.color.receiver_muted))
            textSize = 13f
            gravity = Gravity.CENTER
        }
        statusPanel.addView(discoveryLabel, linearMatchWrap(bottom = 12))

        pairingPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            visibility = View.GONE
            setPadding(0, dp(24), 0, 0)
        }
        statusPanel.addView(pairingPanel, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        pairingSender = TextView(this).apply {
            setTextColor(getColor(R.color.receiver_text))
            textSize = 17f
            gravity = Gravity.CENTER
        }
        pairingPanel.addView(pairingSender, linearMatchWrap(bottom = 24))

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        pairingPanel.addView(actions, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        allowButton = Button(this).apply {
            text = getString(R.string.pair_allow)
            isAllCaps = false
            isFocusable = true
            setOnClickListener { runtime.respondToPairing(true) }
        }
        denyButton = Button(this).apply {
            text = getString(R.string.pair_deny)
            isAllCaps = false
            isFocusable = true
            setOnClickListener { runtime.respondToPairing(false) }
        }
        actions.addView(allowButton, LinearLayout.LayoutParams(dp(170), dp(58)).apply { marginEnd = dp(14) })
        actions.addView(denyButton, LinearLayout.LayoutParams(dp(170), dp(58)))
    }

    private fun createReceiverWebView(): WebView {
        return WebView(this).apply {
            visibility = View.GONE
            setBackgroundColor(Color.BLACK)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            settings.javaScriptEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.domStorageEnabled = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: android.webkit.PermissionRequest) {
                    request.deny()
                }
            }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    return !isAllowedNavigation(request.url.toString())
                }

                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                    if (request.isForMainFrame) loadedCastId?.let { runtime.reportPlaybackState(it, "error") }
                }

                override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                    if (request.isForMainFrame && errorResponse.statusCode >= 400) loadedCastId?.let { runtime.reportPlaybackState(it, "error") }
                }

                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    loadedCastId?.let { runtime.reportPlaybackState(it, "error") }
                    recreateWebViewAfterRendererFailure(view)
                    return true
                }
            }
        }
    }

    private fun recreateWebViewAfterRendererFailure(deadView: WebView) {
        stopPlaybackPolling()
        val index = root.indexOfChild(deadView)
        root.removeView(deadView)
        deadView.destroy()
        webView = createReceiverWebView()
        root.addView(webView, index.coerceAtLeast(0), FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        loadedCastId = null
    }

    private fun isAllowedNavigation(candidate: String): Boolean {
        if (candidate == "about:blank") return true
        val session = runtime.snapshot().activeSession ?: return false
        return try {
            val allowed = URI(session.sourceUrl)
            val value = URI(candidate)
            value.scheme == "http"
                && value.host == allowed.host
                && value.port == allowed.port
                && value.path == "/receiver"
                && value.rawQuery == allowed.rawQuery
        } catch (_: Exception) {
            false
        }
    }

    private fun startPlaybackPolling(castId: String) {
        stopPlaybackPolling()
        pollingCastId = castId
        val runnable = object : Runnable {
            override fun run() {
                if (pollingCastId != castId || loadedCastId != castId) return
                webView.evaluateJavascript("document.body && document.body.dataset ? (document.body.dataset.state || '') : ''") { raw ->
                    val value = try { JSONArray("[$raw]").optString(0) } catch (_: Exception) { "" }
                    if (value.isNotBlank()) runtime.reportPlaybackState(castId, value)
                }
                uiHandler.postDelayed(this, 500)
            }
        }
        uiHandler.postDelayed(runnable, 500)
    }

    private fun stopPlaybackPolling() {
        pollingCastId = null
        uiHandler.removeCallbacksAndMessages(null)
    }

    private fun enterImmersiveMode() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun linearMatchWrap(bottom: Int = 0): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(bottom)
        }
}
