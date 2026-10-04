import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getDatabase, ref, push, set, update, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAuPIGTzDdQFZwzk7orQwjgExeCDi0P8Dg",
  authDomain: "pizza-ulis-2026.firebaseapp.com",
  databaseURL: "https://pizza-ulis-2026-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pizza-ulis-2026",
  storageBucket: "pizza-ulis-2026.firebasestorage.app",
  messagingSenderId: "634199014939",
  appId: "1:634199014939:web:1715967910160cd5b1c2be",
  measurementId: "G-NPXL1M5C63"
};

const ingredients = [
  {id:"jambon", name:"Jambon", emoji:"🥓", price:2, cls:"ham"},
  {id:"fromage", name:"Fromage", emoji:"🧀", price:1, cls:"cheese"},
  {id:"creme", name:"Crème", emoji:"🥛", price:1, cls:"cream"},
  {id:"olive", name:"Olive", emoji:"🫒", price:1, cls:"olive"},
  {id:"oignon", name:"Oignon", emoji:"🧅", price:1, cls:"onion"},
  {id:"poivron", name:"Poivron", emoji:"🫑", price:1, cls:"pepper"},
  {id:"saumon", name:"Saumon", emoji:"🐟", price:3, cls:"salmon"},
  {id:"champignon", name:"Champignon", emoji:"🍄", price:2, cls:"mushroom"},
  {id:"pepperoni", name:"Pepperoni", emoji:"🍕", price:2, cls:"pepperoni"},
  {id:"tomate", name:"Tomate", emoji:"🍅", price:1, cls:"tomato"},
  {id:"basilic", name:"Basilic", emoji:"🌿", price:1, cls:"basil"}
];

const DEFAULT_SETTINGS = {
  moneyEnabled:false,
  sharingEnabled:false,
  prices:Object.fromEntries(ingredients.map(i=>[i.id,i.price]))
};

let app, auth, db, currentUser;
let role=null, classCode=null, playerName=null;
let unsubscribeOrders=null, unsubscribeSettings=null;
let draft=Object.fromEntries(ingredients.map(i=>[i.id,0]));
let cookChecks={};
let serverKnownStatuses={};
let serverAlertTimer=null;
let settings={...DEFAULT_SETTINGS, prices:{...DEFAULT_SETTINGS.prices}};

