// sdk.js v1.3
function _spinEl(){let el=document.getElementById(SPIN_ID);if(el)return el;el=document.createElement("div");el.id=SPIN_ID;el.dataset.ch="sdk";el.innerHTML=`<div class="sp"><svg viewBox="0 0 50 50"><defs><linearGradient id="chSpinGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#7aa8ff"/></linearGradient></defs><circle class="bg" cx="25" cy="25" r="20"/><circle class="an" cx="25" cy="25" r="20"/></svg></div><div class="tx"></div><div class="sb"></div></div>`;document.body.appendChild(el);return el}
function _injectSpinCSS(){if(document.getElementById(SPIN_CSS_ID))return;const s=document.createElement("style");s.id=SPIN_CSS_ID;s.textContent=`#${SPIN_ID}{position:fixed;inset:0;z-index:99999;background:rgba(5,7,15,.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;flex-direction:column;gap:16px;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif}#${SPIN_ID}.show{display:flex}#${SPIN_ID} .sp{width:64px;height:64px;position:relative}#${SPIN_ID} .sp svg{width:100%;height:100%;animation:chSpinRot 1.4s linear infinite}#${SPIN_ID} .sp .bg{stroke:rgba(79,140,255,.15);stroke-width:4;fill:none}#${SPIN_ID} .sp .an{stroke:url(#chSpinGrad);stroke-width:4;fill:none;stroke-linecap:round;stroke-dasharray:90,150;stroke-dashoffset:0;animation:chSpinDash 1.4s ease-in-out infinite}#${SPIN_ID} .tx{color:#e8eef8;font-size:.95rem;font-weight:600;text-align:center;max-width:80vw}#${SPIN_ID} .sb{color:#8fa0bd;font-size:.78rem;text-align:center;max-width:80vw;margin-top:-4px}@keyframes chSpinRot{100%{transform:rotate(360deg)}}@keyframes chSpinDash{0%{stroke-dasharray:1,150;stroke-dashoffset:0}50%{stroke-dasharray:90,150;stroke-dashoffset:-35}100%{stroke-dasharray:90,150;stroke-dashoffset:-124}}`;document.head.appendChild(s)}
const _s=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};const _r=k=>{try{return localStorage.getItem(k)}catch(e){return null}};const _d=k=>{try{localStorage.removeItem(k)}catch(e){}};
const SPIN_ID="ch-spin",SPIN_CSS_ID="ch-spin-css";
const DEF={worker:"https://proud-flower-677b.braatzjunioralexandre5.workers.dev",baseLogin:"https://app.codehub.site.je/API/v3/continuar-conta",storageKey:"ch_authid",appToken:""};
export class CodeHub{
constructor(o={}){const c={...DEF,...o};this.worker=c.worker;this.baseLogin=c.baseLogin;this.appToken=c.appToken;this.storageKey=c.storageKey;this.onPending=c.onPending||(()=>{});this.onConfirmed=c.onConfirmed||(()=>{});this.onError=c.onError||(()=>{});this.onReloaded=c.onReloaded||(()=>{});this.es=null;this.popup=null;this._ls={};window.addEventListener("message",e=>{if(!e.data||e.data.type!=="AUTH_DONE")return;try{const u=new URL(e.data.url);if(u.protocol!=="https:")return;if(e.data.url===location.href)return;location.href=e.data.url}catch(err){}})}
_emit(k,d){(this._ls[k]||[]).forEach(f=>{try{f(d)}catch(e){console.warn(e)}})}
on(k,f){(this._ls[k]=this._ls[k]||[]).push(f);return()=>this.off(k,f)}
off(k,f){if(!this._ls[k])return;this._ls[k]=this._ls[k].filter(x=>x!==f)}
showSpinner(t="",s=""){_injectSpinCSS();const el=_spinEl();el.querySelector(".tx").textContent=t||"";el.querySelector(".sb").textContent=s||"";el.classList.add("show")}
hideSpinner(){const el=document.getElementById(SPIN_ID);if(el)el.classList.remove("show")}
saveSession(id){_s(this.storageKey,id)}
readSession(){return _r(this.storageKey)}
clearSession(){_d(this.storageKey)}
hasSession(){return!!this.readSession()}
async _get(p,q={}){const qs=new URLSearchParams(q).toString();const r=await fetch(`${this.worker}${p}${qs?"?"+qs:""}`);return await r.json()}
async _post(p,b={}){const r=await fetch(`${this.worker}${p}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});return await r.json()}
async createAuthId(){const d=await this._get("/CreateAuthId");if(!d.ok)throw new Error(d.erro||"createAuthId failed");return d.authId}
openPopup(id,redirectUrl){const dest=redirectUrl||location.href;if(!dest.toLowerCase().startsWith("https://"))throw new Error("Page must be HTTPS.");const qs=new URLSearchParams({token:this.appToken,authid:id,redirecturl:dest});this.popup=window.open(`${this.baseLogin}?${qs}`,"loginPopup","width=500,height=680,scrollbars=yes");return this.popup}
listenSSE(id){if(this.es)this.es.close();this.es=new EventSource(`${this.worker}/LoginAuthId?id=${id}`);this.es.addEventListener("status",async e=>{let d;try{d=JSON.parse(e.data)}catch(err){return}if(d.status==="pending"){this.onPending(d);this._emit("pending",d);return}if(d.status==="confirmed"){this.es.close();this.es=null;try{if(this.popup&&!this.popup.closed)this.popup.close()}catch(err){}this.saveSession(id);this.hideSpinner();this.onConfirmed(d);this._emit("confirmed",d);return}if(d.status==="not_found"){this.es.close();this.es=null;const err=new Error("authId not found");this.onError(err);this._emit("error",err)}});this.es.addEventListener("error",e=>{this.onError(e);this._emit("error",e)})}
async login(redirectUrl,spinner=true){this.clearSession();if(spinner)this.showSpinner();try{const id=await this.createAuthId();this.saveSession(id);this.openPopup(id,redirectUrl);this.listenSSE(id);this._emit("started",{authId:id});return id}catch(e){if(spinner)this.hideSpinner();throw e}}
async getProfile(fbToken){const d=await this._get("/AuthProfile",{token:fbToken});return d.data||{}}
async getAccount(fbToken){const u=await this.getProfile(fbToken);return{uid:u.uid||null,name:u.displayName||null,email:u.email||null,emailVerified:u.emailVerified===true,photoUrl:u.photoUrl||null,disabled:u.disabled===true,success:u.success===true,version:u.version||null,raw:u}}
async getTokenStatus(fbToken){const d=await this._get("/AuthStatus",{token:fbToken});return d.data||{}}
async getAppData(token){const t=token||this.appToken;if(!t)throw new Error("appToken is required");const d=await this._get("/TokenData",{token:t});if(!d.ok)throw new Error(d.erro||"getAppData failed");return d.data}
async getAuthStatus(authId){const id=authId||this.readSession();if(!id)throw new Error("authId is required");return await this._get("/StatusAuthId",{id})}
async createAuthToken(authId){const id=authId||this.readSession();if(!id)throw new Error("authId is required");return await this._get("/CreateAuthToken",{id,token:this.appToken})}
async authByApp(token){
  const t=token||this.appToken;
  if(!t)throw new Error("appToken is required");
  const d=await this._get("/AuthCreateAuthIdByApp",{token:t});
  if(!d.ok)throw new Error(d.erro||"authByApp failed");
  this.saveSession(d.authId);
  return d;
}
async logout(confirmar=true){const id=this.readSession();if(!id){this.clearSession();return{ok:true,msg:"nothing to delete"}}if(confirmar&&!confirm("Delete authid from server and browser?"))return{ok:false,msg:"cancelled"};let ok=false;try{const d=await this._get("/DeleteAuthId",{id});if(d.ok)ok=true}catch(e){console.warn(e)}this.clearSession();return{ok,msg:ok?"deleted":"server failed"}}
async deleteAuthId(id){if(!id)throw new Error("authId is required");return await this._get("/DeleteAuthId",{id})}
async reloadAccount(authId){const id=authId||this.readSession();if(!id)throw new Error("authId is required");const st=await this._get("/StatusAuthId",{id});if(!st||st.status!=="confirmed")return{ok:false,status:(st&&st.status)||"pending",conta:null,raw:st};const conta=await this.getAccount(st.firebaseIdToken);this.onReloaded({authId:id,conta,raw:st});this._emit("reloaded",{authId:id,conta,raw:st});return{ok:true,status:"confirmed",conta,raw:st}}
watchSession(){const id=this.readSession();if(!id)return null;this.listenSSE(id);return id}
async autoReload(){const id=this.readSession();if(!id)return{ok:false,status:"no_session"};return await this.reloadAccount(id)}
close(){if(this.es){this.es.close();this.es=null}if(this.popup&&!this.popup.closed){try{this.popup.close()}catch(e){}}}}
export function createCodeHub(o){return new CodeHub(o)}
export default CodeHub;
