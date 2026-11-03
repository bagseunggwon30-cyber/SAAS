/* ===================================================================== 래더 시뮬레이터 (anim kind: ladder)
   build.mjs 가 엔진 클로저 안, `const ANIM_KINDS={` 바로 앞에 끼워 넣는다. (s, Pen, anLab, anHit, nz, clamp, reduced, simPopXY 등 엔진 도우미 사용)

   강의 대본 형식:
   {"t":"anim","kind":"ladder","id":"LD1","x":150,"y":170,"w":800,
    "rows":[ [요소, 요소, ..., 출력요소], ... ]   // 최대 8줄
    "pb":["P0000"],            // 누르는 동안만 ON (푸시버튼). 없으면 눌러서 켜고/끄기(토글)
    "init":{"P0001":1},        // 처음 상태 (NC 정지버튼처럼 평소 ON 인 입력)
    "names":{"P0000":"기동"},  // 디바이스 설명(접점 아래 작은 글씨)
    "scan":"slow",             // 처음부터 천천히 스캔 보기
    "chart":["P0000","T0000"], // 타임차트 (최대 4개)
    "monitor":false,           // 아래 디바이스 모니터 숨김
    "rh":70}                   // 줄 높이
   요소: {"k":"a"|"b"|"p"|"n","l":"P0000","or":"P0020" 또는 {요소}}
         {"k":"cmp","op":">=","s1":"D0000","s2":"3"}
   출력: {"k":"coil"|"set"|"rst","l":"P0020"} {"k":"ton"|"tof","l":"T0000","v":30}(0.1초 단위)
         {"k":"ctu","l":"C0000","v":5} {"k":"mov","s":"1","d":"D0000"}
   act: {"t":"act","id":"LD1","do":"press"|"release"|"tap"|"on"|"off"|"toggle"|"slow"|"fast"|"reset","value":"P0000"}
*/
const LAD={timer:0,list:new Set(),blur:false};
const LAD_OUT=new Set(['coil','set','rst','ton','tof','ctu','mov','calc','inc','dec','tmr','bsft']);
const LAD_CON=new Set(['a','b','p','n','cmp']);
const LAD_BOX=new Set(['ton','tof','ctu','mov','calc','inc','dec','tmr','bsft']);
const LAD_CMP=['=','<>','>','<','>=','<='];
const LAD_GREEN='#1f9d55';
function ladTickAll(){
  if(document.hidden)return;
  const now=performance.now();
  LAD.list.forEach(a=>{
    if(!ANIMS.has(a)){LAD.list.delete(a);return;}
    try{a.tick(now);}catch(e){console.warn('ladder 오류',e);LAD.list.delete(a);}
  });
  if(!LAD.list.size){clearInterval(LAD.timer);LAD.timer=0;}
}
function ladStart(a){
  LAD.list.add(a);
  if(!LAD.timer)LAD.timer=setInterval(ladTickAll,40);
  if(!LAD.blur){LAD.blur=true;const rel=()=>LAD.list.forEach(x=>x.releaseAll&&x.releaseAll());window.addEventListener('blur',rel);document.addEventListener('visibilitychange',()=>{if(document.hidden)rel();});}
}
function ladEl(e,depth){
  if(typeof e==='string')e={k:'a',l:e};
  if(!e||typeof e!=='object')return null;
  let k=String(e.k||'a').toLowerCase();
  if(!LAD_OUT.has(k)&&!LAD_CON.has(k))k='a';
  const str=(v,n)=>v==null?'':String(v).trim().slice(0,n||10);
  const o={k,l:str(e.l,10)};
  if(k==='mov'){o.s=str(e.s,8)||'0';o.l=str(e.d||e.l,10);o.p=!!e.p;}
  if(k==='calc'){const up=String(e.op||'ADD').toUpperCase();o.op=['ADD','SUB','MUL','DIV'].indexOf(up)>=0?up:'ADD';o.s1=str(e.s1,8)||'0';o.s2=str(e.s2,8)||'0';o.l=str(e.d||e.l,10);o.p=!!e.p;}
  if(k==='inc'||k==='dec')o.p=!!e.p;
  if(k==='bsft'){o.s=str(e.s,10);o.e=str(e.e,10);o.l=o.s;o.bits=ladRange(o.s,o.e);o.p=!!e.p;}
  if(k==='cmp'){o.op=LAD_CMP.indexOf(e.op)>=0?e.op:'=';o.s1=str(e.s1,8);o.s2=str(e.s2,8);o.l='';}
  if(k==='ton'||k==='tof'||k==='ctu'||k==='tmr')o.v=clamp(Math.round(nz(e.v,10)),1,99999);
  if(LAD_CON.has(k)&&!depth&&e.or!=null&&e.or!==''){const r=ladEl(e.or,1);if(r&&LAD_CON.has(r.k))o.or=r;}
  return o;
}
const ladIsNum=x=>/^-?\d+$/.test(String(x));
const ladW16=v=>((v+32768)%65536+65536)%65536-32768; // 16비트 부호 있는 정수로 넘침
const ladSys=n=>typeof n==='string'&&n.charAt(0)==='_'; // _ON 같은 시스템 플래그(상시 ON)
function ladRange(s,e){ // M0000~M0007 → 비트 목록 (같은 워드 안, 마지막 자리 16진)
  const re=/^([A-Z]+)(\d{3})([0-9A-F])$/i,m1=re.exec(s||''),m2=re.exec(e||'');
  if(!m1||!m2||m1[1].toUpperCase()!==m2[1].toUpperCase()||m1[2]!==m2[2])return [s];
  const p=parseInt(m1[3],16),q=parseInt(m2[3],16);if(q<p)return [s];
  const out=[];for(let i=p;i<=q;i++)out.push(m1[1].toUpperCase()+m1[2]+i.toString(16).toUpperCase());return out;
}
const ladFmtT=ms=>(Math.round(ms/100)/10).toFixed(1);

