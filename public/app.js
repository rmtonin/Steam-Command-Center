// Dashboard UI and minimal OBS WebSocket 5 client.
const $=(id)=>document.getElementById(id),fmt=(n)=>Number(n||0).toLocaleString(),pct=(a,b)=>b?`${(a/b*100).toFixed(2)}%`:'0.00%';
let ws,sequence=0,pending=new Map(),timer,settings={url:'ws://127.0.0.1:4455',password:'',poll:10,twitchChannel:'',youtubeChannelId:'',...JSON.parse(localStorage.getItem('scc')||'{}')};
const histories={total:[],twitch:[],youtube:[],obs:[]};
function pushHistory(name,value,limit=24){const list=histories[name];list.push(Number(value)||0);if(list.length>limit)list.shift();return list}
function drawChart(id,values,width,height){const chart=$(id);if(!chart)return;const max=Math.max(...values,1),min=Math.min(...values,0),range=Math.max(max-min,1);const points=values.map((value,index)=>`${values.length===1?0:index/(values.length-1)*width},${height-3-((value-min)/range)*(height-8)}`).join(' ');chart.setAttribute('points',points||`0,${height-3} ${width},${height-3}`)}
function updateCharts(platforms){const twitch=Number(platforms.twitch.viewers||0),youtube=Number(platforms.youtube.viewers||0),total=twitch+youtube;drawChart('twitch-chart',pushHistory('twitch',twitch),160,34);drawChart('youtube-chart',pushHistory('youtube',youtube),160,34);drawChart('total-chart',pushHistory('total',total),220,48)}
function showError(message){$('error').textContent=message?.message||message;$('error').hidden=false}
function rotateRight(v,n){return(v>>>n)|(v<<(32-n))}
function sha256Base64(text){const bytes=new TextEncoder().encode(text),bitLength=bytes.length*8,length=Math.ceil((bytes.length+9)/64)*64,message=new Uint8Array(length);message.set(bytes);message[bytes.length]=128;const view=new DataView(message.buffer);view.setUint32(length-8,Math.floor(bitLength/4294967296),false);view.setUint32(length-4,bitLength>>>0,false);const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];for(let o=0;o<length;o+=64){const w=new Uint32Array(64);for(let i=0;i<16;i++)w[i]=view.getUint32(o+i*4,false);for(let i=16;i<64;i++){const a=rotateRight(w[i-15],7)^rotateRight(w[i-15],18)^(w[i-15]>>>3),b=rotateRight(w[i-2],17)^rotateRight(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+a+w[i-7]+b)>>>0}let[a,b,c,d,e,f,g,z]=h;for(let i=0;i<64;i++){const t1=(z+(rotateRight(e,6)^rotateRight(e,11)^rotateRight(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((rotateRight(a,2)^rotateRight(a,13)^rotateRight(a,22))+((a&b)^(a&c)^(b&c)))>>>0;z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}h=[(h[0]+a)>>>0,(h[1]+b)>>>0,(h[2]+c)>>>0,(h[3]+d)>>>0,(h[4]+e)>>>0,(h[5]+f)>>>0,(h[6]+g)>>>0,(h[7]+z)>>>0]}const out=new Uint8Array(32),outView=new DataView(out.buffer);h.forEach((v,i)=>outView.setUint32(i*4,v,false));return btoa(String.fromCharCode(...out))}
function setObsStatus(state,label){const badge=$('obs-status');badge.textContent=label;badge.dataset.state=state}
function clearError(){$('error').textContent='';$('error').hidden=true}
function connect(){
  const previousSocket=ws;
  if(previousSocket) previousSocket.close();

  const socket=new WebSocket(settings.url);
  ws=socket;
  setObsStatus('connecting','OBS connecting');

  socket.onmessage=async({data})=>{
    if(socket!==ws) return;
    const m=JSON.parse(data);

    if(m.op===0){
      const identify={rpcVersion:1,eventSubscriptions:1};
      if(m.d.authentication){
        const secret=sha256Base64(settings.password+m.d.authentication.salt);
        identify.authentication=sha256Base64(secret+m.d.authentication.challenge);
      }
      socket.send(JSON.stringify({op:1,d:identify}));
      return;
    }

    if(m.op===2){
      setObsStatus('connected','OBS connected');
      clearError();
      refreshObs();
      return;
    }

    if(m.op===7){
      const request=pending.get(m.d.requestId);
      if(request){
        m.d.requestStatus.result
          ? request.resolve(m.d.responseData)
          : request.reject(Error(m.d.requestStatus.comment));
        pending.delete(m.d.requestId);
      }
    }
  };

  socket.onclose=(event)=>{
    if(socket!==ws) return;
    const messages={4005:'Unsupported RPC version.',4006:'Invalid event subscription.',4007:'OBS did not receive Identify in time.',4008:'OBS rejected the Identify message.',4009:'OBS authentication failed. Check the WebSocket password.',4010:'Unsupported RPC version.'};
    setObsStatus('disconnected','OBS disconnected');
    showError(messages[event.code]||`OBS disconnected (code ${event.code}).`);
  };

  socket.onerror=()=>{
    if(socket!==ws) return;
    setObsStatus('disconnected','OBS connection error');
    showError('Could not connect to OBS WebSocket.');
  };
}
function call(requestType){return new Promise((resolve,reject)=>{if(!ws||ws.readyState!==1)return reject(Error('OBS is not connected'));const requestId=String(++sequence);pending.set(requestId,{resolve,reject});ws.send(JSON.stringify({op:6,d:{requestType,requestId}}))})}
async function refreshObs(){try{const[s,o]=await Promise.all([call('GetStats'),call('GetStreamStatus')]);$('fps').textContent=Number(s.activeFps||0).toFixed(1);$('cpu').textContent=Number(s.cpuUsage||0).toFixed(1)+'%';$('memory').textContent=Number(s.memoryUsage||0).toFixed(0)+' MB';$('render').textContent=pct(s.renderSkippedFrames,s.renderTotalFrames);$('encode').textContent=pct(s.outputSkippedFrames,s.outputTotalFrames);$('output').textContent=o.outputActive?'Active':'Stopped';$('time').textContent=o.outputTimecode||'00:00:00';$('live').textContent=o.outputActive?'● LIVE':'○ STANDBY'}catch(e){showError(e)}}
async function refreshPlatforms(){try{const d=await fetch(`/api/platforms?${new URLSearchParams({twitchChannel:settings.twitchChannel,youtubeChannelId:settings.youtubeChannelId})}`,{cache:'no-store'}).then(r=>r.json());for(const[p,x]of Object.entries(d)){const q=p==='twitch'?'tw':'yt';$(q+'-state').textContent=x.configured?(x.live?'Live':'Offline'):'Not configured';$(q+'-viewers').textContent=fmt(x.viewers);$(q+'-title').textContent=x.title||x.error||'';p==='twitch'?$('tw-followers').textContent=fmt(x.followers):$('yt-subs').textContent=fmt(x.subscribers)}$('yt-mode').textContent=d.youtube.selectedEvent?.scheduledStartTime?`Selected event: ${new Date(d.youtube.selectedEvent.scheduledStartTime).toLocaleString()}`:'No event selected';$('total').textContent=fmt((d.twitch.viewers||0)+(d.youtube.viewers||0));updateCharts(d)}catch(e){showError(e)}}
function schedule(){clearInterval(timer);timer=setInterval(()=>{refreshObs();refreshPlatforms()},Math.max(5,settings.poll)*1000)}
$('settings').onclick=()=>{$('twitch-channel').value=settings.twitchChannel;$('youtube-channel-id').value=settings.youtubeChannelId;$('url').value=settings.url;$('password').value=settings.password;$('poll').value=settings.poll;$('modal').showModal()};$('close').onclick=()=>$('modal').close();$('clear').onclick=()=>{localStorage.removeItem('scc');settings={url:'ws://127.0.0.1:4455',password:'',poll:10,twitchChannel:'',youtubeChannelId:''};$('modal').close();connect()};$('form').onsubmit=(e)=>{e.preventDefault();settings={url:$('url').value.trim(),password:$('password').value,poll:Number($('poll').value),twitchChannel:$('twitch-channel').value.trim(),youtubeChannelId:$('youtube-channel-id').value.trim()};localStorage.setItem('scc',JSON.stringify(settings));$('modal').close();connect();schedule()};$('refresh').onclick=()=>{refreshObs();refreshPlatforms()};
$('find-youtube-event').onclick=async()=>{
  const button=$('find-youtube-event');
  button.disabled=true;
  button.textContent='Searching...';
  try{
    const response=await fetch(`/api/youtube/select-upcoming?${new URLSearchParams({youtubeChannelId:settings.youtubeChannelId})}`,{method:'POST'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'YouTube event search failed');
    const start=result.selection.scheduledStartTime?new Date(result.selection.scheduledStartTime).toLocaleString():'time unavailable';
    $('yt-mode').textContent=`Selected: ${result.selection.title} (${start})`;
    await refreshPlatforms();
  }catch(error){showError(error)}finally{
    button.disabled=false;
    button.textContent='Find next YouTube event';
  }
};
connect();refreshPlatforms();schedule();
