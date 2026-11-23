"use client";
import { useEffect,useState } from "react";
import Workspace from "./ui/workspace";
import { ArrivalAccess } from "./access";
import "./arrival.css";
type Session={user:{id:string;name:string};permissions:string[];department:{id:string;name:string}};
export default function ArrivalPreplans({department}: {department?:{isolated:boolean};inspectionPilot?:boolean}){
  const [session,setSession]=useState<Session|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const controller=new AbortController();let active=true;fetch("/api/arrival/session",{cache:"no-store",signal:controller.signal}).then(async response=>{const body=await response.json() as Session&{error?:string};if(!response.ok)throw Error(body.error||"Preplan access could not be verified.");if(active){setSession(body);setError("");try{localStorage.setItem("stickney-arrival-owner",body.user.id);}catch{}}}).catch(error=>{if(active)setError(error instanceof Error?error.message:"Preplan access could not be verified.");});return()=>{active=false;controller.abort();};},[attempt]);
  if(error)return <section className="content-card" role="alert"><h1>Preplans could not open</h1><p>{error}</p><button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry preplans</button></section>;
  if(!session)return <section className="content-card" role="status">Opening Stickney preplans…</section>;
  return <ArrivalAccess.Provider value={new Set(session.permissions)}><div className="arrival-app" data-theme="light" data-isolated={department?.isolated?"true":"false"}><Workspace key={session.user.id} user={session.user}/></div></ArrivalAccess.Provider>;
}
