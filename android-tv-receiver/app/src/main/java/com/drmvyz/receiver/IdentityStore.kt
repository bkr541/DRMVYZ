package com.drmvyz.receiver

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID

class IdentityStore(context: Context) {
    private val preferences = context.getSharedPreferences("drmvyz_receiver_identity_v1", Context.MODE_PRIVATE)

    fun getOrCreateDeviceId(): String {
        val resolution = ReceiverIdentityPolicy.resolve(preferences.getString("deviceId", null)) { UUID.randomUUID().toString() }
        if (resolution.created) preferences.edit().putString("deviceId", resolution.deviceId).commit()
        return resolution.deviceId
    }
}

class ReceiverTrustStore(context: Context) {
    private val preferences = context.getSharedPreferences("drmvyz_receiver_trust_v1", Context.MODE_PRIVATE)
    private val secureRandom = SecureRandom()

    fun hasTrustedSender(senderDeviceId: String): Boolean = readRecord(senderDeviceId) != null

    fun verifySenderToken(senderDeviceId: String?, token: String?): Boolean {
        if (!ReceiverProtocol.isValidDeviceId(senderDeviceId) || !ReceiverProtocol.isValidPairingToken(token)) return false
        val stored = readRecord(senderDeviceId!!) ?: return false
        val expected = stored.optString("token")
        if (!ReceiverProtocol.isValidPairingToken(expected)) return false
        return MessageDigest.isEqual(
            expected.toByteArray(StandardCharsets.UTF_8),
            token!!.toByteArray(StandardCharsets.UTF_8),
        )
    }

    fun pairSender(senderDeviceId: String, senderName: String): String {
        require(ReceiverProtocol.isValidDeviceId(senderDeviceId))
        val token = randomToken()
        val record = JSONObject()
            .put("version", 1)
            .put("senderDeviceId", senderDeviceId)
            .put("senderName", ReceiverProtocol.cleanName(senderName, "DRMVYZ Sender"))
            .put("token", token)
        preferences.edit().putString(key(senderDeviceId), record.toString()).commit()
        return token
    }

    fun clearSender(senderDeviceId: String) {
        preferences.edit().remove(key(senderDeviceId)).apply()
    }

    private fun readRecord(senderDeviceId: String): JSONObject? {
        if (!ReceiverProtocol.isValidDeviceId(senderDeviceId)) return null
        val raw = preferences.getString(key(senderDeviceId), null) ?: return null
        return try {
            val value = JSONObject(raw)
            if (value.optInt("version") != 1 || value.optString("senderDeviceId") != senderDeviceId) null else value
        } catch (_: Exception) {
            null
        }
    }

    private fun key(senderDeviceId: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(senderDeviceId.toByteArray(StandardCharsets.UTF_8))
        return "sender_" + Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    private fun randomToken(): String {
        val bytes = ByteArray(32)
        secureRandom.nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }
}
