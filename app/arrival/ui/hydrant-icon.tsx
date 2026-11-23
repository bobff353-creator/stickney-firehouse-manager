import {HYDRANT_PATH} from '../lib/map-icons';
export default function HydrantIcon({size=18,className}:{size?:number;className?:string}){
 return <svg width={size} height={size} viewBox="0 0 36 48" fill="currentColor" stroke="none" aria-hidden="true" focusable="false" className={className}><path d={HYDRANT_PATH}/><circle cx="18" cy="28" r="5.5" fill="var(--surface,#fff)"/><path d="m18 25 2.8 2-1.1 3.2h-3.4l-1.1-3.2Z"/></svg>;
}
