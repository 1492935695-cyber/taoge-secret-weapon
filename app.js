(() => {
  'use strict';
  const $=id=>document.getElementById(id),fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'—',fmtCount=v=>typeof v==='number'&&Number.isFinite(v)?Math.round(v).toLocaleString('zh-CN'):'—';
  const hm=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'—';};
  let savedKey='';try{savedKey=sessionStorage.getItem('taoge-key')||'';}catch(e){}
  const key=location.hash.slice(1)||savedKey;
  if(key)try{sessionStorage.setItem('taoge-key',key);}catch(e){}
  const local=['127.0.0.1','localhost'].includes(location.hostname)||/^[a-z0-9-]+\.trycloudflare\.com$/.test(location.hostname);
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
    set('minute-clicks',fresh?fmt(last.minuteClicks):'—');
    set('average',sameDay?fmt(last.dailyAverage):'—');
    set('average-clicks',sameDay?fmt(last.dailyAverageClicks):'—');
    set('minute-time',fresh?(last.minuteSpend===null?'正在核对分钟数据':hm(last.asOf)+' 更新'):last?'最后采样 '+hm(last.asOf):'正在取得最新数据');
    const t=sameDay?last.totals:{};
    for(const [id,v] of Object.entries({'current-hour':t.current_hour_spend,'previous-hour':t.previous_hour_spend,'daily-spend':t.spend,'current-hour-net-roi':t.current_hour_net_roi,'net-roi':t.net_roi,'net-cvr':t.net_cvr==null?null:t.net_cvr*100,'net-cpo':t.net_cpo,'cpm':t.cpm,'budget-remaining':t.budget_remaining,'refund-rate':t.refund_rate==null?null:t.refund_rate*100}))set(id,fmt(v));
    set('current-hour-paid-orders',fmtCount(t.current_hour_paid_orders));set('paid-orders',fmtCount(t.paid_orders));
    set('target','目标 '+fmt(t.target));set('current-hour-label',t.current_hour_label||'本小时');set('current-hour-roi-label',t.current_hour_label||'本小时');set('current-hour-paid-orders-label',t.current_hour_label||'本小时');set('previous-hour-label',t.previous_hour_label||'上一小时');
    set('daily-budget','今日预算 '+fmt(t.daily_budget)+' 元');
    const refund=last&&last.refundAverage;
    set('refund-average',refund&&refund.rate!=null?'平均退款率 '+fmt(refund.rate*100)+'% · 历史'+refund.days+'日':'平均退款率 — · 暂无历史样本');
    $('refund-average').title='近7日内同计划有记录日期的最后快照，按整体成交金额加权；不含今天，可能未覆盖全天。';
    set('net-orders',t.net_orders==null?'今日消耗 ÷ 今日净成交单数':'今日净成交 '+t.net_orders+' 单');
    set('updated',last?'数据更新 '+hm(last.asOf):'尚未取得数据');$('updated').title=last?last.asOf:'';
    let notice='';
    if(!key)notice='请使用涛哥分享的完整专属链接打开，链接需包含 # 后面的访问码。';
    else if(lastError)notice=last?'连接暂时中断，正在自动重试。下方保留上次数据，当前分钟消耗暂不显示。':'实时数据暂未连接，正在自动重试。请稍候，连接成功后会自动显示。';
    else if(last&&!fresh)notice=last.message||'数据暂未更新，正在自动恢复。当前分钟消耗暂不显示；采集电脑需开机联网并保持千川登录。';
    $('notice').hidden=!notice;set('notice',notice);
    const canFallback=lastError&&!local&&endpoint&&key;
    $('fallback-link').hidden=!canFallback;
    if(canFallback)$('fallback-link').href=endpoint+'/?v=13#'+key;
    const a=fresh&&last.advice;
    $('advice').dataset.level=a?a.level||'hold':'hold';
    if(a){set('advice-title',a.title||'');set('advice-body',a.advice||'');set('advice-time',hm(a.at)+' · 每'+(a.intervalMinutes||5)+'分钟更新');}
    else{set('advice-title',fresh?'正在积累观察样本':'数据更新后再判断');set('advice-body',fresh?'先保持当前设置，待有效样本形成后显示建议。':'请先确认采集连接和数据时间，避免根据旧数据调整计划。');set('advice-time','每5分钟更新');}
    const evidence=a&&a.evidence;set('advice-evidence',evidence?'依据：'+evidence:'');$('advice-evidence').hidden=!evidence;
    if(last){$('history').replaceChildren(...last.history.slice().reverse().map(r=>{const tr=document.createElement('tr');for(const v of [hm(r.at),fmt(r.minuteSpend),fmt(r.impressionsPerMinute),fmt(r.clicksPerMinute),r.netOrders==null?'—':String(r.netOrders),fmt(r.netRoi),fmt(r.spend)]){const td=document.createElement('td');td.textContent=v;tr.append(td);}tr.title=r.at;return tr;}));
      const d=last.details||{},percent=v=>v==null?'—':fmt(v*100)+'%';
      const items=[['数据质量',d.data_quality],['数据源延迟',d.source_age_seconds==null?null:Math.round(d.source_age_seconds)+' 秒'],['今日展示次数',d.impressions],['今日点击次数',d.clicks],['今日支付订单数',d.paid_orders],['今日净成交订单数',d.net_orders],['今日支付成交金额',fmt(d.paid_amount)+' 元'],['今日净成交金额',fmt(d.net_amount)+' 元'],['累计 CPM',fmt(d.cpm)],['累计 CTR',percent(d.ctr)],['累计 CPC',fmt(d.cpc)],['累计支付转化率',percent(d.paid_cvr)],['累计净成交转化率',percent(d.net_cvr)],['支付每单成本',fmt(d.paid_cpo)],['净成交每单成本',fmt(d.net_cpo)],['支付 ROI',fmt(d.paid_roi)],['ROI 目标',fmt(d.target)],['今日预算',fmt(d.daily_budget)+' 元'],['今日剩余预算',fmt(d.budget_remaining)+' 元'],['预算消耗速度',d.budget_burn_rate==null?null:fmt(d.budget_burn_rate)+' 元 / 小时'],['按当前速度可跑',d.budget_eta_minutes==null?null:fmt(d.budget_eta_minutes)+' 分钟']];
      for(const mins of [5,10,15,30,60]){const w=d['window_'+mins+'m']||{};items.push(['近'+mins+'分钟消耗',w.spend==null?null:fmt(w.spend)+' 元'],['近'+mins+'分钟净 ROI',w.reliable?fmt(w.net_roi):null]);}
      $('extra-metrics').replaceChildren(...items.filter(([k,v])=>v!=null&&v!=='—'&&!String(v).startsWith('—')).map(([k,v])=>{const div=document.createElement('div'),label=document.createElement('span'),b=document.createElement('b');label.textContent=k;b.textContent=String(v);div.append(label,b);return div;}));
      const records=(id,rows,describe)=>{const nodes=rows.slice().reverse().map(r=>{const p=document.createElement('p');p.textContent=describe(r);return p;});if(!nodes.length){const p=document.createElement('p');p.textContent='暂无记录';nodes.push(p);}$(id).replaceChildren(...nodes);};
      records('alerts',last.alerts||[],r=>hm(r.at)+' · '+(r.title||'提醒')+' '+(r.evidence||'')+(r.advice?' 建议：'+r.advice:''));
      records('events',last.events||[],r=>hm(r.at)+' · '+(r.label||r.field||r.type||'变更')+' '+String(r.before??'—')+' → '+String(r.after??'—'));
    }
  }
  async function json(url,opts={}){
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),14000):null;
    try{const r=await fetch(url,{cache:'no-store',...(controller?{signal:controller.signal}:{}),...opts});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}
    finally{if(timer!==null)clearTimeout(timer);}
  }
  async function discover(force=false,exclude=''){
    if(local)return;
    if(!force&&endpoint&&Date.now()-endpointAt<180000)return;
    const sources=[new URL('endpoint.json?t='+Date.now(),location.href).href,'https://raw.githubusercontent.com/1492935695-cyber/taoge-secret-weapon/main/endpoint.json?t='+Date.now()];
    let failure;
    for(const source of sources){try{
      const d=await json(source);
      if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(d.endpoint||'')||d.endpoint===exclude)throw Error('Waiting for connection');
      endpoint=d.endpoint;endpointAt=Date.now();return;
    }catch(e){failure=e;}}
    throw failure||Error('Waiting for connection');
  }
  async function refresh(){
    if(busy||!key){render();return;}busy=true;$('refresh').disabled=true;
    try{await discover();let data;
      try{data=await json(endpoint+'/api/snapshot?t='+Date.now(),{headers:{Authorization:'Bearer '+key}});}
      catch(e){if(local)throw e;await discover(true,endpoint);data=await json(endpoint+'/api/snapshot?t='+Date.now(),{headers:{Authorization:'Bearer '+key}});}
      if(data.version!==4)throw Error('Unexpected data');last=data;lastError='';clockOffset=typeof data.serverAt==='string'?new Date(data.serverAt).getTime()-Date.now():0;
    }catch(e){lastError=e.message;}finally{busy=false;$('refresh').disabled=false;render();}
  }
  $('refresh').addEventListener('click',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('online',refresh);
  setInterval(refresh,10000);setInterval(render,5000);refresh();
})();
