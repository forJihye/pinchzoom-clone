import './index.css';
import { buildElement, loadImage } from './utils';
// https://github.com/manuelstofer/pinchzoom

const defaultOptions: PinchZoomOptions = {
  tapZoomFactor: 2,
  zoomOutFactor: 1.3,
  animationDuration: 300,
  maxZoom: 4,
  minZoom: 0.5,
  draggableUnzoomed: true,
  lockDragAxis: false,
  setOffsetsOnce: false,
  use2d: true,
  verticalPadding: 0,
  horizontalPadding: 0,

  onZoomStart: null,
  onZoomEnd: null,
  onZoomUpdate: null,
  onDragStart: null,
  onDragEnd: null,
  onDragUpdate: null,
  onDoubleTap: null,
  
  zoomStartEventName: 'pz_zoomstart',
  zoomUpdateEventName: 'pz_zoomupdate',
  zoomEndEventName: 'pz_zoomend',
  dragStartEventName: 'pz_dragstart',
  dragUpdateEventName: 'pz_dragupdate',
  dragEndEventName: 'pz_dragend',
  doubleTapEventName: 'pz_doubletap',
}

class PinchZoom {
  el!: HTMLElement;
  container!: HTMLElement;
  options: PinchZoomOptions = defaultOptions;

  zoomFactor: number = 1;
  lastScale: number = 1;

  _isOffsetsSet!: boolean;
  initialOffset: {x: number; y: number} = {x: 0, y: 0};
  offset: {x: number; y: number}  = {x: 0, y: 0};

  hasInteraction!: boolean;
  inAnimtaion!: boolean;
  
  get getInitialZoomFactor() { // 초기 확대/축소 비율 (container 자식 요소)
    const xZoom = this.container.offsetWidth / this.el.offsetWidth;
    const yZoom = this.container.offsetHeight / this.el.offsetHeight;
    return Math.min(xZoom, yZoom);
  }

  constructor(el: HTMLElement, options: Object) {
    this.el = el;
    this.options = Object.assign({}, this.options, options);

    this.setupMarkup();
    Promise.all(this.isImageLoaded(el)).then((val) => {
      this.updateContianerY();
      this.setupOffsets();
      this.updateTransform();
    });
  }
  private setupMarkup () {
    this.container = buildElement('<div class="pinch-zoom-container"></div>');
    this.el.parentNode?.insertBefore(this.container, this.el);
    this.container.appendChild(this.el);

    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';

    this.el.style.transformOrigin = '0% 0%';
    this.el.style.position = 'absolute';
  }
  // Determine if image is loaded (이미지 로드 확인)
  private isImageLoaded (el: HTMLElement) {
    if (el.nodeName === 'IMG') {
      return [loadImage((el as HTMLImageElement).src)]
    } else {
      const childs = el.querySelectorAll('img');
      return [...childs].map((el: HTMLImageElement) => loadImage(el.src))
    }
  }
  private setupOffsets () {
    if (this.options.setOffsetsOnce && this._isOffsetsSet) return;
    this._isOffsetsSet = true;

    this.computeInitialOffset();
    this.resetOffset();
  }
  // Updates the css values according to the current zoom factor and offset
  // 현재 확대/축소 비율 및 오프셋에 따라 css 값을 업데이트합니다.
  private updateTransform () {
    const zoomFactor = this.getInitialZoomFactor * this.zoomFactor;
    const offsetX = - this.offset.x / zoomFactor;
    const offsetY = - this.offset.y / zoomFactor;
    const transform2d = `scale(${zoomFactor}, ${zoomFactor}) translate(${offsetX}px, ${offsetY}px)`;
    this.el.style.transform = transform2d;
  }
  // utils
  private unsetContainerY () {
    this.container.style.height = '0px';
  }
  private setContainerY (y: number) {
    this.container.style.height = y + 'px';
  }
  private updateContianerY () { // container Y 크기 
    this.unsetContainerY()
    this.setContainerY((this.container.parentElement as HTMLElement).offsetHeight)
  }
  private computeInitialOffset() { // 초기 상대 위치 (offset) 계산 - 컨테이너 안에 요소가 중앙 위치
    const x = - Math.abs((this.el.offsetWidth * this.getInitialZoomFactor - this.container.offsetWidth)) / 2;
    const y = - Math.abs((this.el.offsetHeight * this.getInitialZoomFactor - this.container.offsetHeight))/ 2;
    this.initialOffset = {x, y};
  }
  private resetOffset () {
    this.offset.x = this.initialOffset.x
    this.offset.y = this.initialOffset.y
  }
}

const main = async () => {try {
  const el = document.querySelector('.pinch-zoom') as HTMLElement;
  const pinchzoom = new PinchZoom(el, {});

} catch(e: any) {
  console.error(e)
  // throw Error(e)
}}
main()