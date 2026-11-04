import { IntegrationError } from "./shopee.ts";
export async function readLimitedObject(request:Request,maxBytes=4096):Promise<Record<string,unknown>> {
  const declared=Number(request.headers.get("Content-Length"));
  if(Number.isFinite(declared)&&declared>maxBytes)throw new IntegrationError("invalid_request","Solicitação muito grande.",413);
  const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
  if(reader){
    try {
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new IntegrationError("invalid_request","Solicitação muito grande.",413);}chunks.push(value);}
    }finally{reader.releaseLock();}
  }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body:unknown;
  try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new IntegrationError("invalid_request","Solicitação inválida.",400);}
  if(!body||typeof body!=="object"||Array.isArray(body))throw new IntegrationError("invalid_request","Solicitação inválida.",400);
  return body as Record<string,unknown>;
}
