export const distance = (x1, y1, x2, y2) => {
  const dx = x1 - x2,
    dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
};

export const trunc = (str, len) =>
  str.length > len ? str.substr(0, len - 1) + "..." : str;

export const hashCode = s =>
  s.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

export const webglColor = color => {
  const { r, g, b, opacity } = d3.color(color).rgb();
  return [r / 255, g / 255, b / 255, opacity];
};

export const iterateElements = (selector, fn) =>
  [].forEach.call(document.querySelectorAll(selector), fn);
