const distance = (x1, y1, x2, y2) => {
  const dx = x1 - x2,
    dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
};

const trunc = (str, len) =>
  str.length > len ? str.substr(0, len - 1) + "..." : str;

const hashCode = s =>
  s.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

const createColorBuffer = (data, colorFunc) => {
  const colors = new Float32Array(data.length * 4);
  let i = 0;
  data.forEach(d => {
    const colObj = colorFunc(d);
    colors[i++] = colObj.r / 255;
    colors[i++] = colObj.g / 255;
    colors[i++] = colObj.b / 255;
    colors[i++] = colObj.opacity;
  });
  return colors;
  
}