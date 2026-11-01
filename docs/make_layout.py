# Чертёж экрана матча ОМУТ 390×844 (логические px) и анатомия компонентов. Рисуется ×2.
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.dirname(os.path.abspath(__file__))
K = 2
ICON = {n: Image.open(os.path.join(D, 'icons', 'png', n + '.png')).convert('RGBA') for n in
        ['sun','skull','eye','tentacle','flame','swirl','heart','sword','coin','shield','gear','exit','deck','grave','hourglass','poison']}
def font(sz, bold=False):
    for f in (['arialbd.ttf'] if bold else []) + ['arial.ttf', 'DejaVuSans.ttf']:
        try: return ImageFont.truetype(f, sz * K)
        except Exception: pass
    return ImageFont.load_default()
F9, F10, F11, F12, F14 = font(9), font(10), font(11), font(12), font(14, True)
BG=(12,13,14); LINE=(70,74,78); TXT=(236,230,214); MUTE=(150,146,136); GOLD=(226,179,60); RED=(226,72,60); BLUE=(79,143,214); PURP=(163,92,255); GREEN=(148,211,108)

def R(d, x, y, w, h, outline=LINE, fill=None, width=1):
    d.rectangle([x*K, y*K, (x+w)*K-1, (y+h)*K-1], outline=outline, fill=fill, width=width*K)
def T(d, x, y, s, f=F10, c=TXT, anchor='la'):
    d.text((x*K, y*K), s, font=f, fill=c, anchor=anchor)
def ico(im, n, x, y, s=16):
    i = ICON[n].resize((s*K, s*K), Image.NEAREST); im.paste(i, (x*K, y*K), i)
def dim(d, x1, y1, x2, y2, label, c=GOLD):
    d.line([x1*K, y1*K, x2*K, y2*K], fill=c, width=K)
    T(d, (x1+x2)/2, (y1+y2)/2, label, F9, c, 'mm')

W, H = 390, 844
im = Image.new('RGB', (W*K + 820*K, H*K), BG); d = ImageDraw.Draw(im)
R(d, 0, 0, W, H, outline=(110,110,110))

zones = [('Верхняя панель: соперник', 0, 56), ('Рука соперника + колода/Дно', 60, 54), ('Ряд миров соперника', 118, 190),
         ('Баннер хода / подсказка', 312, 30), ('Твой ряд миров', 346, 190), ('Твоя рука (веер)', 540, 230), ('Нижняя панель: ты + «Конец хода»', 774, 70)]
for name, y, h in zones:
    R(d, 0, y, W, h, outline=(45,48,52))
    T(d, W + 14, y + 4, f'y {y}–{y+h}  ·  высота {h}', F11, GOLD)
    T(d, W + 14, y + 20, name, F11, TXT)
T(d, W + 14, 600, 'Отступ между зонами 4 px.', F10, MUTE); T(d, W + 14, 616, 'Сумма: 844. Боковые поля 10 px.', F10, MUTE)

# верхняя панель
R(d, 12, 6, 44, 44, outline=MUTE); T(d, 34, 28, 'аватар', F9, MUTE, 'mm')
ico(im, 'heart', 64, 20); T(d, 84, 20, '25', F14); ico(im, 'coin', 118, 20); T(d, 138, 20, '4', F14)
R(d, 282, 6, 44, 44, outline=MUTE); ico(im, 'gear', 296, 20); R(d, 334, 6, 44, 44, outline=MUTE); ico(im, 'exit', 348, 20)
# рука соперника
for i in range(5):
    x = 195 - 16 + (i - 2) * 26; R(d, x, 63, 32, 48, outline=(90,140,140), fill=(18,30,32))
R(d, 12, 67, 40, 40, outline=MUTE); ico(im, 'deck', 24, 72); T(d, 32, 100, '33', F9, MUTE, 'mm')
R(d, 338, 67, 40, 40, outline=MUTE); ico(im, 'grave', 350, 72); T(d, 358, 100, '6', F9, MUTE, 'mm')

worlds = ['flame', 'skull', 'eye', 'sun']
def world(y0, mine, contents):
    for i in range(4):
        x = 10 + i * 94
        R(d, x, y0, 88, 190, outline=(90,60,60) if not mine else (80,84,88), width=1)
        for s in range(2):
            ty = y0 + 5 + s * 84
            c = contents[i][s]
            if c:
                col = {'r':BLUE,'e':PURP,'l':GOLD,'c':(180,184,188)}[c]
                R(d, x+6, ty, 76, 80, outline=col, fill=(30,32,34), width=2)
                T(d, x+44, ty+34, 'арт: лицо', F9, MUTE, 'mm')
                ico(im, worlds[i] if worlds[i] != 'eye' else 'eye', x+9, ty+3)
                R(d, x+8, ty+58, 34, 20, outline=LINE, fill=(8,8,9)); ico(im, 'sword', x+9, ty+60); T(d, x+28, ty+61, '3', F11)
                R(d, x+46, ty+58, 34, 20, outline=LINE, fill=(8,8,9)); ico(im, 'heart', x+47, ty+60); T(d, x+66, ty+61, '5', F11)
            else:
                d.rectangle([(x+6)*K, ty*K, (x+82)*K-1, (ty+80)*K-1], outline=(70,70,70), width=K)
        ico(im, worlds[i], x + 68, y0 + 171)
