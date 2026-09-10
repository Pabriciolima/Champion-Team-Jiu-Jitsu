import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
const digits=(value="")=>String(value||"").replace(/\D/g,"");
const isSandbox=()=>((Deno.env.get("ASAAS_ENV")||"sandbox").toLowerCase()==="sandbox");

function validCpf(raw=""){
  const cpf=digits(raw);if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;
  let sum=0;for(let i=0;i<9;i++)sum+=Number(cpf[i])*(10-i);
  let check=(sum*10)%11;if(check===10)check=0;if(check!==Number(cpf[9]))return false;
  sum=0;for(let i=0;i<10;i++)sum+=Number(cpf[i])*(11-i);
  check=(sum*10)%11;if(check===10)check=0;return check===Number(cpf[10]);
}

function sandboxCpf(seed=""){
  let hash=2166136261;for(const char of String(seed)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)>>>0}
  let base=String(hash%1000000000).padStart(9,"0");if(/^(\d)\1{8}$/.test(base))base="529982247";
  const calc=(value:string,factor:number)=>{let sum=0;for(const char of value)sum+=Number(char)*factor--;const r=(sum*10)%11;return r===10?0:r};
  base+=String(calc(base,10));base+=String(calc(base,11));return base;
}

async function asaas(path:string,init:RequestInit={}){
  const key=Deno.env.get("ASAAS_API_KEY");if(!key)throw new Error("Integração Asaas indisponível.");
  const base=isSandbox()?"https://api-sandbox.asaas.com/v3":"https://api.asaas.com/v3";
  const response=await fetch(base+path,{...init,headers:{"Content-Type":"application/json",access_token:key,...(init.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.errors?.map((e:any)=>e?.description).filter(Boolean).join(" | ")||data?.message||`Asaas HTTP ${response.status}`);
  return data;
}

async function ensureCustomer(admin:any,student:any,payment:any){
  const cpf=validCpf(student.cpf)?digits(student.cpf):isSandbox()?sandboxCpf(student.id):"";
  if(!cpf)throw new Error("Cadastre um CPF válido para gerar a cobrança PIX.");
  const customerBody:any={name:student.full_name,cpfCnpj:cpf,externalReference:`student:${student.id}`,notificationDisabled:false};
  if(student.email)customerBody.email=student.email;
  const phone=digits(student.phone);if(phone.length>=10&&phone.length<=13)customerBody.mobilePhone=phone;
  let customerId=payment.provider_customer_id||"";
  if(customerId){
    const remote=await asaas(`/customers/${customerId}`);
    if(digits(remote?.cpfCnpj)!==cpf)await asaas(`/customers/${customerId}`,{method:"PUT",body:JSON.stringify(customerBody)});
  }else{
    const customer=await asaas("/customers",{method:"POST",body:JSON.stringify(customerBody)});customerId=customer.id;
  }
  await admin.from("payments").update({provider:"asaas",provider_customer_id:customerId,updated_at:new Date().toISOString()}).eq("id",payment.id);
  return customerId;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const caller=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:req.headers.get("Authorization")||""}},auth:{persistSession:false,autoRefreshToken:false}});
    const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:authData,error:authError}=await caller.auth.getUser();if(authError||!authData.user)return json({error:"Sessão inválida."},401);
    const {data:profile}=await admin.from("profiles").select("id,role,academy_id,active").eq("id",authData.user.id).single();if(!profile?.active)return json({error:"Perfil não autorizado."},403);
    const body=await req.json(),action=String(body.action||"ensure_charge"),paymentId=String(body.payment_id||"");
    const {data:payment,error:paymentError}=await admin.from("payments").select("*").eq("id",paymentId).single();if(paymentError)throw paymentError;
    const {data:student,error:studentError}=await admin.from("students").select("*").eq("id",payment.student_id).single();if(studentError)throw studentError;
    if(profile.role==="student"&&student.profile_id!==authData.user.id)return json({error:"Acesso negado."},403);
    if(profile.role==="owner"&&payment.academy_id!==profile.academy_id)return json({error:"Acesso negado."},403);
    if(!["student","owner","master_admin"].includes(profile.role))return json({error:"Perfil sem permissão."},403);

    if(action==="check_payment"){
      if(payment.status==="paid")return json({ok:true,status:"paid",newly_confirmed:false});
      if(!payment.external_id)return json({ok:true,status:payment.status,newly_confirmed:false});
      const remote=await asaas(`/payments/${payment.external_id}`);
      const paid=["RECEIVED","CONFIRMED","RECEIVED_IN_CASH"].includes(String(remote?.status||"").toUpperCase());
      if(!paid)return json({ok:true,status:payment.status,provider_status:remote?.status||null,newly_confirmed:false});
      const paidAt=remote?.confirmedDate||remote?.paymentDate||remote?.clientPaymentDate||new Date().toISOString();
      const {data:updated}=await admin.from("payments").update({status:"paid",paid_at:paidAt,invoice_url:remote?.invoiceUrl||payment.invoice_url,updated_at:new Date().toISOString()}).eq("id",payment.id).neq("status","paid").select("id");
      const newlyConfirmed=!!updated?.length;
      await admin.from("billing_events").upsert({academy_id:payment.academy_id,payment_id:payment.id,student_id:payment.student_id,event_key:`${payment.id}:reconciled:${payment.external_id}`,event_type:"payment_reconciled",title:"Pagamento confirmado",message:"Mensalidade confirmada automaticamente pelo Asaas.",channel:"asaas_polling"},{onConflict:"event_key"});
      if(newlyConfirmed)await admin.from("notifications").insert([
        {academy_id:payment.academy_id,student_id:payment.student_id,audience:"student",title:"Pagamento confirmado ✅",message:"Recebemos sua mensalidade. Obrigado!",type:"success"},
        {academy_id:payment.academy_id,student_id:null,audience:"admin",title:"Mensalidade paga ✅",message:`Pagamento de ${student.full_name} confirmado automaticamente pelo Asaas.`,type:"success"}
      ]);
      return json({ok:true,status:"paid",newly_confirmed:newlyConfirmed});
    }

    if(payment.status==="paid")throw new Error("Mensalidade já paga.");
    if(payment.external_id&&payment.pix_copy_paste&&payment.pix_qr_code_base64)return json({ok:true,payment});
    const customerId=await ensureCustomer(admin,student,payment);let chargeId=payment.external_id,invoiceUrl=payment.invoice_url;
    if(!chargeId){const charge=await asaas("/payments",{method:"POST",body:JSON.stringify({customer:customerId,billingType:"PIX",value:Number(payment.amount),dueDate:payment.due_date,description:`Mensalidade Champion Team - ${student.full_name}`,externalReference:payment.id})});chargeId=charge.id;invoiceUrl=charge.invoiceUrl||null}
    const pix=await asaas(`/payments/${chargeId}/pixQrCode`);
    await admin.from("payments").update({provider:"asaas",provider_customer_id:customerId,external_id:chargeId,invoice_url:invoiceUrl,pix_copy_paste:pix.payload,pix_qr_code_base64:pix.encodedImage,updated_at:new Date().toISOString()}).eq("id",payment.id);
    await admin.from("billing_events").upsert({academy_id:payment.academy_id,payment_id:payment.id,student_id:payment.student_id,event_key:`${payment.id}:pix:${chargeId}`,event_type:"pix_generated",title:"Pix gerado",message:"Cobrança Pix disponibilizada para o aluno.",channel:"asaas"},{onConflict:"event_key"});
    return json({ok:true,payment_id:payment.id,pix_copy_paste:pix.payload,pix_qr_code_base64:pix.encodedImage,invoice_url:invoiceUrl});
  }catch(error){console.error("billing-pix",error);return json({error:String((error as any)?.message||error)},400)}
});
