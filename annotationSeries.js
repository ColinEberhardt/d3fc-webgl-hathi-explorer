import * as d3 from 'd3';
import * as fc from 'd3fc';
import { annotation } from 'd3-svg-annotation';

// Wraps the most awesome d3-annotation component (https://d3-annotation.susielu.com/)
// so that it can be rendered as a series
export const seriesSvgAnnotation = () => {
  // the underlying component that we are wrapping
  const d3Annotation = annotation();

  let xScale = d3.scaleLinear();
  let yScale = d3.scaleLinear();

  const join = fc.dataJoin("g", "annotation");

  const series = selection => {
    selection.each((data, index, group) => {
      // always reset the accessors in case the scales have changed
      d3Annotation.accessors({
        x: d => xScale(d.x),
        y: d => yScale(d.y)
      });

      // add an entry/exit transition (uses the default fade
      // in/out from fc.dataJoin)
      const container = d3.select(group[index])
        .transition()
        .duration(100)
        .ease(d3.easeLinear);

      // this join will use the rebound key method to identify if
      // annotations should be re-used
      const selection = join(container, data);

      // add annotations for any new data items (removed items are
      // implicitly cleaned up by the data join)
      if (selection.enter().size() > 0) {
        d3Annotation.annotations(data);
      }

      // invoke the component for any new data items (implicitly 
      // applies the same check as above)
      selection.enter()
        .call(d3Annotation);

      // notify the annotation component if any annotations have
      // been updated (rather than being new)
      // N.B. fc.dataJoin follows the old d3 convention of merging
      // enter into update
      if (selection.size() - selection.enter().size() > 0) {
        d3Annotation.updatedAccessors();
      }
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

  fc.rebind(series, join, 'key');
  fc.rebindAll(series, d3Annotation);

  return series;
};
