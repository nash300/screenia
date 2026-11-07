"""Create Screenia's print-ready, two-sided A4 sales leaflet.

The PDF has a 3 mm bleed on every edge (216 x 303 mm). All typography and
shapes are vector; the supplied brand photography is placed at native quality.
"""

from pathlib import Path

from PIL import Image
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "screenia-a4-leaflet-two-sided-sv.pdf"
SINGLE_OUT = ROOT / "output" / "pdf" / "screenia-a4-leaflet-sv.pdf"
ASSETS = ROOT / "public"

# Finished page: A4 trim size plus 3 mm bleed on all sides.
BLEED = 3 * mm
TRIM_W, TRIM_H = 210 * mm, 297 * mm
W, H = TRIM_W + BLEED * 2, TRIM_H + BLEED * 2
SAFE = 9 * mm

NAVY = HexColor("#09295F")
BLUE = HexColor("#1457BD")
BLUE_DARK = HexColor("#073984")
BLUE_DEEP = HexColor("#04265E")
PALE = HexColor("#F5F8FF")
ICE = HexColor("#EAF2FF")
LINE = HexColor("#D3E2FA")
MUTED = HexColor("#587099")
YELLOW = HexColor("#FFD32A")
INK = HexColor("#17213A")
GREEN = HexColor("#168A71")
PLUS = HexColor("#6A46B8")


def fonts():
    family = ASSETS / "fonts" / "manrope"
    pdfmetrics.registerFont(TTFont("Screenia", str(family / "Manrope-500.ttf")))
    pdfmetrics.registerFont(TTFont("Screenia-Medium", str(family / "Manrope-600.ttf")))
    pdfmetrics.registerFont(TTFont("Screenia-Bold", str(family / "Manrope-800.ttf")))


def rr(c, x, y, width, height, radius, fill, stroke=None, sw=0.7):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.setLineWidth(sw)
    c.roundRect(x, y, width, height, radius, fill=1, stroke=1 if stroke else 0)


def crop_image(c, path, x, y, width, height, focus_x=0.5, focus_y=0.5):
    """Place an image like CSS object-fit: cover, with optional focal point."""
    with Image.open(path) as source:
        source_width, source_height = source.size
        scale = max(width / source_width, height / source_height)
        draw_width, draw_height = source_width * scale, source_height * scale
        left = x - (draw_width - width) * focus_x
        bottom = y - (draw_height - height) * focus_y
        c.saveState()
        clip = c.beginPath()
        clip.rect(x, y, width, height)
        c.clipPath(clip, stroke=0, fill=0)
        c.drawImage(ImageReader(source.copy()), left, bottom, draw_width, draw_height, mask="auto")
        c.restoreState()


def draw_lines(c, value, x, y, width, font="Screenia", size=9, color=INK, leading=None, max_lines=None):
    leading = leading or size * 1.35
    lines = simpleSplit(value, font, size, width)
    if max_lines is not None:
        lines = lines[:max_lines]
    c.setFont(font, size)
    c.setFillColor(color)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def centered(c, value, x, y, width, font="Screenia", size=9, color=INK):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawCentredString(x + width / 2, y, value)


def bullet(c, value, x, y, width, color=INK, size=7.15, bullet_color=BLUE, leading=9.8):
    c.setFillColor(bullet_color)
    c.circle(x + 2, y + 2.1, 1.4, fill=1, stroke=0)
    c.setFont("Screenia", size)
    c.setFillColor(color)
    lines = simpleSplit(value, "Screenia", size, width - 11)
    for i, line in enumerate(lines):
        c.drawString(x + 8, y - i * leading, line)
    return y - len(lines) * leading - 2.5


