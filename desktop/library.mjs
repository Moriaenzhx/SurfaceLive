import {access, mkdir, readFile, writeFile, readdir, realpath, rename, mkdtemp, rm, stat, statfs} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname, isAbsolute, join, resolve, sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {direction} from './engine.mjs';

export const sourceFiles={'index.html':'html','styles.css':'css','app.js':'js'};
const validId=/^[a-f0-9-]{36}$/;
const isInside=(parent,path)=>path===parent||path.startsWith(parent+sep);

async function readRevisions(root){
  const found=[];
  for(const dir of await readdir(root,{withFileTypes:true})){
    if(!dir.isDirectory()||!validId.test(dir.name))continue;
    const folder=join(root,dir.name);
    try{
      const item=JSON.parse(await readFile(join(folder,'revision.json'),'utf8'));
      if(item?.id===dir.name && validId.test(item.project) && typeof item.title==='string' && typeof item.createdAt==='string' &&
          ['desktop','tablet','mobile'].includes(item.direction?.device))found.push({...item,folder,sample:false});
    }catch(error){
      // A selected folder may also contain unrelated UUID-named directories.
      if(!['ENOENT','ENOTDIR','EISDIR','EACCES','EPERM'].includes(error.code) && !(error instanceof SyntaxError))throw error;
    }
  }
  return found;
}

