package com.drmvyz.receiver

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReceiverProtocolTest {
    @Test
    fun `matches Stage 5 Receiver V2 protocol and discovery constants`() {
        assertEquals("drmvyz-receiver", ReceiverProtocol.PROTOCOL_NAME)
        assertEquals(2, ReceiverProtocol.PROTOCOL_VERSION)
        assertEquals(2, ReceiverProtocol.PROTOCOL_MIN_VERSION)
        assertEquals("DRMVYZ_CAST_RECEIVER", ReceiverProtocol.DISCOVERY_MAGIC)
        assertEquals(1, ReceiverProtocol.DISCOVERY_VERSION)
        assertEquals(53531, ReceiverProtocol.DISCOVERY_PORT)
        assertEquals("_drmvyz-cast._tcp.", ReceiverProtocol.MDNS_SERVICE_TYPE)
        assertEquals(setOf("windowed", "borderless", "fullscreen"), ReceiverProtocol.WINDOW_MODES)
    }

    @Test
    fun `session source must stay on the discovered private sender`() {
        assertTrue(ReceiverProtocol.isAllowedSource(
            "http://192.168.50.12:43111/receiver?session=s1&token=t1",
            "192.168.50.12",
        ))
        assertFalse(ReceiverProtocol.isAllowedSource(
            "https://192.168.50.12:43111/receiver?session=s1&token=t1",
            "192.168.50.12",
        ))
        assertFalse(ReceiverProtocol.isAllowedSource(
            "http://192.168.50.13:43111/receiver?session=s1&token=t1",
            "192.168.50.12",
        ))
        assertFalse(ReceiverProtocol.isAllowedSource(
            "http://8.8.8.8:43111/receiver?session=s1&token=t1",
            "8.8.8.8",
        ))
    }

    @Test
    fun `receiver state machine returns to Ready after pairing disconnect and failures`() {
        val machine = ReceiverStateMachine()
        machine.transition(ReceiverState.Pairing, "Pairing")
        assertEquals(ReceiverState.Pairing, machine.state)
        machine.reset()
        assertEquals(ReceiverState.Ready, machine.state)
        machine.transition(ReceiverState.Connecting, "Connecting")
        machine.transition(ReceiverState.Connected, "Live")
        assertEquals(ReceiverState.Connected, machine.state)
        machine.transition(ReceiverState.Error, "Decoder failed")
        assertEquals(ReceiverState.Error, machine.state)
        machine.reset("Recovered")
        assertEquals(ReceiverState.Ready, machine.state)
        assertEquals("Recovered", machine.message)
    }

    @Test
    fun `packaged contract documents every sender endpoint and quality ceiling`() {
        val contract = File("src/main/assets/drmvyz_receiver_v2_contract.json").readText()
        assertTrue(contract.contains("\"version\": 2"))
        assertTrue(contract.contains("\"legacyUdpPort\": 53531"))
        assertTrue(contract.contains("\"maxLongEdge\": 1920"))
        assertTrue(contract.contains("\"maxFps\": 60"))
        assertTrue(contract.contains("GET /api/v2/capabilities"))
        assertTrue(contract.contains("POST /api/v2/pair"))
        assertTrue(contract.contains("POST /api/v2/sessions"))
        assertTrue(contract.contains("POST /api/v2/sessions/:castId/stop"))
    }
    @Test
    fun `stable identity survives restart and malformed identity is repaired`() {
        val existing = "receiver-device-1234"
        val retained = ReceiverIdentityPolicy.resolve(existing) { error("valid identity must not rotate") }
        assertEquals(existing, retained.deviceId)
        assertFalse(retained.created)

        val repaired = ReceiverIdentityPolicy.resolve("bad id") { "receiver-device-repaired" }
        assertEquals("receiver-device-repaired", repaired.deviceId)
        assertTrue(repaired.created)
    }

}
