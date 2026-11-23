// Public county 2025 orthophotography; request only visible Web Mercator tiles.
// exportImage reprojects the source State Plane imagery into exactly the same
// EPSG:3857 bounds Leaflet uses for streets, saved outlines and hydrants.
export function satelliteTileUrl({x,y,z}:{x:number;y:number;z:number}){
 const half=20037508.342789244,span=2*half/(2**z),left=-half+x*span,top=half-y*span;
 const url=new URL('https://img.cookcountyil.gov/imagery/rest/services/CookOrtho2025/ImageServer/exportImage');
 url.search=new URLSearchParams({bbox:[left,top-span,left+span,top].join(','),bboxSR:'3857',imageSR:'3857',size:'256,256',adjustAspectRatio:'false',format:'jpg',f:'image'}).toString();
 return url.toString();
}
