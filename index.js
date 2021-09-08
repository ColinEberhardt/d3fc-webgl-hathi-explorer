import { seriesSvgAnnotation } from './annotationSeries.js';

import * as d3 from 'd3';
import * as fc from 'd3fc';
import * as Arrow from 'apache-arrow';
import bespokePointSeries from './bespokePointSeries';
import streamingAttribute from './streamingAttribute';
import indexedFillColor from './indexedFillColor';
import closestPoint from './closestPoint';

import arrowFile from './data.arrows';

const LO_FI_VERSION = location.hash.indexOf('lofi') > -1;
const CLICK_TO_LOAD = location.hash.indexOf('ctl') > -1;

const MAX_BUFFER_SIZE = 4e6; // 1M values * 4 byte value width

const columnValues = (table, columnName) => {
  const index = table.getColumnIndex(columnName);
  return table.chunks.filter(chunk => chunk.length > 0)
    .map(chunk => chunk.data.childData[index].values);
};

const data = {
  pointers: [],
  annotations: [],
  table: Arrow.Table.empty()
};

// bufferBuilder doesn't automatically assign texture units
// so we manually assign them here
const CLOSEST_POINT_TEXTURE_UNIT = 0;
const FILL_COLOR_TEXTURE_UNIT = 1;

// compute the fill color for each datapoint
const languageAttribute = streamingAttribute()
  .maxByteLength(MAX_BUFFER_SIZE)
  // WebGL doesn't support 32-bit integers
  // because it's based around 32-bit floats.
  // Therefore, ignore 16 most significant bits.
  .type(fc.webglTypes.UNSIGNED_SHORT)
  .stride(4);

const languageFill = indexedFillColor()
  .attribute(languageAttribute)
  .range([0, d3.schemeCategory10.length - 1])
  .value(d => d3.color(d3.schemeCategory10[Math.round(d)]))
  .clamp(false)
  .unit(FILL_COLOR_TEXTURE_UNIT);

const yearAttribute = streamingAttribute()
  .maxByteLength(MAX_BUFFER_SIZE)
  // WebGL doesn't support 32-bit integers
  // because it's based around 32-bit floats.
  // Therefore, ignore 16 most significant bits.
  .type(fc.webglTypes.UNSIGNED_SHORT)
  .stride(4);

const yearColorScale = d3.scaleSequential()
  .domain([1850, 2000])
  .interpolator(d3.interpolateRdYlGn);

const yearFill = indexedFillColor()
  .attribute(yearAttribute)
  .range(yearColorScale.domain())
  .value(d => d3.color(yearColorScale(d)))
  .clamp(true)
  .unit(FILL_COLOR_TEXTURE_UNIT);

let fillColor = yearFill;

const DISABLED_CLASSES = 'text-gray-600 cursor-not-allowed';
const ACTIVE_CLASSES = 'text-red-600';

// wire up the fill color selector
for (const el of document.querySelectorAll('button')) {
  if (LO_FI_VERSION) {
    el.classList.remove(...ACTIVE_CLASSES.split(' '));
    el.classList.add(...DISABLED_CLASSES.split(' '));
  } else {
    el.addEventListener('click', () => {
      for (const el2 of document.querySelectorAll('button')) {
        el2.classList.remove(...ACTIVE_CLASSES.split(' '));
      }
      el.classList.add(...ACTIVE_CLASSES.split(' '));
      fillColor = el.id === 'language' ? languageFill : yearFill;
      redraw();
    });
  }
}

const xScale = d3.scaleLinear().domain([-50, 50]);
const yScale = d3.scaleLinear().domain([-50, 50]);

const indexAttribute = streamingAttribute()
  .maxByteLength(MAX_BUFFER_SIZE)
  .type(fc.webglTypes.UNSIGNED_BYTE)
  .size(4)
  .normalized(true);

const crossValueAttribute = streamingAttribute()
  .maxByteLength(MAX_BUFFER_SIZE);
const mainValueAttribute = streamingAttribute()
  .maxByteLength(MAX_BUFFER_SIZE);

const pointSeries = bespokePointSeries()
  .crossValueAttribute(crossValueAttribute)
  .mainValueAttribute(mainValueAttribute);

if (!LO_FI_VERSION) {
  pointSeries.decorate((programBuilder) => {
    const gl = programBuilder.context();
    gl.disable(gl.BLEND);

    fillColor(programBuilder);
  });
}

const findClosestPoint = closestPoint()
  .crossValueAttribute(crossValueAttribute)
  .mainValueAttribute(mainValueAttribute)
  .indexValueAttribute(indexAttribute)
  .unit(CLOSEST_POINT_TEXTURE_UNIT)
  .on('read', ({ index }) => {
    const currentPoint = data.pointers[0];
    findClosestPoint.point(currentPoint);

    // ensure the read is not for a stale point
    const previousPoint = findClosestPoint.point();
    if (
      previousPoint?.x !== currentPoint?.x ||
      previousPoint?.y !== currentPoint?.y
    ) {
      return;
    }

    // create an annotation for the read value
    data.annotations = [
      createAnnotationData(data.table.get(index))
    ];

    // disable further reads
    findClosestPoint.read(false);

    // no need to schedule a redraw because the SVG 
    // series are rendered after the WebGL series
  });

