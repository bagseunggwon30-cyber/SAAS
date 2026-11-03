// 결선 일기장 — 래더 확장 빌드
// original/index.html (APK assets/index.html 원본) + src/* → dist/index.html
// 사용: node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

let html = read('original/index.html');
const css = read('src/ladder.css');
const sim = read('src/ladder-sim.js');
const lessons = read('src/lessons-ladder.js');

function patch(name, from, to) {
  const n = html.split(from).length - 1;
  if (n !== 1) throw new Error(`[${name}] 기준 문자열이 ${n}번 나옴 (1번이어야 함)`);
  html = html.replace(from, () => to);
}

// 1) 스타일
patch('css', '<div id="app">', `<style>\n${css}</style>\n<div id="app">`);
// 2) 래더 강의 (다른 강의 스크립트 뒤, 엔진 앞)
patch('lessons', '<script>var rough=', `<script>\n${lessons}\n</script>\n<script>var rough=`);
// 3) anim 위젯에 ladder 추가
patch('anim-kind', 'const ANIM_KINDS={', `${sim}\nconst ANIM_KINDS={\n  ladder:LADDER_ANIM,`);
// 4) 기존 ladder 도형도 눌러 볼 수 있는 래더로 (실패하면 원래 정적 그림으로)
patch('runop-ladder',
  "case 'text':case 'line':case 'box':case 'ring':case 'slot':case 'dim':case 'wave':case 'table':case 'ladder':{",
  "case 'ladder':{const lsh=buildAnim(Object.assign({},op,{t:'anim',kind:'ladder',legacy:op.legacy!==false}),R,turn);" +
  "if(lsh){if(live)camTouch(lsh.bbox,R);await R.sleep(Math.min(1400,450+(Array.isArray(op.rows)?op.rows.length:1)*260)+120);break;}}\n" +
  "    case 'text':case 'line':case 'box':case 'ring':case 'slot':case 'dim':case 'wave':case 'table':{");
// 5) anim 도 '손 뗌'을 받는다 (푸시버튼처럼 누르는 동안만 ON)
patch('simup', 'if(tg.anim)return;', 'if(tg.anim){if(tg.anim.release)tg.anim.release(tg.part);return;}');
// 6) demo act 의 손가락 위치에 value(디바이스)도 넘김
patch('finger', 'const p=an.fingerAt(so.do);', 'const p=an.fingerAt(so.do,so.value);');
// 7) anim 대상 act 가 있는 demo 도 다시 보기 가능
patch('demovalid', "return rec.ops.every(o=>!o||o.t!=='act'||simResolve(o.id));",
  "return rec.ops.every(o=>!o||o.t!=='act'||simResolve(o.id)||animResolve(o.id));");
// 8) 과정 목록에 'PLC 래더 입문'
patch('courses', "{id:'plc',name:'PLC·주차장 실무',short:'PLC'},",
  "{id:'plc',name:'PLC·주차장 실무',short:'PLC'},{id:'ladder',name:'PLC 래더 입문',short:'래더'},");

// 9) 모바일은 도구가 '손(이동)'으로 고정이라 눌러 보는 부품·위젯이 탭에 반응하지 않던 문제:
//    손 모드에서도 짧게 탭하면 누름, 끌면 화면 이동
patch('hand-tap-hit',
  "if(mode==='pen'&&e.button===0){const ht=hitTest(e.clientX,e.clientY);if(ht)simTg=animTarget(ht)||(SIM.on?simTarget(ht):null);}",
  "if((mode==='pen'||mode==='hand')&&e.button===0){const ht=hitTest(e.clientX,e.clientY);if(ht)simTg=animTarget(ht)||(SIM.on?simTarget(ht):null);}");
patch('hand-tap-down',
  "  if(simTg){cur.mode='sim';cur.sim=simTg;simDown(simTg);}",
  "  if(simTg&&mode==='hand'){const me=cur;me.simWait=simTg;me.simTm=setTimeout(()=>{if(cur===me&&me.simWait&&me.moved<10){me.mode='sim';me.sim=me.simWait;me.simWait=null;simDown(me.sim);}},90);wrap.classList.add('dragging');}\n" +
  "  else if(simTg){cur.mode='sim';cur.sim=simTg;simDown(simTg);}");
patch('hand-tap-up',
  "  if(c.mode==='sim'){simUp(c.sim,e.type==='pointerup'&&c.moved<10);return;}",
  "  if(c.simWait){clearTimeout(c.simTm);if(c.moved<10&&e.type==='pointerup'){simDown(c.simWait);simUp(c.simWait,true);return;}}\n" +
  "  if(c.mode==='sim'){simUp(c.sim,e.type==='pointerup'&&c.moved<10);return;}");

mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist/index.html'), html);
console.log('dist/index.html', (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB');
