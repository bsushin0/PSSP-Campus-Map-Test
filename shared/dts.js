/* PSSP Digital Testing Site: shared unlock, session and helper code.
   Loaded by the home page and by every test page. No passwords or answers live in this file. */
(function(){
  'use strict';
  var ROOT = new URL('..', document.currentScript.src).href;      /* site root, e.g. https://bsushin0.github.io/pssp-dts/ */
  var KEY = 'pssp-dts';
  var TIMEOUT_MIN = 60;                                            /* the unlock ends after this many minutes with no activity */
  var LIVE_HOST = 'bsushin0.github.io';
  var isDev = location.hostname !== LIVE_HOST;                     /* any other address is a preview copy */
  var enc = new TextEncoder();

  function unb64(s){ var b=atob(s), u=new Uint8Array(b.length); for(var i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; }
  async function kek(pw,salt,iter){
    var base=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:salt,iterations:iter},base,{name:'AES-GCM',length:256},false,['decrypt']);
  }
  /* Opens data/private.enc.json with the test passcode or the admin passcode (same check the map test does).
     adminOnly: accept the admin passcode only. Returns the decrypted settings. */
  async function openPrivate(pw, adminOnly){
    if(!(window.crypto&&crypto.subtle)) throw new Error('Use Edge or Chrome over https.');
    var r=await fetch(ROOT+'data/private.enc.json',{cache:'no-store'}); if(!r.ok) throw new Error('data/private.enc.json was not found.');
    var j=await r.json(); if(j.v!==4) throw new Error('private.enc.json is from an older setup. Make a new one with vault-setup.html.');
    var dk=null, names=adminOnly?['a']:['t','a'];
    for(var n=0;n<names.length&&!dk;n++){
      var w=j.wk[names[n]]; if(!w) continue;
      try{ dk=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(w.iv)},await kek(names[n]==='a'?pw.trim():pw,unb64(w.salt),w.iter),unb64(w.c)); }catch(e){}
    }
    if(!dk) throw new Error(adminOnly?'Wrong admin passcode.':'Wrong passcode.');
    var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(j.iv)},await crypto.subtle.importKey('raw',dk,'AES-GCM',false,['decrypt']),unb64(j.c));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  /* ----- session: kept for this browser tab only ----- */
  function raw(){ try{ return JSON.parse(sessionStorage.getItem(KEY)||'null'); }catch(e){ return null; } }
  function save(s){ s.at=Date.now(); try{ sessionStorage.setItem(KEY,JSON.stringify(s)); }catch(e){} }
  function lock(){ try{ sessionStorage.removeItem(KEY); }catch(e){} }
  function session(){
    var s=raw(); if(!s) return null;
    if(Date.now()-(s.at||0) > TIMEOUT_MIN*60000){ lock(); return null; }
    return s;
  }
  async function unlock(pw, evName, evSp){
    evName=String(evName||'').trim().replace(/\s+/g,' '); evSp=String(evSp||'').trim().replace(/^sp[\s#.\-]*/i,'');
    if(evName.split(' ').length<2) throw new Error('Enter the evaluator full name (first and last).');
    if(!/^[0-9]+$/.test(evSp)) throw new Error('Enter the evaluator SP number (digits only).');
    await openPrivate(pw,false);
    save({pw:pw, evName:evName, evSp:evSp, taker:null});
  }
  function setTaker(name, sp){
    var s=session(); if(!s) return false;
    name=String(name||'').trim().replace(/\s+/g,' '); sp=String(sp||'').trim().replace(/^sp[\s#.\-]*/i,'');
    s.taker=(name||sp)?{name:name,sp:sp}:null; save(s); return true;
  }
  /* any click or key press on a page that loads this file counts as activity */
  var lastTouch=0;
  function touch(){ var now=Date.now(); if(now-lastTouch<30000) return; lastTouch=now; var s=session(); if(s) save(s); }
  ['click','keydown'].forEach(function(ev){ document.addEventListener(ev,touch,true); });

  /* Saves a file to the repository with the autosave token from the settings (admin pages only). */
  async function ghPut(gh, path, text, msg){
    var br=isDev?'dev':(gh.branch||'main'), url='https://api.github.com/repos/'+gh.repo+'/contents/'+path;
    var H={Authorization:'Bearer '+gh.token,Accept:'application/vnd.github+json'};
    for(var k=0;k<3;k++){
      var sha, r0=await fetch(url+'?ref='+br,{headers:H,cache:'no-store'});
      if(r0.ok) sha=(await r0.json()).sha; else if(r0.status!==404) throw new Error('GitHub answered '+r0.status);
      var body={message:msg,content:btoa(unescape(encodeURIComponent(text))),branch:br}; if(sha) body.sha=sha;
      var r=await fetch(url,{method:'PUT',headers:Object.assign({'Content-Type':'application/json'},H),body:JSON.stringify(body)});
      if(r.ok) return;
      if(r.status!==409&&r.status!==422) throw new Error('GitHub answered '+r.status);
    }
    throw new Error('Could not save after 3 tries.');
  }

  window.DTS={ROOT:ROOT,isDev:isDev,TIMEOUT_MIN:TIMEOUT_MIN,openPrivate:openPrivate,session:session,unlock:unlock,lock:lock,setTaker:setTaker,ghPut:ghPut};

  /* a small banner so nobody mistakes a preview copy for the live site */
  if(isDev){ document.addEventListener('DOMContentLoaded',function(){ var b=document.createElement('div'); b.textContent='Preview copy (dev). Not the live testing site.'; b.style.cssText='position:fixed;left:0;bottom:0;z-index:99999;background:#8A6410;color:#fff;font:600 11px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;padding:3px 10px'; b.className='noprint'; document.body.appendChild(b); }); }
})();