const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)}
function roleLabel(r){return r==="client"?"Client":r==="serveur"?"Serveur / Serveuse":r==="pizzaiolo"?"Pizzaiolo":"Enseignant"}
function statusLabel(s){return ({waiting:"En attente",taken:"Prise par le serveur",making:"En préparation",ready:"Pizza prête",done:"Terminée"})[s]||s}
function money(v){return `${Number(v||0)} €`}
function totalPrice(values=draft){return ingredients.reduce((sum,i)=>sum+Number(values?.[i.id]||0)*Number(settings.prices?.[i.id]??i.price),0)}
function fractionLabel(f){return ({"1/1":"Pizza entière","1/2":"1/2 pizza","1/4":"1/4 de pizza","3/4":"3/4 de pizza","1/8":"1/8 de pizza","3/8":"3/8 de pizza","5/8":"5/8 de pizza","7/8":"7/8 de pizza"})[f]||"Pizza entière"}
function normalizedSettings(raw){
  return {moneyEnabled:!!raw?.moneyEnabled,sharingEnabled:!!raw?.sharingEnabled,prices:{...DEFAULT_SETTINGS.prices,...(raw?.prices||{})}};
}
function settingsRef(){return ref(db,`classes/${classCode}/settings`)}
function ordersRef(){return ref(db,`classes/${classCode}/orders`)}
function listenSettings(callback){
  if(unsubscribeSettings) unsubscribeSettings();
  unsubscribeSettings=onValue(settingsRef(),snap=>{settings=normalizedSettings(snap.val());callback(settings)},()=>toast("Impossible de lire les options de la classe."));
}
function listenOrders(callback){
  if(unsubscribeOrders) unsubscribeOrders();
  unsubscribeOrders=onValue(ordersRef(),snap=>{
    const data=snap.val()||{};
    const list=Object.entries(data).map(([id,o])=>({id,...o})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    callback(list);
  },()=>toast("Connexion à la base impossible."));
}
function stopListeners(){if(unsubscribeOrders)unsubscribeOrders();if(unsubscribeSettings)unsubscribeSettings();unsubscribeOrders=null;unsubscribeSettings=null}

function showApp(){
  $("loginView").classList.remove("active");$("appView").classList.add("active");
  $("roleBadge").textContent=`${roleLabel(role)} • ${playerName}`;
  renderRole();
}
function renderRole(){
  stopListeners();
  if(role==="client") renderClient();
  if(role==="serveur") renderServer();
  if(role==="pizzaiolo") renderPizzaiolo();
  if(role==="enseignant") renderTeacher();
}

function ingredientCards(values=draft,readonly=false){
  return `<div class="ingredients">${ingredients.map(i=>{
    const q=Number(values?.[i.id]||0);
    const price=Number(settings.prices?.[i.id]??i.price);
    return `<div class="ingredient"><div class="food">${i.emoji}</div><div><b>${i.name}</b>${settings.moneyEnabled?`<div class="ingredient-price">${money(price)} / unité</div>`:""}${readonly?`<div class="qty"><span>Quantité : ${q}</span></div>`:`<div class="qty"><button data-minus="${i.id}">−</button><span>${q}</span><button data-plus="${i.id}">+</button></div>`}</div></div>`;
  }).join("")}</div>`;
}

function pizzaPreview(values=draft,fraction="1/1"){
  const toppings=[];
  ingredients.forEach((i,idx)=>{
    for(let n=0;n<Number(values?.[i.id]||0);n++){
      const angle=((idx*47+n*83)%360)*Math.PI/180;
      const radius=10+((idx*17+n*11)%22);
      const x=50+Math.cos(angle)*radius;
      const y=50+Math.sin(angle)*radius;
      toppings.push(`<span class="pizza-topping ${i.cls}" style="left:${x}%;top:${y}%" title="${i.name}">${i.emoji}</span>`);
    }
  });
  const fractionClass = fraction.replace("/","-");
  const overlay=fraction!=="1/1"?`<div class="pizza-fraction-overlay fraction-${fractionClass} filled-${fractionClass}"></div><div class="pizza-fraction-lines"></div><div class="fraction-badge">${fractionLabel(fraction)}</div>`:"";
  return `<div class="pizza-stage"><div class="pizza-board"><div class="pizza-top"><div class="pizza-sauce"></div><div class="pizza-cheese"></div>${toppings.slice(0,28).join("")}<div class="pizza-highlight"></div></div>${overlay}</div></div>`;
}

function fractionChoices(){return `<div class="fraction-options">${["1/1","1/2","1/4","3/4","1/8","3/8","5/8","7/8"].map(f=>`<button type="button" class="fraction-choice ${draftFraction===f?"selected":""}" data-fraction="${f}">${fractionLabel(f)}</button>`).join("")}</div>`}
let draftFraction="1/1";

function renderClient(){
  listenSettings(s=>{
    $("appContent").innerHTML=`
    <div class="page-head"><div><h2>🧑‍🍳 Je prépare ma commande</h2><p class="sub">Choisis les ingrédients et regarde ta pizza se construire.</p></div></div>
    <div class="layout client-layout">
      <div class="card"><div class="notice">👉 Utilise + et − pour choisir les quantités.</div><h3>Les ingrédients</h3><div id="ingredientArea">${ingredientCards()}</div>
        ${s.sharingEnabled?`<div class="option-panel"><h3>🍕 Partage de la pizza</h3><p class="sub">Choisis la fraction de pizza demandée.</p>${fractionChoices()}</div>`:""}
        <div class="actions" style="margin-top:18px"><button id="clearBtn" class="secondary">Tout remettre à 0</button><button id="sendOrderBtn" class="primary">Envoyer la commande 🍕</button></div>
      </div>
      <div class="card pizza-card"><h3>Ma pizza</h3><div id="livePizza">${pizzaPreview(draft,draftFraction)}</div>${s.moneyEnabled?`<div class="total-box">Total : <strong>${money(totalPrice())}</strong></div>`:""}<div id="clientMessage" class="order-summary"></div></div>
    </div>
    <div class="card" style="margin-top:20px"><h3>Mes commandes</h3><div id="myOrders"></div></div>`;
    bindDraftControls();
    $("clearBtn").onclick=()=>{draft=Object.fromEntries(ingredients.map(i=>[i.id,0]));draftFraction="1/1";renderClient()};
    $("sendOrderBtn").onclick=createOrder;
    document.querySelectorAll("[data-fraction]").forEach(b=>b.onclick=()=>{draftFraction=b.dataset.fraction;renderClient()});
    listenOrders(renderMyOrders);
  });
}
function bindDraftControls(){
  document.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>{draft[b.dataset.plus]=Math.min(20,(draft[b.dataset.plus]||0)+1);renderClient()});
  document.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>{draft[b.dataset.minus]=Math.max(0,(draft[b.dataset.minus]||0)-1);renderClient()});
}
async function createOrder(){
  const has=Object.values(draft).some(v=>v>0);if(!has){toast("Ajoute au moins un ingrédient.");return}
  const newRef=push(ordersRef());
  await set(newRef,{client:playerName,createdAt:serverTimestamp(),status:"waiting",items:{...draft},server:"",cook:"",fraction:settings.sharingEnabled?draftFraction:"1/1",price:settings.moneyEnabled?totalPrice(draft):null});
  draft=Object.fromEntries(ingredients.map(i=>[i.id,0]));draftFraction="1/1";toast("Commande envoyée au serveur !");renderClient();
}

