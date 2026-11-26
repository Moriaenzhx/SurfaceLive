import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, readdir, realpath, rename, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright-core';

const project = fileURLToPath(new URL('../../', import.meta.url));
const executablePath = process.env.SURFACELIVE_TEST_APP || join(project, 'dist/SurfaceLive-darwin-arm64/SurfaceLive.app/Contents/MacOS/SurfaceLive');
const sandbox = await mkdtemp(join(await realpath(tmpdir()), 'surfacelive-storage-'));
const profile = join(sandbox, 'profile');
const original = join(profile, 'revisions');
const destination = join(sandbox, '作品 新位置');
const exported = join(sandbox, 'export');
await Promise.all([mkdir(destination), mkdir(exported)]);
const errors = [];
let app, page;

async function launch() {
  app = await electron.launch({executablePath, args:['--workbench-acceptance', '--user-data-dir='+profile]});
  page = await app.firstWindow();
  page.setDefaultTimeout(9000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setContentSize(1555, 992));
  await page.getByRole('tab', {selected:true}).waitFor();
  await app.evaluate(({shell}) => {
    globalThis.openedFolders = [];
    shell.openPath = async folder => { globalThis.openedFolders.push(folder); return ''; };
  });
}
async function settings() {
  await page.click('#settings');
  await page.locator('#settings-dialog[open]').waitFor();
  await page.waitForFunction(() => document.getElementById('storage-root').textContent.length > 0);
}
async function pickDirectory(folder, trigger = '#change-storage') {
  await app.evaluate(({dialog}, folder) => {
    dialog.showOpenDialog = async () => ({canceled:!folder, filePaths:folder ? [folder] : []});
  }, folder);
  await page.click(trigger);
}
async function expectOpened(trigger, folder) {
  await page.click(trigger);
  const paths = await app.evaluate(() => globalThis.openedFolders);
  assert.equal(paths.at(-1), folder);
}
const info = id => page.evaluate(id => window.studio.storageInfo(id), id);
const saveStyle = (base, radius) => page.evaluate(({base, radius}) => window.studio.saveEdit({
  base, edits:[{selector:'[data-testid="primary-action"]', values:{'border-radius':radius}}]
}), {base, radius});

try {
  await launch();
  await settings();
  assert.equal(await page.textContent('#storage-root'), original);
  const space = (await info('sample')).availableBytes;
  assert(Number.isFinite(space) && space >= 0);
  assert.match(await page.textContent('#disk-free'), /所在磁盘可用/);
  assert.match(await page.textContent('#source-description'), /应用内置示例/);
  await expectOpened('#open-storage-source', (await info('sample')).current.folder);
  await expectOpened('#open-storage-root', original);
  await page.fill('#settings-search', '源码');
  assert.equal(await page.textContent('#settings-heading'), '搜索结果');
  assert(await page.locator('#open-storage-source').isVisible());
  assert(!await page.locator('#theme-label').isVisible());
  await page.fill('#settings-search', 'no_such_setting');
  assert(await page.locator('#settings-no-results').isVisible());
  await page.click('[data-settings-page="agents"]');
  const agents = await page.evaluate(async () => (await window.studio.state()).agents);
  assert.equal(await page.textContent('#settings-codex'), agents.codex ? '已检测到本机 CLI' : '未检测到本机 CLI');
  await page.click('#settings-refresh');
  await page.getByText('检测完成。', {exact:true}).waitFor();
  await page.click('[data-settings-page="keys"]');
  assert(await page.locator('#send-shortcut').isVisible());
  await page.click('[data-settings-page="general"]');
  await page.locator('input[name=theme][value=system]').check();
  await page.emulateMedia({colorScheme:'dark'});
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.emulateMedia({colorScheme:'light'});
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.keyboard.press('Escape');
  assert(await page.locator('#settings').evaluate(el => el === document.activeElement));
  await page.click('#new');
  await settings();
  assert(await page.locator('#open-storage-source').isDisabled());
  assert.match(await page.textContent('#source-description'), /草稿/);
  await page.click('#close-settings');

  // This version exists on disk before the user selects a new project directory.
  const first = await saveStyle('sample', 7);
  const firstFolder = join(original, first);
  const oldStyles = await readFile(join(firstFolder, 'styles.css'));
  await settings();
  assert.equal(await page.textContent('#storage-source'), firstFolder);
  await pickDirectory(null);
  assert.equal((await info(first)).root, original);
  await pickDirectory(firstFolder);
  await page.locator('#storage-feedback[data-kind="error"]').waitFor();
  assert.equal(await page.textContent('#storage-feedback'), '这里是某个版本的源码目录，请选择用于存放作品的文件夹');
  assert.equal((await info(first)).root, original);
  await pickDirectory((await info('sample')).current.folder);
  await page.getByText('请选择应用资源目录以外的文件夹', {exact:true}).waitFor();
  await pickDirectory(destination);
  await page.waitForFunction(path => document.getElementById('storage-root').textContent === path, destination);
  assert.equal(await page.textContent('#storage-source'), firstFolder);
  await page.click('#previous-locations summary');
  await expectOpened('#previous-folders button', original);
  await page.keyboard.press('Escape');
  const second = await saveStyle(first, 11);
  const secondFolder = join(destination, second);
  const metadata = JSON.parse(await readFile(join(secondFolder, 'revision.json'), 'utf8'));
  assert.equal(metadata.parent, first);
  assert.deepEqual(await readFile(join(firstFolder, 'styles.css')), oldStyles);
  assert.match(await readFile(join(secondFolder, 'styles.css'), 'utf8'), /border-radius: 11px/);
  await app.close(); app = null;
  await launch();
  assert.equal((await info(second)).root, destination);
  assert.equal((await info(first)).current.folder, firstFolder);
  await settings();
  assert.equal(await page.textContent('#storage-source'), secondFolder);
  await expectOpened('#open-storage-source', secondFolder);
  await page.keyboard.press('Escape');
  await page.click('#history-menu');
  await page.locator('#versions button').filter({hasText:'版本 1'}).click();
  await page.frameLocator('#preview').getByTestId('primary-action').waitFor();
  await page.click('#history-menu');
  await expectOpened('#open-version-folder', firstFolder);
  await pickDirectory(exported, '#export');
  await page.getByRole('status').filter({hasText:'源码已导出到'}).first().waitFor();
  const [exportFolder] = await readdir(exported);
  for (const name of ['index.html','styles.css','app.js']) {
    assert.deepEqual(await readFile(join(exported, exportFolder, name)), await readFile(join(firstFolder, name)));
  }

  // A disconnected destination must not silently send a new version to the old location.
  await rename(destination, destination+'-offline');
  await assert.rejects(saveStyle(first, 15), /保存位置不可写/);
  assert.equal((await info(first)).availableBytes, null);
  // Completed attempts move from the private staging directory into their revision.
  assert.deepEqual((await readdir(original)).sort(), ['.design-traces',first].sort());
  assert.deepEqual(await readdir(join(original,'.design-traces')), []);
  await app.close(); app = null;
  await launch();
  assert(!(await page.evaluate(() => window.studio.state())).revisions.some(r => r.id === second));
  await rename(destination+'-offline', destination);
  await settings();
  assert.equal((await info(second)).current.folder, secondFolder);
  assert.deepEqual(errors, []);
  console.log('Passed settings search, agent status, theme, draft, source locations, chooser cancel, cross-root saves, restart, history, export, disconnection and reconnection.');
} finally {
  if (app) await app.close();
  await rm(sandbox, {recursive:true, force:true});
}
