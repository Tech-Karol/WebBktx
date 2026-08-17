/*
 * ============================================================
 * WebBktx XFile
 *
 * Version: 1.0
 *
 * Xbox Virtual File System / File API
 *
 * Designed for:
 *
 *   kernel.js
 *   thunks.js
 *   xapi.js
 *   memory.js
 *   xbe.js
 *
 * Features:
 *
 *   - Xbox-style virtual paths
 *   - Local game files
 *   - In-memory files
 *   - File handles
 *   - Open / close
 *   - Read / write
 *   - Seek
 *   - EOF
 *   - File size
 *   - File information
 *   - Directory enumeration
 *   - Mount points
 *   - XBE file access
 *   - Async host-file import
 *   - Safe path normalization
 *   - No PWA
 *   - No Cache API
 *   - No network requirement
 *
 * ============================================================
 */

"use strict";


/* ============================================================
   VERSION
============================================================ */

const WEBBKTX_XFILE_VERSION = "1.0";


/* ============================================================
   CONSTANTS
============================================================ */

const XFILE_ACCESS = {

    READ:  0x00000001,
    WRITE: 0x00000002,
    READ_WRITE: 0x00000003

};


const XFILE_OPEN = {

    EXISTING: 0,
    CREATE: 1,
    CREATE_ALWAYS: 2,
    OPEN_ALWAYS: 3

};


const XFILE_SEEK = {

    SET: 0,
    CURRENT: 1,
    END: 2

};


const XFILE_ATTRIBUTES = {

    NORMAL: 0x00000080,
    DIRECTORY: 0x00000010,
    READONLY: 0x00000001

};


/* ============================================================
   ERROR CODES
============================================================ */

const XFILE_ERROR = {

    SUCCESS: 0,

    FILE_NOT_FOUND: 2,
    PATH_NOT_FOUND: 3,
    ACCESS_DENIED: 5,
    INVALID_HANDLE: 6,
    INVALID_PARAMETER: 87,
    ALREADY_EXISTS: 183,
    NO_MORE_FILES: 18,
    END_OF_FILE: 38,
    DISK_FULL: 112,
    NOT_SUPPORTED: 50

};


/* ============================================================
   HELPERS
============================================================ */

function xfileNormalizePath(path) {

    if (path === null || path === undefined) {

        throw new TypeError(
            "XFile path is required."
        );

    }


    path = String(path);

    path =
        path
            .replace(/\\/g, "/")
            .trim();


    /*
     * Xbox paths commonly look like:
     *
     * D:\game\default.xbe
     * T:\data\file.dat
     * E:\default.xbe
     *
     * Internally we normalize them.
     */

    if (
        !path.includes(":")
    ) {

        path =
            "D:/" +
            path.replace(/^\/+/, "");

    }


    /*
     * Normalize drive letter.
     */

    if (
        /^[a-zA-Z]:/.test(path)
    ) {

        path =
            path[0].toUpperCase() +
            path.slice(1);

    }


    /*
     * Remove duplicate slashes.
     */

    path =
        path.replace(
            /\/+/g,
            "/"
        );


    /*
     * Resolve "." and "..".
     */

    const parts =
        path.split("/");


    const result = [];


    for (
        const part of parts
    ) {

        if (
            !part ||
            part === "."
        ) {

            continue;

        }


        if (
            part === ".."
        ) {

            if (
                result.length > 1
            ) {

                result.pop();

            }

            continue;

        }


        result.push(part);

    }


    if (
        result.length === 0
    ) {

        return "D:/";

    }


    /*
     * Drive root.
     */

    if (
        /^[A-Z]:$/.test(result[0])
    ) {

        return result[0] + "/";

    }


    return result.join("/");

}


function xfileParentPath(path) {

    path =
        xfileNormalizePath(path);


    const index =
        path.lastIndexOf("/");


    if (
        index <= 2
    ) {

        return path.slice(
            0,
            3
        );

    }


    return path.slice(
        0,
        index
    );

}


