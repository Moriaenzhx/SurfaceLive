import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {Queue} from './store.ts';
import {systemFetch} from './system-fetch.ts';
import {Collector,digest} from './capture.ts';
import {draft} from './draft.ts';
import {ensure} from './schema.ts';
const here=fileURLToPath(new URL('./',import.meta.url));
const [cmd,arg,extra,hash]=process.argv.slice(2);
const db=new Queue(join(here,'data','factory.sqlite'));
const cache=join(here,'.research');
const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const collector=new Collector(db,cache,process.argv.includes('--curl')?systemFetch as typeof fetch:fetch);
try{
  if(cmd==='discover-links'){
    const seed=json(arg);
    console.log(await collector.discoverLinks(seed.source,seed.pathPrefix,seed.limit));
  }else if(cmd==='discover'){
    const list=json(arg||join(here,'data','registry.json'));
    for(const source of list) db.discover(source);
    console.log('Registered',list.length);
  }else if(cmd==='capture'){
    const ids=(arg==='all'||arg==='pending')?db.all().filter(e=>e.source.rightsStatus!=='link-only' && (arg==='all'||e.stage==='discovered'||e.stage==='eligible')).map(e=>e.source.id):[arg];
    for(const id of ids) try{await collector.capture(id);console.log(id,db.get(id).stage);}
    catch(e){console.error(id,(e as Error).message,(e as Error).cause||'');process.exitCode=1;}
  }else if(cmd==='check-cache'){
    let count=0;
    for(const e of db.all().filter(x=>x.stage==='indexed' && x.capture?.screenshot)){
      const shot=e.capture!.screenshot!;
      ensure(digest(readFileSync(join(cache,shot.sha256+'.png')))===shot.sha256,'Screenshot checksum mismatch: '+e.source.id);
      count++;
    }
    console.log('Verified indexed screenshot files:',count);
  }else if(cmd==='draft') console.log(await draft(db.get(arg),cache,extra));
  else if(cmd==='attach-trace') console.log(db.attachTrace(arg,extra,cache));
  else if(cmd==='distill') db.distill(arg,json(extra));
  else if(cmd==='review') db.review(arg,extra,hash);
  else if(cmd==='index') db.index(arg);
  else if(cmd==='list') console.log(JSON.stringify(db.all().map(e=>({id:e.source.id,stage:e.stage,hash:e.capture?.versionHash,error:e.error})),null,2));
  else if(cmd==='show') console.log(JSON.stringify(db.get(arg),null,2));
  else if(cmd==='history') console.log(JSON.stringify(db.db.prepare('SELECT at,entry FROM history WHERE id=? ORDER BY seq').all(arg).map(r=>({at:r.at,...JSON.parse(String(r.entry))})),null,2));
  else ensure(false,'factory discover-links <listing.json> | discover [registry.json] | capture <id|all|pending> | draft <id> <codex-model> | attach-trace <id> <trace.json> | distill <id> <cards.json> | review <id> <reviewer> <versionHash> | index <id> | list | check-cache | show <id> | history <id>');
}catch(e){console.error((e as Error).message);process.exitCode=1;}finally{db.db.close();}
