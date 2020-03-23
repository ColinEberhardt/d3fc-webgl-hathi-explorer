const fs = require('fs');
const http = require('http');

const fetch = url =>
    new Promise((resolve, reject) =>
        http
            .get(url, resp => {
                let data = '';
                resp.on('data', chunk => {
                    data += chunk;
                });
                resp.on('end', () => {
                    resolve(data);
                });
            })
            .on('error', error => reject(error))
    );

// const BASE_URL = 'http://creatingdata.us/data/scatter/fiction/tiles/';
const BASE_URL = 'http://creatingdata.us/data/scatter/hathi/tiles/';

const matchRegex = async (url, regex) => {
    const htmlPage = await fetch(url);
    const matches = [];
    let match;
    while ((match = regex.exec(htmlPage))) {
        matches.push(match[1]);
    }
    return matches;
};

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const tileFolders = await matchRegex(`${BASE_URL}/`, /href="([0-9]*)\/"/g);
    console.log(tileFolders);
    for (let j = 5; j < tileFolders.length; j++) {
        const tileFolder = tileFolders[j];

        const subFolders = await matchRegex(
            `${BASE_URL}/${tileFolder}/`,
            /href="([0-9]*)\/"/g
        );
        for (let i = 0; i < subFolders.length; i++) {
            const subFolder = subFolders[i];

            const files = await matchRegex(
                `${BASE_URL}/${tileFolder}/${subFolder}/`,
                /href="([0-9]*.tsv)"/g
            );

            for (let k = 0; k < files.length; k++) {
                const file = files[k];
                const fileUrl = `${BASE_URL}/${tileFolder}/${subFolder}/${file}`;
                console.log(fileUrl);
                await pause(500);

                const fileData = await fetch(fileUrl);
                fs.writeFileSync(`data/${tileFolder}-${subFolder}-${file}`, fileData);
            }
        }
    }
})();

// head -1 data/1-0-0.tsv > foo.txt; tail -n +2 -q data/*.tsv | sed -e '$ d' >> foo.txt