function xfileFileName(path) {

    path =
        xfileNormalizePath(path);


    const index =
        path.lastIndexOf("/");


    if (
        index === -1
    ) {

        return path;

    }


    return path.slice(
        index + 1
    );

}


function xfileNow() {

    return Date.now();

}


function xfileToUint8Array(data) {

    if (
        data instanceof Uint8Array
    ) {

        return new Uint8Array(
            data
        );

    }


    if (
        data instanceof ArrayBuffer
    ) {

        return new Uint8Array(
            data.slice(0)
        );

    }


    if (
        ArrayBuffer.isView(data)
    ) {

        return new Uint8Array(
            data.buffer.slice(
                data.byteOffset,
                data.byteOffset +
                data.byteLength
            )
        );

    }


    if (
        typeof data === "string"
    ) {

        return new TextEncoder().encode(
            data
        );

    }


    throw new TypeError(
        "Unsupported file data type."
    );

}


/* ============================================================
   XFILE ENTRY
============================================================ */

class WebBktxXFileEntry {

    constructor(
        path,
        data = null,
        options = {}
    ) {

        this.path =
            xfileNormalizePath(
                path
            );


        this.name =
            xfileFileName(
                this.path
            );


        this.directory =
            options.directory === true;


        this.attributes =
            options.attributes !== undefined
                ? options.attributes
                : (
                    this.directory
                        ? XFILE_ATTRIBUTES.DIRECTORY
                        : XFILE_ATTRIBUTES.NORMAL
                );


        this.created =
            options.created ||
            xfileNow();


        this.modified =
            options.modified ||
            this.created;


        this.accessed =
            options.accessed ||
            this.created;


        this.data =
            this.directory
                ? null
                : (
                    data
                        ? xfileToUint8Array(data)
                        : new Uint8Array(0)
                );

    }


    get size() {

        if (
            this.directory
        ) {

            return 0;

        }


        return this.data.length;

    }


    isDirectory() {

        return this.directory;

    }


    isFile() {

        return !this.directory;

    }


    read(
        offset,
        length
    ) {

        if (
            this.directory
        ) {

            throw new Error(
                "Cannot read a directory."
            );

        }


        offset =
            Math.max(
                0,
                offset | 0
            );


        length =
            Math.max(
                0,
                length | 0
            );


        if (
            offset >=
            this.data.length
        ) {

            return new Uint8Array(0);

        }


        const end =
            Math.min(
                offset + length,
                this.data.length
            );


        this.accessed =
            xfileNow();


        return this.data.slice(
            offset,
            end
        );

    }


    write(
        offset,
        bytes
    ) {

        if (
            this.directory
        ) {

            throw new Error(
                "Cannot write a directory."
            );

        }


        offset =
            Math.max(
                0,
                offset | 0
            );


        bytes =
            xfileToUint8Array(
                bytes
            );


        const requiredSize =
            offset +
            bytes.length;


        if (
            requiredSize >
            this.data.length
        ) {

            const newData =
                new Uint8Array(
                    requiredSize
                );


            newData.set(
                this.data,
                0
            );


            this.data =
                newData;

        }


        this.data.set(
            bytes,
            offset
        );


        this.modified =
            xfileNow();


        this.accessed =
            this.modified;


        return bytes.length;

    }


    truncate(
        size
    ) {

        if (
            this.directory
        ) {

            throw new Error(
                "Cannot truncate a directory."
            );

        }


        size =
            Math.max(
                0,
                size | 0
            );


        if (
            size ===
            this.data.length
        ) {

            return;

        }


        const newData =
            new Uint8Array(
                size
            );


        newData.set(
            this.data.subarray(
                0,
                Math.min(
                    size,
                    this.data.length
                )
            )
        );


        this.data =
            newData;


        this.modified =
            xfileNow();

    }


    info() {

        return {

            path:
                this.path,

            name:
                this.name,

            size:
                this.size,

            directory:
                this.directory,

            attributes:
                this.attributes,

            created:
                this.created,

            modified:
                this.modified,

            accessed:
                this.accessed

        };

    }

}


