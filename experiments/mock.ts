import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** A deterministic TEST FIXTURE. It does NOT simulate good design or model inference. */
export async function writeMockOutput(cwd:string, variant:string): Promise<void> {
  await writeFile(join(cwd,'index.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TEST FIXTURE ${variant}</title><link rel="stylesheet" href="styles.css"></head><body><main><h1>MOCK ${variant}，仅测试链路</h1><p>不代表真实设计或审美能力</p><button data-testid="primary-action">Test action</button><p data-testid="action-feedback" aria-live="polite">未操作</p></main><script src="app.js"></script></body></html>`);
  await writeFile(join(cwd,'styles.css'), 'body{font-family:system-ui;margin:24px}button{padding:14px}@media(max-width:600px){body{margin:12px}}');
  await writeFile(join(cwd,'app.js'), 'document.querySelector("[data-testid=primary-action]").addEventListener("click",()=>{document.querySelector("[data-testid=action-feedback]").textContent="已执行"})');
}
