import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, ArrowUp, ArrowDown, TableIcon } from 'lucide-react';

export default function DataTable({
  data,
  columns,
  isLoading = false,
  emptyMessage = "No data available",
  getRowClassName = null,
  globalFilter: externalFilter,
  onGlobalFilterChange,
  hideSearch = false,
  searchBarActions = null,
}) {
  const [internalFilter, setInternalFilter] = useState('');
  const globalFilter = externalFilter !== undefined ? externalFilter : internalFilter;
  const setGlobalFilter = onGlobalFilterChange || setInternalFilter;

  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: 'includesString',
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div className="space-y-0">
      {!hideSearch && (
        <div className="flex items-center gap-2 justify-between px-4 py-2 border-b border-border">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          {searchBarActions && (
            <div className="flex items-center gap-2">{searchBarActions}</div>
          )}
        </div>
      )}

      {/* Table — Table component renders its own .data-table-wrapper div */}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                  className={header.column.getCanSort() ? 'cursor-pointer select-none hover:text-foreground' : ''}
                >
                  <div className="flex items-center justify-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'  && <ArrowUp   className="h-3 w-3 text-primary" />}
                    {header.column.getIsSorted() === 'desc' && <ArrowDown  className="h-3 w-3 text-primary" />}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-xs text-muted-foreground">Loading…</p>
                </div>
              </TableCell>
            </TableRow>
          ) : !data || data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-20">
                <div className="flex flex-col items-center gap-2">
                  <TableIcon className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map(row => (
              <TableRow
                key={row.id}
                className={getRowClassName ? getRowClassName(row) : ''}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <div className="flex items-center gap-2">
          <p className="text-[0.75rem] text-muted-foreground">Show</p>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-7 w-[60px] text-[0.75rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 50, 100].map(size => (
                <SelectItem key={size} value={String(size)} className="text-[0.75rem]">{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[0.75rem] text-muted-foreground">
          Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of{' '}
          <strong>{Math.max(1, table.getPageCount())}</strong>
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="h-7 w-7">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-7 w-7">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-7 w-7">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="h-7 w-7">
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
