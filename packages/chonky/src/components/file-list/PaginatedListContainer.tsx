/**
 * @author Timur Kuzhagaliyev <tim.kuzh@gmail.com>
 * @copyright 2020
 * @license MIT
 */

import React, { CSSProperties, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { FixedSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { selectFileViewConfig, selectors } from '../../redux/selectors';
import { FileViewMode } from '../../types/file-view.types';
import { useInstanceVariable } from '../../util/hooks-helpers';
import { makeLocalChonkyStyles } from '../../util/styles';
import { SmartFileEntry } from './FileEntry';

export interface FileListListProps {
    width: number;
    height: number;
    hasNextPage: boolean;
    isNextPageLoading: boolean;
    loadNextPage: (...args: any) => void;
}

export const PaginatedListContainer: React.FC<FileListListProps> = React.memo(props => {
    const { width, height, isNextPageLoading, loadNextPage, hasNextPage } = props;

    const viewConfig = useSelector(selectFileViewConfig);

    const displayFileIds = useSelector(selectors.getDisplayFileIds);
    const displayFileIdsRef = useInstanceVariable(displayFileIds);
    const getItemKey = useCallback(
        (index: number) => displayFileIdsRef.current[index] ?? `loading-file-${index}`,
        [displayFileIdsRef]
    );
    // If there are more items to be loaded then add an extra row to hold a loading indicator.
    const itemCount = hasNextPage ? displayFileIds.length + 1 : displayFileIds.length;

    const isItemLoaded = (index: number) =>
        !hasNextPage || index < displayFileIds.length;
    const loadMoreItems = isNextPageLoading ? () => {} : loadNextPage;

    const classes = useStyles();
    const listComponent = useMemo(() => {
        // When entry size is null, we use List view
        const rowRenderer = (data: { index: number; style: CSSProperties }) => {
            return (
                <div style={data.style}>
                    {!isItemLoaded(data.index) ? (
                        'Loading...'
                    ) : (
                        <SmartFileEntry
                            fileId={displayFileIds[data.index] ?? null}
                            displayIndex={data.index}
                            fileViewMode={FileViewMode.List}
                        />
                    )}
                </div>
            );
        };

        return (
            <InfiniteLoader
                isItemLoaded={isItemLoaded}
                itemCount={itemCount}
                loadMoreItems={loadMoreItems}
            >
                {({ onItemsRendered, ref }) => (
                    <FixedSizeList
                        ref={ref}
                        className={classes.listContainer}
                        itemSize={viewConfig.entryHeight}
                        height={height}
                        itemCount={displayFileIds.length}
                        onItemsRendered={onItemsRendered}
                        width={width}
                        itemKey={getItemKey}
                    >
                        {rowRenderer}
                    </FixedSizeList>
                )}
            </InfiniteLoader>
        );
    }, [
        classes.listContainer,
        viewConfig.entryHeight,
        height,
        displayFileIds,
        width,
        getItemKey,
    ]);

    return listComponent;
});

const useStyles = makeLocalChonkyStyles(theme => ({
    listContainer: {
        borderTop: `solid 1px ${theme.palette.divider}`,
    },
}));
