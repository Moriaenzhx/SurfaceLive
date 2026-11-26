import scenarios from '../live-engine/design/benchmark.json' with {type:'json'};
import {runDesktopTrials} from './desktop-trial.mjs';

const [out,...variants]=process.argv.slice(2);
if(!out||!variants.length||variants.some(v=>!['A0','A1','A2'].includes(v)))throw Error('Specify output directory and conditions');
const tasks=scenarios.flatMap(s=>[...new Set(variants)].map(variant=>({s,variant})));
await runDesktopTrials(tasks,out);
