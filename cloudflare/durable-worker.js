/**
 * Anderson MV Networks — realtime Telegram webchat, Durable Objects edition.
 *
 * Legacy /webchat and /webchat/poll keep working during an orderly cutover.
 * New endpoints /webchat/v2 and /webchat/v2/ws use SQLite Durable Objects.
 * Telegram webhook delegates legacy messages unless a v2 session is selected.
 */
import { DurableObject } from "cloudflare:workers";
import legacy from "./telegram-worker.js";
import { previewHTML } from "./staging-preview.js";

const allowed=new Set(["https://andersonmvnetworks.com","https://www.andersonmvnetworks.com","https://andersonmavi30.github.io","https://andersonmv-telegram-bot-staging.andersonmavi30.workers.dev"]);
const ttl=24*60*60*1000, cats=new Set(["projects","consulting","collaborations","support"]);
const fields=["name","email","phone","description"];
const safe=(s,n=1500)=>String(s??"").replace(/[<>]/g,"").trim().slice(0,n);
const english=l=>l==="en";
const txt=(l,es,en)=>english(l)?en:es;
const valid=id=>/^[a-f0-9-]{36}$/.test(id);
const json=(data,status=200,origin)=>new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
    ...(origin?{"access-control-allow-origin":origin,"access-control-allow-headers":"content-type",
      "access-control-allow-methods":"POST,OPTIONS","vary":"Origin"}:{})}});
