export function col(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function shade(c, k) {
  return {
    r: Math.min(255, (c.r * k) | 0),
    g: Math.min(255, (c.g * k) | 0),
    b: Math.min(255, (c.b * k) | 0),
  };
}

export const css = (c, a) =>
  a === undefined
    ? `rgb(${c.r | 0},${c.g | 0},${c.b | 0})`
    : `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${a})`;
