package com.gymapp.broadcast;

import org.springframework.web.util.HtmlUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Server-side twin of frontend utils/richText.tsx: *bold* _italic_ ~underline~ [text](https://..)
// "# " / "## " headings, "- " bullets, "12. " numbered (number shown as typed), "---" rule,
// :::justify ... :::, and tab-indent. Text is HTML-escaped BEFORE markers are applied, and only
// http(s) links survive, so Owner-typed text can never inject markup. All styling is inline
// because email clients ignore <style> blocks.
final class RichMarkupConverter {

    private static final Pattern INLINE = Pattern.compile("(\\*[^*\\n]+\\*|_[^_\\n]+_|~[^~\\n]+~|\\[[^\\]]+\\]\\([^)]+\\))");
    private static final Pattern LINK = Pattern.compile("^\\[([^\\]]+)\\]\\(([^)]+)\\)$");
    private static final Pattern ORDERED = Pattern.compile("^(\\d+)\\.\\s+(.*)$");
    private static final String P_STYLE = "margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;";

    private RichMarkupConverter() {}

    static String toHtml(String markup, String accent) {
        String[] lines = markup.replace("\r\n", "\n").split("\n", -1);
        StringBuilder out = new StringBuilder();
        List<String> bullets = new ArrayList<>();
        List<String[]> ordered = new ArrayList<>();
        List<String> justify = new ArrayList<>();
        boolean inJustify = false;

        for (String line : lines) {
            String trimmed = line.trim();

            if (inJustify) {
                if (trimmed.equals(":::")) {
                    flushJustify(out, justify, accent);
                    inJustify = false;
                } else {
                    justify.add(line);
                }
                continue;
            }
            if (trimmed.equals(":::justify")) {
                flushLists(out, bullets, ordered, accent);
                inJustify = true;
                continue;
            }
            if (trimmed.equals("---")) {
                flushLists(out, bullets, ordered, accent);
                out.append("<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:20px 0;\" />");
                continue;
            }
            if (trimmed.startsWith("- ")) {
                flushOrdered(out, ordered, accent);
                bullets.add(trimmed.substring(2));
                continue;
            }
            Matcher om = ORDERED.matcher(trimmed);
            if (om.matches()) {
                flushBullets(out, bullets, accent);
                ordered.add(new String[]{om.group(1), om.group(2)});
                continue;
            }

            flushLists(out, bullets, ordered, accent);

            if (trimmed.startsWith("## ")) {
                out.append("<h3 style=\"margin:18px 0 8px;font-size:18px;line-height:1.3;color:#111827;\">")
                        .append(inline(trimmed.substring(3), accent)).append("</h3>");
            } else if (trimmed.startsWith("# ")) {
                out.append("<h2 style=\"margin:20px 0 8px;font-size:24px;line-height:1.25;color:#111827;\">")
                        .append(inline(trimmed.substring(2), accent)).append("</h2>");
            } else {
                boolean indented = line.startsWith("\t");
                String content = indented ? line.substring(1) : line;
                if (content.trim().isEmpty()) {
                    out.append("<div style=\"height:8px;line-height:8px;\">&nbsp;</div>");
                } else {
                    out.append("<p style=\"").append(P_STYLE).append(indented ? "padding-left:24px;" : "")
                            .append("\">").append(inline(content, accent)).append("</p>");
                }
            }
        }
        flushLists(out, bullets, ordered, accent);
        if (inJustify) flushJustify(out, justify, accent);
        return out.toString();
    }

    static String toPlainText(String markup) {
        StringBuilder sb = new StringBuilder();
        for (String line : markup.replace("\r\n", "\n").split("\n", -1)) {
            String t = line.trim();
            if (t.equals(":::justify") || t.equals(":::")) continue;
            if (t.equals("---")) { sb.append("----------\n"); continue; }
            if (t.startsWith("## ")) t = t.substring(3);
            else if (t.startsWith("# ")) t = t.substring(2);
            sb.append(line.startsWith("\t") ? "    " : "").append(stripInline(t)).append("\n");
        }
        return sb.toString().replaceAll("\\n{3,}", "\n\n").trim();
    }

    private static void flushLists(StringBuilder out, List<String> bullets, List<String[]> ordered, String accent) {
        flushBullets(out, bullets, accent);
        flushOrdered(out, ordered, accent);
    }

    private static void flushBullets(StringBuilder out, List<String> bullets, String accent) {
        if (bullets.isEmpty()) return;
        out.append("<ul style=\"margin:0 0 12px;padding-left:22px;font-size:15px;line-height:1.6;color:#374151;\">");
        for (String b : bullets) {
            out.append("<li style=\"margin:2px 0;\">").append(inline(b, accent)).append("</li>");
        }
        out.append("</ul>");
        bullets.clear();
    }

    private static void flushOrdered(StringBuilder out, List<String[]> ordered, String accent) {
        if (ordered.isEmpty()) return;
        for (String[] item : ordered) {
            out.append("<p style=\"margin:2px 0;padding-left:4px;font-size:15px;line-height:1.6;color:#374151;\">")
                    .append("<span style=\"color:#6b7280;\">").append(HtmlUtils.htmlEscape(item[0])).append(".</span> ")
                    .append(inline(item[1], accent)).append("</p>");
        }
        out.append("<div style=\"height:8px;line-height:8px;\">&nbsp;</div>");
        ordered.clear();
    }

    private static void flushJustify(StringBuilder out, List<String> lines, String accent) {
        if (lines.isEmpty()) return;
        out.append("<div style=\"text-align:justify;\">");
        for (String l : lines) {
            if (l.trim().isEmpty()) continue;
            out.append("<p style=\"").append(P_STYLE).append("\">").append(inline(l, accent)).append("</p>");
        }
        out.append("</div>");
        lines.clear();
    }

    private static String inline(String raw, String accent) {
        String escaped = HtmlUtils.htmlEscape(raw);
        Matcher m = INLINE.matcher(escaped);
        StringBuilder sb = new StringBuilder();
        int last = 0;
        while (m.find()) {
            sb.append(escaped, last, m.start());
            String part = m.group();
            char c = part.charAt(0);
            if (c == '*') {
                sb.append("<strong>").append(part, 1, part.length() - 1).append("</strong>");
            } else if (c == '_') {
                sb.append("<em>").append(part, 1, part.length() - 1).append("</em>");
            } else if (c == '~') {
                sb.append("<span style=\"text-decoration:underline;\">").append(part, 1, part.length() - 1).append("</span>");
            } else {
                Matcher lm = LINK.matcher(part);
                if (lm.matches() && lm.group(2).trim().matches("(?i)^https?://.*")) {
                    sb.append("<a href=\"").append(lm.group(2).trim()).append("\" style=\"color:")
                            .append(accent).append(";text-decoration:underline;\">").append(lm.group(1)).append("</a>");
                } else if (lm.matches()) {
                    sb.append(lm.group(1));
                } else {
                    sb.append(part);
                }
            }
            last = m.end();
        }
        sb.append(escaped, last, escaped.length());
        return sb.toString();
    }

    private static String stripInline(String raw) {
        Matcher m = INLINE.matcher(raw);
        StringBuilder sb = new StringBuilder();
        int last = 0;
        while (m.find()) {
            sb.append(raw, last, m.start());
            String part = m.group();
            char c = part.charAt(0);
            if (c == '*' || c == '_' || c == '~') {
                sb.append(part, 1, part.length() - 1);
            } else {
                Matcher lm = LINK.matcher(part);
                sb.append(lm.matches() ? lm.group(1) + " (" + lm.group(2).trim() + ")" : part);
            }
            last = m.end();
        }
        sb.append(raw, last, raw.length());
        return sb.toString();
    }
}