/* ============================================================
   XFILE HANDLE
============================================================ */

class WebBktxXFileHandle {

    constructor(
        id,
        entry,
        access
    ) {

        this.id =
            id;


        this.entry =
            entry;


        this.access =
            access;


        this.position =
            0;


        this.closed =
            false;


        this.created =
            xfileNow();

    }


    canRead() {

        return (
            (this.access &
                XFILE_ACCESS.READ) !== 0
        );

    }


    canWrite() {

        return (
            (this.access &
                XFILE_ACCESS.WRITE) !== 0
        );

    }


    ensureOpen() {

        if (
            this.closed
        ) {

            throw new Error(
                "XFile handle is closed."
            );

        }

    }


    read(
        length
    ) {

        this.ensureOpen();


        if (
            !this.canRead()
        ) {

            throw new Error(
                "File was not opened for reading."
            );

        }


        const bytes =
            this.entry.read(
                this.position,
                length
            );


        this.position +=
            bytes.length;


        return bytes;

    }


    write(
        bytes
    ) {

        this.ensureOpen();


        if (
            !this.canWrite()
        ) {

            throw new Error(
                "File was not opened for writing."
            );

        }


        const written =
            this.entry.write(
                this.position,
                bytes
            );


        this.position +=
            written;


        return written;

    }


    seek(
        offset,
        origin =
            XFILE_SEEK.SET
    ) {

        this.ensureOpen();


        offset =
            Number(offset);


        if (
            !Number.isFinite(offset)
        ) {

            throw new Error(
                "Invalid seek offset."
            );

        }


        let newPosition;


        switch (origin) {

            case XFILE_SEEK.SET:

                newPosition =
                    offset;

                break;


            case XFILE_SEEK.CURRENT:

                newPosition =
                    this.position +
                    offset;

                break;


            case XFILE_SEEK.END:

                newPosition =
                    this.entry.size +
                    offset;

                break;


            default:

                throw new Error(
                    "Invalid seek origin."
                );

        }


        newPosition =
            Math.max(
                0,
                Math.floor(
                    newPosition
                )
            );


        this.position =
            newPosition;


        return this.position;

    }


    tell() {

        this.ensureOpen();

        return this.position;

    }


    eof() {

        this.ensureOpen();

        return (
            this.position >=
            this.entry.size
        );

    }


    close() {

        this.closed =
            true;

    }


    info() {

        this.ensureOpen();


        return {

            handle:
                this.id,

            path:
                this.entry.path,

            position:
                this.position,

            size:
                this.entry.size,

            access:
                this.access,

            eof:
                this.eof()

        };

    }

}


/* ============================================================
   XFILE SYSTEM
============================================================ */

class WebBktxXFile {

    constructor(
        options = {}
    ) {

        this.version =
            WEBBKTX_XFILE_VERSION;


        this.entries =
            new Map();


        this.handles =
            new Map();


        this.nextHandle =
            1;


        this.mounts =
            new Map();


        this.lastError =
            XFILE_ERROR.SUCCESS;


        this.readOnly =
            options.readOnly === true;


        this.debug =
            options.debug === true;


        /*
         * Standard Xbox-style drives.
         */

        this.createMount(
            "C:",
            {
                type: "memory",
                writable: !this.readOnly
            }
        );


        this.createMount(
            "D:",
            {
                type: "game",
                writable: false
            }
        );


        this.createMount(
            "E:",
            {
                type: "memory",
                writable: !this.readOnly
            }
        );


        this.createMount(
            "T:",
            {
                type: "memory",
                writable: !this.readOnly
            }
        );


        this.log(
            "XFile 1.0 initialized."
        );

    }


    /* ========================================================
       LOG
    ======================================================== */

    log(
        message,
        data = null
    ) {

        if (
            !this.debug
        ) {

            return;

        }


        if (
            data !== null
        ) {

            console.log(
                `[WebBktx XFile] ${message}`,
                data
            );

        } else {

            console.log(
                `[WebBktx XFile] ${message}`
            );

        }

    }


