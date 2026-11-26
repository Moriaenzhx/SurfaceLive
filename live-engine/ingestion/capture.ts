import robotsParser from 'robots-parser';
import {PNG} from 'pngjs';
import {createHash,randomUUID} from 'node:crypto';
import {writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {canonical,checkCandidate,ensure,type Candidate,type Capture} from './schema.ts';
import {Queue,type Entry} from './store.ts';

export const digest=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const bot='SurfaceLiveResearch';
const maxPage=2*1024*1024, maxPng=16*1024*1024;
export class Collector{
  policies=new Map<string,{rule:ReturnType<typeof robotsParser>;proof:Capture['robots'][number]}>();
  queue:Queue; cache:string; request:typeof fetch;
  constructor(queue:Queue, cache:string, request=fetch){this.queue=queue;this.cache=cache;this.request=request;}
  async read(url:string,max:number,delay=1200,robots=false){
    const u=new URL(canonical(url));
    const send=async()=>{
      const start=this.queue.reserve(u.origin,Math.max(delay,1200));
      await sleep(Math.max(0,start-Date.now()));
      return await this.request(u.href,{redirect:'error',signal:AbortSignal.timeout(65000),headers:{'User-Agent':bot+'/1.0 (design reference research; low-volume)'}});
    };
    const res=await send().catch(()=>send());
    if(robots && res.status===404) return Buffer.alloc(0);
    if(res.status===429 || res.status===503){
      const retry=res.headers.get('retry-after');
      const ms=retry && /^\d+$/.test(retry)?Number(retry)*1000:Date.parse(retry||'')-Date.now();
      this.queue.reserve(u.origin,Math.max(60000,Number.isFinite(ms)?ms:0));
    }
    ensure(res.ok && res.body,'HTTP '+res.status+' '+u.href);
    ensure(Number(res.headers.get('content-length'))<=max,'Content exceeds size limit');
    const reader=res.body.getReader(), parts:Uint8Array[]=[];let size=0;
    try{while(true){
      const {value,done}=await reader.read();if(done)break;
      size+=value.length;ensure(size<=max,'Content exceeds size limit');parts.push(value);
    }}finally{await reader.cancel();}
    return Buffer.concat(parts);
  }
  async allowedDelay(url:string){
    const origin=new URL(canonical(url)).origin;
    if(!this.policies.has(origin)){
      const path=origin+'/robots.txt', bytes=await this.read(path,512*1024,1200,true);
      this.policies.set(origin,{rule:robotsParser(path,bytes.toString('utf8')),proof:{url:path,hash:digest(bytes),checkedAt:new Date().toISOString()}});
    }
    const rule=this.policies.get(origin)!.rule;
    ensure(rule.isAllowed(url,bot)!==false,'robots.txt disallows '+url);
    return (rule.getCrawlDelay(bot)||0)*1000;
  }
  // A reviewed listing grants access to the listing alone. Every discovered target starts link-only.
  async discoverLinks(seed:Candidate,prefix:string,limit=20){
    checkCandidate(seed);
    ensure(seed.rightsStatus!=='link-only' && prefix.startsWith('/') && prefix.length>1,'Reviewed listing and path prefix required');
    ensure(Number.isInteger(limit) && limit>=1 && limit<=100,'Limit must be 1..100');
    const wait=await this.allowedDelay(seed.canonicalUrl);
    const html=(await this.read(seed.canonicalUrl,maxPage,wait)).toString('utf8');
    const seen=new Set(this.queue.all().map(e=>canonical(e.source.canonicalUrl)));
    const ids:string[]=[];
    for(const match of html.matchAll(/\bhref\s*=\s*["']([^"'<>]+)["']/gi)){
      let url:URL;
      try{url=new URL(match[1].replaceAll('&amp;','&'),seed.canonicalUrl);}catch{continue;}
      if(url.origin!==new URL(seed.canonicalUrl).origin || !url.pathname.startsWith(prefix) || url.search)continue;
      const link=canonical(url.href);
      if(seen.has(link))continue;
      const id='link-'+digest(link).slice(0,16);
      this.queue.discover({id,title:url.pathname,canonicalUrl:link,publisher:url.host,sceneTags:seed.sceneTags,
        rightsStatus:'link-only',licenseOrTerms:'Pending individual rights review',termsUrl:seed.termsUrl,discoveredFrom:seed.canonicalUrl});
      ids.push(id);seen.add(link);if(ids.length===limit)break;
    }
    return ids;
  }
  async capture(id:string){
    let expected=this.queue.get(id);
    const s=expected.source;
    ensure(s.rightsStatus!=='link-only','Link-only: collection disabled');
    const replace=(next:Entry)=>{
      this.queue.update(id,current=>{
        ensure(JSON.stringify(current)===JSON.stringify(expected),'Source changed during capture; retry');
        return next;
      });
      expected=next;
    };
    try{
      const urls=[s.canonicalUrl,...(s.screenshotUrl?[s.screenshotUrl]:[])];
      const delays=[];
      for(const url of urls) delays.push(await this.allowedDelay(url));
      if(expected.stage==='discovered') replace({...expected,stage:'eligible',error:undefined});
      const page=await this.read(s.canonicalUrl,maxPage,delays[0]);
      const html=page.toString('utf8');
      const title=html.match(/<title[^>]*>([^<]{1,1000})<\/title>/i)?.[1]?.trim();
      ensure(title,'Missing source page title');
      const pageHash=digest(page);
      const revision=html.match(/"wgRevisionId"\s*:\s*(\d+)/)?.[1];
      const cap:Capture={pageTitle:title,pageHash,revision,capturedAt:new Date().toISOString(),robots:[...new Set(urls.map(u=>new URL(u).origin))].map(o=>this.policies.get(o)!.proof),versionHash:''};
      let imageBytes:Buffer|undefined;
      if(s.screenshotUrl){
        if(new URL(s.canonicalUrl).hostname==='commons.wikimedia.org'){
          const links=[...html.matchAll(/href="(https:\/\/upload\.wikimedia\.org\/[^"<>]+)"/gi)];
          ensure(links.some(m=>decodeURI(canonical(m[1].replaceAll('&amp;','&')))===decodeURI(canonical(s.screenshotUrl!))), 'Image reference missing from source');
        }
        const bytes=await this.read(s.screenshotUrl,maxPng,delays[1]);
        ensure(bytes.length>=33 && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),'Expected PNG bytes');
        ensure(bytes.readUInt32BE(16)*bytes.readUInt32BE(20)<=20000000,'Image dimensions exceed limit');
        const {width,height}=PNG.sync.read(bytes);
        const hash=digest(bytes);
        cap.screenshot={url:s.screenshotUrl,sha256:hash,width,height};
        imageBytes=bytes;
      }
      cap.versionHash=digest(JSON.stringify([s,revision||pageHash,cap.screenshot?.sha256]));
      ensure(!expected.capture || expected.capture.versionHash===cap.versionHash,'Source changed; renew terms review before saving this version');
      if(imageBytes && cap.screenshot){
        mkdirSync(this.cache,{recursive:true});
        const tmp=join(this.cache,randomUUID()+'.part');
        writeFileSync(tmp,imageBytes);renameSync(tmp,join(this.cache,cap.screenshot.sha256+'.png'));
      }
      if(expected.capture?.versionHash===cap.versionHash && !expected.error && expected.stage!=='eligible'){
        replace({...expected,capture:{...cap,traces:expected.capture.traces}});return;
      }
      replace({source:s,stage:'captured',capture:cap});
    }catch(err){
      const reason=String((err as Error).message);
      // Withdraw stale evidence from retrieval while retaining the previously reviewed version in history.
      if(JSON.stringify(this.queue.get(id))===JSON.stringify(expected)) replace({source:s,stage:'discovered',capture:expected.capture,error:reason});
      throw err;
    }
  }
}
