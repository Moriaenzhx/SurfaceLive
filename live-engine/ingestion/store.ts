import {isDeepStrictEqual} from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { readFileSync,writeFileSync } from 'node:fs';
import {createHash} from 'node:crypto';
import { canonical, checkCandidate, checkCards, ensure, type Candidate, type Capture, type Trace, hasText, type Card } from './schema.ts';

export type Stage='discovered'|'eligible'|'captured'|'distilled'|'reviewed'|'indexed';
export type Entry={source:Candidate;stage:Stage;capture?:Capture;cards?:Card[];review?:{by:string;at:string};error?:string};
const now=()=>new Date().toISOString();
export class Queue {
  db:DatabaseSync;
  constructor(path:string){
    mkdirSync(dirname(path),{recursive:true});
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, url TEXT UNIQUE, title TEXT UNIQUE, entry TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history(seq INTEGER PRIMARY KEY, id TEXT NOT NULL, at TEXT NOT NULL, entry TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS objects(id TEXT PRIMARY KEY,title TEXT UNIQUE,source TEXT NOT NULL,card TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS visual_digest ON objects(json_extract(card,'$.inspectedHash'))
        WHERE json_extract(card,'$.kind')='VisualExemplar';
      CREATE TABLE IF NOT EXISTS hosts(host TEXT PRIMARY KEY, next INTEGER NOT NULL);`);
  }
  transaction<T>(fn:()=>T):T{
    this.db.exec('BEGIN IMMEDIATE');
    try{const result=fn();this.db.exec('COMMIT');return result;}
    catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  all():Entry[]{return this.db.prepare('SELECT entry FROM sources ORDER BY id').all().map(r=>JSON.parse(String(r.entry)));}
  get(id:string):Entry{
    const row=this.db.prepare('SELECT entry FROM sources WHERE id=?').get(id);
    ensure(row,'Unknown source '+id);return JSON.parse(String(row.entry));
  }
  save(e:Entry){
    const s=e.source, json=JSON.stringify(e);
    this.db.prepare('INSERT INTO sources VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET url=excluded.url,title=excluded.title,entry=excluded.entry')
      .run(s.id,canonical(s.canonicalUrl),s.title.trim().toLowerCase(),json);
    this.db.prepare('INSERT INTO history(id,at,entry) VALUES(?,?,?)').run(s.id,now(),json);
    this.db.prepare('DELETE FROM objects WHERE source=?').run(s.id);
    if(e.stage==='indexed') for(const c of e.cards!) this.db.prepare('INSERT INTO objects VALUES(?,?,?,?)').run(c.id,c.title.trim().toLowerCase(),s.id,JSON.stringify(c));
  }
  discover(s:Candidate){
    checkCandidate(s); s={...s,canonicalUrl:canonical(s.canonicalUrl)};
    this.transaction(()=>{
      const row=this.db.prepare('SELECT entry FROM sources WHERE id=?').get(s.id);
      if(row){
        const prev:Entry=JSON.parse(String(row.entry));
        ensure(prev.source.canonicalUrl===s.canonicalUrl,'Duplicate source ID');
        if(isDeepStrictEqual(prev.source,s)) return;
      }
      this.save({source:s,stage:'discovered'});
    });
  }
  update(id:string,fn:(e:Entry)=>Entry){
    this.transaction(()=>this.save(fn(this.get(id))));
  }
  attachTrace(id:string,path:string,cache:string){
    const bytes=readFileSync(path),trace:Trace=JSON.parse(bytes.toString('utf8'));
    const sha256=createHash('sha256').update(bytes).digest('hex');
    ensure([trace.userAction,trace.before,trace.after].every(hasText) && trace.before!==trace.after && Number.isFinite(Date.parse(trace.observedAt)), 'DOM trace requires an observed state change');
    this.update(id,e=>{
      ensure(e.capture && !e.error && e.source.rightsStatus!=='link-only' && trace.sourceId===id && trace.versionHash===e.capture.versionHash,'Trace source version mismatch');
      mkdirSync(cache,{recursive:true});writeFileSync(join(cache,sha256+'.json'),bytes);
      const item={sha256,observedAt:trace.observedAt,userAction:trace.userAction,after:trace.after};
      const traces=[...(e.capture.traces||[]).filter(t=>t.sha256!==sha256),item];
      return {...e,capture:{...e.capture,traces}};
    });
    return sha256;
  }
  distill(id:string,cards:Card[]){
    this.update(id,e=>{
      ensure(['captured','distilled','reviewed','indexed'].includes(e.stage) && e.capture && !e.error,'Capture required');
      checkCards(cards,e.source,e.capture);
      return {...e,stage:'distilled',cards,review:undefined};
    });
  }
  review(id:string,by:string,hash:string){
    ensure(by.trim(),'Reviewer required');
    this.update(id,e=>{
      ensure(e.stage==='distilled' && e.capture?.versionHash===hash && !e.error,'Review requires current distilled capture');
      checkCards(e.cards!,e.source,e.capture!);
      return {...e,stage:'reviewed',review:{by,at:now()}};
    });
  }
  index(id:string){
    this.update(id,e=>{
      ensure(e.stage==='reviewed' && e.review && !e.error,'Independent review step required');
      checkCards(e.cards!,e.source,e.capture!);
      return {...e,stage:'indexed'};
    });
  }
  reserve(host:string,delay:number){
    return this.transaction(()=>{
      const previous=this.db.prepare('SELECT next FROM hosts WHERE host=?').get(host);
      const start=Math.max(Date.now(),Number(previous?.next||0));
      this.db.prepare('INSERT OR REPLACE INTO hosts VALUES(?,?)').run(host,start+delay);
      return start;
    });
  }
}
