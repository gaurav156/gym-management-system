package com.gymapp.broadcast;

import com.gymapp.entity.BroadcastFormat;
import com.gymapp.entity.BroadcastType;
import com.gymapp.storage.ImagePurpose;
import com.gymapp.storage.StorageService;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Used by BOTH the live preview endpoint and the real send, so what the Owner sees is exactly
// what recipients get. Custom HTML is sanitized with a safelist (no scripts/forms/iframes/<style>;
// inline style="" is kept - it's what email clients actually support).
@Component
public class BroadcastEmailRenderer {

    public record Rendered(String html, String text) {}

    public static final String DEFAULT_ACCENT = "#e11d48";
    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final Pattern URL_PATTERN = Pattern.compile("https?://[^\\s\"'()<>\\\\]+");
    private static final Safelist SAFELIST = buildSafelist();
    private static final String FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    private final StorageService storage;

    @Value("${app.mail.gym-name}")
    private String gymName;

    @Value("${app.mail.logo-url:}")
    private String logoUrl;

    public BroadcastEmailRenderer(StorageService storage) {
        this.storage = storage;
    }

    public static boolean isValidAccent(String c) {
        return c != null && HEX_COLOR.matcher(c).matches();
    }

    public static String accentOrDefault(String c) {
        return isValidAccent(c) ? c : DEFAULT_ACCENT;
    }

    public Rendered render(BroadcastMessage m, String recipientName, String unsubscribeUrl) {
        String accent = accentOrDefault(m.accentColor());
        String safeName = HtmlUtils.htmlEscape(recipientName);
        boolean branded = m.format() != BroadcastFormat.HTML;
        boolean promotional = m.type() == BroadcastType.PROMOTIONAL;
        String safeGym = HtmlUtils.htmlEscape(gymName);

        String content;
        String text;
        switch (m.format()) {
            case HTML -> {
                content = sanitize(m.body());
                text = htmlToText(content);
            }
            case DESIGNER -> {
                content = RichMarkupConverter.toHtml(m.body(), accent);
                text = RichMarkupConverter.toPlainText(m.body());
            }
            default -> {
                content = "<p style=\"margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;\">"
                        + HtmlUtils.htmlEscape(m.body()).replace("\r\n", "\n").replace("\n", "<br>") + "</p>";
                text = m.body();
            }
        }
        content = content.replace("{{name}}", safeName);
        text = text.replace("{{name}}", recipientName);

        boolean hasCta = m.format() == BroadcastFormat.DESIGNER
                && m.ctaLabel() != null && m.ctaUrl() != null;
        String ctaHtml = hasCta
                ? "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px 0 8px;\"><tr>"
                + "<td style=\"background-color:" + accent + ";border-radius:8px;\">"
                + "<a href=\"" + HtmlUtils.htmlEscape(m.ctaUrl()) + "\" style=\"display:inline-block;padding:13px 28px;"
                + "font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;\">"
                + HtmlUtils.htmlEscape(m.ctaLabel()) + "</a></td></tr></table>"
                : "";

        String greeting = branded
                ? "<p style=\"margin:0 0 14px;font-size:15px;color:#111827;\">Hi " + safeName + ",</p>"
                : "";

        String bannerHtml = (m.format() == BroadcastFormat.DESIGNER && m.bannerUrl() != null && !m.bannerUrl().isBlank())
                ? "<tr><td><img src=\"" + HtmlUtils.htmlEscape(m.bannerUrl()) + "\" width=\"600\" alt=\"\" "
                + "style=\"display:block;width:100%;max-width:600px;height:auto;border:0;\" /></td></tr>"
                : "";

        String logoHtml = (logoUrl != null && !logoUrl.isBlank())
                ? "<img src=\"" + HtmlUtils.htmlEscape(logoUrl) + "\" alt=\"" + safeGym + "\" width=\"48\" height=\"48\" "
                + "style=\"display:block;border-radius:10px;margin:0 auto 12px;\" />"
                : "";
        String headerHtml = branded
                ? "<tr><td style=\"background-color:#111827;padding:24px 32px;text-align:center;\">" + logoHtml
                + "<div style=\"color:#ffffff;font-size:18px;font-weight:600;\">" + safeGym + "</div></td></tr>"
                : "";

        String footerLine = promotional
                ? "You're receiving this because you agreed to receive offers and updates from " + safeGym + "."
                : "This is an important announcement from " + safeGym + ".";
        String unsubLink = (promotional && unsubscribeUrl != null)
                ? " <a href=\"" + HtmlUtils.htmlEscape(unsubscribeUrl) + "\" style=\"color:#6b7280;text-decoration:underline;\">Unsubscribe</a>"
                : "";

        String html = "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" /></head>"
                + "<body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:" + FONT + ";\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:24px 12px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" "
                + "style=\"max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;\">"
                + headerHtml
                + bannerHtml
                + "<tr><td style=\"padding:" + (branded ? "28px 32px" : "0") + ";\">" + greeting + content + ctaHtml + "</td></tr>"
                + "<tr><td style=\"padding:18px 32px;border-top:1px solid #f3f4f6;text-align:center;\">"
                + "<p style=\"margin:0;font-size:12px;line-height:1.5;color:#9ca3af;\">" + footerLine + unsubLink
                + "<br>Please don't reply to this email.</p></td></tr>"
                + "</table></td></tr></table></body></html>";

        StringBuilder plain = new StringBuilder();
        if (branded) plain.append("Hi ").append(recipientName).append(",\n\n");
        plain.append(text);
        if (hasCta) plain.append("\n\n").append(m.ctaLabel()).append(": ").append(m.ctaUrl());
        plain.append("\n\n-- ").append(gymName).append("\n");
        if (promotional && unsubscribeUrl != null) plain.append("To unsubscribe: ").append(unsubscribeUrl).append("\n");

        return new Rendered(html, plain.toString());
    }

