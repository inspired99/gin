# Промпты для персонажей fixgaz

## Один промпт на все

Один лист `sheet.png`: 4 столбца на 3 ряда, соотношение 4:3 (например 1536 на 1152). Все трое получаются в одном стиле за одну генерацию.

| Ряд | Кто | Столбцы слева направо |
|---|---|---|
| 1 | Елисей | обычный, в форме, в дыму, спит |
| 2 | Павел | обычный, в форме, в дыму, спит |
| 3 | джинн | жив, смеется, напуган, побежден |

```
Pixel art sprite sheet, 4 columns by 3 rows, twelve equal cells, landscape 4:3. Row 1: chibi young man, short brown hair with a swept-up quiff, blue t-shirt, dark blue jeans, white sneakers. Row 2: chibi young man, dark buzz cut, navy button-up shirt with rolled sleeves, gray trousers, white sneakers. Rows 1 and 2, left to right: standing relaxed, smiling; flexing both biceps; hunched and coughing, gray smoke cloud by his head; asleep standing, tiny z above his head. Row 3: hookah smoke genie, round gray smoke body with a curl on top, rising from a small hookah bowl with an orange coal; left to right: smirking, arms crossed; laughing, puffed up; scared and shrunken, sweat drop; defeated, three fading smoke puffs over the empty bowl. Style: 8-bit NES sprites, 32x32 pixel grid, crisp square pixels, 1-pixel near-black outline, flat colors, no gradients, no shadows. Background: solid flat magenta #ff00ff. No text, no frame, no grid lines. Front view, full body, sprites centered in cells.
```

Что проверить в результате: 12 поз, никто не перепутан рядами, нет подписей и линий сетки, фон ровный. Если генератор путает ряды или склеивает позы, ниже есть запасной вариант: три отдельных листа 2 на 2.

Когда какая поза показывается:

- **обычный**: день без событий.
- **в форме**: тренировка была сегодня или вчера.
- **в дыму**: сегодня был кальян или висит неотработанный штраф.
- **спит**: три дня без записей.
- **джинн**: сейчас в комнате стоит только первая поза. Здоровье джинна убрано, остальные три позы не используются. Варианты по уровням ниже, в разделе «Джинн по уровням».

## Требования к файлам

- PNG, длинная сторона от 1536.
- Фон прозрачный. Если инструмент так не умеет, то ровный пурпурный `#ff00ff` без теней и текстур (так и стоит в промптах): на белом пропали бы белые кроссовки. Вырежу сам.
- Позы одного размера, каждая по центру своей ячейки, с полями по краям.
- Без подписей, рамок и линий сетки.

Готовые файлы положи в `assets/src/`. Я нарежу их на позы, приведу к пиксельной сетке и подключу.

## Запасной вариант: три листа 2 на 2

Сначала `hero-a.png`, затем `hero-b.png` и `genie.png` с первым листом как референсом стиля. Позы слева направо, сверху вниз: обычный, в форме, в дыму, спит (у джинна: жив, смеется, напуган, побежден).

### Елисей

```
Pixel art sprite sheet, 2x2 grid of four equal square cells, the same character in four poses. Character: chibi young man, short brown hair with a small swept-up quiff at the front, clean-shaven, plain blue t-shirt #3b82f6, dark blue jeans, white sneakers, big head, full body, front view. Top left: standing relaxed, small smile. Top right: flexing both biceps, proud grin. Bottom left: hunched and coughing, eyes squeezed shut, small gray smoke cloud next to his head. Bottom right: asleep standing, eyes closed, two tiny letters z above his head. Style: 8-bit NES game sprite on a 32x32 pixel grid, large crisp square pixels, 1-pixel near-black outline #171717, flat colors, no gradients, no anti-aliasing, no glow, no ground shadow. Background: solid flat magenta #ff00ff, nothing else. No text labels, no frame, no grid lines. Each pose centered in its cell, same size in all four cells.
```

### Павел

```
Pixel art sprite sheet, 2x2 grid of four equal square cells, the same character in four poses, in exactly the same pixel style as the reference image. Character: chibi young man, very short dark buzz cut, clean-shaven, dark navy button-up shirt with rolled-up sleeves, brown belt, gray trousers, white sneakers, big head, full body, front view. Top left: standing relaxed, small smile. Top right: flexing both biceps, proud grin. Bottom left: hunched and coughing, eyes squeezed shut, small gray smoke cloud next to his head. Bottom right: asleep standing, eyes closed, two tiny letters z above his head. Style: 8-bit NES game sprite on a 32x32 pixel grid, large crisp square pixels, 1-pixel near-black outline #171717, flat colors, no gradients, no anti-aliasing, no glow, no ground shadow. Background: solid flat magenta #ff00ff, nothing else. No text labels, no frame, no grid lines. Each pose centered in its cell, same size in all four cells.
```