def qr(c, x, y, size, value):
    widget = QrCodeWidget(value)
    bounds = widget.getBounds()
    drawing = Drawing(size, size, transform=[size / (bounds[2] - bounds[0]), 0, 0, size / (bounds[3] - bounds[1]), 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x, y)


def logo(c, x, y, width):
    image = ASSETS / "brand" / "screenia-logo-full-transparent.png"
    with Image.open(image) as source:
        ratio = source.height / source.width
    c.drawImage(str(image), x, y, width, width * ratio, mask="auto")


def top_brand(c, page, total_pages=2):
    logo(c, BLEED + SAFE, H - BLEED - SAFE - 12 * mm, 37 * mm)
    c.setFont("Screenia-Medium", 6.7)
    c.setFillColor(MUTED)
    c.drawRightString(W - BLEED - SAFE, H - BLEED - SAFE - 5 * mm, f"SCREENIA  |  {page}/{total_pages}")


def check(c, x, y, color=GREEN):
    c.setStrokeColor(color)
    c.setLineWidth(1.3)
    p = c.beginPath()
    p.moveTo(x, y)
    p.lineTo(x + 2.2, y - 2.4)
    p.lineTo(x + 6.3, y + 3.0)
    c.drawPath(p, stroke=1, fill=0)


def workflow_tile(c, x, y, width, height, image, number, title, body):
    rr(c, x, y, width, height, 3.2 * mm, white, LINE)
    image_h = 34 * mm
    crop_image(c, image, x + 2.1 * mm, y + height - image_h - 2.1 * mm, width - 4.2 * mm, image_h, 0.5, 0.55)
    c.setFillColor(BLUE)
    c.circle(x + 6 * mm, y + height - 6 * mm, 3.4 * mm, fill=1, stroke=0)
    centered(c, str(number), x + 2.6 * mm, y + height - 8.1 * mm, 6.8 * mm, "Screenia-Bold", 5.5, white)
    c.setFont("Screenia-Medium", 6.6)
    c.setFillColor(NAVY)
    c.drawString(x + 3 * mm, y + 16 * mm, title)
    draw_lines(c, body, x + 3 * mm, y + 10.4 * mm, width - 6 * mm, size=5.45, color=MUTED, leading=6.6, max_lines=2)


def screen_mockup(c, x, y, width, height, image, corner=5 * mm):
    """A minimal physical-display frame for product imagery."""
    rr(c, x + 2.5 * mm, y - 2.5 * mm, width, height, corner, Color(0, 0, 0, alpha=0.23))
    rr(c, x, y, width, height, corner, HexColor("#07182F"))
    crop_image(c, image, x + 2.4 * mm, y + 2.4 * mm, width - 4.8 * mm, height - 4.8 * mm, 0.5, 0.52)
    c.setFillColor(Color(1, 1, 1, alpha=0.45))
    c.roundRect(x + 2.4 * mm, y + height - 4.8 * mm, width - 4.8 * mm, 2.4 * mm, 1.2 * mm, fill=1, stroke=0)


def front(c):
    # Premium brochure cover - product-led imagery and editorial typography, not website cards.
    c.setFillColor(NAVY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    x0 = BLEED + SAFE
    content_w = TRIM_W - 2 * SAFE
    top = H - BLEED - SAFE
    # visual accents / white logo block
    c.setFillColor(BLUE)
    c.circle(W - 10 * mm, H - 27 * mm, 39 * mm, fill=1, stroke=0)
    c.setFillColor(Color(1, 1, 1, alpha=0.045))
    c.circle(W - 7 * mm, H - 27 * mm, 52 * mm, fill=1, stroke=0)
    rr(c, x0, top - 13 * mm, 62 * mm, 13 * mm, 4 * mm, white)
    logo(c, x0 + 4 * mm, top - 10.3 * mm, 35 * mm)
    c.setFont("Screenia-Medium", 6.1)
    c.setFillColor(Color(1, 1, 1, alpha=0.72))
    c.drawRightString(x0 + content_w, top - 5 * mm, "DIGITAL SKYLTNING FÖR FÖRETAG")

    # Hero copy and a composed stack of product examples.
    c.setFillColor(YELLOW)
    c.rect(x0, top - 29 * mm, 16 * mm, 1.8 * mm, fill=1, stroke=0)
    c.setFont("Screenia-Medium", 7.1)
    c.setFillColor(Color(1, 1, 1, alpha=0.78))
    c.drawString(x0, top - 37 * mm, "FRÅN FÖRSTA BLICK TILL NÄSTA STEG")
    c.setFont("Screenia-Bold", 24.2)
    c.setFillColor(white)
    c.drawString(x0, top - 51 * mm, "En skärm.")
    c.drawString(x0, top - 63 * mm, "En tydligare affär.")
    draw_lines(c, "Screenia gör din befintliga TV eller skärm till en levande kanal för kampanjer, menyer, prislistor och kundinformation.", x0, top - 76 * mm, 65 * mm, size=8.0, color=Color(1, 1, 1, alpha=0.8), leading=10.5)
    c.setFont("Screenia-Medium", 6.7)
    c.setFillColor(YELLOW)
    c.drawString(x0, top - 111 * mm, "PLANERING  •  DESIGN  •  TEKNIK  •  UPPDATERINGAR")

    # Main mock-up and two smaller, overlapping example frames.
    mx, my = x0 + 92 * mm, top - 119 * mm
    screen_mockup(c, mx, my, 86 * mm, 68 * mm, ASSETS / "landing" / "workflow" / "05-live-display.png")
    screen_mockup(c, mx - 13 * mm, my + 9 * mm, 34 * mm, 47 * mm, ASSETS / "landing" / "workflow" / "01-package-request.png", 4 * mm)
    screen_mockup(c, mx + 53 * mm, my + 45 * mm, 38 * mm, 29 * mm, ASSETS / "landing" / "workflow" / "02-design-planning.png", 4 * mm)
    c.setFillColor(YELLOW)
    c.circle(mx + 77 * mm, my + 64 * mm, 4.5 * mm, fill=1, stroke=0)
    centered(c, "01", mx + 72.5 * mm, my + 62.4 * mm, 9 * mm, "Screenia-Bold", 5.5, NAVY)

    # White content band, inspired by a print editorial spread rather than a UI grid.
    lower_y = BLEED
    rr(c, 0, lower_y, W, 112 * mm, 0, white)
    content_y = lower_y + 84 * mm
    c.setFont("Screenia-Bold", 15.5)
    c.setFillColor(NAVY)
    c.drawString(x0, content_y + 15 * mm, "Så går det till.")
    c.setFont("Screenia", 6.8)
    c.setFillColor(MUTED)
    c.drawString(x0, content_y + 8 * mm, "Fem enkla steg från din idé till innehåll som möter kunder på skärmen.")
    steps = [
        ("Välj", "Paket och antal skärmar"),
        ("Dela", "Meny, bilder och budskap"),
        ("Skapa", "Layouten utformas"),
        ("Anslut", "Enheten till HDMI + Wi-Fi"),
        ("Visa", "Ditt innehåll går live"),
    ]
    step_y = lower_y + 54 * mm
    step_w = content_w / 5
    for index, (title, body) in enumerate(steps, 1):
        sx = x0 + (index - 1) * step_w
        if index < 5:
            c.setStrokeColor(LINE)
            c.setLineWidth(1.1)
            c.line(sx + 10 * mm, step_y + 11 * mm, sx + step_w - 4 * mm, step_y + 11 * mm)
        c.setFillColor(BLUE if index != 3 else YELLOW)
        c.circle(sx + 6 * mm, step_y + 11 * mm, 5.3 * mm, fill=1, stroke=0)
        centered(c, str(index), sx + 0.7 * mm, step_y + 9.1 * mm, 10.6 * mm, "Screenia-Bold", 6.0, NAVY if index == 3 else white)
        c.setFont("Screenia-Bold", 7.0)
        c.setFillColor(NAVY)
        c.drawString(sx, step_y - 1.5 * mm, title)
        draw_lines(c, body, sx, step_y - 7 * mm, step_w - 4 * mm, size=5.55, color=MUTED, leading=6.8, max_lines=2)

    # Image-led proof strip.
    proof_y = lower_y + 19 * mm
    proof_w = 36 * mm
    for index, image in enumerate([
        ASSETS / "landing" / "section-art" / "salon-service-window.jpg",
        ASSETS / "landing" / "section-art" / "restaurant-menu-screens.jpg",
        ASSETS / "landing" / "section-art" / "digital-menu-board.jpg",
    ]):
        px = x0 + index * (proof_w + 3 * mm)
        rr(c, px - 0.6 * mm, proof_y - 0.6 * mm, proof_w + 1.2 * mm, 21 * mm + 1.2 * mm, 3 * mm, white, LINE)
        crop_image(c, image, px, proof_y, proof_w, 21 * mm, 0.5, 0.54)
    text_x = x0 + 3 * (proof_w + 3 * mm) + 3 * mm
    qsize = 15 * mm
    qx = x0 + content_w - qsize
    draw_lines(c, "Din skärm. Ditt budskap.", text_x, proof_y + 14.2 * mm, qx - text_x - 4 * mm, font="Screenia-Bold", size=8.0, color=NAVY, leading=9.0, max_lines=2)
    draw_lines(c, "TV/skärm ingår inte - du behöver bara HDMI och Wi-Fi. Screenia hjälper till med resten.", text_x, proof_y + 5.8 * mm, qx - text_x - 4 * mm, size=5.35, color=MUTED, leading=6.4, max_lines=2)
    qr(c, qx, proof_y + 3.4 * mm, qsize, "https://screenia.se")
    c.showPage()


def package_card(c, x, y, width, height, name, resolution, badge, badge_color, description, features, device_path, prices):
    rr(c, x, y, width, height, 4.5 * mm, white, LINE)
    c.setFillColor(badge_color)
    c.roundRect(x + 5 * mm, y + height - 12 * mm, 34 * mm, 7 * mm, 3.5 * mm, fill=1, stroke=0)
    centered(c, badge, x + 5 * mm, y + height - 9.5 * mm, 34 * mm, "Screenia-Medium", 5.8, white)
    c.setFont("Screenia-Bold", 13.5)
    c.setFillColor(NAVY)
    c.drawString(x + 5 * mm, y + height - 22 * mm, name)
    c.setFont("Screenia-Medium", 7.2)
    c.setFillColor(badge_color)
    c.drawString(x + 5 * mm, y + height - 28 * mm, resolution)

    # A small product visual makes package cards feel product-led rather than tabular.
    with Image.open(device_path) as source:
        ratio = source.height / source.width
    iw = 21 * mm
    ih = iw * ratio
    c.drawImage(str(device_path), x + width - iw - 4 * mm, y + height - ih - 4 * mm, iw, ih, mask="auto")

    text_y = y + height - 37 * mm
    end_y = draw_lines(c, description, x + 5 * mm, text_y, width - 10 * mm, "Screenia", 6.75, MUTED, 8.9)
    current_y = end_y - 1.5 * mm
    for item in features:
        current_y = bullet(c, item, x + 5 * mm, current_y, width - 10 * mm, size=6.3, leading=8.0, bullet_color=badge_color)

    # Price band stays consistent across all packages.
    band_h = 26 * mm
    c.setFillColor(PALE)
    c.roundRect(x + 4 * mm, y + 4 * mm, width - 8 * mm, band_h, 3 * mm, fill=1, stroke=0)
    c.setFont("Screenia-Medium", 5.8)
    c.setFillColor(MUTED)
    c.drawString(x + 7 * mm, y + 23.2 * mm, "FÖRSTA BETALNINGEN - 1 SKÄRM")
    c.setFont("Screenia-Bold", 9.2)
    c.setFillColor(NAVY)
    c.drawString(x + 7 * mm, y + 17.2 * mm, prices[0])
    c.setFont("Screenia", 5.65)
    c.setFillColor(MUTED)
    c.drawString(x + 7 * mm, y + 12.3 * mm, prices[1])
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(x + 7 * mm, y + 9 * mm, x + width - 7 * mm, y + 9 * mm)
    c.setFont("Screenia-Bold", 8.2)
    c.setFillColor(badge_color)
    c.drawString(x + 7 * mm, y + 5.6 * mm, prices[2])


def package_row(c, x, y, width, height, name, resolution, label, tone, description, feature_columns, device, first_payment, breakdown, monthly):
    rr(c, x, y, width, height, 4 * mm, white, LINE)
    left_w = 56 * mm
    rr(c, x, y, left_w, height, 4 * mm, tone)
    c.setFillColor(Color(1, 1, 1, alpha=0.17))
    c.circle(x + left_w - 6 * mm, y + height - 7 * mm, 15 * mm, fill=1, stroke=0)
    c.setFont("Screenia-Medium", 5.7)
    c.setFillColor(NAVY if tone == YELLOW else white)
    c.drawString(x + 5 * mm, y + height - 8 * mm, label)
    c.setFont("Screenia-Bold", 15.2)
    c.drawString(x + 5 * mm, y + height - 16 * mm, name)
    c.setFont("Screenia-Medium", 6.2)
    c.drawString(x + 5 * mm, y + height - 22 * mm, resolution)
    with Image.open(device) as source:
        ratio = source.height / source.width
    iw = 21 * mm
    c.drawImage(str(device), x + left_w - iw - 4 * mm, y + height - iw * ratio - 2 * mm, iw, iw * ratio, mask="auto")
    c.setFont("Screenia-Medium", 5.3)
    c.setFillColor(NAVY if tone == YELLOW else Color(1, 1, 1, alpha=0.82))
    c.drawString(x + 5 * mm, y + 17 * mm, "FÖRSTA BETALNINGEN - 1 SKÄRM")
    c.setFont("Screenia-Bold", 12.4)
    c.drawString(x + 5 * mm, y + 11.2 * mm, first_payment)
    c.setFont("Screenia", 5.2)
    c.drawString(x + 5 * mm, y + 6.7 * mm, breakdown)
    c.setFont("Screenia-Bold", 6.7)
    c.drawString(x + 5 * mm, y + 2.4 * mm, monthly)

    body_x = x + left_w + 5 * mm
    body_w = width - left_w - 10 * mm
    draw_lines(c, description, body_x, y + height - 9 * mm, body_w, size=6.5, color=MUTED, leading=8.0, max_lines=2)
    col_gap = 4 * mm
    col_w = (body_w - col_gap) / 2
    for col, items in enumerate(feature_columns):
        current_y = y + height - 20 * mm
        bx = body_x + col * (col_w + col_gap)
        for item in items:
            current_y = bullet(c, item, bx, current_y, col_w, size=5.65, leading=6.9, bullet_color=tone)


def back(c, page=2, total_pages=2):
    c.setFillColor(PALE)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    top_brand(c, page, total_pages)
    x0 = BLEED + SAFE
    content_w = TRIM_W - 2 * SAFE
    top = H - BLEED - SAFE - 23 * mm
    c.setFillColor(YELLOW)
    c.rect(x0, top + 5 * mm, 15 * mm, 1.7 * mm, fill=1, stroke=0)
    c.setFont("Screenia-Bold", 18.5)
    c.setFillColor(NAVY)
    c.drawString(x0, top - 5 * mm, "Välj paket som passar din skärm.")
    c.setFont("Screenia", 7.1)
    c.setFillColor(MUTED)
    c.drawString(x0, top - 11.5 * mm, "Samma trygga uppstart - olika skärpa och möjligheter. Paketen kan kombineras mellan flera skärmar.")

    row_h = 52 * mm
    row_gap = 3 * mm
    row1_y = top - 19 * mm - row_h
    packages = [
        (
            "Standard", "FULL HD 1080P", "STARTPAKET", BLUE,
            "För mindre skärmar och standardinnehåll i Full HD.",
            [["Uppspelning i Full HD (1080p)", "Rekommenderas för skärmar under 55 tum", "Passar kampanjer, erbjudanden och informationsskärmar"], ["Planeringshjälp, layoutdesign och överenskomna ändringar ingår i startavgiften", "3 veckors kostnadsfri provperiod", "Ingen bindningstid"]],
            ASSETS / "brand" / "screenia-standard-device.png", "1 297 kr", "499 admin + 699 enhet + 99 frakt", "99 kr/mån efter provperiod",
        ),
        (
            "Premium", "ÄKTA 4K + EGEN VIDEO", "VIDEO", YELLOW,
            "För större skärmar och verksamheter som vill använda egna videoklipp.",
            [["Uppspelning i äkta 4K (3840 x 2160)", "Rekommenderas för skärmar från 55 tum", "Skarpare text, menyer och detaljerade bilder"], ["Ladda upp egna MP4- och WEBM-videor via kundportalen", "Screenia granskar materialet före publicering", "3 veckors kostnadsfri provperiod", "Ingen bindningstid"]],
            ASSETS / "brand" / "screenia-premium-device.png", "1 697 kr", "499 admin + 1 099 enhet + 99 frakt", "129 kr/mån efter provperiod",
        ),
    ]
    for index, package in enumerate(packages):
        package_row(c, x0, row1_y - index * (row_h + row_gap), content_w, row_h, *package)

    # Useful, customer-facing price and delivery details fill the lower page without repetition.
    info_y = BLEED + SAFE + 32 * mm
    info_h = 38 * mm
    split = 113 * mm
    rr(c, x0, info_y, split, info_h, 4 * mm, white, LINE)
    c.setFont("Screenia-Bold", 10.8)
    c.setFillColor(NAVY)
    c.drawString(x0 + 5 * mm, info_y + 28 * mm, "Tydliga kostnader när du växer.")
    draw_lines(c, "Administrativ startavgift 499 kr täcker upp till 3 skärmar. För fler skärmar tillkommer 249 kr per skärm i uppstart. Frakt är alltid 99 kr oavsett antal enheter.", x0 + 5 * mm, info_y + 20.5 * mm, split - 10 * mm, size=6.15, color=MUTED, leading=7.6)
    c.setFont("Screenia-Medium", 6.0)
    c.setFillColor(BLUE)
    c.drawString(x0 + 5 * mm, info_y + 6 * mm, "Månadsabonnemanget börjar först efter den kostnadsfria provperioden.")

    rx = x0 + split + 3 * mm
    rw = content_w - split - 3 * mm
    rr(c, rx, info_y, rw, info_h, 4 * mm, NAVY)
    c.setFont("Screenia-Bold", 10.2)
    c.setFillColor(white)
    c.drawString(rx + 5 * mm, info_y + 28 * mm, "Det här behöver du.")
    needs = ["En egen TV eller skärm", "HDMI-ingång och Wi-Fi", "Meny, bilder, priser eller kampanjinnehåll"]
    need_y = info_y + 20 * mm
    for value in needs:
        c.setFillColor(YELLOW)
        c.circle(rx + 7 * mm, need_y + 1.3 * mm, 2.6 * mm, fill=1, stroke=0)
        check(c, rx + 4.8 * mm, need_y + 1.0 * mm, NAVY)
        c.setFont("Screenia", 6.15)
        c.setFillColor(Color(1, 1, 1, alpha=0.9))
        c.drawString(rx + 13 * mm, need_y - 0.6 * mm, value)
        need_y -= 7 * mm

    footer_y = BLEED + SAFE
    rr(c, x0, footer_y, content_w, 29 * mm, 4 * mm, BLUE_DEEP)
    c.setFont("Screenia-Bold", 12.0)
    c.setFillColor(white)
    c.drawString(x0 + 6 * mm, footer_y + 18.5 * mm, "Se exempel och hitta rätt paket.")
    c.setFont("Screenia", 6.7)
    c.setFillColor(Color(1, 1, 1, alpha=0.86))
    c.drawString(x0 + 6 * mm, footer_y + 12 * mm, "Besök screenia.se för exempel, aktuell information och en oförbindlig förfrågan.")
    c.setFont("Screenia-Medium", 5.55)
    c.setFillColor(Color(1, 1, 1, alpha=0.72))
    c.drawString(x0 + 6 * mm, footer_y + 5.3 * mm, "Priser inkl. moms. TV/skärm ingår inte. Aktuella villkor och priser finns på screenia.se.")
    qsize = 20 * mm
    qr(c, x0 + content_w - qsize - 6 * mm, footer_y + 4.5 * mm, qsize, "https://screenia.se")
    c.setFont("Screenia-Medium", 5.7)
    c.setFillColor(white)
    c.drawRightString(x0 + content_w - qsize - 4 * mm, footer_y + 14.2 * mm, "Skanna för att komma igång")
    c.setFont("Screenia", 5.7)
    c.setFillColor(Color(1, 1, 1, alpha=0.72))
    c.drawRightString(x0 + content_w - qsize - 4 * mm, footer_y + 8.2 * mm, "screenia.se")
    c.showPage()


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fonts()
    c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("Screenia - Digital skyltning för företag")
    c.setAuthor("Screenia")
    c.setSubject("Print-ready two-sided A4 sales leaflet with 3 mm bleed")
    front(c)
    back(c)
    c.save()
    print(OUT)

    single = canvas.Canvas(str(SINGLE_OUT), pagesize=(W, H), pageCompression=1)
    single.setTitle("Screenia - Paket och priser")
    single.setAuthor("Screenia")
    single.setSubject("Print-ready one-sided A4 price guide with 3 mm bleed")
    back(single, page=1, total_pages=1)
    single.save()
    print(SINGLE_OUT)


if __name__ == "__main__":
    main()
