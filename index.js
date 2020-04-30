import { seriesSvgAnnotation } from "./annotation-series.js";
import {
  distance,
  trunc,
  hashCode,
  webglColor,
  iterateElements
} from "./util.js";


const webglRepeat = () => {

  let orient = 'vertical';
  let series = () => fc.seriesWebglLine();
  const multi = fc.seriesWebglMulti();
  let seriesCache = [];

  const repeat = (data) => {
    if (orient === 'vertical') {
      throw new Error('work this out later');
    } else {
      const previousSeriesCache = seriesCache;
      seriesCache = data.map((d, i) => i < previousSeriesCache.length ? previousSeriesCache[i] : series());
      multi.series(seriesCache)
        .mapping((data, index) => data[index]);
    }
    multi(data);
  };

  repeat.series = (...args) => {
    if (!args.length) {
      return series;
    }
    series = args[0];
    seriesCache = [];
    return repeat;
  };

  repeat.orient = (...args) => {
    if (!args.length) {
      return orient;
    }
    orient = args[0];
    return repeat;
  };

  fc.rebindAll(repeat, multi, fc.exclude('series', 'mapping'));

  return repeat;
};


const data = [];
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

// compute the fill color for each datapoint
const languageFill = d =>
webglColor(languageColorScale(hashCode(d.language) % 10));
const yearFill = d => webglColor(yearColorScale(d.year));
let fillColorValue = languageFill;

const repeatSeries = webglRepeat()
  .series(() => {

    const fillColor = fc
      .webglFillColor();

    return fc
      .seriesWebglPoint()
      .equals((a, b) => a.length > 0)
      .size(1)
      .crossValue(d => d.x)
      .mainValue(d => d.y)
      .decorate((program, data) => {
        // setting these properties invalidates their internal caches so only set them if we need to
        if (fillColor.data() == null) {
          fillColor.data(data);
        }
        if (fillColor.value() !== fillColorValue) {
          fillColor.value(fillColorValue);
        }
        fillColor(program);
      });
  })
  .orient('horizontal');


// wire up the fill color selector
iterateElements(".controls a", el => {
  el.addEventListener("click", () => {
    iterateElements(".controls a", el2 => el2.classList.remove("active"));
    el.classList.add("active");
    fillColorValue = el.id === "language" ? languageFill : yearFill;
    redraw();
  });
});


// create a spatial index for rapidly finding the closest datapoint
// spatialIndex = new Flatbush(1e6);

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
  // const p = 0.01;
  // rows.forEach(d => spatialIndex.add(d.x - p, d.y - p, d.x + p, d.y + p));
  if (rows.length > 0) {
    data.push(rows);
  }

  if (finished) {
    document.getElementById("loading").style.display = "none";

    // spatialIndex.finish();
  }

  redraw();
};
streamingLoaderWorker.postMessage("data.tsv");

const languageColorScale = d3.scaleOrdinal(d3.schemeCategory10);
const yearColorScale = d3
  .scaleSequential()
  .domain([1850, 2000])
  .interpolator(d3.interpolateRdYlGn);
const xScale = d3.scaleLinear().domain([-50, 50]);
const yScale = d3.scaleLinear().domain([-50, 50]);
const xScaleOriginal = xScale.copy();
const yScaleOriginal = yScale.copy();

const zoom = d3
  .zoom()
  .scaleExtent([0.8, 10])
  .on("zoom", () => {
    // update the scales based on current zoom
    xScale.domain(d3.event.transform.rescaleX(xScaleOriginal).domain());
    yScale.domain(d3.event.transform.rescaleY(yScaleOriginal).domain());
    redraw();
  });

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

const chart = fc
  .chartCartesian(xScale, yScale)
  .webglPlotArea(
    // only render the point series on the WebGL layer
    fc
      .seriesWebglMulti()
      .series([repeatSeries])
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
      .on("measure.range", () => {
        xScaleOriginal.range([0, d3.event.detail.width]);
        yScaleOriginal.range([d3.event.detail.height, 0]);
      })
      .call(zoom)
      .call(pointer)
  );

// render the chart with the required data
// Enqueues a redraw to occur on the next animation frame
const redraw = () => {
  d3.select("#chart")
    .datum({ annotations, data })
    .call(chart);
};
