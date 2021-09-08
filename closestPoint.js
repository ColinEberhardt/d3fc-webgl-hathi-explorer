import * as d3 from 'd3';
import { rebind, webglProgramBuilder, webglUniform } from 'd3fc';
import drawModes from '@d3fc/d3fc-webgl/src/program/drawModes';
import rebindCurry from '@d3fc/d3fc-webgl/src/rebindCurry';
import oneDimensionalTexture from './oneDimensionalTexture';

const mapVertexShader = () => `
precision mediump float;

uniform vec2 uPoint;
uniform float uMaxDistance;
attribute float aCrossValue;
attribute float aMainValue;
attribute vec4 aIndex;
varying vec4 vFragColor;

void main() {
    // distance calculated and converted to [0, 1]
    float distance = min(distance(uPoint, vec2(aCrossValue, aMainValue)), uMaxDistance) / uMaxDistance;
    
    gl_Position = vec4(0.5, 0.5, distance, 1.0);

    gl_PointSize = 1.0;

    vFragColor = vec4(aIndex[0], aIndex[1], aIndex[2], distance);
}
`;

const mapFragmentShader = () => `
precision mediump float;

varying vec4 vFragColor;

void main() {
    gl_FragColor = vFragColor;
}
`;

export default function () {
    const UNIT_LENGTH = 1;
    const dispatch = d3.dispatch('read');
    const texture = oneDimensionalTexture()
        .data(new Uint8Array(UNIT_LENGTH * 4));
    const pointUniform = webglUniform();
    const maxDistanceUniform = webglUniform();
    const programBuilder = webglProgramBuilder()
        .fragmentShader(mapFragmentShader)
        .vertexShader(mapVertexShader)
        .mode(drawModes.POINTS);

    programBuilder.buffers()
        .uniform(`uPoint`, pointUniform)
        .uniform(`uMaxDistance`, maxDistanceUniform);

    let previousContext = null;
    let frameBuffer = null;
    let depthBuffer = null;
    let unit = null;

    let maxDistance = 1;
    let point = null;
    let read = false;

    const closestPoint = function (data) {
        // handle edge case
        if (data.length < 1) {
            return;
        }

        const context = programBuilder.context();

        if (context !== previousContext) {
            // context new or restored - regenerate all gl references
            frameBuffer = context.createFramebuffer();
            depthBuffer = context.createRenderbuffer();
            context.bindRenderbuffer(context.RENDERBUFFER, depthBuffer);
            context.renderbufferStorage(
                context.RENDERBUFFER, 
                context.DEPTH_COMPONENT16, 
                UNIT_LENGTH, 
                UNIT_LENGTH
            );
            previousContext = context;
        }
        
        maxDistanceUniform.data([maxDistance]);
        pointUniform.data([point?.x, point?.y]);
        
        // configure the context - custom frameBuffer, depthBuffer, viewport, etc.
        {
            context.viewport(0, 0, UNIT_LENGTH, UNIT_LENGTH);
            texture.location(null);
            const glTexture = texture(programBuilder);
            context.bindFramebuffer(context.FRAMEBUFFER, frameBuffer);
            const level = 0;
            context.framebufferTexture2D(
                context.FRAMEBUFFER,
                context.COLOR_ATTACHMENT0,
                context.TEXTURE_2D,
                glTexture,
                level
            );
            context.bindRenderbuffer(context.RENDERBUFFER, depthBuffer);
            context.framebufferRenderbuffer(
                context.FRAMEBUFFER,
                context.DEPTH_ATTACHMENT,
                context.RENDERBUFFER,
                depthBuffer
            );
            context.clear(context.DEPTH_BUFFER_BIT);
            context.enable(context.DEPTH_TEST);
            context.depthFunc(context.LESS);
        }

        // run the calculation
        programBuilder(data.length);

        // optionally read back the result
        if (read) {
            const pixels = new Uint8Array(4);
            context.readPixels(
                0,
                0,
                UNIT_LENGTH,
                UNIT_LENGTH,
                context.RGBA,
                context.UNSIGNED_BYTE,
                pixels
            );
            const index = pixels[2] << 16 | pixels[1] << 8 | pixels[0];
            const distance = (pixels[3] / 256) * maxDistance;
            dispatch.call('read', closestPoint, { index, distance });
        }

        // reset the context
        {
            context.disable(context.DEPTH_TEST);
            context.viewport(0, 0, context.canvas.width, context.canvas.height);
            context.bindFramebuffer(context.FRAMEBUFFER, null);
            context.bindRenderbuffer(context.RENDERBUFFER, null);
        }
    };

    closestPoint.texture = () => texture;

    closestPoint.xScale = (...args) => {
        let xScale;
        if (!args.length) {
            return xScale;
        }
        xScale = args[0];
        return closestPoint;
    };

    closestPoint.yScale = (...args) => {
        let yScale;
        if (!args.length) {
            return yScale;
        }
        yScale = args[0];
        return closestPoint;
    };

    closestPoint.maxDistance = (...args) => {
        if (!args.length) {
            return maxDistance;
        }
        maxDistance = args[0];
        return closestPoint;
    };

    closestPoint.point = (...args) => {
        if (!args.length) {
            return point;
        }
        point = args[0];
        return closestPoint;
    };

    closestPoint.read = (...args) => {
        if (!args.length) {
            return read;
        }
        read = args[0];
        return closestPoint;
    };

    closestPoint.unit = (...args) => {
        if (!args.length) {
            return unit;
        }
        unit = args[0];
        return closestPoint;
    };

    rebind(closestPoint, dispatch, 'on');
    rebind(closestPoint, programBuilder, 'context', 'pixelRatio');
    rebindCurry(
        closestPoint,
        'mainValueAttribute',
        programBuilder.buffers(),
        'attribute',
        'aMainValue'
    );
    rebindCurry(
        closestPoint,
        'crossValueAttribute',
        programBuilder.buffers(),
        'attribute',
        'aCrossValue'
    );
    rebindCurry(
        closestPoint,
        'indexValueAttribute',
        programBuilder.buffers(),
        'attribute',
        'aIndex'
    );

    return closestPoint;
}