import mammoth from "mammoth";
import { parseText } from "./textParser";
import type { ParseResult } from "./validate";

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .doc / .xls / .ppt
const RTF_SIGNATURE = [0x7b, 0x5c, 0x72, 0x74, 0x66]; // "{\\rtf"

function startsWith(buf: ArrayBuffer, sig: number[]): boolean {
  if (buf.byteLength < sig.length) return false;
  const view = new Uint8Array(buf, 0, sig.length);
  return sig.every((b, i) => view[i] === b);
}

function looksLikeZip(buf: ArrayBuffer): boolean {
  return startsWith(buf, ZIP_SIGNATURE);
}

function looksLikeOle2(buf: ArrayBuffer): boolean {
  return startsWith(buf, OLE2_SIGNATURE);
}

function looksLikeRtf(buf: ArrayBuffer): boolean {
  return startsWith(buf, RTF_SIGNATURE);
}

/**
 * Detect Microsoft Information Protection / RMS / DRM-encrypted Office documents.
 * These are valid OLE2 compound files but the content stream is encrypted and
 * unreadable without authenticating against the tenant's rights service in Word.
 */
function looksLikeEncryptedOffice(buf: ArrayBuffer): boolean {
  // Scan first ~64KB of the file for distinctive MIP/RMS marker strings.
  const view = new Uint8Array(buf, 0, Math.min(buf.byteLength, 65536));
  // The markers are stored as UTF-16LE inside OLE streams, so look for ASCII
  // bytes alternating with NULs.
  const haystack = new TextDecoder("latin1").decode(view).replace(/\0/g, "");
  return (
    haystack.includes("EncryptedPackage") ||
    haystack.includes("DRMEncryptedDataSpace") ||
    haystack.includes("DRMEncryptedTransform") ||
    haystack.includes("Microsoft.Metadata.DRMTransform") ||
    haystack.includes("mipLabelMetadata")
  );
}

/**
 * Best-effort text extraction for legacy Word .doc (OLE2 compound) files.
 * Scans the whole buffer for UTF-16LE and ASCII printable runs, keeps long ones,
 * and concatenates. Not perfect — formatting and ordering may drift — but
 * usually recovers enough question/answer text for the text parser to work.
 */
function extractStringsFromOle2(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const MIN_RUN = 6;
  const out: string[] = [];

  // UTF-16LE pass: pairs of (printable, 0x00)
  {
    let run = "";
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const lo = bytes[i];
      const hi = bytes[i + 1];
      const isAsciiPrint =
        hi === 0 && (lo === 9 || lo === 10 || lo === 13 || (lo >= 32 && lo < 127));
      // Allow a few common Latin-1 / smart-quote code points (U+00A0..U+00FF, U+2010..U+201F)
      const isLatin1 = hi === 0x00 && lo >= 0xa0;
      const isPunct = (hi === 0x20 && lo >= 0x10 && lo <= 0x2f);
      if (isAsciiPrint || isLatin1 || isPunct) {
        run += String.fromCharCode(lo | (hi << 8));
      } else {
        if (run.length >= MIN_RUN) out.push(run);
        run = "";
      }
    }
    if (run.length >= MIN_RUN) out.push(run);
  }

  // ASCII pass (catches stretches stored as 8-bit)
  {
    let run = "";
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) {
        run += String.fromCharCode(c);
      } else {
        if (run.length >= MIN_RUN) out.push(run);
        run = "";
      }
    }
    if (run.length >= MIN_RUN) out.push(run);
  }

  // De-dupe near-identical lines while preserving order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of out) {
    const key = s.replace(/\s+/g, " ").trim();
    if (key.length < MIN_RUN) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  return unique.join("\n");
}

/** Very small RTF→text fallback: strip control words and groups. */
function rtfToText(buf: ArrayBuffer): string {
  const raw = new TextDecoder("latin1").decode(buf);
  return raw
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function looksLikeText(buf: ArrayBuffer): boolean {
  const view = new Uint8Array(buf, 0, Math.min(512, buf.byteLength));
  let printable = 0;
  for (let i = 0; i < view.length; i++) {
    const c = view[i];
    if (c === 0) return false;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) printable++;
  }
  return view.length > 0 && printable / view.length > 0.9;
}

