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

const webglColor = color => {
  const { r, g, b, opacity } = d3.color(color).rgb();
  return [r / 255, g / 255, b / 255, opacity];
};

const extent = range => Math.abs(range[1] - range[0]);

const iterateElements = (selector, fn) =>
  [].forEach.call(document.querySelectorAll(selector), fn);

const createLatch = () => {
  let latched = false;
  return {
    set: () => {
      latched = true;
    },
    isSet: () => {
      previousLatchedState = latched;
      if (latched) {
        latched = false;
      }
      return previousLatchedState;
    }
  };
};
