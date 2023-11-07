/**
 * @author Timur Kuzhagaliyev <tim.kuzh@gmail.com>
 * @copyright 2020
 * @license MIT
 */

import React, {
    CSSProperties,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useSelector } from 'react-redux';
import { FixedSizeGrid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { ChonkyActions } from '../../action-definitions';
import { selectFileViewConfig, selectors } from '../../redux/selectors';
import { FileViewConfigGrid } from '../../types/file-view.types';
import { RootState } from '../../types/redux.types';
import { useInstanceVariable } from '../../util/hooks-helpers';
import { makeGlobalChonkyStyles, useIsMobileBreakpoint } from '../../util/styles';
import { SmartFileEntry } from './FileEntry';

export interface FileListGridProps {
    width: number;
    height: number;
    hasNextPage: boolean;
    isNextPageLoading: boolean;
    loadNextPage: (...args: any) => void;
}

interface GridConfig {
    rowCount: number;
    columnCount: number;
    gutter: number;
    rowHeight: number;
    columnWidth: number;
}

export const isMobileDevice = () => {
    // noinspection JSDeprecatedSymbols
    return (
        typeof window.orientation !== 'undefined' ||
        navigator.userAgent.indexOf('IEMobile') !== -1
    );
};

export const getGridConfig = (
    width: number,
    fileCount: number,
    viewConfig: FileViewConfigGrid,
    isMobileBreakpoint: boolean
): GridConfig => {
    const gutter = isMobileBreakpoint ? 5 : 15;
    const scrollbar = isMobileDevice() ? 0 : 18;

    let columnCount: number;
    let columnWidth: number;
    if (isMobileBreakpoint) {
        columnCount = 2;
        columnWidth = (width - gutter - scrollbar) / columnCount;
    } else {
        columnWidth = viewConfig.entryWidth;
        columnCount = Math.max(
            1,
            Math.floor((width - scrollbar) / (columnWidth + gutter))
        );
    }

    const rowCount = Math.ceil(fileCount / columnCount);

    return {
        rowCount,
        columnCount,
        gutter,
        rowHeight: viewConfig.entryHeight,
        columnWidth,
    };
};

export const PaginatedGridContainer: React.FC<FileListGridProps> = React.memo(props => {
    const { width, height, isNextPageLoading, loadNextPage, hasNextPage } = props;

    const viewConfig = useSelector(selectFileViewConfig) as FileViewConfigGrid;
    const displayFileIds = useSelector(selectors.getDisplayFileIds);
    const fileCount = useMemo(() => displayFileIds.length, [displayFileIds]);

    const gridRef = useRef<FixedSizeGrid>();
    const isMobileBreakpoint = useIsMobileBreakpoint();

    // If there are more items to be loaded then add an extra row to hold a loading indicator.
    const itemCount = hasNextPage ? displayFileIds.length + 1 : displayFileIds.length;

    const isItemLoaded = (index: number) =>
        !hasNextPage || index < displayFileIds.length;
    const loadMoreItems = isNextPageLoading ? () => {} : loadNextPage;

    // Whenever the grid config changes at runtime, we call a method on the
    // `FixedSizeGrid` handle to reset column width/row height cache.
    // !!! Note that we deliberately update the `gridRef` firsts and update the React
    //     state AFTER that. This is needed to avoid file entries jumping up/down.
    const [gridConfig, setGridConfig] = useState(
        getGridConfig(width, fileCount, viewConfig, isMobileBreakpoint)
    );
    const gridConfigRef = useRef(gridConfig);
    useEffect(() => {
        setGridConfig(getGridConfig(width, fileCount, viewConfig, isMobileBreakpoint));
    }, [
        setGridConfig,
        gridConfigRef,
        isMobileBreakpoint,
        width,
        viewConfig,
        fileCount,
    ]);

    const sizers = useMemo(() => {
        const gc = gridConfigRef;
        return {
            getColumnWidth: (index: number) =>
                gc.current.columnWidth! +
                (index === gc.current.columnCount - 1 ? 0 : gc.current.gutter),
            getRowHeight: (index: number) =>
                gc.current.rowHeight +
                (index === gc.current.rowCount - 1 ? 0 : gc.current.gutter),
        };
    }, [gridConfigRef]);

    const displayFileIdsRef = useInstanceVariable(
        useSelector(selectors.getDisplayFileIds)
    );
    const getItemKey = useCallback(
        (data: { columnIndex: number; rowIndex: number; data: any }) => {
            const index =
                data.rowIndex * gridConfigRef.current.columnCount + data.columnIndex;

            return displayFileIdsRef.current[index] ?? `loading-file-${index}`;
        },
        [gridConfigRef, displayFileIdsRef]
    );

    const cellRenderer = useCallback(
        (data: { rowIndex: number; columnIndex: number; style: CSSProperties }) => {
            const gc = gridConfigRef;
            const index = data.rowIndex * gc.current.columnCount + data.columnIndex;
            const fileId = displayFileIds[index];
            if (displayFileIds[index] === undefined) return null;

            const styleWithGutter: CSSProperties = {
                ...data.style,
                paddingRight:
                    data.columnIndex === gc.current.columnCount - 1
                        ? 0
                        : gc.current.gutter,
                paddingBottom:
                    gc.current.gutter,
                boxSizing: 'border-box',
            };

            return (
                <div style={styleWithGutter}>
                    <SmartFileEntry
                        fileId={fileId ?? null}
                        displayIndex={index}
                        fileViewMode={viewConfig.mode}
                    />
                </div>
            );
        },
        [displayFileIds, viewConfig.mode]
    );

    const classes = useStyles();
    const gridComponent = useMemo(() => {
        return (
            <InfiniteLoader
                isItemLoaded={isItemLoaded}
                itemCount={itemCount}
                loadMoreItems={loadMoreItems}
            >
                {({ onItemsRendered, ref }) => (
                    <FixedSizeGrid
                        ref={node => {
                            gridRef.current = node as FixedSizeGrid;
                            ref(node as FixedSizeGrid);
                        }}
                        className={classes.gridContainer}
                        rowHeight={gridConfig.rowHeight + gridConfig.gutter}
                        columnWidth={gridConfig.columnWidth + gridConfig.gutter}
                        columnCount={gridConfig.columnCount}
                        height={height}
                        rowCount={gridConfig.rowCount}
                        width={width}
                        itemKey={getItemKey}
                        onItemsRendered={gridProps => {
                            onItemsRendered({
                                overscanStartIndex:
                                    gridProps.overscanRowStartIndex *
                                    gridConfig.columnCount,
                                overscanStopIndex:
                                    gridProps.overscanRowStopIndex *
                                    gridConfig.columnCount,
                                visibleStartIndex:
                                    gridProps.visibleRowStartIndex *
                                    gridConfig.columnCount,
                                visibleStopIndex:
                                    gridProps.visibleRowStopIndex *
                                    gridConfig.columnCount,
                            });
                        }}
                    >
                        {cellRenderer}
                    </FixedSizeGrid>
                )}
            </InfiniteLoader>
        );
    }, [
        classes.gridContainer,
        gridConfig.rowHeight,
        gridConfig.gutter,
        gridConfig.columnWidth,
        gridConfig.columnCount,
        gridConfig.rowCount,
        sizers.getRowHeight,
        sizers.getColumnWidth,
        height,
        width,
        getItemKey,
        cellRenderer,
    ]);

    return gridComponent;
});

const useStyles = makeGlobalChonkyStyles(() => ({
    gridContainer: {},
}));
