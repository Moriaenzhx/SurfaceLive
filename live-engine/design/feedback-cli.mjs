import {readFile} from 'node:fs/promises';
import {recordPreference} from './preferences.mjs';
const [database,ballot]=process.argv.slice(2);
if(!database||!ballot)throw Error('Usage: node live-engine/design/feedback-cli.mjs <preferences.sqlite> <human-feedback.json>');
console.log(JSON.stringify(await recordPreference(database,JSON.parse(await readFile(ballot,'utf8')))));
