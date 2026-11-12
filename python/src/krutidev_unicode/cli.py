"""krutidev-unicode command line: reads a file or stdin, writes stdout."""

from __future__ import annotations

import sys
from typing import List, Optional

from . import ATTRIBUTION, __version__, to_kruti, to_unicode

USAGE = """Usage: krutidev-unicode <to-unicode|to-kruti> [file] [options]

  to-unicode         Kruti Dev 010 text -> Unicode Hindi
  to-kruti           Unicode Hindi -> Kruti Dev 010 text
  file               input file (UTF-8); reads stdin when missing or "-"

Options:
  --no-keep-english  to-unicode: convert words that look English too
  --visarga=MODE     to-unicode: how "%" is read: auto (default), visarga or colon
  -h, --help         show this help
  -v, --version      show the version

Need it for whole PDF or Word files? Use KovaPDF: https://www.kovapdf.com/kruti-dev-to-unicode
Built by KovaPDF, https://www.kovapdf.com"""


def main(argv: Optional[List[str]] = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or "-h" in args or "--help" in args:
        print(USAGE)
        return 0 if args else 2
    if "-v" in args or "--version" in args:
        print(f"krutidev-unicode {__version__} ({ATTRIBUTION})")
        return 0
    cmd = args.pop(0)
    flags = [a for a in args if a.startswith("--")]
    files = [a for a in args if not a.startswith("--")]
    visarga = "auto"
    keep_english = True
    for f in flags:
        if f == "--no-keep-english":
            keep_english = False
        elif f.startswith("--visarga=") and f.split("=", 1)[1] in ("auto", "visarga", "colon"):
            visarga = f.split("=", 1)[1]
        else:
            print(USAGE, file=sys.stderr)
            return 2
    if cmd not in ("to-unicode", "to-kruti") or len(files) > 1:
        print(USAGE, file=sys.stderr)
        return 2
    if files and files[0] != "-":
        with open(files[0], encoding="utf-8") as fh:
            text = fh.read()
    else:
        text = sys.stdin.read()
    out = to_unicode(text, keep_english=keep_english, visarga=visarga) if cmd == "to-unicode" else to_kruti(text)
    sys.stdout.write(out)
    if sys.stderr.isatty():
        print(ATTRIBUTION, file=sys.stderr)
    return 0