    // Every stored broadcast image the body references, so BroadcastService can record them in
    // broadcast_assets. Scans for any URL (covers <img src> and CSS url()) rather than parsing.
    public Set<String> extractInlineImageKeys(String body) {
        Set<String> keys = new LinkedHashSet<>();
        Matcher m = URL_PATTERN.matcher(body);
        while (m.find()) {
            storage.keyFromUrl(m.group())
                    .filter(k -> k.startsWith(ImagePurpose.BROADCAST_IMAGE.prefix()) && !k.contains(".."))
                    .ifPresent(keys::add);
        }
        return keys;
    }

    private String sanitize(String html) {
        return Jsoup.clean(html, "", SAFELIST, new Document.OutputSettings().prettyPrint(false));
    }

    private String htmlToText(String html) {
        Document d = Jsoup.parseBodyFragment(html);
        d.select("br").after("\\n");
        d.select("p,div,tr,h1,h2,h3,h4,li,hr").after("\\n");
        return d.wholeText().replace("\\n", "\n")
                .replaceAll("[ \\t]+\\n", "\n").replaceAll("\\n{3,}", "\n\n").trim();
    }

    private static Safelist buildSafelist() {
        return Safelist.relaxed()
                .addTags("center", "hr", "font", "section", "header", "footer", "figure", "figcaption")
                .addAttributes(":all", "style", "align", "dir")
                .addAttributes("table", "width", "height", "border", "cellpadding", "cellspacing", "bgcolor", "role")
                .addAttributes("tr", "bgcolor", "valign")
                .addAttributes("td", "width", "height", "valign", "bgcolor", "colspan", "rowspan")
                .addAttributes("th", "width", "height", "valign", "bgcolor", "colspan", "rowspan")
                .addAttributes("font", "color", "size", "face")
                .addAttributes("a", "target")
                .addEnforcedAttribute("a", "rel", "noopener noreferrer")
                .addProtocols("a", "href", "tel");
    }
}