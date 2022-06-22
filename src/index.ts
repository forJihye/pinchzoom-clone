import './index.css';
import { buildElement, loadImage, triggerEvent } from './utils';
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
  isDoubleTap!: boolean;
  enabled!: boolean;

  get getInitialZoomFactor() { // 초기 확대/축소 비율 (container 자식 요소)
    const xZoom = this.container.offsetWidth / this.el.offsetWidth;
    const yZoom = this.container.offsetHeight / this.el.offsetHeight;
    return Math.min(xZoom, yZoom);
  }
  constructor(el: HTMLElement, options: Object) {
    this.el = el;
    this.options = Object.assign({}, this.options, options);

    this.setupMarkup();
    this.detectGestures(this.container, this);
    
    Promise.all(this.isImageLoaded(el)).then((val) => {
      this.updateContianerY();
      this.setupOffsets();
      this.updateTransform();
    });
    this.enable();
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
  // container offset 기준으로 터치 위치 반환
  private getTouches (event: TouchEvent) {
    const rect = this.container.getBoundingClientRect();
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
    const top = rect.top + scrollTop;
    const left = rect.left + scrollLeft;
    
    return [...event.touches].map(touch => ({
      x: touch.clientX - top,
      y: touch.clientY - left,
    }));
  }
  // Scale to a specific zoom factor (not relative) 특정 확대/축소 비율로 크키 고정 (상대적X)
  private scaleTo (zoomFactor: number, center: {x: number; y: number}) {
    this.scale(zoomFactor, center)
  }
  // Scales the element from specified center 지정된 중심에서의 요소 스케일 (크키) 조정
  private scale (scale: number, center: {x: number; y: number}) {
    scale = this.scaleZoomFactor(scale);
    this.addOffset({
      x: (scale - 1) * (center.x + this.offset.x),
      y: (scale - 1) * (center.y + this.offset.y),
    });

  }
  // 현재 상태를 기준으로 확대/축소 비율 재조정
  private scaleZoomFactor (scale: number) {
    const originZoom = this.zoomFactor;
    this.zoomFactor += scale;
    this.zoomFactor = Math.min(this.options.maxZoom as number, Math.max(this.zoomFactor, this.options.minZoom as number));
    return this.zoomFactor / originZoom;
  }

  // detect Gestures 동작 탐지
  private detectGestures (container: HTMLElement, target: PinchZoom) {
    let firstMove = true;
    let fingers = 0;
    let lastTouchStart: null|number = null;
    let startTouches: null|number = null;
    
    const detectDoubleTap = (ev: TouchEvent) => { // 더블 더치 동작
      const time = new Date().getTime();
      if (fingers > 1) lastTouchStart = null;

      const dist = time - (lastTouchStart as number)
      if (dist < 300)  { // 300 -> touchstart 터치 두번 간격 시간
        target.cancelTouchEvent(ev);
        target.handleDoubleTap(ev);
      } else {
        target.isDoubleTap = false;
      }
      if (fingers === 1) lastTouchStart = time;
    }

    // addEventListener - https://developer.mozilla.org/ko/docs/Web/API/EventTarget/addEventListener
    container.addEventListener('touchstart', (ev) => {
      if (target.enabled) {
        console.log('touchstart', ev);
        firstMove = true;
        fingers = ev.touches.length;
        detectDoubleTap(ev);
      }
    }, { passive: false }) 
    container.addEventListener('touchmove', (ev) => {
      console.log('touchmove', ev)
      if (target.enabled && !target.isDoubleTap) {
        if (firstMove) {
          
        } else {

        }
        firstMove = false;
      }
    }, { passive: false })
    container.addEventListener('touchend', (ev) => {
      console.log('touchend', ev)
      if (target.enabled) {
        fingers = ev.touches.length;
      }
    })
  }

  // event Handler
  private cancelTouchEvent (event: TouchEvent) {
    event.stopPropagation();
    event.preventDefault();
  }
  // Event handler for 'doubletap'
  private handleDoubleTap (event: TouchEvent) {
    if (this.hasInteraction) return;
    this.isDoubleTap = true;

    let center = this.getTouches(event)[0];
    const zoomFactor = this.zoomFactor > 1 ? 1 : this.zoomFactor;
    const startZoomFactor = this.zoomFactor;

    this.scaleTo(startZoomFactor + 0 * (zoomFactor - startZoomFactor), center);
    this.updateTransform();

    if (startZoomFactor > zoomFactor) {
      console.log('current center zoom')
    }
    // custom callback option
    triggerEvent(this.el, this.options.doubleTapEventName as string);
    if(typeof this.options.onDoubleTap == "function"){
      this.options.onDoubleTap(this, event)
    }
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
  private addOffset (offset: {x: number; y: number}) {
    this.offset = {
      x: this.offset.x + offset.x,
      y: this.offset.y + offset.y
    }
  }
  private enable() {
    this.enabled = true;
  }
  private disable () {
    this.enabled = false;
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