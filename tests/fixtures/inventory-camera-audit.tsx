import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import InventoryCapture from '../../app/inventory-capture';
// Isolated fixture: synthetic pixels only. Never opens the user's actual camera or a network API.
let scenario='denied', starts=0, stops=0;
const grants:Array<()=>void>=[];
function report(){const status=document.getElementById('camera-counters');if(status)status.textContent=`Requests: ${starts}; stopped tracks: ${stops}`;}
function sample(barcode=true){const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,640,480);
 if(barcode){
   // Code 39: ordinary linear VIN barcode, including start/stop bars and quiet zones.
   const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
   const patterns=[0x034,0x121,0x061,0x160,0x031,0x130,0x070,0x025,0x124,0x064,0x109,0x049,0x148,0x019,0x118,0x058,0x00D,0x10C,0x04C,0x01C,0x103,0x043,0x142,0x013,0x112,0x052,0x007,0x106,0x046,0x016,0x181,0x0C1,0x1C0,0x091,0x190,0x0D0];
   let x=44;ctx.fillStyle='black';for(const char of '*1FTWW3BR4AEA52595*'){const pattern=char==='*'?0x094:patterns[alphabet.indexOf(char)];for(let bit=8;bit>=0;bit--){const width=pattern&(1<<bit)?5:2;if(bit%2===0)ctx.fillRect(x,140,width,200);x+=width;}x+=2;}
 }
 else{ctx.fillStyle='#174761';ctx.fillRect(20,20,600,440);ctx.fillStyle='white';ctx.font='28px Arial';ctx.fillText('SYNTHETIC APPARATUS PHOTO',65,240);}return canvas;
}
Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{starts++;report();if(scenario==='denied')throw new DOMException('Fixture denied','NotAllowedError');if(scenario==='missing')throw new DOMException('Fixture no camera','NotFoundError');
 const create=()=>{const media=sample(scenario==='barcode').captureStream(5);for(const track of media.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{if(track.readyState==='live'){stops++;report();}stop();};}return media;};
 if(scenario==='delayed')return new Promise(resolve=>grants.push(()=>resolve(create())));return create();}}});
function App(){const [open,setOpen]=useState<'vin'|'photo'|'equipment'|null>(null);const [result,setResult]=useState('Nothing captured');const [tick,setTick]=useState(0);
 return <><aside style={{font:'16px Arial',padding:16}}><h1>Camera fixture · synthetic only</h1><label>Test camera behavior <select onChange={e=>scenario=e.target.value}><option value="denied">Permission denied</option><option value="missing">No camera</option><option value="delayed">Delayed permission</option><option value="photo">Synthetic photo</option><option value="barcode">Synthetic VIN barcode</option></select></label><p id="camera-counters">Requests: 0; stopped tracks: 0</p><button onClick={()=>grants.splice(0).forEach(grant=>grant())}>Resolve pending permission</button><button onClick={()=>setOpen('photo')}>Open photo camera</button><button onClick={()=>setOpen('vin')}>Open VIN scanner</button><button onClick={()=>setOpen('equipment')}>Open equipment scanner</button><p role="status">{result}</p></aside>
 {open&&<><InventoryCapture mode={open} title={open==='photo'?'Test apparatus photo':'Test barcode scanner'} onClose={()=>setOpen(null)} onPhoto={file=>{setResult(`Photo ready: ${file.type}; ${file.size} bytes; NOT SAVED`);setOpen(null);}} onCode={code=>{setResult(`Code read: ${code}; NOT SAVED`);setOpen(null);}}/><div style={{position:'fixed',bottom:0,zIndex:4000,background:'#fff4ba',padding:4,font:'12px Arial'}}><button onClick={()=>setTick(tick+1)}>Parent refresh {tick}</button><button onClick={async()=>{const blob=await new Promise<Blob|null>(resolve=>sample().toBlob(resolve,'image/png'));const transfer=new DataTransfer();transfer.items.add(new File([blob!],'synthetic-barcode.png',{type:'image/png'}));const input=document.querySelector<HTMLInputElement>('.capture-alternatives input:not([capture])')!;input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));}}>Choose synthetic barcode photo</button></div></>}
 </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
