# Layout Test Font

`ABeeZee-Regular.ttf` is a 46,016-byte OFL-licensed fixture, downloaded from:
https://raw.githubusercontent.com/google/fonts/main/ofl/abeezee/ABeeZee-Regular.ttf

SHA-256: `2901c8df256648cc2bb2e3afb381cb8d28e65ed3dbe11de20695ae4d5ffdeda9`

The accompanying `OFL.txt` is the upstream license. Tests supply these fixed
bytes through mocked HTTP while exercising actual Pillow/FreeType metrics and
font cmap parsing. Tests do not access network services or paid APIs.

Production never substitutes this font for a MediaKit font. Production measures
the actual versioned Source Han resource supplied as the submitted `font_type`.
