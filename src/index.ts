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
  nthZoom: number = 0;

  lastZoomCenter!: boolean|{x: number; y: number};
  lastDragPosition!: boolean|{x: number; y: number};;

  _isOffsetsSet!: boolean;
  initialOffset: {x: number; y: number} = {x: 0, y: 0};
  offset: {x: number; y: number}  = {x: 0, y: 0};

  hasInteraction!: boolean;
  inAnimation!: boolean;
  isDoubleTap!: boolean;
  enabled!: boolean;
// 초기 확대/축소 비율 (container 자식 요소)
  get getInitialZoomFactor() { 
    const xZoom = this.container.offsetWidth / this.el.offsetWidth;
    const yZoom = this.container.offsetHeight / this.el.offsetHeight;
    return Math.min(xZoom, yZoom);
  }
  // 현재 오프셋 및 확대/축소 비율에 대한 가상 확대/축소 중심 계산 (역 줌 사용)
  get getCurrentZoomCenter() { // return - the current zoom center
    const offsetLeft = this.offset.x - this.initialOffset.x;
    const offsetTop = this.offset.y - this.initialOffset.y;
    const centerX = -1 * this.offset.x - offsetLeft / (1 / this.zoomFactor - 1);
    const centerY = -1 * this.offset.y - offsetTop / (1 / this.zoomFactor - 1);
    return {
      x: centerX,
      y: centerY,
    }
  }
  constructor(el: HTMLElement, options: Object) {
    this.el = el;
    this.options = Object.assign({}, this.options, options);

    this.setupMarkup();
    
    Promise.all(this.isImageLoaded(el)).then((val) => {
      this.updateContianerY();
      this.setupOffsets();
      this.updateTransform();
      this.detectGestures(this.container, this);
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
  // 오프셋의 최대 / 최소값 
  private sanitizeOffset (offset: {x: number; y: number}) {
    const elWidth = this.el.offsetWidth * this.getInitialZoomFactor * this.zoomFactor;
    const elHeight = this.el.offsetHeight * this.getInitialZoomFactor * this.zoomFactor;
    const maxX = elWidth - this.container.offsetWidth + (this.options.horizontalPadding as number);
    const maxY = elHeight -  this.container.offsetHeight + (this.options.verticalPadding as number);
    const maxOffsetX = Math.max(maxX, 0);
    const maxOffsetY = Math.max(maxY, 0);
    const minOffsetX = Math.min(maxX, 0) - (this.options.horizontalPadding as number);
    const minOffsetY = Math.min(maxY, 0) - (this.options.verticalPadding as number);
    return {
      x: Math.min(Math.max(offset.x, minOffsetX), maxOffsetX),
      y: Math.min(Math.max(offset.y, minOffsetY), maxOffsetY)
  };
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
  private endTransform () {
    this.hasInteraction = false;
    this.sanitize();
    this.updateTransform()
  }
  // 현재 상태를 기준으로 확대/축소 비율 재조정
  private scaleZoomFactor (scale: number) {
    const originZoom = this.zoomFactor;
    this.zoomFactor *= scale;
    this.zoomFactor = Math.min(this.options.maxZoom as number, Math.max(this.zoomFactor, this.options.minZoom as number));
    return this.zoomFactor / originZoom;
  }
  private isCloseTo (value: number, expected: number) {
    return value > expected - 0.01 && value < expected + 0.01;
  };
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
  private targetTouches (touches: TouchList) {
    return Array.from(touches).map(function (touch) {
      return { x: touch.pageX, y: touch.pageY };
    }); 
  }
  private getDistance (a: {x: number; y: number}, b: {x: number; y: number}) {
    let x = 0;
    let y = 0;
    x = a.x - b.x;
    y = a.y - b.y;
    return Math.sqrt(x * x + y * y)
  }
  private calculateScale (startTouches: {x: number; y: number}[], endTouches: {x: number; y: number}[]) {
    const startDistance = this.getDistance(startTouches[0], startTouches[1])
    const endDistance = this.getDistance(endTouches[0], endTouches[1])
    return endDistance / startDistance;
  }
  // 여러 번의 터치의 터치 중심을 계산 
  private getTouchCenter (touches: {x: number; y: number}[]) {
    return this.getVectorAvg(touches);
  }
  // 다중 벡터(x, y 값)의 평균을 계산
  private getVectorAvg (vectors: {x: number; y: number}[]) {
    return {
        x: vectors.map(function (v) { return v.x; }).reduce((a, b) => a + b) / vectors.length,
        y: vectors.map(function (v) { return v.y; }).reduce((a, b) => a + b) / vectors.length
    };
  }
  // Scale to a specific zoom factor (not relative) 특정 확대/축소 비율로 크키 고정 (상대적X)
  private scaleTo (zoomFactor: number, center: {x: number; y: number}) {
    this.scale(zoomFactor / this.zoomFactor, center)
  }
  // Scales the element from specified center 지정된 중심에서의 요소 스케일 (크키) 조정
  private scale (scale: number, center: {x: number; y: number}) {
    scale = this.scaleZoomFactor(scale);
    this.addOffset({
      x: (scale - 1) * (center.x + this.offset.x),
      y: (scale - 1) * (center.y + this.offset.y),
    });
  }
  private drag (center: {x: number; y: number}, lastCenter: {x: number; y: number}) {
    if (lastCenter) {
      if (this.options.lockDragAxis) {
        // 가장 많이 변경된 위치로 스크롤 잠금
        if (Math.abs(center.x - lastCenter.x) > Math.abs(center.y - lastCenter.y)) {
          this.addOffset({
            x: -(center.x - lastCenter.x),
            y: 0
          });
        } else {
          this.addOffset({
            y: -(center.y - lastCenter.y),
            x: 0
          });
        }
      } else {
        this.addOffset({
          y: -(center.y - lastCenter.y),
          x: -(center.x - lastCenter.x)
        });
      }
    }
  }
  private sanitize() {
    if (this.zoomFactor < (this.options.zoomOutFactor as number)) {
      this.zoomOutAnimation()
    } else if (this.isInsaneOffset(this.offset)) {
      this.sanitizeOffsetAnimation();
    }
  }
  // 오프셋이 현재 줌 계수로 정상인지 확인
  private isInsaneOffset(offset: {x: number; y: number}) {
    const sanitizedOffset = this.sanitizeOffset(offset);
    return sanitizedOffset.x !== offset.x || sanitizedOffset.y !== offset.y;
  }
  // offset 이동 애니메이션
  private sanitizeOffsetAnimation () {
    const targetOffset = this.sanitizeOffset(this.offset);
    const startOffset = {x: this.offset.x, y: this.offset.y};

    this.animate({
      timing: (timeFraction: number) => {
        return -Math.cos(timeFraction * Math.PI) / 2  + 0.5; // swing timing
      },  
      draw: (progress: number) => {
        this.offset.x = startOffset.x + progress * (targetOffset.x - startOffset.x);
        this.offset.y = startOffset.y + progress * (targetOffset.y - startOffset.y);
        this.updateTransform();
      },
      duration: this.options.animationDuration as number
    })
  }
  // 원래 위치로 다시 zoom
  private zoomOutAnimation () {
    if (this.zoomFactor === 1) return;
    const startZoomFactor = this.zoomFactor;
    const zoomFactor = 1;
    const center = this.getCurrentZoomCenter;
    this.animate({
      timing: (timeFraction: number) => {
        return -Math.cos(timeFraction * Math.PI) / 2  + 0.5; // swing timing
      },  
      draw: (progress: number) => {
        this.scaleTo(startZoomFactor + progress * (zoomFactor - startZoomFactor), center)
      },
      duration: this.options.animationDuration as number
    })
  }
  // detect Gestures 동작 탐지
  private detectGestures (container: HTMLElement, target: PinchZoom) {
    let firstMove = true;
    let fingers = 0;
    let lastTouchStart: null|number = null;
    let startTouches: null|{x: number; y: number}[] = null;
    let interaction: null|'zoom'|'drag' = null;

    // 동작 적용 (줌 & 드래그)
    const setInteraction = (newInteraction: null|'zoom'|'drag', ev: TouchEvent) => {
      if (interaction !== newInteraction) {
        if (interaction && !newInteraction) {
          switch (interaction) {
            case 'zoom': target.handleZoomEnd(ev)
            break;
            case 'drag': target.handleDragEnd(ev)
            break;
          }
        }
        switch (newInteraction) {
        case 'zoom': target.handleZoomStart(ev)
        break;
        case 'drag': target.handleDragStart(ev)
        break;
        }
      }
      interaction = newInteraction;
    }

    // 동작 업데이트 (줌 & 드래그)
    const updateInteraction = (ev: TouchEvent) => {
      if (fingers === 2) setInteraction('zoom', ev)
      else if (fingers === 1 && target.canDrag()) setInteraction('drag', ev)
      else setInteraction(null, ev);
    }
    
    // 더블 더치 동작
    const detectDoubleTap = (ev: TouchEvent) => { 
      const time = new Date().getTime();
      if (fingers > 1) lastTouchStart = null;

      const dist = time - (lastTouchStart as number)
      if (dist < 300)  { // 300 -> touchstart 터치 두번 간격 시간
        target.cancelTouchEvent(ev);
        target.handleDoubleTap(ev);
        switch (interaction) {
        case 'zoom': target.handleZoomEnd(ev)
        break;
        case 'drag': target.handleDragEnd(ev)
        break
        }
      } else {
        target.isDoubleTap = false;
      }
      if (fingers === 1) lastTouchStart = time;
    }

    // addEventListener - https://developer.mozilla.org/ko/docs/Web/API/EventTarget/addEventListener
    container.addEventListener('touchstart', (ev) => {
      // console.log('touchstart', ev);
      if (target.enabled) {
        firstMove = true;
        fingers = ev.touches.length;
        detectDoubleTap(ev);
      }
    }, { passive: false }) 

    container.addEventListener('touchmove', (ev) => {
      // console.log('touchmove', ev)
      if (target.enabled && !target.isDoubleTap) {
        if (firstMove) {
          updateInteraction(ev);
          if (interaction) {
            this.cancelTouchEvent(ev)
          }
          startTouches = this.targetTouches(ev.touches);
        } else {
          switch (interaction) {
          case 'zoom': 
            if (startTouches?.length === 2 && ev.touches.length === 2) {
              this.handleZoom(ev, this.calculateScale(startTouches, this.targetTouches(ev.touches)))
            }
          break;
          case 'drag': this.handleDrag(ev)
          break;
          }
          if (interaction) {
            this.cancelTouchEvent(ev)
            this.updateTransform();
          }
        }
        firstMove = false;
      } 
    }, { passive: false })

    container.addEventListener('touchend', (ev) => {
      // console.log('touchend', ev)
      if (target.enabled) {
        fingers = ev.touches.length;
        updateInteraction(ev)
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
    const zoomFactor = this.zoomFactor > 1 ? 1 : this.options.tapZoomFactor as number;
    const startZoomFactor = this.zoomFactor;

    if (startZoomFactor > zoomFactor) { // 역 줌
      center = this.getCurrentZoomCenter;
    }
    
    this.animate({
      timing: (timeFraction: number) => {
        return -Math.cos(timeFraction * Math.PI) / 2  + 0.5; // swing timing
      },  
      draw: (progress: number) => {
        this.scaleTo(startZoomFactor + progress * (zoomFactor - startZoomFactor), center)
      },
      duration: this.options.animationDuration as number
    })

    // custom callback option
    triggerEvent(this.el, this.options.doubleTapEventName as string);
    if(typeof this.options.onDoubleTap == "function"){
      this.options.onDoubleTap(this, event)
    }
  }
  // Event handler for 'zoomstart'
  private handleZoomStart (event: TouchEvent) {
    this.inAnimation = false;
    this.lastScale = 1;
    this.nthZoom = 0;
    this.lastZoomCenter = false;
    this.hasInteraction = true;
  }
  // Event handler for 'zoomend'
  private handleZoomEnd (event: TouchEvent) {
    this.endTransform();
  }
  // Event hansler for 'zoom' 
  private handleZoom (event: TouchEvent, newScale: number ) {
    const touchCenter = this.getTouchCenter(this.getTouches(event));
    const scale = newScale / this.lastScale;
    this.lastScale = newScale;

    this.nthZoom += 1;
    if (this.nthZoom > 3) {
      this.scale(scale, touchCenter);
      this.drag(touchCenter, this.lastZoomCenter as {x: number; y: number});
    } 
    this.lastZoomCenter = touchCenter;
  }
  // Event handler for 'dragStart'
  private handleDragStart (event: TouchEvent) {
    this.inAnimation = false;
    this.lastDragPosition = false;
    this.hasInteraction = true;
    this.handleDrag(event);
  }
  // Event handler for 'dragEnd'
  private handleDragEnd (event: TouchEvent) {
    this.endTransform();
  }
  // Event hansler for 'drag' 
  private handleDrag (event: TouchEvent) {
    const touch = this.getTouches(event)[0];
    this.drag(touch, this.lastDragPosition as {x: number; y: number});
    this.offset = this.sanitizeOffset(this.offset);
    this.lastDragPosition = touch;
  }
  // requestAnimationFrame - https://javascript.info/js-animation
  private animate (options: {timing: Function, draw: Function, duration: number, callback?: () => void}) {
    let start = performance.now();
    this.inAnimation = true;

    const self = this;
    function render(time: number) {
      if (!self.inAnimation) return;
      let timeFraction = (performance.now() - start) / options.duration;
      if (timeFraction > 1) {
        timeFraction = 1;
        options.draw(1);
        if (options?.callback) options.callback();
        self.updateTransform();
        self.inAnimation = false;
        self.updateTransform();
      } else {
        let progress = options.timing(timeFraction);
        options.draw(progress);
        self.updateTransform();
        requestAnimationFrame(render);
      }
    }
    requestAnimationFrame(render);
  }
  // 이미지가 끌 수 있는 상태인지 확인
  // 이미지를 끌 수 있는 경우 끌기 이벤트가 수행되고 취소 / 끌 수 없는 경우 끌기 이벤트가 이 구성 요소를 통해 버블.
  private canDrag () {
    return this.options.draggableUnzoomed || !this.isCloseTo(this.zoomFactor, 1);
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