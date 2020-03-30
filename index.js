// Enqueues a redraw to occur on the next animation frame
const redraw = () =>
  d3
    .select("d3fc-group")
    .node()
    .requestRedraw();

const progressElement = document.getElementById("progress");
const renderLatch = createLatch();
let data = [];
let dataChanged = false;
let fillColor = i => i;
let index;

const createAnnotationData = datapoint => ({
  note: {
    label: datapoint.first_author_name + " " + datapoint.year,
    bgPadding: 5,
    title: trunc(datapoint.title, 100)
  },
  x: datapoint.x,
  y: datapoint.y,
  dx: 20,
  dy: 20
});

// create a web worker that streams the chart data
const streamingLoaderWorker = new Worker("streaming-tsv-parser.js");
streamingLoaderWorker.onmessage = ({ data: { items, totalBytes, finished } }) => {
  const rows = items
    .map(d => ({
      ...d,
      x: Number(d.x),
      y: Number(d.y),
      year: Number(d.date)
    }))
    .filter(d => d.year);
  data.push(...rows);

  progressElement.innerText = `Loading - ${totalBytes.toFixed(0)}`;

  if (finished) {
    progressElement.innerText = "";

    // compute the fill color for each datapoint
    fillColor = fc
      .webglFillColor()
      .value(d => webglColor(languageColorScale(hashCode(d.language) % 10)))
      .data(data);

      // create a spatial index for raidly finding the closest datapoint
    index = new Flatbush(data.length);
    const p = 0.01;
    data.forEach(d => index.add(d.x - p, d.y - p, d.x + p, d.y + p));
    index.finish();
  }

  renderLatch.set();
  redraw();
};
streamingLoaderWorker.postMessage("data.tsv");

const languageColorScale = d3.scaleOrdinal(d3.schemeCategory10);
const xScale = d3.scaleLinear().domain([-50, 50]);
const yScale = d3.scaleLinear().domain([-50, 50]);
const xScaleOriginal = xScale.copy();
const yScaleOriginal = yScale.copy();

const line = fc
  .seriesWebglPoint()
  .equals(() => !renderLatch.isSet())
  .size(1)
  .defined(() => true)
  .crossValue(d => d.x)
  .mainValue(d => d.y)
  .decorate(program => fillColor(program));

const zoom = d3.zoom().on("zoom", () => {
  // update the scales based on current zoom
  xScale.domain(d3.event.transform.rescaleX(xScaleOriginal).domain());
  yScale.domain(d3.event.transform.rescaleY(yScaleOriginal).domain());
  redraw();
});

const annotations = [];

const pointer = fc.pointer().on("point", ([coord]) => {
  annotations.pop();

  if (!coord) {
    return;
  }

  // find the closes datapoint to the pointer
  const x = xScale.invert(coord.x);
  const y = yScale.invert(coord.y);
  const closestIndex = index.neighbors(x, y, 1);
  const closestDatum = data[closestIndex];

  // if the closest point is within 20 pixels, show the annotation
  if (
    distance(coord.x, coord.y, xScale(closestDatum.x), yScale(closestDatum.y)) <
    20
  ) {
    annotations[0] = createAnnotationData(closestDatum);
  }

  redraw();
});

const annotationSeries = seriesSvgAnnotation()
  .notePadding(15)
  .type(d3.annotationCallout);

const chart = fc
  .chartCartesian(xScale, yScale)
  .webglPlotArea(
    // only render the point series on the WebGL layer
    fc
      .seriesWebglMulti()
      .series([line])
      .mapping(data => data.data)
  )
  .svgPlotArea(
    // only render the annotations series on the SVG layer
    fc
      .seriesSvgMulti()
      .series([annotationSeries])
      .mapping(data => data.annotations)
  )
  .decorate(sel =>
    sel
      .enter()
      .select("d3fc-svg.plot-area")
      .on("measure.range", () => {
        xScaleOriginal.range([0, d3.event.detail.width]);
        yScaleOriginal.range([d3.event.detail.height, 0]);
      })
      .call(zoom)
      .call(pointer)
  );

// render the chart with the required data
d3.select("#chart")
  .datum({ annotations, data })
  .call(chart);
