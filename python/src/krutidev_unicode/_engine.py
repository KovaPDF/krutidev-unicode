"""Kruti Dev 010 <-> Unicode Hindi: a pure Python port of the KovaPDF website
engine (frontend/lib/hindi/kruti.ts and hindiEnglish.ts).

The data tables live in _tables.py, which is GENERATED from the TypeScript
engine. This file is the logic, ported rule for rule; the shared test vectors
(test/vectors.json, made by running the website engine) check that both give
the same output. Read the SPEC comment at the top of
src/engine/hindi/kruti.ts for the rules.

The TypeScript engine works on UTF-16 code units. To give exactly the same
results for text outside the Basic Multilingual Plane (emoji), this port
converts the input to a string of UTF-16 code units first (surrogates as
separate characters) and joins them back at the end.
"""

from __future__ import annotations

import base64
import math
import re
from typing import Callable, Dict, List, Optional, Set, Tuple

from . import _tables as T

# --------------------------------------------------------------------------
# UTF-16 helpers
# --------------------------------------------------------------------------

_ASTRAL = re.compile("[\U00010000-\U0010FFFF]")
_SURR = re.compile("[\ud800-\udfff]")


def _units(s: str) -> str:
    if not _ASTRAL.search(s):
        return s
    out = []
    for ch in s:
        o = ord(ch)
        if o >= 0x10000:
            o -= 0x10000
            out.append(chr(0xD800 + (o >> 10)))
            out.append(chr(0xDC00 + (o & 0x3FF)))
        else:
            out.append(ch)
    return "".join(out)


def _text(u: str) -> str:
    if not _SURR.search(u):
        return u
    return u.encode("utf-16-le", "surrogatepass").decode("utf-16-le", "surrogatepass")


_JS_WS = "\t\n\u000b\u000c\r    -     　﻿"
_RX = re.IGNORECASE | re.ASCII

# --------------------------------------------------------------------------
# Code units and classes
# --------------------------------------------------------------------------

C_HALANT = 0x094D
C_NUKTA = 0x093C
C_AA = 0x093E
C_I = 0x093F
C_II = 0x0940
C_E = 0x0947
C_AI = 0x0948
C_O = 0x094B
C_AU = 0x094C
C_CE = 0x0945
C_CO = 0x0949
C_ANUS = 0x0902
C_CHANDRA = 0x0901
C_VISARGA = 0x0903
C_RA = 0x0930
C_A_LETTER = 0x0905
C_AA_LETTER = 0x0906
C_E_LETTER = 0x090F
C_AI_LETTER = 0x0910
C_O_LETTER = 0x0913
C_AU_LETTER = 0x0914
C_CAND_O_LETTER = 0x0911
C_CAND_E_LETTER = 0x090D

C_MI = ord(T.M_I)
C_MIA = ord(T.M_I_AN)
C_MREPH = ord(T.M_REPH)
C_MHALF = ord(T.M_HALF)
C_MVIS = 0xE005


def _is_cons(c: int) -> bool:
    return 0x0915 <= c <= 0x0939 or 0x0958 <= c <= 0x095F


def _is_vowel_sign(c: int) -> bool:
    return 0x093E <= c <= 0x094C or 0x094E <= c <= 0x094F or 0x0955 <= c <= 0x0957 or c == 0x0962 or c == 0x0963


def _is_mark(c: int) -> bool:
    return c == C_ANUS or c == C_CHANDRA


def _is_halant_like(c: int) -> bool:
    return c == C_HALANT or c == C_MHALF


def _is_devanagari(c: int) -> bool:
    return 0x0900 <= c <= 0x097F


def _is_space_code(c: int) -> bool:
    return (
        c == 32 or c == 9 or c == 10 or c == 13 or c == 11 or c == 12 or c == 0xA0
        or 0x2000 <= c <= 0x200A or c == 0x2028 or c == 0x2029 or c == 0x202F or c == 0x205F or c == 0x3000
    )


def _is_ascii_digit(c: int) -> bool:
    return 48 <= c <= 57


def _is_latin_letter(c: int) -> bool:
    return 65 <= c <= 90 or 97 <= c <= 122


# --------------------------------------------------------------------------
# Kruti -> Unicode tables
# --------------------------------------------------------------------------

TAB_SIZE = 0x2220
# first code unit -> [(key, [values])] longest key first
_FIRST: Dict[int, List[Tuple[str, List[int]]]] = {}
_LETTER_CODE = [0] * TAB_SIZE

for _k, _v in T.KRUTI_TO_UNICODE:
    _c = ord(_k[0])
    _FIRST.setdefault(_c, []).append((_k, [ord(ch) for ch in _v]))
    _v0 = ord(_v[0])
    if (
        len(_k) == 1
        and (_is_devanagari(_v0) or _v0 >= 0xE000)
        and _v not in ("।", "॥", "ऽ", "॰")
        and not (0x0966 <= _v0 <= 0x096F)
        and _c < TAB_SIZE
    ):
        _LETTER_CODE[_c] = 1
for _lst in _FIRST.values():
    _lst.sort(key=lambda e: -len(e[0]))
_LETTER_CODE[0x2013] = 1
_LETTER_CODE[0x2014] = 1
_LETTER_CODE[ord("%")] = 0


def _is_letter_code(c: int) -> bool:
    return c < TAB_SIZE and _LETTER_CODE[c] == 1


def _fold_input_char(c: int) -> Optional[str]:
    if 0x80 <= c <= 0x9F:
        m = T.CP1252_C1[c - 0x80]
        return m if m else None
    if 0xF020 <= c <= 0xF0FF:
        b = c - 0xF000
        if 0x80 <= b <= 0x9F:
            m = T.CP1252_C1[b - 0x80]
            return m if m else None
        return chr(b)
    return None


def _fold_input(src: str) -> str:
    out: Optional[List[str]] = None
    for i, ch in enumerate(src):
        c = ord(ch)
        if c < 0x80 or (0x9F < c < 0xF020) or c > 0xF0FF:
            continue
        f = _fold_input_char(c)
        if f is not None:
            if out is None:
                out = list(src)
            out[i] = f
    return src if out is None else "".join(out)


_COLON_SET = set(T.COLON_LABELS)

