/* Anderson MV Networks — Telegram WebChat v2 (Durable Objects + WebSockets) */
(() => {
  "use strict";
  if (window.__amvTelegramV2) return;
  window.__amvTelegramV2=true;
  const root=document.documentElement;
  const endpoint="https://andersonmv-telegram-bot.andersonmavi30.workers.dev/webchat/v2";
  const socketEndpoint="wss://andersonmv-telegram-bot.andersonmavi30.workers.dev/webchat/v2/ws";
  const storageKey="amv-telegram-do-v2";
  const fab=document.getElementById("telegramFab");
  const panel=document.getElementById("telegramPanel");
  const close=document.getElementById("telegramClose");
  const chat=document.getElementById("telegramChat");
  const options=document.getElementById("telegramOptions");
  const form=document.getElementById("telegramChatForm");
  const input=document.getElementById("telegramMessage");
  const typing=document.getElementById("telegramTyping");
  const status=document.getElementById("telegramStatus");
  if (!fab||!panel||!chat||!options||!form||!input) return;

  let session=null,ws=null,started=false,connected=false,pendingField=null;
  let lastId=0,retryDelay=1000,retryTimer=null,typingTimer=null,busy=false,manuallyClosed=false;

  const lang=()=>root.dataset.lang==="en"?"en":"es";
  const tr=(es,en)=>lang()==="en"?en:es;
  const labels=()=>[
    {id:"projects",label:tr("🚀 Proyectos","🚀 Projects")},
    {id:"consulting",label:tr("💼 Consultoría","💼 Consulting")},
    {id:"collaborations",label:tr("🤝 Colaboraciones","🤝 Collaborations")},
    {id:"support",label:tr("🛠️ Soporte","🛠️ Support")},
    {id:"talk",label:tr("👤 Hablar con Anderson","👤 Talk to Anderson")}
  ];
  function loadSession() {
    try {
      const v=JSON.parse(localStorage.getItem(storageKey)||"null");
      return v&&typeof v.id==="string"&&typeof v.token==="string"?v:null;
    }catch(e){return null}
  }
  function saveSession(value){
    try{localStorage.setItem(storageKey,JSON.stringify(value))}catch(e){}
  }
  function forgetSession() {
    session=null;try{localStorage.removeItem(storageKey)}catch(e){}
  }
  function updateInputHint(){
    const phone=pendingField==="phone";
    input.placeholder=phone
      ?tr("Ej: +57312000030","e.g. +57312000030")
      :tr(input.dataset.placeholderEs||"Escribe un mensaje…",input.dataset.placeholderEn||"Write a message…");
    input.setAttribute("inputmode",phone?"tel":"text");
  }
  function setStatus(){
    if (!status)return;
    status.textContent=ws?.readyState===WebSocket.OPEN
      ?tr("Conectado · Telegram","Connected · Telegram")
      :tr("Conectando…","Connecting…");
  }
  function bubble(text,kind="bot",id=null) {
    if (!text)return;
    if (id!=null&&chat.querySelector('[data-message-id="'+id+'"]'))return;
    const node=document.createElement("div");
    node.className="telegram-bubble "+(kind==="user"?"user":"bot");
    node.textContent=(kind==="anderson"?"Anderson: ":"")+text;
    if(id!=null){node.dataset.messageId=String(id);lastId=Math.max(lastId,id)}
    chat.appendChild(node);
    chat.scrollTop=chat.scrollHeight;
  }
  function history(items) {
    if(!Array.isArray(items)||!items.length)return;
    const oldScroll=chat.scrollTop;
    chat.innerHTML="";
    lastId=0;
    items.forEach(item=>bubble(item.text,item.from,item.id));
    chat.scrollTop=chat.scrollHeight;
  }
  function setMenu(items) {
    options.innerHTML="";
    const list=connected||pendingField?[]:(Array.isArray(items)?items:labels());
    for(const item of list) {
      const button=document.createElement("button");
      button.type="button";button.textContent=item.label;
      button.addEventListener("click",()=>action(item.id,button));
      options.appendChild(button);
    }
  }
  function showTyping(active,until) {
    if(typingTimer){clearTimeout(typingTimer);typingTimer=null}
    if(!typing)return;
    typing.hidden=!active;
    if(active){
      typing.textContent=tr("Anderson está escribiendo…","Anderson is typing…");
      typingTimer=setTimeout(()=>{typing.hidden=true},Math.min(25000,Math.max(1000,until?until-Date.now():25000)));
    }
  }
  async function call(payload,canReset=false){
    const data=Object.assign({lang:lang()},session?{sessionId:session.id,token:session.token}:{},payload);
    const resp=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    let body=null;
    try{body=await resp.json()}catch(e){}
    if(!resp.ok||!body?.ok){
      if(canReset&&[401,404,410].includes(resp.status)){
        forgetSession();return call({action:"start"},false);
      }
      throw new Error(body?.error||"WebChat HTTP "+resp.status);
    }
    return body;
  }
  function receive(e){
    let data;try{data=JSON.parse(e.data)}catch(err){return}
    if(data.type==="snapshot"){
      if(data.history?.length)history(data.history);
      connected=Boolean(data.connected);pendingField=data.collect||null;
      updateInputHint();
      setMenu(connected||pendingField?[]:labels());
      showTyping(Boolean(data.typing));
    }else if(data.type==="message"&&data.message){
      bubble(data.message.text,data.message.from,data.message.id);showTyping(false);
    }else if(data.type==="typing"){
      showTyping(Boolean(data.active),data.until);
    }
  }
  function connect(){
    if(!session||document.hidden||manuallyClosed)return;
    if(ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING))return;
    const url=new URL(socketEndpoint);
    url.searchParams.set("sessionId",session.id);
    url.searchParams.set("token",session.token);
    const socket=new WebSocket(url.toString());
    ws=socket;
    socket.addEventListener("open",()=>{retryDelay=1000;setStatus()});
    socket.addEventListener("message",receive);
    socket.addEventListener("close",()=>{
      if(ws===socket)ws=null;
      setStatus();
      if(!manuallyClosed&&started)retry();
    });
    socket.addEventListener("error",()=>{try{socket.close()}catch(e){}});
    setStatus();
  }
  function retry(){
    if(retryTimer)return;
    retryTimer=setTimeout(()=>{retryTimer=null;connect()},retryDelay);
    retryDelay=Math.min(retryDelay*2,10000);
  }
  async function initialize(){
    if(started)return;
    started=true;manuallyClosed=false;
    session=loadSession();
    chat.innerHTML="";
    setMenu([]);
    bubble(tr("Hola 👋 Soy el asistente de Anderson MV Networks. ¿En qué puedo ayudarte?",
      "Hi 👋 I'm Anderson MV Networks' assistant. How can I help you?"));
    try{
      const data=await call({action:"start"},true);
      if(data.sessionId&&data.token){
        session={id:data.sessionId,token:data.token};saveSession(session);
      }
      if(data.history?.length)history(data.history);
      connected=Boolean(data.connected);
      pendingField=data.collect||null;
      updateInputHint();
      setMenu(connected||pendingField?[]:data.options||labels());
      showTyping(Boolean(data.typing));
      connect();
    }catch(e){
      bubble(tr("No fue posible conectar. Vuelve a intentarlo cerrando y abriendo el chat.",
        "Could not connect. Please close and reopen the chat to try again."));
      started=false;
    }
  }
  async function action(choice,button){
    if(busy||!session)return;
    busy=true;
    setMenu([]);
    try{
      const data=await call({action:choice});
      bubble(data.reply);
      if(data.collect){pendingField=data.collect;input.focus()}
      else if(data.connected){connected=true;pendingField=null}
      updateInputHint();
      if(!data.collect&&!data.connected)setMenu(data.options||labels());
    }catch(e){
      bubble(tr("Ocurrió un error. Inténtalo nuevamente.","An error occurred. Please try again."));
      setMenu(labels());
    }finally{busy=false}
  }
  async function onSubmit(event){
    event.preventDefault();
    if(busy||!session)return;
    const text=input.value.trim();
    if(!text)return;
    busy=true;input.disabled=true;
    try{
      const data=await call(pendingField?{action:"collect",value:text}:{action:"message",message:text});
      bubble(text,"user");
      input.value="";
      bubble(data.reply);
      if(data.collect){pendingField=data.collect}
      else if(data.connected){pendingField=null;connected=true;setMenu([])}
      else setMenu(data.options||labels());
      updateInputHint();
    }catch(e){
      bubble(tr("No se pudo enviar el mensaje. Inténtalo nuevamente.",
        "Message could not be sent. Please try again."));
    }finally{busy=false;input.disabled=false;input.focus()}
  }
  function toggle(open) {
    panel.classList.toggle("is-open",open);
    panel.setAttribute("aria-hidden",String(!open));
    fab.setAttribute("aria-expanded",String(open));
    if(open)initialize();
  }
  fab.addEventListener("click",()=>toggle(!panel.classList.contains("is-open")));
  close?.addEventListener("click",()=>toggle(false));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")toggle(false)});
  form.addEventListener("submit",onSubmit);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&started)connect()});
  window.addEventListener("online",()=>{if(started)connect()});
  const syncLanguage=()=>{
    updateInputHint();
    if(typing&&!typing.hidden)typing.textContent=tr("Anderson está escribiendo…","Anderson is typing…");
    setStatus();
    if(started&&!connected&&!pendingField)setMenu(labels());
  };
  new MutationObserver(syncLanguage).observe(root,{attributes:true,attributeFilter:["data-lang"]});
  syncLanguage();
})();