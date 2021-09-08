import { color } from 'd3';
import { rebind, webglUniform } from 'd3fc';
import oneDimensionalTexture from './oneDimensionalTexture';

export default () => {
    const rangeUniform = webglUniform();
    const textureUniform = oneDimensionalTexture();

    let attribute = null;
    let range = [0, 1];
    let value = indexValue => color('red');
    let resolution = 256;
    let dirty = true;

    const indexedFillColor = (programBuilder) => {
        rangeUniform.data(range);

        if (dirty) {
            const data = new Uint8Array(resolution * 4);
            const step = (range[1] - range[0]) / (resolution - 1);
            for (let i = 0; i < resolution; i++) {
                const { r, g, b, opacity } = value(range[0] + i * step).rgb();
                data[i * 4] = r;
                data[i * 4 + 1] = g;
                data[i * 4 + 2] = b;
                data[i * 4 + 3] = opacity * 255;
            }
            textureUniform.data(data);
            dirty = false;
        }

        const vertexShader = programBuilder
            .vertexShader()
            .appendHeader(`uniform vec2 uFillColorRange;`)
            .appendHeader(`uniform sampler2D uFillColorTexture;`)
            .appendHeader(`attribute float aFillColorValue;`)
            .appendHeader(`varying vec4 vFillColor;`);

        vertexShader.appendBody(`
            float fillColorIndex = (aFillColorValue - uFillColorRange[0]) / (uFillColorRange[1] - uFillColorRange[0]);
            vFillColor = texture2D(uFillColorTexture, vec2(fillColorIndex, 0.5));
        `);

        programBuilder.fragmentShader()
            .appendHeader(`varying vec4 vFillColor;`)
            .appendBody(
                `gl_FragColor = (canFill * vFillColor) + ((1.0 - canFill) * gl_FragColor);`
            );

        programBuilder
            .buffers()
            .uniform(`uFillColorRange`, rangeUniform)
            .uniform(`uFillColorTexture`, textureUniform)
            .attribute(`aFillColorValue`, attribute);
    };

    indexedFillColor.attribute = (...args) => {
        if (!args.length) {
            return attribute;
        }
        attribute = args[0];
        return indexedFillColor;
    };

    indexedFillColor.range = (...args) => {
        if (!args.length) {
            return range;
        }
        if (range !== args[0]) {
            range = args[0];
            dirty = true;
        }
        return indexedFillColor;
    };

    indexedFillColor.value = (...args) => {
        if (!args.length) {
            return value;
        }
        if (value !== args[0]) {
            value = args[0];
            dirty = true;
        }
        return indexedFillColor;
    };

    indexedFillColor.resolution = (...args) => {
        if (!args.length) {
            return resolution;
        }
        if (resolution !== args[0]) {
            resolution = args[0];
            dirty = true;
        }
        return indexedFillColor;
    };

    rebind(indexedFillColor, textureUniform, 'clamp', 'unit');

    return indexedFillColor;
};
