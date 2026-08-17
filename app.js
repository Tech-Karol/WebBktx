const loadingScreen = document.getElementById("loadingScreen");
const mainScreen = document.getElementById("mainScreen");

const progress = document.getElementById("progress");
const loadingText = document.getElementById("loadingText");

const gameFile = document.getElementById("gameFile");
const fileInfo = document.getElementById("fileInfo");
const startButton = document.getElementById("startButton");


async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/*
    Service Worker
*/

async function installLocal() {

    loadingText.textContent = "Uruchamianie pamięci lokalnej...";
    progress.style.width = "25%";

    if ("serviceWorker" in navigator) {

        try {

            await navigator.serviceWorker.register("sw.js");

        } catch (error) {

            console.error(error);

        }

    }

    await sleep(500);

    loadingText.textContent = "Ładowanie WebBktx Core...";
    progress.style.width = "50%";

    await sleep(500);

    loadingText.textContent = "Ładowanie modułu grafiki...";
    progress.style.width = "75%";

    await sleep(500);

    loadingText.textContent = "WebBktx gotowy.";
    progress.style.width = "100%";

    await sleep(700);

    loadingScreen.classList.add("hidden");
    mainScreen.classList.remove("hidden");
}


gameFile.addEventListener("change", () => {

    const file = gameFile.files[0];

    if (!file) {

        fileInfo.textContent = "Nie wybrano pliku.";

        startButton.disabled = true;

        return;
    }

    const size =
        (file.size / 1024 / 1024).toFixed(2);

    fileInfo.textContent =
        `${file.name} — ${size} MB`;

    startButton.disabled = false;

});


startButton.addEventListener("click", () => {

    const file = gameFile.files[0];

    if (!file) return;

    alert(
        "WebBktx otrzymał plik gry:\n\n" +
        file.name +
        "\n\nRdzeń emulatora zostanie dodany w kolejnych wersjach."
    );

});


installLocal();
