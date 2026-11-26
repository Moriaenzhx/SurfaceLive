import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

// A local transaction is released by the OS after a crash, unlike a persistent flag file.
export function acquireDesignClient(){
  const lock=new DatabaseSync(join(tmpdir(),'surfacelive-design-runner-'+(process.getuid?.()??'user')+'.sqlite'));
  try{lock.exec('BEGIN IMMEDIATE');return lock;}
  catch(error){
    lock.close();
    if(error.errcode===5)throw Error('已有一个后台验收实例正在运行');
    throw error;
  }
}
