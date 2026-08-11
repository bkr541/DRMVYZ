package com.drmvyz.receiver

import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.nio.charset.StandardCharsets
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

internal data class HttpRequest(
    val method: String,
    val path: String,
    val headers: Map<String, String>,
    val body: ByteArray,
    val remoteAddress: String,
)

internal data class HttpResponse(
    val status: Int,
    val json: JSONObject? = null,
) {
    companion object {
        fun empty(status: Int = 204) = HttpResponse(status, null)
        fun error(status: Int, message: String) = HttpResponse(status, JSONObject().put("error", message))
    }
}

internal class ReceiverHttpServer(
    private val handler: (HttpRequest) -> HttpResponse,
) {
    private val running = AtomicBoolean(false)
    private val acceptExecutor = Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "drmvyz-http-accept") }
    private val workerExecutor = Executors.newCachedThreadPool { runnable -> Thread(runnable, "drmvyz-http-worker") }
    @Volatile private var serverSocket: ServerSocket? = null

    val port: Int
        get() = serverSocket?.localPort ?: 0

    fun start(): Int {
        if (running.get()) return port
        val socket = ServerSocket(0, 32, InetAddress.getByName("0.0.0.0"))
        socket.reuseAddress = true
        serverSocket = socket
        running.set(true)
        acceptExecutor.execute {
            while (running.get()) {
                try {
                    val client = socket.accept()
                    workerExecutor.execute { handleClient(client) }
                } catch (_: SocketException) {
                    if (running.get()) continue else break
                } catch (_: Exception) {
                    if (!running.get()) break
                }
            }
        }
        return socket.localPort
    }

    fun stop() {
        if (!running.getAndSet(false)) return
        try { serverSocket?.close() } catch (_: Exception) { }
        serverSocket = null
        workerExecutor.shutdownNow()
        acceptExecutor.shutdownNow()
    }

    private fun handleClient(socket: Socket) {
        socket.use { client ->
            client.soTimeout = 35_000
            val response = try {
                val request = readRequest(client) ?: return
                handler(request)
            } catch (error: PayloadTooLargeException) {
                HttpResponse.error(413, error.message ?: "Request body is too large")
            } catch (error: BadRequestException) {
                HttpResponse.error(400, error.message ?: "Invalid request")
            } catch (error: Exception) {
                HttpResponse.error(500, error.message ?: "Receiver request failed")
            }
            writeResponse(client, response)
        }
    }

    private fun readRequest(socket: Socket): HttpRequest? {
        val input = BufferedInputStream(socket.getInputStream())
        val requestLine = readAsciiLine(input, 8_192) ?: return null
        val parts = requestLine.split(' ')
        if (parts.size < 2) throw BadRequestException("Invalid HTTP request line")
        val method = parts[0].uppercase(Locale.US)
        val path = parts[1]
        val headers = linkedMapOf<String, String>()
        while (true) {
            val line = readAsciiLine(input, 16_384) ?: throw BadRequestException("Incomplete HTTP headers")
            if (line.isEmpty()) break
            val separator = line.indexOf(':')
            if (separator <= 0) throw BadRequestException("Invalid HTTP header")
            val key = line.substring(0, separator).trim().lowercase(Locale.US)
            if (!headers.containsKey(key)) headers[key] = line.substring(separator + 1).trim()
        }
        val contentLength = headers["content-length"]?.toIntOrNull() ?: 0
        if (contentLength < 0) throw BadRequestException("Invalid Content-Length")
        if (contentLength > ReceiverProtocol.MAX_JSON_BODY_BYTES) throw PayloadTooLargeException("Request body is too large")
        val body = ByteArray(contentLength)
        var offset = 0
        while (offset < body.size) {
            val read = input.read(body, offset, body.size - offset)
            if (read < 0) throw BadRequestException("Incomplete request body")
            offset += read
        }
        return HttpRequest(method, path, headers, body, socket.inetAddress.hostAddress.orEmpty())
    }

    private fun readAsciiLine(input: BufferedInputStream, maxBytes: Int): String? {
        val bytes = ArrayList<Byte>(128)
        var previous = -1
        while (bytes.size <= maxBytes) {
            val current = input.read()
            if (current < 0) return if (bytes.isEmpty()) null else throw BadRequestException("Incomplete HTTP line")
            if (previous == '\r'.code && current == '\n'.code) {
                bytes.removeAt(bytes.lastIndex)
                return bytes.toByteArray().toString(StandardCharsets.ISO_8859_1)
            }
            bytes.add(current.toByte())
            previous = current
        }
        throw BadRequestException("HTTP line is too long")
    }

    private fun writeResponse(socket: Socket, response: HttpResponse) {
        val output = BufferedOutputStream(socket.getOutputStream())
        val body = response.json?.toString()?.toByteArray(StandardCharsets.UTF_8) ?: ByteArray(0)
        val statusText = when (response.status) {
            200 -> "OK"
            204 -> "No Content"
            400 -> "Bad Request"
            401 -> "Unauthorized"
            403 -> "Forbidden"
            404 -> "Not Found"
            409 -> "Conflict"
            413 -> "Payload Too Large"
            426 -> "Upgrade Required"
            503 -> "Service Unavailable"
            else -> "Internal Server Error"
        }
        val headers = buildString {
            append("HTTP/1.1 ${response.status} $statusText\r\n")
            if (body.isNotEmpty()) append("Content-Type: application/json; charset=utf-8\r\n")
            append("Content-Length: ${body.size}\r\n")
            append("Cache-Control: no-store\r\n")
            append("X-Content-Type-Options: nosniff\r\n")
            append("Connection: close\r\n\r\n")
        }.toByteArray(StandardCharsets.ISO_8859_1)
        output.write(headers)
        output.write(body)
        output.flush()
    }

    private class BadRequestException(message: String) : Exception(message)
    private class PayloadTooLargeException(message: String) : Exception(message)
}
