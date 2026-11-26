// A project has one workspace tab. Each unsent new project has its own draft key.
const tabsKey = 'workbench-project-tabs';
let projectEntries = [];
let activeEntry = null;
let draftNumber = 0;
let renderedTabs = '';

function persistTabs() {
  localStorage.setItem(tabsKey, JSON.stringify({entries:projectEntries, active:activeEntry?.key ?? null, draftNumber}));
}
function revisionEntry(revision) {
  let entry = projectEntries.find(item => item.key === revision.project);
  if (!entry) {
    entry = {key:revision.project, revision:revision.id, open:false};
    projectEntries.push(entry);
  }
  return entry;
}
function titleOf(entry) {
  if (entry.revision) return data.revisions.find(r => r.id === entry.revision)?.title || '作品';
  return entry.number > 1 ? '新作品 ' + entry.number : '新作品';
}
function createDraftEntry() {
  const number = ++draftNumber;
  const entry = {key:number === 1 ? 'new' : 'draft-' + number, number, revision:null, open:true};
  projectEntries.push(entry);
  return entry;
}
function rememberViewport() {
  if (!activeEntry?.revision) return;
  Object.assign(activeEntry, {view, zoom});
  persistTabs();
}
function activateEntry(entry) {
  activeEntry = entry;
  if (entry) entry.open = true;
  persistTabs();
  loadVersion(entry?.revision ?? null);
}
function selectVersion(id) {
  const revision = data.revisions.find(r => r.id === id);
  if (!revision) return;
  const entry = revisionEntry(revision);
  entry.revision = id;
  activateEntry(entry);
}
function newProjectTab() {
  if (data.job || submitting) return;
  activateEntry(createDraftEntry());
  selectTab('compose');
  focusComposer();
}
function draftHasContent(entry) {
  const draft = readLocal('draft:' + entry.key, {});
  return !!(draft.text || (draft.target && draft.target !== 'auto') || entry.hasReferences);
}
function forgetEntry(entry) {
  projectEntries.splice(projectEntries.indexOf(entry), 1);
}
function focusCurrentTab() {
  ($('project-tabs').querySelector('[aria-selected="true"]') || $('new')).focus();
}
function closeProjectTab(entry) {
  if (data.job || submitting) return;
  const opened = projectEntries.filter(item => item.open);
  const index = opened.indexOf(entry);
  entry.open = false;
  if (!entry.revision && !draftHasContent(entry)) forgetEntry(entry);
  if (entry === activeEntry) activateEntry(opened[index + 1] || opened[index - 1] || null);
  else { releaseClosedPreviews(); persistTabs(); render(); }
  focusCurrentTab();
}
function openFromLibrary(entry) {
  if (activeEntry && !activeEntry.revision && !draftHasContent(activeEntry)) forgetEntry(activeEntry);
  activateEntry(entry);
  focusCurrentTab();
}
function tabKeydown(event, entry) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Delete') { event.preventDefault(); closeProjectTab(entry); return; }
  const opened = projectEntries.filter(item => item.open);
  const i = opened.indexOf(entry);
  const destinations = {Home:0, End:opened.length-1, ArrowLeft:(i+opened.length-1)%opened.length, ArrowRight:(i+1)%opened.length};
  if (!Object.hasOwn(destinations, event.key)) return;
  event.preventDefault();
  const next = opened[destinations[event.key]];
  if (next !== activeEntry) activateEntry(next);
  focusCurrentTab();
}
function renderProjectTabs() {
  const opened = projectEntries.filter(item => item.open);
  const busy = !!data.job || submitting;
  const signature = JSON.stringify([activeEntry?.key,busy,opened.map(e => [e.key,titleOf(e),!!e.revision])]);
  if (signature !== renderedTabs) {
    renderedTabs = signature;
    const host = $('project-tabs');
    const inside = host.contains(document.activeElement);
    host.replaceChildren();
    for (const entry of opened) {
      const title = titleOf(entry), active = entry === activeEntry;
      const wrap = element('div', null, 'project-tab');
      wrap.setAttribute('role','presentation');
      const button = element('button');
      button.id = 'tab-' + entry.key;
      button.setAttribute('role','tab');
      button.setAttribute('aria-controls','project-workspace');
      button.setAttribute('aria-keyshortcuts','Delete');
      button.setAttribute('aria-selected',String(active));
      button.tabIndex = active ? 0 : -1;
      button.disabled = busy;
      button.title = title;
      button.append(icon(entry.revision ? 'layout' : 'file'), element('span',title));
      button.onclick = () => { if (entry !== activeEntry) activateEntry(entry); focusCurrentTab(); };
      button.onkeydown = event => tabKeydown(event,entry);
      const close = element('button',null,'tab-close');
      close.disabled = busy;
      close.tabIndex = active ? 0 : -1;
      close.setAttribute('aria-label','关闭标签 · ' + title);
      close.title = '关闭标签';
      close.append(icon('close'));
      close.onclick = () => closeProjectTab(entry);
      wrap.append(button,close); host.append(wrap);
    }
    if (activeEntry) $('project-workspace').setAttribute('aria-labelledby','tab-' + activeEntry.key);
    else $('project-workspace').removeAttribute('aria-labelledby');
    host.querySelector('[aria-selected="true"]')?.parentElement.scrollIntoView({block:'nearest',inline:'nearest'});
    if (inside && !busy) focusCurrentTab();
  }
  const list = $('projects');
  list.replaceChildren();
  if (!current()) {
    const candidates = [...new Set(data.revisions.map(revisionEntry))];
    candidates.push(...projectEntries.filter(e => !e.open && !e.revision && draftHasContent(e)));
    for (const entry of candidates) {
      const button = element('button',null,'project');
      button.disabled = busy;
      button.append(icon(entry.revision ? 'layout' : 'file'),element('span',titleOf(entry)));
      button.title = titleOf(entry);
      button.onclick = () => openFromLibrary(entry);
      list.append(button);
    }
  }
  $('project-library').hidden = !list.childElementCount;
}
async function restoreProjectTabs() {
  const saved = readLocal(tabsKey, null);
  if (Array.isArray(saved?.entries)) {
    const seen = new Set();
    for (const entry of saved.entries) {
      if (!entry || typeof entry.key !== 'string' || seen.has(entry.key)) continue;
      if (entry.revision) {
        const revision = data.revisions.find(r => r.id === entry.revision && r.project === entry.key)
          || data.revisions.find(r => r.project === entry.key);
        if (!revision) continue;
        entry.revision = revision.id;
      } else if (!Number.isSafeInteger(entry.number) || entry.number < 1) continue;
      seen.add(entry.key); projectEntries.push(entry);
    }
    draftNumber = Math.max(Number(saved.draftNumber) || 0, ...projectEntries.map(e => e.number || 0));
    activateEntry(projectEntries.find(e => e.key === saved.active && e.open) || projectEntries.find(e => e.open) || null);
    return;
  }
  // Carry the previous single-project selection and its draft/attachments into the first tab session.
  for (const revision of data.revisions) revisionEntry(revision).open = true;
  const previous = localStorage.getItem('selection');
  const revision = data.revisions.find(r => r.id === previous);
  const refs = await referenceStore('get','references:new').catch(() => []);
  let draft;
  if (previous === '' || !projectEntries.length || localStorage.getItem('draft:new') || refs?.length) {
    draft = createDraftEntry();
    draft.hasReferences = !!refs?.length;
    draft.open = previous === '' || !data.revisions.length;
  }
  if (revision) selectVersion(revision.id);
  else activateEntry(draft?.open ? draft : projectEntries[0]);
}
