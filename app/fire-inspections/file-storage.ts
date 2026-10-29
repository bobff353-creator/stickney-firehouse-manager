export function inspectionFileStorage(key:string,department:string){
 const imported=key.startsWith('eso:'),reference=imported?key.slice(4):key,parts=reference.split('#'),objectKey=parts[0];
 if(parts.length>1&&(!imported||parts.length!==2||!/^eso-[a-f0-9-]{36}$/i.test(parts[1])))throw Error('The original file reference is invalid.');
 if(!objectKey.startsWith(department+'/')||objectKey.split('/').includes('..'))throw Error('This file is outside the inspection department.');
 return{bucket:imported?'stickney-fire-inspections-eso':'stickney-fire-inspections-pilot',objectKey};
}
