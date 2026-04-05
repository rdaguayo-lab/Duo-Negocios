// DUO Control de Negocios v2.6 — vacaciones editar/cancelar, fechas destacadas
import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { guardarFirebase, escucharFirebase } from './firebase';


// ── ESTILOS ───────────────────────────────────────────────
const IS = { width:"100%", padding:"10px 12px", borderRadius:10, boxSizing:"border-box", border:"1px solid #ffffff12", background:"#07090f", color:"#f0ece8", fontSize:13, outline:"none" };
const GB = { background:"#ffffff0c", border:"none", color:"#ffffff44", padding:"5px 12px", borderRadius:8, cursor:"pointer", fontSize:11 };

// ── CONSTANTES ────────────────────────────────────────────
const CORREOS_DUENOS = ["rdaguayo@gmail.com", "avello.jessica@gmail.com"];

const USUARIOS = [
  { id:"dueno1", nombre:"Administrador (Rodrigo)", pass:"rodrigo1704", rol:"dueno",     sucursal:null,      turno:null      },
  { id:"dueno2", nombre:"Administrador (Jessica)", pass:"jessica0106", rol:"dueno",     sucursal:null,      turno:null      },
  { id:"car_t1", nombre:"Carahue · Turno 1", pass:"duot1",       rol:"vendedora", sucursal:"carahue", turno:"Turno 1" },
  { id:"car_t2", nombre:"Carahue · Turno 2", pass:"duot2",       rol:"vendedora", sucursal:"carahue", turno:"Turno 2" },
  { id:"temuco", nombre:"DUO Temuco",        pass:"duot3",       rol:"vendedora", sucursal:"temuco",  turno:null      },
];

const SUCS = {
  carahue: { nombre:"DUO Carahue", color:"#22c55e", bg:"#22c55e14", emoji:"🌿" },
  temuco:  { nombre:"DUO Temuco",  color:"#3b82f6", bg:"#3b82f614", emoji:"🏙️" },
};

const FIJOS_DEF = {
  carahue: [
    { id:"fc1", label:"Sueldo Turno 1 (total)", esSueldo:true, turnoSueldo:"t1" },
    { id:"fc2", label:"Sueldo Turno 2 (total)", esSueldo:true, turnoSueldo:"t2" },
    { id:"fc3", label:"Honorarios Contadora" },
    { id:"fc4", label:"Internet" },
    { id:"fc5", label:"Arriendo Local" },
  ],
  temuco: [
    { id:"ft1", label:"Sueldo Trabajadora (total)", esSueldo:true, turnoSueldo:"t1" },
    { id:"ft2", label:"Honorarios Contadora" },
    { id:"ft3", label:"Arriendo Local" },
    { id:"ft4", label:"Internet" },
  ],
};

const VAR_DEF = {
  carahue: [{ id:"vc1", label:"Luz" }, { id:"vc2", label:"Otro" }],
  temuco:  [{ id:"vt1", label:"Luz" }, { id:"vt2", label:"Agua" }, { id:"vt3", label:"Otro" }],
};

const CAT_GASTO = [
  { id:"proveedor",   label:"🏭 Pago Proveedor",    req:true  },
  { id:"operacional", label:"⚙️ Operacional",        req:false },
  { id:"higiene",     label:"🧴 Higiene y Limpieza", req:false },
  { id:"insumo",      label:"📦 Insumos",             req:false },
  { id:"emergencia",  label:"🚨 Emergencia",           req:false },
  { id:"otro",        label:"📝 Otro",                 req:false },
];

const TIPOS_PAGO = [
  { id:"efectivo",      label:"💵 Efectivo"      },
  { id:"tarjeta",       label:"💳 Tarjeta"       },
  { id:"transferencia", label:"🏦 Transferencia" },
];

const PROV_DEF = {
  carahue: [{ id:"pc1", nombre:"Proveedor Principal Carahue", contacto:"", categoria:"General", esCigarro:false }, { id:"pc2", nombre:"Proveedor Cigarros Carahue", contacto:"", categoria:"Cigarros", esCigarro:true }],
  temuco:  [{ id:"pt1", nombre:"Proveedor Principal Temuco",  contacto:"", categoria:"General", esCigarro:false }, { id:"pt2", nombre:"Proveedor Cigarros Temuco",  contacto:"", categoria:"Cigarros", esCigarro:true }],
};

// ── HELPERS ───────────────────────────────────────────────
const fmt    = (n) => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
const fmtK   = (n) => { const a=Math.abs(n||0); if(a>=1e6) return (n/1e6).toFixed(1)+"M"; if(a>=1000) return Math.round(n/1000)+"K"; return String(n||0); };
const hoy    = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const uid    = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const mesNow = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const lblMes = (k) => { if(!k)return""; const[y,m]=k.split("-"); return new Date(+y,+m-1,1).toLocaleString("es-CL",{month:"long",year:"numeric"}); };
const diasD  = (f) => f?Math.floor((new Date()-new Date(f))/864e5):0;
const anosD  = (f) => diasD(f)/365;
const fmtGcal= (f) => f?f.replace(/-/g,""):"";
const sumarD = (f,n) => { const d=new Date(f+"T00:00:00"); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };

// ── FERIADOS CHILE (fijos + Semana Santa aproximada) ──────
function getFeriadosChile(year) {
  // Feriados fijos
  const fijos = [
    `${year}-01-01`, // Año Nuevo
    `${year}-05-01`, // Día del Trabajo
    `${year}-05-21`, // Glorias Navales
    `${year}-06-20`, // Día de los Pueblos Indígenas (aprox.)
    `${year}-07-16`, // Virgen del Carmen
    `${year}-08-15`, // Asunción de la Virgen
    `${year}-09-18`, // Independencia
    `${year}-09-19`, // Glorias del Ejército
    `${year}-10-31`, // Día de las Iglesias Evangélicas
    `${year}-11-01`, // Día de Todos los Santos
    `${year}-12-08`, // Inmaculada Concepción
    `${year}-12-25`, // Navidad
  ];
  // Semana Santa (cálculo algoritmo Gauss)
  const a=year%19, b=Math.floor(year/100), c=year%100;
  const d2=Math.floor(b/4), e=b%4, f2=Math.floor((b+8)/25);
  const g=Math.floor((b-f2+1)/3), h=(19*a+b-d2-g+15)%30;
  const i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7;
  const m2=Math.floor((a+11*h+22*l)/451);
  const mes=Math.floor((h+l-7*m2+114)/31);
  const dia=(h+l-7*m2+114)%31+1;
  const pascua=new Date(year,mes-1,dia);
  const viernesSanto=new Date(pascua); viernesSanto.setDate(pascua.getDate()-2);
  const lunesGloria=new Date(pascua); lunesGloria.setDate(pascua.getDate()+1);
  const fmt2=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return new Set([...fijos, fmt2(viernesSanto), fmt2(lunesGloria)]);
}

// Cuenta días hábiles entre dos fechas (inclusive), excluyendo sábados, domingos y feriados
function diasHabiles(desde, hasta) {
  if(!desde||!hasta) return 0;
  const d1=new Date(desde+"T00:00:00");
  const d2=new Date(hasta+"T00:00:00");
  if(d2<d1) return 0;
  // Obtener feriados de todos los años en el rango
  const years=new Set();
  for(let y=d1.getFullYear();y<=d2.getFullYear();y++) years.add(y);
  const feriados=new Set();
  years.forEach(y=>{ getFeriadosChile(y).forEach(f=>feriados.add(f)); });
  let count=0;
  const cur=new Date(d1);
  while(cur<=d2) {
    const dow=cur.getDay(); // 0=dom, 6=sab
    const fStr=`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
    if(dow!==0 && dow!==6 && !feriados.has(fStr)) count++;
    cur.setDate(cur.getDate()+1);
  }
  return count;
}

function filtroPer(items,p,c1,c2) {
  const n=new Date();
  return (items||[]).filter(x=>{
    const d=new Date(x.fecha+"T00:00:00");
    if(p==="dia")    return x.fecha===hoy();
    if(p==="semana") { const s=new Date(n); s.setDate(n.getDate()-n.getDay()); s.setHours(0,0,0,0); return d>=s; }
    if(p==="mes")    return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();
    if(p==="año")    return d.getFullYear()===n.getFullYear();
    if(p==="custom"&&c1&&c2) return x.fecha>=c1&&x.fecha<=c2;
    return true;
  });
}
function filtroMes(items,mk) {
  return (items||[]).filter(x=>{ const d=new Date((x.fecha||"")+"T00:00:00"); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`===mk; });
}
function dias14() { return Array.from({length:14},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(13-i)); return d.toISOString().split("T")[0]; }); }

function getFijosMap(data,suc,mk) { return {...(data.fijosBase?.[suc]||{}),...((data.fijosOv||{})[mk]?.[suc]||{})}; }
function getVarMap(data,suc,mk)   { return {...(data.varBase?.[suc]||{}),...((data.varOv||{})[mk]?.[suc]||{})}; }

function calcIVA(data,suc,mk) {
  const boletas    = filtroMes(data[suc]?.boletas||[],mk);
  const totalBol   = boletas.reduce((s,x)=>s+x.monto,0);
  const netoVentas = Math.round(totalBol/1.19);
  const ivaDebito  = totalBol - netoVentas;
  const facturas   = [...filtroMes(data[suc]?.gastos||[],mk).filter(g=>g.categoria==="proveedor"&&g.factura),...filtroMes(data[suc]?.cigarros?.gastos||[],mk).filter(g=>g.factura)];
  const totalFact  = facturas.reduce((s,g)=>s+g.monto,0);
  const netoCompras= Math.round(totalFact/1.19);
  const ivaCredito = totalFact - netoCompras;
  const ivaPagar   = Math.max(0,ivaDebito-ivaCredito);
  // PPM: 3% del neto de boletas emitidas
  const ppm        = Math.round(netoVentas*0.03);
  const totalPagar = ivaPagar + ppm;
  return { boletas, totalBol, netoVentas, ivaDebito, totalFact, netoCompras, ivaCredito, ivaPagar, ppm, totalPagar };
}

function calcReporte(data,suc,mk) {
  const v  = filtroMes(data[suc]?.ventas||[],mk);
  const g  = filtroMes(data[suc]?.gastos||[],mk);
  const cv = filtroMes(data[suc]?.cigarros?.ventas||[],mk);
  const cg = filtroMes(data[suc]?.cigarros?.gastos||[],mk);
  const tv=v.reduce((s,x)=>s+x.monto,0), tg=g.reduce((s,x)=>s+x.monto,0);
  const tcv=cv.reduce((s,x)=>s+x.monto,0), tcg=cg.reduce((s,x)=>s+x.monto,0);
  const tar=v.filter(x=>x.tipo==="tarjeta").reduce((s,x)=>s+x.monto,0);
  const comTar=Math.round(tar*(data.comision?.[suc]||0)/100);
  const utilBruta=(tv-tg-comTar)+(tcv-tcg);
  const fm=getFijosMap(data,suc,mk); const vm=getVarMap(data,suc,mk);
  const fd=FIJOS_DEF[suc]; const fe=data.fijosExtra?.[suc]||[];
  const vd=VAR_DEF[suc];   const ve=data.varExtra?.[suc]||[];
  const totalFijos=[...fd,...fe].reduce((s,x)=>s+(fm[x.id]||0),0);
  const totalVarMan=[...vd,...ve].reduce((s,x)=>s+(vm[x.id]||0),0);
  const iva=calcIVA(data,suc,mk);
  const totalVar=totalVarMan+iva.totalPagar;
  return {
    tv,tg,tcv,tcg,tar,comTar,utilBruta,totalFijos,totalVar,totalVarMan,
    ivaPagar:iva.ivaPagar, ppm:iva.ppm, totalPagar:iva.totalPagar,
    utilReal:utilBruta-totalFijos-totalVar,
    ef:v.filter(x=>x.tipo==="efectivo").reduce((s,x)=>s+x.monto,0),
    trans:v.filter(x=>x.tipo==="transferencia").reduce((s,x)=>s+x.monto,0),
    fm,vm,
  };
}

// ── EXTERNOS (correo / calendar) ─────────────────────────
function abrirCorreo({para=CORREOS_DUENOS,asunto="",cuerpo=""}) {
  const dest=Array.isArray(para)?para.join(","):para;
  window.open(`mailto:${dest}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`,"_blank");
}
function abrirCalendar({titulo="",inicio="",fin="",descripcion=""}) {
  window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${encodeURIComponent(inicio)}/${encodeURIComponent(fin)}&details=${encodeURIComponent(descripcion)}`,"_blank");
}

// ── STORAGE ───────────────────────────────────────────────
const LS="duo_v8";
const DATA0=()=>({
  carahue:{ ventas:[], gastos:[], proveedores:PROV_DEF.carahue, cigarros:{ventas:[],gastos:[]}, boletas:[] },
  temuco: { ventas:[], gastos:[], proveedores:PROV_DEF.temuco,  cigarros:{ventas:[],gastos:[]}, boletas:[] },
  fijosBase:{ carahue:{}, temuco:{} }, fijosOv:{}, fijosExtra:{ carahue:[], temuco:[] },
  varBase:  { carahue:{}, temuco:{} }, varOv:{},   varExtra:  { carahue:[], temuco:[] },
  // Desglose sueldos: { "fc1": { liquido:0, prevision:0 }, ... }
  sueldosDetalle: { carahue:{}, temuco:{} },
  comision:{ carahue:1.5, temuco:1.5 },
  mensajes:[], chatDuenos:[], notas:[],
  trabajadores:{
    carahue_t1:{ nombre:"Trabajador/a Turno 1", contrato:"indefinido", fechaIngreso:"", diasVac:15, diasUsados:0, solicitudes:[] },
    carahue_t2:{ nombre:"Trabajador/a Turno 2", contrato:"indefinido", fechaIngreso:"", diasVac:15, diasUsados:0, solicitudes:[] },
    temuco:    { nombre:"Trabajador/a Temuco",  contrato:"indefinido", fechaIngreso:"", diasVac:15, diasUsados:0, solicitudes:[] },
  },
});
const load =()=>{ try{ const d=localStorage.getItem(LS); return d?JSON.parse(d):null; }catch{return null;} };
const save =(d)=>{ try{ localStorage.setItem(LS,JSON.stringify(d)); }catch{} };
function mergeData(s) {
  const b=DATA0(); if(!s)return b;
  return { ...b,...s,
    carahue:{...b.carahue,...s.carahue,boletas:s.carahue?.boletas||[]},
    temuco: {...b.temuco, ...s.temuco, boletas:s.temuco?.boletas||[]},
    comision:s.comision||b.comision, mensajes:s.mensajes||s.observaciones||[],
    chatDuenos:s.chatDuenos||[], notas:s.notas||[],
    sueldosDetalle:s.sueldosDetalle||b.sueldosDetalle,
    fijosBase:s.fijosBase||b.fijosBase, fijosOv:s.fijosOv||b.fijosOv,
    varBase:s.varBase||b.varBase, varOv:s.varOv||b.varOv,
  };
}

// ── MICRO COMPONENTES ─────────────────────────────────────
function Lbl({children}){ return <div style={{fontSize:10,color:"#ffffff40",letterSpacing:2,marginBottom:5}}>{children}</div>; }
function Inp({label,type="text",value,onChange,placeholder,rows}){
  const stop=(e)=>e.stopPropagation();
  if(rows) return <div style={{marginBottom:14}} onClick={stop}><Lbl>{label}</Lbl><textarea rows={rows} value={value||""} placeholder={placeholder} onClick={stop} onFocus={stop} onChange={e=>{stop(e);onChange(e.target.value);}} style={{...IS,resize:"vertical",lineHeight:1.6}}/></div>;
  return <div style={{marginBottom:14}} onClick={stop}><Lbl>{label}</Lbl><input type={type} inputMode={type==="number"?"numeric":undefined} value={value||""} placeholder={placeholder} onClick={stop} onFocus={stop} onChange={e=>{stop(e);onChange(e.target.value);}} style={IS}/></div>;
}
function Sel({label,value,onChange,children}){ return <div style={{marginBottom:14}} onClick={e=>e.stopPropagation()}><Lbl>{label}</Lbl><select value={value} onClick={e=>e.stopPropagation()} onFocus={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();onChange(e.target.value);}} style={IS}>{children}</select></div>; }
function Btn({onClick,color="#f97316",loading=false,children,full=true}){
  return <button onClick={onClick} disabled={loading} style={{width:full?"100%":"auto",padding:"11px 16px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${color},${color}cc)`,color:color==="#fbbf24"?"#000":"#fff",fontWeight:800,fontSize:13,cursor:loading?"not-allowed":"pointer",marginTop:6,opacity:loading?0.7:1}}>{loading?"Guardando...":children}</button>;
}
function Tag({label,color}){ return <span style={{background:color+"20",color,padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:700}}>{label}</span>; }
function DelBtn({onClick}){ return <button onClick={onClick} style={{background:"#ef444415",border:"none",color:"#f87171",width:26,height:26,borderRadius:8,cursor:"pointer",fontSize:13,flexShrink:0}}>×</button>; }
function Empty({text}){ return <div style={{textAlign:"center",color:"#ffffff18",padding:40,fontSize:13}}>{text}</div>; }
function Kpi({valor,label,sub}){
  const pos=valor>=0;
  return <div style={{background:pos?"linear-gradient(135deg,#22c55e14,#4ade8005)":"linear-gradient(135deg,#ef444414,#f8717105)",border:`1px solid ${pos?"#22c55e22":"#ef444422"}`,borderRadius:18,padding:"18px",marginBottom:18,textAlign:"center"}}><div style={{fontSize:10,color:"#ffffff28",letterSpacing:4,marginBottom:4}}>{label}</div><div style={{fontSize:38,fontWeight:900,color:pos?"#4ade80":"#f87171",letterSpacing:"-2px"}}>{fmt(valor)}</div>{sub&&<div style={{fontSize:10,color:"#ffffff25",marginTop:4}}>{sub}</div>}</div>;
}
function FR({label,valor,color,bold,big,sub,final}){
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:sub?"2px 0":"5px 0",opacity:sub?0.8:1}}><div style={{fontSize:sub?10:11,color:sub?"#ffffff38":"#ffffff58",fontWeight:bold?"700":"400",paddingLeft:sub?8:0}}>{label}</div><div style={{fontSize:big?16:sub?11:12,fontWeight:bold||big?"800":"500",color,background:final?color+"14":undefined,padding:final?"4px 10px":undefined,borderRadius:final?8:undefined}}>{valor>=0?"+":""}{fmt(valor)}</div></div>;
}
function QBtn({icon,label,color,onClick}){
  return <button onClick={onClick} style={{padding:"14px 10px",borderRadius:14,border:`1px solid ${color}20`,background:color+"0e",color,fontWeight:800,fontSize:12,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:5,width:"100%"}}><span style={{fontSize:22}}>{icon}</span>{label}</button>;
}
function IBox({label,value}){ return <div style={{background:"#ffffff05",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:9,color:"#ffffff30",marginBottom:2}}>{label}</div><div style={{fontSize:12,fontWeight:700}}>{value||"—"}</div></div>; }
function MoneyInput({value,onChange,highlighted}){
  return <div style={{position:"relative"}} onClick={e=>e.stopPropagation()}><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:highlighted?"#f97316":"#ffffff33",pointerEvents:"none"}}>$</span><input type="number" inputMode="numeric" placeholder="0" value={value||""} onClick={e=>e.stopPropagation()} onFocus={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();onChange(e.target.value);}} style={{...IS,width:120,paddingLeft:22,textAlign:"right",borderColor:highlighted?"#f9731640":"#ffffff12",color:highlighted?"#fb923c":"#f0ece8"}}/></div>;
}
function TotalRow({label,valor,color}){ return <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:color+"0a",borderRadius:8,marginTop:6}}><span style={{fontSize:11,color:color+"88"}}>{label}</span><span style={{fontSize:13,fontWeight:800,color}}>{fmt(valor)}</span></div>; }
// Categorías de proveedor disponibles
const CATS_PROV = ["General","Comida","Snack","Dulces","Confites","Bebidas","Lácteos","Limpieza","Cigarros","Otro"];

