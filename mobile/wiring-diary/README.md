# 결선 일기장 — PLC 래더 확장

모바일 학습 앱 `결선 일기장 S25 v1.2` APK 안의 `assets/index.html`에 다음을 더한 빌드입니다.

- **A. 래더 시뮬레이터**: 래더 그림을 눌러 보면 통전(초록 흐름)·접점 ON 표시가 움직이고, 🐢 천천히 스캔(① 입력 읽기 → ② 위→아래 실행 → ③ 출력 쓰기, 노란 스캔 커서)·디바이스 모니터·타임차트를 보여 줍니다.
  지원 요소: a/b 접점, 상승·하강 에지(P/N), 비교 접점, 코일, SET/RST, TON/TOF, CTU, MOV.
- **B. 새 과정 「PLC 래더 입문」 8강**: 래더 읽기·통전 / 자기유지·인터록 / 스캔 / SET·RST·에지·토글 / TON·TOF·깜빡이 / CTU·디바이스 지도·16진 주소 / MOV·비교 스텝 시퀀스(리프트) / XG5000 시뮬레이터 연습과 현장 안전.
- **새 과정 「PLC 래더 고급」 8강**: INC/INCP·SUB·16비트 넘침 / 4–20mA 스케일링·히스테리시스 / TMR 적산·1초 펄스 가동시간 / 스텝 감시 타이머·고장 스텝 / 경보 래치·부저 정지·첫 고장 / BSFT 컨베이어 추적 / 운전 모드(자동·수동·원점·비상 후 재기동) / 실전 고장 찾기·고속 카운터·Modbus.
  고급용 명령: ADD/SUB/MUL/DIV, INC/DEC, 펄스형(P), TMR, BSFT, 상시 ON 플래그(`_ON`), 모니터에서 −/+로 바꾸는 아날로그 입력(`ain`).
- 기존 강의(중급 1·6·7강)의 래더 6개도 이제 눌러 볼 수 있습니다. 6강 Y-Δ의 T1은 5초 타이머로 동작합니다.
- **버그 수정**: 모바일은 도구가 '손(이동)'으로 고정이라 ⚡ 동작 모드의 부품과 눌러 보는 위젯이 탭에 반응하지 않던 문제를 고쳤습니다. 짧게 탭하면 누름이고, 끌면 화면이 이동합니다.

## 파일

| 경로 | 내용 |
|---|---|
| `original/index.html` | APK에서 꺼낸 원본. 수정하지 않습니다. |
| `src/ladder-sim.js` | 래더 시뮬레이터 (`anim` kind `ladder`). 엔진 클로저 안에 삽입됩니다. |
| `src/ladder.css` | 시뮬레이터 스타일 |
| `src/lessons-ladder.js` | 래더 입문 8강과 기존 래더 보정 |
| `src/lessons-ladder-adv.js` | 래더 고급 8강 |
| `build.mjs` | 원본에 위 파일을 끼워 넣어 `dist/index.html`을 만듭니다. 기준 문자열이 정확히 1번 있는지 검사합니다. |
| `build-apk.sh`, `tools/` | 묶기·정렬 → v2 서명 |
| `apk-template/` | 원본 APK의 매니페스트·dex·리소스 |

## 빌드

```bash
node build.mjs                      # → dist/index.html
KEYSTORE=diary.p12 STOREPASS=... ALIAS=diary APKSIG_JAR=apksig-2.3.0.jar ./build-apk.sh out.apk
```

원래 생성기(`tools/build-main.js`, `gen-*.js`)를 쓰고 있다면 `dist/index.html`을 기존 파이프라인의 `assets/index.html` 자리에 넣고 **원래 키로 서명**하면 됩니다. 이렇게 하면 기존 앱 위에 업데이트로 설치되고 학습 진행 기록도 유지됩니다.

## 강의 대본에서 래더 쓰기

```js
{t:'anim',kind:'ladder',id:'LD1',x:150,y:190,w:780,
 pb:['P0000'], init:{P0001:1}, names:{P0000:'기동'}, chart:['P0000','P0020'], scan:'slow',
 rows:[[{k:'a',l:'P0000',or:'P0020'},{k:'a',l:'P0001'},{k:'coil',l:'P0020'}],
       [{k:'a',l:'P0020'},{k:'ton',l:'T0000',v:30}]]}
{t:'act',id:'LD1',do:'tap',value:'P0000'}   // press / release / on / off / toggle / slow / fast / reset

// 고급 요소
{k:'calc',op:'DIV',s1:'D0100',s2:'16',d:'D0110',p:false}  // ADD/SUB(16비트 넘침)/MUL/DIV, p:true = ADDP 등
{k:'inc',l:'D0010',p:true}  {k:'tmr',l:'T0000',v:100}  {k:'bsft',s:'M0000',e:'M0007'}  {k:'mov',s:'1',d:'D0000',p:true}
ain:{D0100:{min:0,max:16000,step:800,init:4000}}   // 모니터의 −/+ 로 조절하는 워드 입력
{t:'act',id:'LD1',do:'set',value:'D0100=8000'}      // up / down 도 가능
```

`v`(타이머)는 0.1초 단위로 가정합니다. 실제 XG5000의 시간 단위는 기본 파라미터의 디바이스 영역에서 확인하세요.
