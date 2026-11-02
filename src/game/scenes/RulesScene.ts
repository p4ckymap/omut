import Phaser from 'phaser';
import { C, H, icon, overlays, setupCamera, text, W } from '../core';
import { backdrop } from '../ui/backdrop';
import { Button, iconButton } from '../ui/Button';
import { Scroller } from '../ui/Scroller';

const SECTIONS: { title: string; body?: string; items?: [string, string, string][] }[] = [
  { title: 'Цель', body: 'Сведи жизни Бота к нулю. У каждого 25 жизней (меняется в настройках). Колода одна на двоих, сыгранные и погибшие карты уходят в сброс.' },
  { title: 'Стол', body: 'Жребий-монета решает, кто ходит первым; руки раздаются сразу. Из шести миров на партию выпадают четыре, название и значок мира — на его рамке. Твой мир стоит напротив мира Бота. В каждом мире два места — до восьми существ на столе.',
    items: [['sun', 'Явь', 'родной класс Люди'], ['skull', 'Навь', 'родной класс Нежить'], ['eye', 'Чаща', 'родной класс Нечисть'],
      ['tentacle', 'Пучина', 'родной класс Чудища'], ['flame', 'Пекло', 'родной класс Бесы'], ['swirl', 'Омут', 'родного класса нет']] },
  { title: 'Кого можно поставить', body: 'Одна карта может стоять в любом мире. Пара в мире — только если хотя бы одна из карт родного класса этого мира. Например, в Яви: Люди + Нежить можно, Люди + Люди можно, Нежить + Бесы нельзя. В Омуте пара — только одного класса. Значок класса на карте совпадает со значком его родного мира. Существо в родном мире бьёт на 1 сильнее, пока стоит там — значок класса на фишке тогда в золотом кольце.' },
  { title: 'Ход', body: 'В начале хода берёшь карту и получаешь монеты: ходы 1–2 по 2, 3–4 по 3, 5–6 по 4, дальше по 5. Копилка — до 10. Дальше в любом порядке: ставь существ (до конца хода их можно переставлять), играй чары, усиливай, сжигай лишние карты. Против бота время на ход не ограничено.' },
  { title: 'Бой', body: 'Существа бьют сами, когда хозяин заканчивает ход. Каждое бьёт того, кто стоит напротив; если там карта с Приоритетом — её. Пустой мир напротив — удар в жизни соперника. Только что поставленное существо ждёт следующего хода (кроме Рывка). Пунктирные стрелки показывают, кто кого ударит.' },
  { title: 'Предсмертный удар', body: 'Погибая от удара существа, карта в последний миг бьёт убийцу на свою атаку. Цепочки нет. Удара нет при смерти от чар, Яда, Пожирания и от выстрела с Дальнобоем.' },
  { title: 'Монеты', body: 'За каждое убитое существо платят награду (0–5 монет, указана на обороте карты). Усиление (на картах — «Закалка»): 2 монеты — +1 к атаке навсегда, раз за ход на существо, до трёх раз. Сжечь карту: +1 монета, до двух за ход.' },
  { title: 'Умения', items: [
    ['shield', 'Приоритет', 'Пока карта стоит, враг в мире напротив бьёт только её.'],
    ['arrow', 'Дальнобой', 'Стреляет в любой мир: выбирает врага, которого добьёт. Не получает предсмертный удар.'],
    ['bolt', 'Рывок', 'Бьёт уже в конце того хода, когда её поставили.'],
    ['shield', 'Щит N', 'Каждый удар по карте слабее на N.'],
    ['steadfast', 'Стойкость', 'Первый смертельный удар оставляет её с 1 ХП.'],
    ['greed', 'Жадность N', 'В начале твоего хода приносит N монет.'],
    ['blood', 'Кровь N', 'После атаки забирает N жизней соперника себе.'],
    ['poison', 'Яд N', 'Цель удара теряет N ХП в начале каждого своего хода.'],
    ['healer', 'Лекарь N', 'В начале хода лечит соседа по миру на N ХП.'],
    ['ram', 'Таран', 'Лишний урон после смерти цели уходит в жизни соперника.'],
    ['devour', 'Пожирает', 'Цель с 3 ХП или меньше съедается целиком, без ответа.'],
    ['surface', 'Всплытие', 'Срабатывает, когда карта выходит на поле. Жаба Бабы-Яги остаётся на месте превращённой карты, даже если пара так не собралась бы.'],
    ['deathstrike', 'Предсмертный удар', 'Есть у всех существ.'],
  ] },
  { title: 'Управление', items: [
    ['deck', 'Поставить карту', 'Перетащи из руки в подсвеченное место. Или коснись карты, потом места.'],
    ['rune', 'Чары', 'Перетащи на цель в подсветке. Чары без цели — на поле или кнопка «Сыграть».'],
    ['move', 'Переставить', 'Пока ход не закончен, только что поставленных существ можно переставлять куда угодно. После «Конца хода» они закрепляются.'],
    ['flame', 'Сжечь', 'Пока тащишь карту, внизу появляется зона «Сжечь карту» — брось туда, получишь монету.'],
    ['flip', 'Описание', 'Двойное касание или долгое нажатие на любую карту. Нажми на карту, чтобы перевернуть.'],
    ['hammer', 'Усилить', 'Коснись своего существа — под полем появится кнопка «Усилить». Она даёт +1 к атаке навсегда; рядом указана цена.'],
  ] },
  { title: 'Подсказки', body: 'Закрывай пустые миры: через них бьют прямо по жизням. Ставь сильных напротив слабых — смотри на стрелки. Когда колода опустеет, оба начнут терять по жизни каждый ход.' },
];

