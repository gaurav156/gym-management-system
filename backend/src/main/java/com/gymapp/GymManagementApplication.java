package com.gymapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableAsync
@EnableScheduling
public class GymManagementApplication {
    public static void main(String[] args) {
        // Must run before Spring starts: every LocalDate/LocalDateTime.now(), @Scheduled cron
        // and the Postgres session timezone follow the JVM default. Render runs in UTC.
        String tz = System.getenv("APP_TIMEZONE");
        TimeZone.setDefault(TimeZone.getTimeZone(tz == null || tz.isBlank() ? "Asia/Kolkata" : tz.trim()));
        SpringApplication.run(GymManagementApplication.class, args);
    }
}