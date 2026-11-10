/* PSSP Digital Testing Site: how a typed radio-code answer is judged. Used by the test and by practice. */
(function(){
  function norm(s){ return String(s||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9 ]+/g,' ').replace(/\b(the|a|an)\b/g,' ').replace(/\s+/g,' ').trim(); }
  function lev(a,b){ var m=a.length,n=b.length,d=[],i,j; for(i=0;i<=m;i++){d[i]=[i];} for(j=1;j<=n;j++){d[0][j]=j;}
    for(i=1;i<=m;i++) for(j=1;j<=n;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[m][n]; }
  function isRight(item,given){
    var g=norm(given); if(!g) return false;
    var opts=[item.a].concat(item.alt||[]).map(norm).filter(Boolean);
    var neg=function(s){ return /\b(not|no|isn t|never)\b/.test(s); };
    for(var i=0;i<opts.length;i++){ var o=opts[i];
      if(g===o) return true;
      if(neg(g)!==neg(o)) continue;
      if(o.length>=5 && lev(g,o)<=Math.floor(o.length*0.15)) return true;
      if(o.length>=6 && (' '+g+' ').indexOf(' '+o+' ')>=0) return true;
    }
    return false;
  }
  function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  async function load(root){ var r=await fetch(root+'data/codes.json',{cache:'no-store'}); if(!r.ok) throw new Error('data/codes.json was not found.'); var j=await r.json(); if(!j||!Array.isArray(j.items)||!j.items.length) throw new Error('The codes list is empty.'); return j; }
  window.CODES={isRight:isRight,shuffle:shuffle,load:load};
})();
