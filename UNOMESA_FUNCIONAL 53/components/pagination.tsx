"use client";

const PAGE_SIZE = 50;

export function pageItems<T>(rows: T[], page: number, pageSize = PAGE_SIZE) {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

export function Pagination({
  total,
  page,
  onPage,
  language = "es",
  hasNext,
  loading = false,
  shown = 0,
  pageSize = PAGE_SIZE,
}: {
  total: number;
  page: number;
  onPage: (page: number) => void;
  language?: "es" | "en";
  hasNext?: boolean;
  loading?: boolean;
  shown?: number;
  pageSize?: number;
}) {
  const en = language === "en";
  if (hasNext !== undefined) {
    if (page === 1 && !hasNext) return null;
    return <nav className="pagination" aria-label={en ? "Result pages" : "Páginas de resultados"} aria-busy={loading}>
      <span>{en ? "Page" : "Página"} {page} · {shown} {en ? "shown" : "visibles"}</span>
      <button type="button" disabled={loading || page === 1} onClick={() => onPage(page - 1)}>{en ? "Previous" : "Anterior"}</button>
      <button type="button" disabled={loading || !hasNext} onClick={() => onPage(page + 1)}>{en ? "Next" : "Siguiente"}</button>
    </nav>;
  }
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const visible = Array.from(
    { length: Math.min(5, pages) },
    (_, index) => start + index,
  );
  return (
    <nav className="pagination" aria-label={en ? "Result pages" : "Páginas de resultados"}>
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} {en ? "of" : "de"} {total}
      </span>
      <button type="button" disabled={loading || page === 1} onClick={() => onPage(page - 1)}>
        {en ? "Previous" : "Anterior"}
      </button>
      {visible.map((number) => (
        <button
          type="button"
          className={number === page ? "active" : ""}
          disabled={loading}
          aria-current={number === page ? "page" : undefined}
          onClick={() => onPage(number)}
          key={number}
        >
          {number}
        </button>
      ))}
      <button type="button" disabled={loading || page === pages} onClick={() => onPage(page + 1)}>
        {en ? "Next" : "Siguiente"}
      </button>
    </nav>
  );
}

export { PAGE_SIZE };
