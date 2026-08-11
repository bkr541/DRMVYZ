package com.drmvyz.receiver

class ReceiverStateMachine {
    @Volatile var state: ReceiverState = ReceiverState.Ready
        private set
    @Volatile var message: String? = "Waiting for a DRMVYZ sender"
        private set

    @Synchronized
    fun transition(next: ReceiverState, detail: String? = null) {
        state = next
        message = detail
    }

    @Synchronized
    fun reset(detail: String = "Waiting for a DRMVYZ sender") {
        state = ReceiverState.Ready
        message = detail
    }
}
