// Original upright hydrant artwork, with bonnet, barrel, side caps and flange.
export const HYDRANT_PATH = 'M15 3h6v4h-6V3ZM10 14a8 8 0 0 1 16 0H10ZM9 14h18v5H9v-5Zm2 5h14v20h3v5H8v-5h3V19ZM4 22h7v11H4V22Zm21 0h7v11h-7V22ZM2 21h3v13H2V21Zm29 0h3v13h-3V21Z';
export const HYDRANT_MARKER_SVG = '<svg class="hydrant-symbol" viewBox="0 0 36 48" aria-hidden="true"><path class="hydrant-halo" d="'+HYDRANT_PATH+'"/><path class="hydrant-housing" d="'+HYDRANT_PATH+'"/><path class="hydrant-shine" d="M13 12c1-3 3-4 6-4M12 16h11M14 21v16M11 41h13M6 24v6M28 24v6"/><circle class="hydrant-face" cx="18" cy="28" r="5.8"/><path class="hydrant-nut" d="m18 24 3.8 2.7-1.5 4.4h-4.6l-1.5-4.4Z"/></svg>';
export function hydrantColor(flow:number|null,status:string){
 if(status==='Out of service')return '#929a9b';
 if(flow===null)return '#e3bc35';
 return flow>=1500?'#3b9ddb':flow>=1000?'#5aaa5c':flow>=500?'#ed9a36':'#d95e4d';
}
