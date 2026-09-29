import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const source='https://api.neris.fsri.org/openapi.json';
const response=await fetch(source);if(!response.ok)throw Error(`Schema download failed: ${response.status}`);
const raw=await response.text(),api=JSON.parse(raw),schemas=api.components.schemas,selected={};
function visit(node){if(!node||typeof node!=='object')return;if(node.$ref){const key=node.$ref.split('/').pop();if(!selected[key]){if(!schemas[key])throw Error(`Missing ${key}`);selected[key]=schemas[key];visit(schemas[key]);}}for(const [key,value]of Object.entries(node)){if(key==='examples')continue;if(Array.isArray(value))value.forEach(visit);else visit(value);}}
selected.IncidentPayload=schemas.IncidentPayload;visit(schemas.IncidentPayload);
function trim(node){if(Array.isArray(node))return node.map(trim);if(!node||typeof node!=='object')return node;return Object.fromEntries(Object.entries(node).filter(([k])=>k!=='examples').map(([k,v])=>[k,trim(v)]));}
await fs.mkdir('app/neris',{recursive:true});
await fs.writeFile('app/neris/schema.json',JSON.stringify({source,version:api.info.version,verifiedAt:new Date().toISOString().slice(0,10),sha256:crypto.createHash('sha256').update(raw).digest('hex'),root:'IncidentPayload',components:{schemas:trim(selected)}},null,2)+'\n');
console.log(`Pinned ${Object.keys(selected).length} official schema definitions, API ${api.info.version}. Review before publishing.`);
