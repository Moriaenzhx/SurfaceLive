// Compare the source snapshot and every previously present experiment directory.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const sha=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const read=async name=>JSON.parse(await readFile(join('runs/K-03B',name+'.json')));
async function tree(path){
  const entries=await readdir(path,{withFileTypes:true}),paths=[];
  for(const e of entries){
    const file=join(path,e.name);
    if(e.isDirectory())paths.push(...await tree(file));
    else if(e.isFile())paths.push(file);
  }
  return paths;
}
const old=await read('history-before'),previous=await read('source-before');
const historicalRoots=[...new Set(Object.keys(old).map(p=>p.split('/').slice(0,2).join('/')))];
const actual=(await Promise.all(historicalRoots.map(tree))).flat().sort();
assert.deepEqual(actual,Object.keys(old).sort(),'historical path set changed');
for(const file of actual)assert.equal(await sha(file),old[file],file);
const paths=[...(await Promise.all(['desktop','docs','live-engine','experiments'].map(tree))).flat(),
  'README.md','.gitignore','package.json','package-lock.json'];
const changed=[],added=paths.filter(p=>!previous[p]).sort(),removed=Object.keys(previous).filter(p=>!paths.includes(p));
for(const file of paths)if(previous[file]&&await sha(file)!==previous[file])changed.push(file);
console.log(JSON.stringify({historicalFiles:actual.length,changed:changed.sort(),added,removed},null,2));
