(() => {
  const defaults = Object.freeze({ enabled: true, width: 480, delay: 500 });
  const clamp = (value, fallback, minimum, maximum, step) => {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.min(maximum, Math.max(minimum, Math.round(number / step) * step))
      : fallback;
  };
  globalThis.HoverPreviewSettings = Object.freeze({
    defaults,
    headerHeight: 36,
    heightFor: (width) => Math.round(((width - 2) * 800) / 1280) + 38,
    normalize: (values = {}) => ({
      enabled:
        typeof values.enabled === "boolean" ? values.enabled : defaults.enabled,
      width: clamp(values.width, defaults.width, 320, 1000, 10),
      delay: clamp(values.delay, defaults.delay, 200, 1500, 100),
    }),
  });
})();
