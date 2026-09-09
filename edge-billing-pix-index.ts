import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

const digits=(v="")=>String(v).replace(/\D/g,"");

async function asaas(path:string,init:RequestInit={}){
  const key=Deno.env.get("ASAAS_API_KEY");
  if(!key) throw new Error("ASAAS_API_KEY não configurada.");
  const sandbox=(Deno.env.get("ASAAS_ENV")||"production").toLowerCase()==="sandbox";
  const base=sandbox?"https://api-sandbox.asaas.com/v3":"https://api.asaas.com/v3";
  const r=await fetch(base+path,{...init,headers:{"Content-Type":"application/json","access_token":key,...(init.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.errors?.[0]?.description||data?.message||`Asaas HTTP ${r.status}`);
  return data;
}

async function ensureCustomer(admin:any,student:any,payment:any){
  if(payment.provider_customer_id) return payment.provider_customer_id;
  const customer=await asaas("/customers",{method:"POST",body:JSON.stringify({
    name:student.full_name,email:student.email||undefined,mobilePhone:digits(student.phone)||undefined,
    cpfCnpj:digits(student.cpf)||undefined,externalReference:student.id,notificationDisabled:false
  })});
  await admin.from("payments").update({provider:"asaas",provider_customer_id:customer.id,updated_at:new Date().toISOString()}).eq("id",payment.id);

  if((Deno.env.get("ASAAS_ENABLE_WHATSAPP")||"").toLowerCase()==="true"){
    try{
      const list=await asaas(`/customers/${customer.id}/notifications`);
      for(const n of list?.data||[]){
        if(!["PAYMENT_DUEDATE_WARNING","PAYMENT_OVERDUE"].includes(n.event)) continue;
        await asaas(`/notifications/${n.id}`,{method:"PUT",body:JSON.stringify({
          enabled:true,emailEnabledForCustomer:true,smsEnabledForCustomer:true,whatsappEnabledForCustomer:true
        })});
      }
    }catch(e){console.warn("WhatsApp não ativado:",e)}
  }
  return customer.id;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  try{
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}},auth:{persistSession:false,autoRefreshToken:false}});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:authData,error:authError}=await caller.auth.getUser();
    if(authError||!authData.user)return new Response(JSON.stringify({error:"Sessão inválida."}),{status:401,headers});

    const {data:profile}=await admin.from("profiles").select("id,role,academy_id,active").eq("id",authData.user.id).single();
    if(!profile?.active)throw new Error("Perfil não autorizado.");

    const body=await req.json(),paymentId=String(body.payment_id||"");
    const {data:payment,error:pe}=await admin.from("payments").select("*").eq("id",paymentId).single(); if(pe)throw pe;
    const {data:student,error:se}=await admin.from("students").select("*").eq("id",payment.student_id).single(); if(se)throw se;

    if(profile.role==="student"&&student.profile_id!==authData.user.id)return new Response(JSON.stringify({error:"Acesso negado."}),{status:403,headers});
    if(profile.role==="owner"&&payment.academy_id!==profile.academy_id)return new Response(JSON.stringify({error:"Acesso negado."}),{status:403,headers});
    if(!["student","owner","master_admin"].includes(profile.role))return new Response(JSON.stringify({error:"Perfil sem permissão."}),{status:403,headers});
    if(payment.status==="paid")throw new Error("Mensalidade já paga.");

    if(payment.external_id&&payment.pix_copy_paste&&payment.pix_qr_code_base64){
      return new Response(JSON.stringify({ok:true,payment}),{headers});
    }

    const customerId=await ensureCustomer(admin,student,payment);
    let chargeId=payment.external_id,invoiceUrl=payment.invoice_url;
    if(!chargeId){
      const charge=await asaas("/payments",{method:"POST",body:JSON.stringify({
        customer:customerId,billingType:"PIX",value:Number(payment.amount),dueDate:payment.due_date,
        description:`Mensalidade Champion Team - ${student.full_name}`,externalReference:payment.id
      })});
      chargeId=charge.id;invoiceUrl=charge.invoiceUrl||null;
    }

    const pix=await asaas(`/payments/${chargeId}/pixQrCode`);
    await admin.from("payments").update({
      provider:"asaas",provider_customer_id:customerId,external_id:chargeId,invoice_url:invoiceUrl,
      pix_copy_paste:pix.payload,pix_qr_code_base64:pix.encodedImage,updated_at:new Date().toISOString()
    }).eq("id",payment.id);

    await admin.from("billing_events").upsert({
      academy_id:payment.academy_id,payment_id:payment.id,student_id:payment.student_id,
      event_key:`${payment.id}:pix:${chargeId}`,event_type:"pix_generated",title:"Pix gerado",
      message:"Cobrança Pix disponibilizada para o aluno.",channel:"asaas"
    },{onConflict:"event_key"});

    return new Response(JSON.stringify({ok:true,payment_id:payment.id,pix_copy_paste:pix.payload,pix_qr_code_base64:pix.encodedImage,invoice_url:invoiceUrl}),{headers});
  }catch(e){return new Response(JSON.stringify({error:String(e?.message||e)}),{status:400,headers})}
});
