package com.gymapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// EnableScheduling turns on Spring's @Scheduled support - required for
// AttendanceService.autoCheckoutStaleRecords() to actually run.
@SpringBootApplication
@EnableScheduling
public class GymManagementApplication {
    public static void main(String[] args) {
        SpringApplication.run(GymManagementApplication.class, args);
    }
}