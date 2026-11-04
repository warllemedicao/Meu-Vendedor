"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import type { MarketplaceConnection } from "@/types/marketplace";
interface State {connections:MarketplaceConnection[];loading:boolean;error:string;refresh:()=>void;}
const Context=createContext<State>({connections:[],loading:false,error:"",refresh:()=>{}});
export function MarketplaceProvider({children}:{children:ReactNode}) {
  const {user,loading}=useAuth();
  if(!user)return <Context.Provider value={{connections:[],loading,error:"",refresh:()=>{}}}>{children}</Context.Provider>;
  return <UserConnections key={user.id} userId={user.id}>{children}</UserConnections>;
}
function UserConnections({children,userId}:{children:ReactNode;userId:string}) {
  const [connections,setConnections]=useState<MarketplaceConnection[]>([]);
  const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;const client=getSupabase();if(!client)return;
    const load=()=>{void client.from("mv_connections").select("id,platform_id,status,last_sync_at,last_error_code,sync_scope").eq("user_id",userId).then(({data,error})=>{
      if(!active)return;
      if(error)setError("Não foi possível verificar as conexões.");else{setConnections(data??[]);setError("");}
      setLoading(false);
    });};
    load();const timer=setInterval(load,60000);return()=>{active=false;clearInterval(timer);};
  },[userId,revision]);
  return <Context.Provider value={{connections,loading,error,refresh:()=>{setLoading(true);setRevision(x=>x+1);}}}>{children}</Context.Provider>;
}
export function useMarketplace(){return useContext(Context);}
