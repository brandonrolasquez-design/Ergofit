(function(){
  const root=document.getElementById('app-shell');
  const cfg=window.ERGOFIT_SUPABASE||{};
  const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const BASELINES={risk:33.3,fatigue:4.0,alarm:0};
  const TARGETS={risk:20,fatigue:3.0,alarm:5};
  let injected=false;
  const norm=v=>String(v??'').trim().toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  async function getRows(){
    if(!cfg.url||!cfg.publishableKey)return [];
    const m=await import(SDK);
    const c=m.createClient(cfg.url,cfg.publishableKey);
    const {data,error}=await c.auth.getSession();
    if(error||!data.session)return [];
    const q=await c.from('registrations').select('id,level,fatigue,alarm,created_at').order('created_at',{ascending:true});
    if(q.error)throw q.error;
    return q.data||[];
  }
  function calc(data){
    const n=data.length;
    const risk=n?((data.filter(r=>['moderado','alto'].includes(norm(r.level))).length/n)*100):0;
    const fatigue=n?(data.reduce((s,r)=>s+Number(r.fatigue||0),0)/n):0;
    const alarm=n?((data.filter(r=>norm(r.alarm)==='si').length/n)*100):0;
    return {risk,fatigue,alarm,n};
  }
  function periodKey(date){const d=new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  function periodLabel(key){const [y,m]=key.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('es-CO',{month:'short',year:'numeric'}).replace('.','');}
  function monthly(data){
    const map={};
    data.forEach(r=>{const k=periodKey(r.created_at);(map[k]??=[]).push(r);});
    return Object.keys(map).sort().map(k=>({label:periodLabel(k),...calc(map[k])}));
  }
  function lineChart(series,key,baseline,target,min=0,max=100){
    const W=760,H=250,p={l:52,r:24,t:24,b:46};
    const innerW=W-p.l-p.r,innerH=H-p.t-p.b;
    const pts=series.map((d,i)=>({x:series.length===1?p.l+innerW/2:p.l+i*(innerW/(series.length-1)),y:p.t+innerH-(Math.max(min,Math.min(max,d[key]))-min)/(max-min)*innerH,d}));
    const y=v=>p.t+innerH-(v-min)/(max-min)*innerH;
    const grid=[min,min+(max-min)/4,min+(max-min)/2,min+3*(max-min)/4,max];
    const gridSvg=grid.map(v=>`<g><line x1="${p.l}" y1="${y(v)}" x2="${W-p.r}" y2="${y(v)}" stroke="#D7E3E2"/><text x="${p.l-9}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#526466">${Number(v).toFixed(key==='fatigue'?1:0)}${key==='fatigue'?'':'%'}</text></g>`).join('');
    const path=pts.length?pts.map((pt,i)=>`${i?'L':'M'} ${pt.x} ${pt.y}`).join(''):'';
    const dots=pts.map(pt=>`<circle cx="${pt.x}" cy="${pt.y}" r="5" fill="#0F5C5E"><title>${pt.d.label}: ${key==='fatigue'?pt.d[key].toFixed(1)+'/10':pt.d[key].toFixed(1)+'%'}</title></circle>`).join('');
    const labels=pts.map(pt=>`<text x="${pt.x}" y="${H-18}" text-anchor="middle" font-size="11" fill="#526466">${esc(pt.d.label)}</text>`).join('');
    const baseY=y(baseline),targetY=y(target);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tendencia del indicador" style="width:100%;height:auto;display:block"><rect x="0" y="0" width="${W}" height="${H}" rx="14" fill="#fff"/>${gridSvg}<line x1="${p.l}" y1="${baseY}" x2="${W-p.r}" y2="${baseY}" stroke="#E09F3E" stroke-width="2" stroke-dasharray="7 6"/><line x1="${p.l}" y1="${targetY}" x2="${W-p.r}" y2="${targetY}" stroke="#2F7D78" stroke-width="2" stroke-dasharray="4 5"/>${path?`<path d="${path}" fill="none" stroke="#0F5C5E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`:''}${dots}${labels}<g transform="translate(${p.l} 10)"><line x1="0" y1="0" x2="22" y2="0" stroke="#E09F3E" stroke-width="2" stroke-dasharray="7 6"/><text x="28" y="4" font-size="11" fill="#526466">Línea base</text><line x1="94" y1="0" x2="116" y2="0" stroke="#2F7D78" stroke-width="2" stroke-dasharray="4 5"/><text x="122" y="4" font-size="11" fill="#526466">Meta</text></g></svg>`;
  }
  function card(title,value,unit,baseline,target,better){
    const current=value;
    const delta=current-baseline;
    const status=better?(current<=target?'Meta alcanzada':'En seguimiento'):(current<=target?'Dentro del umbral':'Revisar');
    const cls=current<=target?'kpi-ok':'kpi-watch';
    return `<div class="card kpi-tracker-card"><div class="kpi-tracker-head"><div><div class="kpi-tracker-title">${title}</div><div class="kpi-tracker-value">${typeof current==='number'?current.toFixed(unit==='%'?1:1):current}<span>${unit}</span></div></div><span class="kpi-status ${cls}">${status}</span></div><div class="kpi-tracker-meta"><span>Línea base: <strong>${baseline.toFixed(1)}${unit}</strong></span><span>Meta: <strong>${target.toFixed(1)}${unit}</strong></span><span>Cambio: <strong>${delta>0?'+':''}${delta.toFixed(1)}${unit}</strong></span></div></div>`;
  }
  function render(data){
    const host=document.getElementById('epi-kpi-tracking');
    if(!host)return;
    const current=calc(data),series=monthly(data);
    const riskSeries=series.map(x=>({label:x.label,risk:x.risk}));
    const fatigueSeries=series.map(x=>({label:x.label,fatigue:x.fatigue}));
    const alarmSeries=series.map(x=>({label:x.label,alarm:x.alarm}));
    host.innerHTML=`<div class="kpi-tracker-wrap"><div class="hero"><div><h2>Seguimiento de KPI</h2><p>Indicadores calculados automáticamente con la base completa de evaluaciones ERGOFIT. Las líneas punteadas muestran línea base y meta.</p></div><div class="kpi-n">n = ${current.n}</div></div><div class="grid kpi-tracker-grid">${card('KPI 1 · Riesgo moderado o alto',current.risk,'%',BASELINES.risk,TARGETS.risk,true)}${card('KPI 2 · Fatiga autorreportada',current.fatigue,'/10',BASELINES.fatigue,TARGETS.fatigue,true)}${card('KPI 3 · Alertas ergonómicas',current.alarm,'%',BASELINES.alarm,TARGETS.alarm,true)}</div><div class="grid kpi-chart-grid"><div class="card kpi-chart"><h3>1. Riesgo moderado o alto</h3><p class="small">Proporción de evaluaciones con nivel moderado o alto por mes.</p>${lineChart(riskSeries,'risk',BASELINES.risk,TARGETS.risk,0,100)}</div><div class="card kpi-chart"><h3>2. Fatiga autorreportada</h3><p class="small">Promedio mensual en escala de 0 a 10.</p>${lineChart(fatigueSeries,'fatigue',BASELINES.fatigue,TARGETS.fatigue,0,10)}</div><div class="card kpi-chart"><h3>3. Alertas ergonómicas</h3><p class="small">Proporción mensual de evaluaciones que generan alerta.</p>${lineChart(alarmSeries,'alarm',BASELINES.alarm,TARGETS.alarm,0,100)}</div></div><div class="kpi-method"><strong>Lectura técnica:</strong> el KPI 1 y el KPI 2 se interpretan como indicadores donde una reducción es favorable frente a la meta definida. Para el KPI 3, una alerta no representa por sí misma un resultado negativo; funciona como mecanismo de detección. Por ello, el seguimiento operativo debe complementarse con el porcentaje de alertas gestionadas.</div></div>`;
  }
  function inject(){
    if(injected)return;
    const content=root.querySelector('.content');
    if(!content)return;
    const existing=document.getElementById('epi-kpi-tracking');
    if(existing){injected=true;load();return;}
    const section=document.createElement('section');section.id='epi-kpi-tracking';content.appendChild(section);injected=true;load();
  }
  async function load(){try{const data=await getRows();render(data);}catch(e){const host=document.getElementById('epi-kpi-tracking');if(host)host.innerHTML=`<div class="card"><strong>Seguimiento de KPI no disponible.</strong><p class="small">${esc(e.message||'Error de conexión')}</p></div>`;}}
  const observer=new MutationObserver(inject);
  observer.observe(root,{childList:true,subtree:true});
  setTimeout(inject,1200);
  setInterval(()=>{if(document.visibilityState!=='hidden')load();},30000);
})();
