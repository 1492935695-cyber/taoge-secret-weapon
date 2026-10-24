(() => {
  'use strict';
  const $=id=>document.getElementById(id),fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  const hm=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'—';};
  const key=location.hash.slice(1)||sessionStorage.getItem('taoge-key')||'';
  if(key)sessionStorage.setItem('taoge-key',key);
  const local=['127.0.0.1','localhost'].includes(location.hostname);
  let endpoint=local?location.origin:'',endpointAt=0,last=null,busy=false,lastError='',clockOffset=0;
  const set=(id,v)=>$(id).textContent=v;
  function render(){
    const now=Date.now()+clockOffset,asOf=last?new Date(last.asOf).getTime():0,age=(now-asOf)/1000;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
    const sameDay=last&&last.date===today,fresh=!!(last&&sameDay&&age>=-30&&age<=180&&last.fresh&&last.health==='running'&&!lastError);
    const status=lastError?'连接中断，正在重试':!last?'正在连接':!sameDay?'等待今日数据':last.health==='error'?'采集重连中':age>180?'数据已延迟':fresh?'正在采集':'正在恢复采集';
    $('connection').className='connection '+(fresh?'live':lastError||age>180?'error':'warning');set('connection-text',status);
    $('circle').classList.toggle('stale',!fresh);
    set('minute',fresh?fmt(last.minuteSpend):'—');
    set('average',sameDay?fmt(last.dailyAverage):'—');
    set('minute-time',fresh?(last.minuteSpend===null?'首个样本已到，等待下一分钟':hm(last.asOf)+' 更新'):last?'最后采样 '+hm(last.asOf):'正在取得最新数据');
    const t=sameDay?last.totals:{};
    for(const [id,v] of Object.entries({'current-hour':t.current_hour_spend,'previous-hour':t.previous_hour_spend,'daily-spend':t.spend,'net-roi':t.net_roi,'net-cvr':t.net_cvr==null?null:t.net_cvr*100,'net-cpo':t.net_cpo}))set(id,fmt(v));
    set('target','目标 '+fmt(t.target));set('current-hour-label',t.current_hour_label||'本小时');set('previous-hour-label',t.previous_hour_label||'上一小时');
    set('net-orders',t.net_orders==null?'今日消耗 ÷ 今日净成交单数':'今日净成交 '+t.net_orders+' 单');
    set('updated',last?'数据更新 '+hm(last.asOf):'尚未取得数据');$('updated').title=last?last.asOf:'';
    let notice='';
    if(!key)notice='请使用涛哥分享的完整专属链接打开，链接需包含 # 后面的访问码。';
    else if(lastError)notice='连接暂时中断，正在自动重试。下方保留上次数据，当前分钟消耗暂不显示。';
    else if(last&&!fresh)notice=last.message||'数据暂未更新，正在自动恢复。当前分钟消耗暂不显示；采集电脑需开机联网并保持千川登录。';
    $('notice').hidden=!notice;set('notice',notice);
    const a=fresh&&last.advice;$('advice').hidden=!a;
    if(a){set('advice-title',a.title||'');set('advice-body',a.advice||'');set('advice-time',hm(a.at));}
    if(last){$('history').replaceChildren(...last.history.slice().reverse().map(r=>{const tr=document.createElement('tr');for(const v of [hm(r.at),fmt(r.minuteSpend),r.netOrders==null?'—':String(r.netOrders),fmt(r.netRoi)]){const td=document.createElement('td');td.textContent=v;tr.append(td);}tr.title=r.at;return tr;}));}
  }
  async function json(url,opts={}){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(14000),...opts});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
  async function discover(force=false){
    if(local)return;
    if(!force&&endpoint&&Date.now()-endpointAt<180000)return;
    const d=await json('https://raw.githubusercontent.com/1492935695-cyber/taoge-secret-weapon/main/endpoint.json?t='+Date.now());
    if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(d.endpoint||''))throw Error('Waiting for connection');
    endpoint=d.endpoint;endpointAt=Date.now();
  }
  async function refresh(){
    if(busy||!key){render();return;}busy=true;$('refresh').disabled=true;
    try{await discover();let data;
      try{data=await json(endpoint+'/api/snapshot?t='+Date.now(),{headers:{Authorization:'Bearer '+key}});}
      catch(e){if(local)throw e;await discover(true);data=await json(endpoint+'/api/snapshot?t='+Date.now(),{headers:{Authorization:'Bearer '+key}});}
      if(data.version!==4)throw Error('Unexpected data');last=data;lastError='';clockOffset=typeof data.serverAt==='string'?new Date(data.serverAt).getTime()-Date.now():0;
    }catch(e){lastError=e.message;}finally{busy=false;$('refresh').disabled=false;render();}
  }
  $('refresh').addEventListener('click',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('online',refresh);
  setInterval(refresh,10000);setInterval(render,5000);refresh();
})();
