package com.gymapp.config;

import com.gymapp.security.JwtAuthFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // public endpoints
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/public/**").permitAll()

                // owner-only endpoints
                .requestMatchers("/api/owner/**").hasRole("OWNER")

                // a member needs to see their own assigned branch (e.g. to load plans) -
                // this specific rule must come before the broader /api/branches/** rule below
                .requestMatchers("/api/branches/mine").hasAnyRole("OWNER", "MANAGER", "MEMBER")

                // manager + owner endpoints
                .requestMatchers("/api/branches/**").hasAnyRole("OWNER", "MANAGER")
                .requestMatchers("/api/plans/manage/**").hasAnyRole("OWNER", "MANAGER")
                .requestMatchers("/api/members/**").hasAnyRole("OWNER", "MANAGER")
                // owner-only: correcting a trainer's joining date, or marking/clearing them
                // as left - a Manager must not be able to do either (must precede the
                // broader /api/trainers/** rule below to take effect)
                .requestMatchers("/api/trainers/*/dates").hasRole("OWNER")

                .requestMatchers("/api/trainers/**").hasAnyRole("OWNER", "MANAGER")

                // membership purchase is recorded by front-desk staff against cash payment,
                // not self-service by the member - see MembershipService.purchase()
                .requestMatchers("/api/memberships/purchase").hasAnyRole("OWNER", "MANAGER")

                // membership admin actions - branch listing and lifecycle changes. The PUT
                // matcher is deliberately method-specific: GET /api/memberships/mine and
                // PUT /api/memberships/{id} are both a single path segment, so without
                // pinning this to PUT it would also (wrongly) restrict the member's own
                // GET /mine endpoint.
                .requestMatchers("/api/memberships/branch/**").hasAnyRole("OWNER", "MANAGER")
                .requestMatchers("/api/memberships/*/cancel", "/api/memberships/*/pause",
                        "/api/memberships/*/resume").hasAnyRole("OWNER", "MANAGER")
                .requestMatchers(HttpMethod.PUT, "/api/memberships/*").hasAnyRole("OWNER", "MANAGER")

                // payment history - branch/member views for staff, "my payments" for the
                // member themselves (ownership is checked in PaymentController.mine())
                .requestMatchers("/api/payments/branch/**", "/api/payments/member/**").hasAnyRole("OWNER", "MANAGER")
                .requestMatchers("/api/payments/mine").hasRole("MEMBER")

                // attendance check-in can be triggered from a reception kiosk (manager/owner),
                // a member's own QR/PIN screen, or a trainer's own QR/PIN screen
                .requestMatchers("/api/attendance/checkin").hasAnyRole("OWNER", "MANAGER", "MEMBER", "TRAINER")
                .requestMatchers("/api/attendance/summary/**").hasAnyRole("OWNER", "MANAGER")
                .requestMatchers("/api/attendance/history/**", "/api/attendance/today/**",
                        "/api/attendance/last-checkin/**").hasAnyRole("OWNER", "MANAGER")

                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}