"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type PointerEvent
} from "react";

export const AIGC_NODE_DRAG_THRESHOLD = 4;

interface ActivePointerGesture {
  dragged: boolean;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
}

export function useAigcNodeSurfaceActivation(
  onActivate: (target: HTMLElement) => void
) {
  const activeGestureRef = useRef<ActivePointerGesture | null>(null);
  const lastPointerTypeRef = useRef<string | null>(null);
  const onActivateRef = useRef(onActivate);
  const suppressActivationRef = useRef(false);

  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    activeGestureRef.current = {
      dragged: false,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY
    };
    lastPointerTypeRef.current = event.pointerType;
    suppressActivationRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const gesture = activeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = Math.hypot(
      event.clientX - gesture.startX,
      event.clientY - gesture.startY
    );
    if (distance > AIGC_NODE_DRAG_THRESHOLD) {
      gesture.dragged = true;
      suppressActivationRef.current = true;
    }
  }, []);

  const finishPointerGesture = useCallback(
    (event: PointerEvent<HTMLElement>, canceled = false) => {
      const gesture = activeGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      suppressActivationRef.current = canceled || gesture.dragged;
      lastPointerTypeRef.current = gesture.pointerType;
      activeGestureRef.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
    },
    []
  );

  const onDoubleClickCapture = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const suppressed =
        suppressActivationRef.current ||
        lastPointerTypeRef.current === "touch";
      suppressActivationRef.current = false;
      if (!suppressed) {
        onActivateRef.current(event.currentTarget);
      }
    },
    []
  );

  const suppressTouchActivation = useCallback(() => {
    lastPointerTypeRef.current = "touch";
    suppressActivationRef.current = true;
  }, []);

  return {
    onDoubleClickCapture,
    onPointerCancel: (event: PointerEvent<HTMLElement>) =>
      finishPointerGesture(event, true),
    onPointerDown,
    onPointerMove,
    onPointerUp: finishPointerGesture,
    onTouchCancel: suppressTouchActivation,
    onTouchEnd: suppressTouchActivation,
    onTouchStart: suppressTouchActivation
  };
}

export function stopAigcNodeControlEvent(event: {
  stopPropagation: () => void;
}) {
  event.stopPropagation();
}
