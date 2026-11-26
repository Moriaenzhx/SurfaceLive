// curl uses the host's HTTPS proxy settings on systems where Node fetch connects directly.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
export async function systemFetch(url:string,init:RequestInit){
  const {stdout}=await run('curl',['--disable','--silent','--show-error','--connect-timeout','12','--max-time','60','--proto','=https',
    '--max-filesize','16777216','--user-agent',new Headers(init.headers).get('User-Agent')!,
    '--write-out','\nSURFACELIVE-HTTP %{http_code} %{header_json}',url],{encoding:'buffer',maxBuffer:17*1024*1024,signal:init.signal??undefined});
  const boundary=Buffer.from('\nSURFACELIVE-HTTP ');
  const marker=stdout.lastIndexOf(boundary);
  if(marker<0) throw new Error('Missing HTTP response metadata');
  const trailer=stdout.subarray(marker+boundary.length).toString();
  const split=trailer.indexOf(' ');
  const status=Number(trailer.slice(0,split));
  const headers=JSON.parse(trailer.slice(split+1)) as Record<string,string[]>;
  return new Response([204,304].includes(status)?null:stdout.subarray(0,marker),{status,headers:Object.entries(headers).map(([k,v])=>[k,v.join(', ')]) as [string,string][]});
}
