const CACHE_NAME = "webbktx-v1";

const FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./sw.js",
    "./manifest.json"
];


self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)

            .then(cache => {

                return cache.addAll(FILES);

            })

            .then(() => {

                return self.skipWaiting();

            })

    );

});


self.addEventListener("activate", event => {

    event.waitUntil(

        self.clients.claim()

    );

});


self.addEventListener("fetch", event => {

    event.respondWith(

        caches.match(event.request)

            .then(cached => {

                if (cached) {

                    return cached;

                }

                return fetch(event.request);

            })

    );

});
