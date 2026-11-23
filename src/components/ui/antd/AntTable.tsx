"use client";

import React from "react";
import { Table, Empty } from "antd";
import type { TableProps, TablePaginationConfig } from "antd";
import type { ColumnsType } from "antd/es/table";

export type AntTableProps<T extends object = any> = Omit<TableProps<T>, "onRow"> & {
  onRowClick?: (record: T, index?: number, event?: React.MouseEvent) => void;
  onRow?: TableProps<T>["onRow"];
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  emptyText?: React.ReactNode;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
};

export function AntTable<T extends object = any>({
  columns,
  dataSource,
  rowKey = "id" as any,
  pagination = {
    pageSize: 15,
    showSizeChanger: true,
    pageSizeOptions: ["10", "15", "25", "50", "100"],
    showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total}`,
    size: "small",
  },
  onRowClick,
  onRow,
  rowClassName,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyText,
  scroll,
  bordered = false,
  size = "middle",
  wrapperClassName,
  wrapperStyle,
  className,
  locale,
  ...rest
}: AntTableProps<T>) {
  const customEmpty = (
    <div style={{ padding: "32px 16px", textAlign: "center" }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div style={{ marginTop: 6 }}>
            {emptyTitle && (
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--fg)", marginBottom: 4 }}>
                {emptyTitle}
              </div>
            )}
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              {emptyDescription ?? emptyText ?? "No records found matching current criteria"}
            </div>
            {emptyAction && <div style={{ marginTop: 12 }}>{emptyAction}</div>}
          </div>
        }
      />
    </div>
  );

  const mergedOnRow: TableProps<T>["onRow"] = (record, index) => {
    const base = onRow ? onRow(record, index) : {};
    if (onRowClick) {
      return {
        ...base,
        onClick: (event: React.MouseEvent) => {
          base.onClick?.(event);
          onRowClick(record, index, event);
        },
      };
    }
    return base;
  };

  const mergedRowClassName = (record: T, index: number, indent: number): string => {
    const custom = typeof rowClassName === "function" ? rowClassName(record, index, indent) : (rowClassName ?? "");
    return [custom, onRowClick ? "ant-table-row-clickable" : ""].filter(Boolean).join(" ");
  };

  const mergedPagination: TablePaginationConfig | false =
    pagination === false
      ? false
      : {
          pageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ["10", "15", "25", "50", "100"],
          showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total}`,
          size: "small",
          ...pagination,
        };

  return (
    <div className={`crm-table-wrapper ${wrapperClassName ?? ""}`} style={wrapperStyle}>
      <Table<T>
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKey}
        pagination={mergedPagination}
        onRow={mergedOnRow}
        rowClassName={mergedRowClassName}
        scroll={scroll}
        bordered={bordered}
        size={size}
        className={className}
        locale={{
          emptyText: customEmpty,
          ...locale,
        }}
        {...rest}
      />
    </div>
  );
}

AntTable.Summary = Table.Summary;

export { Table };
export type { ColumnsType };
