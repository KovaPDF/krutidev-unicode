"""Runs the shared test vectors (../../test/vectors.json, made by running the
KovaPDF website engine) against the Python port."""

import json
import os
from pathlib import Path

import pytest

import krutidev_unicode as ku

HERE = Path(__file__).resolve().parent
# the shared file (../../test/vectors.json); an sdist ships a copy next to this test
VECTORS = Path(os.environ.get("KRUTI_VECTORS") or next(p for p in (HERE.parent.parent / "test" / "vectors.json", HERE / "vectors.json") if p.exists()))
DATA = json.loads(VECTORS.read_text(encoding="utf-8"))

OPT_NAMES = {"keepEnglish": "keep_english", "visarga": "visarga"}


def kw(options):
    return {OPT_NAMES[k]: v for k, v in (options or {}).items() if k != "direction"}


def run(v):
    fn, x, o = v["fn"], v["input"], v.get("options") or {}
    if fn == "toUnicode":
        return ku.to_unicode(x, **kw(o))
    if fn == "toKruti":
        return ku.to_kruti(x)
    if fn == "convertWithReport":
        return ku.convert_with_report(x, o["direction"], **kw(o))
    if fn == "detectEncoding":
        return ku.detect_encoding(x)
    if fn == "isKrutiFont":
        return ku.is_kruti_font(x)
    if fn == "splitIntoParts":
        return ku.split_into_parts(x, o["size"])
    raise AssertionError("unknown fn " + fn)


def test_has_enough_vectors():
    assert len(DATA) >= 100


@pytest.mark.parametrize("v", DATA, ids=[f'{v["id"]}-{v["fn"]}' for v in DATA])
def test_vector(v):
    assert run(v) == v["expected"]


def test_aliases_and_empty():
    assert ku.to_unicode("") == "" and ku.to_kruti("") == ""
    assert ku.kruti_to_unicode("dk;kZy;") == ku.to_unicode("dk;kZy;") == "कार्यालय"
    assert "Kruti Dev 010" in ku.KRUTI_FONT_NAMES
    assert "KovaPDF" in ku.ATTRIBUTION