# --------------------------------------------------------------------------
# Kruti -> Unicode
# --------------------------------------------------------------------------


class _Ctx:
    __slots__ = ("keep", "unknown", "visarga", "anomalies")

    def __init__(self, keep, unknown, visarga, anomalies):
        self.keep = keep
        self.unknown = unknown
        self.visarga = visarga
        self.anomalies = anomalies


class _Buf:
    """Code-unit buffer with an opaque flag per unit."""

    __slots__ = ("a", "o")

    def __init__(self):
        self.a: List[int] = []
        self.o: List[int] = []

    @property
    def n(self) -> int:
        return len(self.a)

    def push(self, c: int, opaque: int = 0) -> None:
        self.a.append(c)
        self.o.append(opaque)

    def last(self, back: int = 1) -> int:
        p = len(self.a) - back
        return self.a[p] if p >= 0 and not self.o[p] else -1

    def insert(self, at: int, units: List[int]) -> None:
        self.a[at:at] = units
        self.o[at:at] = [0] * len(units)

    def remove(self, at: int) -> None:
        del self.a[at]
        del self.o[at]

    def to_string(self) -> str:
        a = self.a
        o = self.o
        return "".join(chr(C_HALANT if (x == C_MHALF and not o[i]) else x) for i, x in enumerate(a))


def _is_out_punct(c: int) -> bool:
    if c < 0x80:
        return not _is_latin_letter(c) and not _is_ascii_digit(c)
    return c == 0x0964 or c == 0x0965 or 0x2010 <= c <= 0x205E


def _tokenize(s: str, ctx: _Ctx) -> _Buf:
    keep = ctx.keep
    n = len(s)
    b = _Buf()
    i = 0
    while i < n:
        c = ord(s[i])
        if keep is not None and keep[i]:
            b.push(c, 1)
            i += 1
            continue
        if _is_space_code(c):
            b.push(c)
            i += 1
            continue
        if c == 0x25:  # %
            i += 1
            prev = b.a[-1] if b.n > 0 and not b.o[-1] else -1
            nx = ord(s[i]) if i < n and not (keep is not None and keep[i]) else -1
            if prev < 0 or _is_space_code(prev) or _is_ascii_digit(prev) or _is_out_punct(prev):
                b.push(0x3A)
            elif nx == 0x26:
                b.push(0x3A)
            elif nx >= 0 and _is_letter_code(nx):
                b.push(C_VISARGA)
            elif ctx.visarga == "colon":
                b.push(0x3A)
            elif ctx.visarga == "visarga":
                b.push(C_VISARGA)
            else:
                b.push(C_MVIS)
            continue
        if c == 0x2013 or c == 0x2014:
            nx = ord(s[i + 1]) if i + 1 < n and not (keep is not None and keep[i + 1]) else -1
            if nx >= 0 and _is_letter_code(nx):
                b.push(0x0926 if c == 0x2013 else 0x0915)
                b.push(0x0943)
            else:
                b.push(c)
            i += 1
            continue
        hit = None
        lst = _FIRST.get(c) if c < TAB_SIZE else None
        if lst is not None:
            for key, val in lst:
                if len(key) == 1:
                    hit = (key, val)
                    break
                if i + len(key) <= n and s.startswith(key, i):
                    ok = True
                    if keep is not None:
                        for m in range(1, len(key)):
                            if keep[i + m]:
                                ok = False
                    if ok:
                        hit = (key, val)
                        break
        if hit is None:
            if _is_ascii_digit(c) or c == 0x21:
                b.push(c)
            else:
                is_high = 0xD800 <= c <= 0xDBFF and i + 1 < n
                ch = s[i : i + 2] if is_high else s[i]
                known = _is_devanagari(c) or c == 0x200C or c == 0x200D or 0xE000 <= c <= 0xE0FF
                if not known and ctx.unknown is not None:
                    ctx.unknown[ch] = None
                if ctx.anomalies >= 0 and not _is_devanagari(c):
                    ctx.anomalies += 1
                b.push(c, 1)
                if is_high:
                    b.push(ord(s[i + 1]), 1)
                    i += 1
            i += 1
            continue
        key, v = hit
        v0 = v[0]
        last = b.last()
        if len(key) == 1 and len(v) == 1:
            if v0 == C_ANUS and last == C_ANUS:
                i += 1
                continue
            if v0 == C_E and last == C_ANUS and b.last(2) == C_E:
                i += 1
                continue
            if v0 == C_MREPH and last == C_MREPH:
                i += 1
                continue
        if (v0 == C_AA or v0 == C_O or v0 == C_AU) and last == 0x20 and b.last(2) == C_MHALF:
            b.a.pop()
            b.o.pop()
        if v0 == C_NUKTA and len(v) == 1 and _is_halant_like(last) and b.n >= 2 and _is_cons(b.last(2)):
            b.a[-1] = C_NUKTA
            b.push(last)
            i += 1
            continue
        for x in v:
            b.a.append(x)
            b.o.append(0)
        i += len(key)
    return b


def _cluster_end(a: List[int], o: List[int], n: int, j: int) -> int:
    k = j + 1
    if k < n and not o[k] and a[k] == C_NUKTA:
        k += 1
    while k + 1 < n and not o[k] and not o[k + 1] and _is_halant_like(a[k]) and _is_cons(a[k + 1]):
        k += 2
        if k < n and not o[k] and a[k] == C_NUKTA:
            k += 1
    return k


_COMPOSE_NUKTA = {0x0928: 0x0929, 0x0930: 0x0931, 0x0933: 0x0934}