function ProvCard({p,gastos,onDel,onEdit,cigarro}){
  const total=(gastos||[]).filter(g=>g.proveedor===p.nombre).reduce((s,g)=>s+g.monto,0);
  const colBg=cigarro?"linear-gradient(135deg,#fbbf24,#f59e0b)":"linear-gradient(135deg,#8b5cf6,#a78bfa)";
  const colBorder=cigarro?"#fbbf2412":"#8b5cf612";
  return(
    <div style={{background:"#0d1525",borderRadius:12,padding:"12px 14px",marginBottom:8,border:`1px solid ${colBorder}`}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{width:36,height:36,borderRadius:10,background:colBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,flexShrink:0}}>{p.nombre[0]?.toUpperCase()}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{p.nombre}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
            {p.categoria&&<span style={{fontSize:10,background:cigarro?"#fbbf2420":"#8b5cf620",color:cigarro?"#fbbf24":"#a78bfa",padding:"2px 7px",borderRadius:5,fontWeight:700}}>{p.categoria}</span>}
            {p.vendedor&&<span style={{fontSize:10,background:"#60a5fa20",color:"#60a5fa",padding:"2px 7px",borderRadius:5}}>👤 {p.vendedor}</span>}
          </div>
          {p.contacto&&<div style={{fontSize:10,color:"#ffffff44"}}>📞 {p.contacto}</div>}
          <div style={{fontSize:11,color:"#f87171",marginTop:2}}>Total pagado: {fmt(total)}</div>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <button onClick={onEdit} style={{background:"#ffffff10",border:"none",color:"#ffffff66",width:28,height:28,borderRadius:8,cursor:"pointer",fontSize:13}}>✏️</button>
          <DelBtn onClick={onDel}/>
        </div>
      </div>
    </div>
  );
}
function BtnNotif({icon,label,sub,color,onClick}){
  return <button onClick={onClick} style={{width:"100%",background:color+"0e",border:`1px solid ${color}25`,borderRadius:12,padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}><span style={{fontSize:22,flexShrink:0}}>{icon}</span><div><div style={{fontSize:12,fontWeight:700,color}}>{label}</div>{sub&&<div style={{fontSize:10,color:"#ffffff44",marginTop:2}}>{sub}</div>}</div><span style={{marginLeft:"auto",color:color+"88",fontSize:18}}>→</span></button>;
}

// ── APP RAÍZ ──────────────────────────────────────────────
export default function App(){
  const [sesion,setSesion]=useState(null);
  const [data,setData]=useState(()=>mergeData(load()));
  const [sincronizado,setSincronizado]=useState(false);

  // Escuchar cambios en tiempo real desde Firebase
  useEffect(()=>{
    const unsub=escucharFirebase((datosFirebase)=>{
      const merged=mergeData(datosFirebase);
      setData(merged);
      save(merged);
      setSincronizado(true);
    });
    return ()=>unsub();
  },[]);

  // Guardar en local Y en Firebase (activa tiempo real)
  const guardar=(nd)=>{
    setData(nd);
    save(nd);
    guardarFirebase(nd);
  };

  if(!sesion) return <PantallaLogin onLogin={setSesion}/>;
  if(sesion.rol==="dueno") return <VistaDueno sesion={sesion} data={data} guardar={guardar} onSalir={()=>setSesion(null)}/>;
  return <VistaVendedora sesion={sesion} data={data} guardar={guardar} onSalir={()=>setSesion(null)}/>;
}


// ── LOGIN ─────────────────────────────────────────────────
function PantallaLogin({onLogin}){
  const [uid2,setUid]=useState(""); const [pass,setPass]=useState("");
  const [show,setShow]=useState(false); const [err,setErr]=useState("");
  const entrar=()=>{ const u=USUARIOS.find(x=>x.id===uid2&&x.pass===pass); if(!u){setErr("Usuario o contraseña incorrectos");return;} setErr(""); onLogin(u); };
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(155deg,#07090f,#0c1420)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:52,marginBottom:4}}>🏪</div>
          <div style={{fontSize:40,fontWeight:900,letterSpacing:"-3px",color:"#fff",lineHeight:1}}>DUO</div>
          <div style={{fontSize:11,color:"#ffffff28",letterSpacing:5,textTransform:"uppercase",marginTop:6}}>Control de Negocios</div>
          <div style={{fontSize:11,color:"#ffffff18",marginTop:4}}>Carahue · Temuco</div>
        </div>
        <div style={{background:"#0d1525",borderRadius:20,padding:26,border:"1px solid #ffffff0c"}}>
          <Sel label="USUARIO" value={uid2} onChange={setUid}>
            <option value="">-- Seleccionar --</option>
            <optgroup label="🔑 Administradores">{USUARIOS.filter(u=>u.rol==="dueno").map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}</optgroup>
            <optgroup label="🏪 Sucursales">{USUARIOS.filter(u=>u.rol==="vendedora").map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}</optgroup>
          </Sel>
          <div style={{marginBottom:20}}>
            <Lbl>CONTRASEÑA</Lbl>
            <div style={{position:"relative"}}>
              <input type={show?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&entrar()} placeholder="••••••••" style={{...IS,paddingRight:44}}/>
              <button onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#ffffff33",cursor:"pointer",fontSize:15}}>{show?"🙈":"👁️"}</button>
            </div>
          </div>
          {err&&<div style={{color:"#f87171",fontSize:12,marginBottom:12,textAlign:"center"}}>{err}</div>}
          <Btn onClick={entrar} color="#f97316">Ingresar →</Btn>
        </div>
      </div>
    </div>
  );
}

// ── CHAT GENERAL (dueños ↔ vendedoras) ───────────────────
function PanelMensajes({sesion,data,guardar}){
  const [texto,setTexto]=useState(""); const [para,setPara]=useState("todos");
  const esDueno=sesion.rol==="dueno"; const suc=sesion.sucursal;
  const mensajes=useMemo(()=>(data.mensajes||[]).filter(m=>{
    if(esDueno)return true;
    if(m.de===sesion.id)return true;
    if(m.de!=="dueno")return m.sucursal===suc;
    return m.para==="todos"||m.para===suc;
  }).sort((a,b)=>a.id.localeCompare(b.id)),[data.mensajes,esDueno,sesion.id,suc]);
  const enviar=()=>{
    if(!texto.trim())return;
    const hora=new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"});
    const msg=esDueno
      ?{id:uid(),de:"dueno",nombreDe:sesion.nombre,para,texto:texto.trim(),fecha:hoy(),hora,leido:false}
      :{id:uid(),de:sesion.id,nombreDe:sesion.nombre,sucursal:suc,turno:sesion.turno,para:"dueno",texto:texto.trim(),fecha:hoy(),hora,leido:false};
    guardar({...data,mensajes:[...(data.mensajes||[]),msg]}); setTexto("");
  };
  const marcar=(id)=>guardar({...data,mensajes:(data.mensajes||[]).map(m=>m.id===id?{...m,leido:true}:m)});
  return(
    <div>
      <div style={{background:"#0d1525",borderRadius:14,padding:16,marginBottom:14,border:"1px solid #f9731618"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#f97316",marginBottom:12}}>{esDueno?"📤 Enviar a vendedores":"✏️ Escribir a los administradores"}</div>
        {esDueno&&<Sel label="DESTINATARIO" value={para} onChange={setPara}><option value="todos">📢 Todos</option><option value="carahue">🌿 Carahue</option><option value="temuco">🏙️ Temuco</option></Sel>}
        <Inp label="MENSAJE" value={texto} onChange={setTexto} placeholder="Escribe aquí..." rows={3}/>
        <Btn onClick={enviar} color={esDueno?"#f97316":"#3b82f6"}>Enviar</Btn>
      </div>
      <div style={{background:"#0d1525",borderRadius:14,padding:16,border:"1px solid #ffffff0c"}}>
        <div style={{fontSize:11,color:"#ffffff33",marginBottom:14,letterSpacing:2}}>CONVERSACIÓN</div>
        {mensajes.length===0&&<Empty text="Sin mensajes aún"/>}
        {mensajes.map(m=>{
          const esMio=esDueno?m.de==="dueno":m.de===sesion.id;
          const esDMsg=m.de==="dueno";
          const quien=esDMsg?`👑 ${m.nombreDe}`:`${m.sucursal==="carahue"?"🌿":"🏙️"} ${m.nombreDe||m.de}${m.turno?` · ${m.turno}`:""}`;
          const dest=esDMsg&&(m.para==="todos"?"→ Todos":m.para==="carahue"?"→ 🌿 Carahue":"→ 🏙️ Temuco");
          const col=esMio?"#f97316":"#3b82f6";
          return(
            <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:esMio?"flex-end":"flex-start",marginBottom:12}}>
              <div style={{fontSize:10,color:"#ffffff30",marginBottom:3,display:"flex",gap:6}}><span>{quien}</span>{dest&&<span style={{color:"#f9731666"}}>{dest}</span>}<span>{m.hora}</span></div>
              <div style={{maxWidth:"85%",background:esMio?col+"22":"#ffffff0c",border:`1px solid ${esMio?col+"40":"#ffffff10"}`,borderRadius:esMio?"14px 14px 4px 14px":"14px 14px 14px 4px",padding:"10px 14px"}}>
                <div style={{fontSize:13,color:!esMio&&!m.leido?"#f0ece8":"#ffffff77",lineHeight:1.5}}>{m.texto}</div>
              </div>
              {esDueno&&!esDMsg&&!m.leido&&<button onClick={()=>marcar(m.id)} style={{marginTop:3,background:"none",border:"none",color:"#22c55e88",fontSize:10,cursor:"pointer"}}>✓ Leído</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CHAT PRIVADO ENTRE DUEÑOS ─────────────────────────────
function ChatDuenos({sesion,data,guardar}){
  const [texto,setTexto]=useState("");
  const mensajes=useMemo(()=>(data.chatDuenos||[]).sort((a,b)=>a.id.localeCompare(b.id)),[data.chatDuenos]);
  const enviar=()=>{
    if(!texto.trim())return;
    const hora=new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"});
    const msg={id:uid(),de:sesion.id,nombre:sesion.nombre,texto:texto.trim(),fecha:hoy(),hora};
    guardar({...data,chatDuenos:[...mensajes,msg]}); setTexto("");
  };
  return(
    <div>
      <div style={{background:"#f9731610",border:"1px solid #f9731620",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:11,color:"#fb923c"}}>
        🔒 Chat privado — solo visible para los administradores
      </div>
      <div style={{background:"#0d1525",borderRadius:14,padding:16,marginBottom:14,border:"1px solid #f9731620"}}>
        <Inp label="MENSAJE" value={texto} onChange={setTexto} placeholder="Escribe a tu socio/a..." rows={3}/>
        <Btn onClick={enviar} color="#f97316">Enviar</Btn>
      </div>
      <div style={{background:"#0d1525",borderRadius:14,padding:16,border:"1px solid #ffffff0c"}}>
        <div style={{fontSize:11,color:"#ffffff33",marginBottom:14,letterSpacing:2}}>CONVERSACIÓN PRIVADA</div>
        {mensajes.length===0&&<Empty text="Sin mensajes aún"/>}
        {mensajes.map(m=>{
          const esMio=m.de===sesion.id;
          const col=esMio?"#f97316":"#a78bfa";
          return(
            <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:esMio?"flex-end":"flex-start",marginBottom:12}}>
              <div style={{fontSize:10,color:"#ffffff30",marginBottom:3,display:"flex",gap:6}}><span>👑 {m.nombre}</span><span>{m.hora}</span></div>
              <div style={{maxWidth:"85%",background:col+"22",border:`1px solid ${col}40`,borderRadius:esMio?"14px 14px 4px 14px":"14px 14px 14px 4px",padding:"10px 14px"}}>
                <div style={{fontSize:13,color:"#f0ece8",lineHeight:1.5}}>{m.texto}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── NOTAS Y CLAVES ────────────────────────────────────────
function PanelNotas({sesion,data,guardar}){
  const [tab,setTab]=useState("notas");
  const [form,setForm]=useState({tipo:"nota",titulo:"",contenido:"",categoria:"general"});
  const [verClave,setVerClave]=useState({});
  const notas=(data.notas||[]).filter(n=>tab==="notas"?n.tipo==="nota":n.tipo==="clave");
  const agregar=()=>{
    if(!form.titulo||!form.contenido)return;
    guardar({...data,notas:[...(data.notas||[]),{id:uid(),...form,fecha:hoy(),autor:sesion.nombre}]});
    setForm({tipo:tab==="notas"?"nota":"clave",titulo:"",contenido:"",categoria:"general"});
  };
  const eliminar=(id)=>guardar({...data,notas:(data.notas||[]).filter(n=>n.id!==id)});
  const catColors={general:"#60a5fa",urgente:"#f87171",proveedor:"#fbbf24",banco:"#a78bfa",otro:"#86efac"};
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["notas","📝 Notas"],["claves","🔑 Claves"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"6px 16px",borderRadius:20,border:"1px solid",borderColor:tab===k?"#f97316":"#ffffff12",background:tab===k?"#f9731614":"transparent",color:tab===k?"#f97316":"#ffffff44",fontSize:11,fontWeight:700,cursor:"pointer"}}>{l}</button>
        ))}
      </div>
      <div style={{background:"#0d1525",borderRadius:14,padding:16,marginBottom:14,border:"1px solid #ffffff0c"}}>
        <div style={{fontSize:12,fontWeight:700,color:tab==="notas"?"#60a5fa":"#a78bfa",marginBottom:12}}>{tab==="notas"?"📝 Nueva Nota":"🔑 Nueva Clave"}</div>
        <Inp label="TÍTULO" value={form.titulo} onChange={v=>setForm(f=>({...f,titulo:v}))} placeholder={tab==="notas"?"Título de la nota":"Servicio o cuenta..."}/>
        <Inp label={tab==="notas"?"CONTENIDO":"CLAVE / CONTRASEÑA"} value={form.contenido} onChange={v=>setForm(f=>({...f,contenido:v}))} placeholder={tab==="notas"?"Escribe aquí...":"Contraseña o datos de acceso..."} rows={tab==="claves"?2:3}/>
        <Sel label="CATEGORÍA" value={form.categoria} onChange={v=>setForm(f=>({...f,categoria:v}))}>
          <option value="general">General</option>
          {tab==="notas"&&<option value="urgente">🚨 Urgente</option>}
          {tab==="claves"&&<><option value="banco">🏦 Banco</option><option value="proveedor">🏭 Proveedor</option></>}
          <option value="otro">Otro</option>
        </Sel>
        <Btn onClick={agregar} color={tab==="notas"?"#60a5fa":"#a78bfa"}>Guardar {tab==="notas"?"Nota":"Clave"}</Btn>
      </div>
      {notas.length===0&&<Empty text={`Sin ${tab==="notas"?"notas":"claves"} guardadas`}/>}
      {[...notas].reverse().map(n=>(
        <div key={n.id} style={{background:"#0d1525",borderRadius:12,padding:14,marginBottom:10,border:`1px solid ${catColors[n.categoria]||"#ffffff12"}30`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              <Tag label={n.categoria} color={catColors[n.categoria]||"#ffffff44"}/>
              <span style={{fontSize:13,fontWeight:700}}>{n.titulo}</span>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:10,color:"#ffffff30"}}>{n.fecha}</span>
              <DelBtn onClick={()=>eliminar(n.id)}/>
            </div>
          </div>
          {tab==="claves"?(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{flex:1,background:"#ffffff08",borderRadius:8,padding:"8px 12px",fontFamily:"monospace",fontSize:13,color:verClave[n.id]?"#f0ece8":"#ffffff44",letterSpacing:verClave[n.id]?1:3}}>
                {verClave[n.id]?n.contenido:"••••••••••"}
              </div>
              <button onClick={()=>setVerClave(v=>({...v,[n.id]:!v[n.id]}))} style={{background:"#ffffff10",border:"none",color:"#ffffff55",padding:"8px 10px",borderRadius:8,cursor:"pointer",fontSize:13}}>
                {verClave[n.id]?"🙈":"👁️"}
              </button>
            </div>
          ):(
            <div style={{fontSize:12,color:"#ffffff77",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.contenido}</div>
          )}
          <div style={{fontSize:10,color:"#ffffff25",marginTop:6}}>Creado por {n.autor}</div>
        </div>
      ))}
    </div>
  );
}

// ── PANEL IVA + PPM + PREVISIÓN ──────────────────────────
function PanelIVA({data,mes,setMes}){
  const ivaC=calcIVA(data,"carahue",mes);
  const ivaT=calcIVA(data,"temuco", mes);
  const totalIVA=ivaC.totalPagar+ivaT.totalPagar;

  // Previsión: suma de campo "prevision" del desglose de sueldos
  const getPrev=(suc)=>{
    const sd=data.sueldosDetalle?.[suc]||{};
    return FIJOS_DEF[suc].filter(x=>x.esSueldo).reduce((s,x)=>s+(parseFloat(sd[x.id]?.prevision)||0),0);
  };
  const prevC=getPrev("carahue");
  const prevT=getPrev("temuco");
  const totalPrev=prevC+prevT;

  const [y,mo]=mes.split("-");
  const dia12=`${y}-${mo}-12`;
  const dia20=`${y}-${mo}-20`;
  const lblM=lblMes(mes);

  // ── Correo día 12 ──
  const correoPrev=()=>{
    const lineasC=FIJOS_DEF.carahue.filter(x=>x.esSueldo).map(x=>{
      const liq=parseFloat(data.sueldosDetalle?.carahue?.[x.id]?.liquido)||0;
      const prev=parseFloat(data.sueldosDetalle?.carahue?.[x.id]?.prevision)||0;
      return prev>0?`  ${x.label}\n    Líquido: ${fmt(liq)} | Previsión: ${fmt(prev)} | Total: ${fmt(liq+prev)}`:"";
    }).filter(Boolean).join("\n");
    const lineasT=FIJOS_DEF.temuco.filter(x=>x.esSueldo).map(x=>{
      const liq=parseFloat(data.sueldosDetalle?.temuco?.[x.id]?.liquido)||0;
      const prev=parseFloat(data.sueldosDetalle?.temuco?.[x.id]?.prevision)||0;
      return prev>0?`  ${x.label}\n    Líquido: ${fmt(liq)} | Previsión: ${fmt(prev)} | Total: ${fmt(liq+prev)}`:"";
    }).filter(Boolean).join("\n");
    abrirCorreo({
      asunto:`📅 Recordatorio Previsión Trabajadores — 12 de ${lblM}`,
      cuerpo:`PAGO PREVISIÓN DUO NEGOCIOS\nFecha límite: 12 de ${lblM}\n\n🌿 DUO CARAHUE\n${lineasC||"  Sin datos de previsión"}\n  TOTAL PREVISIÓN: ${fmt(prevC)}\n\n🏙️ DUO TEMUCO\n${lineasT||"  Sin datos de previsión"}\n  TOTAL PREVISIÓN: ${fmt(prevT)}\n\nTOTAL GENERAL: ${fmt(totalPrev)}\n\nGenerado desde DUO Control de Negocios`
    });
  };

  // ── Calendar día 12 ──
  const calendarPrev=()=>{
    abrirCalendar({
      titulo:`📅 Pago Previsión Trabajadores DUO — ${fmt(totalPrev)}`,
      inicio:fmtGcal(dia12),
      fin:fmtGcal(sumarD(dia12,1)),
      descripcion:`Pago previsión (AFP + salud) trabajadores DUO\n\nCarahue: ${fmt(prevC)}\nTemuco: ${fmt(prevT)}\nTOTAL: ${fmt(totalPrev)}\n\nFecha límite: 12 de ${lblM}`,
    });
  };

  // ── Correo día 20 ──
  const correoIVA=()=>{
    abrirCorreo({
      asunto:`🧾 Recordatorio IVA + PPM — 20 de ${lblM}`,
      cuerpo:`PAGO IVA + PPM DUO NEGOCIOS\nFecha límite: 20 de ${lblM}\n\n🌿 DUO CARAHUE\n  Neto boletas: ${fmt(ivaC.netoVentas)}\n  IVA Débito:   ${fmt(ivaC.ivaDebito)}\n  IVA Crédito:  ${fmt(ivaC.ivaCredito)}\n  IVA a pagar:  ${fmt(ivaC.ivaPagar)}\n  PPM (3% neto):${fmt(ivaC.ppm)}\n  TOTAL:        ${fmt(ivaC.totalPagar)}\n\n🏙️ DUO TEMUCO\n  Neto boletas: ${fmt(ivaT.netoVentas)}\n  IVA Débito:   ${fmt(ivaT.ivaDebito)}\n  IVA Crédito:  ${fmt(ivaT.ivaCredito)}\n  IVA a pagar:  ${fmt(ivaT.ivaPagar)}\n  PPM (3% neto):${fmt(ivaT.ppm)}\n  TOTAL:        ${fmt(ivaT.totalPagar)}\n\nTOTAL A PAGAR: ${fmt(totalIVA)}\n\nGenerado desde DUO Control de Negocios`
    });
  };

  // ── Calendar día 20 ──
  const calendarIVA=()=>{
    abrirCalendar({
      titulo:`🧾 Pago IVA + PPM DUO — ${fmt(totalIVA)}`,
      inicio:fmtGcal(dia20),
      fin:fmtGcal(sumarD(dia20,1)),
      descripcion:`Pago IVA + PPM DUO Negocios\nCarahue: ${fmt(ivaC.totalPagar)}\nTemuco: ${fmt(ivaT.totalPagar)}\nTOTAL: ${fmt(totalIVA)}\n\nFecha límite: 20 de ${lblM}`,
    });
  };

  return(
    <div>
      <div style={{marginBottom:16}}><Lbl>MES</Lbl><input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{...IS,maxWidth:220}}/></div>

      {/* ── BLOQUE DÍA 12: PREVISIÓN ── */}
      <div style={{background:"#60a5fa10",border:"1px solid #60a5fa25",borderRadius:14,padding:"16px 18px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontSize:12,fontWeight:800,color:"#60a5fa"}}>📅 DÍA 12 — Pago Previsión Trabajadores</div>
            <div style={{fontSize:10,color:"#ffffff44",marginTop:2}}>AFP + Salud · extraído del desglose de sueldos</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:"#ffffff30"}}>Total a pagar</div>
            <div style={{fontSize:22,fontWeight:900,color:"#60a5fa"}}>{fmt(totalPrev)}</div>
          </div>
        </div>

        {/* Detalle por sucursal */}
        {[{suc:"carahue",prev:prevC},{suc:"temuco",prev:prevT}].map(({suc,prev})=>{
          const info=SUCS[suc];
          const sd=data.sueldosDetalle?.[suc]||{};
          const trabajadores=FIJOS_DEF[suc].filter(x=>x.esSueldo);
          return(
            <div key={suc} style={{background:"#ffffff06",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:700}}>{info.emoji} {info.nombre}</span>
                <span style={{fontSize:13,fontWeight:800,color:"#60a5fa"}}>{fmt(prev)}</span>
              </div>
              {trabajadores.map(x=>{
                const liq=parseFloat(sd[x.id]?.liquido)||0;
                const prv=parseFloat(sd[x.id]?.prevision)||0;
                return(prv>0||liq>0)?
                  <div key={x.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0",borderBottom:"1px solid #ffffff07"}}>
                    <span style={{color:"#ffffff55"}}>{x.label}</span>
                    <span style={{color:"#ffffff77"}}>Líq: {fmt(liq)} · Prev: <b style={{color:"#60a5fa"}}>{fmt(prv)}</b></span>
                  </div>:null;
              })}
              {prev===0&&<div style={{fontSize:10,color:"#f8717166"}}>⚠️ Ingresa el desglose de sueldos en 💼 Gastos</div>}
            </div>
          );
        })}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
          <BtnNotif icon="📧" label="Correo recordatorio día 12" sub="A Rodrigo y Jessica" color="#60a5fa" onClick={correoPrev}/>
          <BtnNotif icon="📅" label="Agendar en Calendar" sub={`12 de ${lblM}`} color="#60a5fa" onClick={calendarPrev}/>
        </div>
      </div>

      {/* ── BLOQUE DÍA 20: IVA + PPM ── */}
      <div style={{background:"#f8717110",border:"1px solid #f8717125",borderRadius:14,padding:"16px 18px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontSize:12,fontWeight:800,color:"#f87171"}}>🧾 DÍA 20 — Pago IVA + PPM</div>
            <div style={{fontSize:10,color:"#ffffff44",marginTop:2}}>IVA ventas boletas + PPM 3% neto</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:"#ffffff30"}}>Total a pagar</div>
            <div style={{fontSize:22,fontWeight:900,color:"#f87171"}}>{fmt(totalIVA)}</div>
          </div>
        </div>

        <div style={{background:"#8b5cf610",border:"1px solid #8b5cf620",borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:11,color:"#a78bfa"}}>
          💡 Boletas con IVA incluido → Neto = Bruto ÷ 1.19 → IVA = Bruto − Neto. PPM = 3% del neto.
        </div>

        {[{suc:"carahue",iva:ivaC},{suc:"temuco",iva:ivaT}].map(({suc,iva})=>{
          const info=SUCS[suc];
          return(
            <div key={suc} style={{background:"#ffffff06",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700}}>{info.emoji} {info.nombre}</span>
                <span style={{fontSize:13,fontWeight:800,color:"#f87171"}}>{fmt(iva.totalPagar)}</span>
              </div>
              <div style={{background:"#ffffff04",borderRadius:8,padding:10}}>
                <FR label="🧾 Boletas brutas (c/IVA)"    valor={iva.totalBol}   color="#a78bfa" bold/>
                <FR label="  Neto (÷ 1.19)"              valor={iva.netoVentas} color="#c4b5fd" sub/>
                <FR label="  IVA Débito (bruto − neto)"  valor={iva.ivaDebito}  color="#c4b5fd" sub/>
                <FR label="🗂️ Facturas compra"           valor={iva.totalFact}  color="#60a5fa" bold/>
                <FR label="  IVA Crédito (bruto − neto)" valor={iva.ivaCredito} color="#93c5fd" sub/>
                <div style={{borderTop:"1px dashed #ffffff0e",margin:"6px 0"}}/>
                <FR label="IVA a pagar"                  valor={iva.ivaPagar}   color="#f87171" bold/>
                <FR label="PPM (3% neto)"                valor={iva.ppm}        color="#fbbf24" bold/>
                <div style={{borderTop:"2px solid #ffffff15",margin:"6px 0"}}/>
                <FR label="✅ TOTAL DÍA 20"              valor={iva.totalPagar} color="#f87171" bold big final/>
              </div>
              {iva.boletas.length>0&&(
                <div style={{marginTop:8}}>
                  <div style={{fontSize:9,color:"#ffffff25",letterSpacing:2,marginBottom:5}}>BOLETAS DEL MES</div>
                  {iva.boletas.map(b=>(<div key={b.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #ffffff07",fontSize:11}}><span style={{color:"#ffffff44"}}>{b.fecha}{b.turno&&<span style={{color:"#f9731655"}}> · {b.turno}</span>}</span><span style={{color:"#a78bfa",fontWeight:700}}>{fmt(b.monto)}</span></div>))}
                </div>
              )}
              {iva.boletas.length===0&&<div style={{fontSize:10,color:"#f8717166",marginTop:6}}>⚠️ Sin boletas registradas este mes</div>}
            </div>
          );
        })}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
          <BtnNotif icon="📧" label="Correo recordatorio día 20" sub="A Rodrigo y Jessica" color="#f87171" onClick={correoIVA}/>
          <BtnNotif icon="📅" label="Agendar en Calendar" sub={`20 de ${lblM}`} color="#f87171" onClick={calendarIVA}/>
        </div>
      </div>

      {/* Resumen consolidado */}
      <div style={{background:"#0d1525",borderRadius:14,padding:"14px 16px",border:"1px solid #ffffff0c"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#ffffff55",marginBottom:10,letterSpacing:1}}>RESUMEN OBLIGACIONES DEL MES</div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #ffffff0c"}}>
          <span style={{fontSize:12,color:"#60a5fa"}}>📅 Día 12 — Previsión trabajadores</span>
          <span style={{fontSize:13,fontWeight:800,color:"#60a5fa"}}>{fmt(totalPrev)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #ffffff0c"}}>
          <span style={{fontSize:12,color:"#f87171"}}>🧾 Día 20 — IVA + PPM</span>
          <span style={{fontSize:13,fontWeight:800,color:"#f87171"}}>{fmt(totalIVA)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",marginTop:2}}>
          <span style={{fontSize:12,fontWeight:700,color:"#ffffff88"}}>TOTAL OBLIGACIONES</span>
          <span style={{fontSize:16,fontWeight:900,color:"#fbbf24"}}>{fmt(totalPrev+totalIVA)}</span>
        </div>
      </div>
    </div>
  );
}

// ── PANEL NOTIFICAR ───────────────────────────────────────
function PanelNotificar({sesion,data,esDueno,rc,rt,mes}){
  const suc=sesion.sucursal;
  const [rF,setRF]=useState({asunto:"",cuerpo:""});
  const [cF,setCF]=useState({titulo:"",inicio:"",fin:"",descripcion:""});

  const reporteMensual=()=>{
    if(!rc||!rt)return;
    abrirCorreo({asunto:`📊 Reporte Mensual DUO — ${mes}`,cuerpo:`REPORTE DUO NEGOCIOS · ${mes}\n\n🌿 CARAHUE\nVentas: ${fmt(rc.tv)} | Gastos: ${fmt(rc.tg)}\nComisión tarjeta: ${fmt(rc.comTar)}\nFijos: ${fmt(rc.totalFijos)} | Variables: ${fmt(rc.totalVar)}\nIVA+PPM: ${fmt(rc.totalPagar)}\n✅ Utilidad real: ${fmt(rc.utilReal)}\n\n🏙️ TEMUCO\nVentas: ${fmt(rt.tv)} | Gastos: ${fmt(rt.tg)}\nComisión tarjeta: ${fmt(rt.comTar)}\nFijos: ${fmt(rt.totalFijos)} | Variables: ${fmt(rt.totalVar)}\nIVA+PPM: ${fmt(rt.totalPagar)}\n✅ Utilidad real: ${fmt(rt.utilReal)}\n\nTOTAL CONSOLIDADO: ${fmt(rc.utilReal+rt.utilReal)}`});
  };

  const alerta=(tipo)=>{
    const sucNom=suc?SUCS[suc].nombre:"";
    const asuntos={insumos:`⚠️ Insumos faltantes — ${sucNom}`,urgente:`🚨 Urgente — ${sucNom}`,recordatorio:`📌 Recordatorio — ${sucNom}`};
    const cuerpos={insumos:`${sesion.nombre} reporta insumos faltantes en ${sucNom}.\nFecha: ${hoy()}`,urgente:`${sesion.nombre} reporta situación urgente en ${sucNom}.\nFecha: ${hoy()} · ${new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}`,recordatorio:`Recordatorio de ${sesion.nombre} desde ${sucNom}.\nFecha: ${hoy()}`};
    abrirCorreo({asunto:asuntos[tipo],cuerpo:cuerpos[tipo]});
  };

  return(
    <div>
      <div style={{background:"#0d1525",borderRadius:14,padding:16,marginBottom:14,border:"1px solid #ffffff0c"}}>
        <div style={{fontSize:13,fontWeight:800,marginBottom:4}}>📬 Notificaciones</div>
        <div style={{fontSize:11,color:"#ffffff44",marginBottom:16}}>Se abrirá tu app de correo o Google Calendar con el mensaje ya preparado.</div>

        <div style={{fontSize:11,fontWeight:700,color:"#60a5fa",letterSpacing:1,marginBottom:10}}>📧 CORREO</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
          {esDueno?(
            <>
              <BtnNotif icon="📊" label="Reporte mensual completo" sub="Envía a Rodrigo y Jessica" color="#22c55e" onClick={reporteMensual}/>
              <BtnNotif icon="🔔" label="Recordatorio pago proveedores" sub="Aviso a ambos administradores" color="#f97316" onClick={()=>abrirCorreo({asunto:"🔔 Recordatorio Proveedores DUO",cuerpo:`Revisar pagos pendientes a proveedores.\nFecha: ${hoy()}`})}/>
              <div style={{borderTop:"1px solid #ffffff0c",paddingTop:12}}>
                <Inp label="ASUNTO" value={rF.asunto} onChange={v=>setRF(f=>({...f,asunto:v}))} placeholder="Asunto..."/>
                <Inp label="MENSAJE" value={rF.cuerpo} onChange={v=>setRF(f=>({...f,cuerpo:v}))} placeholder="Mensaje..." rows={3}/>
                <Btn onClick={()=>abrirCorreo({asunto:rF.asunto,cuerpo:rF.cuerpo})} color="#60a5fa">Abrir en correo</Btn>
              </div>
            </>
          ):(
            <>
              <BtnNotif icon="⚠️" label="Alerta insumos faltantes" sub={`→ ${CORREOS_DUENOS.join(", ")}`} color="#fbbf24" onClick={()=>alerta("insumos")}/>
              <BtnNotif icon="🚨" label="Situación urgente" sub={`→ ${CORREOS_DUENOS.join(", ")}`} color="#f87171" onClick={()=>alerta("urgente")}/>
              <BtnNotif icon="📌" label="Recordatorio general" sub={`→ ${CORREOS_DUENOS.join(", ")}`} color="#a78bfa" onClick={()=>alerta("recordatorio")}/>
            </>
          )}
        </div>

        <div style={{fontSize:11,fontWeight:700,color:"#4ade80",letterSpacing:1,marginBottom:10}}>📅 GOOGLE CALENDAR</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {esDueno?(
            <>
              <BtnNotif icon="📅" label="Agendar cierre de mes" sub="1° del mes siguiente" color="#4ade80" onClick={()=>{ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+1); const f=d.toISOString().split("T")[0]; abrirCalendar({titulo:"📊 Cierre Mensual DUO",inicio:fmtGcal(f),fin:fmtGcal(sumarD(f,1)),descripcion:"Revisar reportes, IVA, PPM y liquidar sueldos."}); }}/>
              <div style={{borderTop:"1px solid #ffffff0c",paddingTop:12}}>
                <Inp label="TÍTULO EVENTO" value={cF.titulo} onChange={v=>setCF(f=>({...f,titulo:v}))} placeholder="Nombre del evento..."/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <div><Lbl>INICIO</Lbl><input type="date" value={cF.inicio} onChange={e=>setCF(f=>({...f,inicio:e.target.value}))} style={IS}/></div>
                  <div><Lbl>FIN</Lbl><input type="date" value={cF.fin} onChange={e=>setCF(f=>({...f,fin:e.target.value}))} style={IS}/></div>
                </div>
                <Inp label="DESCRIPCIÓN" value={cF.descripcion} onChange={v=>setCF(f=>({...f,descripcion:v}))} rows={2}/>
                <Btn onClick={()=>abrirCalendar({titulo:cF.titulo,inicio:fmtGcal(cF.inicio),fin:fmtGcal(cF.fin),descripcion:cF.descripcion})} color="#4ade80">Abrir en Calendar</Btn>
              </div>
            </>
          ):(
            <>
              <BtnNotif icon="🏖️" label="Agendar solicitud vacaciones" sub="Coordinar con administradores" color="#60a5fa" onClick={()=>abrirCalendar({titulo:`🏖️ Vacaciones ${sesion.nombre}`,inicio:fmtGcal(hoy()),fin:fmtGcal(sumarD(hoy(),1)),descripcion:`Solicitud de vacaciones\nCoordinar reemplazo con 1 semana de anticipación.`})}/>
              <BtnNotif icon="📋" label="Agendar reunión con administradores" sub="Crea evento de coordinación" color="#4ade80" onClick={()=>abrirCalendar({titulo:`📋 Reunión DUO — ${suc?SUCS[suc].nombre:""}`,inicio:fmtGcal(hoy()),fin:fmtGcal(sumarD(hoy(),1)),descripcion:"Reunión de coordinación DUO Negocios"})}/>
              <div style={{borderTop:"1px solid #ffffff0c",paddingTop:12}}>
                <Inp label="TÍTULO EVENTO" value={cF.titulo} onChange={v=>setCF(f=>({...f,titulo:v}))} placeholder="Nombre del evento..."/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <div><Lbl>INICIO</Lbl><input type="date" value={cF.inicio} onChange={e=>setCF(f=>({...f,inicio:e.target.value}))} style={IS}/></div>
                  <div><Lbl>FIN</Lbl><input type="date" value={cF.fin} onChange={e=>setCF(f=>({...f,fin:e.target.value}))} style={IS}/></div>
                </div>
                <Btn onClick={()=>abrirCalendar({titulo:cF.titulo,inicio:fmtGcal(cF.inicio),fin:fmtGcal(cF.fin),descripcion:cF.descripcion})} color="#4ade80">Abrir en Calendar</Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PANEL INFORMES ───────────────────────────────────────
function PanelInformes({data}){
  const [tipo,setTipo]=useState("mensual"); // mensual | semanal | diario | custom
  const [mes,setMes]=useState(mesNow());
  const [semana,setSemana]=useState(0);
  const [diaF,setDiaF]=useState(hoy());
  const [rangoD,setRangoD]=useState({desde:hoy(),hasta:hoy()});

  const rangoSemana=(offset=0)=>{
    const hoy2=new Date();
    const lunes=new Date(hoy2);
    lunes.setDate(hoy2.getDate()-hoy2.getDay()+1-(offset*7));
    lunes.setHours(0,0,0,0);
    const domingo=new Date(lunes);
    domingo.setDate(lunes.getDate()+6);
    const fmt2=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    return {desde:fmt2(lunes),hasta:fmt2(domingo),label:`${String(lunes.getDate()).padStart(2,"0")}/${String(lunes.getMonth()+1).padStart(2,"0")} — ${String(domingo.getDate()).padStart(2,"0")}/${String(domingo.getMonth()+1).padStart(2,"0")}/${domingo.getFullYear()}`};
  };

  const rango=rangoSemana(semana);

  const calcSuc2=(suc)=>{
    let v,g,cv,cg;
    if(tipo==="mensual"){
      v=filtroMes(data[suc]?.ventas||[],mes);
      g=filtroMes(data[suc]?.gastos||[],mes);
      cv=filtroMes(data[suc]?.cigarros?.ventas||[],mes);
      cg=filtroMes(data[suc]?.cigarros?.gastos||[],mes);
    } else if(tipo==="diario"){
      v=(data[suc]?.ventas||[]).filter(x=>x.fecha===diaF);
      g=(data[suc]?.gastos||[]).filter(x=>x.fecha===diaF);
      cv=(data[suc]?.cigarros?.ventas||[]).filter(x=>x.fecha===diaF);
      cg=(data[suc]?.cigarros?.gastos||[]).filter(x=>x.fecha===diaF);
    } else if(tipo==="custom"){
      v=(data[suc]?.ventas||[]).filter(x=>x.fecha>=rangoD.desde&&x.fecha<=rangoD.hasta);
      g=(data[suc]?.gastos||[]).filter(x=>x.fecha>=rangoD.desde&&x.fecha<=rangoD.hasta);
      cv=(data[suc]?.cigarros?.ventas||[]).filter(x=>x.fecha>=rangoD.desde&&x.fecha<=rangoD.hasta);
      cg=(data[suc]?.cigarros?.gastos||[]).filter(x=>x.fecha>=rangoD.desde&&x.fecha<=rangoD.hasta);
    } else {
      v=(data[suc]?.ventas||[]).filter(x=>x.fecha>=rango.desde&&x.fecha<=rango.hasta);
      g=(data[suc]?.gastos||[]).filter(x=>x.fecha>=rango.desde&&x.fecha<=rango.hasta);
      cv=(data[suc]?.cigarros?.ventas||[]).filter(x=>x.fecha>=rango.desde&&x.fecha<=rango.hasta);
      cg=(data[suc]?.cigarros?.gastos||[]).filter(x=>x.fecha>=rango.desde&&x.fecha<=rango.hasta);
    }
    const tv=v.reduce((s,x)=>s+x.monto,0);
    const tg=g.reduce((s,x)=>s+x.monto,0);
    const tcv=cv.reduce((s,x)=>s+x.monto,0);
    const tcg=cg.reduce((s,x)=>s+x.monto,0);
    const ef=v.filter(x=>x.tipo==="efectivo").reduce((s,x)=>s+x.monto,0);
    const tar=v.filter(x=>x.tipo==="tarjeta").reduce((s,x)=>s+x.monto,0);
    const trans=v.filter(x=>x.tipo==="transferencia").reduce((s,x)=>s+x.monto,0);
    const comTar=Math.round(tar*(data.comision?.[suc]||0)/100);
    const mk=tipo==="mensual"?mes:`${rango.desde.slice(0,7)}`;
    const fijosMap=getFijosMap(data,suc,mk);
    const varMap=getVarMap(data,suc,mk);
    const fd=FIJOS_DEF[suc]||[]; const fe=data.fijosExtra?.[suc]||[];
    const vd=VAR_DEF[suc]||[];   const ve=data.varExtra?.[suc]||[];
    const totalFijos=tipo==="mensual"?[...fd,...fe].reduce((s,x)=>s+(parseFloat(fijosMap[x.id])||0),0):0;
    const totalVar=tipo==="mensual"?[...vd,...ve].reduce((s,x)=>s+(parseFloat(varMap[x.id])||0),0):0;
    const iva=tipo==="mensual"?calcIVA(data,suc,mk):{ivaPagar:0,ppm:0,totalPagar:0};
    const utilBruta=tv+tcv-tg-tcg-comTar;
    const utilReal=utilBruta-totalFijos-totalVar-iva.ivaPagar-iva.ppm;
    const diasOper=[...new Set(v.map(x=>x.fecha))].length||1;
    const promDia=Math.round(tv/diasOper);
    const t1=v.filter(x=>x.turno==="Turno 1").reduce((s,x)=>s+x.monto,0);
    const t2=v.filter(x=>x.turno==="Turno 2").reduce((s,x)=>s+x.monto,0);
    return{tv,tg,tcv,tcg,ef,tar,trans,comTar,totalFijos,totalVar,utilBruta,utilReal,iva,diasOper,promDia,t1,t2,fijosMap,varMap,fd,fe,vd,ve};
  };

  const car=calcSuc2("carahue");
  const tem=calcSuc2("temuco");
  const totalUtil=car.utilReal+tem.utilReal;
  const totalVentas=car.tv+tem.tv;

  const periodoLabel=tipo==="mensual"?lblMes(mes):tipo==="diario"?diaF:tipo==="custom"?`${rangoD.desde} → ${rangoD.hasta}`:rango.label;
  const titulo=tipo==="mensual"?`Informe Mensual — ${periodoLabel}`:tipo==="diario"?`Informe Diario — ${periodoLabel}`:tipo==="custom"?`Informe Rango — ${periodoLabel}`:`Informe Semanal — ${periodoLabel}`;

  const imprimirPDF=()=>{
    const w=window.open("","_blank");
    const estilos=`
      body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a2e;margin:0;padding:24px;font-size:13px;}
      h1{font-size:22px;font-weight:900;margin-bottom:4px;color:#1a1a2e;}
      h2{font-size:16px;font-weight:800;margin:20px 0 10px;color:#1a1a2e;border-bottom:2px solid #e5e7eb;padding-bottom:6px;}
      h3{font-size:13px;font-weight:700;margin:14px 0 6px;color:#374151;}
      .sub{font-size:11px;color:#6b7280;margin-bottom:16px;}
      .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
      .kpi{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px;text-align:center;}
      .kpi-val{font-size:20px;font-weight:900;margin-bottom:4px;}
      .kpi-lbl{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;}
      .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6;}
      .row.bold{font-weight:700;}
      .row.total{font-weight:900;font-size:15px;background:#f9fafb;padding:8px 6px;border-radius:6px;margin-top:6px;}
      .pos{color:#059669;} .neg{color:#dc2626;}
      .suc{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;}
      .footer{margin-top:30px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px;}
      @media print{body{padding:12px;}}
    `;
    const fmtP=(n)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
    const rowP=(l,v,bold=false,pos=null)=>{
      const color=pos===null?(v>=0?"pos":"neg"):(pos?"pos":"neg");
      return `<div class="row${bold?" bold":""}"><span>${l}</span><span class="${color}">${fmtP(v)}</span></div>`;
    };
    const secSuc=(suc,r,info)=>`
      <div class="suc">
        <h2>${info.emoji} ${info.nombre}</h2>
        <h3>📥 Ingresos</h3>
        ${rowP("💰 Ventas totales",r.tv,true,true)}
        ${rowP("  💵 Efectivo",r.ef)}
        ${rowP("  💳 Tarjeta bruta",r.tar)}
        ${r.comTar>0?rowP(`  ↳ Comisión TUU (${data.comision?.[suc]||0}%)`,-r.comTar,false,false):""}
        ${rowP("  🏦 Transferencia",r.trans)}
        ${rowP("🚬 Ventas cigarros",r.tcv,true,true)}
        <h3>📤 Egresos</h3>
        ${rowP("📉 Gastos operacionales",-r.tg,true,false)}
        ${rowP("📦 Compras cigarros",-r.tcg,true,false)}
        ${tipo==="mensual"?`
          ${rowP("💼 Gastos fijos",-r.totalFijos,true,false)}
          ${[...r.fd,...r.fe].map(x=>{ const v2=parseFloat(r.fijosMap[x.id])||0; return v2>0?rowP(`  ${x.label}`,-v2):"";}).join("")}
          ${rowP("📊 Gastos variables",-r.totalVar,true,false)}
          ${[...r.vd,...r.ve].map(x=>{ const v2=parseFloat(r.varMap[x.id])||0; return v2>0?rowP(`  ${x.label}`,-v2):"";}).join("")}
          ${r.iva.ivaPagar>0?rowP("🧾 IVA a pagar",-r.iva.ivaPagar,false,false):""}
          ${r.iva.ppm>0?rowP("📊 PPM",-r.iva.ppm,false,false):""}
        `:""}
        <h3>📊 Resultado</h3>
        <div class="row total"><span>= Utilidad operacional</span><span class="${r.utilBruta>=0?"pos":"neg"}">${fmtP(r.utilBruta)}</span></div>
        ${tipo==="mensual"?`<div class="row total"><span>= UTILIDAD REAL (después de todo)</span><span class="${r.utilReal>=0?"pos":"neg"}">${fmtP(r.utilReal)}</span></div>`:""}
        ${suc==="carahue"?`<h3>⏰ Por Turno</h3>${rowP("🌅 Turno 1",r.t1)}${rowP("🌙 Turno 2",r.t2)}`:""}
        <h3>📈 Indicadores</h3>
        ${rowP("Días con operaciones",r.diasOper,false,true)}
        ${rowP("Promedio diario ventas",r.promDia,false,true)}
      </div>`;

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${titulo}</title><style>${estilos}</style></head><body>
      <h1>🏪 DUO Control de Negocios</h1>
      <div class="sub">${titulo} · Generado el ${new Date().toLocaleDateString("es-CL",{day:"2-digit",month:"long",year:"numeric"})}</div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-val pos">${fmtP(totalVentas)}</div><div class="kpi-lbl">Ventas totales</div></div>
        <div class="kpi"><div class="kpi-val ${totalUtil>=0?"pos":"neg"}">${fmtP(totalUtil)}</div><div class="kpi-lbl">Utilidad ${tipo==="mensual"?"real":"operacional"}</div></div>
        <div class="kpi"><div class="kpi-val">${fmtP(car.tv+tem.tv>0?Math.round(totalUtil/(car.tv+tem.tv)*100):0)}%</div><div class="kpi-lbl">Margen</div></div>
      </div>
      ${secSuc("carahue",car,SUCS.carahue)}
      ${secSuc("temuco",tem,SUCS.temuco)}
      <div class="footer">DUO Control de Negocios · duo-negocios.vercel.app · ${new Date().toLocaleString("es-CL")}</div>
    </body></html>`);
    w.document.close();
    setTimeout(()=>w.print(),500);
  };

  return(
    <div>
      {/* Selector tipo */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[["mensual","📅 Mensual"],["semanal","📆 Semanal"],["diario","📋 Diario"],["custom","📐 Rango"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTipo(k)} style={{flex:1,minWidth:70,padding:"9px 4px",borderRadius:10,border:`1px solid ${tipo===k?"#f97316":"#ffffff12"}`,background:tipo===k?"#f9731620":"transparent",color:tipo===k?"#f97316":"#ffffff44",fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>
        ))}
      </div>

      {/* Selector período */}
      {tipo==="mensual"&&(
        <div style={{marginBottom:16}}><Lbl>MES</Lbl><input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{...IS,maxWidth:220}}/></div>
      )}
      {tipo==="semanal"&&(
        <div style={{marginBottom:16}}>
          <Lbl>SEMANA</Lbl>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setSemana(s=>s+1)} style={{background:"#ffffff10",border:"none",color:"#ffffff66",padding:"8px 14px",borderRadius:8,cursor:"pointer",fontSize:16}}>←</button>
            <div style={{flex:1,textAlign:"center",background:"#ffffff08",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,color:"#f97316"}}>{rango.label}</div>
            <button onClick={()=>setSemana(s=>Math.max(0,s-1))} style={{background:"#ffffff10",border:"none",color:semana===0?"#ffffff22":"#ffffff66",padding:"8px 14px",borderRadius:8,cursor:"pointer",fontSize:16}} disabled={semana===0}>→</button>
          </div>
        </div>
      )}
      {tipo==="diario"&&(
        <div style={{marginBottom:16}}><Lbl>FECHA</Lbl><input type="date" value={diaF} onChange={e=>setDiaF(e.target.value)} style={{...IS,maxWidth:220}}/></div>
      )}
      {tipo==="custom"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          <div><Lbl>DESDE</Lbl><input type="date" value={rangoD.desde} onChange={e=>setRangoD(r=>({...r,desde:e.target.value}))} style={IS}/></div>
          <div><Lbl>HASTA</Lbl><input type="date" value={rangoD.hasta} onChange={e=>setRangoD(r=>({...r,hasta:e.target.value}))} style={IS}/></div>
        </div>
      )}

      {/* KPIs consolidados */}
      <div style={{background:"linear-gradient(135deg,#0d1525,#1a2540)",borderRadius:16,padding:18,marginBottom:16,border:"1px solid #f9731620"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#f97316",letterSpacing:2,marginBottom:14}}>🏪 CONSOLIDADO DUO</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div style={{textAlign:"center",background:"#4ade8010",borderRadius:12,padding:"14px 8px"}}>
            <div style={{fontSize:10,color:"#4ade8066",marginBottom:4}}>Ventas totales</div>
            <div style={{fontSize:20,fontWeight:900,color:"#4ade80"}}>{fmt(totalVentas)}</div>
          </div>
          <div style={{textAlign:"center",background:totalUtil>=0?"#4ade8010":"#f8717110",borderRadius:12,padding:"14px 8px"}}>
            <div style={{fontSize:10,color:totalUtil>=0?"#4ade8066":"#f8717166",marginBottom:4}}>Utilidad {tipo==="mensual"?"real":"operacional"}</div>
            <div style={{fontSize:20,fontWeight:900,color:totalUtil>=0?"#4ade80":"#f87171"}}>{fmt(totalUtil)}</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"Carahue ventas",v:car.tv,c:"#22c55e"},{l:"Temuco ventas",v:tem.tv,c:"#3b82f6"},{l:"Margen",v:totalVentas>0?Math.round(totalUtil/totalVentas*100):0,c:"#f97316",pct:true}].map(x=>(
            <div key={x.l} style={{background:"#ffffff06",borderRadius:10,padding:"10px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"#ffffff44",marginBottom:3}}>{x.l}</div>
              <div style={{fontSize:13,fontWeight:800,color:x.c}}>{x.pct?`${x.v}%`:fmt(x.v)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Detalle por sucursal */}
      {[{suc:"carahue",r:car},{suc:"temuco",r:tem}].map(({suc,r})=>{
        const info=SUCS[suc];
        return(
          <div key={suc} style={{background:"#0d1525",borderRadius:16,padding:18,marginBottom:14,border:`1px solid ${info.color}20`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${info.color}15`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:20}}>{info.emoji}</span>
                <div style={{fontSize:14,fontWeight:800}}>{info.nombre}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:9,color:"#ffffff33"}}>Utilidad {tipo==="mensual"?"real":"oper."}</div>
                <div style={{fontSize:18,fontWeight:900,color:r.utilReal>=0?"#4ade80":"#f87171"}}>{fmt(r.utilReal)}</div>
              </div>
            </div>

            {/* Ingresos */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"#4ade8066",letterSpacing:2,marginBottom:6}}>📥 INGRESOS</div>
              {[{l:"💰 Ventas",v:r.tv,c:"#4ade80"},{l:"  💵 Efectivo",v:r.ef,c:"#86efac"},{l:"  💳 Tarjeta",v:r.tar,c:"#60a5fa"},{l:"  🏦 Transferencia",v:r.trans,c:"#a78bfa"},{l:"🚬 Cigarros",v:r.tcv,c:"#fbbf24"}].map(x=>(
                x.v>0&&<div key={x.l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #ffffff05"}}>
                  <span style={{fontSize:11,color:"#ffffff55"}}>{x.l}</span>
                  <span style={{fontSize:12,fontWeight:700,color:x.c}}>{fmt(x.v)}</span>
                </div>
              ))}
              {r.comTar>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}>
                <span style={{fontSize:11,color:"#f8717188"}}>  ↳ Comisión TUU</span>
                <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>−{fmt(r.comTar)}</span>
              </div>}
            </div>

            {/* Egresos */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"#f8717166",letterSpacing:2,marginBottom:6}}>📤 EGRESOS</div>
              {[{l:"📉 Gastos operacionales",v:r.tg,c:"#f87171"},{l:"📦 Compras cigarros",v:r.tcg,c:"#fca5a5"}].map(x=>(
                x.v>0&&<div key={x.l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #ffffff05"}}>
                  <span style={{fontSize:11,color:"#ffffff55"}}>{x.l}</span>
                  <span style={{fontSize:12,fontWeight:700,color:x.c}}>−{fmt(x.v)}</span>
                </div>
              ))}
              {tipo==="mensual"&&<>
                {r.totalFijos>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #ffffff05"}}>
                  <span style={{fontSize:11,color:"#ffffff55"}}>💼 Gastos fijos</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#fb923c"}}>−{fmt(r.totalFijos)}</span>
                </div>}
                {r.totalVar>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #ffffff05"}}>
                  <span style={{fontSize:11,color:"#ffffff55"}}>📊 Gastos variables</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#c084fc"}}>−{fmt(r.totalVar)}</span>
                </div>}
                {r.iva.totalPagar>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #ffffff05"}}>
                  <span style={{fontSize:11,color:"#ffffff55"}}>🧾 IVA + PPM</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>−{fmt(r.iva.totalPagar)}</span>
                </div>}
              </>}
            </div>

            {/* Resultado */}
            <div style={{background:r.utilBruta>=0?"#4ade8010":"#f8717110",border:`1px solid ${r.utilBruta>=0?"#4ade8025":"#f8717125"}`,borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:12,fontWeight:700}}>= Utilidad operacional</span>
              <span style={{fontSize:15,fontWeight:900,color:r.utilBruta>=0?"#4ade80":"#f87171"}}>{fmt(r.utilBruta)}</span>
            </div>
            {tipo==="mensual"&&<div style={{background:r.utilReal>=0?"#22c55e14":"#ef444414",border:`1px solid ${r.utilReal>=0?"#22c55e30":"#ef444430"}`,borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:12,fontWeight:800}}>= UTILIDAD REAL</span>
              <span style={{fontSize:16,fontWeight:900,color:r.utilReal>=0?"#4ade80":"#f87171"}}>{fmt(r.utilReal)}</span>
            </div>}

            {/* Indicadores */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
              <div style={{background:"#ffffff05",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#ffffff44"}}>Días activos</div>
                <div style={{fontSize:16,fontWeight:800,color:"#60a5fa"}}>{r.diasOper}</div>
              </div>
              <div style={{background:"#ffffff05",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#ffffff44"}}>Promedio/día</div>
                <div style={{fontSize:16,fontWeight:800,color:"#a78bfa"}}>{fmt(r.promDia)}</div>
              </div>
            </div>
            {suc==="carahue"&&(r.t1>0||r.t2>0)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
              <div style={{background:"#22c55e08",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#4ade8066"}}>🌅 Turno 1</div>
                <div style={{fontSize:14,fontWeight:800,color:"#4ade80"}}>{fmt(r.t1)}</div>
              </div>
              <div style={{background:"#4ade8008",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#86efac66"}}>🌙 Turno 2</div>
                <div style={{fontSize:14,fontWeight:800,color:"#86efac"}}>{fmt(r.t2)}</div>
              </div>
            </div>}
          </div>
        );
      })}

      {/* Botón PDF */}
      <button onClick={imprimirPDF} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#dc2626,#ef4444)",color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8}}>
        📄 Descargar / Imprimir Informe PDF
      </button>
      <div style={{fontSize:10,color:"#ffffff33",textAlign:"center",marginTop:8}}>Se abrirá una ventana para guardar o imprimir el informe</div>
    </div>
  );
}

// ── PANEL TUU — CONCILIACIÓN OPERADORA TARJETA ───────────
function PanelTUU({data,mes,setMes,guardar}){
  const [modalSuc,setModalSuc]=useState(null); // suc a registrar depósito
  const [modalMonto,setModalMonto]=useState("");
  const [modalFecha,setModalFecha]=useState(hoy());
  const [modalRef,setModalRef]=useState("");

  // Depósitos registrados por el usuario: guardados en data.tuuDepositos
  // estructura: [ { id, suc, fecha, monto, referencia } ]
  const depositos=data.tuuDepositos||[];

  const depMes=(suc)=>depositos.filter(d=>d.suc===suc&&d.fecha.startsWith(mes.slice(0,7)));

  // Calcular lo que TUU debería depositar por sucursal en el mes
  const calcTUU=(suc)=>{
    const ventas=filtroMes(data[suc]?.ventas||[],mes.slice(0,7));
    const tarjeta=ventas.filter(v=>v.tipo==="tarjeta").reduce((s,v)=>s+v.monto,0);
    const comision=Math.round(tarjeta*(data.comision?.[suc]||0)/100);
    const neto=tarjeta-comision;
    return {tarjeta,comision,neto};
  };

  const guardarDeposito=()=>{
    if(!modalSuc||!modalMonto)return;
    const nd=JSON.parse(JSON.stringify(data));
    if(!nd.tuuDepositos)nd.tuuDepositos=[];
    nd.tuuDepositos.push({id:uid(),suc:modalSuc,fecha:modalFecha,monto:parseFloat(modalMonto)||0,referencia:modalRef});
    guardar(nd);
    setModalSuc(null); setModalMonto(""); setModalFecha(hoy()); setModalRef("");
  };

  const eliminarDeposito=(id)=>{
    const nd=JSON.parse(JSON.stringify(data));
    nd.tuuDepositos=(nd.tuuDepositos||[]).filter(d=>d.id!==id);
    guardar(nd);
  };

  const tuuC=calcTUU("carahue");
  const tuuT=calcTUU("temuco");
  const depC=depMes("carahue").reduce((s,d)=>s+d.monto,0);
  const depT=depMes("temuco").reduce((s,d)=>s+d.monto,0);
  const difC=depC-tuuC.neto;
  const difT=depT-tuuT.neto;

  return(
    <div>
      <div style={{marginBottom:16}}><Lbl>MES</Lbl><input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{...IS,maxWidth:220}}/></div>

      {/* Explicación */}
      <div style={{background:"#60a5fa10",border:"1px solid #60a5fa20",borderRadius:12,padding:"12px 14px",marginBottom:16,fontSize:11,color:"#93c5fd",lineHeight:1.7}}>
        💳 <b>¿Cómo funciona?</b><br/>
        La app calcula cuánto debería depositarte TUU (ventas con tarjeta menos su comisión).<br/>
        Tú registras los depósitos reales que llegan a tu cuenta.<br/>
        La diferencia te muestra si TUU está al día o tiene pagos pendientes.
      </div>

      {/* Resumen consolidado */}
      <div style={{background:"#0d1525",borderRadius:14,padding:"14px 16px",marginBottom:16,border:"1px solid #ffffff0c"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#ffffff55",marginBottom:12,letterSpacing:1}}>RESUMEN CONSOLIDADO — {lblMes(mes)}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <div style={{background:"#60a5fa10",borderRadius:10,padding:"10px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"#60a5fa66",marginBottom:4}}>TUU debe depositar</div>
            <div style={{fontSize:16,fontWeight:900,color:"#60a5fa"}}>{fmt(tuuC.neto+tuuT.neto)}</div>
            <div style={{fontSize:9,color:"#ffffff33",marginTop:2}}>ambas sucursales</div>
          </div>
          <div style={{background:"#4ade8010",borderRadius:10,padding:"10px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"#4ade8066",marginBottom:4}}>Depósitos recibidos</div>
            <div style={{fontSize:16,fontWeight:900,color:"#4ade80"}}>{fmt(depC+depT)}</div>
            <div style={{fontSize:9,color:"#ffffff33",marginTop:2}}>registrados por ti</div>
          </div>
          <div style={{background:(difC+difT)>=0?"#4ade8010":"#f8717110",borderRadius:10,padding:"10px",textAlign:"center"}}>
            <div style={{fontSize:9,color:(difC+difT)>=0?"#4ade8066":"#f8717166",marginBottom:4}}>Diferencia</div>
            <div style={{fontSize:16,fontWeight:900,color:(difC+difT)>=0?"#4ade80":"#f87171"}}>{fmt(Math.abs(difC+difT))}</div>
            <div style={{fontSize:9,color:"#ffffff33",marginTop:2}}>{(difC+difT)>=0?"✅ A favor tuyo":"⚠️ TUU debe"}</div>
          </div>
        </div>
      </div>

      {/* Por sucursal */}
      {[{suc:"carahue",tuu:tuuC,dep:depC,dif:difC},{suc:"temuco",tuu:tuuT,dep:depT,dif:difT}].map(({suc,tuu,dep,dif})=>{
        const info=SUCS[suc];
        const deps=depMes(suc);
        return(
          <div key={suc} style={{background:"#0d1525",borderRadius:16,padding:18,marginBottom:16,border:`1px solid ${info.color}20`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:22}}>{info.emoji}</span>
                <div><div style={{fontSize:14,fontWeight:800}}>{info.nombre}</div><div style={{fontSize:10,color:info.color}}>{lblMes(mes)}</div></div>
              </div>
              <button onClick={()=>setModalSuc(suc)} style={{background:"#60a5fa20",border:"none",color:"#60a5fa",padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700}}>+ Registrar depósito</button>
            </div>

            {/* Cálculo esperado */}
            <div style={{background:"#ffffff05",borderRadius:12,padding:14,marginBottom:12}}>
              <div style={{fontSize:10,color:"#ffffff44",letterSpacing:2,marginBottom:8}}>LO QUE TUU DEBERÍA DEPOSITAR</div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #ffffff07"}}>
                <span style={{fontSize:12,color:"#ffffff66"}}>💳 Ventas con tarjeta</span>
                <span style={{fontSize:13,fontWeight:700,color:"#60a5fa"}}>{fmt(tuu.tarjeta)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #ffffff07"}}>
                <span style={{fontSize:12,color:"#ffffff44"}}>↳ menos comisión TUU ({data.comision?.[suc]||0}%)</span>
                <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>−{fmt(tuu.comision)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",marginTop:2}}>
                <span style={{fontSize:12,fontWeight:700,color:"#ffffff88"}}>= Neto a depositar</span>
                <span style={{fontSize:16,fontWeight:900,color:"#4ade80"}}>{fmt(tuu.neto)}</span>
              </div>
            </div>

            {/* Depósitos recibidos */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"#ffffff44",letterSpacing:2,marginBottom:8}}>DEPÓSITOS RECIBIDOS DE TUU</div>
              {deps.length===0?(
                <div style={{textAlign:"center",padding:"14px",color:"#ffffff25",fontSize:11}}>Sin depósitos registrados este mes</div>
              ):deps.map(d=>(
                <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"#ffffff06",borderRadius:8,marginBottom:6}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:"#4ade80"}}>{fmt(d.monto)}</div>
                    <div style={{fontSize:10,color:"#ffffff44"}}>{d.fecha}{d.referencia&&` · Ref: ${d.referencia}`}</div>
                  </div>
                  <DelBtn onClick={()=>eliminarDeposito(d.id)}/>
                </div>
              ))}
              {deps.length>0&&(
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"#4ade8008",borderRadius:8}}>
                  <span style={{fontSize:11,color:"#4ade8088"}}>Total depósitos</span>
                  <span style={{fontSize:13,fontWeight:800,color:"#4ade80"}}>{fmt(dep)}</span>
                </div>
              )}
            </div>

            {/* Diferencia */}
            <div style={{background:dif>=0?"#4ade8012":"#f8717112",border:`1px solid ${dif>=0?"#4ade8025":"#f8717125"}`,borderRadius:12,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:dif>=0?"#4ade80":"#f87171"}}>
                    {dif===0?"✅ Cuadrado exacto":dif>0?"✅ Depósito mayor al esperado":"⚠️ TUU tiene depósito pendiente"}
                  </div>
                  <div style={{fontSize:10,color:"#ffffff44",marginTop:2}}>
                    {dif===0?"Los depósitos coinciden con las ventas":
                     dif>0?`Recibiste ${fmt(dif)} más de lo esperado`:
                     `Faltan ${fmt(Math.abs(dif))} por depositar`}
                  </div>
                </div>
                <div style={{fontSize:20,fontWeight:900,color:dif>=0?"#4ade80":"#f87171"}}>{fmt(Math.abs(dif))}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Modal registrar depósito */}
      {modalSuc&&(
        <div onClick={()=>setModalSuc(null)} style={{position:"fixed",inset:0,background:"#000000cc",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0d1525",borderRadius:"20px 20px 0 0",padding:"26px 22px 44px",width:"100%",maxWidth:500,border:"1px solid #ffffff0e"}}>
            <div style={{fontSize:16,fontWeight:900,marginBottom:4}}>💳 Registrar Depósito TUU</div>
            <div style={{fontSize:11,color:"#ffffff44",marginBottom:20}}>{modalSuc==="carahue"?"🌿 DUO Carahue":"🏙️ DUO Temuco"}</div>
            <div style={{marginBottom:14}}>
              <Lbl>FECHA DEL DEPÓSITO</Lbl>
              <input type="date" value={modalFecha} onChange={e=>setModalFecha(e.target.value)} style={IS}/>
            </div>
            <div style={{marginBottom:14}}>
              <Lbl>MONTO DEPOSITADO ($)</Lbl>
              <input type="number" inputMode="numeric" placeholder="0" value={modalMonto} onChange={e=>setModalMonto(e.target.value)} style={{...IS,fontSize:16}}/>
            </div>
            <div style={{marginBottom:20}}>
              <Lbl>N° REFERENCIA / COMPROBANTE (opcional)</Lbl>
              <input type="text" placeholder="Ej: TUU-2026-001" value={modalRef} onChange={e=>setModalRef(e.target.value)} style={IS}/>
            </div>
            <button onClick={guardarDeposito} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"linear-gradient(135deg,#3b82f6,#60a5fa)",color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer"}}>
              Guardar Depósito
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GASTOS PANEL ─────────────────────────────────────────
function GastosPanel({data,mes,setMes,guardar}){
  const [editMes,setEditMes]=useState(false);
  const [modal,setModal]=useState(null);
  // modal = { suc, id, label, tipo } tipo: sueldo|fijo|var|comision
  const [liq,setLiq]=useState("");
  const [prev,setPrev]=useState("");
  const [monto,setMonto]=useState("");
  const [pct,setPct]=useState("");
  const [nf,setNf]=useState({carahue:"",temuco:""});
  const [nv,setNv]=useState({carahue:"",temuco:""});

  const getVal=(suc,id)=>{
    const ov=(data.fijosOv||{})[mes]?.[suc]?.[id];
    if(editMes&&ov!==undefined) return ov;
    return data.fijosBase?.[suc]?.[id]||0;
  };
  const getVar=(suc,id)=>{
    const ov=(data.varOv||{})[mes]?.[suc]?.[id];
    if(editMes&&ov!==undefined) return ov;
    return data.varBase?.[suc]?.[id]||0;
  };

  const abrir=(suc,id,label,tipo)=>{
    if(tipo==="sueldo"){
      const sd=data.sueldosDetalle?.[suc]?.[id];
      const total=parseFloat(getVal(suc,id))||0;
      setLiq(sd?.liquido!==undefined ? String(sd.liquido) : (total>0?String(total):""));
      setPrev(sd?.prevision!==undefined ? String(sd.prevision) : "");
    } else if(tipo==="comision"){
      setPct(String(data.comision?.[suc]||""));
    } else if(tipo==="fijo"){
      setMonto(String(getVal(suc,id)||""));
    } else {
      setMonto(String(getVar(suc,id)||""));
    }
    setModal({suc,id,label,tipo});
  };

  const guardarModal=()=>{
    if(!modal) return;
    const {suc,id,tipo}=modal;
    // Copia profunda del data actual
    const nd=JSON.parse(JSON.stringify(data));

    if(tipo==="sueldo"){
      const l=parseFloat(liq)||0;
      const p=parseFloat(prev)||0;
      const total=l+p;
      // Guardar desglose
      if(!nd.sueldosDetalle) nd.sueldosDetalle={};
      if(!nd.sueldosDetalle[suc]) nd.sueldosDetalle[suc]={};
      nd.sueldosDetalle[suc][id]={liquido:l, prevision:p};
      // Guardar total
      if(editMes){
        if(!nd.fijosOv) nd.fijosOv={};
        if(!nd.fijosOv[mes]) nd.fijosOv[mes]={};
        if(!nd.fijosOv[mes][suc]) nd.fijosOv[mes][suc]={};
        nd.fijosOv[mes][suc][id]=total;
      } else {
        if(!nd.fijosBase) nd.fijosBase={};
        if(!nd.fijosBase[suc]) nd.fijosBase[suc]={};
        nd.fijosBase[suc][id]=total;
      }
    } else if(tipo==="comision"){
      if(!nd.comision) nd.comision={};
      nd.comision[suc]=parseFloat(pct)||0;
    } else if(tipo==="fijo"){
      const v=parseFloat(monto)||0;
      if(editMes){
        if(!nd.fijosOv) nd.fijosOv={};
        if(!nd.fijosOv[mes]) nd.fijosOv[mes]={};
        if(!nd.fijosOv[mes][suc]) nd.fijosOv[mes][suc]={};
        nd.fijosOv[mes][suc][id]=v;
      } else {
        if(!nd.fijosBase) nd.fijosBase={};
        if(!nd.fijosBase[suc]) nd.fijosBase[suc]={};
        nd.fijosBase[suc][id]=v;
      }
    } else if(tipo==="var"){
      const v=parseFloat(monto)||0;
      if(editMes){
        if(!nd.varOv) nd.varOv={};
        if(!nd.varOv[mes]) nd.varOv[mes]={};
        if(!nd.varOv[mes][suc]) nd.varOv[mes][suc]={};
        nd.varOv[mes][suc][id]=v;
      } else {
        if(!nd.varBase) nd.varBase={};
        if(!nd.varBase[suc]) nd.varBase[suc]={};
        nd.varBase[suc][id]=v;
      }
    }
    guardar(nd);
    setModal(null);
  };

  return(
    <div>
      <div style={{background:"#f9731610",border:"1px solid #f9731620",borderRadius:12,padding:"12px 14px",marginBottom:16,fontSize:11,color:"#fb923c"}}>
        💡 Toca cualquier ítem para editar. El total del sueldo = Líquido + Previred.
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        <div style={{flex:1}}><Lbl>MES</Lbl><input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{...IS,maxWidth:200}}/></div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:16}}>
          <span style={{fontSize:11,color:"#ffffff44"}}>Solo este mes</span>
          <button onClick={()=>setEditMes(e=>!e)} style={{width:40,height:22,borderRadius:11,border:"none",background:editMes?"#f97316":"#ffffff18",cursor:"pointer",position:"relative"}}>
            <div style={{width:16,height:16,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:editMes?21:3,transition:"left .2s"}}/>
          </button>
        </div>
      </div>

      {["carahue","temuco"].map(suc=>{
        const info=SUCS[suc];
        const fd=FIJOS_DEF[suc]; const fe=data.fijosExtra?.[suc]||[];
        const vd=VAR_DEF[suc];   const ve=data.varExtra?.[suc]||[];
        const totF=[...fd,...fe].reduce((s,x)=>s+(parseFloat(getVal(suc,x.id))||0),0);
        const totV=[...vd,...ve].reduce((s,x)=>s+(parseFloat(getVar(suc,x.id))||0),0);
        const sd=data.sueldosDetalle?.[suc]||{};

        return(
          <div key={suc} style={{background:"#0d1525",borderRadius:16,padding:18,marginBottom:16,border:`1px solid ${info.color}18`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <span style={{fontSize:20}}>{info.emoji}</span>
              <div><div style={{fontSize:14,fontWeight:800}}>{info.nombre}</div>
              <div style={{fontSize:10,color:editMes?"#f97316":"#ffffff33"}}>{editMes?`Editando ${lblMes(mes)}`:"Valores base"}</div></div>
            </div>

            <div style={{fontSize:11,fontWeight:700,color:"#fb923c",marginBottom:8}}>💼 GASTOS FIJOS</div>
            {[...fd,...fe].map(x=>{
              const val=parseFloat(getVal(suc,x.id))||0;
              const liqD=sd[x.id]?.liquido||0;
              const prevD=sd[x.id]?.prevision||0;
              return(
                <button key={x.id} onClick={()=>abrir(suc,x.id,x.label,x.esSueldo?"sueldo":"fijo")}
                  style={{width:"100%",background:"#ffffff06",border:`1px solid ${val>0?"#fb923c25":"#ffffff0c"}`,borderRadius:10,padding:"11px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",textAlign:"left"}}>
                  <div>
                    <div style={{fontSize:12,color:"#ffffff77"}}>{x.label}</div>
                    {x.esSueldo&&<div style={{fontSize:10,color:"#ffffff44",marginTop:2}}>
                      Líq: {fmt(liqD)} · Prev: {fmt(prevD)}
                    </div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,fontWeight:800,color:val>0?"#fb923c":"#ffffff33"}}>{val>0?fmt(val):"—"}</span>
                    <span style={{fontSize:14}}>✏️</span>
                  </div>
                </button>
              );
            })}
            <div style={{display:"flex",gap:8,marginBottom:4}}>
              <input value={nf[suc]} onChange={e=>setNf(p=>({...p,[suc]:e.target.value}))} placeholder="Nuevo ítem fijo..." style={{...IS,flex:1,fontSize:11}}/>
              <button onClick={()=>{if(nf[suc].trim()){const nd=JSON.parse(JSON.stringify(data));if(!nd.fijosExtra)nd.fijosExtra={};if(!nd.fijosExtra[suc])nd.fijosExtra[suc]=[];nd.fijosExtra[suc].push({id:"fe"+uid(),label:nf[suc].trim()});guardar(nd);setNf(p=>({...p,[suc]:""}));}}} style={{background:"#fb923c20",border:"1px solid #fb923c40",color:"#fb923c",padding:"8px 12px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>+ Agregar</button>
            </div>
            <TotalRow label="Total fijos" valor={totF} color="#fb923c"/>

            <div style={{fontSize:11,fontWeight:700,color:"#c084fc",margin:"14px 0 8px"}}>📊 GASTOS VARIABLES</div>
            {[...vd,...ve].map(x=>{
              const val=parseFloat(getVar(suc,x.id))||0;
              return(
                <button key={x.id} onClick={()=>abrir(suc,x.id,x.label,"var")}
                  style={{width:"100%",background:"#ffffff06",border:`1px solid ${val>0?"#c084fc25":"#ffffff0c"}`,borderRadius:10,padding:"11px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",textAlign:"left"}}>
                  <div style={{fontSize:12,color:"#ffffff77"}}>{x.label}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,fontWeight:800,color:val>0?"#c084fc":"#ffffff33"}}>{val>0?fmt(val):"—"}</span>
                    <span style={{fontSize:14}}>✏️</span>
                  </div>
                </button>
              );
            })}
            <div style={{display:"flex",gap:8,marginBottom:4}}>
              <input value={nv[suc]} onChange={e=>setNv(p=>({...p,[suc]:e.target.value}))} placeholder="Nuevo ítem variable..." style={{...IS,flex:1,fontSize:11}}/>
              <button onClick={()=>{if(nv[suc].trim()){const nd=JSON.parse(JSON.stringify(data));if(!nd.varExtra)nd.varExtra={};if(!nd.varExtra[suc])nd.varExtra[suc]=[];nd.varExtra[suc].push({id:"ve"+uid(),label:nv[suc].trim()});guardar(nd);setNv(p=>({...p,[suc]:""}));}}} style={{background:"#c084fc20",border:"1px solid #c084fc40",color:"#c084fc",padding:"8px 12px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>+ Agregar</button>
            </div>
            <TotalRow label="Total variables" valor={totV} color="#c084fc"/>

            <button onClick={()=>abrir(suc,"comision","Comisión Operador Tarjeta","comision")}
              style={{width:"100%",marginTop:10,background:"#60a5fa0a",border:"1px solid #60a5fa18",borderRadius:12,padding:"11px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",textAlign:"left"}}>
              <div><div style={{fontSize:11,fontWeight:700,color:"#60a5fa"}}>💳 Comisión Tarjeta</div><div style={{fontSize:10,color:"#ffffff44"}}>% sobre ventas con tarjeta</div></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15,fontWeight:900,color:"#60a5fa"}}>{data.comision?.[suc]||0}%</span>
                <span style={{fontSize:14}}>✏️</span>
              </div>
            </button>

            <div style={{borderTop:"1px solid #ffffff0e",marginTop:12,paddingTop:10,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:12,color:"#ffffff33"}}>Total mes (sin IVA+PPM)</span>
              <span style={{fontSize:14,fontWeight:900,color:"#f87171"}}>{fmt(totF+totV)}</span>
            </div>
          </div>
        );
      })}

      {/* MODAL */}
      {modal&&(
        <div onClick={()=>setModal(null)} style={{position:"fixed",inset:0,background:"#000000cc",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0d1525",borderRadius:"20px 20px 0 0",padding:"26px 22px 44px",width:"100%",maxWidth:500,border:"1px solid #ffffff0e"}}>
            <div style={{fontSize:16,fontWeight:900,marginBottom:4}}>✏️ {modal.label}</div>
            <div style={{fontSize:11,color:"#ffffff44",marginBottom:20}}>{editMes?`Solo para ${lblMes(mes)}`:"Valor base — todos los meses"}</div>

            {modal.tipo==="sueldo"&&(
              <>
                <div style={{marginBottom:14}}>
                  <Lbl>SUELDO LÍQUIDO ($)</Lbl>
                  <input type="number" inputMode="numeric" placeholder="0" value={liq} onChange={e=>setLiq(e.target.value)} style={{...IS,fontSize:16}}/>
                </div>
                <div style={{marginBottom:14}}>
                  <Lbl>PREVIRED — Cotizaciones ($)</Lbl>
                  <input type="number" inputMode="numeric" placeholder="0" value={prev} onChange={e=>setPrev(e.target.value)} style={{...IS,fontSize:16}}/>
                </div>
                <div style={{background:"#22c55e12",border:"1px solid #22c55e25",borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#ffffff55"}}>Total sueldo</span>
                  <span style={{fontSize:18,fontWeight:900,color:"#4ade80"}}>{fmt((parseFloat(liq)||0)+(parseFloat(prev)||0))}</span>
                </div>
              </>
            )}

            {(modal.tipo==="fijo"||modal.tipo==="var")&&(
              <div style={{marginBottom:14}}>
                <Lbl>MONTO ($)</Lbl>
                <input type="number" inputMode="numeric" placeholder="0" value={monto} onChange={e=>setMonto(e.target.value)} style={{...IS,fontSize:16}}/>
              </div>
            )}

            {modal.tipo==="comision"&&(
              <div style={{marginBottom:14}}>
                <Lbl>PORCENTAJE (%)</Lbl>
                <input type="number" inputMode="decimal" placeholder="1.5" step="0.1" value={pct} onChange={e=>setPct(e.target.value)} style={{...IS,fontSize:16}}/>
              </div>
            )}

            <button onClick={guardarModal} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"linear-gradient(135deg,#f97316,#fb923c)",color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer"}}>
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TRABAJADORES PANEL ────────────────────────────────────
function TrabajadoresPanel({data,updTrab,aprobar,rechazar,guardar}){
  const [sel,setSel]=useState("carahue_t1");
  const [ed,setEd]=useState(false);
  const [form,setForm]=useState({});
  const [editVacId,setEditVacId]=useState(null);
  const [editVacF,setEditVacF]=useState({desde:"",hasta:"",motivo:""});
  const LISTA=[{id:"carahue_t1",label:"🌿 Carahue — Turno 1"},{id:"carahue_t2",label:"🌿 Carahue — Turno 2"},{id:"temuco",label:"🏙️ Temuco — Trabajadora"}];
  const w=data.trabajadores?.[sel]||{};
  useEffect(()=>setForm({nombre:w.nombre||"",contrato:w.contrato||"indefinido",fechaIngreso:w.fechaIngreso||""}),[sel,data]);
  const anos=anosD(w.fechaIngreso); const puede=anos>=1;
  const dispD=Math.max(0,(w.diasVac||15)-(w.diasUsados||0));
  const pend=(w.solicitudes||[]).filter(s=>s.estado==="pendiente");
  const aprobadas=(w.solicitudes||[]).filter(s=>s.estado==="aprobada");

  // Revocar aprobación
  const revocar=(sid)=>{
    const t=JSON.parse(JSON.stringify(data.trabajadores||{}));
    const s=t[sel].solicitudes.find(x=>x.id===sid);
    t[sel].diasUsados=Math.max(0,(t[sel].diasUsados||0)-s.dias);
    s.estado="rechazada";
    guardar({...data,trabajadores:t});
  };

  // Guardar edición de vacaciones
  const guardarEditVac=()=>{
    if(!editVacF.desde||!editVacF.hasta)return;
    const nuevosDias=diasHabiles(editVacF.desde,editVacF.hasta);
    const t=JSON.parse(JSON.stringify(data.trabajadores||{}));
    const s=t[sel].solicitudes.find(x=>x.id===editVacId);
    const diffDias=nuevosDias-s.dias;
    t[sel].diasUsados=Math.max(0,(t[sel].diasUsados||0)+diffDias);
    s.desde=editVacF.desde; s.hasta=editVacF.hasta;
    s.motivo=editVacF.motivo; s.dias=nuevosDias;
    guardar({...data,trabajadores:t});
    setEditVacId(null);
  };

  // Calcular si trabajador está de vacaciones hoy
  const hoyStr=hoy();
  const vacHoy=aprobadas.find(s=>hoyStr>=s.desde&&hoyStr<=s.hasta);
  const proxVac=aprobadas.filter(s=>s.desde>hoyStr).sort((a,b)=>a.desde.localeCompare(b.desde))[0];

  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {LISTA.map(wk=>(<button key={wk.id} onClick={()=>{setSel(wk.id);setEd(false);setEditVacId(null);}} style={{padding:"6px 14px",borderRadius:20,border:"1px solid",borderColor:sel===wk.id?"#f97316":"#ffffff12",background:sel===wk.id?"#f9731614":"transparent",color:sel===wk.id?"#f97316":"#ffffff44",fontSize:11,fontWeight:700,cursor:"pointer"}}>{wk.label}</button>))}
      </div>

      {/* Banner estado vacaciones */}
      {vacHoy&&(
        <div style={{background:"linear-gradient(135deg,#3b82f620,#60a5fa10)",border:"2px solid #3b82f650",borderRadius:14,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>🏖️</span>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:"#60a5fa"}}>DE VACACIONES HOY</div>
            <div style={{fontSize:11,color:"#ffffff77",marginTop:2}}>Salió: <b style={{color:"#4ade80"}}>{vacHoy.desde}</b> · Regresa: <b style={{color:"#fbbf24"}}>{vacHoy.hasta}</b></div>
            <div style={{fontSize:11,color:"#ffffff44"}}>{vacHoy.dias} días hábiles · {vacHoy.motivo||"Sin motivo"}</div>
          </div>
        </div>
      )}
      {!vacHoy&&proxVac&&(
        <div style={{background:"#fbbf2410",border:"1px solid #fbbf2425",borderRadius:14,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:22}}>📅</span>
          <div>
            <div style={{fontSize:12,fontWeight:800,color:"#fbbf24"}}>PRÓXIMAS VACACIONES</div>
            <div style={{fontSize:11,color:"#ffffff66",marginTop:2}}>Sale: <b style={{color:"#4ade80"}}>{proxVac.desde}</b> · Regresa: <b style={{color:"#f87171"}}>{proxVac.hasta}</b> · {proxVac.dias} días</div>
          </div>
        </div>
      )}

      <div style={{background:"#0d1525",borderRadius:16,padding:18,marginBottom:14,border:"1px solid #ffffff0c"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:800}}>{w.nombre||"Sin nombre"}</div>
          <button onClick={()=>setEd(e=>!e)} style={{background:"#f9731620",border:"none",color:"#f97316",padding:"5px 12px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700}}>{ed?"Cancelar":"✏️ Editar"}</button>
        </div>
        {ed?(<div><Inp label="NOMBRE" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))}/><Sel label="CONTRATO" value={form.contrato} onChange={v=>setForm(f=>({...f,contrato:v}))}><option value="indefinido">Indefinido</option><option value="plazo_fijo">Plazo Fijo</option><option value="honorarios">Honorarios</option></Sel><Inp label="FECHA INGRESO" type="date" value={form.fechaIngreso} onChange={v=>setForm(f=>({...f,fechaIngreso:v}))}/><Btn onClick={()=>{updTrab(sel,form);setEd(false);}}>Guardar</Btn></div>)
        :(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><IBox label="Contrato" value={{indefinido:"Indefinido",plazo_fijo:"Plazo Fijo",honorarios:"Honorarios"}[w.contrato]||"—"}/><IBox label="Fecha Ingreso" value={w.fechaIngreso||"—"}/><IBox label="Tiempo trabajado" value={w.fechaIngreso?`${Math.floor(anos)}a ${Math.floor((anos%1)*12)}m`:"—"}/><IBox label="Vacaciones" value={puede?"✅ Habilitadas":"⏳ < 1 año"}/></div>)}
      </div>
      <div style={{background:"#0d1525",borderRadius:16,padding:18,border:"1px solid #60a5fa18"}}>
        <div style={{fontSize:13,fontWeight:800,color:"#60a5fa",marginBottom:14}}>🏖️ Vacaciones</div>
        {!puede?(<div style={{textAlign:"center",padding:20,color:"#ffffff30",fontSize:12}}>⏳ Se habilitan al cumplir 1 año.{w.fechaIngreso&&<><br/><span style={{color:"#ffffff44"}}>Faltan ~{Math.max(0,Math.ceil(365-diasD(w.fechaIngreso)))} días</span></>}</div>):(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
              <div style={{background:"#60a5fa12",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:9,color:"#60a5fa55"}}>Total</div><div style={{fontSize:20,fontWeight:900,color:"#60a5fa"}}>{w.diasVac||15}</div></div>
              <div style={{background:"#f8717112",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:9,color:"#f8717155"}}>Usados</div><div style={{fontSize:20,fontWeight:900,color:"#f87171"}}>{w.diasUsados||0}</div></div>
              <div style={{background:"#4ade8012",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:9,color:"#4ade8055"}}>Disponibles</div><div style={{fontSize:20,fontWeight:900,color:"#4ade80"}}>{dispD}</div></div>
            </div>

            {/* Pendientes */}
            {pend.length>0&&<div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"#fbbf2466",letterSpacing:2,marginBottom:8}}>PENDIENTES</div>
              {pend.map(s=>(
                <div key={s.id} style={{background:"#fbbf2410",border:"1px solid #fbbf2420",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>📅 {s.dias} días hábiles</div>
                  <div style={{fontSize:11,color:"#4ade80"}}>Sale: {s.desde}</div>
                  <div style={{fontSize:11,color:"#f87171",marginBottom:6}}>Regresa: {s.hasta}</div>
                  <div style={{fontSize:10,color:"#ffffff44",marginBottom:8}}>{s.motivo||"Sin motivo"}</div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>aprobar(sel,s.id)} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:"#22c55e20",color:"#4ade80",fontWeight:700,fontSize:12,cursor:"pointer"}}>✅ Aprobar</button>
                    <button onClick={()=>rechazar(sel,s.id)} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:"#ef444420",color:"#f87171",fontWeight:700,fontSize:12,cursor:"pointer"}}>❌ Rechazar</button>
                  </div>
                </div>
              ))}
            </div>}

            {/* Aprobadas */}
            {aprobadas.length>0&&<div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"#4ade8066",letterSpacing:2,marginBottom:8}}>APROBADAS</div>
              {[...aprobadas].reverse().map(s=>(
                <div key={s.id} style={{background:"#4ade8010",border:"1px solid #4ade8025",borderRadius:10,padding:"12px",marginBottom:8}}>
                  {editVacId===s.id?(
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"#4ade80",marginBottom:10}}>✏️ Modificar vacaciones</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                        <div><Lbl>DESDE</Lbl><input type="date" value={editVacF.desde} onChange={e=>setEditVacF(f=>({...f,desde:e.target.value}))} style={{...IS,fontSize:12}}/></div>
                        <div><Lbl>HASTA</Lbl><input type="date" value={editVacF.hasta} onChange={e=>setEditVacF(f=>({...f,hasta:e.target.value}))} style={{...IS,fontSize:12}}/></div>
                      </div>
                      {editVacF.desde&&editVacF.hasta&&<div style={{fontSize:11,color:"#60a5fa",marginBottom:8}}>Días hábiles: {diasHabiles(editVacF.desde,editVacF.hasta)}</div>}
                      <Inp label="MOTIVO" value={editVacF.motivo} onChange={v=>setEditVacF(f=>({...f,motivo:v}))}/>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={guardarEditVac} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:"#4ade8020",color:"#4ade80",fontWeight:700,fontSize:12,cursor:"pointer"}}>💾 Guardar</button>
                        <button onClick={()=>setEditVacId(null)} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:"#ffffff10",color:"#ffffff44",fontWeight:700,fontSize:12,cursor:"pointer"}}>Cancelar</button>
                      </div>
                    </div>
                  ):(
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:"#4ade80",marginBottom:4}}>✅ {s.dias} días hábiles</div>
                          <div style={{display:"flex",gap:12}}>
                            <div style={{background:"#22c55e20",borderRadius:8,padding:"5px 10px"}}>
                              <div style={{fontSize:9,color:"#4ade8066"}}>🛫 SALE</div>
                              <div style={{fontSize:13,fontWeight:900,color:"#4ade80"}}>{s.desde}</div>
                            </div>
                            <div style={{background:"#f9731620",borderRadius:8,padding:"5px 10px"}}>
                              <div style={{fontSize:9,color:"#f9731666"}}>🛬 REGRESA</div>
                              <div style={{fontSize:13,fontWeight:900,color:"#f97316"}}>{s.hasta}</div>
                            </div>
                          </div>
                          {s.motivo&&<div style={{fontSize:10,color:"#ffffff44",marginTop:6}}>{s.motivo}</div>}
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>{setEditVacId(s.id);setEditVacF({desde:s.desde,hasta:s.hasta,motivo:s.motivo||""});}} style={{background:"#3b82f620",border:"none",color:"#60a5fa",width:28,height:28,borderRadius:8,cursor:"pointer",fontSize:13}}>✏️</button>
                          <button onClick={()=>revocar(s.id)} style={{background:"#ef444420",border:"none",color:"#f87171",width:28,height:28,borderRadius:8,cursor:"pointer",fontSize:13}}>✕</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>}

            {/* Historial rechazadas */}
            {(w.solicitudes||[]).filter(s=>s.estado==="rechazada").length>0&&(
              <div>
                <div style={{fontSize:10,color:"#ffffff25",letterSpacing:2,marginBottom:8}}>HISTORIAL</div>
                {[...(w.solicitudes||[])].filter(s=>s.estado==="rechazada").reverse().map(s=>(
                  <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #ffffff07",fontSize:11}}>
                    <span style={{color:"#f87171"}}>❌</span>
                    <span style={{color:"#ffffff44"}}>{s.dias} días ({s.desde}→{s.hasta})</span>
                    <Tag label="rechazada" color="#f87171"/>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DETALLE SUCURSAL ──────────────────────────────────────
function DetalleSuc({suc,data,periodo,c1,c2}){
  const info=SUCS[suc]; const [sub,setSub]=useState("ventas");
  const vs=filtroPer(data[suc]?.ventas||[],periodo,c1,c2);
  const gs=filtroPer(data[suc]?.gastos||[],periodo,c1,c2);
  const cigV=filtroPer(data[suc]?.cigarros?.ventas||[],periodo,c1,c2);
  const cigG=filtroPer(data[suc]?.cigarros?.gastos||[],periodo,c1,c2);
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[["ventas","💰 Ventas"],["gastos","📉 Gastos"],["cigarros","🚬 Cigarros"]].map(([k,l])=>(<button key={k} onClick={()=>setSub(k)} style={{padding:"6px 14px",borderRadius:20,border:"1px solid",borderColor:sub===k?info.color:"#ffffff10",background:sub===k?info.color+"18":"transparent",color:sub===k?info.color:"#ffffff33",fontSize:11,fontWeight:700,cursor:"pointer"}}>{l}</button>))}
      </div>
      {sub==="ventas"&&(vs.length===0?<Empty text="Sin ventas"/>:vs.map(v=>(<div key={v.id} style={{background:"#0d1525",borderRadius:11,padding:"11px 13px",marginBottom:7,border:"1px solid #22c55e0c"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:2}}>{TIPOS_PAGO.filter(t=>t.id===v.tipo).map(t=><Tag key={t.id} label={t.label} color={v.tipo==="efectivo"?"#22c55e":v.tipo==="tarjeta"?"#3b82f6":"#8b5cf6"}/>)}{v.turno&&<Tag label={v.turno} color="#f97316"/>}<span style={{fontSize:10,color:"#ffffff25"}}>{v.fecha}</span></div>{v.descripcion&&<div style={{fontSize:11,color:"#ffffff44"}}>{v.descripcion}</div>}</div><div style={{fontSize:14,fontWeight:900,color:"#4ade80"}}>{fmt(v.monto)}</div></div></div>)))}
      {sub==="gastos"&&(gs.length===0?<Empty text="Sin gastos"/>:gs.map(g=>(<div key={g.id} style={{background:"#0d1525",borderRadius:11,padding:"11px 13px",marginBottom:7,border:"1px solid #ef44440c"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:2}}><Tag label={CAT_GASTO.find(c=>c.id===g.categoria)?.label||g.categoria} color="#f87171"/><span style={{fontSize:10,color:"#ffffff25"}}>{g.fecha}</span></div><div style={{fontSize:11,fontWeight:600}}>{g.proveedor||g.tienda||"—"}</div>{g.factura&&<div style={{fontSize:10,color:"#ffffff25"}}>#{g.factura}</div>}</div><div style={{fontSize:14,fontWeight:900,color:"#f87171"}}>{fmt(g.monto)}</div></div></div>)))}
      {sub==="cigarros"&&<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}><div style={{background:"#fbbf2410",borderRadius:11,padding:11}}><div style={{fontSize:9,color:"#fbbf2455"}}>Ventas</div><div style={{fontSize:17,fontWeight:900,color:"#fbbf24"}}>{fmt(cigV.reduce((s,x)=>s+x.monto,0))}</div></div><div style={{background:"#f8717110",borderRadius:11,padding:11}}><div style={{fontSize:9,color:"#f8717155"}}>Compras</div><div style={{fontSize:17,fontWeight:900,color:"#f87171"}}>{fmt(cigG.reduce((s,x)=>s+x.monto,0))}</div></div></div>{cigV.map(v=>(<div key={v.id} style={{background:"#0d1525",borderRadius:10,padding:"9px 12px",marginBottom:5,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11}}>{v.descripcion||"Venta"}</span><span style={{color:"#fbbf24",fontWeight:800}}>{fmt(v.monto)}</span></div>))}{cigG.map(g=>(<div key={g.id} style={{background:"#0d1525",borderRadius:10,padding:"9px 12px",marginBottom:5,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11}}>{g.proveedor||"Compra"}</span><span style={{color:"#f87171",fontWeight:800}}>{fmt(g.monto)}</span></div>))}</div>}
    </div>
  );
}

// ── VISTA DUEÑO ───────────────────────────────────────────
function VistaDueno({sesion,data,guardar,onSalir}){
  const [tab,setTab]=useState("resumen");
  const [periodo,setPer]=useState("mes");
  const [c1,setC1]=useState(""); const [c2,setC2]=useState("");
  const [mes,setMes]=useState(mesNow());
  const d14=useMemo(()=>dias14(),[]);

  const calcSuc=(suc,p,c1,c2)=>{
    const v=filtroPer(data[suc]?.ventas||[],p,c1,c2);
    const g=filtroPer(data[suc]?.gastos||[],p,c1,c2);
    const cv=filtroPer(data[suc]?.cigarros?.ventas||[],p,c1,c2);
    const cg=filtroPer(data[suc]?.cigarros?.gastos||[],p,c1,c2);
    const tv=v.reduce((s,x)=>s+x.monto,0),tg=g.reduce((s,x)=>s+x.monto,0);
    const tcv=cv.reduce((s,x)=>s+x.monto,0),tcg=cg.reduce((s,x)=>s+x.monto,0);
    const tar=v.filter(x=>x.tipo==="tarjeta").reduce((s,x)=>s+x.monto,0);
    const comTar=Math.round(tar*(data.comision?.[suc]||0)/100);
    return{tv,tg,tar,comTar,util:tv-tg-comTar,ef:v.filter(x=>x.tipo==="efectivo").reduce((s,x)=>s+x.monto,0),trans:v.filter(x=>x.tipo==="transferencia").reduce((s,x)=>s+x.monto,0),cigUtil:tcv-tcg,totalUtil:(tv-tg-comTar)+(tcv-tcg),t1:v.filter(x=>x.turno==="Turno 1").reduce((s,x)=>s+x.monto,0),t2:v.filter(x=>x.turno==="Turno 2").reduce((s,x)=>s+x.monto,0)};
  };
  const car=calcSuc("carahue",periodo,c1,c2);
  const tem=calcSuc("temuco",periodo,c1,c2);
  const rc=calcReporte(data,"carahue",mes);
  const rt=calcReporte(data,"temuco",mes);

  const grafData=useMemo(()=>d14.map(d=>({f:d.slice(5),vc:(data.carahue?.ventas||[]).filter(x=>x.fecha===d).reduce((s,x)=>s+x.monto,0),uc:(data.carahue?.ventas||[]).filter(x=>x.fecha===d).reduce((s,x)=>s+x.monto,0)-(data.carahue?.gastos||[]).filter(x=>x.fecha===d).reduce((s,x)=>s+x.monto,0),vt:(data.temuco?.ventas||[]).filter(x=>x.fecha===d).reduce((s,x)=>s+x.monto,0),ut:(data.temuco?.ventas||[]).filter(x=>x.fecha===d).reduce((s,x)=>s+x.monto,0)-(data.temuco?.gastos||[]).filter(x=>x.fecha===d).reduce((s,x)=>s+x.monto,0)})),[data,d14]);

  const msgNuevos=(data.mensajes||[]).filter(m=>m.de!=="dueno"&&!m.leido).length;
  const chatNuevos=(data.chatDuenos||[]).filter(m=>m.de!==sesion.id).length;

  const PERIODOS=[{k:"dia",l:"Hoy"},{k:"semana",l:"Semana"},{k:"mes",l:"Mes"},{k:"año",l:"Año"},{k:"custom",l:"Rango"}];
  const TABS=[["resumen","📊 Resumen"],["reporte","📋 Reporte"],["iva","🧾 IVA/PPM"],["tuu","💳 TUU"],["informes","📄 Informes"],["graficos","📈 Gráficos"],["gastos","💼 Gastos"],["trabajadores","👥 RRHH"],["mensajes","💬 Equipo"],["chat","🔒 Chat"],["notas","📝 Notas"],["notificar","📬 Notificar"],["carahue","🌿 Carahue"],["temuco","🏙️ Temuco"]];
  const SIN_FILTRO=["reporte","iva","tuu","informes","gastos","trabajadores","mensajes","chat","notas","notificar"];

  const setFB=(suc,id,v)=>guardar({...data,fijosBase:{...data.fijosBase,[suc]:{...(data.fijosBase?.[suc]||{}),[id]:parseFloat(v)||0}}});
  const setFO=(mk,suc,id,v)=>{const o=JSON.parse(JSON.stringify(data.fijosOv||{}));if(!o[mk])o[mk]={};if(!o[mk][suc])o[mk][suc]={};o[mk][suc][id]=parseFloat(v)||0;guardar({...data,fijosOv:o});};
  const setVB=(suc,id,v)=>guardar({...data,varBase:{...data.varBase,[suc]:{...(data.varBase?.[suc]||{}),[id]:parseFloat(v)||0}}});
  const setVO=(mk,suc,id,v)=>{const o=JSON.parse(JSON.stringify(data.varOv||{}));if(!o[mk])o[mk]={};if(!o[mk][suc])o[mk][suc]={};o[mk][suc][id]=parseFloat(v)||0;guardar({...data,varOv:o});};
  const addFE=(suc,lbl)=>guardar({...data,fijosExtra:{...data.fijosExtra,[suc]:[...(data.fijosExtra?.[suc]||[]),{id:"fe"+uid(),label:lbl}]}});
  const addVE=(suc,lbl)=>guardar({...data,varExtra:{...data.varExtra,[suc]:[...(data.varExtra?.[suc]||[]),{id:"ve"+uid(),label:lbl}]}});
  const setCom=(suc,v)=>guardar({...data,comision:{...data.comision,[suc]:parseFloat(v)||0}});
  const setSueldoDetalle=(suc,gid,liquido,prevision)=>{
    const sd=JSON.parse(JSON.stringify(data.sueldosDetalle||{}));
    if(!sd[suc])sd[suc]={};
    sd[suc][gid]={liquido:parseFloat(liquido)||0, prevision:parseFloat(prevision)||0};
    guardar({...data,sueldosDetalle:sd});
  };
  const aprobar=(wid,sid)=>{const t=JSON.parse(JSON.stringify(data.trabajadores||{}));const s=t[wid].solicitudes.find(x=>x.id===sid);s.estado="aprobada";t[wid].diasUsados=(t[wid].diasUsados||0)+s.dias;guardar({...data,trabajadores:t});};
  const rechazar=(wid,sid)=>{const t=JSON.parse(JSON.stringify(data.trabajadores||{}));t[wid].solicitudes.find(x=>x.id===sid).estado="rechazada";guardar({...data,trabajadores:t});};
  const updTrab=(wid,f)=>{const t=JSON.parse(JSON.stringify(data.trabajadores||{}));t[wid]={...t[wid],...f};guardar({...data,trabajadores:t});};

  return(
    <div style={{minHeight:"100vh",background:"#07090f",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#f0ece8"}}>
      <div style={{background:"#0d1525",borderBottom:"1px solid #ffffff0c",padding:"12px 16px 0",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div><div style={{fontSize:15,fontWeight:900}}>🏪 DUO — Panel Administradores</div><div style={{fontSize:10,color:"#f97316"}}>{sesion.nombre}</div></div>
          <button onClick={onSalir} style={GB}>Salir</button>
        </div>
        <div style={{display:"flex",overflowX:"auto"}}>
          {TABS.map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{background:"none",border:"none",padding:"7px 10px",fontSize:11,fontWeight:700,color:tab===k?"#f97316":"#ffffff33",borderBottom:tab===k?"2px solid #f97316":"2px solid transparent",cursor:"pointer",whiteSpace:"nowrap",position:"relative"}}>
              {l}
              {k==="mensajes"&&msgNuevos>0&&<span style={{position:"absolute",top:3,right:3,background:"#f87171",borderRadius:"50%",width:7,height:7,display:"block"}}/>}
              {k==="chat"&&chatNuevos>0&&<span style={{position:"absolute",top:3,right:3,background:"#f97316",borderRadius:"50%",width:7,height:7,display:"block"}}/>}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:16,maxWidth:860,margin:"0 auto"}}>
        {!SIN_FILTRO.includes(tab)&&(
          <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
            {PERIODOS.map(p=>(<button key={p.k} onClick={()=>setPer(p.k)} style={{padding:"5px 12px",borderRadius:20,border:"1px solid",borderColor:periodo===p.k?"#f97316":"#ffffff10",background:periodo===p.k?"#f9731614":"transparent",color:periodo===p.k?"#f97316":"#ffffff33",fontSize:11,fontWeight:700,cursor:"pointer"}}>{p.l}</button>))}
            {periodo==="custom"&&<><input type="date" value={c1} onChange={e=>setC1(e.target.value)} style={{...IS,width:"auto"}}/><input type="date" value={c2} onChange={e=>setC2(e.target.value)} style={{...IS,width:"auto"}}/></>}
          </div>
        )}

        {tab==="resumen"&&(
          <div>
            {/* KPI total consolidado */}
            <Kpi valor={car.totalUtil+tem.totalUtil} label="UTILIDAD OPERACIONAL TOTAL" sub="Sin descontar gastos fijos, variables ni IVA/PPM"/>

            {/* Nota explicativa */}
            <div style={{background:"#ffffff08",borderRadius:12,padding:"10px 14px",marginBottom:16,fontSize:11,color:"#ffffff55",lineHeight:1.6}}>
              💡 <b style={{color:"#ffffff88"}}>¿Cómo se calcula la utilidad operacional?</b><br/>
              Ventas totales − Gastos diarios − Comisión tarjeta = Utilidad operacional.<br/>
              Para ver la utilidad real (descontando sueldos, IVA, PPM, etc.) ve a <b style={{color:"#f97316"}}>📋 Reporte</b>.
            </div>

            {[{suc:"carahue",sd:car},{suc:"temuco",sd:tem}].map(({suc,sd})=>{
              const info=SUCS[suc];
              return(
                <div key={suc} style={{background:"#0d1525",borderRadius:16,padding:18,marginBottom:16,border:`1px solid ${info.color}25`}}>

                  {/* Encabezado sucursal */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:14,borderBottom:`1px solid ${info.color}18`}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:40,height:40,borderRadius:12,background:info.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{info.emoji}</div>
                      <div>
                        <div style={{fontSize:15,fontWeight:900}}>{info.nombre}</div>
                        <div style={{fontSize:10,color:"#ffffff40"}}>{suc==="carahue"?"Turno 1 y Turno 2":"Turno único"}</div>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:10,color:"#ffffff44",marginBottom:2}}>Utilidad operacional</div>
                      <div style={{fontSize:24,fontWeight:900,color:sd.util>=0?"#4ade80":"#f87171"}}>{fmt(sd.util)}</div>
                      <div style={{fontSize:10,color:"#ffffff33"}}>= Ventas − Gastos − Comisión</div>
                    </div>
                  </div>

                  {/* Sección INGRESOS */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#4ade8066",letterSpacing:2,marginBottom:8}}>📥 INGRESOS</div>
                    <div style={{background:"#22c55e08",borderRadius:12,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                        <span style={{fontSize:13,color:"#ffffff88",fontWeight:600}}>💰 Total Ventas</span>
                        <span style={{fontSize:15,fontWeight:900,color:"#4ade80"}}>{fmt(sd.tv)}</span>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:"#ffffff06",borderRadius:8}}>
                          <span style={{fontSize:11,color:"#ffffff55"}}>💵 Efectivo</span>
                          <span style={{fontSize:12,fontWeight:700,color:"#86efac"}}>{fmt(sd.ef)}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:"#ffffff06",borderRadius:8}}>
                          <span style={{fontSize:11,color:"#ffffff55"}}>💳 Tarjeta (bruto)</span>
                          <span style={{fontSize:12,fontWeight:700,color:"#60a5fa"}}>{fmt(sd.tar)}</span>
                        </div>
                        {sd.comTar>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:"#f8717108",borderRadius:8}}>
                          <span style={{fontSize:11,color:"#f8717188"}}>↳ menos comisión tarjeta ({data.comision?.[suc]||0}%)</span>
                          <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>−{fmt(sd.comTar)}</span>
                        </div>}
                        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:"#ffffff06",borderRadius:8}}>
                          <span style={{fontSize:11,color:"#ffffff55"}}>🏦 Transferencia</span>
                          <span style={{fontSize:12,fontWeight:700,color:"#a78bfa"}}>{fmt(sd.trans)}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:"#fbbf2408",borderRadius:8}}>
                          <span style={{fontSize:11,color:"#fbbf2488"}}>🚬 Cigarros (utilidad neta)</span>
                          <span style={{fontSize:12,fontWeight:700,color:"#fbbf24"}}>{fmt(sd.cigUtil)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sección EGRESOS */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#f8717166",letterSpacing:2,marginBottom:8}}>📤 EGRESOS DIARIOS</div>
                    <div style={{background:"#ef444408",borderRadius:12,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontSize:13,color:"#ffffff88",fontWeight:600}}>📉 Total Gastos operacionales</span>
                        <span style={{fontSize:15,fontWeight:900,color:"#f87171"}}>{fmt(sd.tg)}</span>
                      </div>
                      <div style={{fontSize:10,color:"#ffffff33",marginTop:4}}>Pagos a proveedores, insumos, emergencias, etc.</div>
                    </div>
                  </div>

                  {/* Turnos (solo Carahue) */}
                  {suc==="carahue"&&(
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#ffffff33",letterSpacing:2,marginBottom:8}}>⏰ VENTAS POR TURNO</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div style={{background:"#22c55e0c",border:"1px solid #22c55e18",borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                          <div style={{fontSize:11,color:"#22c55e88",marginBottom:4}}>🌅 Turno 1</div>
                          <div style={{fontSize:18,fontWeight:900,color:"#4ade80"}}>{fmt(sd.t1)}</div>
                        </div>
                        <div style={{background:"#4ade800c",border:"1px solid #4ade8018",borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                          <div style={{fontSize:11,color:"#4ade8088",marginBottom:4}}>🌙 Turno 2</div>
                          <div style={{fontSize:18,fontWeight:900,color:"#86efac"}}>{fmt(sd.t2)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resultado */}
                  <div style={{background:sd.util>=0?"#4ade8010":"#f8717110",border:`1px solid ${sd.util>=0?"#4ade8025":"#f8717125"}`,borderRadius:12,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:sd.util>=0?"#4ade80":"#f87171"}}>= Utilidad Operacional</div>
                      <div style={{fontSize:10,color:"#ffffff33",marginTop:2}}>Ventas {sd.comTar>0?"− Gastos − Comisión tarjeta":"− Gastos"}</div>
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:sd.util>=0?"#4ade80":"#f87171"}}>{fmt(sd.util)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab==="reporte"&&(
          <div>
            <div style={{marginBottom:16}}><Lbl>MES</Lbl><input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{...IS,maxWidth:220}}/></div>
            <Kpi valor={rc.utilReal+rt.utilReal} label="UTILIDAD REAL TOTAL" sub={`Después de TODOS los gastos + IVA/PPM · ${lblMes(mes)}`}/>
            {[{suc:"carahue",r:rc},{suc:"temuco",r:rt}].map(({suc,r})=>{
              const info=SUCS[suc];
              const fd=FIJOS_DEF[suc];const fe=data.fijosExtra?.[suc]||[];
              const vd=VAR_DEF[suc];const ve=data.varExtra?.[suc]||[];
              return(
                <div key={suc} style={{background:"#0d1525",borderRadius:16,padding:18,marginBottom:16,border:`1px solid ${info.color}18`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{info.emoji}</span><div><div style={{fontSize:14,fontWeight:800}}>{info.nombre}</div><div style={{fontSize:10,color:info.color}}>{lblMes(mes)}</div></div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#ffffff30"}}>Utilidad real</div><div style={{fontSize:20,fontWeight:900,color:r.utilReal>=0?"#4ade80":"#f87171"}}>{fmt(r.utilReal)}</div></div>
                  </div>
                  <div style={{background:"#ffffff04",borderRadius:12,padding:14}}>
                    <FR label="💰 Ventas totales"      valor={r.tv}    color="#4ade80" bold/>
                    <FR label="  💵 Efectivo"           valor={r.ef}    color="#86efac" sub/>
                    <FR label="  💳 Tarjeta bruta"      valor={r.tar}   color="#60a5fa" sub/>
                    {r.comTar>0&&<FR label={`  ↳ Comisión (${data.comision?.[suc]||0}%)`} valor={-r.comTar} color="#f87171" sub/>}
                    <FR label="  🏦 Transferencia"      valor={r.trans} color="#a78bfa" sub/>
                    <FR label="🚬 Ventas cigarros"      valor={r.tcv}   color="#fbbf24" bold/>
                    <div style={{borderTop:"1px dashed #ffffff0e",margin:"7px 0"}}/>
                    <FR label="📉 Gastos operacionales" valor={-r.tg}   color="#f87171" bold/>
                    <FR label="📦 Compras cigarros"     valor={-r.tcg}  color="#fca5a5" bold/>
                    <div style={{borderTop:"1px solid #ffffff12",margin:"7px 0"}}/>
                    <FR label="= Utilidad Operacional"  valor={r.utilBruta} color={r.utilBruta>=0?"#4ade80":"#f87171"} bold big/>
                    <div style={{borderTop:"1px dashed #ffffff0e",margin:"7px 0"}}/>
                    <FR label="💼 Gastos Fijos"         valor={-r.totalFijos} color="#fb923c" bold/>
                    {[...fd,...fe].map(x=>{ const v=r.fm[x.id]||0; return v>0?<FR key={x.id} label={`  ${x.label}`} valor={-v} color="#fdba74" sub/>:null; })}
                    <FR label="📊 Gastos Variables"     valor={-r.totalVar} color="#c084fc" bold/>
                    {[...vd,...ve].map(x=>{ const v=r.vm[x.id]||0; return v>0?<FR key={x.id} label={`  ${x.label}`} valor={-v} color="#d8b4fe" sub/>:null; })}
                    <FR label="  🧾 IVA a pagar"        valor={-r.ivaPagar}   color="#d8b4fe" sub/>
                    <FR label="  📊 PPM (3% neto)"      valor={-r.ppm}        color="#d8b4fe" sub/>
                    <div style={{borderTop:"2px solid #ffffff18",margin:"9px 0"}}/>
                    <FR label="✅ UTILIDAD REAL"        valor={r.utilReal} color={r.utilReal>=0?"#4ade80":"#f87171"} bold big final/>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab==="iva"&&<PanelIVA data={data} mes={mes} setMes={setMes}/>}
        {tab==="tuu"&&<PanelTUU data={data} mes={mes} setMes={setMes} guardar={guardar}/>}
        {tab==="informes"&&<PanelInformes data={data}/>}
        {tab==="graficos"&&(
          <div>
            <div style={{background:"#0d1525",borderRadius:16,padding:18,marginBottom:14,border:"1px solid #ffffff0c"}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:12}}>📈 Ventas 14 días</div>
              <ResponsiveContainer width="100%" height={180}><LineChart data={grafData} margin={{left:-10,right:10}}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff07"/><XAxis dataKey="f" tick={{fontSize:9,fill:"#ffffff28"}} tickLine={false} axisLine={false}/><YAxis tick={{fontSize:9,fill:"#ffffff28"}} tickLine={false} axisLine={false} tickFormatter={fmtK}/><Tooltip contentStyle={{background:"#0d1525",border:"1px solid #ffffff12",borderRadius:10,fontSize:11}} formatter={v=>fmt(v)} labelStyle={{color:"#ffffff44"}}/><Legend wrapperStyle={{fontSize:11}}/><Line type="monotone" dataKey="vc" name="Carahue" stroke="#22c55e" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="vt" name="Temuco" stroke="#3b82f6" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>
            </div>
            <div style={{background:"#0d1525",borderRadius:16,padding:18,border:"1px solid #ffffff0c"}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:12}}>💹 Utilidad diaria</div>
              <ResponsiveContainer width="100%" height={180}><BarChart data={grafData} margin={{left:-10,right:10}} barGap={2}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff07"/><XAxis dataKey="f" tick={{fontSize:9,fill:"#ffffff28"}} tickLine={false} axisLine={false}/><YAxis tick={{fontSize:9,fill:"#ffffff28"}} tickLine={false} axisLine={false} tickFormatter={fmtK}/><Tooltip contentStyle={{background:"#0d1525",border:"1px solid #ffffff12",borderRadius:10,fontSize:11}} formatter={v=>fmt(v)} labelStyle={{color:"#ffffff44"}}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="uc" name="Carahue" fill="#22c55e" radius={[4,4,0,0]}/><Bar dataKey="ut" name="Temuco" fill="#3b82f6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
            </div>
          </div>
        )}
        {tab==="gastos"&&<GastosPanel data={data} mes={mes} setMes={setMes} guardar={guardar}/>}        {tab==="trabajadores"&&<TrabajadoresPanel data={data} updTrab={updTrab} aprobar={aprobar} rechazar={rechazar} guardar={guardar}/>}
        {tab==="mensajes"&&<PanelMensajes sesion={sesion} data={data} guardar={guardar}/>}
        {tab==="chat"&&<ChatDuenos sesion={sesion} data={data} guardar={guardar}/>}
        {tab==="notas"&&<PanelNotas sesion={sesion} data={data} guardar={guardar}/>}
        {tab==="notificar"&&<PanelNotificar sesion={sesion} data={data} esDueno={true} rc={rc} rt={rt} mes={mes}/>}
        {(tab==="carahue"||tab==="temuco")&&<DetalleSuc suc={tab} data={data} periodo={periodo} c1={c1} c2={c2}/>}
      </div>
    </div>
  );
}

// ── VISTA VENDEDORA ───────────────────────────────────────
function VistaVendedora({sesion,data,guardar,onSalir}){
  const suc=sesion.sucursal; const info=SUCS[suc];
  const [tab,setTab]=useState("registrar");
  const [modal,setModal]=useState(null);
  const [gnd,setGnd]=useState(false);

  const sd=data[suc]||{ventas:[],gastos:[],proveedores:[],cigarros:{ventas:[],gastos:[]},boletas:[]};
  const vs=sd.ventas||[]; const gs=sd.gastos||[];
  const pvs=sd.proveedores||[];
  const cigV=sd.cigarros?.ventas||[]; const cigG=sd.cigarros?.gastos||[];
  const bols=sd.boletas||[];
  const pCig=pvs.filter(p=>p.esCigarro); const pNrm=pvs.filter(p=>!p.esCigarro);

  const upd=async(nd)=>{setGnd(true);guardar({...data,[suc]:nd});setGnd(false);};

  const eV={fecha:hoy(),tipo:"efectivo",monto:"",descripcion:""};
  const eG={fecha:hoy(),categoria:"proveedor",proveedor:"",tienda:"",factura:"",monto:"",descripcion:""};
  const eCV={fecha:hoy(),monto:"",descripcion:""}; const eCG={fecha:hoy(),proveedor:"",factura:"",monto:"",descripcion:""};
  const eP={nombre:"",contacto:"",vendedor:"",categoria:"General",catPersonalizada:"",esCigarro:false}; const eB={fecha:hoy(),monto:""};
  const eVF={desde:"",hasta:"",motivo:""};

  const [vF,setVF]=useState(eV); const [gF,setGF]=useState(eG);
  const [cvF,setCvF]=useState(eCV); const [cgF,setCgF]=useState(eCG);
  const [pF,setPF]=useState(eP); const [bF,setBF]=useState(eB);
  const [vacF,setVacF]=useState(eVF);
  const [editProvId,setEditProvId]=useState(null);
  const [perCaja,setPerCaja]=useState("dia");
  const [cajaDe,setCajaDe]=useState(hoy());
  const [cajaHa,setCajaHa]=useState(hoy());
  const [perV,setPerV]=useState("dia");
  const [vDe,setVDe]=useState(hoy());
  const [vHa,setVHa]=useState(hoy());

  const gP=async()=>{
    if(!pF.nombre)return;
    const cat=pF.categoria==="__nueva__"?pF.catPersonalizada:pF.categoria;
    const prov={...pF,categoria:cat};
    if(editProvId){
      await upd({...sd,proveedores:pvs.map(p=>p.id===editProvId?{...p,...prov}:p)});
    } else {
      await upd({...sd,proveedores:[{id:uid(),...prov},...pvs]});
    }
    setPF(eP);setEditProvId(null);setModal(null);
  };
  const editarProv=(p)=>{setPF({nombre:p.nombre,contacto:p.contacto||"",vendedor:p.vendedor||"",categoria:p.categoria||"General",catPersonalizada:"",esCigarro:p.esCigarro||false});setEditProvId(p.id);setModal("prov");};

  const gV=async()=>{if(!vF.monto)return;await upd({...sd,ventas:[{id:uid(),...vF,monto:+vF.monto,turno:sesion.turno},...vs]});setVF(eV);setModal(null);};
  const gG=async()=>{if(!gF.monto)return;await upd({...sd,gastos:[{id:uid(),...gF,monto:+gF.monto},...gs]});setGF(eG);setModal(null);};
  const gCV=async()=>{if(!cvF.monto)return;await upd({...sd,cigarros:{...sd.cigarros,ventas:[{id:uid(),...cvF,monto:+cvF.monto},...cigV]}});setCvF(eCV);setModal(null);};
  const gCG=async()=>{if(!cgF.monto)return;await upd({...sd,cigarros:{...sd.cigarros,gastos:[{id:uid(),...cgF,monto:+cgF.monto},...cigG]}});setCgF(eCG);setModal(null);};
  const gB=async()=>{if(!bF.monto)return;await upd({...sd,boletas:[{id:uid(),...bF,monto:+bF.monto,turno:sesion.turno},...bols]});setBF(eB);setModal(null);};

  const dV=(id)=>upd({...sd,ventas:vs.filter(x=>x.id!==id)});
  const dG=(id)=>upd({...sd,gastos:gs.filter(x=>x.id!==id)});
  const dCV=(id)=>upd({...sd,cigarros:{...sd.cigarros,ventas:cigV.filter(x=>x.id!==id)}});
  const dCG=(id)=>upd({...sd,cigarros:{...sd.cigarros,gastos:cigG.filter(x=>x.id!==id)}});
  const dP=(id)=>upd({...sd,proveedores:pvs.filter(x=>x.id!==id)});
  const dB=(id)=>upd({...sd,boletas:bols.filter(x=>x.id!==id)});

  const wid=suc==="carahue"?(sesion.turno==="Turno 1"?"carahue_t1":"carahue_t2"):"temuco";
  const worker=data.trabajadores?.[wid]||{};
  const puedeV=anosD(worker.fechaIngreso)>=1;
  const dispD=Math.max(0,(worker.diasVac||15)-(worker.diasUsados||0));

  const solicitarVac=()=>{
    if(!vacF.desde||!vacF.hasta)return;
    const dias=diasHabiles(vacF.desde, vacF.hasta);
    if(dias>dispD){alert(`Solo tienes ${dispD} días disponibles`);return;}
    const t=JSON.parse(JSON.stringify(data.trabajadores||{}));
    if(!t[wid])return;
    t[wid].solicitudes=[...(t[wid].solicitudes||[]),{id:uid(),...vacF,dias,estado:"pendiente",fecha:hoy()}];
    guardar({...data,trabajadores:t});setVacF(eVF);setModal(null);
  };

  const vHoy=vs.filter(v=>v.fecha===hoy()&&(!sesion.turno||v.turno===sesion.turno));
  const gHoy=gs.filter(g=>g.fecha===hoy());
  const cvHoy=cigV.filter(v=>v.fecha===hoy());
  const cgHoy=cigG.filter(g=>g.fecha===hoy());
  const bHoy=bols.filter(b=>b.fecha===hoy());
  const catA=CAT_GASTO.find(c=>c.id===gF.categoria);
  const msgNuevos=(data.mensajes||[]).filter(m=>m.de==="dueno"&&(m.para==="todos"||m.para===suc)&&!m.leido).length;

  const TABS=[["registrar","📝 Registrar"],["historial","🕐 Hoy"],["caja","💰 Mi Caja"],["cigarros","🚬 Cigarros"],["boletas","🧾 Boletas"],["vacaciones","🏖️ Vacaciones"],["mensajes","💬 Mensajes"],["notificar","📬 Notificar"],["proveedores","🏭 Proveedores"]];

  return(
    <div style={{minHeight:"100vh",background:"#07090f",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#f0ece8"}}>
      <div style={{background:"#0d1525",borderBottom:"1px solid #ffffff0c",padding:"12px 16px 0",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div><div style={{fontSize:14,fontWeight:900}}>{info.emoji} {info.nombre}</div><div style={{fontSize:10,color:info.color}}>{sesion.turno||"Turno único"} · {gnd?"Guardando...":"✓ Guardado"}</div></div>
          <button onClick={onSalir} style={GB}>Salir</button>
        </div>
        <div style={{display:"flex",overflowX:"auto"}}>
          {TABS.map(([k,l])=>(<button key={k} onClick={()=>setTab(k)} style={{background:"none",border:"none",padding:"7px 10px",fontSize:11,fontWeight:700,color:tab===k?info.color:"#ffffff33",borderBottom:tab===k?`2px solid ${info.color}`:"2px solid transparent",cursor:"pointer",whiteSpace:"nowrap",position:"relative"}}>{l}{k==="mensajes"&&msgNuevos>0&&<span style={{position:"absolute",top:3,right:3,background:"#f87171",borderRadius:"50%",width:7,height:7,display:"block"}}/>}</button>))}
        </div>
      </div>

      <div style={{padding:16,maxWidth:700,margin:"0 auto"}}>

        {tab==="registrar"&&(
          <div>
            <div style={{background:"#0d1525",borderRadius:16,padding:18,marginBottom:14,border:`1px solid ${info.color}14`}}>
              <div style={{fontSize:11,fontWeight:700,color:info.color,marginBottom:14,letterSpacing:1}}>REGISTRAR OPERACIÓN</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <QBtn icon="💰" label="Venta"          color={info.color} onClick={()=>setModal("venta")}/>
                <QBtn icon="📤" label="Gasto"          color="#f87171"    onClick={()=>setModal("gasto")}/>
                <QBtn icon="🚬" label="Venta Cigarro"  color="#fbbf24"    onClick={()=>setModal("cigV")}/>
                <QBtn icon="📦" label="Compra Cigarro" color="#fb923c"    onClick={()=>setModal("cigG")}/>
              </div>
            </div>
            <div style={{background:"#0d1525",borderRadius:16,padding:18,border:`1px solid ${info.color}0e`}}>
              <div style={{fontSize:11,fontWeight:700,color:"#ffffff28",marginBottom:12}}>TURNO HOY</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[{l:"Ventas",n:vHoy.length,c:info.color},{l:"Gastos",n:gHoy.length,c:"#f87171"},{l:"V.Cigarros",n:cvHoy.length,c:"#fbbf24"},{l:"C.Cigarros",n:cgHoy.length,c:"#fb923c"}].map(x=>(<div key={x.l} style={{background:"#ffffff05",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:9,color:"#ffffff25"}}>{x.l}</div><div style={{fontSize:22,fontWeight:900,color:x.c}}>{x.n}</div></div>))}
              </div>
              <div style={{marginTop:10,fontSize:10,color:"#ffffff18",textAlign:"center"}}>💡 Solo los administradores pueden ver montos y utilidades</div>
            </div>
          </div>
        )}

        {tab==="historial"&&(
          <div>
            {vHoy.length>0&&<>
              <div style={{fontSize:10,color:"#ffffff22",letterSpacing:2,margin:"14px 0 8px"}}>💰 VENTAS HOY {sesion.turno?`— ${sesion.turno}`:""}</div>
              {vHoy.map(v=>(
                <div key={v.id} style={{background:"#0d1525",borderRadius:10,padding:"11px 13px",marginBottom:7,border:"1px solid #22c55e0c"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{display:"flex",gap:5,marginBottom:2,flexWrap:"wrap"}}>
                        {TIPOS_PAGO.filter(t=>t.id===v.tipo).map(t=><Tag key={t.id} label={t.label} color={v.tipo==="efectivo"?"#22c55e":v.tipo==="tarjeta"?"#3b82f6":"#8b5cf6"}/>)}
                        {v.turno&&<Tag label={v.turno} color="#f97316"/>}
                        <span style={{fontSize:10,color:"#ffffff25"}}>{v.fecha}</span>
                      </div>
                      {v.descripcion&&<div style={{fontSize:11,color:"#ffffff44"}}>{v.descripcion}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:14,fontWeight:800,color:"#4ade80"}}>{fmt(v.monto)}</span>
                      <button onClick={()=>{setVF({fecha:v.fecha,tipo:v.tipo,monto:String(v.monto),descripcion:v.descripcion||""});dV(v.id);setModal("venta");}} style={{background:"#3b82f620",border:"none",color:"#60a5fa",width:26,height:26,borderRadius:8,cursor:"pointer",fontSize:12}}>✏️</button>
                      <DelBtn onClick={()=>dV(v.id)}/>
                    </div>
                  </div>
                </div>
              ))}
            </>}
            {gHoy.length>0&&<>
              <div style={{fontSize:10,color:"#ffffff22",letterSpacing:2,margin:"14px 0 8px"}}>📉 GASTOS HOY</div>
              {gHoy.map(g=>(
                <div key={g.id} style={{background:"#0d1525",borderRadius:10,padding:"11px 13px",marginBottom:7,border:"1px solid #ef44440c"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{display:"flex",gap:5,marginBottom:2,flexWrap:"wrap"}}>
                        <Tag label={CAT_GASTO.find(c=>c.id===g.categoria)?.label||g.categoria} color="#f87171"/>
                        <span style={{fontSize:10,color:"#ffffff25"}}>{g.fecha}</span>
                      </div>
                      <div style={{fontSize:11,fontWeight:600}}>{g.proveedor||g.tienda||"—"}</div>
                      {g.factura&&<div style={{fontSize:10,color:"#ffffff25"}}>#{g.factura}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:14,fontWeight:800,color:"#f87171"}}>{fmt(g.monto)}</span>
                      <button onClick={()=>{setGF({fecha:g.fecha,categoria:g.categoria,proveedor:g.proveedor||"",tienda:g.tienda||"",factura:g.factura||"",monto:String(g.monto),descripcion:g.descripcion||""});dG(g.id);setModal("gasto");}} style={{background:"#3b82f620",border:"none",color:"#60a5fa",width:26,height:26,borderRadius:8,cursor:"pointer",fontSize:12}}>✏️</button>
                      <DelBtn onClick={()=>dG(g.id)}/>
                    </div>
                  </div>
                </div>
              ))}
            </>}
            {vHoy.length===0&&gHoy.length===0&&<Empty text="Sin registros hoy"/>}
          </div>
        )}

        {tab==="caja"&&(()=>{
          const PERS=[["dia","Hoy"],["semana","Semana"],["mes","Mes"],["año","Año"],["custom","Rango"]];
          const vP=filtroPer(vs,perCaja,cajaDe,cajaHa);
          const gP2=filtroPer(gs,perCaja,cajaDe,cajaHa);
          const cvP=filtroPer(sd.cigarros?.ventas||[],perCaja,cajaDe,cajaHa);
          const cgP=filtroPer(sd.cigarros?.gastos||[],perCaja,cajaDe,cajaHa);
          const tvP=vP.reduce((s,x)=>s+x.monto,0);
          const tgP=gP2.reduce((s,x)=>s+x.monto,0);
          const tcvP=cvP.reduce((s,x)=>s+x.monto,0);
          const tcgP=cgP.reduce((s,x)=>s+x.monto,0);
          const efP=vP.filter(x=>x.tipo==="efectivo").reduce((s,x)=>s+x.monto,0);
          const tarP=vP.filter(x=>x.tipo==="tarjeta").reduce((s,x)=>s+x.monto,0);
          const transP=vP.filter(x=>x.tipo==="transferencia").reduce((s,x)=>s+x.monto,0);
          const comTarP=Math.round(tarP*(data.comision?.[suc]||0)/100);
          const utilP=tvP+tcvP-tgP-tcgP-comTarP;
          return(
            <div>
              <div style={{background:"#fbbf2410",border:"1px solid #fbbf2420",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:11,color:"#fbbf24"}}>
                💡 Usa esta pestaña para cuadrar el dinero físico de caja con los registros del sistema.
              </div>
              {/* Selector período */}
              <div style={{display:"flex",gap:6,marginBottom:perCaja==="custom"?8:16,flexWrap:"wrap"}}>
                {PERS.map(([k,l])=>(
                  <button key={k} onClick={()=>setPerCaja(k)} style={{flex:1,minWidth:50,padding:"8px 4px",borderRadius:9,border:`1px solid ${perCaja===k?info.color:"#ffffff12"}`,background:perCaja===k?info.color+"20":"transparent",color:perCaja===k?info.color:"#ffffff44",fontWeight:700,fontSize:11,cursor:"pointer"}}>{l}</button>
                ))}
              </div>
              {perCaja==="custom"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                  <div><Lbl>DESDE</Lbl><input type="date" value={cajaDe} onChange={e=>setCajaDe(e.target.value)} style={{...IS,fontSize:12}}/></div>
                  <div><Lbl>HASTA</Lbl><input type="date" value={cajaHa} onChange={e=>setCajaHa(e.target.value)} style={{...IS,fontSize:12}}/></div>
                </div>
              )}
              {/* Resumen */}
              <div style={{background:"#0d1525",borderRadius:14,padding:16,marginBottom:14,border:`1px solid ${info.color}18`}}>
                <div style={{fontSize:10,color:"#ffffff44",letterSpacing:2,marginBottom:12}}>📊 RESUMEN {PERS.find(p=>p[0]===perCaja)?.[1]?.toUpperCase()}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  <div style={{background:"#4ade8010",borderRadius:10,padding:"12px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#4ade8066",marginBottom:4}}>💰 Total Ventas</div>
                    <div style={{fontSize:18,fontWeight:900,color:"#4ade80"}}>{fmt(tvP)}</div>
                  </div>
                  <div style={{background:"#f8717110",borderRadius:10,padding:"12px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#f8717166",marginBottom:4}}>📉 Total Gastos</div>
                    <div style={{fontSize:18,fontWeight:900,color:"#f87171"}}>{fmt(tgP)}</div>
                  </div>
                </div>
                {/* Desglose ventas */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:10,color:"#ffffff33",marginBottom:6}}>Desglose ventas:</div>
                  {[{l:"💵 Efectivo en caja",v:efP,c:"#4ade80"},{l:"💳 Tarjeta",v:tarP,c:"#60a5fa"},{l:"🏦 Transferencia",v:transP,c:"#a78bfa"}].map(x=>(
                    x.v>0&&<div key={x.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #ffffff07"}}>
                      <span style={{fontSize:11,color:"#ffffff55"}}>{x.l}</span>
                      <span style={{fontSize:12,fontWeight:700,color:x.c}}>{fmt(x.v)}</span>
                    </div>
                  ))}
                  {comTarP>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #ffffff07"}}>
                    <span style={{fontSize:11,color:"#f8717188"}}>↳ Comisión tarjeta</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>−{fmt(comTarP)}</span>
                  </div>}
                  {tcvP>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #ffffff07"}}>
                    <span style={{fontSize:11,color:"#fbbf2488"}}>🚬 Cigarros</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#fbbf24"}}>{fmt(tcvP-tcgP)}</span>
                  </div>}
                </div>
                {/* Resultado */}
                <div style={{background:utilP>=0?"#4ade8012":"#f8717112",border:`1px solid ${utilP>=0?"#4ade8025":"#f8717125"}`,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:utilP>=0?"#4ade80":"#f87171"}}>Utilidad operacional</div>
                    <div style={{fontSize:10,color:"#ffffff44"}}>Dinero que debería quedar en caja</div>
                  </div>
                  <div style={{fontSize:20,fontWeight:900,color:utilP>=0?"#4ade80":"#f87171"}}>{fmt(utilP)}</div>
                </div>
              </div>
              {/* Detalle transacciones */}
              {vP.length>0&&<>
                <div style={{fontSize:10,color:"#ffffff22",letterSpacing:2,margin:"14px 0 8px"}}>💰 VENTAS DEL PERÍODO</div>
                {vP.map(v=>(
                  <div key={v.id} style={{background:"#0d1525",borderRadius:9,padding:"9px 12px",marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #22c55e0a"}}>
                    <div>
                      <div style={{display:"flex",gap:5,marginBottom:2}}>
                        <Tag label={TIPOS_PAGO.find(t=>t.id===v.tipo)?.label||v.tipo} color={v.tipo==="efectivo"?"#22c55e":v.tipo==="tarjeta"?"#3b82f6":"#8b5cf6"}/>
                        <span style={{fontSize:10,color:"#ffffff33"}}>{v.fecha}</span>
                      </div>
                      {v.descripcion&&<div style={{fontSize:10,color:"#ffffff44"}}>{v.descripcion}</div>}
                    </div>
                    <span style={{fontSize:13,fontWeight:800,color:"#4ade80"}}>{fmt(v.monto)}</span>
                  </div>
                ))}
              </>}
              {gP2.length>0&&<>
                <div style={{fontSize:10,color:"#ffffff22",letterSpacing:2,margin:"14px 0 8px"}}>📉 GASTOS DEL PERÍODO</div>
                {gP2.map(g=>(
                  <div key={g.id} style={{background:"#0d1525",borderRadius:9,padding:"9px 12px",marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #ef44440a"}}>
                    <div>
                      <div style={{display:"flex",gap:5,marginBottom:2}}>
                        <Tag label={CAT_GASTO.find(c=>c.id===g.categoria)?.label||g.categoria} color="#f87171"/>
                        <span style={{fontSize:10,color:"#ffffff33"}}>{g.fecha}</span>
                      </div>
                      {(g.proveedor||g.tienda)&&<div style={{fontSize:10,color:"#ffffff44"}}>{g.proveedor||g.tienda}</div>}
                    </div>
                    <span style={{fontSize:13,fontWeight:800,color:"#f87171"}}>{fmt(g.monto)}</span>
                  </div>
                ))}
              </>}
              {vP.length===0&&gP2.length===0&&<Empty text="Sin registros en este período"/>}
            </div>
          );
        })()}


        {tab==="cigarros"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}><QBtn icon="🚬" label="+ Venta" color="#fbbf24" onClick={()=>setModal("cigV")}/><QBtn icon="📦" label="+ Compra" color="#f87171" onClick={()=>setModal("cigG")}/></div>
            {cvHoy.length>0&&<><div style={{fontSize:10,color:"#ffffff22",letterSpacing:2,marginBottom:8}}>VENTAS HOY</div>{cvHoy.map(v=>(<div key={v.id} style={{background:"#0d1525",borderRadius:10,padding:"9px 12px",marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:11}}>{v.descripcion||"Venta cigarros"}</div><div style={{fontSize:10,color:"#ffffff25"}}>{v.fecha}</div></div><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{color:"#fbbf24",fontWeight:800}}>{fmt(v.monto)}</span><button onClick={()=>{setCvF({fecha:v.fecha,monto:String(v.monto),descripcion:v.descripcion||""});dCV(v.id);setModal("cigV");}} style={{background:"#3b82f620",border:"none",color:"#60a5fa",width:26,height:26,borderRadius:8,cursor:"pointer",fontSize:12}}>✏️</button><DelBtn onClick={()=>dCV(v.id)}/></div></div>))}</>}
            {cgHoy.length>0&&<><div style={{fontSize:10,color:"#ffffff22",letterSpacing:2,margin:"12px 0 8px"}}>COMPRAS HOY</div>{cgHoy.map(g=>(<div key={g.id} style={{background:"#0d1525",borderRadius:10,padding:"9px 12px",marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:11}}>{g.proveedor||"Compra"}</div><div style={{fontSize:10,color:"#ffffff25"}}>{g.fecha} {g.factura&&`· #${g.factura}`}</div></div><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{color:"#f87171",fontWeight:800}}>{fmt(g.monto)}</span><button onClick={()=>{setCgF({fecha:g.fecha,proveedor:g.proveedor||"",factura:g.factura||"",monto:String(g.monto),descripcion:g.descripcion||""});dCG(g.id);setModal("cigG");}} style={{background:"#3b82f620",border:"none",color:"#60a5fa",width:26,height:26,borderRadius:8,cursor:"pointer",fontSize:12}}>✏️</button><DelBtn onClick={()=>dCG(g.id)}/></div></div>))}</>}
            {cvHoy.length===0&&cgHoy.length===0&&<Empty text="Sin registros hoy"/>}
          </div>
        )}

        {tab==="boletas"&&(
          <div>
            <div style={{background:"#8b5cf610",border:"1px solid #8b5cf622",borderRadius:12,padding:"12px 14px",marginBottom:16,fontSize:11,color:"#a78bfa"}}>🧾 Registra el total de boletas emitidas en tu turno. Los administradores usan este dato para calcular el IVA y PPM mensual.</div>
            <div style={{background:"#0d1525",borderRadius:14,padding:16,marginBottom:16,border:"1px solid #8b5cf618"}}>
              <Inp label="FECHA" type="date" value={bF.fecha} onChange={v=>setBF(f=>({...f,fecha:v}))}/>
              <Inp label="TOTAL BOLETAS ($)" type="number" placeholder="Ej: 350000" value={bF.monto} onChange={v=>setBF(f=>({...f,monto:v}))}/>
              {sesion.turno&&<div style={{background:"#8b5cf612",borderRadius:8,padding:"7px 12px",fontSize:11,color:"#a78bfa",marginBottom:12}}>Turno: {sesion.turno}</div>}
              {bF.monto>0&&(()=>{
                const bruto=+bF.monto||0;
                const neto=Math.round(bruto/1.19);
                const iva=bruto-neto;
                return <div style={{background:"#8b5cf608",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:11}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#ffffff44"}}>Monto bruto (c/IVA)</span><span style={{color:"#a78bfa",fontWeight:700}}>{fmt(bruto)}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#ffffff44"}}>Neto (÷1.19)</span><span style={{color:"#60a5fa",fontWeight:700}}>{fmt(neto)}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#ffffff44"}}>IVA (19%)</span><span style={{color:"#f87171",fontWeight:700}}>{fmt(iva)}</span></div>
                </div>;
              })()}
              <Btn onClick={gB} color="#8b5cf6" loading={gnd}>Registrar Boletas</Btn>
            </div>
            {bols.filter(b=>b.fecha===hoy()||(sesion.turno?b.turno===sesion.turno:true)).slice(0,20).map(b=>{
              const bruto=b.monto||0;
              const neto=Math.round(bruto/1.19);
              const iva=bruto-neto;
              return(
                <div key={b.id} style={{background:"#0d1525",borderRadius:10,padding:"10px 13px",marginBottom:6,border:"1px solid #8b5cf615"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"#a78bfa"}}>Boletas — {b.fecha}</div>
                      {b.turno&&<div style={{fontSize:10,color:"#ffffff33"}}>{b.turno}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:14,fontWeight:800,color:"#a78bfa"}}>{fmt(bruto)}</span>
                      <button onClick={()=>{setBF({fecha:b.fecha,monto:String(b.monto)});dB(b.id);}} style={{background:"#3b82f620",border:"none",color:"#60a5fa",width:26,height:26,borderRadius:8,cursor:"pointer",fontSize:12}}>✏️</button>
                      <DelBtn onClick={()=>dB(b.id)}/>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                    <div style={{background:"#60a5fa08",borderRadius:6,padding:"5px 8px",textAlign:"center"}}><div style={{fontSize:9,color:"#60a5fa55"}}>Neto</div><div style={{fontSize:11,fontWeight:700,color:"#60a5fa"}}>{fmt(neto)}</div></div>
                    <div style={{background:"#f8717108",borderRadius:6,padding:"5px 8px",textAlign:"center"}}><div style={{fontSize:9,color:"#f8717155"}}>IVA 19%</div><div style={{fontSize:11,fontWeight:700,color:"#f87171"}}>{fmt(iva)}</div></div>
                    <div style={{background:"#a78bfa08",borderRadius:6,padding:"5px 8px",textAlign:"center"}}><div style={{fontSize:9,color:"#a78bfa55"}}>Bruto</div><div style={{fontSize:11,fontWeight:700,color:"#a78bfa"}}>{fmt(bruto)}</div></div>
                  </div>
                </div>
              );
            })}
            {bols.length===0&&<Empty text="Sin boletas registradas"/>}
          </div>
        )}

        {tab==="vacaciones"&&(
          <div>
            <div style={{background:"#0d1525",borderRadius:16,padding:18,border:"1px solid #60a5fa18"}}>
              <div style={{fontSize:13,fontWeight:800,color:"#60a5fa",marginBottom:10}}>🏖️ Mis Vacaciones</div>
              <div style={{background:"#fbbf2410",border:"1px solid #fbbf2425",borderRadius:10,padding:"10px 12px",marginBottom:14,fontSize:11,color:"#fbbf24"}}>⚠️ Las vacaciones deben solicitarse con <b>al menos 1 semana de anticipación</b>. Se cuentan solo <b>días hábiles</b> (lunes a viernes, excluye feriados de Chile).</div>
              {!puedeV?(<div style={{textAlign:"center",padding:20,color:"#ffffff30",fontSize:12}}>⏳ Se habilitan al cumplir 1 año.{worker.fechaIngreso&&<><br/><span style={{fontSize:11,color:"#ffffff44"}}>Faltan ~{Math.max(0,Math.ceil(365-diasD(worker.fechaIngreso)))} días</span></>}</div>):(
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                    <div style={{background:"#60a5fa12",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:9,color:"#60a5fa55"}}>Total</div><div style={{fontSize:20,fontWeight:900,color:"#60a5fa"}}>{worker.diasVac||15}</div></div>
                    <div style={{background:"#f8717112",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:9,color:"#f8717155"}}>Usados</div><div style={{fontSize:20,fontWeight:900,color:"#f87171"}}>{worker.diasUsados||0}</div></div>
                    <div style={{background:"#4ade8012",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:9,color:"#4ade8055"}}>Disponibles</div><div style={{fontSize:20,fontWeight:900,color:"#4ade80"}}>{dispD}</div></div>
                  </div>
                  <Btn onClick={()=>setModal("vacaciones")} color="#3b82f6">+ Solicitar Vacaciones</Btn>
                  {(worker.solicitudes||[]).length>0&&(
                    <div style={{marginTop:14}}>
                      <div style={{fontSize:10,color:"#ffffff22",letterSpacing:2,marginBottom:8}}>MIS SOLICITUDES</div>
                      {[...(worker.solicitudes||[])].reverse().map(s=>(
                        <div key={s.id} style={{background:"#ffffff06",borderRadius:10,padding:"10px 12px",marginBottom:6,border:`1px solid ${s.estado==="aprobada"?"#4ade8020":s.estado==="rechazada"?"#f8717120":"#fbbf2420"}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:s.estado==="aprobada"?8:0}}>
                            <div>
                              <div style={{fontSize:11,fontWeight:600}}>{s.dias} días hábiles</div>
                              <div style={{fontSize:11,color:"#4ade8088"}}>🛫 Sale: {s.desde}</div>
                              <div style={{fontSize:11,color:"#f9731688"}}>🛬 Regresa: {s.hasta}</div>
                              {s.motivo&&<div style={{fontSize:10,color:"#ffffff33"}}>{s.motivo}</div>}
                            </div>
                            <Tag label={s.estado} color={s.estado==="aprobada"?"#4ade80":s.estado==="rechazada"?"#f87171":"#fbbf24"}/>
                          </div>
                          {s.estado==="aprobada"&&(
                            <button onClick={()=>{
                              const t=JSON.parse(JSON.stringify(data.trabajadores||{}));
                              const sol=t[wid].solicitudes.find(x=>x.id===s.id);
                              t[wid].diasUsados=Math.max(0,(t[wid].diasUsados||0)-sol.dias);
                              sol.estado="rechazada";
                              guardar({...data,trabajadores:t});
                            }} style={{width:"100%",padding:"6px",borderRadius:8,border:"1px solid #f8717130",background:"#f8717110",color:"#f87171",fontWeight:700,fontSize:11,cursor:"pointer",marginTop:4}}>
                              ✕ Cancelar vacaciones (vuelvo antes)
                            </button>
                          )}
                          {s.estado==="pendiente"&&(
                            <button onClick={()=>{
                              const t=JSON.parse(JSON.stringify(data.trabajadores||{}));
                              t[wid].solicitudes=t[wid].solicitudes.filter(x=>x.id!==s.id);
                              guardar({...data,trabajadores:t});
                            }} style={{width:"100%",padding:"6px",borderRadius:8,border:"1px solid #f8717130",background:"#f8717110",color:"#f87171",fontWeight:700,fontSize:11,cursor:"pointer",marginTop:4}}>
                              ✕ Retirar solicitud
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab==="mensajes"&&<PanelMensajes sesion={sesion} data={data} guardar={guardar}/>}
        {tab==="notificar"&&<PanelNotificar sesion={sesion} data={data} esDueno={false} rc={null} rt={null} mes={null}/>}

        {tab==="proveedores"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700}}>{pvs.length} proveedores</div>
              <button onClick={()=>{setPF({nombre:"",contacto:"",vendedor:"",categoria:"General",catPersonalizada:"",esCigarro:false});setEditProvId(null);setModal("prov");}} style={{border:"none",color:"#fff",padding:"9px 18px",borderRadius:10,fontWeight:900,cursor:"pointer",fontSize:13,background:"linear-gradient(135deg,#8b5cf6,#a78bfa99)"}}>+ Proveedor</button>
            </div>
            {pNrm.map(p=><ProvCard key={p.id} p={p} gastos={gs} onDel={()=>dP(p.id)} onEdit={()=>editarProv(p)}/>)}
            {pCig.length>0&&<div style={{fontSize:10,color:"#fbbf2444",letterSpacing:2,margin:"12px 0 8px"}}>🚬 CIGARROS</div>}
            {pCig.map(p=><ProvCard key={p.id} p={p} gastos={cigG} onDel={()=>dP(p.id)} onEdit={()=>editarProv(p)} cigarro/>)}
          </div>
        )}
      </div>

      {/* MODALES */}
      {modal&&(
        <div onClick={()=>setModal(null)} style={{position:"fixed",inset:0,background:"#000000bb",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0d1525",borderRadius:"20px 20px 0 0",padding:"24px 22px 36px",width:"100%",maxWidth:500,border:"1px solid #ffffff0e",maxHeight:"90vh",overflowY:"auto"}}>

            {modal==="venta"&&<>
              <div style={{fontSize:16,fontWeight:900,marginBottom:18}}>💰 Registrar Venta</div>
              <Inp label="FECHA" type="date" value={vF.fecha} onChange={v=>setVF(f=>({...f,fecha:v}))}/>
              <div style={{marginBottom:14}}><Lbl>TIPO DE PAGO</Lbl><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{TIPOS_PAGO.map(t=>(<button key={t.id} onClick={()=>setVF(f=>({...f,tipo:t.id}))} style={{flex:1,minWidth:90,padding:"9px 6px",borderRadius:10,border:`1px solid ${vF.tipo===t.id?info.color:"#ffffff12"}`,background:vF.tipo===t.id?info.color+"20":"transparent",color:vF.tipo===t.id?info.color:"#ffffff44",fontWeight:700,fontSize:12,cursor:"pointer"}}>{t.label}</button>))}</div>{vF.tipo==="tarjeta"&&(data.comision?.[suc]||0)>0&&<div style={{fontSize:10,color:"#f8717199",marginTop:5}}>⚠️ Se descontará {data.comision[suc]}% de comisión al calcular utilidad</div>}</div>
              <Inp label="MONTO ($)" type="number" placeholder="0" value={vF.monto} onChange={v=>setVF(f=>({...f,monto:v}))}/>
              <Inp label="DESCRIPCIÓN (opcional)" value={vF.descripcion} onChange={v=>setVF(f=>({...f,descripcion:v}))}/>
              {sesion.turno&&<div style={{background:info.color+"12",borderRadius:8,padding:"7px 12px",fontSize:11,color:info.color,marginBottom:12}}>Turno: {sesion.turno}</div>}
              <Btn onClick={gV} color={info.color} loading={gnd}>Guardar Venta</Btn>
            </>}

            {modal==="gasto"&&<>
              <div style={{fontSize:16,fontWeight:900,marginBottom:18}}>📤 Registrar Gasto</div>
              <Inp label="FECHA" type="date" value={gF.fecha} onChange={v=>setGF(f=>({...f,fecha:v}))}/>
              <Sel label="CATEGORÍA" value={gF.categoria} onChange={v=>setGF(f=>({...f,categoria:v,proveedor:"",tienda:""}))}>
                {CAT_GASTO.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </Sel>
              {catA?.req?(<div style={{marginBottom:14}}><Lbl>PROVEEDOR</Lbl><select value={gF.proveedor} onChange={e=>setGF(f=>({...f,proveedor:e.target.value}))} style={IS}><option value="">-- Seleccionar --</option>{pNrm.map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}</select>{pNrm.length===0&&<div style={{fontSize:10,color:"#f87171",marginTop:4}}>⚠️ Agrega proveedores primero</div>}</div>):(<Inp label="LUGAR / TIENDA" placeholder="Ej: Líder, Unimarc" value={gF.tienda} onChange={v=>setGF(f=>({...f,tienda:v}))}/>)}
              <Inp label="N° FACTURA (opcional)" value={gF.factura} onChange={v=>setGF(f=>({...f,factura:v}))}/>
              <Inp label="MONTO ($)" type="number" placeholder="0" value={gF.monto} onChange={v=>setGF(f=>({...f,monto:v}))}/>
              <Inp label="¿QUÉ SE COMPRÓ?" value={gF.descripcion} onChange={v=>setGF(f=>({...f,descripcion:v}))}/>
              <Btn onClick={gG} color="#ef4444" loading={gnd}>Guardar Gasto</Btn>
            </>}

            {modal==="cigV"&&<><div style={{fontSize:16,fontWeight:900,marginBottom:18}}>🚬 Venta Cigarros</div><Inp label="FECHA" type="date" value={cvF.fecha} onChange={v=>setCvF(f=>({...f,fecha:v}))}/><Inp label="MONTO ($)" type="number" placeholder="0" value={cvF.monto} onChange={v=>setCvF(f=>({...f,monto:v}))}/><Inp label="DESCRIPCIÓN (opcional)" value={cvF.descripcion} onChange={v=>setCvF(f=>({...f,descripcion:v}))}/><Btn onClick={gCV} color="#fbbf24" loading={gnd}>Guardar</Btn></>}

            {modal==="cigG"&&<><div style={{fontSize:16,fontWeight:900,marginBottom:18}}>📦 Compra Cigarros</div><Inp label="FECHA" type="date" value={cgF.fecha} onChange={v=>setCgF(f=>({...f,fecha:v}))}/><div style={{marginBottom:14}}><Lbl>PROVEEDOR CIGARROS</Lbl><select value={cgF.proveedor} onChange={e=>setCgF(f=>({...f,proveedor:e.target.value}))} style={IS}><option value="">-- Seleccionar --</option>{pCig.map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}</select></div><Inp label="N° FACTURA" value={cgF.factura} onChange={v=>setCgF(f=>({...f,factura:v}))}/><Inp label="MONTO ($)" type="number" placeholder="0" value={cgF.monto} onChange={v=>setCgF(f=>({...f,monto:v}))}/><Btn onClick={gCG} color="#f87171" loading={gnd}>Guardar</Btn></>}

            {modal==="prov"&&<>
              <div style={{fontSize:16,fontWeight:900,marginBottom:4}}>{editProvId?"✏️ Editar Proveedor":"🏭 Nuevo Proveedor"}</div>
              <div style={{fontSize:11,color:"#ffffff33",marginBottom:18}}>{editProvId?"Modifica los datos del proveedor":"Agrega un nuevo proveedor"}</div>
              <Inp label="NOMBRE *" value={pF.nombre} onChange={v=>setPF(f=>({...f,nombre:v}))}/>
              <Inp label="VENDEDOR / REPRESENTANTE" placeholder="Ej: Juan Pérez" value={pF.vendedor} onChange={v=>setPF(f=>({...f,vendedor:v}))}/>
              <Inp label="TELÉFONO" placeholder="Ej: +56 9 1234 5678" value={pF.contacto} onChange={v=>setPF(f=>({...f,contacto:v}))}/>
              <div style={{marginBottom:14}}>
                <Lbl>CATEGORÍA</Lbl>
                <select value={pF.categoria==="__nueva__"?"__nueva__":pF.categoria} onChange={e=>setPF(f=>({...f,categoria:e.target.value,catPersonalizada:""}))} style={IS}>
                  {CATS_PROV.map(c=><option key={c} value={c}>{c}</option>)}
                  <option value="__nueva__">+ Nueva categoría...</option>
                </select>
                {pF.categoria==="__nueva__"&&<input placeholder="Escribe el nombre de la nueva categoría..." value={pF.catPersonalizada} onChange={e=>setPF(f=>({...f,catPersonalizada:e.target.value}))} style={{...IS,marginTop:8,fontSize:13}}/>}
              </div>
              <div style={{marginBottom:14}}>
                <Lbl>TIPO</Lbl>
                <div style={{display:"flex",gap:8}}>
                  {[{v:false,l:"📦 General"},{v:true,l:"🚬 Cigarros"}].map(o=>(
                    <button key={String(o.v)} onClick={()=>setPF(f=>({...f,esCigarro:o.v}))}
                      style={{flex:1,padding:10,borderRadius:10,border:`1px solid ${pF.esCigarro===o.v?"#8b5cf6":"#ffffff12"}`,background:pF.esCigarro===o.v?"#8b5cf620":"transparent",color:pF.esCigarro===o.v?"#a78bfa":"#ffffff44",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <Btn onClick={gP} color="#8b5cf6" loading={gnd}>{editProvId?"Guardar Cambios":"Guardar Proveedor"}</Btn>
            </>}

            {modal==="vacaciones"&&<>
              <div style={{fontSize:16,fontWeight:900,marginBottom:14}}>🏖️ Solicitar Vacaciones</div>
              <div style={{background:"#fbbf2410",border:"1px solid #fbbf2425",borderRadius:10,padding:"10px 12px",marginBottom:14,fontSize:11,color:"#fbbf24"}}>⚠️ Mínimo <b>1 semana de anticipación</b>. Se cuentan solo <b>días hábiles</b> (excluye sáb, dom y feriados de Chile).</div>
              <div style={{background:"#60a5fa12",borderRadius:10,padding:"10px 12px",marginBottom:14,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#60a5fa66"}}>Días disponibles</span><span style={{fontSize:14,fontWeight:800,color:"#60a5fa"}}>{dispD}</span></div>
              <Inp label="FECHA DESDE" type="date" value={vacF.desde} onChange={v=>setVacF(f=>({...f,desde:v}))}/>
              <Inp label="FECHA HASTA" type="date" value={vacF.hasta} onChange={v=>setVacF(f=>({...f,hasta:v}))}/>
              {vacF.desde&&vacF.hasta&&<div style={{background:"#3b82f614",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#60a5fa",marginBottom:12}}>Días hábiles: <b>{diasHabiles(vacF.desde,vacF.hasta)}</b> <span style={{color:"#ffffff44"}}>(excluye sáb, dom y feriados)</span></div>}
              <Inp label="MOTIVO (opcional)" value={vacF.motivo} onChange={v=>setVacF(f=>({...f,motivo:v}))}/>
              <Btn onClick={solicitarVac} color="#3b82f6" loading={gnd}>Enviar Solicitud</Btn>
            </>}

          </div>
        </div>
      )}
    </div>
  );
}