    /* ========================================================
       ERROR
    ======================================================== */

    setError(
        error
    ) {

        this.lastError =
            error;


        return false;

    }


    getLastError() {

        return this.lastError;

    }


    clearError() {

        this.lastError =
            XFILE_ERROR.SUCCESS;

    }


    /* ========================================================
       MOUNTS
    ======================================================== */

    createMount(
        drive,
        options = {}
    ) {

        drive =
            String(drive)
                .replace(
                    /[\\/]+$/,
                    ""
                )
                .toUpperCase();


        if (
            !/^[A-Z]:$/.test(drive)
        ) {

            throw new Error(
                `Invalid drive: ${drive}`
            );

        }


        this.mounts.set(
            drive,
            {

                drive,

                type:
                    options.type ||
                    "memory",

                writable:
                    options.writable !== false,

                source:
                    options.source ||
                    null

            }
        );


        /*
         * Make sure root directory exists.
         */

        const root =
            drive + "/";


        if (
            !this.entries.has(root)
        ) {

            this.entries.set(
                root,
                new WebBktxXFileEntry(
                    root,
                    null,
                    {
                        directory: true
                    }
                )
            );

        }


        return true;

    }


    removeMount(
        drive
    ) {

        drive =
            String(drive)
                .toUpperCase();


        this.mounts.delete(
            drive
        );

    }


    getMount(
        path
    ) {

        path =
            xfileNormalizePath(
                path
            );


        const drive =
            path.slice(
                0,
                2
            )
            .toUpperCase();


        return (
            this.mounts.get(
                drive
            ) ||
            null
        );

    }


    /* ========================================================
       PATH
    ======================================================== */

    normalizePath(
        path
    ) {

        return xfileNormalizePath(
            path
        );

    }


    /* ========================================================
       DIRECTORY CREATION
    ======================================================== */

    ensureDirectory(
        path
    ) {

        path =
            xfileNormalizePath(
                path
            );


        const drive =
            path.slice(
                0,
                2
            );


        if (
            !this.mounts.has(
                drive
            )
        ) {

            this.createMount(
                drive
            );

        }


        const parts =
            path.split("/");


        let current =
            parts[0] + "/";


        for (
            let i = 1;
            i < parts.length;
            i++
        ) {

            if (
                !parts[i]
            ) {

                continue;

            }


            current +=
                parts[i] +
                "/";


            if (
                !this.entries.has(
                    current
                )
            ) {

                this.entries.set(
                    current,
                    new WebBktxXFileEntry(
                        current,
                        null,
                        {
                            directory: true
                        }
                    )
                );

            }

        }


        return true;

    }


    /* ========================================================
       ADD FILE
    ======================================================== */

    addFile(
        path,
        data,
        options = {}
    ) {

        path =
            xfileNormalizePath(
                path
            );


        const mount =
            this.getMount(
                path
            );


        if (
            !mount
        ) {

            this.setError(
                XFILE_ERROR.PATH_NOT_FOUND
            );


            return false;

        }


        if (
            !mount.writable &&
            options.force !== true
        ) {

            /*
             * D: is normally the game/DVD image.
             * Files can still be imported there using
             * the explicit force option.
             */

            if (
                mount.type !== "game"
            ) {

                this.setError(
                    XFILE_ERROR.ACCESS_DENIED
                );


                return false;

            }

        }


        this.ensureDirectory(
            xfileParentPath(
                path
            )
        );


        const entry =
            new WebBktxXFileEntry(
                path,
                data,
                options
            );


        this.entries.set(
            path,
            entry
        );


        this.clearError();


        this.log(
            "File added.",
            {
                path,
                size:
                    entry.size
            }
        );


        return entry;

    }


    /* ========================================================
       ADD DIRECTORY
    ======================================================== */

    addDirectory(
        path
    ) {

        this.ensureDirectory(
            path
        );


        return this.entries.get(
            xfileNormalizePath(path)
        );

    }


