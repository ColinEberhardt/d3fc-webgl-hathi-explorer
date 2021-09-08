export default () => {
    let location = null;
    let data = null;
    let clamp = false;
    let dirty = true;
    let texture = null;
    let unit = null;

    const oneDimensionalTexture = programBuilder => {
        const gl = programBuilder.context();

        if (texture == null) {
            texture = gl.createTexture();
        }

        if (dirty) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            const level = 0, width = data.length / 4, height = 1, border = 0;
            gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, width, height, border, gl.RGBA, gl.UNSIGNED_BYTE, data);
        }

        if (location != null) {
            // allow the texture to be used without binding 
            // e.g. as a framebuffer
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(location, unit);
        }

        dirty = false;

        return texture;
    };

    oneDimensionalTexture.clear = () => {
        dirty = true;
        texture = null;
    };

    oneDimensionalTexture.location = (...args) => {
        if (!args.length) {
            return location;
        }
        location = args[0];
        return oneDimensionalTexture;
    };

    oneDimensionalTexture.data = (...args) => {
        if (!args.length) {
            return data;
        }
        if (data !== args[0]) {
            data = args[0];
            dirty = true;
        }
        return oneDimensionalTexture;
    };

    oneDimensionalTexture.clamp = (...args) => {
        if (!args.length) {
            return clamp;
        }
        if (clamp !== args[0]) {
            clamp = args[0];
            dirty = true;
        }
        return oneDimensionalTexture;
    };

    oneDimensionalTexture.unit = (...args) => {
        if (!args.length) {
            return unit;
        }
        unit = args[0];
        return oneDimensionalTexture;
    };

    return oneDimensionalTexture;
};