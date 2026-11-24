/** Read-only DOM audit for the isolated scheduler fixture and authenticated UI.
 * Call with the browser tool's evaluate API after navigating a supported screen.
 * Gradients, native popups, icons and focus indicators also need visual review.
 */
export function schedulerContrastAudit() {
  const rgba = value => {
    const channels = value.match(/[\d.]+/g)?.map(Number) || [];
    return [channels[0] || 0, channels[1] || 0, channels[2] || 0, channels[3] ?? 1];
  };
  const composite = (front, back) => front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3]));
  const luminance = color => color.map(v => {
    v /= 255;
    return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  };
  const visible = element => {
    if (!element.getClientRects().length || element.closest('dialog:not([open])')) return false;
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  };
  const background = element => {
    const chain = [];
    for (let parent = element; parent; parent = parent.parentElement) chain.unshift(parent);
    return chain.reduce((back, parent) => composite(rgba(getComputedStyle(parent).backgroundColor), back), [255, 255, 255]);
  };
  const entries = [];
  for (const element of document.querySelectorAll('.sf-schedule *')) {
    if (!visible(element) || element.tagName === 'OPTION') continue;
    let text = Array.from(element.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').trim();
    if (element.matches('input,textarea,select')) text = element.value || element.placeholder || element.getAttribute('aria-label') || '';
    if (!text) continue;
    const style = getComputedStyle(element), back = background(element);
    let opacity = 1;
    for (let parent = element; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
    const placeholder = Boolean(element.matches('input,textarea') && !element.value && element.placeholder);
    const foregroundStyle = placeholder ? getComputedStyle(element, '::placeholder') : style;
    const front = rgba(foregroundStyle.color);
    front[3] *= opacity * (placeholder ? Number(foregroundStyle.opacity) : 1);
    const ratio = contrast(composite(front, back), back);
    const size = Number.parseFloat(style.fontSize), bold = Number(style.fontWeight) >= 700;
    const required = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    entries.push({ text: text.slice(0, 100), tag: element.tagName, cls: element.className, ratio: Number(ratio.toFixed(2)), required,
      fg: foregroundStyle.color, bg: back.map(Math.round), opacity, disabled: element.matches(':disabled'), placeholder });
  }
  return { entries, buttons: Array.from(document.querySelectorAll('.sf-schedule button')).filter(visible).map(element => ({
    text: element.textContent.trim() || element.getAttribute('aria-label'), disabled: element.disabled,
    bg: getComputedStyle(element).backgroundColor, fg: getComputedStyle(element).color, opacity: getComputedStyle(element).opacity,
  })), horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
}