    /* ========================================================
       REMOVE
    ======================================================== */

    remove(
        path
    ) {

        path =
            xfileNormalizePath(
                path
            );


        const entry =
            this.entries.get(
                path
            );


        if (
            !entry
        ) {

            this.setError(
                XFILE_ERROR.FILE_NOT_FOUND
            );


            return false;

        }


        if (
            entry.directory
        ) {

            const prefix =
                path.endsWith("/")
                    ? path
                    : path + "/";


            for (
                const key
                of this.entries.keys()
            ) {

                if (
                    key.startsWith(
                        prefix
                    )
                ) {

                    this.entries.delete(
                        key
                    );

                }

            }

        }


        this.entries.delete(
            path
        );


        this.clearError();


        return true;

    }


    /* ========================================================
       EXISTS
    ======================================================== */

    exists(
        path
    ) {

        path =
            xfileNormalizePath(
                path
            );


        return this.entries.has(
            path
        );

    }


    isFile(
        path
    ) {

        const entry =
            this.entries.get(
                xfileNormalizePath(
                    path
                )
            );


        return !!(
            entry &&
            entry.isFile()
        );

    }


    isDirectory(
        path
    ) {

        const entry =
            this.entries.get(
                xfileNormalizePath(
                    path
                )
            );


        return !!(
            entry &&
            entry.isDirectory()
        );

    }


    /* ========================================================
       OPEN
    ======================================================== */

    open(
        path,
        access =
            XFILE_ACCESS.READ,
        creation =
            XFILE_OPEN.EXISTING
    ) {

        path =
            xfileNormalizePath(
                path
            );


        const mount =
            this.getMount(
                path
            );


        if (
            !mount
        ) {

            this.setError(
                XFILE_ERROR.PATH_NOT_FOUND
            );


            return null;

        }


        let entry =
            this.entries.get(
                path
            );


        /*
         * Existing file.
         */

        if (
            entry
        ) {

            if (
                entry.directory
            ) {

                this.setError(
                    XFILE_ERROR.ACCESS_DENIED
                );


                return null;

            }


            if (
                creation ===
                XFILE_OPEN.CREATE_ALWAYS
            ) {

                if (
                    !mount.writable
                ) {

                    this.setError(
                        XFILE_ERROR.ACCESS_DENIED
                    );


                    return null;

                }


                entry =
                    this.addFile(
                        path,
                        new Uint8Array(0)
                    );

            }

        } else {

            /*
             * File does not exist.
             */

            if (
                creation ===
                    XFILE_OPEN.EXISTING
            ) {

                this.setError(
                    XFILE_ERROR.FILE_NOT_FOUND
                );


                return null;

            }


            if (
                !mount.writable
            ) {

                this.setError(
                    XFILE_ERROR.ACCESS_DENIED
                );


                return null;

            }


            entry =
                this.addFile(
                    path,
                    new Uint8Array(0)
                );

        }


        if (
            !entry
        ) {

            return null;

        }


        const handle =
            new WebBktxXFileHandle(
                this.nextHandle++,
                entry,
                access
            );


        this.handles.set(
            handle.id,
            handle
        );


        this.clearError();


        this.log(
            "File opened.",
            {
                handle:
                    handle.id,

                path
            }
        );


        return handle;

    }


    /* ========================================================
       OPEN BY HANDLE
    ======================================================== */

    getHandle(
        handle
    ) {

        let id =
            handle;


        if (
            handle instanceof
            WebBktxXFileHandle
        ) {

            id =
                handle.id;

        }


        id =
            Number(id);


        const result =
            this.handles.get(
                id
            );


        if (
            !result ||
            result.closed
        ) {

            this.setError(
                XFILE_ERROR.INVALID_HANDLE
            );


            return null;

        }


        return result;

    }


    /* ========================================================
       CLOSE
    ======================================================== */

    close(
        handle
    ) {

        const file =
            this.getHandle(
                handle
            );


        if (
            !file
        ) {

            return false;

        }


        file.close();


        this.handles.delete(
            file.id
        );


        this.clearError();


        return true;

    }


