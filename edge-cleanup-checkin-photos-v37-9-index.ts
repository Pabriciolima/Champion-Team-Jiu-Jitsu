import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{"Content-Type":"application/json"}
});

async function sha256(value:string){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async(req)=>{
  try{
    if(req.method!=="POST") return json({error:"method_not_allowed"},405);
    const supplied=req.headers.get("x-cron-token")||"";
    const expectedHash="50bdbb1580cbf0ef685ba8a6851f98fe6871b8a26a5b39d8e0286153fa03428e";
    if(!expectedHash||!supplied||await sha256(supplied)!==expectedHash){
      return json({error:"unauthorized"},401);
    }

    const admin=createClient(
      Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {auth:{persistSession:false,autoRefreshToken:false}}
    );
    const nowIso=new Date().toISOString();
    const {data:rows,error:rowsError}=await admin.from("checkins")
      .select("id,photo_url,photo_expires_at")
      .not("photo_url","is",null).lte("photo_expires_at",nowIso).limit(500);
    if(rowsError) throw rowsError;

    const paths=(rows||[]).map((row:any)=>row.photo_url)
      .filter((path:any)=>typeof path==="string"&&path&&!/^https?:\/\//i.test(path));
    let removed=0;
    if(paths.length){
      const {data,error}=await admin.storage.from("checkins").remove(paths);
      if(error) throw error;
      removed=data?.length||0;
    }
    const ids=(rows||[]).map((row:any)=>row.id);
    if(ids.length){
      const {error}=await admin.from("checkins").update({photo_url:null,photo_deleted_at:nowIso}).in("id",ids);
      if(error) throw error;
    }
    return json({ok:true,checked:rows?.length||0,removed,cleaned_at:nowIso});
  }catch(error){
    console.error("cleanup-checkin-photos",error);
    return json({error:"cleanup_failed"},500);
  }
});