world(118, False, [[None,None],['c',None],['e','r'],[None,None]])
T(d, 195, 327, 'Баннер: «Твой ход» / подсказка / причина отказа', F10, MUTE, 'mm')
world(346, True, [['l',None],[None,None],['c','c'],[None,None]])
# размеры мира и фишки
dim(d, 10, 312-4, 98, 312-4, '88')
dim(d, 100, 118, 100, 308, '190')
T(d, 10, 540-2, '', F9)

# рука
for i, col in enumerate([(180,184,188), BLUE, GOLD, PURP, (180,184,188)]):
    k = i - 2; x = 195 - 42 + k * 64; y = 600 + abs(k) * 6
    up = (i == 2)
    if up:
        R(d, 195 - 59, 548, 118, 188, outline=col, fill=(30,32,34), width=3); T(d, 195, 640, 'выбранная ×1.4', F9, MUTE, 'mm'); continue
    R(d, x, y, 84, 134, outline=col, fill=(26,28,30), width=3)
T(d, 30, 752, 'Карта в руке 84×134. Выбранная/тащимая — 118×188, поднята на 40 px над пальцем.', F9, MUTE)
# нижняя панель
R(d, 12, 787, 44, 44, outline=MUTE); ico(im, 'heart', 64, 801); T(d, 84, 801, '25', F14); ico(im, 'coin', 118, 801); T(d, 138, 801, '7', F14)
R(d, 228, 785, 150, 48, outline=GOLD, width=2); T(d, 303, 809, 'Конец хода', F12, GOLD, 'mm')

# ---- правая колонка: анатомия ----
ox = W + 300
T(d, ox, 20, 'ФИШКА НА ПОЛЕ 76×80 (масштаб ×2)', F11, GOLD)
fx, fy = ox, 40
d.rectangle([fx*K, fy*K, (fx+152)*K-1, (fy+160)*K-1], outline=BLUE, width=4*K, fill=(30,32,34))
T(d, fx+76, fy+70, 'арт: лицо персонажа', F10, MUTE, 'mm'); T(d, fx+76, fy+84, '(кадр по focus из cards.json)', F9, MUTE, 'mm')
ico(im, 'eye', fx+6, fy+6, 32); ico(im, 'shield', fx+114, fy+6, 32); ico(im, 'poison', fx+6, fy+80, 24)
R(d, fx+4, fy+116, 68, 40, outline=LINE, fill=(8,8,9)); ico(im, 'sword', fx+8, fy+120, 32); T(d, fx+46, fy+124, '3', font(18, True))
R(d, fx+80, fy+116, 68, 40, outline=LINE, fill=(8,8,9)); ico(im, 'heart', fx+84, fy+120, 32); T(d, fx+122, fy+124, '5', font(18, True))
notes = ['• рамка 2px цвета редкости + 1px тёмная внутри', '• класс 16px слева сверху', '• щит Приоритета 16px справа сверху',
         '• статусы (яд, ждёт) 16px слева, над плашками', '• урон и ♥: плашки 34×20, цифра Tiny5 16px', '• ♥ красным, если ранен', '• имени нет: имя и текст — в инспекторе']
for i, n in enumerate(notes): T(d, fx+160, fy + 4 + i * 16, n, F9, TXT)
T(d, ox, 230, 'СОСТОЯНИЯ ФИШКИ', F11, GOLD)
st = [('может бить', GOLD), ('выбрана', TXT), ('цель', RED), ('свой союзник-цель', GREEN), ('нельзя', LINE)]
for i, (n, c) in enumerate(st):
    x = ox + i * 90; R(d, x, 250, 60, 64, outline=c, width=2, fill=(24,26,28)); T(d, x + 30, 324, n, F9, c, 'mm')
T(d, ox, 344, 'Над целью при атаке — плашка «+N монет» (награда).', F9, MUTE)
T(d, ox, 380, 'КАРТА В РУКЕ 84×134', F11, GOLD)
hx, hy = ox, 400
d.rectangle([hx*K, hy*K, (hx+84)*K-1, (hy+134)*K-1], outline=GOLD, width=3*K, fill=(30,32,34))
T(d, hx+6, hy+6, 'Кощей', F10); ico(im, 'skull', hx+62, hy+5)
R(d, hx+3, hy+110, 78, 21, outline=LINE, fill=(8,8,9)); ico(im, 'heart', hx+5, hy+112); T(d, hx+21, hy+113, '7', F10)
ico(im, 'sword', hx+31, hy+112); T(d, hx+47, hy+113, '4', F10); ico(im, 'coin', hx+57, hy+112); T(d, hx+73, hy+113, '7', F10)
for i, n in enumerate(['• имя: Golos Text 700, 11px, до 2 строк', '• класс 16px справа сверху', '• арт на всю карту под текстом',
                       '• низ: ♥ | урон | цена, Tiny5 16px', '• не хватает монет: карта тусклее,', '  цена красным', '• оборот и полный текст — инспектор 300×480']):
    T(d, hx + 96, hy + i * 16, n, F9, TXT)
T(d, ox, 560, 'ИНСПЕКТОР 300×480 — точно по макету assets/src/card-koshey.webp', F11, GOLD)
ref = Image.open(os.path.join(D, '..', 'concept', 'assets', 'src', 'card-koshey.webp')).convert('RGB')
ref = ref.resize((int(ref.width * (560*K/ref.width)), int(ref.height * (560*K/ref.width))))
im.paste(ref, (ox*K, 580*K))
im.save(os.path.join(D, 'layout-390x844.png'))
print('ok')
