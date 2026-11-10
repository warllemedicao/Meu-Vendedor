"use client";
import { getSupabase } from "@/lib/supabase/client";
export async function marketplaceAction(action:"connect"|"sync"|"disconnect"|"generate_link"|"browse_products",payload:Record<string,unknown>={}) {
  const client=getSupabase();if(!client)throw new Error("A conexão com o banco não está configurada.");
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw new Error("Entre na sua conta para continuar.");
  const {data,error}=await client.functions.invoke("marketplace",{body:{...payload,action,platform:"shopee"}});
  if(error) {
    let message="Não foi possível concluir a operação. Verifique sua conexão e tente novamente.";
    if(error.context instanceof Response) {
      try {
        const result=await error.context.json();
        if(typeof result?.error?.message==="string")message=result.error.message;
      }catch{ /* Respostas não JSON nunca são apresentadas ao usuário. */ }
    }
    throw new Error(message);
  }
  if(data?.error)throw new Error(typeof data.error.message==="string"?data.error.message:"Operação não concluída.");
  return data as {productsCount?:number;url?:string;message?:string;products?:import("@/types/marketplace").MarketplaceProduct[];page?:number;hasNextPage?:boolean;searchFallback?:boolean;fetchedAt?:string};
}
export function displayDate(value:string|null):string {
  return value?new Date(value).toLocaleString("pt-BR"):"Ainda não realizada";
}