    /* ========================================================
       READ
    ======================================================== */

    read(
        handle,
        length
    ) {

        const file =
            this.getHandle(
                handle
            );


        if (
            !file
        ) {

            return null;

        }


        try {

            const result =
                file.read(
                    length
                );


            this.clearError();


            if (
                result.length === 0 &&
                file.eof()
            ) {

                this.lastError =
                    XFILE_ERROR.END_OF_FILE;

            }


            return result;

        } catch (
            error
        ) {

            this.setError(
                XFILE_ERROR.ACCESS_DENIED
            );


            throw error;

        }

    }


    /* ========================================================
       WRITE
    ======================================================== */

    write(
        handle,
        data
    ) {

        const file =
            this.getHandle(
                handle
            );


        if (
            !file
        ) {

            return -1;

        }


        try {

            const result =
                file.write(
                    data
                );


            this.clearError();


            return result;

        } catch (
            error
        ) {

            this.setError(
                XFILE_ERROR.ACCESS_DENIED
            );


            throw error;

        }

    }


    /* ========================================================
       SEEK
    ======================================================== */

    seek(
        handle,
        offset,
        origin =
            XFILE_SEEK.SET
    ) {

        const file =
            this.getHandle(
                handle
            );


        if (
            !file
        ) {

            return -1;

        }


        try {

            const position =
                file.seek(
                    offset,
                    origin
                );


            this.clearError();


            return position;

        } catch (
            error
        ) {

            this.setError(
                XFILE_ERROR.INVALID_PARAMETER
            );


            throw error;

        }

    }


    tell(
        handle
    ) {

        const file =
            this.getHandle(
                handle
            );


        if (
            !file
        ) {

            return -1;

        }


        return file.tell();

    }


    eof(
        handle
    ) {

        const file =
            this.getHandle(
                handle
            );


        if (
            !file
        ) {

            return true;

        }


        return file.eof();

    }


    /* ========================================================
       FILE INFO
    ======================================================== */

    stat(
        path
    ) {

        path =
            xfileNormalizePath(
                path
            );


        const entry =
            this.entries.get(
                path
            );


        if (
            !entry
        ) {

            this.setError(
                XFILE_ERROR.FILE_NOT_FOUND
            );


            return null;

        }


        this.clearError();


        return entry.info();

    }


    getSize(
        path
    ) {

        const info =
            this.stat(
                path
            );


        if (
            !info
        ) {

            return -1;

        }


        return info.size;

    }


    /* ========================================================
       DIRECTORY ENUMERATION
    ======================================================== */

    list(
        path = "D:/"
    ) {

        path =
            xfileNormalizePath(
                path
            );


        if (
            !path.endsWith("/")
        ) {

            path += "/";

        }


        const result =
            [];


        for (
            const entry
            of this.entries.values()
        ) {

            if (
                entry.path ===
                path
            ) {

                continue;

            }


            if (
                entry.path.startsWith(
                    path
                )
            ) {

                const rest =
                    entry.path.slice(
                        path.length
                    );


                if (
                    rest.length === 0
                ) {

                    continue;

                }


                /*
                 * Only direct children.
                 */

                const slash =
                    rest.indexOf("/");


                if (
                    slash !== -1 &&
                    slash !== rest.length - 1
                ) {

                    continue;

                }


                result.push(
                    entry.info()
                );

            }

        }


        result.sort(
            (a, b) =>
                a.name.localeCompare(
                    b.name
                )
        );


        this.clearError();


        return result;

    }


    /* ========================================================
       IMPORT BLOB / FILE
    ======================================================== */