def _reorder(at: _Buf, ctx: _Ctx) -> str:
    a = at.a
    o = at.o
    n = at.n
    out = _Buf()
    count = ctx.anomalies >= 0

    def put(c: int) -> None:
        if _is_vowel_sign(c):
            p = out.n
            while p > 0 and not out.o[p - 1] and _is_mark(out.a[p - 1]):
                p -= 1
            has_base = p > 0 and not out.o[p - 1]
            if p < out.n and not has_base:
                p = out.n
            prev = out.a[p - 1] if p > 0 and not out.o[p - 1] else -1
            if _is_halant_like(prev):
                half = prev == C_MHALF
                if half and c in (C_AA, C_O, C_AU):
                    out.remove(p - 1)
                    if c == C_AA:
                        return
                    c = C_E if c == C_O else C_AI
                else:
                    out.remove(p - 1)
                    if count and half:
                        ctx.anomalies += 1
                p -= 1
                prev = out.a[p - 1] if p > 0 and not out.o[p - 1] else -1
            merged = -1
            if prev == C_AA:
                merged = C_O if c == C_E else C_AU if c == C_AI else C_CO if c == C_CE else -1
            elif prev == C_AA_LETTER and c == C_CE:
                merged = C_CAND_O_LETTER
            elif prev == C_A_LETTER:
                merged = (
                    C_AA_LETTER if c == C_AA else C_O_LETTER if c == C_O else C_AU_LETTER if c == C_AU else C_CAND_O_LETTER if c == C_CO else -1
                )
            elif prev == C_E_LETTER:
                merged = C_AI_LETTER if c == C_E else C_CAND_E_LETTER if c == C_CE else -1
            if merged >= 0:
                out.a[p - 1] = merged
                return
            if count and not (_is_cons(prev) or prev == C_NUKTA):
                ctx.anomalies += 1
            if p == out.n:
                out.push(c)
            else:
                out.insert(p, [c])
            return
        last = out.last()
        if c == C_HALANT or c == C_MHALF:
            if _is_halant_like(last):
                if c == C_HALANT:
                    out.a[-1] = C_HALANT
                return
            if count and not _is_cons(last) and last != C_NUKTA:
                ctx.anomalies += 1
            out.push(c)
            return
        if c == C_NUKTA:
            if _is_halant_like(last) and _is_cons(out.last(2)):
                out.a[-1] = C_NUKTA
                out.push(last)
                return
            if _is_vowel_sign(last) or _is_mark(last):
                p = out.n
                while p > 0 and not out.o[p - 1] and (_is_vowel_sign(out.a[p - 1]) or _is_mark(out.a[p - 1])):
                    p -= 1
                if p > 0 and not out.o[p - 1] and _is_cons(out.a[p - 1]):
                    comp = _COMPOSE_NUKTA.get(out.a[p - 1])
                    if comp is not None:
                        out.a[p - 1] = comp
                    else:
                        out.insert(p, [C_NUKTA])
                    return
            comp = _COMPOSE_NUKTA.get(last)
            if comp is not None:
                out.a[-1] = comp
                return
            if count and not _is_cons(last):
                ctx.anomalies += 1
            out.push(c)
            return
        if _is_mark(c) and c == last:
            return
        if count:
            if (_is_mark(c) or c == C_VISARGA) and (last < 0 or _is_space_code(last) or _is_out_punct(last)):
                ctx.anomalies += 1
            if _is_cons(c) or _is_mark(c):
                pass
            elif last == C_MHALF:
                ctx.anomalies += 1
        out.push(c)

    def reph() -> None:
        A = out.a
        O = out.o
        p = out.n
        while p > 0 and not O[p - 1] and (_is_vowel_sign(A[p - 1]) or _is_mark(A[p - 1])):
            p -= 1
        q = p
        if q > 0 and not O[q - 1] and A[q - 1] == C_NUKTA:
            q -= 1
        if q > 0 and not O[q - 1] and _is_cons(A[q - 1]):
            q -= 1
            while True:
                if q < 2 or O[q - 1] or not _is_halant_like(A[q - 1]):
                    break
                r = q - 2
                if not O[r] and A[r] == C_NUKTA and r >= 1:
                    r -= 1
                if O[r] or not _is_cons(A[r]):
                    break
                q = r
            out.insert(q, [C_RA, C_HALANT])
            return
        if count:
            ctx.anomalies += 1
        out.push(C_RA)
        out.push(C_HALANT)

    def visarga() -> None:
        last = out.last()
        if _is_vowel_sign(last) or _is_mark(last):
            out.push(0x3A)
            return
        if _is_cons(last) or last == C_NUKTA:
            p = out.n
            while p > 0 and out.n - p < 40 and not out.o[p - 1] and _is_devanagari(out.a[p - 1]):
                p -= 1
            w = "".join(map(chr, out.a[p:]))
            out.push(0x3A if w in _COLON_SET else C_VISARGA)
            return
        out.push(0x3A)

    i = 0
    while i < n:
        c = a[i]
        if o[i]:
            out.push(c, 1)
            i += 1
            continue
        if c == C_MI or c == C_MIA:
            j = i + 1
            while j < n and not o[j] and _is_mark(a[j]):
                j += 1
            if j < n and not o[j] and _is_cons(a[j]):
                k = _cluster_end(a, o, n, j)
                for m in range(j, k):
                    put(a[m])
                put(C_I)
                if c == C_MIA:
                    out.push(C_ANUS)
                for m in range(i + 1, j):
                    out.push(a[m])
                i = k
                continue
            if count:
                ctx.anomalies += 1
            out.push(C_I)
            if c == C_MIA:
                out.push(C_ANUS)
            i += 1
            continue
        if c == C_MREPH:
            reph()
            i += 1
            continue
        if c == C_MVIS:
            visarga()
            i += 1
            continue
        put(c)
        i += 1
    if count and out.n > 0 and out.a[-1] == C_MHALF and not out.o[-1]:
        ctx.anomalies += 1
    if count:
        for x in range(out.n - 1):
            if out.a[x] == C_MHALF and not out.o[x] and not _is_cons(out.a[x + 1]):
                ctx.anomalies += 1
    return out.to_string()


def _decode_kruti(folded: str, keep, unknown, visarga: str) -> str:
    ctx = _Ctx(keep, unknown, visarga, -1)
    return _reorder(_tokenize(folded, ctx), ctx)


# --------------------------------------------------------------------------
# Hindi letter-pair plausibility and English protection (hindiEnglish.ts)
# --------------------------------------------------------------------------

_HI_PAIRS = base64.b64decode(T.HI_PAIRS_B64)
_HI_INDEX: Dict[str, int] = {}
for _i, _ch in enumerate(T.HI_ALPHABET):
    _HI_INDEX[_ch] = _i


