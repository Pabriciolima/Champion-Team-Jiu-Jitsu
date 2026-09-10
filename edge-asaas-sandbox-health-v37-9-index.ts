import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers});
  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const caller=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{
      global:{headers:{Authorization:req.headers.get("Authorization")||""}},
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const {data:auth,error:authError}=await caller.auth.getUser();
    if(authError||!auth.user) return json({error:"unauthorized"},401);
    const {data:profile}=await admin.from("profiles").select("role,active").eq("id",auth.user.id).single();
    if(!profile?.active||!["master_admin","owner"].includes(profile.role)) return json({error:"forbidden"},403);

    const key=Deno.env.get("ASAAS_API_KEY")||"";
    const env=(Deno.env.get("ASAAS_ENV")||"sandbox").toLowerCase();
    const base=env==="sandbox"?"https://api-sandbox.asaas.com/v3":"https://api.asaas.com/v3";
    const result:any={env,keyConfigured:!!key,apiOk:false};
    if(!key) return json(result,503);
    const response=await fetch(base+"/customers?limit=1",{headers:{access_token:key}});
    result.apiOk=response.ok;
    result.apiHttp=response.status;
    return json(result,response.ok?200:502);
  }catch(error){
    console.error("asaas-health",error);
    return json({error:"health_check_failed"},500);
  }
});
