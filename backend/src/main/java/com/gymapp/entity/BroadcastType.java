package com.gymapp.entity;

// ANNOUNCEMENT = important update, sent to the whole audience. PROMOTIONAL = offers/marketing,
// sent only to users with marketingConsent = true, and always carries an unsubscribe link.
public enum BroadcastType { ANNOUNCEMENT, PROMOTIONAL }