def _hindi_word_plausible(uni: str) -> bool:
    N = len(T.HI_ALPHABET)
    idx = _HI_INDEX
    pairs = _HI_PAIRS

    def has(bit: int) -> bool:
        return (pairs[bit >> 3] & (1 << (bit & 7))) != 0

    prev = 0
    any_ = False
    for ch in uni:
        if ch in ("ऩ", "ऱ", "ऴ"):
            base = "न" if ch == "ऩ" else "र" if ch == "ऱ" else "ळ"
            k0 = idx[base]
            if not has(prev * N + k0):
                return False
            prev = k0
            any_ = True
            ch = "़"
        k = idx.get(ch)
        if k is None or k < 2:
            if any_ and not has(prev * N + 1):
                return False
            prev = 0
            any_ = False
            continue
        if not has(prev * N + k):
            return False
        prev = k
        any_ = True
    if any_ and not has(prev * N + 1):
        return False
    return True


_EN_SET: Set[str] = set(w for w in T.EN_WORDS.split(" ") if w)
_ACRONYM_SET: Set[str] = set(T.ACRONYMS_LIST.split(" "))
_HINDI_FIRST: Set[str] = set(T.HINDI_FIRST_LIST.split(" "))
_KRUTI_COMMON: Set[str] = set(T.KRUTI_COMMON_LIST.split(" "))
_POSS_RE = re.compile("['’]s\\Z")


def _is_known_acronym(s: str) -> bool:
    return s in _ACRONYM_SET or s.upper() in _ACRONYM_SET


def _is_english_word_form(lower: str) -> bool:
    st = _EN_SET
    w = _POSS_RE.sub("", lower, count=1).replace("'", "").replace("’", "")
    if len(w) < 2:
        return w == "a" or w == "i"
    if w in st:
        return True
    if w.find("-") > 0:
        return all(len(p) > 0 and (p in st or _is_english_word_form(p)) for p in w.split("-"))

    def try_base(b: str) -> bool:
        return len(b) >= 2 and (b in st or (b + "e") in st)

    def undouble(b: str) -> str:
        return b[:-1] if len(b) >= 3 and b[-1] == b[-2] else b

    if w.endswith("ies") and try_base(w[:-3] + "y"):
        return True
    if w.endswith("ied") and try_base(w[:-3] + "y"):
        return True
    if w.endswith("es") and try_base(w[:-2]):
        return True
    if w.endswith("s") and not w.endswith("ss") and w[:-1] in st:
        return True
    if w.endswith("ed"):
        b = w[:-2]
        if try_base(b) or undouble(b) in st:
            return True
    if w.endswith("ing"):
        b = w[:-3]
        if try_base(b) or undouble(b) in st:
            return True
    if w.endswith("ers") or w.endswith("er"):
        b = w[:-3] if w.endswith("ers") else w[:-2]
        if try_base(b) or undouble(b) in st:
            return True
    if w.endswith("est"):
        b = w[:-3]
        if try_base(b) or undouble(b) in st:
            return True
    if w.endswith("ily") and (w[:-3] + "y") in st:
        return True
    if w.endswith("ly") and try_base(w[:-2]):
        return True
    if w.endswith("ment") and try_base(w[:-4]):
        return True
    if w.endswith("ness") and try_base(w[:-4]):
        return True
    return False


_COMMON_TRAIL = re.compile("(?:AA|[A\\]\\-,.;:!?])+\\Z")


def _is_kruti_common_word(token: str) -> bool:
    return token in _KRUTI_COMMON or _COMMON_TRAIL.sub("", token, count=1) in _KRUTI_COMMON


LEAD_PUNCT = "([{<\"'‘“¼Þ^"
TRAIL_PUNCT = ")]}>\"'.,;:!?’”½ß*\\%&-"
KEEP_LEAD = "(\"'‘“"
KEEP_TRAIL = ".,;:!?)\"'’”"
URL_RE = re.compile("(?:https?://|ftp://|www\\.)[^" + _JS_WS + "]+", _RX)
EMAIL_RE = re.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}")
FILE_RE = re.compile(
    "[A-Za-z0-9][A-Za-z0-9_\\-.]*\\.(?:pdf|docx?|xlsx?|pptx?|txt|csv|rtf|odt|ods|odp|jpe?g|png|gif|bmp|webp|tiff?|svg|heic|zip|rar|7z|html?|css|js|ts|json|xml|md|mp[34]|wav|avi|mkv|mov|exe|apk|msi|epub|psd|ai|eps)",
    _RX,
)


def _is_file_name(s: str) -> bool:
    if not FILE_RE.fullmatch(s):
        return False
    ext = s[s.rfind(".") + 1 :]
    return ext == ext.lower() or ext == ext.upper()


NUMBER_RE = re.compile("[0-9]+(?:[.,:/-][0-9]+)*")
PERCENT_RE = re.compile("[0-9]+(?:[.,][0-9]+)?%")
ORDINAL_RE = re.compile("[0-9]+(?:st|nd|rd|th)", _RX)
ALNUM_CODE_RE = re.compile("[A-Z]{1,6}-?[0-9]{1,6}")
WORD_RE = re.compile("[A-Za-z](?:[A-Za-z'’-]*[A-Za-z])?")
CONTRACTION_RE = re.compile("[A-Za-z]+['’](?:s|t|re|ve|ll|d|m)", _RX)
WHOLE_TRAIL = ".,;:!?)]}\"'’”½ßA\\-&"
_ADDR_CHARS = re.compile("[.@:/]")
_APOS = re.compile("['’]")


def _has_non_ascii(s: str) -> bool:
    return any(ord(ch) > 0x7E for ch in s)


