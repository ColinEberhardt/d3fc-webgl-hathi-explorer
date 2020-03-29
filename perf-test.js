
// FPS - 

// 4.1.10 - 43
// 4.1.11 - 44
// 4.1.12 - 45
// 4.1.13 - 126 (?!)
// 4.1.14 - 124 
// 4.1.15 - 125 
// 4.1.16 - 123 
// 4.1.17 - 124 
// 4.1.18 - 122 
// 4.1.19 - 125 
// 4.1.20 - 125 
// 4.1.25 - 125 
// 4.1.28 - 125 


var stats = new Stats();
stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

const redraw = () => {
  stats.begin();
  d3
    .select("d3fc-group")
    .node()
    .requestRedraw();
  stats.end();
}

const data = d3.range(0, 1000000).map(d => ({
  x: Math.random(),
  y: Math.random()
}))


const xExtent = fc.extentLinear().accessors([d => d.x]);
const yExtent = fc.extentLinear().accessors([d => d.y]);

const xScale = d3.scaleLinear().domain(xExtent(data));
const yScale = d3.scaleLinear().domain(yExtent(data));


const line = fc
  .seriesWebglPoint()
  .equals((a, b)=>{ return a.length !== 0 })
  // optimised 'defined' step, we know that all datapoints are defined
  .defined(() => true)
  .size(1)
  .crossValue(d => d.x)
  .mainValue(d => d.y)
  
const xScaleOriginal = xScale.copy();
const yScaleOriginal = yScale.copy();

const zoom = d3.zoom().on("zoom", () => {
  // update the scales based on current zoom
  xScale.domain(d3.event.transform.rescaleX(xScaleOriginal).domain());
  yScale.domain(d3.event.transform.rescaleY(yScaleOriginal).domain());
  redraw();
});



const chart = fc
  .chartCartesian(xScale, yScale)
  .webglPlotArea(line)
  .decorate(sel =>
    sel
      .enter()
      .select(".webgl-plot-area")
      .on("measure.range", () => {
        xScaleOriginal.range([0, d3.event.detail.width]);
        yScaleOriginal.range([d3.event.detail.height, 0]);
      })
      .call(zoom)
  );

// render the chart with the required data
d3.select("#chart")
  .datum(data)
  .call(chart);

