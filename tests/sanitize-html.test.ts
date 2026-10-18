import test from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, safeHttpsUrl, sanitizeHtml } from "../lib/sanitize-html";

test("keeps allowed tags and Arabic text", () => {
  const html = "<p>فاز <strong>الأنصار</strong> <em>اليوم</em></p><ul><li>هدف</li></ul><h2>عنوان</h2><blockquote>اقتباس</blockquote>";
  assert.equal(sanitizeHtml(html), html);
});

test("drops script, style and iframe together with their content", () => {
  assert.equal(sanitizeHtml("<p>a</p><script>alert(1)</script><style>p{}</style><iframe src=\"https://x.test\">x</iframe><p>b</p>"), "<p>a</p><p>b</p>");
  assert.equal(sanitizeHtml("<p>a</p><script>alert(1)"), "<p>a</p>");
  assert.equal(sanitizeHtml("<SCRIPT >alert(1)</SCRIPT ><p>ok</p>"), "<p>ok</p>");
  assert.equal(sanitizeHtml("<svg><a href=\"https://x.test\">x</a></svg><p>ok</p>"), "<p>ok</p>");
});

test("unwraps unknown tags and strips every attribute", () => {
  assert.equal(sanitizeHtml("<div class=\"x\" style=\"color:red\"><p onclick=\"alert(1)\" id=\"y\">نص</p></div>"), "<p>نص</p>");
  assert.equal(sanitizeHtml("<span>a</span><font>b</font>"), "ab");
  assert.equal(sanitizeHtml("a<br/>b<br />c</br>"), "a<br>b<br>c");
});

test("img keeps https src and alt only, adds lazy loading", () => {
  assert.equal(
    sanitizeHtml("<img src=\"https://cdn.test/a.jpg\" alt=\"ملعب\" onerror=\"alert(1)\" width=\"9\">"),
    "<img src=\"https://cdn.test/a.jpg\" alt=\"ملعب\" loading=\"lazy\">",
  );
  for (const src of ["javascript:alert(1)", "data:image/png;base64,AAAA", "//evil.test/a.jpg", "http://cdn.test/a.jpg", "/uploads/a.jpg"]) {
    assert.equal(sanitizeHtml(`<img src="${src}">`), "", src);
  }
});

test("a keeps https href with rel and target; any other href is removed", () => {
  assert.equal(
    sanitizeHtml("<a href=\"https://alansar.sa/x\" onclick=\"x()\">رابط</a>"),
    "<a href=\"https://alansar.sa/x\" rel=\"noopener nofollow\" target=\"_blank\">رابط</a>",
  );
  for (const href of ["javascript:alert(1)", "jav&#x61;script:alert(1)", "java\nscript:alert(1)", "&#106;avascript:alert(1)", " javascript:alert(1)", "vbscript:x", "data:text/html,x", "//evil.test"]) {
    assert.equal(sanitizeHtml(`<a href="${href}">x</a>`), "<a>x</a>", JSON.stringify(href));
  }
});

test("text and attribute values cannot smuggle markup", () => {
  assert.equal(sanitizeHtml("1 < 2 > 0 &amp; <img src=x onerror=alert(1)"), "1 &lt; 2 &gt; 0 &amp; &lt;img src=x onerror=alert(1)");
  assert.equal(sanitizeHtml("<p title=\"a>b\">x</p>"), "<p>x</p>");
  assert.equal(sanitizeHtml("<!-- <script>alert(1)</script> --><p>x</p>"), "<p>x</p>");
  assert.equal(sanitizeHtml("<img src=\"https://cdn.test/a.jpg\" alt='\"><b>x'>"), "<img src=\"https://cdn.test/a.jpg\" alt=\"&quot;&gt;&lt;b&gt;x\" loading=\"lazy\">");
});

test("unclosed, nested and empty input stay harmless", () => {
  assert.equal(sanitizeHtml("<p><strong>عنوان<p>نص"), "<p><strong>عنوان<p>نص");
  assert.equal(sanitizeHtml("<blockquote><p>اقتباس</p></blockquote></div>"), "<blockquote><p>اقتباس</p></blockquote>");
  assert.equal(sanitizeHtml(""), "");
});

test("decodeEntities and safeHttpsUrl", () => {
  assert.equal(decodeEntities("&#1575;&#x644;&amp;"), "ال&");
  assert.equal(decodeEntities("&unknown; &#0;"), "&unknown; ");
  assert.equal(safeHttpsUrl("https://alansar.sa/a?b=1&amp;c=2"), "https://alansar.sa/a?b=1&c=2");
  assert.equal(safeHttpsUrl("HTTPS://alansar.sa"), "HTTPS://alansar.sa");
  assert.equal(safeHttpsUrl("https:///x"), null);
  assert.equal(safeHttpsUrl("https&#58;//alansar.sa"), "https://alansar.sa");
});