    async importFile(
        file,
        targetPath
    ) {

        if (
            !file
        ) {

            throw new Error(
                "No host file supplied."
            );

        }


        let bytes;


        if (
            file instanceof
            ArrayBuffer
        ) {

            bytes =
                new Uint8Array(
                    file
                );

        } else if (
            file instanceof
            Uint8Array
        ) {

            bytes =
                file;

        } else if (
            typeof Blob !==
            "undefined" &&
            file instanceof Blob
        ) {

            bytes =
                new Uint8Array(
                    await file.arrayBuffer()
                );

        } else {

            throw new TypeError(
                "Unsupported host file."
            );

        }


        const path =
            targetPath ||
            (
                "D:/" +
                (
                    file.name ||
                    "import.bin"
                )
            );


        return this.addFile(
            path,
            bytes,
            {
                force: true
            }
        );

    }


    /* ========================================================
       IMPORT XBE
    ======================================================== */

    async importXBE(
        file,
        path = null
    ) {

        const target =
            path ||
            (
                "D:/" +
                (
                    file.name ||
                    "default.xbe"
                )
            );


        const entry =
            await this.importFile(
                file,
                target
            );


        if (
            !entry
        ) {

            return null;

        }


        this.log(
            "XBE imported.",
            {
                path:
                    target,

                size:
                    entry.size
            }
        );


        return entry;

    }


    /* ========================================================
       EXPORT FILE
    ======================================================== */

    exportFile(
        path
    ) {

        path =
            xfileNormalizePath(
                path
            );


        const entry =
            this.entries.get(
                path
            );


        if (
            !entry ||
            entry.directory
        ) {

            this.setError(
                XFILE_ERROR.FILE_NOT_FOUND
            );


            return null;

        }


        this.clearError();


        return entry.data.slice();

    }


    /* ========================================================
       READ WHOLE FILE
    ======================================================== */

    readFile(
        path
    ) {

        const entry =
            this.entries.get(
                xfileNormalizePath(
                    path
                )
            );


        if (
            !entry ||
            entry.directory
        ) {

            this.setError(
                XFILE_ERROR.FILE_NOT_FOUND
            );


            return null;

        }


        this.clearError();


        return entry.data.slice();

    }


    /* ========================================================
       WRITE WHOLE FILE
    ======================================================== */

    writeFile(
        path,
        data
    ) {

        path =
            xfileNormalizePath(
                path
            );


        let entry =
            this.entries.get(
                path
            );


        if (
            entry &&
            entry.directory
        ) {

            this.setError(
                XFILE_ERROR.ACCESS_DENIED
            );


            return false;

        }


        if (
            !entry
        ) {

            entry =
                this.addFile(
                    path,
                    data
                );

        } else {

            entry.data =
                xfileToUint8Array(
                    data
                );

            entry.modified =
                xfileNow();

        }


        this.clearError();


        return entry;

    }


    /* ========================================================
       FIND XBE
    ======================================================== */

    findXBE(
        root = "D:/"
    ) {

        root =
            xfileNormalizePath(
                root
            );


        if (
            !root.endsWith("/")
        ) {

            root += "/";

        }


        for (
            const entry
            of this.entries.values()
        ) {

            if (
                entry.directory
            ) {

                continue;

            }


            if (
                !entry.path.startsWith(
                    root
                )
            ) {

                continue;

            }


            if (
                entry.name
                    .toLowerCase()
                    .endsWith(
                        ".xbe"
                    )
            ) {

                return entry;

            }

        }


        return null;

    }


    /* ========================================================
       LOAD XBE INTO WEBBKTX
    ======================================================== */

    async loadXBE(
        xbe,
        path = null
    ) {

        /*
         * If an XBE parser instance was supplied,
         * use its raw buffer.
         */

        if (
            xbe &&
            xbe.parser &&
            xbe.parser.bytes
        ) {

            const bytes =
                xbe.parser.bytes;


            const target =
                path ||
                "D:/default.xbe";


            return this.addFile(
                target,
                bytes,
                {
                    force: true
                }
            );

        }


        /*
         * If a host File / Blob was supplied.
         */

        if (
            xbe instanceof Blob
        ) {

            return this.importXBE(
                xbe,
                path
            );

        }


        throw new TypeError(
            "Unsupported XBE source."
        );

    }