function LADDER_ANIM(a,op){
  const legacy=!!op.legacy;
  const x0=nz(op.x,150),y0=nz(op.y,150),W=clamp(nz(op.w,700),300,1100);
  const RH=clamp(nz(op.rh,80),56,120);
  const rowsIn=(Array.isArray(op.rows)?op.rows:[]).slice(0,8).filter(Array.isArray);
  if(!rowsIn.length)throw new Error('ladder rows');
  a.sc=1;a.cx=x0+W/2;a.cy=y0;
  const names=(op.names&&typeof op.names==='object')?op.names:{};
  /* ----- 줄 정리 ----- */
  const rows=rowsIn.map(r=>{
    const els=r.map(e=>ladEl(e)).filter(Boolean);
    const cons=els.filter(e=>LAD_CON.has(e.k)).slice(0,6);
    const out=els.find(e=>LAD_OUT.has(e.k))||null;
    return {cons,out,pw:[],pow:0};
  });
  /* ----- 디바이스 분류 ----- */
  a.dv={};a.T={};a.C={};a.ext={};a.ph={};a.pv={};
  const written=new Set(),used=[],seen=new Set(),words=new Set(),wWritten=new Set();
  const use=n=>{if(n&&!ladIsNum(n)&&!seen.has(n)){seen.add(n);used.push(n);}};
  rows.forEach(r=>{
    r.cons.forEach(e=>{[e,e.or].forEach(c=>{if(!c)return;if(c.k==='cmp'){use(c.s1);use(c.s2);[c.s1,c.s2].forEach(v=>{if(v&&!ladIsNum(v))words.add(v);});}else use(c.l);});});
    const o=r.out;if(!o)return;
    use(o.l);
    if(o.k==='ton'||o.k==='tof'){if(!a.T[o.l])a.T[o.l]={acc:0,done:0,pre:o.v,k:o.k};}
    else if(o.k==='ctu'){if(!a.C[o.l])a.C[o.l]={cur:0,done:0,pre:o.v};}
    else if(o.k==='mov'){words.add(o.l);wWritten.add(o.l);if(o.s&&!ladIsNum(o.s)){use(o.s);words.add(o.s);}}
    else if(o.k==='calc'){words.add(o.l);wWritten.add(o.l);[o.s1,o.s2].forEach(v=>{if(v&&!ladIsNum(v)){use(v);words.add(v);}});}
    else if(o.k==='inc'||o.k==='dec'){words.add(o.l);wWritten.add(o.l);}
    else if(o.k==='tmr'){if(!a.T[o.l])a.T[o.l]={acc:0,done:0,pre:o.v,k:'tmr'};}
    else if(o.k==='bsft'){o.bits.forEach(b=>{use(b);written.add(b);});}
    if(o.k!=='rst')written.add(o.l);
  });
  rows.forEach(r=>{const o=r.out;if(o&&o.k==='rst'&&!a.T[o.l]&&!a.C[o.l]&&!words.has(o.l))written.add(o.l);});
  used.forEach(n=>{if(/^D\d/i.test(n))words.add(n);});
  const isTC=n=>!!(a.T[n]||a.C[n]);
  const inputs=used.filter(n=>!written.has(n)&&!isTC(n)&&!words.has(n)&&!ladSys(n));
  const ain=(op.ain&&typeof op.ain==='object')?op.ain:{};
  const ainList=Object.keys(ain).filter(n=>seen.has(n)&&!wWritten.has(n));a.wext={};
  const inSet=new Set(inputs);
  const init=(op.init&&typeof op.init==='object')?op.init:{};
  const pbList=Array.isArray(op.pb)?op.pb.map(String):null;
  const momentary=n=>pbList?pbList.indexOf(n)>=0:(legacy&&!/THR|LS|SEN|센서|리밋|T\d/i.test(n));
  a.reset=()=>{
    used.forEach(n=>{a.dv[n]=0;a.pv[n]=0;a.ph[n]=0;});
    for(const n in a.T){a.T[n].acc=0;a.T[n].done=0;}
    for(const n in a.C){a.C[n].cur=0;a.C[n].done=0;}
    rows.forEach(r=>{if(r.out)r.out.pp=0;});
    inputs.forEach(n=>{a.ext[n]=init[n]?1:0;a.dv[n]=a.ext[n];a.pv[n]=a.ext[n];});
    for(const n in init){if(!inSet.has(n)&&!isTC(n)){a.dv[n]=Number(init[n])||0;a.ph[n]=a.dv[n]?1:0;}}
    used.forEach(n=>{if(ladSys(n)){a.dv[n]=1;a.pv[n]=1;}});
    ainList.forEach(n=>{const c=ain[n]||{};a.wext[n]=clamp(Math.round(nz(c.init,nz(c.min,0))),nz(c.min,-32768),nz(c.max,32767));a.dv[n]=a.wext[n];});
    a.err=0;
    a.pressed={};a.flash={};a.hist=[];a.histT=0;a.relQ={};a.pressRead={};a.readNo=a.readNo||0;
  };
  a.reset();
  /* ----- 값 읽기 ----- */
  a.bit=n=>{if(ladSys(n))return 1;const T=a.T[n];if(T)return T.done?1:0;const C=a.C[n];if(C)return C.done?1:0;return a.dv[n]?1:0;};
  a.word=n=>{if(ladIsNum(n))return parseInt(n,10);const T=a.T[n];if(T)return Math.floor(T.acc/100);const C=a.C[n];if(C)return C.cur;return a.dv[n]|0;};
  const evalCon=c=>{
    switch(c.k){
      case 'a':return a.bit(c.l);
      case 'b':return a.bit(c.l)?0:1;
      case 'p':return a.bit(c.l)&&!a.pv[c.l]?1:0;
      case 'n':return !a.bit(c.l)&&a.pv[c.l]?1:0;
      case 'cmp':{const p=a.word(c.s1),q=a.word(c.s2);
        switch(c.op){case '=':return p===q?1:0;case '<>':return p!==q?1:0;case '>':return p>q?1:0;case '<':return p<q?1:0;case '>=':return p>=q?1:0;default:return p<=q?1:0;}}
    }
    return 0;
  };
  const coilRuns={};rows.forEach(r=>{if(r.out&&r.out.k==='coil')coilRuns[r.out.l]=(coilRuns[r.out.l]||0)+1;});
  a.runRung=(r,dt,now)=>{
    let p=1;r.pw=[];
    r.cons.forEach(c=>{
      const m=evalCon(c),o=c.or?evalCon(c.or):0;
      c.st=m;if(c.or)c.or.st=o;
      if(m&&(c.k==='p'||c.k==='n'))a.flash[c.l+c.k]=now;
      if(o&&c.or&&(c.or.k==='p'||c.or.k==='n'))a.flash[c.or.l+c.or.k]=now;
      p=p&&(m||o)?1:0;r.pw.push(p);
    });
    r.pow=p;
    const o=r.out;if(!o)return;
    switch(o.k){
      case 'coil':a.dv[o.l]=p;break;
      case 'set':if(p)a.dv[o.l]=1;break;
      case 'rst':if(p){const T=a.T[o.l],C=a.C[o.l];if(T){T.acc=0;T.done=0;}else if(C){C.cur=0;C.done=0;}else a.dv[o.l]=0;}break;
      case 'ton':{const T=a.T[o.l],pt=o.v*100;if(p){T.acc=Math.min(T.acc+dt,pt);T.done=T.acc>=pt?1:0;}else{T.acc=0;T.done=0;}break;}
      case 'tof':{const T=a.T[o.l],pt=o.v*100;if(p){T.done=1;T.acc=0;T.run=0;}else if(T.done){T.run=1;T.acc=Math.min(T.acc+dt,pt);if(T.acc>=pt){T.done=0;T.run=0;}}else T.run=0;break;}
      case 'ctu':{const C=a.C[o.l];if(p&&!o.pp)C.cur=Math.min(C.cur+1,99999);C.done=C.cur>=o.v?1:0;o.pp=p;break;}
      case 'mov':if(o.p?(p&&!o.pp):p)a.dv[o.l]=a.word(o.s);o.pp=p;break;
      case 'calc':if(o.p?(p&&!o.pp):p){const x=a.word(o.s1),y=a.word(o.s2);let v=null;
        if(o.op==='ADD')v=ladW16(x+y);else if(o.op==='SUB')v=ladW16(x-y);else if(o.op==='MUL')v=x*y;
        else if(y!==0)v=Math.trunc(x/y);else if(!a.err){a.err=1;pop('÷0 : 연산 에러(_ERR) — 결과를 안 써요');}
        if(v!==null)a.dv[o.l]=v;}o.pp=p;break;
      case 'inc':case 'dec':if(o.p?(p&&!o.pp):p)a.dv[o.l]=ladW16((a.dv[o.l]|0)+(o.k==='inc'?1:-1));o.pp=p;break;
      case 'tmr':{const T=a.T[o.l],pt=o.v*100;if(p)T.acc=Math.min(T.acc+dt,pt);T.done=T.acc>=pt?1:0;break;}
      case 'bsft':if(o.p?(p&&!o.pp):p){const b=o.bits;for(let i=b.length-1;i>0;i--)a.dv[b[i]]=a.dv[b[i-1]]?1:0;a.dv[b[0]]=0;}o.pp=p;break;
    }
  };
  // 짧은 탭도 최소 한 번은 읽히게: 누른 뒤 아직 입력 읽기가 없었으면 떼기를 다음 읽기 뒤로 미룬다
  const readInputs=()=>{inputs.forEach(n=>{a.dv[n]=a.ext[n]?1:0;if(a.relQ[n]){a.relQ[n]=0;a.ext[n]=init[n]?1:0;}});ainList.forEach(n=>{a.dv[n]=a.wext[n];});a.readNo++;};
  const writeOutputs=()=>{written.forEach(n=>{a.ph[n]=a.bit(n);});used.forEach(n=>{a.pv[n]=a.bit(n);});};
  /* ----- 스캔 ----- */
  a.slow=op.scan==='slow';a.last=performance.now();a.scanT0=a.last;
  a.phase={k:'in',i:-1,t0:a.last};a.scanNo=0;
  const SLOW={in:900,rung:760,out:900};
  const phaseDur=k=>SLOW[k]/Math.max(.25,speed);
  a.scanFast=(dt,now)=>{readInputs();rows.forEach(r=>a.runRung(r,dt,now));writeOutputs();a.scanNo++;};
  a.enterPhase=(k,i,now)=>{
    a.phase={k,i,t0:now};
    if(k==='in'){a.dtScan=Math.min(8000,now-a.scanT0);a.scanT0=now;readInputs();}
    else if(k==='rung')a.runRung(rows[i],a.dtScan,now);
    else if(k==='out'){writeOutputs();a.scanNo++;}
  };
  a.tick=now=>{
    if(!a.slow){const dt=Math.min(250,Math.max(0,now-a.last));a.last=now;a.scanFast(dt,now);}
    else{
      a.last=now;
      if(now-a.phase.t0>=phaseDur(a.phase.k==='rung'?'rung':a.phase.k)){
        const ph=a.phase;
        if(ph.k==='in')a.enterPhase('rung',0,now);
        else if(ph.k==='rung')ph.i+1<rows.length?a.enterPhase('rung',ph.i+1,now):a.enterPhase('out',-1,now);
        else a.enterPhase('in',-1,now);
      }
    }
    if(chartSigs.length&&now-a.histT>=100){a.histT=now;a.hist.push(chartSigs.map(n=>a.sig(n)));if(a.hist.length>CH_N)a.hist.shift();}
    a.draw(now);
  };
  a.sig=n=>inSet.has(n)?(a.ext[n]?1:0):written.has(n)&&!isTC(n)?a.ph[n]:a.bit(n);
  a.setSlow=v=>{
    v=!!v;if(v===a.slow)return;a.slow=v;const now=performance.now();a.last=now;a.scanT0=now;
    if(v){a.enterPhase('in',-1,now);if(a.sh)animPop(a,'🐢 스캔을 천천히 보여 줘요');}
    else if(a.sh)animPop(a,'⚡ 실제 PLC처럼 빠르게 스캔');
  };

  /* ===================== 그리기 ===================== */
  const gCur=s('g');const gS=s('g');const gHL=s('g');const gF=s('g');const gT=s('g');const gUI=s('g');const gH=s('g');
  a.g.append(gCur,gS,gHL,gF,gT,gUI,gH);
  const pen=new Pen(gS,hashSeed(a.id+'lad'));
  const pop=t=>{if(a.sh)animPop(a,t);};
  const col=INK.pencil,lo={stroke:col,roughness:.6};
  const P=(o)=>Object.assign({},lo,o);
  const segs=[]; // {el,el2,fn}
  const seg=(pts,fn)=>{
    const d=polyD(pts);
    pen.path(d,P({strokeWidth:2.4}));
    const g1=s('path',{d,class:'lad-glow'}),g2=s('path',{d,class:'lad-flow'+(reduced()?' static':'')});
    gF.append(g1,g2);segs.push({g1,g2,fn,on:-1});
  };
  const lab=(x,y,str,fs,fill,anchor,cls)=>{const t=s('text',{x:f1(x),y:f1(y),class:cls||'st halo','text-anchor':anchor||'middle'},str);t.style.fontSize=(fs||20)+'px';if(fill)t.style.fill=fill;gT.append(t);return t;};
  const SHOWC=RH>=70&&op.comments!==false; // 접점 아래 설명(줄이 좁으면 모니터에만)
  const hl=[];   // 접점 하이라이트 {el,fn}
  const fixed=[]; // 갱신할 글자 등 {fn}
  const contactW=c=>c.k==='cmp'?52:11;
  // 줄 위치
  let yy=y0;
  rows.forEach(r=>{const hasOr=r.cons.some(c=>c.or),nm=SHOWC&&r.cons.some(c=>c.or&&names[c.l]);r.top=yy;r.rh=hasOr?RH+(nm?70:50):RH;r.ym=yy+RH/2;r.yo=r.ym+(nm?72:60);yy+=r.rh;});
  const H=yy-y0;
  // 모선
  pen.line(x0,y0,x0,y0+H,P({strokeWidth:3.6}));pen.line(x0+W,y0,x0+W,y0+H,P({strokeWidth:3.6}));
  gF.append(s('line',{x1:x0,y1:y0,x2:x0,y2:y0+H,class:'lad-rail'}));
  const drawContact=(c,cx,ym)=>{
    if(c.k==='cmp'){
      const bw=104;
      pen.rect(cx-bw/2,ym-17,bw,34,P({strokeWidth:2.2,fill:'rgba(255,255,255,.45)'}));
      const r=s('rect',{x:cx-bw/2+3,y:ym-14,width:bw-6,height:28,rx:4,class:'lad-hl'});gHL.append(r);hl.push({el:r,fn:()=>c.st});
      lab(cx,ym+7,c.s1+' '+c.op+' '+c.s2,17,AN_INK,'middle','st');
      return;
    }
    pen.line(cx-11,ym-15,cx-11,ym+15,P({strokeWidth:2.8}));pen.line(cx+11,ym-15,cx+11,ym+15,P({strokeWidth:2.8}));
    if(c.k==='b')pen.line(cx-10,ym+15,cx+10,ym-15,P({strokeWidth:2}));
    const r=s('rect',{x:cx-9,y:ym-14,width:18,height:28,rx:3,class:'lad-hl'});gHL.append(r);
    if(c.k==='p'||c.k==='n'){lab(cx,ym+6,c.k.toUpperCase(),17,'#7a3e00','middle','st');
      hl.push({el:r,fn:now=>(c.st||now-(a.flash[c.l+c.k]||-1e9)<380)?1:0});}
    else hl.push({el:r,fn:()=>c.st});
    if(c.l)lab(cx,ym-21,c.l,19);
    if(SHOWC&&names[c.l])lab(cx,ym+29,String(names[c.l]).slice(0,10),14,'#6b6f76');
  };
  const hitFor=(n,x,y,w,h)=>{if(!n)return;anHit(gH,a,(inSet.has(n)?'in:':'dev:')+n,x,y,w,h);};
  a.pos={};
  rows.forEach((r,ri)=>{
    const out=r.out,box=out&&LAD_BOX.has(out.k);
    const outW=out?(box?232:150):10;
    const zl=x0+10,zr=x0+W-outW,n=r.cons.length,S=n?(zr-zl)/n:0;
    let prevX=x0,prevFn=()=>1;
    r.cons.forEach((c,i)=>{
      const cx=zl+(i+.5)*S,hw=contactW(c),ym=r.ym;
      const pin=prevFn;
      if(c.or){
        const ow=contactW(c.or),hs=Math.max(hw,ow)+25;
        seg([[prevX,ym],[cx-hs,ym]],pin);
        seg([[cx-hs,ym],[cx-hw,ym]],pin);
        seg([[cx+hw,ym],[cx+hs,ym]],()=>pin()&&c.st);
        seg([[cx-hs,ym],[cx-hs,r.yo],[cx-ow,r.yo]],pin);
        seg([[cx+ow,r.yo],[cx+hs,r.yo],[cx+hs,ym]],()=>pin()&&c.or.st);
        drawContact(c.or,cx,r.yo);
        if(c.or.l){a.pos[c.or.l]=a.pos[c.or.l]||{x:cx,y:r.yo};hitFor(c.or.l,cx-30,r.yo-38,60,62);}
        prevX=cx+hs;
      }else{
        seg([[prevX,ym],[cx-hw,ym]],pin);
        prevX=cx+hw;
      }
      drawContact(c,cx,ym);
      if(c.l){a.pos[c.l]=a.pos[c.l]||{x:cx,y:ym};hitFor(c.l,cx-30,ym-38,60,62);}
      prevFn=()=>r.pw[i];
    });
    const powFn=()=>r.pow;
    if(!out){seg([[prevX,r.ym],[x0+W,r.ym]],powFn);return;}
    if(!box){
      const cx=x0+W-75,ym=r.ym;
      seg([[prevX,ym],[cx-17,ym]],powFn);
      pen.line(cx+17,ym,x0+W,ym,P({strokeWidth:2.4}));
      const cc=s('circle',{cx,cy:ym,r:19,class:'lad-coil'});gHL.append(cc);
      pen.path('M'+f1(cx-6)+','+f1(ym-16)+' Q'+f1(cx-26)+','+ym+' '+f1(cx-6)+','+f1(ym+16),P({strokeWidth:2.8}));
      pen.path('M'+f1(cx+6)+','+f1(ym-16)+' Q'+f1(cx+26)+','+ym+' '+f1(cx+6)+','+f1(ym+16),P({strokeWidth:2.8}));
      if(out.k==='set'||out.k==='rst')lab(cx,ym+7,out.k==='set'?'S':'R',22,out.k==='set'?'#1f5fbf':'#c2271d','middle','st');
      if(out.l)lab(cx,ym-21,out.l,19);
      if(SHOWC&&names[out.l])lab(cx,ym+29,String(names[out.l]).slice(0,10),14,'#6b6f76');
      const dbl=out.k==='coil'&&coilRuns[out.l]>1;
      const warn=dbl?s('circle',{cx,cy:ym,r:26,class:'lad-warn'}):null;if(warn)gHL.append(warn);
      hl.push({el:cc,cls:'lad-coil',fn:()=>out.k==='coil'||out.k==='set'?a.bit(out.l):(r.pow?1:0)});
      if(warn)hl.push({el:warn,cls:'lad-warn',fn:()=>{const bad=r.pow&&!a.bit(out.l)?1:0;if(bad&&!a.warned){a.warned=1;pop('⚠ 아래 줄이 '+out.l+'을(를) 덮어써요');}return bad;}});
      a.pos[out.l]=a.pos[out.l]||{x:cx,y:ym};
      hitFor(out.l,cx-30,ym-38,60,62);
    }else{
      const bx=x0+W-122,ym=r.ym,bw=200,bh=52;
      seg([[prevX,ym],[bx-bw/2,ym]],powFn);
      pen.line(bx+bw/2,ym,x0+W,ym,P({strokeWidth:2.4}));
      pen.rect(bx-bw/2,ym-bh/2,bw,bh,P({strokeWidth:2.4,fill:'rgba(255,255,255,.5)'}));
      const bhl=s('rect',{x:bx-bw/2+3,y:ym-bh/2+3,width:bw-6,height:bh-6,rx:5,class:'lad-box'});gHL.append(bhl);
      const P1=out.p?'P':'';
      const head=out.k==='mov'?('MOV'+P1+'  '+out.s+'  '+out.l):out.k==='calc'?(out.op+P1+' '+out.s1+' '+out.s2+' '+out.l)
        :(out.k==='inc'||out.k==='dec')?(out.k.toUpperCase()+P1+'  '+out.l):out.k==='bsft'?('BSFT'+P1+' '+out.s+' '+out.e)
        :(out.k.toUpperCase()+'  '+out.l+'  '+out.v);
      lab(bx,ym-6,head,head.length>17?16:19,AN_INK,'middle','st');
      if(out.k==='bsft'){
        const n=out.bits.length,cw=Math.min(20,180/n),sx=bx-n*cw/2;const cells=[];
        out.bits.forEach((b,i)=>{const c=s('rect',{x:f1(sx+i*cw+1),y:ym+5,width:f1(cw-2),height:13,rx:2,class:'lad-bit'});gUI.append(c);cells.push({c,b});});
        fixed.push({fn:()=>cells.forEach(o=>setCls(o.c,'lad-bit',!!a.dv[o.b]))});
        hl.push({el:bhl,fn:()=>r.pow});
      }else if(out.k==='ton'||out.k==='tof'||out.k==='tmr'){
        const T=a.T[out.l];
        gUI.append(s('rect',{x:bx-88,y:ym+6,width:120,height:10,rx:4,class:'lad-bar0'}));
        const bar=s('rect',{x:bx-88,y:ym+6,width:0,height:10,rx:4,class:'lad-bar'});gUI.append(bar);
        const rd=lab(bx+40,ym+17,'',15,'#1f5fbf','start','st');
        fixed.push({fn:()=>{const pt=out.v*100,f=clamp(T.acc/pt,0,1);bar.setAttribute('width',f1(120*f));
          rd.textContent=out.k!=='tof'?ladFmtT(T.acc)+'/'+ladFmtT(pt)+'s':(T.done&&!T.run?'ON':ladFmtT(T.acc)+'/'+ladFmtT(pt)+'s');}});
        hl.push({el:bhl,fn:()=>T.done});
      }else if(out.k==='ctu'){
        const C=a.C[out.l];const rd=lab(bx,ym+19,'',17,'#1f5fbf','middle','st');
        fixed.push({fn:()=>{rd.textContent='현재값 '+C.cur+' / '+out.v;}});
        hl.push({el:bhl,fn:()=>C.done});
      }else{
        const rd=lab(bx,ym+19,'',16,'#1f5fbf','middle','st');
        fixed.push({fn:()=>{rd.textContent=out.l+' = '+a.word(out.l);}});
        hl.push({el:bhl,fn:()=>r.pow});
      }
      a.pos[out.l]=a.pos[out.l]||{x:bx,y:ym};
      hitFor(out.l,bx-bw/2,ym-bh/2,bw,bh);
    }
  });
  /* ----- 스캔 커서 ----- */
  const cur=s('rect',{x:x0+3,y:y0,width:W-6,height:RH,rx:8,class:'lad-cur'});gCur.append(cur);
  const curArrow=s('text',{x:x0-8,y:y0,class:'st','text-anchor':'end'},'▶');curArrow.style.fontSize='22px';curArrow.style.fill='#c27a00';gCur.append(curArrow);
  /* ----- 위쪽 버튼 / 단계 표시 ----- */
  const chips=[];
  let topY=y0;
  if(!legacy&&op.controls!==false){
    const cy=y0-30;topY=cy-14;
    const chip=(x,w,part,fn)=>{
      const g=s('g');gUI.append(g);
      const r=s('rect',{x,y:cy-14,width:w,height:28,rx:14,class:'lad-chip'});
      const t=s('text',{x:x+w/2,y:cy+6,class:'lad-cht','text-anchor':'middle'});g.append(r,t);
      anHit(gH,a,part,x,cy-16,w,32);chips.push({r,t,fn});
      return {x:x+w/2,y:cy};
    };
    a.posMode=chip(x0+W-250,150,'mode',()=>a.slow?['⚡ 빠르게 스캔',1]:['🐢 천천히 스캔',0]);
    a.posReset=chip(x0+W-92,92,'reset',()=>['↺ 처음',0]);
    if(W>=760){a.phT=[];
      ['① 입력 읽기','② 위→아래 실행','③ 출력 쓰기'].forEach((tx,i)=>{const t=s('text',{x:x0+8+i*150,y:cy+6,class:'lad-ph','text-anchor':'start'},tx);gUI.append(t);a.phT.push(t);});}
    else{a.ph1=s('text',{x:x0+8,y:cy+6,class:'lad-ph on','text-anchor':'start'});gUI.append(a.ph1);}
  }
  /* ----- 모니터 ----- */
  let botY=y0+H;
  const mon=[];
  if(!legacy&&op.monitor!==false){
    let mx=x0,my=y0+H+38;
    const order=(Array.isArray(op.monitor)?op.monitor.map(String).filter(n=>seen.has(n)):
      inputs.concat(ainList,used.filter(n=>!inSet.has(n)&&!isTC(n)&&!words.has(n)),Object.keys(a.T),Object.keys(a.C),used.filter(n=>words.has(n)&&!isTC(n)&&ainList.indexOf(n)<0))).filter(n=>!ladSys(n));
    const ml=s('text',{x:x0,y:my-21,class:'lad-mt','text-anchor':'start'},'디바이스 모니터  (● = 실제 LED/값)');gUI.append(ml);
    order.forEach(n=>{
      const kind=inSet.has(n)?'in':ainList.indexOf(n)>=0?'ai':a.T[n]?'t':a.C[n]?'c':words.has(n)?'d':(written.has(n)&&!/^[MKLF]\d/i.test(n))?'out':'m';
      const nm0=(kind==='in'||kind==='out'||kind==='ai')&&names[n]?String(names[n]):'',nm=nm0.length<=6?nm0:nm0.split(/[\s(]/)[0].slice(0,6);
      const w=kind==='ai'?Math.max(290,210+nm.length*13):kind==='t'?150:kind==='d'||kind==='c'?126:Math.max(104,52+(n.length+(nm?1:0))*8.2+nm.length*13);
      if(mx+w>x0+W+60){mx=x0;my+=36;}
      const g=s('g');gUI.append(g);
      const r=s('rect',{x:mx,y:my-14,width:w-6,height:28,rx:8,class:'lad-mon '+kind});
      const led=s('circle',{cx:mx+13,cy:my,r:6,class:'lad-led'});
      const t=s('text',{x:mx+24,y:my+5,class:'lad-mtx','text-anchor':'start'});
      g.append(r,led,t);
      if(kind==='in')anHit(gH,a,'in:'+n,mx,my-16,w-6,32);
      if(kind==='ai'){
        [['−',w-104,'ai-:'],['+',w-56,'ai+:']].forEach(q=>{const bx2=mx+q[1];
          g.append(s('rect',{x:bx2,y:my-13,width:44,height:26,rx:7,class:'lad-chip on'}));
          const tt=s('text',{x:bx2+22,y:my+7,class:'lad-cht','text-anchor':'middle'},q[0]);tt.style.fontSize='20px';g.append(tt);
          anHit(gH,a,q[2]+n,bx2-3,my-20,50,40);});
        a.pos['ai:'+n]={x:mx+w-34,y:my};
      }
      mon.push({n,kind,led,t,nm});
      mx+=w;
    });
    botY=my+18;
  }
  /* ----- 타임차트 ----- */
  const chartSigs=(!legacy&&Array.isArray(op.chart)?op.chart.map(String).filter(n=>seen.has(n)):[]).slice(0,4);
  const CH_N=80;const chPaths=[];
  if(chartSigs.length){
    const cy0=botY+18,rowH=30,lw=78,pw=W-lw;
    const t=s('text',{x:x0,y:cy0+2,class:'lad-mt','text-anchor':'start'},'타임차트 (최근 8초, 오른쪽이 지금)');gUI.append(t);
    chartSigs.forEach((n,i)=>{
      const ty=cy0+14+i*rowH;
      gUI.append(s('line',{x1:x0+lw,y1:ty+rowH-6,x2:x0+W,y2:ty+rowH-6,class:'lad-chax'}));
      const tl=s('text',{x:x0,y:ty+rowH-9,class:'lad-mtx','text-anchor':'start'},n);gUI.append(tl);
      const p=s('path',{d:'',class:'lad-chp c'+i});gUI.append(p);
      chPaths.push({p,ty,lw,pw,rowH});
    });
    botY=cy0+14+chartSigs.length*rowH+4;
  }
  /* ----- 갱신 ----- */
  const setCls=(el,cls,on)=>{if(el._on===on)return;el._on=on;el.setAttribute('class',cls+(on?' on':''));};
  a.draw=now=>{
    segs.forEach(sg=>{const on=sg.fn()?1:0;if(sg.on!==on){sg.on=on;sg.g1.classList.toggle('on',!!on);sg.g2.classList.toggle('on',!!on);}});
    hl.forEach(h=>{const on=h.fn(now)?1:0;if(!h.base)h.base=h.cls||h.el.getAttribute('class');setCls(h.el,h.base,on);});
    fixed.forEach(f=>f.fn());
    // 커서
    let cr=null,alpha=0;
    if(a.slow){if(a.phase.k==='rung')cr=rows[a.phase.i];alpha=1;}
    else if(!reduced()){const per=Math.max(900,rows.length*260),u=(now%per)/per;cr=rows[Math.min(rows.length-1,Math.floor(u*rows.length))];alpha=.45;}
    if(cr){cur.setAttribute('y',f1(cr.top+2));cur.setAttribute('height',f1(cr.rh-4));cur.style.opacity=a.slow?1:.5;
      curArrow.setAttribute('y',f1(cr.ym+8));curArrow.style.opacity=a.slow?1:0;}
    else{cur.style.opacity=0;curArrow.style.opacity=0;}
    cur.classList.toggle('slow',a.slow);
    if(a.phT)a.phT.forEach((t,i)=>{const k=['in','rung','out'][i];setCls(t,'lad-ph',a.slow&&a.phase.k===k);t.style.opacity=a.slow?1:.35;});
    if(a.ph1){const k=a.phase.k,txt=!a.slow?'⚡ 스캔 중':k==='in'?'① 입력 읽기':k==='out'?'③ 출력 쓰기':'② '+(a.phase.i+1)+'번째 줄';if(a.ph1.textContent!==txt)a.ph1.textContent=txt;}
    chips.forEach(c=>{const v=c.fn();if(c.t.textContent!==v[0])c.t.textContent=v[0];setCls(c.r,'lad-chip',!!v[1]);});
    mon.forEach(m=>{
      let txt=m.n,on=0;
      if(m.kind==='in'){on=a.ext[m.n];txt=m.n+(m.nm?' '+m.nm:'');}
      else if(m.kind==='out'){on=a.ph[m.n];txt=m.n+(m.nm?' '+m.nm:'');}
      else if(m.kind==='m'){on=a.bit(m.n);}
      else if(m.kind==='t'){const T=a.T[m.n];on=T.done;txt=m.n+' '+ladFmtT(T.acc)+'s';}
      else if(m.kind==='ai'){on=a.wext[m.n]>0;txt=m.n+(m.nm?' '+m.nm:'')+' = '+a.wext[m.n];}
      else if(m.kind==='c'){const C=a.C[m.n];on=C.done;txt=m.n+' = '+C.cur;}
      else{on=a.word(m.n)?1:0;txt=m.n+' = '+a.word(m.n);}
      if(m.t.textContent!==txt)m.t.textContent=txt;
      setCls(m.led,'lad-led',!!on);
    });
    if(chPaths.length){
      const N=a.hist.length;
      chPaths.forEach((c,i)=>{
        if(!N){c.p.setAttribute('d','');return;}
        const dx=c.pw/(CH_N-1),hi=c.ty+6,lo2=c.ty+c.rowH-6;let d='',prevY=null;
        for(let k=0;k<N;k++){const xx=x0+c.lw+(CH_N-N+k)*dx,yv=a.hist[k][i]?hi:lo2;
          if(prevY===null)d='M'+f1(xx)+','+yv;else if(yv!==prevY)d+=' L'+f1(xx)+','+prevY+' L'+f1(xx)+','+yv;prevY=yv;}
        d+=' L'+f1(x0+c.lw+c.pw)+','+prevY;
        c.p.setAttribute('d',d);
      });
    }
  };
  /* ----- 조작 ----- */
  const tip=n=>{const p=a.pos[n];if(p)simPopXY(p.x-40,p.y-62,n+(ladSys(n)?' 상시 ON 플래그':a.T[n]?' 타이머: 프로그램이 시간을 세요':a.C[n]?' 카운터: 프로그램이 세요':' 은(는) 프로그램이 정해요'));};
  a.press=(n,how)=>{
    if(!inSet.has(n)){tip(n);return;}
    const base=init[n]?1:0;
    if(how==='press'||(how==='auto'&&momentary(n))){a.pressed[n]=1;a.relQ[n]=0;a.pressRead[n]=a.readNo;a.ext[n]=base?0:1;}
    else if(how==='release'){a.pressed[n]=0;if(a.pressRead[n]===a.readNo)a.relQ[n]=1;else a.ext[n]=base;}
    else if(how==='on')a.ext[n]=1;
    else if(how==='off')a.ext[n]=0;
    else a.ext[n]=a.ext[n]?0:1;
    a.draw(performance.now());
  };
  a.click=part=>{
    part=String(part||'');
    if(part==='mode'){a.setSlow(!a.slow);return;}
    if(part==='reset'){a.reset();a.warned=0;pop('↺ 모두 처음 상태로');a.draw(performance.now());return;}
    if(part.slice(0,3)==='in:'){a.press(part.slice(3),'auto');return;}
    if(part.slice(0,4)==='ai+:'||part.slice(0,4)==='ai-:'){a.adj(part.slice(4),part.charAt(2)==='+'?1:-1);return;}
    if(part.slice(0,4)==='dev:'){tip(part.slice(4));return;}
    if(inputs.length){a.press(inputs[0],'auto');}
  };
  a.adj=(n,dir,abs)=>{const c=ain[n];if(!c||ainList.indexOf(n)<0)return;const mn=nz(c.min,0),mx=nz(c.max,16000),st=nz(c.step,Math.max(1,Math.round((mx-mn)/10)));
    a.wext[n]=clamp(abs!=null?Math.round(abs):a.wext[n]+dir*st,mn,mx);a.draw(performance.now());};
  a.release=part=>{part=String(part||'');if(part.slice(0,3)==='in:'){const n=part.slice(3);if(a.pressed[n])a.press(n,'release');}};
  a.releaseAll=()=>{for(const n in a.pressed)if(a.pressed[n])a.press(n,'release');};
  a.act=(d,val)=>{
    d=String(d||'toggle');const n=val!=null?String(val):inputs[0];
    if(d==='slow'||d==='fast'){a.setSlow(d==='slow');return;}
    if(d==='reset'){a.reset();a.warned=0;a.draw(performance.now());return;}
    if(d==='set'){const m=/^(.+?)=(-?\d+)$/.exec(String(val||''));if(m)a.adj(m[1],0,parseInt(m[2],10));return;}
    if(d==='up'||d==='down'){a.adj(n,d==='up'?1:-1);return;}
    if(d==='tap'){a.press(n,'press');setTimeout(()=>{if(a.pressed[n])a.press(n,'release');},a.slow?Math.max(600,phaseDur('in')*(rows.length+2)):600);return;}
    if(d==='press'||d==='release'||d==='on'||d==='off')a.press(n,d);
    else a.press(n,'toggle');
  };
  a.fingerAt=(d,val)=>{
    if((d==='slow'||d==='fast')&&a.posMode)return a.posMode;
    if(d==='reset'&&a.posReset)return a.posReset;
    if(d==='set'||d==='up'||d==='down'){const m=String(val||'').split('=')[0];const q=a.pos['ai:'+m];if(q)return q;}
    const n=val!=null?String(val):inputs[0];const p=a.pos[n];
    return p?{x:p.x,y:p.y}:{x:x0+W/2,y:y0+H/2};
  };
  a.render=()=>{};
  a.state=()=>({err:a.err,wext:Object.assign({},a.wext),dv:Object.assign({},a.dv),ph:Object.assign({},a.ph),ext:Object.assign({},a.ext),T:JSON.parse(JSON.stringify(a.T)),C:JSON.parse(JSON.stringify(a.C)),slow:a.slow,phase:a.phase.k,scanNo:a.scanNo});
  if(a.slow)a.enterPhase('in',-1,performance.now());else a.scanFast(0,performance.now());
  a.draw(performance.now());
  ladStart(a);
  return {x:x0-34,y:topY,w:W+48,h:botY-topY+6};
}
