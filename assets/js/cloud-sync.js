(function(){
  const cfg=window.ERGOFIT_CONFIG||{};
  const configured=Boolean(cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase);
  let client=null;
  if(configured){client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);window.ERGOFIT_SUPABASE=client;}
  async function saveRegistration(record){
    if(!configured)return {ok:false,reason:'backend-not-configured'};
    const row={client_id:record.id,name:record.name,job:record.job,exposures:record.exposures,zones:record.zones,fatigue:record.fatigue,duration:record.duration,alarm:record.alarm,level:record.level,created_at:record.createdAt||new Date().toISOString(),source:'ergofit-web'};
    const {error}=await client.from('registrations').upsert(row,{onConflict:'client_id'});
    return error?{ok:false,error:error.message}:{ok:true};
  }
  async function syncAdmin(){
    if(!configured)return;
    const {data,error}=await client.from('registrations').select('*').order('created_at',{ascending:false});
    if(error)return;
    let current={};try{current=JSON.parse(localStorage.getItem('ergofit_db_v1')||'{}')}catch{}
    const employees=[],assessments=[];
    (data||[]).forEach(r=>{const eid='cloud-'+r.client_id;employees.push({id:eid,name:r.name,area:'Por definir',role:r.job});assessments.push({id:'cloud-a-'+r.client_id,employeeId:eid,date:(r.created_at||'').slice(0,10),score:Number(r.fatigue||0)*10,level:r.level||'Bajo',body:(r.zones||[]).join(', '),factor:(r.exposures||[]).join(', '),notes:'Registro preventivo realizado desde ERGOFIT.'});});
    const localEmployees=(current.employees||[]).filter(x=>!String(x.id).startsWith('cloud-'));
    const localAssessments=(current.assessments||[]).filter(x=>!String(x.id).startsWith('cloud-a-'));
    localStorage.setItem('ergofit_db_v1',JSON.stringify({...current,employees:[...employees,...localEmployees],assessments:[...assessments,...localAssessments]}));
  }
  window.ERGOFIT_CLOUD={configured,client,saveRegistration,syncAdmin};
  const nativeSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    nativeSet.call(this,key,value);
    if(configured&&key==='ergofit_registro_local_v2'&&this===window.localStorage){try{const arr=JSON.parse(value||'[]');if(arr[0])saveRegistration(arr[0]);}catch{}}
  };
})();
