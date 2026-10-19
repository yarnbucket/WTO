(function(){
 'use strict';
 if(document.getElementById('wtoHalloweenLayer'))return;
 const screens=[document.getElementById('summaryScreen'),document.getElementById('trackerScreen')].filter(Boolean);
 if(!screens.length)return;
 const style=document.createElement('style');
 style.textContent=`
 body[data-theme="halloween"] :is(#summaryScreen,#trackerScreen){isolation:isolate}
 .wto-halloween-layer{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none!important;user-select:none;contain:layout paint}
 .wto-halloween-layer[hidden]{display:none!important}
 .wto-haunt{position:absolute;left:0;top:var(--y,20%);width:var(--size,80px);height:auto;opacity:0;pointer-events:none!important;will-change:transform,opacity;animation:wtoHauntCross var(--duration,11s) linear both}
 .wto-haunt svg{display:block;width:100%;height:auto;overflow:visible;filter:drop-shadow(0 0 3px #a795b855)}
 .wto-haunt-art{display:block;transform:scaleX(var(--facing,1));animation:wtoHauntFloat 2.8s ease-in-out infinite}
 .wto-haunt[data-kind="cat"] svg,.wto-haunt[data-kind="witch"] svg{filter:drop-shadow(0 0 2px #e9ad7577)}
 .wto-haunt[data-kind="cat"] .wto-haunt-art{animation:none;transform:scaleX(var(--facing,1))}
 .wto-haunt[data-kind="spider"]{top:0;animation-name:wtoHauntSpider}
 .wto-haunt[data-kind="spider"] .wto-haunt-art{animation:none}
 .wto-haunt-wing{transform-box:fill-box;transform-origin:center;animation:wtoHauntFlap .38s ease-in-out infinite alternate}
 .wto-haunt-legs{transform-box:fill-box;transform-origin:center;animation:wtoHauntPaws .24s ease-in-out infinite alternate}
 .wto-haunt.still{animation:none;opacity:.28;left:var(--still-x,3%);top:var(--still-y,10%);transform:none;will-change:auto}
 .wto-haunt.still .wto-haunt-art,.wto-haunt.still .wto-haunt-wing,.wto-haunt.still .wto-haunt-legs{animation:none}
 @keyframes wtoHauntCross{0%{opacity:0;transform:translate3d(var(--from),0,0)}8%{opacity:var(--opacity,.45)}50%{opacity:var(--opacity,.45);transform:translate3d(calc((var(--from) + var(--to))/2),var(--drift,12px),0)}92%{opacity:var(--opacity,.45)}100%{opacity:0;transform:translate3d(var(--to),0,0)}}
 @keyframes wtoHauntSpider{0%{opacity:0;transform:translate3d(var(--spider-x),-200px,0)}16%{opacity:.5}45%,65%{opacity:.5;transform:translate3d(var(--spider-x),var(--drop,20px),0)}100%{opacity:0;transform:translate3d(var(--spider-x),-200px,0)}}
 @keyframes wtoHauntFloat{0%,100%{transform:translateY(-6px) scaleX(var(--facing,1)) rotate(-3deg)}50%{transform:translateY(7px) scaleX(var(--facing,1)) rotate(3deg)}}
 @keyframes wtoHauntFlap{from{transform:scaleY(.48)}to{transform:scaleY(1)}}
 @keyframes wtoHauntPaws{from{transform:skewX(-13deg)}to{transform:skewX(13deg)}}
 @media(prefers-reduced-motion:reduce){.wto-haunt,.wto-haunt *{animation:none!important;will-change:auto}}
 `;
 document.head.appendChild(style);
 const art={
  ghost:'<svg viewBox="0 0 100 120"><path fill="#eee9f5" d="M18 109V48a32 32 0 0 1 64 0v61l-13-9-12 10-13-10-13 10-13-1Z"/><ellipse cx="39" cy="49" rx="6" ry="10" fill="#171220"/><ellipse cx="62" cy="49" rx="6" ry="10" fill="#171220"/><ellipse cx="51" cy="73" rx="7" ry="9" fill="#171220"/></svg>',
  bat:'<svg viewBox="0 0 160 90"><g fill="#0b0810" stroke="#a38ea5" stroke-width="1.3"><path class="wto-haunt-wing" d="M78 41Q45 8 3 10l17 25 9-4 5 21 17-5 12 20 17-12Z"/><path class="wto-haunt-wing" d="M82 41q33-33 75-31l-17 25-9-4-5 21-17-5-12 20-17-12Z"/><path d="m69 31-4-17 14 11 15-11-3 18q12 25-11 44-23-19-11-45Z"/></g><circle cx="75" cy="39" r="2" fill="#edbc58"/><circle cx="85" cy="39" r="2" fill="#edbc58"/></svg>',
  spider:'<svg viewBox="0 0 100 200"><path d="M50 0v133" stroke="#c4bdcf" stroke-width="1"/><g fill="none" stroke="#0c0811" stroke-width="4" stroke-linecap="round"><path d="m43 147-20-19-13 10m31 17-24-7-12 16m36-2-22 11-6 17m33-20-14 20 1 9m24-52 20-19 13 10m-31 17 24-7 12 16m-36-2 22 11 6 17m-33-20 14 20-1 9"/></g><ellipse cx="50" cy="161" rx="16" ry="22" fill="#100b18" stroke="#9f809f"/><ellipse cx="50" cy="142" rx="11" ry="10" fill="#100b18"/><circle cx="46" cy="140" r="2" fill="#eeba5e"/><circle cx="54" cy="140" r="2" fill="#eeba5e"/></svg>',
  cat:'<svg viewBox="0 0 180 110"><g fill="#08080b" stroke="#8b6c65" stroke-width="1.2"><path d="M52 77C8 76 8 17 29 17c13 0 14 18 2 22-8 3-9-8-3-8-14 19 4 37 28 34" fill="none" stroke="#08080b" stroke-width="12" stroke-linecap="round"/><ellipse cx="87" cy="69" rx="39" ry="22"/><path class="wto-haunt-legs" d="m61 79-6 25h16l5-23m18 2 5 21h15l-7-27m15-11 12 35h14l-14-48"/><path d="m113 50 1-32 20 15 24-11-5 34q-13 27-40-6Z"/></g><path d="m126 47 6-2m12-1 6 1" stroke="#c1e56a" stroke-width="3"/><path d="m147 58 20-4m-20 7 21 3" stroke="#ab9b95" stroke-width="1.2"/></svg>',
  witch:'<svg viewBox="0 0 180 110"><path d="m12 91 145-19" stroke="#8f613c" stroke-width="5"/><path d="m149 62 28 4-16 10 17 12-31-7Z" fill="#94733d"/><g fill="#0c0912" stroke="#9e7b90" stroke-width="1"><path d="m60 71 20-29 16 7 13 24-18-4-19 20-10-4 13-19Z"/><path d="m88 33 16-1 1 7 10 3-12 4-1 10-18-6Z"/><path d="m66 30 48 1-19-9-8-20-9 24Z"/><path d="m79 54-21 9-19-4-1 6 24 5 24-10Z"/><path d="m91 70 13 15 23-3 1 7-31 3-17-15Z"/></g></svg>'
 };
 const layer=document.createElement('div');layer.id='wtoHalloweenLayer';layer.className='wto-halloween-layer';layer.hidden=true;layer.setAttribute('aria-hidden','true');screens[0].appendChild(layer);
 const motion=matchMedia('(prefers-reduced-motion: reduce)');let timer=null,bag=[],running=false,host=null;const removals=new Map();
 const random=(min,max)=>min+Math.random()*(max-min);
 function clear(){clearTimeout(timer);timer=null;for(const t of removals.values())clearTimeout(t);removals.clear();layer.replaceChildren();running=false;}
 function nextKind(){if(!bag.length){bag=Object.keys(art);for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}return bag.pop();}
 function remove(node){clearTimeout(removals.get(node));removals.delete(node);node.remove();}
 function add(kind,index=0,still=false){
  if(layer.childElementCount>=4)return;
  const node=document.createElement('span');node.className='wto-haunt'+(still?' still':'');node.dataset.kind=kind;node.innerHTML='<span class="wto-haunt-art">'+art[kind]+'</span>';
  const right=Math.random()<.5,size=kind==='witch'?random(100,140):kind==='cat'?random(75,105):kind==='spider'?random(40,56):random(48,83),duration=kind==='bat'?random(7,9):random(11,15);
  const y=kind==='cat'?random(85,91):kind==='witch'?random(10,35):random(13,65);
  const vars={'--size':size+'px','--duration':duration+'s','--from':right?'calc(100vw + 150px)':'-180px','--to':right?'-180px':'calc(100vw + 150px)','--facing':right?-1:1,'--y':`calc(${y}% + ${index*12}px)`,'--drift':random(-24,24)+'px','--opacity':kind==='ghost'?.35:.52,'--spider-x':(Math.random()<.5?random(2,10):random(82,90))+'vw','--drop':random(-30,45)+'px','--still-x':(index===0?2:index===1?83:5)+'%','--still-y':(index===0?3:index===1?30:84)+'%'};
  for(const [key,value] of Object.entries(vars))node.style.setProperty(key,String(value));
  layer.appendChild(node);
  if(!still){node.addEventListener('animationend',event=>{if(event.target===node)remove(node);});removals.set(node,setTimeout(()=>remove(node),(duration+1)*1000));}
 }
 function spawn(){if(!running||document.hidden||document.body.dataset.theme!=='halloween')return;const kind=nextKind();const count=kind==='bat'?Math.min(3,4-layer.childElementCount):1;for(let i=0;i<count;i++)add(kind,i);timer=setTimeout(spawn,random(8000,15000));}
 function sync(){
  const nextHost=screens.find(s=>!s.classList.contains('app-hidden'));
  const active=document.body.dataset.theme==='halloween'&&!document.hidden&&!!nextHost;
  if(!active){clear();layer.hidden=true;host=null;return;}
  if(running&&host===nextHost)return;
  clear();host=nextHost;host.appendChild(layer);layer.hidden=false;running=true;
  if(motion.matches){['spider','ghost','cat'].forEach((kind,i)=>add(kind,i,true));return;}
  timer=setTimeout(spawn,2200);
 }
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-theme']});
 const screenObserver=new MutationObserver(sync);screens.forEach(s=>screenObserver.observe(s,{attributes:true,attributeFilter:['class']}));
 document.addEventListener('visibilitychange',sync);motion.addEventListener('change',()=>{clear();sync();});
 addEventListener('pagehide',()=>{clear();layer.hidden=true;host=null;});addEventListener('pageshow',sync);
 sync();
})();