export class RulesScene extends Phaser.Scene {
  private from = 'Menu';
  private leaving = false;
  constructor() { super('Rules'); }

  create(data: { from?: string }) {
    this.from = data?.from ?? 'Menu';
    this.leaving = false;
    setupCamera(this);
    backdrop(this);
    const close = overlays.push(() => this.back());
    iconButton(this, 18, 26, 'back', () => close()).setDepth(10).setName('rules-back');
    text(this, 78, 25, 'Как играть', { size: 36, font: 'display' }).setDepth(10);
    text(this, 78, 71, 'Славянские легенды. Твоя тактика.', { size: 13, color: C.accent }).setDepth(10);
    const footerY = this.from === 'Match' ? H - 16 : 754;
    const sc = new Scroller(this, 0, 116, W, footerY - 116);
    let y = 18;
    const add = (o: Phaser.GameObjects.GameObject & { height?: number }) => { sc.content.add(o); return o; };
    for (const s of SECTIONS) {
      add(text(this, 24, y, s.title, { size: 24, color: C.accent }));
      y += 34;
      if (s.body) {
        const t = add(text(this, 24, y, s.body, { size: 14, font: 'text', wrap: 342, line: 4 })) as Phaser.GameObjects.Text;
        y += t.height + 12;
      }
      for (const [ic, name, desc] of s.items ?? []) {
        add(icon(this, 32, y + 10, ic, 20));
        const n = add(text(this, 50, y, name, { size: 15, font: 'text', bold: true, color: C.accent })) as Phaser.GameObjects.Text;
        const d = add(text(this, 50, y + n.height + 1, desc, { size: 14, font: 'text', wrap: 316, line: 3 })) as Phaser.GameObjects.Text;
        y += n.height + d.height + 12;
      }
      const line = this.add.rectangle(24, y + 6, 342, 1, C.line).setOrigin(0, 0.5); add(line);
      y += 24;
    }
    sc.height = y + 12;
    // A fixed footer keeps the tutorial discoverable, but never offers to abandon a running match.
    const footer = this.add.graphics().setDepth(9);
    footer.fillStyle(C.bg).fillRect(0, footerY, W, H - footerY);
    footer.fillStyle(C.line).fillRect(24, footerY, 342, 1);
    if (this.from !== 'Match') {
      new Button(this, 20, 772, 'Пройти обучение', () => this.startTutorial(close), { w: 350, h: 56, kind: 'main', size: 22, icon: 'book' })
        .setDepth(10).setName('rules-tutorial');
    }
  }

  private async startTutorial(close: () => Promise<void>) {
    if (this.leaving) return;
    this.leaving = true;
    await close();
    if (this.from === 'Match') this.scene.stop('Match');
    this.scene.start('Match', { tutorial: true });
  }

  private back() {
    if (this.leaving) return;
    if (this.from === 'Match') { this.scene.stop(); this.scene.resume('Match'); }
    else this.scene.start('Menu');
  }
}
