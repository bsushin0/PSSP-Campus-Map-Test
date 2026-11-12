/* Saves a finished test to the encrypted results vault (database/ folder), the same way the Campus Map Test does.
   window.PSSPVault.save(rec, gh) -> Promise<string message>. Records need an id. Saving the same id again replaces the file (used after admin review). */
(function(){
  var KEY=null;
  function b64(buf){ var u=new Uint8Array(buf), s='', i; for(i=0;i<u.length;i+=8192) s+=String.fromCharCode.apply(null,u.subarray(i,i+8192)); return btoa(s); }
  async function pub(){
    if(KEY) return KEY;
    var r=await fetch(DTS.ROOT+'data/vault-key.json',{cache:'no-store'}); if(!r.ok) throw new Error('vault-key.json was not found');
    var j=await r.json(); KEY=await crypto.subtle.importKey('jwk',j.pub,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']); return KEY;
  }
  async function seal(rec){
    var key=await pub(), aes=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']), iv=crypto.getRandomValues(new Uint8Array(12));
    var ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},aes,new TextEncoder().encode(JSON.stringify(rec)));
    var wk=await crypto.subtle.encrypt({name:'RSA-OAEP'},key,await crypto.subtle.exportKey('raw',aes));
    return JSON.stringify({v:1,k:b64(wk),iv:b64(iv),c:b64(ct)});
  }
  async function fname(rec){
    var h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('pssp-rec:'+rec.id));
    return Array.prototype.slice.call(new Uint8Array(h),0,8).map(function(x){return x.toString(16).padStart(2,'0');}).join('')+'.enc.json';
  }
  var Q=Promise.resolve();
  function save(rec, gh){
    var run=Q.then(async function(){
      var t=await seal(rec), n=await fname(rec);
      if(gh&&gh.token){ await DTS.ghPut(gh,'database/'+n,t,'Save '+String(rec.test||'').toUpperCase()+' result '+n.slice(0,8)); return 'Saved to the results vault.'; }
      var u=URL.createObjectURL(new Blob([t],{type:'application/json'})), a=document.createElement('a'); a.href=u; a.download=n; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(u);},4000);
      return 'Autosave is off, so the encrypted result was downloaded as '+n+'. Add it to the database folder in the repository.';
    });
    Q=run.catch(function(){});
    return run;
  }
  window.PSSPVault={save:save};
})();
