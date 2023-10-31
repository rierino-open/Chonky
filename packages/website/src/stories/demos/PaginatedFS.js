import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    setChonkyDefaults,
    ChonkyActions,
    FileHelper,
    FileBrowser,
    FileContextMenu,
    FileList,
    FileNavbar,
    FileToolbar,
} from 'chonky';
import { ChonkyIconFA } from 'chonky-icon-fontawesome';
import styled from 'styled-components';

import Paper from '@material-ui/core/Paper';

import { StylesProvider, createGenerateClassName } from '@material-ui/core/styles';

export function usePrevious(value) {
    const ref = useRef();
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

const useCustomFileMap = baseFile => {
    const { baseFileMap, rootFolderId } = baseFile;

    const [fileMap, setFileMap] = useState(baseFileMap);
    const [currentFolderId, setCurrentFolderId] = useState(rootFolderId);

    const resetFileMap = useCallback(() => {
        setFileMap(baseFileMap);
        setCurrentFolderId(rootFolderId);
    }, [baseFileMap, rootFolderId]);

    const currentFolderIdRef = useRef(currentFolderId);
    useEffect(() => {
        currentFolderIdRef.current = currentFolderId;
    }, [currentFolderId]);

    const deleteFiles = useCallback(files => {
        setFileMap(currentFileMap => {
            const newFileMap = { ...currentFileMap };

            files.forEach(file => {
                delete newFileMap[file.id];

                // Update the parent folder to make sure it doesn't try to load the
                // file we just deleted.
                if (file.parentId) {
                    const parent = newFileMap[file.parentId];
                    const newChildrenIds = parent.childrenIds.filter(id => id !== file.id);
                    newFileMap[file.parentId] = {
                        ...parent,
                        childrenIds: newChildrenIds,
                        childrenCount: newChildrenIds.length,
                    };
                }
            });

            return newFileMap;
        });
    }, []);

    // Function that will be called when files are moved from one folder to another
    // using drag & drop.
    const moveFiles = useCallback((files, source, destination) => {
        setFileMap(currentFileMap => {
            const newFileMap = { ...currentFileMap };
            const moveFileIds = new Set(files.map(f => f.id));

            const newSourceChildrenIds = source.childrenIds?.filter(id => !moveFileIds.has(id));
            newFileMap[source.id] = {
                ...source,
                childrenIds: newSourceChildrenIds,
                childrenCount: newSourceChildrenIds.length,
            };

            const newDestinationChildrenIds = [...destination.childrenIds, ...files.map(f => f.id)];
            newFileMap[destination.id] = {
                ...destination,
                childrenIds: newDestinationChildrenIds,
                childrenCount: newDestinationChildrenIds.length,
            };

            files.forEach(file => {
                newFileMap[file.id] = {
                    ...file,
                    parentId: destination.id,
                };
            });

            return newFileMap;
        });
    }, []);

    const createFolder = useCallback(folderName => {
        setFileMap(currentFileMap => {
            const newFileMap = { ...currentFileMap };

            return newFileMap;
        });
    }, []);

    return {
        fileMap,
        currentFolderId,
        setCurrentFolderId,
        resetFileMap,
        deleteFiles,
        moveFiles,
        createFolder,
    };
};

export const useFiles = (fileMap, currentFolderId) => {
    return useMemo(() => {
        const currentFolder = fileMap[currentFolderId];
        const childrenIds = currentFolder.childrenIds;
        const files = childrenIds.map(fileId => fileMap[fileId]);
        return files;
    }, [currentFolderId, fileMap]);
};

export const useFolderChain = (fileMap, currentFolderId) => {
    return useMemo(() => {
        const currentFolder = fileMap[currentFolderId];
        const folderChain = [currentFolder];
        let parentId = currentFolder.parentId;

        while (parentId) {
            const parentFile = fileMap[parentId];
            if (parentFile) {
                folderChain.unshift(parentFile);
                parentId = parentFile.parentId;
            } else {
                break;
            }
        }

        return folderChain;
    }, [currentFolderId, fileMap]);
};

export const useFileActionHandler = setCurrentFolderId => {
    return useCallback(
        data => {
            if (data.id === ChonkyActions.OpenFiles.id) {
                const { targetFile, files } = data.payload;
                const fileToOpen = targetFile ?? files[0];
                if (fileToOpen && FileHelper.isDirectory(fileToOpen)) {
                    setCurrentFolderId(fileToOpen.id);
                    return;
                }
            }
        },
        [setCurrentFolderId]
    );
};

const VFSBrowser = props => {
    const { fileMap, currentFolderId, setCurrentFolderId, resetFileMap } = useCustomFileMap(
        props.data && props.data.baseFileMap
            ? props.data
            : {
                  rootFolderId: 'root',
                  baseFileMap: {
                      root: {
                          id: 'root',
                          name: 'Root',
                          isDir: true,
                          modDate: new Date(),
                          parentId: null,
                          childrenIds: [],
                          childrenCount: 0,
                      },
                  },
              }
    );

    const files = useFiles(fileMap, currentFolderId);
    const folderChain = useFolderChain(fileMap, currentFolderId);

    const handleFileAction = useFileActionHandler(setCurrentFolderId);
    const fileActions = useMemo(
        () => [
            // ChonkyActions.CreateFolder,
            // ChonkyActions.DeleteFiles,
            // ChonkyActions.UploadFiles,
            // ChonkyActions.DownloadFiles,
        ],
        []
    );
    const prevCurrentFolderId = usePrevious(currentFolderId);

    useEffect(() => {
        resetFileMap(props.data);
    }, [props.data]);

    useEffect(() => {
        if (prevCurrentFolderId == undefined && currentFolderId == 'root') {
            return;
        }

        props.listFolderContents && props.listFolderContents(props.fileSystem, currentFolderId);
    }, [currentFolderId, props.fileSystem]);

    const generateClassName = createGenerateClassName({
        seed: 'fb',
    });

    return (
        <>
            <div style={{ height: '50vh' }}>
                <StylesProvider generateClassName={generateClassName}>
                    <FileBrowser
                        files={props.loading ? [null] : files}
                        folderChain={folderChain}
                        fileActions={fileActions}
                        onFileAction={handleFileAction}
                        {...props}
                    >
                        <FileNavbar />
                        <FileToolbar />
                        <FileList
                            paginated={props.paginated}
                            hasNextPage={props.hasNextPage}
                            isNextPageLoading={props.isNextPageLoading}
                            loadNextPage={props.loadNextPage}
                        />
                        <FileContextMenu />
                    </FileBrowser>
                </StylesProvider>
            </div>
        </>
    );
};

// import DemoFsMap from './demo.fs_map.json';

setChonkyDefaults({ iconComponent: ChonkyIconFA });

const StyledWrapper = styled.div`
    .chonky-wrapper {
        max-width: 960px;
        height: 400px;
    }
    .story-controls {
        display: inline-block;
        margin-top: 10px;
        padding: 10px;
    }
`;

const StoryComponent = () => {
    const [files, setFiles] = React.useState({
        rootFolderId: 'root',
        baseFileMap: {
            root: {
                id: 'root',
                name: 'Root',
                isDir: true,
                childrenIds: [],
                childrenCount: 0,
            },
        },
    });
    const [loading, setLoading] = React.useState(false);
    const [folderPath, setFolderPath] = React.useState(null);
    const [page, setPage] = React.useState(0);
    const [hasNextPage, setHasNextPage] = React.useState(false);
    const [isNextPageLoading, setIsNextPageLoading] = React.useState(false);
    const fileSystem = 'fs_local';

    const listFolderContents = (fsName, folderPath = '') => {
        //Set to loading animation
        setLoading(true);
        fetch(`https://cdn.ata.ooo/files.json`).then(response => {
            if (response.status === 200) {
                response.json().then(res => {
                    const data = res?.list;
                    const rootFolderId = folderPath === '' ? 'root' : folderPath;
                    setFolderPath(rootFolderId);

                    const newBaseFileMap = {
                        root: {
                            id: 'root',
                            name: 'Root',
                            isDir: true,
                            childrenIds: [],
                            childrenCount: 0,
                        },
                    };

                    const pathSplit = rootFolderId.split('/');
                    const folderName = rootFolderId === 'root' ? 'Root' : pathSplit[pathSplit.length - 1];

                    if (rootFolderId !== 'root') {
                        var pathSoFar = null;
                        for (const p in pathSplit) {
                            const currentPath = pathSplit[p];
                            const parentPath = pathSoFar || 'root';
                            pathSoFar = (pathSoFar ? pathSoFar + '/' : '') + currentPath;
                            newBaseFileMap[pathSoFar] = {
                                id: pathSoFar,
                                name: currentPath,
                                isDir: true,
                                childrenIds: [],
                                childrenCount: 0,
                                parentId: parentPath,
                            };
                        }
                    }

                    data.forEach(file => {
                        const fileId = rootFolderId === 'root' ? file.fileName : `${rootFolderId}/${file.fileName}`;

                        const thumbExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
                        const splits = fileId?.split('.');
                        const fileExtension = splits ? splits[splits.length - 1] : null;
                        var thumbnailUrl = null;

                        newBaseFileMap[fileId] = {
                            id: fileId,
                            name: file.fileName,
                            isDir: file.type === 'folder',
                            size: file.size,
                            modDate: file.lastModified || new Date(),
                            parentId: rootFolderId,
                            childrenIds: [],
                            thumbnailUrl: thumbnailUrl,
                        };

                        if (newBaseFileMap[rootFolderId].childrenIds.includes(fileId)) {
                            return;
                        }

                        newBaseFileMap[rootFolderId].childrenIds.push(fileId);
                        newBaseFileMap[rootFolderId].childrenCount = newBaseFileMap[rootFolderId].childrenCount + 1;
                    });

                    setFiles({ rootFolderId: rootFolderId, baseFileMap: newBaseFileMap });
                    setPage(0);
                    setHasNextPage(res.list.length < res.totalCount);
                    setLoading(false);
                });
            }
        });
    };

    const loadNextPage = () => {
        setIsNextPageLoading(true);
        setPage(page + 1);
    };
    React.useEffect(() => {
        if (page > 0 && hasNextPage) {
            fetch(`https://cdn.ata.ooo/files${page + 1}.json`).then(response => {
                if (response.status === 200) {
                    response.json().then(res => {
                        const data = res?.list;
                        const rootFolderId = folderPath;

                        const newBaseFileMap = JSON.parse(JSON.stringify(files.baseFileMap));

                        data.forEach(file => {
                            const fileId = rootFolderId === 'root' ? file.fileName : `${rootFolderId}/${file.fileName}`;

                            var thumbnailUrl = null;

                            newBaseFileMap[fileId] = {
                                id: fileId,
                                name: file.fileName,
                                isDir: file.type === 'folder',
                                size: file.size,
                                modDate: file.lastModified || new Date(),
                                parentId: rootFolderId,
                                childrenIds: [],
                                thumbnailUrl: thumbnailUrl,
                            };

                            if (newBaseFileMap[rootFolderId].childrenIds.includes(fileId)) {
                                return;
                            }

                            newBaseFileMap[rootFolderId].childrenIds.push(fileId);
                            newBaseFileMap[rootFolderId].childrenCount = newBaseFileMap[rootFolderId].childrenCount + 1;
                        });

                        setFiles({
                            rootFolderId: files.rootFolderId,
                            baseFileMap: newBaseFileMap,
                        });
                        setHasNextPage(files.baseFileMap.length < res.totalCount);
                        setLoading(false);
                        setIsNextPageLoading(false);
                    });
                }
            });
        }
    }, [page]);

    const createDirectory = (fsName, currentFolderId, folderPath = '') => {};

    const deleteFile = (fsName, currentFolderId, files) => {};

    const uploadFile = (fsName, currentFolderId, file, fileName) => {};

    const downloadFile = (fsName, currentFolderId, files) => {};

    React.useEffect(() => {
        var folder = '';
        listFolderContents(fileSystem, folder);
    }, []);

    return (
        <StyledWrapper>
            <div style={{ height: '50vh' }}>
                <VFSBrowser
                    data={files || null}
                    onChange={() => {}}
                    // multi={props.multi}
                    listFolderContents={listFolderContents}
                    loading={loading}
                    onCreateFolder={createDirectory}
                    onDelete={deleteFile}
                    onUpload={uploadFile}
                    onDownload={downloadFile}
                    fileSystem={fileSystem}
                    paginated={true}
                    hasNextPage={hasNextPage}
                    isNextPageLoading={isNextPageLoading}
                    loadNextPage={loadNextPage}
                />
            </div>
            <Paper className="story-controls"></Paper>
        </StyledWrapper>
    );
};

StoryComponent.displayName = 'Paginated FS';
export const PaginatedFS = StoryComponent;
