// Strict XML 1.0 well-formedness checker for tests. No dependencies.
// Supported: optional XML declaration, comments, one root element, nested
// elements, quoted unique attributes, text, the five predefined entities and
// numeric character references. Not supported (reported as errors): DOCTYPE,
// CDATA, processing instructions other than the leading declaration.

export type XmlCheck = { ok: true } | { ok: false; error: string; index: number };

const NAME_START = /[A-Za-z_:]/;
const NAME_CHAR = /[A-Za-z0-9_:.\-]/;
const PREDEFINED = new Set(["amp", "lt", "gt", "quot", "apos"]);

/** XML 1.0 `Char` production for a single code point. */
export function isXmlChar(cp: number): boolean {
  return (
    cp === 0x9 ||
    cp === 0xa ||
    cp === 0xd ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  );
}

class Fail extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message);
  }
}

export function checkXml(input: string): XmlCheck {
  try {
    parse(input);
    return { ok: true };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.message, index: e.index };
    throw e;
  }
}

export function isWellFormedXml(input: string): boolean {
  return checkXml(input).ok;
}

function parse(s: string): void {
  // Character range check over code points (lone surrogates fail here).
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i)!;
    if (cp >= 0xd800 && cp <= 0xdfff) throw new Fail("lone surrogate", i);
    if (!isXmlChar(cp)) {
      throw new Fail(`character U+${cp.toString(16).toUpperCase().padStart(4, "0")} outside XML Char range`, i);
    }
    i += cp > 0xffff ? 2 : 1;
  }

  let i = 0;
  const n = s.length;
  const stack: string[] = [];
  let rootSeen = false;

  const isWs = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";

  // Optional XML declaration, only at the very start.
  if (s.startsWith("<?xml") && (isWs(s[5] ?? "") || s[5] === "?")) {
    const end = s.indexOf("?>");
    if (end < 0) throw new Fail("unterminated XML declaration", 0);
    i = end + 2;
  }

  const readName = (): string => {
    const start = i;
    if (i >= n || !NAME_START.test(s[i])) throw new Fail("invalid name", i);
    i++;
    while (i < n && NAME_CHAR.test(s[i])) i++;
    return s.slice(start, i);
  };

  /** Validates `&...;` at s[i] === "&" and advances past it. */
  const readReference = (): void => {
    const semi = s.indexOf(";", i);
    if (semi < 0) throw new Fail("unterminated entity reference", i);
    const body = s.slice(i + 1, semi);
    if (PREDEFINED.has(body)) {
      i = semi + 1;
      return;
    }
    const dec = /^#([0-9]+)$/.exec(body);
    const hex = /^#x([0-9A-Fa-f]+)$/.exec(body);
    const m = dec ?? hex;
    if (!m) throw new Fail(`bad entity "&${body};"`, i);
    const cp = dec ? parseInt(m[1], 10) : parseInt(m[1], 16);
    if (!Number.isFinite(cp) || !isXmlChar(cp)) {
      throw new Fail(`character reference "&${body};" outside XML Char range`, i);
    }
    i = semi + 1;
  };

  while (i < n) {
    const c = s[i];
    if (c === "<") {
      if (s.startsWith("<!--", i)) {
        const end = s.indexOf("-->", i + 4);
        if (end < 0) throw new Fail("unterminated comment", i);
        if (s.slice(i + 4, end).includes("--")) throw new Fail("'--' inside comment", i);
        i = end + 3;
        continue;
      }
      if (s.startsWith("<!", i) || s.startsWith("<?", i)) {
        throw new Fail("unsupported markup declaration", i);
      }
      if (s[i + 1] === "/") {
        const tagStart = i;
        i += 2;
        const name = readName();
        while (i < n && isWs(s[i])) i++;
        if (s[i] !== ">") throw new Fail("malformed end tag", i);
        i++;
        const open = stack.pop();
        if (open === undefined) throw new Fail(`unexpected end tag </${name}>`, tagStart);
        if (open !== name) throw new Fail(`mismatched end tag </${name}>, expected </${open}>`, tagStart);
        continue;
      }
      // Start tag.
      const tagStart = i;
      if (stack.length === 0 && rootSeen) throw new Fail("multiple root elements", i);
      i++;
      const name = readName();
      const attrs = new Set<string>();
      for (;;) {
        const before = i;
        while (i < n && isWs(s[i])) i++;
        if (i >= n) throw new Fail("unterminated start tag", tagStart);
        if (s[i] === ">") {
          i++;
          stack.push(name);
          rootSeen = true;
          break;
        }
        if (s[i] === "/") {
          if (s[i + 1] !== ">") throw new Fail("malformed empty-element tag", i);
          i += 2;
          rootSeen = true;
          break;
        }
        if (i === before) throw new Fail("missing whitespace between attributes", i);
        const attr = readName();
        if (attrs.has(attr)) throw new Fail(`duplicate attribute "${attr}"`, i);
        attrs.add(attr);
        while (i < n && isWs(s[i])) i++;
        if (s[i] !== "=") throw new Fail(`attribute "${attr}" has no value`, i);
        i++;
        while (i < n && isWs(s[i])) i++;
        const q = s[i];
        if (q !== '"' && q !== "'") throw new Fail(`attribute "${attr}" value not quoted`, i);
        i++;
        for (;;) {
          if (i >= n) throw new Fail("unterminated attribute value", i);
          const ch = s[i];
          if (ch === q) {
            i++;
            break;
          }
          if (ch === "<") throw new Fail("raw '<' in attribute value", i);
          if (ch === "&") readReference();
          else i++;
        }
      }
      continue;
    }
    // Text content.
    if (stack.length === 0) {
      if (!isWs(c)) throw new Fail("content outside root element", i);
      i++;
      continue;
    }
    if (c === "&") {
      readReference();
      continue;
    }
    if (c === ">" && s.slice(Math.max(0, i - 2), i) === "]]") {
      throw new Fail("']]>' in content", i);
    }
    i++;
  }

  if (stack.length > 0) throw new Fail(`unclosed element <${stack[stack.length - 1]}>`, n);
  if (!rootSeen) throw new Fail("no root element", 0);
}

export function assertWellFormedXml(input: string): void {
  const r = checkXml(input);
  if (!r.ok) throw new Error(`Not well-formed XML: ${r.error} at index ${r.index}`);
}
