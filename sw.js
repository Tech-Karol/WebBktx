/*
 * ============================================================
 * WebBktx Service Worker
 *
 * Version: 0.4
 *
 * Local application cache
 * ============================================================
 */

"use strict";


const CACHE_NAME =
    "webbktx-cache-v4";


const APP_FILES = [

    "./",

    "./index.html",

    "./style.css",

    "./core.js",

    "./app.js",

    "./manifest.json"

];


/* ============================================================
   INSTALL
============================================================ */

self.addEventListener(
    "install",
    event => {

        console.log(
            "[WebBktx SW] Installing:",
            CACHE_NAME
        );


        event.waitUntil(

            caches.open(
                CACHE_NAME
            )

            .then(
                cache => {

                    return cache.addAll(
                        APP_FILES
                    );

                }
            )

        );


        /*
         * Activate immediately.
         */

        self.skipWaiting();

    }
);


/* ============================================================
   ACTIVATE
============================================================ */

self.addEventListener(
    "activate",
    event => {

        console.log(
            "[WebBktx SW] Activating:",
            CACHE_NAME
        );


        event.waitUntil(

            caches.keys()

            .then(
                cacheNames => {

                    return Promise.all(

                        cacheNames.map(
                            cacheName => {

                                if (
                                    cacheName !==
                                    CACHE_NAME
                                ) {

                                    console.log(
                                        "[WebBktx SW] " +
                                        "Deleting old cache:",
                                        cacheName
                                    );


                                    return caches.delete(
                                        cacheName
                                    );

                                }


                                return null;

                            }
                        )

                    );

                }
            )

        );


        /*
         * Take control of the page immediately.
         */

        self.clients.claim();

    }
);


/* ============================================================
   FETCH
============================================================ */

self.addEventListener(
    "fetch",
    event => {

        /*
         * Only handle GET requests.
         */

        if (
            event.request.method !==
            "GET"
        ) {

            return;

        }


        event.respondWith(

            caches.match(
                event.request
            )

            .then(
                cachedResponse => {

                    /*
                     * Cached application file.
                     */

                    if (
                        cachedResponse
                    ) {

                        return cachedResponse;

                    }


                    /*
                     * Not cached:
                     * request from network.
                     */

                    return fetch(
                        event.request
                    );

                }
            )

        );

    }
);
