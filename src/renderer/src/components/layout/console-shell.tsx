import clsx from "clsx";
import type { PropsWithChildren } from "react";

import { StatusBadge } from "@renderer/components/shared/ui";
import type { PlcStatusSnapshot } from "@shared/types";

export type ScreenKey =
  | "dashboard"
  | "assistant"
  | "plc"
  | "errors"
  | "project"
  | "monitor"
  | "settings";

const screenMeta: Array<{ key: ScreenKey; label: string; hint: string }> = [
  { key: "dashboard", label: "대시보드", hint: "현황 개요" },
  { key: "assistant", label: "어시스턴트", hint: "질문 안내" },
  { key: "plc", label: "PLC 센터", hint: "프로파일" },
  { key: "errors", label: "오류 코드", hint: "코드 조회" },
  { key: "project", label: "프로젝트", hint: "파일 가져오기" },
  { key: "monitor", label: "모니터", hint: "트레이스" },
  { key: "settings", label: "설정", hint: "동기화 / UI" },
];

export const ConsoleShell = ({
  activeScreen,
  compactMode,
  onCaptureClipboard,
  onOpenQuickAsk,
  onSelectScreen,
  status,
  children,
}: PropsWithChildren<{
  activeScreen: ScreenKey;
  compactMode: boolean;
  onCaptureClipboard: () => void;
  onOpenQuickAsk: () => void;
  onSelectScreen: (screen: ScreenKey) => void;
  status: PlcStatusSnapshot | null;
}>) => (
  <div className={clsx("console-layout", compactMode && "console-layout--compact")}>
    <aside className="sidebar">
      <div className="brand-block">
        <p className="brand-block__eyebrow">LS ELECTRIC FIELD TOOL</p>
        <h1>XG5000 Assistant</h1>
        <p className="brand-block__detail">현장 엔지니어용 운영 콘솔</p>
      </div>
      <nav className="nav-list" aria-label="Main">
        {screenMeta.map((screen) => (
          <button
            key={screen.key}
            className={clsx("nav-item", activeScreen === screen.key && "nav-item--active")}
            onClick={() => onSelectScreen(screen.key)}
            type="button"
          >
            <span>{screen.label}</span>
            <small>{screen.hint}</small>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <StatusBadge tone={status?.connected ? "success" : "neutral"}>
          {status?.connected ? `${status.cpuModel} ${status.mode}` : "PLC 오프라인"}
        </StatusBadge>
        <p>고위험 제어는 승인 구조만 제공하며 실제 제어는 비활성 상태입니다.</p>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div>
          <p className="topbar__eyebrow">XG5000 V3.1 어시스턴트 워크스페이스</p>
          <h2>{screenMeta.find((screen) => screen.key === activeScreen)?.label}</h2>
        </div>
        <div className="topbar__status">
          <div className="button-row topbar__actions">
            <button className="button" data-testid="capture-clipboard" onClick={onCaptureClipboard} type="button">
              클립보드
            </button>
            <button className="button button--primary" data-testid="open-quick-ask" onClick={onOpenQuickAsk} type="button">
              빠른 질문
            </button>
          </div>
          <StatusBadge tone={status?.connected ? "success" : "warning"}>
            {status?.connected ? "실시간 컨텍스트 준비됨" : "오프라인 안내"}
          </StatusBadge>
          {status ? <p>마지막 확인 {new Date(status.lastSeenAt).toLocaleTimeString("ko-KR")}</p> : null}
        </div>
      </header>
      <div className="screen-content">{children}</div>
    </main>
  </div>
);
