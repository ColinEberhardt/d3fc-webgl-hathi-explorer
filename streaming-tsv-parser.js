function streamingTsvParser(file, callback) {
  const textDecoder = new TextDecoder("utf-8");
  let columnHeadings;
  let previousChunk = "";

  fetch(file)
    .then(response => {
      if (!response.ok) {
        throw Error(response.status + " " + response.statusText);
      }

      if (!response.body) {
        throw Error("ReadableStream not yet supported in this browser.");
      }

      const contentLength = response.headers.get("content-length");
      if (!contentLength) {
        throw Error("Content-Length response header unavailable");
      }

      return new ReadableStream({
        start(controller) {
          const reader = response.body.getReader();

          const read = async () => {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              return;
            }

            // decode and split into lines
            const textData = textDecoder.decode(value) + previousChunk;
            const lines = textData.split("\n");

            // the first line is our column headings
            if (!columnHeadings) {
              columnHeadings = lines[0].split("\t");
              lines.shift();
            }
            // the last line is probably partial - so append to the next chunk
            previousChunk = lines.pop();

            // convert each row to an object
            const items = lines
              .map(row => {
                const cells = row.split("\t");
                if (cells.length !== columnHeadings.length) {
                  return null;
                }
                let rowValue = {};
                columnHeadings.forEach((h, i) => {
                  rowValue[h] = cells[i];
                });
                return rowValue;
              })
              .filter(i => i);

            callback(items);

            controller.enqueue(value);
            read();
          };

          read();
        }
      });
    })
    .then(stream => new Response(stream))
    .then(response => response.text())
    .then(data => {
      console.log("download completed");
      console.log(data.length);
    })
    .catch(error => {
      console.error(error);
    });
}
