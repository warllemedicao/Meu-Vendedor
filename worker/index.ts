interface WorkerEnv {
  ASSETS: { fetch(request:Request):Promise<Response> };
  MV_SYNC_JOB_TOKEN: string;
}
const worker = {
  fetch(request:Request,env:WorkerEnv) { return env.ASSETS.fetch(request); },
  async scheduled(_controller:unknown,env:WorkerEnv) {
    if(!env.MV_SYNC_JOB_TOKEN)throw new Error("marketplace_scheduler_not_configured");
    const response=await fetch("https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/marketplace",{
      method:"POST",headers:{"x-mv-job-token":env.MV_SYNC_JOB_TOKEN,"Content-Type":"application/json"},
      body:"{}",signal:AbortSignal.timeout(140000),redirect:"error",
    });
    if(!response.ok)throw new Error(`marketplace_scheduler_http_${response.status}`);
  },
};

export default worker;
