package com.gymapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class BroadcastAttachment {

    @Column(name = "asset_key", nullable = false)
    private String assetKey;

    @Column(nullable = false)
    private String filename;
}