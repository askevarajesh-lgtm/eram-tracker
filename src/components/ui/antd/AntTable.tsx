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
        defaultPageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50", "100"],
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
                    if (event.defaultPrevented) return;
                    const target = event.target as HTMLElement | null;
                    if (
                        target?.closest(
                            'button, input, select, textarea, a, label, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], .ant-checkbox-wrapper, .ant-checkbox, .ant-select, .ant-btn, .record-actions, [data-no-row-click]'
                        )
                    ) {
                        return;
                    }
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

    const mergedPagination: TablePaginationConfig | false = React.useMemo(() => {
        if (pagination === false) return false;

        const baseDefaults: TablePaginationConfig = {
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total}`,
            size: "small",
        };

        const config = typeof pagination === "object" ? { ...pagination } : {};

        // If pagination is not explicitly controlled (no onChange or onShowSizeChange handler),
        // we must NOT pass a fixed `pageSize` or `current` to antd's Table, because antd treats them
        // as strictly controlled props. When controlled without state updates, antd prevents the user
        // from changing the page size (e.g. 10 -> 20 -> 50) or changing pages.
        // Instead, convert any `pageSize` into `defaultPageSize` and `current` into `defaultCurrent`.
        const isControlled = Boolean(config.onChange || config.onShowSizeChange);

        if (!isControlled) {
            const initialSize = config.pageSize ?? config.defaultPageSize ?? baseDefaults.defaultPageSize;
            const initialCurrent = config.current ?? config.defaultCurrent ?? 1;

            delete config.pageSize;
            delete config.current;

            return {
                ...baseDefaults,
                ...config,
                defaultPageSize: initialSize,
                defaultCurrent: initialCurrent,
            };
        }

        return {
            ...baseDefaults,
            ...config,
        };
    }, [pagination]);

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
