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
  async function openBoth(pw, adminOnly){
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
    return {p:JSON.parse(new TextDecoder().decode(pt)),dk:dk};
  }
  async function openPrivate(pw, adminOnly){ return (await openBoth(pw,adminOnly)).p; }

  /* ----- encrypted data files (data/*.enc.json), locked with the settings key that sits inside private.enc.json ----- */
  function b64(u8){ var s='',i; for(i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); }
  async function readData(path, dk){
    var r=await fetch(ROOT+path,{cache:'no-store'}); if(r.status===404) return null; if(!r.ok) throw new Error(path+' could not be loaded ('+r.status+').');
    var j=await r.json(); if(j.v!==1) throw new Error(path+' is in an unknown format.');
    var key=await crypto.subtle.importKey('raw',dk,'AES-GCM',false,['decrypt']), pt;
    try{ pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(j.iv)},key,unb64(j.c)); }catch(e){ throw new Error(path+' could not be opened with this passcode.'); }
    return JSON.parse(new TextDecoder().decode(pt));
  }
  async function sealData(dk, obj){
    var key=await crypto.subtle.importKey('raw',dk,'AES-GCM',false,['encrypt']), iv=crypto.getRandomValues(new Uint8Array(12));
    var ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,enc.encode(JSON.stringify(obj)));
    return JSON.stringify({v:1,iv:b64(iv),c:b64(new Uint8Array(ct))})+'\n';
  }

  /* ----- session: kept for this browser tab only ----- */
  function raw(){ try{ return JSON.parse(sessionStorage.getItem(KEY)||'null'); }catch(e){ return null; } }
  function save(s){ s.at=Date.now(); try{ sessionStorage.setItem(KEY,JSON.stringify(s)); }catch(e){} }
  function lock(){ try{ sessionStorage.removeItem(KEY); sessionStorage.removeItem('pssp-dts-admin'); }catch(e){} }
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
  /* Called the moment a test is started. The page keeps working with what it already holds, but the unlock is wiped from this tab, so a refresh or a new visit needs the evaluator to log in again. No test can be redone on the spot. */
  function begin(){ try{ sessionStorage.removeItem(KEY); }catch(e){} }
  /* any click or key press on a page that loads this file counts as activity */
  var lastTouch=0;
  function touch(){ var now=Date.now(); if(now-lastTouch<30000) return; lastTouch=now; var s=session(); if(s) save(s); var a=araw(); if(a&&Date.now()-(a.at||0)<=TIMEOUT_MIN*60000) asave(a); }
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

  /* ----- admin session: one sign-in for every setup page, kept for this browser tab only ----- */
  var AKEY='pssp-dts-admin';
  function araw(){ try{ return JSON.parse(sessionStorage.getItem(AKEY)||'null'); }catch(e){ return null; } }
  function asave(s){ s.at=Date.now(); try{ sessionStorage.setItem(AKEY,JSON.stringify(s)); }catch(e){} }
  function adminLock(){ try{ sessionStorage.removeItem(AKEY); }catch(e){} }
  function adminSession(){ var s=araw(); if(!s) return null; if(Date.now()-(s.at||0)>TIMEOUT_MIN*60000){ adminLock(); return null; } return s; }
  function cleanName(n){ return String(n||'').trim().replace(/\s+/g,' '); }
  function cleanSp(n){ return String(n||'').trim().replace(/^sp[\s#.\-]*/i,''); }
  async function adminSignIn(pw,name,sp){
    name=cleanName(name); sp=cleanSp(sp);
    if(name.split(' ').length<2) throw new Error('Enter your full name (first and last).');
    if(!/^[0-9]+$/.test(sp)) throw new Error('Enter your SP number (digits only).');
    var o=await openBoth(pw,true);
    if(Array.isArray(o.p.admins)&&o.p.admins.indexOf(+sp)<0) throw new Error('SP '+sp+' is not on the admin list.');
    asave({pw:pw.trim(),name:name,sp:sp}); o.name=name; o.sp=sp; o.who=name+', SP '+sp; return o;
  }
  async function adminOpen(){
    var s=adminSession(); if(!s) return null;
    try{ var o=await openBoth(s.pw,true); o.name=s.name; o.sp=s.sp; o.who=s.name+', SP '+s.sp; asave(s); return o; }catch(e){ adminLock(); return null; }
  }
  /* Puts the admin sign-in form into a <section> and calls ready(ctx) once an admin is in. Already signed in: no form. */
  /* The sign-in form lives only on the admin hub (opts.login). Every other admin page sends you there and brings you back after. */
  function nextPath(){ var q=(location.search.match(/[?&]next=([^&]*)/)||[])[1]; if(!q) return ''; try{ q=decodeURIComponent(q); }catch(e){ return ''; } return /^[A-Za-z0-9_\-\/.]+\.html$|^[A-Za-z0-9_\-\/]+\/$/.test(q)&&q.indexOf('..')<0&&q.charAt(0)!=='/'?q:''; }
  function adminGate(sec, ready, opts){
    opts=opts||{};
    function go(ctx){ sec.hidden=true; ready(ctx); }
    adminOpen().then(function(o){ if(o) return go(o);
      if(!opts.login){ var rel=location.href.slice(ROOT.length).split(/[?#]/)[0]; if(rel&&rel.slice(-1)!=='/'&&!/\.html$/.test(rel)) rel+='.html'; location.replace(ROOT+'admin/'+(rel?'?next='+encodeURIComponent(rel):'')); return; }
      sec.hidden=false;
      sec.innerHTML='<h2>Admin sign-in</h2><p>Enter the admin passcode, your full name and your SP number. Your name and SP number are recorded with every save. You sign in once for all setup pages.</p>'
        +'<form autocomplete="off" style="display:flex;flex-direction:column;gap:14px"><div><label for="agP">Admin passcode</label><input type="password" id="agP" autocomplete="current-password"></div>'
        +'<div class="row"><div class="grow"><label for="agN">Full name</label><input type="text" id="agN" autocomplete="off" placeholder="First and last name"></div>'
        +'<div class="grow"><label for="agS">SP number</label><input type="text" id="agS" autocomplete="off" inputmode="numeric" placeholder="Your SP number"></div></div>'
        +'<p class="err" role="alert"></p><div class="row"><button type="submit">Sign in</button><a class="btn alt" href="'+ROOT+'">Home</a></div></form>';
      var f=sec.querySelector('form'), er=sec.querySelector('.err'), b=sec.querySelector('button[type=submit]');
      f.addEventListener('submit',function(e){ e.preventDefault(); er.textContent='Signing in…'; b.disabled=true;
        adminSignIn(sec.querySelector('#agP').value,sec.querySelector('#agN').value,sec.querySelector('#agS').value).then(function(o){ go(o); }).catch(function(x){ er.textContent=(x&&x.message)||String(x); b.disabled=false; });
      });
    });
  }
  /* Saves a text file to the repo with the autosave token; with no token, downloads it for the admin to upload. Returns a sentence to show. */
  async function saveFile(ctx, path, text, msg){
    var gh=ctx&&ctx.p&&ctx.p.gh;
    if(gh&&gh.token){ await ghPut(gh,path,text,msg+' ('+ctx.who+')'); return 'Saved'+(isDev?' to the dev branch':'')+'. Pages pick it up within a minute or two.'; }
    var u=URL.createObjectURL(new Blob([text],{type:'application/json'})), a=document.createElement('a'); a.href=u; a.download=path.split('/').pop(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(u);},4000);
    return 'Autosave is off, so the file was downloaded. Upload '+a.download+' to the '+path.split('/').slice(0,-1).join('/')+' folder in the repository.';
  }

  window.DTS={nextPath:nextPath,ROOT:ROOT,isDev:isDev,TIMEOUT_MIN:TIMEOUT_MIN,openPrivate:openPrivate,openBoth:openBoth,readData:readData,sealData:sealData,adminSession:adminSession,adminSignIn:adminSignIn,adminOpen:adminOpen,adminLock:adminLock,adminGate:adminGate,saveFile:saveFile,session:session,begin:begin,unlock:unlock,lock:lock,setTaker:setTaker,ghPut:ghPut};

  /* a small banner so nobody mistakes a preview copy for the live site */
  if(isDev){ document.addEventListener('DOMContentLoaded',function(){ var b=document.createElement('div'); b.textContent='Preview copy (dev). Not the live testing site.'; b.style.cssText='position:fixed;left:0;bottom:0;z-index:99999;background:#8A6410;color:#fff;font:600 11px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;padding:3px 10px'; b.className='noprint'; document.body.appendChild(b); }); }
})();
