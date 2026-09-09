import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async(req)=>{
  try{
    const expected=Deno.env.get("ASAAS_WEBHOOK_TOKEN")||"";
    const received=req.headers.get("asaas-access-token")||req.headers.get("x-webhook-token")||"";
    if(expected&&received!==expected)return new Response("unauthorized",{status:401});

    const body=await req.json(),event=String(body.event||""),ap=body.payment||{},ref=String(ap.externalReference||"");
    if(!ref)return new Response(JSON.stringify({ok:true,ignored:true}),{headers:{"Content-Type":"application/json"}});

    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const {data:p,error}=await admin.from("payments").select("*").eq("id",ref).single();
    if(error||!p)return new Response(JSON.stringify({ok:true,ignored:"payment not found"}),{headers:{"Content-Type":"application/json"}});

    let status=p.status,paidAt=p.paid_at;
    if(["PAYMENT_RECEIVED","PAYMENT_CONFIRMED"].includes(event)){status="paid";paidAt=new Date().toISOString()}
    else if(event==="PAYMENT_OVERDUE")status="overdue";
    else if(event==="PAYMENT_REFUNDED")status="refunded";
    else if(event==="PAYMENT_DELETED")status="cancelled";

    await admin.from("payments").update({status,paid_at:paidAt,external_id:ap.id||p.external_id,invoice_url:ap.invoiceUrl||p.invoice_url,updated_at:new Date().toISOString()}).eq("id",p.id);
    await admin.from("billing_events").upsert({
      academy_id:p.academy_id,payment_id:p.id,student_id:p.student_id,event_key:`${p.id}:webhook:${event}:${ap.id||"asaas"}`,
      event_type:event.toLowerCase(),title:status==="paid"?"Pagamento confirmado":"Atualização de cobrança",
      message:status==="paid"?"Pagamento da mensalidade confirmado automaticamente.":`Evento Asaas: ${event}.`,channel:"asaas_webhook"
    },{onConflict:"event_key"});

    if(status==="paid")await admin.from("notifications").insert({
      academy_id:p.academy_id,student_id:p.student_id,audience:"student",title:"Pagamento confirmado ✅",
      message:"Recebemos sua mensalidade. Obrigado!",type:"success"
    });

    return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json"}});
  }catch(e){return new Response(JSON.stringify({error:String(e?.message||e)}),{status:400,headers:{"Content-Type":"application/json"}})}
});
