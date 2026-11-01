# Генератор пиксельных иконок ОМУТ: сетка 14×14 + автоматическая тёмная обводка 1px = 16×16.
# Запуск: python make_icons.py  → icons-16.png, icons-32.png (×2), icons-preview.png, папка png/ с отдельными файлами.
# 'X' — основной цвет, 'o' — второй тон, 'h' — блик, '.' — пусто.
from PIL import Image, ImageDraw, ImageFont
import os, json

OUT = os.path.dirname(os.path.abspath(__file__))
OUTLINE = (11, 11, 13, 255)

def hexc(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

G = {}  # имя -> (сетка или функция, палитра, подпись)

G['sun'] = ([
 "......XX......",
 "......XX......",
 "..X........X..",
 "...X.XXXX.X...",
 ".....XhhXX....",
 "....XhXXXXX...",
 "XX..XhXXXXX.XX",
 "XX..XXXXXXX.XX",
 "....XXXXXXo...",
 ".....XXXXo....",
 "...X.XooX.X...",
 "..X........X..",
 "......XX......",
 "......XX......"], {'X':'#f2c14e','h':'#fff1b0','o':'#c08a2a'}, 'Явь / Люди')

G['skull'] = ([
 "...XXXXXXXX...",
 "..XXXXXXXXXX..",
 ".XXhhXXXXXXXX.",
 ".XhXXXXXXXXXX.",
 ".XX...XX...XX.",
 ".XX...XX...XX.",
 ".XX...XX...XX.",
 ".XXXXXXXXXXXX.",
 "..XXXX..XXXX..",
 "...XXXXXXXX...",
 "...XX.XX.XX...",
 "...XXXXXXXX...",
 "..............",
 ".............."], {'X':'#e6e2d6','h':'#ffffff','o':'#8a867c'}, 'Навь / Нежить')

G['eye'] = ([
 "..............",
 "..............",
 "..............",
 "....XXXXXX....",
 "..XXhhXXhhXX..",
 ".XhhhXXXXhhhX.",
 "XhhhXXooXXhhhX",
 "XhhhXXooXXhhhX",
 ".XhhhXXXXhhhX.",
 "..XXhhXXhhXX..",
 "....XXXXXX....",
 "..............",
 "..............",
 ".............."], {'X':'#7fc25a','h':'#e4f6c8','o':'#0e160a'}, 'Чаща / Нечисть')

G['tentacle'] = ([
 "..............",
 ".....XXXX.....",
 "....XX..XX....",
 "....X....XX...",
 "....XX....X...",
 ".....X....XX..",
 "..........XX..",
 ".........XXX..",
 "........XXXh..",
 ".......XXXh...",
 ".....XXXXh....",
 "...XXXXXh.....",
 "..XXXXXh......",
 ".XXXXXX......."], {'X':'#6fb3e8','h':'#d7ecff','o':'#2f5f8f'}, 'Пучина / Чудища')

G['flame'] = ([
 "......X.......",
 "......XX......",
 ".....XXX......",
 ".....XXXX.....",
 "....XXXXX..X..",
 "...XXXXXXX.XX.",
 "...XXXXXXXXXX.",
 "..XXXXooXXXXX.",
 "..XXXoooXXXXX.",
 "..XXXooooXXXX.",
 "..XXXoohoXXXX.",
 "...XXoohoXXX..",
 "....XXooXXX...",
 ".....XXXXX...."], {'X':'#ff7a33','o':'#ffd36b','h':'#fff6d0'}, 'Пекло / Бесы')

def swirl(d):
    d.ellipse([0, 1, 13, 12], outline=1)
    d.ellipse([3, 4, 10, 9], outline=1)
    d.rectangle([6, 6, 7, 7], fill=1)
    d.point([(2, 3), (11, 10)], fill=0)  # разрывы колец — ощущение вращения
    d.point([(4, 5), (9, 8)], fill=0)
G['swirl'] = (swirl, {'X':'#8fe0cf'}, 'Омут (любой класс)')

G['heart'] = ([
 "..............",
 "..XXX....XXX..",
 ".XXXXX..XXXXX.",
 "XXhhXXXXXXXXXX",
 "XhhXXXXXXXXXXX",
 "XhXXXXXXXXXXXX",
 "XXXXXXXXXXXXoX",
 ".XXXXXXXXXXoX.",
 "..XXXXXXXXoX..",
 "...XXXXXXXX...",
 "....XXXXXX....",
 ".....XXXX.....",
 "......XX......",
 ".............."], {'X':'#e2483c','h':'#ff9a90','o':'#a3281f'}, 'Здоровье ♥')

G['sword'] = ([
 "...........XXX",
 "..........XhhX",
 ".........XhhX.",
 "........XhhX..",
 ".......XhhX...",
 "......XhhX....",
 "..X..XhhX.....",
 "..XXXhhX......",
 "...XXhX.......",
 "...XXXXX......",
 "..XoX.XX......",
 ".XoX..........",
 "XoX...........",
 "XX............"], {'X':'#cfccc2','h':'#ffffff','o':'#8a5a2a'}, 'Урон ⚔')

def coin(d):
    d.ellipse([0, 0, 13, 13], fill=1)
    d.ellipse([3, 3, 10, 10], outline=2)
    d.point([(3, 1), (4, 1), (2, 2), (1, 3), (1, 4)], fill=3)
G['coin'] = (coin, {'X':'#e2b33c','o':'#9a6f12','h':'#fff0a8'}, 'Монета')

G['shield'] = ([
 ".XXXXXXXXXXXX.",
 ".XhhhXXXXXXXX.",
 ".XhXXXooXXXXX.",
 ".XhXXXooXXXXX.",
 ".XXXooooooXXX.",
 ".XXXooooooXXX.",
 ".XXXXXooXXXXX.",
 "..XXXXooXXXX..",
 "..XXXXooXXXX..",
 "...XXXXXXXX...",
 "....XXXXXX....",
 ".....XXXX.....",
 "......XX......",
 ".............."], {'X':'#d6d9dc','h':'#ffffff','o':'#e2b33c'}, 'Приоритет / Щит')

DROP = [
 "......XX......",
 "......XX......",
 ".....XXXX.....",
 ".....XXXX.....",
 "....XXXXXX....",
 "...XXXXXXXX...",
 "..XhXXXXXXXX..",
 "..XhXXXXXXXX..",
 ".XXhXXXXXXXXX.",
 ".XXXXXXXXXXXX.",
 ".XXXXXXXXXXoX.",
 "..XXXXXXXXoX..",
 "...XXXXXXXX...",
 ".....XXXX....."]
G['blood'] = (DROP, {'X':'#d0302a','h':'#ff8a80','o':'#8a1c18'}, 'Кровь')
G['poison'] = ([r if i not in (8, 9, 10) else r for i, r in enumerate([
 "......XX......",
 "......XX......",
 ".....XXXX.....",
 ".....XXXX.....",
 "....XXXXXX....",
 "...XXXXXXXX...",
 "..XhXXXXXXXX..",
 "..XhXXooXXXX..",
 ".XXXXXooXXXXX.",
 ".XXXXXXXXoXXX.",
 ".XXoXXXXXXXXX.",
 "..XXXXXXXXXX..",
 "...XXXXXXXX...",
 ".....XXXX....."])], {'X':'#8fd16a','h':'#e0ffc0','o':'#3e7a24'}, 'Яд')

G['hourglass'] = ([
 "..............",
 "..XXXXXXXXXX..",
 "...X......X...",
 "...XhhhhhhX...",
 "....XhhhhX....",
 ".....XhhX.....",
 "......XX......",
 "......XX......",
 ".....X..X.....",
 "....X.hh.X....",
 "...XhhhhhhX...",
 "..XXXXXXXXXX..",
 "..............",
 ".............."], {'X':'#c9b38a','h':'#e2b33c'}, 'Ждёт хода')

G['bolt'] = ([
 "........XXXX..",
 ".......XXXX...",
 "......XXXX....",
 ".....XXXX.....",
 "....XXXX......",
 "...XXXXXXXXX..",
 "...XXXXXXXX...",
 ".......XXX....",
 "......XXX.....",
 ".....XXX......",
 "....XXX.......",
 "...XX.........",
 "..XX..........",
 ".X............"], {'X':'#ffd34a'}, 'Рывок')

G['arrow'] = ([
 "..........XXXX",
 "...........XXX",
 "..........XXXX",
 ".........XXX.X",
 "........XXX...",
 ".......XXX....",
 "......XXX.....",
 ".....XXX......",
 "....XXX.......",
 "..oXXX........",
 ".ooXX.........",
 "oo.oo.........",
 "o..o..........",
 ".............."], {'X':'#d9d6cc','o':'#c0532a'}, 'Дальнобой')

G['ram'] = ([
 "..............",
 "XX......XX....",
 "XXX.....XXX...",
 ".XXX.....XXX..",
 "..XXX.....XXX.",
 "...XXX.....XXX",
 "....XXX.....XX",
 "....XXX.....XX",
 "...XXX.....XXX",
 "..XXX.....XXX.",
 ".XXX.....XXX..",
 "XXX.....XXX...",
 "XX......XX....",
 ".............."], {'X':'#ff8a3d'}, 'Таран')

G['steadfast'] = ([
 "..............",
 "..XXX....XXX..",
 ".XoooX..XoooX.",
 "XoooooXXoooooX",
 "Xoooooooo.oooX",
 "Xooooooo.ooooX",
 "Xoooooooo.oooX",
 ".Xooooooo.ooX.",
 "..Xoooooo.oX..",
 "...XooooooX...",
 "....XooooX....",
 ".....XooX.....",
 "......XX......",
 ".............."], {'X':'#e6e2d6','o':'#5a5650'}, 'Стойкость')

def greed(d):
    d.ellipse([0, 2, 10, 12], fill=1)
    d.ellipse([3, 5, 7, 9], outline=2)
    d.rectangle([11, 0, 12, 6], fill=4); d.rectangle([9, 2, 13, 3], fill=4)
G['greed'] = (greed, {'X':'#e2b33c','o':'#9a6f12','h':'#fff0a8','p':'#94d36c'}, 'Жадность')

G['healer'] = ([
 "..............",
 "..XXX....XXX..",
 ".XXXXX..XXXXX.",
 "XXXXXXhhXXXXXX",
 "XXXXXXhhXXXXXX",
 "XXXhhhhhhhhXXX",
 "XXXhhhhhhhhXXX",
 ".XXXXXhhXXXXX.",
 "..XXXXhhXXXX..",
 "...XXXXXXXX...",
 "....XXXXXX....",
 ".....XXXX.....",
 "......XX......",
 ".............."], {'X':'#7fc25a','h':'#ffffff'}, 'Лекарь')

G['devour'] = ([
 "..XXXXXXXXXX..",
 ".XXXXXXXXXXXX.",
 "XXXXXXXXXXXXXX",
 "XhX.hX.Xh.XhXX",
 "X.h..h..h..h.X",
 "X............X",
 "X............X",
 "X............X",
 "X.h..h..h..h.X",
 "XXhX.Xh.hX.hXX",
 "XXXXXXXXXXXXXX",
 ".XXXXXXXXXXXX.",
 "..XXXXXXXXXX..",
 ".............."], {'X':'#9b5cd6','h':'#f4efe2'}, 'Пожирает')

G['surface'] = ([
 "......XX......",
 ".....XXXX.....",
 "....XXXXXX....",
 "...XXXXXXXX...",
 "..XXX.XX.XXX..",
 "......XX......",
 "......XX......",
 "......XX......",
 "..............",
 ".oo..oo..oo..o",
 "o..oo..oo..oo.",
 "..............",
 ".oo..oo..oo..o",
 "o..oo..oo..oo."], {'X':'#8fe0cf','o':'#3f8f9f'}, 'Всплытие')

G['deathstrike'] = ([
 "XX..........XX",
 "XhX........XhX",
 ".XhX......XhX.",
 "..XhX....XhX..",
 "...XhX..XhX...",
 "....XhXXhX....",
 ".....XhhX.....",
 ".....XhhX.....",
 "....XoXXoX....",
 "..XXo....oXX..",
 "..Xo......oX..",
 ".oX........Xo.",
 "oo..........oo",
 ".............."], {'X':'#d6d2c6','h':'#ffffff','o':'#c2493e'}, 'Предсмертный удар')

def gear(d):
    d.ellipse([2, 2, 11, 11], fill=1)
    for x0, y0, x1, y1 in [(6,0,7,2),(6,11,7,13),(0,6,2,7),(11,6,13,7),(2,2,3,3),(10,2,11,3),(2,10,3,11),(10,10,11,11)]:
        d.rectangle([x0, y0, x1, y1], fill=1)
    d.ellipse([5, 5, 8, 8], fill=0)
G['gear'] = (gear, {'X':'#c9ccd0'}, 'Настройки')

G['exit'] = ([
 "XXXXXXXX......",
 "XhhhhhhX......",
 "Xh....hX......",
 "Xh....hX..X...",
 "Xh....hX..XX..",
 "Xh..X.hXXXXXX.",
 "Xh....hXXXXXXX",
 "Xh....hXXXXXX.",
 "Xh....hX..XX..",
 "Xh....hX..X...",
 "Xh....hX......",
 "XhhhhhhX......",
 "XXXXXXXX......",
 ".............."], {'X':'#c9ccd0','h':'#6a6d70'}, 'Выход')

G['deck'] = ([
 "....XXXXXXXXX.",
 "....XoooooooX.",
 "..XXXXXXXXXoX.",
 "..XoooooooXoX.",
 "XXXXXXXXXXXoX.",
 "XooooooooXXoX.",
 "XoohhhhooXXoX.",
 "XohoooohoXXoX.",
 "XohohhohoXXXX.",
 "XohoohohoX....",
 "XoohhhohoX....",
 "XooooooooX....",
 "XXXXXXXXXX....",
 ".............."], {'X':'#8fe0cf','o':'#13262a','h':'#8fe0cf'}, 'Колода Омута')

G['grave'] = ([
 "....XXXXXX....",
 "...XXXXXXXX...",
 "..XXXXXXXXXX..",
 "..XXXXooXXXX..",
 "..XXXooooXXX..",
 "..XXXXooXXXX..",
 "..XXXXooXXXX..",
 "..XXXXXXXXXX..",
 "..XXXXXXXXXX..",
 "..XXXXXXXXXX..",
 ".XXXXXXXXXXXX.",
 "hhhhhhhhhhhhhh",
 "..............",
 ".............."], {'X':'#9d988c','o':'#5a5650','h':'#5f7a3a'}, 'Дно (сброс)')

G['hammer'] = ([
 "..XXXXXXXX....",
 ".XhhhhhhhXX...",
 ".XXXXXXXXXX...",
 "..XXXXXXXX....",
 ".....oo.......",
 ".....oo.......",
 ".....oo.......",
 ".....oo.......",
 ".....oo.......",
 ".....oo.......",
 ".....oo.......",
 "....oooo......",
 "..............",
 ".............."], {'X':'#c9ccd0','h':'#ffffff','o':'#8a5a2a'}, 'Закалка')

G['rune'] = ([
 "......XX......",
 "......XX......",
 ".....XXXX.....",
 ".....XhhX.....",
 "....XXhhXX....",
 ".XXXXXhhXXXXX.",
 "XXhhhhhhhhhhXX",
 "XXhhhhhhhhhhXX",
 ".XXXXXhhXXXXX.",
 "....XXhhXX....",
 ".....XhhX.....",
 ".....XXXX.....",
 "......XX......",
 "......XX......"], {'X':'#a37ae0','h':'#efe4ff'}, 'Чары')

def render(name):
    src, pal, _ = G[name]
    keymap = {1: 'X', 2: 'o', 3: 'h', 4: 'p'}
    grid = [[None] * 14 for _ in range(14)]
    if callable(src):
        m = Image.new('L', (14, 14), 0); src(ImageDraw.Draw(m))
        for y in range(14):
            for x in range(14):
                v = m.getpixel((x, y))
                if v: grid[y][x] = keymap.get(v, 'X')
    else:
        assert len(src) == 14, (name, len(src))
        for y, row in enumerate(src):
            assert len(row) == 14, (name, y, len(row), row)
            for x, ch in enumerate(row):
                if ch != '.': grid[y][x] = ch
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y in range(14):
        for x in range(14):
            ch = grid[y][x]
            if ch: im.putpixel((x + 1, y + 1), hexc(pal.get(ch, pal['X'])))
    # обводка: пустые клетки рядом (4 соседа) с заполненными
    px = im.load(); out = im.copy(); po = out.load()
    for y in range(16):
        for x in range(16):
            if px[x, y][3] == 0 and any(0 <= x+dx < 16 and 0 <= y+dy < 16 and px[x+dx, y+dy][3] for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                po[x, y] = OUTLINE
    return out

names = list(G.keys())
os.makedirs(os.path.join(OUT, 'png'), exist_ok=True)
icons = {n: render(n) for n in names}
cols = 8; rows = (len(names) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * 16, rows * 16), (0, 0, 0, 0))
atlas = {}
for i, n in enumerate(names):
    x, y = (i % cols) * 16, (i // cols) * 16
    sheet.paste(icons[n], (x, y)); atlas[n] = {'x': x, 'y': y, 'w': 16, 'h': 16, 'label': G[n][2]}
    icons[n].save(os.path.join(OUT, 'png', n + '.png'))
    icons[n].resize((32, 32), Image.NEAREST).save(os.path.join(OUT, 'png', n + '@2x.png'))
sheet.save(os.path.join(OUT, 'icons-16.png'))
sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(os.path.join(OUT, 'icons-32.png'))
json.dump(atlas, open(os.path.join(OUT, 'icons.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# превью ×4 с подписями
S = 64; cell_w, cell_h = 150, 104
pv = Image.new('RGB', (cols * cell_w, rows * cell_h), (22, 24, 26))
d = ImageDraw.Draw(pv)
try: font = ImageFont.truetype('arial.ttf', 13)
except Exception: font = ImageFont.load_default()
for i, n in enumerate(names):
    cx, cy = (i % cols) * cell_w, (i // cols) * cell_h
    pv.paste(icons[n].resize((S, S), Image.NEAREST), (cx + (cell_w - S) // 2, cy + 8), icons[n].resize((S, S), Image.NEAREST))
    pv.paste(icons[n].resize((32, 32), Image.NEAREST), (cx + 6, cy + 8), icons[n].resize((32, 32), Image.NEAREST))
    d.text((cx + 6, cy + 80), n + ' — ' + G[n][2], fill=(220, 214, 200), font=font)
pv.save(os.path.join(OUT, 'icons-preview.png'))
print('ok', len(names), 'icons')
