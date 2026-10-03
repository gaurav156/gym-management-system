package com.gymapp.broadcast;

import com.gymapp.entity.Broadcast;
import com.gymapp.entity.BroadcastStatus;
import com.gymapp.repository.BroadcastRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;

// If the app restarts mid-broadcast, the row is left SENDING (which would also block new
// broadcasts). Recipients are a persisted snapshot, so resuming just re-runs the dispatcher
// over whoever is still PENDING.
@Component
public class BroadcastStartupRecovery {

    private static final Logger log = LoggerFactory.getLogger(BroadcastStartupRecovery.class);

    private final BroadcastRepository broadcastRepository;
    private final BroadcastDispatcher dispatcher;

    public BroadcastStartupRecovery(BroadcastRepository broadcastRepository, BroadcastDispatcher dispatcher) {
        this.broadcastRepository = broadcastRepository;
        this.dispatcher = dispatcher;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void resumeInterruptedBroadcasts() {
        List<Broadcast> interrupted = broadcastRepository.findByStatus(BroadcastStatus.SENDING);
        for (Broadcast b : interrupted) {
            log.info("Resuming interrupted broadcast {}", b.getId());
            dispatcher.dispatch(b.getId());
        }
    }
}