const redraw = () =>
  d3
    .select("d3fc-group")
    .node()
    .requestRedraw();

d3.tsv("data.tsv", d => ({
  ...d,
  x: Number(d.x),
  y: Number(d.y),
  year: Number(d.date)
})).then(data => {
  console.log(data.length)
  // some books don't have a year
  data = data.filter(d => d.year);

  // create a flatbush spacial index
  const index = new Flatbush(data.length);
  const p = 0.01;
  data.forEach(d => index.add(d.x - p, d.y - p, d.x + p, d.y + p));
  index.finish();

  // const yearColorScale = d3
  //   .scaleSequential()
  //   .domain([1800, 2000])
  //   .interpolator(d3.interpolateViridis);

  // create a color buffer where the color for each datapoint
  // is dependant on language
  const languageColorScale = d3.scaleOrdinal(d3.schemeCategory10);
  const colors = createColorBuffer(data, d =>
    d3.color(languageColorScale(hashCode(d.language) % 10))
  );
  const colorBuilder = fc.projectedAttributeBuilder(colors);

  const xExtent = fc.extentLinear().accessors([d => d.x]);
  const yExtent = fc.extentLinear().accessors([d => d.y]);

  const xScale = d3.scaleLinear().domain(xExtent(data));
  const yScale = d3.scaleLinear().domain(yExtent(data));

  const sizeScale = d3
    .scaleLinear()
    .domain([100, 5])
    .range([1, 5]);

  const line = fc
    .seriesWebglPoint()
    .equals((a, b)=>{ return a.length !== 0 })
    .size(() =>
      Math.pow(
        Math.max(
          0.2,
          sizeScale(Math.abs(yScale.domain()[0] - yScale.domain()[1]))
        ),
        2
      )
    )
    // optimised 'defined' step, we know that all datapoints are defined
    .defined(() => true)
    .crossValue(d => d.x)
    .mainValue(d => d.y)
    .decorate(program => {
      // program
      //   .vertexShader()
      //   .appendHeader(fc.vertexShaderSnippets.multiColor.header)
      //   .appendBody(fc.vertexShaderSnippets.multiColor.body);

      // program
      //   .fragmentShader()
      //   .appendHeader(fc.fragmentShaderSnippets.multiColor.header)
      //   .appendBody(fc.fragmentShaderSnippets.multiColor.body);

      // program.buffers().attribute("aColor", colorBuilder);
    });

  const xScaleOriginal = xScale.copy();
  const yScaleOriginal = yScale.copy();

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

    if (
      distance(
        coord.x,
        coord.y,
        xScale(closestDatum.x),
        yScale(closestDatum.y)
      ) < 20
    ) {
      annotations[0] = {
        note: {
          label: closestDatum.first_author_name + " " + closestDatum.year,
          bgPadding: 5,
          title: trunc(closestDatum.title, 100)
        },
        x: closestDatum.x,
        y: closestDatum.y,
        dx: 20,
        dy: 20
      };
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
      // onl render the annotations series on the SVG layer
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
});