function orderCard(o,mode=""){
  const itemRows=ingredients.filter(i=>Number(o.items?.[i.id]||0)>0).map(i=>`<div class="item-row"><span class="ingredient-name"><span class="mini-food">${i.emoji}</span>${i.name}</span><b>${o.items[i.id]}</b></div>`).join("");
  const fraction=o.fraction&&o.fraction!=="1/1"?`<div class="fraction-order">🍕 <b>${fractionLabel(o.fraction)}</b></div>`:"";
  const price=settings.moneyEnabled&&o.price!=null?`<div class="order-price">💶 Total : <strong>${money(o.price)}</strong></div>`:"";
  return `<div class="order-card"><h3>Commande 🍕 <span class="status ${o.status}">${statusLabel(o.status)}</span></h3><div class="meta">Client : <b>${escapeHtml(o.client)}</b> ${o.server?`• Serveur : <b>${escapeHtml(o.server)}</b>`:""}</div>${fraction}${price}<div class="order-items">${itemRows}</div>${mode}</div>`;
}
function renderMyOrders(list){const mine=list.filter(o=>o.client===playerName);$("myOrders").innerHTML=mine.length?`<div class="orders">${mine.map(o=>orderCard(o)).join("")}</div>`:`<div class="empty">Ta commande apparaîtra ici.</div>`}

function playReadySound(){try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const ctx=new Ctx(),now=ctx.currentTime;[0,.16,.32].forEach((d,k)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=[660,880,1047][k];g.gain.setValueAtTime(.0001,now+d);g.gain.exponentialRampToValueAtTime(.18,now+d+.02);g.gain.exponentialRampToValueAtTime(.0001,now+d+.13);o.connect(g);g.connect(ctx.destination);o.start(now+d);o.stop(now+d+.14)});setTimeout(()=>ctx.close(),700)}catch(e){}}
function notifyPizzaReady(o){const box=$("serverAlert");if(!box)return;box.innerHTML=`<div class="ready-alert"><div class="ready-alert-icon">🔔</div><div><b>Pizza prête !</b><div>La pizza de <strong>${escapeHtml(o.client)}</strong> est terminée.</div></div><button class="secondary" id="dismissReady">OK</button></div>`;box.classList.add("show");$("dismissReady").onclick=()=>box.classList.remove("show");clearTimeout(serverAlertTimer);serverAlertTimer=setTimeout(()=>box.classList.remove("show"),9000);playReadySound()}
function renderServer(){serverKnownStatuses={};$("appContent").innerHTML=`<div class="page-head"><div><h2>🧑‍💼 Comptoir des commandes</h2><p class="sub">Prends une commande, vérifie les quantités, puis envoie-la au pizzaiolo.</p></div></div><div id="serverAlert"></div><div id="serverOrders"></div>`;listenSettings(()=>listenOrders(renderServerOrders))}
function renderServerOrders(list){
  const previous={...serverKnownStatuses};list.forEach(o=>{if(previous[o.id]&&previous[o.id]!=="ready"&&o.status==="ready")notifyPizzaReady(o);serverKnownStatuses[o.id]=o.status});
  const active=list.filter(o=>o.status!=="done");
  $("serverOrders").innerHTML=active.length?`<div class="orders">${active.map(o=>{let action="";if(o.status==="waiting")action=`<button class="primary takeOrder" data-id="${o.id}">Prendre la commande</button>`;else if(o.status==="taken")action=`<div class="notice">Commande prise. Vérifie les quantités ci-dessus.</div><div class="actions"><button class="primary sendCook" data-id="${o.id}">Envoyer au pizzaiolo 👨‍🍳</button></div>`;else if(o.status==="ready")action=`<button class="primary finishOrder" data-id="${o.id}">Donner la pizza au client</button>`;else action=`<div class="notice">Le pizzaiolo prépare cette pizza…</div>`;return orderCard(o,action)}).join("")}</div>`:`<div class="empty">Aucune commande pour le moment.</div>`;
  document.querySelectorAll(".takeOrder").forEach(b=>b.onclick=()=>update(ref(db,`classes/${classCode}/orders/${b.dataset.id}`),{status:"taken",server:playerName}));
  document.querySelectorAll(".sendCook").forEach(b=>b.onclick=()=>update(ref(db,`classes/${classCode}/orders/${b.dataset.id}`),{status:"making"}).then(()=>toast("Commande envoyée au pizzaiolo.")));
  document.querySelectorAll(".finishOrder").forEach(b=>b.onclick=()=>update(ref(db,`classes/${classCode}/orders/${b.dataset.id}`),{status:"done"}).then(()=>toast("Pizza remise au client !")));
}