    /* ========================================================
       RESET
    ======================================================== */

    reset() {

        this.handles.clear();


        this.entries.clear();


        /*
         * Recreate mounted roots.
         */

        for (
            const mount
            of this.mounts.values()
        ) {

            this.entries.set(
                mount.drive + "/",
                new WebBktxXFileEntry(
                    mount.drive + "/",
                    null,
                    {
                        directory: true
                    }
                )
            );

        }


        this.nextHandle =
            1;


        this.clearError();

    }


    /* ========================================================
       STATUS
    ======================================================== */

    getStatus() {

        let files = 0;
        let directories = 0;
        let bytes = 0;


        for (
            const entry
            of this.entries.values()
        ) {

            if (
                entry.directory
            ) {

                directories++;

            } else {

                files++;

                bytes +=
                    entry.size;

            }

        }


        return {

            version:
                this.version,

            files,

            directories,

            bytes,

            openHandles:
                this.handles.size,

            mounts:
                Array.from(
                    this.mounts.keys()
                ),

            lastError:
                this.lastError

        };

    }


    /* ========================================================
       DEBUG DUMP
    ======================================================== */

    dump() {

        return Array.from(
            this.entries.values()
        )
        .map(
            entry =>
                entry.info()
        );

    }

}


/* ============================================================
   XBOX COMPATIBILITY API
============================================================ */

class WebBktxXFileAPI {

    constructor(
        filesystem
    ) {

        this.fs =
            filesystem;

    }


    CreateFile(
        path,
        access =
            XFILE_ACCESS.READ,
        creation =
            XFILE_OPEN.EXISTING
    ) {

        const handle =
            this.fs.open(
                path,
                access,
                creation
            );


        return handle
            ? handle.id
            : -1;

    }


    CloseHandle(
        handle
    ) {

        return this.fs.close(
            handle
        );

    }


    ReadFile(
        handle,
        length
    ) {

        return this.fs.read(
            handle,
            length
        );

    }


    WriteFile(
        handle,
        data
    ) {

        return this.fs.write(
            handle,
            data
        );

    }


    SetFilePointer(
        handle,
        offset,
        origin =
            XFILE_SEEK.SET
    ) {

        return this.fs.seek(
            handle,
            offset,
            origin
        );

    }


    GetFileSize(
        handle
    ) {

        const file =
            this.fs.getHandle(
                handle
            );


        if (
            !file
        ) {

            return -1;

        }


        return file.entry.size;

    }


    GetFileInformation(
        path
    ) {

        return this.fs.stat(
            path
        );

    }


    GetLastError() {

        return this.fs.getLastError();

    }

}


/* ============================================================
   GLOBAL INSTANCE
============================================================ */

const WebBktxFileSystem =
    new WebBktxXFile();


const WebBktxXFileAPIInstance =
    new WebBktxXFileAPI(
        WebBktxFileSystem
    );


/* ============================================================
   GLOBAL EXPORTS
============================================================ */

window.WebBktxXFile =
    WebBktxXFile;


window.WebBktxXFileEntry =
    WebBktxXFileEntry;


window.WebBktxXFileHandle =
    WebBktxXFileHandle;


window.WebBktxXFileAPI =
    WebBktxXFileAPI;


window.WebBktxFileSystem =
    WebBktxFileSystem;


window.WebBktxFileAPI =
    WebBktxXFileAPIInstance;


/* ============================================================
   CONSTANTS EXPORT
============================================================ */

window.WebBktxXFileConstants = {

    ACCESS:
        XFILE_ACCESS,

    OPEN:
        XFILE_OPEN,

    SEEK:
        XFILE_SEEK,

    ATTRIBUTES:
        XFILE_ATTRIBUTES,

    ERROR:
        XFILE_ERROR

};


/* ============================================================
   READY
============================================================ */

console.log(
    `%cWebBktx XFile ${WEBBKTX_XFILE_VERSION} loaded.`,
    "font-weight:bold"
);

console.log(
    "Virtual Xbox filesystem ready."
);
