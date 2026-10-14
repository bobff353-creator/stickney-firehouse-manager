'use client';
import {useEffect,useState} from 'react';
import {queueReturnHref} from './task-queue-view';
export default function TaskQueueReturn(){const [href,setHref]=useState('');useEffect(()=>{void Promise.resolve().then(()=>setHref(queueReturnHref(window.location.search)));},[]);return href?<p className="queue-return no-print"><a href={href}>← Return to your filtered task queue</a></p>:null;}
