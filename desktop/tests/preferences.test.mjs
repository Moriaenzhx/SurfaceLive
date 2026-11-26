import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {matchingPreferences,recordPreference} from '../../live-engine/design/preferences.mjs';

async function makeVersion(dir,id){
  const folder=join(dir,id);await mkdir(join(folder,'evidence'),{recursive:true});
  const hash=data=>createHash('sha256').update(data).digest('hex');
  const files={};
  for(const name of ['index.html','app.js','styles.css']){
    const bytes='test-fixture-'+id+name;await writeFile(join(folder,name),bytes);files[name]={sha256:hash(bytes)};
  }
  const browser=[];
  for(const device of ['desktop','mobile']){
    const file='evidence/'+device+'.png',bytes=Buffer.from('fixture-only-'+device);
    await writeFile(join(folder,file),bytes);
    browser.push({device,functionalPass:true,screenshot:{file,sha256:hash(bytes)},after:'fixture state',errors:[]});
  }
  await writeFile(join(folder,'design-trace.json'),JSON.stringify({attemptId:id,code:{revision:id,files},browser,winningStrategy:id}));
  return {folder};
}
test('explicit feedback survives reopen and is retrieved only within all of its scopes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'surfacelive-preferences-test-'));
  try{
    const file=join(dir,'preferences.sqlite'),choice=await makeVersion(dir,'first'),loser=await makeVersion(dir,'second');
    const scope={user:'local-owner',project:'project-a',brand:'知时',scene:'传统文化择时'};
    const input={id:'test-vote',scope,choice,rejected:[loser],reason:'比较时段时更容易辨读',humanVerified:false};
    const match={user:'local-owner',project:scope.project,brands:['知时'],scenes:[scope.scene]};
    assert.equal((await recordPreference(file,input)).confirmed,false);assert.deepEqual(matchingPreferences(file,match),[]);
    const confirmed={...input,id:'verified-test',humanVerified:true};
    assert.equal((await recordPreference(file,confirmed)).confirmed,true);
    assert.equal((await recordPreference(file,confirmed)).confirmed,true);
    const selected=matchingPreferences(file,match);assert.deepEqual(selected.map(v=>v.id),['verified-test']);
    assert(!JSON.stringify(selected).includes(dir));
    for(const changed of [{user:'someone-else'},{project:'another'},{brands:['其他品牌']},{scenes:['general']}])
      assert.deepEqual(matchingPreferences(file,{...match,...changed}),[]);
    await assert.rejects(recordPreference(file,{...input,id:'other',scope:{user:scope.user}}));
    await assert.rejects(recordPreference(file,{...confirmed,reason:'changed existing vote'}));
    await writeFile(join(choice.folder,'styles.css'),'changed source');
    await assert.rejects(recordPreference(file,{...confirmed,id:'changed-artifact'}),/源码已变化/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
