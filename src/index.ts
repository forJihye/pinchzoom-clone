import './index.css';
import { buildElement } from './utils';
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
  options: PinchZoomOptions = defaultOptions;

  container!: HTMLElement;
  constructor(el: HTMLElement, options: Object) {
    this.el = el;
    this.options = Object.assign({}, this.options, options);

    this.setupMarkup();
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
}

const main = async () => {try {
  const el = document.querySelector('div.pinch-zoom') as HTMLElement;
  const pinchzoom = new PinchZoom(el, {});

} catch(e: any) {
  throw Error(e)
}}
main()