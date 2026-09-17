(function(){
  const cfg=window.ERGOFIT_SUPABASE||{};
  const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  let clientPromise=null;
  async function client(){
    if(!cfg.url||!cfg.publishableKey) throw new Error('Supabase no configurado');
    if(!clientPromise) clientPromise=import(SDK).then(m=>m.createClient(cfg.url,cfg.publishableKey));
    return clientPromise;
  }
  async function saveRegistration(record){
    const c=await client();
    const row={client_id:record.id,name:record.name,job:record.job,exposures:record.exposures||[],zones:record.zones||[],fatigue:Number(record.fatigue||0),duration:record.duration||null,alarm:record.alarm||'no',level:record.level||null,created_at:record.createdAt||new Date().toISOString(),source:'ergofit-web'};
    const {error}=await c.from('registrations').upsert(row,{onConflict:'client_id'});
    if(error) throw error;
    return row;
  }
  async function listRegistrations(){
    const c=await client();
    const {data,error}=await c.from('registrations').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    return data||[];
  }
  async function subscribe(callback){
    const c=await client();
    return c.channel('ergofit-registrations').on('postgres_changes',{event:'*',schema:'public',table:'registrations'},callback).subscribe();
  }
  window.ERGOFIT_CLOUD={configured:Boolean(cfg.url&&cfg.publishableKey),client:null,saveRegistration,listRegistrations,subscribe};
  const nativeSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    nativeSet.call(this,key,value);
    if(key==='ergofit_registro_local_v2'&&this===window.localStorage){
      try{const arr=JSON.parse(value||'[]');if(arr[0])saveRegistration(arr[0]).catch(e=>console.warn('ERGOFIT cloud sync:',e.message));}catch(e){}
    }
  };
})();
