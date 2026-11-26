// Re-run the shipped preview checker without publishing a revision or starting an Agent.
import {app,protocol} from 'electron';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {basename,dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve('runs/K-03B'),out=mkdtempSync(join(root,'contract-recheck-'));
const profile=join(out,'profile');mkdirSync(profile);app.setPath('userData',profile);
if(process.platform==='darwin'){app.setActivationPolicy('prohibited');app.dock?.hide();}
protocol.registerSchemesAsPrivileged([{scheme:'surface-page',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.on('window-all-closed',()=>{});
const hash=data=>createHash('sha256').update(data).digest('hex');
async function run(){
  const [runtime,...receipts]=process.argv.slice(2);
  assert(runtime&&receipts.length,'Pass isolated desktop build and frozen receipt(s)');
  const load=file=>import(pathToFileURL(join(resolve(runtime),'desktop',file)));
  const {inspectPage}=await load('preview.mjs'),{readRevisionContract}=await load('design-trace.mjs');
  const {sourceFiles}=await load('library.mjs');
  const report={runtime:resolve(runtime),checkerSha256:hash(await readFile(join(runtime,'desktop/contract-check.mjs'))),cases:[]};
  await app.whenReady();
  for(const file of receipts){
    const receipt=JSON.parse(await readFile(file)),base=join(dirname(resolve(file)),'attempt');
    const trace=JSON.parse(await readFile(join(base,'design-trace.json')));
    const ref=trace.contracts.find(c=>c.id===trace.code.contractId);
    const contract=await readRevisionContract({folder:base,designContract:ref});
    const item={runId:trace.attemptId,scenario:receipt.scenario,contractId:contract.id,contractSha256:ref.sha256,
      originalStatus:receipt.status,sourceVersion:trace.code.sourceVersion,files:{},checks:[]};
    const product={};
    for(const [name,key] of Object.entries(sourceFiles)){
      const bytes=await readFile(join(base,name));item.files[name]=hash(bytes);
      assert.equal(item.files[name],trace.code.files[name].sha256);
      product[key]=bytes.toString('utf8');
    }
    assert.equal(hash(JSON.stringify(item.files)),item.sourceVersion);
    const resources={pending:new Map([[trace.attemptId,product]])};
    const sink={async screenshot(label,bytes){
      assert.equal(label,basename(label));const name=receipt.scenario+'-'+label+'.png';
      await writeFile(join(out,name),bytes,{flag:'wx',mode:0o600});
      return {file:name,sha256:hash(bytes),bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
    }};
    for(const {device} of contract.evaluationPlan.viewports){
      const check=await inspectPage(trace.attemptId,device,resources,AbortSignal.timeout(120_000),sink,contract.evaluationPlan.journey,undefined,contract);
      item.checks.push(check);
      console.log(receipt.scenario,device,check.functionalPass,check.reason??check.error??'');
    }
    report.cases.push(item);
    await writeFile(join(out,'results.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  }
  console.log(out);
  return report.cases.every(item=>item.checks.every(view=>view.functionalPass));
}
run().then(passed=>app.exit(passed?0:1)).catch(error=>{console.error(error);app.exit(1);});