def _classify_kruti_token(core: str, whole: str, plausible: Callable[[str], bool]) -> str:
    if len(whole) <= 512 and _ADDR_CHARS.search(whole):
        if URL_RE.fullmatch(whole) or EMAIL_RE.fullmatch(whole) or _is_file_name(whole):
            return "E"
        if URL_RE.fullmatch(core) or EMAIL_RE.fullmatch(core) or _is_file_name(core):
            return "E"
    if len(core) > 64 or _has_non_ascii(core.replace("’", "'")):
        return "K"
    c0 = ord(core[0])
    if 48 <= c0 <= 57:
        if NUMBER_RE.fullmatch(core):
            return "N"
        if ORDINAL_RE.fullmatch(core):
            return "E"
    if ALNUM_CODE_RE.fullmatch(core):
        return "E" if _is_known_acronym(re.sub("[-0-9]", "", core)) or not plausible(core) else "e"
    if not WORD_RE.fullmatch(core):
        return "K"
    if _APOS.search(core) and not CONTRACTION_RE.fullmatch(core):
        return "K"
    letters = re.sub("['’-]", "", core)
    if len(letters) == 1:
        if letters == "a" or letters == "I":
            return "a"
        if letters == "A":
            return "I"
        return "K"
    if re.fullmatch("A+", letters):
        return "K"
    if core in _HINDI_FIRST:
        return "f"
    lower = letters.lower()
    all_caps = letters == letters.upper()
    capitalised = (not all_caps) and letters[0] == letters[0].upper() and letters[1:] == letters[1:].lower()
    all_lower = letters == lower
    in_list = _is_english_word_form(core.lower())
    if all_caps:
        if in_list or _is_known_acronym(letters):
            return "e" if plausible(core) else "E"
        if not plausible(core):
            return "E"
        return "K"
    if in_list:
        return "e" if plausible(core) else "E"
    if (all_lower or capitalised) and len(letters) >= 3:
        return "U"
    return "K"


class _Tok:
    __slots__ = ("start", "end", "i", "j", "line", "cls", "english", "lower_first", "bare")

    def __init__(self, start, end, i, j, line, cls, english, lower_first, bare):
        self.start = start
        self.end = end
        self.i = i
        self.j = j
        self.line = line
        self.cls = cls
        self.english = english
        self.lower_first = lower_first
        self.bare = bare


def _find_english_kruti(s: str, kept: List[str], plausible: Callable[[str], bool]) -> Optional[bytearray]:
    toks: List[_Tok] = []
    cls_cache: Dict[str, str] = {}
    n = len(s)
    line = 0
    i = 0
    while i < n:
        c = ord(s[i])
        if _is_space_code(c):
            if c == 10:
                line += 1
            i += 1
            continue
        if c == 0x26:
            i += 1
            continue
        j = i
        while j < n and not _is_space_code(ord(s[j])) and ord(s[j]) != 0x26:
            j += 1
        a = i
        b = j
        while a < b and s[a] in LEAD_PUNCT:
            a += 1
        while b > a and s[b - 1] in TRAIL_PUNCT:
            b -= 1
        if b > a:
            core = s[a:b]
            we = j
            while we > i and s[we - 1] in WHOLE_TRAIL:
                we -= 1
            whole = s[i:we]
            if PERCENT_RE.fullmatch(s[a:j]) and b == j - 1:
                cls = "Q"
                b = j
            elif whole == core:
                cls = cls_cache.get(core)
                if cls is None:
                    cls = _classify_kruti_token(core, whole, plausible)
                    cls_cache[core] = cls
            else:
                cls = _classify_kruti_token(core, whole, plausible)
            if cls == "E" and (URL_RE.fullmatch(whole) or EMAIL_RE.fullmatch(whole)):
                a = i
                b = i + len(whole)
            if len(core) > 64 and cls != "E":
                cls = "K"
            toks.append(_Tok(a, b, i, j, line, cls, cls in ("E", "Q"), "a" <= core[0] <= "z", a == i and b == j))
        else:
            toks.append(_Tok(i, i, i, j, line, "P", False, False, False))
        i = j
    if not toks:
        return None

    def candidate(t: Optional[_Tok], line0: int) -> bool:
        return t is not None and t.line == line0 and t.cls not in ("K", "U", "P", "Q")

    for k, t in enumerate(toks):
        if t.cls != "U":
            continue
        p = k - 1
        while p >= 0 and toks[p].cls == "P":
            p -= 1
        q = k + 1
        while q < len(toks) and toks[q].cls == "P":
            q += 1
        prev = toks[p] if p >= 0 else None
        nxt = toks[q] if q < len(toks) else None
        if candidate(prev, t.line) or (prev is not None and prev.cls == "u" and prev.line == t.line) or candidate(nxt, t.line):
            w = s[t.start : t.end]
            t.cls = "K" if plausible(w) else "u"
        else:
            t.cls = "K"

    k0 = 0
    while k0 < len(toks):
        t0 = toks[k0]
        if t0.cls == "K" or t0.cls == "P":
            k0 += 1
            continue
        run: List[_Tok] = []
        k = k0
        line0 = t0.line
        while k < len(toks) and toks[k].line == line0 and toks[k].cls != "K":
            if toks[k].cls != "P":
                run.append(toks[k])
            k += 1
        left_k = False
        m = k0 - 1
        while m >= 0 and toks[m].line == line0:
            if toks[m].cls == "P":
                m -= 1
                continue
            left_k = toks[m].cls == "K"
            break
        right_k = k < len(toks) and toks[k].line == line0 and toks[k].cls == "K"
        sure = sum(1 for t in run if t.cls == "E")
        if sure > 0:
            last = len(run) - 1
            for m, t in enumerate(run):
                left_ok = m > 0 or (not left_k and sure >= 2)
                right_ok = m < last or (not right_k and sure >= 2)
                if t.cls in ("E", "e"):
                    t.english = True
                elif t.cls == "N":
                    t.english = len(run) > 1
                elif t.cls in ("f", "u"):
                    t.english = left_ok and right_ok
                elif t.cls == "a":
                    t.english = True
                elif t.cls == "I":
                    t.english = left_ok and m < last and run[m + 1].lower_first
        k0 = k

    mask: Optional[bytearray] = None
    seen: Set[str] = set()
    for t in toks:
        if not t.english or t.end <= t.start:
            continue
        if mask is None:
            mask = bytearray(n)
        a = t.start
        b = t.end
        if t.cls not in ("N", "Q"):
            while a > t.i and s[a - 1] in KEEP_LEAD:
                a -= 1
            while b < t.j and s[b] in KEEP_TRAIL:
                b += 1
        for x in range(a, b):
            mask[x] = 1
        w = s[t.start : t.end]
        if t.cls not in ("N", "Q") and w not in seen:
            seen.add(w)
            if len(kept) < 1000:
                kept.append(w)
    return mask


_PLAUSIBLE_CACHE: Dict[str, bool] = {}