const menu=l=>[
  ["projects",txt(l,"🚀 Proyectos","🚀 Projects")],["consulting",txt(l,"💼 Consultoría","💼 Consulting")],
  ["collaborations",txt(l,"🤝 Colaboraciones","🤝 Collaborations")],
  ["support",txt(l,"🛠️ Soporte","🛠️ Support")],["talk",txt(l,"👤 Hablar con Anderson","👤 Talk to Anderson")]
].map(([id,label])=>({id,label}));
const category=(l,a)=>({
  projects:txt(l,"🚀 Cuéntame qué proyecto tienes en mente.","🚀 Tell me about your project."),
  consulting:txt(l,"💼 Cuéntame qué infraestructura quieres revisar.","💼 Tell me what infrastructure you want reviewed."),
  collaborations:txt(l,"🤝 Cuéntame qué colaboración propones.","🤝 Tell me about your collaboration idea."),
  support:txt(l,"🛠️ Describe el problema o tecnología involucrada.","🛠️ Describe the issue or technology involved.")
})[a]||"";
const prompt=(l,f)=>({
  name:txt(l,"👤 Para registrar tus datos de contacto, ¿puedes indicarme tu nombre completo?","👤 To register your contact details, could you provide your full name?"),
  email:txt(l,"Gracias. ¿Cuál es tu correo electrónico?","Thanks. What's your email address?"),
  phone:txt(l,"¿Cuál es tu teléfono de contacto?","What's your contact phone number?"),
  description:txt(l,"Por último, describe brevemente lo que necesitas.","Finally, briefly describe what you need.")
})[f]||"";
const replyMarkup=id=>({inline_keyboard:[[{text:"💬 Responder",callback_data:"reply:"+id}]]});
const room=(env,id)=>env.CHAT_ROOMS.get(env.CHAT_ROOMS.idFromName("web:"+id));
const router=env=>env.ADMIN_ROUTER.get(env.ADMIN_ROUTER.idFromName("admin:"+env.TELEGRAM_ADMIN_CHAT_ID));
async function toObject(stub,path,data) {
  const r=await stub.fetch("https://internal"+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
  return {status:r.status,body:await r.json()};
}
async function tg(env,method,payload) {
  const r=await fetch("https://api.telegram.org/bot"+env.TELEGRAM_BOT_TOKEN+"/"+method,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)
  });
  if(!r.ok)throw Error("Telegram HTTP "+r.status);
  const d=await r.json();
  if(!d.ok)throw Error("Telegram API failure");
  return d.result;
}
function contact(s) {
  return txt(s.lang,"🔔 Nuevo contacto web","🔔 New website contact")+"\n\n"+
    txt(s.lang,"Nombre: ","Name: ")+s.name+"\n"+
    txt(s.lang,"Correo: ","Email: ")+s.email+"\n"+
    txt(s.lang,"Teléfono: ","Phone: ")+(s.phone||txt(s.lang,"No proporcionado","Not provided"))+"\n"+
    txt(s.lang,"Sesión: ","Session: ")+s.id+"\n\n"+
    txt(s.lang,"Descripción:\n","Description:\n")+s.description;
}
async function web(request,env,url) {
  const origin=request.headers.get("origin")||"";
  if(!allowed.has(origin))return new Response("Forbidden",{status:403});
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{
    "access-control-allow-origin":origin,"access-control-allow-headers":"content-type",
    "access-control-allow-methods":"POST,OPTIONS","vary":"Origin"}});
  if(url.pathname==="/webchat/v2/ws") {
    if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return new Response("Upgrade required",{status:426});
    const id=url.searchParams.get("sessionId"),token=url.searchParams.get("token");
    if(!valid(id)||!valid(token))return new Response("Unauthorized",{status:401});
    return room(env,id).fetch(request);
  }
  if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405,origin);
  if(Number(request.headers.get("content-length")||0)>8192)return json({ok:false,error:"Payload too large"},413,origin);
  let b;
  try{b=await request.json()}catch{return json({ok:false,error:"Invalid JSON"},400,origin)}
  let id=safe(b.sessionId,100),token=safe(b.token,100);
  const create=b.action==="start"&&(!id||!token);
  if(create){id=crypto.randomUUID();token=crypto.randomUUID()}
  if(!valid(id)||!valid(token))return json({ok:false,error:"Invalid session credentials"},401,origin);
  const result=await toObject(room(env,id),"/api",{...b,sessionId:id,token,create});
  if(create&&result.body.ok){result.body.sessionId=id;result.body.token=token}
  return json(result.body,result.status,origin);
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    try{
      if(url.pathname==="/chat-preview"&&request.method==="GET")return new Response(previewHTML,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; connect-src 'self' wss://andersonmv-telegram-bot-staging.andersonmavi30.workers.dev; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
      if(url.pathname==="/webchat/v2"||url.pathname==="/webchat/v2/ws")return web(request,env,url);
      if(url.pathname==="/"&&request.method==="POST")return webhook(request,env);
      return legacy.fetch(request,env);
    }catch(e){
      console.error("Realtime webchat failed:",e?.message||"unknown");
      if(url.pathname.startsWith("/webchat/v2"))
        return json({ok:false,error:"Service temporarily unavailable"},503,allowed.has(request.headers.get("Origin"))?request.headers.get("Origin"):null);
      return new Response("Temporary service error",{status:503});
    }
  }
};
export class ChatRoom extends DurableObject {
  async load(){return this.ctx.storage.get("chat")}
  async save(s){s.expiresAt=Date.now()+ttl;await this.ctx.storage.put("chat",s);await this.ctx.storage.setAlarm(s.expiresAt)}
  append(s,from,text) {
    const m={id:++s.sequence,from,text,at:Date.now()};
    s.history.push(m);
    s.history=s.history.slice(-50);
    return m;
  }
  emit(event){
    const raw=JSON.stringify(event);
    for(const ws of this.ctx.getWebSockets("visitor"))try{ws.send(raw)}catch(e){}
  }
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==="/webchat/v2/ws"){
      const s=await this.load(),id=url.searchParams.get("sessionId"),token=url.searchParams.get("token");
      if(!s||s.id!==id||s.token!==token||s.expiresAt<Date.now())return new Response("Unauthorized",{status:401});
      const [client,server]=Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server,["visitor"]);
      server.serializeAttachment({id:s.id});
      server.send(JSON.stringify({type:"snapshot",history:s.history,connected:s.escalated,
        collect:s.state.startsWith("awaiting_")?s.state.slice(9):null,typing:s.typingUntil>Date.now()}));
      return new Response(null,{status:101,webSocket:client});
    }
    if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
    const b=await request.json();
    if(url.pathname==="/admin")return this.admin(b);
    if(url.pathname!=="/api")return json({ok:false,error:"Invalid action"},404);
    let s=await this.load();
    if(!s){
      if(!b.create||b.action!=="start")return json({ok:false,error:"Session not found"},404);
      s={id:b.sessionId,token:b.token,lang:english(b.lang)?"en":"es",state:"chat",
        escalated:false,name:"",email:"",phone:"",description:"",history:[],sequence:0,
        typingUntil:0,expiresAt:Date.now()+ttl,rate:{start:Date.now(),count:0}};
      await this.save(s);
    }
    if(s.id!==b.sessionId||s.token!==b.token)return json({ok:false,error:"Unauthorized"},401);
    if(s.expiresAt<Date.now())return json({ok:false,error:"Expired"},410);
    const l=english(b.lang)?"en":"es";s.lang=l;
    const now=Date.now();
    if(now-s.rate.start>60000)s.rate={start:now,count:0};
    if(++s.rate.count>40)return json({ok:false,error:"Too many requests"},429);
    const state=s.state;
    if(b.action==="start"||b.action==="sync"){
      await this.save(s);
      return json({ok:true,history:s.history,connected:s.escalated,
        collect:state.startsWith("awaiting_")?state.slice(9):null,typing:s.typingUntil>Date.now(),
        options:state==="chat"?menu(l):[]});
    }
    if(s.escalated&&b.action!=="message")return json({ok:true,connected:true,reply:""});
    if(cats.has(b.action)&&state==="chat"){
      const reply=category(l,b.action);
      this.append(s,"bot",reply);await this.save(s);
      return json({ok:true,reply,options:menu(l)});
    }
    if(b.action==="talk"&&state==="chat"){
      s.state="awaiting_name";
      const reply=prompt(l,"name");this.append(s,"bot",reply);await this.save(s);
      return json({ok:true,reply,collect:"name"});
    }
    if(b.action==="collect"&&state.startsWith("awaiting_")){
      const field=state.slice(9),idx=fields.indexOf(field);
      if(idx<0)return json({ok:false,error:"Invalid collection state"},409);
      let value=safe(b.value,field==="description"?1200:field==="email"?160:field==="phone"?60:100);
      if(field==="phone"&&["skip","omitir"].includes(value.toLowerCase()))value="";
      if(!value&&field!=="phone")return json({ok:true,reply:txt(l,"Dato obligatorio.","Required field."),collect:field});
      if(field==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        return json({ok:true,reply:txt(l,"Correo no válido.","Invalid email address."),collect:field});
      s[field]=value;
      if(idx<3){
        const next=fields[idx+1];s.state="awaiting_"+next;
        const reply=prompt(l,next);this.append(s,"bot",reply);await this.save(s);
        return json({ok:true,reply,collect:next});
      }
      await tg(this.env,"sendMessage",{
        chat_id:this.env.TELEGRAM_ADMIN_CHAT_ID,text:contact(s),reply_markup:replyMarkup(s.id)
      });
      s.state="connected";s.escalated=true;
      const reply=txt(l,"✅ Anderson recibió tus datos. Puedes seguir hablando aquí.","✅ Anderson received your details. You can keep chatting here.");
      this.append(s,"bot",reply);await this.save(s);
      return json({ok:true,reply,connected:true});
    }
    if(b.action==="message"){
      if(state.startsWith("awaiting_"))return json({ok:false,error:"Complete contact details first"},409);
      const message=safe(b.message,1500);
      if(!message)return json({ok:false,error:"Empty message"},400);
      if(s.escalated)await tg(this.env,"sendMessage",{
        chat_id:this.env.TELEGRAM_ADMIN_CHAT_ID,
        text:"💬 "+s.name+" (Web)\n\n"+message,reply_markup:replyMarkup(s.id)
      });
      this.append(s,"user",message);
      const reply=s.escalated?"":txt(l,"Gracias. Elige una opción o solicita hablar con Anderson.","Thanks. Choose an option or ask to talk to Anderson.");
      if(reply)this.append(s,"bot",reply);
      await this.save(s);
      return json({ok:true,connected:s.escalated,reply,options:s.escalated?[]:menu(l)});
    }
    return json({ok:false,error:"Invalid action"},400);
  }
  async admin(b){
    const s=await this.load();
    if(!s||!s.escalated||s.expiresAt<Date.now())return json({ok:false,error:"Session unavailable"},404);
    if(b.type==="prepare"){
      s.typingUntil=Date.now()+25000;
      await this.save(s);
      this.emit({type:"typing",active:true,until:s.typingUntil});
      return json({ok:true,name:s.name});
    }
    if(b.type==="reply"){
      const content=safe(b.text,3500);
      if(!content)return json({ok:false,error:"Empty message"},400);
      s.typingUntil=0;
      const message=this.append(s,"anderson",content);
      await this.save(s);
      this.emit({type:"message",message});
      this.emit({type:"typing",active:false});
      return json({ok:true,name:s.name});
    }
    return json({ok:false,error:"Invalid admin action"},400);
  }
  async webSocketMessage(ws,message){try{if(message==="ping")ws.send(JSON.stringify({type:"pong"}))}catch(e){}}
  async webSocketClose(ws,code,reason){try{ws.close(code,reason)}catch(e){}}
  async alarm(){
    const s=await this.load();
    if(s&&s.expiresAt>Date.now())return this.ctx.storage.setAlarm(s.expiresAt);
    for(const ws of this.ctx.getWebSockets())try{ws.close(1000,"Expired")}catch(e){}
    await this.ctx.storage.deleteAll();
  }
}
export class AdminRouter extends DurableObject {
  async fetch(request){
    if(request.method!=="POST")return json({ok:false},405);
    const b=await request.json();
    if(b.type==="select"){await this.ctx.storage.put("active",{id:b.id,until:Date.now()+ttl});return json({ok:true})}
    if(b.type==="get"){const active=await this.ctx.storage.get("active");return json({ok:true,id:active?.until>Date.now()?active.id:null})}
    if(b.type==="clear"){await this.ctx.storage.delete("active");return json({ok:true})}
    return json({ok:false},400);
  }
}
async function webhook(request,env){
  const secret=request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if(!env.TELEGRAM_WEBHOOK_SECRET||secret!==env.TELEGRAM_WEBHOOK_SECRET)return new Response("Unauthorized",{status:401});
  const update=await request.clone().json();
  const adminId=String(env.TELEGRAM_ADMIN_CHAT_ID);
  if(update.callback_query){
    const cb=update.callback_query,chatId=String(cb.message?.chat?.id||""),fromId=String(cb.from?.id||"");
    const data=String(cb.data||"");
    if(data.startsWith("reply:")&&chatId===adminId&&fromId===adminId){
      const id=data.slice(6);
      if(!valid(id))return legacy.fetch(request,env);
      const selected=await toObject(room(env,id),"/admin",{type:"prepare"});
      if(!selected.body.ok){
        // Switching to a legacy contact must clear any previously selected v2 chat.
        await toObject(router(env),"/route",{type:"clear"});
        return legacy.fetch(request,env);
      } // legacy KV conversation
      await tg(env,"answerCallbackQuery",{callback_query_id:cb.id});
      await toObject(router(env),"/route",{type:"select",id});
      await tg(env,"sendMessage",{chat_id:adminId,text:"✍️ Respondiendo a "+selected.body.name+". Escribe tu mensaje. /cancelar para cerrar."});
      return new Response("OK");
    }
    return legacy.fetch(request,env);
  }
  if(update.message){
    const m=update.message,chatId=String(m.chat?.id||""),fromId=String(m.from?.id||"");
    const text=String(m.text||"");
    if(chatId===adminId&&fromId===adminId){
      const selected=await toObject(router(env),"/route",{type:"get"});
      if(text==="/cancelar"||text==="/cancel"){
        await toObject(router(env),"/route",{type:"clear"});
        await tg(env,"sendMessage",{chat_id:chatId,text:"Conversación web cerrada."});
        return new Response("OK");
      }
      if(selected.body.id&&text&&!text.startsWith("/")){
        const reply=await toObject(room(env,selected.body.id),"/admin",{type:"reply",text});
        if(reply.body.ok){
          await tg(env,"sendMessage",{chat_id:chatId,text:"✅ Mensaje enviado a "+reply.body.name+"."});
          return new Response("OK");
        }
        await toObject(router(env),"/route",{type:"clear"});
      }
    }
  }
  return legacy.fetch(request,env);
}
