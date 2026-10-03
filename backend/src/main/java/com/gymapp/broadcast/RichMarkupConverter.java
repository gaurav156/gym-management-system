package com.gymapp.broadcast;

import org.springframework.web.util.HtmlUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Server-side twin of frontend utils/richText.tsx. Syntax:
//   *bold* _italic_ ~underline~ [text](https://..) ![alt|width](https://..)
//   "# " / "## " headings, "- " bullets, "12. " numbered, "---" rule, tab-indent
//   :::left|center|right|justify ... :::   alignment block (applies to everything inside)
//   @button Label | https://link | #bg | #text   one button; consecutive lines form one row
// Text is HTML-escaped BEFORE markers are applied; links/images must be http(s) and button
// colours must be #rrggbb, so Owner-typed text can never inject markup. All styling is inline
// because email clients ignore <style> blocks.
final class RichMarkupConverter {

    private static final Pattern INLINE = Pattern.compile(
            "(!\\[[^\\]]*\\]\\([^)\\s]+\\)|\\*[^*\\n]+\\*|_[^_\\n]+_|~[^~\\n]+~|\\[[^\\]]+\\]\\([^)]+\\))");
    private static final Pattern IMAGE = Pattern.compile("^!\\[([^\\]]*)\\]\\(([^)\\s]+)\\)$");
    private static final Pattern LINK = Pattern.compile("^\\[([^\\]]+)\\]\\(([^)]+)\\)$");
    private static final Pattern ORDERED = Pattern.compile("^(\\d+)\\.\\s+(.*)$");
    private static final Pattern ALIGN_OPEN = Pattern.compile("^:::(left|center|right|justify)$");
    private static final Pattern HEX = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final String BUTTON_PREFIX = "@button ";
    private static final String P_STYLE = "margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;";

    private RichMarkupConverter() {}

    static String toHtml(String markup, String accent) {
        return render(markup.replace("\r\n", "\n").split("\n", -1), accent, "left");
    }

    private static String render(String[] lines, String accent, String align) {
        StringBuilder out = new StringBuilder();
        List<String> bullets = new ArrayList<>();
        List<String[]> ordered = new ArrayList<>();
        List<String> buttons = new ArrayList<>();
        List<String> alignInner = new ArrayList<>();
        boolean inAlign = false;
        String alignKind = "left";

        for (String line : lines) {
            String trimmed = line.trim();

            if (inAlign) {
                if (trimmed.equals(":::")) {
                    flushAlign(out, alignInner, alignKind, accent);
                    inAlign = false;
                } else {
                    alignInner.add(line);
                }
                continue;
            }

            boolean isButton = trimmed.startsWith(BUTTON_PREFIX);
            if (!isButton) flushButtons(out, buttons, accent, align);

            Matcher am = ALIGN_OPEN.matcher(trimmed);
            if (am.matches()) {
                flushLists(out, bullets, ordered);
                inAlign = true;
                alignKind = am.group(1);
                continue;
            }
            if (isButton) {
                flushLists(out, bullets, ordered);
                buttons.add(trimmed.substring(BUTTON_PREFIX.length()));
                continue;
            }
            if (trimmed.equals("---")) {
                flushLists(out, bullets, ordered);
                out.append("<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:20px 0;\" />");
                continue;
            }
            if (trimmed.startsWith("- ")) {
                flushOrdered(out, ordered);
                bullets.add(trimmed.substring(2));
                continue;
            }
            Matcher om = ORDERED.matcher(trimmed);
            if (om.matches()) {
                flushBullets(out, bullets);
                ordered.add(new String[]{om.group(1), om.group(2)});
                continue;
            }

            flushLists(out, bullets, ordered);

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
        flushLists(out, bullets, ordered);
        flushButtons(out, buttons, accent, align);
        if (inAlign) flushAlign(out, alignInner, alignKind, accent);
        return out.toString();
    }

    // The block's inner lines are rendered with the SAME rules (headings, lists, images, buttons),
    // and the alignment is passed down so buttons can align themselves too.
    private static void flushAlign(StringBuilder out, List<String> inner, String kind, String accent) {
        if (inner.isEmpty()) return;
        out.append("<div style=\"text-align:").append(kind).append(";\">")
                .append(render(inner.toArray(new String[0]), accent, kind))
                .append("</div>");
        inner.clear();
    }

    // One row of side-by-side buttons. Built from tables (Outlook-safe), wrapped in a full-width
    // cell whose align attribute positions the row - no float, so following text never wraps beside it.
    private static void flushButtons(StringBuilder out, List<String> specs, String accent, String align) {
        if (specs.isEmpty()) return;
        StringBuilder cells = new StringBuilder();
        for (String spec : specs) {
            String[] p = spec.split("\\|", -1);
            String label = p[0].trim();
            String url = p.length > 1 ? p[1].trim() : "";
            String bg = color(p.length > 2 ? p[2].trim() : "", accent);
            String fg = color(p.length > 3 ? p[3].trim() : "", "#ffffff");
            if (label.isEmpty() || !url.matches("(?i)^(https?://|mailto:|tel:).+")) continue;

            if (cells.length() > 0) {
                cells.append("<td width=\"12\" style=\"font-size:0;line-height:0;\">&nbsp;</td>");
            }
            cells.append("<td style=\"background-color:").append(bg).append(";border-radius:8px;\">")
                    .append("<a href=\"").append(HtmlUtils.htmlEscape(url)).append("\" style=\"display:inline-block;")
                    .append("padding:13px 28px;font-size:15px;font-weight:600;color:").append(fg)
                    .append(";text-decoration:none;\">").append(HtmlUtils.htmlEscape(label)).append("</a></td>");
        }
        specs.clear();
        if (cells.length() == 0) return;

        String cellAlign = align.equals("center") || align.equals("right") ? align : "left";
        out.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:8px 0 16px;\">")
                .append("<tr><td align=\"").append(cellAlign).append("\">")
                .append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>")
                .append(cells)
                .append("</tr></table></td></tr></table>");
    }

