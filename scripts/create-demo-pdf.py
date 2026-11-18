"""One-off demo asset generator. Website builds do not require Python.

Run with a Python that has reportlab; override font paths if needed.
"""
import os
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parent.parent
REGULAR = os.environ.get('MISAO_PDF_FONT', '/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = os.environ.get('MISAO_PDF_FONT_BOLD', '/System/Library/Fonts/Supplemental/Arial Bold.ttf')
pdfmetrics.registerFont(TTFont('MISAO', REGULAR))
pdfmetrics.registerFont(TTFont('MISAO-Bold', BOLD))
pdfmetrics.registerFontFamily('MISAO', normal='MISAO', bold='MISAO-Bold')
NAVY = colors.HexColor('#101A3B')
MUTED = colors.HexColor('#52617A')
BLUE = colors.HexColor('#4259BD')
styles = {
    'label': ParagraphStyle('label', fontName='MISAO-Bold', fontSize=10, leading=14, textColor=BLUE, spaceAfter=13),
    'title': ParagraphStyle('title', fontName='MISAO-Bold', fontSize=28, leading=33, textColor=NAVY, spaceAfter=11),
    'subtitle': ParagraphStyle('subtitle', fontName='MISAO', fontSize=11, leading=17, textColor=MUTED, spaceAfter=16),
    'h2': ParagraphStyle('h2', fontName='MISAO-Bold', fontSize=13, leading=18, textColor=NAVY, spaceBefore=12, spaceAfter=6),
    'body': ParagraphStyle('body', fontName='MISAO', fontSize=10.5, leading=15, textColor=NAVY, spaceAfter=6, alignment=TA_LEFT),
}
def p(value, style='body'):
    return Paragraph(value, styles[style])

def footer(canvas, document):
    canvas.setStrokeColor(colors.HexColor('#DCE2F0'))
    canvas.line(22 * mm, 21 * mm, 188 * mm, 21 * mm)
    canvas.setFont('MISAO', 9)
    canvas.setFillColor(MUTED)
    canvas.drawString(22 * mm, 15 * mm, 'МИСАО / Математика / Демонстрационное задание')
    canvas.drawRightString(188 * mm, 15 * mm, str(document.page))

def main():
    output = ROOT / 'public/files/linear-equations.pdf'
    output.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=22 * mm, leftMargin=22 * mm,
                            topMargin=22 * mm, bottomMargin=28 * mm, title='МИСАО - Линейные уравнения', author='МИСАО')
    story = [
        p('МИСАО   /   МАТЕМАТИКА', 'label'),
        p('Линейные уравнения', 'title'),
        p('Домашнее задание № 1 · Основы алгебры<br/>Демонстрационный материал · 2026-2027 учебный год', 'subtitle'),
        p('Цель работы', 'h2'),
        p('Научиться решать линейные уравнения, раскрывать скобки и проверять корни подстановкой.'),
        p('Часть 1. Решите уравнения', 'h2'),
        p('Для каждого уравнения запишите последовательность преобразований и выполните проверку.'),
    ]
    equations = [
        ['01', '5x - 7 = 18'], ['02', '3(x + 2) = 2x + 11'],
        ['03', '(x - 4) / 3 = 5'], ['04', '4(2x - 1) - 3x = 16'],
        ['05', '2(x + 3) = 2x + 6'],
    ]
    table = Table([[p(number), p(equation)] for number, equation in equations], colWidths=[17 * mm, 149 * mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F2F5FC')),
        ('LINEBELOW', (0, 0), (-1, -2), .5, colors.white),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.extend([
        table,
        p('Часть 2. Составьте уравнение', 'h2'),
        p('Три одинаковые тетради и ручка за 20 рублей стоят 110 рублей. Сколько стоит одна тетрадь? Обозначьте неизвестное, составьте уравнение, решите его и запишите ответ с единицами измерения.'),
        p('Как оформить работу', 'h2'),
        p('Укажите имя, группу и название темы. Для каждого задания приведите ход решения. Если корней нет или их бесконечно много, объясните почему. Формат сдачи уточните у преподавателя.'),
        p('Критерии проверки', 'h2'),
        p('5 баллов - по одному за каждое верно решённое уравнение с обоснованием.<br/>2 балла - за модель и решение текстовой задачи.<br/>1 балл - за проверки подстановкой и понятное оформление.<br/><b>Всего: 8 баллов.</b>'),
    ])
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(output)

if __name__ == '__main__':
    main()
