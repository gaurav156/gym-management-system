package com.gymapp.security;

import jakarta.servlet.http.HttpServletRequest;

// Resolves the "real" client IP for rate-limiting purposes. Render (and most PaaS hosts)
// terminate TLS at a reverse proxy, so request.getRemoteAddr() would return the proxy's
// own IP for every request once this is deployed - X-Forwarded-For is where the actual
// client IP shows up in that setup. Locally (no proxy in front), the header is simply
// absent and this falls back to getRemoteAddr() as normal.
public final class ClientIpResolver {

    private ClientIpResolver() {}

    public static String resolve(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            // The header can be a comma-separated chain (client, proxy1, proxy2, ...) -
            // the first entry is the original client.
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}