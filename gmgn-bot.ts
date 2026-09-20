import "dotenv/config";
import axios from "axios";
import { spawn } from "node:child_process";

const E=(k:string,d="")=>process.env[k]??d, N=(k:string,d:number)=>Number(E(k,String(d)));
const C={chain:E("GMGN_CHAIN","sol"),interval:N("SCAN_INTERVAL_MS",15000),dry:E("LIVE_TRADING","false").toLowerCase()!=="true",wallet:E("GMGN_WALLET_ADDRESS"),input:E("GMGN_INPUT_TOKEN","So11111111111111111111111111111111111111112"),buy:E("GMGN_BUY_AMOUNT","10000000"),slip:N("GMGN_SLIPPAGE",20),liq:N("MIN_LIQUIDITY_USD",10000),vol:N("MIN_VOLUME_USD",25000),top10:N("MAX_TOP10_PCT",35),dev:N("MAX_DEV_PCT",10),sm:N("MIN_SMART_MONEY",1),age:N("MAX_CREATED_MINUTES",60),tg:E("TELEGRAM_BOT_TOKEN"),chat:E("TELEGRAM_CHAT_ID")};
if(!C.tg) throw new Error("TELEGRAM_BOT_TOKEN is required");
const tg=axios.create({baseURL:`https://api.telegram.org/bot${C.tg}`,timeout:15000});
const send=async(text:string)=>{if(C.chat) await tg.post("/sendMessage",{chat_id:C.chat,text,parse_mode:"HTML",disable_web_page_preview:true})};
function gmgn(args:string[]):Promise<any>{return new Promise((ok,bad)=>{const p=spawn("gmgn-cli",[...args,"--raw"],{env:process.env});let o="",e="";p.stdout.on("data",d=>o+=d);p.stderr.on("data",d=>e+=d);p.on("error",bad);p.on("close",c=>{if(c!==0)return bad(new Error(e||`gmgn-cli exited ${c}`));try{ok(JSON.parse(o))}catch{bad(new Error("Invalid GMGN JSON: "+o.slice(0,300)))}})})}
const arr=(x:any):any[]=>Array.isArray(x)?x:(Array.isArray(x?.data)?x.data:Array.isArray(x?.data?.list)?x.data.list:Array.isArray(x?.list)?x.list:Array.isArray(x?.tokens)?x.tokens:[]);
const n=(o:any,ks:string[])=>{for(const k of ks){const v=Number(o?.[k]);if(Number.isFinite(v))return v}return 0};
const pass=(t:any)=>{const l=n(t,["liquidity","liquidity_usd","liquidityUsd"]),v=n(t,["volume_24h","volume_24h_usd","volume_usd","volume"]),h=n(t,["top_10_holder_rate","top10","top_10"]),d=n(t,["dev_holding_percent","dev_pct","dev_holding"]),s=n(t,["smart_degen_count","smart_money_count","smart_money"]),a=n(t,["created_minutes","age_minutes"]);return(!l||l>=C.liq)&&(!v||v>=C.vol)&&(!h||h<=C.top10)&&(!d||d<=C.dev)&&(!s||s>=C.sm)&&(!a||a<=C.age)};
async function scan(){const x=await gmgn(["market","trending","--chain",C.chain,"--interval","1h","--order-by","volume","--limit","30","--filter","not_risk","--filter","not_honeypot"]);return arr(x).filter(pass).slice(0,5)}
const esc=(s:string)=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
async function swap(input:string,out:string,value:string,side:"buy"|"sell"){if(C.dry)return{dry_run:true,side,input,out,value};if(!C.wallet)throw new Error("GMGN_WALLET_ADDRESS is required");const a=["swap","--chain",C.chain,"--from",C.wallet,"--input-token",input,"--output-token",out,"--slippage",String(C.slip),side==="buy"?"--amount":"--percent",value,"--yes"];return gmgn(a)}
async function command(chat:string,text:string){if(C.chat&&chat!==C.chat)return;const [cmd,...p]=text.trim().split(/\s+/);try{
if(cmd==="/start"||cmd==="/help")return send("<b>GMGN Trading Bot</b>\n/status\n/scan\n/token &lt;address&gt;\n/buy &lt;address&gt; &lt;amount&gt;\n/sell &lt;address&gt; &lt;percent&gt;");
if(cmd==="/status")return send(`<b>Status</b>\nChain: ${C.chain}\nMode: ${C.dry?"PAPER":"LIVE"}\nScan: ${C.interval/1000}s\nWallet: ${C.wallet?C.wallet.slice(0,8)+"…":"not set"}`);
if(cmd==="/scan"){const x=await scan();return send(x.length?x.map((t,i)=>`${i+1}. <b>${esc(t.symbol??t.name??"TOKEN")}</b>\n<code>${esc(t.address??t.token_address??t.mint??"unknown")}</code>`).join("\n\n"):"Tidak ada token yang lolos filter.");}
if(cmd==="/token"){if(!p[0])return send("Usage: /token TOKEN_ADDRESS");const x=await gmgn(["token","info","--chain",C.chain,"--address",p[0]]);return send(`<pre>${esc(JSON.stringify(x,null,2).slice(0,3500))}</pre>`)}
if(cmd==="/buy"){if(!p[0])return send("Usage: /buy TOKEN_ADDRESS AMOUNT");const x=await swap(C.input,p[0],p[1]??C.buy,"buy");return send(`<b>BUY ${C.dry?"PAPER":"SUBMITTED"}</b>\n<pre>${esc(JSON.stringify(x,null,2).slice(0,3500))}</pre>`)}
if(cmd==="/sell"){if(!p[0])return send("Usage: /sell TOKEN_ADDRESS PERCENT");const x=await swap(p[0],C.input,p[1]??"100","sell");return send(`<b>SELL ${C.dry?"PAPER":"SUBMITTED"}</b>\n<pre>${esc(JSON.stringify(x,null,2).slice(0,3500))}</pre>`)}
}catch(e){await send("❌ "+esc(String(e).slice(0,1200)))}}
async function poll(){let offset=0;for(;;){try{const r=await tg.get("/getUpdates",{params:{timeout:25,offset}});for(const u of r.data.result??[]){offset=Math.max(offset,u.update_id+1);if(u.message?.text)await command(String(u.message.chat.id),u.message.text)}}catch(e){console.error("Telegram",e);await new Promise(r=>setTimeout(r,3000))}}}
async function alerts(){try{const x=await scan();if(x.length)await send(`<b>GMGN ${C.chain.toUpperCase()}</b> — ${x.length} candidate(s)\nMode: ${C.dry?"PAPER":"LIVE"}`)}catch(e){console.error(e)}}
(async()=>{await send(`🤖 GMGN bot online — ${C.chain.toUpperCase()} — ${C.dry?"PAPER":"LIVE"}`);setInterval(alerts,C.interval);await poll()})().catch(e=>{console.error(e);process.exit(1)});