import { flowError, missingFlowDiagnostic, readFlowDiagnostic } from "./flow-diagnostics.ts";

export type FlowMode = "navigate" | "inspect" | "create-project" | "inspect-editor" | "stage-prompt" | "prepare-draft" | "prepare-image" | "inspect-settings";
type Options = { target?: string; secret?: string; endpoint: unknown; mode: FlowMode; traceId: string; prompt?: string; imageMime?: string; imageBase64?: string; images?: Array<{mime:string;data:string}>; imageRightsConfirmed?: boolean };
export async function requestFlowExecutor(options: Options, fetcher: typeof fetch = fetch): Promise<boolean | Record<string, unknown>> {
 const {target, secret, endpoint, mode, traceId, prompt, imageMime, imageBase64, images, imageRightsConfirmed}=options;
 const started=Date.now();
 const failure=(reason:string, diagnostics?:unknown)=>({error:flowError(reason), diagnostics:readFlowDiagnostic(diagnostics,traceId,mode)??missingFlowDiagnostic(traceId,mode,reason,Date.now()-started)});
 if(!target||!secret||typeof endpoint!=="string") return mode==="navigate"?false:failure("executor_not_configured");
 try{
  const url=new URL(target);
  if(url.protocol!=="https:") return mode==="navigate"?false:failure("executor_not_configured");
  const result=await fetcher(url.toString(),{method:"POST",redirect:"error",headers:{authorization:"Bearer "+secret,"content-type":"application/json"},body:JSON.stringify({wsEndpoint:endpoint,mode,traceId,...(["stage-prompt","prepare-draft","prepare-image"].includes(mode)?{prompt}:{}),...(mode==="prepare-image"?{imageMime,imageBase64,imageRightsConfirmed}:{}),...(mode==="prepare-draft"&&images?.length?{images,imageRightsConfirmed}:{})}),signal:AbortSignal.timeout(mode==="prepare-draft"?105000:55000)});
  const parsed:unknown=await result.json().catch(()=>({}));
  const body:Record<string,unknown>=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};
  if(mode==="navigate") return result.ok&&body.navigationReady===true;
  if(!result.ok){
   const detail=body.detail;
   const details=detail&&typeof detail==="object"?detail as Record<string,unknown>:{};
   const code=flowError(typeof detail==="string"?detail:details.code);
   const diagnostic=failure(code,details.diagnostics);
   console.warn("flow_executor_result",JSON.stringify({traceId,status:result.status,diagnostics:diagnostic.diagnostics}));
   return diagnostic;
  }
  if(body.inspectionReady!==true) return failure("flow_inspection_unavailable");
  const diagnostics=readFlowDiagnostic(body.diagnostics,traceId,mode)??missingFlowDiagnostic(traceId,mode,"executor_report_unavailable",Date.now()-started);
  console.info("flow_executor_result",JSON.stringify({traceId,status:result.status,diagnostics}));
  return {...body,diagnostics};
 }catch(error){
  const reason=error instanceof Error&&["TimeoutError","AbortError"].includes(error.name)?"flow_executor_timeout":"flow_inspection_unavailable";
  const diagnostic=failure(reason);
  console.warn("flow_executor_result",JSON.stringify({traceId,diagnostics:diagnostic.diagnostics}));
  return mode==="navigate"?false:diagnostic;
 }
}
