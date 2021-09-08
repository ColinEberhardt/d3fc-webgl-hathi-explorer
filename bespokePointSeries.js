import { scaleIdentity } from 'd3';
import {
    rebind,
    webglSeriesPoint,
    webglScaleMapper
} from 'd3fc';
import webglConstantAttribute from '@d3fc/d3fc-webgl/src/buffer/constantAttribute'
import circlePointShader from '@d3fc/d3fc-webgl/src/shaders/point/circle/baseShader'

export default () => {
    const sizeAttribute = webglConstantAttribute();
    const definedAttribute = webglConstantAttribute();

    const draw = webglSeriesPoint()
        .sizeAttribute(sizeAttribute)
        .definedAttribute(definedAttribute);

    let xScale = scaleIdentity();
    let yScale = scaleIdentity();
    let decorate = (programBuilder, data, index) => { };

    const streamingPointSeries = (data) => {
        sizeAttribute.value([Math.pow(window.devicePixelRatio ?? 1, 2)]);
        definedAttribute.value([true]);

        // the following assumes there is no d3 scale required
        const xWebglScale = webglScaleMapper(xScale).webglScale;
        const yWebglScale = webglScaleMapper(yScale).webglScale;

        draw.xScale(xWebglScale)
            .yScale(yWebglScale)
            .type(circlePointShader())
            .decorate(programBuilder => {
                decorate(programBuilder, data, 0);
            });

        draw(data.length);
    };

    streamingPointSeries.xScale = (...args) => {
        if (!args.length) {
            return xScale;
        }
        xScale = args[0];
        return streamingPointSeries;
    };

    streamingPointSeries.yScale = (...args) => {
        if (!args.length) {
            return yScale;
        }
        yScale = args[0];
        return streamingPointSeries;
    };

    streamingPointSeries.decorate = (...args) => {
        if (!args.length) {
            return decorate;
        }
        decorate = args[0];
        return streamingPointSeries;
    };

    // this is where the attributes are exposed to the consumer
    rebind(streamingPointSeries, draw, 'context', 'pixelRatio', 'type', 'mainValueAttribute', 'crossValueAttribute');

    return streamingPointSeries;
};
