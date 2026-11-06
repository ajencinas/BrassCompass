"""Write the full game script as a Word document.

Called by tools/export-script.mjs (npm run script:export) with the document model as JSON:

    python3 tools/script_docx.py script.json docs/FULL_SCRIPT.docx

The model is a list of blocks: {"t": "h", "level", "text"} for headings (Heading 1 act,
Heading 2 room, Heading 3 conversation, so Word's navigation pane works) and
{"t": "p", "runs", "indent", "style"} for paragraphs, whose runs are {"k", "v"} with k one of
text, speaker (bold small caps), label (bold), dir (stage directions and conditions: italic
grey), ref (the file:line source: small grey), code (ids: monospace) and link.
"""

import json
import sys

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.shared import Cm, Pt, RGBColor

GREY = RGBColor(0x80, 0x80, 0x80)
DARK_GREY = RGBColor(0x60, 0x60, 0x60)


def main(src: str, out: str) -> None:
    with open(src, encoding="utf8") as f:
        blocks = json.load(f)

    doc = Document()
    section = doc.sections[0]
    section.left_margin = section.right_margin = Cm(2.2)
    normal = doc.styles["Normal"]
    normal.font.name = "Georgia"
    normal.font.size = Pt(10.5)
    normal.paragraph_format.space_after = Pt(2)

    styles = {}

    def style(name: str, base: str = "Normal"):
        if name not in styles:
            st = doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
            st.base_style = doc.styles[base]
            styles[name] = st
        return styles[name]

    hotspot = style("Script Hotspot")
    hotspot.paragraph_format.space_before = Pt(8)
    hotspot.paragraph_format.keep_with_next = True
    note = style("Script Note")
    note.font.size = Pt(9)
    caption = style("Script Caption")
    caption.paragraph_format.left_indent = Cm(1)
    caption.paragraph_format.space_before = Pt(6)
    caption.paragraph_format.space_after = Pt(6)
    node = style("Script Line")
    node.paragraph_format.space_before = Pt(6)
    node.paragraph_format.keep_with_next = True

    first_heading = True
    for b in blocks:
        if b["t"] == "h":
            if first_heading:
                doc.add_heading(b["text"], level=0)
                first_heading = False
                continue
            doc.add_heading(b["text"], level=b["level"])
            continue
        st = b.get("style") or ""
        name = {"hotspot": "Script Hotspot", "note": "Script Note", "caption": "Script Caption"}.get(st)
        if st.startswith("node:"):
            name = "Script Line"
        para = doc.add_paragraph(style=name)
        if b.get("indent"):
            para.paragraph_format.left_indent = Cm(0.8 * b["indent"])
        for r in b["runs"]:
            k, v = r["k"], r["v"]
            if k == "ref":
                run = para.add_run("  " + v)
                run.font.size = Pt(7)
                run.font.color.rgb = GREY
                continue
            run = para.add_run(v)
            if k == "speaker":
                run.bold = True
                run.font.small_caps = True
            elif k == "label":
                run.bold = True
            elif k == "dir":
                run.italic = True
                run.font.color.rgb = GREY
            elif k == "code":
                run.font.name = "Consolas"
                run.font.size = Pt(8.5)
                run.font.color.rgb = DARK_GREY
            elif k == "link":
                run.italic = True
                run.underline = True
                run.font.color.rgb = DARK_GREY
    doc.save(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