function renderPizzaiolo(){$("appContent").innerHTML=`<div class="page-head"><div><h2>👨‍🍳 Cuisine</h2><p class="sub">Coche chaque unité quand elle est mise sur la pizza.</p></div></div><div id="cookOrders"></div>`;listenSettings(()=>listenOrders(renderCookOrders))}
function cookOrderProgress(o){const items=ingredients.filter(i=>Number(o.items?.[i.id]||0)>0);const total=items.reduce((s,i)=>s+Number(o.items[i.id]||0),0);if(o.status==="ready")return{done:total,total};const state=cookChecks[o.id]||{};const done=items.reduce((s,i)=>s+(state[i.id]||[]).filter(Boolean).length,0);return{done,total}}
function renderCookOrders(list){
  const active=list.filter(o=>o.status==="making"||o.status==="ready");
  $("cookOrders").innerHTML=active.length?`<div class="orders">${active.map(o=>{
    const progress=cookOrderProgress(o);const rows=ingredients.filter(i=>Number(o.items?.[i.id]||0)>0).map(i=>{const q=Number(o.items[i.id]||0);const checked=o.status==="ready"?Array(q).fill(true):(cookChecks[o.id]?.[i.id]||Array(q).fill(false));if(!cookChecks[o.id])cookChecks[o.id]={};if(!cookChecks[o.id][i.id])cookChecks[o.id][i.id]=checked.slice(0,q);return `<div class="cook-item"><div class="cook-item-head"><span class="cook-food">${i.emoji}</span><b>${i.name}</b><span class="cook-qty">× ${q}</span></div><div class="unit-checks">${Array.from({length:q},(_,n)=>`<label class="unit-check"><input type="checkbox" data-unit="${o.id}|${i.id}|${n}" ${checked[n]?"checked":""} ${o.status==="ready"?"disabled":""}><span>${n+1}</span></label>`).join("")}</div></div>`}).join("");
    const pct=progress.total?Math.round(progress.done/progress.total*100):0;const action=o.status==="making"?`<button class="primary markReady big-ready" data-id="${o.id}">🟢 PIZZA TERMINÉE</button>`:`<div class="notice ready-notice">🎉 Pizza terminée. Le serveur a été prévenu.</div>`;
    return `<div class="order-card cook-card"><h3>🍕 Pizza de ${escapeHtml(o.client)} <span class="status ${o.status}">${statusLabel(o.status)}</span></h3>${o.fraction&&o.fraction!=="1/1"?`<div class="fraction-order">🍕 ${fractionLabel(o.fraction)}</div>`:""}<div class="cook-progress"><div class="progress-label"><b>${progress.done} / ${progress.total}</b> ingrédients préparés <span>${pct}%</span></div><div class="progress-bar"><div style="width:${pct}%"></div></div></div><div class="cook-items">${rows}</div><div class="actions">${action}</div></div>`;
  }).join("")}</div>`:`<div class="empty">Aucune pizza à préparer.</div>`;
  document.querySelectorAll("[data-unit]").forEach(input=>input.onchange=()=>{const [oid,iid,n]=input.dataset.unit.split("|");if(!cookChecks[oid])cookChecks[oid]={};if(!cookChecks[oid][iid])cookChecks[oid][iid]=[];cookChecks[oid][iid][Number(n)]=input.checked;renderCookOrders(list)});
  document.querySelectorAll(".markReady").forEach(b=>b.onclick=()=>{const o=list.find(x=>x.id===b.dataset.id);const progress=cookOrderProgress(o);if(progress.done<progress.total){toast(`Il reste ${progress.total-progress.done} ingrédient(s) à préparer.`);return}update(ref(db,`classes/${classCode}/orders/${b.dataset.id}`),{status:"ready",cook:playerName}).then(()=>toast("Pizza prête ! Le serveur est prévenu."))});
}

