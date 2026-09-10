import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={
  "Content-Type":"application/json",
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const digits=(value="")=>String(value||"").replace(/\D/g,"");
const validEmail=(value="")=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));

function validCpf(raw=""){
  const cpf=digits(raw);
  if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf)) return false;
  let sum=0;
  for(let i=0;i<9;i++) sum+=Number(cpf[i])*(10-i);
  let check=(sum*10)%11;
  if(check===10) check=0;
  if(check!==Number(cpf[9])) return false;
  sum=0;
  for(let i=0;i<10;i++) sum+=Number(cpf[i])*(11-i);
  check=(sum*10)%11;
  if(check===10) check=0;
  return check===Number(cpf[10]);
}

function sandboxCpf(seed=""){
  let hash=2166136261;
  for(const char of String(seed)){
    hash^=char.charCodeAt(0);
    hash=Math.imul(hash,16777619)>>>0;
  }
  let base=String(hash%1000000000).padStart(9,"0");
  if(/^(\d)\1{8}$/.test(base)) base="529982247";
  const calc=(value:string,factor:number)=>{
    let sum=0;
    for(const char of value) sum+=Number(char)*factor--;
    const remainder=(sum*10)%11;
    return remainder===10?0:remainder;
  };
  base+=String(calc(base,10));
  base+=String(calc(base,11));
  return base;
}