export async function parseDocx(file: File): Promise<ParseResult> {
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (e) {
    return { errors: [`Could not read file: ${(e as Error).message}`] };
  }

  if (!looksLikeZip(buffer)) {
    // Encrypted / rights-protected Office document — content is unreadable here.
    if (looksLikeEncryptedOffice(buffer)) {
      return {
        errors: [
          "This document is encrypted with Microsoft Information Protection (MIP / Azure RMS / sensitivity label).",
          "The question text is sealed inside an `EncryptedPackage` stream and can only be decrypted by Word after you authenticate against your tenant.",
          "To use it here:",
          "  1. Open the file in Microsoft Word (signed in to the tenant that issued the label).",
          "  2. File → Info → Protect Document → Restrict Access → Remove restriction (if your label policy allows it).",
          "     — or — File → Save As → Plain Text (.txt) or Word Document (.docx) without the sensitivity label.",
          "  3. Upload the unprotected file.",
          "If your organisation does not allow removing the label, you cannot use this document in a third-party tool.",
        ],
      };
    }

    // Legacy Word 97-2003 .doc (OLE2 compound document) — extract strings heuristically.
    if (looksLikeOle2(buffer)) {
      const text = extractStringsFromOle2(buffer);
      if (text.trim().length === 0) {
        return {
          errors: [
            "This appears to be a legacy Word 97-2003 .doc file but no text could be extracted. " +
              "Please open it in Word and File → Save As → Word Document (.docx), then re-upload.",
          ],
        };
      }
      const result = parseText(text, file.name.replace(/\.docx?$/i, ""));
      result.errors.unshift(
        "Note: this is a legacy Word 97-2003 .doc file. Text was extracted with a best-effort scraper — " +
          "formatting and question ordering may be imperfect. For best results, open the file in Word and " +
          "save as .docx (Word Document)."
      );
      return result;
    }

    // RTF saved as .docx
    if (looksLikeRtf(buffer)) {
      const text = rtfToText(buffer);
      const result = parseText(text, file.name.replace(/\.docx?$/i, ""));
      result.errors.unshift(
        "Note: this file is RTF, not .docx. Parsed with a minimal RTF→text converter; " +
          "complex formatting may be lost."
      );
      return result;
    }

    // Plain text or text-like content with a .docx extension.
    if (looksLikeText(buffer)) {
      const text = new TextDecoder().decode(buffer);
      const result = parseText(text, file.name);
      result.errors.unshift(
        "Note: this file is not a real .docx (ZIP) document — parsed as plain text instead. " +
          "For best results re-save the document from Word as .docx, or paste the content into a .txt file."
      );
      return result;
    }
    return {
      errors: [
        "This file is not a valid .docx (Office Open XML) document. Likely causes:",
        "  • An older Word 97-2003 .doc file — re-save in Word as .docx.",
        "  • An RTF or PDF renamed to .docx — use the original format instead.",
        "  • A Google Docs export gone wrong — use File → Download → Microsoft Word (.docx).",
        "  • A corrupted download — try downloading again.",
        "Workaround: open the file in Word and File → Save As → .docx, or copy the text into a .txt or .md file.",
      ],
    };
  }

  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    if (!result.value || result.value.trim().length === 0) {
      return { errors: ["DOCX appears to be empty or contains no extractable text."] };
    }
    const parsed = parseText(result.value, file.name.replace(/\.docx$/i, ""));
    if (result.messages && result.messages.length > 0) {
      parsed.errors.push(
        ...result.messages
          .filter((m) => m.type === "warning" || m.type === "error")
          .slice(0, 5)
          .map((m) => `DOCX: ${m.message}`)
      );
    }
    return parsed;
  } catch (e) {
    return { errors: [`Failed to read DOCX: ${(e as Error).message}`] };
  }
}
