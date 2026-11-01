import { simulateGame } from './engine/simulate';
import './engine-check.css';

const button = document.querySelector<HTMLButtonElement>('#run')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const status = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;
const games = document.querySelector<HTMLOListElement>('#games')!;
button.addEventListener('click', async () => {
  if (!seedInput.checkValidity() || seedInput.value.trim() === '') { status.textContent = 'Введи целый номер от 0 до 999999.'; seedInput.focus(); return; }
  const seed = Number(seedInput.value), rows: ReturnType<typeof simulateGame>[] = [];
  button.disabled = true; seedInput.disabled = true; results.hidden = true;
  games.replaceChildren();
  try {
    for (let i = 0; i < 10; i++) {
      status.textContent = `Проверяем партию ${i + 1} из 10…`;
      await new Promise(resolve => setTimeout(resolve, 16));
      const r = simulateGame(seed + i); rows.push(r);
      const li = document.createElement('li');
      li.textContent = `Партия ${seed + i}: победил игрок ${r.winner + 1}. Ходы: ${r.personalTurns.join(' / ')}. Действий: ${r.actions}.`;
      games.append(li);
    }
    const mean = rows.reduce((sum, r) => sum + r.meanPersonalTurns, 0) / rows.length;
    document.querySelector('#summary')!.textContent = `10 партий завершены без ошибок. В среднем ${mean.toFixed(2).replace('.', ',')} хода на игрока.`;
    results.hidden = false; status.textContent = 'Проверка пройдена.';
  } catch (error) {
    status.textContent = `Проверка остановилась: ${error instanceof Error ? error.message : String(error)}`;
  } finally { button.disabled = false; seedInput.disabled = false; }
});
