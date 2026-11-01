# ОМУТ — промпты для генерации арта

Эталон стиля — утверждённая карта Кощея (`concept/assets/src/card-koshey.webp`). Если твой генератор умеет «референс стиля» (style reference, image prompt), **всегда прикладывай эту картинку**: так все карты получатся одной руки.

## Как генерировать
1. В начало каждого промпта вставляй **общий стиль** (блок ниже), потом описание конкретной карты.
2. Если генератор поддерживает «негативный промпт», вставь блок «Не надо». Если нет, допиши в конец «no text, no frame, no border, no UI».
3. Делай 4 варианта и бери тот, где персонаж целиком, лицо в верхней трети и фон не перегружен.
4. Сохраняй файл под именем из таблицы и клади в нужную папку. Обрезку, размер и цвет потом выровняет скрипт (`npm run art`), сам ничего не растягивай.
5. Не вырезай арт из скриншотов игры: только чистые картинки из генератора.

## Общий стиль (вставлять в каждый промпт)
```
dark slavic folklore fantasy, detailed pixel art illustration, 32-bit style with crisp visible pixels, limited muted palette, deep shadows, soft fog, dramatic rim light, one warm accent color, gloomy mystical atmosphere, character centered, full figure or knees-up, three-quarter view, face in the upper third of the image, clean silhouette readable at small size, background is the character's home world, slightly blurred and darker than the character
```

## Не надо (негативный промпт)
```
text, letters, watermark, signature, card frame, border, UI, icons, numbers, cropped head, cut off face, multiple characters, cute, chibi, cartoon, anime, glossy 3d render, photorealistic, neon colors, purple-blue gradient, smooth vector, blurry, jpeg artifacts
```

## Размеры
| Что | Пропорции | Минимальный размер выдачи | Папка |
|---|---|---|---|
| Персонажи и чары | 3:4 вертикально | 768×1024 | `assets/art/` |
| Фоны миров | 9:16 вертикально | 720×1280 | `assets/worlds/` |
| Рубашка карты | 5:8 вертикально | 640×1024 | `assets/ui/` |
| Аватары | 1:1 | 512×512 | `assets/ui/` |
| Фон меню | 9:16 | 1080×1920 | `assets/ui/` |

---

## Фоны миров
Без персонажей, без слотов и пунктира, без интерфейса. Нижняя треть темнее, в середине спокойная зона: там будут стоять фишки. Детали по краям.

| Файл | Промпт (после общего стиля, слова про персонажа убрать) |
|---|---|
| `worlds/yav.png` | `empty landscape, no characters, Yav — the world of living people: autumn fields at dusk, wooden palisade of a frontier outpost, distant spruce forest, low orange sun in haze, golden-brown palette` |
| `worlds/nav.png` | `empty landscape, no characters, Nav — the underworld of the dead: burial mounds, leaning wooden crosses, old bones in grass, cold pale fog, grey-green palette, dim moonlight` |
| `worlds/chasha.png` | `empty landscape, no characters, the Thicket — a dark ancient forest of crooked trees and roots, glowing green eyes between trunks, fireflies, mossy ground, deep green palette` |
| `worlds/puchina.png` | `empty underwater scene, no characters, the Abyss — deep dark sea bottom, rising bubbles, shadows of huge tentacles far away, sunken rocks, cold blue palette, light from above` |
| `worlds/peklo.png` | `empty landscape, no characters, Peklo — the fiery underworld: black rocks, rivers of lava, rising embers and sparks, smoke, red-orange palette` |
| `worlds/omut.png` | `empty scene, no characters, the Whirlpool — black still water seen from above at an angle, a slow vortex with concentric ripples, dark teal reflections, mist over the water` |

---

