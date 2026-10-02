import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getDatabase, ref, push, set, update, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

/*
  IMPORTANT:
  1) Create a Firebase project.
  2) Enable Anonymous Authentication and Realtime Database.
  3) Paste your Firebase web configuration below.
  4) Deploy this folder on a free static host such as GitHub Pages.
*/
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
  {id:"jambon", name:"Jambon", emoji:"🥓"},
  {id:"fromage", name:"Fromage", emoji:"🧀"},
  {id:"creme", name:"Crème", emoji:"🥛"},
  {id:"olive", name:"Olive", emoji:"🫒"},
  {id:"oignon", name:"Oignon", emoji:"🧅"},
  {id:"poivron", name:"Poivron", emoji:"🫑"},
  {id:"saumon", name:"Saumon", emoji:"🐟"},
  {id:"champignon", name:"Champignon", emoji:"🍄"},
  {id:"pepperoni", name:"Pepperoni", emoji:"🍕"},
  {id:"tomate", name:"Tomate", emoji:"🍅"},
  {id:"basilic", name:"Basilic", emoji:"🌿"}
];

let app, auth, db, currentUser;
let role = null, classCode = null, playerName = null, unsubscribe = null;
let draft = Object.fromEntries(ingredients.map(i=>[i.id,0]));

const $ = id => document.getElementById(id);
const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function toast(msg){
  const t=$("toast"); t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2400);
}
function roleLabel(r){return r==="client"?"Client":r==="serveur"?"Serveur / Serveuse":"Pizzaiolo";}
function statusLabel(s){return ({waiting:"En attente",taken:"Prise par le serveur",making:"En préparation",ready:"Pizza prête",done:"Terminée"})[s]||s;}

function showApp(){
  $("loginView").classList.remove("active"); $("appView").classList.add("active");
  $("roleBadge").textContent = `${roleLabel(role)} • ${playerName}`;
  renderRole();
}
function renderRole(){
  if(unsubscribe) unsubscribe();
  if(role==="client") renderClient();
  if(role==="serveur") renderServer();
  if(role==="pizzaiolo") renderPizzaiolo();
}
function ordersRef(){ return ref(db, `classes/${classCode}/orders`); }

function ingredientCards(values=draft, readonly=false){
  return `<div class="ingredients">${ingredients.map(i=>{
    const q=Number(values?.[i.id]||0);
    return `<div class="ingredient">
      <div class="food">${i.emoji}</div>
      <div><b>${i.name}</b>
      ${readonly ? `<div class="qty"><span>Quantité : ${q}</span></div>` :
      `<div class="qty"><button data-minus="${i.id}">−</button><span>${q}</span><button data-plus="${i.id}">+</button></div>`}
      </div></div>`;
  }).join("")}</div>`;
}

function pizzaPreview(values=draft){
  const toppings=[];
  ingredients.forEach(i=>{ for(let n=0;n<Number(values?.[i.id]||0);n++) toppings.push(`<span class="topping">${i.emoji}</span>`); });
  return `<div class="pizza-preview"><div class="pizza-base">${toppings.length?toppings.slice(0,18).join(""):"<span style='font-size:42px'>🍕</span>"}</div></div>`;
}

function renderClient(){
  $("appContent").innerHTML = `
  <div class="page-head"><div><h2>🧑‍🍳 Je prépare ma commande</h2><p class="sub">Choisis les ingrédients et les quantités.</p></div></div>
  <div class="layout">
    <div class="card">
      <div class="notice">👉 Utilise + et − pour demander le nombre d'ingrédients voulu.</div>
      <h3>Les ingrédients</h3>
      <div id="ingredientArea">${ingredientCards()}</div>
      <div class="actions" style="margin-top:18px">
        <button id="clearBtn" class="secondary">Tout remettre à 0</button>
        <button id="sendOrderBtn" class="primary">Envoyer la commande 🍕</button>
      </div>
    </div>
    <div class="card"><h3>Ma pizza</h3>${pizzaPreview()}<div id="clientMessage" class="order-summary"></div></div>
  </div>
  <div class="card" style="margin-top:20px"><h3>Mes commandes</h3><div id="myOrders"></div></div>`;
  bindDraftControls();
  $("clearBtn").onclick=()=>{draft=Object.fromEntries(ingredients.map(i=>[i.id,0]));renderClient();};
  $("sendOrderBtn").onclick=createOrder;
  listenOrders(renderMyOrders);
}

