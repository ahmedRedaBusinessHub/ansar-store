/**
 * Allow-list HTML sanitizer for news bodies (spec 2026-10-14 D5). Hand-rolled on purpose: no new
 * dependency, and the input is article markup from web-api / WordPress. Its output is the only
 * string the storefront ever passes to dangerouslySetInnerHTML.
 */

/** Removed together with everything inside them. */
const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math", "textarea", "title"];
const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "a", "img", "figure", "figcaption"]);
const VOID_TAGS = new Set(["br", "img"]);

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const ATTRIBUTE = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
  colon: ":", tab: "\t", newline: "\n", sol: "/", lpar: "(", rpar: ")",
};

/** Numeric entities plus the named ones an attacker can use to hide a URL scheme. Unknown names are left as written. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1] === "x" || entity[1] === "X";
      const code = hex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return NAMED[entity.toLowerCase()] ?? match;
  });
}

/** The URL when it is https after decoding entities and removing control/whitespace characters; otherwise null. */
export function safeHttpsUrl(raw: string): string | null {
  const value = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
  return /^https:\/\/[^/]/i.test(value) ? value : null;
}

const escapeText = (value: string) => value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function readAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    if (!attributes.has(name)) attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

/** Rebuilt opening tag carrying only allowed attributes, or null when the tag must disappear. */
function openTag(name: string, attributeSource: string): string | null {
  const attributes = readAttributes(attributeSource);
  if (name === "a") {
    const href = safeHttpsUrl(attributes.get("href") ?? "");
    return href ? `<a href="${escapeAttribute(href)}" rel="noopener nofollow" target="_blank">` : "<a>";
  }
  if (name === "img") {
    const src = safeHttpsUrl(attributes.get("src") ?? "");
    if (!src) return null;
    const alt = decodeEntities(attributes.get("alt") ?? "");
    return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy">`;
  }
  return `<${name}>`;
}

export function sanitizeHtml(html: string): string {
  let source = html.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
  for (const tag of DROP_WITH_CONTENT) {
    source = source.replace(new RegExp(`<${tag}\\b[\\s\\S]*?(?:<\\/${tag}\\s*>|$)`, "gi"), "");
  }
  let output = "";
  let last = 0;
  for (const match of source.matchAll(TAG)) {
    const index = match.index ?? 0;
    output += escapeText(source.slice(last, index));
    last = index + match[0].length;
    const name = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue;
    if (match[1]) {
      if (!VOID_TAGS.has(name)) output += `</${name}>`;
      continue;
    }
    output += openTag(name, match[3]) ?? "";
  }
  return output + escapeText(source.slice(last));
}
