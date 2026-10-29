export function inspectionFileStorage(key:string,department:string){
 const imported=key.startsWith('eso:'),objectKey=imported?key.slice(4):key;
 if(!objectKey.startsWith(department+'/')||objectKey.split('/').includes('..'))throw Error('This file is outside the inspection department.');
 return{bucket:imported?'stickney-fire-inspections-eso':'stickney-fire-inspections-pilot',objectKey};
}
