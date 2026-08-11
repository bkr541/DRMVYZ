package com.drmvyz.receiver

object ReceiverIdentityPolicy {
    data class Resolution(val deviceId: String, val created: Boolean)

    fun resolve(existing: String?, create: () -> String): Resolution {
        if (ReceiverProtocol.isValidDeviceId(existing)) return Resolution(existing!!, false)
        val generated = create()
        require(ReceiverProtocol.isValidDeviceId(generated)) { "Generated receiver identity is invalid" }
        return Resolution(generated, true)
    }
}
