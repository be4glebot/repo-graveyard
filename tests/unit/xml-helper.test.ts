import { describe, expect, it } from "vitest";
import { assertWellFormedXml, checkXml, isWellFormedXml } from "../helpers/xml";

describe("xml helper: known-good", () => {
  const good = [
    '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="a &amp; b"><title>x</title></svg>',
    '<?xml version="1.0"?>\n<a><b/></a>\n',
    "<a x='1' y=\"2\">&lt;&gt;&amp;&quot;&apos;&#65;&#x1F600;</a>",
    "<a><!-- note --><b>\u00B7 \u2026 \u{1F47B}</b></a>",
    "<a/>",
  ];
  it.each(good)("accepts %s", (xml) => {
    expect(checkXml(xml)).toEqual({ ok: true });
    expect(() => assertWellFormedXml(xml)).not.toThrow();
  });
});

describe("xml helper: known-bad", () => {
  const bad: Array<[string, string, string]> = [
    ["unclosed tag", "<a><b></a>", "mismatched"],
    ["unclosed root", "<a><b/>", "unclosed"],
    ["raw ampersand in text", "<a>fish & chips</a>", "entity"],
    ["raw ampersand in attribute", '<a x="a & b"/>', "entity"],
    ["raw less-than in text", "<a>1 < 2</a>", "invalid name"],
    ["raw less-than in attribute", '<a x="<"/>', "raw '<'"],
    ["duplicate attribute", '<a x="1" x="2"/>', "duplicate"],
    ["unquoted attribute", "<a x=1/>", "not quoted"],
    ["bad named entity", "<a>&nbsp;</a>", "bad entity"],
    ["bad numeric entity", "<a>&#0;</a>", "Char range"],
    ["control character", "<a>\u0001</a>", "Char range"],
    ["U+FFFE", "<a>\uFFFE</a>", "Char range"],
    ["lone surrogate", "<a>\uD800</a>", "surrogate"],
    ["multiple roots", "<a/><b/>", "multiple root"],
    ["text outside root", "x<a/>", "outside root"],
    ["empty input", "", "no root"],
  ];
  it.each(bad)("rejects %s", (_name, xml, fragment) => {
    const r = checkXml(xml);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(fragment);
    expect(isWellFormedXml(xml)).toBe(false);
    expect(() => assertWellFormedXml(xml)).toThrow(/Not well-formed XML/);
  });
});
