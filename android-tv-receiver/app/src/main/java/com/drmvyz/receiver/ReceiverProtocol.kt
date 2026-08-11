package com.drmvyz.receiver

import java.net.URI
import java.util.Locale

enum class ReceiverState {
    Ready,
    Pairing,
    Connecting,
    Connected,
    Error,
}

data class ReceiverDisplayCapability(
    val id: String,
    val name: String,
    val width: Int,
    val height: Int,
    val scaleFactor: Float,
    val refreshRate: Int?,
    val primary: Boolean,
)

data class PairingRequest(
    val senderDeviceId: String,
    val senderName: String,
)

data class ReceiverSession(
    val castId: String,
    val controlToken: String,
    val senderDeviceId: String,
    val pairingToken: String,
    val displayId: String,
    val sourceUrl: String,
    val windowMode: String,
    val aspectRatio: String,
)

object ReceiverProtocol {
    const val PROTOCOL_NAME = "drmvyz-receiver"
    const val PROTOCOL_VERSION = 2
    const val PROTOCOL_MIN_VERSION = 2

    const val DISCOVERY_MAGIC = "DRMVYZ_CAST_RECEIVER"
    const val DISCOVERY_VERSION = 1
    const val DISCOVERY_PORT = 53531
    const val DISCOVERY_INTERVAL_MS = 2_500L
    const val MDNS_SERVICE_TYPE = "_drmvyz-cast._tcp."

    const val DISPLAY_ID = "android-default"
    const val MAX_LONG_EDGE = 1920
    const val MAX_SHORT_EDGE = 1080
    const val MAX_FPS = 60
    const val MAX_VIDEO_BITRATE_KBPS = 12_000
    const val STATS_INTERVAL_MS = 2_000
    const val MAX_JSON_BODY_BYTES = 64 * 1024

    val WINDOW_MODES = setOf("windowed", "borderless", "fullscreen")
    val ASPECT_RATIOS = setOf("16:9", "16:10", "4:3", "3:2", "1:1", "9:16")

    private val deviceIdPattern = Regex("^[A-Za-z0-9._:-]{8,128}$")
    private val pairingTokenPattern = Regex("^[A-Za-z0-9_-]{24,256}$")

    fun isValidDeviceId(value: String?): Boolean = value != null && deviceIdPattern.matches(value)

    fun isValidPairingToken(value: String?): Boolean = value != null && pairingTokenPattern.matches(value)

    fun cleanName(value: String?, fallback: String, maxLength: Int = 160): String {
        val cleaned = value?.trim()?.take(maxLength).orEmpty()
        return cleaned.ifBlank { fallback }
    }

    fun normalizeRemoteAddress(value: String?): String {
        if (value.isNullOrBlank()) return ""
        return value.removePrefix("::ffff:").substringBefore('%')
    }

    fun isPrivateNetworkAddress(value: String?): Boolean {
        val address = normalizeRemoteAddress(value).lowercase(Locale.US)
        if (address == "::1" || address == "localhost") return true
        if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true
        val parts = address.split('.').mapNotNull { it.toIntOrNull() }
        if (parts.size != 4 || parts.any { it !in 0..255 }) return false
        if (parts[0] == 10 || parts[0] == 127) return true
        if (parts[0] == 169 && parts[1] == 254) return true
        if (parts[0] == 172 && parts[1] in 16..31) return true
        return parts[0] == 192 && parts[1] == 168
    }

    fun isAllowedSource(sourceUrl: String?, remoteAddress: String?): Boolean {
        if (sourceUrl.isNullOrBlank()) return false
        return try {
            val uri = URI(sourceUrl)
            val host = normalizeRemoteAddress(uri.host)
            val remote = normalizeRemoteAddress(remoteAddress)
            uri.scheme == "http"
                && uri.path == "/receiver"
                && uri.port in 1..65_535
                && isPrivateNetworkAddress(host)
                && isPrivateNetworkAddress(remote)
                && (host == remote || remote == "127.0.0.1" || remote == "::1")
                && !uri.rawQuery.isNullOrBlank()
        } catch (_: Exception) {
            false
        }
    }
}
