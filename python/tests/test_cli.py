import io
import sys

from krutidev_unicode.cli import main


def test_cli_to_unicode(monkeypatch, capsys):
    monkeypatch.setattr(sys, "stdin", io.StringIO("esjk uke jke gSA"))
    assert main(["to-unicode"]) == 0
    assert capsys.readouterr().out == "मेरा नाम राम है।"


def test_cli_to_kruti_file(tmp_path, capsys):
    f = tmp_path / "in.txt"
    f.write_text("भारत सरकार", encoding="utf-8")
    assert main(["to-kruti", str(f)]) == 0
    assert capsys.readouterr().out == "Hkkjr ljdkj"


def test_cli_help_and_bad(capsys):
    assert main(["--help"]) == 0
    assert "kovapdf.com" in capsys.readouterr().out
    assert main(["to-unicode", "--bogus"]) == 2
