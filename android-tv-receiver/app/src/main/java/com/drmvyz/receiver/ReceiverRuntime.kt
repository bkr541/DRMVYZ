package com.drmvyz.receiver

import android.content.Context
import android.hardware.display.DisplayManager
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.Display
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

class ReceiverRuntime(private val context: Context) {
    data class Snapshot(
        val state: ReceiverState,
        val message: String?,
        val discoveryNote: String?,
        val deviceId: String,
        val receiverName: String,
        val port: Int,
        val activeSession: ReceiverSession?,
    )

    interface Listener {
        fun onSnapshot(snapshot: Snapshot)
        fun onPairingRequest(request: PairingRequest?)
        fun onSessionChanged(session: ReceiverSession?)
    }

    private data class PendingPair(
        val request: PairingRequest,
        val completion: CompletableFuture<Boolean>,
    )

    private val lock = Any()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val identityStore = IdentityStore(context)
    private val trustStore = ReceiverTrustStore(context)
    private val secureRandom = SecureRandom()
    private val connectivityManager = context.getSystemService(ConnectivityManager::class.java)
    private val displayManager = context.getSystemService(DisplayManager::class.java)
    private val deviceId = identityStore.getOrCreateDeviceId()
    private val receiverName = ReceiverProtocol.cleanName("${Build.MODEL} · DRMVYZ", "Android TV · DRMVYZ", 120)

