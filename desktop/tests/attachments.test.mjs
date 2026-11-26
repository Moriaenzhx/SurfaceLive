import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {generate} from '../agent.mjs';
test('Claude image turns use the streaming input and output protocol and preserve the result event',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'studio-image-protocol-')),exe=join(cwd,'agent.cjs');
  const previous=process.env.SURFACELIVE_CLAUDE_EXEC;
  try{
    await writeFile(exe,'#!/usr/bin/env node\n'+String.raw`
const assert=require('node:assert/strict');
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];
assert.equal(value('--input-format'),'stream-json');assert.equal(value('--output-format'),'stream-json');
assert(args.includes('--verbose'));assert.equal(value('--effort'),'medium');
let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{
  const msg=JSON.parse(input).message.content;
  assert.equal(msg[0].source.media_type,'image/jpeg');assert.equal(msg[0].source.data,'AQID');assert.equal(msg[1].text,'review');
  console.log(JSON.stringify({type:'system'}));
  const product={title:'演示',html:'<html><link href="styles.css"><script src="app.js"></script></html>',css:'button{}',js:'void 0'};
  console.log(JSON.stringify({type:'result',structured_output:product}));
});`,{mode:0o755});
    process.env.SURFACELIVE_CLAUDE_EXEC=exe;
    const result=await generate({type:'claude',effort:'medium',prompt:'review',images:[{bytes:Buffer.from([1,2,3])}],cwd,signal:new AbortController().signal});
    assert.equal(result.title,'演示');
  }finally{
    if(previous===undefined)delete process.env.SURFACELIVE_CLAUDE_EXEC;else process.env.SURFACELIVE_CLAUDE_EXEC=previous;
    await rm(cwd,{recursive:true,force:true});
  }
});
