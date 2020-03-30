const textDecoder = new TextDecoder("utf-8");

onmessage = async ({ data: filename }) => {
  let columnHeadings;
  let previousChunk = "";
  let totalBytes = 0;

  const response = await fetch(filename);

  if (!response.body) {
    // TODO: handle this error
    throw Error("ReadableStream not yet supported in this browser.");
  }

  const streamedResponse = new Response(
    new ReadableStream({
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

          totalBytes += value.byteLength;
          postMessage({ items, totalBytes });

          controller.enqueue(value);
          read();
        };

        read();
      }
    })
  );

  const data = await streamedResponse.text();
  postMessage({ items: [], totalBytes: data.length, finished: true });
};
