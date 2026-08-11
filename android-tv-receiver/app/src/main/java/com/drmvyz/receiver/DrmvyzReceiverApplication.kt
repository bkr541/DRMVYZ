package com.drmvyz.receiver

import android.app.Application

class DrmvyzReceiverApplication : Application() {
    val runtime: ReceiverRuntime by lazy { ReceiverRuntime(this) }

    override fun onTerminate() {
        runtime.stop()
        super.onTerminate()
    }
}
