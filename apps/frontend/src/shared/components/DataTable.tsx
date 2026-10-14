import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { cn } from '@/shared/lib/utils';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Value used for client-side sorting; presence makes the column sortable */
  sortValue?: (row: T) => string | number | null;
  /** Mark as sortable when sorting is server-side (controlled `sort` prop) */
  sortable?: boolean;
  className?: string;
}

export type SortOrder = 'asc' | 'desc';

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  getRowId: (row: T) => string;
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  /** Server-side sorting (controlled). Without it, columns with sortValue sort locally. */
  sort?: { by: string; order: SortOrder; onChange: (by: string, order: SortOrder) => void };
  /** Server-side pagination */
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  onRowClick,
  empty,
  sort,
  pagination,
  rowClassName,
}: DataTableProps<T>) {
  const [localSort, setLocalSort] = useState<{ by: string; order: SortOrder } | null>(null);
  const activeSort = sort ?? localSort;

  const rows = useMemo(() => {
    if (!data || sort || !localSort) return data;
    const column = columns.find((c) => c.id === localSort.by);
    if (!column?.sortValue) return data;
    const dir = localSort.order === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = column.sortValue!(a) ?? '';
      const vb = column.sortValue!(b) ?? '';
      return va < vb ? -dir : va > vb ? dir : 0;
    });
  }, [data, columns, sort, localSort]);

  const toggleSort = (id: string) => {
    const order: SortOrder = activeSort?.by === id && activeSort.order === 'asc' ? 'desc' : 'asc';
    if (sort) sort.onChange(id, order);
    else setLocalSort({ by: id, order });
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => {
                const sortable = col.sortable || (!sort && !!col.sortValue);
                const isSorted = activeSort?.by === col.id;
                const SortIcon = !isSorted
                  ? ArrowUpDown
                  : activeSort.order === 'asc'
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <TableHead
                    key={col.id}
                    className={col.className}
                    aria-sort={
                      isSorted
                        ? activeSort.order === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.id)}
                        className="-ml-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {col.header}
                        <SortIcon className={cn('size-3.5', !isSorted && 'opacity-40')} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !rows
              ? Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {columns.map((col) => (
                      <TableCell key={col.id}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows?.map((row) => (
                  <TableRow
                    key={getRowId(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      onRowClick &&
                        'cursor-pointer focus-visible:bg-muted focus-visible:outline-none',
                      rowClassName?.(row),
                    )}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.id} className={col.className}>
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!isLoading && rows?.length === 0 && (empty ?? <EmptyState title="Nothing here yet" />)}
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              aria-label="Next page"
            >
              Next <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
