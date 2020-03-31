// Wraps the most awesome d3-annotation component (https://d3-annotation.susielu.com/)
// so that it can be rendered as a series
export const seriesSvgAnnotation = () => {
  // the underlying component that we are wrapping
  const d3Annotation = d3.annotation();

  let xScale = d3.scaleLinear();
  let yScale = d3.scaleLinear();

  const join = fc.dataJoin("g", "annotation");

  const series = selection => {
    selection.each((data, index, group) => {
      const projectedData = data.map(d => ({
        ...d,
        x: xScale(d.x),
        y: yScale(d.y)
      }));

      d3Annotation.annotations(projectedData);

      join(d3.select(group[index]), projectedData).call(d3Annotation);
    });
  };

  series.xScale = (...args) => {
    if (!args.length) {
      return xScale;
    }
    xScale = args[0];
    return series;
  };

  series.yScale = (...args) => {
    if (!args.length) {
      return yScale;
    }
    yScale = args[0];
    return series;
  };

  fc.rebindAll(series, d3Annotation);

  return series;
};
