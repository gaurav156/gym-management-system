package com.gymapp.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

// One place for the branded header shared by every email (OTP, invoices, welcome,
// broadcasts). All values are optional - a blank config gives a plain text header.
@Component
public class EmailBranding {

    private static final String FALLBACK_FONTS =
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    @Value("${app.mail.gym-name}")
    private String gymName;

    // Must be a publicly reachable PNG/JPG - many email clients render SVG badly or not at all.
    @Value("${app.mail.logo-url:}")
    private String logoUrl;

    // Optional PNG (transparent background, white text, ~2x resolution) of the gym name
    // rendered in the brand font. This is the only reliable way to show a custom font in
    // email: Gmail and Outlook ignore web fonts.
    @Value("${app.mail.name-image-url:}")
    private String nameImageUrl;

    // Optional font-family name. Only honoured by clients that have/allow it (e.g. Apple
    // Mail); everyone else silently gets the fallback stack, so it is safe to set.
    @Value("${app.mail.name-font:}")
    private String nameFont;

    public String headerRow(String padding) {
        String safeGym = HtmlUtils.htmlEscape(gymName);
        StringBuilder sb = new StringBuilder();
        sb.append("<tr><td style=\"background-color:#111827;padding:").append(padding)
                .append(";text-align:center;\">");

        if (has(logoUrl)) {
            sb.append("<img src=\"").append(HtmlUtils.htmlEscape(logoUrl)).append("\" alt=\"").append(safeGym)
                    .append("\" width=\"56\" height=\"56\" style=\"display:block;width:56px;height:56px;")
                    .append("border-radius:50%;background-color:#ffffff;border:0;margin:0 auto 12px;\" />");
        }

        if (has(nameImageUrl)) {
            sb.append("<img src=\"").append(HtmlUtils.htmlEscape(nameImageUrl)).append("\" alt=\"").append(safeGym)
                    .append("\" height=\"28\" style=\"display:block;height:28px;width:auto;max-width:100%;")
                    .append("border:0;margin:0 auto;\" />");
        } else {
            sb.append("<div style=\"color:#ffffff;font-size:18px;letter-spacing:").append(has(nameFont) ? "0.08em" : "-0.01em")
                    .append(";font-weight:").append(has(nameFont) ? "400" : "600")
                    .append(";font-family:").append(fontStack()).append(";\">").append(safeGym).append("</div>");
        }

        sb.append("</td></tr>");
        return sb.toString();
    }

    private String fontStack() {
        if (!has(nameFont)) return FALLBACK_FONTS;
        String clean = nameFont.replaceAll("[^A-Za-z0-9 \\-]", "").trim(); // value ends up inside style=""
        return clean.isEmpty() ? FALLBACK_FONTS : "'" + clean + "'," + FALLBACK_FONTS;
    }

    private static boolean has(String s) {
        return s != null && !s.isBlank();
    }
}