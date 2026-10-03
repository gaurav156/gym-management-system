package com.gymapp.broadcast;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class BroadcastCreatedListener {

    private final BroadcastDispatcher dispatcher;

    public BroadcastCreatedListener(BroadcastDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }

    // dispatcher.dispatch() is itself @Async, so this returns straight away.
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBroadcastCreated(BroadcastCreatedEvent event) {
        dispatcher.dispatch(event.broadcastId());
    }
}