var hi=Object.defineProperty;var li=(n,e,t)=>e in n?hi(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t;var f=(n,e,t)=>li(n,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))a(o);new MutationObserver(o=>{for(const s of o)if(s.type==="childList")for(const i of s.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&a(i)}).observe(document,{childList:!0,subtree:!0});function t(o){const s={};return o.integrity&&(s.integrity=o.integrity),o.referrerPolicy&&(s.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?s.credentials="include":o.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(o){if(o.ep)return;o.ep=!0;const s=t(o);fetch(o.href,s)}})();const S=1920,V=1080,na=2,di=S,ci=V,ct={high:{backingW:di,backingH:ci,smoothing:"high",cheapGlow:!1},medium:{backingW:1600,backingH:900,smoothing:"medium",cheapGlow:!1},low:{backingW:1280,backingH:720,smoothing:"low",cheapGlow:!0}};function ui(n,e,t,a){const o=ct[n]??ct.high;return Math.min(Math.min(e,na),o.backingW/Math.max(1,t),o.backingH/Math.max(1,a))}function fi(n,e){const t=(ct[n]??ct.high).smoothing;return e<S&&t==="high"?"medium":t}const q=880,pi=820,gi=1024;function mi(){var s,i;if(typeof window>"u")return!1;const n=new URLSearchParams(window.location.search);if(n.has("mobile"))return n.get("mobile")!=="0";if(n.has("nomobile"))return!1;const e=(navigator.maxTouchPoints??0)>0||((s=window.matchMedia)==null?void 0:s.call(window,"(any-pointer: coarse)").matches)===!0||((i=window.matchMedia)==null?void 0:i.call(window,"(pointer: coarse)").matches)===!0;if(window.innerWidth>gi||Math.min(window.innerWidth,window.innerHeight)>pi)return!1;const a=window.innerHeight>window.innerWidth&&window.innerWidth<=600,o=window.innerWidth<=900&&window.innerHeight<=480;return e||a||o}class bi{constructor(e,t=!1){f(this,"canvas");f(this,"ctx");f(this,"scale",1);f(this,"mobile");f(this,"sceneOnly",!1);f(this,"titleCover",!1);f(this,"cropX",0);f(this,"cssW",0);f(this,"stageW",0);f(this,"covering",!1);f(this,"_quality","high");f(this,"resizeTimer",null);f(this,"resizeDirty",!1);f(this,"dprQuery",null);f(this,"onDprChange",()=>{this.resizeSoon(),this.watchDpr()});f(this,"peekUntil",0);this.canvas=e,this.mobile=t;const a=e.getContext("2d",{alpha:!1});if(!a)throw new Error("2D canvas unavailable");this.ctx=a,this.resize(),this.watchDpr()}get quality(){return this._quality}get cheapGlow(){return ct[this._quality].cheapGlow}setQuality(e){!ct[e]||e===this._quality||(this._quality=e,this.resize())}resizeSoon(e=120){if(this.resizeTimer!==null){this.resizeDirty=!0;return}this.resize();const t=()=>{this.resizeTimer=null,this.resizeDirty&&(this.resizeDirty=!1,this.resize(),this.resizeTimer=window.setTimeout(t,e))};this.resizeTimer=window.setTimeout(t,e)}watchDpr(){var e,t,a,o;typeof window>"u"||typeof window.matchMedia!="function"||((t=(e=this.dprQuery)==null?void 0:e.removeEventListener)==null||t.call(e,"change",this.onDprChange),this.dprQuery=window.matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`),(o=(a=this.dprQuery).addEventListener)==null||o.call(a,"change",this.onDprChange,{once:!0}))}get logicalHeight(){return this.mobile&&this.sceneOnly?q:V}setSceneOnly(e){!this.mobile||this.sceneOnly===e||(this.sceneOnly=e,this.resize())}coverMode(){return!this.mobile||typeof window>"u"||window.innerWidth>window.innerHeight?null:this.sceneOnly?"scene":this.titleCover?"title":null}setTitleCover(e){!this.mobile||this.titleCover===e||(this.titleCover=e,this.resize())}get visible(){return!this.covering||this.scale<=0?{x:0,w:S}:{x:this.cropX/this.scale,w:Math.min(S,this.stageW/this.scale)}}panTo(e,t,a=!1){if(!this.covering)return;const o=Math.max(0,this.cssW-this.stageW);if(a&&(this.peekUntil=0),!a&&performance.now()<this.peekUntil){this.applyCrop();return}const s=Math.max(0,Math.min(o,e*this.scale-this.stageW/2));a||Math.abs(s-this.cropX)<.4?this.cropX=s:this.cropX+=(s-this.cropX)*Math.min(1,t*9),this.applyCrop()}dragCrop(e){this.covering&&(this.cropX=Math.max(0,Math.min(Math.max(0,this.cssW-this.stageW),this.cropX-e)),this.peekUntil=performance.now()+3200,this.applyCrop())}applyCrop(){const e=Math.min(window.devicePixelRatio||1,na),t=this.covering?Math.round(this.cropX*e)/e:0,a=t>0?`translate3d(${-t}px,0,0)`:"";this.canvas.style.transform!==a&&(this.canvas.style.transform=a)}resize(){const e=Math.min(window.devicePixelRatio||1,na),t=this.canvas.parentElement,a=(t==null?void 0:t.clientWidth)||window.innerWidth,o=(t==null?void 0:t.clientHeight)||window.innerHeight,s=this.logicalHeight,i=this.coverMode();let r=Math.min(a/S,o/s);i==="scene"?r=Math.max(a/S,o/s):i==="title"&&(r=Math.max(a/S,Math.min(o/s,a/640))),this.scale=r,this.covering=i!==null,typeof document<"u"&&document.body.classList.toggle("m-cover",this.covering);const h=Math.floor(S*r),l=Math.floor(s*r);this.canvas.style.width=`${h}px`,this.canvas.style.height=`${l}px`;const u=ui(this._quality,e,h,l);this.canvas.width=Math.max(1,Math.round(h*u)),this.canvas.height=Math.max(1,Math.round(l*u)),this.ctx.setTransform(this.canvas.width/S,0,0,this.canvas.height/s,0,0),this.ctx.imageSmoothingEnabled=!0,this.ctx.imageSmoothingQuality=fi(this._quality,this.canvas.width),this.cssW=h,this.stageW=a,this.cropX=Math.max(0,Math.min(Math.max(0,h-a),this.cropX)),this.applyCrop()}toLogical(e,t){const a=this.canvas.getBoundingClientRect();return{x:(e-a.left)/a.width*S,y:(t-a.top)/a.height*this.logicalHeight}}}const wi=500,yi=14;class ki{constructor(e){f(this,"x",0);f(this,"y",0);f(this,"lastKind","mouse");f(this,"handlers",{down:[],move:[]});f(this,"pans",[]);f(this,"keys",[]);f(this,"keysUp",[]);f(this,"touching",!1);const t=(c,p,g,m,b)=>{const y=e.toLogical(p,g);this.x=y.x,this.y=y.y,c.forEach(_=>_(y.x,y.y,m,b))};window.addEventListener("mousemove",c=>{this.touching||(this.lastKind="mouse",t(this.handlers.move,c.clientX,c.clientY,c.button,{clicks:0,kind:"mouse"}))}),e.canvas.addEventListener("mousedown",c=>{this.touching||(c.preventDefault(),e.canvas.focus({preventScroll:!0}),this.lastKind="mouse",t(this.handlers.down,c.clientX,c.clientY,c.button,{clicks:Math.max(1,c.detail||1),kind:"mouse"}))});let a=null;const o=()=>{a&&window.clearTimeout(a.timer),a=null};let s=0;const i=()=>{s&&window.clearTimeout(s),s=0},r=()=>{i(),s=window.setTimeout(()=>{s=0,this.touching=!1},400)},h=(c,p)=>{var _;const g=e.canvas.getBoundingClientRect(),m=(_=e.canvas.parentElement)==null?void 0:_.getBoundingClientRect(),b=m?Math.max(g.left,m.left):g.left,y=m?Math.min(g.right,m.right):g.right;return c>=b&&c<=y&&p>=g.top&&p<=g.bottom};e.canvas.addEventListener("pointerdown",c=>{if(c.pointerType==="mouse")return;c.preventDefault(),e.canvas.focus({preventScroll:!0}),o(),i(),this.touching=!0;const p=c.pointerType==="pen"?"pen":"touch";this.lastKind=p;try{e.canvas.setPointerCapture(c.pointerId)}catch{}const g={id:c.pointerId,x:c.clientX,y:c.clientY,kind:p,long:!1,timer:0};g.timer=window.setTimeout(()=>{if(!(a!==g||g.long)){if(g.long=!0,g.timer=0,navigator.vibrate)try{navigator.vibrate(12)}catch{}t(this.handlers.move,g.x,g.y,0,{clicks:0,kind:p}),t(this.handlers.down,g.x,g.y,2,{clicks:1,kind:p})}},wi),a=g});let l=null;window.addEventListener("pointermove",c=>{if(l&&c.pointerId===l.id){const p=c.clientX-l.x;l.x=c.clientX,p!==0&&this.pans.forEach(g=>g(p));return}!a||c.pointerId!==a.id||Math.hypot(c.clientX-a.x,c.clientY-a.y)>yi&&(a.kind==="touch"&&!a.long&&(l={id:a.id,x:c.clientX}),o())});const u=c=>{l&&c.pointerId===l.id&&(l=null,r())};window.addEventListener("pointerup",u),window.addEventListener("pointercancel",u),window.addEventListener("pointerup",c=>{if(c.pointerType==="mouse"||!a||c.pointerId!==a.id)return;const p=a;o(),r(),!(p.long||!h(c.clientX,c.clientY))&&(t(this.handlers.move,p.x,p.y,0,{clicks:0,kind:p.kind}),t(this.handlers.down,p.x,p.y,0,{clicks:1,kind:p.kind}))}),window.addEventListener("pointercancel",c=>{c.pointerType!=="mouse"&&a&&c.pointerId===a.id&&(o(),i(),this.touching=!1)});const d=()=>{o(),i(),this.touching=!1};window.addEventListener("blur",d),document.addEventListener("visibilitychange",()=>{document.hidden&&d()}),window.addEventListener("contextmenu",d),e.canvas.addEventListener("contextmenu",c=>c.preventDefault()),window.addEventListener("keydown",c=>{this.keys.forEach(p=>p(c.key,c))}),window.addEventListener("keyup",c=>{this.keysUp.forEach(p=>p(c.key,c))}),window.addEventListener("blur",()=>this.keysUp.forEach(c=>c("",null)))}onDown(e){this.handlers.down.push(e)}onMove(e){this.handlers.move.push(e)}onPan(e){this.pans.push(e)}onKey(e){this.keys.push(e)}onKeyUp(e){this.keysUp.push(e)}}const vi=4,Aa=3,Ue={stallMs:15e3,directMs:3e4,retryDelayMs:260,retryAgainMs:6e3},Ea=3,Ca=160*1024*1024;class _i{constructor(){f(this,"images",new Map);f(this,"audio",new Map);f(this,"retained",new Set);f(this,"jobs",new Map);f(this,"queue",[]);f(this,"running",0);f(this,"sheetFrames",new Map);f(this,"failed",new Set);f(this,"catalog",new Map);f(this,"fallback",null);f(this,"fallbackKeys",new Set);f(this,"failedAt",new Map);f(this,"onlineHooked",!1);f(this,"audioTries",new Map);f(this,"audioUrls",new Map);f(this,"audioGaveUp",new Set);f(this,"audioGaveUpAt",0);f(this,"audioNoticed",!1);f(this,"onNotice",null);f(this,"boundsCache",new Map)}retain(e){this.retained=new Set(e),this.evict()}evict(){let e=0;for(const t of this.images.values())e+=t.width*t.height*4;if(!(e<=Ca))for(const t of[...this.images.keys()]){if(e<=Ca)break;if(this.retained.has(t)||t.startsWith("char_")||t==="bg_title")continue;const a=this.images.get(t);a&&(e-=a.width*a.height*4,this.images.delete(t))}}setCatalog(e){for(const[t,a]of Object.entries(e))this.catalog.set(t,a)}hasFailed(e){for(const t of e)if(this.failed.has(t))return!0;return!1}async load(e,t,a={}){for(const[d,c]of Object.entries(a.frames??{}))this.sheetFrames.set(d,c);this.setCatalog(e.images);const o=a.eagerAudio?new Set(a.eagerAudio):null;for(const[d,c]of Object.entries(e.audio)){if(this.audio.has(d))continue;const p=new Audio;p.preload=!o||o.has(d)?"auto":"metadata",p.src=c,this.audioUrls.set(d,c),p.addEventListener("error",()=>this.audioFailed(d,p)),this.audio.set(d,p)}this.hookOnline();const s=Object.keys(e.images),i=[...(a.priority??[]).filter(d=>d in e.images),...s],r=new Set,h=[];let l=0;const u=s.length;u===0&&t(1);for(const d of i){if(r.has(d))continue;r.add(d);const c=this.enqueue(d,e.images[d]);h.push(c.done.then(()=>{l++,t(Math.min(1,l/u))}))}this.pump(),await Promise.all(h)}async ensure(e,t){const a=[...new Set(e)].filter(i=>this.catalog.has(i));if(this.retryFailed(a,Ue.retryAgainMs),this.retryAudio(Ue.retryAgainMs),!a.length){t==null||t(1);return}let o=0;const s=a.map(i=>this.enqueue(i,this.catalog.get(i)).done.then(()=>{o++,t==null||t(Math.min(1,o/a.length))}));this.pump(),await Promise.all(s)}ready(e){const t=[];for(const a of e){const o=this.jobs.get(a);o&&(this.bump(a),t.push(o.done))}return this.pump(),Promise.all(t).then(()=>{})}isReady(e){return this.images.has(e)||!this.jobs.has(e)||this.failed.has(e)}prioritize(e){for(const t of[...e].reverse())this.bump(t)}img(e){const t=this.images.get(e);return!t&&this.queue.length&&this.bump(e),t}enqueue(e,t){const a=this.jobs.get(e);if(a)return a;if(this.images.has(e)&&!this.fallbackKeys.has(e)||this.failed.has(e)){let r;const h=new Promise(l=>{r=l});return r(),{key:e,url:t,done:h,resolve:r}}let o;const s=new Promise(r=>{o=r}),i={key:e,url:t,done:s,resolve:o};return this.jobs.set(e,i),this.queue.push(i),i}bump(e){const t=this.queue.findIndex(o=>o.key===e);if(t<=0)return;const[a]=this.queue.splice(t,1);this.queue.unshift(a)}pump(){for(;this.running<vi&&this.queue.length;){const e=this.queue.shift();this.running++,this.fetchImage(e).finally(()=>{this.running--,e.resolve(),this.pump()})}}async fetchImage(e){for(let t=1;t<=Aa;t++){const a=t===1?e.url:_n(e.url,t),o=await Ii(a);if(o){try{await o.decode()}catch{}if(!e.key.startsWith("bg_")){const s=this.sheetFrames.get(e.key);await this.measure(e.key,o,s&&s>1?[1,s]:[1])}this.images.set(e.key,o),this.fallbackKeys.delete(e.key),this.failed.delete(e.key),this.failedAt.delete(e.key);return}t<Aa&&await Mi(Ue.retryDelayMs*t)}if(console.warn("image failed after retries:",e.key,e.url),this.failed.add(e.key),this.failedAt.set(e.key,ut()),e.key.startsWith("bg_")&&!this.images.has(e.key)){const t=await this.fallbackImage();t&&!this.images.has(e.key)&&(this.images.set(e.key,t),this.fallbackKeys.add(e.key))}}async giveUp(e){const t=[...e].filter(o=>o.startsWith("bg_")&&!this.images.has(o));if(!t.length)return;const a=await this.fallbackImage();if(a)for(const o of t)this.images.has(o)||(this.images.set(o,a),this.fallbackKeys.add(o))}retryFailed(e,t=0){const a=[];for(const o of e?[...e]:[...this.failed])!this.failed.has(o)||!this.catalog.has(o)||ut()-(this.failedAt.get(o)??-1/0)<t||(this.failed.delete(o),this.jobs.delete(o),a.push(o));for(const o of a)this.enqueue(o,this.catalog.get(o));a.length&&this.pump()}audioFailed(e,t){var s;const a=this.audioUrls.get(e)??t.src,o=(this.audioTries.get(e)??0)+1;if(this.audioTries.set(e,o),o<Ea){setTimeout(()=>{t.src=_n(a,o+1),t.load()},Ue.retryDelayMs*o*4);return}console.warn("audio failed after retries:",e,a),this.audioGaveUp.add(e),this.audioGaveUpAt=ut(),this.audioNoticed||(this.audioNoticed=!0,(s=this.onNotice)==null||s.call(this,"The music could not be loaded. The voyage goes on without it; it will try again when the connection settles."))}retryAudio(e=0){if(!(!this.audioGaveUp.size||ut()-this.audioGaveUpAt<e)){for(const t of[...this.audioGaveUp]){const a=this.audio.get(t),o=this.audioUrls.get(t);!a||!o||(this.audioGaveUp.delete(t),this.audioTries.set(t,Ea-1),a.src=_n(o,9),a.load())}this.audioGaveUpAt=ut()}}hookOnline(){this.onlineHooked||typeof window>"u"||typeof window.addEventListener!="function"||(this.onlineHooked=!0,window.addEventListener("online",()=>{this.retryFailed(),this.retryAudio()}))}fallbackImage(){return this.fallback||(this.fallback=new Promise(e=>{const t=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="880" viewBox="0 0 1920 880">
          <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0a1420"/><stop offset="0.62" stop-color="#122536"/><stop offset="1" stop-color="#071018"/>
          </linearGradient><radialGradient id="g" cx="0.5" cy="0.3" r="0.7">
            <stop offset="0" stop-color="#28435a" stop-opacity="0.5"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
          </radialGradient></defs>
          <rect width="1920" height="880" fill="url(#f)"/><rect width="1920" height="880" fill="url(#g)"/>
        </svg>`,a=new Image;a.decoding="async",a.onload=()=>e(a),a.onerror=()=>e(null),a.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(t)}`})),this.fallback}async measure(e,t,a){await Ti();const o=Ha(t);if(o)for(const s of a){const i=`${e}#${s}`;this.boundsCache.has(i)||this.boundsCache.set(i,Na(o,t.width,t.height,s))}}frameBounds(e,t=1){const a=`${e}#${t}`,o=this.boundsCache.get(a);if(o)return o;const s=this.images.get(e);if(!s||!s.width)return;const i=Ha(s);if(!i)return;const r=Na(i,s.width,s.height,t);return this.boundsCache.set(a,r),r}}function Ha(n){const e=Math.max(1,Math.floor(Math.max(n.width,n.height)/768)),t=Math.ceil(n.width/e),a=Math.ceil(n.height/e);try{const o=document.createElement("canvas");o.width=t,o.height=a;const s=o.getContext("2d",{willReadFrequently:!0});return s.drawImage(n,0,0,t,a),{w:t,h:a,step:e,data:s.getImageData(0,0,t,a).data}}catch{return}}function Ti(){return new Promise(n=>{typeof requestIdleCallback=="function"?requestIdleCallback(()=>n(),{timeout:200}):setTimeout(n,0)})}function Na(n,e,t,a){const{w:o,h:s,step:i,data:r}=n,h=(d,c)=>r[(c*o+d)*4+3]>=96,l=[],u=o/a;for(let d=0;d<a;d++){const c=Math.round(d*u),p=Math.round((d+1)*u);let g=s,m=-1,b=p,y=-1;for(let C=0;C<s;C++)for(let D=c;D<p;D++)h(D,C)&&(C<g&&(g=C),C>m&&(m=C),D<b&&(b=D),D>y&&(y=D));if(m<0){const C=e/a;l.push({top:0,bottom:t,left:d*C,right:(d+1)*C,torso:(d+.5)*C});continue}let _=y,x=b;const T=g+Math.floor((m-g)*.15),N=g+Math.floor((m-g)*.45);for(let C=T;C<=N;C++)for(let D=b;D<=y;D++)h(D,C)&&(D<_&&(_=D),D>x&&(x=D));l.push({top:g*i,bottom:Math.min(t,(m+1)*i),left:b*i,right:Math.min(e,(y+1)*i),torso:x>=_?(_+x+1)/2*i:(b+y+1)/2*i})}return l}function ut(){return typeof performance<"u"?performance.now():Date.now()}async function Ii(n){if(typeof fetch=="function"&&!n.startsWith("data:")&&!n.startsWith("blob:")){const e=await Si(n);if(e===null)return null;if(e){const t=URL.createObjectURL(e),a=await La(t,Ue.directMs);return URL.revokeObjectURL(t),a}}return La(n,Ue.directMs)}async function Si(n){var s,i;const e=typeof AbortController=="function"?new AbortController:null;let t,a=!1;const o=()=>{clearTimeout(t),t=setTimeout(()=>{a=!0,e==null||e.abort()},Ue.stallMs)};try{o();const r=await fetch(n,e?{signal:e.signal}:void 0);if(!r.ok)return null;const h=r.headers.get("content-type")??"",l=(i=(s=r.body)==null?void 0:s.getReader)==null?void 0:i.call(s);if(!l)return await r.blob();const u=[];for(;;){const{done:d,value:c}=await l.read();if(d)break;c&&u.push(c),o()}return new Blob(u,{type:h})}catch{return a?null:void 0}finally{clearTimeout(t)}}function La(n,e){return new Promise(t=>{const a=new Image;a.decoding="async";let o=!1;const s=r=>{o||(o=!0,clearTimeout(i),a.onload=null,a.onerror=null,t(r))},i=setTimeout(()=>s(null),e);a.onload=()=>s(a),a.onerror=()=>s(null),a.src=n})}function _n(n,e){if(n.startsWith("data:")||n.startsWith("blob:"))return n;const t=n.includes("?")?"&":"?";return`${n}${t}retry=${e}`}function Mi(n){return new Promise(e=>setTimeout(e,n))}function $a(n){let e=n>>>0;return()=>{e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}function Da(n,e,t){const a=2*Math.PI*Math.min(e.f,t*.45)/t,o=Math.cos(a),s=Math.sin(a)/(2*(e.q??Math.SQRT1_2));let i,r,h;e.type==="lowpass"?(i=(1-o)/2,r=1-o,h=i):e.type==="highpass"?(i=(1+o)/2,r=-(1+o),h=i):(i=s,r=0,h=-s);const l=1+s,u=-2*o,d=1-s;let c=0,p=0,g=0,m=0;for(let b=0;b<n.length;b++){const y=n[b],_=(i*y+r*c+h*p-u*g-d*m)/l;p=c,c=y,m=g,g=_,n[b]=_}return n}function ls(n){let e=0;for(let t=0;t<n.length;t++){const a=Math.abs(n[t]);a>e&&(e=a)}return e}const ds=.001;function cs(n){return(n.at??0)+(n.attack??ds)+(n.hold??0)+n.decay*6}function xi(n,e,t,a){const o=Math.floor((e.at??0)*t),s=Math.min(n.length-o,Math.ceil((cs(e)-(e.at??0))*t));if(s<=0)return;let i=new Float32Array(s);const r=e.f??440,h=e.f2??r,l=Math.exp(-1/(t*(e.glide??Math.max(.001,e.decay/2))));let u=1;if(e.src==="noise")for(let y=0;y<s;y++)i[y]=a()*2-1;else if(e.src==="grains"){const y=(e.density??1e3)/t;for(let _=0;_<s;_++)i[_]=a()<y?a()*2-1:0}else if(e.src==="pulses"){const y=e.jitter??0;let _=0,x=1;for(let T=0;T<s;T++)_+=(h+(r-h)*u)*x/t,u*=l,_>=1&&(_-=1,x=1+y*(a()-.5),i[T]=1-y*.5+y*a())}else{let y=0;for(let _=0;_<s;_++)i[_]=Math.sin(y),y+=2*Math.PI*(h+(r-h)*u)/t,u*=l}if(e.filter){const y=Array.isArray(e.filter)?e.filter:[e.filter];if(y.length===1)Da(i,y[0],t);else{const _=new Float32Array(s);for(const x of y){const T=Da(Float32Array.from(i),x,t),N=x.gain??1;for(let C=0;C<s;C++)_[C]+=T[C]*N}i=_}}const d=e.src==="sine"?1:1/(ls(i)||1),c=Math.max(1,Math.round((e.attack??ds)*t)),p=Math.round((e.hold??0)*t),g=Math.exp(-1/Math.max(1e-6,e.decay*t)),m=d*e.amp;let b=1;for(let y=0;y<s;y++){let _=1;y<c?_=y/c:y>=c+p&&(_=b,b*=g),n[o+y]+=i[y]*m*_}}function Ai(n,e,t){const a=n.reduce((r,h)=>Math.max(r,cs(h)),0),o=new Float32Array(Math.max(1,Math.ceil(a*e)));for(const r of n)xi(o,r,e,t);const s=ls(o);if(s>0)for(let r=0;r<o.length;r++)o[r]/=s;const i=Math.min(o.length,Math.round(e*.003));for(let r=0;r<i;r++)o[o.length-1-r]*=r/i;return o}function Ra(n,e,t){const a=$a(t*7919+17);return Ai(n(a),e,$a(t*104729+3))}const H=(n,e,t)=>e+(t-e)*n(),Ke={wood:{gain:.026,design:n=>[{src:"sine",f:H(n,140,165),f2:90,glide:.015,attack:.002,decay:.02,amp:.4},{src:"noise",filter:{type:"bandpass",f:H(n,480,560),q:1.6},attack:.0015,decay:.024,amp:1},{src:"noise",filter:{type:"highpass",f:2800},attack:3e-4,decay:.003,amp:.4},{src:"noise",filter:{type:"bandpass",f:750,q:1.4},at:H(n,.05,.062),attack:.002,decay:.014,amp:.45}]},deck:{gain:.023,design:n=>[{src:"sine",f:H(n,105,125),f2:66,glide:.02,attack:.003,decay:.032,amp:.5},{src:"noise",filter:{type:"bandpass",f:H(n,320,380),q:1.4},attack:.002,decay:.03,amp:1},{src:"noise",filter:{type:"highpass",f:2200},attack:4e-4,decay:.0025,amp:.22},{src:"noise",filter:{type:"bandpass",f:600,q:1.3},at:H(n,.06,.075),attack:.003,decay:.018,amp:.42}]},stone:{gain:.036,design:n=>[{src:"noise",filter:{type:"bandpass",f:H(n,2100,2700),q:.9},attack:3e-4,decay:.005,amp:1},{src:"noise",filter:{type:"lowpass",f:1e3},attack:8e-4,decay:.01,amp:.5},{src:"sine",f:170,f2:110,glide:.006,attack:.001,decay:.01,amp:.28},{src:"grains",density:3e3,filter:{type:"highpass",f:3200},at:.006,attack:.006,decay:.018,amp:.25},{src:"noise",filter:{type:"bandpass",f:H(n,2800,3400),q:1},at:H(n,.04,.05),attack:3e-4,decay:.004,amp:.45}]},sand:{gain:.025,design:n=>[{src:"grains",density:4e3,filter:{type:"bandpass",f:H(n,1300,1700),q:.7},attack:.012,decay:.05,amp:1},{src:"noise",filter:{type:"lowpass",f:260},attack:.005,decay:.04,amp:.6},{src:"grains",density:2500,filter:{type:"bandpass",f:H(n,2100,2500),q:.8},at:H(n,.06,.08),attack:.01,decay:.035,amp:.5}]},earth:{gain:.025,design:n=>[{src:"sine",f:H(n,88,100),f2:55,glide:.015,attack:.003,decay:.026,amp:.45},{src:"noise",filter:{type:"lowpass",f:H(n,560,680)},attack:.003,decay:.026,amp:1},{src:"grains",density:1200,filter:{type:"highpass",f:2e3},at:.004,attack:.004,decay:.028,amp:.3},{src:"noise",filter:{type:"lowpass",f:800},at:H(n,.055,.07),attack:.003,decay:.015,amp:.4}]}};function Ei(n,e,t,a){const o=Math.max(-1,Math.min(1,Number.isFinite(n)?n:0)),s=Math.max(0,Math.min(1,Number.isFinite(e)?e:0));return{pan:o*.5,gain:(1-.6*s)*(t?1.3:1),rate:(1+.03*a)*(t?1.08:1),hold:t?.045:1/0}}const Ci=()=>[{src:"noise",filter:{type:"bandpass",f:1700,q:4},attack:4e-4,decay:.007,amp:.8},{src:"sine",f:1250,f2:1180,glide:.01,attack:6e-4,decay:.011,amp:.7},{src:"sine",f:560,f2:520,glide:.01,attack:.001,decay:.009,amp:.3},{src:"noise",filter:{type:"highpass",f:4e3},attack:3e-4,decay:.0015,amp:.12}],us=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,2500,3200),q:.5},attack:.07,decay:.07,amp:.45},{src:"grains",density:300,filter:{type:"bandpass",f:H(n,4e3,5e3),q:1.5},attack:.03,hold:.04,decay:.07,amp:1},{src:"grains",density:150,filter:{type:"bandpass",f:3200,q:1.2},at:.1,attack:.01,decay:.05,amp:.5},{src:"noise",filter:{type:"lowpass",f:1100},at:H(n,.12,.15),attack:.008,decay:.035,amp:.4}],Hi=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,1200,1600),q:3},attack:.001,decay:.012,amp:.8},{src:"sine",f:H(n,1800,2200),attack:8e-4,decay:.008,amp:.25}],Ni=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,620,820),q:.8},attack:.012,decay:.045,amp:1},{src:"sine",f:H(n,240,280),f2:210,glide:.04,attack:.004,decay:.04,amp:.25}],Li=n=>{const e=H(n,388,396);return[{src:"sine",f:e,attack:.006,decay:.09,amp:.8},{src:"sine",f:e*1.4983,at:.07,attack:.006,decay:.11,amp:.55}]},$i=n=>[{src:"noise",filter:{type:"lowpass",f:H(n,260,340)},attack:.3,hold:.12,decay:.24,amp:1},{src:"sine",f:H(n,62,72),f2:H(n,42,48),glide:.35,attack:.24,hold:.1,decay:.22,amp:.4}],Di=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,1900,2300),q:.8},attack:.02,decay:.05,amp:.35},{src:"sine",f:261.63,attack:.012,decay:.12,amp:.5},{src:"sine",f:392,at:.09,attack:.012,decay:.14,amp:.28}],Ri=n=>[{src:"sine",f:H(n,132,142),f2:108,glide:.04,attack:.003,decay:.09,amp:.7},{src:"noise",filter:{type:"lowpass",f:420},attack:.002,decay:.05,amp:.35},{src:"sine",f:H(n,125,135),f2:100,glide:.04,at:.09,attack:.003,decay:.1,amp:.55}],qi=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,900,1100),q:.6},attack:.05,decay:.07,amp:.6},{src:"grains",density:220,filter:{type:"bandpass",f:1300,q:1.1},attack:.02,hold:.03,decay:.07,amp:.9},{src:"sine",f:150,f2:95,glide:.012,at:.16,attack:.002,decay:.03,amp:.55},{src:"noise",filter:{type:"lowpass",f:500},at:.16,attack:.002,decay:.028,amp:.45},{src:"sine",f:H(n,2400,2800),at:.17,attack:5e-4,decay:.012,amp:.06}],Pi=n=>{const e=H(n,1560,1760);return[{src:"noise",filter:{type:"bandpass",f:H(n,3e3,3800),q:2.5},attack:6e-4,decay:.007,amp:.4},{src:"sine",f:e,f2:e*.99,glide:.2,attack:.0012,decay:.04,amp:.8},{src:"sine",f:e*2.41,attack:8e-4,decay:.02,amp:.2},{src:"sine",f:e*1.4983,at:H(n,.065,.08),attack:.0012,decay:.05,amp:.55},{src:"sine",f:e*1.4983*2.41,at:.07,attack:8e-4,decay:.022,amp:.12}]},Oi=n=>{const e=H(n,516,530);return[{src:"sine",f:e,attack:.008,decay:.12,amp:.8},{src:"sine",f:e*2.756,attack:.004,decay:.04,amp:.1},{src:"sine",f:e*1.4983,at:.12,attack:.01,decay:.16,amp:.65},{src:"sine",f:e*1.4983*2.756,at:.12,attack:.004,decay:.05,amp:.07}]},Wi=n=>[{src:"sine",f:H(n,150,168),f2:100,glide:.03,attack:.003,decay:.045,amp:.8},{src:"noise",filter:{type:"lowpass",f:H(n,300,380)},attack:.002,decay:.03,amp:.5},{src:"sine",f:H(n,128,142),f2:86,glide:.03,at:.1,attack:.003,decay:.05,amp:.55},{src:"noise",filter:{type:"lowpass",f:260},at:.1,attack:.002,decay:.03,amp:.3}],Fi=n=>[{src:"pulses",f:H(n,90,120),f2:H(n,150,190),glide:.12,jitter:.3,filter:[{type:"bandpass",f:H(n,620,760),q:6},{type:"bandpass",f:1450,q:5,gain:.5}],attack:.05,hold:.1,decay:.08,amp:.5},{src:"noise",filter:{type:"bandpass",f:H(n,1700,2100),q:3},at:.36,attack:8e-4,decay:.006,amp:.45},{src:"sine",f:H(n,190,215),f2:120,glide:.02,at:.365,attack:.002,decay:.045,amp:.8},{src:"noise",filter:{type:"lowpass",f:520},at:.365,attack:.002,decay:.04,amp:.55}],Bi=n=>{const e=H(n,760,900),t=H(n,1250,1450);return[{src:"pulses",f:e,f2:e*.62,glide:.1,jitter:.08,filter:[{type:"bandpass",f:t,q:5},{type:"bandpass",f:t*2.1,q:6,gain:.55}],attack:.03,hold:.09,decay:.07,amp:1},{src:"pulses",f:e*.92,f2:e*.55,glide:.12,jitter:.1,filter:[{type:"bandpass",f:t*.92,q:5},{type:"bandpass",f:t*1.9,q:6,gain:.5}],at:.3,attack:.035,hold:.1,decay:.09,amp:.8}]},Vi=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,780,940),q:.7},attack:.06,decay:.05,amp:.7},{src:"grains",density:200,filter:{type:"bandpass",f:1300,q:1.1},attack:.03,hold:.03,decay:.06,amp:.8},{src:"sine",f:H(n,2250,2450),attack:8e-4,decay:.014,amp:.07,at:.1},{src:"sine",f:130,f2:86,glide:.012,at:.13,attack:.002,decay:.03,amp:.35}],Gi=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,620,740),q:.7},attack:.03,decay:.035,amp:.55},{src:"sine",f:112,f2:74,glide:.012,at:.055,attack:.002,decay:.032,amp:.55},{src:"noise",filter:{type:"lowpass",f:480},at:.055,attack:.002,decay:.03,amp:.4},{src:"sine",f:H(n,1850,1950),attack:8e-4,decay:.01,amp:.05,at:.06}],zi=n=>{const e=H(n,392,400);return[{src:"noise",filter:{type:"bandpass",f:H(n,2600,3200),q:3},attack:6e-4,decay:.006,amp:.35},{src:"sine",f:H(n,1300,1400),attack:.001,decay:.03,amp:.4},{src:"sine",f:e,at:.05,attack:.01,decay:.13,amp:.75},{src:"sine",f:e*1.4983,at:.16,attack:.012,decay:.2,amp:.7},{src:"sine",f:e*1.4983*2.005,at:.16,attack:.008,decay:.07,amp:.1}]},Ki=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,1700,2100),q:.5},attack:.14,hold:.05,decay:.13,amp:.5},{src:"grains",density:220,filter:{type:"bandpass",f:3600,q:1.2},attack:.08,hold:.05,decay:.1,amp:.6},{src:"sine",f:H(n,190,200),f2:147,glide:.25,attack:.1,hold:.05,decay:.22,amp:.7},{src:"sine",f:H(n,388,398),f2:296,glide:.25,at:.08,attack:.1,decay:.16,amp:.2}],Ui=n=>[{src:"sine",f:H(n,105,120),f2:66,glide:.02,attack:.002,decay:.07,amp:1},{src:"noise",filter:{type:"lowpass",f:H(n,520,640)},attack:.0015,decay:.05,amp:.8},{src:"noise",filter:{type:"bandpass",f:H(n,330,400),q:2},attack:.001,decay:.03,amp:.5},{src:"grains",density:900,filter:{type:"bandpass",f:H(n,1500,1900),q:2.5},at:.05,attack:.004,hold:.02,decay:.05,amp:.4},{src:"grains",density:600,filter:{type:"bandpass",f:H(n,1300,1600),q:2.5},at:.17,attack:.004,decay:.04,amp:.25}],X={tick:.085,page:.05,satchel:.05,hatch:.1,stairs:.07,stamp:.11,bell:.09,hover:.018,arm:.026,advance:.022,choice:.034,chartOpen:.05,chartClose:.033,chartTone:.02,threshold:.045,save:.026,error:.045,pickup:.05,chime:.035,deny:.045,door:.08,gull:.045,inventoryOpen:.04,inventoryClose:.032,combine:.04,travel:.04,locked:.075,motif:.027,note:.03,actBreak:.2},aa=[0,7,12,9],qa=[2,4,7,0],Yi=261.6255653005986;function rt(n){return Yi*2**(n/12)}function It(n){const e=Number.isFinite(n)?Math.max(1,Math.min(qa.length,Math.round(n)))-1:0;return qa[e]}function ji(n,e,t,a=1){return[{src:"sine",f:n,at:e,attack:.006,decay:t,amp:a},{src:"sine",f:n*2.756,at:e,attack:.003,decay:t*.5,amp:a*.16}]}function oa(n,e,t){return aa.flatMap((a,o)=>{const s=o===aa.length-1;return ji(rt(n+a),e+o*.28,s?.17:.14,(s?1:.92)*t)})}function Dt(n,e=0){const t=It(n)+e*12;return()=>oa(t,.04,1)}function Xi(n,e=0){const t=It(n)+e*12;return aa.map(a=>rt(t+a))}const Qi=n=>[...us(n).map(e=>({...e,amp:e.amp*.42})),{src:"sine",f:196,at:.09,attack:.012,decay:.28,amp:.65},{src:"sine",f:392,at:.09,attack:.01,decay:.16,amp:.16},{src:"sine",f:293.66,at:.2,attack:.02,decay:.34,amp:.5},{src:"sine",f:587.33,at:.2,attack:.015,decay:.18,amp:.1}];function Ji(n,e){const t=Number.isFinite(e)?Math.max(4,Math.min(14,e)):8,a=It(n)-12;return()=>{const o=t-.6;return[{src:"sine",f:rt(a),attack:1.1,hold:Math.max(.2,t-2.4),decay:.34,amp:.55},{src:"sine",f:rt(a+7),attack:1.8,hold:Math.max(.1,t-3),decay:.3,amp:.22},{src:"sine",f:rt(a+12),attack:2.4,hold:Math.max(.1,t-3.8),decay:.4,amp:.08},...oa(It(n),.75,.34),...oa(It(n),Math.max(1.2,o-2.2),.26),{src:"sine",f:rt(a),at:o,attack:.02,decay:.34,amp:.5}]}}const Zi=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,1700,2400),q:.7},attack:8e-4,decay:.022,amp:.85},{src:"sine",f:H(n,140,165),f2:78,glide:.02,attack:.001,decay:.07,amp:.9},{src:"sine",f:H(n,62,74),f2:48,glide:.03,attack:.002,decay:.13,amp:1},{src:"noise",filter:{type:"lowpass",f:H(n,380,520)},attack:.001,decay:.05,amp:.7},{src:"sine",f:H(n,1750,1980),f2:1680,glide:.04,attack:6e-4,decay:.075,amp:.11},{src:"sine",f:H(n,2650,2900),glide:.03,attack:5e-4,decay:.045,amp:.06},{src:"grains",density:900,filter:{type:"highpass",f:2600},at:H(n,.012,.03),attack:.004,decay:.035,amp:.18}],er=n=>{const e=H(n,820,900),t=[[1,.65,1],[2.01,.45,.55],[2.72,.35,.4],[4.18,.24,.22],[5.43,.18,.16],[7.1,.12,.08]];return[{src:"noise",filter:{type:"highpass",f:3200},attack:4e-4,decay:.006,amp:.5},{src:"noise",filter:{type:"bandpass",f:H(n,1400,1800),q:2},attack:8e-4,decay:.02,amp:.3},...t.map(([a,o,s])=>({src:"sine",f:e*a,f2:e*a*.997,glide:.3,attack:.0015,hold:.01,decay:o,amp:s}))]},tr=n=>[{src:"pulses",f:H(n,200,240),f2:H(n,300,360),glide:.08,jitter:.2,filter:[{type:"bandpass",f:1250,q:7},{type:"bandpass",f:2600,q:6,gain:.6}],attack:.02,hold:.06,decay:.05,amp:.45},{src:"sine",f:105,f2:62,glide:.02,at:.17,attack:.002,decay:.07,amp:1},{src:"noise",filter:{type:"lowpass",f:650},at:.17,attack:.0015,decay:.05,amp:.75},{src:"noise",filter:{type:"bandpass",f:420,q:2},at:.17,attack:.001,decay:.03,amp:.6},{src:"noise",filter:{type:"bandpass",f:1500,q:2},at:.19,attack:.001,decay:.012,amp:.25}],nr=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,1800,4e3),q:.8},attack:2e-4,decay:H(n,.0015,.004),amp:1},{src:"noise",filter:{type:"lowpass",f:H(n,800,1500)},attack:4e-4,decay:.005,amp:H(n,.3,.6)}],ar=n=>[{src:"noise",filter:{type:"bandpass",f:H(n,600,900),q:.5},attack:.18,hold:.05,decay:.22,amp:1},{src:"grains",density:60,filter:{type:"bandpass",f:3e3,q:1},at:.05,attack:.05,decay:.2,amp:.5}],or=n=>{const e=H(n,.28,.42),t=[{src:"noise",filter:{type:"lowpass",f:H(n,330,480),q:.9},attack:H(n,.3,.5),hold:.05,decay:.28,amp:1},{src:"noise",filter:{type:"bandpass",f:H(n,800,1100),q:.8},at:e,attack:.12,decay:.2,amp:.45}],a=2+Math.floor(n()*3);for(let o=0;o<a;o++){const s=H(n,500,900);t.push({src:"sine",f:s,f2:s*1.7,glide:.01,at:e+H(n,.02,.35),attack:.002,decay:.012,amp:H(n,.08,.16)})}return t},sr=n=>{const e=H(n,700,1200);return[{src:"sine",f:e,f2:e*1.9,glide:.01,attack:8e-4,decay:.03,amp:1},{src:"noise",filter:{type:"highpass",f:2500},attack:3e-4,decay:.0012,amp:.25},{src:"sine",f:e,f2:e*1.9,glide:.01,at:H(n,.1,.14),attack:.002,decay:.03,amp:.15}]},ir=n=>{const e=H(n,55,115);return[{src:"pulses",f:e,f2:e*H(n,.7,1.5),glide:H(n,.2,.4),jitter:.3,filter:[{type:"bandpass",f:H(n,450,680),q:12},{type:"bandpass",f:H(n,1e3,1400),q:9,gain:.7},{type:"bandpass",f:2300,q:6,gain:.3}],attack:H(n,.15,.3),hold:H(n,.1,.3),decay:H(n,.2,.35),amp:1}]},Tn={crackle:{every:[.25,.9],gain:.09},lapping:{every:[1.8,4.2],gain:.041},drip:{every:[1.6,6],gain:.034},creak:{every:[4,12],gain:.085}},Pa={first:[.9,1.5],every:[20,40]};function Oa(n){const e=Number.isFinite(n)?n:0;return{pan:Math.max(-.8,Math.min(.8,e/1500)),gain:1/(1+(e/1300)**2)}}const rr={hearth:{filter:{type:"lowpass",frequency:340},level:.042,lfo:{hz:.07,depth:.4},air:{frequency:1500,q:.7,level:.1}},study:{filter:{type:"lowpass",frequency:260},level:.028,lfo:{hz:.05,depth:.35}},workshop:{filter:{type:"bandpass",frequency:300,q:.6},level:.032,lfo:{hz:.045,depth:.45},air:{frequency:2200,q:.8,level:.08}},counting:{filter:{type:"lowpass",frequency:240},level:.026,lfo:{hz:.04,depth:.3},air:{frequency:3200,q:.9,level:.06}},cabin:{filter:{type:"lowpass",frequency:210},level:.04,lfo:{hz:.08,depth:.5},air:{frequency:900,q:.7,level:.1}},hold:{filter:{type:"lowpass",frequency:170},level:.045,lfo:{hz:.06,depth:.55},air:{frequency:600,q:.6,level:.12}},gallery:{filter:{type:"lowpass",frequency:250},level:.03,lfo:{hz:.09,depth:.5},air:{frequency:1800,q:.7,level:.08}}},hr=1.4,lr=.45,dr=new Set(["hover","threshold","travel"]);function Fe(n,e){return!(e&&dr.has(n))}const In=0,cr=.5,ur=1,fr=.75,pr=.4,gr=.8,mr={"dock.mp3":{duration:48,end:44.7},"fog.mp3":{duration:44,end:39.3},"office.mp3":{duration:36,end:28.5},"pans.mp3":{duration:43.2,end:43.2},"sea.mp3":{duration:44,end:40.9},"sunset.mp3":{duration:48.2,end:47.9},"tavern.mp3":{duration:40,end:38.2}},Wa=60,br=.8,an=.7,wr=.7,yr=7;function Sn(n){return Math.max(0,Math.min(1,Number.isFinite(n)?n:an))/an}const Fa=2,kr=.7,ft={threshold:-2,knee:0,ratio:20,attack:.002,release:.18},vr=1e4,_r=1e3,Ba=16;function Tr(n,e,t){const a=Math.max(0,Math.min(1,t))*Math.PI/2;return e>=n?n+(e-n)*Math.sin(a):e+(n-e)*Math.cos(a)}const Ir={tick:{design:Ci,variants:3},hover:{design:Hi,variants:3},advance:{design:Ni,variants:3},choice:{design:Li,variants:2},threshold:{design:$i,variants:2},save:{design:Di,variants:2},error:{design:Ri,variants:2},pickup:{design:Pi,variants:3},chime:{design:Oi,variants:2},deny:{design:Wi,variants:3},door:{design:Fi,variants:3},gull:{design:Bi,variants:4},"inventory:open":{design:Vi,variants:2},"inventory:close":{design:Gi,variants:2},combine:{design:zi,variants:2},travel:{design:Ki,variants:2},locked:{design:Ui,variants:3},page:{design:us,variants:3},satchel:{design:qi,variants:3},hatch:{design:tr,variants:2},stamp:{design:Zi,variants:3},bell:{design:er,variants:2},pop:{design:nr,variants:6},hiss:{design:ar,variants:3},lap:{design:or,variants:4},drip:{design:sr,variants:4},creak:{design:ir,variants:4},note:{design:Qi,variants:3},"motif:1":{design:Dt(1),variants:1},"motif:2":{design:Dt(2),variants:1},"motif:3":{design:Dt(3),variants:1},"motif:4":{design:Dt(4),variants:1},"step:wood":{design:Ke.wood.design,variants:4},"step:deck":{design:Ke.deck.design,variants:4},"step:stone":{design:Ke.stone.design,variants:4},"step:sand":{design:Ke.sand.design,variants:4},"step:earth":{design:Ke.earth.design,variants:4}},Sr={crackle:["pop","hiss"],lapping:["lap"],drip:["drip"],creak:["creak"]},Mr=["tick","hover","advance","choice","threshold","page","satchel","hatch","stamp","bell","step:wood","note","save","error","pickup","deny","door","chime","inventory:open","inventory:close","combine","travel","locked","gull","motif:1","motif:2","motif:3","motif:4"];function Va(n){typeof requestIdleCallback=="function"?requestIdleCallback(()=>n(),{timeout:2e3}):window.setTimeout(n,60)}function xr(n){let e=2166136261;for(let t=0;t<n.length;t++)e=Math.imul(e^n.charCodeAt(t),16777619);return(e>>>0)%1e5}class Ar{constructor(e){f(this,"ctx",null);f(this,"current",null);f(this,"volume",br);f(this,"musicVolume",an);f(this,"sfxVolume",an);f(this,"muted",!1);f(this,"master",null);f(this,"limiter",null);f(this,"musicBus",null);f(this,"sfxBus",null);f(this,"musicDuck",null);f(this,"envBus",null);f(this,"stepPan",null);f(this,"cueBus",null);f(this,"cue",null);f(this,"cueBuffers",new Map);f(this,"trackGain",new Map);f(this,"stopTimers",new Map);f(this,"bedEnds",new Map);f(this,"loopTimers",new Map);f(this,"listeners",new Set);f(this,"resumeHooked",new WeakSet);f(this,"hidden",typeof document<"u"&&document.hidden);f(this,"ambience",null);f(this,"ambienceKind",null);f(this,"roomTone",null);f(this,"roomToneKind",null);f(this,"bedBuffer",null);f(this,"noiseBuffers",new Map);f(this,"savedAt",-1/0);f(this,"banks",new Map);f(this,"lastVariant",new Map);f(this,"ducked",!1);f(this,"duckLevel",In);f(this,"talking",!1);f(this,"listenerX",null);f(this,"surface","wood");f(this,"foot",1);f(this,"place",{});f(this,"placeKey","");f(this,"voices",[]);this.assets=e;try{const t=JSON.parse(localStorage.getItem("brasscompass.audio.v1")||"{}");this.muted=t.muted===!0;const a=(o,s)=>typeof o=="number"&&Number.isFinite(o)?Math.max(0,Math.min(1,o)):s;t.version===Fa&&(this.volume=a(t.volume,this.volume),this.musicVolume=a(t.music,this.musicVolume),this.sfxVolume=a(t.sfx,this.sfxVolume))}catch{}typeof document<"u"&&document.addEventListener("visibilitychange",()=>{document.hidden?this.suspend():this.resume()})}setVolume(e){this.volume=Math.max(0,Math.min(1,e)),this.syncSettings()}setMusicVolume(e){this.musicVolume=Math.max(0,Math.min(1,e)),this.syncSettings()}setSfxVolume(e){this.sfxVolume=Math.max(0,Math.min(1,e)),this.syncSettings()}toggleMute(){this.muted=!this.muted,this.syncSettings();for(const e of this.voices)this.muted?this.disarm(e):this.armVoice(e);return this.muted}get level(){return this.muted?0:this.volume}syncSettings(){if(this.master&&this.ctx){const e=this.master.gain;e.cancelScheduledValues(this.ctx.currentTime),e.setTargetAtTime(this.level,this.ctx.currentTime,.015);for(const[t,a]of[[this.musicBus,this.musicBusGain()],[this.sfxBus,this.sfxBusGain()],[this.cueBus,this.musicBusGain()]])t&&(t.gain.cancelScheduledValues(this.ctx.currentTime),t.gain.setTargetAtTime(a,this.ctx.currentTime,.015))}this.syncUnrouted();try{localStorage.setItem("brasscompass.audio.v1",JSON.stringify({version:Fa,muted:this.muted,volume:this.volume,music:this.musicVolume,sfx:this.sfxVolume}))}catch{}for(const e of[...this.listeners])try{e()}catch{}}onChange(e){return this.listeners.add(e),()=>{this.listeners.delete(e)}}musicBusGain(){return Sn(this.musicVolume)*wr}sfxBusGain(){return Sn(this.sfxVolume)*yr}get videoVolume(){return this.muted?0:Math.max(0,Math.min(1,this.volume*Sn(this.musicVolume)*kr))}syncUnrouted(){this.current&&!this.trackGain.get(this.current)&&(this.current.volume=Math.min(1,this.level*this.musicBusGain()*this.musicDuckLevel()))}panner(e){return typeof e.createStereoPanner=="function"?e.createStereoPanner():null}get running(){var e;return((e=this.ctx)==null?void 0:e.state)==="running"}unlock(){var e,t;if(!this.ctx){const a=window.AudioContext||window.webkitAudioContext;if(a){const o=new a;if(this.ctx=o,this.master=o.createGain(),this.master.gain.value=this.level,this.limiter=o.createDynamicsCompressor(),this.limiter.threshold.value=ft.threshold,this.limiter.knee.value=ft.knee,this.limiter.ratio.value=ft.ratio,this.limiter.attack.value=ft.attack,this.limiter.release.value=ft.release,this.master.connect(this.limiter).connect(o.destination),this.musicDuck=o.createGain(),this.musicDuck.gain.value=this.musicDuckLevel(),this.musicDuck.connect(this.master),this.musicBus=o.createGain(),this.musicBus.gain.value=this.musicBusGain(),this.musicBus.connect(this.musicDuck),this.sfxBus=o.createGain(),this.sfxBus.gain.value=this.sfxBusGain(),this.sfxBus.connect(this.master),this.cueBus=o.createGain(),this.cueBus.gain.value=this.musicBusGain(),this.cueBus.connect(this.master),this.envBus=o.createGain(),this.envBus.gain.value=this.ducked?this.duckLevel:1,this.envBus.connect(this.sfxBus),this.stepPan=this.panner(o),(e=this.stepPan)==null||e.connect(this.sfxBus),this.current){const s=this.route(this.current);s&&this.fade(s.gain,1,_r)}this.buildVoices(),this.warm(Mr)}}if(!this.hidden){if(this.ctx&&this.ctx.state!=="running"&&this.ctx.resume().catch(()=>{}),this.ambienceKind&&!this.ambience){const a=this.ambienceKind;this.ambienceKind=null,this.setAmbience(a)}if(this.roomToneKind&&!this.roomTone){const a=this.roomToneKind;this.roomToneKind=null,this.setRoomTone(a)}(t=this.current)!=null&&t.paused&&this.current.play().catch(()=>{}),this.current&&this.watchLoop(this.current)}}suspend(){this.hidden=!0;for(const e of this.assets.audio.values())e.paused||e.pause();for(const e of this.voices)this.disarm(e);this.ctx&&this.ctx.state==="running"&&this.ctx.suspend().catch(()=>{})}resume(){var e;this.hidden=!1,this.ctx&&this.ctx.state!=="running"&&this.ctx.resume().catch(()=>{}),(e=this.current)!=null&&e.paused&&this.current.play().catch(()=>{}),this.current&&this.watchLoop(this.current);for(const t of this.voices)this.armVoice(t)}route(e){const t=this.ctx;if(!t||!this.master)return null;if(this.trackGain.has(e))return this.trackGain.get(e)??null;let a=null;try{const o=t.createMediaElementSource(e);a=t.createGain(),a.gain.value=0,o.connect(a).connect(this.musicBus??this.master),e.volume=1}catch{a=null}return this.trackGain.set(e,a),a}ramp(e,t,a){const s=this.ctx.currentTime;e.cancelScheduledValues(s),e.setValueAtTime(e.value,s),e.linearRampToValueAtTime(t,s+Math.max(.01,a/1e3))}fade(e,t,a){const s=this.ctx.currentTime,i=e.value;e.cancelScheduledValues(s),e.setValueAtTime(i,s);const r=Math.max(.01,a/1e3);for(let h=1;h<=Ba;h++){const l=h/Ba;e.linearRampToValueAtTime(Tr(i,t,l),s+r*l)}}fadeOut(e,t){const a=this.trackGain.get(e),o=this.stopTimers.get(e);if(o!==void 0&&window.clearTimeout(o),this.stopTimers.delete(e),!a||e.paused||!this.ctx){this.stopTrack(e);return}this.fade(a.gain,0,t),this.stopTimers.set(e,window.setTimeout(()=>this.stopTrack(e),t+120))}bedEnd(e){if(this.bedEnds.has(e))return this.bedEnds.get(e)??null;const t=(e.src.split("/").pop()??"").split("?")[0],a=mr[t];if(!a||!Number.isFinite(e.duration))return null;const o=Math.abs(e.duration-a.duration)<.5?a.end:null;return this.bedEnds.set(e,o),o}watchLoop(e){this.unwatchLoop(e);let t=!1;const a=s=>{const i=window.setTimeout(()=>{this.loopTimers.delete(e),o()},Math.max(Wa,s));this.loopTimers.set(e,i)},o=()=>{if(this.hidden||this.current!==e)return;const s=this.bedEnd(e);if(s===null){e.loop=!0,e.ended&&this.restartBed(e),!t&&!Number.isFinite(e.duration)&&(t=!0,e.addEventListener("loadedmetadata",()=>{this.current===e&&this.watchLoop(e)},{once:!0}));return}if(e.loop=!1,e.ended||!e.paused&&e.currentTime>=s){this.restartBed(e),a(Wa);return}a((s-e.currentTime)*1e3+30)};o()}restartBed(e){try{e.currentTime=0}catch{}e.paused&&e.play().catch(()=>{})}unwatchLoop(e){const t=this.loopTimers.get(e);t!==void 0&&window.clearTimeout(t),this.loopTimers.delete(e)}stopTrack(e){this.unwatchLoop(e);const t=this.stopTimers.get(e);t!==void 0&&window.clearTimeout(t),this.stopTimers.delete(e),e.paused||e.pause(),e.currentTime=0;const a=this.trackGain.get(e);a&&this.ctx&&(a.gain.cancelScheduledValues(this.ctx.currentTime),a.gain.value=0)}playMusic(e,t=900){const a=this.assets.audio.get(e);if(!a||this.current===a&&(!a.paused||this.hidden))return;a.preload!=="auto"&&(a.preload="auto"),this.resumeWhenReady(a);const o=this.current&&this.current!==a?this.current:null;for(const r of this.assets.audio.values())r===o||r===a||(this.stopTimers.has(r)||!r.paused?this.fadeOut(r,t):this.stopTrack(r));const s=this.stopTimers.get(a);s!==void 0&&(window.clearTimeout(s),this.stopTimers.delete(a)),this.current=a,a.paused&&(a.currentTime=0),this.watchLoop(a);const i=this.route(a);i?this.fade(i.gain,1,t):a.volume=Math.min(1,this.level*this.musicBusGain()*this.musicDuckLevel()),this.hidden||a.play().catch(()=>{}),o&&this.fadeOut(o,t)}resumeWhenReady(e){this.resumeHooked.has(e)||(this.resumeHooked.add(e),e.addEventListener("canplay",()=>{this.current===e&&e.paused&&!this.hidden&&!e.ended&&e.play().catch(()=>{})}))}musicDuckLevel(){return(this.ducked?this.duckLevel:1)*(this.talking?fr:1)}duck(e,t=In){const a=e?Math.max(0,Math.min(1,t)):In;if(!(this.ducked===e&&this.duckLevel===a)){if(this.ducked=e,this.duckLevel=a,this.ctx&&this.musicDuck&&this.envBus){const o=(e?cr:ur)*1e3;this.ramp(this.musicDuck.gain,this.musicDuckLevel(),o),this.ramp(this.envBus.gain,e?a:1,o)}this.syncUnrouted()}}frame(e,t=!1){var o;if(t!==this.talking&&(this.talking=t,this.ctx&&this.musicDuck&&!this.ducked&&this.ramp(this.musicDuck.gain,this.musicDuckLevel(),(t?pr:gr)*1e3),this.syncUnrouted()),!Number.isFinite(e)||this.listenerX!==null&&Math.abs(e-this.listenerX)<.5)return;this.listenerX=e;const a=this.ctx;if(a)for(const s of this.voices){if(!s.at)continue;const i=Oa(s.at.x-e);Math.abs(i.gain-s.mix.gain)<.004&&Math.abs(i.pan-s.mix.pan)<.004||(s.mix=i,s.out.gain.setTargetAtTime(i.gain,a.currentTime,.08),(o=s.pan)==null||o.pan.setTargetAtTime(i.pan,a.currentTime,.08))}}cueBuffer(e,t){const a=this.ctx;if(!a)return null;let o=this.cueBuffers.get(e);if(!o){const s=Ra(t,a.sampleRate,1);o=a.createBuffer(1,s.length,a.sampleRate),o.getChannelData(0).set(s),this.cueBuffers.set(e,o)}return o}beginCue(e,t){const a=this.ctx;if(!a)return;this.endCue(120);const o=Number.isFinite(t)?Math.max(4,Math.min(14,t)):8,s=this.cueBuffer(`act-break:${e}:${o.toFixed(1)}`,Ji(e,o));if(!s)return;const i=a.createBufferSource();i.buffer=s;const r=a.createGain(),h=a.currentTime;r.gain.setValueAtTime(0,h),r.gain.linearRampToValueAtTime(X.actBreak,h+.6),i.connect(r).connect(this.cueBus??this.master??a.destination),i.start(h);const l=window.setTimeout(()=>this.endCue(900),(s.duration+.05)*1e3);this.cue={src:i,gain:r,timer:l}}endCue(e=900){const t=this.cue;if(!t)return;this.cue=null,window.clearTimeout(t.timer);const a=this.ctx;if(a){const o=a.currentTime,s=t.gain.gain;typeof s.cancelAndHoldAtTime=="function"?s.cancelAndHoldAtTime(o):(s.cancelScheduledValues(o),s.setValueAtTime(s.value,o)),s.setTargetAtTime(0,o,Math.max(.02,e/4e3));try{t.src.stop(o+Math.max(.05,e/1e3)+.1)}catch{}}else try{t.src.stop()}catch{}t.src.onended=()=>{try{t.src.disconnect(),t.gain.disconnect()}catch{}}}compass(e){const t=Number.isFinite(e)?Math.max(1,Math.min(4,Math.round(e))):1;this.sound(`motif:${t}`,X.motif,{dest:this.cueBus??void 0})}note(){this.sound("note",X.note,{rate:.98+Math.random()*.04})}setRoom(e){this.surface=e.footsteps&&Ke[e.footsteps]?e.footsteps:"wood",this.ctx&&this.bank(`step:${this.surface}`),this.setRoomTone(e.roomTone??null),this.setAmbience(e.ambience&&e.ambience!=="gulls"?e.ambience:null);const t=JSON.stringify([e.ambience==="gulls",e.emitters??[]]);t!==this.placeKey&&(this.placeKey=t,this.place=e,this.dropVoices(),this.buildVoices())}buildVoices(){const e=this.ctx,t=this.envBus;if(!e||!t||this.voices.length)return;const a=[...this.place.emitters??[]];this.place.ambience==="gulls"&&a.push({kind:"gulls"});for(const o of a){if(o.kind!=="gulls"&&!Tn[o.kind])continue;const s=o.at?{x:o.at.x,y:o.at.y}:null,i=s&&this.listenerX!==null?Oa(s.x-this.listenerX):{pan:0,gain:1},r=e.createGain();r.gain.value=i.gain;const h=this.panner(e);h?(h.pan.value=i.pan,r.connect(h).connect(t)):r.connect(t);const l={kind:o.kind,at:s,out:r,pan:h,mix:i,timer:null};if(this.voices.push(l),o.kind!=="gulls")for(const u of Sr[o.kind])this.bank(u);this.armVoice(l,!0)}}dropVoices(){const e=this.ctx;for(const t of this.voices){if(this.disarm(t),e){const o=e.currentTime;t.out.gain.cancelScheduledValues(o),t.out.gain.setValueAtTime(t.out.gain.value,o),t.out.gain.setTargetAtTime(0,o,.1)}const a=t.pan?[t.out,t.pan]:[t.out];window.setTimeout(()=>{for(const o of a)try{o.disconnect()}catch{}},900)}this.voices=[]}armVoice(e,t=!1){if(e.timer!==null||!this.ctx||this.hidden||this.muted)return;let a;if(e.kind==="gulls"){const[o,s]=t?Pa.first:Pa.every;a=o+Math.random()*(s-o)}else{const[o,s]=Tn[e.kind].every;a=t?Math.random()*s:o+Math.random()*(s-o)}e.timer=window.setTimeout(()=>{e.timer=null,this.voices.includes(e)&&(this.fire(e),this.armVoice(e))},a*1e3)}disarm(e){e.timer!==null&&window.clearTimeout(e.timer),e.timer=null}fire(e){const t=this.ctx;if(!t||t.state!=="running"||this.hidden||this.muted)return;const a=t.currentTime+.03,o=(r,h)=>r+Math.random()*(h-r);!e.at&&e.pan&&e.pan.pan.setValueAtTime(o(-.5,.5),a);const s=e.out;if(e.kind==="gulls"){const r=Math.random()<.35?2:1;for(let h=0;h<r;h++)this.gullCall(s,o(.9,1.12),.03+h*o(.5,.9),o(.6,1));return}const i=Tn[e.kind].gain;if(e.kind==="crackle"){let r=0;const h=1+Math.floor(Math.random()*5);for(let l=0;l<h;l++)this.sound("pop",i*o(.35,1),{at:a+r,dest:s,rate:o(.8,1.3)}),r+=o(.02,.14);Math.random()<.15&&this.sound("hiss",i*.3,{at:a,dest:s,rate:o(.9,1.1)})}else e.kind==="lapping"?this.sound("lap",i*o(.7,1),{at:a,dest:s,rate:o(.9,1.1)}):e.kind==="drip"?(this.sound("drip",i*o(.7,1),{at:a,dest:s,rate:o(.9,1.1)}),Math.random()<.25&&this.sound("drip",i*o(.4,.7),{at:a+o(.25,.5),dest:s,rate:o(.9,1.1)})):this.sound("creak",i*o(.6,1),{at:a,dest:s,rate:o(.85,1.1)})}bed(e){if(this.bedBuffer)return this.bedBuffer;const t=e.sampleRate,a=Math.floor(t*15),o=Math.floor(t*1.5),s=new Float32Array(a+o);let i=0;for(let l=0;l<s.length;l++){const u=Math.random()*2-1;i=(i+.02*u)/1.02,s[l]=i*3.2}const r=e.createBuffer(1,a,t),h=r.getChannelData(0);h.set(s.subarray(0,a));for(let l=0;l<o;l++){const u=l/o*(Math.PI/2);h[l]=s[l]*Math.sin(u)+s[a+l]*Math.cos(u)}return this.bedBuffer=r,r}setAmbience(e){if(this.ambienceKind===e)return;this.ambienceKind=e;const t=this.ctx;if(!t||(this.ambience&&this.stopBed(this.ambience),this.ambience=null,!e))return;const a=t.createBufferSource();a.buffer=this.bed(t),a.loop=!0;const o=Math.random()*a.buffer.duration,s=t.createBiquadFilter(),i=t.createGain(),r=t.createGain();let h;e==="sea"?(s.type="lowpass",s.frequency.value=620,h=.1):e==="wind"?(s.type="bandpass",s.frequency.value=520,s.Q.value=.6,h=.07):(s.type="lowpass",s.frequency.value=380,h=.055),i.gain.value=h;const l=t.createOscillator(),u=t.createGain();l.frequency.value=e==="sea"?.09:.05,u.gain.value=h*.45,l.connect(u).connect(i.gain);const d=t.currentTime;r.gain.setValueAtTime(0,d),r.gain.linearRampToValueAtTime(1,d+1.2),a.connect(s).connect(i).connect(r).connect(this.envBus??this.sfxBus??this.master??t.destination),l.start(),a.start(d,o);const c={src:a,lfo:l,out:r,nodes:[a,s,i,l,u,r],timer:null};if(this.ambience=c,e==="tavern"){const p=t.createBiquadFilter();p.type="lowpass",p.frequency.value=1500,p.connect(r),c.nodes.push(p),this.scheduleTavern(c,p,600)}}setRoomTone(e){if(this.roomToneKind===e)return;this.roomToneKind=e;const t=this.ctx;if(!t||(this.roomTone&&this.stopBed(this.roomTone,lr),this.roomTone=null,!e))return;const a=rr[e];if(!a)return;const o=t.createBufferSource();o.buffer=this.bed(t),o.loop=!0;const s=Math.random()*o.buffer.duration,i=t.createBiquadFilter();i.type=a.filter.type,i.frequency.value=a.filter.frequency,a.filter.q!==void 0&&(i.Q.value=a.filter.q);const r=t.createGain();r.gain.value=a.level;const h=t.createGain(),l=t.createOscillator(),u=t.createGain();l.frequency.value=a.lfo.hz,u.gain.value=a.level*a.lfo.depth,l.connect(u).connect(r.gain);const d=t.currentTime;h.gain.setValueAtTime(0,d),h.gain.linearRampToValueAtTime(1,d+hr),o.connect(i).connect(r).connect(h).connect(this.envBus??this.sfxBus??this.master??t.destination);const c=[o,i,r,l,u,h];if(a.air){const p=t.createBiquadFilter();p.type="bandpass",p.frequency.value=a.air.frequency,p.Q.value=a.air.q;const g=t.createGain();g.gain.value=a.level*a.air.level,o.connect(p).connect(g).connect(h),c.push(p,g)}l.start(d),o.start(d,s),this.roomTone={src:o,lfo:l,out:h,nodes:c,timer:null}}stopBed(e,t=.4){const a=this.ctx;e.timer!==null&&window.clearTimeout(e.timer),e.timer=null;const o=a.currentTime;e.out.gain.cancelScheduledValues(o),e.out.gain.setValueAtTime(e.out.gain.value,o),e.out.gain.setTargetAtTime(0,o,t);const s=o+Math.max(2.5,t*6);e.src.onended=()=>{for(const i of e.nodes)try{i.disconnect()}catch{}};try{e.src.stop(s)}catch{}try{e.lfo.stop(s)}catch{}}scheduleTavern(e,t,a){const o=a??900+Math.random()*3200;e.timer=window.setTimeout(()=>{var s;this.ambience===e&&(((s=this.ctx)==null?void 0:s.state)==="running"&&!this.hidden&&!this.muted&&this.tavernEvent(e,t),this.scheduleTavern(e,t))},o)}tavernEvent(e,t){const a=Math.random();if(a<.62){const o=Math.random()<.6?105+Math.random()*50:190+Math.random()*60,s=2+Math.floor(Math.random()*4);let i=0;const r=.01+Math.random()*.008;for(let h=0;h<s;h++){const l=o*(.9+Math.random()*.25),u=.11+Math.random()*.18;this.tone(l,u,"triangle",r,l*(.85+Math.random()*.25),{dest:t,delay:i,attack:.04}),i+=u*(.7+Math.random()*.5)}if(Math.random()<.3){const h=o*(Math.random()<.5?1.5:.75);this.tone(h,.2,"triangle",r*.8,h*.9,{dest:t,delay:i+.25,attack:.05})}}else if(a<.9){const o=Math.random()<.35?2:1;for(let s=0;s<o;s++){const i=2200+Math.random()*1300,r=s*(.06+Math.random()*.08),h=.01+Math.random()*.008;this.tone(i,.14,"sine",h,void 0,{dest:e.out,delay:r}),this.tone(i*2.76,.07,"sine",h*.45,void 0,{dest:e.out,delay:r})}}else this.noise(.12+Math.random()*.12,.025,260+Math.random()*200,t)}tone(e,t,a="sine",o=.18,s,i={}){const r=this.ctx;if(!r||this.muted)return;const h=r.currentTime+(i.delay??0),l=i.attack??.01,u=r.createOscillator(),d=r.createGain();u.type=a,u.frequency.setValueAtTime(e,h),s!==void 0&&u.frequency.exponentialRampToValueAtTime(s,h+t),d.gain.setValueAtTime(0,h),d.gain.linearRampToValueAtTime(o,h+l),d.gain.exponentialRampToValueAtTime(1e-4,h+Math.max(t,l+.02)),u.connect(d).connect(i.dest??this.sfxBus??this.master??r.destination),u.onended=()=>{u.disconnect(),d.disconnect()},u.start(h),u.stop(h+Math.max(t,l+.02)+.02)}ring(e,t,a,o,s=.015){const i=this.ctx;if(!i||this.muted)return;const r=i.currentTime+a,h=i.createOscillator(),l=i.createGain();h.frequency.value=e,l.gain.setValueAtTime(0,r),l.gain.linearRampToValueAtTime(t,r+s),l.gain.setTargetAtTime(0,r+s,o),h.connect(l).connect(this.sfxBus??this.master??i.destination),h.onended=()=>{h.disconnect(),l.disconnect()},h.start(r),h.stop(r+s+o*6)}noiseBuffer(e,t){const a=Math.round(t*1e3);let o=this.noiseBuffers.get(a);if(!o){const s=Math.max(1,Math.floor(e.sampleRate*a/1e3));o=e.createBuffer(1,s,e.sampleRate);const i=o.getChannelData(0);for(let r=0;r<s;r++)i[r]=(Math.random()*2-1)*(1-r/s);this.noiseBuffers.set(a,o)}return o}noise(e,t=.12,a=1200,o){const s=this.ctx;if(!s||this.muted)return;const i=s.createBufferSource();i.buffer=this.noiseBuffer(s,e),i.playbackRate.value=.92+Math.random()*.16;const r=s.createBiquadFilter();r.type="lowpass",r.frequency.value=a;const h=s.createGain();h.gain.value=t,i.connect(r).connect(h).connect(o??this.sfxBus??this.master??s.destination),i.onended=()=>{i.disconnect(),r.disconnect(),h.disconnect()},i.start()}bank(e){let t=this.banks.get(e);if(!t){const a=this.ctx,{design:o,variants:s}=Ir[e];t=[];const i=xr(e);for(let r=0;r<s;r++){const h=Ra(o,a.sampleRate,i+r),l=a.createBuffer(1,h.length,a.sampleRate);l.getChannelData(0).set(h),t.push(l)}this.banks.set(e,t)}return t}warm(e){const t=()=>{const a=e.find(o=>!this.banks.has(o));!a||!this.ctx||(this.bank(a),Va(t))};Va(t)}sound(e,t,a={}){const o=this.ctx;if(!o||this.muted)return;const s=this.bank(e);let i=Math.floor(Math.random()*s.length);s.length>1&&i===this.lastVariant.get(e)&&(i=(i+1)%s.length),this.lastVariant.set(e,i);const r=a.at??o.currentTime+(a.delay??0),h=o.createBufferSource();h.buffer=s[i],h.playbackRate.value=a.rate??1;const l=o.createGain();l.gain.setValueAtTime(t,r),a.hold!==void 0&&Number.isFinite(a.hold)&&l.gain.setTargetAtTime(0,r+a.hold,.012),h.connect(l).connect(a.dest??this.sfxBus??this.master??o.destination),h.onended=()=>{h.disconnect(),l.disconnect()},h.start(r)}click(){this.sound("tick",X.tick,{rate:.97+Math.random()*.06})}hover(){this.sound("hover",X.hover,{rate:.97+Math.random()*.06})}arm(){this.sound("hover",X.arm,{rate:.82+Math.random()*.05})}advance(){this.sound("advance",X.advance,{rate:.96+Math.random()*.06})}choice(){this.sound("choice",X.choice,{rate:.98+Math.random()*.03})}chart(e){this.sound("page",e?X.chartOpen:X.chartClose,{rate:e?.86:1.16}),e?this.tone(196,.5,"sine",X.chartTone,146,{attack:.05}):this.tone(146,.32,"sine",X.chartTone*.7,110,{attack:.03})}threshold(){this.sound("threshold",X.threshold,{rate:.96+Math.random()*.05})}saved(){if(this.hidden)return;const e=performance.now();e-this.savedAt<vr||(this.savedAt=e,this.sound("save",X.save,{rate:.98+Math.random()*.03}))}error(){this.sound("error",X.error,{rate:.97+Math.random()*.04})}step(e=0,t=0,a=!1){var r;const o=this.ctx;if(!o||this.muted)return;this.foot=this.foot===1?-1:1;const s=Ei(e,t,a,this.foot),i=o.currentTime;(r=this.stepPan)==null||r.pan.setValueAtTime(s.pan,i),this.sound(`step:${this.surface}`,Ke[this.surface].gain*s.gain,{at:i,dest:this.stepPan??void 0,rate:s.rate*(.985+Math.random()*.03),hold:s.hold})}page(){this.sound("page",X.page,{rate:.94+Math.random()*.12})}stamp(){this.sound("stamp",X.stamp,{rate:.96+Math.random()*.08})}nightBell(){this.sound("bell",X.bell,{rate:.99+Math.random()*.02}),this.sound("bell",X.bell*.55,{delay:1.05,rate:.965+Math.random()*.02})}pickup(){this.sound("pickup",X.pickup,{rate:.97+Math.random()*.06}),this.sound("satchel",X.satchel,{delay:.1,rate:.95+Math.random()*.1})}chime(){this.sound("chime",X.chime,{rate:.99+Math.random()*.02})}inventory(e){this.sound(e?"inventory:open":"inventory:close",e?X.inventoryOpen:X.inventoryClose,{rate:.97+Math.random()*.06})}combine(){this.sound("combine",X.combine,{rate:.99+Math.random()*.02})}travel(){this.sound("travel",X.travel,{rate:.97+Math.random()*.06})}locked(){this.sound("locked",X.locked,{rate:.96+Math.random()*.08})}resolve(e=4){[523.25,659.25,783.99,1046.5].forEach((t,a)=>{this.ring(t,.065,a*.18,.42),this.ring(t*2,.01,a*.18,.14,.008)}),Xi(e,1).forEach((t,a)=>this.ring(t,.045,.35+a*.3,.5))}deny(){this.sound("deny",X.deny,{rate:.97+Math.random()*.06})}door(e="door"){if(e!=="none"){if(e==="hatch"){this.sound("hatch",X.hatch,{rate:.95+Math.random()*.1});return}if(e==="stairs"){for(let t=0;t<4;t++)this.sound("step:wood",X.stairs*(1-t*.15),{delay:t*.17,rate:(t%2?.97:1.03)*(1+t*.01)});return}this.sound("door",X.door,{rate:.95+Math.random()*.1})}}gulls(){this.gullCall()}gullCall(e,t=1,a=0,o=1){this.sound("gull",X.gull*o,{dest:e,delay:a,rate:t})}}const Er='Georgia, "Times New Roman", serif';function ya(n){return`${n.weight??"normal"} ${n.size}px ${n.family??Er}`}function je(n,e,t,a){n.font=ya(a);const o=e.split(/\s+/).filter(Boolean);if(o.length===0)return[];const s=[];let i=o[0];for(let r=1;r<o.length;r++){const h=`${i} ${o[r]}`;n.measureText(h).width>t?(s.push(i),i=o[r]):i=h}return s.push(i),s}function K(n,e,t,a,o){n.save(),n.font=ya(o),n.textAlign=o.align??"left",n.textBaseline="top",o.shadow!==!1&&(n.lineJoin="round",n.strokeStyle="rgba(0,0,0,0.22)",n.lineWidth=Math.max(3,o.size*.2),n.strokeText(e,t,a+2),n.fillStyle="rgba(0,0,0,0.55)",n.fillText(e,t,a+2)),n.fillStyle=o.color,n.fillText(e,t,a),n.restore()}function fs(n,e){if(e>=n.length)return n;let t=Math.max(0,Math.floor(e));for(;t<n.length&&n[t]!==" ";)t++;return n.slice(0,t)}function Ne(n,e){let t=!1;for(let a=0,o=e.length-1;a<e.length;o=a++){const s=e[a].x,i=e[a].y,r=e[o].x,h=e[o].y;i>n.y!=h>n.y&&n.x<(r-s)*(n.y-i)/(h-i||1e-9)+s&&(t=!t)}return t}function ht(n,e){const t=n.x-e.x,a=n.y-e.y;return t*t+a*a}function Cr(n,e,t){const a=t.x-e.x,o=t.y-e.y,s=a*a+o*o;if(s===0)return{...e};let i=((n.x-e.x)*a+(n.y-e.y)*o)/s;return i=Math.max(0,Math.min(1,i)),{x:e.x+i*a,y:e.y+i*o}}function ps(n,e){let t=e[0],a=1/0;for(let o=0;o<e.length;o++){const s=Cr(n,e[o],e[(o+1)%e.length]),i=ht(n,s);i<a&&(a=i,t=s)}return t}function Hr(n,e,t){if(Ne(n,t))return n;let a=n.x-e.x,o=n.y-e.y,s=Math.hypot(a,o);if(s<1e-9){const i=t.reduce((r,h)=>({x:r.x+h.x/t.length,y:r.y+h.y/t.length}),{x:0,y:0});a=i.x-n.x,o=i.y-n.y,s=Math.hypot(a,o)||1}for(const i of[1,2,3,5]){const r={x:n.x+a/s*i,y:n.y+o/s*i};if(Ne(r,t))return r}for(let i=0;i<16;i++){const r={x:n.x+Math.cos(i*Math.PI/8),y:n.y+Math.sin(i*Math.PI/8)};if(Ne(r,t))return r}return n}function nt(n,e){if(e.some(s=>Ne(n,s)))return{...n};let t=null,a=null,o=1/0;for(const s of e){if(s.length<3)continue;const i=ps(n,s),r=ht(n,i);r<o&&(o=r,t=i,a=s)}return t&&a?Hr(t,n,a):{...n}}const Nr=n=>({x0:Math.min(...n.map(e=>e.x)),y0:Math.min(...n.map(e=>e.y)),x1:Math.max(...n.map(e=>e.x)),y1:Math.max(...n.map(e=>e.y))}),me=20;class Mn{constructor(e,t,a){f(this,"cols");f(this,"rows");f(this,"walkable");f(this,"polys");f(this,"boxes");this.polys=e.filter(o=>o.length>=3),this.boxes=this.polys.map(Nr),this.cols=Math.ceil(t/me),this.rows=Math.ceil(a/me),this.walkable=new Uint8Array(this.cols*this.rows);for(let o=0;o<this.rows;o++)for(let s=0;s<this.cols;s++){const i={x:s*me+me/2,y:o*me+me/2};this.walkable[o*this.cols+s]=this.inside(i)?1:0}}inside(e){for(let t=0;t<this.polys.length;t++){const a=this.boxes[t];if(!(e.x<a.x0||e.x>a.x1||e.y<a.y0||e.y>a.y1)&&Ne(e,this.polys[t]))return!0}return!1}nearEdge(e,t){for(let a=0;a<this.polys.length;a++){const o=this.boxes[a];if(!(e.x<o.x0-t||e.x>o.x1+t||e.y<o.y0-t||e.y>o.y1+t)&&ht(e,ps(e,this.polys[a]))<t*t)return!0}return!1}idx(e,t){return t*this.cols+e}isWalkable(e,t){return e<0||t<0||e>=this.cols||t>=this.rows?!1:this.walkable[this.idx(e,t)]===1}cellOf(e){return{c:Math.floor(e.x/me),r:Math.floor(e.y/me)}}centre(e){const t=e%this.cols,a=(e-t)/this.cols;return{x:t*me+me/2,y:a*me+me/2}}nearestCell(e){const{c:t,r:a}=this.cellOf(e);if(this.isWalkable(t,a))return{c:t,r:a};let o=-1,s=1/0;for(let r=0;r<this.walkable.length;r++){if(!this.walkable[r])continue;const h=ht(e,this.centre(r));h<s&&(s=h,o=r)}if(o<0)return null;const i=o%this.cols;return{c:i,r:(o-i)/this.cols}}polyAt(e){return this.polys.find(t=>Ne(e,t))??null}endPoint(e,t){const a=this.centre(t);if(this.inside(e)&&this.clear(a,e))return{...e};const o=this.polyAt(a);if(!o)return a;const s=nt(e,[o]);return this.clear(a,s)?s:a}path(e,t){const a=this.nearestCell(e),o=this.nearestCell(t);if(!a||!o)return[];const s=this.idx(a.c,a.r),i=this.idx(o.c,o.r);if(s===i)return[this.endPoint(t,i)];const r=this.cols*this.rows,h=new Float32Array(r).fill(1/0),l=new Int32Array(r).fill(-1),u=new Uint8Array(r);h[s]=0;const d=(D,Q)=>Math.hypot(D-o.c,Q-o.r),c=[],p=(D,Q)=>{c.push({i:D,f:Q});let B=c.length-1;for(;B>0;){const W=B-1>>1;if(c[W].f<=c[B].f)break;[c[W],c[B]]=[c[B],c[W]],B=W}},g=()=>{if(c.length===0)return;const D=c[0],Q=c.pop();if(c.length){c[0]=Q;let B=0;for(;;){const W=B*2+1,j=W+1;let I=B;if(W<c.length&&c[W].f<c[I].f&&(I=W),j<c.length&&c[j].f<c[I].f&&(I=j),I===B)break;[c[I],c[B]]=[c[B],c[I]],B=I}}return D};p(s,d(a.c,a.r));const m=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];let b=s,y=ht(this.centre(s),t),_=!1;for(;c.length;){const D=g();if(D.i===i){_=!0;break}if(u[D.i])continue;u[D.i]=1;const Q=ht(this.centre(D.i),t);Q<y&&(y=Q,b=D.i);const B=D.i%this.cols,W=(D.i-B)/this.cols;for(const[j,I,M]of m){const P=B+j,Y=W+I;if(!this.isWalkable(P,Y)||j!==0&&I!==0&&(!this.isWalkable(B+j,W)||!this.isWalkable(B,W+I)))continue;const J=this.idx(P,Y),de=h[D.i]+M;de<h[J]&&(h[J]=de,l[J]=D.i,p(J,de+d(P,Y)))}}const x=_?i:b;if(x===s)return[this.endPoint(t,s)];const T=[];let N=x;for(;N!==-1&&(T.push(N),N!==s);)N=l[N];T.reverse();const C=T.map(D=>this.centre(D));return this.smooth([e,...C,this.endPoint(t,x)])}smooth(e){const t=[],a=e.length-1;let o=0;for(;o<a;){let s=a;for(;s>o+1&&!this.clear(e[o],e[s]);)s--;t.push(e[s]),o=s}return t}clear(e,t){const a=Math.ceil(Math.hypot(t.x-e.x,t.y-e.y)/4);for(let o=1;o<a;o++){const s={x:e.x+(t.x-e.x)*o/a,y:e.y+(t.y-e.y)*o/a};if(!(this.inside(s)||this.nearEdge(s,1.5)))return!1}return!0}}const ie=[{id:"open",label:"Open"},{id:"close",label:"Close"},{id:"push",label:"Push"},{id:"pull",label:"Pull"},{id:"walk",label:"Walk to"},{id:"pickup",label:"Pick up"},{id:"talk",label:"Talk to"},{id:"give",label:"Give",twoObject:!0},{id:"use",label:"Use",twoObject:!0},{id:"look",label:"Look at"},{id:"turnon",label:"Turn on"},{id:"turnoff",label:"Turn off"}];ie.reduce((n,e)=>(n[e.id]=e.label,n),{});const gs="brasscompass.prefs.v1",Lr=3,ms="brasscompass.completed",$r=["slow","normal","fast","instant"],Dr=[1,1.25,1.5,1.75,2],Rr=["normal","long","xlong"],qr=["hold","toggle"],Pr=["high","medium","low"],Or={normal:1,long:1.6,xlong:2.4},Ga={slow:34,normal:62,fast:120,instant:1/0},Wr={slow:38,normal:70,fast:135,instant:1/0},Fr={textSpeed:null,waitForClick:!0,textScale:null,reducedMotion:null,highContrast:null,readingTime:"normal",revealMode:"hold",skipRead:!1,quality:"high"};function Br(){try{const n=JSON.parse(localStorage.getItem(gs)||"{}"),e=Dr.includes(n.textScale)?n.textScale:null,t=typeof n.v=="number"?n.v:1;return{textSpeed:$r.includes(n.textSpeed)?n.textSpeed:null,waitForClick:t>=3?n.waitForClick!==!1:!0,textScale:t>=2||e!==1?e:null,reducedMotion:typeof n.reducedMotion=="boolean"?n.reducedMotion:null,highContrast:typeof n.highContrast=="boolean"?n.highContrast:null,readingTime:Rr.includes(n.readingTime)?n.readingTime:"normal",revealMode:qr.includes(n.revealMode)?n.revealMode:"hold",skipRead:n.skipRead===!0,quality:Pr.includes(n.quality)?n.quality:"high"}}catch{return{...Fr}}}function Vr(n){try{localStorage.setItem(gs,JSON.stringify({v:Lr,...n}))}catch{}}function bs(n){return n<.55?1.5:n<.8?1.25:1}function Gr(n,e){return n.textScale??bs(e)}const qe=typeof matchMedia=="function"?matchMedia("(prefers-reduced-motion: reduce)"):null;function zr(){return(qe==null?void 0:qe.matches)??!1}function Kr(n){var e;(e=qe==null?void 0:qe.addEventListener)==null||e.call(qe,"change",n)}const Pe=typeof matchMedia=="function"?matchMedia("(prefers-contrast: more)"):null;function Ur(){return(Pe==null?void 0:Pe.matches)??!1}function Yr(n){var e;(e=Pe==null?void 0:Pe.addEventListener)==null||e.call(Pe,"change",n)}function pt(n){return n.highContrast??Ur()}let ws=!1;function jr(n){ws=n}function fe(){return ws}function ys(n){return n.reducedMotion??zr()}function ks(n,e=ys(n)){return e?"instant":n.textSpeed??"normal"}function xn(){try{return localStorage.getItem(ms)==="1"}catch{return!1}}function Xr(){try{localStorage.setItem(ms,"1")}catch{}}const Mt="rgba(240,208,142,",An={active:"rgba(46,35,17,0.5)",hover:"rgba(36,28,16,0.46)",rest:"rgba(4,7,14,0.42)"},En={pressed:"rgba(120,90,38,0.5)",lit:Mt+"0.5)",rest:Mt+"0.3)"},za={pressed:Mt+"0.34)",normal:"rgba(0,0,0,0.55)"},Ka={lit:Mt+"0.8)",rest:Mt+"0.5)"},Qr=Math.PI*2;function pn(n,e,t,a,o,s={}){const i=s.radius??0,r=s.hover||s.active,h=e+2,l=t+2,u=a-4,d=o-4;n.save(),s.bare||(n.fillStyle=s.active?An.active:s.hover?An.hover:An.rest,i>0?(Zr(n,h,l,u,d,Math.max(0,i-2)),n.fill()):n.fillRect(h,l,u,d));const c=3.5+i*.55,p=s.active===!0,g=p?En.pressed:r?En.lit:En.rest,m=p?za.pressed:za.normal;if(n.lineWidth=1,n.lineCap="butt",n.strokeStyle=g,n.beginPath(),n.moveTo(e+c,t+2.5),n.lineTo(e+a-c,t+2.5),n.moveTo(e+2.5,t+c),n.lineTo(e+2.5,t+o-c),n.stroke(),n.strokeStyle=m,n.beginPath(),n.moveTo(e+c,t+o-2.5),n.lineTo(e+a-c,t+o-2.5),n.moveTo(e+a-2.5,t+c),n.lineTo(e+a-2.5,t+o-c),n.stroke(),s.rivets&&a>=90&&o>=30){n.fillStyle=r?Ka.lit:Ka.rest;const b=5.5+i*.3;n.beginPath();for(let y=0;y<4;y++){const _=y&1?e+a-b:e+b,x=y&2?t+o-b:t+b;n.moveTo(_+1.25,x),n.arc(_,x,1.25,0,Qr)}n.fill()}n.restore()}const Jr="rgba(255,226,160,0.16)";function Zr(n,e,t,a,o,s){const i=Math.min(s,a/2,o/2);n.beginPath(),n.moveTo(e+i,t),n.lineTo(e+a-i,t),n.quadraticCurveTo(e+a,t,e+a,t+i),n.lineTo(e+a,t+o-i),n.quadraticCurveTo(e+a,t+o,e+a-i,t+o),n.lineTo(e+i,t+o),n.quadraticCurveTo(e,t+o,e,t+o-i),n.lineTo(e,t+i),n.quadraticCurveTo(e,t,e+i,t),n.closePath()}const ve=8;function gn(n){return Math.max(1,Math.ceil(n/ve))}function vs(n){const e=Math.min(n.page,gn(n.inventory.length)-1);return n.inventory.slice(e*ve,e*ve+ve)}const He=q,eh=40,sa=152,th=6;function ka(n){const e=Math.round(40+(Math.min(n,1.5)-1)*28),t=n>1?6:8,a=n>1?888:892,o=a+2*e+t+(n>1?6:12),s=Math.round(Math.min(34,27*n));return{vy:a,vh:e,gap:t,sentY:o,line1:s,line2:Math.round(Math.min(23,20*n)),line2Y:o+s+(n>1?3:11)}}const ze=40,Ut=940,_s=1010,nh=918,ia=205,Ua=68,on=8,ah=96,oh=58,Ae={verb:"#d6caa8",verbHover:"#fff6dc",verbActive:"#e8c98a",sentence:"#7fd6d0",narration:"#d8cfb8",gold:"#c9a24a"};function Ts(n,e=1){const t=ka(e),a=n%6,o=Math.floor(n/6);return{x:eh+a*(sa+th),y:t.vy+o*(t.vh+t.gap),w:sa,h:t.vh}}function sn(n,e,t,a,o,s="normal"){for(;a>o&&(n.font=`${s} ${a}px Georgia, "Times New Roman", serif`,!(n.measureText(e).width<=t));a--);return a}function he(n,e,t,a,o,s="normal"){const i=Math.max(1,Math.min(Math.round(o),Math.round(a))),r=sn(n,e,t,Math.max(1,Math.round(a)),i,s);if(n.font=`${s} ${r}px Georgia, "Times New Roman", serif`,n.measureText(e).width<=t)return{text:e,size:r};let h=e;for(;h.length>1&&(h=h.slice(0,-1).trimEnd(),!(n.measureText(`${h}…`).width<=t)););return{text:`${h}…`,size:r}}function rn(n){const e=n%4,t=Math.floor(n/4);return{x:_s+e*(ia+on),y:nh+t*(Ua+on),w:ia,h:Ua}}function Ya(n){return rn(n%ve)}const Yt={x:1680,y:880,w:44,h:34},ra={x:1780,y:880,w:44,h:34},ke={prev:"page:prev",next:"page:next"};function Rt(n){return n===ke.prev||n===ke.next}function at(n,e,t){return n>=t.x&&n<=t.x+t.w&&e>=t.y&&e<=t.y+t.h}function qt(n,e,t){if(e<He)return null;for(let s=0;s<ie.length;s++)if(at(n,e,Ts(s,t.scale)))return{kind:"verb",id:ie[s].id};const a=vs(t);for(let s=0;s<a.length;s++)if(at(n,e,rn(s)))return{kind:"item",id:a[s].id};if(gn(t.inventory.length)>1){if(at(n,e,Yt))return{kind:"page",delta:-1};if(at(n,e,ra))return{kind:"page",delta:1}}const o=ka(t.scale);return at(n,e,{x:ze,y:o.sentY-8,w:Ut,h:V-o.sentY+8})?{kind:"sentence"}:null}const gt=new Map;function ha(n,e,t,a){const o=`${ya(a)}|${t}|${e}`;let s=gt.get(o);return s||(s=je(n,e,t,a),gt.size>160&&gt.delete(gt.keys().next().value),gt.set(o,s)),s}function Is(n,e,t,a,o,s){let i=t;for(let r=0;r<e.length&&i>0;r++){const h=e[r];K(n,i>=h.length?h:h.slice(0,i),a,o+r*s.lineHeight,s),i-=h.length+1}}const ja=new WeakMap;function sh(n){let e=ja.get(n);if(!e){const t=n.createLinearGradient(0,He,0,V);t.addColorStop(0,"rgba(10,14,24,0.96)"),t.addColorStop(1,"rgba(4,6,12,0.99)");const a=n.createLinearGradient(0,He,0,He+26);a.addColorStop(0,"rgba(0,0,0,0.55)"),a.addColorStop(1,"rgba(0,0,0,0)"),e={back:t,shade:a},ja.set(n,e)}return e}function ih(n,e){const t=sh(n);n.fillStyle=t.back,n.fillRect(0,He,S,V-He),n.strokeStyle="rgba(201,162,74,0.5)",n.lineWidth=2,n.beginPath(),n.moveTo(0,He+1),n.lineTo(S,He+1),n.stroke(),n.fillStyle=t.shade,n.fillRect(0,He,S,26),hh(n,e);const a=dh(n,e);return ch(n,e),{narrationBox:a}}const Xa=new Map;function rh(n,e){let t=Xa.get(e);if(t===void 0){const a=sa-(e>1?40:20);t=Math.round(21*e);for(const o of ie)t=Math.min(t,sn(n,o.label,a,Math.round(21*e),16,"bold"));Xa.set(e,t)}return t}function hh(n,e){ie.forEach((t,a)=>{const o=Ts(a,e.scale),s=e.verb===t.id,i=e.hoverVerb===t.id,r=e.focusVerb===t.id,h=!s&&e.suggestVerb===t.id,l=fe();n.fillStyle=l?"rgba(130,160,180,0.16)":"rgba(130,160,180,0.07)",n.fillRect(o.x,o.y,o.w,o.h),n.strokeStyle=l?"rgba(214,226,236,0.9)":"rgba(160,184,198,0.42)",n.lineWidth=l?2:1,n.strokeRect(o.x+n.lineWidth/2,o.y+n.lineWidth/2,o.w-n.lineWidth,o.h-n.lineWidth),l||pn(n,o.x,o.y,o.w,o.h,{hover:i||h,active:s,rivets:!0}),s?(n.fillStyle="rgba(201,162,74,0.16)",n.fillRect(o.x,o.y,o.w,o.h),n.strokeStyle="rgba(232,201,138,0.55)",n.lineWidth=1.5,n.strokeRect(o.x+.75,o.y+.75,o.w-1.5,o.h-1.5)):h?(n.fillStyle="rgba(232,201,138,0.13)",n.fillRect(o.x,o.y,o.w,o.h),n.strokeStyle="rgba(232,201,138,0.8)",n.lineWidth=1.5,n.strokeRect(o.x+.75,o.y+.75,o.w-1.5,o.h-1.5)):i&&(n.fillStyle="rgba(255,255,255,0.06)",n.fillRect(o.x,o.y,o.w,o.h)),r&&(n.strokeStyle="#fff3cf",n.lineWidth=l?4:2.5,n.strokeRect(o.x+3,o.y+3,o.w-6,o.h-6));const u=s?"bold":"normal",d=rh(n,e.scale);l||K(n,t.label,o.x+(e.scale>1?o.w/2:14),o.y+Math.round((o.h-d)/2),{size:d,color:Jr,weight:u,align:e.scale>1?"center":"left",shadow:!1}),K(n,t.label,o.x+(e.scale>1?o.w/2:14),o.y+Math.round((o.h-d)/2)-1,{size:d,color:r||s||h?Ae.verbActive:i||l?Ae.verbHover:Ae.verb,weight:u,align:e.scale>1?"center":"left",shadow:!1})})}function lh(n,e){const t=e.narrationAlpha??1;if(!e.narration||t<=.001)return null;const a=Math.round(27*e.scale),o=Math.round(a*1.34),s={size:a,color:fe()?"#fffaf0":Ae.narration,lineHeight:o},i=e.narrationFull??e.narration,r=ha(n,i,1560,s),h=Math.max(Math.round(84*e.scale),r.length*o+48),l=Math.max(64,q-h-4),u=n.createLinearGradient(0,l,0,l+h);return u.addColorStop(0,"rgba(3,7,13,0)"),u.addColorStop(.22,fe()?"rgba(0,0,0,0.88)":"rgba(3,7,13,0.7)"),u.addColorStop(1,fe()?"rgba(0,0,0,0.98)":"rgba(3,7,13,0.95)"),n.save(),n.globalAlpha=t,n.fillStyle=u,n.fillRect(0,l,S,h),n.strokeStyle="rgba(232,201,138,0.16)",n.lineWidth=1,n.beginPath(),n.moveTo(150,l+1),n.lineTo(S-150,l+1),n.stroke(),Is(n,r,e.narration.length,150,l+22,s),n.restore(),{x:140,y:l,w:1640,h}}function dh(n,e){const t=ka(e.scale),a=lh(n,e),o=e.verb?ie.find(c=>c.id===e.verb):void 0,s=(o==null?void 0:o.label)??"",i=e.objA??"",r=e.objB??"",h=e.verb==="give"?"to":"with",l=[s,i].filter(Boolean).join(" "),u=e.target&&e.target!==i?e.target:null,d=!l||r||!u?null:i?o!=null&&o.twoObject?` ${h} ${u}`:null:` ${u}`;{const c=fe(),p=r?t.line2Y+Math.round(Math.min(28,25*e.scale))+12:t.sentY+t.line1+16,g=ze-12,m=t.sentY-6,b=Ut+24,y=Math.min(V-8,p)-m;n.save(),n.fillStyle="rgba(5,9,16,0.58)",n.fillRect(g,m,b,y),n.strokeStyle=c?"rgba(232,201,138,0.8)":"rgba(201,162,74,0.34)",n.lineWidth=c?2:1,n.strokeRect(g+n.lineWidth/2,m+n.lineWidth/2,b-n.lineWidth,y-n.lineWidth),c||pn(n,g,m,b,y,{bare:!0,rivets:!0}),n.restore()}if(l){const c=sn(n,l+(d??""),Ut,t.line1,20,"bold");K(n,l,ze,t.sentY+4,{size:c,color:Ae.sentence,weight:"bold"}),n.font=`bold ${c}px Georgia, "Times New Roman", serif`;const p=ze+n.measureText(l).width;d?K(n,d,p,t.sentY+4,{size:c,color:"#ecd29a",weight:"bold"}):o!=null&&o.twoObject&&i&&!r&&K(n,` ${h} …`,p,t.sentY+4,{size:c,color:fe()?"#f4e2b4":"rgba(236,210,154,0.78)",weight:"bold"})}else e.suggestLine&&(n.fillStyle="rgba(232,201,138,0.85)",n.beginPath(),n.arc(ze+7,t.sentY+18,3.5,0,Math.PI*2),n.fill(),K(n,e.suggestLine,ze+22,t.sentY+4,{size:sn(n,e.suggestLine,Ut-22,t.line1,20,"bold"),color:"#ecd29a",weight:"bold"}));return r&&K(n,`${h} ${r}`,ze,t.line2Y,{size:Math.round(Math.min(28,25*e.scale)),color:Ae.sentence}),a}function xt(n,e,t,a,o,s){const i=Math.min(s,a/2,o/2);n.beginPath(),n.moveTo(e+i,t),n.lineTo(e+a-i,t),n.quadraticCurveTo(e+a,t,e+a,t+i),n.lineTo(e+a,t+o-i),n.quadraticCurveTo(e+a,t+o,e+a-i,t+o),n.lineTo(e+i,t+o),n.quadraticCurveTo(e,t+o,e,t+o-i),n.lineTo(e,t+i),n.quadraticCurveTo(e,t,e+i,t),n.closePath()}function ch(n,e){const t=gn(e.inventory.length),a=Math.max(0,Math.min(e.page,t-1)),o=_s-6,s=879,i=4*(ia+on)-on+12;n.save();const r=n.createLinearGradient(0,s,0,s+34);if(r.addColorStop(0,"rgba(50,36,23,0.92)"),r.addColorStop(1,"rgba(26,18,12,0.94)"),n.fillStyle=r,xt(n,o,s,i,34,5),n.fill(),n.strokeStyle="rgba(201,162,74,0.26)",n.lineWidth=1,n.stroke(),n.setLineDash([2,4]),n.strokeStyle="rgba(232,201,138,0.18)",n.beginPath(),n.moveTo(o+34,s+7),n.lineTo(o+i-12,s+7),n.moveTo(o+34,s+27),n.lineTo(o+i-12,s+27),n.stroke(),n.setLineDash([]),n.beginPath(),n.arc(o+18,s+17,9,0,Math.PI*2),n.strokeStyle="rgba(232,201,138,0.7)",n.lineWidth=1.4,n.stroke(),n.fillStyle="rgba(201,162,74,0.16)",n.fill(),n.fillStyle="#d9b877",n.beginPath(),n.moveTo(o+18,s+10),n.lineTo(o+22,s+17),n.lineTo(o+18,s+24),n.lineTo(o+14,s+17),n.closePath(),n.fill(),n.restore(),t>1){const l=(p,g,m,b)=>{n.fillStyle=m?"rgba(232,201,138,0.1)":"rgba(255,255,255,0.025)",n.fillRect(p.x,p.y,p.w,p.h),n.strokeStyle=m?"rgba(232,201,138,0.5)":"rgba(232,201,138,0.16)",n.lineWidth=1,n.strokeRect(p.x+.5,p.y+.5,p.w-1,p.h-1),b&&(n.strokeStyle="#fff3cf",n.lineWidth=fe()?4:2.5,n.strokeRect(p.x+3,p.y+3,p.w-6,p.h-6));const y=Math.min(34,Math.round(26*Math.max(1,e.scale)));K(n,g,p.x+p.w/2,p.y+Math.round((p.h-y)/2)-2,{size:y,color:m?"#f0d9a0":fe()?"rgba(214,204,176,0.6)":"rgba(201,180,140,0.38)",align:"center",shadow:!1})};l(Yt,"‹",a>0,e.focusItem===ke.prev),l(ra,"›",a<t-1,e.focusItem===ke.next);const u=(Yt.x+Yt.w+ra.x)/2,d=11,c=u-(t-1)*d/2;for(let p=0;p<t;p++)n.beginPath(),n.arc(c+p*d,894,p===a?3.4:2.2,0,Math.PI*2),n.fillStyle=p===a?"#e8c98a":"rgba(232,201,138,0.3)",n.fill()}for(let l=0;l<ve;l++)Qa(n,rn(l),!1,!1,!1);vs(e).forEach((l,u)=>{var _;const d=rn(u),c=e.selectedItem===l.id,p=c||e.hoverItem===l.id,g=e.focusItem===l.id,m=((_=e.fresh)==null?void 0:_[l.id])??0;if(Qa(n,d,p,g,!0),m>0){const x=e.reduced?1:.7+.3*Math.sin((e.time??0)*5.5);n.fillStyle=`rgba(232,201,138,${(.16*m*x).toFixed(3)})`,n.fillRect(d.x,d.y,d.w,d.h),n.strokeStyle=`rgba(255,226,160,${(.85*m*x).toFixed(3)})`,n.lineWidth=2.5,n.strokeRect(d.x-1,d.y-1,d.w+2,d.h+2)}c&&(n.fillStyle=Ae.gold,n.fillRect(d.x,d.y,4,d.h));const b=l.icon&&l.icon.width>0?l.icon:null,y=p||g;if(b){const x=Math.min(ah/b.width,oh/b.height),T=b.width*x,N=b.height*x;n.save(),n.globalAlpha=y?.22:1,n.drawImage(b,d.x+(d.w-T)/2,d.y+(d.h-N)/2,T,N),n.restore()}else y||(n.save(),n.translate(d.x+d.w/2,d.y+d.h/2),n.strokeStyle="rgba(201,162,74,0.7)",n.lineWidth=1.4,n.beginPath(),n.arc(0,0,9,0,Math.PI*2),n.stroke(),n.fillStyle="rgba(232,201,138,0.85)",n.beginPath(),n.arc(0,0,3,0,Math.PI*2),n.fill(),n.restore());if(y){let x=Math.round(18*e.scale),T=ha(n,l.name,d.w-20,{size:x});for(;x>13&&(T.length>2||T.length*(x+4)>d.h-12);)x--,T=ha(n,l.name,d.w-20,{size:x});const N=x+4,C=d.y+Math.round((d.h-Math.min(2,T.length)*N)/2)+1;T.slice(0,2).forEach((D,Q)=>{K(n,D,d.x+d.w/2,C+Q*N,{size:x,color:"#fff3d6",align:"center",shadow:!1})})}})}function Qa(n,e,t,a,o){const s=n.createLinearGradient(0,e.y,0,e.y+e.h);o?(s.addColorStop(0,t?"rgba(74,53,31,0.92)":"rgba(48,34,21,0.9)"),s.addColorStop(1,t?"rgba(40,28,18,0.94)":"rgba(23,16,11,0.94)")):(s.addColorStop(0,"rgba(28,20,14,0.5)"),s.addColorStop(1,"rgba(15,11,8,0.6)")),n.save(),xt(n,e.x,e.y,e.w,e.h,6),n.fillStyle=s,n.fill(),n.setLineDash([3,4]),n.strokeStyle=t?"rgba(232,201,138,0.5)":fe()?"rgba(232,201,138,0.8)":"rgba(201,162,74,0.2)",n.lineWidth=fe()?1.5:1,n.stroke(),n.setLineDash([]),n.strokeStyle="rgba(255,231,190,0.05)",n.beginPath(),n.moveTo(e.x+8,e.y+3),n.lineTo(e.x+e.w-8,e.y+3),n.stroke(),o&&pn(n,e.x,e.y,e.w,e.h,{hover:t,radius:6,rivets:!0,bare:!0}),a&&(n.strokeStyle="#fff3cf",n.lineWidth=fe()?4:2.5,xt(n,e.x+3,e.y+3,e.w-6,e.h-6,4),n.stroke()),n.restore()}function Cn(n,e,t,a,o=!1,s=1,i=null){o&&(n.save(),n.strokeStyle="rgba(239,139,110,0.9)",n.lineWidth=2,n.beginPath(),n.arc(e+14,t+16,9,0,Math.PI*2),n.moveTo(e+9,t+11),n.lineTo(e+19,t+21),n.moveTo(e+19,t+11),n.lineTo(e+9,t+21),n.stroke(),n.restore())}const mt=new Map;function uh(n,e,t,a=1,o=!0){const s=`${a}|${o}|${e}|${t.join("")}`,i=mt.get(s);if(i)return i;const r=o?386:110,h=o?1430:1700;let l=Math.round(27*a),u=38,d=[],c=[],p=[],g=0;const m=Math.round(16*a),b=76+Math.round(12*(a-1));do{u=l+Math.round(11*Math.min(a,1.25)),d=je(n,e,h,{size:l}),c=t.map(C=>je(n,C,h-64,{size:l-2})),p=c.map(C=>Math.max(48,C.length*u+m));const N=p.reduce((C,D)=>C+D+6,0);if(g=Math.max(400,b+d.length*u+28+N+16),g<=1040||l<=20)break;l--}while(!0);const y=Math.max(20,1060-g),_=y+b;let x=_+d.length*u+30;const T={top:y,height:g,size:l,lineHeight:u,bodyY:_,textX:r,textW:h,column:o,lines:d,choiceLines:c,rects:p.map(N=>{const C={x:r,y:x,w:h,h:N};return x+=N+6,C})};return mt.size>48&&mt.delete(mt.keys().next().value),mt.set(s,T),T}const bt=(n,e,t,a)=>e+(n-e)*Math.exp(-t/a),va=n=>1-(1-n)*(1-n)*(1-n);class fh{constructor(){f(this,"appear",0);f(this,"top",null);f(this,"portrait",null);f(this,"prev",null);f(this,"mix",1);f(this,"spot",null);f(this,"open",0)}reset(){this.appear=0,this.top=null,this.portrait=this.prev=null,this.mix=1,this.spot=null,this.open=0}update(e,t,a,o,s){if(a!==this.portrait&&(this.prev=this.portrait,this.portrait=a,this.mix=this.prev&&!s?0:1),s){this.appear=1,this.top=t.top,this.mix=1,this.prev=null,this.spot=o,this.open=o?1:0;return}this.appear=Math.min(1,this.appear+e/.28),this.top=this.top===null?t.top:bt(this.top,t.top,e,.07),Math.abs(this.top-t.top)<.5&&(this.top=t.top),this.mix=Math.min(1,this.mix+e/.22),this.mix>=1&&(this.prev=null),o?(!this.spot||this.open<.02?this.spot={...o}:(this.spot.x=bt(this.spot.x,o.x,e,.12),this.spot.y=bt(this.spot.y,o.y,e,.12),this.spot.rx=bt(this.spot.rx,o.rx,e,.12),this.spot.ry=bt(this.spot.ry,o.ry,e,.12)),this.open=Math.min(1,this.open+e/.35)):this.open=Math.max(0,this.open-e/.25)}offset(e){return(this.top??e.top)-e.top+this.rise()}rise(){return(1-va(this.appear))*26}}const la={soft:.34,strong:.72},Ja={soft:null,strong:null};function ph(n){const e=n?"strong":"soft",t=Ja[e];if(t)return t;const a=la[e],o=document.createElement("canvas");o.width=o.height=256;const s=o.getContext("2d"),i=s.createRadialGradient(128,128,0,128,128,128);return i.addColorStop(0,`rgba(2,4,10,${(a*.11).toFixed(3)})`),i.addColorStop(.5,`rgba(2,4,10,${(a*.3).toFixed(3)})`),i.addColorStop(.82,`rgba(2,4,10,${(a*.8).toFixed(3)})`),i.addColorStop(1,`rgba(2,4,10,${a})`),s.fillStyle=i,s.fillRect(0,0,256,256),Ja[e]=o,o}const Za={soft:`rgba(2,4,10,${la.soft})`,strong:`rgba(2,4,10,${la.strong})`};function gh(n,e,t){const a=fe();if(n.fillStyle=a?Za.strong:Za.soft,!e||t<=.01){n.fillRect(0,0,S,V);return}const o=va(t),s=e.rx*o,i=e.ry*o,r=e.x-s,h=e.y-i,l=e.x+s,u=e.y+i;n.fillRect(0,0,S,Math.max(0,h)),n.fillRect(0,u,S,Math.max(0,V-u)),n.fillRect(0,h,Math.max(0,r),u-h),n.fillRect(l,h,Math.max(0,S-l),u-h),n.drawImage(ph(a),r,h,l-r,u-h)}function eo(n,e,t,a){if(a<=0)return;n.save(),n.globalAlpha*=a,n.beginPath(),n.rect(t.x,t.y,t.w,t.h),n.clip();const o=Math.max(t.w/e.width,t.h/e.height);n.drawImage(e,t.x+(t.w-e.width*o)/2,t.y+(t.h-e.height*o)/2,e.width*o,e.height*o),n.restore()}function mh(n,e,t,a){const o=e.x+e.w/2,s=e.y+Math.min(e.h,248)/2+20,i=74;if(n.save(),n.fillStyle="rgba(19,33,46,0.9)",n.strokeStyle=a,n.globalAlpha*=.85,n.lineWidth=2,n.beginPath(),n.arc(o,s,i,0,Math.PI*2),n.fill(),n.stroke(),n.beginPath(),n.arc(o,s,i-8,0,Math.PI*2),n.globalAlpha*=.5,n.stroke(),n.restore(),t){K(n,t,o,s-38,{size:76,color:a,align:"center",weight:"bold",shadow:!1});return}n.save(),n.fillStyle=a,n.globalAlpha*=.8,n.beginPath();for(let r=0;r<8;r++){const h=r*Math.PI/4-Math.PI/2,l=r%2?14:52,u=o+Math.cos(h)*l,d=s+Math.sin(h)*l;r?n.lineTo(u,d):n.moveTo(u,d)}n.closePath(),n.fill(),n.restore()}function bh(n,e){const t=e.layout,a=e.stage??null;gh(n,(a==null?void 0:a.spot)??null,(a==null?void 0:a.open)??0);const o=a?a.offset(t):0,s=a?a.rise():0;n.save(),n.globalAlpha=a?va(a.appear):1;const i=t.top+o,r=t.top+t.height+s,h=n.createLinearGradient(0,i,0,r);h.addColorStop(0,"rgba(3,6,12,0)");const l=fe();if(h.addColorStop(.16,l?"rgba(3,6,12,0.55)":"rgba(3,6,12,0.42)"),h.addColorStop(.46,l?"rgba(3,6,12,0.9)":"rgba(3,6,12,0.84)"),h.addColorStop(1,"rgba(2,4,9,0.98)"),n.fillStyle=h,n.fillRect(0,i,S,r-i),n.save(),n.beginPath(),n.rect(0,i,S,r-i),n.clip(),n.translate(0,o),t.column){const u={x:92,y:t.top+34,w:238,h:Math.min(326,t.height-68)},d=a?a.mix:1;n.save(),xt(n,u.x,u.y,u.w,u.h,3),n.clip(),a!=null&&a.prev&&eo(n,a.prev,u,1-d),e.portrait?eo(n,e.portrait,u,d):e.monogram!==void 0&&e.monogram!==null&&(n.save(),n.globalAlpha*=d,mh(n,u,e.monogram,e.speakerAccent??"#e8c98a"),n.restore()),n.restore(),n.save(),xt(n,u.x+.5,u.y+.5,u.w-1,u.h-1,3),n.strokeStyle="rgba(232,201,138,0.28)",n.lineWidth=1,n.stroke(),n.restore()}if(e.speaker){const u=e.speaker.toUpperCase(),d=Math.round(Math.min(26,20*e.scale));K(n,u,t.textX,t.top+30,{size:d,color:e.speakerAccent??"#edce91",weight:"bold",shadow:!1}),n.save(),n.font=`bold ${d}px Georgia, "Times New Roman", serif`;const c=n.measureText(u).width;n.strokeStyle="rgba(232,201,138,0.32)",n.lineWidth=1,n.beginPath(),n.moveTo(t.textX+c+20,t.top+30+d*.62),n.lineTo(t.textX+t.textW,t.top+30+d*.62),n.stroke(),n.restore()}Is(n,t.lines,fs(e.text,e.reveal).length,t.textX,t.bodyY,{size:t.size,color:"#f0e7d6",lineHeight:t.lineHeight}),e.choices.forEach((u,d)=>{const c=t.rects[d],p=e.hoverIndex===d,g=!!u.seen&&!p;if(p){const b=n.createLinearGradient(c.x,0,c.x+c.w,0);b.addColorStop(0,"rgba(232,201,138,0.14)"),b.addColorStop(.7,"rgba(232,201,138,0.04)"),b.addColorStop(1,"rgba(232,201,138,0)"),n.fillStyle=b,n.fillRect(c.x,c.y,c.w,c.h),n.fillStyle="#e8c98a",n.fillRect(c.x,c.y+4,2,c.h-8)}n.strokeStyle=p?"rgba(232,201,138,0.35)":"rgba(232,201,138,0.12)",n.lineWidth=1,n.beginPath(),n.moveTo(c.x+30,c.y+c.h-1),n.lineTo(c.x+c.w,c.y+c.h-1),n.stroke(),n.save(),n.translate(c.x+14,c.y+c.h/2),n.rotate(Math.PI/4),n.strokeStyle=p?"#ffe6a8":"rgba(232,201,138,0.55)",n.fillStyle=p?"#e8c98a":"rgba(232,201,138,0.08)",n.lineWidth=1.2,n.fillRect(-4,-4,8,8),n.strokeRect(-4,-4,8,8),n.restore();const m=Math.round(8*e.scale+(t.lineHeight-(t.size-2))/2);(t.choiceLines[d]??[]).forEach((b,y)=>{K(n,b,c.x+40,c.y+m-2+y*t.lineHeight,{size:t.size-2,color:p?"#fffaf0":g?"#8b928c":"#d3cbbb",shadow:!1})})}),n.restore(),n.restore()}function Hn(n,e,t){const a=t.stage?t.stage.offset(t.layout):0,o=t.layout.rects.findIndex(s=>at(n,e-a,s));return o<0?null:o}const to={0:{key:"Enter"},1:{key:"Escape"},2:{key:"q"},3:{key:"h"},4:{key:"PageUp",repeats:!0},5:{key:"PageDown",repeats:!0},6:{key:"j"},7:{key:"l"},8:{key:"a"},9:{key:"Pause"},10:{key:"Tab",shift:!0,repeats:!0},11:{key:"Tab",repeats:!0},12:{key:"ArrowUp",repeats:!0},13:{key:"ArrowDown",repeats:!0},14:{key:"ArrowLeft",repeats:!0},15:{key:"ArrowRight",repeats:!0}},wh=.55,yh=420,kh=130,vh=[["Controller: D-pad or left stick","Move between things, verbs, the satchel and answers"],["Controller: A / B","Enter (do it, choose) / Escape (cancel, leave a conversation)"],["Controller: X / Y","Reveal what you can interact with / a tip"],["Controller: LB / RB","Turn the satchel's pages"],["Controller: LT / RT / Select","Chart / line history / map"],["Controller: Start","Pause, and resume"],["Controller: stick click","Move between the scene, the verbs and the satchel"]];function no(){return{held:new Map}}function _h(n){const e=new Map;n.buttons.forEach((o,s)=>{const i=to[s];o&&i&&e.set(`b${s}`,i)});const t=n.axes[0]??0,a=n.axes[1]??0;if(Math.max(Math.abs(t),Math.abs(a))>=wh){const o=Math.abs(t)>Math.abs(a)?t<0?14:15:a<0?12:13;e.set(`s${o}`,to[o])}return e}function Th(n,e,t){const a=[],o=_h(e),s=new Set;for(const[i,r]of o){const h=`${r.shift?"+":""}${r.key}`;if(s.has(h)){o.delete(i);continue}s.add(h)}for(const[i,r]of o){const h=n.held.get(i);h?t>=h.next&&(a.push({type:"down",key:r.key,shift:!!r.shift,repeat:!0}),h.next=t+kh):(a.push({type:"down",key:r.key,shift:!!r.shift,repeat:!1}),n.held.set(i,{binding:r,next:r.repeats?t+yh:1/0}))}for(const[i,r]of[...n.held])o.has(i)||(n.held.delete(i),a.push({type:"up",key:r.binding.key,shift:!!r.binding.shift,repeat:!1}));return a}function Ih(n){const e=[];for(const t of n.held.values())e.push({type:"up",key:t.binding.key,shift:!!t.binding.shift,repeat:!1});return n.held.clear(),e}function ao(n){return n.mapping==="standard"}function Sh(n){const e=n.key==="ArrowDown"||n.key==="ArrowRight",t=n.key==="ArrowUp"||n.key==="ArrowLeft";return e||t?{...n,key:"Tab",shift:t}:n}class Mh{constructor(e){f(this,"state",no());f(this,"active",new Set);f(this,"unsupported",new Set);this.hooks=e,!(typeof window>"u")&&(window.addEventListener("gamepadconnected",t=>{const a=t.gamepad;if(!this.active.has(a.index)){if(!ao(a)){this.unsupported.has(a.index)||(this.unsupported.add(a.index),this.hooks.announce("Controller connected, but its layout is not supported. Use the keyboard or mouse."));return}this.active.add(a.index),this.hooks.announce("Controller connected. Use the D-pad to move, A to choose, B to go back, Start to pause.")}}),window.addEventListener("gamepaddisconnected",t=>{const a=t.gamepad.index;if(this.unsupported.delete(a),!!this.active.delete(a)){for(const s of Ih(this.state))this.hooks.press(s);this.state=no(),this.active.size||this.hooks.announce("Controller disconnected.")}}))}get connected(){return this.active.size>0}poll(e){var s;if(!this.active.size)return;const a=(((s=navigator.getGamepads)==null?void 0:s.call(navigator))??[]).find(i=>!!(i&&i.connected&&ao(i)&&this.active.has(i.index)));if(!a)return;const o={buttons:a.buttons.map(i=>i.pressed),axes:[...a.axes]};for(const i of Th(this.state,o,e))this.hooks.press(i)}}function xh(n,e=!1){if(typeof document>"u")return;const t=document.activeElement,a=t instanceof HTMLSelectElement||t instanceof HTMLInputElement&&t.type==="range";e&&!(a&&(n.key==="ArrowLeft"||n.key==="ArrowRight"))&&(n=Sh(n));const o=t&&t!==document.body?t:window;if(n.type==="down"&&t&&t!==document.body){if(n.key==="Enter"&&t.matches("button, summary, a[href]")){t.click();return}if(t instanceof HTMLSelectElement&&(n.key==="ArrowLeft"||n.key==="ArrowRight")){const i=t.selectedIndex+(n.key==="ArrowLeft"?-1:1);i>=0&&i<t.options.length&&(t.selectedIndex=i,t.dispatchEvent(new Event("change",{bubbles:!0})));return}if(t instanceof HTMLInputElement&&t.type==="range"&&(n.key==="ArrowLeft"||n.key==="ArrowRight")){n.key==="ArrowLeft"?t.stepDown():t.stepUp(),t.dispatchEvent(new Event("input",{bubbles:!0}));return}}const s=new KeyboardEvent(n.type==="down"?"keydown":"keyup",{key:n.key,shiftKey:n.shift,repeat:n.repeat,bubbles:!0,cancelable:!0});Object.defineProperty(s,"__pad",{value:!0}),o.dispatchEvent(s)}const pe={reveal:"Q",history:"L",tip:"H",chart:"J",map:"A",pause:"Escape",mute:"M",pagePrev:"PageUp",pageNext:"PageDown"},Ah=[["Left-click a thing","Do the obvious: talk, take, open, look (the lit-up verb)"],["Right-click a thing","Look at it"],["Right-click elsewhere","Cancel the sentence, or leave a conversation"],["Click a verb, then a thing","Do exactly that (Use and Give take two)"],["Click the floor","Walk; double-click to run"],["Click the arrow over a way out","Walk to it and go through"],["Double-click a doorway","Leave at once"],["Hold Q, or the Reveal button","Show everything you can interact with (Settings: Reveal key can make Q a switch)"],["Tab / Shift+Tab","Keyboard play: move between the scene, the verbs and the inventory"],["Arrows, then Enter","Move within the scene, verbs or inventory, and act"],["Focus a way out, then Enter","Walk to it and go through"],[`${pe.pagePrev} / ${pe.pageNext}`,"Turn the satchel's pages"],["1–9, or arrows and Enter","Choose in a conversation"],["Click, Enter or Space","Skip a line that is typing"],["Hold Ctrl (or ])","Fast-forward lines you have already read"],[pe.tip,"A tip for what to do next"],[pe.chart,"Chart — everything you have learned"],[pe.map,"Map — the island chart, its areas, and travel"],[pe.history,"Line history — the last 30 lines"],[pe.mute,"Mute or unmute the sound"],["Escape","Cancel what you are doing; again for pause and settings"],["C / E (at the title)","Continue the saved voyage, or open Chapter select"],["R (in Chapter select)","Reopen the scene list"],...vh,["Touch: tap a thing","Shows its name and what a tap would do; tap again to act"],["Touch: tap an arrow","Names the way out; tap again to walk to it and go through"],["Touch: long-press","Look at (like right-click)"],["Touch: tap a top-bar icon","Names the plate; tap it again to do its job"]];function Eh(n){return!(n instanceof HTMLElement)||!n.isConnected||n===document.body||n===document.documentElement||n.closest("[hidden]")||n.getAttribute("aria-hidden")==="true"||n.hasAttribute("disabled")?!1:n.getClientRects().length>0}function Le(n){if(typeof document>"u")return;const e=document.getElementById("game"),t=[n,e].find(Eh);t==null||t.focus({preventScroll:!0})}function Ch(){return`<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".85"/>
    <circle cx="24" cy="24" r="15.5" fill="none" stroke="currentColor" stroke-width=".8" opacity=".45"/>
    <path d="M24 8.5 27 21l12.5 3L27 27l-3 12.5L21 27 8.5 24 21 21Z" fill="currentColor" opacity=".92"/>
    <circle cx="24" cy="24" r="2.2" fill="#0b1422"/>
  </svg>`}function Pt(n){return`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${{sound:`<path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" opacity=".9"/>
      <path d="M16.5 8.5a5.5 5.5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,text:`<path d="M5 4.5h9.5L19 9v10.5H5Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M14 4.5V9h4.5M8 12.5h8M8 15.5h6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,display:`<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,voyage:`<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.3"/>
      <path d="M12 3.5v5.9M12 14.6v5.9M3.5 12h5.9M14.6 12h5.9M6 6l3.2 3.2M14.8 14.8 18 18M18 6l-3.2 3.2M9.2 14.8 6 18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`}[n]}</svg>`}const Hh=400;class Nh{constructor(e){f(this,"panel",document.createElement("div"));f(this,"previousFocus",null);f(this,"armedAt",null);this.actions=e,this.panel.className="settings",this.panel.hidden=!0;const t=Ah.map(([a,o])=>`<dt>${a}</dt><dd>${o}</dd>`).join("");this.panel.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="pause-heading">
      <header class="settings-head">
        <div class="settings-title">
          <span class="settings-mark">${Ch()}</span>
          <h1 id="pause-heading">Voyage paused</h1>
        </div>
        <button data-action="resume" class="primary"><span class="resume-glyph" aria-hidden="true"></span>Resume</button>
      </header>
      <div class="settings-grid">
        <div class="group" data-group="text" role="group" aria-labelledby="text-heading">
          <h2 id="text-heading"><span class="group-icon">${Pt("text")}</span>Reading</h2>
          <div class="reading">
            <label class="row stacked"><span>Text speed</span><select data-pref="textSpeed" aria-describedby="speed-note">
              <option value="slow">Slow</option><option value="normal">Normal</option>
              <option value="fast">Fast</option><option value="instant">Instant</option>
            </select></label>
            <label class="row stacked"><span>Text size</span><select data-pref="textScale">
              <option value="auto">Automatic</option>
              <option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option>
              <option value="1.75">175%</option><option value="2">200%</option>
            </select></label>
            <label class="row stacked"><span>Reading time</span><select data-pref="readingTime" aria-describedby="reading-note">
              <option value="normal">Normal</option><option value="long">Long</option>
              <option value="xlong">Very long</option>
            </select></label>
            <button data-action="wait" aria-pressed="false" aria-describedby="wait-note"></button>
            <button data-action="skipread" aria-pressed="false" aria-describedby="skip-note"></button>
          </div>
          <p class="note" id="speed-note" hidden>Reduced motion is on, so lines appear at once.</p>
          <p class="note" id="reading-note">Reading time sets how long a line stays up once it has been read, before it moves on by itself.</p>
          <p class="note" id="wait-note">Keep each line until I click: a line that something is waiting on stays up until you click, press a key or tap. Off, it moves on by itself after the reading time.</p>
          <p class="note" id="skip-note">Skip read text: lines you have already read move on after a moment. Hold Ctrl, or press ], to fast-forward them even when this is off.</p>
        </div>
        <div class="group" data-group="sound" role="group" aria-labelledby="sound-heading">
          <h2 id="sound-heading"><span class="group-icon">${Pt("sound")}</span>Sound</h2>
          <button data-action="mute"></button>
          <label class="row"><span>Master volume</span><input data-volume="master" type="range" min="0" max="1" step="0.05"></label>
          <label class="row"><span>Music</span><input data-volume="music" type="range" min="0" max="1" step="0.05"></label>
          <label class="row"><span>Effects</span><input data-volume="sfx" type="range" min="0" max="1" step="0.05"></label>
        </div>
        <div class="group" data-group="display" role="group" aria-labelledby="display-heading">
          <h2 id="display-heading"><span class="group-icon">${Pt("display")}</span>Display</h2>
          <label class="row"><span>Reduced motion</span><select data-pref="reducedMotion">
            <option value="auto">Follow system</option><option value="on">On</option><option value="off">Off</option>
          </select></label>
          <label class="row"><span>High contrast</span><select data-pref="highContrast">
            <option value="auto">Follow system</option><option value="on">On</option><option value="off">Off</option>
          </select></label>
          <label class="row"><span>Reveal key (Q)</span><select data-pref="revealMode">
            <option value="hold">Hold to show</option><option value="toggle">Press to switch on and off</option>
          </select></label>
          <label class="row"><span>Graphics quality</span><select data-pref="quality" aria-describedby="quality-note">
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select></label>
          <p class="note" id="quality-note">Lower it if the game stutters: Medium and Low draw fewer pixels, and Low drops the soft glows.</p>
          <button data-action="fullscreen" aria-pressed="false"></button>
          <button data-action="tips" aria-pressed="false"></button>
        </div>
        <div class="group" data-group="voyage" role="group" aria-labelledby="voyage-heading">
          <h2 id="voyage-heading"><span class="group-icon">${Pt("voyage")}</span>Voyage</h2>
          <button data-action="restart"></button>
          <div class="confirm" role="group" aria-labelledby="restart-question" hidden>
            <p id="restart-question">Begin again?</p>
            <button data-action="keep">Keep my voyage</button>
            <button data-action="erase" class="danger">Erase this voyage</button>
          </div>
          <button data-action="title"></button>
        </div>
      </div>
      <details><summary>Controls</summary><dl class="controls">${t}</dl></details>
    </section>`,document.body.append(this.panel),this.panel.addEventListener("click",a=>{var s;const o=(s=a.target.closest("button"))==null?void 0:s.dataset.action;if(o==="restart"){this.askRestart();return}if(o==="keep"){this.keepVoyage();return}if(o==="erase"){if(a.detail>1||this.armedAt===null||performance.now()-this.armedAt<Hh)return;this.actions.restart();return}o==="resume"&&this.actions.resume(),o==="title"&&this.actions.title(),o==="mute"&&(this.actions.mute(),this.sync()),o==="tips"&&(this.actions.toggleTips(),this.sync()),o==="wait"&&(this.actions.setPrefs({waitForClick:!this.actions.prefs().waitForClick}),this.sync()),o==="skipread"&&(this.actions.setPrefs({skipRead:!this.actions.prefs().skipRead}),this.sync()),o==="fullscreen"&&this.toggleFullscreen()}),this.panel.addEventListener("mousedown",a=>{a.target===this.panel&&a.preventDefault()});for(const a of this.panel.querySelectorAll("input[data-volume]"))a.addEventListener("input",()=>{const o=Number(a.value);a.dataset.volume==="master"&&this.actions.volume(o),a.dataset.volume==="music"&&this.actions.musicVolume(o),a.dataset.volume==="sfx"&&this.actions.sfxVolume(o)});for(const a of this.panel.querySelectorAll("select[data-pref]"))a.addEventListener("change",()=>{const o=a.value;a.dataset.pref==="textSpeed"&&this.actions.setPrefs({textSpeed:o}),a.dataset.pref==="textScale"&&this.actions.setPrefs({textScale:o==="auto"?null:Number(o)}),a.dataset.pref==="reducedMotion"&&this.actions.setPrefs({reducedMotion:o==="auto"?null:o==="on"}),a.dataset.pref==="highContrast"&&this.actions.setPrefs({highContrast:o==="auto"?null:o==="on"}),a.dataset.pref==="readingTime"&&this.actions.setPrefs({readingTime:o}),a.dataset.pref==="revealMode"&&this.actions.setPrefs({revealMode:o}),a.dataset.pref==="quality"&&this.actions.setPrefs({quality:o}),this.sync()});document.addEventListener("fullscreenchange",()=>this.sync()),this.panel.addEventListener("keydown",a=>{if(a.stopPropagation(),a.repeat&&(a.key==="Enter"||a.key===" "||a.key==="Escape")){a.preventDefault();return}if(a.ctrlKey||a.metaKey||a.altKey)return;if(a.key==="Escape"){a.preventDefault(),this.armedAt!==null?this.keepVoyage():this.actions.resume();return}const o=a.target.tagName==="SELECT";if(!o&&(a.key==="h"||a.key==="H")){a.preventDefault(),this.actions.tip();return}if(!o&&(a.key==="l"||a.key==="L")){a.preventDefault(),this.actions.history();return}if(a.key==="Tab"){const s=[...this.panel.querySelectorAll("button, input, select, summary")].filter(h=>!h.closest("[hidden]")&&!h.disabled),r=(s.indexOf(document.activeElement)+(a.shiftKey?-1:1)+s.length)%s.length;a.preventDefault(),s[r].focus()}})}button(e){return this.panel.querySelector(`[data-action="${e}"]`)}askRestart(){this.armedAt===null&&(this.armedAt=performance.now(),this.button("restart").hidden=!0,this.panel.querySelector(".confirm").hidden=!1,this.button("keep").focus())}keepVoyage(){this.armedAt=null,this.panel.querySelector(".confirm").hidden=!0;const e=this.button("restart");e.hidden=!1,e.focus()}toggleFullscreen(){var a,o;const e=document,t=document.documentElement;try{document.fullscreenElement??e.webkitFullscreenElement?document.exitFullscreen?document.exitFullscreen().catch(()=>{}):(a=e.webkitExitFullscreen)==null||a.call(e):t.requestFullscreen?t.requestFullscreen().catch(()=>{}):(o=t.webkitRequestFullscreen)==null||o.call(t)}catch{}}sync(){const e=this.actions.audio(),t=this.actions.prefs(),a=this.actions.reduced(),o=this.button("mute");o.textContent=e.muted?"Sound off":"Sound on",o.setAttribute("aria-label",e.muted?"Sound is off. Enable sound.":"Sound is on. Mute sound.");const s=c=>this.panel.querySelector(`input[data-volume="${c}"]`);s("master").value=String(e.volume),s("music").value=String(e.musicVolume),s("sfx").value=String(e.sfxVolume);const i=c=>this.panel.querySelector(`select[data-pref="${c}"]`),r=i("textSpeed");r.value=ks(t,a),r.disabled=a,this.panel.querySelector("#speed-note").hidden=!a;const h=i("textScale");h.value=t.textScale===null?"auto":String(t.textScale),h.options[0].textContent=`Automatic (${Math.round(this.actions.autoTextScale()*100)}% here)`,i("reducedMotion").value=t.reducedMotion===null?"auto":t.reducedMotion?"on":"off",i("highContrast").value=t.highContrast===null?"auto":t.highContrast?"on":"off",i("readingTime").value=t.readingTime,i("revealMode").value=t.revealMode,i("quality").value=t.quality;const l=(c,p,g,m)=>{const b=this.button(c);b.textContent=p?g:m,b.setAttribute("aria-pressed",String(p))};l("wait",t.waitForClick,"Keep each line until I click: on","Keep each line until I click: off"),l("skipread",t.skipRead,"Skip read text: on","Skip read text: off"),l("tips",this.actions.tips(),"Tips: on","Tips: off"),this.button("tips").setAttribute("aria-label",this.actions.tips()?"Tips are on. Turn tips off.":"Tips are off. Turn tips on."),this.button("wait").setAttribute("aria-label",t.waitForClick?"Keep each line until I click is on. Turn it off to let lines move on by themselves.":"Keep each line until I click is off. Turn it on to keep lines until you click."),this.button("skipread").setAttribute("aria-label",t.skipRead?"Skip read text is on. Turn it off.":"Skip read text is off. Turn it on.");const u=!!(document.fullscreenElement??document.webkitFullscreenElement),d=!!(document.documentElement.requestFullscreen??document.documentElement.webkitRequestFullscreen);l("fullscreen",u,"Fullscreen: on","Fullscreen: off"),this.button("fullscreen").setAttribute("aria-label",u?"Leave fullscreen":"Enter fullscreen"),this.button("fullscreen").hidden=!d,this.button("restart").textContent="Restart voyage",this.button("title").textContent="Return to title"}focus(){this.panel.hidden||this.button("resume").focus()}get open(){return!this.panel.hidden}show(){this.previousFocus=document.activeElement,this.armedAt=null,this.panel.querySelector(".confirm").hidden=!0,this.button("restart").hidden=!1,this.sync(),this.panel.hidden=!1,this.button("resume").focus()}hide(){this.panel.hidden=!0,Le(this.previousFocus)}}const Nn=30;class Lh{constructor(e){f(this,"overlay",document.createElement("div"));f(this,"list");f(this,"previousFocus",null);f(this,"lines",[]);this.onDismiss=e,this.overlay.className="casebook history",this.overlay.hidden=!0,this.overlay.innerHTML=`
      <section role="dialog" aria-modal="true" aria-labelledby="history-heading">
        <header>
          <p class="eyebrow">LINE HISTORY</p>
          <h1 id="history-heading">What was just said</h1>
          <p class="lede">The last ${Nn} lines, newest at the bottom.</p>
        </header>
        <ol class="casebook-body history-body" tabindex="0" aria-label="Recent lines"></ol>
        <footer>
          <button data-action="close">Close</button>
          <small>L or Escape to close</small>
        </footer>
      </section>`,document.body.append(this.overlay),this.list=this.overlay.querySelector("ol"),this.overlay.addEventListener("click",t=>{var o;(((o=t.target.closest("button"))==null?void 0:o.dataset.action)==="close"||t.target===this.overlay)&&this.hide()}),this.overlay.addEventListener("keydown",t=>{if(t.stopPropagation(),t.key==="Escape"||t.key.toLowerCase()==="l"){t.preventDefault(),this.hide();return}if(t.key==="Tab"){const a=[this.list,this.overlay.querySelector("button")],s=(a.indexOf(document.activeElement)+(t.shiftKey?-1:1)+a.length)%a.length;t.preventDefault(),a[s].focus()}})}get open(){return!this.overlay.hidden}add(e){const t=this.lines[this.lines.length-1];t&&t.text===e.text&&t.speaker===e.speaker||(this.lines.push(e),this.lines.length>Nn&&this.lines.splice(0,this.lines.length-Nn))}clear(){this.lines.length=0}show(){if(!this.open){if(this.previousFocus=document.activeElement,this.list.replaceChildren(),!this.lines.length){const e=document.createElement("li");e.className="casebook-empty",e.textContent="Nothing has been said yet.",this.list.append(e)}for(const e of this.lines){const t=document.createElement("li");t.className=e.choice?"casebook-entry history-choice":"casebook-entry";const a=document.createElement("strong");a.textContent=e.speaker?`${e.speaker}: `:"",t.append(a,document.createTextNode(e.text)),this.list.append(t)}this.overlay.hidden=!1,this.list.focus(),this.list.scrollTop=this.list.scrollHeight}}hide(){this.open&&(this.overlay.hidden=!0,Le(this.previousFocus),this.onDismiss())}}function At(n){return!n.startsWith("/")||n.startsWith("//")?n:new URL(n.slice(1),new URL("./",document.baseURI)).href}const Qe={images:{bg_alley_restart_wide:"/assets/scenes/alley_restart_a.webp",bg_arcadia_cabin_restart_b_wide:"/assets/scenes/arcadia_cabin_restart_b_wide.webp",bg_area_harbour:"/assets/scenes/area_harbour.webp",bg_area_harbour_v2:"/assets/scenes/area_harbour_v2.webp",bg_area_lantern:"/assets/scenes/area_lantern.webp",bg_area_lantern_v2:"/assets/scenes/area_lantern_v2.webp",bg_area_marrow:"/assets/scenes/area_marrow.webp",bg_area_marrow_v2:"/assets/scenes/area_marrow_v2.webp",bg_area_shroud:"/assets/scenes/area_shroud.webp",bg_area_shroud_v2:"/assets/scenes/area_shroud_v2.webp",bg_area_town:"/assets/scenes/area_town.webp",bg_area_town_v2:"/assets/scenes/area_town_v2.webp",bg_atlas_island:"/assets/scenes/title_night.webp",bg_below_decks_restart_wide:"/assets/scenes/below_decks_restart_wide.webp",bg_bow_fog_restart_b_wide:"/assets/scenes/bow_fog_restart_b_wide.webp",bg_cabin_v2_wide:"/assets/scenes/cabin_v2_wide.webp",bg_chandlery_restart_wide:"/assets/scenes/chandlery_restart_a.webp",bg_countinghouse_restart_wide:"/assets/scenes/countinghouse_restart_b.webp",bg_crows_nest_restart_b_wide:"/assets/scenes/crows_nest_restart_b_wide.webp",bg_deck_wide:"/assets/scenes/deck_wide.webp",bg_dock_cinema_wide:"/assets/scenes/dock_cinema_wide.webp",bg_dock_wide:"/assets/scenes/dock_wide.webp",bg_far_pans_v2b_wide:"/assets/scenes/far_pans_r3_wide.webp",bg_gallery_v2_wide:"/assets/scenes/gallery_v2_wide.webp",bg_key_gate_v2b_wide:"/assets/scenes/key_gate_r3_wide.webp",bg_lagoon_shore_v2b_wide:"/assets/scenes/lagoon_shore_r3_wide.webp",bg_lantern_deck_restart_b_wide:"/assets/scenes/lantern_deck_bell_r2_wide.webp",bg_marrow_deck_v2_wide:"/assets/scenes/marrow_deck_v2_wide.webp",bg_office_cinema_wide:"/assets/scenes/office_cinema_wide.webp",bg_office_wide:"/assets/scenes/office_wide.webp",bg_pierend_cinema_wide:"/assets/scenes/pierend_cinema_wide.webp",bg_quarterdeck_v2_wide:"/assets/scenes/quarterdeck_v2_wide.webp",bg_quay_cinema_wide:"/assets/scenes/quay_cinema_wide.webp",bg_reef_wreck_v2b_wide:"/assets/scenes/reef_wreck_v2b_wide.webp",bg_salt_camp_v2b_wide:"/assets/scenes/salt_camp_r3_wide.webp",bg_shore_wide:"/assets/scenes/shore_wide_r3.webp",bg_tavern_cinema_wide:"/assets/scenes/tavern_cinema_wide.webp",bg_title:"/assets/scenes/title_night.webp",bg_village_v2_wide:"/assets/scenes/village_v2_wide.webp",bg_warehouse_restart_wide:"/assets/scenes/warehouse_restart_b.webp",bg_weather_works_v2b_wide:"/assets/scenes/weather_works_v2b_wide.webp",char_elias:"/assets/characters/elias_painted_v2.webp",char_walk_v2:"/assets/characters/elias_walk_v2_painted_r2.webp",char_walk_vertical:"/assets/characters/elias_walk_vertical_painted_r2.webp",npc_ansel:"/assets/characters/ansel.webp",npc_ansel_body:"/assets/characters/ansel_body_painted_g.webp",npc_bramwick_body_v2:"/assets/characters/bramwick_body_painted.webp",npc_bramwick_seated:"/assets/characters/bramwick_seated_painted.webp",npc_dorrit:"/assets/characters/dorrit.webp",npc_dorrit_body:"/assets/characters/dorrit_body_painted.webp",npc_harbourmaster:"/assets/characters/harbourmaster.webp",npc_hobb:"/assets/characters/hobb.webp",npc_hobb_body:"/assets/characters/hobb_body_painted.webp",npc_marta_body_v2:"/assets/characters/marta_body_painted.webp",npc_mordant:"/assets/characters/mordant.webp",npc_mordant_body:"/assets/characters/mordant_body_painted_v2.webp",npc_nell:"/assets/characters/nell.webp",npc_nell_body:"/assets/characters/nell_body_painted.webp",npc_nib:"/assets/characters/nib_painted_r3.webp",npc_nib_body:"/assets/characters/nib_body_painted_g.webp",npc_onn:"/assets/characters/onn.webp",npc_onn_body:"/assets/characters/onn_body_painted.webp",npc_pike:"/assets/characters/pike.webp",npc_pike_body:"/assets/characters/pike_body_painted_v2_g.webp",npc_quill:"/assets/characters/quill_painted.webp",npc_quill_body:"/assets/characters/quill_body_painted.webp",npc_rook:"/assets/characters/rook.webp",npc_rook_body:"/assets/characters/rook_body.webp",npc_silas:"/assets/characters/silas.webp",npc_silas_body:"/assets/characters/silas_body.webp",npc_tam:"/assets/characters/tam.webp",npc_tam_body:"/assets/characters/tam_body_painted_v2_g.webp",npc_tamhobb:"/assets/characters/tamhobb.webp",npc_tamhobb_body:"/assets/characters/tamhobb_body_boathook_r3.webp",npc_tavernkeep:"/assets/characters/tavernkeep.webp",npc_vane:"/assets/characters/vane.webp",npc_vane_body:"/assets/characters/vane_body.webp",npc_vex:"/assets/characters/vex_painted.webp",npc_vex_body:"/assets/characters/vex_body_painted.webp",item_chart:"/assets/props/items/chart_painted.webp",item_compass:"/assets/props/items/compass.webp",item_crowbar:"/assets/props/items/crowbar_painted.webp",item_lantern:"/assets/props/items/lantern.webp",item_nameplate:"/assets/props/items/nameplate_painted.webp",item_spyglass:"/assets/props/items/spyglass_painted.webp",prop_crowbar:"/assets/props/crowbar.webp",prop_lantern_wrapped:"/assets/props/lantern_wrapped.webp"},audio:{music_dock:"/assets/audio/dock.mp3",music_fog:"/assets/audio/fog.mp3",music_office:"/assets/audio/office.mp3",music_pans:"/assets/audio/pans.mp3",music_sea:"/assets/audio/sea.mp3",music_sunset:"/assets/audio/sunset.mp3",music_tavern:"/assets/audio/tavern.mp3"}},hn=[{id:"harbour",name:"The Harbour",act:1,blurb:"The quay, the Salty Keel, the harbourmaster's house, and the lanes behind them.",image:"bg_area_harbour_v2",x:.455,y:.605,rooms:[{id:"dock",name:"Dreadwater Harbour",x:.09,y:.62,note:"The Marrow and the harbourmaster's house."},{id:"pier_end",name:"The Harbour Mouth",x:.035,y:.66,note:"Vex at the lamp, where the harbour opens."},{id:"quay",name:"The Quay",x:.19,y:.72,note:"The boards between the harbour and the mouth."},{id:"tavern",name:"The Salty Keel",x:.295,y:.57,note:"Marta's fire, and the island's talk."},{id:"office",name:"The Harbourmaster's House",x:.39,y:.48,note:"Bramwick, his desk, and the harbour's book."},{id:"alley",name:"Wreckers' Lane",x:.49,y:.53,note:"The lane between the warehouses."},{id:"warehouse",name:"The Boat Shed",x:.6,y:.55,note:"A boat on its cradle, and someone hiding."},{id:"counting_house",name:"Vex's Warehouse",x:.7,y:.52,note:"Green lamps, cubbies, and Vex's charts."},{id:"chandlery",name:"The Shipwright's",x:.86,y:.56,note:"Quill's counter, and Hobb's mast."}]},{id:"town",name:"Upper Town",act:1,blurb:"The lane climbs from the harbour to the light on the headland.",image:"bg_area_town_v2",x:.275,y:.335,rooms:[{id:"village",name:"Upper Town",x:.38,y:.6,note:"Cobbles, a well, and the island's oldest inhabitants."},{id:"weather_works",name:"The Lighthouse",x:.8,y:.22,note:"Rook's light, and his old log."}]},{id:"marrow",name:"The Marrow",act:2,blurb:"Vex's ship, out on the water, with her crew and her cargo.",image:"bg_area_marrow_v2",x:.155,y:.6,rooms:[{id:"bow_fog",name:"The Bow of the Marrow",x:.1,y:.48,note:"The first attempt at the Shroud."},{id:"marrow_deck",name:"The Deck",x:.3,y:.68,note:"The crew, the hatch and the rigging."},{id:"crows_nest",name:"The Crow's Nest",x:.36,y:.1,note:"Quill's office, high on the foremast."},{id:"below_decks",name:"The Crew Deck",x:.44,y:.62,note:"Dorrit's stove, and the hold below."},{id:"marrow_quarterdeck",name:"The Helm",x:.62,y:.58,note:"Vex at the wheel and the binnacle."},{id:"marrow_cabin",name:"The Captain's Cabin",x:.84,y:.52,note:"Vex's chart table."},{id:"marrow_gallery",name:"The Stern Gallery",x:.92,y:.55,note:"The wake, the sunset, and Quill off watch."}]},{id:"shroud",name:"The Shroud",act:3,blurb:"The fog flats, the wreck, the castaway camp, and the gate to the Grey Lantern.",image:"bg_area_shroud_v2",x:.705,y:.425,rooms:[{id:"lagoon_shore",name:"The Wrack Line",x:.1,y:.66,note:"The longboat, and the way into the Shroud."},{id:"reef_wreck",name:"The Sunken Wreck",x:.46,y:.55,note:"The bell, the nameplate, and the dead."},{id:"salt_camp",name:"The Castaway Camp",x:.68,y:.6,note:"Elias, alive, and still charting."},{id:"far_pans",name:"The Far Flats",x:.82,y:.66,note:"The edge of the fog, and the ghost ship beyond."},{id:"key_gate",name:"The Reef Gate",x:.91,y:.54,note:"Where the longboat goes out to the Grey Lantern."}]},{id:"lantern",name:"The Grey Lantern",act:4,blurb:"Mordant's ship, deep in the fog, where the bell and the name wait.",image:"bg_area_lantern_v2",x:.79,y:.335,rooms:[{id:"lantern_deck",name:"The Deck",x:.45,y:.62,note:"The great lantern, the bell, and Mordant's crew."},{id:"arcadia_cabin",name:"The Captain's Cabin",x:.78,y:.5,note:"The nameplate on Mordant's desk."}]}];function jt(n){return hn.find(e=>e.rooms.some(t=>t.id===n))}class $h{constructor(e){f(this,"overlay",document.createElement("div"));f(this,"chart",document.createElement("canvas"));f(this,"wash");f(this,"stage",document.createElement("div"));f(this,"markers",document.createElement("div"));f(this,"heading",document.createElement("h1"));f(this,"list",document.createElement("ol"));f(this,"note",document.createElement("p"));f(this,"back",document.createElement("button"));f(this,"closeBtn",document.createElement("button"));f(this,"previousFocus",null);f(this,"view","island");f(this,"state",{act:1,room:null,visited:()=>!1});f(this,"handlers");f(this,"chartUrl","");f(this,"art",null);this.handlers=e,this.overlay.className="atlas",this.overlay.hidden=!0,this.overlay.innerHTML=`
      <section class="atlas-frame" role="dialog" aria-modal="true" aria-labelledby="atlas-heading">
        <div class="atlas-wash" aria-hidden="true"></div>
        <header class="atlas-head">
          <h1 id="atlas-heading"></h1>
        </header>
        <div class="atlas-stage">
          <canvas class="atlas-chart" role="img" aria-label=""></canvas>
          <div class="atlas-markers"></div>
        </div>
        <aside class="atlas-key" aria-label="Places on the chart">
          <ol class="atlas-list"></ol>
        </aside>
        <p class="atlas-note" aria-live="polite"></p>
        <button class="atlas-back" type="button" aria-label="Back to the island" title="Back to the island"><span aria-hidden="true">←</span></button>
        <button class="atlas-close" type="button" aria-label="Close the chart" title="Close the chart"><span aria-hidden="true">✕</span></button>
      </section>`,document.body.append(this.overlay),this.chart=this.overlay.querySelector(".atlas-chart"),this.wash=this.overlay.querySelector(".atlas-wash"),this.stage=this.overlay.querySelector(".atlas-stage"),this.markers=this.overlay.querySelector(".atlas-markers"),this.heading=this.overlay.querySelector(".atlas-head h1"),this.list=this.overlay.querySelector(".atlas-list"),this.note=this.overlay.querySelector(".atlas-note"),this.back=this.overlay.querySelector(".atlas-back"),this.closeBtn=this.overlay.querySelector(".atlas-close"),window.addEventListener("resize",()=>{this.open&&this.drawChart()}),this.back.addEventListener("click",()=>this.goIsland()),this.closeBtn.addEventListener("click",()=>this.hide()),this.wash.addEventListener("click",()=>this.hide()),this.chart.addEventListener("pointerdown",()=>{document.activeElement===document.body&&this.focusFirst()}),this.overlay.addEventListener("keydown",t=>{var l,u;if(t.stopPropagation(),t.key==="Escape"||t.key.toLowerCase()==="a"){t.preventDefault(),this.view!=="island"?this.goIsland():this.hide();return}const a=t.key==="ArrowDown"||t.key==="ArrowRight"||t.key==="Tab"&&!t.shiftKey?1:t.key==="ArrowUp"||t.key==="ArrowLeft"||t.key==="Tab"&&t.shiftKey?-1:0;if(!a)return;const o=[...this.overlay.querySelectorAll("button")].filter(d=>!d.hidden&&d.tabIndex>=0),s=t.key==="Tab"?o:[...this.overlay.querySelectorAll(".atlas-marker, .atlas-back, .atlas-close")].filter(d=>!d.hidden&&d.offsetParent!==null),i=s.length?s:o;if(!i.length)return;const r=i.indexOf(document.activeElement),h=r<0?a<0?i.length-1:0:(r+a+i.length)%i.length;t.preventDefault(),this.overlay.querySelectorAll(".selected").forEach(d=>d.classList.remove("selected")),(l=i[h])==null||l.classList.add("selected"),(u=i[h])==null||u.focus()})}get open(){return!this.overlay.hidden}show(e){this.state=e,this.previousFocus=document.activeElement,this.view="island",this.overlay.hidden=!1,this.render()}hide(){this.overlay.hidden||(this.overlay.hidden=!0,this.chart.width=1,this.chart.height=1,Le(this.previousFocus),this.handlers.onDismiss())}goIsland(){this.view="island",this.render()}goArea(e){this.view=e,this.render()}area(){return this.view==="island"?void 0:hn.find(e=>e.id===this.view)}render(){const e=this.area();if(this.markers.replaceChildren(),this.list.replaceChildren(),this.note.textContent="",this.stage.classList.toggle("island",!e),!e){const a=da("bg_atlas_island");this.paintChart(a,"Fenn's chart of Dreadwater Isle"),this.heading.textContent="Dreadwater Isle",this.back.hidden=!0;const o=jt(this.state.room??"");hn.forEach(s=>{const i=s.act>this.state.act,r=s.id===(o==null?void 0:o.id),h=`${s.name}${i?" — beyond the fog":r?" — you are here":""}`,l=()=>{if(i){this.note.textContent="The fog hides that part of the island. Not yet.";return}this.goArea(s.id)};this.marker(s.x,s.y,{klass:r?"here":i?"locked":"",label:h,tag:s.name,onPick:l}),this.row(s.name,r?"You are here.":i?"Beyond the fog. Not yet.":`Act ${s.act}`,{klass:r?"here":i?"locked":"",label:h,onPick:l})}),this.focusFirst();return}const t=da(e.image);this.paintChart(t,`${e.name} on Dreadwater Isle`),this.heading.textContent=e.name,this.back.hidden=!1,e.rooms.forEach(a=>{const o=a.id===this.state.room,s=o||this.state.visited(a.id),i=o?"here":s?"known":"locked",r=`${a.name}${o?" — you are here":s?"":" — not yet found"}`,h=()=>{if(o){this.hide();return}if(!s){this.note.textContent="I have not found my way there yet.";return}if(e.act!==this.state.act){this.note.textContent="That is another voyage. Not this one.";return}this.hide(),this.handlers.onTravel(a.id)};this.marker(a.x,a.y,{klass:i,label:r,tag:a.name,onPick:h}),this.row(a.name,o?"You are here.":a.note??"",{klass:i,label:r,onPick:h})}),this.focusFirst()}paintChart(e,t){if(this.chart.setAttribute("aria-label",t),e!==this.chartUrl){this.chartUrl=e,this.art=null;const a=new Image;a.decoding="async",a.onload=()=>{this.chartUrl===e&&(this.art=a,this.drawChart())},a.src=e}this.drawChart()}drawChart(){const e=this.stage.clientWidth,t=this.stage.clientHeight;if(!e||!t)return;const a=Math.min(window.devicePixelRatio||1,2),o=Math.min(a,1920/e,1080/t),s=Math.max(1,Math.round(e*o)),i=Math.max(1,Math.round(t*o));this.chart.width!==s&&(this.chart.width=s),this.chart.height!==i&&(this.chart.height=i);const r=this.chart.getContext("2d");if(!r)return;r.setTransform(s/e,0,0,i/t,0,0),r.imageSmoothingEnabled=!0,r.imageSmoothingQuality="high",r.fillStyle="#04090c",r.fillRect(0,0,e,t);const h=this.art;if(!h||!h.width||!h.height)return;const l=Math.min(e/h.width,t/h.height),u=h.width*l,d=h.height*l;r.drawImage(h,(e-u)/2,(t-d)/2,u,d)}marker(e,t,a){const o=document.createElement("button");o.type="button",o.className=`atlas-marker ${a.klass}`,o.style.left=`${e*100}%`,o.style.top=`${t*100}%`,o.setAttribute("aria-label",a.label),o.title=a.tag;const s=document.createElement("span");s.className="atlas-glow",s.setAttribute("aria-hidden","true");const i=document.createElement("span");i.className="atlas-glyph",i.setAttribute("aria-hidden","true");const r=document.createElement("span");r.className="atlas-tag",r.setAttribute("aria-hidden","true"),r.textContent=a.tag,o.append(s,i,r),o.addEventListener("click",()=>{a.onPick(),a.klass.includes("locked")&&(o.classList.remove("denied"),o.offsetWidth,o.classList.add("denied"),window.setTimeout(()=>o.classList.remove("denied"),620))}),o.addEventListener("focus",()=>{o.classList.add("selected"),this.note.textContent=`Selected: ${a.tag}. Enter to open.`}),o.addEventListener("blur",()=>o.classList.remove("selected")),this.markers.append(o)}row(e,t,a){const o=document.createElement("li"),s=document.createElement("button");s.type="button",s.className=`atlas-row ${a.klass}`,s.tabIndex=-1,s.setAttribute("aria-label",a.label),s.innerHTML=`<span class="atlas-row-name">${Et(e)}</span><span class="atlas-row-note">${Et(t)}</span>`,s.addEventListener("click",a.onPick),s.addEventListener("focus",()=>{s.classList.add("selected"),this.note.textContent=`Selected: ${e}. Enter to travel.`}),s.addEventListener("blur",()=>s.classList.remove("selected")),o.append(s),this.list.append(o)}focusFirst(){const t=(document.body.classList.contains("mobile")?this.overlay.querySelector(".atlas-row"):this.overlay.querySelector(".atlas-marker"))??this.back;t&&(this.overlay.querySelectorAll(".selected").forEach(a=>a.classList.remove("selected")),t.classList.add("selected"),t.focus())}}function da(n){const e={bg_atlas_island:"/assets/scenes/title_night.webp",bg_title:"/assets/scenes/title_night.webp",bg_area_harbour:"/assets/scenes/area_harbour.webp",bg_area_town:"/assets/scenes/area_town.webp",bg_area_marrow:"/assets/scenes/area_marrow.webp",bg_area_shroud:"/assets/scenes/area_shroud.webp",bg_area_lantern:"/assets/scenes/area_lantern.webp",bg_area_harbour_v2:"/assets/scenes/area_harbour_v2.webp",bg_area_town_v2:"/assets/scenes/area_town_v2.webp",bg_area_marrow_v2:"/assets/scenes/area_marrow_v2.webp",bg_area_shroud_v2:"/assets/scenes/area_shroud_v2.webp",bg_area_lantern_v2:"/assets/scenes/area_lantern_v2.webp"};return e[n]?At(e[n]):""}function Et(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}const Dh={},Rh=new Set,qh=.35;function Ph(n){return(n.split("/").pop()??"").split("?")[0]}function Oh(n){const e=/act-(iv|iii|ii|i)-/i.exec(n);return e?["i","ii","iii","iv"].indexOf(e[1].toLowerCase())+1:1}const Wh=400,Fh=new Set(["Enter","Escape"," "]);class Bh{constructor(e){f(this,"overlay",document.createElement("div"));f(this,"video",document.createElement("video"));f(this,"onComplete",null);f(this,"unduck",null);f(this,"hideTimer",null);f(this,"cueFor",null);f(this,"cueStarted",!1);f(this,"cueMeta",null);f(this,"unsubscribeAudio",null);f(this,"startedAt",-1/0);f(this,"held",new Set);f(this,"heldAtStart",new Set);f(this,"previousFocus",null);f(this,"transcript",document.createElement("div"));this.audio=e,this.overlay.className="cinematic",this.overlay.hidden=!0,this.overlay.setAttribute("role","dialog"),this.overlay.setAttribute("aria-modal","true"),this.overlay.setAttribute("aria-label","Story cinematic"),this.video.playsInline=!0,this.video.preload="auto";const t=document.createElement("button");t.type="button",t.textContent="Show text",t.className="cinematic-text",this.transcript.className="cinematic-transcript sr-only";const a=document.createElement("button");a.type="button",a.textContent="Skip cinematic",a.className="cinematic-skip";const o=document.createElement("p");o.className="cinematic-hint",o.textContent="Click, Enter, or Escape to skip",this.overlay.append(this.video,this.transcript,t,a,o),document.body.append(this.overlay),a.addEventListener("click",()=>{this.settled()&&this.skip()}),t.addEventListener("click",s=>{s.stopPropagation();const i=this.transcript.classList.toggle("visible");this.transcript.classList.toggle("sr-only",!i),t.textContent=i?"Hide text":"Show text"}),this.overlay.addEventListener("click",s=>{(s.target===this.overlay||s.target===this.video)&&this.settled()&&this.skip()}),this.overlay.addEventListener("keydown",s=>{Fh.has(s.key)&&(s.preventDefault(),s.stopPropagation(),!(s.repeat||this.heldAtStart.has(s.key)||!this.settled())&&this.skip())}),window.addEventListener("keydown",s=>{this.held.add(s.key)},!0),window.addEventListener("keyup",s=>{this.held.delete(s.key),this.heldAtStart.delete(s.key)},!0),window.addEventListener("blur",()=>{this.held.clear(),this.heldAtStart.clear()}),this.video.addEventListener("ended",()=>this.skip()),this.video.addEventListener("error",()=>this.skip())}get active(){return this.onComplete!==null}settled(){return performance.now()-this.startedAt>=Wh}play(e,t){var h,l;if(this.active)return;this.unduck!==null&&(window.clearTimeout(this.unduck),this.unduck=null),this.hideTimer!==null&&(window.clearTimeout(this.hideTimer),this.hideTimer=null);const a=Dh[e.split("/").pop()??""]??[];this.transcript.replaceChildren(...a.map(u=>{const d=document.createElement("p");return d.textContent=u,d})),this.transcript.classList.add("sr-only"),this.transcript.classList.remove("visible");const o=this.overlay.querySelector(".cinematic-text");o&&(o.textContent="Show text"),this.overlay.setAttribute("aria-label",a.length?a.join(". "):"Story cinematic"),this.onComplete=t,this.startedAt=performance.now(),this.heldAtStart=new Set(this.held);const s=this.audio();s.endCue(200);const i=Rh.has(Ph(e));if(s.duck(!0,i?0:qh),this.syncVolume(),(h=this.unsubscribeAudio)==null||h.call(this),this.unsubscribeAudio=((l=s.onChange)==null?void 0:l.call(s,()=>this.syncVolume()))??null,this.video.src=At(e),this.cueFor=i?null:e,this.cueStarted=!1,this.cueMeta&&(this.video.removeEventListener("loadedmetadata",this.cueMeta),this.cueMeta=null),this.cueFor){const u=()=>{if(this.cueStarted||this.cueFor!==e||!this.active)return;const d=Number.isFinite(this.video.duration)?this.video.duration:0;d<=0||(this.cueStarted=!0,s.beginCue(Oh(e),d))};this.cueMeta=u,this.video.addEventListener("loadedmetadata",u,{once:!0}),this.video.readyState>=1&&u()}const r=this.overlay.hidden;r&&(this.previousFocus=document.activeElement),this.overlay.inert=!1,this.overlay.hidden=!1,r&&this.overlay.offsetWidth,this.overlay.classList.add("showing"),this.overlay.querySelector("button").focus(),this.video.play().catch(()=>{})}syncVolume(){const e=this.audio();this.video.muted=e.muted,this.video.volume=e.muted?0:Math.max(0,Math.min(1,e.videoVolume??e.volume*e.musicVolume))}skip(){var t;if(!this.onComplete)return;const e=this.onComplete;this.onComplete=null,(t=this.unsubscribeAudio)==null||t.call(this),this.unsubscribeAudio=null,this.cueFor=null,this.cueMeta&&(this.video.removeEventListener("loadedmetadata",this.cueMeta),this.cueMeta=null),this.audio().endCue(),this.video.pause(),this.overlay.contains(document.activeElement)&&document.activeElement.blur(),this.overlay.inert=!0,this.overlay.classList.remove("showing"),this.hideTimer=window.setTimeout(()=>this.finishHide(),this.fadeMs()+50),this.unduck=window.setTimeout(()=>{this.unduck=null,this.audio().duck(!1)},0),e()}finishHide(){this.hideTimer=null,!this.active&&(this.overlay.hidden=!0,this.video.removeAttribute("src"),this.video.load(),document.activeElement===document.body&&Le(this.previousFocus))}fadeMs(){const e=parseFloat(getComputedStyle(this.overlay).transitionDuration);return Number.isFinite(e)?e*1e3:350}}const _a={vex:{id:"vex",name:"Captain Vex",portrait:"npc_vex",body:"npc_vex_body",accent:"#d9a05a"},mordant:{id:"mordant",name:"Captain Mordant",portrait:"npc_mordant",body:"npc_mordant_body",accent:"#9fb8b0"},elias:{id:"elias",name:"Elias Fenn",portrait:"npc_ansel",body:"npc_ansel_body",accent:"#e8c98a"},fenn:{id:"fenn",name:"Fenn",accent:"#8fd3c7"},bramwick:{id:"bramwick",name:"Harbourmaster Bramwick",portrait:"npc_harbourmaster",body:"npc_bramwick_body_v2",accent:"#e8c98a"},marta:{id:"marta",name:"Marta",portrait:"npc_tavernkeep",body:"npc_marta_body_v2",accent:"#e8c98a"},quill:{id:"quill",name:"Quill",portrait:"npc_quill",body:"npc_quill_body",accent:"#8fd3c7"},rook:{id:"rook",name:"Old Rook",portrait:"npc_rook",body:"npc_rook_body",accent:"#c9b28a"},nell:{id:"nell",name:"Nell",portrait:"npc_nell",body:"npc_nell_body",accent:"#e8c98a"},tam:{id:"tam",name:"Tam",portrait:"npc_tam",body:"npc_tam_body",accent:"#a8d8c0"},onn:{id:"onn",name:"Old Onn",portrait:"npc_onn",body:"npc_onn_body",accent:"#c9a2e0"},silas:{id:"silas",name:"Silas Cray",portrait:"npc_silas",body:"npc_silas_body",accent:"#d9a26a"},tallow:{id:"tallow",name:"Mr Tallow (from the back room)",accent:"#c9b28a"},narrator:{id:"narrator",name:"",accent:"#e8c98a"},vane:{id:"vane",name:"Captain Vane",portrait:"npc_vane",body:"npc_vane_body",accent:"#e0a06a"},dorrit:{id:"dorrit",name:"Dorrit",portrait:"npc_dorrit",body:"npc_dorrit_body",accent:"#b9c7e0"},hobb:{id:"hobb",name:"Hobb",portrait:"npc_hobb",body:"npc_hobb_body",accent:"#c99a7a"},ansel:{id:"ansel",name:"Ansel Fenn",portrait:"npc_ansel",body:"npc_ansel_body",accent:"#f0c674"},pike:{id:"pike",name:"Pike",portrait:"npc_pike",body:"npc_pike_body",accent:"#e8d36a"},tamhobb:{id:"tamhobb",name:"Tam Hobb",portrait:"npc_tamhobb",body:"npc_tamhobb_body",accent:"#c99a7a"},weather:{id:"weather",name:"A Weather man",accent:"#b8b8a0"},weather2:{id:"weather2",name:"Another Weather man",accent:"#a8a890"},nib:{id:"nib",name:"Nib",portrait:"npc_nib",body:"npc_nib_body",accent:"#b8c4a8"},regular:{id:"regular",name:"A regular",accent:"#c9b28a"}};function Ee(n){return _a[n]??{id:n,name:n,accent:"#e8c98a"}}const Vh=`# The Father and the Fog — four acts. Act I is the return, Act II the crew and the first fog.
# Act III runs from the fog flats to the reef gate; Act IV is the Grey Lantern's deck, its
# captain's cabin, and the last choice. No opening film: the voyage starts on the harbour at
# the dock. The closing card is at the bottom of this file and follows that choice.

act 1 "The Return"
  start dock
  inventory compass
  caption "Dreadwater Isle. The boatman puts me on the pier and pushes off before I can thank him. It is three months since my father sailed into the fog."

act 2 "The Crew"
  start marrow_deck
  inventory compass spyglass crowbar
  caption "The Marrow is ours, for what that's worth. Vex at the helm, Quill aloft, Dorrit below, Hobb at the mast. The fog is waiting."

act 3 "The Shroud"
  start lagoon_shore
  inventory compass crowbar chart
  caption "The wreck of the Marrow behind us, the rock ahead. The fog is not empty. It has been waiting."

act 4 "The Grey Lantern"
  start lantern_deck
  inventory compass crowbar nameplate
  caption "Eighty years of stolen ships, and one captain who refused to sink. Time to give them their names back."

# The closing card. The fog-lifts ending is the mercy; the long-way ending is the survival.
# Every line is conditional, so only the chosen ending's card is read.

ending "THE FATHER AND THE FOG"
  title if ending_fog_lifts
    "THE FOG LIFTS"
  title if ending_long_way
    "THE LONG WAY HOME"
  painting bg_shore_wide focus 1280,420 music music_sea if ending_fog_lifts
  painting bg_deck_wide focus 1250,300 music music_fog if ending_long_way
  painting bg_dock_cinema_wide focus 1280,420 music music_dock

  # THE FOG LIFTS — the crews go free, and the island sails again.
  line if ending_fog_lifts
    "My father comes home with the chart under his arm and salt in his beard. He apologises to the harbour for being late."
  line if ending_fog_lifts and vex_trust
    "Vex stays. He calls it rebuilding the harbour. The island calls it the first honest thing he has done."
  line if ending_fog_lifts and not vex_trust
    "Vex tells the island he lifted the fog. Nobody believes him. He tells it anyway, with a new coat."
  line if ending_fog_lifts
    "Quill charts the Shroud for the first time in eighty years. The first clear channel is Quill's Run, and she pretends not to care."
  line if ending_fog_lifts
    "Hobb and Tam come home together. Hobb walks half a step behind his brother all the way up the hill, in case the fog changes its mind."
  line if ending_fog_lifts
    "Dorrit feeds every crew that comes in. He says it is to keep them out of his kitchen, and keeps the pot on."
  line if ending_fog_lifts
    "The harbour fills again. Bramwick meets every boat at the pier, and enjoys it."
  line if ending_fog_lifts
    "The Shroud thins to a mist, and then to weather. The fishing boats go past the reef and come back."
  line if ending_fog_lifts
    "The Grey Lantern settles into the sea like a tired sail. The crews go free before she goes."
  line if ending_fog_lifts
    "I say the name once more, quietly. Mordant. It sounds like a man now, not a curse."
  line if ending_fog_lifts
    "Marta hangs a new story over the Salty Keel's fire. For once, it has an ending."
  line if ending_fog_lifts
    "My father and I draw the new coast together. The chart is honest now."
  line if ending_fog_lifts
    "He gives me back my coat, shaves off the beard, and apologises for my birthday a second time. I accept all three."
  line if ending_fog_lifts
    "Marta unbolts the back door at last. The lamp in my father's window is lit, and it stays lit."
  line if ending_fog_lifts
    "His compass lies open on the table between us. The needle points north, and stays there."
  line if ending_fog_lifts
    "Old Rook hears the fog has gone. He orders a drink, then pushes it away. He has somewhere to be."
  line if ending_fog_lifts
    "On the first clear morning of the year, the harbour bell rings for the dead. At noon Tam Hobb takes the rope, and Hobb lets him."
  line if ending_fog_lifts
    "I tell Tam Hobb that his son kept counting. He says he knows, and rings it again."
  line if ending_fog_lifts
    "Old Onn comes down to the quay to hear the story. I tell her the truth. She says it will do, and goes back to her step."

  # THE LONG WAY HOME — the living get out; the dead and the fog remain.
  line if ending_long_way and vex_trust
    "Vex takes the salvage and leaves Dreadwater in the longboat. He is not running. He goes back to the rock for my father, and calls it a debt worth collecting."
  line if ending_long_way and vex_trust
    "My father comes home a month later, in that boat, with the rest of the chart."
  line if ending_long_way and not vex_trust
    "Vex takes the salvage and the credit. He tells the island he saved us. The ones we left are not in his story."
  line if ending_long_way and not vex_trust
    "My father stays on the fog rock to finish the chart. He chose it, and I did not argue. I have not decided which of us I blame."
  line if ending_long_way
    "Quill brings us out with a heading she made up on the spot. It works. She never says how close it was."
  line if ending_long_way
    "Hobb comes home with Tam. He does not speak for a day, and then he does not stop."
  line if ending_long_way
    "Dorrit keeps the pot hot all the way home. Nobody goes hungry, not even Vex."
  line if ending_long_way
    "The island takes us back. The fog is still out there, and the fishing boats still do not go past the reef."
  line if ending_long_way
    "The Shroud keeps its crews. On quiet nights Hobb takes the Lantern's clapper down to the harbour wall and strikes a post: three, then one. The island has learned not to ask."
  line if ending_long_way
    "The blank half of the chart hangs in the Salty Keel. Marta says that is the honest part."
  line if ending_long_way and vex_trust
    "My father's compass points at the fog until the month he comes home. Then it points at the harbour, and stays."
  line if ending_long_way and not vex_trust
    "I keep my father's compass in my coat. It still points at the fog, and some mornings I follow it as far as the quay."
  line if ending_long_way
    "Old Rook does not ask how it went. He puts a glass in front of me and one in front of himself."
  line if ending_long_way and vex_trust
    "I go back to Dreadwater with a crew, half a chart, and a father a month behind me."
  line if ending_long_way and not vex_trust
    "I go back to Dreadwater with a crew, half a chart, and no father. Some mornings the fog looks like a road."
  line if ending_long_way
    "The Grey Lantern is still out there. Some nights I stand on the quay and say Mordant's name to the fog. It does not answer. That is not the same as going back."
`,Gh=`# Global item combinations: only portable actions belong here. Room combinations live in each
# room's script, where the painted object is.
#
# The chart and the compass were both my father's, and they travel together. In the fog the
# needle finally has somewhere to point.

# Act III: the chart has caught up with the needle.
use compass on chart if act 3 and rule_name
  "The needle swings past the chart's edge and stops on the reef gate. My father has drawn the rest."
use compass on chart if act 3
  "The needle leans toward the wreck. The chart has no mark for where we are standing."

# Act I: the edge of the Shroud is as far as the chart goes.
use compass on chart
  "The chart stops at the edge of the Shroud. The needle points straight past it. My father went that way."

# Act II: two things for finding your way, and neither one trusts the fog.
use compass on spyglass if act 2
  "The needle points into the fog. Through the glass, the fog looks back."

# Act IV: the needle and the name, on the Grey Lantern.
use compass on nameplate if act 4 and not name_spoken
  "The needle swings between the plate and the captain's cabin. The name is here. The captain is not."
use compass on nameplate if act 4
  "The needle points at the deck. The name has already done its work."
`,zh=`dialogue bramwick
  node root bramwick "Fenn. You came back. I hoped you would stay away."
    > "Where is my father?" -> father
    > "Why is the harbour empty?" -> harbour
    > "I need a ship." -> ship
    > "You wrote him off, didn't you?" -> guilt
    > "Nothing. I'll come back." -> bye

  node father bramwick "The Shroud took him. Three months ago. No wreck, no boat, no body."
    -> father2
  node father2 bramwick "I have known every ship in this harbour for thirty years. I know what a lost one looks like."
    > "Then find me one that isn't lost." -> ship
    > "What is the Shroud?" -> shroud
    > "Did anyone go after him?" -> search

  node search bramwick "Two boats went out. One came back with her sails set and nobody aboard."
    -> search2
  node search2 bramwick "The other did not come back. That was in the first month. Nobody has tried since."
    > "What is the Shroud?" -> shroud
    > "Who still sails?" -> ship
    > "I am sorry I asked." -> bye

  node shroud bramwick "The fog bank off the headland. It was old when I was a boy, and it has not moved."
    -> shroud2
  node shroud2 bramwick "Ships go in. The fog keeps them. That is all anyone knows for certain."
    > "And the town blames Vex?" -> blame
    > "Who still sails?" -> ship
    > "Thank you." -> bye

  node blame bramwick "Vex is the only captain who comes back."
    -> blame2
  node blame2 bramwick "People need someone to blame who is still here."
    > "Is he guilty?" -> guilty
    > "Who still sails?" -> ship

  node guilty bramwick "I don't know. I have known enough guilty men to know one can still be useful."
    > "That is not an answer." -> guilty2
    > "Who still sails?" -> ship
  node guilty2 bramwick "No. It is a harbourmaster's answer. I am sorry."
    > "Tell me about Vex." -> ship
    > "Goodnight." -> bye

  node harbour bramwick "Three ships came in this month. Two left. The rest of the fleet is in the fog, or under it."
    -> harbour2
  node harbour2 bramwick "The town is frightened, Fenn. Frightened people stop being kind."
    > "Who still sails?" -> ship
    > "What is the Shroud?" -> shroud
    > "I'll come back." -> bye

  node ship bramwick "One ship still sails from Dreadwater. The Marrow. She belongs to Captain Vex."
    -> ship2
  node ship2 bramwick "Vex works the fog's edge. He will not go into it. Nobody will."
    > "Where do I find him?" -> where
    > "Then I will ask him myself." -> where
    > "Why will nobody sail?" -> afraid

  node where bramwick "Vex keeps the counting house at the top of Wreckers' Lane. The one with the green lamps."
    -> where2
  node where2 bramwick "If you need a crew, start at the Salty Keel. Marta knows every soul on this island."
    > "I'll go and ask Vex." -> bye
    > "Why won't anyone sail?" -> afraid
    > "Goodnight." -> bye

  node afraid bramwick "Because the last three crews are still out there. The town counts them every Sunday."
    > "Then I will count them too." -> bye
    > "Who still sails?" -> ship

  node guilt bramwick "I wrote your father down as lost. It took one line."
    -> guilt2
  node guilt2 bramwick "I have read that line every morning since. It does not improve."
    > "Then give me a ship." -> ship
    > "I don't want your sorry." -> hard
    > "Goodnight." -> bye
  node hard bramwick "No. You want him back. So do I. I cannot do that either."
    > "Then give me a ship." -> ship
    > "Goodnight." -> bye

  node again bramwick "Back again. The harbour has not improved, and neither have I."
    > "Vex says he won't sail." if met_vex -> after_vex
    > "Tell me about Vex." -> ship
    > "Tell me about my father." -> father
    > "Nothing. Goodnight." -> bye
  node after_vex bramwick "Vex says no before he has heard the question."
    -> after_vex2
  node after_vex2 bramwick "Find what he wants. Then he will move."
    > "I'll find it." -> bye
    > "What does he want?" -> after_vex3
  node after_vex3 bramwick "I don't know. He does not tell me anything he can sell."
    > "Then I'll ask him." -> bye

  node bye bramwick "Fenn. If you go out there, come back. I am too old to write another one."
`,Kh=`dialogue dorrit
  node root dorrit "Well? I've no time to waste, and neither has the stew."
    set met_dorrit
    > "Marta says you're blamed." if not dorrit_cleared -> blamed
    > "Pike gave up the rudder. You're clear." if rudder_back and seen:dorrit.confess and not dorrit_cleared -> clear2
    > "What's missing?" if not dorrit_cleared -> stores
    > "You're cleared. Come aboard." if dorrit_cleared -> cleared
    > "Nothing. I'm sorry." -> END

  node blamed dorrit "Blamed. Forty years cooking for this island, and now I'm a thief."
    > "Why you?" -> why
    > "What's missing?" -> stores

  node why dorrit "The key is on my belt. The lock is older than I am. So it's my fault."
    > "Who else could get in?" -> key
    > "I'll find the truth." -> END

  node key dorrit "The lane door has a loose bolt. Half the island knows it."
    > "What's missing?" -> stores
    > "I'll look around." -> END

  node stores dorrit "Six crates. Salt, flour, dried fish. The good tea."
    > "Who would take them?" -> who
    > "What does the fog take?" -> fog
    > "I'll look around." -> END

  node who dorrit "Anyone hungry. That's the trouble with blaming the cook."
    -> END

  node fog dorrit "The fog takes ships, not tea. I've watched it from the hill."
    -> END

  node clear2 dorrit "Pike's man talked? Then say it where the island can hear."
    set dorrit_cleared
    -> thanks

  node thanks dorrit "I'm cleared, then. Once the island hears it."
    > "I'll tell them." -> join
    > "What about the man in the shed?" -> wen

  node wen dorrit "He can sleep in my kitchen till the Marrow sails. Pike won't look there."
    -> join

  node join dorrit "Then I'm coming with you. Somebody has to feed that crew."
    -> END

  node cleared dorrit "Cleared. I've packed my spoons. All forty of them."
    > "Forty spoons?" -> spoons
    > "What about the man in the shed?" -> wen2
    > "Welcome aboard." -> END

  node spoons dorrit "One for each year I've cooked here. I'm not leaving them for Pike."
    -> END

  node wen2 dorrit "The man in the shed? He can sleep in my kitchen. Pike won't look there."
    -> END

  # The thief in the boat shed. Dorrit is not there; the voice is the whole scene.
  node thief narrator "I knock on the top crate. The breathing stops."
    -> voice

  node voice narrator "A man's voice, behind the crates. \\"Don't call Pike. Please.\\""
    > "I'm not Pike." -> notpike
    > "You're the one who took the stores." -> took
    > "Come out where I can see you." -> come

  node notpike narrator "\\"They all say that,\\" he says. \\"Then they call Pike.\\""
    -> come

  node took narrator "\\"I moved them,\\" he says. \\"I didn't take them. There's a difference.\\""
    -> come

  node come narrator "A man stands up from behind the crates. His coat is stiff with salt."
    -> confess

  node confess narrator "\\"Pike paid me,\\" he says. \\"Two crowns and a meal. I moved the stores to his shed.\\""
    note pike_rudder "Pike paid the man in the boat shed to move the stores. Vex's spare rudder is in Pike's shed."
    > "And the Marrow's rudder?" -> rudder
    > "Why did you do it?" -> why2
    > "You stole from Dorrit." -> stole

  node rudder narrator "\\"The rudder's in Pike's shed. He took it himself. He said it was owed.\\""
    -> end

  node why2 narrator "\\"I hadn't eaten in three days,\\" he says. \\"I only wanted work.\\""
    -> end

  node stole narrator "\\"I know,\\" he says. \\"I'm sorry.\\" He says it like he's said it a lot."
    -> end

  node end narrator "When I look back, the gap behind the crates is empty. He has gone."
    -> END

  # ------------------------------------------------------------------ ACT II
  # The galley aboard the Marrow. \`hold2\` reads salvage_seen, which below_decks and Hobb set;
  # the Cormorant is one of Marta's island stories, and Dorrit is the one who has heard them.
  node galley dorrit "Mind the pot. It has been on since the anchor came up."
    > "What's in it?" -> pot
    > "Anything new?" if seen:dorrit.galley -> galley_after
    > "You've seen the hold." if salvage_seen -> hold2
    > "Why did you come aboard?" -> why3
    > "Later." -> END

  node pot dorrit "Salt beef, and a potato that has seen better days. Don't tell the potato."
    -> galley2

  node galley2 narrator "He stirs. He tastes. He adds salt with the look of a man settling a debt."
    > "What's in it?" -> pot
    > "You've seen the hold." if salvage_seen -> hold2
    > "Why did you come aboard?" -> why3
    > "Later." -> END

  node hold2 dorrit "I have cooked beside that pile for a day and never once looked at the names."
    -> hold3

  node hold3 dorrit "Marta tells a story about the Cormorant. She tells it on the cold nights."
    > "Tell me the story." -> cormorant
    > "Vex never said where it came from." -> never

  node cormorant dorrit "She says the sea keeps what it takes. Then she charges me for the rum."
    -> END

  node never dorrit "No. He would have to admit where it came from, and Vex never admits anything."
    -> END

  node why3 dorrit "Because I fed this island for forty years and it never once asked if I was all right."
    -> why4

  node why4 dorrit "Then you came asking. So here I am. Don't make it strange."
    -> END

  node galley_after dorrit "The pot is still on. That is the whole news."
    > "What's in it?" -> pot
    > "Later." -> END

  # ------------------------------------------------------------------ ACT III
  # The fog flats. Dorrit came ashore with his spoons and his opinions. The camp
  # (rooms/salt_camp.adv) opens \`camp\`.
  node camp dorrit "Seven tents and nobody cooking. What kind of camp is that?"
    > "Where is everyone?" -> camp_gone
    > "What about the hut?" -> camp_hut
    > "How are you holding up?" -> holding
    > "Tell me about the wreck." -> wreck
    > "And Vex?" -> vex
    > "What about my father?" -> elias
    > "Later." -> END

  node camp_gone dorrit "Gone. Every one. The washing is still out. That's what I can't get past."
    -> camp

  node camp_hut dorrit "Locked from the outside. A pantry, if I'm any judge. Somebody was afraid of their own cook."
    -> camp

  node holding dorrit "I lost forty spoons and a good pan. I'm furious. Don't tell anyone."
    -> holding2

  node holding2 dorrit "Furious is better than frightened. I've had practice."
    -> camp

  node wreck dorrit "The water came in and the deck went quiet. I held on to Hobb's arm and thought about my spoons."
    -> wreck2

  node wreck2 dorrit "Then I was in the boat. I don't remember the rest. I don't want to."
    -> camp

  node vex dorrit "He never said thank you for the soup. That's not the crime. But I noticed."
    -> vex2

  node vex2 dorrit "The crime is he sailed us into that fog and called it weather. Soup doesn't cover that."
    -> camp

  node elias dorrit "He's thin. I'll make him something. Don't tell him it's porridge."
    -> camp
`,Uh=`# Elias Fenn, alive on the fog rock. The reunion is the plainest writing in the game: short
# sentences, beats, silence. He is cheerful about catastrophe, and he apologises for the wrong
# things. He gives rule three (the name) and the plan for the Grey Lantern.
#
# The camp scene (rooms/salt_camp.adv) opens \`found\`; afterwards the Elias hotspot opens \`hub\`.
# The player can leave the first conversation early, so the rules and the plan can be asked for
# again from the hub.
dialogue elias
  node found narrator "He turns round. He is thin, and sunburnt, and he does not let go of the chart."
    set elias_found
    -> name

  node name elias "Fenn."
    -> beat

  node beat narrator "He says my name. Then he waits."
    -> taller

  node taller elias "You're taller."
    > "Hello, Father." -> hello
    > "You're alive." -> alive
    > "It's been three months." -> months
    > "I don't know what to say." -> nothing

  node hello elias "Hello, son."
    -> look

  node alive elias "Mostly. The rest of me is still out there, I think."
    -> look

  node months elias "Three months and four days. I'd stopped counting the days. Then you walked up, and I did the sum."
    -> look

  node nothing elias "That's all right. I had three months to think of something. I've got nothing."
    -> look

  node look narrator "He looks at me. I look at him. Neither of us moves."
    -> coat

  node coat elias "I'm sorry about your coat. I took it off the hook the day I sailed."
    > "I don't care about the coat." -> care
    > "You've been wearing my coat?" -> wearing

  node wearing elias "Since the Arcadia. It's the warmest thing on the rock. I'm sorry."
    -> care

  node care narrator "He is apologising for a coat. I don't stop him."
    -> then

  node then elias "And I'm sorry about the beard. I look like a broom."
    -> birthday

  node birthday elias "I missed your birthday, didn't I?"
    > "It was three months ago." -> birthday2
    > "It doesn't matter." -> birthday3

  node birthday2 elias "I know. I had a whole speech. It was mostly about the coat."
    -> sits

  node birthday3 elias "It does. I'm sorry anyway."
    -> sits

  node sits narrator "He sits down on the salt, suddenly, as if his legs have been waiting for permission."
    -> sorry

  node sorry elias "I'm sorry I wasn't there. That's the one I meant."
    -> silence

  node silence narrator "Neither of us says anything. Behind us, the washing moves."
    -> ask

  node ask elias "Tell me who's with you. I heard the ship go down."
    > "Quill. Dorrit. Hobb." -> crew
    > "Vex brought us." -> vex

  node crew elias "Good. Quill will keep you straight. Dorrit will keep you fed. Hobb will keep the ship together."
    -> lost

  node vex elias "Vex. He's still afloat, then. That man could float on an apology."
    -> lost

  node lost narrator "He looks past me at the water. The smile stays where it is."
    -> arcadia

  node arcadia elias "The Arcadia went down out past the reef. I don't remember it. I remember the cold."
    > "The others?" -> others
    > "You don't have to talk about it." -> no_talk

  node others elias "I woke up alone. I've been looking for them ever since. From here, you can see a long way."
    -> no_talk

  node no_talk elias "I'm all right. I've had the salt and the gulls. The gulls are not good company."
    -> chart

  node chart elias "I've been charting the Lantern. It keeps a road, like anything else."
    > "Show me." -> show
    > "How do you chart a ghost?" -> ghost

  node ghost elias "The same way you chart a reef. You watch it until it stops surprising you."
    -> show

  node show narrator "He kneels and unrolls the chart on the salt. Four stones hold the corners."
    -> show2

  node show2 elias "West, then north, then back into the fog. Every time. It does not hurry."
    > "Then we can find it." -> find
    > "It's a long way from anywhere." -> far

  node find elias "We can find it. Getting off again is the part I'm working on."
    -> rules

  node far elias "Everything is a long way from here. That's what makes it quiet."
    -> rules

  node rules elias "Three things. I've had three months to be sure of them."
    -> one

  node one elias "One. The bell calls a ship in. Cut it loose and the fog loses its voice."
    -> two

  node two elias "Two. The great lantern shows it where the ship is. Put it out and the fog goes blind."
    -> three

  node three elias "Three. The Grey Lantern cannot take a ship whose crew speaks her captain's name."
    set rule_name
    note rule_name "Elias: the Grey Lantern cannot take a ship whose captain speaks its name. Cut the bell, douse the lantern, say the name."
    > "Its name?" -> its
    > "Whose name?" -> its

  node its elias "The name of the man who captains her. Not the painted one on her stern."
    -> plate

  node plate elias "It's on a brass plate. Her bow carried one, and her captain's desk has the place for it."
    > "Hobb found it in the wreck." if has nameplate -> plate_have
    > "Then we'll find it." if not has nameplate -> plan

  node plate_have elias "Then you are carrying her captain's name in your pocket. Keep it dry. We'll read it on his desk."
    -> plan

  node plan elias "So. We go aboard. Hobb cuts the bell. Quill puts out the great lantern. One of us says the name."
    > "That's three impossible things." -> imposs
    > "What about the crews?" -> crews

  node imposs elias "Four. We all come back. I'm less sure of that one."
    -> crews

  node crews elias "They're still aboard. Still at their posts. Eighty years of standing watch."
    > "Can they be freed?" -> free
    > "And Tam?" -> tam

  node free elias "I think so. I've watched her long enough to think so."
    -> tam

  node tam elias "There's a bell on her. It rings every night. Hobb will know who's pulling it."
    -> bell

  node bell narrator "Out in the fog, a bell rings once. Hobb lifts his head."
    -> hobb

  node hobb narrator "He doesn't say anything. He doesn't have to."
    -> end

  node end elias "Go on. Before I get comfortable."
    -> END

  # Afterwards. The rules and the plan are offered again in case the player left the first
  # conversation early; the hub is the quiet scene with the chart and the father.
  node hub elias "Still here? The plan won't wait. Neither will Hobb."
    > "Tell me about the chart." -> chart_hub
    > "What happened to the Arcadia?" -> arcadia_hub
    > "Did you see the Marrow?" if not seen:elias.marrow -> marrow
    > "What are the three rules?" if not rule_name -> rules_again
    > "What's the plan?" if rule_name -> plan_again
    > "Whose camp is this?" -> camp_hub
    > "The slate says the bell called them." if looked:salt_camp.hut -> camp_slate
    > "Are you all right?" -> allright
    > "I'll be back." -> END

  node chart_hub elias "The chart is the only thing I've made out here. I'd like it to be worth something."
    -> hub

  node arcadia_hub elias "She was a good ship. I was lucky. I keep thinking about the ones who weren't."
    -> hub

  node marrow elias "Once. From the reef. I waved. I don't think he saw me."
    -> hub

  node rules_again elias "Bell, lantern, name. I'll say them slower."
    -> one

  node plan_again elias "Hobb takes the bell. Quill takes the lantern. You and I take the name."
    -> plan_details

  node plan_details elias "We do it together, or we don't do it at all."
    -> hub

  node camp_hub elias "It was here when I came. The pots were still warm. I've tried not to move anything."
    > "You think someone was here?" -> camp_hub2
    > "That's not an answer." -> camp_hub3

  node camp_hub2 elias "I think someone left in a hurry. I don't think they're coming back."
    -> hub

  node camp_hub3 elias "No. It isn't. I've had three months to make one up, and I can't."
    -> hub

  node camp_slate elias "I heard it too. Every night. I stopped going to the door."
    -> hub

  node allright elias "I'm alive. I'm drawing. I'm not hungry. That's three more than I expected."
    -> hub
`,Yh=`# Act IV: Mordant in the Grey Lantern's cabin, and the last choice of the voyage.
#
# Mordant's conversation opens \`ending\` once his name has been spoken. The player gives Vex
# something to hold on to, or does not, and then decides whether to lay the crews to rest or
# take the living and run.
#
# Read here, set by the deck and the captain's cabin: bell_cut, lantern_doused, name_spoken,
# tam_freed. This file sets vex_trust, curse_broken, ending_fog_lifts, escaped_fog and
# ending_long_way, and ends the voyage with win.

dialogue ending
  # The confrontation. Mordant is courteous, ancient and territorial. He never threatens.
  node root narrator "Mordant waits beside the desk. The cabin is quiet enough to hear the ship move."
    -> vex_rail

  node vex_rail narrator "Vex's voice comes down the companionway. He is on the deck above, with the longboat's rope in his hands."
    -> vex_ask

  node vex_ask vex "The boat. The rope. Your word. Give me one of them, and I'll know where I stand."
    > "Take the boat." -> vex_boat
      set vex_trust
    > "Take the rope." -> vex_rope
      set vex_trust
    > "You have my word." -> vex_word
      set vex_trust
    > "You'll get nothing from me." -> vex_none
      set vex_trust = false

  node vex_boat vex "The boat, then. If this goes wrong, I am not waiting for a signal."
    -> terms

  node vex_rope vex "A rope. I can hold a rope. It is the waiting I am bad at."
    -> terms

  node vex_word vex "Your word. I have been paid in worse."
    -> terms

  node vex_none vex "Then I keep the oars. Do not expect me to use them for anyone else."
    -> terms

  # The last choice. A needs all three holds; B is always there.
  node terms mordant "You want the living. I understand. The dead are mine."
    > "Why do you keep them?" -> keep
    > "What happens if I free them?" -> free_q
    > "Lay them to rest." if bell_cut and lantern_doused and name_spoken -> rest
      set curse_broken
      set ending_fog_lifts
    > "Take the living and run." -> run
      set escaped_fog
      set ending_long_way

  node keep mordant "A ship needs hands. The fog brings me hands. I have never pretended it was kind."
    -> terms

  node free_q mordant "Then the bell falls quiet and the lantern goes dark, and my name is only a name. I would go with them."
    > "You would let them go?" -> free_q2
    > "Then I will do it." if bell_cut and lantern_doused and name_spoken -> rest
      set curse_broken
      set ending_fog_lifts
    > "Not yet." -> terms

  node free_q2 mordant "I have kept this ship afloat for eighty years. I am tired, and I am not sorry."
    -> terms

  # Lay them to rest: ring the bell for the dead, speak the name, let the fog go.
  node rest narrator "We go up the ladder. Mordant follows, slowly."
    -> rest0

  node rest0 narrator "On deck, the crew stands at its posts. Hobb is waiting at the mast with the clapper in his hand."
    -> rest1

  node rest1 narrator "He gives it to me. I climb the shrouds as far as I dare, which is not far, and strike the bell where it hangs."
    -> rest2

  node rest2 narrator "Three notes for the watch. One for home. Down on the deck, the crew lifts its heads."
    -> rest3

  node rest3 fenn "Mordant. Your watch is over."
    -> rest4

  node rest4 narrator "The fog goes out like a tide. By the time the hull begins to settle, we are in the longboat, and nobody remembers climbing down."
    -> rest5

  node rest5 narrator "Mordant stands at his rail and takes off his hat, first to his crew and then to the sea. My father puts a hand on my shoulder, and we watch the sea take her."
    win

  # Take the living and run: the dead stay, and so does the fog.
  node run mordant "Take your living, then. The dead are mine, and the fog is patient."
    -> run_chart

  # Elias stays: the Lantern's road can only be drawn from the rock, and he will not leave the
  # chart half done. This is the one choice in the ending that is his.
  node run_chart narrator "My father has not moved. He looks at the chart in his hands, then at me. It is the look he gives a coastline that is not finished."
    -> run_stay

  node run_stay elias "Take them home. Someone has to finish the other half, and it can only be drawn from the rock."
    -> run_stay2

  node run_stay2 fenn "You have been alone out there for three months."
    -> run_stay3

  node run_stay3 elias "Which makes me the best man for it. Go before I change my mind. Or you change it for me."
    -> run_tear

  node run_tear narrator "He tears the chart along the fold and puts the blank half in my hand. He keeps the half with the Lantern's road on it, and the pencil."
    -> run2

  node run2 narrator "We go up the ladder and over the rail into the longboat. Dorrit has the pot hot. Vex has the oars. He does not say why he is rowing, and nobody asks."
    -> run3

  node run3 narrator "We put my father ashore on the fog rock. He waves. This time Vex sees it, and waves back."
    -> run4

  node run4 narrator "Behind us, the Grey Lantern turns away, dark and dumb. Her crew stays at its posts. The fog closes over them."
    -> run5

  node run5 narrator "Ahead, the harbour light. I count the living: Quill, Hobb, Tam, Dorrit, Vex, and me. Six in the boat. It is one fewer than I wanted."
    win
`,jh=`dialogue hobb
  node root hobb "Fenn."
    set met_hobb
    > "Hobb?" -> name
    > "What's wrong with the mast?" -> mast
    > "I need a carpenter." -> need
    > "Later." -> END

  node name hobb "Bosun. Carpenter. Both."
    -> mast

  node need hobb "You'll want the Marrow. Everybody wants the Marrow."
    -> mast

  node mast hobb "The iron band on the mast has seized. I've been at it since sundown."
    > "Can you free it?" -> fix
    > "What do you need?" -> fix
    > "I'll leave you to it." -> END

  node fix hobb "A lever, and a hand that isn't holding the mast."
    > "I'll hold it." -> hand
    > "There's a crowbar on the counter." -> lever

  node hand hobb "Then take the crowbar and get under the band. I'll hold her."
    -> END

  node lever hobb "Aye. Use it. I'll hold her."
    -> END

  node again hobb "The band won't move. The crowbar's on the counter, if you're helping."
    > "I'm helping." -> hand
    > "I'll come back." -> END

  node joined hobb "She'll hold. I'm coming with her."
    set met_hobb
    > "Your brother?" -> brother
    > "Welcome aboard." -> END

  node brother hobb "Tam. He went into the fog three months back. I want him back."
    > "We'll find him." -> promise
    > "I'm sorry." -> sorry

  node promise hobb "Aye."
    -> END

  node sorry hobb "Don't be. Be useful."
    -> END

  node after hobb "The mast will hold. I'll be at the Marrow."
    > "Your brother?" -> brother
    > "Right." -> END

  # ------------------------------------------------------------------ ACT II
  # The hold. Hobb is the one who knows a name on the barrels, and talking to him sets
  # salvage_seen too, so a player who never looks at the stack still gets the beat.
  node hold hobb "Arcadia."
    set salvage_seen
    -> hold2

  node hold2 hobb "Tam sailed on her. My brother. And here is her cargo, stacked like firewood."
    > "Vex has been picking the wrecks." -> pick
    > "Are you sure it is her?" -> sure
    > "I'm sorry, Hobb." -> sorry2

  node sure hobb "I tarred that name on her stern the winter before she sailed. I would know it anywhere."
    -> pick

  node pick hobb "Picking them clean, and selling it back to the island. At a profit."
    -> anger

  node anger hobb "He will answer for it. Not today. Today I am counting barrels."
    -> END

  node sorry2 hobb "Don't be sorry. Be angry. It lasts longer."
    -> END

  node hold_after hobb "Forty-one barrels. I will know if one goes missing."
    > "Who do we tell?" -> tell2
    > "Good." -> END

  node tell2 hobb "The crew. All of it. He can't sell cargo we have all seen."
    -> END

  # ------------------------------------------------------------------ ACT III
  # The wreck on the reef. Hobb hears the bell across the flats and knows the hand on it.
  # The plate is the name; the plan is his end of the job, not the whole of it.
  node bell hobb "You heard it. Three, then one."
    -> bell2

  node bell2 narrator "Across the flats, the bell again. Three notes, then one. It does not hurry."
    -> bell3

  node bell3 hobb "That is Tam. That is my brother's hand on the rope."
    > "How do you know?" -> know
    > "Tam is alive, then." -> alive
    > "It could be the wind." -> wind

  node know hobb "He rings it like he did on the Arcadia. Three to call the watch, one to send them home."
    -> tam

  node alive hobb "He is at his post. If he were not, the bell would be quiet."
    -> tam

  node wind hobb "The wind has never kept time. Tam does."
    -> tam

  node tam hobb "Tam Hobb. Able seaman. Three months in the fog, and still counting the watches."
    > "We will bring him out." -> promise3
    > "Who rings for the others?" -> others

  node promise3 hobb "Aye. When we board her, I go to the bell first. You find your father."
    -> plate

  node others hobb "Every lost ship has a hand on a rope. Somebody is ringing for all of them."
    -> plate

  node plate narrator "Hobb works a broken bow timber out of the wreck. The wood is grey, and it does not belong to this ship."
    -> plate2

  node plate2 hobb "M. Mordant. Master. Torn off her bow and jammed in another ship's ribs."
    give nameplate
    note mordant_name "M. MORDANT, MASTER, on a brass plate from the Grey Lantern's bow."
    > "The Grey Lantern's bow." -> bow
    > "Who is Mordant?" -> mordant
    > "Then we have a name." -> name2

  node bow hobb "Aye. Grey paint under the salt. The old ship has been shedding pieces for eighty years. This one still has her name on it."
    -> plan

  node mordant hobb "Her master. It is the one thing the sea gave back."
    -> plan

  node name2 hobb "We have a name. What we do with it is your business."
    -> plan

  node plan hobb "When we board her, I go to the bell. I cut it loose before the rest of you are aboard."
    set bell_plan
    > "And the name?" -> plan_name
    > "Why did you come?" -> why3
    > "We board her." -> END

  node plan_name hobb "That is your business. I only know it is written on brass."
    -> END

  node plan_after hobb "The bell is mine. The rest is yours."
    > "Why did you come?" -> why3
    > "Wait for my word." -> END

  node why3 hobb "Tam went to sea because I did. He is three years younger and always one rope ahead."
    > "You came to bring him home." -> why4
    > "You think he is still alive." -> why5

  node why4 hobb "He would do the same for me. That is the whole of it."
    -> END

  node why5 hobb "He is ringing that bell. A dead man has no need to keep time."
    -> END
`,Xh=`dialogue marta
  node root marta "Elias Fenn's boy. Everyone on this island knows whose son you are."
    -> root2
  node root2 marta "Sit down. That's Old Rook in the corner. He came back from the fog."
    -> root3
  node root3 marta "Dorrit's in the kitchen. Pike's crew says he stole stores from the boat shed."
    > "What happened to my father?" -> father
    > "I need a ship." -> ship
    > "Tell me about the island." -> island
    > "Tell me about Rook." -> rook
    > "Did Dorrit take the stores?" -> dorrit
    > "Nothing. I'll stand." -> bye
    > "Rook told me the fog hunts by sound." if rule_sound -> rule
    > "I have my father's chart." if has chart -> chart
  node again marta "Back again. Rook's still in his corner, and the kettle's still on. What do you need?"
    > "What happened to my father?" -> father
    > "I need a ship." -> ship
    > "Tell me about the island." -> island
    > "Tell me about Rook." -> rook
    > "Did Dorrit take the stores?" -> dorrit
    > "Nothing. I'll stand." -> bye
    > "Rook told me the fog hunts by sound." if rule_sound -> rule
    > "I have my father's chart." if has chart -> chart
  node cleared marta "Dorrit has told the whole kitchen he was right all along. Pike's crew has gone very quiet. What do you need?"
    > "What happened to my father?" -> father
    > "I need a ship." -> ship
    > "Tell me about the island." -> island
    > "Tell me about Rook." -> rook
    > "Nothing. I'll stand." -> bye
    > "Rook told me the fog hunts by sound." if rule_sound -> rule
    > "I have my father's chart." if has chart -> chart
  node father marta "He kept a room above the back door. I haven't touched it."
    -> father2
  node father2 marta "He was charting the fog. He said the answer was out there, not in a bottle."
    > "Can I see his room?" -> room
    > "What was he like?" -> like
    > "I'll find him." -> bye
  node room marta "When you can look at it without breaking. It's over the back door, up in Upper Town."
    note father_room "Marta has kept my father's room above the Salty Keel's back door just as he left it."
    -> bye
  node like marta "He laughed at weather. He laughed at everything except a bad chart."
    -> bye
  node ship marta "There's one seaworthy ship in this harbour. The Marrow, and Captain Vex has her."
    -> ship2
  node ship2 marta "He won't sail into the fog. He'll tell you himself, at his warehouse."
    > "Where is his warehouse?" -> vex_where
    > "I'll make him sail." -> vex_make
    > "Who can crew her?" -> crew
  node vex_where marta "The counting house on Wreckers' Lane. The sign says Vex's Warehouse. He's proud of the sign."
    -> bye
  node vex_make marta "Then bring him something he wants more than safety. I've never met a man who couldn't be bought."
    -> bye
  node crew marta "A cook, a navigator, a carpenter. Most of them are in this room or hiding from it."
    > "Who's the cook?" -> dorrit
    > "Who's the navigator?" -> quill_crew
    > "Who navigated for my father?" -> rook
    > "I'll find them." -> bye
  node island marta "Half the harbour is empty. The other half is related, and scared."
    -> island2
  node island2 marta "Six ships gone in three years. Five came back empty. Your father's never came back at all."
    > "Empty how?" -> empty
    > "What does Vex say?" -> vex
    > "Who is Dorrit?" -> dorrit
    > "That's enough." -> bye
  node empty marta "Sails set, wheel tied off, not a soul aboard. That's not weather."
    -> island2
  node vex marta "Captain Vex. He owns the Marrow, and most of the salvage on this coast."
    -> vex2
  node vex2 marta "The island blames him for the missing ships. He lets them. Fear keeps his prices high."
    > "Where do I find him?" -> vex_where
    > "Will he sail?" -> vex_will
    > "I'll talk to him." -> bye
  node vex_will marta "Not into the fog. Not for money. Not for me."
    -> bye
  node quill_crew marta "Quill. Young, sharp, and she wants the chart table. Vex has her compass, so she can't sail."
    -> bye
  node rook marta "Old Rook. He navigated for your father. He came back from the fog alone."
    -> rook2
  node rook2 marta "He drinks in the corner. He might talk to you. He liked your father."
    > "I'll talk to him." -> bye
    > "Why did he come back?" -> rook_why
  node rook_why marta "Nobody knows. He won't say. That's why people buy him drinks."
    -> bye
  node dorrit marta "Dorrit. He's cooked here since before I had the lease. Stores went missing from the boat shed."
    -> dorrit2
  node dorrit2 marta "Pike's crew says he sold them. He didn't. I know him, and I know Pike."
    > "I'll clear his name." -> dorrit_job
    > "What was taken?" -> stores
    > "Not my problem." -> dorrit_cold
  node stores marta "Salt, flour, dried fish. Six crates. Enough to feed a crew, not a town."
    -> dorrit2
  node dorrit_job marta "Find who took them. The boat shed's on the lane. Pike's men are always there."
    note dorrit_blamed "Marta: stores are missing from the boat shed. Pike's crew blames Dorrit. Clear his name."
    -> bye
  node dorrit_cold marta "Then don't expect him to cook for you."
    -> bye
  node rule marta "Rook told you that? Then keep your bell quiet and your mouth shut."
    -> rule2
  node rule2 marta "I've buried enough people who didn't."
    -> bye
  node chart marta "Then you've got more than most. Don't let Vex see it. He'll want half."
    -> bye
  node bye marta "Go on. The door's heavier than it looks."
`,Qh=`# Mordant, master of the Grey Lantern. He is courteous, tired and territorial: he keeps taking
# ships because he is afraid to sink, and he keeps the crews because he cannot sail her alone.
# He is never gory; the horror is that he is polite.
#
# The room only calls this tree once \`name_spoken\` is set. The first beat asks whether the bell
# and the lantern are already done; the full confrontation follows only then, and its last
# choice hands off to the \`ending\` tree (owned by another writer).
dialogue mordant
  node root narrator "The cold gathers at the end of the cabin. The light through the broken planks does not reach it."
    -> who

  # Coming back to him after a "Not yet" or "Give me a moment": the room sends the player here
  # (talk mordant at again / again_ask) instead of replaying the introduction from the root.
  node again narrator "The cold gathers at the end of the cabin again, patient as before."
    -> report

  node again_ask narrator "The cold gathers again. He is waiting for the question."
    -> ask

  node who mordant "I am Mordant. You said my name. Nobody has said it in eighty years."
    -> report

  node report mordant "Tell me what you have done to my ship."
    > "Your bell is cut. Your light is out." if bell_cut and lantern_doused -> done
    > "Not yet. Not all of it." if (not bell_cut or not lantern_doused) -> early
    > "What do you want from us?" -> want

  node want mordant "Nothing. I want to stay afloat. I want the water to leave me alone."
    -> report

  node early mordant "Then we are not finished. Cut my bell. Put out my light. I will be here."
    -> early2

  node early2 narrator "The cold goes out of the cabin. The cabin is only a cabin again."
    -> END

  node done mordant "You cut my bell. You put out my lantern. And still you stand in my cabin."
    > "You took our ship first." -> took
    > "Let the crews go." -> letgo
    > "We only want to leave." -> leave

  node took mordant "Your ship came too close. The fog brought it to me. I did not choose it."
    -> sorry

  node letgo mordant "Let them go where? I am the only thing keeping them afloat."
    -> sorry

  node leave mordant "Everyone wants to leave. Nobody asks what stays behind."
    -> sorry

  node sorry narrator "He is quiet for a moment. When he speaks again, his voice is lower."
    -> why

  node why mordant "You want to know why I take ships."
    -> why2

  node why2 mordant "Because a ship that stops is a ship that sinks. I will not sink."
    -> why3

  node why3 narrator "It is the only thing he has said that sounds like fear."
    -> crew

  node crew mordant "And because a ship needs hands. Mine have been still for eighty years."
    -> crew2

  node crew2 mordant "So I keep the crews. They keep their watches, and I keep them out of the water."
    > "They are not yours. They were taken." -> notyours
    > "What happens if you let go?" -> letoff
    > "You could come with us." -> come

  node notyours mordant "Taken. Yes. I know the word. I have had eighty years to learn it."
    -> ask

  node letoff mordant "They go where I cannot follow. That is what rest means. I never liked the sound of it."
    -> ask

  node come mordant "With you. To a harbour that has already written me down as a wreck."
    -> ask

  node ask mordant "Ask what you came to ask. I have had a long time to think of answers."
    > "Why keep them at their posts?" -> posts
    > "What happens to the fog?" -> fog
    > "Did you take the Arcadia too?" -> arcadia
    > "What are you afraid of?" -> afraid
    > "I'm ready." -> ready
    > "Not yet." -> END

  node posts mordant "They are at their posts because I am still here. If I let go, they go out like a lamp."
    -> ask

  node fog mordant "The fog is my wake. It will not go while I am still in the water."
    -> fog2

  node fog2 mordant "Let me go and it goes with me. That is the whole of the bargain."
    -> ask

  node arcadia mordant "The ship with the broken bow. The fog brought her crew to me, and I kept them."
    -> arcadia1b

  node arcadia1b mordant "I keep the hands. The hulls I let go. It seemed civil."
    -> arcadia2

  node arcadia2 mordant "One of them rang the bell every night. I think he was calling for his brother."
    -> ask

  node afraid mordant "The water. The quiet after it. I have been afraid for eighty years, and I am tired."
    -> ask

  node ready narrator "Elias is beside me. The fog is quiet, waiting on a word."
    -> ready2

  node ready2 mordant "Then say it here, in the room where I kept it. And decide what my ship becomes."
    > "It ends here, Mordant." -> END
      talk ending
    > "Give me a moment." -> END
`,Jh=`dialogue nell
  node root nell "Elias Fenn's boy, back from the mainland. Buying, or loitering? I charge for both."
    > "What's the news?" -> news
    > "What are you selling?" -> selling
    > "Tell me about the village." -> village
    > "Anything strange on the water?" -> strange
    > "Just looking. Goodnight." -> bye
  node news nell "Half the boats are tied up. The other half are for sale. Nobody's buying."
    > "Why not?" -> why
    > "What's for sale?" -> sale
    > "I'll look elsewhere." -> bye
  node why nell "Because the fog took six ships, and nobody wants to be the seventh."
    -> bye
  node sale nell "Rope, nets, a dinghy with a good name. The owners have gone inland."
    -> bye
  node selling nell "Rope, lamp oil, dried fish, and gossip. The fish is fresher."
    -> bye
  node village nell "Forty houses and a well. Half are empty since the ships stopped coming back."
    -> village2
  node village2 nell "The rest are related. That's why it's quiet."
    > "It looks peaceful." -> peaceful
    > "Goodnight, Nell." -> bye
  node peaceful nell "It is. That's what worries me. A harbour town should sound like a harbour."
    -> bye
  node strange nell "The fog's closer this month. On still nights the fishermen won't go past the reef."
    -> strange2
  node strange2 nell "Old Onn says the water goes quiet out there. I sell rope, not answers."
    > "I'll ask her." -> bye
    > "What do you think it is?" -> think
  node think nell "I think the fog is listening. The gulls stopped first. They always know."
    -> bye
  node bye nell "Go on. If you hear anything out there, I'm buying. News, I mean. Not rope."
`,Zh=`dialogue onn
  node root onn "Mind the cobbles. They're wet, and I've swept them twice."
    > "You knew the Arcadia's crew?" -> crew
    > "What's wrong with the water past the reef?" -> water
    > "Do you need help?" -> help
    > "I'll leave you to it." -> bye
  node crew onn "My husband's cousin. The boy from the end house. Ten off this street."
    -> crew2
  node crew2 onn "I counted them out. I counted them back. Only the first part worked."
    > "What happened to them?" -> water
    > "I'm sorry, Onn." -> sorry
  node sorry onn "Sorry doesn't sweep cobbles. Find out what's out there."
    -> bye
  node water onn "Past the reef the water goes quiet. Not calm. Quiet. The fishermen won't say its name."
    -> water2
  node water2 onn "They call it the Shroud. Don't say it twice."
    > "What do you think it is?" -> think
    > "I'll be careful." -> bye
  node think onn "I think it's old. Older than the harbour, older than the name. It was here first."
    -> bye
  node help onn "No, child. I have the broom, the step, and a lot of time."
    -> help2
  node help2 onn "What I want is one person to come back and tell me what's out there."
    > "I'll try." -> promise
    > "I can't promise that." -> honest
  node promise onn "Then try. When you know, come and tell me. Not the harbourmaster. Me."
    -> bye
  node honest onn "No. Nobody can. That's why I'm asking anyway."
    -> bye
  node bye onn "Mind the cobbles. I've swept them twice."
`,el=`dialogue pike
  node root pike "This lane is private. Wreckers' business. You are not on the list."
    > "Who are the wreckers?" -> wreckers
    > "What's in the shed?" -> shed
    > "I'm looking for Vex's rudder." if met_vex -> rudder
    > "The man you paid talked." if seen:dorrit.confess -> confess
    > "Step aside." -> aside
    > "Sorry. Wrong lane." -> bye

  node wreckers pike "We take what the fog leaves. Ships, cargo, anything that floats. It is salvage."
    > "And the people?" -> people
    > "What's in the shed?" -> shed
    > "The man you paid talked." if seen:dorrit.confess -> confess
    > "I'm looking for Vex's rudder." if met_vex -> rudder

  node people pike "We don't take people. People are not salvage. There is a rule."
    > "You have a rule for people?" -> form
    > "What's in the shed?" -> shed
  node form pike "There is a rule for everything. That is what makes it a profession."
    > "What's in the shed?" -> shed
    > "Goodbye." -> bye

  node shed pike "Stores. Some of it ours, some of it waiting to be ours. It is all written down."
    > "Those crates came from the boat shed." if saw_stores -> stores
    > "And Vex's rudder?" if saw_stores and met_vex -> rudder
    > "Right. Sorry." -> bye

  node stores pike "They came ashore by themselves. Everything comes ashore by itself. That is how salvage works."
    > "The man you paid told me." if seen:dorrit.confess -> confess
    > "The crates are from the boat shed." if saw_stores -> crates
    > "That is not how salvage works." -> argue
  node crates pike "Crates are crates. The boat shed is full of them, and none of them have names."
    > "The man you paid told me." if seen:dorrit.confess -> confess
    > "Goodbye." -> bye
  node argue pike "It is if I write it down. I am very careful about what I write down."
    > "The man you paid told me." if seen:dorrit.confess -> confess
    > "Goodbye." -> bye

  node rudder pike "Vex's rudder? I don't have Vex's rudder. I have a rudder."
    > "The man you paid told me." if seen:dorrit.confess -> confess
    > "The stores in your shed are stolen too." if saw_stores -> crates
    > "Then where is it?" -> where
    > "I'll find it myself." -> bye
  node where pike "Ask the man who found it. I only catalogued it."
    > "Who found it?" -> finder
    > "The man you paid told me." if seen:dorrit.confess -> confess
  node finder pike "A survivor. They come out of the fog sometimes. They don't talk much, and they don't stay."
    > "Where is he now?" -> survivor
    > "Did you pay him to steal for you?" -> accused
  node survivor pike "The boat shed, most likely. He sleeps where the stores used to be."
    > "He told me already." if seen:dorrit.confess -> confess
    > "I'll find him." -> bye

  node accused pike "I paid him for salvage. The stores were salvage. The rudder was salvage."
    > "The man you paid told me." if seen:dorrit.confess -> confess
    > "Salvage is theft with a longer word." -> caught_soft
  node caught_soft pike "It is a longer word. That is why I use it."
    > "The man you paid told me." if seen:dorrit.confess -> confess
    > "Goodbye." -> bye

  node confess pike "Wen. He cannot keep his mouth shut for two crowns. I should have known."
    -> confess2
  node confess2 pike "So I paid him. So the stores are mine. That does not make the rudder yours."
    > "Vex wants it back." if met_vex -> caught
    > "I'll take it to Vex myself." if met_vex -> caught
    > "Who owns a rudder like that?" if not met_vex -> owner
    > "Goodbye." -> bye

  node owner pike "A ship's captain, and a loud one. Vex, at the warehouse. Go and ask him what he wants, then come back."
    -> bye

  node caught pike "All right. Take the rudder. I will write it off as weather and a bad night."
    -> caught2
  node caught2 pike "And tell the cook I did not steal his name. I only took the stores."
    set rudder_back
    > "I'll tell him." -> END
    > "You'll tell him yourself." -> caught3
  node caught3 pike "I would rather not. He has a wooden spoon and strong opinions."
    > "Then stay out of the Salty Keel." -> END

  node aside pike "You are not a wrecker. You are a cartographer in a wet coat."
    > "I'm the cartographer who knows Vex." if met_vex -> rudder
    > "I'm the cartographer who is asking nicely." -> nice
    > "Goodbye." -> bye
  node nice pike "Nicely is not a category. Come back with a category."
    > "Goodbye." -> bye

  node after pike "The rudder's on its way to the Marrow. I have the record."
    > "Good." -> END
    > "Stay out of the boat shed." -> after2
  node after2 pike "The boat shed is not my department."

  node bye pike "Mind the chain on your way out."
`,tl=`dialogue quill
  node root quill "Marta says the cartographer is back."
    set met_quill
    > "I need a navigator." -> want
    > "You're Quill." -> name
    > "Who told you that?" -> marta
    > "Later." -> END

  node marta quill "Marta tells everyone everything. It's how the island stays alive."
    -> want

  node name quill "Quill. Lookout on the Marrow, and a better navigator than the one we've got."
    -> want

  node want quill "Vex won't sail. And I won't sail without my compass."
    > "Where's your compass?" -> compass
    > "Why won't Vex sail?" -> why
    > "Then I'll find another crew." -> END

  node why quill "Ask him. He's been counting his money all night."
    > "Where's your compass?" -> compass
    > "I'll ask him." -> END

  node compass quill "Vex has it. I owe him for a passage, so he keeps it in his pocket."
    > "What do you owe him?" -> debt
    > "I'll get it back." -> promise
    > "Good luck with that." -> END

  node debt quill "Half a passage. I paid the rest in work. He says lookout work doesn't count."
    -> promise

  node promise quill "Bring it back and I'll navigate you past the fog. Any fog."
    -> END

  node again quill "Still no compass. Still no voyage."
    > "Where does Vex keep it?" -> compass
    > "I'm working on it." -> END

  node got quill "That's my compass. Vex gave it up?"
    set met_quill
    > "He had no choice." -> gave
    > "The debt is paid." -> gave
    > "It was in his safe." -> found

  node gave quill "Then he's afraid of something. Good."
    -> join

  node found quill "Liar. I like it."
    -> join

  node join quill "I'm your navigator. I'll take the nest when you need eyes."
    > "My father is out there." -> father
    > "Welcome aboard." -> END

  node father quill "Then we'll find him. I'm good at finding things."
    -> END

  node after quill "Navigator. Don't make me regret it."
    > "My father is out there." if not seen:quill.father -> father
    > "Welcome aboard." -> END

  # ------------------------------------------------------------------ ACT II
  # Aboard the Marrow. The crow's nest (rooms/crows_nest.adv) opens \`nest\`; the stern gallery
  # (rooms/marrow_gallery.adv) opens \`gallery\`; any deck scene can open \`aboard\`. All act 2.
  node aboard quill "The deck's yours, cartographer. Try not to chart the rigging."
    > "What's the fog doing?" -> leaning
    > "Where's Vex?" -> vex_at
    > "Later." -> END

  node vex_at quill "At the chart table with the door shut. He has been in there since the sun came up."
    -> END

  node leaning quill "From the island it looked flat. Out here it is leaning to windward, like a sail."
    > "Fog doesn't lean." -> lean2
    > "What's under it?" -> under

  node lean2 quill "This one does. And the sea has gone flat in a stripe under it. A stripe, not a wave."
    -> under

  node under quill "Something big and slow is dragging it. The wind is going the other way."
    > "That isn't weather." -> weather
    > "Keep watching." -> END

  node weather quill "No. But I would like to be wrong, so I will keep looking."
    -> END

  # The crow's nest.
  node nest quill "You're in my office. Mind the edge."
    > "What do you see?" -> see
    > "Why keep watch from up here?" -> why_nest
    > "Later." -> END

  node see quill "The fog is standing up. Like a sail taking wind, only there is no wind."
    -> see2

  node see2 quill "And there is a sound. Put your ear on the rail. It is like a rope drawn over wood."
    > "I don't hear anything." -> hear
    > "Something's out there." -> out

  node hear quill "You will. It comes and goes. It came while you were climbing."
    -> out

  node out quill "It has been keeping pace since we cleared the harbour. Slow, like it has all day."
    note fog_leans "Quill: the fog leans to windward and the sea goes flat under it. Something big and slow is in the Shroud."
    > "Vex should know." -> tell
    > "What do you want to do?" -> want2

  node tell quill "Vex doesn't come up here. He doesn't like the view."
    -> want2

  node want2 quill "I want the chart table. I can navigate. He has me counting gulls."
    > "Then navigate us." -> navigate
    > "Give him time." -> time

  node navigate quill "Say that to him, and I'll have the chart in one hand and this glass in the other."
    -> END

  node time quill "I have given him long enough. I'm not patient. I'm just up high."
    -> END

  node why_nest quill "Up here I can see the shape of things. Down there I'm a pair of hands."
    -> END

  node nest_after quill "Still leaning. Still leaning the wrong way."
    > "Anything else?" -> out
    > "Keep watching." -> END

  # The stern gallery, off watch.
  node gallery quill "Off watch. Don't tell anyone."
    > "Why out here?" -> gal_why
    > "What is the fog like from the stern?" -> gal_fog
    > "How long were you a lookout?" -> gal_lookout
    > "Vex has been stripping the wrecks." if salvage_seen -> gal_salvage
    > "Goodnight, Quill." -> END

  node gal_more narrator "The sun goes down another inch. The rail is warm where her arm was."
    > "Why out here?" -> gal_why
    > "What is the fog like from the stern?" -> gal_fog
    > "How long were you a lookout?" -> gal_lookout
    > "Vex has been stripping the wrecks." if salvage_seen -> gal_salvage
    > "Goodnight, Quill." -> END

  node gal_why quill "Because a ship is only as good as the one who knows where it is. I'm practising."
    -> gal_more

  node gal_fog quill "From here it is a wall. From up top it is a thing with a current in it."
    -> gal_more

  node gal_lookout quill "Four years. I'm done looking at things. I want to know where they are."
    -> gal_more

  node gal_salvage quill "I know. I have been steering round those barrels since we cleared the harbour."
    -> gal_salvage2

  node gal_salvage2 quill "He pays me. Don't ask me to be sorry for him. Ask me to be better than him."
    -> gal_more

  node gallery_after quill "The sun is nearly in the sea. It does that every night, and I still watch it."
    > "Why out here?" -> gal_why
    > "Goodnight, Quill." -> END

  # ------------------------------------------------------------------ ACT III
  # The fog flats and the castaway camp. Quill came off the Marrow with her glass and nothing
  # else. The camp (rooms/salt_camp.adv) opens \`camp\`; the boardwalk at the far pans opens
  # \`pans\`. She does not mention Fenn's father until she has seen him alive.
  node camp quill "Seven tents. A dozen shirts on the line. Nobody. I counted twice."
    > "Where did they go?" -> camp_gone
    > "What about the hut?" -> camp_hut
    > "Tell me about the wreck." -> wreck
    > "What about my father?" -> elias
    > "And Vex?" -> vex
    > "How are you holding up?" -> holding
    > "Later." -> END

  node camp_gone quill "The fog took them, or the camp did. I don't like either answer."
    -> camp

  node camp_hut quill "Locked from the outside, same as the tents. That's a store, shut up tidy by people who meant to come back."
    -> camp

  node wreck quill "I was in the nest when she went. I heard the bell. Then the water."
    -> wreck2

  node wreck2 quill "I didn't see what took us. I felt it go past under the hull."
    -> camp

  node vex quill "He took us in to prove he was right. He is still proving it."
    -> vex2

  node vex2 quill "I would trust him with a heading. Not with a life."
    -> camp

  node elias quill "He's alive. Go and be his son for a minute. We can wait."
    -> camp

  node holding quill "I lost my ship. I didn't lose you. I'm counting that as a win."
    -> camp

  # The far pans, optional: the Shroud from a safe distance.
  node pans quill "From here the fog looks like weather. That's what I keep telling myself."
    > "What do you see?" -> pans_see
    > "Are you all right?" -> pans_ok
    > "We should go back." -> END

  node pans_see quill "The edge of it. It has a line, like a coast. At night the line comes closer."
    -> pans

  node pans_ok quill "No. But the wind is doing something to my eyes, so I'll blame it."
    -> pans
`,nl=`dialogue rook
  node root rook "Elias Fenn's boy. I'd know those eyes anywhere. Don't look pleased about it."
    set met_rook
    > "You knew my father." -> knew
    > "You're the one who came back." -> came_back
    > "I need to know about the fog." -> fog
    > "I found your old log." if weather_works_store and not rook_story -> log
    > "Tell me the rule again." if rook_story -> after
    > "I'll leave you to your drink." -> bye
  node knew rook "I navigated for him for eleven years. Best captain on the Shroud run. Worst singer."
    > "He sailed into the fog three months ago." -> lost
    > "You were with him when he went?" -> with_him
  node lost rook "I heard. The Arcadia went in at dusk with a full crew. Nobody came out."
    -> lost2
  node lost2 rook "I wasn't aboard that night. I was here, drinking. That's the part I can't fix."
    > "Where were you?" -> with_him
    > "What took her?" -> fog
  node with_him rook "I shipped on the Kestrel after your father retired me. She went into the fog. I came back."
    -> with_him2
  node with_him2 rook "I don't remember how. I remember the bell. That's all I'll say sober."
    > "The bell?" -> fog
    > "Then say it drunk." -> drunk
  node drunk rook "No. I've tried. The drink makes it louder."
    -> bye
  node came_back rook "One man came back. That's me. It's not a boast. It's a warning."
    > "What happened out there?" -> fog
    > "Why do you stay here?" -> stay
  node stay rook "The sea's done with me. The bar isn't. That's not the same as safe."
    -> bye
  node fog rook "The fog takes ships. That's public knowledge. The rest is in my log."
    > "Where's your log?" -> book
    > "Tell me the rest." -> rest
    > "I'll find my own answers." -> bye
  node rest rook "Not sober. I've been sober once since the Kestrel. It didn't last the night."
    -> bye
  node book rook "Up at the light. The keeper keeps the old logs. Mine's in the store with my name on it."
    note rook_log "Rook's old log is in the keeper's store at the lighthouse. The last page is a list of names."
    > "I'll fetch it." -> promise
    > "Why should I trust a drunk?" -> trust
  node promise rook "Then go. I'll be here. I'm always here."
    -> bye
  node trust rook "You shouldn't. But the log doesn't lie, and I can't say the same for myself."
    -> bye
  node log rook "You found it. Then you read the part about the bell."
    -> log2
  node log2 rook "It rang with no hand on the rope. The crew went to the rail to look. I didn't."
    -> rule
  node rule rook "The thing in the fog hunts by sound. Keep quiet, and it loses you for a while."
    set rule_sound
    note rule_bell "Rook: the Grey Lantern hunts by sound. Silence the bell and it loses you for a while."
    -> chart
  node chart rook "There's a chart folded in the back. Your father's hand. He drew the fog's edge before he went in."
    give chart
    set rook_story
    note rook_chart "Rook gave me my father's chart of the fog's edge. It was folded in the back of his old log."
    -> story
  node story rook "He gave it to me the night before he sailed. I told him not to go. He laughed."
    > "Thank you, Rook." -> thanks
    > "What else do you remember?" -> more
    > "Why didn't you go with him?" -> why_not
  node more rook "The crew. My crew. They're still out there. I hear the bell some nights."
    -> thanks
  node why_not rook "I was afraid. I'm still afraid. It's the only thing I've kept up."
    -> thanks
  node thanks rook "Go on. Be a better navigator than me. The bar is low and I'm under it."
    -> bye
  node after rook "Keep the bell quiet. Keep your head down. That's all I know."
    -> bye
  node bye rook "Go on. And come back. I'd like to be wrong about something."
`,al=`dialogue tam
  node root tam "You're Elias Fenn's boy. Everyone on the wall says you're going into the fog."
    > "How does everyone know?" -> know
    > "What are you doing up here?" -> count
    > "Have you seen anything strange?" -> strange
    > "Maybe. Goodnight." -> bye
  node know tam "I count the ships from the corner. People talk in front of me. I'm short."
    -> count
  node count tam "Nine or ten a week, before. Now it's three, and two of those are the Marrow."
    > "Which boat is the Marrow?" -> which
    > "That's a good tally." -> bye
  node which tam "Uncle Hobb mends boats at the shipwright's. He's got Dad on his arm, in ink."
    > "Where's your dad?" -> strange
    > "Goodnight, Tam." -> bye
  node strange tam "The Arcadia came round the headland faster than anything. I timed her. Then she stopped."
    > "She was my father's ship." -> captain
    > "I'm sorry." -> dad
    > "Ships stop." -> stop
  node captain tam "You're the captain's? Then you're not a stranger. You're on the tally."
    -> dad
  node stop tam "She was never late. Not once."
    -> dad
  node dad tam "Dad went with her. Tam Hobb, able seaman. I'm Tam too. Mum only has to shout once."
    -> dad2
  node dad2 tam "Mum says not to talk about it. So I tell strangers."
    > "I'll look for them. All of them." -> promise
    > "Goodnight, Tam." -> bye
  node promise tam "If you find Dad, tell him the tally's still running. Tell him I kept counting."
    -> bye
  node bye tam "Goodnight. That's you counted."
`,ol=`dialogue vex
  node root vex "That compass. I know it. Elias Fenn's, unless I'm wrong."
    set met_vex
    > "I need the Marrow." -> need
    > "They say you're the only one sailing." -> only
    > "Nothing. Goodnight." -> END

  node need vex "The Marrow doesn't sail. She's had enough of the fog."
    -> terms

  node only vex "Sailing is a strong word. I sit in the harbour and charge for it."
    -> terms

  node terms vex "Pike's wreckers took my spare rudder. Bring it back and we'll talk."
    > "Where would Pike keep it?" -> where
    > "I'll get it." -> END
    > "Find another rudder." -> another

  node another vex "There isn't another. Pike has the only one that fits."
    -> END

  node where vex "His shed in Wreckers' Lane. Take someone who can run."
    -> END

  node no_rudder vex "Still no rudder. Still no voyage."
    > "Where would Pike keep it?" -> where
    > "I'm working on it." -> END

  node rudder vex "That is my rudder. You're either very good or very lucky."
    set met_vex
    > "Now talk." -> deal
    > "The rudder for a passage." -> deal
    > "Keep it. I'll find another captain." -> bluff

  node bluff vex "There isn't another captain. That's the joke."
    -> deal

  node deal vex "My ship. My rules. Half the salvage. I captain."
    > "Agreed." -> sail
    > "My father first." -> father
    > "Half is robbery." -> half

  node father vex "Your father is a reason, not a cargo. I'll take you to the fog."
    -> sail

  node half vex "It is robbery. You're welcome to walk."
    > "Agreed." -> sail
    > "I'll walk." -> END

  node sail vex "Then it's a voyage. Bring a cook and a carpenter."
    set vex_deal
    set quill_compass
    note vex_terms "Vex will sail: his ship, his rules, half the salvage. He returned Quill's compass."
    -> compass

  node compass vex "Take Quill's compass. Tell her the debt is paid."
    -> END

  node deal_done vex "We sail at the tide. Try not to be late."
    > "About the fog." -> fog
    > "About my father." -> my_father
    > "What's in the safe?" -> salvage
    > "Nothing." -> END

  node fog vex "The fog takes ships. I take passengers. We understand each other."
    -> END

  node my_father vex "Elias Fenn sailed in with a good crew. I'm not him."
    -> END

  node salvage vex "Tide tables, mostly. And a few things the sea owed me."
    > "Those charts have ship names on them." -> charts
    > "Never mind." -> END

  node charts vex "Salvage. The sea gives, and I keep. That's the trade."
    -> END

  # Act II — the helm. Vex sends Fenn to the bow; later the crew brings the hold
  # back to him, and he answers it by sailing deeper.
  node helm vex "You're on my quarterdeck, cartographer. Say your piece."
    > "What are we doing out here?" -> edge
    > "Why the bow?" -> bow
    > "Nothing." -> END

  node edge vex "The edge of the Shroud. Close enough to see it, far enough to leave."
    -> send

  node bow vex "Because the fog has a voice, and I want to hear it before it hears us."
    -> send

  node send vex "Take the bow. Call the water. If it calls back, don't answer."
    > "Call the water?" -> call
    > "You're serious." -> serious
    > "I'm going." -> END

  node call vex "Old trick. A voice at the bow tells the fog we're only weather."
    > "And if it doesn't believe us?" -> believe
    > "I'll call it." -> END

  node believe vex "Then we run. Quietly. That's the whole plan."
    -> END

  node serious vex "I am always serious. It's the coat that makes people doubt me."
    -> END

  node helm_done vex "The bow. I meant what I said about calling the water."
    > "What if it answers?" -> answer
    > "I'm going." -> END

  node answer vex "Then we learn something. Try not to."
    -> END

  node after_fog vex "You're back. Good. I was starting to think the fog had taste."
    > "The bell rang on its own." -> bell
    > "It's still out there." -> out

  node bell vex "Bells do that, on ships. In stories."
    -> END

  node out vex "Then we keep the light low and our mouths shut."
    -> END

  node confront vex "You've seen the hold."
    > "Those crates have ships' names on them." -> names
    > "How long have you been stripping wrecks?" -> howlong
    > "The crew saw. They know what you are." -> crew

  node names vex "Names are all that is left of them. I keep the names dry."
    -> admit

  node howlong vex "Since before your father sailed. The fog is a good supplier."
    -> admit

  node crew vex "Then they can hate me on the way back. It is how I am paid."
    -> admit

  node admit vex "The sea takes. I keep what it drops. The Arcadia's barrels came in on the tide a week after she sailed."
    -> admit2

  node admit2 vex "I fished them out before anyone else could. I don't apologise for weather."
    > "My father was on one of those ships." -> about_father
    > "You're a thief." -> thief
    > "Take us home." -> home

  node about_father vex "I know. I didn't put him there."
    -> decision

  node thief vex "A thief with a ship. The only kind that sails."
    -> decision

  node home vex "Home is the one heading I can't sell."
    -> decision

  node decision vex "No. We go deeper. I'll prove it's only weather."
    set vex_exposed
    > "You'll get us killed." -> refuse
    > "Then we all go." -> together

  node refuse vex "Maybe. Not today. Hold the rail."
    -> END

  node together vex "That's the spirit. Everyone aboard, then."
    -> END

  node last vex "I'm taking her deeper. You can watch, or you can swim."
    > "The light. It hunts light, doesn't it?" if rule_light -> last_light
    > "You'll get us killed." -> last_kill
    > "Then I'm with you." -> last_go

  node last_light vex "Then we go dark. Hold on to something."
    -> gone

  node last_kill vex "Probably. Find a rail."
    -> gone

  node last_go vex "Good. Keep your feet under you."
    -> gone

  node gone narrator "Vex puts both hands on the wheel and turns her past the last pencil mark."
    music music_fog
    -> sun

  node sun narrator "The sun goes first. Then the colour. Then the rails."
    -> deeper_fog

  node deeper_fog narrator "The fog comes up the hull like water up a stair."
    -> bell_rings

  node bell_rings narrator "Somewhere ahead, a bell rings. There is no hand on the rope."
    sound chime
    -> dark

  node dark narrator "The lanterns gutter. The dark comes down and stays."
    -> under

  node under narrator "Something vast passes under the keel. The deck lifts, and keeps lifting."
    -> green

  node green narrator "A green light opens in the fog. A ship rises out of it, older than the island."
    -> lantern_name

  node lantern_name narrator "Her name is on the stern, grey under the salt. The Grey Lantern."
    -> voice

  node voice narrator "I don't see her captain. I hear him. He welcomes the Marrow aboard."
    -> taken

  node taken narrator "The deck goes out from under me. Cold, a rope, Hobb shouting my name."
    -> boat

  node boat narrator "Then the longboat. Then the wreck behind us, and the fog closing its door."
    set marrow_lost
    act 2

  # Act III — the Shroud. Stranded on the flats, the wreck, the reef gate and the
  # boarding. The admission is \`saw_elias\`, not \`admit\`: \`admit\` is already the Act II
  # salvage beat and its node id has to stay.
  node shore vex "Stranded on a fog flat with a crew that would happily leave me here. I've had worse nights."
    > "What do we do now?" -> shore_what
    > "The crew wants answers." -> shore_crew
    > "What did you see out there?" -> shore_saw
    > "Nothing." -> END

  node shore_what vex "We walk. The camp is up the flats, and your father's chart is the only map worth having."
    > "You're coming with us." -> shore_coming
    > "Don't fall behind." -> END

  node shore_coming vex "Somebody has to carry the oars. You'd only drop them."
    -> END

  node shore_crew vex "They can want. Wanting is free. Rowing is not."
    > "They think you left him." -> shore_saw
    > "Give them something." -> shore_give
    > "Nothing." -> END

  node shore_give vex "I have a boat, a coat, and a good story. Two of those are useful."
    -> END

  node shore_saw vex "You want the rest. The part I didn't say on the sand."
    > "Tell me." if not seen:vex.saw_elias -> saw_elias
    > "Tell me again." if seen:vex.saw_elias -> saw_again
    > "Not now." -> END

  node saw_elias vex "The part I left out. He had a lantern, and he swung it up and down off the reef. I told myself it was a buoy. It wasn't."
    > "You left him there." -> saw_left
    > "Why?" -> saw_why
    > "You're telling me now." -> saw_now

  node saw_left vex "Yes. I left him. I'm not going to make it sound better than that."
    -> saw_fear

  node saw_why vex "The fog was between us. I was on the wrong side of it, and I stayed there."
    -> saw_why2

  node saw_why2 fenn "A buoy. Thick fog. The wrong side of it. That's the third reason you've given me."
    -> saw_why3

  node saw_why3 vex "Then here is the fourth, and the true one. I was afraid."
    -> saw_fear

  node saw_now vex "Because you'd have found out. You're the sort who finds out."
    -> saw_fear

  node saw_fear vex "I've been afraid since the first ship I lost. Fear is the only crew that stays."
    > "Then be useful." -> saw_useful
    > "You're a coward." -> saw_coward
    > "I've heard enough." -> END

  node saw_useful vex "I know the reef water. I know how she hunts. That's worth a boat and an oar."
    -> saw_deal

  node saw_coward vex "A live coward. The best kind, and the only kind that gets old."
    -> saw_deal

  node saw_deal vex "I'm not on your side. I'm on the boat's side. The boat's on mine."
    > "That will have to do." -> END
    > "Don't make me regret it." -> saw_regret

  node saw_regret vex "I make everyone regret something. You'll fit right in."
    -> END

  node saw_again vex "I have said it. The lantern still goes up and down in my head."
    -> END

  # The wreck: the Arcadia, the nameplate, and Vex's eye for what the sea gives back.
  node wreck vex "I know this water. I've been picking at it for years, and it never picks back."
    > "Whose ship was she?" -> wreck_ship
    > "What do you know about the nameplate?" -> wreck_plate
    > "Did you see my father here?" -> shore_saw
    > "Nothing." -> END

  node wreck_ship vex "A ship the fog took. There are enough of them out here to make a reef."
    > "Did you take anything off her?" -> wreck_took
    > "Leave her alone." -> END

  node wreck_took vex "Cargo. Names. Nothing that answered me. That is the whole trade."
    -> END

  node wreck_plate vex "A name, cut into brass. The sea keeps the rest of the ship, but not that."
    > "Whose name?" if not rule_name -> wreck_plate_unknown
    > "I've read it." if rule_name -> wreck_plate_known
    > "Never mind." -> END

  node wreck_plate_unknown vex "I don't know. Reading it costs more light than I like to spend."
    -> END

  node wreck_plate_known vex "Then keep it behind your teeth until we're aboard. Names carry."
    -> END

  # The gate refuses until all three holds: Elias, the name and Hobb's bell plan.
  node gate vex "The gate stays shut until I like the plan. I don't like it yet."
    > "What is missing?" -> gate_what
    > "Elias is with us." if elias_found -> gate_elias
    > "We have the third rule." if rule_name -> gate_rule
    > "Hobb has a plan for the bell." if bell_plan -> gate_bell
    > "Then stay here." -> END

  node gate_what vex "Count them off. I'll tell you which one I don't believe."
    > "Elias and the rules." if not elias_found -> missing_elias
    > "The name." if not rule_name -> missing_name
    > "Hobb's plan for the bell." if not bell_plan -> missing_bell
    > "All three are done." if elias_found and bell_plan and rule_name -> gate_all
    > "Later." -> END

  node missing_elias vex "Your father has the rules. Until he says them, we are guessing at the fog."
    -> END

  node missing_name vex "The name is the whole trick. Without it, we are just noise in the fog."
    -> END

  node missing_bell vex "Hobb's plan. I want to hear how he means to take a bell off a dead ship."
    -> END

  node gate_all vex "Then we are ready. I hate being ready. It means something is about to happen."
    -> END

  node gate_elias vex "Your father is alive. Good. Dead men don't draw maps."
    -> END

  node gate_rule vex "The name. Say it and she cannot take us."
    -> END

  node gate_bell vex "Hobb's plan. If it involves climbing, I'm holding the rope from down here."
    -> END

  # The boarding. Vex rows; he is useful, and he is not sorry.
  node board vex "I row you out. After that, I'm a passenger with a good coat."
    > "Why are you coming?" -> board_why
    > "What do I do when we're aboard?" -> board_what
    > "What about the others?" -> board_crew
    > "Let's go." -> board_go

  node board_why vex "If you die out there, they'll say I let you. I'd rather be a witness."
    > "That's not a reason." -> board_reason
    > "It'll do." -> board_go

  node board_reason vex "It's the only reason I have that isn't fear. Take it."
    -> board_go

  node board_what vex "Stay where I can see you. Bell first, then the light, then the name."
    > "And you?" -> board_you
    > "Right." -> board_go

  node board_you vex "I'll be at the oars. Somebody has to be ready to leave."
    -> board_go

  node board_crew vex "They follow you. I follow the boat. It works out the same."
    -> board_go

  # The same boarding the open gate gives (key_gate.adv): all three holds are already in hand,
  # because Vex only offers this beat once Elias, the name and Hobb's plan are done.
  node board_go vex "Get in. Try not to rock her."
    -> board_away

  node board_away narrator "I step into the boat. The gate stands open behind me, and nobody looks back. Vex pulls, and the Grey Lantern comes out of the fog to meet us."
    set lantern_boarded
    act 3
`,sl=`# The Father and the Fog — the small inventory. Ids are fixed; the icon is item_<id>.
# Each look is one line: what it is, and (where it helps) what it is for.

item compass "Elias's compass"
  look "My father's compass. Brass, scratched, and it points at the fog instead of north."
  # Act I states mirror the tip ladder: the needle points at the next step. Quill counts only
  # once she has joined, not merely once her compass is in hand.
  state if act 1 and vex_deal and dorrit_cleared and quill_compass and seen:quill.join and rook_story and hobb_joined
    look "The needle points at the harbour mouth. Everyone else is ready."
  state if act 1 and vex_deal and dorrit_cleared and quill_compass and rook_story and not hobb_joined
    look "The needle points at the shipwright's. A ship without a carpenter stays in port."
  state if act 1 and vex_deal and dorrit_cleared and quill_compass and not rook_story and weather_works_store
    look "The needle points at the Salty Keel. Rook's log is in my coat, and Rook is still there."
  state if act 1 and vex_deal and dorrit_cleared and quill_compass and not rook_story
    look "The needle points up at the lighthouse. Rook's log is up there."
  state if act 1 and vex_deal and dorrit_cleared and quill_compass and not seen:quill.join
    look "The needle points at the shipwright's. Quill still has to take her compass."
  state if act 1 and rudder_back and not dorrit_cleared
    look "The needle points at the Salty Keel. Dorrit is still waiting for the good news."
  state if act 1 and rudder_back and dorrit_cleared and not vex_deal
    look "The needle points at Vex's warehouse. It trusts him about as far as I do."
  state if act 1 and met_vex and not rudder_back and seen:dorrit.confess
    look "The needle points at Pike's shed. The man behind the crates has already talked."
  state if act 1 and met_vex and not rudder_back
    look "The needle swings toward Wreckers' Lane, and the boat shed behind it."
  # Act II: the needle mirrors the ladder again, and in the fog it stops pretending.
  state if act 2 and marrow_lost
    look "The needle swings once and points down at the water. It has never done that before."
  state if act 2 and vex_exposed
    look "The needle points at Vex, then at the fog. It cannot decide which is worse."
  state if act 2 and salvage_seen
    look "The needle points at the quarterdeck, where Vex is pretending the hold is empty."
  state if act 2 and room bow_fog
    look "The needle points over the bow and will not come back. Ahead is not north."
  state if act 2 and fog_tried
    look "The needle points at the deck hatch. It would rather go below than look at the water."
  state if act 2 and room marrow_quarterdeck
    look "The needle points at Vex. It has stopped trusting the weather."
  state if act 2
    look "The needle points at the quarterdeck, where Vex is steering us to the edge of the Shroud."
  # Act IV: one last road, and it runs from the deck to the captain's cabin. The three holds
  # take their order from the deck (bell, light, name), whatever order the player tries.
  state if act 4 and not bell_cut
    look "The needle points at the bell. It rings when the ship rolls, and no one is pulling it."
  state if act 4 and not lantern_doused
    look "The needle points up into the rigging. The great lantern is still burning."
  state if act 4 and not name_spoken
    look "The needle points down through the deck, at the desk in the captain's cabin. The name is the last thing to set down."
  state if act 4
    look "The needle points down at the captain's cabin. Mordant is standing there, and the needle has stopped running."

item spyglass "Quill's spyglass"
  look "Quill's spyglass. She says she doesn't need it. She cleans it every morning."
  # Act II: the glass is for looking at the fog, which is the problem.
  state if act 2 and marrow_lost
    look "Quill's spyglass. It is wet, and the fog through it is empty. That is worse than a shape."
  state if act 2 and fog_tried and room bow_fog
    look "Quill's spyglass. Through it, the fog has a shape, and the shape is keeping pace."
  state if act 2 and salvage_seen
    look "Quill's spyglass. The names on the crates below are still in my head. The glass can't help with those."
  state if act 2 and fog_tried
    look "Quill's spyglass. The fog does not get closer through it. It gets further away."
  state if act 2
    look "Quill's spyglass. She lent it to me for the bow. She did not say what to look for."

item crowbar "Hobb's crowbar"
  look "Hobb's crowbar. It has opened more ships than it has closed."
  # Act II: the same iron, and a hold full of other people's ships.
  state if act 2 and salvage_seen
    look "Hobb's crowbar. The crates below were nailed shut. Every lid had a ship's name on it."
  state if act 2 and fog_tried
    look "Hobb's crowbar. It is the only thing aboard that Vex did not take off a wreck."
  state if act 2
    look "Hobb's crowbar. Hobb says a ship is only a door that learned to float."
  # Act IV: the bell is iron, and iron answers to the crowbar.
  state if act 4 and bell_cut
    look "Hobb's crowbar. The bell is cut and quiet. The iron has done its work."
  state if act 4
    look "Hobb's crowbar. The bell is iron, and iron answers to this."

item chart "Elias's chart"
  look "My father's chart of the Shroud. Half of it is guesswork in his hand."
  # Act III: the blank half is where the crew is standing, and Elias is filling it in.
  state if act 3 and rule_name
    look "My father's chart, the Lantern's route drawn across it in his hand. It ends at the reef gate."
  state if act 3 and elias_found
    look "My father's chart. The blank half is filling in, one pencil line at a time."
  state if act 3
    look "My father's chart of the Shroud. Out here, the blank half is the water under my feet."
  state if rook_story
    look "My father's chart of the Shroud, with the fog's edge drawn in Rook's hand."

item nameplate "Mordant's nameplate"
  look "A brass plate from the Grey Lantern's bow, green with salt: GREY LANTERN — M. MORDANT, MASTER."
  # Act III: the plate comes off a grey bow timber jammed in the wreck, before anyone knows what the name is for.
  state if act 3 and rule_name
    name "Mordant's nameplate"
    look "The name on the plate is the one Elias says the Lantern cannot take. MORDANT."
  state if act 3
    name "the nameplate"
    look "A brass plate from the Grey Lantern's bow, lodged in the wreck. GREY LANTERN — M. MORDANT, MASTER. I cannot place the captain."
  # Act IV: the name on the plate is the whole of the last hold.
  state if act 4 and name_spoken
    look "The name on the plate has been said aloud. It is only brass again."
  state if act 4
    look "The brass plate from the Grey Lantern. MORDANT. The name is the last thing we need."

item lantern "oiled canvas"
  look "A wad of oiled canvas, soaked through. Enough to smother a flame."
`,il=`room alley "Wreckers' Lane"
  bg bg_alley_restart_wide
  width 2560
  backdrop "contrast(0.9) brightness(1.22) saturate(1.04) lift(0.012)"
  music music_dock
  grade "brightness(0.98) saturate(0.9)"
  # The harbour restart: a full-bleed painting of the lane between the warehouses, strict
  # side-on. Every way out is painted in light, not lettering: the lane mouth and its ship at
  # the far left, the boat shed's open doors burning with cold fog light, the counting house's
  # broad green sliding door under a green lamp with its green pool on the cobbles, and the
  # shipwright's lit door and rope window at the right. No signs anywhere. Wet cobbles run the
  # whole lower third; nothing painted stands in the walking band below the crate bases.
  perspective horizon 380 ref 875 height 330
  walk (0,872) (30,844) (140,830) (400,822) (800,818) (1200,816) (1600,816) (2000,818) (2300,822) (2480,830) (2540,844) (2540,872)
  entry 300,850
  arrive dock 300,850
  arrive chandlery 2300,844
  arrive warehouse 1050,844
  arrive counting_house 1430,844
  footsteps stone
  # Painted lights only: the corner lantern at the lane mouth, the string of lamps overhead,
  # the counting house's green glass lamp, the small sconce beside it, and the chandlery's
  # warm window and door lantern. Each point sits on its painted flame or glass.
  light 90,260 radius 150 lantern
  light 430,120 radius 70 lantern
  light 780,110 radius 80 lantern
  light 1250,40 radius 80 lantern
  light 1415,120 radius 170 lantern colour "#79e6a4"
  light 1620,145 radius 90 lantern
  light 1900,420 radius 300 lantern
  light 2280,115 radius 110 lantern
  light 2470,300 radius 140 lantern

  # Act I: the wreckers work the bottom of the lane. Pike keeps the paperwork.
  scene if act 1 and not alley_seen
    set alley_seen
    say "Wreckers' Lane. Every door is shut except one, and the lamps are still lit."
    say "A young man in a grey coat is writing on a clipboard under them."

  # You come in from the docks at the left end, and the boat shed's open door is a full screen
  # up the lane. Say where it is, once.
  scene if not alley_way_out_seen
    set alley_way_out_seen
    say "Up the lane, past Vex's green lamp and the shipwright's lit window, the boat shed's latch is up and its door stands open on the fog."

  # Pike stands under the chandlery's hanging lantern, between the lit shop and its door, a
  # little deeper into the lane than Fenn's walking line. He faces the lane mouth.
  sprite npc_pike_body at 2180,832 size 1 flip idle speaker pike for pike grade "saturate(0.82) brightness(0.85)"

  hotspot pike "Pike"
    area 2110,450 170x360
    stand 2080,840
    look "Pike. Grey coat, yellow armband, and a clipboard he holds like a shield."
    talk "He lowers the clipboard a little."
      talk pike
    give "He writes something down instead of taking it."
    state if rudder_back
      name "Pike"
      look "Pike. The clipboard is under his arm now. He looks like a man who has just been audited."
      talk: talk pike at after

  # The crate stack against the boat-shed wall: ships' stores with the marks scraped off.
  hotspot shed "the wreckers' shed"
    area 580,420 220x290
    stand 600,844
    look "A lean-to against the shed wall, packed with crates of ships' stores."
      say "Somebody has scraped the shipping marks off."
      set saw_stores
    open "The lean-to is tied shut with a length of chain. The chain is loose enough to be a suggestion."
    push "The chain rattles, and Pike's pencil stops moving."
    state if rudder_back
      name "the picked-over shed"
      look "The lean-to is tidier than it was. The chain is down, and the best crates have gone."

  # The tall black boat-shed doors, one leaf open on a blade of cold fog light. The opening
  # catches the eye from the lane mouth, and the stand is on the cobbles in front of it.
  hotspot boat_shed "the boat shed door"
    area 880,220 230x400
    stand 1050,844
    exit warehouse
    look "The boat shed. The latch is up, and the door is open on the fog. Somebody is inside."
    open "I push the door. It gives quietly, as if it has been opened carefully before."
    state if dorrit_cleared
      look "The boat shed. The door is shut now, and the latch is down."
      open "The shed is quiet. Dorrit has packed his spoons."

  # The broad green sliding door under the green glass lamp: Vex's counting house, green light
  # spilling across the cobbles at the widest point of the lane.
  hotspot counting_door "the counting house window"
    area 1450,220 380x420
    stand 1600,844
    exit counting_house
    look "A tall green-painted window with a lamp above it. The paint is newer than the rest of the lane. Vex's counting house."
    open "The sill is low enough. I get a knee on it and climb into Vex's counting house."

  # The shipwright's lit door at the right edge, with the broad rope-and-oar window beside it.
  hotspot chandlery_door "the shipwright's door"
    area 2350,180 210x370
    stand 2290,844
    exit chandlery
    look "The shipwright's door, and a broad lit window full of rope and oars. Open late, because ships are always leaving."
    open "I push the door. A bell somewhere in the shop regrets it."

  # The lane turns out of frame at the left, past the jettied corner: the painted cobbles are
  # the way back down to the quay, not the water itself.
  hotspot to_dock "the lane back down to the docks"
    area 0,540 230x320
    stand 300,850
    exit dock sound none
    look "The lane runs back down to the waterfront."
`,rl=`room arcadia_cabin "The Grey Lantern — Captain's Cabin"
  # A side-on close-up of the stern cabin under the great lantern: the bunk and books at the
  # left, the open companionway climbing through the broken deck, the desk with its empty brass
  # oval at the right, the stern windows and the green lantern. The lower third is clear floor.
  bg bg_arcadia_cabin_restart_b_wide
  width 2560
  backdrop "brightness(0.82) saturate(0.78) contrast(1.04) hue-rotate(-6deg) lift(0.012)"
  music music_fog
  grade "saturate(0.86) brightness(0.97)"
  perspective horizon 500 ref 875 height 500
  walk (40,875) (60,845) (2150,845) (2180,875)
  entry 1500,858
  # Coming down the companionway you land on the boards beside its foot.
  arrive lantern_deck 1000,858
  footsteps wood
  motes dust (650,0) (1260,0) (1520,860) (620,860) count 60
  emit drip at 700,860
  emit creak

  # Act IV. Mordant's cabin, still dry after eighty years. The desk is where the name is read,
  # and the cold at the end of the cabin is where the man who kept it is waiting.
  # The companionway's cold daylight is the way up; the green lantern burns at the stern.
  light 1000,250 radius 180 lantern colour "#cfe6ff"
  light 1000,720 radius 130 lantern colour "#bfe0ff"
  light 2060,180 radius 90 lantern colour "#4fd98c"
  light 2060,180 radius 240 lantern colour "#4fd98c" if name_spoken
  light 2060,180 radius 90 lantern colour "#c8ffe0" if name_spoken

  scene if not arcadia_cabin_entered
    set arcadia_cabin_entered
    say "The cabin is dry, which is the first wrong thing. The inkpot is dry too, and the last line in the log is still wet."
    say "Elias is at the desk with his chart rolled tight in one hand."
    say "\\"This is where a captain answers to his name,\\" he says. \\"Put it on the desk.\\""
    say "He holds out his hand for the plate, then lets it fall to his side. \\"You read it. I'll say it.\\""

  sprite npc_ansel_body at 1800,852 size 1 idle speaker elias for elias grade "saturate(0.88) brightness(0.95)"
  # Setting the plate down works exactly as the desk's own Use does: the name is read, Elias
  # says it, and Mordant answers.
  use nameplate on nameplate if not name_spoken
    "I set the plate down. The brass catches the light from the broken planks."
    say "GREY LANTERN — M. MORDANT, MASTER."
    say "\\"Mordant,\\" Elias says. He says it like a bell, once."
    say "\\"I've said everyone else's name,\\" he says. \\"I never had his.\\""
    take nameplate
    set name_spoken
    talk mordant
  use nameplate on nameplate
    "The plate lies where I set it. The name has been said, and the cabin is colder."
  use crowbar on nameplate
    "The plate is brass, not a crate. The desk would not thank me."
  use lantern on nameplate
    "The canvas is soaked, and the last line in the log is still wet. I keep them apart."
  # The plate is normally handed over in Act III. A migrated save without it gets a spare
  # from the cabin's own desk rather than an unwinnable room.
  scene if act 4 and not has nameplate and not name_spoken
    say "A spare brass plate lies in the desk's dust, green at the edges and blank."
    say "It is not the one from the wreck. It will do."
    give nameplate

  # The ghost captain, in the dark corner, once Elias has spoken his name.
  sprite npc_mordant_body at 250,850 size 1 idle speaker mordant for mordant if name_spoken

  # The desk. The plate comes from the Grey Lantern's bow, lodged in the wreck, and is set
  # down in the clean oval in the dust; the painted oval is empty until it is put there.
  hotspot nameplate "the nameplate"
    area 1200,520 580x280
    stand 1450,858
    look "Mordant's desk. A log with a wet last line, a dry inkpot, and a clean oval in the dust where a plate should sit."
    use "I set the plate down. The brass catches the light from the broken planks."
      say "GREY LANTERN — M. MORDANT, MASTER."
      say "\\"Mordant,\\" Elias says. He says it like a bell, once."
      say "\\"I've said everyone else's name,\\" he says. \\"I never had his.\\""
      take nameplate
      set name_spoken
      talk mordant
    state if name_spoken and bell_cut and lantern_doused and seen:mordant.ask
      name "the nameplate"
      look "The plate lies where I set it. The name has been said, and the cabin is colder."
      use "I put my hand on the plate. Something is waiting at the end of the cabin."
        talk mordant at again_ask
    state if name_spoken
      name "the nameplate"
      look "The plate lies where I set it. The name has been said, and the cabin is colder."
      use "I put my hand on the plate. Something is waiting at the end of the cabin."
        talk mordant at again
    state if not has nameplate
      look "Mordant's desk. A log, a dry inkpot, and a clean oval in the dust. The plate is not in my hands."
      use "There is nothing on the desk to read. The plate is not in my hands."
        nothing

  hotspot hammock "the bunk"
    area 0,480 650x320
    stand 550,858
    look "A built-in bunk, still made, the blanket folded as if the cabin were expecting its captain back."
    use "I put a hand on the blanket. It is dry, and cold enough to feel like it has just been left."

  hotspot pigeonholes "the books"
    area 220,260 470x230
    nowalk
    look "A shelf of books and bundles, salt-stained and swollen. Every loose sheet is blank. A captain's name is on the ones he signed."
    use "I pull one out. Blank. The next is blank. The ship stopped needing paper a long time ago."

  # Declared after the bunk and the books he stands in front of: the later hotspot wins the click.
  hotspot mordant "Mordant"
    show if name_spoken
    area 80,380 340x480
    stand 420,858
    look "A cold place at the end of the cabin. The green light comes from nowhere I can see."
    talk "I say his name again. The cold turns toward me."
      talk mordant
    state if bell_cut and lantern_doused and seen:mordant.ask
      name "Mordant, waiting"
      look "Mordant is there, in the cold. He is waiting for me to finish it."
      talk "He does not move. \\"When you are ready,\\" he says, \\"say it again.\\""
        talk mordant at again_ask
    state if bell_cut and lantern_doused
      name "Mordant, waiting"
      look "Mordant is there, in the cold. He is waiting for me to finish it."
      talk "He does not move. \\"When you are ready,\\" he says, \\"say it again.\\""
        talk mordant at again
    state if seen:mordant.who
      talk "I say his name again. The cold turns toward me."
        talk mordant at again

  hotspot portrait "the stern windows"
    area 1300,300 900x200
    nowalk
    look "Three stern windows, their curtains torn to rags, and past them the ship's own carved gallery and the fog."
    talk "I say nothing. The cabin does not need me to."

  # The painted companionway climbs the centre-left bulkhead through the open hatch in the
  # deckhead: the ladder's foot on the boards, the bright opening above it.
  hotspot ladder "the ladder to the deck"
    area (880,80) (1120,80) (1120,720) (1050,740) (880,720)
    stand 1000,858
    exit lantern_deck sound stairs
    look "A ladder up through the broken deck. The fog comes down the opening."
    open "I go up."

  hotspot elias "Elias Fenn"
    area 1720,480 230x360
    stand 1800,858
    look "My father, with salt in his beard and ink on his fingers. He is waiting for me to read it."
    talk "He says, \\"Go on. I'll say the name. You just have to read it.\\""
      say "\\"And then we finish it,\\" he says. \\"All of us.\\""
    state if name_spoken
      look "My father, standing very still. He has said the name. He looks lighter."
      talk "He says, \\"Whatever happens next, I'm here for it.\\""

`,hl=`# ACT II. The crew deck, with Vex's salvage stacked where the crew eats: barrels and a
# sea-chest from ships that never came home. Looking at the barrels (or Hobb, below) is what
# sets salvage_seen; nobody else in Act II sets it. The names are the island's own stories:
# the Arcadia took Fenn's father and Hobb's brother; the Cormorant is one of Marta's.
room below_decks "The Marrow — Crew Deck"
  bg bg_below_decks_restart_wide
  width 2560
  backdrop "brightness(1.1) contrast(0.97) lift(0.02)"
  music music_office
  grade "saturate(0.92) brightness(0.97)"
  perspective horizon 470 ref 875 height 560
  # The repainted deck is level: hammocks and the chest at the far left, the mess table and the
  # galley across the centre, and the open hatch at the far right, whose daylight is the way up.
  # The walk keeps to the clear plank band in front of the furniture, and stops short of the
  # salvage stacked against the right-hand corner.
  walk (40,875) (60,832) (2300,832) (2320,875)
  entry 1950,868
  arrive marrow_deck 1950,868
  footsteps deck
  light 870,300 radius 130 lantern
  light 950,415 radius 70 candle
  light 1605,700 radius 100 fire colour "#ff8a3c"
  light 2200,250 radius 170 lantern colour "#cfe6ff"
  motes dust (900,0) (1600,0) (1650,860) (950,860) count 50
  motes steam (1575,400) (1700,400) (1700,455) (1575,455) count 8
  emit creak at 2140,850
  occluder floor 800 (200,610) (600,610) (600,800) (200,800)
  occluder floor 815 (640,560) (1215,560) (1215,815) (640,815)
  occluder floor 800 (1480,520) (1775,520) (1775,800) (1480,800)

  # Hobb works the chest at the back of the deck (0.98), Dorrit stands over the stove in
  # the near row (1.0): two depths and two sizes, not a line.
  sprite npc_hobb_body at 520,840 size 1 idle speaker hobb for hobb grade "saturate(0.85) brightness(0.92)" if act 2
  sprite npc_dorrit_body at 1800,852 size 1 flip idle speaker dorrit for dorrit grade "saturate(0.85) brightness(0.95)" if act 2

  scene if act 2 and not below_arrived
    set below_arrived
    say "The crew deck smells of other ships. Tar, salt, and wood that has been in the water."
    say "The hold is full. What would not fit is stacked here, where the crew eats."
    say "Dorrit has stopped stirring. Down the deck, Hobb has his hand flat on a barrel head."

  # A migrated/hand-edited save can carry the one-way flag without the queued act ending.
  # Do not strand it on a ship with no way to finish the act.
  scene if act 2 and marrow_lost
    say "The Marrow is already going into the fog. There is nothing left to argue with."
    act 2

  hotspot salvage "the salvage"
    # The barrel and crate stacked against the right-hand corner, under the hatch light.
    area 2300,620 240x250
    nowalk
    look "Barrels in the corner, every head burnt with a name. CORMORANT. KESTREL. ARCADIA. All lost."
      set salvage_seen
      note salvage_hold "Vex's hold is full of salvage from the ships the fog took: the Cormorant, the Kestrel, the Arcadia."
      say "Hobb takes his hand off the Arcadia barrel. He puts it behind his back."
      say "Dorrit sets the ladle down. The stew goes on bubbling at nobody."
    state if salvage_seen
      look "The salvage. I keep reading the names, hoping one of them is a mistake."

  hotspot chest "the sea-chest"
    area 150,590 440x230
    stand 620,868
    look "A sea-chest with iron bands. CORMORANT burnt into the lid. The barrels in the corner carry more."
    open "The lid is warped with salt. Whatever was inside, Vex has had it out."
    state if salvage_seen
      look "The Cormorant's chest. Marta tells that story on the cold nights. She never says how it ends."

  hotspot hammocks "the hammocks"
    area 0,80 760x540
    nowalk
    look "Hammocks slung in rows, swaying with the ship. Nobody is asleep in any of them."
    use "I'd get in and never get out again."

  hotspot table "the mess table"
    area 650,500 570x310
    stand 1260,868
    look "The mess table, scrubbed pale, with benches for more of us than there are."
    use "I straighten a bench. It has been straightened."

  hotspot stove "the galley stove"
    area 1480,500 300x300
    stand 1740,868
    look "The galley stove, hot and complaining. Dorrit has been at it since the anchor came up."
    turnoff "Dorrit would have my fingers off. He has had a hard week."

  hotspot stew "the stew pot"
    area 1560,400 190x170
    stand 1660,868
    look "A stew pot the size of a font. It smells of salt beef and decisions."
    pickup "Dorrit's ladle arrives before my hand does."

  hotspot hobb "Hobb"
    show if act 2
    area 440,480 220x360
    stand 760,868
    look "Hobb, by the chest, reading the barrel head like it's a letter."
    talk "He doesn't turn round. He says, \\"Come and look at this.\\""
      talk hobb at hold
    state if seen:hobb.hold
      talk "He has not moved from the barrel."
        talk hobb at hold_after

  hotspot dorrit "Dorrit"
    show if act 2
    area 1710,480 190x370
    stand 1680,868
    look "Dorrit at the stove, stirring a pot he has stopped believing in."
    talk "He keeps stirring. \\"You've seen the barrels, then.\\""
      talk dorrit at galley
    state if not salvage_seen
      talk "He is watching the pot. He is not watching me."
        talk dorrit at galley

  hotspot ladder "the ladder up to the deck"
    # The whole ladder and the hatch above it: the brightest thing in the room.
    area (1830,90) (2460,90) (2460,620) (2260,690) (1830,690)
    stand 1980,868
    exit marrow_deck sound hatch
    look "The ladder up to the deck. Daylight, and the smell of open sea coming down it."
`,ll=`room bow_fog "The Marrow — Bow"
  bg bg_bow_fog_restart_b_wide
  width 2560
  backdrop "brightness(0.76) saturate(0.92) contrast(1.04) lift(0.01)"
  music music_fog
  grade "saturate(0.72) brightness(0.94)"
  ambience sea
  perspective horizon 500 ref 875 height 460
  # The bow lamp burns at the right, on its post; the wet deck runs back aft to the left, where
  # the ship's lamps thin into the fog. The way back is the lit line of planks at the left edge.
  walk (40,875) (60,700) (1900,700) (2000,875)
  entry 300,840
  arrive marrow_deck 300,840
  footsteps deck
  light 170,760 radius 170 fire
  light 1875,380 radius 170 lantern
  light 110,440 radius 60 lantern
  haze 120 760 floor 690 alpha 0.24 speed 9
  emit creak

  # Act II, the first try: the bell rings with no hand on the rope, the bow lantern dies, and
  # something vast passes under the hull. Silence and darkness are what save the ship. The bell
  # rope, the bow rail and the lantern are painted; the fog is the white between the rigging
  # and the rail. The thing under the water is heard and felt, never seen.
  scene if act 2 and not fog_tried
    set fog_tried
    set rule_light
    note rule_light "The Shroud hunts light as well as sound. It came when the bow lantern died."
    say "They call it calling the water. You stand at the bow and speak into the fog."
    say "Nobody has told me the words. I say my father's name, and then I wait."
    say "The fog takes it and gives nothing back. The deck is wet, and the ship is quiet."
    say "Then the bell rings."
    say "One note, then another. It is a bell, close above my head."
    say "I look up. The rope hangs still. There is no hand on it."
    say "The bow lantern gutters. The flame leans, as if something has breathed on it."
    say "The light goes out. The fog comes over the rail after it, slow and certain."
    say "The hull lifts under my feet. Not a wave. Something is passing beneath us."
    say "I hear it against the planks, a long scrape that does not hurry."
    say "From the helm, Vex's voice, very low: \\"No lights. Nobody speaks.\\""
    say "The lamps go out along the deck. I hear the crew go still, one at a time."
    say "We drift. The fog closes over the place where the water moved."
    say "When I can hear again, the bow is quiet. The lantern is out, and nothing follows us."

  hotspot fog "the fog"
    area (0,0) (1500,0) (1500,400) (1400,480) (1100,540) (600,560) (200,560) (0,560)
    stand 700,820
    look "The Shroud. It stands on the water like a wall and does not move."
      say "Past it the sea goes on to nowhere I have charted."
    talk "I say the Marrow's name into the fog, the way sailors do. Nothing answers."
    use "I could put my hand in it. I did that once, and it was colder than water."
    state if fog_tried
      look "The fog is quiet today. It was quiet that night too, right up until the bell."
        say "Past it the sea goes on to nowhere I have charted."

  hotspot bow_rail "the bow rail"
    area (300,540) (1450,580) (1600,660) (1200,720) (600,700) (300,680)
    stand 900,840
    look "The bow rail. The paint is worn pale where hands have held it."
    talk "I lean on the rail and tell it we are still here. It does not answer."
    use "I lean on it and look down. The water under us is white and says nothing."
    state if fog_tried
      look "The bow rail. Wet, cold, and still here. So am I."
      use "I look over the rail. The water is white and shallow-looking. I do not look for long."

  hotspot bow_lantern "the bow lantern"
    # The lamp itself and the lit post it stands on. The glass is cut by the top of the frame,
    # so the area carries down the post where it can be clicked without hunting the top bar.
    area (1800,280) (1950,280) (1950,650) (1880,680) (1800,650)
    stand 1850,845
    look "The bow lantern on its post, big enough to read a chart by. It burns all night."
    talk "I leave the lantern alone. It is a lamp. Lamps have enough to do."
    use "The wick is trimmed and the glass is clean. Somebody looks after it."
    state if rule_light
      look "The bow lantern is lit again, turned down low. Nobody stands close to the glass."
      use "I turn it down until the flame is a seed, then step back from it."

  hotspot bell_rope "the bell rope"
    area (1450,0) (1550,0) (1550,230) (1500,270) (1450,230)
    stand 1500,840
    look "The bell rope, hanging out of the fog above the lantern. The bell is up there too, out of sight."
    talk "I do not talk to the bell. I have heard it answer."
    use "I put a hand on the rope. It is cold, and it does not move."
    state if fog_tried
      look "The bell rope, slack and still. Nobody has rung it for the watch since that night."
      use "I take the rope and hold it. It stays quiet. I let it go."

  hotspot aft "back along the deck"
    # The painted bench and rail along the port side, and the deck at its foot.
    area (0,620) (180,620) (300,875) (0,875)
    stand 320,840
    exit marrow_deck sound none
    look "The deck runs back toward the mast and the helm. The fog sits between me and the rest of the ship."
    open "I go back aft along the deck, keeping to the middle of it."

  use spyglass on fog
    "I put the glass up. The fog has no distance in it. It is the same white at the end of the glass."
`,dl=`room chandlery "The Shipwright's"
  bg bg_chandlery_restart_wide
  width 2560
  backdrop "contrast(0.9) brightness(1.22) saturate(1.04)"
  music music_office
  grade "brightness(0.98) saturate(0.9)"
  # The shipwright's shop, full-bleed: the lane door open on cold blue fog at the left, the long
  # counter with its brass scale and lit ship's lantern, rope and oar shelves behind, and the
  # Marrow's bare mast leaning at the right. No sign, no lettering: the open door and the warm
  # counter lamp are the room's two lights, and the floor below them is the walking band.
  perspective horizon 200 ref 875 height 430
  scale 740 435
  scale 810 465
  scale 875 500
  walk (40,872) (70,844) (180,828) (420,818) (800,814) (1200,812) (1600,812) (2000,814) (2300,820) (2480,832) (2540,858) (2540,872)
  entry 180,852
  arrive alley 180,852
  footsteps wood
  # The painted door light, the small shelf lamp, the hanging lamp and the counter lantern. The
  # crowbar and the scale are lit by the counter lamp, not by their own light.
  light 250,320 radius 230 moon
  light 1130,320 radius 80 lantern
  light 1545,80 radius 110 lantern
  light 1700,470 radius 360 lantern

  # The crowbar leans against the counter front until it is picked up; then only the boards remain.
  sprite prop_crowbar at 1350,780 size 0.42 for crowbar
  # Quill at the right end of the counter and Hobb further back by the mast: different depths,
  # sizes and facings, so they do not read as a chorus line.
  sprite npc_quill_body at 1900,832 size 1 flip idle speaker quill for quill
  sprite npc_hobb_body at 2250,828 size 1 idle speaker hobb for hobb

  scene if act 1 and not chandlery_arrived
    set chandlery_arrived
    say "The shipwright's shop. Tar, sawdust, and a mast against the back wall."

  scene if act 1 and quill_compass and not seen:quill.join
    say "Quill is at the counter, holding out her empty hand."

  hotspot counter "the counter"
    area 930,520 1250x170
    stand 1300,838
    look "A long counter: a brass scale, a lantern, and a hundred small things ships need."
    open "The counter is a counter. The shipwright keeps his money in his boot."
    use "I could price a whole ship off this counter. I'd rather not."

  # The shelves are listed before the scale and the lantern: later hotspots win where they
  # overlap, and those two are painted in front of the shelves.
  hotspot shelves "the shelves"
    area 420,50 920x470
    nowalk
    look "Coils of rope, bolts of canvas, a dozen lanterns. Everything a ship needs to come back."
    use "Good rope. Good canvas. None of it does you much good in the fog."

  hotspot scale "the brass scale"
    area 1210,380 170x170
    stand 1290,838
    look "A brass scale, polished. The shipwright weighs everything twice and charges once."
    use "I put a finger on the pan. The scale thinks about it and says nothing."

  hotspot sailcloth "the sailcloth"
    area 2090,350 320x310
    nowalk
    look "Bolts of sailcloth, wrapped and roped. The shipwright charges by the yard."
    use "The canvas is good. It would make a fine sail for a ship with a mast."

  hotspot lantern "the ship's lantern"
    area 1660,340 110x280
    stand 1720,838
    look "A ship's lantern, lit. The glass is clean and the wick is new."
    use "I could carry it. The shipwright would notice before I reached the door."

  # The crowbar leaning against the counter, a pickup sprite rather than paint, so it leaves
  # with the item.
  hotspot crowbar "the crowbar"
    show if not has crowbar
    item crowbar
    area 1320,540 100x240
    stand 1360,838
    look "Hobb's crowbar, red with old rust, leaning against the counter. It has opened more ships than it has closed."
    pickup "I take the crowbar from against the counter. Nobody stops me."

  hotspot mast "the Marrow's mast"
    area 2130,20 260x570
    stand 2110,838
    verb use
    look "The Marrow's mast, standing against the back wall. The iron band at the counter is seized."
    use "The band at the counter won't move. It needs a lever."
    state if hobb_joined
      look "The mast, banded and sound. Hobb rests one hand on it."
      use "The band is sound now. Hobb would only make me do it again."
    state if has crowbar
      look "The iron band at the counter is seized. The crowbar will shift it."
      use "I need to put the crowbar to it."

  hotspot quill "Quill"
    area 1840,400 200x430
    stand 1780,838
    look "Quill: sharp, quick, and standing where she can see the door."
    talk "She looks me over the way she'd look over a chart."
      talk quill
    state if seen:quill.join
      talk "She is checking the rigging with her eyes."
        talk quill at after
    state if quill_compass
      talk "She is already holding out her hand."
        talk quill at got
    state if met_quill
      talk "She is watching the fog through the window."
        talk quill at again

  hotspot hobb "Hobb"
    area 2160,360 280x470
    stand 2110,838
    look "Hobb: a big man with folded arms and no interest in small talk."
    talk "He looks at me. He waits."
      talk hobb
    state if seen:hobb.joined
      talk "He is still looking at the mast."
        talk hobb at after
    state if hobb_joined
      talk "He is still looking at the mast."
        talk hobb at joined
    state if met_hobb
      talk "He does not look up from the band."
        talk hobb at again

  # The door at the left end, opening on cold blue fog and the quay: the only painted way out.
  hotspot door_out "the lane door"
    area 20,60 360x610
    stand 190,852
    exit alley
    look "The lane door. The shipwright keeps it open for the smell of the sea."

  use crowbar on mast if hobb_joined
    "The band is sound. Hobb would only make me do it again."
  use crowbar on mast
    "I get the bar under the iron band and lean. The band shifts with a crack."
    say "Hobb puts one hand flat on the mast. He does not say anything."
    set hobb_joined
    sound chime
`,cl=`room counting_house "Vex's Warehouse"
  bg bg_countinghouse_restart_wide
  width 2560
  backdrop "contrast(0.9) brightness(1.22) saturate(1.04)"
  music music_office
  grade "saturate(0.85) brightness(0.95)"
  # Vex's counting house as a full-bleed painting, strict side-on: the tall lane door open on
  # cold blue night at the left, the pigeonholed chart wall and the empty desks under three
  # green glass lamps, the shuttered window and the portrait high on the right wall, and the
  # black safe beside them. No lettering on the charts, papers or frames; the green lamps and
  # the open door are the room's two lights.
  perspective horizon 300 ref 875 height 360
  # Measured from the painted lane door (y 50-800, 750 px tall): an adult at its floor plane is
  # about 455 px, and the near floor row at 875 is 505 px.
  scale 720 400
  scale 800 455
  scale 875 505
  walk (60,872) (80,842) (200,828) (500,820) (900,816) (1300,814) (1700,814) (2000,816) (2180,820) (2260,830) (2300,852) (2300,872)
  entry 300,836
  arrive alley 300,836
  footsteps wood
  # The three painted green glass lamps, each on its bulb under the shade, plus the cold blue
  # light from the open door and the shuttered window beyond the safe.
  light 280,480 radius 280 moon
  light 1000,500 radius 160 lantern colour "#79e6a4"
  light 1400,530 radius 150 lantern colour "#79e6a4"
  light 1900,500 radius 160 lantern colour "#79e6a4"
  light 2100,260 radius 220 moon

  # Vex stands in the gap between the centre and right desks, a little behind the walking line,
  # facing the door.
  sprite npc_vex_body at 1600,814 size 1 idle speaker vex for vex

  scene if act 1 and not vex_warehouse_arrived
    set vex_warehouse_arrived
    say "Vex's warehouse. Desks, green lamps, and one very good safe."

  # The painted door: the whole leaf and its dark opening, threshold to lintel, with the cold
  # night pouring in.
  hotspot door_out "the lane door"
    area 30,40 460x760
    stand 300,836
    exit alley
    look "The lane door. Oiled hinges, and no lock. Vex likes to hear who comes in."

  hotspot portrait "the portrait"
    area 2270,0 290x350
    nowalk
    look "The last owner in oils: top hat, sword, and a chin the painter improved. Vex bought the warehouse with the portrait still hanging."
    talk "I ask why he keeps it. Vex says it is the only honest man in the room, and he likes to be reminded what honesty looks like."

  hotspot pigeonholes "the pigeonholes"
    # The lower grid only: the window and the portrait hang in front of the upper wall.
    area 520,20 1470x400
    nowalk
    look "Rolled charts in every hole, one for each ship that didn't come home."
    use "Vex calls this his library. The sea calls it salvage."

  # The row of desks, their brass scales and inkwells, and the chart stacks between.
  hotspot desks "the desks"
    area 740,560 1360x250
    stand 1200,820
    look "The tall desks, pens out, nobody at them. Vex does his own accounts and enjoys it."
    open "The drawers are locked. The keys are on a ring in Vex's pocket, alphabetised."
    use "I straighten a pen. It was already straight."

  hotspot safe "the strongbox"
    area 2230,440 330x440
    stand 2200,820
    look "A black safe with a brass dial. Vex says it holds tide tables."
    open "The dial is worn smooth on one side. Vex opens it with his thumb and a look."
    use "It is bolted through the floor. The floor seems nervous about it."

  # The tall shuttered window above the safe: the room's cold light, and no lettering on it.
  hotspot window "the shuttered window"
    area 1990,0 260x430
    nowalk
    look "The shutters are barred, and cold moonlight falls through the slats across the charts."
    use "The shutters are bolted from the inside. Vex does not like the view."

  hotspot vex "Captain Vex"
    area 1550,360 300x470
    stand 1500,820
    look "Captain Vex, in a coat worth more than the Marrow."
    talk "I take my hat off. He likes that."
      talk vex
    state if vex_deal
      look "Captain Vex, counting the tide. He is already spending the salvage."
      talk "He is in a better mood than usual, which is worse."
        talk vex at deal_done
    state if rudder_back
      talk "He has seen the rudder. He is deciding how grateful to look."
        talk vex at rudder
    state if met_vex
      talk "He does not look up from the desk."
        talk vex at no_rudder
`,ul=`# ACT II. Quill's post: the foretop, with the glass she will not be parted from. She sees the
# fog leaning before anyone else does, and hears something under it, which is as close as the
# ghost comes to the screen in this act. No new flags: the scene is knowledge, not a key.
room crows_nest "The Marrow — Crow's Nest"
  bg bg_crows_nest_restart_b_wide
  width 2560
  backdrop "brightness(0.58) saturate(0.62) contrast(1.06) hue-rotate(8deg) lift(0.012)"
  music music_fog
  ambience wind
  grade "sepia(0.08) saturate(1.02) brightness(0.98)"
  perspective horizon 390 ref 875 height 400
  # The platform is shallow in the painting; a gentler curve than the cone keeps Quill at the
  # rail a person and not a doll, while Fenn still grows as he comes forward.
  scale 875 400
  scale 760 350
  scale 640 310
  scale 520 280
  # The open hatch is a hole in the planks: two platform walks meet on a narrow strip of boards
  # in front of the opening, so Fenn can cross the nest without stepping into the drop.
  walk (40,875) (60,760) (600,760) (600,875)
  walk (1100,875) (1100,760) (2300,760) (2300,875)
  walk (600,858) (1100,858) (1100,875) (600,875)
  entry 580,780
  arrive marrow_deck 580,780
  footsteps deck
  light 675,700 radius 140 lantern
  light 900,760 radius 80 candle colour "#ffd39a"
  haze 200 520 floor 620 alpha 0.10 speed 6 tint "#cfd8dc"
  emit creak

  # Quill at the rail, a row back from where Fenn joins her.
  sprite npc_quill_body at 480,780 size 1 idle speaker quill for quill grade "saturate(0.85) brightness(0.92)" if act 2

  scene if act 2 and not nest_arrived
    set nest_arrived
    say "The crow's nest is a plank platform high on the foremast, with a rail Quill does not trust. She calls it an office."
    say "She comes down the shrouds when she hears me, and holds her hand out for the spyglass."

  hotspot shroud "the Shroud"
    area (300,100) (1500,100) (1500,450) (1200,500) (700,520) (300,500)
    nowalk
    stand 500,780
    look "The Shroud, low and white on the water. It has a shoreline, which is more than most weather has."
    state if seen:quill.nest
      look "The fog has a lean on it now. I can see it from here, and I wish I could not."

  hotspot sky "the sky"
    area 0,0 2560x120
    nowalk
    look "The sky, doing the one thing it does well out here: nothing at all."

  hotspot shrouds "the hatch down to the deck"
    # The open hatch and the rope ladder dropping through it into the lit deck below.
    area (620,640) (1100,640) (1100,870) (620,870)
    stand 580,780
    exit marrow_deck sound stairs
    look "The hatch down to the deck. The rope ladder drops into warm lamplight, a long way down."

  hotspot crates "the crates"
    area 80,390 330x320
    stand 420,820
    look "Crates lashed down in the corner of the nest with new line. Vex's cargo, going out with us."
    use "The rope is new. The knots are Vex's. He ties them like he is counting."

  hotspot rail "the rail"
    area (0,460) (1500,470) (1800,520) (1800,620) (900,620) (300,600) (0,580)
    stand 460,800
    look "The rail, cold and wet under my hand. Beyond it the sea is going about its business."
    use "I put my ear on the rail. The wood hums. That is the ship, probably."
    state if seen:quill.nest
      use "I put my ear on the rail. The hum is still there, under the wood. It is not the ship."

  hotspot quill "Quill"
    show if act 2
    area 380,470 210x330
    stand 560,780
    look "Quill, spyglass to her eye, watching the fog's edge the way I watch a page."
    talk "She takes it without a word and puts it to her eye."
      talk quill at nest
    state if seen:quill.nest
      talk "She is talking before I get to the rail."
        talk quill at nest_after
`,fl=`room dock "Dreadwater Harbour"
  bg bg_dock_cinema_wide
  width 2560
  backdrop "contrast(0.9) brightness(1.22) saturate(1.04)"
  music music_dock
  grade "brightness(0.95) saturate(0.85)"
  ambience gulls
  # The harbour's opening painting: the Marrow's dark bow and rigging at the left, the Salty
  # Keel's low warm frontage beyond her, the harbourmaster's jettied house with its lit door at
  # the centre, and the wet quay running on past the counting house's green lamp to the lit
  # steps and the lamps at the right. No signs: the way out is read by lamplight and wet path.
  perspective horizon 470 ref 875 height 330
  # One continuous painted path across the lower third: stone at the left, wet cobbles under
  # the house, cobbles and stone flags at the right. Every stand and arrival sits on it; the
  # crates and barrels stay against the walls, above it.
  walk (1120,878) (1120,845) (1130,805) (1150,770) (1180,740) (1220,716) (1270,700) (1330,688) (1400,678) (1500,672) (1600,672) (1700,680) (1800,690) (1900,702) (2000,716) (2100,732) (2200,752) (2300,774) (2400,802) (2470,878)
  entry 1330,800
  arrive tavern 1160,780
  arrive office 1340,780
  arrive alley 1620,780
  arrive village 2320,830
  arrive pier_end 1330,800
  arrive quay 2420,842
  footsteps stone
  # Painted lights, each on its flame or glass: the two lamps over the Salty Keel's door, the
  # harbourmaster's door and its wall lantern, the counting house's green lamp, and the two
  # tall quay lamps that pool the path at the right.
  light 878,520 radius 110 lantern
  light 1040,620 radius 120 lantern
  light 1315,560 radius 100 lantern
  light 1430,470 radius 70 lantern
  light 1870,440 radius 55 lantern colour "#79e6a4"
  light 2035,415 radius 120 lantern
  light 2445,300 radius 110 lantern
  # The harbour water under the Marrow's bow, kept clear of her hull and the jetty.
  water (0,650) (420,660) (600,680) (600,880) (0,880) ripple 1.8
  emit lapping at 300,800

  # Act I: the boat from the mainland puts Fenn ashore. The harbour is half empty;
  # the only ship with her gear aloft is the Marrow.
  scene if act 1 and not dock_landed
    set dock_landed
    say "The boatman's lantern dwindles across the water. I have the pier to myself, and the quiet."
    say "The few people on the quay find something else to look at. Nobody asks who I am. They know."
    say "One ship is tied up. The other berths are empty, and the lamps are lit for nobody."
    say "A lamp burns in the harbourmaster's house. It is the only welcome in sight."
    say "The quay runs on past the harbourmaster's house, out toward the harbour mouth."

  hotspot ship "the Marrow"
    area (0,120) (620,120) (650,600) (600,680) (0,680)
    stand 1180,790
    look "The Marrow. Her sails are still bent, and her deck is scrubbed. She is the only ship here with any gear aloft."
    talk "I call up to the deck. Nobody answers. The harbour has taught everyone not to shout at ships."
    open "I am not opening a ship. Ships open themselves, usually at the worst moment."
    pickup "She is a little big for my satchel."
    use "I would need a captain first. That seems to be the trouble everywhere on this island."
    state if vex_deal
      look "The Marrow. A new rudder is lashed by her rail, and somebody has been painting her name."
      talk "A man on deck raises a hand, then remembers he is not supposed to be friendly."
    state if met_vex
      name "the Marrow, Vex's ship"
      look "The Marrow. Vex's ship, and the only way off this island that is still afloat."

  # The low warm frontage beyond the Marrow's bow: the Salty Keel, two lanterns burning over
  # its corner, its window warm above the wet stone and the warm pool at its threshold.
  hotspot tavern_door "the Salty Keel"
    area 990,460 120x200
    stand 1160,760
    exit tavern
    look "The Salty Keel. Warm light, and the sound of people carefully not saying something."
    open "I push the door. The room goes quiet in the way a room does when it knows me."

  hotspot office_door "the harbourmaster's house"
    area 1250,420 140x210
    stand 1340,760
    exit office
    look "The harbourmaster's house. A lamp is burning behind the glass."
    open "I go in. Bramwick has run this harbour for thirty years, and he will know what to say."

  # The shadowed slot between the house's corner post and the counting house wall: the mouth
  # of Wreckers' Lane, cold fog light deep inside it and crates stacked against it.
  hotspot alley_mouth "Wreckers' Lane"
    area 1560,340 110x280
    stand 1620,780
    exit alley sound none
    look "A gap between two warehouses. Wreckers' Lane. The name is doing a lot of work."
    open "I turn into the lane. It smells of tar and wet rope."

  # The lit stone steps climbing between the counting house and the tall timber house at the
  # right: the road up to Upper Town, its gate and a lamp burning beyond it.
  hotspot road "the road up to town"
    area 2200,420 230x260
    stand 2290,810
    exit village sound none
    look "The steps climb between the warehouses to Upper Town. Every shutter up there is shut."
    open "I take the steps up. The stone is wet, and the town is listening."

  # The painted path at the right edge, running on under the tall quay lamp and out of frame:
  # the way on to the quay and the harbour mouth.
  hotspot pier "the quay to the harbour mouth"
    area (2360,650) (2550,650) (2550,880) (2360,880)
    stand 2430,845
    exit quay sound none
    look "The wet path runs on past the harbourmaster's house. Past it is the quay, then the pier, then the harbour mouth."
    open "I walk on along the quay, out toward the harbour mouth."

  hotspot water "the harbour water"
    area (0,650) (420,660) (600,680) (600,880) (0,880)
    nowalk
    look "Black water. Past the headland, the fog has sat for three months without moving."
      say "Six ships used to tie up here. Now there is one."
    talk "I say my father's name to the water. The water has heard it before."
    use "I could drink it. I have had worse from the tavern."
`,pl=`room far_pans "The Far Flats"
  bg bg_far_pans_v2b_wide
  width 2560
  backdrop "contrast(1.04) saturate(0.84) brightness(1.08) tone(0.3)"
  music music_pans
  ambience wind
  # The plate is the far flats at night already: cold pewter pans, one lamp on the camp track.
  # Quill takes the same cold, flattened grade as the flats.
  grade "saturate(0.76) brightness(0.92) contrast(0.98)"
  perspective horizon 480 ref 875 height 220
  walk (40,878) (60,842) (900,828) (1600,820) (2200,828) (2500,844) (2520,878)
  entry 2300,846
  arrive salt_camp 2300,846
  footsteps sand
  water (700,500) (1500,500) (1500,600) (700,600) ripple 1.0
  water (1520,540) (1850,540) (1850,640) (1520,640) ripple 1.0
  haze 300 400 floor 460 alpha 0.20 speed 6 tint "#bcc9d3"
  haze 500 680 floor 760 alpha 0.10 speed 5 tint "#aebdca"
  # A thin bank in front of the near bank, so the walker and Quill sit in the haze.
  haze 700 820 floor 872 alpha 0.05 speed 4 tint "#bcc9d6"
  # The lamp on the camp track and the camp fire beyond it are the way back.
  light 2360,820 radius 120 fire
  light 1500,360 radius 110 lantern
  light 2300,520 radius 80 fire
  emit lapping at 900,700

  # Act III, optional: the quiet scene away from the camp. Quill walks out to the end of the
  # boardwalk to look at the Shroud, and says the things she will not say in front of Vex.
  # One figure, far out on the bank below the boardwalk's foot: the wide empty vista is the point.
  sprite npc_quill_body at 760,838 size 1 idle speaker quill for quill if act 3

  scene if act 3 and not pans_seen
    set pans_seen
    say "The far pans run out to the water in white squares. Each one holds a piece of the sky."
    say "Quill is at the end of the boardwalk with her glass up. She does not turn round."

  hotspot sky "the sky"
    area 0,0 2560x235
    nowalk
    look "The sky, the colour of the inside of a shell. Out here that passes for weather."

  hotspot pans "the pans"
    area 0,380 2560x412
    nowalk
    look "Flooded pans, flat as glass. The salt is still in rows, waiting for someone to rake it."

  hotspot fog "the fog"
    area 620,300 1100x110
    nowalk
    look "The fog is a white line along the water. It does not look big enough to take a ship."

  hotspot wreck "the wreck"
    area 1600,150 400x300
    nowalk
    look "A ship on the reef, three masts and a broken back. She has been there longer than the fog."

  hotspot boardwalk "the boardwalk"
    area 0,300 540x330
    stand 430,846
    look "A boardwalk on stilts, running out over the pans and stopping short. It lost its nerve."
    walk "It goes out over the water and stops. I know the feeling."
    use "The planks are warm. I stand on the last one and look at the fog."

  hotspot rakes "the rake"
    area 300,470 300x200
    nowalk
    look "A rake, left in the salt. The handle is bleached white."

  hotspot heron "the heron"
    area 580,420 110x170
    nowalk
    look "A heron, standing in a salt pan like it owns the place. It probably does."

  hotspot salt "the salt heap"
    area 100,560 260x150
    nowalk
    look "A heap of salt, raked and left. The wind has smoothed the top."

  hotspot gull "the gull"
    area 560,555 160x80
    nowalk
    look "A gull on the salt heap, watching me. It has the look of a landlord."

  # The tents, the stake fence and the pale beach track that runs down the right edge to the
  # walk are all the camp; the whole east corner is the target.
  hotspot camp "the camp path"
    area (1850,300) (2150,300) (2280,460) (2380,640) (2560,640) (2560,880) (2000,880) (1920,700) (1860,540)
    stand 2300,850
    exit salt_camp sound none
    look "The camp, back along the shore. Tents, and a fence of stakes."
    open "I walk back along the shore to the camp."

  hotspot quill "Quill"
    area 700,526 150x320
    stand 820,848
    look "Quill, with her glass up and the wind in her coat. She is looking at the fog."
    talk "She lowers the glass when she hears me."
      talk quill at pans

  use compass on fog
    "The needle points at the fog and stays there. It has found something it likes."
  use compass on quill
    "She holds it up. \\"Still the fog,\\" she says. \\"Good. We are not lost yet.\\""
`,gl=`room key_gate "The Reef Gate"
  bg bg_key_gate_v2b_wide
  width 2560
  backdrop "contrast(1.04) saturate(0.86) brightness(1.04) tone(0.3)"
  music music_office
  # The plate is already the Shroud's cold gate: the open leaf with firelight beyond, the
  # longboat in the shallows and the Grey Lantern half-seen. The backdrop deepens it and tones it
  # (indigo shadows, amber key) so it sits with the interiors; the figures are cooled to match.
  grade "saturate(0.64) brightness(0.86) contrast(0.98)"
  perspective horizon 420 ref 875 height 250
  # The sandbank runs along the bottom, in front of the boat and the brazier. Everything the
  # crew stands on is inside this band; the boat's hull stands above it.
  walk (60,878) (80,842) (600,836) (1100,844) (1300,858) (1700,862) (2000,858) (2300,856) (2520,878)
  entry 300,862
  # Arriving from the flats you appear on the painted shore path at the west edge. (The old
  # \`arrive weather_works\` stub is gone: the lighthouse no longer opens onto the reef gate.)
  arrive lagoon_shore 220,862
  footsteps sand
  ambience sea
  # Fire beyond the open gate, the signal brazier on the right, and one green light on the
  # Grey Lantern's rail: never the ship entire and never her captain.
  light 150,790 radius 230 fire
  light 900,650 radius 100 fire
  light 985,640 radius 80 fire
  light 2140,790 radius 120 fire
  # A cold lift on the wet sand at the west edge, so the path out reads even without the label.
  light 160,790 radius 170 moon
  light 1770,250 radius 150 lantern colour "#6fe8a8" if act 3
  light 1770,250 radius 70 lantern colour "#c8ffe2" if act 3
  haze 40 430 floor 700 alpha 0.16 speed 5 tint "#d7dee2"
  haze 470 650 floor 700 alpha 0.1 speed 4 tint "#dfe6ea"
  haze 700 880 floor 870 alpha 0.06 speed 3 tint "#cfd8dc"
  motes embers (840,570) (1020,570) (1020,700) (840,700) count 18
  motes embers (2050,700) (2240,700) (2240,860) (2050,860) count 20

  # The signal brazier stands on the sand; walk round in front of it.
  occluder floor 876 (2070,700) (2260,700) (2245,876) (2085,876)

  # By the brazier, a step back from the boat's track so the gate's opening stays clear.
  sprite npc_vex_body at 1880,856 size 1 idle speaker vex for vex grade "saturate(0.78) brightness(0.9)" if act 3

  # Act III ends at this gate. The three things the castaways need are Elias's rules,
  # the name, and Hobb's plan for the bell; only then does Vex let them board.
  scene if act 3 and elias_found and bell_plan and rule_name and not lantern_boarded and not key_gate_ready
    set key_gate_ready
    say "The gate stands open. The longboat is in the water, and Vex is holding the oars."
    say "Nobody is saying anything. That is how I know it is time."

  scene if act 3 and not key_gate_arrived and (not elias_found or not bell_plan or not rule_name)
    set key_gate_arrived
    say "The reef gate. The palisade runs down into the fog and stops at the water."
    say "Beyond it, the Grey Lantern is at anchor. One green light, and no other lights."
    say "Vex is by the brazier. He has not looked at the gate once."

  # A migrated save can carry the boarding flag without the queued act ending.
  scene if act 3 and lantern_boarded
    say "The longboat is already pulling for the Grey Lantern. The gate is behind us."
    act 3

  # The painted leaves and the open passage between them (x 700-1000), with the brazier light
  # beyond. The stand is the sand strip at the gate's foot.
  hotspot gate "the reef gate"
    area (700,368) (1000,368) (1010,560) (980,690) (790,700) (700,600)
    stand 1060,866
    look "The reef gate. Ship's timber, twice my height, one leaf standing open on the fog."
    open "I step toward the opening. Vex does not move out of the way."
    push "I push the open leaf. It swings a little and comes back."
    pull "I pull the leaf. The hinge grinds, and nothing else happens."
    state if act 3 and (not elias_found or not bell_plan or not rule_name)
      name "the held gate"
      look "The gate stands open, but Vex has one hand on the post and the other in his pocket."
      talk "Vex answers without turning round. \\"Not yet.\\""
        talk vex at gate
    state if act 3 and elias_found and bell_plan and rule_name and not lantern_boarded
      name "the opened gate"
      look "The gate stands open. The longboat waits in the water at its foot."
      open "I walk up to the open gate. The fog comes in to meet me."
        say "I put a hand on the open leaf. It swings wider into the cold."
        say "At the foot of the gate, the longboat rides on water the colour of old pewter."
        say "Hobb is in the bow with his crowbar. Quill has the spyglass. My father sits amidships with the chart across his knees."
        say "Dorrit hands a biscuit round. \\"Nobody boards a ghost ship on an empty stomach,\\" he says. After that, nobody is talking."
        say "Vex is in the stern with both oars shipped. He does not offer me a hand."
        say "Out past him, the fog has a shape: a great dark hull, and one green light."
        say "The bell rings once. It is not our bell."
        sound chime
        say "I step into the boat. The gate stands open behind me, and nobody looks back."
        say "Vex pulls. The Grey Lantern comes out of the fog to meet us."
        set lantern_boarded
        act 3

  # The painted longboat waits in the shallows before the open gate. The hotspot follows the
  # painted hull; the stand is on the sand below her, clear of her footprint.
  hotspot boat "the longboat"
    area (1240,632) (1400,610) (1600,612) (1780,650) (1842,720) (1830,850) (1500,862) (1280,822) (1240,720)
    stand 1900,866
    look "The longboat, waiting in the shallow water before the gate. Her oars are shipped and her hull is the only thing here that still floats."
    talk "I put a hand on her gunwale. She rode five of us in and did not complain."
    use "Vex has the oars. He is not moving them yet."
    state if act 3 and (not elias_found or not bell_plan or not rule_name)
      look "The longboat, empty, in the gate's shadow. She is not going anywhere without a plan."
      talk "She is still and empty. Vex is not looking at her either."
      use "I put a hand on her gunwale. Vex says, \\"Not yet.\\""
    state if act 3 and elias_found and bell_plan and rule_name and not lantern_boarded
      look "The longboat is in the water. Vex is holding her against the gate."
      talk "Her oars are across the thwarts. Vex is holding her ready."
      use "The gate first. Then the boat."

  # Never the whole ship: the painted hull is a shape in the fog, the lantern a green light on it.
  hotspot dark_hull "the dark hull"
    area 1350,30 780x350
    nowalk
    stand 2200,858
    look "Out past the palisade, the fog has a shape in it. A dark hull, long and low, and one green light."
    use "I cannot reach it from here. That is what the gate is for."
    state if act 3 and elias_found and bell_plan and rule_name
      look "The Grey Lantern, half-seen. Dark hull, green lantern, and a bell I can hear."

  hotspot brazier "the signal brazier"
    area 2040,706 214x174
    stand 2000,864
    look "A brazier of cold kelp, smoking to keep the fog down. Somebody has kept it lit all night."
    use "I warm my hands. The smoke leans out to sea."
    turnoff "Vex would only light it again. He likes a fire he can stand beside."

  # The pale shore track at the frame's left edge, running from the gate's sand off west: the
  # target is the painted sandbar and wet channel, not the fog above it.
  hotspot path "the path to the flats"
    area (0,700) (380,700) (470,760) (470,880) (0,880)
    stand 240,864
    exit lagoon_shore sound none
    look "The path back into the fog flats. The sand is the only thing out here that has not moved."

  hotspot vex "Captain Vex"
    show if act 3
    area 1806,556 148x312
    stand 1830,862
    look "Vex by the brazier, coat buttoned to the chin, watching the fog with the face of a man who has been outbid."
    talk "He does not turn round. \\"If you've come to blame me, form a queue.\\""
    state if act 3 and elias_found and bell_plan and rule_name
      look "Vex has stopped watching the fog. He is watching the boat."
      talk "He holds the oars across his knees and looks at me."
        talk vex at board
    state if act 3 and (not elias_found or not bell_plan or not rule_name)
      look "Vex is counting something on his fingers. It looks like the crew."
      talk "He says, \\"We are not ready. Tell me we are ready.\\""
        talk vex at gate
`,ml=`room lagoon_shore "The Wrack Line"
  bg bg_lagoon_shore_v2b_wide
  width 2560
  backdrop "contrast(1.04) saturate(0.84) brightness(1.08) tone(0.3)"
  music music_sea
  ambience sea
  # The plate is the Shroud's own cold, fog-bound flats, painted at night. The figures are
  # graded to match: the backdrop deepens the pale flats and tones them (indigo shadows, amber key).
  grade "saturate(0.76) brightness(0.92)"
  perspective horizon 500 ref 875 height 300
  # The longboat fills the lower left, so the walk starts to the right of her hull and runs the
  # clear wet-sand band east under the palisade, along the near edge of the shallow channels.
  walk (720,878) (740,832) (1050,818) (1400,808) (1750,804) (2100,814) (2400,834) (2520,878)
  entry 1250,845
  # Arrivals sit on the walk by the thing you came through: the longboat from the wreck, the
  # gate path from the reef gate.
  arrive reef_wreck 820,850
  arrive key_gate 1950,842
  footsteps sand
  water (700,500) (980,500) (980,650) (900,670) (700,640) ripple 1.2
  water (1520,500) (1720,500) (1720,620) (1520,620) ripple 1.0
  haze 300 470 floor 560 alpha 0.15 speed 6 tint "#d9e3ea"
  haze 640 770 floor 830 alpha 0.05 speed 3 tint "#c6d2dc"
  # The lamp at the palisade gap and the tents' warmth behind it are the only warm notes, and
  # the lamp is what makes the gate read from the entry frame.
  light 1730,340 radius 100 lantern
  light 2240,470 radius 80 candle
  emit lapping at 1250,660

  # Act III opens here: five alive, one ship gone, and Vex's admission on the sand. The crew
  # stands apart on the flats; the longboat is the way out to the wreck, the gate the way east.
  scene if act 3 and not stranded
    set stranded
    say "The longboat comes in on a wave and stops hard on the sand. For a moment nobody moves."
    say "Behind us the Marrow is going down. The fog is in no hurry about it."
    say "I count heads. Quill. Dorrit. Hobb. Vex. Me. Five. That is the whole crew."
    say "Vex is the last one out. He stands with his coat over his face. Then he says it."
    say "\\"I saw your father. Three weeks back, out past the bar. He was standing on a rock.\\""
    say "Nobody moves. The water goes on doing its small work along the sand."
    say "\\"I could have come about. I told myself the fog was too thick.\\""
    say "Quill turns on him. \\"You knew,\\" she says. \\"You knew, and you let us come.\\""
    say "Dorrit does not say anything. That is how I know he is angry."
    say "Vex pulls the coat down. He looks older than he did at sundown."
    say "\\"The fog was thinner than I told myself. He waved. I turned the wheel.\\""
    say "\\"You can hate me on the walk. There is a long walk.\\""
    say "Hobb has not said a word. He is looking out at the wreck on the reef."
    note vex_saw_elias "Vex saw my father on the rock three weeks back. He turned the wheel."

  # The way east to the reef gate is out of the entry frame, so one short nudge once you have
  # the crew ashore: the gate is a pale gap in the palisade at the far end of the flats.
  scene if act 3 and stranded and not nudge_reef_gate
    set nudge_reef_gate
    say "East along the wet sand, the palisade stands where the flats end. One pale gap in it, and that is the gate."
    say "Vex does not turn round. \\"When the plan is real,\\" he says. \\"Not before.\\""

  sprite npc_vex_body at 1050,822 size 1 idle speaker vex for vex
  sprite npc_quill_body at 1400,828 size 1 flip idle speaker quill for quill
  sprite npc_dorrit_body at 1900,842 size 1 idle speaker dorrit for dorrit
  sprite npc_hobb_body at 2120,822 size 1 idle speaker hobb for hobb

  hotspot lagoon "the lagoon"
    area (560,480) (1700,480) (1700,640) (1450,680) (900,660) (560,620)
    stand 1300,850
    look "The lagoon, flat and cold. The water lies in grey channels between the sandbars."
    talk "I say my father's name to the lagoon. Somewhere out there a ripple starts, and thinks better of it."
    use "I put a finger in. It is cold enough to feel like a decision."
    pickup "I would need something to carry it in. My hands have been tried."

  hotspot wreck_far "the wreck in the fog"
    area 1020,330 500x500
    nowalk
    stand 1100,850
    look "A wreck far out in the fog, only her broken masts showing. The longboat is the only way out to her."
    talk "I call across the flats. The fog takes it and gives nothing back."
    use "She is further out than she looks. Wrecks usually are."

  # The gate is the pale gap in the palisade above the dune, with its painted track running down
  # the sand to the shore. The whole opening and track are the target; the stand is the walk below.
  hotspot reef_gate "the reef gate"
    area (1680,300) (1890,300) (1910,520) (1970,660) (1840,700) (1690,560)
    stand 2000,846
    exit key_gate sound none
    look "A palisade on the dune above the flats, sharpened posts against the fog. Whatever it keeps out, it has kept out for years."
    open "I start across the wet flats toward the palisade."

  hotspot boat "the longboat to the wreck"
    area (20,590) (60,560) (300,540) (490,548) (640,590) (690,700) (680,815) (400,825) (180,790) (40,700)
    stand 800,850
    exit reef_wreck sound none
    look "The longboat, drawn up on the wet sand. She carried five of us in and did not complain."
    talk "I put my hand on her gunwale. She is the only thing we own that still floats."
    open "We row out to the wreck. Quill takes one oar and gives me the other, which she regrets."
    use "We row out to the wreck. Quill takes one oar and gives me the other, which she regrets."

  hotspot vex "Vex"
    show if act 3
    area 1010,535 170x300
    stand 1010,850
    look "Vex, on the flats, with his coat half off. He has stopped being the captain of anything."
    talk "He does not look up. \\"The tide is wrong. We have until it turns.\\""
      talk vex at shore
    give "He looks at my hands, then at the water. \\"Save it for someone who is staying. I travel light these days.\\""

  hotspot quill "Quill"
    show if act 3
    area 1358,545 92x292
    stand 1300,850
    look "Quill, her back to the boat. She is watching the wreck as if it owes her money."
    talk "She says, \\"I can row us out there. I want it noted that I said us.\\""
    give "She does not turn around. \\"Put it away. I have oars to carry.\\""

  hotspot dorrit "Dorrit"
    show if act 3
    area 1818,550 172x304
    stand 1820,852
    look "Dorrit, counting what came ashore, and not liking the total."
    talk "He holds up a spoon. \\"One pot. Four spoons. A captain with no ship. That is the whole of it.\\""
    give "He weighs it in one hand and gives it back. \\"Not unless it is a spoon.\\""

  hotspot hobb "Hobb"
    show if act 3
    area 2056,540 136x288
    stand 2030,848
    look "Hobb, standing apart with his hands behind his back. He is looking at the wreck in the fog."
    talk "He does not turn. \\"That wreck is older than the island. Somebody should have taken her apart years ago.\\""
    give "He shakes his head. \\"Keep your hands free. We will need them.\\""

  use compass on wreck_far
    "The needle swings to the wreck, then past her, out into the fog. It stays there."
  use compass on reef_gate
    "The needle points at the gate, then at the wreck. It cannot choose, so I put it away."
`,bl=`room lantern_deck "The Grey Lantern — Deck"
  # A side-on close-up of the Grey Lantern: the spectral ship in the fog beyond the rail, the
  # great green lantern hanging over the carved stern gallery at the right, and beneath it the
  # open cabin door, whose warm lamplight is the way below.
  bg bg_lantern_deck_restart_b_wide
  width 2560
  backdrop "lift(0.01)"
  music music_fog
  perspective horizon 300 ref 875 height 470
  # A shallow measured scale: the deck is close and level, and the great lantern hangs high
  # above the floor, so the wrapped-canvas prop is sized against a person height up there too.
  scale 40 360
  scale 300 380
  scale 650 420
  scale 875 470
  # The cast stands in the lantern's teal: tint(hue) lays the room's colour over every figure.
  grade "saturate(0.82) brightness(0.96) tint(158)"
  walk (40,875) (60,650) (2150,650) (2200,875)
  entry 1640,865
  arrive arcadia_cabin 1980,845
  footsteps deck
  ambience sea

  # The great lantern is the only light the ghost ship has left. The rail lamp is the only
  # warm thing on the deck, and it is not for us.
  light 1880,170 radius 190 lantern colour "#79e6a4" if not lantern_doused
  light 1880,170 radius 80 lantern colour "#dcffe9" if not lantern_doused
  light 1990,560 radius 80 candle colour "#ffb070"
  light 1980,760 radius 120 candle colour "#ff9f55"
  haze 260 620 floor 700 alpha 0.14 speed 4 tint "#cfd8dc"
  motes dust (360,60) (720,60) (730,370) (340,370) count 20
  emit lapping at 700,790
  emit creak

  # Act IV. The crew is aboard, the three jobs are open, and the deck is the hub between the
  # bell, the lantern and the cabin door. The name is below, in the captain's cabin.
  scene if not lantern_deck_boarded
    set lantern_deck_boarded
    say "The Grey Lantern's deck is wet. The fog stands around it like a wall with no top."
    say "Behind us, the longboat knocks against the hull. Dorrit is minding it, and his pot. Nobody has spoken since we climbed aboard."
    say "Hobb is at the mast with his ear turned up. Quill is watching the great lantern."
    say "Elias holds his chart to his chest and looks at the cabin door."
    say "Vex has his hands in his pockets. \\"Three jobs,\\" he says. \\"I'll watch the boat.\\""

  scene if bell_cut and lantern_doused and not name_spoken and not lantern_deck_ready
    set lantern_deck_ready
    say "The bell is quiet. The great lantern is out. The fog has stopped pressing at the rail."
    say "There is one rule left, and it is below, in the captain's cabin."

  scene if name_spoken and bell_cut and lantern_doused and not lantern_deck_final
    set lantern_deck_final
    say "The deck is very quiet. Somewhere below, the cabin is waiting."

  # The cabin door is under the carved stern gallery at the right-hand end of the deck. One
  # short nudge, once, while the name is still unread.
  scene if act 4 and lantern_deck_boarded and not name_spoken and not nudge_cabin_door
    set nudge_cabin_door
    say "The cabin door is under the carved stern gallery, at the far end of the deck."
    say "Elias holds his chart against his chest. \\"The name is down there,\\" he says. \\"Go on.\\""

  # The crew. Vex holds the stern by the lantern; Quill is forward at the mast; Hobb inboard;
  # Elias centre; Tam comes out of the rigging to the cabin door. Five floor rows, not a rail line.
  sprite npc_ansel_body at 1480,805 size 1 idle speaker elias for elias grade "saturate(0.9) brightness(0.9)"
  sprite npc_quill_body at 700,800 size 1 idle speaker quill for quill grade "saturate(0.9) brightness(0.9)"
  sprite npc_hobb_body at 1010,825 size 1 idle speaker hobb for hobb grade "saturate(0.9) brightness(0.9)"
  sprite npc_vex_body at 1850,830 size 1 idle speaker vex for vex grade "saturate(0.9) brightness(0.9)"
  sprite npc_tamhobb_body at 1250,870 size 1 idle speaker tamhobb for tamhobb grade "saturate(0.9) brightness(0.9)" if tam_freed
  # Mordant appears in his cabin (arcadia_cabin), where the name is spoken.
  # The wrapped lantern: once Quill smothers it, this dark canvas hangs over the painted green
  # glass, so the great lantern itself reads out, not just the dynamic light. The stern lantern
  # hangs close and large in this plate, so the size is measured to its painted glass.
  sprite prop_lantern_wrapped at 1880,300 size 0.70 visible 0.99 grade "saturate(0.8) brightness(0.95)" if lantern_doused

  # The painted green lantern, hanging from the carved gallery above the cabin door. High
  # enough that only Quill can reach it.
  hotspot great_lantern "the great lantern"
    area 1800,40 200x300
    stand 1860,845
    look "The great lantern, green and swollen with light. It hangs from the stern, and the fog leans in to look at it."
    use "The canvas is wet and heavy in my hands. Quill holds out her hand for it."
      say "I pass it up. Quill climbs the stern without hurrying."
      say "She drapes the canvas over the glass. The green light fights her, then gives up."
      say "\\"No air, no flame,\\" she says. \\"No flame, no fog. Simple.\\""
      say "The deck goes dark. Out past the rail, the fog is only fog."
      set lantern_doused
      take lantern
      sound click
    state if lantern_doused
      name "the dark lantern"
      look "The great lantern, wrapped in wet canvas. The green light is out, and the fog has lost interest."
      use "The canvas is tied down and the glass is dark. There is nothing left to put out."
        nothing
    state if not has lantern
      use "The lantern is high, and the canvas is not in my hands. Quill is the one with the wet cloth."
        nothing

  # The canvas in hand works exactly as the lantern's own Use does: Quill takes it, climbs,
  # and the great lantern goes out.
  use lantern on great_lantern
    "The canvas is wet and heavy in my hands. Quill holds out her hand for it."
    say "I pass it up. Quill climbs the stern without hurrying."
    say "She drapes the canvas over the glass. The green light fights her, then gives up."
    say "\\"No air, no flame,\\" she says. \\"No flame, no fog. Simple.\\""
    say "The deck goes dark. Out past the rail, the fog is only fog."
    set lantern_doused
    take lantern
    sound click

  use crowbar on great_lantern
    "The lantern is glass and rope, high above the deck. The crowbar is for the bell."
  use lantern on bell
    "The canvas would smother the bell, not ring it. Hobb has the rope."
  # The mast and rigging, painted from the deck to the top of the frame. The bell is a sound in
  # it, so the rigging answers to the same Use (and the same iron) as the bell does.
  hotspot rigging "the mast and rigging"
    area 900,0 900x600
    nowalk
    look "The mast and the shrouds, black against the fog. Somewhere up there a rope is moving."
    talk "I call up into the rigging. It creaks and does not answer."
    use "Hobb is already climbing. He does not ask what I heard."
      say "He goes up the shrouds hand over hand, the crowbar through his belt."
      say "At the top he stops. Then he says one word, very quietly: \\"Tam.\\""
      say "There is a man in the rigging with one hand on the bell rope. He is thin, and tired, and alive."
      say "\\"I have to keep the watch,\\" Tam says. \\"Somebody has to keep the watch.\\""
      say "Hobb cuts the rope. The clapper comes away in his hand. The bell hangs dumb."
      say "Tam looks at his empty hand like a man waking up."
      set bell_cut
      set tam_freed
      sound chime
    state if bell_cut
      look "The shrouds hang still. Nothing up there is ringing now."
      use "Hobb has cut it. There is nothing left to cut."
        nothing

  # Hobb's iron on the rigging is the bell's job too: the rope parts, Tam is freed.
  use crowbar on rigging if not bell_cut
    "I wedge the bar under the clapper and pull. Hobb is already climbing."
    say "He goes up the shrouds hand over hand, the crowbar through his belt."
    say "At the top he stops. Then he says one word, very quietly: \\"Tam.\\""
    say "There is a man in the rigging with one hand on the bell rope. He is thin, and tired, and alive."
    say "\\"I have to keep the watch,\\" Tam says. \\"Somebody has to keep the watch.\\""
    say "Hobb cuts the rope. The clapper comes away in his hand. The bell hangs dumb."
    say "Tam looks at his empty hand like a man waking up."
    set bell_cut
    set tam_freed
    sound chime
  use crowbar on rigging
    "Hobb has cut the bell already. The iron has done its work."

  # The bell: painted hanging at the top of the mast (r2 plate); the hotspot sits on the painted bell.
  # Three notes, then one, the way Tam rang the Arcadia's watch.
  hotspot bell "the bell"
    area 1025,0 185x270
    nowalk
    look "A ship's bell, green with age, hanging high in the rigging. I hear it: three notes, then one, slow."
    talk "I call up. The bell keeps its time and does not answer."
    use "Hobb is already climbing. He does not ask what I heard."
      say "He goes up the shrouds hand over hand, the crowbar through his belt."
      say "At the top he stops. Then he says one word, very quietly: \\"Tam.\\""
      say "There is a man in the rigging with one hand on the bell rope. He is thin, and tired, and alive."
      say "\\"I have to keep the watch,\\" Tam says. \\"Somebody has to keep the watch.\\""
      say "Hobb cuts the rope. The clapper comes away in his hand. The bell hangs dumb."
      say "Tam looks at his empty hand like a man waking up."
      set bell_cut
      set tam_freed
      sound chime
    state if bell_cut
      name "the silent bell"
      look "The bell hangs quiet above the deck, its rope cut. Tam is by the rail with a boathook, looking at his hands."
      use "Hobb has cut it. There is nothing left to cut."
        nothing
      talk "The rigging is empty. Whatever was ringing has stopped."
        nothing

  # Hobb's iron on the bell is the same job as the bell's own Use: the rope parts, Tam is
  # freed, and the bell hangs dumb.
  use crowbar on bell if not bell_cut
    "I wedge the bar under the clapper and pull. Hobb is already climbing."
    say "He goes up the shrouds hand over hand, the crowbar through his belt."
    say "At the top he stops. Then he says one word, very quietly: \\"Tam.\\""
    say "There is a man in the rigging with one hand on the bell rope. He is thin, and tired, and alive."
    say "\\"I have to keep the watch,\\" Tam says. \\"Somebody has to keep the watch.\\""
    say "Hobb cuts the rope. The clapper comes away in his hand. The bell hangs dumb."
    say "Tam looks at his empty hand like a man waking up."
    set bell_cut
    set tam_freed
    sound chime
  use crowbar on bell
    "Hobb has cut the bell already. The iron has done its work."

  # The low door under the carved gallery at the stern, below the great lantern, standing open
  # with warm lamplight across the deck.
  hotspot cabin_door "the cabin door"
    area 1890,380 220x340
    stand 2070,845
    exit arcadia_cabin sound door
    look "A low door under the carved gallery. The dark behind it is not empty."
    open "I duck under the carved beam and go in."
    use "I duck under the carved beam and go in."
    talk "I knock. The door is already open."
    state if name_spoken
      look "The cabin door, and the cold coming out of it."

  # The rail, and the fog past it. There is no horizon out there at all.
  hotspot rail "the rail"
    area 100,430 1200x170
    stand 650,820
    look "The rail, and the fog past it. The sea is flat and grey, and there is no horizon."
    talk "I lean over the rail and say nothing. The fog keeps that too."
    use "I put my hand on the rail. It is wet, and it is not cold."

  hotspot elias "Elias Fenn"
    area 1400,440 190x380
    stand 1480,805
    look "My father, coat buttoned wrong, chart under one arm. He is looking at the cabin door."
    talk "He says, \\"The name is in there. I've said everyone else's for three months.\\""
      say "\\"I never had his,\\" he says. \\"I would like to finish this one.\\""

  hotspot quill "Quill"
    area 630,435 170x370
    stand 700,800
    look "Quill, with her boots off and her sleeves up. She is measuring the climb with her eyes."
    talk "She does not look at me. \\"The lantern needs something wet, and a hand that can reach it.\\""
      say "She puts a wad of oiled canvas in my hands. It is soaked through and cold."
      say "\\"Hold that. Don't wring it out. When I'm up, pass it.\\""
      give lantern
    state if lantern_doused
      look "Quill is wringing the canvas out over the rail. She looks pleased with herself."
      talk "She says, \\"One light down. Hobb's still up the mast, so the bell is his.\\""
        nothing
    state if has lantern
      talk "She nods at the great lantern. \\"Go on. I'll go up with you.\\""
        nothing

  hotspot hobb "Hobb"
    area 940,460 170x370
    stand 1010,825
    look "Hobb, at the foot of the mast with the crowbar through his belt. He is listening upward."
    talk "He says, \\"Three notes, then one. That is Tam's hand on the rope.\\""
      say "He does not say how he knows. He does not have to."
    state if bell_cut
      look "Hobb is standing very still, looking up at the cut rope. He is not a man who celebrates."
      talk "He looks at me. \\"He is alive,\\" he says. \\"That is all I asked.\\""

  hotspot vex "Captain Vex"
    area 1780,465 160x380
    stand 1850,830
    look "Vex, coat buttoned to the chin, hands in his pockets. He is standing where the rail is highest."
    talk "He does not turn round. \\"I'm not going below. Ghosts and I have an understanding.\\""
      say "\\"You cut the bell, I take the credit,\\" Vex says. \\"That's a good deal. For me.\\""
      say "\\"I'll hold the boat,\\" he says. \\"Somebody has to keep the way out open. That's me being useful.\\""
    state if bell_cut and lantern_doused
      look "Vex is watching the cabin door and trying not to. He has one hand on the rail."
      talk "He says, \\"Whatever is down there, it isn't salvage. I'm not carrying it.\\""

  hotspot tamhobb "Tam Hobb"
    show if tam_freed
    area 1190,505 120x360
    stand 1250,870
    look "Tam Hobb, with the Arcadia's boathook still in one hand. He has not put it down."
    talk "He says, \\"I rang it for three months. I don't know what I was counting.\\""
      say "Hobb looks over at his brother. Neither of them says anything else."
`,wl=`room marrow_cabin "The Marrow — Captain's Cabin"
  bg bg_cabin_v2_wide
  width 2560
  music music_office
  backdrop "contrast(0.9) brightness(1.18) saturate(1.04) lift(0.012)"
  grade "brightness(0.96) saturate(0.9)"
  perspective horizon 200 ref 875 height 430
  # The painting's floor is one deep plank run: the forward door and its lantern at the left,
  # the bunk and chest behind the walking band, the chart table amidships, and the stern
  # windows with the gallery door standing open at the right. The walk crosses in front of
  # the table, never behind it.
  walk (100,875) (110,800) (350,790) (2200,790) (2400,840) (2420,875)
  entry 260,840
  arrive marrow_quarterdeck 260,840
  arrive marrow_gallery 2100,840
  # The chart table's front apron is the biggest painted object in the room; whoever walks
  # behind it is hidden by the apron instead of standing on top of the chart.
  occluder floor 780 (1080,560) (1700,550) (1700,790) (1080,790)
  footsteps deck
  # The hanging oil lamp over the chart, the lantern in the forward doorway, the warm gallery
  # door, and cool dusk light from the stern windows.
  light 1280,220 radius 240 lantern
  light 230,540 radius 110 lantern
  light 2100,380 radius 180 lamp colour "#ffc79a"
  light 1700,300 radius 220 moon
  water (2250,320) (2520,320) (2520,620) (2250,620) ripple 1.4
  emit creak

  # Act II: Vex's cabin is optional. The chart, the tidy ledger and the novel
  # under the pillow do the talking while he is up at the helm.
  scene if act 2 and fog_tried and not gallery_hinted
    set gallery_hinted
    say "The stern window is unlatched. The gallery is empty, and every lantern on it is lit."

  scene if act 2 and not vex_exposed
    say "Vex's cabin. The chart is out, the lamp is lit, and nobody is here to stop me."

  # A migrated/hand-edited save can carry the one-way flag without the queued act ending.
  # Do not strand it on a ship with no way to finish the act.
  scene if act 2 and marrow_lost
    say "The Marrow is already going into the fog. There is nothing left to argue with."
    act 2

  hotspot chart "the chart table"
    area 1100,380 620x220
    stand 1750,840
    look "Vex's chart of the Shroud. The coast is ruled in a careful hand; the wrecks are not marked yet."
    use "A bundle of papers, tucked under the chart's edge. Ships, dates, cargo, prices. Neat as a shopman's book."
    open "The chart is pinned at the corners. Vex does not like it moved."

  hotspot shelf "the instrument shelf"
    area 1085,225 190x150
    nowalk
    look "A shelf of brass instruments, polished every morning. A telescope, dividers, and one thing that does nothing but look expensive."
    use "I do not touch another captain's instruments. That is how expensive things get broken."

  hotspot bunk "the bunk"
    area 300,120 650x520
    nowalk
    look "A bunk made with naval precision. Under the pillow, a novel, face down. The cover has a lady and a sword."

  hotspot windows "the stern windows"
    area 1300,150 700x420
    nowalk
    look "The wake, going back to a harbour I cannot see. Every reason I took this berth is in that white water."

  hotspot gallery "out to the stern gallery"
    area 1960,60 330x560
    stand 2100,840
    look "Beyond the stern window, the captain's gallery, over the wake. Vex's. Nobody goes out uninvited."
    walk "Without an invitation, I would only be a stranger on a balcony, being looked at."
    open "Without an invitation, I would only be a stranger on a balcony, being looked at."
    state if act 2 and fog_tried
      exit marrow_gallery
      look "The gallery, and nobody on it. Vex is at the wheel; the invitation is the empty rail."
      walk "Out onto the gallery, while the captain is busy."

  hotspot door_out "the door to the helm"
    area 80,80 320x640
    stand 260,840
    exit marrow_quarterdeck
    look "The door back out to the quarterdeck, lamplight on the sill."

  use compass on chart
    "The needle points past the edge Vex has drawn. It has no opinion about the pencil."
  use spyglass on windows
    "The wake, closer. It is still going the wrong way."
`,yl=`room marrow_deck "The Marrow — Deck"
  # The painting's deck: the foremast and its ratlines at the left, the open cargo hatch with
  # its cover thrown back amidships, and the helm steps, wheelhouse and stern lantern at the
  # right. The lower third is one clear run of wet planks in front of the hatch.
  bg bg_marrow_deck_v2_wide
  width 2560
  backdrop "lift(0.012)"
  music music_sea
  grade "saturate(0.9) brightness(0.98)"
  ambience sea
  perspective horizon 250 ref 875 height 340
  walk (40,878) (60,760) (180,720) (900,705) (1900,705) (2480,730) (2520,878)
  entry 900,810
  arrive marrow_quarterdeck 2100,840
  arrive below_decks 1080,800
  arrive bow_fog 470,820
  arrive crows_nest 560,820
  footsteps deck
  # The hatch glow, the lit helm windows and the stern lantern are the painted lights.
  light 1150,600 radius 220 lamp
  light 1680,230 radius 170 lamp
  light 2270,180 radius 140 lantern
  water (40,300) (430,300) (430,430) (40,430) ripple 1.6
  motes dust (950,560) (1450,560) (1450,700) (950,700) count 24
  emit lapping at 250,600
  emit creak

  # Act II: the crew on deck, and Vex up at the helm. The Marrow was built for a
  # bigger crew than this; the empty deck is part of the mood.
  # Spread bow to stern: Quill forward by the crates, Hobb amidships at the hatch, Dorrit aft
  # at the foot of the helm steps. The three floor rows keep them from reading abreast.
  sprite npc_quill_body at 700,790 size 1 flip idle speaker quill for quill grade "saturate(0.9) brightness(0.98)" if act 2 and not salvage_seen
  sprite npc_dorrit_body at 1800,835 size 1 idle speaker dorrit for dorrit grade "saturate(0.9) sepia(0.08) brightness(0.96)" if act 2 and not salvage_seen
  sprite npc_hobb_body at 1330,808 size 1 flip idle speaker hobb for hobb grade "saturate(0.9) brightness(0.96)" if act 2 and not salvage_seen

  scene if act 2 and fog_tried and not hatch_hinted
    set hatch_hinted
    say "The hatch cover comes up clean now. Below: the ladder, the crew deck, and the smell of other ships."

  scene if act 2 and not fog_tried and not seen:vex.send
    say "A deck built for thirty, and hardly anybody on it."
    say "Vex is at the helm, hat down against the sun. He has not looked back at the island."

  scene if act 2 and seen:vex.send and not fog_tried and not shrouds_hinted
    set shrouds_hinted
    say "Quill's office is up the rigging by the foremast. The rope ladder would take me, if my hands agreed."

  scene if act 2 and fog_tried and not salvage_seen
    say "The crew is on deck. The hatch is unbarred, and nobody wants to be first below."

  scene if act 2 and salvage_seen and not vex_exposed
    say "The deck is empty. They have all gone up to the helm."
    say "The captain is waiting."

  scene if act 2 and vex_exposed and not marrow_lost
    say "Above us, the helm is turning. Vex is not waiting for me."

  # A migrated/hand-edited save can carry the one-way flag without the queued act ending.
  # Do not strand it on a ship with no way to finish the act.
  scene if act 2 and marrow_lost
    say "The Marrow is already going into the fog. There is nothing left to argue with."
    act 2

  hotspot rail "the sea"
    area 20,260 380x220
    stand 470,820
    look "The sea, going gold at the edge. It looked bigger from the quay. Or I was smaller."
    talk "I say hello to the sea. It has heard better."
    use "The sea has nothing to say to a cartographer with a compass."

  hotspot shrouds "the ladder to the crow's nest"
    area (210,0) (430,0) (430,410) (290,410)
    stand 500,820
    exit crows_nest
    look "The rope ladders up to the crow's nest. Quill's country."
    use "I would get two rungs up before Quill had me down by the collar."
    pickup "They are attached to the mast. That is the point of them."

  hotspot forward "the bow deck"
    area 40,480 280x200
    stand 450,820
    look "The bow, and the fog past it. The deck narrows there, and the fog does not."
    open "Vex wants us aft until he has said his piece. The bow can wait."
    state if act 2 and fog_tried
      exit bow_fog sound none
      look "The bow, and the fog past it. I have heard it answer."
      open "I go forward again. My hands remember the rail."
    state if act 2 and seen:vex.send
      exit bow_fog sound none
      look "The bow. Vex says the fog has a voice, and I am to call the water."
      open "I go forward. The deck narrows, and the fog comes to meet me."

  hotspot crates "the stores"
    area 300,520 480x160
    stand 700,810
    look "Crates lashed by the rail. Salt beef, hard bread, and one crate Dorrit has claimed as his own."
    open "Nailed shut. Dorrit counts the nails."
    use "Dorrit is watching me. I put my hands where he can see them."

  hotspot hatch "the hatch to the crew deck"
    area 900,480 560x220
    stand 850,830
    look "The main hatch, its cover thrown back. A smell of tar and old rope comes up. Under it, something else: wet wood and old cargo."
    open "The cover is up. Vex says the hold is cargo."
    state if act 2 and salvage_seen
      exit below_decks sound hatch
      look "The cover is up. I have seen what is down there."
      open "I go down the ladder again. The dark has a shape now."
    state if act 2 and fog_tried
      exit below_decks sound hatch
      look "The cover is up. Below, crates are stacked where the hammocks should be."
      open "I go down the ladder. It is steep, and the dark smells of old cargo."

  hotspot stairs_up "the steps to the helm"
    area 1900,430 410x360
    stand 2050,830
    exit marrow_quarterdeck sound stairs
    look "The steps up to the quarterdeck. Vex is at the top, not looking down."
    open "I go up."

  hotspot quill "Quill"
    show if act 2 and not salvage_seen
    area 650,490 150x310
    stand 700,795
    look "Quill, at the rail with her spyglass. She has not used it once since we left."
    talk "She does not turn around. \\"I came for the chart. And because Vex owes me a horizon.\\""
      talk quill at aboard
    give "She looks at my hands. \\"I have a compass. I need a horizon.\\""
    state if fog_tried
      look "Quill has put the spyglass away. She is watching the water, not the horizon."
      talk "She says, \\"That was not weather. Weather does not ring a bell.\\""
        talk quill at aboard

  hotspot hobb "Hobb"
    show if act 2 and not salvage_seen
    area 1270,490 180x330
    stand 1320,820
    look "Hobb, one hand on the mast, the other on his crowbar."
    talk "He answers before I ask. \\"My brother is in the fog. That is all of it.\\""
    give "He looks at it and shakes his head. \\"Give it to someone who needs opening.\\""
    state if fog_tried
      look "Hobb has his ear against the mast. He does not like what it is saying."
      talk "He says, \\"Something passed under us. Big as the ship.\\""

  hotspot dorrit "Dorrit"
    show if act 2 and not salvage_seen
    area 1700,510 180x330
    stand 1800,840
    look "Dorrit, in his apron, negotiating with a potato."
    talk "He does not look up. \\"If you are going to stand there, hold this.\\""
    give "He hands me a knife and points at the potatoes. That is not a gift."
    state if fog_tried
      look "Dorrit has stopped cooking. The pot is still on the stove."
      talk "He says, \\"The bell rang. There is no bell on this deck.\\""

  use compass on rail
    "The needle swings past north and settles on the fog ahead."
  use spyglass on rail
    "Grey water, then more grey, then a shape I decide is a wave."
  use crowbar on crates
    "Dorrit's crates. I put the crowbar away before he sees it."
`,kl=`# ACT II, optional. The stern gallery at sundown: no puzzle and nothing needed, just the view,
# the wake, and Quill off watch. Opened from the captain's cabin (the cabin's doors are the way
# back); Quill talks it out in dialogue/quill.adv at \`gallery\`.
room marrow_gallery "The Marrow — Stern Gallery"
  bg bg_gallery_v2_wide
  width 2560
  music music_sunset
  ambience sea
  perspective horizon 255 ref 875 height 460
  grade "sepia(0.08) saturate(1.0) brightness(0.98)"
  # The painting's walk is the clear plank run from the cabin doors at the left to the little
  # table at the right; the table itself is not walked into.
  walk (100,878) (120,820) (1980,815) (2020,860) (2040,878)
  entry 640,842
  arrive marrow_cabin 640,842
  footsteps deck
  # The cabin doorway is the only warm interior; the stern lantern answers it at the right.
  light 150,760 radius 180 fire
  light 2100,180 radius 140 lantern
  light 110,500 radius 200 lamp
  water (520,300) (2300,300) (2300,470) (520,470) ripple 1.4
  motes glints (600,300) (2200,300) (2200,450) (600,450) count 35
  emit lapping at 1500,600
  emit creak

  # Quill at the rail by the captain's table, half a row back and turned out to the sunset:
  # two depths and two facings, not a matched pair shoulder to shoulder.
  sprite npc_quill_body at 1900,820 size 1 flip idle speaker quill for quill grade "saturate(0.95) brightness(0.98)" if act 2

  scene if act 2 and not gallery_arrived
    set gallery_arrived
    say "Sundown on the stern gallery. Quill is here, off watch, with the glass she does not need."

  hotspot doors "the cabin doors"
    area 20,80 300x660
    stand 600,842
    exit marrow_cabin
    look "The doors back into the cabin, lamplight behind the glass. In there it is his ship. Out here it is only the sea."

  hotspot sun "the sunset"
    area 1300,150 300x160
    nowalk
    look "The sun is going into the sea with a lack of restraint that would embarrass a chart."

  hotspot wake "the wake"
    area (1200,300) (1260,300) (1650,620) (700,620)
    nowalk
    look "Our wake, ruled straight back to Dreadwater. The one line on this voyage I could draw myself."

  hotspot sea "the Shroud"
    area (450,300) (1150,300) (700,620) (450,620)
    nowalk
    look "The water between us and the island. Every colour there is, and none of it on my chart."

  hotspot islands "the islands"
    area 1300,230 250x60
    nowalk
    look "Islands going blue with distance, like ink drying. Not one of them with a name I know."

  hotspot gulls "gulls"
    area 1500,40 600x120
    nowalk
    look "Gulls, hanging off the stern without a wingbeat. I have drawn worse birds than that."

  hotspot fish "flying fish"
    area 930,480 150x70
    nowalk
    look "A flying fish leaves the sea, glides fifty yards on fins never meant for it, and drops back in, astonished. I know the feeling."

  hotspot rail "the rail"
    area 430,540 1550x290
    stand 1180,842
    look "The rail, turned and polished by years of a captain's elbows. There is a dent in it the size of a glass."
    push "I lean on it, like a sailor. The sea leans back, like the sea. I stop."

  hotspot table "the captain's table"
    area 2050,560 300x300
    stand 2000,830
    look "A bottle of rum and one glass. The glass is full and nobody is drinking it."
    pickup "It isn't mine to take. I get the feeling it isn't his either."

  hotspot lantern "the stern lantern"
    area 2050,70 100x180
    nowalk
    look "A brass lantern on a bracket, lit already, in case the sun changes its mind."

  hotspot carving "the carving"
    area 2280,580 280x300
    nowalk
    look "Gilt carving on the gallery corner: vines, a cherub, and a mermaid who looks tired of holding a pose."

  hotspot quill "Quill"
    show if act 2
    area 1805,380 200x470
    stand 1660,850
    look "Quill at the rail, off watch, with her spyglass and the whole sunset and no use for either."
    talk "She doesn't turn round. She moves the spyglass an inch along the rail, which I take as hello."
      talk quill at gallery
    state if seen:quill.gallery
      talk "She has the spyglass pointed at nothing in particular."
        talk quill at gallery_after
`,vl=`room marrow_quarterdeck "The Marrow — Helm"
  bg bg_quarterdeck_v2_wide
  width 2560
  backdrop "brightness(1.04) contrast(0.97) lift(0.02)"
  music music_sea
  ambience sea
  perspective horizon 260 ref 875 height 330
  # The painting's raised helm deck: the companionway and its thrown-back cover at the left,
  # the wheel and binnacle amidships, the stern cabin door at the right. The walk stays on the
  # clear foreground planks and stops short of the open stairwell and the cabin threshold.
  walk (420,878) (430,760) (520,735) (2450,730) (2500,790) (2500,878)
  entry 470,830
  arrive marrow_deck 470,830
  arrive marrow_cabin 2150,830
  footsteps deck
  # Warm light rising from the companionway, the wall lantern, and the lamplit cabin door.
  light 300,610 radius 220 lamp
  light 1765,180 radius 130 lantern
  light 1990,520 radius 160 lamp
  water (600,380) (1700,380) (1700,560) (600,560) ripple 1.4
  motes glints (1500,300) (2200,300) (2200,400) (1500,400) count 24
  emit lapping at 1300,620
  emit creak

  # Act II: Vex at the foot of the helm, inboard of the binnacle and clear of the frame edge
  # at every camera position. The wheel and binnacle keep their painted ground; the crew
  # behind him is staggered in depth and size, not lined up abreast.
  sprite npc_vex_body at 1240,800 size 1 idle speaker vex for vex grade "saturate(0.9) brightness(0.98)" if act 2 and not marrow_lost
  sprite npc_quill_body at 1450,790 size 1 flip idle speaker quill for quill grade "saturate(0.9) brightness(0.98)" if act 2 and salvage_seen and not marrow_lost
  sprite npc_hobb_body at 1650,842 size 1 flip idle speaker hobb for hobb grade "saturate(0.9) brightness(0.96)" if act 2 and salvage_seen and not marrow_lost
  sprite npc_dorrit_body at 1860,808 size 1 idle speaker dorrit for dorrit grade "saturate(0.9) sepia(0.08) brightness(0.96)" if act 2 and salvage_seen and not marrow_lost

  scene if act 2 and salvage_seen and not vex_exposed
    say "Quill, Hobb and Dorrit come up behind me. Nobody says anything."
    say "Vex is at the wheel. He does not turn around."

  scene if act 2 and vex_exposed and not marrow_lost
    say "Vex has the wheel. The Marrow is already turning into the fog."

  # A migrated/hand-edited save can carry the one-way flag without the queued act ending.
  # Do not strand it on a ship with no way to finish the act.
  scene if act 2 and marrow_lost
    say "The Marrow is already going into the fog. There is nothing left to argue with."
    act 2

  hotspot vex "Captain Vex"
    show if act 2 and not marrow_lost
    area 1160,485 170x335
    stand 1040,805
    look "Captain Vex at the helm, coat buttoned, both hands where the crew can see them. He likes to be seen working."
    talk "I get his attention. It takes some getting."
      talk vex at helm
    state if act 2 and fog_tried and not salvage_seen and not vex_exposed
      look "Vex is watching the water where the bell rang. He has not blinked."
      talk "He hears me on the stairs and turns his head."
        talk vex at after_fog
    state if act 2 and seen:vex.send and not fog_tried and not salvage_seen
      look "Vex is watching the bow, not me. He is waiting for something out there."
      talk "He does not turn from the bow."
        talk vex at helm_done
    state if act 2 and salvage_seen and not vex_exposed
      look "Vex is at the wheel. He has not looked at me since the hold."
      talk "The crew is behind me. He knows why."
        talk vex at confront
    state if act 2 and vex_exposed and not marrow_lost
      look "Vex has both hands on the wheel. He is not waiting for permission."
      talk "He does not turn around. \\"Say it or hold on.\\""
        talk vex at last

  hotspot wheel "the wheel"
    area 820,210 230x300
    stand 1080,815
    look "The wheel, lashed to the captain's heading. It is bigger than it looks from the quay."
    use "I put a hand on it. The ship does not notice, but I do."
    turnon "There is nothing to turn on. The ship is already doing it."
    state if act 2 and vex_exposed and not marrow_lost
      look "The wheel is turning under Vex's hands. He is taking her deeper."
      use "I put my hand beside his. He does not take it off."
        talk vex at last

  hotspot binnacle "the binnacle"
    area 1010,200 130x320
    stand 1140,815
    look "The binnacle. A ship's compass in brass and glass, swinging slow. My father's compass disagrees with it."
    use "The ship's compass points north. Mine points at the fog. One of them is wrong."
    open "Sealed. You do not open a binnacle any more than you open a doctor."
    turnon "It is lit. It has been lit since before I came aboard."

  hotspot seas "the Shroud"
    area 1140,210 500x290
    nowalk
    look "The Shroud, ahead and to starboard, grey where the weather sits. It has taken every ship for eighty years."
    use "I hold up my father's compass. The needle settles on the grey and stays there."

  hotspot cabin_door "the cabin door"
    area 1830,200 270x420
    stand 2150,830
    exit marrow_cabin
    look "The captain's door, carved and warm at the edges. The charts are in there."
    open "I knock, then go in. Nobody is here to stop me."

  hotspot stairs_down "the steps to the deck"
    area 110,330 330x360
    stand 470,830
    exit marrow_deck sound stairs
    look "The open companionway, its cover thrown back. Warm light comes up the steps from the main deck."
    open "I go down."

  hotspot rail_lantern "the rail lantern"
    area 1735,100 90x190
    stand 1660,840
    look "The rail lantern. It burns all night, whether anyone is watching or not."
    state if rule_light
      name "the last lantern"
      look "The lantern is burning. I keep looking at it, waiting for the fog to take it."
      use "I put my hand near the glass. Warm. For now."

  hotspot quill "Quill"
    show if act 2 and salvage_seen and not marrow_lost
    area 1405,520 105x280
    stand 1360,810
    look "Quill has her spyglass out. She is not looking at the horizon."
    talk "She says, \\"Those crates came off another ship. I could tell from the door.\\""
    give "She does not take it. \\"Keep your hands where I can see them. Both of them.\\""

  hotspot hobb "Hobb"
    show if act 2 and salvage_seen and not marrow_lost
    area 1580,515 150x335
    stand 1520,830
    look "Hobb has his crowbar across his knees. He is holding it like a handrail."
    talk "He says, \\"I counted the crates. Then I stopped counting.\\""
    give "He looks at it for a long time. \\"Not yet. Not for this.\\""

  hotspot dorrit "Dorrit"
    show if act 2 and salvage_seen and not marrow_lost
    area 1795,525 140x295
    stand 1750,815
    look "Dorrit has come up from the galley with his sleeves rolled. He is not holding a spoon."
    talk "He says, \\"I cooked for a man who sells the dead. I want that said somewhere.\\""
    give "He looks at my hands and puts his own behind his back."

  use compass on binnacle
    "North, says the binnacle. The fog, says my father's compass. They glare at each other."
  use compass on seas
    "The needle points into the grey off the bow. It has never wanted anything so much."
  use spyglass on seas
    "Grey, then more grey, then a wave that is only a wave."
`,_l=`room office "The Harbourmaster's House"
  bg bg_office_cinema_wide
  width 2560
  backdrop "contrast(0.9) brightness(1.22) saturate(1.04)"
  music music_office
  grade "brightness(0.95) saturate(0.85)"
  # The interior of the harbourmaster's house: the door standing open on the foggy quay at
  # the left, the moonlit window over the harbour, the ledgers, the desk and its warm lamp.
  perspective horizon 300 ref 875 height 560
  # The painted floor: worn boards between the open door at the left and the desk at the right,
  # clear of the shelves and the desk front. Every stand and arrival sits on this band.
  walk (470,878) (470,850) (500,832) (560,822) (650,815) (760,810) (880,808) (1000,808) (1120,810) (1240,815) (1340,822) (1400,878)
  entry 700,860
  arrive dock 580,855
  footsteps wood
  # The two lights the room is painted around: the desk lamp's warm pool and the cold moon
  # coming through the window. The green harbour lamp and the iron lamp outside the door are
  # smaller, colder notes at the edges.
  light 1795,455 radius 280 lamp
  light 700,235 radius 230 moon
  light 885,450 radius 65 lantern colour "#79e6a4"
  light 500,235 radius 110 lantern
  motes dust (600,130) (980,130) (1450,700) (900,700) count 50
  # Repaint the desk top and its front over Bramwick's lap: he sits in the painted chair,
  # behind the desk, rather than standing on its near side. The top edge sits at his chest, so
  # the desk hides him to the shoulders and he reads as seated, never standing on the desk.
  occluder floor 720 (1800,590) (2560,590) (2560,880) (1800,880)

  # Act I: Bramwick at his desk with the harbour's losses in front of him.
  scene if act 1 and not seen:bramwick.root and not office_called
    set office_called
    say "Bramwick is at his desk with his coat on. He looks like a man who has stopped going home."

  # Seated behind the desk, in frame with the lamp whenever the desk is: full figure height and
  # no \`visible\` crop, so his head and shoulders clear the desktop instead of hiding under it.
  sprite npc_bramwick_seated at 1990,645 size 1 visible 1.0 idle speaker bramwick for bramwick grade "saturate(0.72) brightness(0.78)"

  hotspot bramwick "Harbourmaster Bramwick"
    area 1900,220 280x340
    stand 1320,830
    look "Harbourmaster Bramwick. Thirty years of harbour business, and all of it has settled in his face."
    talk "I clear my throat. Bramwick finishes writing before he looks up."
      talk bramwick
    give "He takes nothing he has not signed for."
    state if seen:bramwick.root
      name "Bramwick"
      look "Bramwick. He has not moved, but the papers on his desk have been squared away."
      talk: talk bramwick at again

  hotspot desk "the harbourmaster's desk"
    area 1420,560 780x180
    stand 1320,830
    look "The harbourmaster's desk. A lamp, a log book, and more paper than the harbour has ships."
    open "The desk has a drawer, and the drawer is locked."
    use "I have nothing to put on a harbourmaster's desk that would not insult us both."
    state if seen:bramwick.root
      look "The desk. The log book is closed, which I have never seen before."

  hotspot drawer "the locked drawer"
    area 1480,660 280x150
    stand 1320,830
    look "A deep drawer with a brass keyhole. Bramwick's drawers are like his answers: locked and well made."
    open "Locked. I am not going to crowbar a harbourmaster's desk."
    pull "I pull. The drawer makes a small, satisfied noise."
    use "It needs a key, and I am not a key."

  # The bookcases behind the desk: the harbour's ledgers, boxes and brass instruments.
  hotspot shelves "the shelves"
    area 1080,130 640x480
    stand 1320,830
    look "Ledgers from the floor to the beams. Every ship the harbour has lost is in there, squared away."
    use "I'd need Bramwick's permission, and a ladder."

  hotspot window "the window"
    area 610,140 370x390
    nowalk
    look "The harbour, framed. One ship, and a great deal of empty water."
    open "Painted shut. Bramwick does not believe in fresh air or new ideas."
    state if vex_deal
      look "The harbour, framed. The Marrow has a new rudder on her rail."
        say "Bramwick has not looked out of this window in a week."

  # The painted door stands open onto the harbour: the whole leaf and the dark opening beside
  # it, lintel to threshold board (the interior boards start at y 690).
  hotspot door_out "the harbour door"
    area 90,110 380x580
    stand 560,855
    exit dock
    look "The door back to the docks. The fog has come up to the step."
    open "I go back out to the harbour."
`,Tl=`room pier_end "The Harbour Mouth"
  bg bg_pierend_cinema_wide
  width 2560
  music music_sea
  grade "brightness(0.95) saturate(0.85)"
  ambience sea
  # The pier end: the lighthouse burning at the right, the harbour town's lights and the
  # Marrow's boat at the left, and the wet stone walk between them.
  perspective horizon 580 ref 875 height 330
  # A measured curve: the pier top is a deep foreground plane, so an adult at the near edge is
  # taller than the old single vanishing point allowed.
  scale 710 185
  scale 875 320
  # One continuous painted walking band: in from the town's waterfront at the left, along the
  # pier top past the boat and the lamp, and out to the lighthouse at the right.
  walk (520,878) (540,830) (580,790) (640,760) (720,740) (820,725) (950,715) (1100,712) (1300,716) (1500,725) (1680,740) (1830,760) (1830,878)
  entry 700,840
  arrive quay 560,840
  footsteps stone
  # The tall pier lamp where Vex waits, the lighthouse above, and the town's scaled-down lights.
  light 1135,240 radius 170 lantern
  light 1725,215 radius 100 lantern
  light 60,510 radius 70 lantern
  light 265,470 radius 60 lantern
  light 380,530 radius 55 lantern
  beacon 1725,215 period 14
  # The harbour water under the town at the left and the open sea beyond the pier at the right.
  water (0,720) (210,720) (300,760) (300,880) (0,880) ripple 1.6
  water (2350,620) (2560,620) (2560,880) (2350,880) ripple 2.2
  emit lapping at 150,800
  emit lapping at 2450,800

  # Act I's last scene: with the crew and the chart aboard, Vex waits at the lamp.
  # The Marrow's boat is the painted launch under it.
  scene if act 1 and vex_deal and dorrit_cleared and quill_compass and seen:quill.join and rook_story and hobb_joined and not pier_ready
    set pier_ready
    say "Vex is at the lamp with his coat buttoned to the throat."
    say "The harbour is quiet. Even the gulls have gone to bed."

  sprite npc_vex_body at 1160,720 size 1 idle speaker vex for vex grade "saturate(0.85) brightness(0.9)" if act 1 and vex_deal and dorrit_cleared and quill_compass and seen:quill.join and rook_story and hobb_joined

  hotspot vex "Captain Vex"
    show if act 1 and vex_deal and dorrit_cleared and quill_compass and seen:quill.join and rook_story and hobb_joined
    area 1095,500 150x235
    stand 990,770
    look "Captain Vex, at the lamp, dressed for a portrait and a fight. He is watching the fog, not me."
    talk "Captain. The crew is ready, and the rudder is on."
      say "Vex turns from the fog. For once he does not look pleased with himself."
      say "\\"Then we go,\\" he says. \\"Before I remember why I do not.\\""
      say "He walks down to the boat without looking back at the island."
      act 1
    give "He looks at my hands. \\"Keep it. I have been paid enough for one lifetime.\\""

  hotspot boat "the Marrow's boat"
    area (470,470) (1060,470) (1060,700) (900,740) (470,720)
    stand 1050,780
    look "The Marrow's boat, made fast under the lamp. Her sail is furled and her oars are shipped."
    open "I step aboard. It rocks like a boat that has been waiting."
    use "I could row out to the Marrow myself. I would rather not arrive out of breath."
    state if act 1 and vex_deal and dorrit_cleared and quill_compass and seen:quill.join and rook_story and hobb_joined
      look "The boat is ready. Somebody has folded her sail and left the gangplank down."

  # The town's lights run on along the waterfront at the left edge; the wet stone carries a
  # warm trail of reflections out of frame.
  hotspot town "back along the quay"
    area 480,760 220x120
    stand 560,840
    exit quay sound none
    look "Back along the quay, the lights of Dreadwater. Half of them are out."
    open "I walk back toward the harbour."

  hotspot lighthouse "the lighthouse"
    area 1630,140 240x460
    nowalk
    look "The lighthouse. It has burned every night for eighty years, and it does not reach the fog."
    use "I cannot climb it from here. I am not sure I would want to."

  hotspot sea "the harbour mouth"
    area 1900,560 660x320
    nowalk
    look "The harbour mouth. Past it the fog bank sits on the water, tall as a wall and twice as quiet."
    talk "I tell the fog I am coming. It does not answer, which is worse than an answer."
`,Il=`room quay "The Quay"
  bg bg_quay_cinema_wide
  width 2560
  music music_dock
  ambience sea
  grade "brightness(0.95) saturate(0.85)"
  # One level horizon between the dock's water line and the harbour mouth's, so neither cut
  # lifts or drops the water under Fenn's feet.
  perspective horizon 560 ref 875 height 330
  # The painted path: wet stone flags running clear from the harbour boards at the right edge
  # to the harbour mouth at the left, between the foreground bollard and the crate stacks.
  # Both exits stand on this band, on the two pools of lamplight and their reflection trails.
  walk (540,878) (540,845) (560,805) (600,775) (660,750) (740,735) (840,725) (960,718) (1100,714) (1260,713) (1420,716) (1600,724) (1780,735) (1960,750) (2140,768) (2300,790) (2420,815) (2470,878)
  entry 1250,830
  arrive dock 2380,845
  arrive pier_end 720,830
  footsteps stone
  # The two quay lamps, the lighthouse lamp and the warm windows of the house at the right.
  light 682,205 radius 150 lantern
  light 1102,382 radius 110 lantern
  light 380,345 radius 90 lantern
  light 1940,352 radius 55 lantern
  light 2190,470 radius 100 lantern
  beacon 380,345 period 14
  # The sea lying along the left of the quay, under the breakwater and the lighthouse.
  water (0,560) (440,560) (540,616) (556,646) (0,716) ripple 1.8
  emit lapping at 200,700

  # First sight of the water from the quay: the harbour behind, the mouth ahead.
  scene if not quay_seen
    set quay_seen
    say "The water opens here. The harbourmaster's house behind me, the pier and the lighthouse ahead."

  # The path runs on under the first lamp, along the waterfront, out toward the harbour mouth:
  # a warm pool and a trail of reflections leaving the left of the frame.
  hotspot harbour_mouth "the harbour mouth"
    area 560,640 230x215
    stand 720,830
    exit pier_end sound none
    look "The stone quay runs out along the water. Past the last lamp is the harbour mouth."
    open "I walk out along the quay toward the harbour mouth."

  # The same path runs back under the second lamp toward the harbour boards at the right edge,
  # where the house lights and the ship's reflections lead off-frame.
  hotspot harbour "the harbour"
    area 2280,735 260x145
    stand 2380,845
    exit dock sound none
    look "The boards run back past the harbourmaster's house to the harbour. The Marrow is tied up beyond it."
    open "I follow the boards back into the harbour."

  hotspot lighthouse "the lighthouse"
    area 290,250 180x290
    nowalk
    look "The lighthouse on the point. It burns for the harbour mouth, and for anyone still coming home."

  hotspot marrow "the Marrow's bow"
    area 1120,300 420x310
    nowalk
    look "The Marrow's bow, high above the boards. Her gear is aloft, as if she were leaving."
`,Sl=`room reef_wreck "The Sunken Wreck"
  bg bg_reef_wreck_v2b_wide
  width 2560
  backdrop "brightness(0.64) saturate(0.95) contrast(1.04) lift(0.01)"
  music music_fog
  ambience sea
  # The plate is the Shroud at night already: only the figures need the same cold, flat key.
  grade "saturate(0.62) brightness(0.86) contrast(0.99)"
  perspective horizon 440 ref 875 height 300
  walk (760,878) (780,842) (1050,828) (1350,820) (1650,818) (1950,822) (2250,832) (2500,844) (2520,878)
  entry 1150,845
  # Arrivals sit by the thing you came through: the longboat from the flats, the east flats
  # from the camp. (The old \`arrive arcadia_cabin\` stub went with the old hatch layout; the
  # cabin is now entered from the Grey Lantern's deck, and nothing exits to the wreck from it.)
  arrive lagoon_shore 820,846
  arrive salt_camp 2400,848
  footsteps sand
  water (1180,640) (1750,640) (1820,760) (1800,862) (1200,862) ripple 1.8
  water (0,560) (700,560) (720,660) (0,680) ripple 1.2
  haze 300 470 floor 520 alpha 0.12 speed 12
  haze 520 700 floor 810 alpha 0.08 speed 7 tint "#c5d1dc"
  # A thin bank in front of the crew as well as behind them, so the figures sit in the fog
  # rather than on top of it.
  haze 640 760 floor 872 alpha 0.09 speed 4 tint "#bcc9d6"
  # The green masthead glow, the brass nameplate's dull glint and the camp fire east of the
  # reef are the three lit things in the room.
  light 1540,150 radius 200 lantern colour "#7fe8b0"
  light 1580,468 radius 40 lantern
  light 2220,520 radius 95 fire
  emit lapping at 1500,790
  emit creak at 1500,500

  # Act III: an old victim of the Grey Lantern, still on the reef. Hobb hears the bell across
  # the flats on the way in; a grey bow timber from the Lantern is jammed in the wreck, with
  # Mordant's brass plate still on it.
  scene if act 3 and not wreck_bell
    set wreck_bell
    say "The wreck leans out of the water, older than anything I have sailed past."
    say "Hobb stops at her hull and puts one hand flat on the wood."
    say "Then, from across the flats, a bell rings."
    say "Three notes, then one. Then the same again, slow and steady."
    say "Hobb lifts his head. \\"That's Tam,\\" he says. He does not sound surprised."
    say "Quill looks at me. Neither of us asks him how he knows."
    note bell_tam "The bell across the flats rings three, then one. Hobb says it is his brother Tam."

  # The east way to the camp sits at the frame's right edge, out of the entry frame. One nudge,
  # once, the first time the wreck is re-entered after the bell.
  scene if act 3 and wreck_bell and not nudge_camp_east
    set nudge_camp_east
    say "East of the wreck the reef flattens into shallow water, and the tracks go on out of sight."
    say "Dorrit is looking that way already. \\"If there are people out there,\\" he says, \\"they will have a pot.\\""

  # Staggered off one line: Quill near the longboat in the foreground, Hobb under the wreck's
  # bow, Vex out on the wet sand, Dorrit away east on the trodden path. Sizes follow depth.
  sprite npc_quill_body at 820,848 size 1 idle speaker quill for quill
  sprite npc_hobb_body at 1050,830 size 1 idle speaker hobb for hobb
  sprite npc_vex_body at 1780,832 size 1 idle speaker vex for vex
  sprite npc_dorrit_body at 2280,846 size 1 flip idle speaker dorrit for dorrit

  hotspot shallows "the shallows"
    area (0,520) (780,520) (800,700) (0,720)
    stand 900,846
    look "Shallow water over pale sand, all the way out to the fog."
    talk "I say my father's name out over the water. The flats do not pass it on."
    use "I could wade. The flats go on further than the light does."

  hotspot bell "the bell"
    area (0,460) (1000,460) (1000,560) (0,560)
    nowalk
    look "A ship's bell, ringing somewhere out on the flats. There is no ship out there to ring it."
    talk "I call back across the water. The bell keeps its time and does not answer."
    use "I would need a boat and a very good reason. I have one of each."
    state if bell_plan
      look "The bell, three and one. Hobb says the hand on the rope is his brother's."
    state if wreck_bell
      look "The bell again, three and one. It is coming from further out than the wreck."

  hotspot wreck "the wreck"
    area 840,30 1040x620
    stand 1250,838
    look "The old wreck, heeled over on the coral. Her name went with her crew."
    talk "I knock on her hull. The sound goes in and does not come back."
    use "Her deck is above the water at low tide. The way up is the broken rail."
    pickup "I would need a bigger satchel and a smaller wreck."

  hotspot nameplate "the nameplate"
    show if act 3
    area 1518,412 165x105
    stand 1450,840
    look "A brass plate on a grey bow timber jammed in the wreck, green with salt. The engraving is worn too smooth to read from this distance."
    use "The plate is nailed fast. Hobb has the hands and the patience."
    talk "I spell out what I can. Hobb does not need me to read it."
    state if has nameplate
      name "the bare timber"
      look "The bare wood where the plate was. Hobb worked it loose and wrapped it in rag."

  # The painted longboat, bow at (200,850) and stern at (960,820), oars shipped above her.
  hotspot boat "the longboat to the flats"
    area (120,540) (160,512) (360,500) (520,520) (575,560) (570,642) (400,660) (240,650) (140,620)
    stand 790,856
    exit lagoon_shore sound none
    look "The longboat, pulled up on the coral. Quill rowed. I sat in the stern and tried to look like ballast."
    open "We row back to the flats. Quill lets me take an oar until she hears me use it."
    use "We row back to the flats. Quill lets me take an oar until she hears me use it."

  # The way east is the shallow reef flat at the frame's right edge; there is no painted trail
  # there (art gap), so the whole walkable corner is the target.
  hotspot salt_flats "the camp path east"
    show if act 3
    area (2080,470) (2300,470) (2400,560) (2520,650) (2520,880) (2300,880) (2200,720) (2100,600)
    stand 2430,852
    exit salt_camp sound none
    look "The flats run east, out of sight of the wreck. Somebody has walked this way before."
    open "I head east across the flats, away from the water."

  hotspot quill "Quill"
    show if act 3
    area 776,560 92x290
    stand 760,846
    look "Quill has the oars over her shoulder and no intention of putting them down."
    talk "She says, \\"Say the word and I will row you back. I am not saying it twice.\\""
    give "She shifts the oars. \\"My hands are full. Ask me when I am not rowing.\\""

  hotspot hobb "Hobb"
    show if act 3
    area 1008,526 96x300
    stand 970,842
    look "Hobb, one hand on the wreck. He is listening to the flats."
    talk "He holds up a hand for quiet. Then he points out across the water."
      talk hobb at bell
    give "He looks at it, then at the wreck. \\"Not now. I have work.\\""
    state if bell_plan
      look "Hobb is coiling a length of old rope. He has already chosen his end of the ship."
      talk "He ties the coil and puts it over his shoulder. \\"The bell is mine.\\""
        talk hobb at plan_after

  hotspot dorrit "Dorrit"
    show if act 3
    area 2218,542 136x304
    stand 2180,850
    look "Dorrit, out ahead of us, looking east. He has found something he does not like."
    talk "He says, \\"There are tents out there. Tents mean people. People mean they eat.\\""
    give "He does not look at it. \\"Unless it is food, keep it dry.\\""

  hotspot vex "Vex"
    show if act 3
    area 1736,550 104x282
    stand 1700,846
    look "Vex, on the rocks with his coat around him. He is in no hurry to move."
    talk "He says, \\"I have been in worse. Not often, and not with this crew.\\""
      talk vex at wreck
    give "He waves it away. \\"I have a coat and a bad reputation. That is luggage enough.\\""

  use compass on wreck
    "The needle points at the hull, then down, at whatever is left of her under the water."
  use crowbar on nameplate
    "Hobb takes the crowbar out of my hand. \\"Hobb has the hands for it. Ask him.\\""
`,Ml=`room salt_camp "The Castaway Camp"
  bg bg_salt_camp_v2b_wide
  width 2560
  backdrop "contrast(1.04) saturate(0.84) brightness(1.12) tone(0.3)"
  music music_fog
  # The plate is the camp at night already: a cold blue-grey salt sheen with two warm lamps.
  # The crew takes the same cold, flattened grade, so nobody reads as a warm cut-out.
  grade "saturate(0.78) brightness(0.92) contrast(0.98)"
  perspective horizon 480 ref 875 height 260
  walk (40,878) (90,838) (400,826) (900,818) (1400,812) (1900,812) (2350,820) (2500,840) (2520,878)
  entry 1500,845
  # The two ways off the camp are both west and both out of the entry frame: the shore to the
  # wreck (near) and the pan bank to the far flats (further out). Arrivals sit by each.
  arrive reef_wreck 250,852
  arrive far_pans 560,850
  footsteps sand
  water (0,560) (700,560) (700,660) (0,660) ripple 1.0
  water (780,600) (1180,600) (1180,680) (780,680) ripple 1.0
  haze 300 470 floor 560 alpha 0.18 speed 6 tint "#b3c2ce"
  haze 620 780 floor 830 alpha 0.08 speed 4 tint "#a7b7c3"
  # Two lamps on the west tracks, the brazier and the lamp over the hut door: the ways out and
  # the one lit doorway all stand on painted flames.
  light 170,830 radius 120 fire
  light 180,340 radius 100 lantern
  light 520,380 radius 90 lantern
  light 1790,560 radius 95 fire
  light 1965,300 radius 80 lantern
  emit lapping at 160,580

  # Act III. The crew comes ashore on the fog rock and finds the camp that has been waiting
  # for them: tents, washing, salt pans, and one man who has been charting the Lantern's road.
  # A staggered camp: Dorrit near the rakes in the foreground, Elias back among the tents,
  # Hobb and Quill at middle depth, Vex out by the store hut. No two share a floor line.
  sprite npc_dorrit_body at 600,846 size 1 idle speaker dorrit for dorrit if act 3
  sprite npc_ansel_body at 1400,720 size 1 idle speaker elias for elias if act 3
  sprite npc_hobb_body at 1560,800 size 1 idle speaker hobb for hobb if act 3
  sprite npc_quill_body at 1750,790 size 1 idle speaker quill for quill if act 3
  sprite npc_vex_body at 2300,842 size 1 idle speaker vex for vex if act 3

  scene if act 3 and not elias_found
    say "The shore runs white into the salt pans. Tents, a line of washing, a hut with its door shut."
    say "Nobody comes out. The washing moves, and that is all."
    say "Then a man stands up from behind the tents. He does not put his work down."
    talk elias at found

  # Both ways off the camp are west, out of the entry frame. One nudge, once, after Elias has
  # given the rules: the shore to the wreck and the pan bank to the far flats.
  scene if act 3 and elias_found and not nudge_camp_west
    set nudge_camp_west
    say "West of the tents the salt runs white to the water. The shore goes back to the wreck; the pan bank goes out to the far flats."
    say "Elias does not look up from the chart. \\"The far flats are a dead end,\\" he says. \\"The wreck is the way back to the gate.\\""

  hotspot pans "the salt pans"
    area 0,450 1150x260
    nowalk
    look "Salt pans, raked into squares. The salt is stacked in white heaps at the corners."
    use "I touch a heap and lick my finger. Salt. It has been here longer than the camp."

  hotspot tents "the tents"
    area 1120,340 700x320
    nowalk
    look "A row of tents, patched with sailcloth. The doors are tied shut from the outside, with a sailor's knot. Someone tied them on the way out."
    talk "I call out. The tents do not answer."

  hotspot washing "the washing"
    area 1580,370 450x150
    nowalk
    look "Shirts on a line, stiff with salt. Somebody washed them for men who did not come back. The pegs are still in."

  hotspot hut "the store hut"
    area 1840,110 580x650
    stand 2000,850
    look "A stout hut with a barred window and a padlock. STORES is painted over the door: salt, rope, lamp oil. A ship's slate is nailed beside it, and one line is still legible: THE BELL CALLED. WE WENT."
      note camp_slate "The camp's slate says the bell called and they went. The tents and the store were shut up tidily from the outside."
    open "The padlock is new. The hut is not. The crews shut it as they left, and it does not open for me."
    talk "I knock. The slate by the door has already answered."
    use "The padlock is new. The crowbar would open it. It is only the camp's store, and the slate has told me enough."

  hotspot pallet "the pallet"
    area 1240,590 180x100
    stand 1350,846
    look "A low wooden pallet, half buried in salt. Somebody sat here to work."
    use "There is a hollow in the salt beside it, the shape of a man who sat too long."

  hotspot rakes "the rakes"
    area 600,470 420x200
    stand 650,850
    look "Two rakes, left where they were put down. The salt has started to grow over them."
    pickup "I would only be taking a rake from a man who is not coming back for it."

  hotspot lagoon "the lagoon"
    area (0,280) (300,280) (300,500) (0,500)
    nowalk
    look "The lagoon, flat and bright. Past it, the fog is a white line."
    talk "I say my father's name to the water. This time he is close enough to hear me."
    use "I would not drink it. The salt has had it first."

  # The plate paints no trail off the camp (art gap): both exits are the open salt at the west
  # edge, one on the near shore, one out across the raked pans. The stands are on the walk.
  hotspot shore_path "the shore to the wreck"
    area (0,700) (300,710) (360,762) (360,880) (0,880)
    stand 160,854
    exit reef_wreck sound none
    look "The shore runs back toward the wreck, white and empty."
    open "I walk back along the shore."

  hotspot pans_path "the path to the far pans"
    show if elias_found
    area (0,500) (300,510) (400,580) (390,660) (0,680)
    stand 300,850
    exit far_pans sound none
    look "The salt pans run on toward the far flats. The shore is open that way."
    open "I walk out along the bank."

  hotspot dorrit "Dorrit"
    area 520,548 180x300
    stand 560,850
    look "Dorrit, with his sleeves rolled up and salt on his boots. He is already planning a meal."
    talk "He is looking at the empty camp as if it has personally offended him."
      talk dorrit at camp

  hotspot elias "Elias Fenn"
    area 1280,430 240x310
    stand 1240,826
    look "A thin man in a coat too big for him. He has been drawing all night."
    talk "He looks up. Then he looks at me properly."
      talk elias at found
    state if rule_name
      name "Elias, my father"
      look "My father, with salt in his beard. He has told me the rules. He looks lighter."
      talk "He has the chart ready. \\"Say the word,\\" he says."
        talk elias at hub
    state if elias_found
      name "Elias, my father"
      look "My father, with salt in his beard. He is still drawing."
      talk "He moves the chart to make room for me."
        talk elias at hub

  hotspot hobb "Hobb"
    area 1480,512 160x300
    stand 1470,846
    look "Hobb, with his back to the camp, looking at the fog."
    talk "He does not turn round."
      say "\\"The bell,\\" Hobb says. \\"I heard it. It's Tam.\\""
      say "He says it the way he says everything. Once."
    state if rule_name
      talk "He is looking at the fog, but he is listening to me."
        say "\\"Cut the bell,\\" he says. \\"Then we bring him home.\\""
        say "He nods. It is the whole speech."

  hotspot quill "Quill"
    area 1702,502 96x300
    stand 1690,842
    look "Quill, with her glass under her arm and salt in her hair. She has been counting the tents."
    talk "She is watching the camp, not me."
      talk quill at camp

  hotspot vex "Captain Vex"
    area 2226,520 148x330
    stand 2280,848
    look "Vex, standing apart from the tents with his coat pulled round him. He has not sat down."
    talk "He sees me coming and does not look away. That is new."
      say "He says: \\"You have heard it by now. I am not going to dress it up.\\""
    state if seen:vex.saw_elias
      talk "He knows I have heard the rest."
        say "\\"I have said my part,\\" Vex says. \\"I am not going to say it better.\\""
        say "Then he looks like Vex again, and asks me about the bell."

  use compass on elias
    "He turns it over. \\"Still pointing at the fog,\\" he says. \\"So am I.\\""
  use compass on quill
    "She holds it up. \\"Still the fog,\\" she says. She does not sound sorry."
  use crowbar on hut
    "The padlock is new. The crowbar would open it. It is only a store, shut up by people who meant to come back. I leave it be."
`,xl=`room tavern "The Salty Keel"
  bg bg_tavern_cinema_wide
  width 2560
  backdrop "contrast(0.9) brightness(1.22) saturate(1.04) lift(0.012)"
  music music_tavern
  ambience tavern
  grade "brightness(0.95) saturate(0.85)"
  # The interior of the Salty Keel: the plank door standing open on the cold blue harbour at
  # the left, the long table under the nets in the middle, the bar and its lamps at the right.
  perspective horizon 300 ref 875 height 440
  # The clear painted aisle: worn boards from the open door at the left across to the bar at
  # the right, in front of the long table and its benches. Every stand and arrival sits on it.
  walk (560,878) (560,850) (580,825) (620,810) (700,800) (800,792) (900,786) (1000,782) (1100,778) (1200,776) (1300,776) (1400,778) (1500,782) (1600,790) (1690,800) (1720,878)
  entry 900,850
  arrive dock 590,840
  footsteps wood
  # The bar lamps, the iron lanterns over the aisle, the cold window's green harbour lamp and
  # the one warm lamp burning outside the open door.
  light 1855,240 radius 120 lantern
  light 2260,218 radius 115 lantern
  light 1450,150 radius 110 lantern
  light 300,390 radius 80 lantern
  light 810,410 radius 55 lantern colour "#79e6a4"
  # The bar counter and the long table are solid painted furniture: whoever stands behind them
  # is repainted over, so the staff read as behind the bar and Rook as at the table. The floor
  # lines sit below the walk band, so Fenn walking past is never covered.
  occluder floor 700 (1700,570) (2560,570) (2560,880) (1700,880)
  occluder floor 700 (1080,545) (1700,545) (1700,880) (1080,880)

  # Staff feet are on the floor behind the counter, so the counter repaints over their legs.
  sprite npc_marta_body_v2 at 2200,640 size 1 visible 0.94 idle speaker marta for marta grade "saturate(0.78) sepia(0.08) brightness(0.85)"
  sprite npc_rook_body at 1220,690 size 1 idle speaker rook for rook grade "saturate(0.75) sepia(0.12) brightness(0.85)"
  sprite npc_dorrit_body at 2020,640 size 1 visible 0.94 flip idle speaker dorrit for dorrit grade "saturate(0.78) sepia(0.08) brightness(0.85)"

  scene if not met_rook
    say "There's an old man at the long table. His drink has gone flat."

  # The bottles are listed before the staff: later hotspots win where they overlap, so the
  # people behind the bar stay clickable even though the shelves are a bigger target.
  hotspot bottles "the bottle shelf"
    area 1920,280 640x290
    stand 1600,830
    look "Bottles, sorted by colour and trouble."
    use "I'd have to reach over the bar. Marta is watching."

  hotspot marta "Marta"
    area 2150,340 250x240
    stand 1600,830
    look "Marta, behind the bar. She's been wiping the same glass since I walked in."
    talk "I catch her eye. It takes some catching."
      talk marta
    give "She only takes things worth trading."
    open "Marta is not a door. She's made that point to better men than me."
    # Once she has said her piece, she does not say it again: the later visits open shorter.
    state if seen:marta.root3 and dorrit_cleared and seen:rook.story
      look "Marta's watching the corner where Rook sits. She's stopped wiping the glass."
      talk: talk marta at cleared
    state if seen:marta.root3 and dorrit_cleared
      talk: talk marta at cleared
    state if seen:marta.root3 and seen:rook.story
      look "Marta's watching the corner where Rook sits. She's stopped wiping the glass."
      talk: talk marta at again
    state if seen:marta.root3
      talk: talk marta at again
    state if seen:rook.story
      look "Marta's watching the corner where Rook sits. She's stopped wiping the glass."

  hotspot rook "old sailor"
    area 1140,380 240x330
    stand 1250,830
    look "An old man at the long table. His mug is full and his eyes aren't."
    talk "He looks up before I speak. He's been waiting."
      talk rook
    give "He waves it away without looking at it."
    state if met_rook
      name "Old Rook"
      look "Rook at the long table against the back wall. He's put the mug down."

  hotspot dorrit "Dorrit"
    area 1850,340 220x280
    stand 1600,850
    look "Dorrit, in his apron, holding a spoon like a small weapon."
    talk "I ask about the stores. He turns before I finish."
      set met_dorrit
      talk dorrit
    give "He looks at my hands. \\"I've no use for it. I've no use for any of it.\\""
    state if met_dorrit
      look "Dorrit, still furious and still cooking. The spoon has not been put down."

  hotspot bar "the bar"
    area 1740,570 820x110
    stand 1600,830
    look "The bar. It's been polished by elbows and one very determined mop."
    use "I'd need money, and Marta's permission. I've neither."
    open "It's a bar, not a crate."

  # The painted harbour door fills the left edge of the tavern: the open leaf, the doorway
  # and the cold blue harbour beyond it, down to the boards.
  hotspot door_out "the door down to the harbour"
    area 60,180 500x560
    stand 620,840
    exit dock
    look "The door down to the harbour. The wind smells of salt and something colder."

  hotspot window "the window"
    area 730,250 190x250
    stand 900,830
    look "The window looks out on the harbour. There's one lamp and a lot of dark."
    use "It doesn't open. Marta says the view is better with the glass in."

  hotspot nets "the nets"
    area 1180,120 400x200
    stand 1300,830
    look "Nets heaped by the door, dry and stiff with salt, and more hung from the beams overhead."
    use "I'd need a boat and a reason."
    pull "The net is tied off. Everything in this room is tied off."

  use compass on rook
    "He turns it over once. \\"Your father's. It still points at the fog.\\""
  use compass on marta
    "She looks at it and gives it back. \\"Keep it. It's the only thing of his you have.\\""
  use compass on dorrit
    "He squints at it. \\"Your father's? Then keep it dry.\\""
  use chart on marta if has chart
    "She reads it upside down and doesn't ask."
  use chart on rook if has chart
    "He knows it. He doesn't want to touch it."
`,Al=`room village "Upper Town"
  bg bg_village_v2_wide
  width 2560
  music music_tavern
  ambience tavern
  grade "saturate(0.84) brightness(0.95)"
  perspective horizon 540 ref 875 height 220
  # The lane's painted cobbles run the full width below the houses; the well, the stair foot and
  # the market stall sit on the far side of this band, so the walk stays clear in front of them.
  walk (60,878) (80,842) (400,832) (800,824) (1200,818) (1600,814) (2000,820) (2300,830) (2520,845) (2520,878)
  entry 760,868
  # The two arrivals are the two painted ways in: the harbour steps at the left, the stair at
  # the right of centre. Stand where the player would come in from each.
  arrive dock 360,858
  arrive weather_works 1620,846
  footsteps stone
  # Every light sits on a painted source: the wall lamp over the steps, the cottage door lamp,
  # the stair lantern, the great lamp and the shrine candles. The two ways out are lit first.
  light 200,320 radius 120 lantern
  light 1120,575 radius 80 lantern
  light 1600,350 radius 120 lantern
  light 1640,85 radius 170 lantern
  light 2080,190 radius 80 candle
  light 860,610 radius 60 candle
  haze 260 520 floor 580 alpha 0.09 speed 4 tint "#c6d2dc"
  haze 620 780 floor 836 alpha 0.05 speed 3 tint "#bcc9d6"

  # Three depths on the lane, not a chorus line: Nell back by the market stall, Tam at the
  # stair foot, Onn forward at the well. Each stays over its own hotspot.
  sprite npc_nell_body at 2130,844 size 1 idle speaker nell for nell grade "saturate(0.85) brightness(0.9)"
  sprite npc_tam_body at 1500,848 size 0.8 idle speaker tam for tam grade "saturate(0.85) brightness(0.9)"
  sprite npc_onn_body at 900,856 size 1 idle speaker onn for onn grade "saturate(0.8) brightness(0.86)"

  scene if seen:marta.father and not village_father_room
    set village_father_room
    say "The window over the Salty Keel's back door. My father's room. The shutters are open and the lamp is out."

  # The two ways out are painted into opposite ends of this lane: the harbour steps at the left
  # edge below the well, and the broad stair to the light climbing out between the houses.
  scene if not village_way_out_seen
    set village_way_out_seen
    say "The harbour steps drop away past the well on the left, and the stair to the light climbs out between the houses at the far end of the lane."

  hotspot nell "Nell"
    area 2050,610 140x250
    stand 2040,850
    look "Nell, beside a stall of rope and dried fish. She's already decided what I'm going to buy."
    talk "She looks at me the way she looks at weather."
      talk nell
    give "She takes goods, not charity."
    open "Nell is not a stall, though she has been mistaken for one."

  hotspot onn "Old Onn"
    area 840,685 120x190
    stand 860,854
    look "An old woman sweeping cobbles that were already clean."
    talk "She stops sweeping before I say anything."
      talk onn
    give "She waves it away. She's done taking things from this harbour."
    open "She is not a door, and she'd have something to say about being asked."

  hotspot well "the well"
    area 540,540 290x270
    stand 900,850
    look "A stone well with a windlass and a bucket. The water down there is older than the harbour."
    use "I draw a bucket. It's cold and tastes of stone. Best thing I've had all night."
    pull "The windlass turns. Somewhere below, a bucket fills."

  hotspot stalls "market stalls"
    area 2200,440 360x340
    stand 2280,850
    look "Rope, lamp oil, dried fish. Everything a ship needs and nobody is buying."
    use "I've no money and no need. Two things that rarely arrive together."

  hotspot shrine "the shrine"
    area 770,455 200x230
    stand 1010,850
    look "A niche with a painted figure and a shelf of candle stubs. Somebody still lights them."
    use "I put a coin in the box. It's the least I can do, and it is exactly that."
    open "The niche is open, as niches are."
    pull "I'm not going to rifle a shrine."

  hotspot washing "washing line"
    area 1780,290 380x120
    nowalk
    stand 1900,850
    look "Ten shirts on a line between two houses. Somebody is still washing for men who aren't coming home."
    state if seen:onn.crew
      look "Ten shirts on the line. Onn counted ten men off this street. Somebody still washes for them."

  hotspot cottages "the houses"
    area 1850,150 450x310
    nowalk
    stand 2000,850
    look "The houses lean on each other. Half the windows are dark, and it isn't late."

  hotspot father_room "the window above the back door"
    area 2140,140 80x160
    nowalk
    stand 2140,850
    look "A window over a back door. The shutters are open and the lamp is out."
    use "The window is shut. The back door below is bolted from the inside."
    open "The window is shut. The back door below is bolted from the inside."
    state if seen:marta.father
      name "the room above the tavern"
      look "My father's room, over the Salty Keel's back door. The shutters are open and the lamp is out."

  # The lane runs out of frame at the left below the well: those painted steps are the way down.
  hotspot steps_down "the steps down to the harbour"
    area (0,510) (210,510) (300,560) (360,620) (360,878) (0,878)
    stand 300,856
    exit dock sound none
    look "The top of the steps down to the harbour. The lamps are on and the street is empty."

  # The stair to the light climbs out between the shrine cottage and the tall house on the right.
  hotspot light_path "the lane up to the light"
    area (1450,470) (1780,470) (1790,690) (1700,720) (1450,720)
    stand 1620,850
    exit weather_works sound none
    look "A broad stone stair between the houses, climbing towards the lighthouse."

  # Tam stands at the stair foot, inside the light-path area's lower corner. Defined after the
  # exit so the boy wins that overlap; the stair itself stays clickable above and to his right.
  hotspot tam "Tam"
    area 1470,690 80x170
    stand 1540,850
    look "A boy in a cap two sizes too big, counting something under his breath. He's always counting."
    talk "He's already turned round. He was waiting for someone to talk to."
      talk tam
    give "He looks at my hands and decides they're empty."
    open "He is not a cupboard. He'd probably fit in one."

  use compass on tam
    "He holds it to his ear like a shell. \\"It doesn't point north.\\""
  use compass on onn
    "She doesn't take it. \\"Keep your father's things, child.\\""
`,El=`room warehouse "The Boat Shed"
  bg bg_warehouse_restart_wide
  width 2560
  backdrop "contrast(0.9) brightness(1.22) saturate(1.04)"
  music music_office
  grade "brightness(0.98) saturate(0.9)"
  # The boat shed as a full-bleed painting: the longboat slung from the roof beams in the
  # centre, the workbench and tool wall under the warm work lamp at the left, and the wide
  # boat-shed door at the right open on cold blue fog and the harbour lights. No signs, no
  # lettering. The cold doorway is the way out; the broad plank floor below it is the walking
  # lane.
  perspective horizon 250 ref 875 height 400
  # Measured from the painted workbench (top y 570, floor y 720): an adult is about 400 px at
  # the bench and 495 px at the near floor row. The boat is slung above the floor, so the bench
  # stays at waist height rather than a person's chin.
  scale 760 425
  scale 875 495
  walk (60,872) (80,846) (200,830) (500,822) (900,818) (1300,816) (1700,816) (2000,818) (2250,822) (2420,830) (2520,846) (2520,872)
  entry 2160,850
  arrive alley 2160,850
  footsteps wood
  # The painted work lamp over the bench, the red lantern by the door, and the cold fog light in
  # the boat-shed doorway. Dust hangs in the doorway's light.
  light 575,215 radius 230 lantern
  light 1840,290 radius 100 lantern colour "#ff7048"
  light 2070,360 radius 340 moon
  motes dust (1860,160) (2300,100) (2400,650) (1950,680) count 40
  # The left-hand stores and the crates beside the door are solid: whoever stands behind them
  # is repainted over. The walking lane is in front of their floor lines.
  occluder floor 860 (0,660) (300,660) (300,880) (0,880)
  occluder floor 860 (2360,640) (2560,640) (2560,880) (2360,880)

  scene if act 1 and not boat_shed_arrived
    set boat_shed_arrived
    say "The boat shed. The island's stores in the dark, and one stack turned wrong."

  # The workbench under the warm lamp: the desk of the room, now at the left of the longboat.
  hotspot desk "the desk"
    area 300,570 420x150
    stand 490,848
    look "A desk in a boat shed: a candle, three books, and a week of dust."
    open "The drawer is empty except for a fish hook and a smell of salt."
    use "The candle is fresh. Somebody has been sitting here."

  # The rolled charts and ledgers propped at the right end of the bench.
  hotspot books "the books"
    area 540,520 140x100
    stand 640,846
    look "Three books, swollen with damp. The top one is a book of sea stories."
    use "The pages are stuck together. The story is about a ship that came back."

  # The lumber, rope and barrels stacked against the left wall, with the gap behind them.
  hotspot stores "the stores"
    area 0,560 300x300
    stand 330,854
    verb talk
    look "The boat shed's stores: crates, barrels, salt beef. One corner is stacked wrong."
    use "I count what's left. Dorrit has already counted it twice."
    talk "I knock on the top crate."
      talk dorrit at thief
    state if seen:dorrit.confess
      look "The stores, stacked wrong at the corner. The gap behind them is empty now."
      talk "There's nobody behind the stores. The thief has gone."

  # The crates beside the lane door, one of them opened and closed again.
  hotspot crates "the crates"
    area 2380,640 180x240
    stand 2320,850
    look "Three crates, stacked neat. The top one has been opened and closed again."
    use "The nails are new. Somebody has been at this stack in a hurry."

  # The longboat herself, slung from the roof and opened at the ribs: the room's centrepiece.
  hotspot longboat "the longboat"
    area 800,220 980x460
    stand 1200,845
    look "The longboat, slung from the beams and opened at the ribs. Somebody is rebuilding her a plank at a time."
    use "I run a hand along the new planking. It is sound, and it is not for me."

  hotspot hoist "the hoist"
    area 1240,0 160x220
    nowalk
    look "A block and tackle. The rope is new, and the hook is still swinging."
    use "I give the rope a pull. Something in the loft shifts and settles."

  # The cold fog-lit boat-shed doorway at the right: the painted threshold boards run out under
  # the opening, and the stand is on the dry planks just inside it.
  hotspot lane_door "the lane door"
    area 1900,150 380x530
    stand 2160,850
    exit alley sound hatch
    look "The lane door, open on the fog. Cold harbour light comes through."
`,Cl=`room weather_works "The Lighthouse"
  bg bg_weather_works_v2b_wide
  width 2560
  music music_fog
  # The plate is already the Shroud's cold night: only the figures need a touch of the same key.
  grade "saturate(0.82) brightness(0.94)"
  ambience wind
  perspective horizon 520 ref 875 height 240
  # The wet flagstone yard crosses the whole foreground of the headland, from the lamp-lit path
  # down at the left edge to the rock shelf below the tower; the walk is the clear painted band.
  walk (30,878) (40,834) (240,820) (520,812) (820,805) (1100,798) (1320,800) (1420,815) (1440,878)
  entry 800,845
  arrive village 330,846
  footsteps stone
  # Every light sits on a painted source: the great lamp, the brazier, the lamp post that marks
  # the way down, and the small lantern over the keeper's open door. The fire basket stands
  # on the flagstones in front of the store (about 685,655 on the plate).
  light 1865,95 radius 240 lantern
  light 685,655 radius 95 fire
  light 90,205 radius 130 lantern
  light 520,540 radius 70 lantern
  motes embers (655,610) (715,610) (715,670) (655,670) count 30
  haze 500 680 floor 700 alpha 0.12 speed 5 tint "#c8d4dc"
  haze 700 850 floor 872 alpha 0.05 speed 3 tint "#bcc9d6"
  emit crackle at 685,655

  scene if seen:rook.book and not weather_works_store
    say "The lighthouse yard. Rook's log should be in the keeper's store, behind the brazier."

  # The painted flagstones are the way down: they run in from the left edge below the store, so
  # the stand is the near end of that paving, not the middle of the yard.
  hotspot path_down "the path down to Upper Town"
    area (0,596) (150,590) (215,620) (220,700) (220,878) (0,878)
    stand 280,850
    exit village sound none
    look "The path down the hill to Upper Town. The wind comes up it, cold."

  hotspot fog "the Shroud"
    area (2080,420) (2560,420) (2560,790) (2140,790) (2080,660)
    nowalk
    stand 1400,845
    look "The Shroud, lying on the water below the headland. It looks like weather. The island knows better."
    talk "I say the island's name into the fog. Nothing answers, which is something."

  hotspot path "the path to the lighthouse"
    area 610,610 700x150
    stand 1060,845
    look "The path climbs the headland to the lighthouse door. Wet flagstones, and the wind coming up them."
    use "It goes up. It also goes down. I know which way I came."

  hotspot lighthouse "the lighthouse"
    area 1660,30 340x600
    stand 1400,845
    look "The lighthouse. Stone on stone, and a lamp lit at the top of it. From the sea it must look like the only thing holding the dark up."
    talk "I talk to the tower. It has heard worse from the wind."
    use "The door at the base is barred. The keeper is up top, where the light is."

  hotspot light "the great lamp"
    area 1770,30 170x140
    stand 1400,845
    look "The great lamp, burning behind its glass. The keeper trims it twice a night, and has never once been late."
    talk "I say nothing to the light. It has enough to do."
    use "The glass is warm from the other side. I leave it alone."

  hotspot store "the keeper's store"
    area 320,215 600x480
    stand 850,845
    look "The keeper's store, behind the brazier. Rook's old log is on the shelf behind the brazier. I could take it."
      note rook_log "Rook's old log is in the keeper's store at the lighthouse. The last page is a list of names."
    use "I take the log down. The keeper can have it back when Rook has read it."
      note rook_log "Rook's old log is in the keeper's store at the lighthouse. The last page is a list of names."
      set weather_works_store
    open "The store door is open. I take Rook's log from the shelf."
      note rook_log "Rook's old log is in the keeper's store at the lighthouse. The last page is a list of names."
      set weather_works_store
    state if weather_works_store
      look "The shelf where Rook's log sat is empty. The keeper will have questions."
      use "I have what I need. The keeper can keep the shelf."
      open "I have what I need."

  hotspot brazier "the brazier"
    area 625,630 125x85
    stand 690,845
    look "The brazier at the keeper's door, heaped with kelp. It throws more smoke than light."
    use "I'd only add to the smoke."
    turnoff "There's no lid and no switch. The sea is a long walk down."
    pickup "Absolutely not."
`,Hl=`# Tips: what to do next. The first entry whose conditions hold is the current tip, so Act I
# runs from its last step back to its first. Shown by H or the Tip button.
#
# Two rungs: the nudge points at the person, place or idea; asking again gives the plain line,
# which says exactly what to do. The compass's look (items.adv) nudges in character.
#
# The Act I flags below are set by the conversations and rooms that earn them (the harbour,
# the tavern, the town and the cast branches); this file only reads them.
#
# Act II reads the ship flags its rooms and scenes set: fog_tried and rule_light in bow_fog,
# salvage_seen below decks, vex_exposed and marrow_lost at the helm. Act III reads the fog
# flags its first scene and rooms set: stranded on the flats, bell_plan at the wreck,
# elias_found and rule_name at the camp, lantern_boarded at the reef gate. Act IV reads the
# three holds the deck and the captain's cabin set (bell_cut, lantern_doused, name_spoken).
# The ending flags (curse_broken, escaped_fog) have no rung: the closing card follows the choice
# at once. tools/test-scripts.mjs (3c) fails a rung that no reachable state can ever show.

# Act I — the last step: a crew, a chart and a ship. Quill only counts once she has actually
# joined (\`seen:quill.join\`): her compass being in hand is not the same as her saying yes, and
# Vex will not appear at the pier until she has.
tip if act 1 and vex_deal and dorrit_cleared and quill_compass and seen:quill.join and rook_story and hobb_joined
  nudge "The crew is aboard, the chart is drawn, and the ship is waiting on one captain."
  "Go to the harbour mouth at the end of the pier and talk to Vex."

# Hobb: the mast still wants a carpenter.
tip if act 1 and vex_deal and dorrit_cleared and quill_compass and rook_story and not hobb_joined
  nudge "The Marrow has a captain, a navigator and a cook. She has no carpenter."
  "Pick up the crowbar from the counter at the shipwright's, off Wreckers' Lane, and use it on the seized mast band to win Hobb over."

# Rook: the log is fetched, and still has to be brought back.
tip if act 1 and vex_deal and dorrit_cleared and quill_compass and not rook_story and weather_works_store
  nudge "Rook's log is in my coat, and Rook is still at the Salty Keel."
  "Take Rook's log to him at the Salty Keel."

# Rook: the log is at the lighthouse.
tip if act 1 and vex_deal and dorrit_cleared and quill_compass and not rook_story
  nudge "Rook came back from the fog when nobody else did. His old log is still at the lighthouse."
  "Fetch Rook's log from the lighthouse and bring it to him at the Salty Keel."

# Dorrit: cleared, but not yet told.
tip if act 1 and rudder_back and not dorrit_cleared
  nudge "Pike's story has cleared Dorrit. Nobody has told him yet."
  "Tell Dorrit he's cleared. He's in the Salty Keel."

# Vex: the rudder is back, so he has no more excuses.
tip if act 1 and rudder_back and dorrit_cleared and not vex_deal
  nudge "Vex named a price, and you have met it."
  "Take the rudder back to Vex at his warehouse."

# Quill: her compass is back from Vex.
tip if act 1 and vex_deal and not seen:quill.join
  nudge "Vex has given up the compass. Quill still hasn't agreed to sail."
  "Take Quill's compass to her at the shipwright's, off Wreckers' Lane."

# The thief has talked; the word still has to reach Pike.
tip if act 1 and met_vex and not rudder_back and seen:dorrit.confess
  nudge "The man behind the crates has talked. Pike is the one who can return the rudder."
  "Take the thief's word to Pike in Wreckers' Lane."

# The rudder: Vex's price, and Pike has it.
tip if act 1 and met_vex and not rudder_back
  nudge "Vex wants his rudder. Marta wants Dorrit cleared. One shed in Wreckers' Lane answers both."
  "Search the boat shed for the real thief, then take his word to Pike."

# Act I — the first step.
tip if act 1
  nudge "The harbourmaster knows the harbour. The tavern keeper knows the island. The last captain has the only ship."
  "Talk to Bramwick or Marta about a ship, and Vex has the only one: his warehouse."

# Act II — the ship, the first fog, the hold and the captain's last lie. The ladder runs from
# the last step back to the first, so the most advanced flag state wins.

# (marrow_lost is set by the scene that ends Act II, so no tip is ever asked while it holds.)

# Vex has stopped lying and started sailing deeper. He is at the helm, not on the main deck:
# the next move is to say it to his face, from the quarterdeck.
tip if act 2 and vex_exposed and not marrow_lost and room marrow_quarterdeck
  nudge "Vex has stopped explaining. He has the helm and he is not turning back."
  "Talk to Vex at the helm and tell him to turn back."

tip if act 2 and vex_exposed and not marrow_lost
  nudge "Vex has stopped explaining. He has the helm and he is not turning back."
  "Go up to the helm and tell Vex to turn back."

# The hold: the crew has seen the salvage, and Vex is at the helm.
tip if act 2 and salvage_seen and not vex_exposed
  nudge "Every crate below has a ship's name on it. Vex is at the helm, steering around the question."
  "Confront Vex at the helm about the salvage."

# The fog has answered. Get off the foredeck first.
tip if act 2 and fog_tried and rule_light and room bow_fog
  nudge "The bow is quiet. The bell is quiet. That is not the same as safe."
  "Go aft to the main deck."

# The fog hunts light and sound now, and the hold is the next answer.
tip if act 2 and fog_tried and rule_light and not salvage_seen
  nudge "The fog hunts light and sound now, and Vex is carrying something he did not declare."
  "Go below decks and look in the hold."

# Act II — the first step. Vex has the helm and a heading.
tip if act 2
  nudge "The crew is finding their places, and Vex has the helm. He wants to run her to the edge of the Shroud."
  "Talk to Vex on the quarterdeck."

# Act III — the fog flats, the wreck, the castaway camp and the reef gate. The ladder works
# whichever way round the player finds Hobb and Elias: a missing piece always has a next step.

# The plan and the name are both in hand.
tip if act 3 and bell_plan and rule_name and not lantern_boarded
  nudge "A bell to cut, a light to douse, a name to say. The tide is with us."
  "Go to the reef gate and board the Grey Lantern."

# The name without the bell.
tip if act 3 and rule_name and not bell_plan
  nudge "Elias has given us the name. Hobb has heard the bell, and has not yet said what he means to do about it."
  "Go back to the wreck and tell Hobb what Elias said."

# Elias is alive; the rules are still in his head.
tip if act 3 and elias_found and not rule_name
  nudge "My father is alive and bent over his chart, and the rules are still in his head."
  "Talk to Elias again at the castaway camp."

# Hobb has heard the bell; Elias has not been found.
tip if act 3 and bell_plan and not elias_found
  nudge "Hobb has heard his brother's bell. Nobody has told my father."
  "Go through the wreck to the castaway camp and find Elias."

# Act III — the first step. Stranded on the flats (the opening scene sets \`stranded\` at once):
# the wreck is the first stop.
tip if act 3 and not bell_plan and not elias_found
  nudge "The crew is ashore, and the wreck is lying open on the reef."
  "Go to the sunken wreck and find Hobb."

# Act IV — the Grey Lantern. Three holds remain (the bell, the great lantern, the name), and
# then Mordant. The order here is the order the deck teaches: bell first, then the light, then
# the name. Every state has a next step, nudge first.

# (curse_broken and escaped_fog are ending flags: the closing card follows the choice at once, and
# a save never carries them, so no tip is ever asked while they hold.)

# All three holds are done and the name is spoken: Mordant is waiting in the cabin.
tip if act 4 and bell_cut and lantern_doused and name_spoken
  nudge "Mordant is in his cabin, and he has not raised his voice once."
  "Talk to Mordant in the captain's cabin."

# The bell and the lantern are done; the name is the last hold. The plate is already in the
# satchel: it has to be set down on Mordant's desk, not found.
tip if act 4 and bell_cut and lantern_doused
  nudge "The bell is quiet and the great lantern is out. One thing is left."
  "Set Mordant's nameplate on his desk in the captain's cabin."

# The bell first: Hobb and Tam are at the rope. This holds even if the name was spoken early
# (Mordant sends us back: not yet), so the next step is always on the deck.
tip if act 4 and not bell_cut
  nudge "Hobb has gone for the bell. Tam is the hand on the rope."
  "Use the crowbar on the bell in the rigging, on the deck of the Grey Lantern."

# The bell is cut; the canvas is already in hand.
tip if act 4 and has lantern
  nudge "The great lantern is still burning, and the oiled canvas is in my hands."
  "Use the oiled canvas on the great lantern."

# The bell is cut; the great lantern still burns at the stern.
tip if act 4
  nudge "The bell is cut, but the great lantern is still burning at the stern."
  "Ask Quill for the oiled canvas, then use it on the great lantern."
`,ca=["click","pickup","chime","deny","door","gulls"],Nl=["open","close","push","pull","walk","pickup","talk","give","use","look","turnon","turnoff"],Nt=n=>Object.keys(n),Ll=Nt({lantern:!0,candle:!0,lamp:!0,fire:!0,moon:!0}),$l=Nt({dust:!0,embers:!0,steam:!0,glints:!0}),Dl=Nt({wood:!0,deck:!0,stone:!0,sand:!0,earth:!0}),Rl=Nt({crackle:!0,lapping:!0,drip:!0,creak:!0}),ql=Nt({door:!0,hatch:!0,stairs:!0,none:!0}),oo=new Set(["brightness","contrast","saturate","sepia","grayscale","hue-rotate","invert","opacity","tone","lift","tint"]);function Pl(n,e="grade"){const t=n.trim();if(t===""||t==="none")return null;const a=/\s*([a-z-]+)\(\s*([^)]*?)\s*\)\s*/gy;let o=0;for(let s=a.exec(t);s;s=a.exec(t)){o=a.lastIndex;const[,i,r]=s;if(!oo.has(i))return`'${i}' isn't a colour filter (${[...oo].join(", ")})`;if(i==="tone"||i==="lift"||i==="tint"){const u=i==="tint"?"grade":"backdrop";if(e!==u)return`${i}(...) only works in a ${u}, not in a ${e}`;if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(r))return`${i}(${r}) needs a plain number${i!=="tint"?` from 0 to 1, like ${i}(0.3)`:" (a hue in degrees), like tint(160)"}, with no unit`;if(i!=="tint"&&(Number(r)<0||Number(r)>1))return`${i}(${r}) must be between 0 and 1`;continue}const h=/^(-?\d+(?:\.\d+)?|-?\.\d+)(%|deg|rad|turn|grad)?$/.exec(r);if(!h)return`${i}(${r}) needs one number, like ${i==="hue-rotate"?"hue-rotate(195deg)":`${i}(0.8)`}`;const l=h[2];if(i==="hue-rotate"){if(!l&&Number(h[1])!==0)return`hue-rotate needs a unit: hue-rotate(${h[1]}deg)`;if(l==="%"||l==="grad")return`hue-rotate takes deg, rad or turn, not ${l}`}else{if(l&&l!=="%")return`${i} takes a number or a percentage, not ${l}`;if(Number(h[1])<0)return`${i} can't be negative`}}return o!==t.length?`can't read the filter from '${t.slice(o)}': write functions like "saturate(0.8) brightness(0.9)"`:null}class mn extends Error{constructor(e,t){super(t),this.loc=e}}const Ol=/[A-Za-z_]/,Wl=/[A-Za-z0-9_:.]/;function Fl(n,e,t,a){const o=[];let s=a;const i=(r,h)=>{throw new mn({file:n,line:e,col:r+1},h)};for(;s<t.length;){const r=t[s];if(r===" "||r==="	"){s++;continue}if(r==="#")break;const h=s;if(r==='"'){for(s++;s<t.length&&t[s]!=='"';)s+=t[s]==="\\"?2:1;s>=t.length&&i(h,"unterminated string"),s++;let c;try{c=JSON.parse(t.slice(h,s))}catch{c=i(h,"bad escape in string")}o.push({t:"str",v:c,col:h+1,end:s+1});continue}const l=/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(?![A-Za-z0-9_])/.exec(t.slice(s));if(l){s+=l[0].length,o.push({t:"size",w:Number(l[1]),h:Number(l[2]),col:h+1,end:s+1});continue}const u=/^-?\d+(?:\.\d+)?(?![A-Za-z_])/.exec(t.slice(s));if(u){s+=u[0].length,o.push({t:"num",v:Number(u[0]),col:h+1,end:s+1});continue}if(Ol.test(r)){for(;s<t.length&&Wl.test(t[s]);)s++;for(;s>h+1&&/[.:]/.test(t[s-1]);)s--;o.push({t:"id",v:t.slice(h,s),col:h+1,end:s+1});continue}const d=t.slice(s,s+2);if(d==="->"||d===">="){s+=2,o.push({t:"p",v:d,col:h+1,end:s+1});continue}if("(),=>:[]".includes(r)){s++,o.push({t:"p",v:r,col:h+1,end:s+1});continue}i(h,`unexpected character '${r}'`)}return o}function Bl(n,e,t){const a={file:n,line:0,indent:-1,toks:[],children:[]},o=[a];return e.split(/\r?\n/).forEach((s,i)=>{const r=i+1;let h=0;for(;h<s.length&&s[h]===" ";)h++;if(s[h]==="	"){t.push({file:n,line:r,col:h+1,message:"indent with spaces, not tabs"});return}let l;try{l=Fl(n,r,s,h)}catch(c){if(c instanceof mn){t.push({...c.loc,message:c.message});return}throw c}if(!l.length)return;for(;o.length>1&&o[o.length-1].indent>=h;)o.pop();const u=o[o.length-1];h%2!==0?t.push({file:n,line:r,col:h+1,message:"indent by two spaces per level (this line has an odd number)"}):h>u.indent+2+(u.indent<0?-1:0)&&t.push({file:n,line:r,col:h+1,message:"indented too far: nest one level (two spaces) at a time"});const d={file:n,line:r,indent:h,toks:l,children:[]};o[o.length-1].children.push(d),o.push(d)}),a.children}class ee{constructor(e){f(this,"i",0);this.ln=e}get toks(){return this.ln.toks}peek(e=0){return this.toks[this.i+e]}done(){return this.i>=this.toks.length}isId(e,t=0){const a=this.peek(t);return(a==null?void 0:a.t)==="id"&&(e===void 0||a.v===e)}isP(e,t=0){const a=this.peek(t);return(a==null?void 0:a.t)==="p"&&a.v===e}loc(e){const t=e??this.peek()??this.toks[this.toks.length-1];return{file:this.ln.file,line:this.ln.line,col:t?this.done()&&!e?t.end:t.col:this.ln.indent+1}}fail(e,t){throw new mn(this.loc(t),e)}next(){const e=this.peek();return e||this.fail("unexpected end of line"),this.i++,e}id(e="a name"){const t=this.peek();return(t==null?void 0:t.t)!=="id"&&this.fail(`expected ${e}`),this.i++,t.v}kw(e){this.isId(e)||this.fail(`expected '${e}'`),this.i++}p(e){return this.isP(e)||this.fail(`expected '${e}'`),this.next()}num(e="a number"){const t=this.peek();return(t==null?void 0:t.t)!=="num"&&this.fail(`expected ${e}`),this.i++,t.v}str(e="a quoted string"){const t=this.peek();return(t==null?void 0:t.t)!=="str"&&this.fail(`expected ${e}`),this.i++,t.v}isStr(){var e;return((e=this.peek())==null?void 0:e.t)==="str"}end(){this.done()||this.fail(`unexpected '${Vl(this.peek())}'`)}}function Vl(n){switch(n.t){case"str":return JSON.stringify(n.v);case"size":return`${n.w}x${n.h}`;default:return String(n.v)}}function Gl(n,e={}){const t={rooms:{},dialogues:{},items:{},tips:[],combos:[],acts:{},ending:null,groups:{},errors:[],locs:new WeakMap},{errors:a,locs:o}=t,s=(w,k)=>(o.set(w,k),w),i=w=>({file:w.file,line:w.line,col:w.indent+1}),r=w=>{try{w()}catch(k){if(k instanceof mn)a.push({...k.loc,message:k.message});else throw k}},h=w=>{w.children.length&&a.push({...i(w.children[0]),message:"nothing can be nested here"})},l=[],u=w=>{const k=w.next();if(k.t==="num"||k.t==="str")return k.v;if(k.t==="id"){if(k.v==="true")return!0;if(k.v==="false")return!1;if(k.v==="unset")return}return w.fail("expected a value: true, false, unset, a number or a quoted string",k)},d=(w,k)=>{const E=k?w.p("("):void 0,R=w.peek(),v=w.num("an x coordinate");w.p(",");const $=w.peek(),A=w.num("a y coordinate"),U=k?w.p(")"):$;return s({x:v,y:A},{file:w.ln.file,line:w.ln.line,col:(E??R).col,end:U.end})},c=w=>{const k=w.peek(),E=[];for(;w.isP("(");)E.push(d(w,!0));E.length<3&&w.fail("a polygon needs at least three points, like (10,20) (30,20) (20,40)");const R=w.toks[w.i-1];return s(E,{file:w.ln.file,line:w.ln.line,col:k.col,end:R.end})},p=w=>{const k=w.peek();if(k||w.fail("expected a condition"),k.t==="p"&&k.v==="(")return g(w);switch(k.t!=="id"&&w.fail("expected a condition, like has rum, not knows_key or aff >= 14"),w.next(),k.v){case"has":return{has:w.id("an item")};case"room":return{room:w.id("a room")};case"act":{if(w.isP("[")){w.next();const v=[w.num("an act number")];for(;w.isP(",");)w.next(),v.push(w.num("an act number"));return w.p("]"),{act:v}}const E=w.num("an act number");if(!w.isP(","))return{act:E};const R=[E];for(;w.isP(",");)w.next(),R.push(w.num("an act number"));return{act:R}}case"not":return w.isId("has")?(w.next(),{notHas:w.id("an item")}):w.isP("(")||w.isId("act")||w.isId("room")?{not:p(w)}:{flag:w.id("a flag"),is:!1};case"and":case"or":return w.fail(`'${k.v}' needs a condition before it`,k)}return w.isP("=")?(w.next(),{flag:k.v,is:u(w)}):w.isP(">=")?(w.next(),{flag:k.v,atLeast:w.num()}):{flag:k.v}},g=w=>{w.p("(");const k=[p(w)];let E=0;for(;w.isId("or");)w.next(),E++,k.push(p(w));return w.isId("and")&&w.fail("only 'or' can join conditions inside parentheses"),w.p(")"),E?{any:k}:k[0]},m=w=>{const k=[p(w)];for(;w.isId("and");)w.next(),k.push(p(w));return w.isId("or")&&w.fail("wrap 'or' conditions in parentheses: (a or b)"),k},b=w=>{if(w.isId("if"))return w.next(),m(w)},y=(w,k,E)=>{const R=w.peek(),v=w.id(`${E} (${k.join(", ")})`);return k.includes(v)||w.fail(`no ${E} '${v}' (${k.join(", ")})`,R),v},_=(w,k,E,R)=>{const v=w.peek(),$=w.num(k);return E($)||w.fail(`${k} must ${R}`,v),$},x=(w,k)=>_(w,k,E=>E>0,"be more than 0"),T=w=>{const k=w.peek(),E=w.str('a colour in quotes, like "#ffb060"');return/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(E)||w.fail(`a colour is written "#rgb" or "#rrggbb", not ${JSON.stringify(E)}`,k),E},N=(w,k="grade")=>{const E=w.peek(),R=w.str("a CSS filter in quotes"),v=Pl(R,k);return v&&w.fail(v,E),R},C=w=>{if(w.isId("sound"))return w.next(),y(w,ql,"door sound")},D=(w,k=new ee(w))=>{const E=k.peek(),R=k.id("an effect, like say, set, give, take, go, talk or note");let v;switch(R){case"say":v={k:"say",text:k.str()};break;case"set":{const $=k.id("a flag");k.isP("=")?(k.next(),v={k:"flag",id:$,v:u(k)}):v={k:"flag",id:$,v:!0};break}case"add":{v={k:"add",id:k.id("a counter flag"),n:k.num("an amount")};break}case"give":v={k:"give",item:k.id("an item")};break;case"take":v={k:"take",item:k.id("an item")};break;case"go":{const $=k.id("a room"),A=C(k);v=A?{k:"go",room:$,sound:A}:{k:"go",room:$};break}case"talk":{const $=k.id("a conversation");k.isId("at")?(k.next(),v={k:"talk",tree:$,node:k.id("a node")}):v={k:"talk",tree:$};break}case"act":v={k:"act",n:k.num("an act number")};break;case"win":v={k:"win"};break;case"sound":{const $=k.peek(),A=k.id("a sound");ca.includes(A)||k.fail(`no sound '${A}' (sounds: ${ca.join(", ")})`,$),v={k:"sound",id:A};break}case"music":v={k:"music",track:k.id("a music track")};break;case"note":{const $=k.id("a casebook entry id"),A=k.str("the entry, in quotes");v={k:"note",id:$,text:A};break}default:return k.fail(`'${R}' isn't an effect (say, set, add, give, take, go, talk, act, win, sound, music)`,E)}return k.end(),h(w),s(v,{file:w.file,line:w.line,col:E.col})},Q=w=>{const k=[];for(const E of w){if(E.toks.length===1&&E.toks[0].t==="id"&&E.toks[0].v==="nothing"){h(E);continue}r(()=>k.push(D(E)))}return k},B=(w,k)=>s(Q(k),i(w)),W=w=>Nl.includes(w),j=(w,k,E,R)=>{var v;if(k.isStr()&&(R.say??(R.say={}),R.say[E]!==void 0&&k.fail(`'${E}' already has a line`),R.say[E]=k.str()),k.isP(":")){k.next(),R.do??(R.do={}),R.do[E]&&k.fail(`'${E}' already has effects`,k.toks[0]),R.do[E]=s([D(w,k)],i(w));return}k.end(),w.children.length?(R.do??(R.do={}),R.do[E]&&k.fail(`'${E}' already has effects`,k.toks[0]),R.do[E]=B(w,w.children)):((v=R.say)==null?void 0:v[E])===void 0&&k.fail(`'${E}' needs a line in quotes or nested effects`,k.toks[0])},I=(w,k)=>{const E=w.id("a room"),R=C(w);w.end(),k.do??(k.do={});for(const v of["open","use","walk"]){k.do[v]&&w.fail(`'${v}' already has effects, so 'exit' can't add them`);const $=R?{k:"go",room:E,sound:R}:{k:"go",room:E};k.do[v]=s([s($,i(w.ln))],i(w.ln))}},M=w=>{const k=new ee(w);k.kw("use");const E=k.id("an item");k.kw("on");const R=k.id("a hotspot or item"),v=b(k);k.end();let $,A;const U=[];for(const O of w.children){const L=O.toks[0];L.t==="str"&&$===void 0&&!U.length?r(()=>{const te=new ee(O);$=te.str(),te.end(),h(O)}):L.t==="id"&&L.v==="consume"&&O.toks.length===1?A=!0:L.t==="id"&&L.v==="keep"&&O.toks.length===1?A=!1:U.push(O)}$===void 0&&k.fail(`'use ${E} on ${R}' needs its line in quotes on the next line`,k.toks[0]);const G={item:E,with:R,say:$};return v&&(G.if=v),A!==void 0&&(G.consume=A),U.length&&(G.do=B(w,U)),s(G,i(w))},P=w=>{const k=new ee(w);k.kw("room");const E=k.id("a room id"),R=k.str("the room's name in quotes");k.end(),t.rooms[E]&&k.fail(`room '${E}' is defined twice`);const v=s({id:E,name:R},i(w));v.hotspots=[];const $=new Set;let A=!1,U=!1;for(const O of w.children)r(()=>{const L=new ee(O),te=L.id("a room property, hotspot or use"),z=()=>{L.end(),h(O)};switch(te){case"bg":v.bg=L.id("an image"),z();break;case"width":v.width=L.num(),z();break;case"music":v.music=L.id("a music track"),z();break;case"ambience":{const F=L.id("an ambience");F!=="gulls"&&F!=="sea"&&F!=="wind"&&F!=="tavern"&&L.fail("ambience is gulls, sea, wind or tavern"),v.ambience=F,z();break}case"grade":v.grade=N(L),z();break;case"backdrop":v.backdrop=N(L,"backdrop"),z();break;case"stars":v.stars={y:L.num()},z();break;case"light":(v.lights??(v.lights=[])).push(Y(L)),z();break;case"water":{const F=c(L);L.kw("ripple");const Z=_(L,"the ripple",ce=>ce>0&&ce<=8,"be more than 0 and at most 8 (pixels of sway)");(v.water??(v.water=[])).push(s({area:F,ripple:Z},i(O))),z();break}case"haze":{const F=L.num("the haze's top y"),Z=L.peek(),ce=L.num("the haze's bottom y");ce<=F&&L.fail("the haze's bottom must be below its top",Z),L.kw("floor");const _e=L.num("the floor line y");L.kw("alpha");const ii=_(L,"alpha",xa=>xa>0&&xa<=1,"be more than 0 and at most 1");L.kw("speed");const ri=L.num("a drift speed in pixels a second"),Ma={top:F,bottom:ce,floor:_e,alpha:ii,speed:ri};L.isId("tint")&&(L.next(),Ma.tint=T(L)),(v.haze??(v.haze=[])).push(s(Ma,i(O))),z();break}case"motes":{const F=y(L,$l,"mote kind"),Z=c(L);L.kw("count");const ce=_(L,"the count",_e=>Number.isInteger(_e)&&_e>0&&_e<=300,"be a whole number from 1 to 300");(v.motes??(v.motes=[])).push(s({kind:F,area:Z,count:ce},i(O))),z();break}case"beacon":{v.beacon&&L.fail("a room has one beacon",L.toks[0]);const F=d(L,!1);L.kw("period"),v.beacon=s({at:F,period:x(L,"the period")},i(O)),z();break}case"footsteps":v.footsteps=y(L,Dl,"footsteps"),z();break;case"emit":{const F=y(L,Rl,"sound to emit");let Z;L.isId("at")&&(L.next(),Z=d(L,!1)),(v.emitters??(v.emitters=[])).push(s(Z?{kind:F,at:Z}:{kind:F},i(O))),z();break}case"perspective":{L.kw("horizon");const F=L.num();L.kw("ref");const Z=L.num();L.kw("height");const ce=L.num();v.perspective=s({horizon:F,refY:Z,refH:ce},i(O)),A=!0,z();break}case"scale":{const F=L.num("a floor y"),Z=L.num("the height in pixels of a standing adult at that y");(v.scale??(v.scale=[])).push({y:F,h:Z}),v.scale=v.scale.sort((ce,_e)=>ce.y-_e.y),z();break}case"walk":(v.walk??(v.walk=[])).push(c(L)),z();break;case"entry":v.entry=d(L,!1),U=!0,z();break;case"arrive":{const F=L.id("the room you arrive from");(v.arrive??(v.arrive={}))[F]=d(L,!1),z();break}case"sprite":(v.sprites??(v.sprites=[])).push(J(L)),h(O);break;case"occluder":{L.kw("floor");const F=L.num("the floor line y");(v.occluders??(v.occluders=[])).push(s({area:c(L),y:F},i(O))),z();break}case"on":{L.kw("enter"),L.end(),v.onEnter=B(O,O.children);break}case"scene":{const F=b(L)??[];L.end(),(v.scenes??(v.scenes=[])).push(s({if:F,do:B(O,O.children)},i(O)));break}case"hotspot":{const F=de(O);$.has(F.id)&&L.fail(`hotspot '${F.id}' is defined twice in ${E}`),$.add(F.id),v.hotspots.push(F);break}case"use":(v.combos??(v.combos=[])).push(M(O));break;case"combos":{const F=L.id("a combo group");z(),v.combos??(v.combos=[]),l.push({room:v,index:v.combos.length,name:F,loc:i(O)});break}default:L.fail(`'${te}' doesn't belong in a room`,L.toks[0])}});const G=[!v.bg&&"bg",!A&&"perspective",!v.walk&&"walk",!U&&"entry"].filter(Boolean);G.length&&a.push({...i(w),message:`room '${E}' needs ${G.join(", ")}`}),v.walk??(v.walk=[]),t.rooms[E]=v},Y=w=>{const k=d(w,!1);w.kw("radius");const E=x(w,"the radius"),R={at:k,radius:E,kind:y(w,Ll,"light kind")};for(;!w.done();){const v=w.peek(),$=w.id("colour or if");if($==="if"){R.showIf=m(w);break}$==="colour"&&R.colour===void 0?R.colour=T(w):$==="color"?w.fail("spell it 'colour'",v):w.fail($==="colour"?"this light already has a colour":`'${$}' isn't a light option (colour, if)`,v)}return s(R,i(w.ln))},J=w=>{const k=w.id("an image");w.kw("at");const E=w.peek(),R=w.num("an x coordinate");w.p(",");const v=w.peek(),$=w.num("a y coordinate");w.kw("size");const A={key:k,x:R,y:$,size:w.num("a size (1 = a standing adult)")};for(;!w.done();){const U=w.peek(),G=w.id("a sprite option");switch(G){case"visible":A.visible=w.num();break;case"flip":A.flip=!0;break;case"idle":A.idle=!0;break;case"speaker":A.speaker=w.id("a character");break;case"for":A.hotspot=w.id("a hotspot");break;case"grade":A.grade=N(w);break;case"if":A.showIf=m(w);break;default:w.fail(`'${G}' isn't a sprite option (visible, flip, idle, speaker, for, grade, if)`,U)}}return s(A,i(w.ln)),o.set(zl(A),{file:w.ln.file,line:w.ln.line,col:E.col,end:v.end}),A},de=w=>{const k=new ee(w);k.kw("hotspot");const E=k.id("a hotspot id"),R=k.str("the hotspot's name in quotes");k.end();const v=s({id:E,name:R,say:{}},i(w));for(const $ of w.children)r(()=>{const A=new ee($),U=A.id("a hotspot property or verb"),G=()=>{A.end(),h($)};if(W(U)){j($,A,U,v);return}switch(U){case"area":{if(A.isP("("))v.area=c(A);else{const O=A.peek(),L=A.num("x");A.p(",");const te=A.num("y"),z=A.next();if(z.t!=="size")throw A.fail("expected a size like 150x145",z);const F={x:L,y:te,w:z.w,h:z.h};v.area={rect:F},s(F,{file:$.file,line:$.line,col:O.col,end:z.end})}G();break}case"stand":v.stand=d(A,!1),G();break;case"show":A.kw("if"),v.showIf=s(m(A),i($)),G();break;case"person":v.person=!0,G();break;case"thing":v.person=!1,G();break;case"nowalk":v.noWalk=!0,G();break;case"verb":{const O=A.id("a verb");if(!W(O))throw A.fail(`no verb '${O}'`);v.verb=O,G();break}case"article":{const O=A.id("the, a or none");if(O!=="the"&&O!=="a"&&O!=="none")throw A.fail("article is the, a or none");v.article=O,G();break}case"item":v.item=A.id("an item"),G();break;case"exit":I(A,v),h($);break;case"states":A.kw("none"),v.states=[],G();break;case"state":{const O=b(A)??[];A.end();const L=s({if:O},i($));for(const te of $.children)r(()=>{const z=new ee(te),F=z.id("name, exit or a verb");W(F)?j(te,z,F,L):F==="name"?(L.name=z.str(),z.end(),h(te)):F==="exit"?(I(z,L),h(te)):z.fail(`'${F}' doesn't belong in a state (name, exit or a verb)`,z.toks[0])});(v.states??(v.states=[])).push(L);break}default:A.fail(`'${U}' doesn't belong in a hotspot`,A.toks[0])}});return v.area||a.push({...i(w),message:`hotspot '${E}' needs an area`}),v},$t=w=>{const k=new ee(w);k.kw("dialogue");const E=k.id("a conversation id");k.end(),t.dialogues[E]&&k.fail(`dialogue '${E}' is defined twice`);const R=s({id:E,start:"",nodes:{}},i(w));let v;for(const $ of w.children)r(()=>{const A=new ee($),U=A.id("start or node");if(U==="start"){v=A.id("a node"),A.end(),h($);return}U!=="node"&&A.fail(`'${U}' doesn't belong in a dialogue (start or node)`,A.toks[0]);const G=A.id("a node id"),O=A.id("a speaker (a character, or narrator)"),L=A.str("the line in quotes");A.end(),R.nodes[G]&&A.fail(`node '${G}' is defined twice in ${E}`);const te=s({id:G,speaker:O,text:L},i($)),z=[];for(const F of $.children)r(()=>{const Z=new ee(F);if(Z.isP(">")){Z.next();const ce={text:Z.str("the choice in quotes")},_e=b(Z);Z.p("->"),ce.to=Z.id("a node, or END"),Z.end(),_e&&(ce.if=_e),F.children.length&&(ce.do=B(F,F.children)),(te.choices??(te.choices=[])).push(s(ce,i(F)))}else Z.isP("->")?(Z.next(),te.next!==void 0&&Z.fail("this node already has a next"),te.next=Z.id("a node, or END"),Z.end(),h(F)):z.push(F)});z.length&&(te.do=s(Q(z),i(z[0]))),R.nodes[G]=te,v??(v=G)});v||a.push({...i(w),message:`dialogue '${E}' has no nodes`}),R.start=v??"",t.dialogues[E]=R},ei=w=>{const k=new ee(w);k.kw("item");const E=k.id("an item id"),R=k.str("the item's name in quotes");k.end(),t.items[E]&&k.fail(`item '${E}' is defined twice`);const v=s({id:E,name:R},i(w));for(const $ of w.children)r(()=>{const A=new ee($),U=A.id("look or state");if(U==="look"){v.look=A.str(),A.end(),h($);return}U!=="state"&&A.fail(`'${U}' doesn't belong in an item (look or state)`,A.toks[0]);const G=s({if:b(A)??[]},i($));A.end();for(const O of $.children)r(()=>{const L=new ee(O),te=L.id("name or look");te==="name"?G.name=L.str():te==="look"?G.look=L.str():L.fail(`'${te}' doesn't belong in an item state (name or look)`,L.toks[0]),L.end(),h(O)});(v.states??(v.states=[])).push(G)});v.look===void 0&&a.push({...i(w),message:`item '${E}' needs a look line`}),t.items[E]=v},vn=(w,k)=>{const E=w.children;E.length!==1&&k.fail("put the text in quotes on the next line, indented",k.toks[0]);const R=new ee(E[0]),v=R.str("the text in quotes");return R.end(),h(E[0]),v},ti=w=>{const k=new ee(w);k.kw("tip");const E=b(k)??[];k.end();const R={if:E,text:""};let v;for(const $ of w.children)r(()=>{const A=new ee($);A.isId("nudge")?(A.next(),R.nudge!==void 0&&A.fail("a tip has one nudge",A.toks[0]),R.nudge=A.str("the nudge in quotes")):(A.isStr()||A.fail('a tip holds its line in quotes, and optionally nudge "…"',A.toks[0]),v!==void 0&&A.fail('a tip has one line; put a hint to show first in nudge "…"',A.toks[0]),v=A.str("the tip in quotes")),A.end(),h($)});R.text=v??k.fail("put the tip in quotes on the next line, indented",k.toks[0]),t.tips.push(s(R,i(w)))},ni=w=>{const k=new ee(w);k.kw("act");const E=k.num("the act number"),R=k.str("the act's title in quotes");k.end(),t.acts[E]&&k.fail(`act ${E} is defined twice`);const v=s({n:E,title:R},i(w));for(const $ of w.children)r(()=>{const A=new ee($),U=A.id("an act property"),G=()=>{A.end(),h($)};switch(U){case"start":{const O=A.id("a room");A.isId("at")?(A.next(),v.start={room:O,pos:d(A,!1)}):v.start={room:O},G();break}case"intro":v.intro=A.str(),G();break;case"outro":v.outro=A.str(),G();break;case"caption":v.caption=A.str(),G();break;case"inventory":{const O=[];for(;!A.done();)O.push(A.id("an item"));v.inventory=O,h($);break}case"on":A.kw("start"),A.end(),v.onStart=B($,$.children);break;default:A.fail(`'${U}' doesn't belong in an act`,A.toks[0])}});v.start||a.push({...i(w),message:`act ${E} needs a start room`}),t.acts[E]=v},ai=w=>{const k=new ee(w);k.kw("ending");const E=k.str("the closing title in quotes");k.end(),t.ending&&k.fail("the ending is defined twice");const R=s({title:E,lines:[]},i(w));for(const v of w.children)r(()=>{const $=new ee(v),A=$.id("title, painting or line");if(A==="title"){$.kw("if");const U=m($);$.end(),(R.titles??(R.titles=[])).push(s({if:U,text:vn(v,$)},i(v)))}else if(A==="painting"){const U={image:$.id("an image")};for(;!$.done();){const G=$.peek(),O=$.id("focus, music or if");if(O==="if"){U.if=m($);break}O==="focus"&&!U.focus?U.focus=d($,!1):O==="music"&&U.music===void 0?U.music=$.id("a music track"):$.fail(O==="focus"||O==="music"?`this painting already has a ${O}`:`'${O}' isn't a painting option (focus, music, if)`,G)}$.end(),h(v),(R.paintings??(R.paintings=[])).push(s(U,i(v)))}else if(A==="line"){const U=b($);$.end();const G=U?{if:U,text:vn(v,$)}:{text:vn(v,$)};R.lines.push(s(G,i(v)))}else $.fail(`'${A}' doesn't belong in the ending (title, painting or line)`,$.toks[0])});t.ending=R},oi=w=>{const k=new ee(w);k.kw("combos");const E=k.id("a group name");k.end(),t.groups[E]&&k.fail(`combo group '${E}' is defined twice`);const R=[];for(const v of w.children)r(()=>{new ee(v).isId("use")||new ee(v).fail("a combo group holds 'use X on Y' blocks"),R.push(M(v))});t.groups[E]=s(R,i(w))},si=[...n].sort((w,k)=>w.path.localeCompare(k.path));for(const w of si)for(const k of Bl(w.path,w.text,a))r(()=>{const E=new ee(k).id("room, hotspot, dialogue, item, tip, use, combos, act or ending");switch(E){case"room":P(k);break;case"dialogue":$t(k);break;case"item":ei(k);break;case"tip":ti(k);break;case"use":t.combos.push(M(k));break;case"combos":oi(k);break;case"act":ni(k);break;case"ending":ai(k);break;default:new ee(k).fail(`'${E}' can't start a block here (room, dialogue, item, tip, use, combos, act, ending)`)}});for(const w of[...l].reverse()){const k=t.groups[w.name];if(!k){a.push({...w.loc,message:`no combo group '${w.name}'`});continue}w.room.combos.splice(w.index,0,...k)}return Kl(t,e),t}const so=new WeakMap;function zl(n){let e=so.get(n);return e||(e={},so.set(n,e)),e}function Kl(n,e){var N,C,D,Q,B,W,j;const{rooms:t,dialogues:a,items:o,locs:s,errors:i}=n,r=(I,M,P=!1)=>{const Y=(I&&s.get(I))??{file:"?",line:0,col:0};i.push({...Y,message:M,...P?{warning:P}:{}})},h=new Map,l=new Map,u=Object.keys(n.acts).length>0,d=(I,M)=>{o[M]||r(I,`no item '${M}'`)},c=(I,M)=>{e.music&&!e.music[M]&&r(I,`no music track '${M}'`)},p=(I,M)=>M==null?void 0:M.forEach(P=>{if("flag"in P)l.has(P.flag)||l.set(P.flag,I);else if("has"in P)d(I,P.has);else if("notHas"in P)d(I,P.notHas);else if("room"in P)t[P.room]||r(I,`no room '${P.room}'`);else if("act"in P)for(const Y of Array.isArray(P.act)?P.act:[P.act])u&&!n.acts[Y]&&r(I,`no act ${Y}`);else"any"in P?p(I,P.any):"not"in P&&p(I,[P.not])}),g=I=>I==null?void 0:I.find(M=>Ln.has(M.k)),m=(I,M)=>I==null?void 0:I.forEach((P,Y)=>{const J=s.has(P)?P:M??P;switch(Y>0&&Ln.has(I[Y-1].k)&&!I.slice(0,Y-1).some(de=>Ln.has(de.k))&&r(J,`nothing runs after '${$n(I[Y-1])}': move this line above it`),P.k){case"flag":case"add":h.has(P.id)||h.set(P.id,J);break;case"give":case"take":d(J,P.item);break;case"go":t[P.room]||r(J,`no room '${P.room}'`);break;case"talk":{const de=a[P.tree];de?P.node&&!de.nodes[P.node]&&r(J,`dialogue '${P.tree}' has no node '${P.node}'`):r(J,`no dialogue '${P.tree}'`);break}case"act":u&&!n.acts[P.n]&&r(J,`no act ${P.n}`);break;case"music":c(J,P.track);break}}),b=(I,M)=>{d(I,I.item),!o[I.with]&&!(M!=null&&M.hotspots.some(P=>P.id===I.with))&&r(I,M?`'${I.with}' is neither an item nor a hotspot in ${M.id}`:`no item '${I.with}'`),p(I,I.if),m(I.do,I)},y=new Set,_=I=>I.forEach((M,P)=>{const Y=I.slice(0,P).find(de=>{var $t;return(de.item===M.item&&de.with===M.with||de.item===M.with&&de.with===M.item)&&(!(($t=de.if)!=null&&$t.length)||Ss(de.if,M.if??[]))});if(!Y||y.has(M))return;y.add(M);const J=s.get(Y);r(M,`this combination is never used: the one${J?` at ${J.file}:${J.line}`:""} for the same pair always matches first`,!0)});for(const I of Object.values(t)){e.images&&I.bg&&!e.images[I.bg]&&r(I,`no image '${I.bg}'`),I.music&&c(I,I.music);for(const[M,P]of Object.entries(I.arrive??{}))t[M]||r(P,`no room '${M}' to arrive from`);for(const M of I.lights??[])p(M,M.showIf);for(const M of I.sprites??[])e.images&&!e.images[M.key]&&r(M,`no image '${M.key}'`),e.characters&&M.speaker&&!e.characters[M.speaker]&&r(M,`no character '${M.speaker}'`),M.hotspot&&!I.hotspots.some(P=>P.id===M.hotspot)&&r(M,`no hotspot '${M.hotspot}' in ${I.id}`),p(M,M.showIf);m(I.onEnter,I);for(const M of I.scenes??[])p(M,M.if),m(M.do,M);for(const M of I.hotspots){M.item&&d(M,M.item),p(M.showIf&&s.has(M.showIf)?M.showIf:M,M.showIf);for(const P of[M,...M.states??[]]){"if"in P&&p(P,P.if);for(const Y of Object.values(P.do??{}))m(Y,P)}}for(const M of I.combos??[])b(M,I);_(I.combos??[])}for(const I of n.combos)b(I);_(n.combos);for(const I of Object.values(a)){I.start&&!I.nodes[I.start]&&r(I,`no node '${I.start}' to start at`);for(const M of Object.values(I.nodes)){e.characters&&M.speaker!=="narrator"&&!e.characters[M.speaker]&&r(M,`no character '${M.speaker}'`),m(M.do,M),M.next&&M.next!=="END"&&!I.nodes[M.next]&&r(M,`no node '${M.next}' in ${I.id}`),(N=M.choices)!=null&&N.length&&M.next!==void 0&&r(M,`node '${M.id}' has both choices and '-> ${M.next}': the player picks a choice, so the next would never be used`);const P=g(M.do);P&&((C=M.choices)!=null&&C.length||M.next!==void 0&&M.next!=="END")&&r(s.has(P)?P:M,`'${$n(P)}' ends the conversation, so this node can't go on to ${(D=M.choices)!=null&&D.length?"choices":`'${M.next}'`}`);for(const Y of M.choices??[]){Y.to!=="END"&&!I.nodes[Y.to]&&r(Y,`no node '${Y.to}' in ${I.id}`),p(Y,Y.if),m(Y.do,Y);const J=g(Y.do);J&&Y.to!=="END"&&r(s.has(J)?J:Y,`'${$n(J)}' ends the conversation, so this choice must lead to END, not '${Y.to}'`)}(Q=M.choices)!=null&&Q.length&&M.choices.every(Y=>{var J;return(J=Y.if)==null?void 0:J.length})&&!Ul(M.choices)&&r(M,`every choice on node '${M.id}' has a condition: if none holds the conversation simply ends here`,!0)}}for(const I of Object.values(o))for(const M of I.states??[])p(M,M.if);for(const I of n.tips)p(I,I.if);for(const I of Object.values(n.acts)){I.start&&!t[I.start.room]&&r(I,`no room '${I.start.room}'`);for(const M of I.inventory??[])d(I,M);m(I.onStart,I)}for(const I of[...((B=n.ending)==null?void 0:B.lines)??[],...((W=n.ending)==null?void 0:W.titles)??[]])p(I,I.if);for(const I of((j=n.ending)==null?void 0:j.paintings)??[])e.images&&!e.images[I.image]&&r(I,`no image '${I.image}'`),I.music&&c(I,I.music),p(I,I.if);const x=I=>I.startsWith("seen:")||I.startsWith("looked:");for(const[I,M]of l)!h.has(I)&&!x(I)&&r(M,`flag '${I}' is read but never set`);const T=new Set(["curse_broken","escaped_fog"]);for(const[I,M]of h)!l.has(I)&&!T.has(I)&&r(M,`flag '${I}' is set but never read`,!0)}const Ln=new Set(["go","talk","act","win"]);function $n(n){switch(n.k){case"go":return`go ${n.room}`;case"talk":return`talk ${n.tree}${n.node?" at "+n.node:""}`;case"act":return`act ${n.n}`;default:return n.k}}function io(n){if("has"in n)return{notHas:n.has};if("notHas"in n)return{has:n.notHas};if("not"in n)return n.not;if("flag"in n&&!("atLeast"in n)){if(!("is"in n))return{flag:n.flag,is:!1};if(n.is===!1)return{flag:n.flag}}return{not:n}}const Ss=(n,e)=>JSON.stringify(n)===JSON.stringify(e);function Ul(n){const e=n.map(t=>t.if??[]);return e.some(t=>{const a=t.length===1?[io(t[0])]:[{any:t.map(io)}];return e.some(o=>o!==t&&Ss(o,a))})}function Yl(n){return`${n.file}:${n.line}:${n.col}: ${n.warning?"warning: ":""}${n.message}`}const jl=Object.assign({"./scripts/acts.adv":Vh,"./scripts/combos.adv":Gh,"./scripts/dialogue/bramwick.adv":zh,"./scripts/dialogue/dorrit.adv":Kh,"./scripts/dialogue/elias.adv":Uh,"./scripts/dialogue/ending.adv":Yh,"./scripts/dialogue/hobb.adv":jh,"./scripts/dialogue/marta.adv":Xh,"./scripts/dialogue/mordant.adv":Qh,"./scripts/dialogue/nell.adv":Jh,"./scripts/dialogue/onn.adv":Zh,"./scripts/dialogue/pike.adv":el,"./scripts/dialogue/quill.adv":tl,"./scripts/dialogue/rook.adv":nl,"./scripts/dialogue/tam.adv":al,"./scripts/dialogue/vex.adv":ol,"./scripts/items.adv":sl,"./scripts/rooms/alley.adv":il,"./scripts/rooms/arcadia_cabin.adv":rl,"./scripts/rooms/below_decks.adv":hl,"./scripts/rooms/bow_fog.adv":ll,"./scripts/rooms/chandlery.adv":dl,"./scripts/rooms/counting_house.adv":cl,"./scripts/rooms/crows_nest.adv":ul,"./scripts/rooms/dock.adv":fl,"./scripts/rooms/far_pans.adv":pl,"./scripts/rooms/key_gate.adv":gl,"./scripts/rooms/lagoon_shore.adv":ml,"./scripts/rooms/lantern_deck.adv":bl,"./scripts/rooms/marrow_cabin.adv":wl,"./scripts/rooms/marrow_deck.adv":yl,"./scripts/rooms/marrow_gallery.adv":kl,"./scripts/rooms/marrow_quarterdeck.adv":vl,"./scripts/rooms/office.adv":_l,"./scripts/rooms/pier_end.adv":Tl,"./scripts/rooms/quay.adv":Il,"./scripts/rooms/reef_wreck.adv":Sl,"./scripts/rooms/salt_camp.adv":Ml,"./scripts/rooms/tavern.adv":xl,"./scripts/rooms/village.adv":Al,"./scripts/rooms/warehouse.adv":El,"./scripts/rooms/weather_works.adv":Cl,"./scripts/tips.adv":Hl}),Xl=Object.entries(jl).map(([n,e])=>({path:n.replace(/^\.\/scripts\//,""),text:e})),Ql={characters:_a,images:Qe.images,music:Qe.audio},$e=Gl(Xl,Ql),ro=$e.errors.filter(n=>!n.warning);if(ro.length)throw new Error(`The .adv scripts don't compile:
`+ro.map(Yl).join(`
`));const Je={rooms:$e.rooms,dialogues:$e.dialogues,items:$e.items,tips:$e.tips,combos:$e.combos,acts:$e.acts,ending:$e.ending},Jl="dock",Dn={x:1330,y:800},le=Je.rooms;function wt(n){var t;if(!n)return[];const e=[n.bg];for(const a of n.sprites??[]){e.push(a.key);const o=a.speaker?(t=_a[a.speaker])==null?void 0:t.portrait:void 0;o&&e.push(o)}return[...new Set(e)]}const ae=Je.acts,Ot=Je.ending,ot=1,Ms=Object.keys(ae).length;function Ct(n){const e=n.name.trim();return n.person||n.article==="none"||/^(the|a|an)\s/i.test(e)?e:n.article==="a"?`${/^[aeiou]/i.test(e)?"an":"a"} ${e}`:/^[A-Z]/.test(e)&&n.article!=="the"?e:`the ${e}`}function ln(n){return n.charAt(0).toUpperCase()+n.slice(1)}function Zl(n,e){return{name:n.name,person:e,article:n.article}}const ho=new Map;function ed(n){let e=0;for(let t=0;t<n.length;t++)e=e*31+n.charCodeAt(t)|0;return Math.abs(e)}function xs(n){return n.replace(new RegExp("(?<!\\.)\\.\\.(?=\\s|$)","g"),".")}function se(n,e){const t=`${e}#${n.length}`,a=ho.get(t)??0;return ho.set(t,a+1),xs(n[(ed(e)+a)%n.length])}function td(n,e,t,a=0){const o=Ct(e),s=ln(o),i=a>=3;if(e.person)switch(n){case"look":return se([`${s}. Exactly as advertised.`,`I look at ${o}. ${s} looks back, which is about as far as that goes.`,`${s}, in full. Nothing I'd write down, and I write down everything.`,`I study ${o} with a cartographer's eye. Nothing's out of place, except possibly me, for staring.`],n+t);case"talk":return se([`${s} has the look of someone whose watch ended a while ago.`,`${s} has nothing more to say to me just now. I respect that; I've nothing more to say either.`,`I open my mouth. ${s} raises an eyebrow. I close my mouth.`,`${s} gives me the look people give a stranger who arrives at five to closing.`],n+t);case"pickup":return se([`${s} would object to being carried, and so would my back.`,`I am not going to pick up ${o}. There are laws, and some of them are mine.`,`${s} is not luggage, and says so with a look.`,`I consider lifting ${o}. ${s} considers me considering it.`],n+t);case"push":case"pull":return se([`Manhandling ${o} would end this conversation and possibly my career.`,`${s} has a firm look that says “try it”.`,"I keep my hands to myself. It's the one line I've never had to draw.",`${s} is not a door, a drawer or a stubborn crate, and would like that understood.`],n+t);case"open":case"close":return se([`${s} is a person, not a cupboard.`,`${s} is not available for opening. Try conversation.`],n+t);case"turnon":case"turnoff":return`${s} doesn't have a switch. I checked, with my eyes.`;case"use":return se(["I don't use people. That's what tools are for.",`${s} is not a tool, and would be the first to say so.`,`Using ${o} for anything would want their consent and a good reason.`],n+t);default:return`${s} gives me a look that ends the idea.`}switch(n){case"look":return se([`${s}. Exactly as advertised.`,`${s}. I've charted less interesting things, but not many.`,`I look at ${o} for a while. It holds up well under inspection, which is more than most things do.`,`${s}, present and correct. I'd draw it if anyone asked.`,`Nothing about ${o} needs a second look. I take one anyway.`],n+t);case"talk":return se([`${s} has nothing to say. Restful.`,`I could talk to ${o}, but I'd only be practising.`,`I say a few words to ${o}. It takes them better than most of my supervisors.`,`${s} keeps its own counsel. I've worked with worse colleagues.`],n+t);case"open":return se([`${s} isn't the sort of thing that opens. I've tried the obvious ways; it's within its rights.`,`I look for a way to open ${o}. There isn't one, which is its own kind of answer.`,`${s} has no lid, no latch and no intention.`,`I'd need a hinge to work with, and ${o} has declined to provide one.`],n+t);case"close":return se([`${s} is already as closed as it intends to be.`,`There's nothing on ${o} to close. I check twice, out of habit.`],n+t);case"pickup":return se([`I can't carry ${o}. Not without a second career.`,`${s} stays where it is. It was here first.`,"My pockets are generous, but not that generous.",`${s} would need a stronger back and a better reason.`],n+t);case"push":case"pull":return se([`I ${n} ${o}. Nothing moves except my dignity.`,`${s} doesn't budge. Neither of us is surprised.`,`I give ${o} a good ${n}. It gives me nothing back but splinters of self-respect.`,`${s} has been where it is for years, and I'm not the one to change its mind.`,...i?[`I give ${o} a heave, like a sailor. It stays put, like a harbour wall.`]:[]],n+t);case"turnon":case"turnoff":return`${s} has no switch, and I have no ideas.`;case"use":return se([`I can't see how to use ${o} on its own.`,`I fiddle with ${o}. It's patient with me, which is worse.`,`${s} doesn't do anything by itself. Neither did I, before this voyage.`,"I'd need a reason, or at least something to use it with.",...i?[`I've crossed a reef by compass, and I still can't see what ${o} is for.`]:[]],n+t);case"give":return"I'd need something to give first.";default:return"Nothing happens, but politely."}}function nd(n,e,t,a){const o=Ct(e),s=Ct(t),i=ln(s);return n==="give"?t.person?se([`${i} has no use for ${o}, and says so without a word. Some people can.`,`${i} looks at ${o}, then at me, and declines both.`,`${i} hands ${o} straight back, the way you'd return a wrong order.`,`“What would I do with that?” is written all over ${s}'s face, in a good firm hand.`],"give"+a):se([`I'm not handing ${o} to ${s}. It has no hands.`,`${i} can't take ${o}. It's not that kind of relationship.`,`I offer ${o} to ${s}. The silence is very understanding.`,`Giving things to ${s} is how people end up talking to furniture.`],"give"+a):t.person?se([`I'd rather not use ${o} on ${s}. Not yet, anyway.`,`${i} looks at ${o}, then at me, and the idea quietly leaves the room.`,`I hold out ${o}. ${i} waits politely for me to explain. I can't.`,`Nothing forbids using ${o} on ${s}. There's a look, though, and it's worse.`],"use"+a):se([`I try ${o} on ${s} and write the result down as “no”.`,`I try ${o} on ${s}. Nothing. Not even a promising noise.`,`${ln(o)} and ${s} have nothing to say to each other.`,`I put ${o} to ${s} several ways. None of them are the right way, if there is one.`],"use"+a)}function ad(n,e){const t=Ct(e),a=ln(t);return n==="pickup"?se([`I already have ${t}. That's how pockets work.`,`${a} is already mine. Picking it up again would be greedy.`],"pickup"+e.name):n==="talk"?se([`I'm not going to talk to ${t}. Not out loud.`,`I have a quiet word with ${t}. It keeps it to itself.`],"talk"+e.name):n==="open"?xs(`There's nothing to open on ${t}.`):se([`${a} needs something to work on.`,`I wave ${t} about. It wants a target, and so, frankly, do I.`,`${a} on its own does nothing. It's waiting for me to have an idea.`,`I'd use ${t} on something, if I could decide what.`],n+e.name)}function od(n=0){const e=["Nothing there worth the name.","I look. It looks like scenery, and it knows it.","Nothing to write down there, and I write down most things.","Pleasant enough, in a way that asks nothing of me.","There's nothing there for a cartographer to add.","Just a bit of the world, between the more interesting bits.",...n>=3?["I've seen emptier water, but not by much."]:[]];return se(e,"empty-look")}function sd(n,e){if(n.length===0)return 0;if(n.length===1)return Math.max(1,n[0].h);let t=0;for(;t<n.length-2&&e>n[t+1].y;)t++;const a=n[t],o=n[t+1],s=o.y-a.y,i=s===0?0:(e-a.y)/s;return Math.max(1,a.h+(o.h-a.h)*i)}function id(n,e){if(n.scale&&n.scale.length)return sd(n.scale,e);const t=n.perspective,a=t.refY-t.horizon;return Math.max(1,t.refH*(e-t.horizon)/(a||1))}class rd{constructor(e,t){f(this,"overlay",document.createElement("div"));f(this,"body",document.createElement("div"));f(this,"count",document.createElement("p"));f(this,"previousFocus",null);f(this,"onDismiss");f(this,"titles");this.onDismiss=t,this.overlay.className="casebook",this.overlay.hidden=!0,this.overlay.innerHTML=`
      <section role="dialog" aria-modal="true" aria-labelledby="casebook-heading">
        <header>
          <p class="eyebrow">FENN'S CHART OF THE SHROUD</p>
          <h1 id="casebook-heading">What I know so far</h1>
          <p class="lede">Everything I've pinned to the chart, in the order I found it.</p>
        </header>
        <div class="casebook-body" tabindex="0"></div>
        <footer>
          <button data-action="close">Close</button>
          <small>J or Escape to close · the chart is kept with your save</small>
        </footer>
      </section>`,document.body.append(this.overlay),this.body=this.overlay.querySelector(".casebook-body"),this.count=document.createElement("p"),this.count.className="casebook-count",this.overlay.querySelector("header").append(this.count),this.overlay.addEventListener("click",a=>{var s;(((s=a.target.closest("button"))==null?void 0:s.dataset.action)==="close"||a.target===this.overlay)&&this.hide()}),this.overlay.addEventListener("keydown",a=>{if(a.stopPropagation(),a.key==="Escape"||a.key.toLowerCase()==="j"){a.preventDefault(),this.hide();return}if(a.key==="Tab"){const o=[this.body,this.overlay.querySelector("button")],i=(o.indexOf(document.activeElement)+(a.shiftKey?-1:1)+o.length)%o.length;a.preventDefault(),o[i].focus()}}),this.titles=e}get open(){return!this.overlay.hidden}show(e,t={}){var s,i;if(this.open)return;this.previousFocus=document.activeElement,this.body.replaceChildren();const a=(s=t.plan)==null?void 0:s.trim(),o=(i=t.where)==null?void 0:i.trim();if(a||o){const r=document.createElement("div");r.className="casebook-next";const h=document.createElement("p");if(h.className="eyebrow",h.textContent="NEXT",r.append(h),a){const l=document.createElement("p");l.className="casebook-plan",l.textContent=a,r.append(l)}if(o){const l=document.createElement("p");l.className="casebook-where",l.textContent=o,r.append(l)}this.body.append(r)}if(e.length===0){const r=document.createElement("p");r.className="casebook-empty",r.textContent="Nothing pinned yet. I have been busy being shouted at.",this.body.append(r)}else{const r=[...new Set(e.map(h=>h.act))].sort((h,l)=>h-l);for(const h of r){const l=document.createElement("h2");l.textContent=this.titles[h]??`Act ${h}`,this.body.append(l);for(const u of e.filter(d=>d.act===h)){const d=document.createElement("p");d.className="casebook-entry",d.textContent=u.text,this.body.append(d)}}}this.count.textContent=e.length===1?"1 note":`${e.length} notes`,this.overlay.hidden=!1,this.body.scrollTop=0,this.body.focus()}hide(){this.open&&(this.overlay.hidden=!0,Le(this.previousFocus),this.onDismiss())}}const bn=[{id:"dorrit_cleared",label:"Dorrit's name",line:"Pike's man talked, and I said it where the island could hear. Dorrit is cleared. He packed forty spoons and came aboard, and the Salty Keel has found someone else to blame.",where:"The Salty Keel, Act I — Dorrit, after the thief in the boat shed talks.",if:[{flag:"dorrit_cleared"}]},{id:"quill_compass",label:"Quill's compass",line:"Vex kept Quill's compass against a debt, then gave it back when we struck the deal. She turned it over twice, said the debt was paid, and went up to the nest.",where:"Vex's Warehouse, Act I — Captain Vex, and the price of a passage.",if:[{flag:"quill_compass"}]},{id:"rook_story",label:"Rook's log",line:"I fetched Rook's old log from the lighthouse store. He read out the part about the bell, then gave me my father's chart folded in the back, and would not look at either of us.",where:"The Lighthouse, Act I — the keeper's store, then Rook at the Salty Keel.",if:[{flag:"rook_story"}]},{id:"hobb_joined",label:"The iron band",line:"I got the crowbar under the iron band and Hobb got the mast free. He said she would hold, and that he was coming with her, and then he went to look for his brother.",where:"The Shipwright's, Act I — Hobb, the seized mast, and the crowbar on the counter.",if:[{flag:"hobb_joined"}]},{id:"gallery_sundown",label:"Sundown on the gallery",line:"Quill was off watch on the stern gallery with the sunset and no use for it. We talked until the sun went into the sea, and agreed not to mention the part where neither of us wanted to leave.",where:"The Marrow's stern gallery, Act II — Quill, off watch at sundown.",if:[{flag:"seen:quill.gallery"}]},{id:"tam_bell",label:"The bell on the flats",line:"The bell rang across the flats, three notes and then one. Hobb put his hand on the wreck and said it was Tam, and none of us asked him how he knew.",where:"The Sunken Wreck, Act III — the bell across the flats.",if:[{flag:"wreck_bell"}]},{id:"elias_found",label:"My father, drawing",line:"My father stood up from behind the tents with his work still in his hand. He was thin and sunburnt and alive, and the first thing he did was move the chart to make room for me.",where:"The Castaway Camp, Act III — the man who stands up behind the tents.",if:[{flag:"elias_found"}]},{id:"far_pans",label:"The far pans",line:"I walked out to the far pans where the boardwalk loses its nerve. Quill had her glass up and the fog in front of her, and she said the things she would not say in front of Vex.",where:"The Far Flats, Act III — the boardwalk out of the castaway camp.",if:[{flag:"pans_seen"}]},{id:"bell_cut",label:"The bell, cut loose",line:"Hobb went up the rigging with the crowbar and cut the bell rope. The clapper came away in his hand. The bell hangs dumb now, and the ringing stopped.",where:"The Grey Lantern — Deck, Act IV — the bell rope above the rigging.",if:[{flag:"bell_cut"}]},{id:"tam_freed",label:"Tam Hobb, off the rope",line:"Tam came down out of the rigging with salt in his hair and three months missing from his eyes. Hobb said his name once, and Tam answered, and that was the whole reunion.",where:"The Grey Lantern — Deck, Act IV — the hand on the bell rope.",if:[{flag:"tam_freed"}]},{id:"lantern_doused",label:"The great lantern",line:"Quill and I got the wet canvas over the great lantern and held it until the green light went out. Every rope on the ship went slack at once, like a held breath letting go.",where:"The Grey Lantern — Deck, Act IV — the great lantern in the rigging.",if:[{flag:"lantern_doused"}]},{id:"name_spoken",label:"The name on the brass",line:"I read the name off the brass plate in the captain's cabin. Elias said it aloud. Mordant. The fog let go of the ship the way a hand lets go of a rope.",where:"The Grey Lantern — Captain's Cabin, Act IV — the nameplate.",if:[{flag:"name_spoken"}]},{id:"vex_trust",label:"Vex, trusted",line:"At the end, Vex could have taken the salvage and run. I gave him the boat, and he noticed. What he does with that is his own business.",where:"The Grey Lantern — Captain's Cabin, Act IV — Vex, at the last.",if:[{flag:"vex_trust"}]},{id:"fog_lifts",label:"Lay them to rest",line:"We rang the bell for the dead and said the name, and the fog lifted off Dreadwater like a curtain. My father came home with the chart under his arm, and the island went back to sailing.",where:"The Grey Lantern, Act IV — the bell, the name, and the choice you make.",if:[{flag:"ending_fog_lifts"}]}],ua=bn.length,As="brasscompass.deeds.v1",hd="DREADWATER: the light burning. All hands.";function Es(){try{const n=JSON.parse(localStorage.getItem(As)||"[]");return Array.isArray(n)?new Set(n.filter(e=>typeof e=="string")):new Set}catch{return new Set}}function ld(n){try{localStorage.setItem(As,JSON.stringify([...new Set(n)]))}catch{}}function Cs(n){const e=Es();for(const t of bn)n(t)&&e.add(t.id);return ld(e),e}function dd(){const n=Es();return{filed:bn.reduce((e,t)=>e+(n.has(t.id)?1:0),0),total:ua}}class cd{constructor(e){f(this,"overlay",document.createElement("div"));f(this,"body",document.createElement("div"));f(this,"entered",document.createElement("ol"));f(this,"unfiled",document.createElement("ol"));f(this,"enteredCount",document.createElement("span"));f(this,"unfiledCount",document.createElement("span"));f(this,"tally",document.createElement("p"));f(this,"previousFocus",null);f(this,"onDismiss");this.onDismiss=e,this.overlay.className="deeds",this.overlay.hidden=!0,this.overlay.innerHTML=`
      <section role="dialog" aria-modal="true" aria-labelledby="deeds-heading">
        <header>
          <p class="eyebrow">THE SHIP'S LOG</p>
          <h1 id="deeds-heading">The voyage, entered</h1>
          <p class="lede">What the log keeps, and what I left for another night.</p>
        </header>
        <div class="deeds-body" tabindex="0">
          <div class="deeds-columns">
            <section class="deeds-column deeds-entered">
              <h2>Entered <span class="deeds-count"></span></h2>
              <ol></ol>
            </section>
            <section class="deeds-column deeds-unfiled">
              <h2>Not yet <span class="deeds-count"></span></h2>
              <ol></ol>
            </section>
          </div>
        </div>
        <p class="deeds-bookend"></p>
        <footer>
          <p class="deeds-tally"></p>
          <button data-action="close">Go home</button>
          <small>Enter, click or Escape to go home · the log keeps every voyage</small>
        </footer>
      </section>`,document.body.append(this.overlay),this.body=this.overlay.querySelector(".deeds-body"),this.entered=this.overlay.querySelector(".deeds-entered ol"),this.unfiled=this.overlay.querySelector(".deeds-unfiled ol"),this.enteredCount=this.overlay.querySelector(".deeds-entered .deeds-count"),this.unfiledCount=this.overlay.querySelector(".deeds-unfiled .deeds-count"),this.tally=this.overlay.querySelector(".deeds-tally"),this.overlay.querySelector(".deeds-bookend").textContent=hd,this.overlay.addEventListener("click",()=>this.hide()),this.overlay.addEventListener("keydown",t=>{if(t.stopPropagation(),t.repeat){(t.key==="Escape"||t.key==="Enter"||t.key===" ")&&t.preventDefault();return}if(t.key==="Escape"||t.key==="Enter"||t.key===" "){t.preventDefault(),this.hide();return}if(t.key==="Tab"){const a=[this.body,this.overlay.querySelector("button")],s=(a.indexOf(document.activeElement)+(t.shiftKey?-1:1)+a.length)%a.length;t.preventDefault(),a[s].focus()}})}get open(){return!this.overlay.hidden}show(e){if(this.open)return;this.previousFocus=document.activeElement;const t=Cs(e);this.entered.replaceChildren(),this.unfiled.replaceChildren();let a=0;for(const s of bn){const i=t.has(s.id);i&&a++;const r=document.createElement("li");r.className=i?"deed entered":"deed unfiled";const h=document.createElement("div");h.className="deed-head";const l=document.createElement("p");if(l.className="deed-label",l.textContent=s.label,h.append(l),i){const d=document.createElement("span");d.className="deed-stamp",d.setAttribute("aria-hidden","true"),d.textContent="ENTERED";const c=document.createElement("span");c.className="sr-only",c.textContent="Entered.",h.append(d,c)}r.append(h);const u=document.createElement("p");i?(u.className="deed-line",u.textContent=s.line,r.append(u),this.entered.append(r)):(u.className="deed-where",u.textContent=s.where,r.append(u),this.unfiled.append(r))}const o=ua-a;this.enteredCount.textContent=`${a}`,this.unfiledCount.textContent=`${o}`,this.entered.hidden=a===0,this.unfiled.hidden=o===0,this.tally.textContent=`${a} of ${ua} in the log`,this.overlay.hidden=!1,this.body.scrollTop=0,this.body.focus()}hide(){this.open&&(this.overlay.hidden=!0,Le(this.previousFocus),this.onDismiss())}}function ud(n,e){if(n===void 0||!Number.isFinite(n))return null;const t=Math.max(0,(e-n)/1e3);if(t<45)return"just now";const a=Math.round(t/60);if(a<60)return a<=1?"1 minute ago":`${a} minutes ago`;const o=Math.round(t/3600);if(o<24)return o<=1?"1 hour ago":`${o} hours ago`;const s=Math.round(t/86400);if(s<60)return s<=1?"1 day ago":`${s} days ago`;const i=Math.round(s/30.44);return i<=1?"1 month ago":`${i} months ago`}function fd(n){return n.length===0?"nothing at all":n.length===1?n[0]:`${n.slice(0,-1).join(", ")} and ${n[n.length-1]}`}function pd(n,e,t){var r,h;const a=ud(n.at,t),o=n.actStarted===!1,s=o?e.actCaption(n.act):null,i=(r=n.tip)==null?void 0:r.trim();return{act:e.actTitle(n.act)??`Act ${n.act}`,when:a?`Last sailed ${a}.`:"Last sailed: the page doesn't say when.",where:`Fenn was in ${e.roomName(n.room)}.`,doing:o?s?`The act hasn't begun. It opens with: “${s}”`:"The act hasn't begun. Nobody has said anything yet.":i?`He was doing: ${i}`:"He was doing: something he didn't write down.",opening:o,knows:`He knows: ${n.notes.length} ${n.notes.length===1?"entry":"entries"}.`,notes:n.notes.slice(-2).map(l=>l.text),carrying:`He is carrying: ${fd(n.inventory.map(l=>e.itemName(l)))}.`,talking:!!((h=n.queue)!=null&&h.length),waiting:e.waitingOnLastChoice(n.act)}}class gd{constructor(e){f(this,"overlay",document.createElement("div"));f(this,"body",document.createElement("div"));f(this,"heading",document.createElement("h1"));f(this,"when",document.createElement("p"));f(this,"where",document.createElement("p"));f(this,"doing",document.createElement("p"));f(this,"knows",document.createElement("p"));f(this,"notes",document.createElement("ul"));f(this,"carrying",document.createElement("p"));f(this,"talking",document.createElement("p"));f(this,"waiting",document.createElement("p"));f(this,"sailButton",document.createElement("button"));f(this,"casebookButton",document.createElement("button"));f(this,"backButton",document.createElement("button"));f(this,"previousFocus",null);f(this,"hooks");f(this,"filed",[]);f(this,"onKeyDown",e=>this.key(e));f(this,"listening",!1);this.hooks=e,this.overlay.className="recap",this.overlay.hidden=!0,this.overlay.innerHTML=`
      <section role="dialog" aria-modal="true" aria-labelledby="recap-heading" aria-describedby="recap-where">
        <header>
          <p class="eyebrow">PREVIOUSLY</p>
          <h1 id="recap-heading"></h1>
          <p class="recap-when" id="recap-when"></p>
        </header>
        <div class="recap-body" tabindex="0">
          <p class="recap-where" id="recap-where"></p>
          <p class="recap-doing"></p>
          <p class="recap-knows"></p>
          <ul class="recap-notes"></ul>
          <p class="recap-carrying"></p>
          <p class="recap-talking" hidden>Someone was still talking when you left.</p>
          <p class="recap-waiting" hidden>The last choice is still waiting.</p>
        </div>
        <footer>
          <div class="recap-answers">
            <button type="button" data-action="sail" class="primary">Set sail</button>
            <button type="button" data-action="casebook">Read the chart</button>
            <button type="button" data-action="back">Back</button>
          </div>
          <small>Enter sets sail · Escape goes back · the room itself waits until you do</small>
        </footer>
      </section>`,document.body.append(this.overlay);const t=a=>this.overlay.querySelector(a);this.body=t(".recap-body"),this.heading=t("#recap-heading"),this.when=t("#recap-when"),this.where=t(".recap-where"),this.doing=t(".recap-doing"),this.knows=t(".recap-knows"),this.notes=t(".recap-notes"),this.carrying=t(".recap-carrying"),this.talking=t(".recap-talking"),this.waiting=t(".recap-waiting"),this.sailButton=t('[data-action="sail"]'),this.casebookButton=t('[data-action="casebook"]'),this.backButton=t('[data-action="back"]'),this.overlay.addEventListener("click",a=>{var s;const o=(s=a.target.closest("button"))==null?void 0:s.dataset.action;o==="sail"?this.sail():o==="casebook"?this.hooks.readCasebook(this.filed):(o==="back"||a.target===this.overlay)&&this.back()})}get open(){return!this.overlay.hidden}show(e){if(this.open)return;this.previousFocus=document.activeElement,this.filed=e.notes;const t=pd(e,this.hooks,Date.now());this.heading.textContent=t.act,this.when.textContent=t.when,this.where.textContent=t.where,this.doing.textContent=t.doing,this.doing.classList.toggle("recap-opening",t.opening),this.knows.textContent=t.knows,this.notes.replaceChildren(...t.notes.map(a=>{const o=document.createElement("li");return o.textContent=a,o})),this.notes.hidden=t.notes.length===0,this.carrying.textContent=t.carrying,this.talking.hidden=!t.talking,this.waiting.hidden=!t.waiting,this.overlay.hidden=!1,this.body.scrollTop=0,this.listen(),this.sailButton.focus()}hide(){this.open&&(this.overlay.hidden=!0,this.unlisten(),Le(this.previousFocus))}back(){this.open&&(this.hide(),this.hooks.back())}sail(){this.open&&(this.hide(),this.hooks.sail())}listen(){this.listening||(this.listening=!0,window.addEventListener("keydown",this.onKeyDown,!0))}unlisten(){this.listening&&(this.listening=!1,window.removeEventListener("keydown",this.onKeyDown,!0))}key(e){if(e.target instanceof Element&&e.target.closest(".casebook, .history"))return;if(e.stopPropagation(),e.key==="Escape"){e.preventDefault(),this.back();return}if(e.key==="Tab"){const a=[this.body,this.sailButton,this.casebookButton,this.backButton],s=(a.indexOf(document.activeElement)+(e.shiftKey?-1:1)+a.length)%a.length;e.preventDefault(),a[s].focus();return}const t=document.activeElement instanceof HTMLButtonElement&&document.activeElement!==this.sailButton;e.key==="Enter"&&!t&&(e.preventDefault(),this.sail())}}const Ht=4,md={lemon:"rum",mushroom:"rum"},Hs={},bd={ending_pirate:"ending_long_way",ending_desk:"ending_fog_lifts"},wd={tavernkeeper:{nofungus:"norum",nofungus2:"norum2"}},Xt=new Set(["ending_fog_lifts","ending_long_way","ending_pirate","ending_desk"]),Ns=new Set(["curse_broken","escaped_fog"]),Lt=new Set([...Xt,...Ns]),ge="brasscompass.save.v4",Ls=["brasscompass.save.v3","brasscompass.save.v2"],$s="brasscompass.save.archive",Me="brasscompass.save.previous";function Ds(n,e){if(e.item(n))return n;const t=md[n];return t!==void 0&&e.item(t)?t:null}function yd(n,e){const t=Math.max(0,...Object.keys(e).map(Number));return{actStart:a=>{var o;return(o=e[a])==null?void 0:o.start},roomInAct:(a,o)=>{var s;return((s=n.get(a))==null?void 0:s.rooms.has(o))??!1},treeInAct:(a,o)=>{var s;return((s=n.get(a))==null?void 0:s.trees.has(o))??!1},actOfRoom:a=>{const o=[...n].filter(([,s])=>s.rooms.has(a)).map(([s])=>s);return o.length===1?o[0]:void 0},lastAct:t}}function Ta(n){return!Xe(n)||!Se(n.version)?1:Math.max(1,Math.floor(n.version))}function Rs(n,e=Lt){return Object.fromEntries(Object.entries(n).filter(([t])=>!e.has(t)))}function kd(n,e){const t={...n};for(const[a,o]of Object.entries(e))a in t&&(o in t||(t[o]=t[a]),delete t[a]);return t}function vd(n,e,t){var a;if(n.k==="act")return e.lastAct!==void 0&&n.n>=e.lastAct?null:n.n===t&&e.act(n.n)?n:null;if(n.k==="win"||(n.k==="flag"||n.k==="add")&&Lt.has(n.id))return null;if(n.k==="give"||n.k==="take"){const o=Ds(n.item,e);return o===null?null:{...n,item:o}}if(n.k==="talk"){const o=n.node!==void 0?((a=wd[n.tree])==null?void 0:a[n.node])??n.node:void 0;return e.talk&&!e.talk(n.tree)||e.treeInAct&&!e.treeInAct(t,n.tree)?null:o!==void 0&&e.talk&&!e.talk(n.tree,o)?{k:"talk",tree:n.tree}:o===void 0?{k:"talk",tree:n.tree}:{k:"talk",tree:n.tree,node:o}}if(n.k==="go"){const o=(e.renamedRooms??Hs)[n.room]??n.room;return!e.room(o)||e.roomInAct&&!e.roomInAct(t,o)?null:o===n.room?n:{...n,room:o}}return n}const Xe=n=>!!n&&typeof n=="object"&&!Array.isArray(n),re=n=>typeof n=="string",Se=n=>typeof n=="number"&&Number.isFinite(n);function _d(n){if(!Xe(n))return!1;switch(n.k){case"flag":return re(n.id)&&"v"in n;case"add":return re(n.id)&&Se(n.n);case"give":case"take":return re(n.item);case"go":return re(n.room);case"talk":return re(n.tree)&&(n.node===void 0||re(n.node));case"act":return Se(n.n);case"win":return!0;case"say":return re(n.text);case"sound":return ca.includes(n.id);case"music":return re(n.track);case"note":return re(n.id)&&re(n.text);default:return!1}}function wn(n,e,t=[]){var c,p,g;if(!Xe(n)||Ta(n)>Ht||!Xe(n.flags)||!Array.isArray(n.inventory))return null;const a=re(n.room)?(e.renamedRooms??Hs)[n.room]??n.room:null,o=a!==null&&e.room(a)?a:null;let s;if(n.act===void 0||n.act===null)s=(o!==null?(c=e.actOfRoom)==null?void 0:c.call(e,o):void 0)??e.firstAct;else if(Se(n.act)&&e.act(n.act))s=n.act;else{const m=o!==null?(p=e.actOfRoom)==null?void 0:p.call(e,o):void 0;if(m===void 0)return null;s=m,t.push(`act ${String(n.act)} is unknown; resumed in act ${m}`)}let i,r;if(o!==null&&(!e.roomInAct||e.roomInAct(s,o)))i=o;else{const m=(g=e.actStart)==null?void 0:g.call(e,s);if(!m||!e.room(m.room))return null;t.push(`room ${re(n.room)?n.room:"?"} is not part of act ${s}; moved to ${m.room}`),i=m.room,r=m.pos??null}const h=[];for(const m of n.inventory){if(!re(m))continue;const b=Ds(m,e);b!==null&&!h.includes(b)&&h.push(b)}const l=[];if(Array.isArray(n.notes))for(const m of n.notes)!Xe(m)||!re(m.id)||!re(m.text)||l.some(b=>b.id===m.id)||l.push({id:m.id,text:m.text,act:Se(m.act)?m.act:s});const u=Rs(kd(n.flags,e.renamedFlags??bd),e.endingFlags??Lt),d={version:Ht,room:i,facing:n.facing===-1?-1:1,flags:u,inventory:h,act:s,notes:l,actStarted:n.actStarted!==!1};if(r?(d.x=r.x,d.y=r.y):r===void 0&&Se(n.x)&&Se(n.y)&&(d.x=n.x,d.y=n.y),re(n.tip)&&n.tip.trim()&&(d.tip=n.tip),Se(n.at)&&(d.at=n.at),Array.isArray(n.queue)){const m=[];for(const b of n.queue){if(!_d(b))continue;const y=vd(b,e,s);y&&m.push(y)}m.length&&(d.queue=m)}return d}function St(n){let e=null;try{e=localStorage.getItem(ge)}catch{return{data:null,raw:null,corrupt:!1}}if(!e)return{data:null,raw:null,corrupt:!1};let t;try{t=JSON.parse(e)}catch{return{data:null,raw:e,corrupt:!0}}const a=Ta(t);if(a>Ht)return{data:null,raw:e,corrupt:!1,future:!0,futureVersion:a};const o=[],s=wn(t,n,o);if(!s)return{data:null,raw:e,corrupt:!0};const i={data:s,raw:e,corrupt:!1};return a<Ht&&(i.migratedFrom=a),o.length&&(i.repaired=o),i}function Ia(n){try{return localStorage.setItem(ge,JSON.stringify(n)),!0}catch{return!1}}function Td(){try{localStorage.removeItem(ge)}catch{}}const Id=8,Sd=new Set(["corrupt","future"]),lo=ge+".corrupt";function fa(){try{const n=localStorage.getItem($s);if(!n)return[];const e=JSON.parse(n);return Array.isArray(e)?e.filter(t=>Xe(t)&&re(t.raw)&&re(t.reason)&&re(t.key)&&Se(t.at)):[]}catch{return[]}}function Md(){const n=fa();try{const e=localStorage.getItem(lo);e&&!n.some(t=>t.raw===e)&&n.unshift({at:0,reason:"corrupt",key:lo,raw:e})}catch{}return n}function xe(n,e,t=ge,a){try{const o=fa();if(o.some(s=>s.raw===n))return!0;for(o.push({at:Date.now(),reason:e,key:t,...a!==void 0?{version:a}:{},raw:n});o.length>Id;){const i=o.slice(0,-1).findIndex(r=>!Sd.has(r.reason));o.splice(i>=0?i:0,1)}return localStorage.setItem($s,JSON.stringify(o)),fa().some(s=>s.raw===n)}catch{return!1}}function xd(n,e){return xe(n,"corrupt",ge,e)}function co(n){const e=[];for(const t of Md()){if(t.reason==="old-key"&&t.key!==Me)continue;let a;try{a=JSON.parse(t.raw)}catch{continue}const o=wn(a,n);o&&e.push({page:t,data:o})}return e.sort((t,a)=>a.page.at-t.page.at)}function Ad(n,e){let t;try{t=JSON.parse(n.raw)}catch{return!1}const a=wn(t,e);if(!a)return!1;try{const o=localStorage.getItem(ge);if(o&&o!==n.raw&&!xe(o,"replaced"))return!1}catch{return!1}return Ia(a)}function Ed(){let n=null;for(const e of Ls)try{const t=localStorage.getItem(e);if(t){let a;try{a=Ta(JSON.parse(t))}catch{}xe(t,"old-key",e,a)&&localStorage.removeItem(e),n??(n=t)}}catch{}return n}function Cd(){try{const n=localStorage.getItem(ge);if(!n)return"none";const e=localStorage.getItem(Me);return e&&e!==n&&!xe(e,"replaced",Me)?"failed":(localStorage.setItem(Me,n),localStorage.getItem(Me)===n?"ok":"failed")}catch{return"failed"}}function uo(n,e){return e?n==="future"?"A page from a newer notebook was set aside untouched. Open that newer copy of the game to read it; Begin starts a fresh page here.":"A page from an unreadable notebook was set aside, kept in the archive. Begin starts a fresh page.":"The last page of my notebook can't be read, and I couldn't set it aside. Begin will not write over it: free some browser storage and reload."}function Rn(){try{return localStorage.getItem(Me)!==null}catch{return!1}}function Hd(n){try{const e=localStorage.getItem(Me);if(!e)return!1;let t=null;try{t=wn(JSON.parse(e),n)}catch{}if(!t)return xe(e,"corrupt",Me)&&localStorage.removeItem(Me),!1;const a=localStorage.getItem(ge);return a&&a!==e&&!xe(a,"replaced")||!Ia(t)?!1:(localStorage.removeItem(Me),!0)}catch{return!1}}function qn(n){try{if(n){if(localStorage.getItem(ge)!==null)return St(n).data!==null}else if(localStorage.getItem(ge)!==null)return!0;return Ls.some(e=>localStorage.getItem(e)!==null)}catch{return!1}}function fo(n){const e=St(n);return e.data||!e.raw?null:e.future?{raw:e.raw,reason:"future",version:e.futureVersion}:{raw:e.raw,reason:"corrupt"}}function Nd(){try{const n=localStorage.getItem(ge);if(!n)return null;const e=JSON.parse(n);return Xe(e)&&Se(e.at)?e.at:null}catch{return null}}function Ld(n,e=[]){const t=[...n??[],...e].filter(a=>a.k!=="win");return t.length?t:void 0}function $d(n){var e;return!n||(e=n.choices)!=null&&e.length?[]:(n.do??[]).filter(t=>t.k==="go"||t.k==="talk"||t.k==="act"||t.k==="win")}function yt(n,e){return!(n??[]).some(t=>"act"in t&&!(Array.isArray(t.act)?t.act.includes(e):t.act===e))}function Dd(n){const e=new Map;for(const t of Object.values(n.acts)){const a=t.n,o={rooms:new Set,trees:new Set,items:new Set(t.inventory??[]),flags:new Set},s=[t.start.room],i=[],r=h=>{for(const l of h??[])l.k==="go"?s.push(l.room):l.k==="talk"?i.push(l.tree):l.k==="give"?o.items.add(l.item):(l.k==="flag"||l.k==="add")&&o.flags.add(l.id)};for(r(t.onStart);s.length||i.length;){const h=s.shift();if(h!==void 0){const d=n.rooms[h];if(!d||o.rooms.has(h))continue;o.rooms.add(h),r(d.onEnter);for(const c of d.scenes??[])yt(c.if,a)&&r(c.do);for(const c of d.hotspots)if(yt(c.showIf,a)){o.flags.add(`looked:${h}.${c.id}`),c.item&&o.items.add(c.item);for(const p of[c.do,...(c.states??[]).filter(g=>yt(g.if,a)).map(g=>g.do)])for(const g of Object.values(p??{}))r(g)}for(const c of[...d.combos??[],...n.combos])yt(c.if,a)&&r(c.do);continue}const l=i.shift(),u=n.dialogues[l];if(!(!u||o.trees.has(l))){o.trees.add(l);for(const d of Object.values(u.nodes)){o.flags.add(`seen:${l}.${d.id}`),r(d.do);for(const c of d.choices??[])yt(c.if,a)&&r(c.do)}}}e.set(a,o)}return e}class Rd{constructor(e=ge,t=Date.now){f(this,"conflictAt",null);f(this,"mine");this.key=e,this.now=t}observe(e){return e.key!==this.key||e.newValue===null?!1:(this.conflictAt=this.now(),!0)}remember(e){this.mine=e}checkStored(e){return this.mine===void 0||e===null||e<=this.mine?!1:(this.conflictAt=this.now(),!0)}get conflicted(){return this.conflictAt!==null}get since(){return this.conflictAt}clear(){this.conflictAt=null,this.mine=void 0}}function qd(n){const{ctx:e,room:t}=n,a=s=>{e.beginPath(),s.forEach((i,r)=>r?e.lineTo(i.x,i.y):e.moveTo(i.x,i.y)),e.closePath()};e.save(),e.lineWidth=2,e.strokeStyle="#3f6";for(const s of t.walk)a(s),e.stroke();e.strokeStyle="#f3c";for(const s of t.occluders??[])a(s.area),e.stroke(),e.setLineDash([6,6]),e.beginPath(),e.moveTo(s.area[0].x,s.y),e.lineTo(Math.max(...s.area.map(i=>i.x)),s.y),e.stroke(),e.setLineDash([]);e.strokeStyle="#39f";for(const s of t.hotspots)"rect"in s.area?e.strokeRect(s.area.rect.x,s.area.rect.y,s.area.rect.w,s.area.rect.h):(a(s.area),e.stroke()),s.stand&&(e.fillStyle="#39f",e.fillRect(s.stand.x-5,s.stand.y-5,10,10));e.strokeStyle="#ff0",e.beginPath(),e.moveTo(0,t.perspective.horizon),e.lineTo(t.width??S,t.perspective.horizon),e.stroke(),Pd(n),Od(n);const o=(s,i,r=4)=>{e.fillStyle=i,e.fillRect(s.x-r,s.y-r,r*2,r*2)};for(const s of t.walk)s.forEach(i=>o(i,"#3f6"));for(const s of t.occluders??[])s.area.forEach(i=>o(i,"#f3c"));for(const s of t.hotspots)"rect"in s.area||s.area.forEach(i=>o(i,"#39f",3));o(t.entry,"#fff",6);for(const s of Object.values(t.arrive??{}))o(s,"#fc6",6);for(const s of t.lights??[])o(s.at,"#f93",5);for(const s of t.water??[])s.area.forEach(i=>o(i,"#3cf"));for(const s of t.motes??[])s.area.forEach(i=>o(i,"#c9f"));t.beacon&&o(t.beacon.at,"#ff9",5);for(const s of t.emitters??[])s.at&&o(s.at,"#f6f",5);n.devHandle&&(e.strokeStyle="#fff",e.lineWidth=3,e.strokeRect(n.devHandle.x-9,n.devHandle.y-9,18,18)),e.restore()}function Pd(n){const{ctx:e,room:t}=n,a=(i,r,h,l)=>K(e,i,r,h,{size:13,color:l,shadow:!0}),o=i=>{e.beginPath(),i.forEach((r,h)=>h?e.lineTo(r.x,r.y):e.moveTo(r.x,r.y)),e.closePath(),e.stroke()};e.save(),e.lineWidth=1.5;for(const i of t.lights??[])e.strokeStyle="#f93",e.setLineDash([5,5]),e.beginPath(),e.arc(i.at.x,i.at.y,i.radius,0,Math.PI*2),e.stroke(),e.setLineDash([]),e.beginPath(),e.arc(i.at.x,i.at.y,i.radius*.18,0,Math.PI*2),e.stroke(),a(`${i.kind}${i.showIf?" (if)":""}`,i.at.x+8,i.at.y+6,"#fc9");e.strokeStyle="#3cf";for(const i of t.water??[])o(i.area),a(`water ${i.ripple}`,i.area[0].x+6,i.area[0].y+4,"#9ef");e.strokeStyle="#c9f";for(const i of t.motes??[])o(i.area),a(`${i.kind} ${i.count}`,i.area[0].x+6,i.area[0].y+4,"#dbf");const s=t.width??S;for(const i of t.haze??[]){e.strokeStyle="rgba(220,220,230,0.8)",e.setLineDash([3,7]);for(const r of[i.top,i.bottom])e.beginPath(),e.moveTo(0,r),e.lineTo(s,r),e.stroke();e.setLineDash([14,6]),e.beginPath(),e.moveTo(0,i.floor),e.lineTo(s,i.floor),e.stroke(),e.setLineDash([]),a(`haze ${i.top}-${i.bottom}, floor ${i.floor}`,12,i.floor-18,"#eee")}if(t.beacon){const{x:i,y:r}=t.beacon.at;e.strokeStyle="#ff9",e.beginPath(),e.arc(i,r,14,0,Math.PI*2),e.moveTo(i-22,r),e.lineTo(i+22,r),e.moveTo(i,r-22),e.lineTo(i,r+22),e.stroke(),a(`beacon ${t.beacon.period}s`,i+18,r+10,"#ffc")}for(const i of t.emitters??[])i.at&&(e.strokeStyle="#f6f",e.beginPath(),e.moveTo(i.at.x,i.at.y-10),e.lineTo(i.at.x+10,i.at.y),e.lineTo(i.at.x,i.at.y+10),e.lineTo(i.at.x-10,i.at.y),e.closePath(),e.stroke(),a(i.kind,i.at.x+12,i.at.y-6,"#fbf"));e.restore()}function Od(n){const{ctx:e,room:t}=n,a=[];for(const o of t.walk)for(let s=0;s<o.length;s++){const i=o[s],r=o[(s+1)%o.length];for(let h=.2;h<1;h+=.3)a.push({x:i.x+(r.x-i.x)*h,y:i.y+(r.y-i.y)*h})}e.save();for(const o of a){const s=n.personHeight(o.y);if(s<24)continue;const i=s*.15;e.strokeStyle="rgba(255,255,255,0.55)",e.fillStyle="rgba(255,255,255,0.10)",e.lineWidth=1.5,e.beginPath(),e.moveTo(o.x-i*.75,o.y-s*.44),e.lineTo(o.x-i*.62,o.y-s*.86),e.lineTo(o.x+i*.62,o.y-s*.86),e.lineTo(o.x+i*.75,o.y-s*.44),e.lineTo(o.x+i*.5,o.y),e.lineTo(o.x-i*.5,o.y),e.closePath(),e.fill(),e.stroke(),e.beginPath(),e.arc(o.x,o.y-s*.93,s*.068,0,Math.PI*2),e.fill(),e.stroke(),e.beginPath(),e.moveTo(o.x-i*.9,o.y),e.lineTo(o.x+i*.9,o.y),e.stroke(),K(e,`${Math.round(s)}`,o.x+i,o.y-s*.99,{size:13,color:"rgba(255,255,255,0.75)",shadow:!1})}e.restore()}const We=4;function qs(n,e){if(n<=We)return 0;const t=Math.ceil(n/We);return(Math.floor(e/We)%t+t)%t*We}const we={width:520,height:68,left:700,right:1220},po=["I","II","III","IV","V","VI","VII","VIII","IX","X"];function Wd(n=Ms){const e=Math.max(0,Math.min(Math.floor(n)||0,po.length));return po.slice(0,e)}const Wt=796,Ze=82,Fd=104;function Bd(n,e,t=!1,a=null,o=!1,s=null){if(s!=null&&s.open&&s.pages.length){const l=qs(s.pages.length,s.offset??0),u=s.pages.slice(l,l+We),d=s.pages.length>We,c=Wt+Ze,p=c-Ze,g=d?p:c;return[...u.map((m,b)=>({id:`page${l+b}`,label:m.label,sub:m.sub,y:g-(u.length-b)*Ze})),...d?[{id:"more",label:"More pages",sub:`${l+1}–${l+u.length} of ${s.pages.length}`,y:p}]:[],{id:"back",label:"Back",y:c}]}const r=[...n?[{id:"continue",label:"Continue",sub:a??void 0}]:[],{id:"start",label:"Begin"},...e?[{id:"explore",label:"Chapter select",sub:"walk any scene · nothing is saved"}]:[]].map((l,u)=>({...l,y:Wt+u*Ze}));if(!t){const l=[];return o&&l.push({id:"previous",label:"Take up last voyage",y:Wt-Ze}),s!=null&&s.pages.length&&l.unshift({id:"recover",label:"Recover an older page",sub:`${s.pages.length} kept`,y:Wt-Ze*(l.length+1)}),[...l,...r]}const h=r.find(l=>l.id==="start").y;return[{id:"keep",label:"Keep my voyage",y:h},{id:"confirm",label:"Begin anew",y:h+Fd}]}function Re(n){return n.some(e=>e.id==="keep")?"keep":n.some(e=>e.id==="continue")?"continue":"start"}function Vd(n,e,t){return e>we.left&&e<we.right&&t>n-8&&t<n+we.height+8}const go=new WeakMap;function Gd(n){let e=go.get(n);return e||(e=n.createLinearGradient(0,0,0,V),e.addColorStop(0,"rgba(3,5,12,0.66)"),e.addColorStop(.42,"rgba(3,5,12,0.18)"),e.addColorStop(.72,"rgba(3,5,12,0.42)"),e.addColorStop(1,"rgba(3,5,12,0.9)"),go.set(n,e)),e}const dn=1.3,zd=9,Kd=1.5,ue={x:S/2-600,y:258,w:1200,h:250};let Pn=null,mo=null,On=null;function Ud(){if(Pn)return Pn;const n=document.createElement("canvas");n.width=ue.w,n.height=ue.h;const e=n.getContext("2d");return e?(K(e,"THE BRASS",ue.w/2,286-ue.y,{size:96,color:"#e8c98a",align:"center",weight:"bold"}),K(e,"COMPASS",ue.w/2,386-ue.y,{size:96,color:"#e8c98a",align:"center",weight:"bold"}),Pn=n,n):null}function Yd(){if(On)return On;const n=document.createElement("canvas");n.width=220,n.height=ue.h;const e=n.getContext("2d");if(!e)return null;const t=e.createLinearGradient(0,0,n.width,0);return t.addColorStop(0,"rgba(255,244,214,0)"),t.addColorStop(.5,"rgba(255,244,214,0.95)"),t.addColorStop(1,"rgba(255,244,214,0)"),e.fillStyle=t,e.fillRect(0,0,n.width,n.height),On=n,n}function jd(n,e,t){const a=Ud();if(!a){K(n,"THE BRASS",S/2,286,{size:96,color:"#e8c98a",align:"center",weight:"bold"}),K(n,"COMPASS",S/2,386,{size:96,color:"#e8c98a",align:"center",weight:"bold"});return}if(n.drawImage(a,ue.x,ue.y),t||e<dn+.5)return;const o=(e-dn-.5)%zd/Kd,s=Yd();if(o>1||!s)return;mo??(mo=document.createElement("canvas"));const i=mo;i.width!==ue.w&&(i.width=ue.w,i.height=ue.h);const r=i.getContext("2d");r&&(r.setTransform(1,0,0,1,0,0),r.globalCompositeOperation="source-over",r.clearRect(0,0,i.width,i.height),r.drawImage(a,0,0),r.globalCompositeOperation="source-atop",r.setTransform(1,0,-.35,1,-260+o*(ue.w+520),0),r.drawImage(s,0,0),r.setTransform(1,0,0,1,0,0),r.globalCompositeOperation="source-over",n.save(),n.globalCompositeOperation="lighter",n.globalAlpha=.5*Math.sin(Math.PI*o),n.drawImage(i,ue.x,ue.y),n.restore())}function Sa(n,e,t,a,o,s,i,r="normal"){n.save(),n.font=`${r} ${o}px Georgia, "Times New Roman", serif`;const h=[...e].map(d=>n.measureText(d).width),l=h.reduce((d,c)=>d+c,0)+i*Math.max(0,e.length-1);let u=t-l/2;return n.textAlign="left",n.textBaseline="top",n.fillStyle=s,[...e].forEach((d,c)=>{n.fillText(d,u,a),u+=h[c]+i}),n.restore(),l}function bo(n,e,t,a,o){n.save(),n.fillStyle=o,n.beginPath();for(let s=0;s<8;s++){const i=s*Math.PI/4-Math.PI/2,r=s%2?a*.34:a,h=e+Math.cos(i)*r,l=t+Math.sin(i)*r;s?n.lineTo(h,l):n.moveTo(h,l)}n.closePath(),n.fill(),n.restore()}function yn(n,e,t,a,o,s="#e8c98a",i=1){n.save(),n.translate(e,t),n.globalAlpha=i,n.strokeStyle=s,n.lineWidth=1,n.beginPath(),n.arc(0,0,a,0,Math.PI*2),n.stroke(),n.globalAlpha=i*.5,n.beginPath(),n.arc(0,0,a*.74,0,Math.PI*2),n.stroke(),n.globalAlpha=i,n.rotate(o);for(let r=0;r<8;r++){n.rotate(Math.PI/4);const h=r%2===0;n.fillStyle=h?s:"rgba(232,201,138,0.45)",n.beginPath(),n.moveTo(0,-a*.9),n.lineTo(a*.1,-a*.16),n.lineTo(0,0),n.lineTo(-a*.1,-a*.16),n.closePath(),n.fill(),h&&(n.fillStyle="rgba(181,69,46,0.72)",n.beginPath(),n.moveTo(0,a*.9),n.lineTo(a*.1,a*.16),n.lineTo(0,0),n.lineTo(-a*.1,a*.16),n.closePath(),n.fill())}n.fillStyle="#0b1422",n.beginPath(),n.arc(0,0,a*.12,0,Math.PI*2),n.fill(),n.restore()}function Xd(n,e,t,a){var c,p;const o=e.buttons.find(g=>g.id===e.focus)??e.buttons.find(g=>g.id===Re(e.buttons));if(!o)return;const s=((c=e.needle)==null?void 0:c.since)??-99,i=((p=e.needle)==null?void 0:p.fromY)??o.y,r=Math.max(0,t-s),h=a?1:1-Math.pow(1-Math.min(1,r/.28),3),l=i+(o.y-i)*h+we.height/2,u=a?0:.55*Math.exp(-4.2*r)*Math.cos(13*r),d=we.left-38;n.save(),n.translate(d,l),n.fillStyle="rgba(8,13,22,0.72)",n.beginPath(),n.arc(0,0,16,0,Math.PI*2),n.fill(),n.strokeStyle="rgba(232,201,138,0.8)",n.lineWidth=1.2,n.stroke(),n.rotate(u),n.fillStyle="#e8c98a",n.beginPath(),n.moveTo(13,0),n.lineTo(0,-4.4),n.lineTo(0,4.4),n.closePath(),n.fill(),n.fillStyle="#b5452e",n.beginPath(),n.moveTo(-11,0),n.lineTo(0,-4.4),n.lineTo(0,4.4),n.closePath(),n.fill(),n.fillStyle="#0b1422",n.beginPath(),n.arc(0,0,2.2,0,Math.PI*2),n.fill(),n.restore()}function Qd(n,e){var i;const t=e.time??1e3,a=e.reduced??!1,o=Math.max(1,e.scale??1),s=e.bg;if(n.save(),!a){const r=1.035+.01*Math.sin(t*.13);n.translate(S/2+Math.sin(t*.09)*22,V/2+Math.cos(t*.11)*7),n.scale(r,r),n.translate(-S/2,-V/2)}if(s){const r=V*(s.width/s.height);n.drawImage(s,(S-r)/2,0,r,V)}else n.fillStyle="#070b14",n.fillRect(0,0,S,V);(i=e.decorate)==null||i.call(e,n),n.restore(),n.fillStyle=Gd(n),n.fillRect(0,0,S,V),yn(n,S/2,196,27,a?0:t*.07,"#e8c98a",.8),jd(n,t,a),e.confirmNew&&ec(n,e);for(const r of e.buttons)r.id==="confirm"?wo(n,r.label,r.y,e.focus===r.id,o,!0):r.id==="explore"?Zd(n,r,t,e.focus===r.id,a,o):r.id===Re(e.buttons)||r.id==="keep"?Jd(n,r,t,e.focus===r.id,a,o):wo(n,r.label,r.y,e.focus===r.id,o,!1,r.sub);if(Xd(n,e,t,a),t<dn){const r=1-t/dn;n.fillStyle=`rgba(0,0,0,${(r*r).toFixed(3)})`,n.fillRect(0,0,S,V)}}function Jd(n,e,t,a,o,s){const i=we.width,r=we.height,h=S/2-i/2,l=e.y,u=n.createLinearGradient(0,l,0,l+r);if(u.addColorStop(0,a?"rgba(47,39,25,0.92)":"rgba(17,26,38,0.86)"),u.addColorStop(1,a?"rgba(25,20,13,0.94)":"rgba(6,10,18,0.92)"),n.fillStyle=u,n.fillRect(h,l,i,r),n.strokeStyle=a?"rgba(255,226,160,0.95)":"rgba(201,162,74,0.55)",n.lineWidth=a?2:1.2,n.strokeRect(h+.5,l+.5,i-1,r-1),a){n.strokeStyle="#ffe6a8",n.lineWidth=2;const m=16;for(const[b,y,_,x]of[[h,l,1,1],[h+i,l,-1,1],[h,l+r,1,-1],[h+i,l+r,-1,-1]])n.beginPath(),n.moveTo(b+_*2,y+x*2+x*m),n.lineTo(b+_*2,y+x*2),n.lineTo(b+_*2+_*m,y+x*2),n.stroke()}yn(n,h+38,l+r/2,21,o?0:t*.16,a?"#ffe6a8":"#d9b877",.95),n.strokeStyle=a?"rgba(255,230,168,0.45)":"rgba(201,162,74,0.28)",n.lineWidth=1,n.beginPath(),n.moveTo(h+76,l+12),n.lineTo(h+76,l+r-12),n.stroke();const d=he(n,e.label.toUpperCase(),i-124,Math.round(25*Math.min(s,e.sub?1.2:1.5)),16,"bold"),c=e.sub?he(n,e.sub,i-124,Math.round(15*Math.min(s,1.2)),11):null,p=h+76+(i-76)/2,g=l+(c?Math.max(4,Math.floor((r-d.size-c.size-2)/2)):Math.round((r-d.size)/2)-1);Sa(n,d.text,p,g,d.size,a?"#fff6e0":"#ecd8ab",4.5,"bold"),c&&K(n,c.text,p,g+d.size+2,{size:c.size,color:a?"#e8d6ae":"#a99a7a",align:"center",shadow:!1})}function Zd(n,e,t,a,o,s){const i=we.width,r=we.height,h=S/2-i/2,l=e.y,u=n.createLinearGradient(0,l,0,l+r);u.addColorStop(0,a?"rgba(34,40,38,0.94)":"rgba(12,24,31,0.82)"),u.addColorStop(1,a?"rgba(19,22,18,0.95)":"rgba(5,12,18,0.9)"),n.fillStyle=u,n.fillRect(h,l,i,r),n.strokeStyle=a?"rgba(255,231,172,0.9)":"rgba(201,162,74,0.42)",n.lineWidth=a?1.8:1,n.strokeRect(h+.5,l+.5,i-1,r-1),n.save(),n.strokeStyle=a?"rgba(232,201,138,0.22)":"rgba(232,201,138,0.1)",n.lineWidth=1,n.beginPath(),n.moveTo(h+84,l+14),n.lineTo(h+i-108,l+14),n.moveTo(h+84,l+r-14),n.lineTo(h+i-108,l+r-14),n.stroke(),n.restore(),yn(n,h+40,l+r/2,18,o?0:t*.12,a?"#ffe6a8":"#c9a24a",.86),n.strokeStyle=a?"rgba(255,230,168,0.4)":"rgba(201,162,74,0.24)",n.lineWidth=1,n.beginPath(),n.moveTo(h+78,l+11),n.lineTo(h+78,l+r-11),n.stroke(),s=Math.min(s,1.4);const d=he(n,e.label.toUpperCase(),i-212,Math.round(18*s),13,"bold");if(Sa(n,d.text,h+(i-30)/2,l+12,d.size,a?"#fff6e0":"#e0cfa6",3.6,"bold"),e.sub){const g=he(n,e.sub,i-212,Math.round(14*s),11);K(n,g.text,h+(i-30)/2,l+r-g.size-11,{size:g.size,color:a?"#e3d2ad":"#b8a98a",align:"center",shadow:!1})}n.save(),n.font=`600 ${Math.round(11*Math.min(s,1.1))}px Georgia, serif`,n.textAlign="center",n.textBaseline="middle",n.fillStyle=a?"rgba(255,231,172,0.95)":"rgba(201,162,74,0.62)";const c=Wd(),p=h+i-57.5-(c.length-1)*19/2;if(c.forEach((g,m)=>n.fillText(g,p+m*19,l+r/2)),n.restore(),a){n.strokeStyle="#ffe6a8",n.lineWidth=2;const g=13;for(const[m,b,y,_]of[[h,l,1,1],[h+i,l,-1,1],[h,l+r,1,-1],[h+i,l+r,-1,-1]])n.beginPath(),n.moveTo(m+y*2,b+_*2+_*g),n.lineTo(m+y*2,b+_*2),n.lineTo(m+y*2+y*g,b+_*2),n.stroke()}}function wo(n,e,t,a,o,s=!1,i){const r=we.width,h=we.height,l=S/2-r/2,u=t,d=S/2,c=n.createLinearGradient(0,u,0,u+h);s?(c.addColorStop(0,a?"rgba(52,28,22,0.94)":"rgba(26,15,15,0.86)"),c.addColorStop(1,a?"rgba(30,15,12,0.95)":"rgba(11,7,9,0.92)")):(c.addColorStop(0,a?"rgba(40,36,26,0.94)":"rgba(13,21,31,0.86)"),c.addColorStop(1,a?"rgba(22,18,12,0.95)":"rgba(5,9,16,0.92)")),n.save(),n.fillStyle=c,n.fillRect(l,u,r,h),n.strokeStyle=s?a?"rgba(255,203,180,0.92)":"rgba(208,154,131,0.5)":a?"rgba(255,231,172,0.92)":"rgba(201,162,74,0.45)",n.lineWidth=a?1.8:1.1,n.strokeRect(l+.5,u+.5,r-1,h-1),n.strokeStyle=a?"rgba(255,230,168,0.22)":"rgba(232,201,138,0.12)",n.lineWidth=1,n.strokeRect(l+4.5,u+4.5,r-9,h-9);const p=s?"rgba(208,154,131,0.7)":a?"rgba(255,230,168,0.95)":"rgba(201,162,74,0.6)";bo(n,l+26,u+h/2,a?7:5.5,p),bo(n,l+r-26,u+h/2,a?7:5.5,p);const g=3.2,m=r-120,b=Math.round(19*Math.min(o,i?1.25:1.5)),y=he(n,e.toUpperCase(),m-g*e.length,b,13,"bold"),_=i?he(n,i,m,Math.round(16*Math.min(o,1.25)),13):null,x=4,T=y.size+(_?x+_.size:0),N=u+Math.max(5,(h-T)/2)-1,C=s?a?"#ffd9c6":"#e0b49f":a?"#fff6e0":"#eddcb3";if(Sa(n,y.text,d,N,y.size,C,g,"bold"),_&&K(n,_.text,d,N+y.size+x,{size:_.size,color:a?"#eadbb6":"#c4b794",align:"center",shadow:!1}),a){n.strokeStyle=s?"#ffcbb4":"#ffe6a8",n.lineWidth=2;const D=13;for(const[Q,B,W,j]of[[l,u,1,1],[l+r,u,-1,1],[l,u+h,1,-1],[l+r,u+h,-1,-1]])n.beginPath(),n.moveTo(Q+W*2,B+j*2+j*D),n.lineTo(Q+W*2,B+j*2),n.lineTo(Q+W*2+W*D,B+j*2),n.stroke()}n.restore()}function ec(n,e){const t=e.buttons.find(g=>g.id==="keep"),a=e.buttons.find(g=>g.id==="confirm");if(!t||!a)return;const o=Math.max(1,e.scale??1),s=Math.round(Math.min(o-1,1)*100),i=t.y-150-s,r=a.y+we.height+20,h=Math.round(760*o),l=S/2-h/2;n.save();const u=n.createLinearGradient(0,i,0,r);u.addColorStop(0,"rgba(16,11,10,0.93)"),u.addColorStop(1,"rgba(9,7,7,0.96)"),n.fillStyle=u,n.fillRect(l,i,h,r-i),n.strokeStyle="rgba(201,162,74,0.5)",n.lineWidth=1.2,n.strokeRect(l+.5,i+.5,h-1,r-i-1),yn(n,S/2,i+40,16,0,"#c9a24a",.6);const d=he(n,"Begin again?",h-60,Math.round(30*o),22,"bold");K(n,d.text,S/2,i+72,{size:d.size,color:"#ffd9b8",align:"center",weight:"bold",shadow:!1});const c=e.saveLabel?`your saved voyage (${e.saveLabel})`:"your saved voyage",p=he(n,`This replaces ${c}; it can be taken up again from the title.`,h-60,Math.round(20*o),15);K(n,p.text,S/2,i+72+d.size+16,{size:p.size,color:"#e6d3bf",align:"center",shadow:!1}),n.restore()}function Qt(n,e,t,a,o,s,i={}){var x,T;const r=e.img(t),h=i.frame??0,l=r&&((x=e.frameBounds(t,i.frames??1))==null?void 0:x[h]);if(!r||!l)return;const u=s*(i.visible??1)/(l.bottom-l.top),d=i.anchor==="box"?(l.left+l.right)/2:nc(t,i.frames??1,h,r.width,l.torso),c=(l.right-l.left)*u,p=(l.bottom-l.top)*u,g=n.getTransform(),m=p*Math.hypot(g.c,g.d),b=m>0?oc(r,t,i.frames??1,h,l,i.grade??"none",m):null,y=i.wrap?hc(r,t,i.frames??1,h,l,c,p,i.wrap):null;n.save(),n.translate(a,o),i.lean&&n.rotate(i.lean);const _=i.squash??1;if(_!==1&&n.scale(1/Math.sqrt(_),_),i.flip&&n.scale(-1,1),y){const N=c/y.dw,C=-i.wrap.blur*.55,D=N/De;n.save(),n.imageSmoothingQuality="low",n.drawImage(y.canvas,(l.left-d)*u-y.pad*N,-s-y.pad*N+C,y.canvas.width*D,y.canvas.height*D),n.restore()}if(b){const N=(T=i.wrap)!=null&&T.rim?ic(b,i.wrap.rim,i.flip??!1):null;n.drawImage(N??b,(l.left-d)*u,-s,c,p)}else n.filter=Ps(i.grade).filter||"none",n.drawImage(r,l.left,l.top,l.right-l.left,l.bottom-l.top,(l.left-d)*u,-s,c,p);n.restore()}const tc={char_walk_v2:[.538,.4399,.4198,.4852,.4494,.4462],char_walk_vertical:[.4845,.4858,.5052,.5142,.5077,.509]};function nc(n,e,t,a,o){const s=tc[n];if(!s||s.length!==e||t>=s.length)return o;const i=a/e;return(t+s[t])*i}const et=new Map;let Wn=0;const ac=8e6,pa=8;function oc(n,e,t,a,o,s,i){const r=o.right-o.left,h=o.bottom-o.top,l=Math.ceil(Math.log2(i)*pa),u=Math.min(h,Math.ceil(2**(l/pa))),d=`${e}|${t}|${a}|${s}|${u}`,c=et.get(d);if(c)return et.delete(d),et.set(d,c),c;const p=Math.max(1,Math.round(r*u/h)),g=document.createElement("canvas");g.width=p,g.height=u;const m=g.getContext("2d");if(!m)return null;m.imageSmoothingEnabled=!0,m.imageSmoothingQuality="high";const b=Ps(s),y=b.filter||null;y&&cn()&&(m.filter=y),m.drawImage(n,o.left,o.top,r,h,0,0,p,u),y&&!cn()&&Os(m,p,u,y),b.tint&&(m.filter="none",m.globalCompositeOperation="source-atop",m.fillStyle=b.tint,m.fillRect(0,0,p,u),m.globalCompositeOperation="source-over"),et.set(d,g),Wn+=p*u;for(const[_,x]of et){if(Wn<=ac||_===d)break;et.delete(_),Wn-=x.width*x.height,x.width=x.height=0}return g}const yo=new WeakMap,kt=new Set;let Ft=0,ko=0;const sc=6e6,Fn=new Map;function ic(n,e,t){const a=n.width,o=n.height;if(a<=0||o<=0)return null;const s=e.side===0?0:t?-e.side:e.side;let i=Fn.get(e.rgb);i===void 0&&(i=Fn.size,Fn.set(e.rgb,i));const r=(i*32+Math.round(e.alpha*20))*3+s+1;let h=yo.get(n);h||(h=new Map,yo.set(n,h));const l=h.get(r);if(l&&l.canvas.width===a)return l.stamp=++ko,l.canvas;const u=document.createElement("canvas");u.width=a,u.height=o;const d=u.getContext("2d");if(!d)return null;d.drawImage(n,0,0),d.globalCompositeOperation="source-atop";const c=s===0?d.createLinearGradient(0,0,0,o*.55):d.createLinearGradient(s>0?a:0,0,s>0?a*.25:a*.75,0);c.addColorStop(0,`rgba(${e.rgb},${e.alpha})`),c.addColorStop(1,`rgba(${e.rgb},0)`),d.fillStyle=c,d.fillRect(0,0,a,o),l&&(kt.delete(l),Ft-=l.pixels);const p={canvas:u,pixels:a*o,stamp:++ko,owner:h,key:r};for(h.set(r,p),kt.add(p),Ft+=p.pixels;Ft>sc&&kt.size>1;){let g=null;for(const m of kt)m!==p&&(!g||m.stamp<g.stamp)&&(g=m);if(!g)break;kt.delete(g),g.owner.delete(g.key),Ft-=g.pixels,g.canvas.width=g.canvas.height=0}return u}const tt=new Map;let Bn=0;const rc=3e6,De=.5;function hc(n,e,t,a,o,s,i,r){if(!cn()||s<=0||i<=0)return null;const h=Math.ceil(Math.log2(Math.max(1,i))*pa),l=`${e}|${t}|${a}|${h}|${r.blur}|${r.colour}`,u=tt.get(l);if(u)return tt.delete(l),tt.set(l,u),u;const d=Math.ceil(r.blur*2.6+4),c=Math.max(1,Math.ceil((s+d*2)*De)),p=Math.max(1,Math.ceil((i+d*2)*De)),g=document.createElement("canvas");g.width=c,g.height=p;const m=g.getContext("2d");if(!m)return null;m.imageSmoothingEnabled=!0,m.imageSmoothingQuality="high",m.drawImage(n,o.left,o.top,o.right-o.left,o.bottom-o.top,d*De,d*De,s*De,i*De),m.globalCompositeOperation="source-in",m.fillStyle=r.colour,m.fillRect(0,0,c,p);const b=document.createElement("canvas");b.width=c,b.height=p;const y=b.getContext("2d");if(!y)return null;y.filter=`blur(${r.blur*De}px)`,y.drawImage(g,0,0),y.filter="none";const _={canvas:b,pad:d,dw:s,dh:i};tt.set(l,_),Bn+=c*p;for(const[x,T]of tt){if(Bn<=rc||x===l)break;tt.delete(x),Bn-=T.canvas.width*T.canvas.height,T.canvas.width=T.canvas.height=0}return _}const lc=.42,vo=new Map;function Ps(n){const e=n??"none";let t=vo.get(e);if(!t){const a=/\btint\(\s*(-?[\d.]+)\s*\)/.exec(e),o=e.replace(/\btint\([^)]*\)/g," ").replace(/\s+/g," ").trim();t={filter:o==="none"?"":o,tint:a?`hsla(${Number(a[1])},62%,40%,${lc})`:null},vo.set(e,t)}return t}let vt;function cn(){if(vt!==void 0)return vt;try{const n=document.createElement("canvas");n.width=n.height=1;const e=n.getContext("2d",{willReadFrequently:!0});e.filter="brightness(0)",e.fillStyle="#fff",e.fillRect(0,0,1,1),vt=e.getImageData(0,0,1,1).data[0]<128}catch{vt=!1}return vt}function Os(n,e,t,a){const o=[],s=/([a-z-]+)\(\s*(-?[\d.]+)(%|deg|rad|turn)?\s*\)/g;for(let r=s.exec(a);r;r=s.exec(a)){const h=r[1];let l=Number(r[2]);r[3]==="%"&&(l/=100);const u=d=>([c,p,g,m])=>[d[0]*c+d[1]*p+d[2]*g,d[3]*c+d[4]*p+d[5]*g,d[6]*c+d[7]*p+d[8]*g,m];switch(h){case"brightness":o.push(([d,c,p,g])=>[d*l,c*l,p*l,g]);break;case"contrast":o.push(([d,c,p,g])=>[(d-.5)*l+.5,(c-.5)*l+.5,(p-.5)*l+.5,g]);break;case"opacity":o.push(([d,c,p,g])=>[d,c,p,g*Math.min(1,l)]);break;case"invert":{const d=Math.min(1,l);o.push(([c,p,g,m])=>[c+(1-2*c)*d,p+(1-2*p)*d,g+(1-2*g)*d,m]);break}case"saturate":{const d=l;o.push(u([.213+.787*d,.715-.715*d,.072-.072*d,.213-.213*d,.715+.285*d,.072-.072*d,.213-.213*d,.715-.715*d,.072+.928*d]));break}case"grayscale":{const d=1-Math.min(1,l);o.push(u([.2126+.7874*d,.7152-.7152*d,.0722-.0722*d,.2126-.2126*d,.7152+.2848*d,.0722-.0722*d,.2126-.2126*d,.7152-.7152*d,.0722+.9278*d]));break}case"sepia":{const d=1-Math.min(1,l);o.push(u([.393+.607*d,.769-.769*d,.189-.189*d,.349-.349*d,.686+.314*d,.168-.168*d,.272-.272*d,.534-.534*d,.131+.869*d]));break}case"hue-rotate":{const c=(r[3]==="rad"?l*180/Math.PI:r[3]==="turn"?l*360:l)*Math.PI/180,p=Math.cos(c),g=Math.sin(c);o.push(u([.213+p*.787-g*.213,.715-p*.715-g*.715,.072-p*.072+g*.928,.213-p*.213+g*.143,.715+p*.285+g*.14,.072-p*.072-g*.283,.213-p*.213-g*.787,.715-p*.715+g*.715,.072+p*.928+g*.072]));break}}}if(!o.length)return;const i=r=>r<0?0:r>1?1:r;try{const r=n.getImageData(0,0,e,t),h=r.data;for(let l=0;l<h.length;l+=4){if(h[l+3]===0)continue;let u=[h[l]/255,h[l+1]/255,h[l+2]/255,h[l+3]/255];for(const d of o)u=d(u).map(i);h[l]=u[0]*255,h[l+1]=u[1]*255,h[l+2]=u[2]*255,h[l+3]=u[3]*255}n.putImageData(r,0,0)}catch{}}function Ws(n,e,t,a,o=.34,s=0,i){const r=dc(i),h=a*1.25*(s?1.12:1),l=Math.max(5,a*.27),u=e-s*a*.14;n.save(),n.globalAlpha=Math.min(1,o*2.7),n.imageSmoothingQuality="low",n.drawImage(r,u-h,t-l-1,h*2,l*2),n.restore()}const _o=new WeakMap;function Fs(n){if(!n)return;const e=_o.get(n);if(e!==void 0)return e;const t=/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(n.colour),a=t?`${t[1]},${t[2]},${t[3]}`:"";return _o.set(n,a),a}const Bt=new Map;function dc(n){const e=n||"",t=Bt.get(e);if(t)return t;const a=document.createElement("canvas");a.width=256,a.height=64;const o=a.getContext("2d");if(o){const[s,i,r]=e?e.split(",").map(Number):[0,0,0],h=e?`${Math.round(4+s*.13)},${Math.round(6+i*.13)},${Math.round(10+r*.13)}`:"5,7,16",l=e?`${Math.round(2+s*.07)},${Math.round(3+i*.07)},${Math.round(6+r*.07)}`:"2,3,9";o.translate(128,32),o.scale(1,.25);const u=o.createRadialGradient(0,0,0,0,0,128);u.addColorStop(0,`rgba(${h},0.75)`),u.addColorStop(.4,`rgba(${h},0.5)`),u.addColorStop(.75,`rgba(${h},0.17)`),u.addColorStop(1,`rgba(${h},0)`),o.fillStyle=u,o.fillRect(-128,-128,256,256);const d=o.createRadialGradient(0,0,0,0,0,62);d.addColorStop(0,`rgba(${l},0.7)`),d.addColorStop(1,`rgba(${l},0)`),o.fillStyle=d,o.fillRect(-128,-128,256,256)}return Bt.size>40&&Bt.clear(),Bt.set(e,a),a}function cc(n,e,t,a,o,s,i={}){var l,u,d;const r=(l=e.frameBounds(t))==null?void 0:l[0];if(!r)return;const h=i.visible??1;h>=1&&Ws(n,a,o,Math.min(s*.3,s*((r.right-r.left)/(r.bottom-r.top))*.8),.34,((d=(u=i.wrap)==null?void 0:u.rim)==null?void 0:d.side)??0,Fs(i.wrap)),Qt(n,e,t,a,o,s,{visible:h,flip:i.flip,grade:i.grade,anchor:i.figure?"torso":"box",lean:i.lean,squash:i.squash,wrap:i.wrap})}const To=.34,Io=.035;class uc{constructor(){f(this,"toward",null);f(this,"from",null);f(this,"entry",null)}leave(e){this.toward=e,this.from=null,this.entry=null}arrive(e,t=null){this.from=this.toward?e:null,this.entry=this.from?t:null,this.toward=null}entrySide(){return this.entry}clear(){this.toward=this.from=null,this.entry=null}zoom(e,t,a){const o=this.toward??this.from;if(!o)return null;if(this.from&&e<=.001)return this.from=null,this.entry=null,null;if(a)return null;const s=e*e*(3-2*e);return{k:1+(this.toward?To:Io)*s,x:Math.max(0,Math.min(S,o.x-t)),y:Math.max(0,Math.min(q,o.y))}}peekZoom(e,t,a){const o=this.toward??this.from;if(!o||a)return null;const s=e*e*(3-2*e);return{k:1+(this.toward?To:Io)*s,x:Math.max(0,Math.min(S,o.x-t)),y:Math.max(0,Math.min(q,o.y))}}}function fc(n){return n*n*(3-2*n)}const Bs={x:S/2,y:V/2};function pc(n,e,t){const a=Math.max(1,e),o=n.viewW??S,s=n.viewH??q,i=((n.viewX??0)+t.x-t.x/a)/(n.scaleX??1),r=(t.y-t.y/a)/(n.scaleY??1),h=o/a/(n.scaleX??1),l=s/a/(n.scaleY??1);return{sx:i,sy:r,sw:h,sh:l,dx:0,dy:0,dw:o,dh:s}}function gc(n,e,t){const a=n.sw>0?n.dw/n.sw:1;return{x:n.dx+(e-n.sx)*a,y:n.dy+(t-n.sy)*a}}function mc(n,e){const t=e==="left"||e==="right",a=t?S:q,o=a*.22,s=e==="right"||e==="below",i=s?a*n:a*(1-n),r=Math.max(0,Math.min(1,(i-o)/a)),h=Math.max(1e-4,Math.min(1,i/a));return{horizontal:t,fromFarEnd:s,a:r,b:h}}function bc(n,e,t){if(e>=.999){n.fillStyle="#000",n.fillRect(0,0,S,V);return}const{horizontal:a,fromFarEnd:o,a:s,b:i}=mc(e,t),r=a?n.createLinearGradient(0,0,S,0):n.createLinearGradient(0,0,0,q);o?(r.addColorStop(0,`rgba(0,0,0,${e})`),r.addColorStop(s,`rgba(0,0,0,${e})`),r.addColorStop(Math.min(1,i+1e-4),"rgba(0,0,0,0)"),r.addColorStop(1,"rgba(0,0,0,0)")):(r.addColorStop(0,"rgba(0,0,0,0)"),r.addColorStop(s,"rgba(0,0,0,0)"),r.addColorStop(Math.min(1,i+1e-4),`rgba(0,0,0,${e})`),r.addColorStop(1,`rgba(0,0,0,${e})`)),n.fillStyle=r,n.fillRect(0,0,S,a?V:q),a||(n.fillStyle="#000",n.fillRect(0,q,S,V-q))}const ga=1.5,So=25;function wc(n){return Math.max(0,Math.min(1,(n-ga)/.5))*.75}function yc(n,e,t,a=Bs){const o=wc(e);if(o<=0)return;const s=a.x,i=a.y+6,r=8,h=18,l=Math.floor(e*8)%r;n.save(),n.globalAlpha=o,n.fillStyle="#d8c9a3";for(let u=0;u<r;u++){const d=u/r*Math.PI*2-Math.PI/2,c=t?0:(l-u+r)%r;n.globalAlpha=o*(t?.6:Math.max(.18,1-c/r)),n.beginPath(),n.arc(s+Math.cos(d)*h,i-30+Math.sin(d)*h,3.2,0,Math.PI*2),n.fill()}n.globalAlpha=o,n.font="22px Georgia, serif",n.textAlign="center",n.textBaseline="middle",n.fillText("Loading",s,i+12),n.restore()}function kc(n,e){if(e.fade<=.001)return;const t=e.fade,a=fc(t);e.entry&&!e.reduced?bc(n,a,e.entry):(n.fillStyle=`rgba(0,0,0,${a})`,n.fillRect(0,0,S,V));const o=e.center??Bs;e.waited&&t>.99&&yc(n,e.waited,e.reduced,o)}const ne=S,Ce=V,vc=Math.PI*2,_c={steps:.6,street:.66,quay:.62,water:.86,planks:.54},Tc={steps:.69,street:.82,quay:.92,water:1.16,planks:.58},Ic={street:{fog:[150,176,198],lamp:[255,196,108]},steps:{fog:[144,172,196],lamp:[255,188,100]},quay:{fog:[148,180,201],lamp:[255,205,128]},water:{fog:[138,170,194],lamp:[255,198,120]},planks:{fog:[116,138,154],lamp:[255,176,92]}};function Be(n,e){return`rgba(${n[0]},${n[1]},${n[2]},${e})`}function Vs(n){return Math.max(0,Math.min(1,n))}function Mo(n,e,t){const a=Vs((t-n)/(e-n));return a*a*(3-2*a)}function Sc(n){return 1-(1-n)*(1-n)}function Mc(n,e){const t=74*e;switch(n){case"left":return{dx:t,dy:0};case"right":return{dx:-t,dy:0};case"above":return{dx:0,dy:t*.7};case"below":return{dx:0,dy:-t*.7}}}class xc{constructor(){f(this,"spec",null);f(this,"plate",null);f(this,"elapsed",0);f(this,"started",!1);f(this,"duration",.65)}get active(){return this.spec!==null}get kind(){var e;return((e=this.spec)==null?void 0:e.kind)??null}begin(e,t,a,o,s=null){this.spec={kind:e,side:t,from:a,to:o},this.plate=s,this.elapsed=0,this.started=!1,this.duration=_c[e]}update(e){return this.spec?this.started?(this.elapsed+=e,this.elapsed>=this.duration):(this.started=!0,!1):!0}end(){this.spec=null,this.plate=null,this.elapsed=0,this.started=!1}draw(e,t){if(!this.spec)return;const a=Vs(this.elapsed/this.duration),{kind:o,side:s}=this.spec,i=Ic[o];if(e.save(),e.fillStyle="#020406",e.fillRect(0,0,ne,Ce),t){e.restore();return}e.save(),e.beginPath(),e.rect(0,0,ne,q),e.clip();const r=this.plate;r?this.through(e,r,a,s,i,o):this.dark(e,a,i);for(let u=0;u<3;u++){const d=(u*.37+a*(.5+u*.12))%1*ne,c=q*(.42+u*.13),p=e.createRadialGradient(d,c,0,d,c,ne*.3);p.addColorStop(0,Be(i.fog,.05+.03*(1-a))),p.addColorStop(1,Be(i.fog,0)),e.fillStyle=p,e.fillRect(0,0,ne,Ce)}const h=e.createRadialGradient(ne*.5,q*.48,q*.16,ne*.5,q*.48,ne*.66);h.addColorStop(0,"rgba(0,0,0,0)"),h.addColorStop(.7,"rgba(0,0,0,0.2)"),h.addColorStop(1,`rgba(0,0,0,${.55+.3*a})`),e.fillStyle=h,e.fillRect(0,0,ne,Ce);const l=1-Mo(.04,.36,a)*Mo(0,.26,1-a);l>.001&&(e.fillStyle=`rgba(2,4,6,${l})`,e.fillRect(0,0,ne,Ce)),e.restore(),e.restore()}through(e,t,a,o,s,i){const r=Sc(a),h=1.34+Tc[i]*r,{dx:l,dy:u}=Mc(o,r),d={x:Math.max(0,Math.min(ne,(t.pivotX??0)+l)),y:Math.max(0,Math.min(q,(t.pivotY??0)+u))},c=pc(t,h,d);e.drawImage(t.image,c.sx,c.sy,c.sw,c.sh,c.dx,c.dy,c.dw,c.dh);const p=gc(c,t.x+t.w/2,t.y+t.h/2),g=(.16+.22*(1-a))*ne,m=e.createRadialGradient(p.x,p.y,0,p.x,p.y,g);m.addColorStop(0,Be(s.lamp,.22*(1-.55*a))),m.addColorStop(.35,Be(s.lamp,.07*(1-.6*a))),m.addColorStop(1,Be(s.lamp,0)),e.save(),e.globalCompositeOperation="lighter",e.fillStyle=m,e.fillRect(0,0,ne,Ce),e.restore();const b=e.createLinearGradient(o==="left"?ne:0,0,o==="left"?0:ne,0);b.addColorStop(0,`rgba(2,4,6,${.28+.42*a})`),b.addColorStop(1,"rgba(2,4,6,0.05)"),e.fillStyle=b,e.fillRect(0,0,ne,Ce),e.fillStyle=`rgba(2,4,6,${Math.max(0,(a-.35)*.9)})`,e.fillRect(0,0,ne,Ce)}dark(e,t,a){const o=e.createLinearGradient(0,0,0,q);o.addColorStop(0,"rgba(7,17,27,1)"),o.addColorStop(1,"rgba(16,26,34,1)"),e.fillStyle=o,e.fillRect(0,0,ne,Ce);const s={x:ne*.5,y:q*.5},i=ne*(.24+.1*(1-t)),r=e.createRadialGradient(s.x,s.y,0,s.x,s.y,i);r.addColorStop(0,Be(a.lamp,.2*(1-t))),r.addColorStop(1,Be(a.lamp,0)),e.save(),e.globalCompositeOperation="lighter",e.fillStyle=r,e.beginPath(),e.arc(s.x,s.y,i,0,vc),e.fill(),e.restore(),e.fillStyle=`rgba(2,4,6,${.3+.6*t})`,e.fillRect(0,0,ne,Ce)}}const Vn=1e3/60,Ac=.05,Ec=3;class Cc{constructor(){f(this,"lastT",0);f(this,"accum",0);f(this,"pendingDt",0)}tick(e){const t=this.lastT?e-this.lastT:0;if(this.lastT=e,this.accum+=t,this.pendingDt+=t,this.accum<Vn-1)return null;this.accum=Math.min(this.accum-Vn,Vn);const a=Math.min(Ac,this.pendingDt/1e3);return this.pendingDt=0,a}reset(){this.lastT=0,this.accum=0,this.pendingDt=0}}class Hc{constructor(e){f(this,"clock",new Cc);f(this,"failures",0);f(this,"fatal",!1);this.hooks=e}start(){requestAnimationFrame(e=>this.frame(e))}frame(e){try{if(this.fatal)return;const t=this.clock.tick(e);t!==null&&(this.hooks.step(t,e),this.failures=0)}catch(t){this.failures++,console.error("The Brass Compass: frame failed",t),this.failures>=Ec&&this.showFailure(t)}finally{requestAnimationFrame(t=>this.frame(t))}}showFailure(e){this.fatal||(this.fatal=!0,this.failures=0,Nc(e,{announce:t=>this.hooks.announce(t),retry:()=>{this.fatal=!1,this.failures=0,this.clock.reset()}}))}}function Nc(n,e){var r,h,l;try{e.announce("The game hit a problem. Choose Try again, or reload the page.")}catch{}if(typeof document>"u")return;const t=document.activeElement instanceof HTMLElement?document.activeElement:null,a=[],o=document.createElement("div");o.id="fatal",o.setAttribute("role","alertdialog"),o.setAttribute("aria-modal","true"),o.setAttribute("aria-labelledby","fatal-title"),o.setAttribute("aria-describedby","fatal-detail");const s=n instanceof Error&&n.message?Et(n.message):"";o.innerHTML=`
    <div class="fatal-inner">
      <h1 id="fatal-title">The game hit a problem</h1>
      <p id="fatal-detail">Something failed three frames running${s?`: ${s}`:""}.
        The voyage is still in the log. Try again, or reload the page to rebuild it from your save.</p>
      <div class="fatal-actions">
        <button type="button" id="fatal-retry">Try again</button>
        <button type="button" id="fatal-reload">Reload page</button>
      </div>
    </div>`;for(const u of Array.from(document.body.children))!(u instanceof HTMLElement)||u===o||u.id==="sr"||(a.push({el:u,was:u.inert}),u.inert=!0);const i=()=>{o.remove();for(const{el:u,was:d}of a)u.inert=d;Le(t)};o.addEventListener("keydown",u=>{if(u.stopPropagation(),u.key==="Escape"){u.preventDefault(),i(),e.retry();try{e.announce("The game is running again.")}catch{}return}if(u.key!=="Tab")return;const d=[...o.querySelectorAll("button")],c=d.indexOf(document.activeElement),p=d.length?(c+(u.shiftKey?-1:1)+d.length)%d.length:-1;u.preventDefault(),p>=0&&d[p].focus()}),document.body.append(o),(r=o.querySelector("#fatal-retry"))==null||r.addEventListener("click",()=>{i(),e.retry();try{e.announce("The game is running again.")}catch{}}),(h=o.querySelector("#fatal-reload"))==null||h.addEventListener("click",()=>location.reload()),(l=o.querySelector("#fatal-retry"))==null||l.focus()}const Lc={"alley.boat_shed":{side:"left",kind:"door"},"alley.counting_door":{side:"right",kind:"door"},"alley.chandlery_door":{side:"right",kind:"door"},"alley.to_dock":{side:"left",kind:"path"},"arcadia_cabin.ladder":{side:"above",kind:"stair"},"lantern_deck.cabin_door":{side:"right",kind:"door"},"below_decks.ladder":{side:"above",kind:"stair"},"bow_fog.aft":{side:"left",kind:"path"},"crows_nest.shrouds":{side:"below",kind:"hatch"},"marrow_cabin.gallery":{side:"right",kind:"door"},"marrow_cabin.door_out":{side:"left",kind:"door"},"marrow_deck.shrouds":{side:"above",kind:"stair"},"marrow_deck.forward":{side:"left",kind:"path"},"marrow_deck.hatch":{side:"below",kind:"hatch"},"marrow_deck.stairs_up":{side:"above",kind:"stair"},"marrow_gallery.doors":{side:"left",kind:"door"},"marrow_quarterdeck.cabin_door":{side:"right",kind:"door"},"marrow_quarterdeck.stairs_down":{side:"below",kind:"stair"},"chandlery.door_out":{side:"left",kind:"door"},"counting_house.door_out":{side:"left",kind:"door"},"dock.tavern_door":{side:"left",kind:"door"},"dock.office_door":{side:"right",kind:"door"},"dock.alley_mouth":{side:"right",kind:"path"},"dock.road":{side:"right",kind:"path"},"dock.pier":{side:"right",kind:"path"},"office.door_out":{side:"left",kind:"door"},"pier_end.town":{side:"left",kind:"path"},"quay.harbour_mouth":{side:"left",kind:"path"},"quay.harbour":{side:"right",kind:"path"},"tavern.door_out":{side:"left",kind:"door"},"warehouse.lane_door":{side:"right",kind:"door"},"far_pans.camp":{side:"right",kind:"path"},"key_gate.path":{side:"left",kind:"path"},"lagoon_shore.reef_gate":{side:"right",kind:"path"},"lagoon_shore.boat":{side:"left",kind:"path"},"reef_wreck.boat":{side:"left",kind:"path"},"reef_wreck.salt_flats":{side:"right",kind:"path"},"salt_camp.shore_path":{side:"left",kind:"path"},"salt_camp.pans_path":{side:"left",kind:"path"},"village.steps_down":{side:"left",kind:"path"},"village.light_path":{side:"right",kind:"path"},"weather_works.path_down":{side:"left",kind:"path"}},$c={"dock.road":"steps","village.steps_down":"steps","village.light_path":"street","weather_works.path_down":"street","dock.pier":"quay","quay.harbour":"quay","quay.harbour_mouth":"quay","pier_end.town":"quay","lagoon_shore.boat":"water","reef_wreck.boat":"water","marrow_deck.forward":"planks","bow_fog.aft":"planks"};function Dc(n){switch(n){case"left":return"right";case"right":return"left";case"above":return"below";case"below":return"above"}}function Rc(n){return!n||n.kind==="door"?null:Dc(n.side)}function qc(n,e){return Lc[`${n}.${e}`]??null}function Pc(n,e){return $c[`${n}.${e}`]??null}const xo=.55,Ao=.62,Eo=5,Oc=n=>n*n*(3-2*n);class Wc{constructor(){f(this,"rings",[]);f(this,"flights",[]);f(this,"fresh",new Map)}ring(e,t){this.rings.length=0,this.rings.push({x:e.x,y:e.y,size:t,t:0})}flight(e,t,a,o){this.flights.push({id:e,label:t,icon:o,from:{...a},t:0}),this.fresh.set(e,Eo)}freshen(e){this.fresh.set(e,Eo)}seen(e){this.fresh.delete(e)}clear(){this.rings.length=0,this.flights.length=0}update(e){for(const t of this.rings)t.t+=e;for(const t of this.flights)t.t+=e;for(this.rings.length&&this.rings[0].t>xo&&(this.rings.length=0);this.flights.length&&this.flights[0].t>Ao;)this.flights.shift();for(const[t,a]of this.fresh)a-e<=0?this.fresh.delete(t):this.fresh.set(t,a-e)}glows(){if(!this.fresh.size)return null;const e={};for(const[t,a]of this.fresh)this.flights.some(o=>o.id===t)||(e[t]=Math.min(1,a/1.2));return e}drawWorld(e,t){for(const a of this.rings){const o=Math.min(1,a.t/xo),s=t?1:.45+.55*(1-(1-o)*(1-o)),i=a.size*.2*s,r=i*.32;e.save(),e.globalAlpha=(1-o)*.85,e.strokeStyle="#ecd29a",e.lineWidth=Math.max(1.5,a.size*.012),e.beginPath(),e.ellipse(a.x,a.y,i,r,0,0,Math.PI*2),e.stroke(),e.globalAlpha*=.5,e.beginPath(),e.ellipse(a.x,a.y,i*.5,r*.5,0,0,Math.PI*2),e.stroke(),e.restore()}}drawScreen(e,t,a){if(!a)for(const o of this.flights){const s=t(o.id);if(!s)continue;const i=Oc(Math.min(1,o.t/Ao)),r=s.x+s.w/2,h=s.y+s.h/2,l=(o.from.x+r)/2,u=Math.min(o.from.y,h)-160,d=(1-i)*(1-i)*o.from.x+2*(1-i)*i*l+i*i*r,c=(1-i)*(1-i)*o.from.y+2*(1-i)*i*u+i*i*h,p=1-.35*i;if(e.save(),e.globalAlpha=i>.85?(1-i)/.15:1,e.translate(d,c),e.scale(p,p),o.icon&&o.icon.width>0){const g=Math.min(72/o.icon.width,72/o.icon.height);e.drawImage(o.icon,-o.icon.width*g/2,-o.icon.height*g/2,o.icon.width*g,o.icon.height*g)}else{e.font="italic 24px Georgia, serif";const g=e.measureText(o.label).width+28;e.fillStyle="rgba(20,16,10,0.9)",e.fillRect(-g/2,-21,g,42),e.strokeStyle="rgba(255,226,160,0.95)",e.lineWidth=2,e.strokeRect(-g/2+1,-20,g-2,40),K(e,o.label,0,-13,{size:24,color:"#fff3cf",align:"center",weight:"italic",shadow:!1})}e.restore()}}}const Co=2560,Fc=1.4,Ho=.5,Bc=1.5,Vc=.9,Gc=.25,zc=.5,No=.5,Lo=.8,Kc=14,$o=250,Uc=960,Yc=n=>1-(1-n)*(1-n)*(1-n);class jc{constructor(e,t,a=()=>{}){f(this,"t",0);f(this,"backdrop",null);f(this,"painted",!1);f(this,"book",null);f(this,"page",0);f(this,"pageStarts",[]);this.card=e,this.assets=t,this.say=a}get pageCount(){var e;return((e=this.book)==null?void 0:e.pages.length)??1}get pageNumber(){return this.page+1}entryAt(e,t){var i;const a=(i=this.book)==null?void 0:i.pages[e],o=(a==null?void 0:a.indices[t])??t,s=o===this.card.lines.length-1&&o>0;return e===0?Bc+o*Vc+(s?No:0):this.pageStart(e)+Gc+t*zc+(s?No:0)}pageStart(e){return e===0?0:this.pageStarts[e]??this.t}pageDoneAt(e){var o;const t=(o=this.book)==null?void 0:o.pages[e],a=t?t.indices.length:this.card.lines.length;return this.entryAt(e,Math.max(0,a-1))+Lo}get revealed(){return this.t>=this.pageDoneAt(this.page)}update(e){this.t+=e}advance(){var a;const e=this.pageDoneAt(this.page);if(this.t<e)return this.t=Math.max(this.t,e),!1;const t=this.pageCount;if(this.page<t-1){this.page+=1,this.pageStarts[this.page]=this.t;const o=(a=this.book)==null?void 0:a.pages[this.page],s=o?o.indices.map(i=>this.card.lines[i]).join(" "):"";return this.say(`page ${this.page+1} of ${t}. ${s}`.trim()),!1}return!0}render(e,t,a){this.bake();const o=this.lay(e,a);this.page=Math.min(this.page,o.pages.length-1);const s=o.pages[this.page];if(e.fillStyle="#03050c",e.fillRect(0,0,S,V),this.backdrop){if(e.save(),e.globalAlpha=Math.min(1,this.t/Fc),!t){const h=1.02+.03*Math.min(1,this.t/40);e.translate(S/2,V/2),e.scale(h,h),e.translate(-S/2,-V/2)}e.drawImage(this.backdrop,0,0),e.restore()}const i=h=>Math.max(0,Math.min(1,(this.t-h)/Lo)),r=h=>t?0:(1-Yc(h))*Kc;if(e.save(),this.page===0){const h=he(e,this.card.title,1700,o.titleSize,24,"bold");let l=i(Ho);e.globalAlpha=l,K(e,h.text,S/2,s.titleY+r(l),{size:h.size,color:"#c9a24a",align:"center",weight:"bold"}),l=i(Ho+.35),e.globalAlpha=l,e.fillStyle="rgba(201,162,74,0.6)",e.fillRect(S/2-70*a*l,s.ruleY,140*a*l,2)}if(s.blocks.forEach((h,l)=>{const u=i(this.entryAt(this.page,l));u<=0||(e.globalAlpha=u,h.lines.forEach((d,c)=>K(e,d,S/2,h.y+c*o.lh+r(u),{size:o.size,color:h.gold?"#c9a24a":"#e6ddc8",align:"center",weight:h.gold?"bold":"normal"})))}),this.page===o.pages.length-1){const h=i(this.pageDoneAt(this.page));if(h>0){e.globalAlpha=h;const l=he(e,"click or press Enter to return to the title  ·  Chapter select is open to you now",1820,o.footerSize,14);K(e,l.text,S/2,s.footerY,{size:l.size,color:"#d4b064",align:"center"})}}if(o.pages.length>1){e.globalAlpha=1;const h=he(e,`${this.page+1} / ${o.pages.length}`,260,Math.round(18*a),12);K(e,h.text,S-80,54,{size:h.size,color:"rgba(212,176,100,0.85)",align:"right",shadow:!1})}e.restore()}lay(e,t){var x;if(((x=this.book)==null?void 0:x.scale)===t)return this.book;const a=Uc-$o,o=1300,s=this.card.lines.length,i=T=>T===s-1&&s>1,r=T=>this.card.lines.map((N,C)=>je(e,N,o,{size:T,weight:i(C)?"bold":"normal"})),h=(T,N)=>N.reduce((C,D)=>C+D.length*Math.round(T*1.4)+Math.round(T*.6),0);let l=28,u=r(l);for(;l>18&&h(l,u)>a;)u=r(--l);const d=t<=1?l:Math.round(l*t),c=t<=1?u:r(d),p=Math.round(d*1.4),g=Math.round(d*.6),m=[];let b=[],y=0;c.forEach((T,N)=>{const C=T.length*p+g;b.length&&y+C>a&&(m.push(b),b=[],y=0),b.push(N),y+=C}),b.length&&m.push(b),m.length||m.push([]);const _=m.map(T=>{const N=T.reduce((B,W)=>B+c[W].length*p+g,0);let C=$o+Math.max(0,(a-N)/3);const D=C,Q=T.map(B=>{const W={lines:c[B],y:C+(i(B)?d*.4:0),gold:i(B)};return C+=c[B].length*p+g,W});return{indices:T,blocks:Q,titleY:D-Math.round(120*t),ruleY:D-Math.round(50*t),footerY:Math.min(1040,Math.max(1e3,C+30))}});return this.book={scale:t,size:d,lh:p,pages:_,titleSize:Math.round(40*t),footerSize:Math.round(20*t)},this.book}bake(){var i,r;const e=this.assets.img(this.card.image);if(this.backdrop&&(this.painted||!e))return;const t=this.backdrop??document.createElement("canvas");t.width=S,t.height=V;const a=t.getContext("2d");if(!a)return;if(a.fillStyle="#03050c",a.fillRect(0,0,S,V),e&&e.width>0){const u=document.createElement("canvas");u.width=320,u.height=180;const d=u.getContext("2d");if(d){d.imageSmoothingQuality="high";const c=Math.max(320/e.width,180/e.height),p=e.width*c,g=e.height*c,m=(((i=this.card.focus)==null?void 0:i.x)??Co/2)/Co*e.width,b=(((r=this.card.focus)==null?void 0:r.y)??q/2)/q*e.height,y=Math.max(320-p,Math.min(0,320/2-m*c)),_=Math.max(180-g,Math.min(0,180/2-b*c));d.drawImage(e,y,_,p,g),a.imageSmoothingEnabled=!0,a.imageSmoothingQuality="high",a.drawImage(u,0,0,S,V),this.painted=!0}}const o=a.createLinearGradient(0,0,0,V);o.addColorStop(0,"rgba(3,5,12,0.58)"),o.addColorStop(.45,"rgba(3,5,12,0.5)"),o.addColorStop(1,"rgba(3,5,12,0.84)"),a.fillStyle=o,a.fillRect(0,0,S,V);const s=a.createRadialGradient(S/2,V/2,V*.3,S/2,V/2,V*.95);s.addColorStop(0,"rgba(0,0,0,0)"),s.addColorStop(1,"rgba(0,0,0,0.55)"),a.fillStyle=s,a.fillRect(0,0,S,V),this.backdrop=t}}const Xc="dock",Qc={lantern:{rgb:[255,178,96],alpha:.22,amp:.3,speed:1,jitter:0},candle:{rgb:[255,196,120],alpha:.24,amp:.4,speed:1.6,jitter:0},fire:{rgb:[255,128,52],alpha:.28,amp:.35,speed:1.3,jitter:4},lamp:{rgb:[255,214,150],alpha:.16,amp:.04,speed:.3,jitter:0},moon:{rgb:[170,196,255],alpha:.1,amp:0,speed:0,jitter:0}},Jt=[2.3,5.9,13.7],Gn=[.55,.3,.15],Jc=200,Zc=.06,eu=3,Do=4,st=1024,Ro=4,tu="#c9d2dc",nu=28,au={dust:[236,228,208],embers:[255,150,60],steam:[226,229,232],glints:[255,244,214]},ou=1500,qo=110,Zt=[255,236,186],Vt=6,Gt=4,kn=Math.PI*2,it=(n,e)=>(n%e+e)%e,Gs=n=>n<0?0:n>1?1:n,en=(n,e,t)=>{const a=Gs((t-n)/(e-n));return a*a*(3-2*a)};function zs(n){let e=Math.floor(Math.abs(n))%2147483646+1;return()=>(e=e*16807%2147483647)/2147483647}function su(n){const e=Math.sin(n*127.1)*43758.5453;return e-Math.floor(e)}function Ks(n){const e=n.length===4?n[1]+n[1]+n[2]+n[2]+n[3]+n[3]:n.slice(1,7),t=parseInt(e,16);return[t>>16&255,t>>8&255,t&255]}function dt(n,e){const t=document.createElement("canvas");return t.width=Math.max(1,Math.ceil(n)),t.height=Math.max(1,Math.ceil(e)),t}const Po=new Map;function un(n){const e=n.join(","),t=Po.get(e);if(t)return t;const a=256,o=dt(a,a),s=o.getContext("2d"),i=s.createRadialGradient(a/2,a/2,0,a/2,a/2,a/2),r=h=>`rgba(${n[0]},${n[1]},${n[2]},${h})`;return i.addColorStop(0,r(1)),i.addColorStop(.18,r(.55)),i.addColorStop(.5,r(.16)),i.addColorStop(1,r(0)),s.fillStyle=i,s.fillRect(0,0,a,a),Po.set(e,o),o}let zn=null;function iu(){if(zn)return zn;const n=512,e=64,t=dt(n,e),a=t.getContext("2d"),o=a.createImageData(n,e);for(let s=0;s<e;s++){const i=(s+.5-e/2)/(e/2);for(let r=0;r<n;r++){const h=(r+.5)/n,l=.08+.92*h,u=Math.exp(-3*(i/l)*(i/l)),d=Math.pow(1-h,1.5)*Math.min(1,h/.03),c=(s*n+r)*4;o.data[c]=Zt[0],o.data[c+1]=Zt[1],o.data[c+2]=Zt[2],o.data[c+3]=Math.round(255*u*d)}}return a.putImageData(o,0,0),zn=t}function ru(n){let e=n.length;for(let t=0;t<n.length;t++)e=(e*31+n[t].x*7.13+n[t].y*3.71)%1e9;return e}function tn(n){return nn({poly:n,sig:NaN,path:new Path2D,x0:0,y0:0,x1:0,y1:0})}function nn(n){const e=ru(n.poly);return e===n.sig||(n.sig=e,n.path=new Path2D,n.x0=n.y0=1/0,n.x1=n.y1=-1/0,n.poly.forEach((t,a)=>{a?n.path.lineTo(t.x,t.y):n.path.moveTo(t.x,t.y),n.x0=Math.min(n.x0,t.x),n.y0=Math.min(n.y0,t.y),n.x1=Math.max(n.x1,t.x),n.y1=Math.max(n.y1,t.y)}),n.path.closePath()),n}function ma(n,e,t){let a=!1;for(let o=0,s=n.length-1;o<n.length;s=o++){const i=n[o],r=n[s];i.y>t!=r.y>t&&e<(r.x-i.x)*(t-i.y)/(r.y-i.y)+i.x&&(a=!a)}return a}function hu(n,e,t){let a=1/0;for(let o=0,s=n.length-1;o<n.length;s=o++){const i=n[s],r=n[o],h=r.x-i.x,l=r.y-i.y,u=h*h+l*l,d=u?Gs(((e-i.x)*h+(t-i.y)*l)/u):0,c=i.x+d*h-e,p=i.y+d*l-t;a=Math.min(a,c*c+p*p)}return Math.sqrt(a)}function lu(n){let e=0;for(let t=0,a=n.length-1;t<n.length;a=t++)e+=n[a].x*n[t].y-n[t].x*n[a].y;return Math.abs(e)/2}const ba=8;function du(n){const e=Qc[n.kind];let t=e.amp,a=e.speed;return n.radius>=Jc&&(t=Math.min(t,Zc/e.alpha),a=Math.min(a,eu*kn/Jt[2]*.95)),{src:n,sprite:un(n.colour?Ks(n.colour):e.rgb),alpha:e.alpha,amp:t,speed:a,jitter:e.jitter,phase:su(n.at.x*.37+n.at.y)*100}}function cu(n,e){const t=tn(n.area),a=zs(1+e*7919+Math.round(t.x0*13+t.y0*7)),o=t.x1-t.x0,s=t.y1-t.y0,i=n.kind==="dust"?Math.min(n.count*4,Math.ceil(n.count*o*s/Math.max(1,lu(n.area)))):n.count,r=new Float32Array(i*ba);for(let l=0;l<i;l++){const u=l*ba;let d=a(),c=a();if(n.kind!=="dust")for(let p=0;p<40&&!ma(n.area,t.x0+d*o,t.y0+c*s);p++)d=a(),c=a();r[u]=d,r[u+1]=c,r[u+2]=a()*kn,r[u+3]=a(),r[u+4]=a(),r[u+5]=a(),r[u+6]=a(),r[u+7]=a()}const h=au[n.kind];return{src:n,shape:t,n:i,seeds:r,rgb:h,sprite:un(h),tinted:!1,style:`rgb(${h[0]},${h[1]},${h[2]})`}}function uu(n,e){let t=7;const a=()=>(t=t*16807%2147483647)/2147483647,o=Array.from({length:Vt*Gt},()=>({path:new Path2D,sum:0,n:0,phase:0}));for(let s=0;s<Math.round(n/9);s++){const i=a()*n,r=a()*e,h=.6+a()*1.6,l=a()*6.3,u=(.5+.5*a())*(1-.7*r/e),d=Math.min(Vt-1,Math.floor(l/6.3*Vt)),c=Math.min(Gt-1,Math.floor(u*Gt)),p=o[d*Gt+c];p.path.moveTo(i+h,r),p.path.arc(i,r,h,0,kn),p.sum+=u,p.n++,p.phase=(d+.5)/Vt*6.3}return{width:n,maxY:e,moon:null,groups:o.filter(s=>s.n).map(s=>({path:s.path,alpha:s.sum/s.n,phase:s.phase}))}}function Oo(n,e,t,a,o){const s=Math.floor(a),i=Math.floor(o),r=a-s,h=o-i,l=r*r*(3-2*r),u=h*h*(3-2*h),d=it(s,e),c=(d+1)%e,p=Math.min(t-1,Math.max(0,i)),g=Math.min(t-1,p+1),m=n[p*e+d],b=n[p*e+c],y=n[g*e+d],_=n[g*e+c];return m+(b-m)*l+(y-m)*u+(m-b-y+_)*l*u}function Wo(n,e,t){const a=st/Ro,o=Math.max(4,Math.round((n.bottom-n.top)/Ro)),s=dt(a,o),i=s.getContext("2d"),r=i.createImageData(a,o),h=zs(e),l=t,u=4,d=t*3,c=7,p=new Float32Array(l*u).map(h),g=new Float32Array(d*c).map(h),[m,b,y]=Ks(n.tint??tu),{top:_,bottom:x}=n,T=Math.min(n.floor,x-.2*(x-_)),N=_+.3*(Math.max(T,_+1)-_);for(let C=0;C<o;C++){const D=C/(o-1),Q=_+D*(x-_),B=en(_,N,Q)*(1-en(T,x,Q));for(let W=0;W<a;W++){const j=.65*Oo(p,l,u,W/a*l,D*(u-1))+.35*Oo(g,d,c,W/a*d,D*(c-1)),I=(C*a+W)*4;r.data[I]=m,r.data[I+1]=b,r.data[I+2]=y,r.data[I+3]=Math.round(255*B*(.25+.75*en(.2,.75,j)))}}return i.putImageData(r,0,0),s}const Fo=/\btone\(\s*([\d.]+)\s*\)/,Bo=/\blift\(\s*([\d.]+)\s*\)/;function fu(n,e,t,a){if(a<=0)return;const o=Math.round(Math.min(1,a)*255);n.save(),n.globalCompositeOperation="screen",n.fillStyle=`rgb(${Math.round(o*.96)},${Math.round(o*.98)},${o})`,n.fillRect(0,0,e,t),n.restore()}function pu(n,e,t,a){a<=0||(n.save(),n.globalCompositeOperation="multiply",n.globalAlpha=Math.min(1,a),n.fillStyle="#6f78b8",n.fillRect(0,0,e,t),n.globalCompositeOperation="soft-light",n.globalAlpha=Math.min(1,a*.8),n.fillStyle="#ffb462",n.fillRect(0,0,e,t),n.restore())}class gu{constructor(e){f(this,"scene",null);f(this,"titleScene",null);f(this,"titleView",{cameraX:0,time:0,reduced:!1});f(this,"source");f(this,"sourceW",0);f(this,"sourceH",0);f(this,"baked",null);f(this,"lamp",null);f(this,"bakedFrom",null);f(this,"bakedCss","");f(this,"frameCtx",null);f(this,"frameView",null);this.host=e}setRoom(e){this.scene=this.prepare(e),!e.backdrop&&this.baked&&(this.baked.width=this.baked.height=0,this.baked=this.bakedFrom=null,this.bakedCss="")}prepare(e){const t={room:e,lights:(e.lights??[]).map(du),water:(e.water??[]).map(a=>({src:a,shape:tn(a.area),scratch:null})),haze:[],motes:(e.motes??[]).map(cu),sky:e.stars?uu(e.width??S,e.stars.y):null,occluders:new Map((e.occluders??[]).map(a=>[a.area,tn(a.area)]))};return t.haze=(e.haze??[]).map((a,o)=>{const s={src:a,tex:null,drawable:{y:a.floor,draw:()=>this.drawHaze(s,o)}};return s}),t}plate(){var d;const e=(d=this.scene)==null?void 0:d.room,t=e?this.host.image(e.bg):void 0;if(this.source=void 0,!e||!t||!t.naturalWidth)return;const a=(e.backdrop??"").trim();if(!a||a==="none")return this.use(t,t.naturalWidth,t.naturalHeight);if(this.baked&&this.bakedFrom===t&&this.bakedCss===a)return this.use(this.baked,this.baked.width,this.baked.height);const o=t.naturalWidth,s=t.naturalHeight,i=this.baked??dt(o,s);i.width=o,i.height=s;const r=i.getContext("2d"),h=Fo.exec(a),l=Bo.exec(a),u=a.replace(Fo," ").replace(Bo," ").trim();return cn()?(r.filter=u||"none",r.drawImage(t,0,0),r.filter="none"):(r.drawImage(t,0,0),u&&Os(r,o,s,u)),h&&pu(r,o,s,Math.max(0,Math.min(1,Number(h[1])))),l&&fu(r,o,s,Math.max(0,Math.min(1,Number(l[1])))),this.baked=i,this.bakedFrom=t,this.bakedCss=a,this.use(i,o,s)}use(e,t,a){return this.source=e,this.sourceW=t,this.sourceH=a,e}occlude(e,t){const a=this.scene,o=this.source;if(!a||!o)return;let s=a.occluders.get(t.area);s||a.occluders.set(t.area,s=tn(t.area)),nn(s);const i=a.room.width??S,r=Math.max(0,Math.floor(s.x0)),h=Math.max(0,Math.floor(s.y0)),l=Math.min(i,Math.ceil(s.x1)),u=Math.min(q,Math.ceil(s.y1));if(l<=r||u<=h)return;const d=this.sourceW/i,c=this.sourceH/q;e.save(),e.clip(s.path),e.drawImage(o,r*d,h*c,(l-r)*d,(u-h)*c,r,h,l-r,u-h),e.restore()}under(e,t){const a=this.scene;if(!a)return;const o=t.cameraX,s=t.cameraX+S;if(a.sky&&this.drawSky(e,a.sky,t,o),a.room.beacon&&this.drawBeacon(e,a.room.beacon,t),this.source&&this.drawWater(e,a,this.source,this.sourceW,this.sourceH,t,o,s),!t.reduced)for(const i of a.motes)i.src.kind!=="dust"&&this.drawMotes(e,i,t.time,o,s)}depth(e,t,a){if(this.frameCtx=t,this.frameView=a,this.scene)for(const o of this.scene.haze)e.push(o.drawable)}over(e,t){const a=this.scene;if(!a)return;const o=t.cameraX,s=t.cameraX+S;if(this.drawLights(e,a,t,o,s),!t.reduced)for(const i of a.motes)i.src.kind==="dust"&&this.drawMotes(e,i,t.time,o,s)}title(e,t,a,o){var _;const s=le[Xc],i=s?this.host.image(s.bg):void 0;if(!s||!i||!i.naturalWidth)return;((_=this.titleScene)==null?void 0:_.room)!==s&&(this.titleScene=this.prepare(s));const r=this.titleScene,h=o?o.w:V*(i.naturalWidth/i.naturalHeight),l=o?o.h:V,u=o?o.x:(S-h)/2,d=o?o.y:0,c=s.width??S,p=h/c,g=l/q,m=Math.max(0,-u/p),b=Math.min(c,(S-u)/p),y=this.titleView;y.cameraX=m,y.time=t,y.reduced=a,e.save(),e.translate(u,d),e.scale(p,g),this.drawWater(e,r,i,i.naturalWidth,i.naturalHeight,y,m,b),this.drawLights(e,r,y,m,b),e.restore()}drawLights(e,t,a,o,s){if(!t.lights.length)return;const i=a.time;e.save(),e.globalCompositeOperation="screen";for(const r of t.lights){const{at:h,radius:l}=r.src;if(h.x+l<o||h.x-l>s||r.src.showIf&&!this.holds(r.src.showIf))continue;let u=1,d=0;if(!a.reduced&&r.amp){const p=r.speed,g=r.phase,m=Gn[0]*Math.sin(i*Jt[0]*p+g)+Gn[1]*Math.sin(i*Jt[1]*p+g*.37)+Gn[2]*Math.sin(i*Jt[2]*p+g*.61);u=1+.5*r.amp*m,r.jitter&&(d=r.jitter*Math.sin(i*7.3+g))}const c=l*(1+.04*(u-1));e.globalAlpha=r.alpha*u,e.drawImage(r.sprite,h.x-c+d,h.y-c,c*2,c*2)}e.restore()}holds(e){for(let t=0;t<e.length;t++)if(!this.host.check(e[t]))return!1;return!0}drawWater(e,t,a,o,s,i,r,h){if(i.reduced||!t.water.length)return;const l=i.time,u=t.room.width??S,d=o/u,c=s/q;for(const p of t.water){const g=nn(p.shape),m=Math.floor(Math.max(g.x0,r,0)),b=Math.ceil(Math.min(g.x1,h,u)),y=Math.floor(Math.max(g.y0,0)),_=Math.ceil(Math.min(g.y1,q));if(b<=m||_<=y)continue;const x=b-m,T=_-y,N=Math.max(1,g.y1-g.y0);let C=p.scratch;(!C||C.canvas.width<x||C.canvas.height<T)&&(C=p.scratch=dt(Math.ceil(g.x1-g.x0)+2,Math.ceil(g.y1-g.y0)+2).getContext("2d")),C.globalCompositeOperation="source-over",C.clearRect(0,0,x,T);for(let D=y;D<_;D+=Do){const Q=(D-g.y0)/N,B=p.src.ripple*(.35+.65*Q),W=B*Math.sin(l*1.7+D*(.16-.08*Q))+.5*B*Math.sin(l*.9-D*.05),j=Math.min(Do,_-D);C.drawImage(a,m*d,D*c,x*d,j*c,W,D-y,x,j)}C.globalCompositeOperation="destination-in",C.translate(-m,-y),C.fill(g.path),C.setTransform(1,0,0,1,0,0),e.drawImage(C.canvas,0,0,x,T,m,y,x,T)}}drawSky(e,t,a,o){e.save(),e.globalCompositeOperation="screen",t.moon||(t.moon=e.createRadialGradient(t.width*.5,t.maxY*.3,0,t.width*.5,t.maxY*.3,t.maxY*1.1),t.moon.addColorStop(0,"rgba(170,190,240,0.22)"),t.moon.addColorStop(1,"rgba(170,190,240,0)")),e.fillStyle=t.moon,e.fillRect(o,0,S,t.maxY*1.5),e.fillStyle="rgb(235,240,255)";for(const s of t.groups)e.globalAlpha=s.alpha*(a.reduced?.75:.75+.25*Math.sin(a.time*1.3+s.phase)),e.fill(s.path);e.restore()}drawBeacon(e,t,a){const{x:o,y:s}=t.at,i=this.lamp??(this.lamp=un(Zt));if(e.save(),e.globalCompositeOperation="screen",a.reduced){e.globalAlpha=.22,e.drawImage(i,o-130,s-130,260,260),e.restore();return}const r=kn*(a.time/t.period+.3),h=Math.cos(r),l=Math.sin(r),u=ou*(.12+.88*Math.abs(h)),d=.3*en(-.6,.2,l);d>.002&&(e.translate(o,s),e.rotate(Math.atan2(-.2*l,h)),e.globalAlpha=d,e.drawImage(iu(),0,-qo/2,u,qo)),e.restore(),e.save(),e.globalCompositeOperation="screen";const c=Math.max(0,l);e.globalAlpha=.16+.5*c*c*c,e.drawImage(i,o-130,s-130,260,260),e.restore()}drawHaze(e,t){const a=this.frameCtx,o=this.frameView;if(!a||!o)return;e.tex??(e.tex=[Wo(e.src,101+t*31,5),Wo(e.src,211+t*17,3)]);const s=o.reduced?0:o.time,i=e.src.bottom-e.src.top;a.save();for(let r=0;r<2;r++){const h=it(s*e.src.speed*(r?1.7:1)+r*377,st);a.globalAlpha=e.src.alpha*(r?.5:.65);let l=h+Math.floor((o.cameraX-h)/st)*st;for(;l<o.cameraX+S;l+=st)a.drawImage(e.tex[r],l,e.src.top,st,i)}a.restore()}drawMotes(e,t,a,o,s){const i=nn(t.shape);if(i.x1<o-200||i.x0>s+200)return;!t.tinted&&this.source&&this.tint(t);const r=i.x1-i.x0,h=i.y1-i.y0,l=t.seeds,u=t.src.area;e.save(),e.globalCompositeOperation=t.src.kind==="embers"?"lighter":"screen",e.fillStyle=t.style;for(let d=0;d<t.n;d++){const c=d*ba,p=l[c],g=l[c+1],m=l[c+2],b=l[c+3];switch(t.src.kind){case"dust":{const y=(l[c+4]-.5)*6,_=1+l[c+5]*4,x=i.x0+it(p*r+y*a+8*Math.sin(.3*a+m),r),T=i.y0+it(g*h+_*a+5*Math.sin(.23*a+1.3*m),h);if(x<o||x>s||!ma(u,x,T))continue;const N=Math.min(1,hu(u,x,T)/nu);e.globalAlpha=.7*(.55+.45*Math.sin(.8*a+m))*N;const C=2.4+b*4.4;e.drawImage(t.sprite,x-C,T-C,C*2,C*2);break}case"embers":{const y=2.2+l[c+4]*1.8,_=it(a/y+l[c+7],1),x=i.x0+p*r+Math.sin(1.3*a+m)*18*_+(l[c+5]-.3)*60*_,T=i.y0+g*h-_*(260+l[c+6]*160);if(x<o||x>s)continue;e.globalAlpha=(1-_)*(.65+.35*Math.sin(17*a+m));const N=(3+b*4)*(1-.45*_);e.drawImage(t.sprite,x-N,T-N,N*2,N*2);break}case"steam":{const y=3+l[c+4]*2,_=it(a/y+l[c+7],1),x=i.x0+p*r+(l[c+5]-.5)*40*_+Math.sin(.9*a+m)*5*_,T=i.y0+g*h-_*(60+l[c+6]*70);if(x<o-60||x>s+60)continue;e.globalAlpha=.16*Math.sin(Math.PI*_);const N=(6+b*6)*(1+3.5*_);e.drawImage(t.sprite,x-N,T-N,N*2,N*2);break}case"glints":{const y=Math.sin((2+l[c+4]*3)*a+m);if(y<.8)continue;const _=(y-.8)/.2,x=_*_,T=i.x0+p*r,N=i.y0+g*h;if(T<o||T>s)continue;const C=4+(8+14*l[c+6])*g,D=4+5*g;e.globalAlpha=.45*x,e.drawImage(t.sprite,T-D,N-D,D*2,D*2),e.globalAlpha=.9*x,e.fillRect(T-C/2,N-.5,C,1+g);break}}}e.restore()}tint(e){e.tinted=!0;const t=this.scene;if(!(e.src.kind!=="dust"||!t||t.motes.indexOf(e)<0||!this.source))try{const a=t.room.width??S,o=1/8,s=Math.ceil(a*o),i=Math.ceil(q*o),r=dt(s,i),h=r.getContext("2d",{willReadFrequently:!0});h.drawImage(this.source,0,0,s,i);const l=h.getImageData(0,0,s,i).data;let u=0,d=0,c=0,p=0;for(let b=0;b<i;b++)for(let y=0;y<s;y++){if(!ma(e.src.area,(y+.5)/o,(b+.5)/o))continue;const _=(b*s+y)*4;u+=l[_],d+=l[_+1],c+=l[_+2],p++}if(!p)return;const g=Math.max(u,d,c)/p||1,m=b=>Math.round(.45*(b/p*255)/g+.55*255);e.rgb=[m(u),m(d),m(c)],e.sprite=un(e.rgb),e.style=`rgb(${e.rgb[0]},${e.rgb[1]},${e.rgb[2]})`}catch{}}}const Oe=n=>n<0?0:n>255?255:n,mu={lantern:[255,178,96],candle:[255,196,120],fire:[255,128,52],lamp:[255,214,150],moon:[170,196,255]},bu=[255,226,190],wu=[176,198,220],Kn=(n,e,t)=>[n[0]+(e[0]-n[0])*t,n[1]+(e[1]-n[1])*t,n[2]+(e[2]-n[2])*t];function Vo(n){if(!n)return null;const e=n.trim(),t=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(e);if(t){const o=t[1];return o.length===3?[parseInt(o[0]+o[0],16),parseInt(o[1]+o[1],16),parseInt(o[2]+o[2],16)]:[parseInt(o.slice(0,2),16),parseInt(o.slice(2,4),16),parseInt(o.slice(4,6),16)]}const a=/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i.exec(e);return a?[Number(a[1]),Number(a[2]),Number(a[3])]:null}function yu(n,e,t,a,o){const s=n.lights??[];let i=0;for(let d=0;d<s.length&&d<20;d++)(!o||o(s[d]))&&(i|=1<<d);const r=((Math.round(e/6)+2048)*1024+(Math.round(t/6)+256))*512+Math.min(511,Math.round(a/4));let h=Go.get(n);h||(h=new Map,Go.set(n,h));const l=h.get(r);if(l&&l.lit===i)return l.wrap;const u=ku(n,e,t,a,o);return h.size>1500&&h.clear(),h.set(r,{lit:i,wrap:u}),u}const Go=new WeakMap;function ku(n,e,t,a,o){var m;let s=bu,i=.28;const r=n.haze??[];let h=0;for(const b of r)t>=b.top-160&&t<=b.bottom+220&&(h=Math.max(h,Math.min(1,b.alpha*2.4)));if(h>0){const b=Kn(Vo((m=r.find(y=>y.tint))==null?void 0:m.tint)??wu,[92,112,136],.45);s=Kn(s,b,h*.7),i=Math.max(i,.22+h*.1)}let l=null;for(const b of n.lights??[]){if(o&&!o(b))continue;const y=Math.max(360,b.radius*(b.kind==="lantern"&&b.colour&&b.radius>=150?6:2.6)),_=Math.hypot(b.at.x-e,b.at.y-t);if(_>=y)continue;const x=(1-_/y)**2,T=Vo(b.colour)??mu[b.kind];if(s=Kn(s,T,x*.85),i=Math.max(i,.2+x*.14),!l||x>l.k){const N=b.at.x-e;l={k:x,rgb:T,side:Math.abs(N)<a*.18?0:N>0?1:-1}}}const u=(b,y)=>Math.round(b/y)*y,d=Math.round(Math.min(.36,i)*10)/10,c=Math.max(10,Math.round(Math.min(32,a*.08)/2)*2),p=[Oe(s[0]),Oe(s[1]),Oe(s[2])].map(b=>Oe(u(b,32))),g={colour:`rgba(${p[0]},${p[1]},${p[2]},${d})`,blur:c};if(l&&l.k>.02){const b=Math.round(Math.min(.34,.08+l.k*.4)*20)/20;g.rim={rgb:l.rgb.map(y=>Oe(u(y,32))).join(","),alpha:b,side:l.side}}return g}const Ie=256,vu=2.4;function _u(){let n=2654435769;const e=()=>(n^=n<<13,n>>>=0,n^=n>>>17,n^=n<<5,n>>>=0,n/4294967296),t=u=>{const d=new Array(u*u);for(let c=0;c<d.length;c++)d[c]=e();return d},a=u=>u*u*(3-2*u),o=(u,d,c,p)=>{const g=c*d,m=p*d,b=Math.floor(g)%d,y=Math.floor(m)%d,_=(b+1)%d,x=(y+1)%d,T=a(g-Math.floor(g)),N=a(m-Math.floor(m)),C=u[y*d+b]+(u[y*d+_]-u[y*d+b])*T,D=u[x*d+b]+(u[x*d+_]-u[x*d+b])*T;return C+(D-C)*N},s=t(3),i=t(7),r=new Float32Array(Ie*Ie);let h=0;for(let u=0;u<Ie;u++)for(let d=0;d<Ie;d++){const c=d/Ie,p=u/Ie,g=(o(s,3,c,p)-.5)*.9+(o(i,7,c,p)-.5)*.42+(e()-.5)*.7;r[u*Ie+d]=g,h+=g}const l=h/r.length;for(let u=0;u<r.length;u++)r[u]-=l;return r}class Tu{constructor(){f(this,"overlayFor",null)}overlay(e){var t;if(((t=this.overlayFor)==null?void 0:t.ctx)!==e){const a=document.createElement("canvas");a.width=S,a.height=q;const o=a.getContext("2d");if(!o)return null;const s=o.createLinearGradient(0,0,S*.25,q);s.addColorStop(0,"rgba(30,46,66,0.085)"),s.addColorStop(.5,"rgba(70,64,54,0.035)"),s.addColorStop(1,"rgba(104,82,56,0.07)"),o.fillStyle=s,o.fillRect(0,0,S,q);const i=o.createRadialGradient(S/2,q/2,q*.36,S/2,q/2,q*.98);i.addColorStop(0,"rgba(4,7,12,0)"),i.addColorStop(1,"rgba(4,6,11,0.50)"),o.fillStyle=i,o.fillRect(0,0,S,q);const r=_u(),h=o.getImageData(0,0,S,q),l=h.data;for(let u=0,d=0;u<q;u++){const c=(u&Ie-1)*Ie;for(let p=0;p<S;p++,d+=4){const g=r[c+(p&Ie-1)],m=l[d+3]/255,b=g*vu/Math.max(m,.07);l[d]=Oe(l[d]+b),l[d+1]=Oe(l[d+1]+b),l[d+2]=Oe(l[d+2]+b)}}o.putImageData(h,0,0),this.overlayFor={ctx:e,canvas:a}}return this.overlayFor.canvas}draw(e){const t=this.overlay(e);t&&e.drawImage(t,0,0)}}const ye=Je.items,Ye=Je.dialogues,Us=Je.combos,Iu=Je.tips,Un="Look around: hover over things to see what they are, and talk to everyone.",zo=" (Ask again for the answer.)";class Su{constructor(e,t){f(this,"nudged",new Set);f(this,"full",new Set);this.rules=e,this.holds=t}current(){return this.rules().findIndex(e=>e.if.every(t=>this.holds(t)))}answer(){const e=this.current();return e<0?Un:this.rules()[e].text}shown(){const e=this.current();if(e<0)return Un;const t=this.rules()[e];return t.nudge&&!this.full.has(e)?t.nudge+zo:t.text}ask(e=!1){const t=this.current();if(t<0)return Un;const a=this.rules()[t];return!a.nudge||this.full.has(t)||this.nudged.has(t)||e?(this.full.add(t),a.text):(this.nudged.add(t),a.nudge+zo)}reset(){this.nudged.clear(),this.full.clear()}}function lt(n,e,t,a,o,s){const i=Math.max(0,Math.min(s,Math.min(a,o)/2));n.beginPath(),n.moveTo(e+i,t),n.lineTo(e+a-i,t),n.quadraticCurveTo(e+a,t,e+a,t+i),n.lineTo(e+a,t+o-i),n.quadraticCurveTo(e+a,t+o,e+a-i,t+o),n.lineTo(e+i,t+o),n.quadraticCurveTo(e,t+o,e,t+o-i),n.lineTo(e,t+i),n.quadraticCurveTo(e,t,e+i,t),n.closePath()}function Mu(n,e,t,a,o,s,i=1){switch(n.save(),n.translate(t,a),n.scale(o/24,o/24),n.globalAlpha*=i,n.strokeStyle=s,n.fillStyle=s,n.lineWidth=1.7,n.lineCap="round",n.lineJoin="round",e){case"eye":{n.beginPath(),n.moveTo(-10,0),n.bezierCurveTo(-5.5,-6.4,5.5,-6.4,10,0),n.bezierCurveTo(5.5,6.4,-5.5,6.4,-10,0),n.stroke(),n.beginPath(),n.arc(0,0,3.1,0,Math.PI*2),n.stroke(),n.beginPath(),n.arc(0,0,1.15,0,Math.PI*2),n.fill();break}case"scroll":{n.beginPath(),n.moveTo(-7.5,-7),n.bezierCurveTo(-10,-7,-10,-3.5,-7.5,-3.5),n.lineTo(7.5,-3.5),n.bezierCurveTo(10,-3.5,10,0,7.5,0),n.lineTo(-7.5,0),n.bezierCurveTo(-10,0,-10,3.5,-7.5,3.5),n.lineTo(7.5,3.5),n.bezierCurveTo(10,3.5,10,7,7.5,7),n.stroke(),n.beginPath(),n.moveTo(-5.5,-1.8),n.lineTo(5.5,-1.8),n.moveTo(-5.5,1.8),n.lineTo(5.5,1.8),n.stroke();break}case"candle":{n.beginPath(),n.moveTo(-8,9.5),n.lineTo(8,9.5),n.stroke(),n.beginPath(),n.moveTo(-4.5,1),n.lineTo(-4.5,8),n.lineTo(4.5,8),n.lineTo(4.5,1),n.stroke(),n.beginPath(),n.moveTo(0,1),n.lineTo(0,-1.8),n.stroke(),n.beginPath(),n.moveTo(0,-9.5),n.bezierCurveTo(4.2,-6.2,3.3,-1.8,0,-1.8),n.bezierCurveTo(-3.3,-1.8,-4.2,-6.2,0,-9.5),n.stroke();break}case"chart":{n.beginPath(),n.moveTo(-7,-9),n.lineTo(5.5,-9),n.quadraticCurveTo(7,-9,7,-7.5),n.lineTo(7,7.5),n.quadraticCurveTo(7,9,5.5,9),n.lineTo(-5.5,9),n.quadraticCurveTo(-7,9,-7,7.5),n.closePath(),n.stroke(),n.beginPath(),n.moveTo(-4,4.5),n.lineTo(-1.5,.5),n.lineTo(1.5,2.5),n.lineTo(4.5,-4),n.stroke(),n.beginPath(),n.arc(-4,4.5,1.1,0,Math.PI*2),n.arc(4.5,-4,1.1,0,Math.PI*2),n.fill();break}case"compass":{n.beginPath(),n.arc(0,0,8.6,0,Math.PI*2),n.stroke(),n.beginPath(),n.moveTo(0,-10.2),n.lineTo(0,-8.2),n.moveTo(0,8.2),n.lineTo(0,10.2),n.moveTo(-10.2,0),n.lineTo(-8.2,0),n.moveTo(8.2,0),n.lineTo(10.2,0),n.stroke(),n.beginPath(),n.moveTo(0,-6.4),n.lineTo(2.3,.4),n.lineTo(0,2.2),n.lineTo(-2.3,.4),n.closePath(),n.stroke(),n.beginPath(),n.arc(0,0,1.1,0,Math.PI*2),n.fill();break}case"pause":{n.beginPath(),lt(n,-7,-8,5,16,2),n.fill(),n.beginPath(),lt(n,2,-8,5,16,2),n.fill();break}}n.restore()}const xu='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z"/><path d="M9 4v13.5M15 6.5V20"/></svg>',Au='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M8 8V6.5A4 4 0 0 1 16 6.5V8"/><path d="M5.5 8h13l1.5 11.5a1 1 0 0 1-1 1.1H5a1 1 0 0 1-1-1.1Z"/><path d="M9 13.5h6"/></svg>',Eu=[{id:"reveal",glyph:"◉",label:"Reveal interactive things"},{id:"log",glyph:"≡",label:"Line history"},{id:"tip",glyph:"✦",label:"Tip"},{id:"casebook",glyph:"",label:"Chart",svg:xu},{id:"map",glyph:"⌖",label:"Map"},{id:"pause",glyph:"Ⅱ",label:"Pause"}];class Cu{constructor(e){f(this,"root");f(this,"top");f(this,"scenes");f(this,"hud");f(this,"where");f(this,"roomName");f(this,"narration");f(this,"sentence");f(this,"action");f(this,"actionLabel");f(this,"actionHint");f(this,"cancel");f(this,"verbs");f(this,"bag");f(this,"bagCount");f(this,"clear");f(this,"title");f(this,"titleButtons");f(this,"dialogue");f(this,"dialogueInner");f(this,"portrait");f(this,"lesson");f(this,"speaker");f(this,"dialogueText");f(this,"choices");f(this,"dialogueContinue");f(this,"ending");f(this,"endingPage");f(this,"drawers");f(this,"items");f(this,"itemsEmpty");f(this,"pager");f(this,"pagerLabel");f(this,"rooms");f(this,"roomList");f(this,"drawerOpen",!1);f(this,"lastScreen",null);f(this,"roomsWereOpen",!1);f(this,"dialogueReturnFocus",null);f(this,"titleBuilt",!1);f(this,"itemKey","");f(this,"choiceKey","");f(this,"titleKey","");f(this,"roomKey","");f(this,"lastNarration","");f(this,"lastWhere","");f(this,"lastRoom","");f(this,"lastLine","");f(this,"lastSpeaker","");f(this,"lastDialogue","");f(this,"lastLesson","");f(this,"lastPortrait","");f(this,"verbKey","");f(this,"lastEnding","");this.bridge=e,this.root=document.createElement("div"),this.root.id="mobile-ui",this.root.innerHTML=`
      <div class="m-top" role="toolbar" aria-label="Game controls"></div>
      <section class="m-hud" aria-label="Game controls">
        <p class="m-lesson" aria-hidden="true" hidden></p>
        <div class="m-context">
          <p class="m-where"></p>
          <p class="m-room-name"></p>
          <p class="m-narration"></p>
          <p class="m-line"></p>
          <button type="button" class="m-action" hidden>
            <span class="m-action-label"></span>
            <span class="m-action-hint"></span>
          </button>
          <button type="button" class="m-quiet m-cancel" hidden>Cancel</button>
        </div>
        <div class="m-verbs" role="toolbar" aria-label="Verbs"></div>
        <div class="m-bag-row">
          <button type="button" class="m-bag" aria-expanded="false" aria-controls="m-drawer">
            <span class="m-bag-glyph" aria-hidden="true">${Au}</span>
            <span class="m-bag-label">Satchel</span>
            <span class="m-bag-count"></span>
          </button>
          <button type="button" class="m-quiet m-clear" hidden>Clear</button>
        </div>
      </section>
      <section class="m-title" aria-label="Title" hidden>
        <div class="m-title-inner">
          <p class="m-title-eyebrow">A TALE OF DREADWATER ISLE</p>
          <div class="m-title-buttons"></div>
        </div>
      </section>
      <section class="m-dialogue" role="dialog" aria-label="Conversation" hidden>
        <div class="m-dialogue-inner">
          <img class="m-portrait" alt="" width="56" height="56" hidden />
          <p class="m-speaker"></p>
          <button type="button" class="m-dialogue-text"></button>
          <div class="m-choices"></div>
          <button type="button" class="m-primary m-dialogue-continue" hidden>Continue</button>
        </div>
      </section>
      <section class="m-ending" aria-label="Voyage's end" hidden>
        <div class="m-ending-inner">
          <p class="m-ending-page"></p>
          <button type="button" class="m-primary m-ending-continue">Continue</button>
        </div>
      </section>
      <section class="m-drawer" id="m-drawer" aria-label="Satchel" hidden>
        <header class="m-drawer-head">
          <h2>Satchel</h2>
          <button type="button" class="m-quiet m-drawer-close">Done</button>
        </header>
        <div class="m-items"></div>
        <p class="m-items-empty" hidden>Nothing yet.</p>
        <div class="m-pager" hidden>
          <button type="button" class="m-quiet m-page-prev" aria-label="Previous satchel page">‹</button>
          <span class="m-pager-label"></span>
          <button type="button" class="m-quiet m-page-next" aria-label="Next satchel page">›</button>
        </div>
      </section>
      <section class="m-rooms" aria-label="Go to a scene" hidden>
        <div class="m-rooms-inner">
          <header class="m-drawer-head">
            <h2>Go to a scene</h2>
            <button type="button" class="m-quiet m-rooms-close">Done</button>
          </header>
          <div class="m-room-list"></div>
        </div>
      </section>`,document.body.append(this.root),this.top=this.q(".m-top"),this.hud=this.q(".m-hud"),this.where=this.q(".m-where"),this.roomName=this.q(".m-room-name"),this.narration=this.q(".m-narration"),this.sentence=this.q(".m-line"),this.action=this.q(".m-action"),this.actionLabel=this.q(".m-action-label"),this.actionHint=this.q(".m-action-hint"),this.cancel=this.q(".m-cancel"),this.verbs=this.q(".m-verbs"),this.bag=this.q(".m-bag"),this.bagCount=this.q(".m-bag-count"),this.clear=this.q(".m-clear"),this.title=this.q(".m-title"),this.titleButtons=this.q(".m-title-buttons"),this.dialogue=this.q(".m-dialogue"),this.dialogueInner=this.q(".m-dialogue-inner"),this.portrait=this.q(".m-portrait"),this.lesson=this.q(".m-lesson"),this.speaker=this.q(".m-speaker"),this.dialogueText=this.q(".m-dialogue-text"),this.choices=this.q(".m-choices"),this.dialogueContinue=this.q(".m-dialogue-continue"),this.ending=this.q(".m-ending"),this.endingPage=this.q(".m-ending-page"),this.drawers=this.q(".m-drawer"),this.items=this.q(".m-items"),this.itemsEmpty=this.q(".m-items-empty"),this.pager=this.q(".m-pager"),this.pagerLabel=this.q(".m-pager-label"),this.rooms=this.q(".m-rooms"),this.roomList=this.q(".m-room-list"),this.buildTopBar(),this.scenes=this.q(".m-scenes"),this.bind(),document.body.classList.add("m-ready")}contains(e){return!!(e&&this.root.contains(e))}q(e){const t=this.root.querySelector(e);if(!t)throw new Error(`mobile UI: missing ${e}`);return t}buildTopBar(){for(const e of Eu){const t=document.createElement("button");t.type="button",t.className="m-icon",t.dataset.bar=e.id,t.setAttribute("aria-label",e.label),t.title=e.label,(e.id==="reveal"||e.id==="tip")&&t.setAttribute("aria-pressed","false"),t.innerHTML=`<span aria-hidden="true">${e.svg??e.glyph}</span>`,this.top.append(t)}this.scenes=document.createElement("button"),this.scenes.type="button",this.scenes.className="m-icon m-scenes",this.scenes.hidden=!0,this.scenes.setAttribute("aria-label","Chapter select"),this.scenes.title="Chapter select",this.scenes.innerHTML='<span aria-hidden="true">▦</span>',this.top.append(this.scenes)}bind(){this.root.addEventListener("click",e=>{var a,o,s,i,r,h,l,u;(o=(a=this.bridge).unlockAudio)==null||o.call(a);const t=(s=e.target)==null?void 0:s.closest("[data-bar],[data-verb],[data-item],[data-title],[data-room],[data-choice]");if(t){const d=t.dataset.bar;if(d){this.bridge.bar(d);return}const c=t.dataset.verb;if(c){this.bridge.verb(c);return}const p=t.dataset.item;if(p){this.bridge.item(p),this.setDrawer(!1);return}const g=t.dataset.title;if(g){this.bridge.title(g);return}const m=t.dataset.room;if(m){this.bridge.room(m);return}const b=Number(t.dataset.choice);if(Number.isInteger(b)){this.bridge.dialogueChoice(b);return}return}if(e.target===this.action||this.action.contains(e.target)){this.action.dataset.action==="continue"?this.bridge.continueStory():this.bridge.confirm();return}if(e.target===this.cancel){this.bridge.cancel();return}if(e.target===this.clear){this.bridge.clear();return}if(this.scenes.contains(e.target)){this.bridge.openRooms();return}if(this.bag.contains(e.target)){this.setDrawer(!this.drawerOpen);return}if((i=e.target)!=null&&i.closest(".m-drawer-close")){this.setDrawer(!1);return}if(e.target===this.dialogueText||e.target===this.dialogueInner){this.bridge.dialogueTap();return}if(e.target===this.dialogueContinue){this.bridge.dialogueTap();return}if(e.target!==this.endingPage){if((r=e.target)!=null&&r.closest(".m-ending-continue")){this.bridge.advanceEnding();return}if((h=e.target)!=null&&h.closest(".m-rooms-close")){this.bridge.closeRooms();return}if((l=e.target)!=null&&l.closest(".m-page-prev")){this.bridge.page(-1);return}if((u=e.target)!=null&&u.closest(".m-page-next")){this.bridge.page(1);return}}})}setDrawer(e,t=!1){var o,s;const a=this.drawerOpen;if(this.drawerOpen=e,e!==a&&!t&&((s=(o=this.bridge).drawer)==null||s.call(o,e)),this.drawers.hidden=!e,this.bag.setAttribute("aria-expanded",String(e)),e&&this.renderItems(this.bridge.state()),e&&!a){const i=this.items.querySelector(".m-item")??this.q(".m-drawer-close");i==null||i.focus({preventScroll:!0})}else!e&&a&&this.drawers.contains(document.activeElement)&&(this.isShowing(this.bag)?this.bag.focus({preventScroll:!0}):this.focusGame())}isShowing(e){return!!(e&&!e.hidden&&e.getClientRects().length>0)}focusGame(){const e=document.getElementById("game");e==null||e.focus({preventScroll:!0})}sync(e){var p,g,m;const t=e.play;this.root.classList.toggle("is-blocked",e.blocked),this.top.hidden=e.screen!=="play"||e.cut,this.hud.hidden=e.screen!=="play"||e.cut,this.title.hidden=e.screen!=="title",this.dialogue.hidden=e.screen!=="dialogue",this.ending.hidden=e.screen!=="ending",this.rooms.hidden=!(e.screen==="play"&&((p=e.roomMenu)!=null&&p.open));const a=!!((g=e.roomMenu)!=null&&g.open)||e.screen==="dialogue";this.top.inert=a;const o=document.getElementById("game");o&&(o.tabIndex=e.screen==="title"||e.screen==="dialogue"?-1:0),e.screen!=="play"&&this.setDrawer(!1,!0),this.scenes.hidden=e.screen!=="play"||!t.explore,this.syncTopBar(e),this.syncTitle(e),this.syncDialogue(e),this.syncEnding(e),this.syncRooms(e),this.syncLesson(e);const s=t.act;s!==this.lastWhere&&(this.where.textContent=s,this.lastWhere=s),t.room!==this.lastRoom&&(this.roomName.textContent=t.room,this.lastRoom=t.room);const i=t.narration.slice(0,Math.max(0,t.narrationShown));i!==this.lastNarration&&(this.narration.textContent=i,this.narration.hidden=i.length===0,this.lastNarration=i);const r=t.sentence;r!==this.lastLine&&(this.sentence.textContent=r,this.sentence.hidden=r.length===0,this.lastLine=r);const h=t.armed,l=this.hud.querySelector(".m-context");l==null||l.classList.toggle("is-idle",!t.narration&&!r&&!h&&!t.waiting),l==null||l.classList.toggle("is-armed",!!h),h?(this.action.hidden=!1,this.action.dataset.action="confirm",this.actionLabel.textContent=h.label,this.actionHint.textContent=h.hint):t.waiting?(this.action.hidden=!1,this.action.dataset.action="continue",this.actionLabel.textContent="Continue",this.actionHint.textContent="Tap to go on"):(this.action.hidden=!0,delete this.action.dataset.action),this.cancel.hidden=!h&&r.length===0,this.clear.hidden=r.length===0&&!t.inventory.some(b=>b.selected),this.bagCount.textContent=t.inventory.length?String(t.inventory.length):"",this.bag.setAttribute("aria-label",t.inventory.length?`Satchel, ${t.inventory.length} ${t.inventory.length===1?"thing":"things"}`:"Satchel, empty"),this.syncVerbs(e),this.drawerOpen&&this.renderItems(e);const u=this.lastScreen===null,d=this.lastScreen!==null&&this.lastScreen!==e.screen;this.lastScreen=e.screen;const c=e.screen==="play"&&!!((m=e.roomMenu)!=null&&m.open);c&&!this.roomsWereOpen?this.focusRooms():!c&&this.roomsWereOpen&&!d&&this.focusAfterRooms(),this.roomsWereOpen=c,(d||u)&&this.focusScreen(e.screen)}focusRooms(){(this.roomList.querySelector(".m-room")??this.q(".m-rooms-close")).focus({preventScroll:!0})}focusAfterRooms(){const e=document.activeElement;!this.rooms.contains(e)&&e!==document.body||(this.isShowing(this.scenes)?this.scenes.focus({preventScroll:!0}):this.focusGame())}focusScreen(e){if(e==="title"){const t=this.titleButtons.querySelector("button.m-primary:not([disabled])")??this.titleButtons.querySelector("button:not([disabled])");this.isShowing(this.title)&&(t==null||t.focus({preventScroll:!0}));return}if(e==="dialogue"){this.dialogueReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null,this.dialogueText.focus({preventScroll:!0});return}if(e==="ending"){this.q(".m-ending-continue").focus({preventScroll:!0});return}if(e==="play"&&!this.roomsWereOpen){const t=this.dialogueReturnFocus;this.dialogueReturnFocus=null,t&&this.isShowing(t)?t.focus({preventScroll:!0}):this.focusGame()}}syncTopBar(e){const t=this.top.querySelector('[data-bar="reveal"]'),a=this.top.querySelector('[data-bar="tip"]');t==null||t.setAttribute("aria-pressed",String(e.reveal)),a==null||a.setAttribute("aria-pressed",String(e.tip)),t==null||t.classList.toggle("on",e.reveal),a==null||a.classList.toggle("on",e.tip)}syncTitle(e){var o;const t=e.title.buttons.map(s=>`${s.id}|${s.label}|${s.sub??""}|${s.kind}|${s.disabled?1:0}`).join("§");if(t===this.titleKey)return;this.titleKey=t;const a=this.titleBuilt;this.titleBuilt=!0,this.titleButtons.replaceChildren();for(const s of e.title.buttons){const i=document.createElement("button");i.type="button",i.dataset.title=s.id,i.className=`m-title-button m-${s.kind}`,i.disabled=!!s.disabled;const r=document.createElement("span");if(r.className="m-title-label",r.textContent=s.label,i.append(r),s.sub){const h=document.createElement("span");h.className="m-title-sub",h.textContent=s.sub,i.append(h)}this.titleButtons.append(i)}a&&e.screen==="title"&&this.isShowing(this.title)&&((o=this.titleButtons.querySelector(".m-primary")??this.titleButtons.querySelector("button"))==null||o.focus({preventScroll:!0}))}syncDialogue(e){const t=e.dialogue;if(!t)return;t.speaker!==this.lastSpeaker&&(this.speaker.textContent=t.speaker,this.lastSpeaker=t.speaker);const a=t.portrait??"";a!==this.lastPortrait&&(this.lastPortrait=a,a?this.portrait.src=a:this.portrait.removeAttribute("src"),this.portrait.hidden=!a,this.dialogueInner.classList.toggle("has-portrait",!!a));const o=t.text.slice(0,Math.max(0,t.shown));o!==this.lastDialogue&&(this.dialogueText.textContent=o,this.lastDialogue=o);const s=t.choices.map(i=>`${i.text}|${i.seen?1:0}`).join("§");if(s!==this.choiceKey){this.choiceKey=s;const i=this.choices.contains(document.activeElement);this.choices.replaceChildren(),t.choices.forEach((r,h)=>{const l=document.createElement("button");l.type="button",l.dataset.choice=String(h),l.className=`m-choice${r.seen?" seen":""}`,l.textContent=r.text,this.choices.append(l)}),i&&(this.choices.querySelector(".m-choice")??this.dialogueText).focus({preventScroll:!0})}this.dialogueContinue.hidden=!t.canAdvance||t.choices.length>0}syncLesson(e){const t=e.screen==="play"?e.lesson??"":"";t!==this.lastLesson&&(this.lesson.textContent=t,this.lastLesson=t),this.lesson.hidden=t.length===0}syncEnding(e){const t=e.ending;if(!t)return;const a=`Page ${t.page} of ${t.pages}`;a!==this.lastEnding&&(this.endingPage.textContent=a,this.lastEnding=a)}syncRooms(e){const t=e.roomMenu;if(!(t!=null&&t.open))return;const a=t.rooms.map(o=>`${o.id}|${o.label}`).join("§");if(a!==this.roomKey){this.roomKey=a,this.roomList.replaceChildren();for(const o of t.rooms){const s=document.createElement("button");s.type="button",s.dataset.room=o.id,s.className="m-room",s.textContent=o.label,this.roomList.append(s)}}}syncVerbs(e){const t=e.play.verbs,a=t.map(o=>`${o.id}|${o.label}`).join("§");if(a!==this.verbKey||this.verbs.childElementCount!==t.length){this.verbKey=a,this.verbs.replaceChildren();for(const o of t){const s=document.createElement("button");s.type="button",s.dataset.verb=o.id,s.setAttribute("aria-label",o.label),s.textContent=o.label,this.verbs.append(s)}}for(let o=0;o<t.length;o++){const s=this.verbs.children[o];s&&(s.classList.toggle("active",t[o].active),s.classList.toggle("suggested",t[o].suggested),s.setAttribute("aria-pressed",String(t[o].active)))}}renderItems(e){const t=e.play.inventory,a=`${e.play.page}|${t.map(o=>`${o.id}|${o.name}|${o.icon??""}`).join("§")}`;if(a!==this.itemKey){this.itemKey=a,this.items.replaceChildren();for(const o of t){const s=document.createElement("button");if(s.type="button",s.dataset.item=o.id,s.className="m-item",o.icon){const r=document.createElement("img");r.className="m-item-icon",r.src=o.icon,r.alt="",r.width=40,r.height=40,r.decoding="async",s.append(r)}const i=document.createElement("span");i.className="m-item-name",i.textContent=o.name,s.append(i),this.items.append(s)}}this.items.hidden=t.length===0,this.itemsEmpty.hidden=t.length>0;for(let o=0;o<t.length;o++){const s=this.items.children[o];s&&s.classList.toggle("selected",t[o].selected)}this.pager.hidden=e.play.pages<2,this.pagerLabel.textContent=`${e.play.page+1} / ${e.play.pages}`}}const Ys="brasscompass.seen.v1",js=3e3;function Ko(n){let e=2166136261;for(let t=0;t<n.length;t++)e^=n.charCodeAt(t),e=Math.imul(e,16777619);return(e>>>0).toString(16)}class Hu{constructor(e=[],t=()=>{},a=js){f(this,"keys");this.save=t,this.max=a,this.keys=new Set(e),this.trim()}get size(){return this.keys.size}has(e){return this.keys.has(Ko(e))}add(e){const t=Ko(e);return this.keys.has(t)?!1:(this.keys.add(t),this.trim(),this.save([...this.keys]),!0)}trim(){for(;this.keys.size>this.max;){const e=this.keys.values().next().value;this.keys.delete(e)}}}function Nu(n){try{const e=JSON.parse(n(Ys)||"[]");return Array.isArray(e)?e.filter(t=>typeof t=="string").slice(-js):[]}catch{return[]}}function Lu(n,e){try{n(JSON.stringify([...e]))}catch{}}const $u=.3;function Du(n,e,t){return n&&(e||t)}const wa=["look","take","use","inventory","chart","keys"],Yn={look:{id:"look",anchor:"scene",text:n=>n?"Tap a thing to name it. Hold to look closer.":"Right-click a thing to look at it."},take:{id:"take",anchor:"scene",text:()=>"Pick up what you can carry."},use:{id:"use",anchor:"sentence",text:n=>n?"Use or give it: then tap the other thing.":"Use or give it: then pick the other thing."},inventory:{id:"inventory",anchor:"satchel",text:n=>n?"The satchel holds what you take. Tap a pocket.":"The satchel holds what you take. Tab reaches it."},chart:{id:"chart",anchor:"bar",text:n=>n?"The chart keeps what you learn. Tap it.":"The chart keeps what you learn. J."},keys:{id:"keys",anchor:"bar",text:n=>n?"Tap a thing to name it, tap again to act. The top bar holds reveal, hint, chart and map.":"Q reveal · H tip · J chart · A map · Esc pause"}},Uo=7,Xs="brasscompass.firstwatch.v1";function Ru(n){try{const e=JSON.parse(n(Xs)||"[]");return Array.isArray(e)?e.filter(t=>wa.includes(t)):[]}catch{return[]}}function qu(n,e){try{n(JSON.stringify([...e]))}catch{}}class Pu{constructor(e,t=()=>{},a=()=>{}){f(this,"taught");f(this,"waiting",[]);f(this,"current",null);this.save=t,this.onShow=a,this.taught=new Set(e.filter(o=>wa.includes(o)))}get fresh(){return this.taught.size<wa.length}learnt(e){return this.taught.has(e)}offer(e){var t;return this.taught.has(e)||((t=this.current)==null?void 0:t.id)===e||this.waiting.includes(e)?!1:(this.current?this.waiting.push(e):this.show(e),!0)}show(e){this.taught.add(e),this.save([...this.taught]),this.current={id:e,left:Uo,total:Uo},this.onShow(e)}tick(e,t=!1){if(!this.current||t||(this.current.left-=e,this.current.left>0))return;const a=this.waiting.shift();this.current=null,a&&this.show(a)}clearQueue(){this.waiting=[],this.current=null}get alpha(){const e=this.current;if(!e)return 0;const t=e.total-e.left;return Math.max(0,Math.min(1,t/.28,e.left/.6))}}const Ou={tavern:"hearth",office:"study",chandlery:"workshop",warehouse:"workshop",counting_house:"counting",marrow_cabin:"cabin",arcadia_cabin:"cabin",below_decks:"hold",marrow_gallery:"gallery"};function Wu(n){return Ou[n]??null}const Fu=/\b(?:locked|padlocked|bolted|barred|sealed shut)\b/i;function Bu(n){return Fu.test(n)}const oe={y:14,h:52,size:52,gap:8,right:1896},fn=["reveal","log","tip","casebook","map","pause"],Yo={reveal:"Reveal interactive things",log:"Line history",tip:"Tip",casebook:"Chart",map:"Map",pause:"Pause"},jn={reveal:pe.reveal,log:pe.history,tip:pe.tip,casebook:pe.chart,map:pe.map,pause:pe.pause},Vu={reveal:"Reveal",log:"History",tip:"Tip",casebook:"Chart",map:"Map",pause:"Pause"},Gu={reveal:"eye",log:"scroll",tip:"candle",casebook:"chart",map:"compass",pause:"pause"};function Xn(){const n={};let e=oe.right;for(let t=fn.length-1;t>=0;t--){const a=fn[t];n[a]={x:e-oe.size,y:oe.y,w:oe.size,h:oe.h},e-=oe.size+oe.gap}return n}const _t=100,zu=.62,jo="brasscompass.tips.v1";function Xo(n){return n.length===1||n==="Enter"||n==="Escape"||n==="Tab"||n==="PageUp"||n==="PageDown"||n.startsWith("Arrow")}const Qo=400,Qn=400,Ku=["hotspot","verb","item"],Ve=["","I","II","III","IV","V","VI"],Uu=.25,Yu=.46;function Te(n){let e=Jo.get(n);if(e)return e;if("rect"in n)e={x:n.rect.x,y:n.rect.y,w:n.rect.w,h:n.rect.h};else{let t=1/0,a=1/0,o=-1/0,s=-1/0;for(const i of n)i.x<t&&(t=i.x),i.x>o&&(o=i.x),i.y<a&&(a=i.y),i.y>s&&(s=i.y);e={x:t,y:a,w:o-t,h:s-a}}return Jo.set(n,e),e}const Jo=new WeakMap,ju=[[0,0],[1,0],[0,1],[1,1]];function Zo(n,e,t,a,o,s){for(const[i,r]of ju){const h=e+i*a,l=t+r*o,u=i?-1:1,d=r?-1:1;n.moveTo(h,l+d*s),n.lineTo(h,l),n.lineTo(h+u*s,l)}}function es(n,e,t){return n>=t.x&&n<=t.x+t.w&&e>=t.y&&e<=t.y+t.h}const Tt=new Set(Object.keys(Qe.images).filter(n=>n.startsWith("item_")).map(n=>n.slice(5)));function Ge(n){const e=n.trim();return/[.!?…:;]["”’')\]]*$/.test(e)?e:`${e}.`}const Xu=1.15,Jn=.62,Zn=[0,1,2,1],Qu=.45,ts={talk:1.5,say:1.5,act:2.4,win:2.5},ns=18,as=240,zt=70,os=4,ss=2.5,Ju=4,Zu=120,is=55,ef=120,tf=18,ea=44,nf=10,af=20,of=62,Kt=700,sf=2.5,rf=.6,hf=2.2,ta=new Set(["go","talk","act","win"]),lf=new Set(["flag","add","give","take","note"]),df=.5,cf=8,rs=4,uf=2e3,ff={ending_fog_lifts:"curse_broken",ending_long_way:"escaped_fog"},pf={migrated:"older save",replaced:"replaced voyage",corrupt:"damaged page",future:"newer page","old-key":"earlier voyage"},be={room:n=>n in le,item:n=>n in ye,act:n=>n in ae,firstAct:ot,talk:(n,e)=>n in Ye&&(e===void 0||e in Ye[n].nodes),endingFlags:Lt,...yd(Dd({rooms:le,dialogues:Ye,acts:ae,combos:Us}),ae)};class gf{constructor(e,t,a,o){f(this,"room");f(this,"mesh");f(this,"x",Dn.x);f(this,"y",Dn.y);f(this,"facing",1);f(this,"moveDirection","right");f(this,"path",[]);f(this,"walkPhase",0);f(this,"walkStarting",!1);f(this,"directionPending",0);f(this,"sentence",{verb:null,a:null,b:null});f(this,"narration",null);f(this,"narrationClock",0);f(this,"inventory",[]);f(this,"inventoryPage",0);f(this,"flags",{});f(this,"act",ot);f(this,"notes",[]);f(this,"dialogue",null);f(this,"fade",0);f(this,"fadeTarget",0);f(this,"title",!0);f(this,"won",!1);f(this,"hoverVerb",null);f(this,"hoverItem",null);f(this,"hoverHotspot",null);f(this,"hoverChoice",-1);f(this,"hoverCueKey",null);f(this,"keyboardFocus",null);f(this,"revealHeld",!1);f(this,"revealToggled",!1);f(this,"touchArmed",null);f(this,"touchArmedAt",0);f(this,"touch",!1);f(this,"mobile",!1);f(this,"mobileUI",null);f(this,"mobileFull",!0);f(this,"mobileSyncAt",-1e9);f(this,"running",!1);f(this,"walkGoal",null);f(this,"confirmNew",!1);f(this,"confirmArmedAt",0);f(this,"confirmLabel",null);f(this,"lastInput","pointer");f(this,"pointerSeen",!1);f(this,"committed",null);f(this,"dialogueClosedAt",-1e9);f(this,"stage",new fh);f(this,"cameraHold",null);f(this,"hoverDirty",!1);f(this,"transition",new uc);f(this,"connector",new xc);f(this,"fx",new Wc);f(this,"ending",null);f(this,"announcedEnding",!1);f(this,"curtain",null);f(this,"exitAt",null);f(this,"exitLinks",new Map);f(this,"pendingEntry",null);f(this,"pendingPassage",null);f(this,"exitIntroSeen",new Set);f(this,"exitIntro",0);f(this,"talking",new Map);f(this,"titleClock",0);f(this,"needle",{fromY:null,since:-99});f(this,"cursorStyle","");f(this,"idle",0);f(this,"barFade",1);f(this,"barFlash",null);f(this,"barLabel",null);f(this,"touchBarArmed",null);f(this,"hoverDwell",0);f(this,"lastBarHover",null);f(this,"cameraX",0);f(this,"focusCameraX",null);f(this,"rejection",0);f(this,"time",0);f(this,"hasSave",!1);f(this,"hasPrevious",!1);f(this,"tabGuard",new Rd);f(this,"foreignSave",!1);f(this,"keepPage",!1);f(this,"recoverable",[]);f(this,"recoverOpen",!1);f(this,"recoverOffset",0);f(this,"titleNotice",null);f(this,"foreignSaveWarned",!1);f(this,"endingChosen",null);f(this,"paused",!1);f(this,"settings");f(this,"cinematic");f(this,"casebook");f(this,"recap");f(this,"history");f(this,"atlas");f(this,"areaCard",null);f(this,"areaCardBusy",!1);f(this,"areaCardLeft",0);f(this,"areaCardFading",!1);f(this,"areaCardThen",null);f(this,"deeds");f(this,"deedsShown",!1);f(this,"casebookTally",null);f(this,"prefs",Br());f(this,"watch");f(this,"tipMode",!1);f(this,"pad",new Mh({announce:e=>this.announce(e),press:e=>this.padPress(e)}));f(this,"keysClock",0);f(this,"keysActed",!1);f(this,"seenLines",new Hu(Nu(e=>{try{return localStorage.getItem(e)}catch{return null}}),e=>Lu(t=>{try{localStorage.setItem(Ys,t)}catch{}},e)));f(this,"narrationRepeat",!1);f(this,"narrationCounted",!1);f(this,"skipClock",0);f(this,"ctrlHeld",!1);f(this,"bracketHeld",!1);f(this,"tipLadder",new Su(()=>Iu,e=>this.check(e)));f(this,"saveBroken",!1);f(this,"live",null);f(this,"a11y",null);f(this,"roomWait",0);f(this,"saveNotice",null);f(this,"noteToast",null);f(this,"noteGlow",0);f(this,"autosaveIn",0);f(this,"loop");f(this,"drawnAt",-1e9);f(this,"drawnW",0);f(this,"drawnH",0);f(this,"focusMemory",{});f(this,"busyAnnouncedAt",-1/0);f(this,"mobileCropAt",0);f(this,"mobileCropKey","");f(this,"queue",null);f(this,"queueDue",0);f(this,"portraitColumns",new Map);f(this,"announcing",[]);f(this,"onArrive",null);f(this,"pendingRoom",null);f(this,"passagePlate",null);f(this,"passageHotspot",null);f(this,"stateCache",new WeakMap);f(this,"tick",0);f(this,"choiceCache",null);f(this,"gradeMemo",new Map);f(this,"gradeMemoRoom");f(this,"ambient",new gu({image:e=>this.assets.img(e),check:e=>this.check(e)}));f(this,"ambientView",{cameraX:0,time:0,reduced:!1});f(this,"paint",new Tu);f(this,"drawables",[]);f(this,"floorLift",null);f(this,"floorLiftFor",null);f(this,"vignetteFor",null);f(this,"chevronOut",[]);f(this,"chevronCand",[]);f(this,"narrationTop",null);f(this,"debugOverlay",!1);f(this,"trace",null);f(this,"devHandle",null);f(this,"explore",!1);f(this,"roomMenu",!1);f(this,"roomMenuFocus",0);f(this,"titleFocus",null);f(this,"continueLabel",null);this.view=e,this.input=t,this.assets=a,this.audio=o,this.mobile=e.mobile,this.touch=e.mobile,this.view.setQuality(this.prefs.quality),this.settings=new Nh({resume:()=>this.setPaused(!1),restart:()=>{this.setPaused(!1),this.persist(),this.stashBeforeNewVoyage()&&(this.clearForeignSave(),this.behindCurtain(()=>{this.title=!1,this.newGame()}))},title:()=>{this.persist(),this.setPaused(!1),this.behindCurtain(()=>{this.resetTransient(),this.explore=!1,this.roomMenu=!1,this.enterTitle()})},mute:()=>{this.audio.toggleMute()},volume:h=>this.audio.setVolume(h),musicVolume:h=>this.audio.setMusicVolume(h),sfxVolume:h=>this.audio.setSfxVolume(h),audio:()=>this.audio,tip:()=>this.resumeWith("tip"),history:()=>this.resumeWith("history"),tips:()=>this.tipMode,toggleTips:()=>this.setTipMode(!this.tipMode),prefs:()=>this.prefs,setPrefs:h=>{const l=this.prefs;this.prefs={...this.prefs,...h},Vr(this.prefs),this.syncDocument(),"highContrast"in h&&pt(l)!==pt(this.prefs)&&this.announce(pt(this.prefs)?"High contrast on.":"High contrast off."),h.revealMode&&h.revealMode!==l.revealMode&&(this.revealToggled=!1,this.revealHeld=!1,this.syncA11yControls(),this.announce(h.revealMode==="toggle"?"Reveal key: press Q to switch on and off.":"Reveal key: hold Q to show.")),h.quality&&h.quality!==l.quality&&(this.view.setQuality(h.quality),this.announce(`Graphics quality: ${h.quality}.`)),h.readingTime&&h.readingTime!==l.readingTime&&this.announce(`Reading time: ${{normal:"normal",long:"long",xlong:"very long"}[h.readingTime]}.`),h.skipRead!==void 0&&h.skipRead!==l.skipRead&&this.announce(h.skipRead?"Skip read text on.":"Skip read text off."),h.waitForClick!==void 0&&h.waitForClick!==l.waitForClick&&this.announce(h.waitForClick?"Lines stay until you click.":"Lines move on by themselves."),"textScale"in h&&h.textScale!==l.textScale&&this.announce(`Text size ${Math.round(this.textScale*100)} percent.`)},reduced:()=>this.reduced,autoTextScale:()=>bs(this.view.scale),contrast:()=>pt(this.prefs)});const s=h=>{try{return localStorage.getItem(h)}catch{return null}},i=h=>{try{localStorage.setItem(Xs,h)}catch{}};this.watch=new Pu(Ru(s),h=>qu(i,h),h=>this.announce(Yn[h].text(this.touch)));try{this.tipMode=localStorage.getItem(jo)==="on"}catch{this.tipMode=!1}this.cinematic=new Bh(()=>this.audio);const r={};for(const[h,l]of Object.entries(ae))r[Number(h)]=`${l.title}`;this.casebook=new rd(r,()=>{this.audio.page(),this.persist()}),this.recap=new gd({actTitle:h=>this.actTitle(h),roomName:h=>{var l;return((l=le[h])==null?void 0:l.name)??h},itemName:h=>{var l;return((l=ye[h])==null?void 0:l.name)??h},actCaption:h=>{var l;return((l=ae[h])==null?void 0:l.caption)??null},waitingOnLastChoice:h=>h===Ms&&xn(),sail:()=>this.sail(),readCasebook:h=>{this.audio.page(),this.casebook.show(h)},back:()=>{this.audio.page(),this.announce("Back at the title. Set sail when you're ready.")}}),this.history=new Lh(()=>this.audio.page()),this.atlas=new $h({onTravel:h=>this.travelTo(h),onDismiss:()=>this.audio.chart(!1)}),this.deeds=new cd(()=>this.leaveDeeds()),this.loop=new Hc({step:(h,l)=>this.step(l,h),announce:h=>this.announce(h)})}padPress(e){if(e.key==="Pause"){if(e.type!=="down"||e.repeat||this.cinematic.active)return;this.paused?this.setPaused(!1):this.pauseBlocked()||this.barAction("pause");return}this.idle=0,xh(e,this.settings.open)}get reduced(){return ys(this.prefs)}get textSpeed(){return ks(this.prefs,this.reduced)}typeTime(e){const t=Ga[this.textSpeed];return Number.isFinite(t)?e/t:0}lineDue(e){var a;const t=((a=this.narration)==null?void 0:a.text.length)??0;return this.typeTime(t)+Math.max(ts[e]??0,t/ns)*this.readingFactor}get readingFactor(){return Or[this.prefs.readingTime]??1}get textScale(){return Gr(this.prefs,this.view.scale)}syncDocument(){if(typeof document>"u")return;document.body.classList.toggle("reduced-motion",this.reduced),document.documentElement.style.setProperty("--text-scale",String(this.prefs.textScale??1));const e=pt(this.prefs);jr(e),document.body.classList.toggle("high-contrast",e)}buildA11yControls(){if(this.mobile||typeof document>"u"||this.a11y)return;const e=document.createElement("div");e.className="a11y-controls sr-only",e.setAttribute("role","toolbar"),e.setAttribute("aria-label","Game controls");const t=(r,h,l)=>{const u=document.createElement("button");return u.type="button",u.textContent=r,u.title=l?`${r} (${l})`:r,l&&(u.setAttribute("aria-keyshortcuts",l),u.setAttribute("aria-label",`${r} (${l})`)),u.addEventListener("click",h),e.append(u),u},a=t("Reveal interactive things",()=>this.barAction("reveal"),"Q");a.setAttribute("aria-pressed","false");const o=t("Tip",()=>this.barAction("tip"),"H");o.setAttribute("aria-pressed","false"),t("Line history",()=>this.barAction("log"),"L"),t("Chart",()=>this.barAction("casebook"),"J"),t("Map",()=>this.barAction("map"),"A"),t("Pause",()=>this.barAction("pause"),"Escape");const s=t("Previous inventory page",()=>this.turnPage(-1),"PageUp"),i=t("Next inventory page",()=>this.turnPage(1),"PageDown");document.body.append(e),e.hidden=this.title||this.won,this.a11y={root:e,reveal:a,tip:o,previous:s,next:i},this.syncA11yControls()}syncA11yVisibility(){const e=this.a11y;if(!e)return;const t=this.title||this.won;t!==e.root.hidden&&(t&&e.root.contains(document.activeElement)&&Le(null),e.root.hidden=t)}syncA11yControls(){const e=this.a11y;if(!e)return;e.reveal.setAttribute("aria-pressed",String(this.revealToggled)),e.tip.setAttribute("aria-pressed",String(this.tipMode));const t=Math.max(1,this.pageCount()),a=Math.min(this.inventoryPage,t-1)+1,o=t<2;e.previous.disabled=o,e.next.disabled=o,e.previous.setAttribute("aria-label",`Previous inventory page, page ${a} of ${t}`),e.next.setAttribute("aria-label",`Next inventory page, page ${a} of ${t}`)}setTipMode(e){this.tipMode=e;try{localStorage.setItem(jo,e?"on":"off")}catch{}this.syncA11yControls()}currentTip(){return this.tipLadder.answer()}showTip(){this.audio.chime(),this.speak(`Tip: ${this.tipLadder.ask(this.tipMode)}`)}teach(e){return this.watch.offer(e)}showCasebook(){if(this.title||this.won||this.explore){this.casebook.show(this.notes);return}this.casebook.show(this.notes,{plan:this.tipLadder.shown(),where:this.casebookWhere()})}casebookWhere(){const e=ae[this.act];return`${e?`Act ${Ve[e.n]??e.n}: ${e.title}`:`Act ${Ve[this.act]??this.act}`} · ${this.room.name}`}suggestedVerb(e){var t,a,o;return e.verb?e.verb:(t=e.do)!=null&&t.talk?"talk":e.item?"pickup":(a=e.do)!=null&&a.open||(o=e.do)!=null&&o.walk?"open":"look"}pauseBlocked(){return!!this.curtain||this.pendingRoom!==null}setPaused(e){this.paused=e,e?(this.persist(),this.settings.show()):this.settings.hide()}resumeWith(e){this.setPaused(!1),!(this.title||this.won||this.cinematic.active)&&(e==="tip"&&!this.dialogue&&!this.queue&&!this.inputLocked()&&this.showTip(),e==="history"&&(this.audio.page(),this.history.show()))}start(){try{this.hasSave=qn(be),this.hasPrevious=Rn()}catch{this.hasSave=!1,this.hasPrevious=!1}addEventListener("storage",e=>this.onStorage(e)),addEventListener("pagehide",()=>this.flushAutosave()),document.addEventListener("visibilitychange",()=>{document.hidden&&this.flushAutosave()}),this.input.onDown((e,t,a,o)=>{this.title||(this.keysActed=!0),this.touch=o.kind!=="mouse"||this.mobile,this.onClick(e,t,a,o.clicks)}),this.input.onMove((e,t,a,o)=>{this.touch=o.kind!=="mouse"||this.mobile,this.onMove(e,t)}),this.input.onPan(e=>{!this.title&&!this.paused&&!this.inputLocked()&&this.view.dragCrop(e)}),this.input.onKey((e,t)=>{!this.title&&Xo(e)&&(this.keysActed=!0),this.onKey(e,t)}),this.input.onKey(e=>{e==="Control"?this.ctrlHeld=!0:e==="]"&&(this.bracketHeld=!0)}),this.input.onKeyUp(e=>{(e===""||e.toLowerCase()==="q")&&(this.revealHeld=!1),(e===""||e==="Control")&&(this.ctrlHeld=!1),(e===""||e==="]")&&(this.bracketHeld=!1)}),Kr(()=>this.syncDocument()),Yr(()=>this.syncDocument()),this.syncDocument(),this.buildA11yControls(),this.loadRoom(Jl,Dn),this.enterTitle(),this.mobile&&(this.mobileUI=new Cu(this.mobileBridge()),this.mobileUI.sync(this.mobileState())),this.mobile||this.view.canvas.focus({preventScroll:!0}),this.loop.start()}step(e,t){this.pad.connected&&this.pad.poll(e),this.paused||(this.time+=t),this.update(t),this.mobileUI&&e-this.mobileSyncAt>100&&(this.mobileSyncAt=e,this.mobileUI.sync(this.mobileState()));const a=this.paused||this.cinematic.active||this.casebook.open||this.history.open||this.deeds.open,o=this.view.canvas.width===this.drawnW&&this.view.canvas.height===this.drawnH;(!a||!o||e-this.drawnAt>250)&&(this.render(),this.drawnAt=e,this.drawnW=this.view.canvas.width,this.drawnH=this.view.canvas.height)}behindCurtain(e){const t=this.curtain;this.curtain=t?()=>{t(),e()}:e,this.fadeTarget=1,this.transition.leave(null),this.passagePlate=null}inputLocked(){var e;return this.curtain||this.deeds.open||(e=this.atlas)!=null&&e.open||this.areaCardBusy||this.recap.open?!0:this.title||this.won?!1:this.paused||this.cinematic.active||this.pendingRoom!==null||this.fade>.5}onKey(e,t){var o;if(t.ctrlKey||t.metaKey||t.altKey)return;if(e==="]"){t.preventDefault();return}if(this.a11y&&e!=="Escape"&&t.target instanceof Node&&this.a11y.root.contains(t.target)||this.mobileUI&&e!=="Escape"&&t.target instanceof Node&&this.mobileUI.contains(t.target)||this.mobile&&e==="Tab"&&!t.__pad||e==="Tab"&&t.target===document.body&&!this.paused&&!this.cinematic.active&&!this.casebook.open&&!this.history.open&&!this.deeds.open&&!this.recap.open&&!this.atlas.open||!Xo(e))return;this.idle=0,this.touchBarArmed=null;const a=e==="Tab"||e.startsWith("Arrow")||e==="PageUp"||e==="PageDown";if(t.repeat&&!a){(e==="Enter"||e===" "||e==="Escape")&&t.preventDefault();return}if(this.areaCardBusy){this.clearAreaCard(!0);return}if(this.paused){this.pausedKey(e,t);return}if(!this.cinematic.active){if((o=this.atlas)!=null&&o.open){t.preventDefault(),(e==="Escape"||e.toLowerCase()==="a")&&this.atlas.hide();return}if((a||e==="Enter"||e===" ")&&(this.lastInput="keyboard"),!(this.explore&&this.exploreKey(e,t))){if(this.casebook.open||this.history.open||this.deeds.open){t.preventDefault(),(e==="Escape"||e.toLowerCase()==="j")&&this.casebook.hide(),(e==="Escape"||e.toLowerCase()==="l")&&this.history.hide(),this.deeds.open&&(e==="Escape"||e==="Enter"||e===" ")&&this.deeds.hide();return}if(this.audio.unlock(),this.title&&this.confirmNew&&e==="Escape"){t.preventDefault(),this.cancelConfirmNew();return}if(this.title&&this.recoverOpen&&e==="Escape"){t.preventDefault(),this.closeRecover();return}if(e==="Escape"&&!this.won&&this.curtain){t.preventDefault();return}if(e==="Escape"&&!this.won){if(t.preventDefault(),this.dialogue){this.leaveDialogue(),this.dialogueClosedAt=performance.now(),this.announce("Left the conversation.");return}if(this.sentence.verb||this.sentence.a||this.sentence.b||this.committed){this.path=[],this.onArrive=null,this.walkGoal=null,this.running=!1,this.touchArmed=null,this.clearSentence(),this.announce("Cancelled.");return}this.flashBar("pause"),this.pauseBlocked()||this.setPaused(!0);return}if(e.toLowerCase()==="m"){this.audio.toggleMute();return}if(this.inputLocked()){(e==="Enter"||e===" "||e.startsWith("Arrow"))&&t.preventDefault();return}if(e.toLowerCase()==="a"&&!this.title&&!this.won&&!this.cinematic.active){t.preventDefault(),this.flashBar("map"),this.showAtlas();return}if(e.toLowerCase()==="j"&&!this.title&&!this.won&&!this.cinematic.active){t.preventDefault(),this.flashBar("casebook"),this.audio.page(),this.showCasebook();return}if(e.toLowerCase()==="l"&&!this.title&&!this.cinematic.active){t.preventDefault(),this.flashBar("log"),this.audio.page(),this.history.show();return}if(e.toLowerCase()==="q"&&!this.title&&!this.won){if(t.preventDefault(),this.flashBar("reveal"),this.prefs.revealMode==="toggle"){this.toggleReveal();return}this.revealHeld||this.announce(this.revealSummary()),this.revealHeld=!0;return}if((e==="h"||e==="H")&&!this.title&&!this.won&&!this.dialogue&&!this.queue){this.flashBar("tip"),this.showTip();return}if(this.won&&(e==="Enter"||e===" ")){t.preventDefault(),this.advanceEnding();return}if(this.title){this.titleKey(e,t);return}if(!a&&this.narration&&this.narration.shown<this.narration.text.length){t.preventDefault(),this.narration.shown=this.narration.text.length,this.narrationClock=this.typeTime(this.narration.text.length);return}if(!a&&this.queue){t.preventDefault(),this.flushQueue();return}if(this.dialogue){const s=this.visibleChoices();if(/^[1-9]$/.test(e))t.preventDefault(),this.pickChoice(parseInt(e,10)-1);else if(s.length&&["ArrowUp","ArrowLeft","ArrowDown","ArrowRight"].includes(e)){t.preventDefault();const i=e==="ArrowUp"||e==="ArrowLeft"?-1:1;this.hoverChoice=(this.hoverChoice+i+s.length)%s.length,this.cueHover(`choice:${this.hoverChoice}`);const r=s[this.hoverChoice];this.announce(`${this.hoverChoice+1} of ${s.length}: ${Ge(r.text)}${r.seen?" Asked before.":""}`)}else if(e==="Tab"&&s.length&&(t.shiftKey?this.hoverChoice>0:this.hoverChoice<s.length-1)){t.preventDefault(),this.hoverChoice=t.shiftKey?this.hoverChoice-1:this.hoverChoice+1,this.cueHover(`choice:${this.hoverChoice}`);const i=s[this.hoverChoice];this.announce(`${this.hoverChoice+1} of ${s.length}: ${Ge(i.text)}${i.seen?" Asked before.":""}`)}else if(e==="Enter"||e===" "){t.preventDefault();const i=this.currentNode();i&&this.dialogue.shown<i.text.length?this.dialogue.shown=i.text.length:s.length?this.pickChoice(this.hoverChoice<0?0:this.hoverChoice):this.advanceDialogue()}return}if(e==="Tab"){if(!this.moveFocus(t.shiftKey?-1:1))return;t.preventDefault()}else["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e)?(t.preventDefault(),this.moveFocusGrid(e)):e==="PageUp"||e==="PageDown"?(t.preventDefault(),this.turnPage(e==="PageUp"?-1:1)):(e==="Enter"||e===" ")&&(t.preventDefault(),this.activateFocus())}}}pausedKey(e,t){const a=e.toLowerCase();e==="Escape"?(t.preventDefault(),this.setPaused(!1)):a==="h"?(t.preventDefault(),this.resumeWith("tip")):a==="l"?(t.preventDefault(),this.resumeWith("history")):e==="Tab"&&(t.preventDefault(),this.settings.focus())}titleKey(e,t){const a=this.titleButtons(),o=a.findIndex(s=>s.id===this.titleFocus);if((e==="c"||e==="C")&&this.hasSave)this.titleActivate("continue");else if((e==="e"||e==="E")&&this.chaptersUnlocked())this.titleActivate("explore");else if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Tab"].includes(e)){const s=e==="ArrowUp"||e==="ArrowLeft"||e==="Tab"&&t.shiftKey?-1:1;if(o>=0&&(o+s<0||o+s>=a.length))return;t.preventDefault();const i=o<0?a.find(r=>r.id===Re(a))??a[0]:a[o+s];this.setTitleFocus(i.id),this.announce(`${i.label}, button ${a.indexOf(i)+1} of ${a.length}`)}else(e==="Enter"||e===" ")&&(t.preventDefault(),this.titleActivate(o<0?Re(a):this.titleFocus))}groupIds(e){if(e==="verb")return ie.map(t=>t.id);if(e==="item"){const t=this.pageInventory();return this.pageCount()>1?[...t,ke.prev,ke.next]:t}return this.sceneOrder().map(t=>t.id)}sceneOrder(){return this.visibleHotspots().map(e=>({h:e,c:this.areaCentre(e.area)})).sort((e,t)=>e.c.x-t.c.x||e.c.y-t.c.y).map(e=>e.h)}focusValid(){const e=this.keyboardFocus;return!!(e&&this.groupIds(e.kind).includes(e.id))}setFocus(e){this.keyboardFocus=e,this.focusMemory[e.kind]=e.id,this.hoverHotspot=null,this.cueHover(`focus:${e.kind}:${e.id}`),this.syncKeyboardCamera(),this.announceFocus()}moveFocus(e){const t=Ku.filter(l=>this.groupIds(l).length>0);if(!t.length)return!1;const a=this.focusValid()?t.indexOf(this.keyboardFocus.kind):-1,o=a<0?e<0?t.length-1:0:a+e;if(o<0||o>=t.length)return!1;const s=t[o],i=this.groupIds(s),r=this.focusMemory[s],h=r&&i.includes(r)?r:s==="hotspot"?this.nearestHotspot()??i[0]:i[0];return this.setFocus({kind:s,id:h}),!0}nearestHotspot(){let e=null,t=1/0;for(const a of this.visibleHotspots()){const o=this.areaCentre(a.area),s=o.x>=this.cameraX&&o.x<=this.cameraX+S,i=Math.abs(o.x-this.x)+(s?0:1e5);i<t&&(t=i,e=a.id)}return e}moveFocusGrid(e){if(!this.focusValid()){this.moveFocus(1);return}const t=this.keyboardFocus;if(t.kind==="hotspot"){const c=this.groupIds("hotspot"),p=c.indexOf(t.id),g=e==="ArrowUp"||e==="ArrowLeft"?-1:1;this.setFocus({kind:"hotspot",id:c[(p+g+c.length)%c.length]});return}if(t.kind==="item"){this.moveItemFocus(e,t.id);return}const a=6,o=this.groupIds(t.kind),s=o.indexOf(t.id),i=Math.floor(s/a),r=s%a,h=Math.ceil(o.length/a);let l=i,u=r;e==="ArrowUp"&&(l=Math.max(0,i-1)),e==="ArrowDown"&&(l=Math.min(h-1,i+1)),e==="ArrowLeft"&&(u=Math.max(0,r-1)),e==="ArrowRight"&&(u=Math.min(a-1,r+1));const d=Math.min(o.length-1,l*a+u);this.setFocus({kind:"verb",id:o[d]})}moveItemFocus(e,t){const a=this.pageCount(),o=this.pageInventory(),s=4;if(Rt(t)){if(e==="ArrowLeft"||e==="ArrowRight")this.turnPage(e==="ArrowLeft"?-1:1),this.setFocus({kind:"item",id:e==="ArrowLeft"?ke.prev:ke.next});else if(e==="ArrowUp"&&o.length){const c=Math.max(0,Math.ceil(o.length/s)-1);this.setFocus({kind:"item",id:o[Math.min(o.length-1,c*s)]})}return}const i=o.indexOf(t);if(i<0){o.length&&this.setFocus({kind:"item",id:o[0]});return}const r=Math.floor(i/s),h=i%s,l=Math.ceil(o.length/s);if(e==="ArrowDown"&&r>=l-1&&a>1){this.setFocus({kind:"item",id:ke.prev});return}if(a>1&&(e==="ArrowLeft"&&h===0||e==="ArrowRight"&&h===s-1)){this.turnPage(e==="ArrowLeft"?-1:1);const c=this.pageInventory();c.length&&this.setFocus({kind:"item",id:c[Math.min(r*s,c.length-1)]});return}let u=r,d=h;e==="ArrowUp"&&(u=Math.max(0,r-1)),e==="ArrowDown"&&(u=Math.min(l-1,r+1)),e==="ArrowLeft"&&(d=Math.max(0,h-1)),e==="ArrowRight"&&(d=Math.min(s-1,h+1)),this.setFocus({kind:"item",id:o[Math.min(o.length-1,u*s+d)]})}pageCount(){return Math.max(1,Math.ceil(this.inventory.length/ve))}pageInventory(){const e=Math.min(this.inventoryPage,this.pageCount()-1);return this.inventory.slice(e*ve,e*ve+ve)}turnPage(e){var a;const t=this.pageCount();t<2||(this.inventoryPage=(Math.min(this.inventoryPage,t-1)+e+t)%t,this.hoverItem=null,Fe("inventory",this.reduced)&&this.audio.inventory(e>0),((a=this.keyboardFocus)==null?void 0:a.kind)==="item"&&Rt(this.keyboardFocus.id)||(this.keyboardFocus=null),this.syncA11yControls(),this.announce(`Page ${Math.min(this.inventoryPage,t-1)+1} of ${t}`))}visibleHotspots(){return this.room.hotspots.filter(e=>!e.showIf||e.showIf.every(t=>this.check(t)))}announceFocus(){var t,a,o;const e=this.keyboardFocus;if(e)if(e.kind==="verb"){const s=ie.findIndex(i=>i.id===e.id);this.announce(`Verb: ${((t=ie[s])==null?void 0:t.label)??e.id}, ${s+1} of ${ie.length}`)}else if(e.kind==="item"){if(Rt(e.id)){const i=this.pageCount(),r=Math.min(this.inventoryPage,i-1)+1;this.announce(`${e.id===ke.prev?"Previous":"Next"} page, page ${r} of ${i}`);return}const s=this.pageInventory();this.announce(`Item: ${((a=ye[e.id])==null?void 0:a.name)??e.id}, ${s.indexOf(e.id)+1} of ${s.length}`)}else{const s=this.sceneOrder(),i=s.find(c=>c.id===e.id);if(!i)return;const r=this.hotspotState(i),h=this.isExit(r),l=h?"Go through":(o=ie.find(c=>c.id===this.suggestedVerb(r)))==null?void 0:o.label,u=h?" A way out.":"",d=this.sentence.verb?"":` Enter: ${l}.`;this.announce(`${r.name}, ${s.indexOf(i)+1} of ${s.length}.${u}${d}`)}}syncKeyboardCamera(){var t;if(this.focusCameraX=null,this.cameraHold=null,((t=this.keyboardFocus)==null?void 0:t.kind)!=="hotspot")return;const e=this.visibleHotspots().find(a=>{var o;return a.id===((o=this.keyboardFocus)==null?void 0:o.id)});e&&(this.focusCameraX=(e.stand??this.areaStand(e.area)).x)}activateFocus(){if(!this.focusValid()){this.moveFocus(1);return}const e=this.keyboardFocus;if(e.kind==="verb")this.audio.click(),this.setVerb(e.id);else if(e.kind==="item"&&Rt(e.id))this.audio.click(),this.turnPage(e.id===ke.prev?-1:1);else if(e.kind==="item"&&this.inventory.includes(e.id))this.audio.click(),this.pickItem(e.id);else if(e.kind==="hotspot"){this.focusCameraX=null;const t=this.visibleHotspots().find(a=>a.id===e.id);t&&this.onHotspotClick(t)}}onMove(e,t){var s;if(this.lastInput="pointer",this.pointerSeen=!0,this.idle=0,this.keyboardFocus=null,this.focusCameraX=null,this.hoverVerb=null,this.hoverItem=null,this.hoverHotspot=null,this.hoverChoice=-1,this.title){const i=((s=this.titleButtons().find(r=>this.hitTitle(r.y,e,t)))==null?void 0:s.id)??null;i!==this.titleFocus&&this.setTitleFocus(i);return}if(this.roomMenu){const r=this.roomMenuLayout().rects.findIndex(h=>es(e,t,h));r>=0&&(this.roomMenuFocus=r),this.cueHover(r>=0?`menu:${r}`:null);return}if(this.dialogue){const i=this.dialogueModel(),r=Hn(e,t,i);this.hoverChoice=r??-1,this.cueHover(r===null?null:`choice:${r}`);return}const a=qt(e,t,this.panelModel());if(a){a.kind==="verb"?this.hoverVerb=a.id:a.kind==="item"&&(this.hoverItem=a.id,this.fx.seen(a.id)),this.cueHover("id"in a?`${a.kind}:${a.id}`:`panel:${a.kind}`);return}const o=t<q?this.exitChevronAt(e,t)??this.hotspotAt(e+this.cameraX,t):null;this.hoverHotspot=(o==null?void 0:o.id)??null,this.cueHover(o?`hotspot:${o.id}`:null)}cueHover(e){e!==this.hoverCueKey&&(this.hoverCueKey=e,!(!e||this.touch||!Fe("hover",this.reduced))&&(this.paused||this.cinematic.active||this.won||this.areaCardBusy||this.curtain||this.pendingRoom!==null||this.fade>.5||this.atlas.open||this.casebook.open||this.history.open||this.deeds.open||this.audio.hover()))}barHit(e,t){if(this.title||this.won||t<oe.y||t>oe.y+oe.h)return null;const a=Xn();for(const o of fn){const s=a[o];if(e>=s.x&&e<=s.x+s.w)return o}return null}showAreaCard(e,t){const a=hn.find(s=>s.id===e);if(!a){t();return}this.assets.ensure([a.image]),this.clearAreaCard();const o=document.createElement("div");o.className="area-card",o.innerHTML=`
      <img src="${da(a.image)}" alt="" />
      <div class="area-card-text">
        <p>ACT ${a.act} · DREADWATER ISLE</p>
        <h1>${Et(a.name)}</h1>
        <p class="area-card-blurb">${Et(a.blurb)}</p>
      </div>`,document.body.append(o),this.areaCard=o,this.areaCardBusy=!0,this.areaCardLeft=2.55,this.areaCardFading=!1,this.areaCardThen=t,requestAnimationFrame(()=>o.classList.add("in"))}tickAreaCard(e){var t;this.areaCardBusy&&(this.areaCardLeft-=e,!this.areaCardFading&&this.areaCardLeft<=.45&&(this.areaCardFading=!0,(t=this.areaCard)==null||t.classList.remove("in")),this.areaCardLeft<=0&&this.clearAreaCard(!0))}clearAreaCard(e=!1){var a;const t=this.areaCardThen;this.areaCardLeft=0,this.areaCardFading=!1,this.areaCardThen=null,(a=this.areaCard)==null||a.remove(),this.areaCard=null,this.areaCardBusy=!1,e&&(t==null||t())}announceBusy(){const e=performance.now();e-this.busyAnnouncedAt<uf||(this.busyAnnouncedAt=e,this.announce("Wait a moment."))}showAtlas(){var e;if(!(this.title||this.won||this.paused||this.cinematic.active||this.dialogue||this.queue||this.atlas.open)){if(this.areaCardBusy||this.pendingRoom!==null||this.curtain||this.fade>0||this.path.length>0||this.onArrive||this.walkGoal||this.running){this.announceBusy();return}this.audio.chart(!0),this.atlas.show({act:this.act,room:((e=this.room)==null?void 0:e.id)??null,visited:t=>!!this.flags[`visited:${t}`]})}}travelTo(e){var a;const t=jt(e);!t||t.act!==this.act||e===((a=this.room)==null?void 0:a.id)||(this.path=[],this.onArrive=null,this.walkGoal=null,this.running=!1,this.clearSentence(),Fe("travel",this.reduced)&&this.audio.travel(),this.goRoom(e,"none"))}barAction(e){if(!this.cinematic.active){if(this.clearTouchArm(),this.flashBar(e),e==="pause"){!this.paused&&!this.pauseBlocked()&&this.setPaused(!0);return}if(!(this.title||this.won)){if(e==="map"){this.showAtlas();return}if(e==="casebook"){this.audio.page(),this.showCasebook();return}if(e==="log"){this.audio.page(),this.history.show();return}if(e==="reveal"){this.toggleReveal();return}e==="tip"&&!this.dialogue&&!this.queue&&!this.inputLocked()&&this.showTip()}}}toggleReveal(){this.revealToggled=!this.revealToggled,this.announce(this.revealToggled?this.revealSummary():"Reveal off."),this.syncA11yControls()}get revealing(){return(this.revealHeld||this.revealToggled)&&!this.title&&!this.won&&!this.dialogue}flashBar(e){this.idle=0,this.barFlash={id:e,left:.65}}revealSummary(){const e=this.visibleHotspots().map(t=>this.hotspotState(t).name);return e.length?`In ${this.room.name}: ${Ge(e.join(", "))}`:`Nothing to use in ${this.room.name}.`}isExit(e){var t,a;return!!((a=(t=this.hotspotState(e).do)==null?void 0:t.walk)!=null&&a.length)}edgeExitAt(e,t){var h,l;const a=this.view.visible,o=e<=a.x+zt?"left":e>=a.x+a.w-zt?"right":null;if(!o||t<0||t>=q)return null;const s=o==="left"?this.cameraX+a.x:this.cameraX+a.x+a.w;let i=null,r=1/0;for(const u of this.visibleHotspots()){const d=this.hotspotState(u);if(!((l=(h=d.do)==null?void 0:h.walk)!=null&&l.length)||d.noWalk)continue;const c=Te(d.area);if(!(o==="left"?c.x<=s+os&&c.x+c.w>=s:c.x+c.w>=s-os&&c.x<=s))continue;const g=d.stand??this.areaStand(d.area),m=Math.hypot(g.x-s,g.y-t);m<r&&(r=m,i=u)}return i}isBareScene(e,t){if(t>=q||qt(e,t,this.panelModel())||this.hotspotAt(e+this.cameraX,t)||this.touch&&this.nearestHotspotAt(e+this.cameraX,t)||this.edgeExitAt(e,t))return!1;const a={x:e+this.cameraX,y:t},o=nt(a,this.room.walk);return Math.hypot(o.x-a.x,o.y-a.y)<90}onClick(e,t,a,o=1){if(this.deeds.open){this.deeds.hide();return}if(this.areaCardBusy){this.clearAreaCard(!0);return}if(this.paused||this.cinematic.active||this.casebook.open||this.history.open)return;if(this.roomMenu){this.mobile||this.roomMenuClick(e,t);return}if(this.explore&&!this.roomMenu&&e>=470&&e<=1080&&t>=oe.y&&t<=oe.y+oe.h){this.roomMenu=!0,this.focusCurrentScene();return}this.audio.unlock(),this.lastInput="pointer",this.idle=0,this.keyboardFocus=null,this.focusCameraX=null;const s=this.mobile?null:this.barHit(e,t);if(s){if(this.touch&&this.touchBarArmed!==s){this.audio.arm(),this.touchBarArmed=s,this.barLabel={id:s,left:3.2},this.idle=0,this.announce(`${Yo[s]} (${jn[s]}). Tap again.`);return}this.touchBarArmed=null,this.barAction(s);return}if(this.touchBarArmed=null,this.barLabel=null,this.inputLocked())return;if(this.won){this.advanceEnding();return}if(this.title){if(a===2||this.mobile||o>=2)return;const d=this.titleButtons().find(c=>this.hitTitle(c.y,e,t));d?this.titleActivate(d.id):this.confirmNew?this.cancelConfirmNew():this.recoverOpen&&this.closeRecover();return}const r=!!(this.narration||this.queue)&&!this.dialogue&&a!==2&&this.isBareScene(e,t);if(this.narration&&this.narration.shown<this.narration.text.length){if(this.narration.shown=this.narration.text.length,this.narrationClock=this.typeTime(this.narration.text.length),!r)return}else if(this.queue&&(this.flushQueue(),!r))return;if(this.dialogue){if(a===2){this.leaveDialogue(),this.dialogue||(this.dialogueClosedAt=performance.now());return}const d=this.currentNode();if(d&&this.dialogue.shown<d.text.length){this.dialogue.shown=d.text.length;return}const c=Hn(e,t,this.dialogueModel());c!==null?this.pickChoice(c):this.visibleChoices().length===0&&this.advanceDialogue(),this.dialogue||(this.dialogueClosedAt=performance.now());return}if(o>=2&&performance.now()-this.dialogueClosedAt<500)return;const h=qt(e,t,this.panelModel());if(a===2){this.clearTouchArm();const d=!this.sentence.verb&&!this.sentence.a;if(d&&(h==null?void 0:h.kind)==="item"){this.audio.click(),this.setVerb("look"),this.pickItem(h.id);return}const c=d&&t<q?this.hotspotAt(e+this.cameraX,t):null;if(c){this.setVerb("look"),this.onHotspotClick(c);return}this.path=[],this.onArrive=null,this.walkGoal=null,this.running=!1,this.clearSentence();return}if(h){this.clearTouchArm(),this.onPanelHit(h);return}if(t>=q)return;const l=(t<q?this.hotspotAt(e+this.cameraX,t):null)??(this.touch&&t<q?this.nearestHotspotAt(e+this.cameraX,t):null),u=this.exitChevronAt(e,t);if(u){if(this.touch&&!this.sentence.verb){if(this.hoverHotspot=u.id,this.hoverDirty=!1,this.touchArmed===u.id){if(performance.now()-this.touchArmedAt<Qn)return;this.clearTouchArm(),this.onHotspotClick(u,1);return}this.armTouch(u);return}this.clearTouchArm(),this.onHotspotClick(u,o);return}if(!l){const d=this.edgeExitAt(e,t),c=this.room.walk.some(m=>Ne({x:e+this.cameraX,y:t},m));if(d&&c&&!this.sentence.verb&&!this.sentence.a&&!this.sentence.b){if(this.touch){this.touchArmed!==d.id?this.armTouch(d):performance.now()-this.touchArmedAt>=Qn&&(this.clearTouchArm(),this.onHotspotClick(d,1));return}this.onHotspotClick(d,o);return}if(this.clearTouchArm(),this.sentence.verb==="look"&&!this.sentence.a&&!this.sentence.b){this.clearSentence(),this.speak(od(this.act));return}const p=nt({x:e+this.cameraX,y:t},this.room.walk),g=this.path.length>0&&this.walkGoal!==null&&Math.hypot(p.x-this.walkGoal.x,p.y-this.walkGoal.y)<60;this.walkTo(p,!0),(o>=2||g)&&this.path.length>0&&(this.running=!0),this.path.length>0&&this.fx.ring(p,this.personHeight(p.y));return}if(this.touch&&!this.sentence.verb){if(this.hoverHotspot=l.id,this.hoverDirty=!1,this.teach("look"),this.touchArmed===l.id){if(performance.now()-this.touchArmedAt<Qn)return;this.clearTouchArm(),this.onHotspotClick(l,1);return}this.armTouch(l);return}this.clearTouchArm(),this.onHotspotClick(l,this.touch?1:o)}confirmTouchArm(){const e=this.touchArmed;if(!e)return;if(this.inputLocked()||this.dialogue){this.clearTouchArm();return}const t=this.visibleHotspots().find(a=>a.id===e);this.clearTouchArm(),t&&(this.hoverHotspot=t.id,this.onHotspotClick(t,1))}armTouch(e){this.audio.arm(),this.hoverHotspot=e.id,this.hoverDirty=!1,this.touchArmed=e.id,this.touchArmedAt=performance.now();const t=this.suggestion();this.announce(`${Ge(e.name)} Tap again: ${Ge(t.suggestLine??"act")}`)}cancelTouch(){this.clearTouchArm(),this.sentence={verb:null,a:null,b:null},this.committed=null,this.hoverHotspot=null,this.hoverVerb=null,this.hoverItem=null}continueStory(){if(this.narration&&this.narration.shown<this.narration.text.length){this.narration.shown=this.narration.text.length,this.narrationClock=this.typeTime(this.narration.text.length);return}this.queue&&this.flushQueue()}mobileDialogueTap(){if(!this.dialogue)return;const e=this.currentNode();if(e&&this.dialogue.shown<e.text.length){this.dialogue.shown=e.text.length;return}this.visibleChoices().length===0&&(this.advanceDialogue(),this.dialogue||(this.dialogueClosedAt=performance.now()))}mobileDialogueChoice(e){this.dialogue&&(this.pickChoice(e),this.dialogue||(this.dialogueClosedAt=performance.now()))}sentenceText(){const{verb:e,a:t,b:a}=this.sentence;if(!e)return"";const o=ie.find(r=>r.id===e),s=[(o==null?void 0:o.label)??"",(t==null?void 0:t.name)??""].filter(Boolean).join(" ");if(!s)return"";const i=e==="give"?"to":"with";return a?`${s} ${i} ${a.name}`:o!=null&&o.twoObject&&t?`${s} ${i} …`:s}syncMobileLayout(){if(!this.mobile||typeof document>"u")return;const e=this.title||this.won;document.body.classList.toggle("m-full",e),document.body.classList.toggle("m-title",this.title),e!==this.mobileFull&&(this.mobileFull=e,this.view.setSceneOnly(!e)),this.view.setTitleCover(this.title),this.panMobileCrop()}panMobileCrop(){var i,r;const e=performance.now(),t=Math.min(.1,Math.max(0,(e-this.mobileCropAt)/1e3));this.mobileCropAt=e;const a=`${this.title?"t":this.won?"w":(i=this.room)==null?void 0:i.id}|${window.innerWidth}x${window.innerHeight}`,o=a!==this.mobileCropKey||this.reduced;this.mobileCropKey=a;let s=this.title?this.cameraX+S/2:this.focusCameraX??this.x;if(!this.title&&this.focusCameraX===null&&this.dialogue){const h=((r=this.currentNode())==null?void 0:r.speaker)??"",l=h&&h!=="fenn"?this.speakerSprite(h):null;l&&(s=Math.abs(l.x-this.x)<this.view.visible.w*.8?(l.x+this.x)/2:l.x)}this.view.panTo(s-this.cameraX,t,o)}portraitUrl(e){const t=Ee(e).portrait,a=t?Qe.images[t]:void 0;return a?At(a):null}get mobileTextScale(){return this.mobile?Math.max(this.textScale,Math.min(3,15/Math.max(1,27*this.view.scale))):this.textScale}mobileState(){var g,m,b,y,_,x;const e=this.title?this.titleButtons():[],t=e.length?Re(e):null,a=this.title&&this.confirmNew&&performance.now()-this.confirmArmedAt<Qo,o=e.map(T=>({id:T.id,label:T.label,sub:T.sub,kind:T.id==="confirm"?"danger":T.id==="explore"?"quiet":T.id===t||T.id==="keep"?"primary":"quiet",disabled:T.id==="confirm"&&a})),s=this.dialogue;let i=null;if(s){const T=this.currentNode(),N=this.visibleChoices();i={speaker:Ee((T==null?void 0:T.speaker)??"").name,portrait:this.portraitUrl((T==null?void 0:T.speaker)??""),text:(T==null?void 0:T.text)??"",shown:s.shown,choices:N.map(C=>({text:C.text,seen:!!C.seen})),canAdvance:!!(T&&s.shown>=T.text.length&&N.length===0)}}const r=this.touchArmed?this.visibleHotspots().find(T=>T.id===this.touchArmed):void 0;let h=null;if(r){const T=this.hotspotState(r),N=this.isExit(T)?"walk":this.suggestedVerb(T);h={label:[((g=ie.find(D=>D.id===N))==null?void 0:g.label)??"",T.name].filter(Boolean).join(" "),hint:"Tap again in the scene, or tap here"}}const l=gn(this.inventory.length),u=Math.min(this.inventoryPage,l-1),d=new Set([(m=this.sentence.a)==null?void 0:m.id,(b=this.sentence.b)==null?void 0:b.id].filter(T=>!!T)),c=ae[this.act],p=this.sentence.verb?null:this.suggestion().suggestVerb;return{screen:this.title?"title":this.won?"ending":i?"dialogue":"play",cut:this.pendingRoom!==null||this.fade>.05,blocked:this.paused||this.cinematic.active||this.casebook.open||this.history.open||this.atlas.open||this.deeds.open,title:{buttons:o},dialogue:i,ending:this.won&&this.ending?{page:this.ending.pageNumber,pages:this.ending.pageCount}:null,play:{act:c?`Act ${Ve[c.n]??c.n}`:"",room:((y=this.room)==null?void 0:y.name)??"",narration:((_=this.narration)==null?void 0:_.text)??"",narrationShown:((x=this.narration)==null?void 0:x.shown)??0,sentence:this.sentenceText(),explore:this.explore,armed:h,waiting:!!(this.queue&&this.narration),verbs:ie.map(T=>({id:T.id,label:T.id==="walk"?"Walk":T.label,active:this.sentence.verb===T.id,suggested:p===T.id})),inventory:this.inventory.map(T=>{var N;return{id:T,name:((N=ye[T])==null?void 0:N.name)??T,selected:d.has(T),icon:Tt.has(T)?At(Qe.images[`item_${T}`]):null}}),page:u,pages:l},reveal:this.revealToggled,tip:this.tipMode,lesson:this.lessonShowing()?Yn[this.watch.current.id].text(!0):null,roomMenu:this.roomMenu?{open:!0,rooms:this.exploreRooms().map(T=>{var N;return{id:T.id,label:`${T.act?`Act ${T.act} · `:""}${((N=le[T.id])==null?void 0:N.name)??T.id}`}})}:null}}mobileBridge(){return{bar:e=>this.barAction(e),verb:e=>{this.audio.click(),this.setVerb(e)},item:e=>{this.audio.click(),this.pickItem(e)},page:e=>this.turnPage(e),clear:()=>this.clearSentence(),confirm:()=>this.confirmTouchArm(),cancel:()=>this.cancelTouch(),continueStory:()=>this.continueStory(),dialogueTap:()=>this.mobileDialogueTap(),dialogueChoice:e=>this.mobileDialogueChoice(e),title:e=>this.titleActivate(e),unlockAudio:()=>this.audio.unlock(),drawer:e=>{Fe("inventory",this.reduced)&&this.audio.inventory(e)},advanceEnding:()=>this.advanceEnding(),room:e=>{const t=this.exploreRooms().findIndex(a=>a.id===e);t>=0&&this.exploreGo(t)},openRooms:()=>{!this.explore||this.roomMenu||(this.roomMenu=!0,this.announce("Chapter select."))},closeRooms:()=>{this.roomMenu&&(this.roomMenu=!1,this.announce("Chapter select closed."))},state:()=>this.mobileState()}}onPanelHit(e){if(this.audio.click(),e.kind==="verb"){this.setVerb(e.id);return}if(e.kind==="item"){this.pickItem(e.id);return}if(e.kind==="page"){this.turnPage(e.delta);return}e.kind==="sentence"&&this.execute()}clearSentence(){this.clearTouchArm(),this.sentence={verb:null,a:null,b:null},this.committed=null,this.narration=null}clearTouchArm(){this.touchArmed=null,this.touchArmedAt=0}get sentenceSent(){return this.committed!==null&&this.committed===this.sentenceKey()}startSentence(){this.sentenceSent&&(this.sentence={verb:null,a:null,b:null},this.committed=null)}setVerb(e){this.clearTouchArm(),this.startSentence();const t=this.sentence.a;if(this.sentence={verb:e,a:t,b:null},this.narration=null,e==="walk"&&this.sentence.a){const a=this.resolveStand(this.sentence.a);a&&this.walkTo(a,!0),this.sentence.a=null}}pickItem(e){var s;this.clearTouchArm(),this.startSentence(),this.fx.seen(e),this.narration=null;const t=((s=ye[e])==null?void 0:s.name)??e,a={kind:"item",id:e,name:t};this.sentence.verb||(this.sentence.verb="use");const o=ie.find(i=>i.id===this.sentence.verb);if(o!=null&&o.twoObject&&this.sentence.a&&this.sentence.a.id!==a.id){this.sentence.b=a,this.execute();return}this.sentence.a=a,this.sentence.b=null,o!=null&&o.twoObject&&this.teach("use"),o!=null&&o.twoObject||this.execute()}onHotspotClick(e,t=1){var h,l;this.audio.click(),this.startSentence();const a=this.hotspotState(e);let o=this.sentence.verb;if(o||(o=this.isExit(a)?"walk":this.suggestedVerb(a),o!=="walk"&&this.setVerb(o)),o==="walk"){const u=e.stand??this.areaStand(e.area),d=(h=a.do)==null?void 0:h.walk,c=a.say.walk;if(d&&t>=2){this.path=[],this.onArrive=null,this.walkGoal=null,this.running=!1,this.clearSentence(),this.goThrough(e,d);return}const p=this.path.length>0&&this.walkGoal!==null&&Math.hypot(u.x-this.walkGoal.x,u.y-this.walkGoal.y)<2,g=d?()=>this.goThrough(e,d):c?()=>{this.faceToward(e),this.speak(c)}:void 0;this.walkTo(u,!0,g),p&&this.path.length>0&&(this.running=!0);return}const s=e.name,i={kind:"hotspot",id:e.id,name:s},r=ie.find(u=>u.id===o);if(r!=null&&r.twoObject){if(this.sentence.b&&(this.sentence={verb:o,a:null,b:null}),!this.sentence.a){if((l=e.do)!=null&&l[o]){this.runHotspot(o,e);return}this.sentence.a=i,o==="use"&&e.say.use&&this.speak(e.say.use);return}if(this.sentence.a.kind==="item"&&!this.sentence.b){this.sentence.b=i,this.execute();return}this.sentence.b=this.sentence.a,this.sentence.a=i,this.execute();return}this.sentence.a=i,this.sentence.b=null,this.execute()}goThrough(e,t){this.prepareExit(e,t),this.runEffects(t),this.exitAt=null}prepareExit(e,t){if(!t.some(r=>r.k==="go"))return;this.exitAt=this.areaCentre(e.area);const a=Te(e.area),o=this.assets.img(this.room.bg);if(this.passageHotspot=e,o){const r=this.ambient.plate()??o;this.passagePlate={image:r,imageW:o.naturalWidth,imageH:o.naturalHeight,x:a.x,y:a.y,w:a.w,h:a.h,scaleX:(o.naturalWidth||1)/(this.room.width??S),scaleY:(o.naturalHeight||1)/q,viewW:S,viewH:q,viewX:this.cameraX,pivotX:Math.max(0,Math.min(S,this.areaCentre(e.area).x-this.cameraX)),pivotY:Math.max(0,Math.min(q,this.areaCentre(e.area).y))}}const s=qc(this.room.id,e.id),i=Pc(this.room.id,e.id);for(const r of t)r.k==="go"&&this.exitLinks.set(r.room,{from:this.room.id,link:s,passage:i,at:this.exitAt})}execute(){const{verb:e,a:t,b:a}=this.sentence;if(!e||!t){this.clearSentence();return}if(a){const s=t.kind==="item"?t:a.kind==="item"?a:null,i=t.kind==="item"?a:t;if(s&&i){this.runCombo(e,s.id,i);return}}if(t.kind==="item"){e==="look"?(t.id==="compass"&&this.audio.compass(this.act),this.speak(this.itemLook(t.id))):this.reject(ad(e,this.itemTarget(t.id))),this.clearSentenceKeepingNarration();return}const o=this.room.hotspots.find(s=>s.id===t.id);if(!o){this.clearSentence();return}this.runHotspot(e,o)}sentenceKey(){const{verb:e,a:t,b:a}=this.sentence;return`${e}|${t==null?void 0:t.kind}:${t==null?void 0:t.id}|${a==null?void 0:a.kind}:${a==null?void 0:a.id}`}clearSentenceIfUnchanged(e){this.sentenceKey()===e&&this.clearSentenceKeepingNarration(),this.committed===e&&(this.committed=null)}runHotspot(e,t){const a=t;t=this.hotspotState(t);const o=t.stand??this.areaStand(t.area),s=this.sentenceKey();this.committed=s;const i=()=>{var u,d,c,p;(d=this.trace)==null||d.call(this,{kind:"verb",text:`${((u=ie.find(g=>g.id===e))==null?void 0:u.label)??e} ${t.name}`,hotspot:a}),t.noWalk||this.faceToward(t);const r=t.say[e],h=(c=t.do)==null?void 0:c[e];if(e==="look"&&this.markLooked(t.id),e==="pickup"&&t.item){const g=this.areaCentre(t.area);this.fx.flight(t.item,((p=ye[t.item])==null?void 0:p.name)??t.item,{x:g.x-this.cameraX,y:g.y},Tt.has(t.item)?this.assets.img(`item_${t.item}`)??null:null),this.giveItem(t.item),this.speak(r??`I take ${this.itemPhrase(t.item)}.`),this.audio.pickup(),h&&this.runEffects(h),this.clearSentenceIfUnchanged(s);return}const l=td(e,this.hotspotTarget(t),e+t.id,this.act);r&&!h&&(e==="open"||e==="use")&&Bu(r)&&Fe("locked",this.reduced)&&this.audio.locked(),r||h?this.speak(r??l):this.reject(l),h&&(this.prepareExit(a,h),this.runEffects(h),this.exitAt=null),this.clearSentenceIfUnchanged(s)};if(t.noWalk){i();return}this.walkTo(o,!1,i)}runCombo(e,t,a){var u;const o=d=>(!d.if||d.if.every(c=>this.check(c)))&&(d.item===t&&d.with===a.id||d.item===a.id&&d.with===t),s=((u=this.room.combos)==null?void 0:u.find(o))??Us.find(o),i=this.sentenceKey();this.committed=i;const r=()=>{var d,c,p;if((p=this.trace)==null||p.call(this,{kind:"combo",text:`${((d=ie.find(g=>g.id===e))==null?void 0:d.label)??e} ${((c=ye[t])==null?void 0:c.name)??t} ${e==="give"?"to":"with"} ${a.name}`,combo:s}),t==="compass"&&this.audio.compass(this.act),s)this.speak(s.say),Fe("combine",this.reduced)&&this.audio.combine(),s.consume&&this.takeItem(t),s.do&&this.runEffects(s.do);else{const g=a.kind==="hotspot"?this.room.hotspots.find(_=>_.id===a.id):void 0,m=g?this.hotspotState(g):void 0,b=m?this.hotspotTarget(m):this.itemTarget(a.id),y=e==="give"&&m&&b.person?m.say.give:void 0;this.reject(y??nd(e,this.itemTarget(t),b,t+a.id))}this.clearSentenceIfUnchanged(i)};if(a.kind==="item"){r();return}const h=this.room.hotspots.find(d=>d.id===a.id),l=(h==null?void 0:h.stand)??(h?this.areaStand(h.area):null);h&&l?this.walkTo(l,!1,()=>{h.noWalk||this.faceToward(h),r()}):r()}hotspotTarget(e){var a;const t=e.person??(!!((a=e.do)!=null&&a.talk)||(this.room.sprites??[]).some(o=>o.hotspot===e.id&&o.speaker));return Zl(e,t)}itemTarget(e){var a;const t=((a=ye[e])==null?void 0:a.name)??e;return{name:t,person:!1,article:/^[A-Z]/.test(t)?"none":"the"}}itemPhrase(e){return Ct(this.itemTarget(e))}itemLook(e){var o;const t=ye[e];if(!t)return"";const a=(o=t.states)==null?void 0:o.find(s=>s.if.every(i=>this.check(i)));return(a==null?void 0:a.look)??t.look}areaStand(e){if("rect"in e){const s=e.rect;return{x:s.x+s.w/2,y:s.y+s.h}}const t=e;let a=0,o=-1/0;for(const s of t)a+=s.x,s.y>o&&(o=s.y);return nt({x:a/t.length,y:o},this.room.walk)}resolveStand(e){if(e.kind==="item")return null;const t=this.room.hotspots.find(a=>a.id===e.id);return t?t.stand??this.areaStand(t.area):null}runEffects(e){var t;for(let a=0;a<e.length;a++){const o=e[a],s=ts[o.k],i=!!((t=this.queue)!=null&&t.length),r=i?this.queueDue:this.lineDue(o.k);if(i||s!==void 0&&this.narration&&!this.dialogue&&this.narrationClock<r){const h=[];let l=!1;for(const u of e.slice(a))!l&&lf.has(u.k)?this.applyEffect(u):h.push(u),ta.has(u.k)&&(l=!0);this.queue=[...this.queue??[],...h],this.queueDue=r,this.persist();return}if(this.applyEffect(o)){this.hoverDirty=!0;return}}this.hoverDirty=!0,this.persist()}applyEffect(e){var t;switch((t=this.trace)==null||t.call(this,{kind:"effect",effect:e}),e.k){case"flag":e.v&&Xt.has(e.id)&&(this.onlyEnding(e.id),this.onlyFinalChoice(e.id),this.endingChosen=e.id),this.flags[e.id]=e.v;break;case"add":{const a=this.flags[e.id];this.flags[e.id]=(typeof a=="number"?a:0)+e.n;break}case"give":this.giveItem(e.item);break;case"take":this.takeItem(e.item);break;case"go":return this.goRoom(e.room,e.sound),!0;case"talk":return this.startDialogue(e.tree,e.node),this.persist(),!0;case"act":return this.completeAct(e.n),!0;case"win":return this.win(),!0;case"say":this.speak(e.text);break;case"sound":this.audio[e.id]();break;case"music":this.audio.playMusic(e.track);break;case"note":this.notes.some(a=>a.id===e.id)||(this.notes.push({id:e.id,text:e.text,act:this.act}),this.audio.note(),this.noteFiled());break}return!1}onlyEnding(e){for(const t of Xt)t!==e&&delete this.flags[t]}onlyFinalChoice(e){const t=ff[e];for(const a of Ns)a!==t&&delete this.flags[a]}flushQueue(){const e=this.queue;this.queue=null,e&&(this.narrationClock=1/0,this.runEffects(e))}giveItem(e){this.hoverDirty=!0,Tt.has(e)&&this.assets.ensure([`item_${e}`]),this.inventory.includes(e)||(this.inventory.push(e),this.fx.freshen(e),this.inventoryPage=Math.floor((this.inventory.length-1)/ve)),this.syncA11yControls(),this.persist()}takeItem(e){this.hoverDirty=!0,this.inventory=this.inventory.filter(t=>t!==e),this.inventoryPage=Math.min(this.inventoryPage,this.pageCount()-1),this.syncA11yControls(),this.persist()}warmInventoryIcons(){const e=this.inventory.filter(t=>Tt.has(t)).map(t=>`item_${t}`);e.length&&this.assets.ensure(e)}startDialogue(e,t){this.clearTouchArm();const a=Ye[e];if(!a)return;const o=t&&a.nodes[t]?t:a.start;this.narration=null,this.keyboardFocus=null,this.dialogue||this.stage.reset(),this.enterNode(a,o)}enterNode(e,t){var s;const a=e.nodes[t];if(!a){this.dialogue=null;return}this.dialogue={tree:e,nodeId:t,shown:0},this.markSeen(e.id,t),this.history.add({speaker:Ee(a.speaker).name,text:a.text}),this.hoverChoice=-1,this.frameConversation(a.speaker);const o=(s=a.do)==null?void 0:s.filter(i=>!ta.has(i.k));o!=null&&o.length&&this.runEffects(o),this.announceNode()}endDialogue(){var a;const e=this.currentNode();this.dialogue=null,this.afterConversation();const t=(a=e==null?void 0:e.do)==null?void 0:a.filter(o=>ta.has(o.k));t!=null&&t.length?this.runEffects(t):this.persist()}leaveDialogue(){const e=new Set;for(;this.dialogue&&!e.has(this.dialogue.nodeId);){e.add(this.dialogue.nodeId);const t=this.currentNode();if(!t||this.visibleChoices().length)break;const a=this.dialogue.tree;if(!t.next||t.next==="END"||!a.nodes[t.next]){this.endDialogue();return}this.enterNode(a,t.next)}this.dialogue=null,this.afterConversation(),this.persist()}frameConversation(e){const t=e==="fenn"?null:this.speakerSprite(e);if(!t)return;const a=Math.abs(t.x-this.x)>S*.7;this.cameraHold=a?t.x:(t.x+this.x)/2}afterConversation(){this.cameraHold=this.cameraX+S/2,this.hoverDirty=!0}speakerSprite(e){var t;return((t=this.room.sprites)==null?void 0:t.find(a=>a.speaker===e&&this.spriteShown(a)))??null}spriteShown(e){const t=e.hotspot?this.room.hotspots.find(a=>a.id===e.hotspot):void 0;return t!=null&&t.showIf&&!t.showIf.every(a=>this.check(a))?!1:!e.showIf||e.showIf.every(a=>this.check(a))}speakerSpot(){const e=this.currentNode();if(!e)return null;let t,a,o;if(e.speaker==="fenn")t=this.x,a=this.y,o=this.personHeight(this.y);else{const s=this.speakerSprite(e.speaker);if(!s)return null;t=s.x,a=s.y,o=this.personHeight(s.y)*s.size}return{x:t-this.cameraX,y:a-o*.7,rx:Math.max(110,o*.46),ry:Math.max(150,o*.62)}}hasPortraits(e){let t=this.portraitColumns.get(e.id);return t===void 0&&(t=Object.values(e.nodes).some(a=>!!Ee(a.speaker).portrait),this.portraitColumns.set(e.id,t)),t}markSeen(e,t){var o,s;const a=(o=Ye[e])==null?void 0:o.nodes[t];a&&((s=this.trace)==null||s.call(this,{kind:"node",tree:e,node:a})),this.flags[`seen:${e}.${t}`]=!0,this.autosaveSoon()}markLooked(e){this.flags[`looked:${this.room.id}.${e}`]=!0,this.autosaveSoon()}currentNode(){return this.dialogue?this.dialogue.tree.nodes[this.dialogue.nodeId]??null:null}announceNode(){const e=this.currentNode();if(!e)return;const t=Ee(e.speaker).name,a=this.visibleChoices().map((o,s)=>`${s+1}. ${Ge(o.text)}${o.seen?" (asked before)":""}`).join(" ");this.announce(`${t?t+": ":""}${Ge(e.text)}${a?" "+a:""}`)}visibleChoices(){var o;const e=this.currentNode(),t=(o=this.dialogue)==null?void 0:o.tree;if(!(e!=null&&e.choices)||!t)return[];const a=[];return e.choices.forEach((s,i)=>{if(s.if&&!s.if.every(h=>this.check(h)))return;const r=s.to&&s.to!=="END"&&s.to!==t.start&&s.to!==e.id&&t.nodes[s.to];a.push({text:s.text,index:i,seen:!!r&&this.flags[`seen:${t.id}.${s.to}`]===!0})}),a}pickChoice(e){var h;const t=this.currentNode();if(!(t!=null&&t.choices)||!this.dialogue)return;const a=this.dialogue,o=a.tree,i=this.visibleChoices()[e];if(!i)return;const r=t.choices[i.index];if(this.audio.choice(),(h=this.trace)==null||h.call(this,{kind:"choice",tree:o.id,choice:r}),this.history.add({speaker:Ee("fenn").name,text:r.text,choice:!0}),r.do&&this.runEffects(r.do),this.dialogue===a){if(r.to==="END"||!r.to||!o.nodes[r.to]){this.dialogue=null,this.afterConversation(),this.persist();return}this.enterNode(o,r.to)}}advanceDialogue(){const e=this.currentNode();if(!e||!this.dialogue){this.dialogue=null;return}if(this.visibleChoices().length)return;this.audio.advance();const t=this.dialogue.tree;if(e.next&&e.next!=="END"&&t.nodes[e.next]){this.enterNode(t,e.next);return}this.endDialogue()}check(e){if("atLeast"in e){const t=this.flags[e.flag];return typeof t=="number"&&t>=e.atLeast}if("flag"in e){const t=this.flags[e.flag];return"is"in e?e.is===void 0?t===void 0:e.is===!1?t===void 0||t===!1:t===e.is:t===!0}return"has"in e?this.inventory.includes(e.has):"notHas"in e?!this.inventory.includes(e.notHas):"room"in e?this.room.id===e.room:"act"in e?Array.isArray(e.act)?e.act.includes(this.act):this.act===e.act:"any"in e?e.any.some(t=>this.check(t)):"not"in e?!this.check(e.not):!0}speak(e){var a;(a=this.trace)==null||a.call(this,{kind:"say",text:e}),this.narration={text:e,shown:this.textSpeed==="instant"?e.length:0},this.narrationClock=0,this.narrationRepeat=!/^Tip: /.test(e)&&this.seenLines.has(e),this.narrationCounted=!1,this.skipClock=0;const t=/^Tip: /.test(e);this.history.add({speaker:t?"Tip":Ee("fenn").name,text:t?e.slice(5):e}),this.announce(e)}announce(e){!this.live&&typeof document<"u"&&(this.live=document.getElementById("sr")),this.live&&(this.announcing.length||queueMicrotask(()=>{this.live&&(this.live.textContent=this.announcing.join(" ")),this.announcing=[]}),this.announcing.push(e))}reject(e){this.speak(e),this.audio.deny(),this.rejection=.38}clearSentenceKeepingNarration(){this.sentence={verb:null,a:null,b:null},this.committed=null}walkTo(e,t,a){var s;const o={x:this.x,y:this.y};this.path=this.mesh.path(o,e),this.path.length&&(this.cameraHold=null),this.walkGoal=this.path.length?e:null,this.running=!1,this.walkStarting=this.path.length>0,this.onArrive=a??null,t&&this.clearSentence(),this.path.length===0&&((s=this.onArrive)==null||s.call(this),this.onArrive=null)}chooseDirection(e){let t=this.path[0];for(const h of this.path)if(t=h,Math.hypot(h.x-this.x,h.y-this.y)>40)break;const a=t.x-this.x,o=t.y-this.y,s=this.moveDirection==="up"||this.moveDirection==="down",r=Math.abs(o)>Math.abs(a)*(s?.8:1.6)?o<0?"up":"down":a<0?"left":"right";Math.abs(a)>Math.abs(o)*.35&&(this.facing=a<0?-1:1),r===this.moveDirection?this.directionPending=0:(this.directionPending+=e,(this.walkStarting||this.directionPending>.15)&&(this.moveDirection=r,this.directionPending=0)),this.walkStarting=!1}faceToward(e){const t="rect"in e.area?e.area.rect.x+e.area.rect.w/2:e.area.reduce((a,o)=>a+o.x,0)/e.area.length;Math.abs(t-this.x)>24&&(this.facing=t<this.x?-1:1)}update(e){var u,d,c;this.tick++,this.syncA11yVisibility(),this.idle=Math.min(this.idle+e,600),this.barFlash&&(this.barFlash.left-=e)<=0&&(this.barFlash=null),this.barLabel&&(this.barLabel.left-=e)<=0&&(this.barLabel=null);const t=this.title||this.won||this.paused||this.cinematic.active||this.areaCardBusy||!!this.dialogue||!!this.queue||this.explore||this.fade>.5;this.watch.tick(e,t);const a=this.barHit(this.input.x,this.input.y),o=this.paused||this.cinematic.active||a||this.noteGlow>0||this.barLabel||this.touchBarArmed||this.watch.current||this.idle<3.5||fe()?1:zu;if(this.barFade+=(o-this.barFade)*Math.min(1,e*(o<this.barFade?2.4:8)),this.tickAreaCard(e),this.areaCardBusy||this.paused||this.cinematic.active)return;if(!this.touch&&this.lastInput==="pointer"&&!!this.hoverHotspot&&!this.inputLocked()&&!this.dialogue&&(!this.watch.learnt("look")||!this.watch.learnt("take"))){if(this.hoverDwell+=e,this.hoverDwell>.65){this.teach("look");const p=this.room.hotspots.find(g=>g.id===this.hoverHotspot);p&&((d=(u=this.hotspotState(p).do)==null?void 0:u.pickup)!=null&&d.length)&&this.teach("take")}}else this.hoverDwell=0;if(!this.watch.learnt("keys")&&!t&&!this.inputLocked()&&(this.keysClock+=e,this.keysClock>(this.keysActed?2.5:9)&&this.teach("keys")),this.rejection=Math.max(0,this.rejection-e),this.fade!==this.fadeTarget){const p=Math.sign(this.fadeTarget-this.fade);this.fade=Math.max(0,Math.min(1,this.fade+p*e*2.2))}if(this.pendingRoom&&this.fade>=.999){const p=this.pendingRoom;if(this.pendingPassage&&this.reduced)this.connector.end(),this.enterPendingRoom();else if(this.pendingPassage){if(!this.connector.active){if(this.passagePlate){this.passagePlate.viewX=this.cameraX;const g=this.passageHotspot?this.areaCentre(this.hotspotState(this.passageHotspot).area):{x:0,y:0};this.passagePlate.pivotX=Math.max(0,Math.min(S,g.x-this.cameraX)),this.passagePlate.pivotY=Math.max(0,Math.min(q,g.y))}this.connector.begin(this.pendingPassage.kind,this.pendingPassage.side,this.room.id,p,this.passagePlate)}this.connector.update(e)&&(this.connector.end(),this.enterPendingRoom())}else this.enterPendingRoom()}if(this.curtain&&this.fade>=.999){const p=this.curtain;this.curtain=null,p(),this.fade=1,this.fadeTarget=0}if(this.fx.update(e),(c=this.ending)==null||c.update(e),!this.title&&!this.curtain&&!this.roomReady()){const p=this.roomWait;this.roomWait+=e,this.roomWait<So?(this.fade=1,this.fadeTarget=0,p<ga&&this.roomWait>=ga&&this.announce("Loading.")):p<So&&this.assets.giveUp([this.room.bg])}else this.roomWait=0;if(this.audio.frame(this.cameraX+S/2,this.dialogue!==null),this.title){this.titleClock+=e;return}if(this.exitIntro>0&&!this.dialogue&&!this.paused&&!this.cinematic.active&&!this.won&&this.fade<.5&&!this.revealing&&(this.exitIntro=Math.max(0,this.exitIntro-e)),this.updateSpeech(e),this.saveNotice&&this.saveNoticeShown()&&(this.saveNotice.left-=e)<=0&&(this.saveNotice=null),this.noteToast&&this.noteToastShown()&&(this.noteToast.left-=e)<=0&&(this.noteToast=null),this.noteGlow>0&&!this.title&&!this.won&&!this.paused&&!this.cinematic.active&&(this.noteGlow=Math.max(0,this.noteGlow-e)),this.autosaveIn>0&&(this.autosaveIn-=e)<=0&&this.persist(),this.narration){this.narrationClock+=e;const p=Ga[this.textSpeed];this.narration.shown=Number.isFinite(p)?Math.min(this.narration.text.length,Math.floor(this.narrationClock*p)+1):this.narration.text.length,Du(this.narrationRepeat,this.prefs.skipRead,this.ctrlHeld||this.bracketHeld)&&(this.narration.shown=this.narration.text.length,this.narrationClock=Math.max(this.narrationClock,this.typeTime(this.narration.text.length)),this.skipClock+=e,this.queue&&this.skipClock>=$u&&this.flushQueue()),!this.narrationCounted&&this.narration&&this.narration.shown>=this.narration.text.length&&(this.narrationCounted=!0,/^Tip: /.test(this.narration.text)||this.seenLines.add(this.narration.text))}if(this.dialogue){const p=Wr[this.textSpeed];this.dialogue.shown=Number.isFinite(p)?this.dialogue.shown+e*p:1e6}const i=this.prefs.waitForClick&&this.narration!==null;if(this.queue&&!i&&(!this.narration||this.narrationClock>=this.queueDue)){const p=this.queue;this.queue=null,this.runEffects(p)}if(this.path.length>0){const p=this.path[0],g=p.x-this.x,m=p.y-this.y,b=Math.hypot(g,m);if(b<1){if(this.x=p.x,this.y=p.y,this.path.shift(),this.path.length===0){const y=this.onArrive;this.onArrive=null,this.walkGoal=null,this.running=!1,y==null||y()}}else{this.chooseDirection(e);const y=g/b,_=m/b,x=Math.hypot(y,_/Qu),T=Xu*(this.running?hf:1),N=Math.min(b,T*e*this.personHeight(this.y)/x);this.x+=y*N,this.y+=_*N;const C=Math.floor(this.walkPhase/(Jn/2));if(this.walkPhase+=N*x/this.personHeight(this.y),Math.floor(this.walkPhase/(Jn/2))!==C){const D=1-this.personHeight(this.y)/this.personHeight(q);this.audio.step((this.x-this.cameraX)/S*2-1,D,this.running)}}}else this.walkPhase=0;const r=Math.max(0,(this.room.width??S)-S);let h=this.cameraX;const l=this.cameraX;if(this.focusCameraX!==null)h=this.focusCameraX-S/2;else if(this.cameraHold!==null)h=this.cameraHold-S/2;else{const p=this.x-this.cameraX;p>S*.62&&(h=this.x-S*.62),p<S*.38&&(h=this.x-S*.38)}if(h=Math.max(0,Math.min(r,h)),this.reduced?this.cameraX=h:this.cameraX+=(h-this.cameraX)*Math.min(1,e*5),Math.abs(h-this.cameraX)<.05&&(this.cameraX=h),Math.abs(this.cameraX-l)>.5&&(this.hoverDirty=!0),this.dialogue){const p=this.dialogueModel(this.frameChoices());this.stage.update(e,p.layout,p.portrait,this.speakerSpot(),this.reduced)}this.hoverDirty&&this.refreshHover()}refreshHover(){var o;if(this.hoverDirty=!1,!this.pointerSeen||this.touch||this.lastInput!=="pointer"||this.title||this.won||this.dialogue)return;const{x:e,y:t}=this.input;this.hoverVerb=null,this.hoverItem=null,this.hoverHotspot=null;const a=qt(e,t,this.panelModel());(a==null?void 0:a.kind)==="verb"?this.hoverVerb=a.id:(a==null?void 0:a.kind)==="item"?this.hoverItem=a.id:!a&&t<q&&(this.hoverHotspot=((o=this.exitChevronAt(e,t)??this.hotspotAt(e+this.cameraX,t))==null?void 0:o.id)??null),!this.hoverVerb&&!this.hoverItem&&!this.hoverHotspot&&(this.hoverCueKey=null)}loadRoom(e,t,a={}){var h,l,u,d;const o=le[e];if(!o)return;const s=a.atEntry||(h=this.room)==null?void 0:h.id;for(const[c,p]of this.exitLinks)p.from!==e&&this.exitLinks.delete(c);this.room=o,this.title||(this.flags[`visited:${e}`]=!0),this.ambient.setRoom(o),(l=this.trace)==null||l.call(this,{kind:"room",room:e}),this.mesh=new Mn(o.walk,o.width??S,q),this.roomWait=0,this.assets.ensure(wt(o)),this.assets.retain(wt(o));const i=nt(t??(s?(u=o.arrive)==null?void 0:u[s]:void 0)??o.entry,o.walk);this.x=i.x,this.y=i.y;const r=Math.max(0,(o.width??S)-S);if(this.cameraX=Math.max(0,Math.min(r,this.x-S/2)),this.focusCameraX=null,this.cameraHold=null,this.hoverDirty=!0,this.fx.clear(),this.path=[],this.onArrive=null,this.sentence={verb:null,a:null,b:null},this.keyboardFocus=null,this.hoverHotspot=null,this.hoverCueKey=null,this.clearTouchArm(),this.walkGoal=null,this.running=!1,this.title||this.announce(`${o.name}.`),o.music&&this.audio.playMusic(o.music),this.audio.setRoom({ambience:o.ambience,roomTone:Wu(o.id)??void 0,footsteps:o.footsteps,emitters:o.emitters}),this.persist(),!this.title){o.onEnter&&this.runEffects(o.onEnter);const c=this.explore||a.scenes===!1||(d=o.scenes)==null?void 0:d.find(p=>p.if.every(g=>this.check(g)));c&&this.runEffects(c.do)}if(this.exitIntro=0,!this.title){const c=this.visibleHotspots().filter(p=>this.isExit(p));!this.exitIntroSeen.has(e)&&c.length>0&&c.length<=Ju&&(this.exitIntro=ss),this.exitIntroSeen.add(e)}}goRoom(e,t){this.path=[],this.onArrive=null,this.persist(),this.audio.door(t),t!=="none"&&Fe("threshold",this.reduced)&&this.audio.threshold();const a=le[e];a&&this.assets.ensure(wt(a));const o=this.exitLinks.get(e)??null;this.exitLinks.delete(e);const s=o&&o.from===this.room.id?o:null;this.pendingEntry=Rc((s==null?void 0:s.link)??null),this.pendingPassage=s!=null&&s.passage&&s.link&&!this.reduced?{kind:s.passage,side:s.link.side}:null,this.transition.leave((s==null?void 0:s.at)??this.exitAt),this.fadeTarget=1,this.pendingRoom=e}enterPendingRoom(){const e=this.pendingRoom;e&&(this.pendingRoom=null,this.pendingPassage=null,this.loadRoom(e),this.passagePlate=null,this.transition.arrive({x:this.x,y:this.y-this.personHeight(this.y)*.5},this.pendingEntry),this.pendingEntry=null,this.fadeTarget=0)}persist(e){if(this.autosaveIn=0,this.title||this.explore||this.won||this.foreignSave||this.keepPage)return;if(this.tabGuard.checkStored(Nd())){this.foreignSave=!0,this.warnForeignSave();return}const t=e?e.pos??le[e.room].entry:{x:this.x,y:this.y},a={version:Ht,room:(e==null?void 0:e.room)??this.room.id,x:t.x,y:t.y,facing:this.facing,flags:Rs(this.flags,Lt),inventory:this.inventory,act:this.act,notes:this.notes,actStarted:(e==null?void 0:e.actStarted)??!0,tip:this.tipLadder.shown(),at:Date.now()},o=this.dialogue?$d(this.currentNode()):void 0,s=Ld(this.queue,o);s&&!e&&(a.queue=s),Ia(a)?(this.tabGuard.remember(a.at??0),this.hasSave=!0,this.saveBroken=!1,this.audio.saved()):this.saveBroken||(this.saveBroken=!0,this.showSaveNotice("I try to write the day down and the page won't take ink. Something is wrong with the ink — my progress is not being saved."))}autosaveSoon(){this.autosaveIn<=0&&(this.autosaveIn=df)}flushAutosave(){this.autosaveIn>0&&this.persist()}onStorage(e){if(this.hasPrevious=Rn(),this.tabGuard.observe(e)){if(this.foreignSave=!0,this.title){this.hasSave=qn(be),this.continueLabel=this.hasSave?this.saveLabel(" ·"):null,this.recoverable=co(be);return}this.warnForeignSave()}}warnForeignSave(){this.foreignSaveWarned||(this.foreignSaveWarned=!0,this.showSaveNotice("Another window has written in this notebook. I won't ink over their page from here — reload this page to take up where they left off.",!0))}clearForeignSave(){this.foreignSave&&(this.saveNotice=null),this.foreignSave=!1,this.foreignSaveWarned=!1,this.tabGuard.clear()}clearKeepPage(){var e;this.keepPage&&(this.keepPage=!1,(e=this.saveNotice)!=null&&e.keep&&(this.saveNotice=null))}stashBeforeNewVoyage(){const e=Cd();if(e==="failed"){const t="I couldn't set my current page aside, so I won't begin a new voyage over it. Free some browser storage and try again.";return this.title?(this.titleNotice=t,this.audio.error(),this.setTitleFocus(Re(this.titleButtons())),this.announce(t)):this.showSaveNotice(t),!1}return e==="ok"&&(this.hasPrevious=!0),this.clearKeepPage(),!0}showSaveNotice(e,t=!1){this.audio.error(),this.saveNotice={text:e,left:t?1e9:Math.max(cf,2*e.length/ns)*this.readingFactor},this.history.add({speaker:Ee("fenn").name,text:e}),this.announce(e)}notify(e){this.showSaveNotice(e)}saveNoticeShown(){return!this.title&&!this.dialogue&&!this.won&&this.fade<.5&&!this.casebook.open&&!this.history.open}noteFiled(){this.noteToast={left:rs},this.noteGlow=rs,this.audio.page()}noteToastShown(){return!this.title&&!this.dialogue&&!this.won&&!this.paused&&!this.cinematic.active&&this.fade<.5&&!this.casebook.open&&!this.history.open&&!this.deeds.open}drawSaveNotice(e){if(!this.saveNotice||!this.saveNoticeShown())return;let t=_t;this.tipMode&&(t+=this.tipBannerHeight(e)),this.drawNoticeBox(e,this.saveNotice.text,t,Math.min(1,this.saveNotice.left/.4))}drawTitleNotice(e){!this.titleNotice||this.confirmNew||this.recoverOpen||this.drawNoticeBox(e,this.titleNotice,null,Math.min(1,this.titleClock/.6))}drawNoticeBox(e,t,a,o){const s=a===null?Math.min(this.textScale,1.5):this.textScale,i=Math.round(20*s),r=Math.round(27*s),h={size:i,color:"#f3e6cf",weight:"normal",shadow:!1},l=je(e,t,1830,h),u=l.length*r+Math.round(17*s),d=a??V-u-24;e.save(),e.globalAlpha=o,e.font=`${i}px Georgia, serif`;const c=Math.min(1872,Math.max(...l.map(p=>e.measureText(p).width))+40);e.fillStyle="rgba(5,13,22,0.92)",e.fillRect(24,d,c,u),e.fillStyle="#d9785a",e.fillRect(24,d,3,u),l.forEach((p,g)=>K(e,p,44,d+Math.round(10*s)+g*r,h)),e.restore()}loadGame(){this.queue=null;const{data:e,raw:t,corrupt:a,future:o,futureVersion:s,migratedFrom:i,repaired:r}=St(be);if(o){const l=!t||xe(t,"future",void 0,s);this.beginAfterUnreadable(l,"This page was written by a newer copy of the game, so I can't read it as mine. I've kept it safe and begun a fresh one.");return}if(!e){if(!a)return this.loadOldSave();const l=!t||xd(t);this.beginAfterUnreadable(l,"The last page of my notebook is ruined — the save couldn't be read. I've kept it aside and started a fresh page.");return}t&&i!==void 0&&xe(t,"migrated",void 0,i),this.clearForeignSave(),this.clearKeepPage(),e.at!==void 0&&this.tabGuard.remember(e.at),this.resetState(),this.inventory=e.inventory,this.warmInventoryIcons(),this.flags=e.flags,this.facing=e.facing,this.act=e.act,this.notes=e.notes;const h=e.x!==void 0&&e.y!==void 0?{x:e.x,y:e.y}:le[e.room].entry;if(this.loadRoom(e.room,h,{scenes:!(e.queue&&e.actStarted!==!1)}),e.actStarted===!1){const l=ae[this.act];l!=null&&l.caption&&this.speak(l.caption),l!=null&&l.onStart&&this.runEffects(l.onStart),this.persist()}else e.queue&&this.runEffects(e.queue);r!=null&&r.length&&(console.warn("save repaired:",r.join("; ")),this.showSaveNotice("A line of my notebook had smudged, so I've set myself down at the start of this chapter. Everything I was carrying and had learned is still with me."))}beginAfterUnreadable(e,t){e?Td():this.keepPage=!0,this.clearForeignSave(),this.newGame(),this.showSaveNotice(e?t:"The last page of my notebook is unreadable, and I couldn't set it aside, so I won't write over it. This voyage will not be saved: free some browser storage and reload.",!e),!e&&this.saveNotice&&(this.saveNotice.keep=!0)}loadOldSave(){const e=Ed();this.clearForeignSave(),this.newGame(),e&&this.showSaveNotice("The old voyage is over. Its page is kept in the archive; a new one begins.")}beginNewVoyage(){var a;const e=fo(be);if(e)xe(e.raw,e.reason,void 0,e.version)?this.clearKeepPage():(this.keepPage=!0,this.titleNotice=null,this.clearForeignSave(),this.showSaveNotice(uo(e.reason,!1)+" This voyage will not be saved.",!0),this.saveNotice&&(this.saveNotice.keep=!0));else if(!this.stashBeforeNewVoyage())return;this.titleNotice=null,this.clearForeignSave(),this.playIntro();const t=jt(((a=ae[1])==null?void 0:a.start.room)??"");t&&this.showAreaCard(t.id,()=>{})}playIntro(){var a;const e=(a=ae[ot])==null?void 0:a.intro,t=()=>{this.title=!1,this.newGame()};e?this.cinematic.play(e,t):t()}completeAct(e){var r,h;if(!ae[e]){console.warn(`completeAct: there is no act ${e}`);return}const t=ae[e+1];if(this.resetTransient(),!t){this.autosaveIn=0;const l=(r=ae[e])==null?void 0:r.outro;l?this.cinematic.play(l,()=>this.win()):this.win();return}this.act=e+1,t.inventory&&(this.inventory=[...t.inventory]),this.persist({room:t.start.room,pos:t.start.pos,actStarted:!1});const a=jt(t.start.room),o=()=>{this.startAct(e+1),a&&this.showAreaCard(a.id,()=>{})},s=()=>{t.intro?this.cinematic.play(t.intro,o):o()},i=(h=ae[e])==null?void 0:h.outro;i?this.cinematic.play(i,s):s()}startAct(e){var a;const t=ae[e];t&&((a=this.trace)==null||a.call(this,{kind:"act",n:e}),this.resetTransient(),this.act=e,t.inventory&&(this.inventory=[...t.inventory],this.inventoryPage=0),this.warmInventoryIcons(),this.loadRoom(t.start.room,t.start.pos??le[t.start.room].entry),this.fade=1,this.fadeTarget=0,t.caption&&this.speak(t.caption),t.onStart&&this.runEffects(t.onStart),this.persist())}resetTransient(){this.clearTouchArm(),this.clearAreaCard(),this.queue=null,this.dialogue=null,this.narration=null,this.path=[],this.onArrive=null,this.pendingRoom=null,this.pendingPassage=null,this.pendingEntry=null,this.exitLinks.clear(),this.passagePlate=null,this.connector.end(),this.exitIntro=0,this.curtain=null,this.transition.clear(),this.fx.clear(),this.fade=this.fadeTarget=0}resetState(){this.resetTransient(),this.exitIntroSeen.clear(),this.explore=!1,this.roomMenu=!1,this.won=!1,this.announcedEnding=!1,this.endingChosen=null,this.deedsShown=!1,this.inventory=[],this.inventoryPage=0,this.flags={},this.notes=[],this.noteToast=null,this.noteGlow=0,this.history.clear(),this.tipLadder.reset(),this.watch.clearQueue(),this.barLabel=null,this.touchBarArmed=null,this.hoverDwell=0,this.syncA11yControls()}newGame(){this.resetState(),this.startAct(ot),xn()||(this.teach("inventory"),this.teach("chart"))}win(){this.resetTransient();const e=Object.keys(this.flags).filter(a=>Xt.has(a)&&this.flags[a]);if(e.length){const a=e.length===1?e[0]:this.endingChosen&&e.includes(this.endingChosen)?this.endingChosen:e.at(-1);this.onlyEnding(a),this.onlyFinalChoice(a)}this.won=!0,this.deedsShown=!1;const t=this.endingCard();this.assets.ensure([t.image]),this.ending=new jc(t,this.assets,a=>this.announce(a)),t.music&&this.audio.playMusic(t.music),this.audio.resolve(this.act),Xr(),this.announcedEnding||(this.announcedEnding=!0,this.announce(`${t.title}. ${t.lines.join(" ")}`.trim())),Cs(a=>a.if.every(o=>this.check(o)))}endingCard(){var s,i,r;const e=h=>!h||h.every(l=>this.check(l)),t=((i=(s=Ot.titles)==null?void 0:s.find(h=>e(h.if)))==null?void 0:i.text)??Ot.title,a=Ot.lines.filter(h=>e(h.if)).map(h=>h.text),o=((r=Ot.paintings)==null?void 0:r.find(h=>e(h.if)))??(this.check({flag:"ending_pirate"})?{image:"bg_deck_wide",focus:{x:1250,y:300},music:"music_sea"}:this.check({flag:"ending_desk"})?{image:"bg_office_wide",focus:{x:1130,y:60},music:"music_dock"}:{image:"bg_dock_wide",focus:{x:1280,y:420},music:"music_dock"});return{title:t,lines:a,image:o.image,focus:o.focus,music:o.music}}advanceEnding(){if(!(!this.ending||!this.ending.advance())){if(!this.deedsShown){this.deedsShown=!0,this.audio.page(),this.deeds.show(e=>e.if.every(t=>this.check(t)));return}this.leaveDeeds()}}leaveDeeds(){this.won&&this.behindCurtain(()=>{this.won=!1,this.ending=null,this.deedsShown=!1,this.enterTitle()})}hotspotState(e){const t=e.states;if(!t)return e;const a=t.findIndex(i=>i.if.every(r=>this.check(r)));if(a<0)return e;let o=this.stateCache.get(e);o||this.stateCache.set(e,o=new Map);let s=o.get(a);if(!s){const i=t[a];s={...e,name:i.name??e.name,say:{...e.say,...i.say},do:{...e.do,...i.do}},o.set(a,s)}return s}hotspotAt(e,t){for(let a=this.room.hotspots.length-1;a>=0;a--){const o=this.room.hotspots[a];if(!(o.showIf&&!o.showIf.every(s=>this.check(s)))&&this.inArea(e,t,o.area))return this.hotspotState(o)}return null}inArea(e,t,a){if("rect"in a){const o=a.rect;return e>=o.x&&e<=o.x+o.w&&t>=o.y&&t<=o.y+o.h}return Ne({x:e,y:t},a)}panelModel(){var t,a,o,s,i,r;const e=this.inventory.map(h=>{var l;return{id:h,name:((l=ye[h])==null?void 0:l.name)??h,icon:Tt.has(h)?this.assets.img(`item_${h}`)??null:null}});return{verb:this.sentence.verb,objA:((t=this.sentence.a)==null?void 0:t.name)??null,objB:((a=this.sentence.b)==null?void 0:a.name)??null,narrationFull:((o=this.narration)==null?void 0:o.text)??null,narration:this.narration?fs(this.narration.text,this.narration.shown):null,narrationAlpha:this.narrationAlpha(),target:this.targetName(),inventory:e,page:this.inventoryPage,hoverVerb:this.hoverVerb,hoverItem:this.hoverItem,focusVerb:((s=this.keyboardFocus)==null?void 0:s.kind)==="verb"?this.keyboardFocus.id:null,focusItem:((i=this.keyboardFocus)==null?void 0:i.kind)==="item"?this.keyboardFocus.id:null,selectedItem:((r=this.sentence.a)==null?void 0:r.kind)==="item"?this.sentence.a.id:null,...this.suggestion(),scale:this.textScale,touch:this.touch,keyboard:this.lastInput==="keyboard",waiting:!!(this.queue&&this.narration),fresh:this.fx.glows(),time:this.time,reduced:this.reduced}}narrationAlpha(){const e=this.narration;if(!e)return 0;if(e.shown<e.text.length||this.queue||this.dialogue)return 1;const t=this.narrationClock-this.lineDue("say")-sf*this.readingFactor;return t<=0?1:Math.max(0,1-t/(rf*this.readingFactor))}targetName(){var s,i,r,h;if(!this.sentence.verb||this.sentence.b)return null;const e=(s=this.sentence.a)==null?void 0:s.id,t=this.hoverItem??(((i=this.keyboardFocus)==null?void 0:i.kind)==="item"?this.keyboardFocus.id:null);if(t)return t===e?null:((r=ye[t])==null?void 0:r.name)??null;const a=this.hoverHotspot??(((h=this.keyboardFocus)==null?void 0:h.kind)==="hotspot"?this.keyboardFocus.id:null),o=a&&a!==e?this.room.hotspots.find(l=>l.id===a):void 0;return o?this.hotspotState(o).name:null}suggestion(){var r,h;const e=this.hoverHotspot??(((r=this.keyboardFocus)==null?void 0:r.kind)==="hotspot"?this.keyboardFocus.id:null),t=e&&!this.sentence.verb&&!this.sentence.a?this.visibleHotspots().find(l=>l.id===e):void 0;if(!t)return{suggestVerb:null,suggestLine:null,suggestExit:!1};const a=this.hotspotState(t),o=this.isExit(a),s=o?"walk":this.suggestedVerb(a),i=((h=ie.find(l=>l.id===s))==null?void 0:h.label)??"";return{suggestVerb:s,suggestLine:`${i} ${a.name}`,suggestExit:o}}frameChoices(){const e=this.choiceCache;if(e&&e.tick===this.tick&&e.dialogue===this.dialogue)return e.list;const t=this.visibleChoices();return this.choiceCache={tick:this.tick,dialogue:this.dialogue,list:t},t}dialogueModel(e=this.visibleChoices()){var h;const t=this.currentNode(),a=Ee((t==null?void 0:t.speaker)??""),o=a.portrait??null,s=o?this.assets.img(o)??null:null,i=this.dialogue?this.hasPortraits(this.dialogue.tree):!0,r=a.name.replace(/^(A|An|Another|The|Mr|Mrs|Old|Captain|Harbourmaster)\s+/,"");return{speaker:a.name,speakerAccent:a.accent??null,text:t?t.text:"",reveal:((h=this.dialogue)==null?void 0:h.shown)??0,portraitKey:o,portrait:s,choices:e.map((l,u)=>({text:l.text,index:u,seen:l.seen})),hoverIndex:this.hoverChoice,layout:uh(this.view.ctx,(t==null?void 0:t.text)??"",e.map(l=>l.text),this.textScale,i),scale:this.textScale,touch:this.touch,keyboard:this.lastInput==="keyboard",stage:this.stage,monogram:i&&!o?r?r[0].toUpperCase():"":null}}render(){const e=this.view.ctx;if(e.clearRect(0,0,S,V),this.syncMobileLayout(),this.updateCursor(),this.title){this.renderTitle(e),this.drawTitleNotice(e),this.renderFade(e),this.mobile||Cn(e,this.input.x,this.input.y);return}if(this.won&&this.ending){this.ending.render(e,this.reduced,this.mobile?this.mobileTextScale:this.textScale),this.renderFade(e),this.mobile||Cn(e,this.input.x,this.input.y);return}const t=this.transition.zoom(this.fade,this.cameraX,this.reduced);t&&(e.save(),e.beginPath(),e.rect(0,0,S,q),e.clip(),e.translate(t.x,t.y),e.scale(t.k,t.k),e.translate(-t.x,-t.y)),this.renderScene(e),e.save(),e.translate(-this.cameraX,0),this.fx.drawWorld(e,this.reduced),e.restore(),t&&e.restore();let a=null;this.mobile||(this.renderTopBar(e),this.dialogue?bh(e,this.dialogueModel(this.frameChoices())):(a=ih(e,this.panelModel()).narrationBox,this.fx.drawScreen(e,o=>this.slotOf(o),this.reduced)),this.explore&&this.renderExplore(e),this.drawSaveNotice(e),Cn(e,this.input.x,this.input.y,null,this.rejection>0,this.textScale,a)),this.narrationTop=a?a.y:null,this.drawFirstWatch(e),this.renderFade(e)}slotOf(e){const t=this.pageInventory().indexOf(e);return t<0?null:Ya(t)}updateCursor(){let e="default";const t=this.input.x,a=this.input.y;if(this.touch||this.paused||this.cinematic.active)e="default";else if(this.title)e=this.titleButtons().some(o=>this.hitTitle(o.y,t,a))?"pointer":"default";else if(this.roomMenu)e="default";else if(this.barHit(t,a))e="pointer";else if(this.dialogue)e=this.hoverChoice>=0?"pointer":"default";else if(this.hoverVerb||this.hoverItem)e="pointer";else if(this.hoverHotspot&&!this.won){const o=this.room.hotspots.find(s=>s.id===this.hoverHotspot);o&&!this.sentence.verb&&this.isExit(o)?e=this.exitCursor(o,t):e="pointer"}else if(!this.won&&a<q&&!this.sentence.verb&&!this.sentence.a&&!this.sentence.b&&this.edgeExitAt(t,a)&&this.room.walk.some(o=>Ne({x:t+this.cameraX,y:a},o))){const o=this.view.visible;e=t<=o.x+o.w/2?"w-resize":"e-resize"}e!==this.cursorStyle&&(this.cursorStyle=e,this.view.canvas.style.cursor=e)}exitCursor(e,t){const a=this.view.visible;if(t<=a.x+zt)return"w-resize";if(t>=a.x+a.w-zt)return"e-resize";const o=this.exitSound(e);return o==="stairs"||o==="hatch"?"ns-resize":o==="none"?this.exitStand(this.hotspotState(e)).x<this.x?"w-resize":"e-resize":"pointer"}nearestHotspotAt(e,t){const a=24/Math.max(.05,this.view.scale);let o=null,s=1/0;for(const i of this.visibleHotspots()){const r=Te(this.hotspotState(i).area),h=Math.max(r.x-e,0,e-(r.x+r.w)),l=Math.max(r.y-t,0,t-(r.y+r.h)),u=Math.hypot(h,l);u<=a&&u<s&&(s=u,o=i)}return o}areaCentre(e){return"rect"in e?{x:e.rect.x+e.rect.w/2,y:e.rect.y+e.rect.h/2}:{x:e.reduce((t,a)=>t+a.x,0)/e.length,y:e.reduce((t,a)=>t+a.y,0)/e.length}}figureGrade(e){const t=this.room.grade;this.gradeMemoRoom!==t&&(this.gradeMemo.clear(),this.gradeMemoRoom=t);const a=e??"";let o=this.gradeMemo.get(a);if(o===void 0){const s=[t,e].filter(i=>!!i&&i!=="none");o=s.length?s.join(" "):"none",this.gradeMemo.set(a,o)}return o}roomReady(){const e=this.room;if(!e)return!0;if(!this.assets.isReady(e.bg))return!1;for(const t of e.sprites??[])if(!this.assets.isReady(t.key))return!1;return!0}renderScene(e){const t=this.ambient.plate(),a=this.room.width??S,o=this.ambientView;o.cameraX=this.cameraX,o.time=this.time,o.reduced=this.reduced,e.save(),e.translate(-this.cameraX,0),t&&e.drawImage(t,0,0,a,q),this.ambient.under(e,o),this.drawExitLighting(e),this.revealing&&this.drawReveal(e);const s=this.drawables;s.length=0;for(const r of this.room.sprites??[]){const h=this.room.hotspots.find(p=>p.id===r.hotspot);if(h!=null&&h.showIf&&!h.showIf.every(p=>this.check(p))||r.showIf&&!r.showIf.every(p=>this.check(p)))continue;const l=r.idle&&!this.reduced?Math.sin(this.time*1.8+r.x)*.0025:0,u=this.speech(r.speaker,r.x),d=r.size*(1+l)*this.personHeight(r.y),c=r.speaker?this.wrapAt(r.x,r.y,d):void 0;s.push({y:r.y,draw:()=>this.drawSprite(e,r.key,r.x,r.y,r.size*(1+l),r.visible??1,!!r.speaker,r.flip,this.figureGrade(r.grade),u,c)})}s.push({y:this.y,draw:()=>this.drawPlayer(e)});const i=this.exitChevrons();for(const r of i)r.edge||s.push({y:r.floor,draw:()=>this.drawChevronAt(e,r.x,r.y,r.angle,r.strength)});if(t)for(const r of this.room.occluders??[])s.push({y:r.y,draw:()=>this.ambient.occlude(e,r)});this.ambient.depth(s,e,o),s.sort((r,h)=>r.y-h.y);for(const r of s)r.draw();this.ambient.over(e,o),this.debugOverlay&&qd({ctx:e,room:this.room,devHandle:this.devHandle,personHeight:r=>this.personHeight(r)}),e.restore(),this.paint.draw(e),this.drawFloorLift(e),e.save(),e.translate(-this.cameraX,0),this.drawHoverGlow(e),this.drawKeyboardFocus(e);for(const r of i)r.edge&&this.drawChevronAt(e,r.x,r.y,r.angle,r.strength,!0);e.restore()}drawFloorLift(e){if(this.floorLiftFor!==e||!this.floorLift){const t=e.createLinearGradient(0,q-190,0,q);t.addColorStop(0,"rgba(58,68,86,0)"),t.addColorStop(.6,"rgba(58,68,86,0.07)"),t.addColorStop(1,"rgba(58,68,86,0.17)"),this.floorLift=t,this.floorLiftFor=e}e.save(),e.globalCompositeOperation="screen",e.fillStyle=this.floorLift,e.fillRect(0,q-190,S,190),e.restore()}renderTopBar(e){var s,i;const t=this.barHit(this.input.x,this.input.y);t!==this.lastBarHover&&(this.lastBarHover=t,this.view.canvas.title=t?`${Yo[t]} (${jn[t]})`:"");const a=Xn();e.save(),e.globalAlpha=this.barFade;for(const r of fn){const h=a[r],l=r==="reveal"&&this.revealing||r==="tip"&&this.tipMode,u=t===r||((s=this.barFlash)==null?void 0:s.id)===r,d=r==="casebook"&&this.noteGlow>0,c=this.reduced?.8:.5+.5*Math.sin(this.time*6);lt(e,h.x-1,h.y-1,h.w+2,h.h+2,12),e.fillStyle="rgba(0,0,0,0.46)",e.fill(),lt(e,h.x,h.y,h.w,h.h,11),e.fillStyle=t===r?"rgba(52,40,22,0.97)":l?"rgba(26,20,11,0.96)":"rgba(3,9,16,0.9)",e.fill();const p=fe();e.strokeStyle=p?t===r?"#fff3cf":"rgba(255,231,172,0.95)":t===r?"rgba(255,231,172,0.62)":l?"rgba(232,201,138,0.42)":"rgba(232,201,138,0.3)",e.lineWidth=p?2:1,e.stroke(),p||pn(e,h.x,h.y,h.w,h.h,{hover:t===r,active:l,radius:11,rivets:!0,bare:!0}),(l||u||d)&&(e.save(),e.beginPath(),e.arc(h.x+h.w/2,h.y+h.h/2,19,0,Math.PI*2),e.strokeStyle=d?`rgba(255,230,168,${.55+.45*c})`:u?"rgba(255,240,200,0.95)":"rgba(232,201,138,0.8)",e.lineWidth=p?u?4:3:u?2:1.5,this.glow(e,"rgba(255,206,130,0.7)",u?10:6+6*(d?c:0),e.lineWidth),e.stroke(),e.restore());const g=l||u||d?"#fff6df":"#ffe2a6";e.save(),this.view.cheapGlow||(e.shadowColor="rgba(255,204,120,0.28)",e.shadowBlur=6),Mu(e,Gu[r],h.x+h.w/2,h.y+h.h/2,u?28:27,g,1),e.restore()}e.restore();const o=this.touch?this.touchBarArmed??((i=this.barLabel)==null?void 0:i.id)??null:t;if(o){const r=`${Vu[o]} · ${jn[o]}`,h=Math.round(15*Math.min(this.textScale,1.3)),l=a[o];e.save(),e.globalAlpha=Math.max(.86,this.barFade),e.font=`${h}px Georgia, "Times New Roman", serif`;const u=e.measureText(r).width+20,d=h+10,c=Math.max(8,Math.min(S-u-8,l.x+l.w/2-u/2)),p=l.y+l.h+5;lt(e,c,p,u,d,6),e.fillStyle="rgba(3,8,14,0.94)",e.fill(),e.strokeStyle="rgba(232,201,138,0.38)",e.lineWidth=1,e.stroke(),K(e,r,c+u/2,p+5,{size:h,color:"#ffe9bb",align:"center",shadow:!1}),e.restore()}if(this.tipMode&&!this.dialogue&&!this.won){const r="Tip: "+this.tipLadder.shown(),h=Math.round(20*this.textScale),l=Math.round(27*this.textScale),u=je(e,r,1830,{size:h,weight:"normal"}),d=u.length*l+Math.round(17*this.textScale);e.save(),e.font=`${h}px Georgia, serif`;const c=Math.min(1872,Math.max(...u.map(p=>e.measureText(p).width))+40);e.restore(),e.fillStyle="rgba(5,13,22,0.86)",e.fillRect(24,_t,c,d),e.fillStyle=Ae.gold,e.fillRect(24,_t,3,d),u.forEach((p,g)=>K(e,p,44,_t+Math.round(10*this.textScale)+g*l,{size:h,color:"#dcebf2",shadow:!1}))}}lessonShowing(){return this.title||this.won||this.explore||this.dialogue||this.cinematic.active||this.areaCardBusy||this.paused||this.fade>.5?!1:!!this.watch.current&&this.watch.alpha>.01}drawFirstWatch(e){if(this.mobile||!this.lessonShowing())return;const t=this.watch.current;if(!t)return;const a=this.watch.alpha;if(a<=.01)return;const o=Yn[t.id],s=o.text(this.touch),i=Math.round(20*Math.min(this.textScale,1.3)),r=o.anchor==="satchel"?640:900,h=he(e,s,r,i,14);e.save(),e.globalAlpha=a,e.font=`${h.size}px Georgia, "Times New Roman", serif`;const l=e.measureText(h.text).width+52,u=h.size+22,d=_t+(this.tipMode?this.tipBannerHeight(e)+6:0);let c=40,p=d;if(o.anchor==="satchel"){const g=Ya(0);c=g.x-4,p=g.y-92}else if(o.anchor==="bar"){const g=Xn().casebook;c=g.x+g.w-l}c=Math.max(24,Math.min(S-l-24,c)),p=Math.max(24,Math.min(V-u-24,p)),lt(e,c,p,l,u,7),e.fillStyle="rgba(4,10,18,0.94)",e.fill(),e.strokeStyle="rgba(232,201,138,0.5)",e.lineWidth=1,e.stroke(),e.fillStyle=Ae.gold,e.fillRect(c,p,3,u),e.save(),e.translate(c+22,p+u/2),e.rotate(Math.PI/4),e.fillStyle="#e8c98a",e.fillRect(-3.5,-3.5,7,7),e.restore(),K(e,h.text,c+38,p+10,{size:h.size,color:"#f2e6cb",shadow:!1}),e.restore()}vignette(e){var t;if(((t=this.vignetteFor)==null?void 0:t.ctx)!==e){const a=e.createRadialGradient(S/2,q/2,q*.35,S/2,q/2,q*.95);a.addColorStop(0,"rgba(0,0,0,0)"),a.addColorStop(1,"rgba(0,0,0,0.5)"),this.vignetteFor={ctx:e,g:a}}return this.vignetteFor.g}introGlow(){if(this.exitIntro<=0)return 0;const e=ss-this.exitIntro;return Math.max(0,Math.min(1,e/.3,this.exitIntro/.65))}drawExitLighting(e){var r;if(this.title||this.won||this.dialogue||this.cinematic.active||this.paused)return;const t=this.visibleHotspots(),a=this.hoverHotspot,o=((r=this.keyboardFocus)==null?void 0:r.kind)==="hotspot"?this.keyboardFocus.id:null,s=this.introGlow();let i=0;for(const h of t){if(!this.isExit(h))continue;i++;const l=this.hotspotState(h),u=this.exitStand(l),d=this.exitThreshold(l);if(d.x<this.cameraX-150||d.x>this.cameraX+S+150)continue;const c=Te(l.area),p=h.id===a||h.id===o||this.pointerNear(d)||this.revealing,g=Math.hypot(u.x-this.x,u.y-this.y)<=as,m=(p?1.3:g?1:.68)+s*.8;if(this.drawThresholdLight(e,d.x,d.y,c.w,c.h,m,p,i),p&&!this.revealing){const b=this.reduced?.7:.5+.5*Math.sin(this.time*3.1+i*1.9);e.save(),this.areaPath(e,l.area),e.globalCompositeOperation="screen",e.fillStyle=`rgba(255,206,140,${.025+.025*b})`,e.fill(),e.restore()}}}pointerNear(e){return!this.pointerSeen||this.touch||this.input.y>=q?!1:Math.hypot(this.input.x+this.cameraX-e.x,this.input.y-e.y)<=Zu}drawThresholdLight(e,t,a,o,s,i,r,h){const l=this.reduced?.74:.56+.44*Math.sin(this.time*(r?3.2:1.55)+h*1.7),u=i*Math.max(.25,l),d=Math.max(42,Math.min(130,o*.62||64)),c=Math.max(70,Math.min(230,s*.55)),p=Math.max(26,Math.min(110,o*.52||44));e.save();const g=e.createRadialGradient(t,a,d*.12,t,a,d*1.55);g.addColorStop(0,"rgba(0,0,0,0)"),g.addColorStop(.6,"rgba(0,0,0,0)"),g.addColorStop(.78,`rgba(18,8,2,${.1+.07*l})`),g.addColorStop(1,"rgba(18,8,2,0)"),e.fillStyle=g,e.beginPath(),e.ellipse(t,a,d*1.55,d*.56,0,0,Math.PI*2),e.fill(),e.globalCompositeOperation="source-over";const m=e.createRadialGradient(t,a,0,t,a,d);m.addColorStop(0,`rgba(255,168,78,${.11*u})`),m.addColorStop(.55,`rgba(255,168,78,${.06*u})`),m.addColorStop(1,"rgba(255,168,78,0)"),e.fillStyle=m,e.beginPath(),e.ellipse(t,a,d,d*.36,0,0,Math.PI*2),e.fill(),e.globalCompositeOperation="lighter";const b=e.createRadialGradient(t,a,0,t,a,d);b.addColorStop(0,`rgba(255,214,150,${.22*u})`),b.addColorStop(.45,`rgba(255,172,86,${.11*u})`),b.addColorStop(1,"rgba(255,140,50,0)"),e.fillStyle=b,e.beginPath(),e.ellipse(t,a,d,d*.36,0,0,Math.PI*2),e.fill(),e.translate(t,a-c*.3),e.scale(p*.6,c*.7);const y=e.createRadialGradient(0,0,0,0,0,1);y.addColorStop(0,`rgba(255,205,130,${.1*u})`),y.addColorStop(.5,`rgba(255,185,100,${.045*u})`),y.addColorStop(1,"rgba(255,170,80,0)"),e.fillStyle=y,e.beginPath(),e.arc(0,0,1,0,Math.PI*2),e.fill(),e.restore()}exitStand(e){return e.stand??this.areaStand(e.area)}exitThreshold(e){const t=Te(e.area);return{x:t.x+t.w/2,y:t.y+t.h}}exitSound(e){var t;for(const a of((t=this.hotspotState(e).do)==null?void 0:t.walk)??[])if(a.k==="go")return a.sound??"door";return null}exitChevrons(){var d;const e=this.chevronOut;if(e.length=0,this.title||this.won||this.dialogue||this.cinematic.active||this.paused||this.revealing)return e;const t=this.visibleHotspots(),a=this.hoverHotspot?t.find(c=>c.id===this.hoverHotspot):void 0,o=((d=this.keyboardFocus)==null?void 0:d.kind)==="hotspot"?this.keyboardFocus.id:null,s=this.view.visible,i=this.cameraX+s.x,r=i+s.w,h=this.chevronCand;h.length=0;const l=(c,p,g)=>{for(const m of t){if(m.id===g||m.showIf&&!m.showIf.every(y=>this.check(y)))continue;const b=Te(this.hotspotState(m).area);if(!(b.w>Kt||b.h>Kt)&&this.inArea(c,p,this.hotspotState(m).area))return!0}return!1};for(const c of t){if(!this.isExit(c))continue;const p=this.hotspotState(c),g=this.exitThreshold(p),m=this.exitSound(p);let b=g.x,y=Math.max(76,Math.min(q-34,g.y-26));const _=Math.hypot(g.x-this.x,g.y-this.y),x=Math.max(0,Math.min(1,(_-is)/(ef-is))),T=c===a||c.id===o;if(x<=.01&&!T)continue;let N=0;if(m==="none"){const W=g.x-this.x;N=Math.abs(W)<18?0:W<0?-Math.PI/2:Math.PI/2}let C=null;const D=Math.max(30,(ea/2+nf)/this.view.scale);b<i?(C="left",b=i+D,N=-Math.PI/2):b>r&&(C="right",b=r-D,N=Math.PI/2);const Q=T||this.pointerNear(g)||Math.hypot(g.x-this.x,g.y-this.y)<=as;if(!Q&&h.some(W=>Math.hypot(W.tx-g.x,W.ty-g.y)<70))continue;let B=l(b,y,c.id);if(B){for(let W=-34;W>=-420;W-=34){const j=y+W;if(!(j<76||j>q-34)&&!l(b,j,c.id)){y=j,B=!1;break}}if(B)for(let W=34;W<=420;W+=34){const j=y+W;if(!(j<76||j>q-34)&&!l(b,j,c.id)){y=j,B=!1;break}}}h.push({raw:c,tx:g.x,ty:g.y,x:b,y,angle:N,edge:C,near:Q,arrived:x,floor:g.y,contested:B})}const u=Math.max(of,ea/this.view.scale);for(const c of["left","right"]){const p=h.filter(b=>b.edge===c).sort((b,y)=>b.ty-y.ty);let g=-1/0;for(const b of p)b.y=Math.max(b.y,g+u),g=b.y;const m=p.length?g-(q-34):0;if(m>0)for(const b of p)b.y=Math.max(76,b.y-m)}for(const c of h){if(this.narrationTop!==null&&c.y+30>this.narrationTop)continue;const p=this.chevronHitRadius();c.y+p>q&&(c.y=q-p),c.y-p<76&&(c.y=76+p),e.push({x:c.x,y:c.y,angle:c.angle,strength:(c.near?1:.72)*c.arrived*(c.contested?.7:1),edge:c.edge!==null,floor:c.floor,hs:c.raw,contested:c.contested})}return e}chevronHitRadius(){return this.touch?Math.max(13,ea/2/this.view.scale):tf}exitChevronAt(e,t){if(t>=q)return null;const a=this.chevronHitRadius(),o=this.transition.peekZoom(this.fade,this.cameraX,this.reduced),s=e+this.cameraX;if(this.overAThing(s,t))return null;let i=null,r=a;for(const h of this.exitChevrons()){const l=o?o.x+(h.x-this.cameraX-o.x)*o.k:h.x-this.cameraX,u=o?o.y+(h.y-o.y)*o.k:h.y,d=Math.hypot(l-e,u-t);d>r||h.contested||(r=d,i=h.hs)}return i}overAThing(e,t){for(const a of this.visibleHotspots()){if(this.isExit(a)||a.showIf&&!a.showIf.every(s=>this.check(s)))continue;const o=Te(this.hotspotState(a).area);if(!(o.w>Kt||o.h>Kt)&&this.inArea(e,t,this.hotspotState(a).area))return!0}return!1}drawChevronAt(e,t,a,o,s=1,i=!1){const r=this.reduced?.6:.5+.5*Math.sin(this.time*2.6),h=Math.min(1,(.62+.24*r+(i?.14:0))*s),l=this.reduced?0:Math.sin(this.time*2)*1.4,u=Math.max(1,af/(26.64*this.view.scale));if(e.save(),e.translate(t,a+l),i){const c=e.createRadialGradient(0,2,0,0,2,34*u);c.addColorStop(0,`rgba(8,4,1,${.5*s})`),c.addColorStop(.65,`rgba(8,4,1,${.28*s})`),c.addColorStop(1,"rgba(8,4,1,0)"),e.fillStyle=c,e.beginPath(),e.arc(0,2,34*u,0,Math.PI*2),e.fill()}e.globalAlpha=.5*s,e.fillStyle="rgba(10,6,2,1)",e.beginPath(),e.ellipse(0,3,21*u,15*u,0,0,Math.PI*2),e.fill(),e.globalAlpha=1,e.globalCompositeOperation="lighter";const d=e.createRadialGradient(0,2,0,0,2,26*u);d.addColorStop(0,`rgba(255,206,130,${.16*s})`),d.addColorStop(1,"rgba(255,180,90,0)"),e.fillStyle=d,e.beginPath(),e.arc(0,2,26*u,0,Math.PI*2),e.fill(),e.globalCompositeOperation="source-over",e.rotate(o),e.scale(1.48*u,1.48*u),e.lineCap="round",e.lineJoin="round";for(const[c,p]of[[0,1],[9,.5]]){e.globalAlpha=p;const g=()=>{e.beginPath(),e.moveTo(-9,c+4),e.lineTo(0,c-4),e.lineTo(9,c+4)};e.strokeStyle="rgba(12,6,2,0.92)",e.lineWidth=6,g(),e.stroke(),e.strokeStyle=`rgba(255,242,214,${Math.min(1,h+.28)})`,e.lineWidth=3.2,g(),e.stroke(),this.glow(e,"rgba(255,186,96,0.9)",12,3.2),e.stroke()}e.restore()}drawReveal(e){const t=this.reduced?.7:.5+.5*Math.sin(this.time*3.4);for(const a of this.visibleHotspots()){const o=this.hotspotState(a),s=this.isExit(o),i=Te(o.area);if(i.w>S*Uu||i.h>V*Yu){this.revealBrackets(e,o.area,i,s,t);continue}this.outlineHotspot(e,o,{fill:s?`rgba(255,196,120,${.05+.025*t})`:`rgba(255,214,150,${.055+.03*t})`,stroke:s?`rgba(255,206,140,${.58+.24*t})`:`rgba(255,228,175,${.5+.22*t})`,width:s?2.2:2,glow:s?18:14,glowColor:s?"rgba(255,170,80,0.8)":"rgba(255,196,110,0.72)",core:.2,edge:.2})}}revealBrackets(e,t,a,o,s){e.save(),e.lineJoin="round",e.lineCap="round";const i=o?"255,206,140":"255,228,175";this.areaPath(e,t),e.strokeStyle=`rgba(${i},0.2)`,e.lineWidth=1.2,e.stroke();const r=Math.min(44,a.w/4,a.h/4);e.beginPath(),Zo(e,a.x,a.y,a.w,a.h,r),e.strokeStyle="rgba(12,7,2,0.4)",e.lineWidth=5,e.stroke(),e.strokeStyle=`rgba(${i},${.62+.2*s})`,e.lineWidth=2.4,e.stroke(),e.restore()}tipBannerHeight(e){if(!this.tipMode)return 0;const t=Math.round(20*this.textScale),a=Math.round(27*this.textScale);return je(e,"Tip: "+this.tipLadder.shown(),1830,{size:t,weight:"normal"}).length*a+Math.round(17*this.textScale)+8}areaPath(e,t){if(e.beginPath(),"rect"in t){const a=t.rect;e.rect(a.x,a.y,a.w,a.h)}else t.forEach((a,o)=>o===0?e.moveTo(a.x,a.y):e.lineTo(a.x,a.y)),e.closePath()}glow(e,t,a,o){if(!this.view.cheapGlow){e.shadowColor=t,e.shadowBlur=a;return}e.save(),e.shadowBlur=0,e.strokeStyle=t,e.globalAlpha*=.32,e.lineWidth=o+a*.9,e.stroke(),e.restore()}outlineHotspot(e,t,a){e.save(),this.areaPath(e,t.area),e.fillStyle=a.fill,e.fill(),a.glow&&(e.globalAlpha=.3,e.strokeStyle=a.glowColor??a.stroke,e.lineWidth=Math.max(7,a.width*4.5),e.stroke(),e.globalAlpha=1,this.glow(e,a.glowColor??a.stroke,a.glow,a.width)),a.edge&&(e.shadowBlur=0,e.strokeStyle=`rgba(12,7,2,${a.edge})`,e.lineWidth=a.width+2.4,e.stroke(),a.glow&&!this.view.cheapGlow&&(e.shadowColor=a.glowColor??a.stroke,e.shadowBlur=a.glow*.7)),e.strokeStyle=a.stroke,e.lineWidth=a.width,a.dash&&e.setLineDash(a.dash),e.stroke(),a.glow&&(a.core??.3)>0&&(e.shadowBlur=0,e.strokeStyle=`rgba(255,246,220,${a.core??.3})`,e.lineWidth=Math.max(.8,a.width*.5),e.stroke()),e.restore()}drawHoverGlow(e){if(!this.hoverHotspot||this.dialogue||this.won)return;const t=this.room.hotspots.find(r=>r.id===this.hoverHotspot);if(!t)return;const a=this.hotspotState(t);if(this.isExit(a))return;const s=.5+.5*(this.reduced?.72:.58+.32*Math.sin(this.time*4.4));if(e.save(),this.areaPath(e,a.area),e.globalCompositeOperation="screen",e.fillStyle=`rgba(255,215,150,${.05+.045*s})`,e.fill(),e.restore(),this.touch)return;const i=Te(a.area);if(e.save(),e.lineJoin="round",e.lineCap="round","rect"in a.area){const r=a.area.rect,h=Math.min(26,r.w/3,r.h/3);this.areaPath(e,a.area),e.strokeStyle=`rgba(255,226,160,${.1+.05*s})`,e.lineWidth=1,e.stroke(),e.beginPath(),Zo(e,r.x,r.y,r.w,r.h,h),e.strokeStyle=`rgba(255,226,160,${.6+.25*s})`,e.lineWidth=2.4,e.stroke()}else Math.max(i.w,i.h)>560&&e.setLineDash([14,10]),this.areaPath(e,a.area),e.strokeStyle=`rgba(232,196,120,${.07+.05*s})`,e.lineWidth=6,e.stroke(),e.strokeStyle=`rgba(255,226,160,${.42+.2*s})`,e.lineWidth=1.6,e.stroke();e.restore()}drawFocusRing(e,t,a){const o=this.reduced?.8:.7+.24*Math.sin(this.time*3.1);e.save(),e.translate(t,a),e.globalCompositeOperation="lighter";const s=e.createRadialGradient(0,0,0,0,0,38);s.addColorStop(0,`rgba(255,230,170,${.2*o})`),s.addColorStop(1,"rgba(255,180,90,0)"),e.fillStyle=s,e.beginPath(),e.ellipse(0,0,38,15,0,0,Math.PI*2),e.fill(),e.globalCompositeOperation="source-over",e.strokeStyle=`rgba(255,243,207,${.62+.26*o})`,e.lineWidth=2,e.beginPath(),e.ellipse(0,0,27,10,0,0,Math.PI*2),this.glow(e,"rgba(255,210,140,0.9)",14,2),e.stroke(),e.restore()}drawKeyboardFocus(e){var r;if(((r=this.keyboardFocus)==null?void 0:r.kind)!=="hotspot"||this.dialogue||this.won)return;const t=this.visibleHotspots().find(h=>{var l;return h.id===((l=this.keyboardFocus)==null?void 0:l.id)});if(!t)return;const a=this.hotspotState(t),o=Te(a.area),s=Math.max(o.w,o.h)>500,i=this.reduced?.8:.68+.2*Math.sin(this.time*3.2);if(e.save(),this.areaPath(e,a.area),e.globalCompositeOperation="screen",e.fillStyle=`rgba(255,243,207,${(s?.03:.055)+.025*i})`,e.fill(),e.restore(),s){const h=this.isExit(a)?this.exitThreshold(a):this.areaStand(a.area);this.drawFocusRing(e,h.x,h.y);return}this.outlineHotspot(e,a,{fill:"rgba(255,243,207,0.02)",stroke:`rgba(255,246,220,${.7+.2*i})`,width:3,glow:20,glowColor:"rgba(255,220,150,0.85)",core:.5,edge:.18})}updateSpeech(e){const t=this.currentNode(),a=this.dialogue&&t&&this.dialogue.shown<t.text.length?t.speaker:null,o=this.narration&&this.narration.shown<this.narration.text.length?"fenn":null,s=new Set([...this.talking.keys(),...a?[a]:[],...o?[o]:[]]);for(const i of s){const r=i===a||i===o?1:0,h=r+((this.talking.get(i)??0)-r)*Math.exp(-e/.14);h<.01&&r===0?this.talking.delete(i):this.talking.set(i,h)}}speech(e,t){const a=e?this.talking.get(e)??0:0;return!e||a<=.001||this.reduced?null:{lean:(e==="fenn"?0:Math.sign(this.x-t))*.022*a,squash:1+.011*a*Math.abs(Math.sin(this.time*8.5+t*.01))}}personHeight(e){return id(this.room,e)}wrapAt(e,t,a){const o=yu(this.room,e,t,a,s=>!s.showIf||s.showIf.every(i=>this.check(i)));return this.view.cheapGlow&&o.rim?{colour:o.colour,blur:o.blur}:o}drawSprite(e,t,a,o,s,i,r,h=!1,l="none",u=null,d){cc(e,this.assets,t,a,o,s*this.personHeight(o),{visible:i,figure:r,flip:h,grade:l,...u,wrap:d})}drawPlayer(e){var d;const t="char_walk_v2",a=this.personHeight(this.y),o=this.path.length>0,s=this.moveDirection==="up"||this.moveDirection==="down",i=this.walkPhase/Jn,r=this.figureGrade("saturate(0.85) brightness(0.9)"),h=this.wrapAt(this.x,this.y,a);Ws(e,this.x,this.y,a*.26,.38,((d=h==null?void 0:h.rim)==null?void 0:d.side)??0,Fs(h));const l=i*2%1,u=o&&!this.reduced?Math.sin(Math.PI*l)*(s?.014:.008)*a:0;if(o&&s&&this.assets.img("char_walk_vertical")){const c=(this.moveDirection==="up"?0:3)+Zn[Math.floor(i*Zn.length)%Zn.length];Qt(e,this.assets,"char_walk_vertical",this.x,this.y-u,a,{frames:6,frame:c,grade:r,wrap:h})}else if(o&&this.assets.img(t)){const c=Math.floor(i*6)%6;Qt(e,this.assets,t,this.x,this.y-u,a,{frames:6,frame:c,grade:r,flip:this.facing<0,wrap:h})}else if(this.assets.img("char_elias")){const c=this.reduced?1:1+Math.sin(this.time*2.2)*.004,p=this.speech("fenn",this.x);Qt(e,this.assets,"char_elias",this.x,this.y,a*c,{grade:r,flip:this.facing<0,...p,wrap:h})}}devState(){var e;return{title:this.title,explore:this.explore,act:this.act,room:((e=this.room)==null?void 0:e.id)??null,x:Math.round(this.x),y:Math.round(this.y),inventory:[...this.inventory],flags:{...this.flags},dialogue:this.dialogue?{tree:this.dialogue.tree.id,node:this.dialogue.nodeId}:null,queue:this.queue?[...this.queue]:null,cameraX:this.cameraX}}devSnapshot(){return{room:this.room.id,x:this.x,y:this.y,facing:this.facing,moveDirection:this.moveDirection,act:this.act,flags:structuredClone(this.flags),inventory:[...this.inventory],inventoryPage:this.inventoryPage,notes:structuredClone(this.notes),dialogue:this.dialogue?{tree:this.dialogue.tree.id,node:this.dialogue.nodeId,shown:this.dialogue.shown}:null,narration:this.narration?{...this.narration}:null,narrationClock:this.narrationClock,queue:this.queue?structuredClone(this.queue):null,queueDue:this.queueDue,cameraX:this.cameraX,sentence:structuredClone(this.sentence)}}devRestore(e,{persist:t=!0}={}){this.resetTransient(),this.title=!1,this.won=!1,this.explore=!1,this.roomMenu=!1,this.confirmNew=!1,this.paused=!1;const a=le[e.room];this.room!==a&&(this.room=a,this.mesh=new Mn(a.walk,a.width??S,q)),this.roomWait=0,this.assets.ensure(wt(a)),this.x=e.x,this.y=e.y,this.facing=e.facing,this.moveDirection=e.moveDirection,this.act=e.act,this.flags=structuredClone(e.flags),this.inventory=[...e.inventory],this.inventoryPage=e.inventoryPage,this.warmInventoryIcons(),this.notes=structuredClone(e.notes),this.cameraX=e.cameraX,this.focusCameraX=null,this.path=[],this.onArrive=null,this.walkGoal=null,this.running=!1,this.walkPhase=0,this.walkStarting=!1,this.directionPending=0,this.sentence=e.sentence?structuredClone(e.sentence):{verb:null,a:null,b:null},this.keyboardFocus=null,this.hoverHotspot=null,this.hoverVerb=null,this.hoverItem=null,this.hoverChoice=-1,this.touchArmed=null,this.touch=!1,this.revealHeld=!1,this.revealToggled=!1,this.rejection=0,this.narration=e.narration?{...e.narration}:null,this.narrationClock=e.narrationClock,this.queue=e.queue?structuredClone(e.queue):null,this.queueDue=e.queueDue;const o=e.dialogue?Ye[e.dialogue.tree]:void 0;this.dialogue=o&&e.dialogue?{tree:o,nodeId:e.dialogue.node,shown:e.dialogue.shown}:null,this.saveNotice=null,this.autosaveIn=0,this.history.clear(),t&&this.persist()}devSetFlag(e,t){t===void 0?delete this.flags[e]:this.flags[e]=t,this.persist()}devGive(e){this.giveItem(e)}devTake(e){this.takeItem(e)}devGoRoom(e){le[e]&&(this.title=!1,this.won=!1,this.resetTransient(),this.loadRoom(e,void 0,{atEntry:!0}))}devAct(e){this.title=!1,this.won=!1,this.startAct(e)}devReload(){if(!this.room)return;const e=le[this.room.id];if(!e)return;this.room=e,this.ambient.setRoom(e),this.mesh=new Mn(e.walk,e.width??S,q),this.roomWait=0,this.assets.ensure(wt(e));const t=nt({x:this.x,y:this.y},e.walk);if(this.x=t.x,this.y=t.y,this.path=[],this.onArrive=null,this.dialogue){const a=Ye[this.dialogue.tree.id];this.dialogue=a!=null&&a.nodes[this.dialogue.nodeId]?{...this.dialogue,tree:a}:null}}devOverlay(e){return e!==void 0&&(this.debugOverlay=e),this.debugOverlay}devWorld(e,t){const a=this.view.toLogical(e,t);return a.x<0||a.x>S||a.y<0||a.y>V?null:{x:a.x+this.cameraX,y:a.y}}devScale(){return this.view.scale}devPick(e,t){var o,s;if(this.title)return null;const a=this.view.toLogical(e,t);if(this.dialogue){const i=this.currentNode();if(!i)return null;const r=Hn(a.x,a.y,this.dialogueModel()),h=r==null?-1:((o=this.visibleChoices()[r])==null?void 0:o.index)??-1,l=(s=i.choices)==null?void 0:s[h];return l?{kind:"choice",tree:this.dialogue.tree.id,node:i,choice:l}:{kind:"node",tree:this.dialogue.tree.id,node:i}}if(a.y>=q)return null;for(let i=this.room.hotspots.length-1;i>=0;i--){const r=this.room.hotspots[i];if(!(r.showIf&&!r.showIf.every(h=>this.check(h)))&&this.inArea(a.x+this.cameraX,a.y,r.area))return{kind:"hotspot",room:this.room.id,hotspot:r}}return null}exploreRooms(){const e=[],t=new Set,a=(o,s)=>!(s!=null&&s.some(i=>"act"in i&&!(Array.isArray(i.act)?i.act.includes(o):i.act===o)));for(const o of Object.values(ae)){const s=[o.start.room],i=new Set;for(;s.length;){const r=s.shift();if(!(i.has(r)||!le[r])){i.add(r),t.has(r)||(t.add(r),e.push({id:r,act:o.n}));for(const h of le[r].hotspots)if(a(o.n,h.showIf)){for(const l of[h,...h.states??[]])if(!("if"in l&&!a(o.n,l.if)))for(const u of Object.values(l.do??{}))for(const d of u??[])d.k==="go"&&!i.has(d.room)&&s.push(d.room)}}}}for(const o of Object.keys(le))t.has(o)||e.push({id:o,act:0});return e}startExplore(){this.resetState(),this.explore=!0,this.title=!1,this.act=ot,this.loadRoom(ae[ot].start.room),this.roomMenu=!0,this.focusCurrentScene(),this.announce("Chapter select."),this.announceSceneFocus()}exploreGo(e){const t=this.exploreRooms()[e];t&&(this.resetTransient(),this.act=t.act||this.act,this.loadRoom(t.id,void 0,{atEntry:!0}),this.roomMenu=!1)}roomMenuLayout(){const e=this.exploreRooms(),t=[...new Set(e.map(u=>u.act))],a=Math.max(1,t.length),o=a<=4?380:Math.max(250,Math.floor((S-240-(a-1)*24)/a)),s=a<=4?36:24,i=a*o+(a-1)*s,r=Math.round((S-i)/2),h=new Array(e.length),l=t.map((u,d)=>{var g;const c=r+d*(o+s),p=e.map((m,b)=>({...m,index:b})).filter(m=>m.act===u).map(({index:m,id:b})=>({index:m,id:b}));return p.forEach((m,b)=>{h[m.index]={x:c,y:236+b*50,w:o,h:44}}),{act:u,title:((g=ae[u])==null?void 0:g.title)??"Elsewhere",x:c,rooms:p}});return{entries:e,columns:l,rects:h}}focusCurrentScene(){const t=this.roomMenuLayout().entries.findIndex(a=>{var o;return a.id===((o=this.room)==null?void 0:o.id)});t>=0&&(this.roomMenuFocus=t)}announceSceneFocus(){const e=this.roomMenuLayout(),t=e.entries[this.roomMenuFocus];if(!t)return;const a=e.columns.find(r=>r.rooms.some(h=>h.index===this.roomMenuFocus)),o=a?a.rooms.findIndex(r=>r.index===this.roomMenuFocus)+1:1,s=(a==null?void 0:a.rooms.length)??1,i=t.act?`Act ${Ve[t.act]??t.act}, `:"";this.announce(`${le[t.id].name}. ${i}scene ${o} of ${s}.`)}exploreKey(e,t){if(this.title)return!1;if(e==="r"||e==="R")return this.roomMenu=!this.roomMenu,this.roomMenu?(this.focusCurrentScene(),this.announce("Chapter select."),this.announceSceneFocus()):this.announce("Chapter select closed."),!0;if(!this.roomMenu)return!1;const a=this.roomMenuLayout(),o=a.entries.length;if(!o)return!1;const s=Math.max(0,Math.min(o-1,this.roomMenuFocus));if(e==="Escape")return t.preventDefault(),this.roomMenu=!1,this.announce("Chapter select closed."),!0;if(e==="Tab"){const l=t.shiftKey?-1:1,u=s+l;return u<0||u>=o||(t.preventDefault(),this.roomMenuFocus=u,this.announceSceneFocus()),!0}if(t.preventDefault(),e==="Enter"||e===" ")return this.exploreGo(s),!0;if(e!=="ArrowUp"&&e!=="ArrowDown"&&e!=="ArrowLeft"&&e!=="ArrowRight")return!0;const i=a.columns.findIndex(l=>l.rooms.some(u=>u.index===s)),r=a.columns[i];if(!r)return!0;const h=Math.max(0,r.rooms.findIndex(l=>l.index===s));if(e==="ArrowUp"||e==="ArrowDown"){const l=Math.max(0,Math.min(r.rooms.length-1,h+(e==="ArrowDown"?1:-1)));this.roomMenuFocus=r.rooms[l].index}else{const l=a.columns[Math.max(0,Math.min(a.columns.length-1,i+(e==="ArrowRight"?1:-1)))],u=Math.max(0,Math.min(l.rooms.length-1,h));l.rooms[u]&&(this.roomMenuFocus=l.rooms[u].index)}return this.announceSceneFocus(),!0}roomMenuClick(e,t){const a=this.roomMenuLayout();for(let o=0;o<a.rects.length;o++)if(es(e,t,a.rects[o])){this.exploreGo(o);return}this.roomMenu=!1}drawChartDiamond(e,t,a,o,s){e.save(),e.translate(t,a),e.rotate(Math.PI/4),e.fillStyle=s,e.fillRect(-o,-o,o*2,o*2),e.restore()}renderExplore(e){var i,r,h;const t=Math.min(this.textScale,1.2);if(!this.roomMenu){e.fillStyle="rgba(4,10,18,0.88)",e.fillRect(470,oe.y,610,oe.h),e.strokeStyle="rgba(201,162,74,0.38)",e.lineWidth=1,e.strokeRect(470.5,oe.y+.5,609,oe.h-1),this.drawChartDiamond(e,492,oe.y+oe.h/2,4,"rgba(232,201,138,0.85)");const u=he(e,"CHAPTER SELECT  ·  R scenes",560,Math.round(20*t),13);K(e,u.text,775,oe.y+Math.round((oe.h-u.size)/2)-1,{size:u.size,color:"#e8c98a",align:"center",weight:"bold",shadow:!1});return}e.fillStyle="rgba(3,5,12,0.92)",e.fillRect(0,0,S,V);const a=he(e,"CHAPTER SELECT",900,Math.round(34*t),20,"bold");K(e,a.text,S/2,78,{size:a.size,color:Ae.gold,align:"center",weight:"bold"});const o=he(e,"walk any scene  ·  nothing is saved",900,Math.round(18*t),12);K(e,o.text,S/2,122,{size:o.size,color:"#a99a7a",align:"center",shadow:!1});const s=this.roomMenuLayout();for(const l of s.columns){const u=l.act?`ACT ${Ve[l.act]??l.act}`:"ELSEWHERE",d=he(e,u,180,Math.round(15*t),11,"bold");K(e,d.text,l.x,172,{size:d.size,color:"#e8c98a",weight:"bold",shadow:!1}),this.drawChartDiamond(e,l.x+200,180,3.5,"rgba(232,201,138,0.55)");const c=he(e,l.title.toUpperCase(),(l.rooms.length,380),Math.round(17*t),11);K(e,c.text,l.x+216,170,{size:c.size,color:"#a99a7a",shadow:!1}),e.strokeStyle="rgba(201,162,74,0.28)",e.lineWidth=1,e.beginPath(),e.moveTo(l.x,200),e.lineTo(l.x+(((r=s.rects[(i=l.rooms[0])==null?void 0:i.index])==null?void 0:r.w)??380),200),e.stroke()}for(const l of s.columns)for(const u of l.rooms){const d=s.rects[u.index];if(!d)continue;const c=u.index===this.roomMenuFocus,p=u.id===((h=this.room)==null?void 0:h.id);e.fillStyle=c?"rgba(232,201,138,0.16)":"rgba(10,16,28,0.82)",e.fillRect(d.x,d.y,d.w,d.h),e.strokeStyle=c?"rgba(255,231,172,0.9)":"rgba(201,162,74,0.26)",e.lineWidth=c?1.5:1,e.strokeRect(d.x+.5,d.y+.5,d.w-1,d.h-1),c&&(e.fillStyle="#e8c98a",e.fillRect(d.x,d.y,3,d.h),e.strokeStyle="rgba(255,230,168,0.55)",e.lineWidth=1.5,e.strokeRect(d.x+4,d.y+4,d.w-8,d.h-8));const g=he(e,le[u.id].name,d.w-(p?82:54),Math.round(20*t),13);if(K(e,g.text,d.x+32,d.y+Math.round((d.h-g.size)/2)-1,{size:g.size,color:c?"#fff6e0":p?"#e8c98a":"#d9c9a4",shadow:!1}),this.drawChartDiamond(e,d.x+17,d.y+d.h/2,3.5,c?"#ffe6a8":p?"rgba(232,201,138,0.9)":"rgba(201,162,74,0.45)"),p){const m=he(e,"HERE",60,Math.round(12*t),9,"bold");K(e,m.text,d.x+d.w-16,d.y+Math.round((d.h-m.size)/2)-1,{size:m.size,color:"#e8c98a",align:"right",weight:"bold",shadow:!1})}}}titleButtons(){return Bd(this.hasSave,this.chaptersUnlocked(),this.confirmNew,this.continueLabel,this.hasPrevious,this.recoverView())}recoverView(){return this.recoverable.length?{open:this.recoverOpen,offset:this.recoverOffset,pages:this.recoverable.map(({page:e,data:t})=>({label:this.actTitle(t.act)??"A saved voyage",sub:[pf[e.reason],e.at>0?new Date(e.at).toLocaleDateString():null].filter(Boolean).join(" · ")}))}:null}closeRecover(){this.recoverOpen=!1,this.recoverOffset=0,this.setTitleFocus("recover"),this.announce("Back to the title.")}chaptersUnlocked(){return xn()}setTitleFocus(e){if(e===this.titleFocus)return;const t=this.titleButtons(),a=t.find(o=>o.id===this.titleFocus)??t.find(o=>o.id===Re(t));this.needle={fromY:(a==null?void 0:a.y)??null,since:this.titleClock},this.titleFocus=e,this.cueHover(e?`title:${e}`:null)}enterTitle(){this.clearTouchArm(),this.title=!0,this.confirmNew=!1,this.titleClock=0;try{const a=fo(be);if(this.titleNotice=null,a){const o=xe(a.raw,a.reason,void 0,a.version);o&&this.clearKeepPage(),this.titleNotice=uo(a.reason,o)}this.hasSave=qn(be),this.hasPrevious=Rn(),this.recoverable=co(be)}catch{this.hasSave=!1,this.hasPrevious=!1,this.recoverable=[]}this.recoverOpen=!1,this.recoverOffset=0;const e=this.titleButtons();this.continueLabel=this.hasSave?this.saveLabel(" ·"):null,this.titleFocus=Re(e),this.needle={fromY:null,since:-99};const t=e.find(a=>a.id===this.titleFocus);this.announce(`${this.titleNotice?this.titleNotice+" ":""}Title screen. ${e.map(a=>a.label).join(", ")}.${t?` Enter chooses ${t.label}.`:""} Arrow keys move between them.`),this.casebookTally=dd()}cancelConfirmNew(){this.confirmNew=!1,this.setTitleFocus("start"),this.announce("Kept your saved voyage.")}saveLabel(e=":"){try{const{data:t}=St(be),a=t&&ae[t.act];return a?`Act ${Ve[a.n]??a.n}${e} ${a.title}`:null}catch{return null}}actTitle(e){const t=ae[e];return t?`Act ${Ve[t.n]??t.n} · ${t.title}`:null}sail(){this.behindCurtain(()=>{this.explore=!1,this.title=!1,this.loadGame()})}hitTitle(e,t,a){return Vd(e,t,a)}renderTitle(e){Qd(e,{bg:this.assets.img("bg_title"),buttons:this.mobile?[]:this.titleButtons(),focus:this.mobile?null:this.titleFocus,dev:!1,confirmNew:this.mobile?!1:this.confirmNew,saveLabel:this.confirmLabel,time:this.titleClock,reduced:this.reduced,scale:this.textScale,needle:this.needle,casebook:this.mobile?null:this.casebookTally})}titleActivate(e){if(e==="previous"){Hd(be)?(this.clearKeepPage(),this.hasSave=!0,this.hasPrevious=!1,this.clearForeignSave(),this.enterTitle(),this.announce("Your earlier voyage is back. Continue takes it up.")):(this.hasPrevious=!1,this.announce("There is no earlier voyage to take up."));return}if(e==="start"&&this.hasSave){if(this.confirmNew)return;this.confirmNew=!0,this.confirmArmedAt=performance.now(),this.confirmLabel=this.saveLabel(),this.setTitleFocus("keep"),this.audio.deny(),this.announce("Start a new voyage? It replaces your saved one, which you can take up again from the title. Keep my voyage, or Yes, start anew.");return}if(e==="keep"){this.cancelConfirmNew();return}if(e==="more"){const t=qs(this.recoverable.length,this.recoverOffset+We);this.recoverOffset=t,this.setTitleFocus(`page${t}`),this.announce(`Pages ${t+1} to ${Math.min(t+We,this.recoverable.length)} of ${this.recoverable.length}.`);return}if(e==="recover"){this.recoverOpen=!0,this.recoverOffset=0,this.setTitleFocus("page0"),this.announce(`Recover an older page. ${this.recoverable.length} kept. Choose one to make it your saved voyage; the one you have now is kept too. Escape goes back.`);return}if(e==="back"){this.closeRecover();return}if(e.startsWith("page")){const t=this.recoverable[Number(e.slice(4))];t&&Ad(t.page,be)?(this.clearKeepPage(),this.clearForeignSave(),this.enterTitle(),this.announce("That page is back. Continue takes it up.")):this.announce("That page could not be taken up. Nothing was changed.");return}if(!(e==="confirm"&&(!this.confirmNew||performance.now()-this.confirmArmedAt<Qo)))if(this.confirmNew=!1,this.titleFocus=null,e==="start"||e==="confirm")this.explore=!1,this.beginNewVoyage();else if(e==="continue"&&this.hasSave){const{data:t}=St(be);t?(this.audio.page(),this.recap.show(t),this.announce("Previously: where you left off. Set sail, read the chart, or go back.")):this.sail()}else e==="explore"&&this.startExplore()}renderFade(e){if(this.connector.active){this.connector.draw(e,this.reduced);return}const t=this.view.visible;kc(e,{center:{x:t.x+t.w/2,y:this.view.logicalHeight/2},fade:this.fade,reduced:this.reduced,entry:this.transition.entrySide(),waited:this.roomWait})}}const mf={char_walk_v2:6,char_walk_vertical:6},Qs=Js(Qe.images),bf=Js(Qe.audio);function Js(n){return Object.fromEntries(Object.entries(n).map(([e,t])=>[e,At(t)]))}const wf=new Set(["bg_title"]),yf=["bg_dock_cinema_wide","char_elias","char_walk_v2","char_walk_vertical"],kf=["music_dock"],vf=["bg_title"];function _f(n){return Object.fromEntries(Object.entries(Qs).filter(([e])=>wf.has(e)===n))}function Zs(n,e){var u;const t=document.getElementById("boot");t==null||t.classList.add("gone"),window.setTimeout(()=>t==null?void 0:t.remove(),700);const a=document.getElementById("bootfail"),o=document.getElementById("bootfail-detail"),s=e instanceof Error&&e.message?e.message:e?String(e):"",i=e?`The game could not start${s?` (${s})`:""}. Your browser may have graphics turned off or blocked; try another browser, or reload.`:n.length?`The first room's art could not be loaded (${n.join(", ")}).`:"The first room's art could not be loaded.";o&&(o.textContent=i);const r=document.getElementById("stage");r&&(r.inert=!0,r.setAttribute("aria-hidden","true"));const h=document.getElementById("game");h&&(h.tabIndex=-1),a&&(a.hidden=!1,(u=document.getElementById("bootfail-retry"))==null||u.focus());const l=document.getElementById("sr");l&&(l.textContent=`The harbour is still in fog. ${i} Choose Try again, or ${e?"reload the page":"check your connection and reload the page"}.`)}async function Tf(){var p,g,m;const n=document.getElementById("game"),e=document.getElementById("boot"),t=document.getElementById("bootbar"),a=mi(),o=()=>{const b=window.innerWidth>window.innerHeight,y=document.body.classList.contains("m-landscape");return document.body.classList.toggle("m-landscape",b),b!==y};a&&(document.body.classList.add("mobile","m-full"),o(),n.setAttribute("aria-label","The Brass Compass. The scene is a painting; the touch controls below it are buttons: the verbs, the satchel, and the action plate that confirms what you tapped."));const s=new bi(n,a),i=new ki(s),r=new _i,h=new Ar(r);if(a){const b=()=>{o()&&s.resize()};window.addEventListener("resize",b),window.addEventListener("orientationchange",b),(m=(g=(p=window.matchMedia)==null?void 0:p.call(window,"(orientation: landscape)"))==null?void 0:g.addEventListener)==null||m.call(g,"change",b)}window.addEventListener("resize",()=>s.resizeSoon()),r.setCatalog(Qs),await r.load({images:_f(!0),audio:bf},b=>{t&&(t.style.width=`${Math.round(Math.min(1,b)*100)}%`)},{frames:mf,eagerAudio:kf});const l=vf.filter(b=>r.hasFailed([b]));if(l.length){console.error("boot failed:",l.join(", ")),Zs(l);return}const u=new gf(s,i,r,h);r.onNotice=b=>u.notify(b),u.start(),r.ensure(yf);const d=["pointerdown","touchend","click","keydown"],c=()=>{if(h.unlock(),!!h.running)for(const b of d)window.removeEventListener(b,c,!0)};for(const b of d)window.addEventListener(b,c,!0);e==null||e.classList.add("gone"),window.setTimeout(()=>e==null?void 0:e.remove(),700)}var hs;(hs=document.getElementById("bootfail-retry"))==null||hs.addEventListener("click",()=>window.location.reload());Tf().catch(n=>{console.error("boot failed:",n),Zs([],n??new Error("unknown error"))});
