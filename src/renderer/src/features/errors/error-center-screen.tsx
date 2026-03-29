import { EmptyState, Panel } from "@renderer/components/shared/ui";
import type { Bookmark, ErrorCodeRecord, SearchResult } from "@shared/types";

export const ErrorCenterScreen = ({
  query,
  onQueryChange,
  onLookup,
  record,
  searchResults,
  bookmarks,
  onAskAssistant,
  onBookmarkAdd,
  onBookmarkDelete,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onLookup: () => void;
  record: ErrorCodeRecord | null;
  searchResults: SearchResult[];
  bookmarks?: Bookmark[];
  onAskAssistant?: (code: string, title: string) => void;
  onBookmarkAdd?: (label: string, targetId: string) => void;
  onBookmarkDelete?: (id: string) => void;
}) => (
  <div className="screen-grid screen-grid--two">
    <Panel eyebrow="Lookup" title="에러 코드 / 증상 조회">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="error-query">코드 또는 증상</label>
          <input
            id="error-query"
            placeholder="예: L0300 또는 OR-LOAD 오류"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim().length >= 2) {
                onLookup();
              }
            }}
          />
        </div>
        <div className="button-row">
          <button className="button button--primary" disabled={query.trim().length < 2} onClick={onLookup} type="button">
            조회
          </button>
        </div>
      </div>

      {record ? (
        <div className="timeline-list">
          <article className="timeline-card">
            <strong>
              {record.code} {record.title}
            </strong>
            <p>원인: {record.cause}</p>
            <p>조치: {record.action}</p>
            <p>관련 메뉴: {record.relatedMenus.join(", ")}</p>
            <div className="button-row">
              {onAskAssistant ? (
                <button
                  className="button button--primary"
                  onClick={() => onAskAssistant(record.code, record.title)}
                  type="button"
                >
                  어시스턴트에 질문
                </button>
              ) : null}
              {onBookmarkAdd ? (
                <button
                  className="button"
                  onClick={() => onBookmarkAdd(`${record.code} ${record.title}`, record.code)}
                  type="button"
                >
                  북마크 추가
                </button>
              ) : null}
            </div>
          </article>
        </div>
      ) : (
        <EmptyState title="코드 조회 대기" detail="정확한 에러 코드나 현상 키워드를 입력하면 원인과 조치를 보여줍니다." />
      )}

      {bookmarks && bookmarks.length > 0 ? (
        <div>
          <h4 style={{ margin: "12px 0 6px" }}>북마크</h4>
          <div className="timeline-list">
            {bookmarks.map((bm) => (
              <article className="timeline-card" key={bm.id}>
                <div className="button-row">
                  <strong>{bm.label}</strong>
                  {onBookmarkDelete ? (
                    <button className="button button--ghost" onClick={() => onBookmarkDelete(bm.id)} type="button">
                      삭제
                    </button>
                  ) : null}
                </div>
                <p>{new Date(bm.createdAt).toLocaleString("ko-KR")}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>

    <Panel eyebrow="Related" title="연관 근거">
      {searchResults.length ? (
        <div className="citation-list">
          {searchResults.map((result) => (
            <article className="citation-card" key={result.id}>
              <strong>{result.title}</strong>
              <p>{result.summary}</p>
              <p>{result.source}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="연관 결과 없음" detail="검색어를 입력하면 내장 매뉴얼 조각과 에러 데이터를 함께 보여줍니다." />
      )}
    </Panel>
  </div>
);
