// 이미지 가져오기
const loadImage = async (src: string, timeout?: number) => new Promise(res => {
  const img = new Image() as HTMLImageElement;
  img.onload = () => res(img);
  img.onerror = () => res(null)
  img.src = src;
  setTimeout(() => res(null), timeout ?? 10000);
});
// 이미지 로드 상태 확인
const isImgLoaded = async (el: HTMLElement) => {
  if (el.tagName === 'IMG') {
    return [await loadImage((el as HTMLImageElement).src)]
  } else {
    const imgs = el.querySelectorAll('img');
    return [...imgs].map(async (img) => await loadImage(img.src));
  }
}
// pinchzoom container element 생성
const buildElement = (innerHTML: string) => {
  const fragment = document.implementation.createHTMLDocument('');
  fragment.body.innerHTML = innerHTML;
  return [...fragment.body.children][0];
}
// 초기 마크업
const setMarkup = (el: HTMLElement) => {
  const container = buildElement('<div class="pinch-zoom-container"></div>') as HTMLElement;
  el.parentNode?.insertBefore(container, el);
  container.appendChild(el);
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  el.style.transformOrigin = '0% 0%';
  el.style.position = 'absolute';
  return container;
}

const options = {
  tabZoom: 2,
  maxZoom: 5,
  minZoom: 0.5,
  animationDuration: 3000
}
let initZoom = 0;
let currentZoom = 1;
let initScale = 0;
let currentScale = 0;
let initOffset = {x: 0, y: 0};
let offset = {x: 0, y: 0};
// 핀치줌 메인
const pinchZoom = (el: HTMLElement) => {
  const container = setMarkup(el);
  container.style.height = container.parentElement?.offsetHeight + 'px';

  const initZoomX = container.offsetWidth / el.offsetWidth;
  const initZoomY = container.offsetHeight / el.offsetHeight;
  const defaultZoom = Math.min(initZoomX, initZoomY);
  const zoom = defaultZoom * currentZoom;

  el.style.transform = `scale(${zoom}, ${zoom})`;
}

const main = async () => { try {
  const el = document.querySelector('.pinch-zoom') as HTMLElement;
  const isImg = await Promise.all([isImgLoaded(el)]);
  if (!isImg.length) {
    console.warn('Image not found');
    return;
  };
  pinchZoom(el);
} catch (e) {
  console.error(e)
}}

main()