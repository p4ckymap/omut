import { expect, test } from '@playwright/test';

test('mobile engine diagnostic runs real matches, repeats deterministically, and validates input',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/engine.html');
  await expect(page).toHaveTitle('ОМУТ — этап 1: проверка движка');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Проверка пройдена.');
  await expect(page.locator('#games li')).toHaveCount(10);
  const first=await page.locator('#games').textContent();
  await page.locator('#run').click();await expect(page.locator('#status')).toHaveText('Проверка пройдена.');
  expect(await page.locator('#games').textContent()).toBe(first);
  await page.locator('#seed').fill('-1');await page.locator('#run').click();
  await expect(page.locator('#status')).toContainText('Введи целый номер');
  await page.locator('#seed').fill('100');await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Проверка пройдена.');
  expect(await page.locator('#games').textContent()).not.toBe(first);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.screenshot({path:'output/stage1/engine-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});
