package com.gymapp.storage;

public enum ImagePurpose {
    PHOTO("avatars/"),
    SIGNATURE("signatures/");

    private final String prefix;

    ImagePurpose(String prefix) { this.prefix = prefix; }

    public String prefix() { return prefix; }
}