    @Volatile private var listener: Listener? = null
    private val stateMachine = ReceiverStateMachine()
    @Volatile private var discoveryNote: String? = null
    @Volatile private var activeSession: ReceiverSession? = null
    @Volatile private var pendingPair: PendingPair? = null
    @Volatile private var receiverToken = ""
    @Volatile private var httpServer: ReceiverHttpServer? = null
    @Volatile private var advertiser: DiscoveryAdvertiser? = null
    @Volatile private var started = false
    @Volatile private var currentNetwork: String? = null
    @Volatile private var networkCallbackRegistered = false

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            val value = network.toString()
            val previous = currentNetwork
            currentNetwork = value
            if (previous != null && previous != value) handleNetworkTopologyChange()
        }

        override fun onLost(network: Network) {
            if (currentNetwork == network.toString()) {
                currentNetwork = null
                handleNetworkTopologyChange()
            }
        }
    }

    fun attachListener(value: Listener) {
        listener = value
        emitSnapshot()
        mainHandler.post {
            value.onPairingRequest(pendingPair?.request)
            value.onSessionChanged(activeSession)
        }
    }

    fun detachListener(value: Listener) {
        if (listener === value) listener = null
    }

    fun start() {
        synchronized(lock) {
            if (started) {
                emitSnapshot()
                return
            }
            started = true
            receiverToken = randomToken(24)
            stateMachine.reset()
            discoveryNote = null
        }
        try {
            val server = ReceiverHttpServer(::handleHttpRequest)
            val port = server.start()
            httpServer = server
            advertiser = DiscoveryAdvertiser(
                context = context,
                deviceId = deviceId,
                receiverName = receiverName,
                port = port,
                receiverToken = receiverToken,
                onStatus = ::handleDiscoveryStatus,
            ).also { it.start() }
            registerNetworkCallback()
            setState(ReceiverState.Ready, "Waiting for a DRMVYZ sender")
        } catch (error: Exception) {
            synchronized(lock) { started = false }
            setState(ReceiverState.Error, "Receiver initialization failed: ${error.message ?: "unknown error"}")
        }
    }

    fun stop() {
        val pairToCancel: PendingPair?
        synchronized(lock) {
            if (!started && httpServer == null && advertiser == null) return
            started = false
            pairToCancel = pendingPair
            pendingPair = null
            activeSession = null
        }
        pairToCancel?.completion?.complete(false)
        unregisterNetworkCallback()
        advertiser?.stop()
        advertiser = null
        httpServer?.stop()
        httpServer = null
        mainHandler.removeCallbacksAndMessages(null)
        stateMachine.reset("Receiver stopped")
        discoveryNote = null
        emitPairing(null)
        emitSession(null)
        emitSnapshot()
    }

    fun respondToPairing(allow: Boolean) {
        val pending = synchronized(lock) {
            val value = pendingPair ?: return
            pendingPair = null
            value
        }
        pending.completion.complete(allow)
        emitPairing(null)
    }

    fun disconnectLocally() {
        val session = synchronized(lock) {
            val current = activeSession ?: return
            activeSession = null
            current
        }
        emitSession(null)
        setState(ReceiverState.Ready, "Disconnected from ${session.senderDeviceId.take(12)}")
    }

    fun reportPlaybackState(castId: String, playbackState: String) {
        val session = activeSession ?: return
        if (session.castId != castId) return
        when (playbackState) {
            "connected" -> setState(ReceiverState.Connected, "Live output")
            "connecting" -> if (stateMachine.state != ReceiverState.Connected) setState(ReceiverState.Connecting, "Connecting live output")
            "error", "ended" -> {
                setState(ReceiverState.Error, if (playbackState == "ended") "Sender ended the output" else "Output connection lost")
                mainHandler.postDelayed({
                    if (activeSession?.castId == castId) disconnectLocally()
                }, 1_800)
            }
        }
    }

    fun snapshot(): Snapshot = Snapshot(
        state = stateMachine.state,
        message = stateMachine.message,
        discoveryNote = discoveryNote,
        deviceId = deviceId,
        receiverName = receiverName,
        port = httpServer?.port ?: 0,
        activeSession = activeSession,
    )

    private fun handleHttpRequest(request: HttpRequest): HttpResponse {
        val path = request.path.substringBefore('?')
        if (request.method == "GET" && path == "/health") {
            return HttpResponse(200, JSONObject()
                .put("service", "drmvyz-android-tv-receiver")
                .put("discoveryVersion", ReceiverProtocol.DISCOVERY_VERSION)
                .put("protocolVersion", ReceiverProtocol.PROTOCOL_VERSION)
                .put("state", stateMachine.state.name))
        }

        if (request.method == "GET" && path == "/api/v2/capabilities") {
            if (!authorizeDiscoveredRequest(request)) {
                return HttpResponse.error(403, "Receiver capability requests require a discovered local-network receiver")
            }
            if (!isWebViewAvailable()) {
                return HttpResponse.error(503, "Android System WebView is unavailable; WebRTC decode cannot start")
            }
            val senderDeviceId = request.headers["x-drmvyz-sender-id"]
            val pairingToken = request.headers["x-drmvyz-pairing-token"]
            return HttpResponse(200, buildCapabilities(trustStore.verifySenderToken(senderDeviceId, pairingToken)))
        }

        if (request.method == "POST" && path == "/api/v2/pair") {
            if (!ReceiverProtocol.isPrivateNetworkAddress(request.remoteAddress)) {
                return HttpResponse.error(403, "Receiver pairing is limited to the local network")
            }
            val body = parseJson(request) ?: return HttpResponse.error(400, "Invalid receiver pairing request")
            if (body.optInt("protocolVersion", -1) != ReceiverProtocol.PROTOCOL_VERSION) {
                return HttpResponse.error(400, "Invalid receiver pairing request")
            }
            val senderDeviceId = body.optString("senderDeviceId")
            if (!ReceiverProtocol.isValidDeviceId(senderDeviceId) || body.optString("receiverToken") != receiverToken) {
                return HttpResponse.error(400, "Invalid receiver pairing request")
            }
            val senderName = ReceiverProtocol.cleanName(body.optString("senderName"), "DRMVYZ Sender")
            val approved = requestPairing(PairingRequest(senderDeviceId, senderName))
            if (!approved) return HttpResponse.error(403, "Pairing declined")
            val pairingToken = trustStore.pairSender(senderDeviceId, senderName)
            return HttpResponse(200, JSONObject()
                .put("protocolVersion", ReceiverProtocol.PROTOCOL_VERSION)
                .put("paired", true)
                .put("pairingToken", pairingToken))
        }

        if (request.method == "POST" && path == "/api/v2/sessions") {
            if (!ReceiverProtocol.isPrivateNetworkAddress(request.remoteAddress)) {
                return HttpResponse.error(403, "Receiver sessions are limited to the local network")
            }
            if (!isWebViewAvailable()) {
                return HttpResponse.error(503, "Android System WebView is unavailable; WebRTC decode cannot start")
            }
            val body = parseJson(request) ?: return HttpResponse.error(400, "Invalid receiver session request")
            val protocolVersion = body.optInt("protocolVersion", -1)
            if (protocolVersion != ReceiverProtocol.PROTOCOL_VERSION) {
                return HttpResponse.error(426, "DRMVYZ Receiver V${ReceiverProtocol.PROTOCOL_VERSION} session protocol is required")
            }
            val senderDeviceId = body.optString("senderDeviceId")
            val pairingToken = body.optString("pairingToken")
            val displayId = body.optString("displayId")
            val sourceUrl = body.optString("sourceUrl")
            val windowMode = body.optString("windowMode")
            val aspectRatio = body.optString("aspectRatio")
            if (body.optString("receiverToken") != receiverToken
                || !ReceiverProtocol.isValidDeviceId(senderDeviceId)
                || !trustStore.verifySenderToken(senderDeviceId, pairingToken)
                || !ReceiverProtocol.isAllowedSource(sourceUrl, request.remoteAddress)) {
                return HttpResponse.error(401, "Receiver session is not authorized")
            }
            if (displayId != ReceiverProtocol.DISPLAY_ID) {
                return HttpResponse.error(409, "Selected receiver display is no longer available")
            }
            if (!ReceiverProtocol.WINDOW_MODES.contains(windowMode) || !ReceiverProtocol.ASPECT_RATIOS.contains(aspectRatio)) {
                return HttpResponse.error(400, "Receiver session options are invalid")
            }

            val session = ReceiverSession(
                castId = java.util.UUID.randomUUID().toString(),
                controlToken = randomToken(24),
                senderDeviceId = senderDeviceId,
                pairingToken = pairingToken,
                displayId = displayId,
                sourceUrl = sourceUrl,
                windowMode = windowMode,
                aspectRatio = aspectRatio,
            )
            synchronized(lock) { activeSession = session }
            emitSession(session)
            setState(ReceiverState.Connecting, "Connecting live output")
            return HttpResponse(200, JSONObject()
                .put("protocolVersion", ReceiverProtocol.PROTOCOL_VERSION)
                .put("castId", session.castId)
                .put("controlToken", session.controlToken)
                .put("selectedDisplay", session.displayId)
                .put("qualityPolicy", qualityPolicy(body.optJSONObject("qualityPolicy"))))
        }

        val stopMatch = Regex("^/api/v2/sessions/([^/]+)/stop$").matchEntire(path)
        if (request.method == "POST" && stopMatch != null) {
            if (!ReceiverProtocol.isPrivateNetworkAddress(request.remoteAddress)) {
                return HttpResponse.error(403, "Receiver session control is limited to the local network")
            }
            val body = parseJson(request) ?: return HttpResponse.error(404, "Receiver session not found")
            val castId = java.net.URLDecoder.decode(stopMatch.groupValues[1], Charsets.UTF_8.name())
            val session = activeSession
            if (session == null
                || session.castId != castId
                || body.optString("receiverToken") != receiverToken
                || body.optString("controlToken") != session.controlToken
                || body.optString("senderDeviceId") != session.senderDeviceId
                || !trustStore.verifySenderToken(body.optString("senderDeviceId"), body.optString("pairingToken"))) {
                return HttpResponse.error(404, "Receiver session not found")
            }
            synchronized(lock) { if (activeSession?.castId == castId) activeSession = null }
            emitSession(null)
            setState(ReceiverState.Ready, "Waiting for a DRMVYZ sender")
            return HttpResponse.empty()
        }

        if (request.method == "POST" && (path == "/api/start-cast" || path == "/api/stop-cast")) {
            return HttpResponse(426, JSONObject()
                .put("error", "DRMVYZ Receiver V${ReceiverProtocol.PROTOCOL_VERSION} session protocol is required")
                .put("protocolVersion", ReceiverProtocol.PROTOCOL_VERSION))
        }

        return HttpResponse.empty(404)
    }

    private fun authorizeDiscoveredRequest(request: HttpRequest): Boolean {
        return ReceiverProtocol.isPrivateNetworkAddress(request.remoteAddress)
            && request.headers["x-drmvyz-receiver-token"] == receiverToken
    }

    private fun parseJson(request: HttpRequest): JSONObject? = try {
        if (request.body.isEmpty()) JSONObject() else JSONObject(String(request.body, Charsets.UTF_8))
    } catch (_: Exception) {
        null
    }

    private fun buildCapabilities(paired: Boolean): JSONObject {
        val display = currentDisplayCapability()
        return JSONObject()
            .put("protocol", JSONObject()
                .put("name", ReceiverProtocol.PROTOCOL_NAME)
                .put("version", ReceiverProtocol.PROTOCOL_VERSION)
                .put("minVersion", ReceiverProtocol.PROTOCOL_MIN_VERSION))
            .put("device", JSONObject().put("id", deviceId).put("name", receiverName))
            .put("pairing", JSONObject().put("required", true).put("paired", paired))
            .put("displays", JSONArray().put(JSONObject()
                .put("id", display.id)
                .put("name", display.name)
                .put("width", display.width)
                .put("height", display.height)
                .put("scaleFactor", display.scaleFactor.toDouble())
                .put("refreshRate", display.refreshRate ?: JSONObject.NULL)
                .put("primary", display.primary)))
            .put("video", JSONObject()
                .put("transport", "webrtc")
                .put("codecNegotiation", "webrtc-sdp")
                .put("codecs", JSONArray().put("video/VP8"))
                .put("maxLongEdge", ReceiverProtocol.MAX_LONG_EDGE)
                .put("maxShortEdge", ReceiverProtocol.MAX_SHORT_EDGE)
                .put("maxFps", ReceiverProtocol.MAX_FPS)
                .put("maxVideoBitrateKbps", ReceiverProtocol.MAX_VIDEO_BITRATE_KBPS)
                .put("statsIntervalMs", ReceiverProtocol.STATS_INTERVAL_MS))
    }

    private fun qualityPolicy(value: JSONObject?): JSONObject {
        fun clamped(name: String, fallback: Int, minimum: Int, maximum: Int): Int {
            val candidate = value?.optDouble(name, Double.NaN) ?: Double.NaN
            return if (candidate.isFinite() && candidate >= minimum) candidate.toInt().coerceAtMost(maximum) else fallback
        }
        return JSONObject()
            .put("maxLongEdge", clamped("maxLongEdge", ReceiverProtocol.MAX_LONG_EDGE, 320, 7680))
            .put("maxShortEdge", clamped("maxShortEdge", ReceiverProtocol.MAX_SHORT_EDGE, 240, 4320))
            .put("maxFps", clamped("maxFps", ReceiverProtocol.MAX_FPS, 1, 120))
            .put("maxVideoBitrateKbps", clamped("maxVideoBitrateKbps", ReceiverProtocol.MAX_VIDEO_BITRATE_KBPS, 250, 100_000))
            .put("codecNegotiation", "webrtc-sdp")
    }

    private fun currentDisplayCapability(): ReceiverDisplayCapability {
        val display = displayManager?.getDisplay(Display.DEFAULT_DISPLAY)
        val mode = display?.mode
        val metrics = context.resources.displayMetrics
        val width = mode?.physicalWidth?.takeIf { it > 0 } ?: metrics.widthPixels.coerceAtLeast(1)
        val height = mode?.physicalHeight?.takeIf { it > 0 } ?: metrics.heightPixels.coerceAtLeast(1)
        val refresh = mode?.refreshRate?.takeIf { it > 0f }?.toInt()
        return ReceiverDisplayCapability(
            id = ReceiverProtocol.DISPLAY_ID,
            name = "TV Display",
            width = width,
            height = height,
            scaleFactor = metrics.density.takeIf { it > 0f } ?: 1f,
            refreshRate = refresh,
            primary = true,
        )
    }

    private fun requestPairing(request: PairingRequest): Boolean {
        val future = CompletableFuture<Boolean>()
        synchronized(lock) {
            if (pendingPair != null) return false
            pendingPair = PendingPair(request, future)
        }
        setState(ReceiverState.Pairing, "Pairing request from ${request.senderName}")
        emitPairing(request)
        val approved = try {
            future.get(30, TimeUnit.SECONDS)
        } catch (_: TimeoutException) {
            false
        } catch (_: Exception) {
            false
        } finally {
            synchronized(lock) {
                if (pendingPair?.completion === future) pendingPair = null
            }
            emitPairing(null)
        }
        if (activeSession == null) setState(ReceiverState.Ready, "Waiting for a DRMVYZ sender")
        return approved
    }

    private fun isWebViewAvailable(): Boolean = try {
        WebView.getCurrentWebViewPackage() != null
    } catch (_: Exception) {
        false
    }

    private fun randomToken(byteCount: Int): String {
        val bytes = ByteArray(byteCount)
        secureRandom.nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    private fun setState(value: ReceiverState, message: String?) {
        stateMachine.transition(value, message)
        emitSnapshot()
    }

    private fun handleDiscoveryStatus(message: String?) {
        discoveryNote = message
        if (message?.startsWith("Receiver discovery unavailable") == true && activeSession == null) {
            setState(ReceiverState.Error, message)
        } else {
            emitSnapshot()
        }
    }

    private fun registerNetworkCallback() {
        if (networkCallbackRegistered || connectivityManager == null) return
        try {
            connectivityManager.registerDefaultNetworkCallback(networkCallback)
            networkCallbackRegistered = true
        } catch (error: Exception) {
            discoveryNote = "Network lifecycle monitoring unavailable: ${error.message ?: "permission/configuration required"}"
            emitSnapshot()
        }
    }

    private fun unregisterNetworkCallback() {
        if (!networkCallbackRegistered || connectivityManager == null) return
        try { connectivityManager.unregisterNetworkCallback(networkCallback) } catch (_: Exception) { }
        networkCallbackRegistered = false
        currentNetwork = null
    }

    private fun handleNetworkTopologyChange() {
        mainHandler.postDelayed({
            if (!started) return@postDelayed
            val pairing = synchronized(lock) {
                val value = pendingPair
                pendingPair = null
                value
            }
            pairing?.completion?.complete(false)
            if (pairing != null) emitPairing(null)
            val session = activeSession
            if (session != null) {
                synchronized(lock) { activeSession = null }
                emitSession(null)
                setState(ReceiverState.Error, "Network changed; live output was disconnected")
                mainHandler.postDelayed({ if (activeSession == null && started) setState(ReceiverState.Ready, "Waiting for a DRMVYZ sender") }, 1_200)
            }
            advertiser?.stop()
            val port = httpServer?.port ?: return@postDelayed
            advertiser = DiscoveryAdvertiser(context, deviceId, receiverName, port, receiverToken, ::handleDiscoveryStatus).also { it.start() }
        }, 500)
    }

    private fun emitSnapshot() {
        val target = listener ?: return
        val value = snapshot()
        mainHandler.post { if (listener === target) target.onSnapshot(value) }
    }

    private fun emitPairing(request: PairingRequest?) {
        val target = listener ?: return
        mainHandler.post { if (listener === target) target.onPairingRequest(request) }
    }

    private fun emitSession(session: ReceiverSession?) {
        val target = listener ?: return
        mainHandler.post { if (listener === target) target.onSessionChanged(session) }
    }
}
