import Phaser from 'phaser';
import { card, WORLDS } from '../../engine/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { sound } from '../audio';
import { haptic } from '../../telegram';
import { C, ms, settings, text, tween, W, wait } from '../core';
import { CARD_H, CARD_W } from '../ui/HandCard';
import { burst, coinsFly, crumble, devour, floatText, ghostTrail, glowFlash, missile, ripple, shake, smoke, sparks, vignette, type Missile } from '../ui/fx';
import { TOKEN_H, TOKEN_W, Token } from '../ui/Token';
import { BANNER_Y, center, DECK_C, DISCARD_C, slotRect, WORLD_X, worldRect } from './geometry';
import type { MatchScene } from './MatchScene';

const SPELL_MISSILE: Record<string, Missile> = { fire: 'fire', istoch: 'heal', znamya: 'magic', poglot: 'void', lik: 'magic', krov: 'blood', koshel: 'magic' };
const deckPos = () => ({ ...DECK_C });
const discardPos = () => ({ ...DISCARD_C });
const who = (p: PlayerId) => (p === 0 ? 'Ты' : 'Бот');

export async function bigBanner(scene: Phaser.Scene, value: string, color: number = C.ink, sub?: string) {
  const root = scene.add.container(W / 2, 400).setDepth(3800);
  const band = scene.add.rectangle(0, 0, W, sub ? 88 : 64, 0x000000, 0.72);
  const t = text(scene, 0, sub ? -12 : 0, value, { size: 34, color, font: 'display' }).setOrigin(0.5);
  root.add([band, t]);
  if (sub) root.add(text(scene, 0, 22, sub, { size: 13, font: 'text', color: C.muted }).setOrigin(0.5));
  root.setScale(settings.reduceMotion ? 1 : 0.6).setAlpha(0);
  await tween(scene, { targets: root, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
  await wait(scene, sub ? 900 : 300);
  await tween(scene, { targets: root, alpha: 0, duration: 160, onComplete: () => root.destroy() });
}

async function countTo(scene: MatchScene, kind: 'hp' | 'coins', p: PlayerId, to: number) {
  const from = scene.shown[kind][p];
  if (from === to) return;
  const o = { v: from };
  const set = (v: number) => (kind === 'hp' ? scene.setHp(p, v) : scene.setCoins(p, v));
  const label = kind === 'hp' ? scene.hpText[p] : scene.coinText[p];
  if (!settings.reduceMotion) scene.tweens.add({ targets: label, scale: 1.25, duration: ms(90), yoyo: true });
  await tween(scene, { targets: o, v: to, duration: Math.min(400, 60 * Math.abs(to - from) + 80), onUpdate: () => set(Math.round(o.v)) });
  set(to);
}

export async function playEvent(scene: MatchScene, e: GameEvent): Promise<void> {
  switch (e.type) {
    case 'TurnStarted': {
      sound.turn();
      scene.setBanner(e.player === 0 ? 'Твой ход' : 'Ход Бота');
      // Freshly placed creatures stop waiting when a new turn starts.
      for (const t of scene.tokens.values()) t.setWaiting(false);
      await bigBanner(scene, e.player === 0 ? 'Твой ход' : 'Ход Бота', e.player === 0 ? C.gold : C.ink);
      return;
    }
    case 'CardDrawn': {
      sound.card();
      if (e.player === 0) {
        if (scene.handViews.some(v => v.uid === e.card.uid)) return;
        const v = scene.addHandView(e.card, true);
        if (e.overflow) {
          scene.handViews.splice(scene.handViews.indexOf(v), 1);
          v.setDepth(800);
          await tween(scene, { targets: v, x: W / 2, y: 430, scale: 1, duration: 300, ease: 'Cubic.Out' });
          scene.setBanner('Рука полна: карта ушла на Дно.', 'deny');
          await wait(scene, 350);
          await tween(scene, { targets: v, ...discardPos(), scale: 0.3, alpha: 0.4, duration: 260, onComplete: () => v.destroy() });
          scene.syncPiles();
          return;
        }
        scene.layoutHand(true);
        await wait(scene, 300);
      } else {
        if (e.overflow) {
          const b = scene.add.image(deckPos().x, deckPos().y, 'back').setDisplaySize(32, 48).setDepth(800);
          await tween(scene, { targets: b, ...discardPos(), duration: 300, onComplete: () => b.destroy() });
          scene.syncPiles();
          return;
        }
        scene.addBotBack(true);
        scene.layoutBotHand(true);
        await wait(scene, 300);
      }
      scene.deckText.setText(String(Math.max(0, Number(scene.deckText.text) - 1)));
      return;
    }
    case 'CoinsChanged': {
      if (e.delta === 0) return;
      if (e.reason === 'reward' && e.delta > 0) {
        sound.coin();
        await coinsFly(scene, scene.lastDeath, scene.coinPos(e.player), e.delta);
        floatText(scene, scene.coinPos(e.player).x + 40, scene.coinPos(e.player).y, `+${e.delta}`, C.gold, 16);
        await countTo(scene, 'coins', e.player, e.coins);
        return;
      }
      if (e.delta > 0) {
        if (e.reason !== 'income') sound.coin();
        floatText(scene, scene.coinPos(e.player).x + 40, scene.coinPos(e.player).y + (e.player === 0 ? -16 : 16), `+${e.delta}`, C.gold, 16);
        if (e.reason === 'greed') {
          const greedy = [...scene.tokens.values()].filter(t => card(t.cardId).abilities.greed && scene.state.players[e.player].board.some(u => u?.uid === t.uid));
          for (const t of greedy) sparks(scene, t.cx, t.cy, C.gold, 10);
        }
      } else floatText(scene, scene.coinPos(e.player).x + 40, scene.coinPos(e.player).y + (e.player === 0 ? -16 : 16), `${e.delta}`, C.muted, 16);
      await countTo(scene, 'coins', e.player, e.coins);
      return;
    }
    case 'CardPlayed': {
      const r = slotRect(e.player, e.slot);
      const fromHand = e.player === 0 ? scene.handViews.find(v => v.uid === e.unit.uid) : undefined;
      const fromBot = e.player === 1 && scene.prev.players[1].hand.some(h => h.uid === e.unit.uid);
      sound.play();
      if (fromHand) {
        scene.handViews.splice(scene.handViews.indexOf(fromHand), 1);
        fromHand.setDepth(800);
        scene.layoutHand(true);
        await tween(scene, { targets: fromHand, x: r.x + TOKEN_W / 2, y: r.y + TOKEN_H / 2, angle: 0, scaleX: TOKEN_W / CARD_W, scaleY: TOKEN_H / CARD_H, duration: 220, ease: 'Back.Out' });
        fromHand.destroy();
      } else if (fromBot) {
        const idx = scene.prev.players[1].hand.findIndex(h => h.uid === e.unit.uid);
        const back = scene.botBacks.splice(Math.min(idx, scene.botBacks.length - 1), 1)[0];
        scene.layoutBotHand(true);
        if (back) {
          back.setDepth(800);
          await tween(scene, { targets: back, x: r.x + TOKEN_W / 2, y: r.y + TOKEN_H / 2, angle: 0, displayWidth: TOKEN_W * 0.9, displayHeight: TOKEN_H * 1.2, duration: 240, ease: 'Cubic.Out' });
          await tween(scene, { targets: back, scaleX: 0, duration: 80, onComplete: () => back.destroy() });
        }
      }
      const tok = new Token(scene, r.x, r.y, e.unit).setDepth(10);
      scene.tokens.set(e.unit.uid, tok);
      scene.lastPos.set(e.unit.uid, { x: tok.cx, y: tok.cy });
      tok.setWaiting(!card(e.unit.cardId).abilities.rush);
      if (!fromHand && !fromBot) {
        tok.setAlpha(0); tok.flash(0xffffff);
        await tween(scene, { targets: tok, alpha: 1, duration: 260 });
        sparks(scene, tok.cx, tok.cy, 0xece6d6, 20);
      } else if (fromBot) {
        const sx = tok.scaleX; tok.scaleX = 0;
        await tween(scene, { targets: tok, scaleX: sx, duration: 120, ease: 'Back.Out' });
      } else {
        tok.setScale(1.08);
        await tween(scene, { targets: tok, scale: 1, duration: 120, ease: 'Back.Out' });
      }
      tok.x = r.x; tok.y = r.y;
      const wid = scene.state.worlds[e.slot >> 1];
      ripple(scene, tok.cx, r.y + TOKEN_H - 2, Phaser.Display.Color.HexStringToColor(WORLDS[wid].color).color, 2, 70);
      burst(scene, tok.cx, r.y + TOKEN_H - 4, [0x8a8578, 0x5a5f64], 10, 50);
      if (e.player === 1) scene.setBanner(`Бот ставит «${card(e.unit.cardId).name}»`);
      return;
    }
    case 'SpellCast': {
      const def = card(e.card.cardId);
      let view: Phaser.GameObjects.Container | Phaser.GameObjects.Image | undefined;
      const mid = { x: W / 2, y: BANNER_Y + 4 };
      if (e.player === 0) {
        const hv = scene.handViews.find(v => v.uid === e.card.uid);
        if (hv) { scene.handViews.splice(scene.handViews.indexOf(hv), 1); view = hv; scene.layoutHand(true); }
      } else {
        const idx = scene.prev.players[1].hand.findIndex(h => h.uid === e.card.uid);
        const back = scene.botBacks.splice(Math.max(0, Math.min(idx, scene.botBacks.length - 1)), 1)[0];
        scene.layoutBotHand(true);
        const img = scene.add.image(back?.x ?? W / 2, back?.y ?? 87, `h:${def.id}`).setDisplaySize(32, 48);
        back?.destroy();
        view = img;
      }
      if (!view) return;
      view.setDepth(2200);
      scene.setBanner(`${who(e.player)}: чары «${def.name}»`, 'hint');
      sound.whoosh();
      const isImg = view instanceof Phaser.GameObjects.Image;
      await tween(scene, { targets: view, x: mid.x, y: mid.y, angle: 0, ...(isImg ? { displayWidth: CARD_W * 1.2, displayHeight: CARD_H * 1.2 } : { scale: 1.2 }), duration: 250, ease: 'Sine.InOut' });
      const color = Phaser.Display.Color.HexStringToColor(WORLDS[def.world].color).color;
      void glowFlash(scene, mid.x, mid.y, color, 220, 380);
      if (def.id === 'fire') sound.fire(); else sound.magic();
      await wait(scene, e.player === 1 ? 650 : 200);
      const fly = tween(scene, { targets: view, ...discardPos(), ...(isImg ? { displayWidth: 30, displayHeight: 46 } : { scale: 0.32 }), alpha: 0.6, duration: 260, onComplete: () => view!.destroy() });
      const caster = scene.avatarCenter(e.player), enemy = scene.avatarCenter(e.player === 0 ? 1 : 0);
      if (e.target) await missile(scene, mid, scene.tokenCenter(e.target), SPELL_MISSILE[def.id] ?? 'magic', 300);
      else if (def.id === 'krov') await missile(scene, enemy, caster, 'blood', 380);
      else if (def.id === 'koshel') { sparks(scene, scene.coinPos(e.player).x, scene.coinPos(e.player).y, C.gold, 16); }
      if (def.id === 'znamya' && e.target) { const t = scene.tokens.get(e.target); if (t) { sparks(scene, t.cx, t.cy, C.gold, 20); floatText(scene, t.cx, t.y + 10, 'Приоритет', C.gold, 16); } }
      if (def.id === 'poglot' && e.target) { const p = scene.tokenCenter(e.target); ripple(scene, p.x, p.y, 0x8fe0cf, 4, 100); }
      await fly;
      scene.syncPiles();
      return;
    }
    case 'AttackDeclared': {
      const a = scene.tokens.get(e.attacker);
      if (!a) return;
      const abil = card(a.cardId).abilities;
      // Hero strikes aim at the empty world opposite; the world is read from where the token stands.
      const world = Math.max(0, WORLD_X.findIndex(x => Math.abs(x + 6 - a.x) < 4));
      const target = e.target === 'hero' ? center(worldRect(e.player === 0 ? 1 : 0, world)) : scene.tokenCenter(e.target);
      a.setDepth(50);
      sound.whoosh();
      if (abil.ranged) {
        await tween(scene, { targets: a, y: a.y + (e.player === 0 ? 4 : -4), duration: 80, yoyo: true });
        await missile(scene, { x: a.cx, y: a.cy }, target, 'arrow', 220);
      } else {
        const x0 = a.x, y0 = a.y;
        const dx = (target.x - a.cx) * 0.6, dy = (target.y - a.cy) * 0.6;
        await tween(scene, { targets: a, x: x0 + dx * 0.15, y: y0 + dy * 0.15 + (e.player === 0 ? 6 : -6), scale: 1.06, duration: 90, ease: 'Sine.Out' });
        await tween(scene, { targets: a, x: x0 + dx, y: y0 + dy, angle: settings.reduceMotion ? 0 : (dx > 0 ? 5 : -5), duration: 140, ease: 'Quad.In' });
        if (abil.devour) a.flash(0xa35cff);
        scene.tweens.add({ targets: a, x: x0, y: y0, angle: 0, scale: 1, duration: ms(200), ease: 'Back.Out', onComplete: () => a.setDepth(10) });
      }
      return;
    }
    case 'DamageDealt': {
      const t = scene.tokens.get(e.target);
      if (!t) return;
      const color = e.cause === 'poison' ? C.heal : e.cause === 'spell' ? 0xff7a33 : 0xffffff;
      t.flash(color);
      t.setHp(e.hp, t.unit.maxHp);
      if (e.amount > 0) sound.hit();
      floatText(scene, t.cx, t.cy - 6, e.amount > 0 ? `−${e.amount}` : '0', e.amount > 0 ? (e.cause === 'poison' ? C.heal : C.blood) : C.muted, 24);
      if (e.cause === 'poison') burst(scene, t.cx, t.cy, [C.heal, 0x3f7a2a], 14, 60);
      else if (e.amount > 0) burst(scene, t.cx, t.cy, [0xffffff, C.blood], 12, 90);
      await shake(scene, t, 3, 240);
      t.x = Math.round(t.x);
      return;
    }
    case 'Healed': {
      if (e.amount <= 0) return;
      sound.heal();
      if (e.target === 'hero') {
        const a = scene.avatarCenter(e.player);
        sparks(scene, a.x, a.y, C.heal, 16);
        floatText(scene, a.x + 60, a.y, `+${e.amount}`, C.heal, 16);
        await countTo(scene, 'hp', e.player, e.hp);
        return;
      }
      const t = scene.tokens.get(e.target);
      if (!t) return;
      sparks(scene, t.cx, t.cy + 10, C.heal, 16);
      floatText(scene, t.cx, t.cy - 6, `+${e.amount}`, C.heal, 24);
      t.setHp(e.hp, t.unit.maxHp);
      await wait(scene, 300);
      return;
    }
    case 'StatusApplied': {
      const t = scene.tokens.get(e.target);
      if (!t) return;
      if (e.status === 'poison' && e.value > 0) {
        floatText(scene, t.cx, t.y + 12, `Яд ${e.value}`, C.heal, 16);
        burst(scene, t.cx, t.cy, [C.heal, 0x2f5f20], 12, 50);
      } else if (e.status === 'poison') {
        sparks(scene, t.cx, t.cy, 0x8fe0cf, 10);
      } else if (e.status === 'home') {
        if (e.value) { sparks(scene, t.cx, t.cy, C.gold, 16); floatText(scene, t.cx, t.y + 14, 'Родной мир: +1 к атаке', C.gold, 13); sound.upgrade(); }
        else floatText(scene, t.cx, t.y + 14, '−1 к атаке', C.muted, 13);
        const live = scene.state.players.flatMap(p => p.board).find(u => u?.uid === e.target);
        if (live) t.refresh(live);
        await wait(scene, 260);
        return;
      } else if (e.status === 'steadfast-used') {
        t.flash(0xffffff);
        floatText(scene, t.cx, t.y + 12, 'Стойкость!', C.ink, 16);
        sparks(scene, t.cx, t.cy, 0xece6d6, 18);
        await wait(scene, 350);
      }
      const loc = scene.state.players.flatMap(p => p.board).find(u => u?.uid === e.target);
      if (loc) t.refresh({ ...t.unit, poison: e.status === 'poison' ? e.value : t.unit.poison, steadfastUsed: t.unit.steadfastUsed || e.status === 'steadfast-used', temporaryPriority: e.status === 'temporary-priority' ? e.value === 1 : t.unit.temporaryPriority });
      await wait(scene, 120);
      return;
    }
    case 'CardDied': {
      const t = scene.tokens.get(e.unit.uid);
      const r = slotRect(e.player, e.slot);
      scene.lastDeath = { x: r.x + TOKEN_W / 2, y: r.y + TOKEN_H / 2 };
      scene.lastPos.set(e.unit.uid, scene.lastDeath);
      if (!t) return;
      scene.tokens.delete(e.unit.uid);
      t.setMode('idle'); t.disableInteractive();
      if (e.cause === 'devour') {
        sound.devour();
        scene.setBanner(`Кракен утаскивает «${card(e.unit.cardId).name}» на дно`, 'hint');
        await devour(scene, t, TOKEN_W, TOKEN_H);
        t.destroy();
        return;
      }
      if (e.cause === 'destroy') {
        sound.devour();
        ripple(scene, t.cx, t.cy, 0x8fe0cf, 4, 110);
        await tween(scene, { targets: t, angle: settings.reduceMotion ? 0 : 200, scale: 0.1, x: t.x + TOKEN_W / 2, y: t.y + TOKEN_H / 2, alpha: 0, duration: 500, ease: 'Cubic.In' });
        burst(scene, scene.lastDeath.x, scene.lastDeath.y, [0x8fe0cf, 0x0b2a27], 26, 120);
        t.destroy();
        return;
      }
      sound.death();
      t.flash(0x000000);
      scene.tweens.add({ targets: t, alpha: 0.6, duration: ms(120) });
      await wait(scene, 120);
      crumble(scene, t.x, t.y, TOKEN_W, TOKEN_H, t.texKey);
      await tween(scene, { targets: t, alpha: 0, y: t.y + 10, duration: 330, ease: 'Quad.In' });
      t.destroy();
      return;
    }
    case 'DeathStrike': {
      sound.deathstrike();
      const from = scene.tokenCenter(e.attacker), to = scene.tokenCenter(e.target);
      floatText(scene, from.x, from.y - 30, 'Предсмертный удар', C.wound, 16);
      await ghostTrail(scene, from, to);
      return;
    }
    case 'RewardPaid': {
      if (e.reward > 0 && e.received === 0) floatText(scene, scene.coinPos(e.player).x + 40, scene.coinPos(e.player).y, 'копилка полна', C.muted, 16);
      return;
    }
    case 'PlayerDamaged': {
      const a = scene.avatars[e.player];
      if (e.amount <= 0) return;
      sound.hero();
      const c = scene.avatarCenter(e.player);
      floatText(scene, c.x + 70, c.y, `−${e.amount}`, C.blood, 24);
      burst(scene, c.x, c.y, [C.blood, 0xffffff], 18, 120);
      if (e.player === 0) { vignette(scene); haptic('heavy'); if (!settings.reduceMotion) scene.cameras.main.shake(ms(220), 0.006); }
      if (e.cause === 'fatigue') scene.setBanner('Омут затягивает: −1 ♥', 'deny');
      await Promise.all([shake(scene, a, 4, 400), countTo(scene, 'hp', e.player, e.hp)]);
      return;
    }
    case 'Transformed': {
      const t = scene.tokens.get(e.before.uid);
      if (!t) return;
      sound.transform();
      scene.setBanner(`Баба-Яга превращает «${card(e.before.cardId).name}» в Жабу`, 'hint');
      smoke(scene, t.cx, t.cy, 0x7fc25a, 26);
      await tween(scene, { targets: t, scaleX: 0, duration: 160 });
      t.refresh(e.after);
      await tween(scene, { targets: t, scaleX: 1, duration: 200, ease: 'Back.Out' });
      return;
    }
    case 'Upgraded': {
      const t = scene.tokens.get(e.target);
      if (!t) return;
      sound.upgrade();
      sparks(scene, t.cx, t.cy, C.gold, 22);
      floatText(scene, t.cx, t.cy - 6, '+1 атака', C.gold, 20);
      t.refresh({ ...t.unit, attack: e.attack, upgrades: e.upgrades });
      if (!settings.reduceMotion) await tween(scene, { targets: t, y: t.y - 4, duration: 100, yoyo: true });
      else await wait(scene, 300);
      return;
    }
    case 'CardBurned': {
      sound.burn();
      let v: Phaser.GameObjects.Container | Phaser.GameObjects.Image | undefined;
      if (e.player === 0) {
        const hv = scene.handViews.find(x => x.uid === e.card.uid);
        if (hv) { scene.handViews.splice(scene.handViews.indexOf(hv), 1); scene.layoutHand(true); v = hv; }
      } else {
        const idx = scene.prev.players[1].hand.findIndex(h => h.uid === e.card.uid);
        const back = scene.botBacks.splice(Math.max(0, Math.min(idx, scene.botBacks.length - 1)), 1)[0]; scene.layoutBotHand(true);
        if (back) { v = scene.add.image(back.x, back.y, `h:${e.card.cardId}`).setDisplaySize(32, 48); back.destroy(); }
        scene.setBanner(`Бот сжигает «${card(e.card.cardId).name}»`);
      }
      if (!v) return;
      v.setDepth(2200);
      const isImg = v instanceof Phaser.GameObjects.Image;
      await tween(scene, { targets: v, x: W / 2, y: 470, angle: 0, ...(isImg ? { displayWidth: CARD_W, displayHeight: CARD_H } : { scale: 1 }), duration: 220 });
      const em = scene.add.particles(0, 0, 'px', { x: { min: W / 2 - 46, max: W / 2 + 46 }, y: { min: 400, max: 545 }, speedY: { min: -80, max: -30 },
        lifespan: ms(600), tint: [0xff7a33, 0xffd36b, 0xe2483c], scale: { start: 2, end: 0 }, blendMode: 'ADD', frequency: 8 }).setDepth(2300);
      await tween(scene, { targets: v, alpha: 0, ...(isImg ? {} : { scaleY: 0.9 }), duration: 380, onComplete: () => v!.destroy() });
      em.stop(); scene.time.delayedCall(ms(700), () => em.destroy());
      scene.syncPiles();
      return;
    }
    case 'DeckReshuffled': {
      scene.setBanner('Омут опустел: Дно перемешано в новую колоду.', 'hint');
      for (let i = 0; i < 6; i++) {
        const b = scene.add.image(discardPos().x, discardPos().y, 'back').setDisplaySize(30, 46).setDepth(2200);
        scene.tweens.add({ targets: b, ...deckPos(), angle: 360, delay: ms(i * 60), duration: ms(360), onComplete: () => b.destroy() });
      }
      await wait(scene, 700);
      scene.syncPiles();
      return;
    }
    case 'FatigueStarted': {
      await bigBanner(scene, 'Омут затягивает', C.wound, 'Каждый теряет 1 ♥ в начале своего хода');
      return;
    }
    case 'MulliganDone': return;
    case 'CombatStarted': {
      scene.setBanner(e.player === 0 ? 'Конец хода — твои существа бьют' : 'Конец хода Бота — его существа бьют', 'hint');
      await wait(scene, 150);
      return;
    }
    case 'Moved': {
      const t = scene.tokens.get(e.unit);
      if (!t) return;
      const r = slotRect(e.player, e.to);
      sound.card();
      t.setDepth(50);
      await tween(scene, { targets: t, x: r.x, y: r.y, scale: 1, duration: 200, ease: 'Cubic.Out', onComplete: () => t.setDepth(10) });
      scene.lastPos.set(e.unit, { x: r.x + TOKEN_W / 2, y: r.y + TOKEN_H / 2 });
      return;
    }
    case 'GameOver': {
      scene.setBanner(e.winner === 0 ? 'Победа!' : 'Поражение', 'hint');
      await wait(scene, 300);
      return;
    }
    case 'ActionRejected': scene.deny(e.reason); return;
  }
}
