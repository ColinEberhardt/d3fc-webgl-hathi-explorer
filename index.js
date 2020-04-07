import { seriesSvgAnnotation } from "./annotation-series.js";
import { interactiveChart } from "./interactiveChart.js";
import {
  distance,
  trunc,
  hashCode,
  webglColor,
  iterateElements
} from "./util.js";

let data = [];
let spatialIndex;

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
streamingLoaderWorker.onmessage = ({
  data: { items, totalBytes, finished }
}) => {
  const rows = items
    .map(d => ({
      ...d,
      x: Number(d.x),
      y: Number(d.y),
      year: Number(d.date)
    }))
    .filter(d => d.year);
  data = data.concat(rows);

  if (finished) {
    document.getElementById("loading").style.display = "none";

    // compute the fill color for each datapoint
    const languageFill = d =>
      webglColor(languageColorScale(hashCode(d.language) % 10));
    const yearFill = d => webglColor(yearColorScale(d.year));

    const fillColor = fc
      .webglFillColor()
      .value(languageFill)
      .data(data);
    pointSeries.decorate(program => fillColor(program));

    // wire up the fill color selector
    iterateElements(".controls a", el => {
      el.addEventListener("click", () => {
        iterateElements(".controls a", el2 => el2.classList.remove("active"));
        el.classList.add("active");
        fillColor.value(el.id === "language" ? languageFill : yearFill);
        redraw();
      });
    });

    // create a spatial index for rapidly finding the closest datapoint
    spatialIndex = new Flatbush(data.length);
    const p = 0.01;
    data.forEach(d => spatialIndex.add(d.x - p, d.y - p, d.x + p, d.y + p));
    spatialIndex.finish();
  }

  redraw();
};
streamingLoaderWorker.postMessage("data.tsv");

const languageColorScale = d3.scaleOrdinal(d3.schemeCategory10);
const yearColorScale = d3
  .scaleSequential()
  .domain([1850, 2000])
  .interpolator(d3.interpolateRdYlGn);

const xScale = d3.scaleLinear(),
  yScale = d3.scaleLinear();

const pointSeries = fc
  .seriesWebglPoint()
  .equals((a, b) => a === b)
  .size(1)
  .crossValue(d => d.x)
  .mainValue(d => d.y);

const annotations = [];

const pointer = fc.pointer().on("point", ([coord]) => {
  annotations.pop();

  if (!coord || !spatialIndex) {
    return;
  }

  // find the closes datapoint to the pointer
  const x = xScale.invert(coord.x);
  const y = yScale.invert(coord.y);
  const closestIndex = spatialIndex.neighbors(x, y, 1);
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

const chart = interactiveChart(xScale, yScale)
  .xDomain([-50, 50])
  .yDomain([-50, 50])
  .scaleExtent([0.8, 10])
  .webglPlotArea(
    // only render the point series on the WebGL layer
    fc
      .seriesWebglMulti()
      .series([pointSeries])
      .mapping(d => d.data)
  )
  .svgPlotArea(
    // only render the annotations series on the SVG layer
    fc
      .seriesSvgMulti()
      .series([annotationSeries])
      .mapping(d => d.annotations)
  )
  .decorate(sel =>
    sel
      .enter()
      .select("d3fc-svg.plot-area")
      .call(pointer)
  );

// render the chart with the required data
// Enqueues a redraw to occur on the next animation frame
const redraw = () => {
  d3.select("#chart")
    .datum({ annotations, data })
    .call(chart);
};
