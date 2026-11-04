// Superfície mínima utilizada pelo backend; o empacotamento final é validado pelo Supabase.
declare const Deno: {
  env: { get(name:string):string|undefined };
  serve(handler:(request:Request)=>Response|Promise<Response>):unknown;
};