def _kruti_plausible(token: str) -> bool:
    hit = _PLAUSIBLE_CACHE.get(token)
    if hit is not None:
        return hit
    ctx = _Ctx(None, None, "auto", 0)
    uni = _reorder(_tokenize(_fold_input(token), ctx), ctx)
    ok = ctx.anomalies == 0 and _hindi_word_plausible(uni)
    if len(_PLAUSIBLE_CACHE) > 20000:
        _PLAUSIBLE_CACHE.clear()
    _PLAUSIBLE_CACHE[token] = ok
    return ok


# --------------------------------------------------------------------------
# Unicode -> Kruti
# --------------------------------------------------------------------------

_PREP_RE = re.compile("[ऩऱऴक़-य़]|़्")


def _prepare_unicode(src: str) -> str:
    if not _PREP_RE.search(src):
        return src
    return _PREP_RE.sub(lambda m: "़्" if len(m.group(0)) == 2 else T.NUKTA_DECOMP[m.group(0)], src)


def _full_glyph(cons: str) -> str:
    base = T.U2K_FULL[cons[0]]
    if len(cons) == 1:
        return base
    return base[:-1] + "+k" if len(base) > 1 and base.endswith("k") else base + "+"


def _half_glyph(cons: str) -> Optional[str]:
    h = T.U2K_HALF.get(cons[0])
    if h is None:
        return None
    return h + "+" if len(cons) > 1 else h


def _cluster_glyphs(cons: List[str], breaks: Optional[List[int]]):
    glyphs: List[str] = []
    m = len(cons)
    last_single = False
    k = 0
    while k < m:
        if k + 1 < m and len(cons[k]) == 1 and len(cons[k + 1]) == 1 and (breaks is None or (k + 1) not in breaks):
            lig = T.U2K_LIGATURES.get(cons[k] + T.HALANT + cons[k + 1])
            if lig is not None:
                if k + 2 == m:
                    glyphs.append(lig["full"])
                else:
                    glyphs.append(lig["half"] if "half" in lig else lig["full"] + "~")
                k += 2
                last_single = False
                continue
        C = cons[k]
        if k == m - 1:
            glyphs.append(_full_glyph(C))
            last_single = True
            k += 1
            continue
        if k + 2 == m and cons[k + 1] == "र" and (breaks is None or (k + 1) not in breaks):
            glyphs.append(_full_glyph(C) + "z")
            last_single = False
            k += 2
            continue
        h = _half_glyph(C)
        glyphs.append(h if h is not None else _full_glyph(C) + "~")
        last_single = False
        k += 1
    return glyphs, last_single


_SYL_CACHE: Dict[str, str] = {}


def _is_vowel_letter(c: int) -> bool:
    return 0x0904 <= c <= 0x0914 or c == 0x0960 or c == 0x0961 or 0x0972 <= c <= 0x0977


_DQ_OPEN = re.compile("[" + _JS_WS + "(\\[{‘“-]")
_SQ_OPEN = re.compile("[" + _JS_WS + "(\\[{\"“]")


def _punct_code(s: str, k: int, tok_start: int) -> Optional[str]:
    ch = s[k]
    hit = T.U2K_PUNCT.get(ch)
    if hit is not None:
        return hit
    if ch == '"':
        p = s[k - 1] if k > tok_start else " "
        return "Þ" if _DQ_OPEN.match(p) or k == tok_start else "ß"
    if ch == "'":
        return "^" if k == tok_start or _SQ_OPEN.match(s[k - 1]) else "*"
    if ch == "!":
        return "!"
    return None


LATIN_KEEP_LEAD = "(\"'‘“"
LATIN_KEEP_TRAIL = ".,;:!?)\"'’”"
_WORDISH = re.compile("[A-Za-z0-9\u0080-￿]")
_CURLY = re.compile("[‘’“”…–—]")


def _is_latin_or_digit(c: int) -> bool:
    return _is_latin_letter(c) or _is_ascii_digit(c)


def _encode_syllable(s: str, start: int, end: int, out: List[str], unknown) -> int:
    k = start
    reph = False
    if ord(s[k]) == C_RA and k + 2 < end and ord(s[k + 1]) == C_HALANT and _is_cons(ord(s[k + 2])):
        reph = True
        k += 2
    cons: List[str] = []
    breaks: Optional[List[int]] = None
    final_hal = False
    while True:
        C = s[k]
        k += 1
        if k < end and ord(s[k]) == C_NUKTA:
            C += T.NUKTA
            k += 1
        cons.append(C)
        if k < end and ord(s[k]) == C_HALANT:
            nx = ord(s[k + 1]) if k + 1 < end else -1
            if _is_cons(nx):
                k += 1
                continue
            if nx == 0x200D and k + 2 < end and _is_cons(ord(s[k + 2])):
                if breaks is None:
                    breaks = []
                breaks.append(len(cons))
                k += 2
                continue
            final_hal = True
            k += 1
            if k < end and ord(s[k]) in (0x200C, 0x200D):
                k += 1
        break
    vs = ""
    if not final_hal and k < end and _is_vowel_sign(ord(s[k])):
        vs = s[k]
        k += 1
    mods = ""
    while k < end:
        c = ord(s[k])
        if c in (C_ANUS, C_CHANDRA, C_VISARGA):
            mods += s[k]
            k += 1
        else:
            break
    key = s[start:k]
    hit = _SYL_CACHE.get(key)
    if hit is None:
        glyphs, last_single = _cluster_glyphs(cons, breaks)
        vs_code = ""
        pre = ""
        if vs == "ि":
            pre = "f"
        elif vs != "":
            last = cons[-1]
            combo = T.U2K_COMBOS.get(last + vs) if last_single and len(last) == 1 else None
            if combo is not None:
                glyphs[-1] = combo
            else:
                vs_code = T.U2K_SIGNS.get(vs, vs)
        mm = "".join(T.U2K_SIGNS[ch] for ch in mods)
        hit = pre + "".join(glyphs) + ("~" if final_hal else "") + vs_code + ("Z" if reph else "") + mm
        if len(_SYL_CACHE) > 50000:
            _SYL_CACHE.clear()
        _SYL_CACHE[key] = hit
    if unknown is not None and vs != "" and vs != "ि" and vs not in T.U2K_SIGNS and not T.U2K_COMBOS.get(cons[-1] + vs):
        unknown[vs] = None
    out.append(hit)
    return k