export class Library{
  constructor(root,sampleFolder,applicationFolder=resolve(sampleFolder,'../..')){
    this.root=root;this.defaultRoot=root;this.sampleFolder=sampleFolder;this.revisions=new Map();
    this.applicationFolder=applicationFolder;
    this.locations=[root];this.unavailable=new Set();this.settingsFile=join(dirname(root),'project-storage.json');
    this.settingsIssue='';
  }
  async load(){
    await mkdir(this.defaultRoot,{recursive:true});
    try{
      const config=JSON.parse(await readFile(this.settingsFile,'utf8'));
      if(!Array.isArray(config?.locations)||!config.locations.every(path=>typeof path==='string'&&isAbsolute(path))||
          !config.locations.includes(config.root))throw Error('保存位置配置无效');
      this.locations=[...new Set([this.defaultRoot,...config.locations])];this.root=config.root;
    }catch(error){
      if(error.code!=='ENOENT')this.settingsIssue='保存位置配置读取失败，当前使用默认目录。可重新选择保存位置。';
    }
    const samples=JSON.parse(await readFile(join(this.sampleFolder,'catalog.json'),'utf8'));
    for(const sample of samples){
      this.revisions.set(sample.id,{...sample,project:sample.id,parent:null,sample:true,createdAt:null,change:'',
        direction:direction(sample.description,sample.target),checks:[],folder:join(this.sampleFolder,sample.folder)});
    }
    await this.readLocations(this.locations);
  }
  async readLocations(locations){
    for(const location of locations){
      try{
        this.index(await readRevisions(location));
        this.unavailable.delete(location);
      }catch{this.unavailable.add(location);}
    }
  }
  index(records){
    for(const item of records)if(!this.revisions.has(item.id))this.revisions.set(item.id,item);
  }
  async changeRoot(path){
    const canonical=await realpath(path);
    if(!(await stat(canonical)).isDirectory())throw Error('请选择文件夹');
    const appRoot=await realpath(this.applicationFolder);
    if(isInside(appRoot,canonical))throw Error('请选择应用资源目录以外的文件夹');
    const previousPaths=await Promise.all(this.locations.map(folder=>realpath(folder).catch(()=>null)));
    const root=this.locations[previousPaths.indexOf(canonical)]||canonical;
    for(const folder of previousPaths.filter(Boolean)){
      if(canonical.startsWith(folder+sep) && validId.test(canonical.slice(folder.length+1).split(sep)[0]))
        throw Error('这里是某个版本的源码目录，请选择用于存放作品的文件夹');
    }
    await access(root,constants.W_OK|constants.X_OK);
    const records=await readRevisions(root);
    const locations=[...new Set([...this.locations,root])];
    const temporary=this.settingsFile+'.'+randomUUID()+'.tmp';
    try{
      await writeFile(temporary,JSON.stringify({root,locations},null,2)+'\n',{flag:'wx',mode:0o600});
      await rename(temporary,this.settingsFile);
    }finally{await rm(temporary,{force:true});}
    this.locations=locations;this.root=root;this.index(records);this.unavailable.delete(root);this.settingsIssue='';
  }
  async storageInfo(id){
    let availableBytes=null;
    try{
      const stats=await statfs(this.root);
      availableBytes=stats.bavail*stats.bsize;
    }catch{/* A removable volume can be disconnected. Keep its configured location. */}
    const revision=id?this.require(id):null;
    return {root:this.root,availableBytes,settingsIssue:this.settingsIssue,
      previous:this.locations.filter(p=>p!==this.root).map(path=>({path,unavailable:this.unavailable.has(path)})),
      current:revision?{id:revision.id,title:revision.title,folder:revision.folder,sample:!!revision.sample}:null};
  }
  async checkSaveLocation(){
    try{await access(this.root,constants.W_OK|constants.X_OK);}
    catch{throw Error('作品保存位置不可写。请连接磁盘或在设置中更改位置。\n'+this.root);}
  }
  async folderFor(kind,value){
    let folder;
    if(kind==='root')folder=this.root;
    else if(kind==='revision')folder=this.require(value).folder;
    else if(kind==='previous'&&this.locations.includes(value))folder=value;
    if(!folder)throw Error('找不到这个保存位置');
    if(!await stat(folder).then(s=>s.isDirectory()).catch(()=>false))throw Error('文件夹当前不可用，请检查磁盘是否已连接');
    return folder;
  }
  list(){
    return [...this.revisions.values()].map(({folder,...value})=>value).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  }
  require(id){
    const r=this.revisions.get(id);if(!r)throw new Error('此版本不存在');return r;
  }
  async source(id){
    const {folder}=this.require(id), result={};
    for(const [name,key] of Object.entries(sourceFiles))result[key]=await readFile(join(folder,name),'utf8');
    return result;
  }
  async reference(id,index){
    const revision=this.require(id),ref=revision.references?.[index];
    if(!Number.isInteger(index)||ref?.kind!=='image')throw Error('找不到这张参考图');
    if(!ref.original)return ref.thumbnail;
    const bytes=await readFile(join(revision.folder,'reference-'+index+'.jpg'));
    return 'data:image/jpeg;base64,'+bytes.toString('base64');
  }
  async commit(metadata,product,references=[],trace){
    const root=this.root;
    const tmp=trace?.folder??await mkdtemp(join(root,'.saving-')), folder=join(root,metadata.id);
    try{
      if(!trace){
        await Promise.all(Object.entries(sourceFiles).map(([name,key])=>writeFile(join(tmp,name),product[key])));
        for(const [index,ref] of references.entries())if(ref.kind==='image')await writeFile(join(tmp,'reference-'+index+'.jpg'),ref.bytes);
      }
      await writeFile(join(tmp,'revision.json'),JSON.stringify(metadata,null,2));
      if(trace)await trace.finish('completed-checks');
      await rename(tmp,folder);this.revisions.set(metadata.id,{...metadata,folder});
    }finally{if(!trace)await rm(tmp,{recursive:true,force:true});}
  }
  async export(id,base){
    const r=this.require(id), source=await this.source(id);
    const name=r.title.replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,48)||'SurfaceLive';
    const dir=await mkdtemp(join(base,name+'-'));
    try{for(const [file,key] of Object.entries(sourceFiles))await writeFile(join(dir,file),source[key]);}
    catch(e){await rm(dir,{recursive:true,force:true});throw e;}
    return dir;
  }
}
export function newMetadata({base,description,change,target,context,agent,model},title){
  return {id:randomUUID(),project:base && !base.sample?base.project:randomUUID(),parent:base?.id||null,
    title,createdAt:new Date().toISOString(),description,change,target,direction:context,agent,model:model||null,checks:[]};
}
