export const buildElement = (innerHTML: string) => {
  const tmp = document.implementation.createHTMLDocument('');
  tmp.body.innerHTML = innerHTML;
  return Array.from(tmp.body.children)[0] as HTMLElement;
}

export const triggerEvent = (el: HTMLElement, type: string, options: {bubbles: boolean; cancelable: boolean} = {"bubbles":true, "cancelable":false}) => {
  const evt = new Event(type, options);
  el.dispatchEvent(evt);
}

export const loadImage = (src: string, timeout: number = 10000) => new Promise(res => {
  const img = new Image();
  img.src = src;
  img.onload = () => res(img);
  img.onerror = () => res(null);
  setTimeout(() => res(null), timeout);
})

