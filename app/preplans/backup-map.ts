// County orthophotography stays aligned with the same Web Mercator projection
// as Google/OSM, including high-zoom building tracing when Google is unavailable.
export function backupSatelliteTile(x:number,y:number,z:number){
 const half=20037508.342789244,span=2*half/2**z,left=-half+x*span,top=half-y*span;
 const lng=(x+.5)/2**z*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+.5)/2**z)))*180/Math.PI;
 if(lat<41.4||lat>42.2||lng< -88.3||lng> -87.5)return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
 const url=new URL('https://img.cookcountyil.gov/imagery/rest/services/CookOrtho2025/ImageServer/exportImage');
 url.search=new URLSearchParams({bbox:[left,top-span,left+span,top].join(','),bboxSR:'3857',imageSR:'3857',size:'256,256',adjustAspectRatio:'false',format:'jpg',f:'image'}).toString();return url.toString();
}
