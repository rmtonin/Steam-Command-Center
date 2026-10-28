/** Stream Command Center server. No third-party Node packages required. */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 6767);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.DATA_DIRECTORY || path.join(ROOT, "data");
const SELECTION_FILE = path.join(DATA_DIR, "youtube-selection.json");
const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8" };
const twitchToken = { value:"", expiresAt:0 };

function sendJson(res,status,data){res.writeHead(status,{"Content-Type":MIME[".json"],"Cache-Control":"no-store"});res.end(JSON.stringify(data));}
function sendText(res,status,text){res.writeHead(status,{"Content-Type":"text/plain; charset=utf-8"});res.end(text);}
async function fetchJson(url,options={}){const response=await fetch(url,options);const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error?.message||`HTTP ${response.status}`);return body;}
function readSelection(){try{return JSON.parse(fs.readFileSync(SELECTION_FILE,"utf8"));}catch{return {videoId:"",title:"",scheduledStartTime:""};}}
function saveSelection(value){fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(SELECTION_FILE,JSON.stringify(value,null,2));}

async function getTwitchToken(){
  if(twitchToken.value && Date.now()<twitchToken.expiresAt-60000)return twitchToken.value;
  const query=new URLSearchParams({client_id:process.env.TWITCH_CLIENT_ID,client_secret:process.env.TWITCH_CLIENT_SECRET,grant_type:"client_credentials"});
  const data=await fetchJson(`https://id.twitch.tv/oauth2/token?${query}`,{method:"POST"});
  twitchToken.value=data.access_token;twitchToken.expiresAt=Date.now()+data.expires_in*1000;return twitchToken.value;
}
async function twitchMetrics(channel){
  const clientId=process.env.TWITCH_CLIENT_ID,secret=process.env.TWITCH_CLIENT_SECRET;
  if(!clientId||!secret||!channel)return {configured:false,live:false};
  const token=await getTwitchToken();const headers={"Client-Id":clientId,Authorization:`Bearer ${token}`};
  const api=(url)=>fetchJson(url,{headers});
  const user=await api(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`);const id=user.data?.[0]?.id;
  if(!id)throw new Error("Twitch channel not found");
  const [stream,followers]=await Promise.all([api(`https://api.twitch.tv/helix/streams?user_id=${id}`),api(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${id}`)]);const live=stream.data?.[0];
  return {configured:true,live:Boolean(live),viewers:live?.viewer_count||0,followers:followers.total||0,title:live?.title||""};
}
async function channelSubscribers(apiKey,channelId){if(!channelId)return 0;const q=new URLSearchParams({part:"statistics",id:channelId,key:apiKey});const data=await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${q}`);return Number(data.items?.[0]?.statistics?.subscriberCount||0);}
async function youtubeMetrics(channelId){
  const apiKey=process.env.YOUTUBE_API_KEY;if(!apiKey||!channelId)return {configured:false,live:false};
  const subscribers=await channelSubscribers(apiKey,channelId);const selection=readSelection();
  if(!selection.videoId)return {configured:true,live:false,viewers:0,subscribers,title:"",selectedEvent:null};
  const q=new URLSearchParams({part:"snippet,liveStreamingDetails",id:selection.videoId,key:apiKey});const data=await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${q}`);const video=data.items?.[0],live=video?.liveStreamingDetails||{};
  return {configured:true,live:Boolean(live.actualStartTime&&!live.actualEndTime),viewers:Number(live.concurrentViewers||0),subscribers,title:video?.snippet?.title||selection.title,selectedEvent:{videoId:selection.videoId,scheduledStartTime:live.scheduledStartTime||selection.scheduledStartTime}};
}
async function selectUpcoming(channelId){
  const apiKey=process.env.YOUTUBE_API_KEY;if(!apiKey||!channelId)throw new Error("YouTube API key and channel ID are required");
  const q=new URLSearchParams({part:"snippet",channelId,eventType:"upcoming",type:"video",order:"date",maxResults:"10",key:apiKey});const data=await fetchJson(`https://www.googleapis.com/youtube/v3/search?${q}`);
  if(!data.items?.length)throw new Error("No public upcoming event found");
  const ids=data.items.map(x=>x.id?.videoId).filter(Boolean);const detailsQ=new URLSearchParams({part:"snippet,liveStreamingDetails",id:ids.join(","),key:apiKey});const details=await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${detailsQ}`);
  const events=details.items.map(x=>({videoId:x.id,title:x.snippet?.title||"",scheduledStartTime:x.liveStreamingDetails?.scheduledStartTime||""})).filter(x=>x.scheduledStartTime).sort((a,b)=>new Date(a.scheduledStartTime)-new Date(b.scheduledStartTime));
  if(!events.length)throw new Error("No scheduled public event found");saveSelection(events[0]);return events[0];
}
function normalized(result,name){return result.status==="fulfilled"?result.value:{configured:true,live:false,error:`${name}: ${result.reason.message}`};}
function fileFor(url){const parsed=new URL(url,"http://localhost"),pathname=decodeURIComponent(parsed.pathname),relative=pathname==="/"?"index.html":pathname.slice(1),file=path.resolve(PUBLIC_DIR,relative);return file.startsWith(`${PUBLIC_DIR}${path.sep}`)?file:null;}
function serve(url,res){const file=fileFor(url);if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile())return sendText(res,404,"Not found");res.writeHead(200,{"Content-Type":MIME[path.extname(file)]||"application/octet-stream"});const stream=fs.createReadStream(file);stream.on("error",e=>res.destroy(e));stream.pipe(res);}
http.createServer(async(req,res)=>{try{const url=new URL(req.url,"http://localhost");if(req.method==="GET"&&url.pathname==="/api/platforms"){const results=await Promise.allSettled([twitchMetrics(url.searchParams.get("twitchChannel")?.trim()||""),youtubeMetrics(url.searchParams.get("youtubeChannelId")?.trim()||"")]);return sendJson(res,200,{twitch:normalized(results[0],"Twitch"),youtube:normalized(results[1],"YouTube")});}if(req.method==="POST"&&url.pathname==="/api/youtube/select-upcoming"){try{return sendJson(res,200,{ok:true,selection:await selectUpcoming(url.searchParams.get("youtubeChannelId")?.trim()||"")});}catch(error){return sendJson(res,400,{ok:false,error:error.message});}}serve(req.url,res);}catch(error){console.error(error);if(!res.headersSent)sendJson(res,500,{error:"Internal server error"});else res.destroy(error);}}).listen(PORT,"0.0.0.0",()=>console.log(`Stream Command Center v1.0 listening on ${PORT}`));