const highlightFillColor = fc.webglFillColor([0.3, 0.3, 0.3, 0.6]);
const highlightPointSeries = bespokePointSeries()
  .crossValueAttribute(crossValueAttribute)
  .mainValueAttribute(mainValueAttribute)
  .decorate((programBuilder) => {
    const gl = programBuilder.context();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    programBuilder.vertexShader()
      .appendHeader('uniform sampler2D uTexture;')
      .appendHeader('attribute vec4 aIndex;')
      .appendBody(`
          vec4 sample = texture2D(uTexture, vec2(0.5, 0.5));
          if (!all(equal(aIndex.xyz, sample.xyz))) {
            // could specify vDefined = 0.0; but this is quicker
            gl_PointSize = 0.0;
          }
      `);
    programBuilder.buffers()
      .attribute('aSize').value([100]);
    programBuilder.buffers()
      .uniform('uTexture', findClosestPoint.texture())
      .attribute('aIndex', indexAttribute);
    highlightFillColor(programBuilder);
  });

const createAnnotationData = row => ({
  ix: row.getValue(row.getIndex('ix')),
  note: {
    label: row.getValue(row.getIndex('first_author_name')) +
      ' ' + row.getValue(row.getIndex('date')),
    bgPadding: 5,
    title: row.getValue(row.getIndex('title')).replace(/(.{100}).*/, '$1...')
  },
  data: {
    x: row.getValue(row.getIndex('x')),
    y: row.getValue(row.getIndex('y'))
  },
  dx: 20,
  dy: 20
});

const annotationSeries = seriesSvgAnnotation()
  .notePadding(15)
  .key(d => d.ix);

let debounceTimer = null;

const pointer = fc.pointer()
  .on('point', (pointers) => {
    // convert the point to domain values
    data.pointers = pointers.map(({ x, y }) => ({
      x: xScale.invert(x),
      y: yScale.invert(y)
    }));

    const point = data.pointers[0];

    // clear any scheduled reads
    clearTimeout(debounceTimer);

    // clear the annotation if the pointer leaves the area
    // otherwise let it linger until it is updated
    if (point == null) {
      data.annotations = [];
      return;
    }

    // push the point into WebGL
    findClosestPoint.point(point);

    // schedule a read of the closest data point back
    // from WebGL
    debounceTimer = setTimeout(() => {
      findClosestPoint.read(true);
      redraw();
    }, 100);

    redraw();
  });

const zoom = fc.zoom()
  .on('zoom', () => {
    data.annotations = [];
    redraw();
  });

const chart = fc
  .chartCartesian(xScale, yScale)
  .webglPlotArea(
    // only render the point series on the WebGL layer
    fc
      .seriesWebglMulti()
      .series(
        LO_FI_VERSION ?
          [pointSeries] :
          [pointSeries, findClosestPoint, highlightPointSeries]
      )
      .mapping(d => d.table)
  )
  .svgPlotArea(
    // only render the annotations series on the SVG layer
    fc
      .seriesSvgMulti()
      .series([annotationSeries])
      .mapping(d => d.annotations)
  )
  .decorate(sel => {
    // apply the zoom behaviour to the plot area
    sel.enter()
      .selectAll('.plot-area')
      .call(zoom, xScale, yScale)
      .call(pointer);
  });

// render the chart with the required data
// enqueues a redraw to occur on the next animation frame
function redraw() {
  // using raw attributes means we need to explicitly pass the data in
  crossValueAttribute.data(columnValues(data.table, 'x'));
  mainValueAttribute.data(columnValues(data.table, 'y'));
  if (!LO_FI_VERSION) {
    languageAttribute.data(columnValues(data.table, 'language'));
    yearAttribute.data(columnValues(data.table, 'date'));
    indexAttribute.data(columnValues(data.table, 'ix'));
  }

  d3.select('#chart')
    .datum(data)
    .call(chart);

}

// stream the data
const loadData = async () => {
  document.querySelector('#loading>span').innerHTML = 'Loading...';
  const response = await fetch(arrowFile);
  const reader = await Arrow.RecordBatchReader.from(response);
  await reader.open();
  data.table = new Arrow.Table(reader.schema);
  for await (const recordBatch of reader) {
    data.table = data.table.concat(recordBatch);
    document.querySelector('#loading>span').innerHTML =
      new Intl.NumberFormat().format(data.table.length) + ' points loaded';
    redraw();
  }
};

redraw();

if (CLICK_TO_LOAD) {
  const clickHandler = () => {
    document.body.removeEventListener('click', clickHandler);
    loadData();
  };
  document.body.addEventListener('click', clickHandler);
  document.querySelector('#loading>span').innerHTML = 'Click to load data';
} else {
  loadData();
}