function bindDraftControls(){
  document.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>{draft[b.dataset.plus]=Math.min(20,(draft[b.dataset.plus]||0)+1);renderClient();});
  document.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>{draft[b.dataset.minus]=Math.max(0,(draft[b.dataset.minus]||0)-1);renderClient();});
}
async function createOrder(){
  const has=Object.values(draft).some(v=>v>0);
  if(!has){toast("Ajoute au moins un ingrédient.");return;}
  const newRef=push(ordersRef());
  await set(newRef,{client:playerName, createdAt:serverTimestamp(), status:"waiting", items:{...draft}, server:"", cook:""});
  draft=Object.fromEntries(ingredients.map(i=>[i.id,0]));
  toast("Commande envoyée au serveur !");
  renderClient();
}

function listenOrders(callback){
  unsubscribe=onValue(ordersRef(), snap=>{
    const data=snap.val()||{};
    const list=Object.entries(data).map(([id,o])=>({id,...o})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    callback(list);
  },err=>toast("Connexion à la base impossible."));
}
function orderCard(o, mode){
  const itemRows=ingredients.filter(i=>Number(o.items?.[i.id]||0)>0).map(i=>
    `<div class="item-row"><span class="ingredient-name"><span class="mini-food">${i.emoji}</span>${i.name}</span><b>${o.items[i.id]}</b></div>`).join("");
  return `<div class="order-card">
    <h3>Commande 🍕 <span class="status ${o.status}">${statusLabel(o.status)}</span></h3>
    <div class="meta">Client : <b>${escapeHtml(o.client)}</b> ${o.server?`• Serveur : <b>${escapeHtml(o.server)}</b>`:""}</div>
    <div class="order-items">${itemRows}</div>
    ${mode||""}
  </div>`;
}

function renderMyOrders(list){
  const mine=list.filter(o=>o.client===playerName);
  $("myOrders").innerHTML=mine.length?`<div class="orders">${mine.map(o=>orderCard(o)).join("")}</div>`:`<div class="empty">Ta commande apparaîtra ici.</div>`;
}

function renderServer(){
  $("appContent").innerHTML=`
  <div class="page-head"><div><h2>🧑‍💼 Comptoir des commandes</h2><p class="sub">Prends une commande, vérifie les quantités, puis envoie-la au pizzaiolo.</p></div></div>
  <div id="serverOrders"></div>`;
  listenOrders(renderServerOrders);
}
function renderServerOrders(list){
  const active=list.filter(o=>o.status!=="done");
  $("serverOrders").innerHTML=active.length?`<div class="orders">${active.map(o=>{
    let action="";
    if(o.status==="waiting"){
      action=`<button class="primary takeOrder" data-id="${o.id}">Prendre la commande</button>`;
    } else if(o.status==="taken"){
      action=`<div class="notice">Commande prise. Vérifie les quantités ci-dessus.</div>
      <div class="actions"><button class="primary sendCook" data-id="${o.id}">Envoyer au pizzaiolo 👨‍🍳</button></div>`;
    } else if(o.status==="ready"){
      action=`<button class="primary finishOrder" data-id="${o.id}">Donner la pizza au client</button>`;
    } else {
      action=`<div class="notice">Le pizzaiolo prépare cette pizza…</div>`;
    }
    return orderCard(o,action);
  }).join("")}</div>`:`<div class="empty">Aucune commande pour le moment.</div>`;
  document.querySelectorAll(".takeOrder").forEach(b=>b.onclick=()=>update(ref(db,`classes/${classCode}/orders/${b.dataset.id}`),{status:"taken",server:playerName}));
  document.querySelectorAll(".sendCook").forEach(b=>b.onclick=()=>update(ref(db,`classes/${classCode}/orders/${b.dataset.id}`),{status:"making"}).then(()=>toast("Commande envoyée au pizzaiolo.")));
  document.querySelectorAll(".finishOrder").forEach(b=>b.onclick=()=>update(ref(db,`classes/${classCode}/orders/${b.dataset.id}`),{status:"done"}).then(()=>toast("Pizza remise au client !")));
}

function renderPizzaiolo(){
  $("appContent").innerHTML=`
  <div class="page-head"><div><h2>👨‍🍳 Cuisine</h2><p class="sub">Coche chaque ingrédient quand la quantité demandée est mise sur la pizza.</p></div></div>
  <div id="cookOrders"></div>`;
  listenOrders(renderCookOrders);
}
function renderCookOrders(list){
  const active=list.filter(o=>o.status==="making" || o.status==="ready");
  $("cookOrders").innerHTML=active.length?`<div class="orders">${active.map(o=>{
    const ready=ingredients.filter(i=>Number(o.items?.[i.id]||0)>0).every(i=>document.querySelector(`[data-check="${o.id}-${i.id}"]`)?.checked);
    const rows=ingredients.filter(i=>Number(o.items?.[i.id]||0)>0).map(i=>
      `<label class="check"><span style="font-size:25px">${i.emoji}</span><span style="flex:1"><b>${i.name}</b></span><span>× ${o.items[i.id]}</span>
      <input type="checkbox" data-check="${o.id}-${i.id}" ${o.status==="ready"?"checked":""}></label>`).join("");
    const action=o.status==="making"?`<button class="primary markReady" data-id="${o.id}">Pizza terminée 🍕</button>`:`<div class="notice">Pizza terminée. Le serveur peut la donner au client.</div>`;
    return `<div class="order-card"><h3>Commande de ${escapeHtml(o.client)} <span class="status ${o.status}">${statusLabel(o.status)}</span></h3>
      <div class="order-items">${rows}</div><div class="actions">${action}</div></div>`;
  }).join("")}</div>`:`<div class="empty">Aucune pizza à préparer.</div>`;
  document.querySelectorAll(".markReady").forEach(b=>b.onclick=()=>{
    const o=list.find(x=>x.id===b.dataset.id);
    const ok=ingredients.filter(i=>Number(o.items?.[i.id]||0)>0).every(i=>document.querySelector(`[data-check="${o.id}-${i.id}"]`)?.checked);
    if(!ok){toast("Coche tous les ingrédients demandés.");return;}
    update(ref(db,`classes/${classCode}/orders/${b.dataset.id}`),{status:"ready",cook:playerName}).then(()=>toast("Pizza prête !"));
  });
}

function leave(){
  if(unsubscribe) unsubscribe();
  unsubscribe=null; role=null; classCode=null; playerName=null;
  $("appView").classList.remove("active"); $("loginView").classList.add("active");
  $("roleBadge").textContent="Non connecté";
}
$("changeRoleBtn").onclick=leave;

document.querySelectorAll(".role-card").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".role-card").forEach(x=>x.classList.remove("selected"));
  b.classList.add("selected"); role=b.dataset.role;
});
$("enterBtn").onclick=async()=>{
  $("loginError").textContent="";
  classCode=$("classCode").value.trim(); playerName=$("playerName").value.trim();
  if(!role){$("loginError").textContent="Choisis un rôle.";return}
  if(!/^[A-Za-z0-9-]{3,12}$/.test(classCode)){$("loginError").textContent="Entre un code de classe de 3 à 12 caractères.";return}
  if(!playerName){$("loginError").textContent="Entre un prénom ou un pseudo.";return}
  try{
    if(firebaseConfig.apiKey==="REMPLACE_MOI") throw new Error("CONFIG");
    app=initializeApp(firebaseConfig); auth=getAuth(app); db=getDatabase(app);
    currentUser=(await signInAnonymously(auth)).user;
    showApp();
  }catch(e){
    $("loginError").textContent = e.message==="CONFIG"
      ? "L'application est prête, mais il faut encore connecter Firebase (voir le guide)."
      : "Impossible de se connecter. Vérifie la configuration Firebase.";
  }
};