## Персонажи (существа)
| Файл | Карта | Описание (после общего стиля) |
|---|---|---|
| `art/opol.png` | Ополченец | `a poor peasant militiaman in a linen shirt and bast shoes holding a pitchfork, worried face, background: Yav autumn fields and palisade` |
| `art/druzh.png` | Дружинник | `a slavic warrior in chainmail and a pointed helmet with a red round shield and a spear, red cloak, stern bearded face, background: Yav fields and palisade` |
| `art/luch.png` | Лучник заставы | `a slavic archer drawing a bow on top of a wooden palisade, leather armor, fur hat, focused eyes, background: Yav dusk sky` |
| `art/svyat.png` | Святогор | `a colossal bogatyr knight taller than the hills, heavy ornate armor, huge sword resting on shoulder, white beard, heroic and calm, background: Yav mountains at sunset, gold accent` |
| `art/mertv.png` | Мертвяк | `a risen corpse in rotten burial clothes climbing out of a grave mound, empty eyes, background: Nav burial mounds and crosses, pale fog` |
| `art/skel.png` | Скелет-щитоносец | `an old skeleton warrior holding a cracked round wooden shield and a rusty sword, defensive pose, background: Nav crosses and fog` |
| `art/upyr.png` | Упырь | `a pale bald ghoul-vampire with red eyes and long claws, crouching, hungry grin, background: Nav graveyard at night` |
| `art/koshey.png` | Кощей | `Koschei the Deathless, a skeletal tsar in a spiked golden crown and black tattered robes with gold armor plates, holding a small chest and a golden needle, background: Nav graveyard hills in green fog, gold accent` |
| `art/kot.png` | Кот | `a big black cat with glowing yellow eyes sitting on a mossy stone, calm and wise, background: Chasha dark green forest` |
| `art/kiki.png` | Кикимора | `a shaggy swamp hag covered in moss and duckweed, long tangled hair, bony fingers dripping green slime, background: Chasha swamp forest` |
| `art/volk.png` | Волкодлак | `a werewolf mid-leap, half man half wolf, torn shirt, glowing orange eyes, bared fangs, background: Chasha forest under a full moon` |
| `art/yaga.png` | Баба-Яга | `Baba Yaga, an old witch flying in a wooden mortar with a broom, long nose, iron teeth, sly smile, a hut on chicken legs behind, background: Chasha dark forest, green and gold accent` |
| `art/zhaba.png` | Болотная жаба | `a huge fat warty toad sitting in shallow water, sleepy golden eyes, background: Puchina misty swamp water` |
| `art/smey.png` | Морской змей | `a long sea serpent bursting out of dark waves, scales, open jaws, background: Puchina stormy sea` |
| `art/kraken.png` | Кракен глубин | `a giant kraken rising from the abyss, many purple-black tentacles with suckers curling toward the viewer, one huge glowing eye in the darkness, background: Puchina deep blue water` |
| `art/bes.png` | Бесёнок | `a small red imp with curved horns, pointed ears, long tail and a mischievous grin, crouching, background: Peklo embers and lava` |
| `art/chert.png` | Чёрт-меняла | `a cunning devil merchant with horns and a goatee, holding a coin pouch and a scroll contract, sly smile, background: Peklo smoky lava cave, gold coins glint` |
| `art/ognz.png` | Огненный змей | `a fiery serpent-dragon made of flames and dark scales, coiling in the air, burning eyes, background: Peklo lava rivers` |
| `art/frog.png` | Жаба (жетон) | `a small sad enchanted frog with a tiny crown fallen beside it, magic sparkles, background: Puchina swamp` |

## Чары
Без персонажей. В центре — предмет или явление, крупно.

| Файл | Карта | Описание |
|---|---|---|
| `art/fire.png` | Огненный шар | `a blazing fireball flying forward, trail of sparks, background: Peklo` |
| `art/krov.png` | Глоток крови | `a carved bone goblet overflowing with dark red blood, red mist rising, background: Nav darkness` |
| `art/istoch.png` | Святой источник | `a holy spring in a birch grove, glowing clear water in a stone basin, soft light, background: Yav` |
| `art/znamya.png` | Знамя | `a red slavic battle banner with a golden sun emblem on a spear shaft, waving in wind, background: Yav` |
| `art/koshel.png` | Кошель | `a worn leather coin purse spilling gold coins on a wooden table, candle light, background: dark interior` |
| `art/poglot.png` | Омут поглотил | `a black whirlpool with teeth-like rocks swallowing a silhouette, dark teal water, background: Omut` |
| `art/lik.png` | Пустой лик | `an empty white wooden mask floating in mist, eye holes glowing faintly, background: Omut fog` |

## Интерфейс
| Файл | Описание |
|---|---|
| `ui/card-back.png` | `card back design, dark slate stone surface, a silver swirling vortex ring in the center, small four-pointed stars around, thin ornamental border, symmetric, pixel art, no text` |
| `ui/avatar-bot.png` | `portrait, a hooded skeleton with glowing eyes, dark background, pixel art, centered head and shoulders` |
| `ui/avatar-me.png` | `portrait, a hooded mysterious figure with the face hidden in shadow, dark background, pixel art, centered head and shoulders` |
| `ui/menu-bg.png` | `vertical scene, black whirlpool water at night under a pale moon, mist, dead reeds at the edges, faint silhouettes of creatures in the water, empty center for a logo, pixel art` |

## Проверка перед тем, как сохранить
- [ ] Нет текста, рамки, цифр.
- [ ] Лицо или главный предмет — в верхней половине, голова не обрезана.
- [ ] Фон — родной мир карты.
- [ ] Похоже на Кощея по стилю (пиксель, туман, приглушённые цвета).
