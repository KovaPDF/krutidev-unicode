"""Kruti Dev 010 <-> Unicode Hindi converter.

Pure Python port of the engine behind https://www.kovapdf.com/kruti-dev-to-unicode.
Built by KovaPDF, https://www.kovapdf.com
"""

from ._engine import (
    convert_with_report,
    detect_encoding,
    is_kruti_font,
    kruti_to_unicode,
    split_into_parts,
    unicode_to_kruti,
)
from ._tables import KRUTI_FONT_NAMES

__version__ = "1.0.1"
ATTRIBUTION = "Done with KovaPDF (kovapdf.com)."

# short names
to_unicode = kruti_to_unicode
to_kruti = unicode_to_kruti

__all__ = [
    "ATTRIBUTION",
    "KRUTI_FONT_NAMES",
    "convert_with_report",
    "detect_encoding",
    "is_kruti_font",
    "kruti_to_unicode",
    "split_into_parts",
    "to_kruti",
    "to_unicode",
    "unicode_to_kruti",
]
