/* Reads the text of a .docx in the browser (no libraries). window.PSSPDocx.read(file) -> {paras:[{text,heading}]}; sentences(paras) -> [{section,sentence}] */
(function(){
  function u16(b,o){ return b[o]|(b[o+1]<<8); }
  function u32(b,o){ return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0; }
  async function inflate(data){
    var s=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function entry(buf, name){
    var b=new Uint8Array(buf), i=b.length-22;
    while(i>=0&&u32(b,i)!==0x06054b50) i--;
    if(i<0) throw new Error('This does not look like a Word (.docx) file.');
    var n=u16(b,i+10), p=u32(b,i+16);
    for(var k=0;k<n;k++){
      if(u32(b,p)!==0x02014b50) break;
      var method=u16(b,p+10), csize=u32(b,p+20), nl=u16(b,p+28), el=u16(b,p+30), cl=u16(b,p+32), lo=u32(b,p+42);
      var nm=new TextDecoder().decode(b.subarray(p+46,p+46+nl));
      if(nm===name){
        var lnl=u16(b,lo+26), lel=u16(b,lo+28), ds=lo+30+lnl+lel, raw=b.subarray(ds,ds+csize);
        if(method===0) return raw; if(method===8) return inflate(raw);
        throw new Error('Unsupported compression in the .docx.');
      }
      p+=46+nl+el+cl;
    }
    return null;
  }
  async function read(file){
    var buf=await file.arrayBuffer(), xml=await entry(buf,'word/document.xml');
    if(!xml) throw new Error('word/document.xml was not found. Is this a Word (.docx) file?');
    var doc=new DOMParser().parseFromString(new TextDecoder().decode(xml),'application/xml');
    if(doc.getElementsByTagName('parsererror').length) throw new Error('The document could not be read.');
    var out=[], ps=doc.getElementsByTagName('w:p');
    for(var i=0;i<ps.length;i++){
      var p=ps[i], txt='', heading=false, st=p.getElementsByTagName('w:pStyle')[0];
      if(st){ var v=st.getAttribute('w:val')||''; heading=/^(heading|title)/i.test(v); }
      var kids=p.getElementsByTagName('*');
      for(var k=0;k<kids.length;k++){
        var t=kids[k].tagName;
        if(t==='w:t') txt+=kids[k].textContent; else if(t==='w:tab') txt+=' '; else if(t==='w:br') txt+=' ';
      }
      txt=txt.replace(/\s+/g,' ').trim(); if(txt) out.push({text:txt,heading:heading});
    }
    return {paras:out};
  }
  /* Splits paragraphs into sentences, remembering the nearest heading above each. */
  function sentences(paras){
    var res=[], sec='';
    paras.forEach(function(p){
      if(p.heading||(p.text.length<60&&!/[.!?]$/.test(p.text)&&/^[A-Z0-9]/.test(p.text)&&p.text.split(' ').length<=8&&!/\d/.test(p.text.slice(-1)))){ sec=p.text; return; }
      p.text.replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/).forEach(function(s){ s=s.trim(); if(s.length>=20) res.push({section:sec,sentence:s}); });
    });
    return res;
  }
  window.PSSPDocx={read:read,sentences:sentences};
})();
