import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={
  "Content-Type":"application/json",
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const cleanEmail=(value="")=>String(value||"").trim().toLowerCase();
const cleanCpf=(value="")=>String(value||"").replace(/\D/g,"");
const validEmail=(value="")=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(value));

async function findUserByEmail(admin:any,email:string){
  for(let page=1;page<=20;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    if(error) throw error;
    const found=(data.users||[]).find((item:any)=>cleanEmail(item.email)===email);
    if(found) return found;
    if((data.users||[]).length<1000) break;
  }
  return null;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization=req.headers.get("Authorization")||"";
    const caller=createClient(url,anonKey,{
      global:{headers:{Authorization:authorization}},
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:authData,error:authError}=await caller.auth.getUser();
    if(authError||!authData.user) return json({error:"Sua sessão expirou. Entre novamente."},401);

    const {data:profile,error:profileError}=await admin.from("profiles")
      .select("id,academy_id,role,active,full_name,email")
      .eq("id",authData.user.id).single();
    if(profileError) throw profileError;
    if(!profile?.active) return json({error:"Perfil sem autorização."},403);

    const body=await req.json();
    const action=String(body.action||"");

    if(action==="create_or_repair"){
      if(!["master_admin","owner"].includes(profile.role)){
        return json({error:"Somente a administração pode criar ou reparar acessos."},403);
      }
      const entityRole=String(body.role||"");
      const entityId=String(body.entity_id||"");
      const email=cleanEmail(body.email);
      const password=String(body.password||"");
      const fullName=String(body.full_name||"").trim();
      const cpf=cleanCpf(body.cpf);
      const requestedAuthUid=String(body.auth_uid||"");
      if(!["student","teacher"].includes(entityRole)) throw new Error("Tipo de acesso inválido.");
      if(!entityId||!fullName||!validEmail(email)) throw new Error("Nome, cadastro e e-mail válidos são obrigatórios.");
      if(password&&password.length<6) throw new Error("A senha inicial precisa ter pelo menos 6 caracteres.");

      const table=entityRole==="student"?"students":"teachers";
      const {data:entity,error:entityError}=await admin.from(table)
        .select("id,academy_id,profile_id,email")
        .eq("id",entityId).maybeSingle();
      if(entityError) throw entityError;
      const academyId=entity?.academy_id||profile.academy_id;
      if(profile.role==="owner"&&academyId!==profile.academy_id){
        return json({error:"Cadastro pertence a outra academia."},403);
      }

      let authUser:any=null;
      const authUid=requestedAuthUid||entity?.profile_id||"";
      if(authUid){
        const {data}=await admin.auth.admin.getUserById(authUid);
        authUser=data?.user||null;
      }
      if(!authUser) authUser=await findUserByEmail(admin,email);

      const attributes:any={
        email,
        email_confirm:true,
        user_metadata:{full_name:fullName},
        app_metadata:{role:entityRole,academy_id:academyId}
      };
      if(password) attributes.password=password;

      if(authUser){
        const {data,error}=await admin.auth.admin.updateUserById(authUser.id,attributes);
        if(error) throw error;
        authUser=data.user;
      }else{
        if(!password) throw new Error("Informe a senha inicial para criar o acesso.");
        const {data,error}=await admin.auth.admin.createUser(attributes);
        if(error) throw error;
        authUser=data.user;
      }
      if(!authUser) throw new Error("O Supabase Auth não retornou o usuário.");

      const {error:profileUpsertError}=await admin.from("profiles").upsert({
        id:authUser.id,academy_id:academyId,role:entityRole,full_name:fullName,
        email,cpf:cpf||null,active:true,updated_at:new Date().toISOString()
      },{onConflict:"id"});
      if(profileUpsertError) throw profileUpsertError;

      const {error:linkError}=await admin.from(table).update({
        profile_id:authUser.id,email,full_name:fullName,
        ...(cpf?{cpf}:{}),updated_at:new Date().toISOString()
      }).eq("id",entityId).eq("academy_id",academyId);
      if(linkError) throw linkError;

      await admin.from("audit_logs").insert({
        academy_id:academyId,actor_profile_id:profile.id,action:"user_access_provisioned",
        entity:table,entity_id:entityId,
        payload:{role:entityRole,email,auth_uid:authUser.id,password_reset:!!password}
      });
      return json({ok:true,uid:authUser.id,email,created:!authUid});
    }

    if(action==="update_self_credentials"){
      const currentPassword=String(body.current_password||"");
      const newPassword=String(body.new_password||"");
      const newEmail=cleanEmail(body.new_email||authData.user.email||"");
      if(!currentPassword) throw new Error("Informe sua senha atual.");
      if(newPassword&&newPassword.length<6) throw new Error("A nova senha precisa ter pelo menos 6 caracteres.");
      if(!validEmail(newEmail)) throw new Error("Informe um novo e-mail válido.");
      if(!newPassword&&newEmail===cleanEmail(authData.user.email)) throw new Error("Nenhuma alteração foi informada.");

      const verifier=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const {error:verifyError}=await verifier.auth.signInWithPassword({
        email:cleanEmail(authData.user.email),password:currentPassword
      });
      if(verifyError) throw new Error("Senha atual incorreta.");

      if(newEmail!==cleanEmail(authData.user.email)){
        const existing=await findUserByEmail(admin,newEmail);
        if(existing&&existing.id!==authData.user.id) throw new Error("Este e-mail já está sendo utilizado.");
      }

      const attributes:any={};
      if(newPassword) attributes.password=newPassword;
      if(newEmail!==cleanEmail(authData.user.email)){
        attributes.email=newEmail;
        attributes.email_confirm=true;
      }
      const {data:updated,error:updateError}=await admin.auth.admin.updateUserById(authData.user.id,attributes);
      if(updateError) throw updateError;

      if(attributes.email){
        const now=new Date().toISOString();
        const {error:profileUpdateError}=await admin.from("profiles")
          .update({email:newEmail,updated_at:now}).eq("id",authData.user.id);
        if(profileUpdateError) throw profileUpdateError;
        if(profile.role==="student"){
          const {error}=await admin.from("students").update({email:newEmail,updated_at:now}).eq("profile_id",authData.user.id);
          if(error) throw error;
        }else if(profile.role==="teacher"){
          const {error}=await admin.from("teachers").update({email:newEmail,updated_at:now}).eq("profile_id",authData.user.id);
          if(error) throw error;
        }
      }
      await admin.from("audit_logs").insert({
        academy_id:profile.academy_id,actor_profile_id:profile.id,action:"user_credentials_updated",
        entity:"profiles",entity_id:profile.id,
        payload:{email_changed:!!attributes.email,password_changed:!!attributes.password}
      });
      return json({ok:true,email:updated.user?.email||newEmail,password_changed:!!attributes.password});
    }

    return json({error:"Ação inválida."},400);
  }catch(error){
    console.error("user-access",error);
    return json({error:String((error as any)?.message||error)},400);
  }
});
