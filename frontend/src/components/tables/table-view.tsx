"use client"

import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { DatabaseZapIcon } from "lucide-react"
import React, { useEffect, useState } from "react"
import type { TableColumnRead, TableRead, TableRowRead } from "@/client"
import { DataTable } from "@/components/data-table"
import { JsonViewWithControls } from "@/components/json-viewer"
import { TableViewAction } from "@/components/tables/table-view-action"
import { TableViewColumnMenu } from "@/components/tables/table-view-column-menu"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useTablesPagination } from "@/hooks/pagination/use-tables-pagination"
import { useWorkspace } from "@/providers/workspace"

function CollapsibleText({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(0)

  // Measure container width on mount and when window resizes
  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [])

  // Estimate characters per line based on container width (assumes monospace font)
  // Adjust the divisor based on your font metrics
  const charsPerLine = Math.max(25, Math.floor(containerWidth / 7))

  if (!isExpanded) {
    return (
      <div ref={containerRef} className="flex items-center">
        <span className="truncate text-xs">
          {text.substring(0, charsPerLine)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="h-6 px-1 text-xs text-muted-foreground hover:bg-transparent"
        >
          ...
        </Button>
      </div>
    )
  }

  // Format the text into chunks based on available width
  const chunks = []
  for (let i = 0; i < text.length; i += charsPerLine) {
    chunks.push(text.substring(i, i + charsPerLine))
  }

  return (
    <div ref={containerRef} className="space-y-1">
      <pre className="whitespace-pre-wrap text-xs">{chunks.join("\n")}</pre>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(false)}
        className="h-6 px-2 text-xs text-muted-foreground"
      >
        Collapse
      </Button>
    </div>
  )
}

export function DatabaseTable({
  table: { id, name, columns },
}: {
  table: TableRead
}) {
  const { workspaceId } = useWorkspace()
  const [pageSize, setPageSize] = useState(20)

  const {
    data: rows,
    isLoading: rowsIsLoading,
    error: rowsError,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    hasNextPage,
    hasPreviousPage,
    currentPage,
    totalEstimate,
    startItem,
    endItem,
  } = useTablesPagination({
    tableId: id,
    workspaceId,
    limit: pageSize,
  })

  useEffect(() => {
    if (id) {
      document.title = `${name} | Tables`
    }
  }, [id, name])

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    goToFirstPage()
  }

  type CellT = CellContext<TableRowRead, TableColumnRead>
  const allColumns: ColumnDef<TableRowRead, TableColumnRead>[] = [
    ...columns.map((column) => ({
      accessorKey: column.name,
      header: () => (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-foreground/90">
            {column.name}
          </span>
          <span className="lowercase text-muted-foreground">{column.type}</span>
          {column.is_index && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
              <DatabaseZapIcon className="mr-1 size-3" />
              Index
            </span>
          )}
          <TableViewColumnMenu column={column} />
        </div>
      ),
      cell: ({ row }: CellT) => {
        const value = row.original[column.name as keyof TableRowRead]
        return (
          <div className="w-full text-xs">
            {typeof value === "object" && value ? (
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation()
                  }
                }}
                className="w-full cursor-default text-left"
              >
                <TooltipProvider>
                  <JsonViewWithControls src={value} />
                </TooltipProvider>
              </button>
            ) : typeof value === "string" && value.length > 25 ? (
              <CollapsibleText text={String(value)} />
            ) : (
              <pre className="text-xs">{String(value)}</pre>
            )}
          </div>
        )
      },
      enableSorting: true,
      enableHiding: true,
    })),
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }: CellT) => <TableViewAction row={row} />,
    },
  ]

  return (
    <DataTable<TableRowRead, TableColumnRead>
      isLoading={rowsIsLoading}
      error={rowsError ?? undefined}
      data={rows}
      emptyMessage="No rows found."
      errorMessage="Error loading rows."
      columns={allColumns}
      serverSidePagination={{
        currentPage,
        hasNextPage,
        hasPreviousPage,
        pageSize,
        totalEstimate,
        startItem,
        endItem,
        onNextPage: goToNextPage,
        onPreviousPage: goToPreviousPage,
        onFirstPage: goToFirstPage,
        onPageSizeChange: handlePageSizeChange,
        isLoading: rowsIsLoading,
      }}
    />
  )
}
