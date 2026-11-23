"use client";
import { createContext,useContext } from "react";
export const ArrivalAccess=createContext<ReadonlySet<string>>(new Set());
export function useArrivalAccess(){return useContext(ArrivalAccess);}
