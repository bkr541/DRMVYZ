package com.drmvyz.receiver

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.NetworkInterface
import java.nio.charset.StandardCharsets
import java.util.Collections
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

internal class DiscoveryAdvertiser(
    context: Context,
    private val deviceId: String,
    private val receiverName: String,
    private val port: Int,
    private val receiverToken: String,
    private val onStatus: (String?) -> Unit,
) {
    private val nsdManager = context.getSystemService(NsdManager::class.java)
    private val running = AtomicBoolean(false)
    @Volatile private var registrationListener: NsdManager.RegistrationListener? = null
    @Volatile private var registeredService: NsdServiceInfo? = null
    @Volatile private var legacySocket: DatagramSocket? = null
    @Volatile private var scheduler: ScheduledExecutorService? = null

    fun start() {
        if (!running.compareAndSet(false, true)) return
        startNsd()
        startLegacyBeacon()
    }

    fun stop() {
        if (!running.getAndSet(false)) return
        sendLegacyBeacon(goodbye = true)
        scheduler?.shutdownNow()
        scheduler = null
        try { legacySocket?.close() } catch (_: Exception) { }
        legacySocket = null
        val listener = registrationListener
        registrationListener = null
        registeredService = null
        if (listener != null) {
            try { nsdManager?.unregisterService(listener) } catch (_: Exception) { }
        }
    }

    private fun startNsd() {
        if (nsdManager == null) {
            onStatus("mDNS/DNS-SD unavailable; using UDP compatibility discovery")
            return
        }
        val serviceInfo = NsdServiceInfo().apply {
            serviceName = "DRMVYZ-${deviceId.replace("-", "").take(12)}"
            serviceType = ReceiverProtocol.MDNS_SERVICE_TYPE
            setPort(port)
            setAttribute("v", ReceiverProtocol.DISCOVERY_VERSION.toString())
            setAttribute("id", deviceId)
            setAttribute("name", receiverName)
            setAttribute("token", receiverToken)
        }
        val listener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(value: NsdServiceInfo) {
                registeredService = value
                onStatus(null)
            }

            override fun onRegistrationFailed(value: NsdServiceInfo, errorCode: Int) {
                registeredService = null
                onStatus("mDNS/DNS-SD registration failed ($errorCode); using UDP compatibility discovery")
            }

            override fun onServiceUnregistered(value: NsdServiceInfo) {
                registeredService = null
            }

            override fun onUnregistrationFailed(value: NsdServiceInfo, errorCode: Int) {
                registeredService = null
            }
        }
        registrationListener = listener
        try {
            nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (error: Exception) {
            registrationListener = null
            onStatus("mDNS/DNS-SD registration failed: ${error.message ?: "unknown error"}; using UDP compatibility discovery")
        }
    }

    private fun startLegacyBeacon() {
        try {
            legacySocket = DatagramSocket().apply { broadcast = true }
            scheduler = Executors.newSingleThreadScheduledExecutor { runnable -> Thread(runnable, "drmvyz-discovery") }
            sendLegacyBeacon(goodbye = false)
            scheduler?.scheduleAtFixedRate(
                { sendLegacyBeacon(goodbye = false) },
                ReceiverProtocol.DISCOVERY_INTERVAL_MS,
                ReceiverProtocol.DISCOVERY_INTERVAL_MS,
                TimeUnit.MILLISECONDS,
            )
        } catch (error: Exception) {
            onStatus("Receiver discovery unavailable: ${error.message ?: "could not open UDP discovery"}")
        }
    }

    private fun sendLegacyBeacon(goodbye: Boolean) {
        val socket = legacySocket ?: return
        if (!running.get() && !goodbye) return
        val payload = JSONObject()
            .put("magic", ReceiverProtocol.DISCOVERY_MAGIC)
            .put("version", ReceiverProtocol.DISCOVERY_VERSION)
            .put("deviceId", deviceId)
            .put("name", receiverName.take(120))
            .put("port", port)
            .put("receiverToken", receiverToken)
            .put("goodbye", goodbye)
            .put("transport", "legacy-udp-compat")
            .toString()
            .toByteArray(StandardCharsets.UTF_8)
        val destinations = linkedSetOf("255.255.255.255")
        try {
            for (networkInterface in Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!networkInterface.isUp || networkInterface.isLoopback) continue
                for (interfaceAddress in networkInterface.interfaceAddresses) {
                    interfaceAddress.broadcast?.hostAddress?.let(destinations::add)
                }
            }
        } catch (_: Exception) {
            // Global broadcast remains a valid compatibility fallback.
        }
        for (destination in destinations) {
            try {
                val address = InetAddress.getByName(destination)
                socket.send(DatagramPacket(payload, payload.size, address, ReceiverProtocol.DISCOVERY_PORT))
            } catch (_: Exception) {
                // A different active interface may still carry the beacon.
            }
        }
    }
}