### Джинн

```
Pixel art sprite sheet, 2x2 grid of four equal square cells, the same character in four poses, in exactly the same pixel style as the reference image. Character: a mischievous hookah smoke genie, round body of gray smoke #bebcbb with a curl on top, thick eyebrows, smoke tail rising from a small hookah bowl with one glowing orange coal #ff6f1e. Top left: confident smirk, arms crossed. Top right: laughing, puffed up bigger, arms raised. Bottom left: scared and shrunken, worried eyes, one sweat drop. Bottom right: defeated, only three small fading smoke puffs above the empty bowl, coal gone dark. Style: 8-bit NES game sprite on a 32x32 pixel grid, large crisp square pixels, 1-pixel near-black outline #171717, flat colors, no gradients, no anti-aliasing, no glow, no ground shadow. Background: solid flat magenta #ff00ff, nothing else. No text labels, no frame, no grid lines. Each pose centered in its cell.
```

## Джинн по уровням

Джинн теперь спутник персонажа: чем выше уровень, тем он крупнее и наряднее. Нужен один лист, четыре джинна в ряд, слева направо от слабого к сильному. Формат 4:1 (например 2048 на 512), `sheet.png` приложить как референс стиля. Файл: `genie-levels.png`.

```
Pixel art sprite sheet, one horizontal row of four equal square cells, the same character at four stages of growth from weakest (left) to strongest (right), in exactly the same pixel style as the reference image. Character: a friendly hookah smoke genie, round body of gray smoke #bebcbb with a curl on top, thick eyebrows, smoke tail rising from a small hookah bowl with one glowing orange coal #ff6f1e. Cell 1: tiny baby genie, a small round puff with big curious eyes, no arms, takes about 40 percent of the cell. Cell 2: young genie, small arms, calm smile, the same as the genie on the reference, about 60 percent of the cell. Cell 3: strong genie, broader body, crossed muscular arms, two golden bracelets #f5c542, small purple vest, confident grin, about 80 percent of the cell. Cell 4: grand genie, the largest, golden turban with a red jewel, golden bracelets and necklace, orange eyes #ff6f1e, proud pose with fists on hips, two small yellow pixel sparkles next to the turban, fills the cell. Style: 8-bit NES game sprite on a 32x32 pixel grid, large crisp square pixels, 1-pixel near-black outline #171717, flat colors, no gradients, no anti-aliasing, no glow, no ground shadow. Background: solid flat magenta #ff00ff, nothing else. No text labels, no frame, no grid lines. Each figure centered in its cell, bowl at the same height in every cell.
```

Уровни по картинкам: первая с lvl 0, вторая с lvl 2, третья с lvl 4, четвертая с lvl 6. Пока листа нет, на всех уровнях стоит прежний джинн, который просто растет в размере.

## Иконка: джинн без кальяна

Квадрат, например 1024 на 1024, `sheet.png` приложить как референс. Файл: `icon.png`. Фон я заменю на теплый сам и нарежу размеры для главного экрана и favicon.

```
Pixel art app icon, square 1:1. The same smoke genie character as in the reference image, but only the genie: no hookah, no bowl, no coal. Big round head and body of gray smoke #bebcbb with a curl on top, thick eyebrows, confident friendly smirk, small crossed arms, a short smoke tail that tapers to a point at the bottom. The genie is centered and fills about 70 percent of the frame, facing forward. Simple bold shapes that stay readable at very small sizes, few details. Style: 8-bit pixel art, big chunky square pixels, 1-pixel near-black outline #171717, flat colors, at most one shade per color, no gradients, no glow, no shadow. Background: solid flat magenta #ff00ff, nothing else. No text, no frame, no border.
```

## Уютная комнатка (замена первой комнаты)

Первая комната вышла подземельем. У каждого теперь своя комнатка, в ней стоят один герой и его джинн. Формат 3:2 (например 1536 на 1024), `sheet.png` приложить как референс стиля. Файл: `scene.png`, а для разных комнат Елисею и Павлу `scene-a.png` и `scene-b.png`.

