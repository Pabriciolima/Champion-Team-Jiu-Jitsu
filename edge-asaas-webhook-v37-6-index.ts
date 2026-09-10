import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});

Deno.serve(async(req)=>{
  try{
    if(req.method!=="POST") return json({ok:true});
    const expected=Deno.env.get("ASAAS_WEBHOOK_TOKEN")||"";
    const received=req.headers.get("asaas-access-token")||req.headers.get("x-webhook-token")||"";
    if(!expected) return new Response("webhook secret not configured",{status:503});
    if(received!==expected) return new Response("unauthorized",{status:401});

    const body=await req.json();
    const eventId=String(body.id||"");
    const event=String(body.event||"");
    const payment=body.payment||{};
    const externalRef=String(payment.externalReference||"");
    const admin=createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {auth:{persistSession:false,autoRefreshToken:false}}
    );

    if(eventId){
      const {error}=await admin.from("asaas_webhook_events").insert({
        event_id:eventId,event_type:event,payment_id:payment.id||null,payload:body
      });
      if(error){
        if(String(error.code)==="23505") return json({ok:true,duplicate:true});
        throw error;
      }
    }
    if(!externalRef) return json({ok:true,ignored:true});

    if(externalRef.startsWith("order:")){
      const orderId=externalRef.slice(6);
      const {data:order,error}=await admin.from("orders")
        .select("*,students(full_name)").eq("id",orderId).single();
      if(error||!order) return json({ok:true,ignored:"order_not_found"});

      if(["PAYMENT_RECEIVED","PAYMENT_CONFIRMED"].includes(event)){
        const {data:confirmed,error:confirmError}=await admin.rpc("reconcile_store_order_payment",{
          p_order_id:orderId,
          p_provider_paid_at:payment.confirmedDate||payment.paymentDate||payment.clientPaymentDate||null,
          p_source:"asaas_webhook"
        });
        if(confirmError) throw confirmError;
        if(!confirmed?.ok){
          await admin.from("notifications").insert({
            academy_id:order.academy_id,student_id:null,audience:"admin",
            title:"Pagamento recebido após cancelamento manual",
            message:`O Asaas confirmou o pagamento do pedido ${order.code||""}, mas ele havia sido cancelado manualmente. Verifique a cobrança antes de entregar o item.`,
            type:"warning"
          });
          return json({ok:true,type:"order",status:confirmed?.status||"late_payment"});
        }
        const finalStatus=String(confirmed?.status||order.status);
        const deposit=order.payment_option==="pix_deposit";
        const studentName=order.students?.full_name||"Aluno";
        await admin.from("orders").update({
          provider_payment_id:payment.id||order.provider_payment_id,
          invoice_url:payment.invoiceUrl||order.invoice_url,
          updated_at:new Date().toISOString()
        }).eq("id",orderId);
        if(confirmed?.newly_confirmed) await admin.from("notifications").insert([
          {academy_id:order.academy_id,student_id:order.student_id,audience:"student",title:deposit?"Sinal do pedido confirmado ✅":"Pagamento do pedido confirmado ✅",message:deposit?`Recebemos o sinal do pedido ${order.code||""}. Restante na retirada: R$ ${Number(order.remaining_balance||0).toFixed(2).replace('.',',')}.`:`Seu pedido ${order.code||""} foi pago e a academia já foi avisada.`,type:"success"},
          {academy_id:order.academy_id,student_id:null,audience:"admin",title:deposit?"Sinal de venda recebido ✅":"Venda paga via Pix ✅",message:deposit?`${studentName} pagou o sinal do pedido ${order.code||""}. Restante na retirada: R$ ${Number(order.remaining_balance||0).toFixed(2).replace('.',',')}.`:`Pedido ${order.code||""} de ${studentName} confirmado automaticamente pelo Asaas.`,type:"success"}
        ]);
        return json({ok:true,type:"order",status:finalStatus});
      }

      if(["PAYMENT_DELETED","PAYMENT_REFUNDED"].includes(event)){
        const {data:cancelled,error:cancelError}=await admin.rpc("cancel_store_order",{
          p_order_id:orderId,
          p_actor_profile_id:null,
          p_reason:`asaas_webhook_${event.toLowerCase()}`
        });
        if(cancelError) throw cancelError;
        return json({ok:true,type:"order",status:cancelled?.status||order.status});
      }
      return json({ok:true,type:"order",status:order.status,event});
    }

    const {data:record,error}=await admin.from("payments").select("*").eq("id",externalRef).single();
    if(error||!record) return json({ok:true,ignored:"payment_not_found"});
    let status=record.status,paidAt=record.paid_at;
    if(["PAYMENT_RECEIVED","PAYMENT_CONFIRMED"].includes(event)){status="paid";paidAt=new Date().toISOString()}
    else if(event==="PAYMENT_OVERDUE") status="overdue";
    else if(event==="PAYMENT_REFUNDED") status="refunded";
    else if(event==="PAYMENT_DELETED") status="cancelled";
    await admin.from("payments").update({
      status,paid_at:paidAt,external_id:payment.id||record.external_id,
      invoice_url:payment.invoiceUrl||record.invoice_url,updated_at:new Date().toISOString()
    }).eq("id",record.id);
    await admin.from("billing_events").upsert({
      academy_id:record.academy_id,payment_id:record.id,student_id:record.student_id,
      event_key:`${record.id}:webhook:${event}:${payment.id||"asaas"}`,
      event_type:event.toLowerCase(),title:status==="paid"?"Pagamento confirmado":"Atualização de cobrança",
      message:status==="paid"?"Pagamento da mensalidade confirmado automaticamente.":`Evento Asaas: ${event}.`,
      channel:"asaas_webhook"
    },{onConflict:"event_key"});
    if(status==="paid") await admin.from("notifications").insert([
      {academy_id:record.academy_id,student_id:record.student_id,audience:"student",title:"Pagamento confirmado ✅",message:"Recebemos sua mensalidade. Obrigado!",type:"success"},
      {academy_id:record.academy_id,student_id:null,audience:"admin",title:"Mensalidade paga ✅",message:"Pagamento de mensalidade confirmado automaticamente pelo Asaas.",type:"success"}
    ]);
    return json({ok:true,type:"membership",status});
  }catch(error){
    console.error("asaas-webhook",error);
    return json({error:String((error as any)?.message||error)},400);
  }
});
