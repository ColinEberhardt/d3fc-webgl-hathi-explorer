export const interactiveChart = (xScale, yScale) => {
  let selection;

  const redraw = () => {
    // this is clearly quite hacky
    selection.node().requestRedraw();
  };

  const zoom = d3.zoom().on("zoom", () => {
    xScale.domain(d3.event.transform.rescaleX(xScaleOriginal).domain());
    yScale.domain(d3.event.transform.rescaleY(yScaleOriginal).domain());
    redraw();
  });

  const chart = fc.chartCartesian(xScale, yScale).decorate(sel => {
    selection = sel;
    sel
      .enter()
      .select("d3fc-svg.plot-area")
      .on("measure.range", () => {
        xScaleOriginal.range([0, d3.event.detail.width]);
        yScaleOriginal.range([d3.event.detail.height, 0]);
      })
      .call(zoom);

    decorate(sel);
  });

  let xScaleOriginal = xScale.copy(),
    yScaleOriginal = yScale.copy();

  let decorate = () => {};

  const instance = selection => chart(selection);

  instance.yDomain = (...args) => {
    if (!args.length) {
      return chart.yDomain();
    }
    yScaleOriginal.domain(...args);
    chart.yDomain(...args);
    return instance;
  };

  instance.xDomain = (...args) => {
    if (!args.length) {
      return chart.xDomain();
    }
    xScaleOriginal.domain(...args);
    chart.xDomain(...args);
    return instance;
  };

  instance.decorate = (...args) => {
    if (!args.length) {
      return decorate;
    }
    decorate = args[0];
    return instance;
  };

  fc.rebindAll(instance, chart, fc.exclude("xDomain", "yDomain", "decorate"));
  fc.rebindAll(instance, zoom);

  return instance;
};
