# krutidev-unicode (Python)

Convert Hindi text typed in **Kruti Dev 010** to **Unicode**, and Unicode back to Kruti Dev. Pure Python, no dependencies, works offline.

This is a port of the conversion engine that runs the Kruti Dev to Unicode tool on KovaPDF. Its tables are generated from that engine, and it passes the same test vectors as the JavaScript package (`@kovapdf/krutidev-unicode` on npm).

Need it for whole PDF or Word files? Use KovaPDF: https://www.kovapdf.com/kruti-dev-to-unicode

Built by KovaPDF, https://www.kovapdf.com

```sh
pip install krutidev-unicode
```

```python
from krutidev_unicode import to_unicode, to_kruti, convert_with_report, detect_encoding, is_kruti_font

to_unicode("esjk uke jke gSA")                     # 'मेरा नाम राम है।'
to_kruti("भारत सरकार")                             # 'Hkkjr ljdkj'
to_unicode("PDF Q+kby dks Word esa cnysa")         # 'PDF फ़ाइल को Word में बदलें' (English kept by default)
to_unicode("Word", keep_english=False)             # 'ॅवतक'
convert_with_report("dk;Z", "kruti-to-unicode")    # dict: text, keptEnglish, unknown, stats
detect_encoding("esjk uke jke gSA")["kind"]        # 'kruti'
is_kruti_font("Kruti Dev 010")                     # True
```

Command line (stdin or a file in, stdout out):

```sh
krutidev-unicode to-unicode < kruti.txt > unicode.txt
python -m krutidev_unicode to-kruti unicode.txt
```

**Kruti Dev 010** is a legacy font: it draws Hindi shapes on ordinary Latin codes, so its text reads as "dk;kZy;" without the font. **Mangal** and **Nirmala UI** are Unicode fonts: set converted text in one of them. Only Kruti Dev 010 is supported (not DevLys or other Kruti Dev numbers). No fonts are included in this package.

Full documentation: https://github.com/KovaPDF/krutidev-unicode

The code is MIT licensed. The KovaPDF name, logo and website content are not covered by that licence.