def _encode_unicode(src: str, unknown) -> str:
    s = _prepare_unicode(src)
    n = len(s)
    out: List[str] = []

    def flag(ch: str) -> None:
        if unknown is not None:
            unknown[ch] = None

    i = 0
    while i < n:
        c0 = ord(s[i])
        if _is_space_code(c0):
            j = i + 1
            while j < n and _is_space_code(ord(s[j])):
                j += 1
            out.append(s[i:j])
            i = j
            continue
        j = i + 1
        while j < n and not _is_space_code(ord(s[j])):
            j += 1
        has_latin = any(_is_latin_letter(ord(s[x])) for x in range(i, j))
        a = i
        b = j
        if has_latin:
            while a < b and not _WORDISH.match(s[a]):
                a += 1
            while b > a and not _WORDISH.match(s[b - 1]):
                b -= 1
            while a < b and _CURLY.match(s[a]):
                a += 1
            while b > a and _CURLY.match(s[b - 1]):
                b -= 1
        k = i
        while k < j:
            c = ord(s[k])
            if _is_devanagari(c):
                if _is_cons(c):
                    k = _encode_syllable(s, k, j, out, unknown)
                    continue
                if _is_vowel_letter(c):
                    v = T.U2K_VOWELS.get(s[k])
                    if v is not None:
                        out.append(v)
                    else:
                        out.append(s[k])
                        flag(s[k])
                    k += 1
                    continue
                if c == C_I:
                    out.append("f")
                    k += 1
                    continue
                g = T.U2K_SIGNS.get(s[k])
                if g is not None:
                    out.append(g)
                else:
                    out.append(s[k])
                    flag(s[k])
                k += 1
                continue
            if c == 0x200C or c == 0x200D:
                p = ord(s[k - 1]) if k > i else 0
                q = ord(s[k + 1]) if k + 1 < j else 0
                if not _is_devanagari(p) and not _is_devanagari(q):
                    out.append(s[k])
                k += 1
                continue
            if _is_latin_letter(c) or _is_ascii_digit(c):
                out.append(s[k])
                k += 1
                continue
            p = ord(s[k - 1]) if k > i else 0
            q = ord(s[k + 1]) if k + 1 < j else 0
            ch0 = s[k]
            in_latin = has_latin and (
                (a <= k < b and not _is_devanagari(p) and not _is_devanagari(q))
                or (k < a and a < b and ch0 in LATIN_KEEP_LEAD and _is_latin_or_digit(ord(s[a])))
                or (k >= b and a < b and ch0 in LATIN_KEEP_TRAIL and _is_latin_or_digit(ord(s[b - 1])))
            )
            if in_latin:
                out.append(s[k])
                k += 1
                continue
            code = _punct_code(s, k, i)
            if code is not None:
                out.append(code)
                k += 1
                continue
            high = 0xD800 <= c <= 0xDBFF and k + 1 < j
            ch = s[k : k + 2] if high else s[k]
            out.append(ch)
            flag(ch)
            k += len(ch)
        i = j
    return "".join(out)


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------


def kruti_to_unicode(text: str, *, keep_english: bool = True, visarga: str = "auto") -> str:
    """Converts Kruti Dev 010 text to Unicode Hindi. English words are kept unless keep_english=False."""
    if not text:
        return ""
    folded = _fold_input(_units(text))
    keep = _find_english_kruti(folded, [], _kruti_plausible) if keep_english else None
    return _text(_decode_kruti(folded, keep, None, visarga))


def unicode_to_kruti(text: str) -> str:
    """Converts Unicode Hindi to Kruti Dev 010. Latin text is left as it is."""
    if not text:
        return ""
    return _text(_encode_unicode(_units(text), None))


def _count_code_points(s: str) -> int:
    return sum(1 for ch in s if not (0xDC00 <= ord(ch) <= 0xDFFF))


def _count_devanagari(s: str) -> int:
    return sum(1 for ch in s if _is_devanagari(ord(ch)))


_ALNUM = re.compile("[A-Za-z0-9]")
_ALPHA = re.compile("[A-Za-z]")
_DEV_RUN = re.compile("[ऀ-ॿ]+")


def _latin_words(s: str) -> List[str]:
    out: List[str] = []
    seen: Set[str] = set()
    n = len(s)
    i = 0
    while i < n:
        while i < n and _is_space_code(ord(s[i])):
            i += 1
        j = i
        while j < n and not _is_space_code(ord(s[j])):
            j += 1
        latin = any(_is_latin_letter(ord(s[x])) for x in range(i, j))
        if not latin:
            i = j
            continue
        for piece in _DEV_RUN.split(s[i:j]):
            a = 0
            b = len(piece)
            while a < b and not _ALNUM.match(piece[a]):
                a += 1
            while b > a and not _ALNUM.match(piece[b - 1]):
                b -= 1
            w = piece[a:b]
            if _ALPHA.search(w) and w not in seen:
                seen.add(w)
                if len(out) < 1000:
                    out.append(w)
        i = j
    return out


def convert_with_report(text: str, direction: str, *, keep_english: bool = True, visarga: str = "auto") -> dict:
    """Converts and reports what could not be converted.

    direction: 'kruti-to-unicode' or 'unicode-to-kruti'. Returns a dict with
    the same keys as the JavaScript library: text, keptEnglish, unknown,
    stats {chars, devanagari, bangla}.
    """
    src = _units(text or "")
    unknown: Dict[str, None] = {}
    kept_english: List[str] = []
    if direction == "kruti-to-unicode":
        folded = _fold_input(src)
        keep = _find_english_kruti(folded, kept_english, _kruti_plausible) if keep_english else None
        out = _decode_kruti(folded, keep, unknown, visarga) if src else ""
    else:
        out = _encode_unicode(src, unknown)
        kept_english.extend(_latin_words(src))
    dev = _count_devanagari(out if direction == "kruti-to-unicode" else src)
    return {
        "text": _text(out),
        "keptEnglish": [_text(w) for w in kept_english],
        "unknown": [_text(x) for x in list(unknown)[:500]],
        "stats": {"chars": _count_code_points(src), "devanagari": dev, "bangla": dev},
    }