const isSandbox=()=>((Deno.env.get("ASAAS_ENV")||"sandbox").toLowerCase()==="sandbox");
const todayBelem=()=>new Intl.DateTimeFormat("en-CA",{
  timeZone:"America/Belem",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date());

async function asaas(path:string,init:RequestInit={}){
  const key=Deno.env.get("ASAAS_API_KEY");
  if(!key) throw new Error("Integração Asaas indisponível: chave não configurada.");
  const base=isSandbox()?"https://api-sandbox.asaas.com/v3":"https://api.asaas.com/v3";
  const response=await fetch(base+path,{
    ...init,
    headers:{"Content-Type":"application/json","access_token":key,...(init.headers||{})}
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const detail=data?.errors?.map((error:any)=>error?.description).filter(Boolean).join(" | ")
      ||data?.message||`HTTP ${response.status}`;
    console.error("ASAAS",path,response.status,data);
    throw new Error(`Asaas: ${detail}`);
  }
  return data;
}

async function ensureCustomer(admin:any,student:any){
  const studentCpf=digits(student.cpf);
  const cpfCnpj=validCpf(studentCpf)
    ? studentCpf
    : isSandbox()
      ? sandboxCpf(student.id)
      : "";

  if(!cpfCnpj){
    throw new Error("Cadastre um CPF válido para gerar a cobrança PIX.");
  }

  const {data:existing,error:existingError}=await admin
    .from("store_customers")
    .select("provider_customer_id")
    .eq("student_id",student.id)
    .maybeSingle();
  if(existingError) throw existingError;

  const customerBody:any={
    name:student.full_name,
    cpfCnpj,
    externalReference:`student:${student.id}`,
    notificationDisabled:false
  };
  if(validEmail(student.email)) customerBody.email=student.email;
  const phone=digits(student.phone);
  if(phone.length>=10&&phone.length<=13) customerBody.mobilePhone=phone;

  let customerId=existing?.provider_customer_id||"";
  if(customerId){
    const remote=await asaas(`/customers/${customerId}`,{method:"GET"});
    const remoteCpf=digits(remote?.cpfCnpj);
    if(remoteCpf!==cpfCnpj){
      await asaas(`/customers/${customerId}`,{method:"PUT",body:JSON.stringify(customerBody)});
    }
  }else{
    const customer=await asaas("/customers",{method:"POST",body:JSON.stringify(customerBody)});
    customerId=customer.id;
    const {error}=await admin.from("store_customers").upsert({
      academy_id:student.academy_id,
      student_id:student.id,
      provider:"asaas",
      provider_customer_id:customerId,
      updated_at:new Date().toISOString()
    },{onConflict:"student_id"});
    if(error) throw error;
  }
  return customerId;
}

async function cancelOrder(admin:any,order:any,actorId:string|null,reason:string){
  if(order.provider_payment_id){
    try{
      await asaas(`/payments/${order.provider_payment_id}`,{method:"DELETE"});
    }catch(error){
      console.warn("Não foi possível remover a cobrança no Asaas",error);
    }
  }
  const {data,error}=await admin.rpc("cancel_store_order",{
    p_order_id:order.id,
    p_actor_profile_id:actorId,
    p_reason:reason
  });
  if(error) throw error;
  return data;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller=createClient(url,anon,{
      global:{headers:{Authorization:req.headers.get("Authorization")||""}},
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

    const {data:authData,error:authError}=await caller.auth.getUser();
    if(authError||!authData.user) return json({error:"Sua sessão expirou. Entre novamente."},401);

    const {data:profile,error:profileError}=await admin
      .from("profiles")
      .select("id,role,academy_id,active")
      .eq("id",authData.user.id)
      .single();
    if(profileError) throw profileError;
    if(!profile?.active) return json({error:"Perfil sem autorização."},403);

    const body=await req.json();
    const action=String(body.action||"checkout");

    if(action==="cancel_order"){
      if(!["owner","master_admin"].includes(profile.role)){
        return json({error:"Somente a administração pode cancelar reservas."},403);
      }
      const orderId=String(body.order_id||"");
      let query=admin.from("orders")
        .select("id,academy_id,student_id,status,code,provider_payment_id")
        .eq("id",orderId);
      if(profile.role==="owner") query=query.eq("academy_id",profile.academy_id);
      const {data:order,error}=await query.single();
      if(error) throw error;
      if(order.status!=="pending") throw new Error("Somente pedidos aguardando PIX podem ser cancelados.");
      const result=await cancelOrder(admin,order,profile.id,"admin_cancelled_reservation");
      await admin.from("notifications").insert({
        academy_id:order.academy_id,
        student_id:order.student_id,
        audience:"student",
        title:"Reserva cancelada",
        message:`O pedido ${order.code||""} foi cancelado pela academia e os itens foram liberados.`,
        type:"warning"
      });
      return json({ok:true,...result});
    }

    if(profile.role!=="student"){
      return json({error:"Somente alunos podem finalizar compras."},403);
    }

    const {data:student,error:studentError}=await admin
      .from("students")
      .select("*")
      .eq("profile_id",authData.user.id)
      .single();
    if(studentError) throw studentError;

    if(action==="expire_order"){
      const orderId=String(body.order_id||"");
      const {data:order,error}=await admin.from("orders")
        .select("id,academy_id,student_id,status,code,provider_payment_id,reservation_expires_at")
        .eq("id",orderId)
        .eq("student_id",student.id)
        .single();
      if(error) throw error;
      if(order.status!=="pending") return json({ok:true,status:order.status});
      if(order.reservation_expires_at&&Date.now()<new Date(order.reservation_expires_at).getTime()){
        return json({ok:true,status:"pending"});
      }
      const result=await cancelOrder(admin,order,student.profile_id,"expired");
      return json({ok:true,...result});
    }

    const items=Array.isArray(body.items)?body.items:[];
    const paymentOption=String(body.payment_option||"pix_full");
    if(!items.length) throw new Error("Carrinho vazio.");
    if(!["pix_full","pix_deposit"].includes(paymentOption)){
      throw new Error("Selecione PIX integral ou PIX sinal.");
    }
    const cleanItems=items.map((item:any)=>(
      {product_id:String(item.product_id||""),quantity:Math.max(1,Math.floor(Number(item.quantity||1)))}
    )).filter((item:any)=>item.product_id);
    if(!cleanItems.length) throw new Error("Nenhum produto válido no carrinho.");

    const {data:reserved,error:reserveError}=await admin.rpc("reserve_store_order",{
      p_academy_id:student.academy_id,
      p_student_id:student.id,
      p_items:cleanItems,
      p_payment_option:paymentOption,
      p_deposit_percent:30
    });
    if(reserveError) throw reserveError;

    const orderId=reserved.order_id;
    let chargeId="";
    try{
      const customerId=await ensureCustomer(admin,student);
      const charge=await asaas("/payments",{method:"POST",body:JSON.stringify({
        customer:customerId,
        billingType:"PIX",
        value:Number(Number(reserved.amount_due_now).toFixed(2)),
        dueDate:todayBelem(),
        description:paymentOption==="pix_deposit"
          ?`Sinal de 30% - pedido ${reserved.code} - Champion Team`
          :`Pedido ${reserved.code} - Champion Team`,
        externalReference:`order:${orderId}`
      })});
      chargeId=charge.id;
      const pix=await asaas(`/payments/${chargeId}/pixQrCode`,{method:"GET"});
      if(!pix?.payload||!pix?.encodedImage) throw new Error("O Asaas não retornou o QR Code do PIX.");

      const expiresAt=reserved.reservation_expires_at;
      const {error:updateError}=await admin.from("orders").update({
        provider:"asaas",
        provider_payment_id:chargeId,
        pix_copy_paste:pix.payload,
        pix_qr_code_base64:pix.encodedImage,
        pix_expires_at:expiresAt,
        invoice_url:charge.invoiceUrl||null,
        updated_at:new Date().toISOString()
      }).eq("id",orderId);
      if(updateError) throw updateError;

      await admin.from("notifications").insert([
        {academy_id:student.academy_id,student_id:student.id,audience:"student",title:"Pedido reservado por 5 minutos",message:`Pedido ${reserved.code} reservado. Valor do Pix: R$ ${Number(reserved.amount_due_now).toFixed(2).replace('.',',')}.`,type:"sale"},
        {academy_id:student.academy_id,student_id:null,audience:"admin",title:"Novo pedido aguardando Pix",message:`${student.full_name} reservou o pedido ${reserved.code}. Total R$ ${Number(reserved.total).toFixed(2).replace('.',',')}.`,type:"sale"}
      ]);

      return json({
        ok:true,
        order_id:orderId,
        code:reserved.code,
        total:Number(reserved.total),
        amount_due_now:Number(reserved.amount_due_now),
        remaining_balance:Number(reserved.remaining_balance),
        payment_option:paymentOption,
        pix_copy_paste:pix.payload,
        pix_qr_code_base64:pix.encodedImage,
        pix_expires_at:expiresAt,
        provider_payment_id:chargeId,
        sandbox:isSandbox()
      });
    }catch(paymentError){
      if(chargeId){
        try{await asaas(`/payments/${chargeId}`,{method:"DELETE"})}catch(error){console.warn(error)}
      }
      const {error:cancelError}=await admin.rpc("cancel_store_order",{
        p_order_id:orderId,
        p_actor_profile_id:student.profile_id,
        p_reason:"asaas_charge_rejected"
      });
      if(cancelError) console.error("Falha ao cancelar checkout recusado",cancelError);
      throw paymentError;
    }
  }catch(error){
    console.error("store-checkout",error);
    return json({error:String((error as any)?.message||error)},400);
  }
});