function renderTeacher(){
  listenSettings(s=>{
    $("appContent").innerHTML=`<div class="page-head"><div><h2>👩‍🏫 Espace enseignant</h2><p class="sub">Active ou désactive les options pédagogiques de la classe.</p></div></div>
    <div class="teacher-grid">
      <div class="card option-card"><div class="option-icon">💶</div><h3>Mode monnaie</h3><p>Affiche le prix de chaque ingrédient et le total de la pizza. Tous les prix sont des nombres entiers en euros.</p><label class="switch-row"><span>Activer la monnaie</span><input id="moneyToggle" type="checkbox" ${s.moneyEnabled?"checked":""}><span class="switch-ui"></span></label></div>
      <div class="card option-card"><div class="option-icon">🍕</div><h3>Mode partage / fractions</h3><p>Permet aux élèves de demander une pizza entière, 1/2, 1/4, 3/4, 1/8, 3/8, 5/8 ou 7/8 de pizza.</p><label class="switch-row"><span>Activer le partage</span><input id="shareToggle" type="checkbox" ${s.sharingEnabled?"checked":""}><span class="switch-ui"></span></label></div>
    </div>
    <div class="card" style="margin-top:20px"><h3>💶 Prix des ingrédients</h3><p class="sub">Les prix sont entiers, sans centimes. Ils servent au calcul de la commande.</p><div class="price-grid">${ingredients.map(i=>`<label class="price-row"><span>${i.emoji} ${i.name}</span><span class="price-edit"><input class="price-input" data-price="${i.id}" type="number" min="0" step="1" value="${Number(s.prices[i.id]??i.price)}"><b>€</b></span></label>`).join("")}</div><div class="actions" style="margin-top:16px"><button id="savePrices" class="primary">💾 Enregistrer les prix</button></div></div>
    <div class="notice" style="margin-top:20px">ℹ️ Les options sont enregistrées pour le code de classe <b>${escapeHtml(classCode)}</b>. Tous les appareils de cette classe les verront automatiquement.</div>`;
    $("moneyToggle").onchange=()=>update(settingsRef(),{moneyEnabled:$("moneyToggle").checked});
    $("shareToggle").onchange=()=>update(settingsRef(),{sharingEnabled:$("shareToggle").checked});
    $("savePrices").onclick=()=>{const prices={};document.querySelectorAll("[data-price]").forEach(inp=>prices[inp.dataset.price]=Math.max(0,Math.round(Number(inp.value)||0)));update(settingsRef(),{prices}).then(()=>toast("Prix enregistrés."))};
  });
}

function leave(){stopListeners();role=null;classCode=null;playerName=null;$("appView").classList.remove("active");$("loginView").classList.add("active");$("roleBadge").textContent="Non connecté"}
$("changeRoleBtn").onclick=leave;
document.querySelectorAll(".role-card").forEach(b=>b.onclick=()=>{document.querySelectorAll(".role-card").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");role=b.dataset.role});

$("enterBtn").onclick=async()=>{
  $("loginError").textContent="";classCode=$("classCode").value.trim();playerName=$("playerName").value.trim();
  if(!role){$("loginError").textContent="Choisis un rôle.";return}
  if(!/^[A-Za-z0-9-]{3,12}$/.test(classCode)){$("loginError").textContent="Entre un code de classe de 3 à 12 caractères.";return}
  if(!playerName){$("loginError").textContent="Entre un prénom ou un pseudo.";return}
  try{
    if(!app)app=initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);currentUser=(await signInAnonymously(auth)).user;showApp();
  }catch(e){$("loginError").textContent="Impossible de se connecter. Vérifie la configuration Firebase."}
};