def split_into_parts(text: str, size: int = 50000) -> List[str]:
    """Cuts a long text into parts of about `size` characters that end at a line break."""
    s = _units(text)
    out: List[str] = []
    i = 0
    while i < len(s):
        if len(s) - i <= size:
            out.append(s[i:])
            break
        end = s.rfind("\n", 0, i + size + 1)
        if end <= i:
            end = s.rfind(" ", 0, i + size + 1)
        end = i + size if end <= i else end + 1
        c = ord(s[end - 1])
        if 0xD800 <= c <= 0xDBFF:
            end += 1
        out.append(s[i:end])
        i = end
    return [_text(p) for p in out]


_KRUTI_MARKERS = set(T.KRUTI_MARKERS)
_KRUTI_INNER = re.compile(
    "[A-Za-z][;'\"\\[\\]{}|=`~+\\\\/<>#:)%&]|[;'\"\\[{}|=`~+\\\\/<>#:)][A-Za-z]|[a-z]A\\Z|^[;'\"\\[{|=`~+\\\\/<>#:)]"
)
_CONTRACTION = re.compile("[A-Za-z]+'(?:s|t|re|ve|ll|d|m)", _RX)
_TRAIL_STRIP = re.compile("[.,;:!?)\"']+\\Z")


def _js_round(x: float) -> int:
    return int(math.floor(x + 0.5))


def _round2(x: float) -> float:
    return math.floor(x * 100 + 0.5) / 100


def detect_encoding(text: str) -> dict:
    """Guesses whether text is Kruti Dev, Unicode Hindi, English, or a mix.

    Returns {kind, confidence, detail {unicodeWords, krutiWords, englishWords}};
    kind is 'kruti', 'unicode', 'english', 'mixed' or 'empty'.
    """
    s0 = _units(text or "")
    s = s0[:200000] if len(s0) > 200000 else s0
    uni = 0
    kru = 0.0
    eng = 0.0
    other = 0
    n = len(s)
    i = 0
    while i < n:
        while i < n and _is_space_code(ord(s[i])):
            i += 1
        if i >= n:
            break
        j = i
        while j < n and not _is_space_code(ord(s[j])):
            j += 1
        tok = _fold_input(s[i:j])
        i = j
        dev = 0
        marker = 0
        letters = 0
        for ch in tok:
            c = ord(ch)
            if _is_devanagari(c):
                dev += 1
            elif ch in _KRUTI_MARKERS:
                marker += 1
            if _is_latin_letter(c):
                letters += 1
        if dev > 0:
            uni += 1
            continue
        if letters == 0 and marker == 0:
            other += 1
            continue
        if marker > 0 or (_KRUTI_INNER.search(tok) and not _CONTRACTION.fullmatch(_TRAIL_STRIP.sub("", tok, count=1))):
            kru += 1
            continue
        if _is_kruti_common_word(tok):
            kru += 1
            continue
        a = 0
        b = len(tok)
        while a < b and tok[a] in LEAD_PUNCT:
            a += 1
        while b > a and tok[b - 1] in TRAIL_PUNCT:
            b -= 1
        core = tok[a:b]
        if not core:
            other += 1
            continue
        cls = _classify_kruti_token(core, tok, _kruti_plausible)
        if cls == "E":
            eng += 1
        elif cls in ("e", "a", "I"):
            eng += 0.6
            kru += 0.4
        elif cls == "f":
            kru += 0.7
            eng += 0.3
        elif cls in ("K", "U") and _kruti_plausible(core):
            kru += 1
        elif cls == "U":
            eng += 1
        elif cls == "N":
            other += 1
        else:
            eng += 0.5
    total = uni + kru + eng
    if total == 0:
        if other == 0:
            return {"kind": "empty", "confidence": 1, "detail": {"unicodeWords": 0, "krutiWords": 0, "englishWords": 0}}
        return {"kind": "english", "confidence": 0.3, "detail": {"unicodeWords": 0, "krutiWords": 0, "englishWords": 0}}
    detail = {"unicodeWords": uni, "krutiWords": _js_round(kru), "englishWords": _js_round(eng)}
    size = min(1, 0.5 + total / 20)
    pu = uni / total
    pk = kru / total
    pe = eng / total
    if pu >= 0.8:
        return {"kind": "unicode", "confidence": _round2(pu * size), "detail": detail}
    if pk >= 0.7:
        return {"kind": "kruti", "confidence": _round2(pk * size), "detail": detail}
    if pe >= 0.8:
        return {"kind": "english", "confidence": _round2(pe * size), "detail": detail}
    if uni == 0 and pk >= 0.5:
        return {"kind": "kruti", "confidence": _round2(pk * size * 0.8), "detail": detail}
    return {"kind": "mixed", "confidence": _round2(max(pu, pk, pe) * size), "detail": detail}


_FONT_SUBSET = re.compile("^[A-Z]{6}\\+")
_FONT_STYLE = re.compile(
    "[-_" + _JS_WS + "]+(bold|italic|oblique|regular|normal|light|medium|semibold|black|condensed|narrow|bolditalic|boldoblique)+\\Z", _RX
)
_FONT_STYLE2 = re.compile("(bold|italic|oblique|regular)+\\Z", _RX)
_FONT_SEP = re.compile("[-_" + _JS_WS + "]+")
_FONT_SEP2 = re.compile("[-_" + _JS_WS + ",]+")
_FONT_BOLD = re.compile("bold\\Z", _RX)
_JS_TRIM = "\t\n\u000b\u000c\r                  　﻿"


def is_kruti_font(name: str) -> bool:
    """True when a font name is Kruti Dev 010 (PDF subset prefixes and style suffixes are ignored)."""
    if not name:
        return False
    n = _FONT_SUBSET.sub("", name.strip(_JS_TRIM), count=1)
    n = n.split(",")[0]
    n = _FONT_STYLE.sub("", n, count=1)
    n = _FONT_STYLE2.sub("", n, count=1)
    n = _FONT_SEP.sub("", n).lower()
    if not n:
        return False
    for f in T.KRUTI_FONT_NAMES:
        if _FONT_BOLD.sub("", _FONT_SEP2.sub("", f), count=1).lower() == n:
            return True
    return n == "krutidev010" or n == "krdev010"
