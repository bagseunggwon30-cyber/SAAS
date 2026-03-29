import type { ManualChunk } from "@shared/types";

export const manualChunkSeed: ManualChunk[] = [
  {
    id: "conn-001",
    title: "PLC 접속 1차 점검",
    section: "온라인 > 접속",
    source: "XG5000 매뉴얼 V3.1",
    category: "connection-issue",
    keywords: ["connect", "connection", "접속", "usb", "ethernet", "timeout", "xg5000", "plc"],
    content:
      "XG5000가 PLC에 연결되지 않으면 먼저 접속 경로를 점검하세요. USB 드라이버 설치 상태, Ethernet IP 설정, 로컬/리모트 홉 선택이 올바른지 순서대로 확인합니다. 현장 네트워크가 불안정할 때는 타임아웃을 5초 이상으로 두고 다시 시도하는 것이 안전합니다.",
  },
  {
    id: "conn-002",
    title: "권장 타임아웃과 재시도 값",
    section: "통신 옵션",
    source: "XG5000 매뉴얼 V3.1",
    category: "connection-issue",
    keywords: ["timeout", "retry", "5 seconds", "통신", "재시도", "권장"],
    content:
      "기본 타임아웃은 5초입니다. 5초보다 낮게 설정하면 불필요한 통신 실패가 자주 발생할 수 있습니다. 문제를 진단할 때는 타임아웃을 최소 5초로 두고, 재시도는 2회에서 3회 정도로 맞춘 뒤 케이블, 모듈, CPU 설정을 확인하세요.",
  },
  {
    id: "proc-001",
    title: "프로그램 쓰기/다운로드 순서",
    section: "온라인 > 쓰기",
    source: "XG5000 매뉴얼 V3.1",
    category: "procedure",
    keywords: ["download", "write", "program", "온라인", "쓰기", "stop mode"],
    content:
      "일반적인 다운로드 순서는 접속, 프로그램 검사 결과 확인, 그 다음 [온라인]-[쓰기] 실행입니다. 가능하면 쓰기 전에 PLC를 STOP 상태로 전환하고, 논리 에러와 문법 에러를 먼저 해소한 뒤 진행하세요.",
  },
  {
    id: "proc-002",
    title: "강제 I/O 안전 메모",
    section: "온라인 > 강제 I/O",
    source: "XG5000 매뉴얼 V3.1",
    category: "procedure",
    keywords: ["force", "io", "output", "강제", "안전", "interlock"],
    content:
      "강제 I/O는 RUN 모드에서도 가능할 수 있지만, 안전 검토를 건너뛰어서는 안 됩니다. 기계 상태, 인터록 체인, 영향받는 출력을 먼저 확인하고 강제 동작 후에는 이력을 남겨 추적 가능하게 해야 합니다.",
  },
  {
    id: "concept-001",
    title: "자동 변수 할당 변경 영향",
    section: "변수 및 설명",
    source: "XG5000 매뉴얼 V3.1",
    category: "concept",
    keywords: ["auto", "variable", "allocation", "자동 할당", "na", "device"],
    content:
      "자동 할당 범위를 줄이거나 삭제하면 이미 배정된 변수가 N/A[Auto]로 돌아갈 수 있습니다. 자동 변수 할당 영역을 바꾼 뒤에는 영향을 받는 변수 전체를 다시 검토하고, 디바이스 할당이 원래 의도와 맞는지 확인해야 합니다.",
  },
  {
    id: "concept-002",
    title: "디버그 모드 가능 조건",
    section: "디버그",
    source: "XG5000 매뉴얼 V3.1",
    category: "concept",
    keywords: ["debug", "run mode", "program mismatch", "alarm", "디버그", "plc"],
    content:
      "PLC가 지원되지 않는 RUN 상태이거나, XG5000 프로젝트와 PLC 프로그램이 서로 다르거나, PLC 자체가 에러 상태이면 디버그가 차단됩니다. 먼저 현재 알람을 읽고, 다운로드된 프로그램과 현재 프로젝트가 같은 리비전인지 확인하세요.",
  },
];
