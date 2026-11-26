export async function openProject(page, name) {
  const tab = page.getByRole('tab').filter({hasText:name}).first();
  if (await tab.count()) { await tab.click(); return; }
  // Historical packaged clients used by the before/after density check.
  if (await page.locator('#project-menu').count()) await page.click('#project-menu');
  else await page.click('#new');
  await page.locator('.project').filter({hasText:name}).first().click();
}

export async function toggleFocusPreview(page) {
  if (!await page.locator('#focus').isVisible()) await page.click('#zoom');
  await page.click('#focus');
}
