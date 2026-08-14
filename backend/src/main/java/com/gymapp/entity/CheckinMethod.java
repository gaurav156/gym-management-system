package com.gymapp.entity;

// BIOMETRIC is included now so the Attendance table needs no schema change
// when a fingerprint/face device is added later - it just becomes another
// value pushed into this same field.
public enum CheckinMethod {
    PIN, QR, BIOMETRIC
}