```
Pixel art game background, landscape 3:2, a small cozy room in an old castle tower on an autumn evening, in the same pixel style as the reference image. Low wooden ceiling beams, warm wooden walls with a little stone, a small crackling fireplace, a soft armchair with a knitted blanket, a bookshelf with books and jars, a round window with rain and orange leaves outside, candles, a hanging lantern, a garland of dried leaves, a steaming mug on a small table. All furniture stands along the back wall. The bottom 40 percent is empty wooden floor with a thick woven rug and no objects, where characters will stand. Everything glows warm amber and honey, no cold colors, no dark dungeon mood. No people, no characters, no text, no UI. Style: 8-bit pixel art, big chunky square pixels, 1-pixel dark outlines, flat colors, limited warm palette, no gradients, no blur.
```

Фон страницы теплее каменной стены, необязательная замена `wall.png`:

```
Seamless tileable pixel art texture, square, in the same pixel style as the reference image. Warm wooden wall paneling of wide vertical planks, honey and chestnut brown tones, very low contrast, thin darker gaps between planks, a few small knots, no highlights, no objects, no text. Tiles seamlessly on all four edges. 8-bit style, big chunky square pixels, flat colors, no gradients, no blur. Calm and warm, made to sit behind light parchment panels without competing with them.
```

## Замок: фон и декор

Стиль всего интерфейса: уютный 8-битный замок осенью, факелы и пергамент. К каждому промпту приложи `sheet.png` как референс стиля, чтобы пиксели совпали с персонажами.

| Файл | Что это | Формат |
|---|---|---|
| `scene.png` | комната, в которой стоят герои | 4:3, например 1536 на 1152 |
| `wall.png` | каменная стена, фон страницы плиткой | квадрат 1024 на 1024 |
| `props.png` | факел в двух кадрах, фонарь, тыква, три листа, свеча | 4 столбца на 2 ряда, 4:2, пурпурный фон |

В `scene.png` нижние 40% должны остаться пустыми (пол и голая стена): туда встанут герои. Факелы по бокам сверху, камин и окно по центру.

### Комната

```
Pixel art game background, landscape 4:3, cozy medieval castle common room at night in autumn, in the same pixel style as the reference image. Rough stone wall. Center: a lit stone fireplace, above it a round-arched window with orange and red autumn trees and a crescent moon. Left and right thirds: plain stone wall with one burning wall torch high up near the top on each side. A hanging iron lantern, a few fallen maple leaves, one small pumpkin by the fireplace. The bottom 40 percent is a plain wooden plank floor and bare lower wall with no objects, where characters will stand. Warm amber torchlight, deep brown and plum shadows. No people, no characters, no text, no UI. Style: 16-bit RPG interior, crisp square pixels, 1-pixel dark outlines, flat colors, limited warm palette, no gradients, no blur.
```

### Стена

```
Seamless tileable pixel art texture, square, in the same pixel style as the reference image. Dark castle stone wall of irregular rectangular stone blocks, very low contrast, deep warm brown and plum-gray tones, slightly lighter mortar lines, no highlights, no torches, no objects, no text. Tiles seamlessly on all four edges. 8-bit style, crisp square pixels, flat colors, no gradients, no blur. Calm and dark, made to sit behind light parchment panels without competing with them.
```

Швы на плитке я уберу сам, даже если генератор схалтурит.

### Декор

```
Pixel art sprite sheet, 4 columns by 2 rows, eight equal cells, in the same pixel style as the reference image. Row 1: wall torch with flame; the same torch with the flame in a second animation frame; hanging iron lantern with a glowing candle; small pumpkin. Row 2: orange maple leaf; red maple leaf; yellow oak leaf; lit candle on a brass holder. Cozy autumn castle mood, warm amber light. Style: 16-bit RPG item sprites, crisp square pixels, 1-pixel near-black outline, flat colors, no gradients, no shadows. Background: solid flat magenta #ff00ff. No text, no frame, no grid lines. Each sprite centered in its cell.
```

## Если рисуешь руками

Сетка 32 на 32 пикселя на позу (лист 64 на 64), обводка `#171717` в один пиксель, фон прозрачный. Цвета сайта: оранжевый `#ff6f1e`, синий `#3b82f6`, розовый `#ff66cf`, зеленый `#22c55e`, дым `#bebcbb`, бумага `#fdfbf9`.
