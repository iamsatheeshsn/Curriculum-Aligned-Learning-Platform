import { useEffect, useMemo, useState } from 'react';
import { Button } from './Brand';

/** Default page size for all portal directory / list screens. */
export const DEFAULT_LIST_PAGE_SIZE = 10;

export type ListPageMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export function useClientPagination<T>(items: T[], pageSize: number = DEFAULT_LIST_PAGE_SIZE) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  const lastPage = Math.max(1, Math.ceil(items.length / Math.max(1, pageSize)) || 1);
  const currentPage = Math.min(Math.max(1, page), lastPage);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const meta: ListPageMeta = {
    current_page: currentPage,
    last_page: lastPage,
    per_page: pageSize,
    total: items.length,
  };

  return {
    page: currentPage,
    setPage,
    pageItems,
    meta,
    pageSize,
    total: items.length,
    lastPage,
    showPager: items.length > pageSize,
  };
}

export function PaginationBar({
  page,
  lastPage,
  total,
  onPageChange,
  disabled,
  className,
  alwaysShow = false,
}: {
  page: number;
  lastPage: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  /** When false (default), hide if only one page. */
  alwaysShow?: boolean;
}) {
  if (!alwaysShow && lastPage <= 1) return null;

  return (
    <div className={className ?? 'stem-pager'} role="navigation" aria-label="Pagination">
      <span>
        Page {page} of {lastPage} · {total} total
      </span>
      <div className="stem-pager-actions">
        <Button
          size="sm"
          type="button"
          variant="secondary"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          size="sm"
          type="button"
          variant="secondary"
          disabled={disabled || page >= lastPage}
          onClick={() => onPageChange(Math.min(lastPage, page + 1))}
        >
          Next
        </Button>
      </div>
      <style>{pagerStyles}</style>
    </div>
  );
}

const pagerStyles = `
.stem-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--stem-line, rgba(12, 124, 128, 0.14));
  font-size: 0.86rem;
  color: var(--stem-ink-soft, #5b6b73);
}
.stem-pager-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
`;
