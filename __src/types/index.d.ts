declare module '*.json';

type PinchZoomEventHandler = (target: PinchZoom, event: TouchEvent) => void;

interface PinchZoomOptions {
  tapZoomFactor?: number; // 탭 확대,축소 배율
  zoomOutFactor?: number; // 축소 배율
  animationDuration?: number; // 지속시간
  maxZoom?: number; // 최대 확대 배율
  minZoom?: number; // 최소 축소 배율
  draggableUnzoomed?: boolean; // 드래그 줌 해제
  lockDragAxis?: boolean; // 드래그 해제
  setOffsetsOnce?: boolean;
  use2d?: boolean; // 2d 사용 여부
  verticalPadding?: number; // 상하 여백
  horizontalPadding?: number; // 좌우 여백

  onZoomStart?: PinchZoomEventHandler|null;
  onZoomEnd?: PinchZoomEventHandler|null;
  onZoomUpdate?: PinchZoomEventHandler|null;
  onDragStart?: PinchZoomEventHandler|null;
  onDragEnd?: PinchZoomEventHandler|null;
  onDragUpdate?: PinchZoomEventHandler|null;
  onDoubleTap?: PinchZoomEventHandler|null;

  zoomStartEventName?: string;
  zoomUpdateEventName?: string;
  zoomEndEventName?: string;
  dragStartEventName?: string;
  dragUpdateEventName?: string;
  dragEndEventName?: string;
  doubleTapEventName?: string;
}
