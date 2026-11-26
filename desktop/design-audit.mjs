// Optional local index. Keep free text, attachments, samples and provider output out of this file.
import {createHash, randomUUID} from 'node:crypto';
import {rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {principles, preferences, visualExemplars} from '../live-engine/knowledge/src/live-knowledge.ts';
import {indexed} from '../live-engine/ingestion/retrieval.ts';

const digest = text => createHash('sha256').update(text).digest('hex');
export class DesignAudit {
  constructor(token, request) {
    this.data = {run_id:token, requestSha256:digest(request), query:null, candidates:null, calls:[]};
    this.privateIds = new Map();
  }
  retrieval(query, tags, knowledge) {
    const groups = [
      [principles, knowledge.rules, 'seed-rule', 'below-diversified-limit'],
      [preferences, knowledge.preferences, 'bundled-preference', 'scene-filter'],
      [visualExemplars, knowledge.exemplars, 'visual-seed', 'scene-or-inspection-filter']
    ];
    const rows = [];
    for (const [pool, hits, kind, reason] of groups) {
      for (const item of pool) {
        const hit = hits.find(h => h.id === item.id);
        rows.push({id:item.id, kind, source:item.sources ?? item.sourceUrl ?? item.origin,
          review:item.status ?? 'not-recorded', score:hit?.score ?? null, excluded:hit ? null : reason});
      }
    }
    for (const entry of indexed()) {
      for (const card of entry.cards) {
        const hit = knowledge.reviewedCards.find(c => c.id === card.id);
        const analogy = knowledge.analogies?.some(c => c.id === card.id);
        rows.push({id:card.id, kind:card.kind, source:entry.source.id, review:'indexed-reviewed',
          versionHash:card.versionHash, ranking:analogy?'orientation + indexed order':'term overlap; kind quota; ID tie-break', analogy:Boolean(analogy),
          excluded:hit || analogy ? null : tags.some(t => card.sceneTags.includes(t)) ? 'kind-quota' : 'outside-tag-and-analogy-selection'});
      }
    }
    for (const item of knowledge.confirmedPreferences ?? []) {
      const id = digest(item.id);
      this.privateIds.set(id,item.id);
      rows.push({id, kind:'confirmed-preference', source:'local-scope-match', review:'human-confirmed', excluded:null});
    }
    this.data.query = {sha256:digest(query), tags, privateText:'scene brief (parent description + current change on revision)'};
    this.data.candidates = rows;
  }
  invocation(call,prompt) {
    // Match only delimited IDs, not ID prefixes. Keep offsets to check against the exact private prompt.
    const present = [];
    for (const row of this.data.candidates ?? []) {
      if (row.excluded) continue;
      const id = this.privateIds.get(row.id) ?? row.id;
      const tags = ['['+id+' /', '['+id+']', JSON.stringify(id)];
      const offsets = tags.map(t => prompt.indexOf(t)).filter(i => i >= 0);
      if (offsets.length) present.push({id:row.id,offsetUTF16:Math.min(...offsets)});
    }
    const visibleIds = new Set(present.map(entry=>entry.id));
    const absent = (this.data.candidates ?? []).filter(row=>!row.excluded&&!visibleIds.has(row.id));
    const excludedAfterRetrieval = absent.map(row=>({
      id:row.id,
      reason:['source','alternative'].includes(call.operation)&&(row.analogy||row.kind==='confirmed-preference')
        ? 'not-in-chosen-direction-context' : 'id-not-present-in-this-stage'
    }));
    this.data.calls.push({operation:call.operation, promptSha256:call.promptSha256, present, excludedAfterRetrieval,
      outcome:call.outcome, sessionId:call.sessionId, elapsedMs:call.elapsedMs,
      reportedModels:call.reportedModels, totalTokens:call.totalTokens, costUsd:call.costUsd, usage:call.usage,exitCode:call.exitCode});
  }
  async save(folder,state) {
    const record = {...this.data, stage:state.stage, target:state.target, parent:state.parent,
      request:'design-trace.json#/request', scene:state.scene?'design-trace.json#/scene':null,
      direction:state.artDirection.status, strategy:state.artDirection.selectedId?'design-trace.json#/artDirection/selectedId':null,
      output:state.code?.revision??null, browser:state.browser.map(c=>({device:c.device,pass:c.functionalPass,shot:c.screenshot?.file})),
      verification:state.visualReview.status, repair:state.automaticRepair.status, elapsedMs:state.elapsedMs??null,
      feedback:state.parent?'design-trace.json#/edits':null};
    const temp=join(folder,'.audit-'+randomUUID());
    await writeFile(temp,JSON.stringify(record,null,2)+'\n',{mode:0o600});
    await rename(temp,join(folder,'design-audit.json'));
  }
}
