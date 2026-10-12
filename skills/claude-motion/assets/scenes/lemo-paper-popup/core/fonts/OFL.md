# Fonts in `core/fonts/`: licence

`fonts.css` declares four font families, all licensed under the **SIL Open Font License 1.1** (OFL). The `f0`–`f7.woff2` files are **subsets**: Google Fonts-style `unicode-range` slices that hold only the glyphs listed in `fonts.css`, not the full fonts. The full text of the licence follows the table.

| Family (style) | Files | Glyph subset (`unicode-range` code points) | Copyright line (from the font's own name table) | Licence URL in the font |
|---|---|---|---|---|
| ZCOOL KuaiLe (Regular) | `f0.woff2` | 208 (≈ 200 mostly Chinese characters: **not enough for running Chinese text**) | Copyright 2018 The ZCOOL KuaiLe Project Authors (https://github.com/googlefonts/zcool-kuaile) | https://openfontlicense.org |
| Fredoka (variable, weights 500, 600 and 700 are used; the file's default instance is named "Fredoka Light") | `f1.woff2` (Hebrew, 172), `f2.woff2` (Latin Extended, 1162), `f3.woff2` (Latin, 387) | see `fonts.css` | Copyright 2016 The Fredoka Project Authors (https://github.com/hafontia/Fredoka-One) | http://scripts.sil.org/OFL |
| Lilita One (Regular) | `f4.woff2` (Latin Extended, 1162), `f5.woff2` (Latin, 387) | see `fonts.css` | Copyright (c) 2011 Juan Montoreano (juan@remolacha.biz), with Reserved Font Names "Lilita One" | http://scripts.sil.org/OFL |
| IM Fell English (Italic and Regular) | `f6.woff2` (Italic), `f7.woff2` (Regular), each Latin, 387 | see `fonts.css` | (c) 2007 Igino Marini (www.iginomarini.com) With Reserved Font Name IM FELL English Italic / IM FELL English Roman | http://scripts.sil.org/OFL |

How this table was made: the family-to-file mapping comes from `fonts.css`; the copyright and licence lines are the `name` table records (IDs 0 and 14) read from the `.woff2` files themselves with fontTools 4.66.0 (fontTools is not in the shared `.venv`; it was installed in a throw-away environment just to read the files). The designer field (name ID 9) is empty in these files, so the copyright line above is the attribution. Nothing was fetched from a web page for the table.

Lilita One and IM FELL English declare **Reserved Font Names** (see their copyright lines). If you modify or rename these files, condition 3 of the licence below applies.

The licence text below is the standard OFL 1.1, in the plain-text layout of the `OFL.txt` that the ZCOOL KuaiLe project ships (https://github.com/googlefonts/zcool-kuaile/blob/main/OFL.txt). It was compared word for word with the official page https://openfontlicense.org/open-font-license-official-text/: the wording is identical, only the dash characters and the list numbering differ in layout. The text itself is unchanged.

## SIL Open Font License 1.1

```text
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