    private static String color(String value, String fallback) {
        return HEX.matcher(value).matches() ? value : fallback;
    }

    static String toPlainText(String markup) {
        StringBuilder sb = new StringBuilder();
        for (String line : markup.replace("\r\n", "\n").split("\n", -1)) {
            String t = line.trim();
            if (ALIGN_OPEN.matcher(t).matches() || t.equals(":::")) continue;
            if (t.equals("---")) { sb.append("----------\n"); continue; }
            if (t.startsWith(BUTTON_PREFIX)) {
                String[] p = t.substring(BUTTON_PREFIX.length()).split("\\|", -1);
                if (p.length > 1 && !p[0].isBlank()) sb.append(p[0].trim()).append(": ").append(p[1].trim()).append("\n");
                continue;
            }
            if (t.startsWith("## ")) t = t.substring(3);
            else if (t.startsWith("# ")) t = t.substring(2);
            sb.append(line.startsWith("\t") ? "    " : "").append(stripInline(t)).append("\n");
        }
        return sb.toString().replaceAll("\\n{3,}", "\n\n").trim();
    }

    private static void flushLists(StringBuilder out, List<String> bullets, List<String[]> ordered) {
        flushBullets(out, bullets);
        flushOrdered(out, ordered);
    }

    private static void flushBullets(StringBuilder out, List<String> bullets) {
        if (bullets.isEmpty()) return;
        out.append("<ul style=\"margin:0 0 12px;padding-left:22px;font-size:15px;line-height:1.6;color:#374151;\">");
        for (String b : bullets) {
            out.append("<li style=\"margin:2px 0;\">").append(inline(b, null)).append("</li>");
        }
        out.append("</ul>");
        bullets.clear();
    }

    private static void flushOrdered(StringBuilder out, List<String[]> ordered) {
        if (ordered.isEmpty()) return;
        for (String[] item : ordered) {
            out.append("<p style=\"margin:2px 0;padding-left:4px;font-size:15px;line-height:1.6;color:#374151;\">")
                    .append("<span style=\"color:#6b7280;\">").append(HtmlUtils.htmlEscape(item[0])).append(".</span> ")
                    .append(inline(item[1], null)).append("</p>");
        }
        out.append("<div style=\"height:8px;line-height:8px;\">&nbsp;</div>");
        ordered.clear();
    }

    private static String inline(String raw, String accent) {
        String linkColor = accent == null ? "#2563eb" : accent;
        String escaped = HtmlUtils.htmlEscape(raw);
        Matcher m = INLINE.matcher(escaped);
        StringBuilder sb = new StringBuilder();
        int last = 0;
        while (m.find()) {
            sb.append(escaped, last, m.start());
            String part = m.group();
            char c = part.charAt(0);
            if (c == '!') {
                Matcher im = IMAGE.matcher(part);
                if (im.matches()) {
                    String alt = im.group(1);
                    String src = im.group(2);
                    String widthAttr = "";
                    int bar = alt.lastIndexOf('|');
                    if (bar >= 0 && alt.substring(bar + 1).matches("\\d{2,4}")) {
                        widthAttr = " width=\"" + alt.substring(bar + 1) + "\"";
                        alt = alt.substring(0, bar);
                    }
                    if (src.matches("(?i)^https?://.*")) {
                        // inline-block so the enclosing :::center / :::right block can align it
                        sb.append("<img src=\"").append(src).append("\" alt=\"").append(alt).append("\"")
                                .append(widthAttr)
                                .append(" style=\"display:inline-block;max-width:100%;height:auto;border:0;border-radius:8px;vertical-align:top;\" />");
                    } else {
                        sb.append(alt);
                    }
                } else {
                    sb.append(part);
                }
            } else if (c == '*') {
                sb.append("<strong>").append(part, 1, part.length() - 1).append("</strong>");
            } else if (c == '_') {
                sb.append("<em>").append(part, 1, part.length() - 1).append("</em>");
            } else if (c == '~') {
                sb.append("<span style=\"text-decoration:underline;\">").append(part, 1, part.length() - 1).append("</span>");
            } else {
                Matcher lm = LINK.matcher(part);
                if (lm.matches() && lm.group(2).trim().matches("(?i)^https?://.*")) {
                    sb.append("<a href=\"").append(lm.group(2).trim()).append("\" style=\"color:")
                            .append(linkColor).append(";text-decoration:underline;\">").append(lm.group(1)).append("</a>");
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
            if (c == '!') {
                Matcher im = IMAGE.matcher(part);
                if (im.matches()) {
                    String alt = im.group(1);
                    int bar = alt.lastIndexOf('|');
                    if (bar >= 0 && alt.substring(bar + 1).matches("\\d{2,4}")) alt = alt.substring(0, bar);
                    sb.append(alt);
                }
            } else if (c == '*' || c == '_' || c == '~') {
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