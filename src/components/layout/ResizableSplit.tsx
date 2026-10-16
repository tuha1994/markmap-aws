import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react';

export type ResizeDirection = 'horizontal' | 'vertical';
type ResizeValueUnit = 'pixels' | 'percent';

type ResizableSplitProps = {
  direction: ResizeDirection;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  value?: number;
  valueUnit?: ResizeValueUnit;
  step?: number;
  onValueChange(value: number): void;
};

type ActivePointer = {
  id: number;
  origin: number;
  value: number;
  contentSize: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function useDesktopViewport() {
  const query = '(min-width: 921px)';
  const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [isDesktop, setIsDesktop] = useState(() => !hasMatchMedia || window.matchMedia(query).matches);

  useEffect(() => {
    if (!hasMatchMedia) return;
    const mediaQuery = window.matchMedia(query);
    const update = () => setIsDesktop(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, [hasMatchMedia]);

  return isDesktop;
}

export function ResizableSplit({
  direction,
  label,
  min,
  max,
  defaultValue,
  value = defaultValue,
  valueUnit = 'pixels',
  step = 1,
  onValueChange
}: ResizableSplitProps) {
  const isDesktop = useDesktopViewport();
  const [activePointer, setActivePointer] = useState<ActivePointer | null>(null);
  const currentValue = clamp(value, min, max);
  const isHorizontal = direction === 'horizontal';

  if (!isDesktop) return null;

  const setBoundedValue = (nextValue: number) => onValueChange(clamp(nextValue, min, max));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const increment = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const decrement = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
    if (event.key === increment) {
      event.preventDefault();
      setBoundedValue(currentValue + step);
    } else if (event.key === decrement) {
      event.preventDefault();
      setBoundedValue(currentValue - step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setBoundedValue(min);
    } else if (event.key === 'End') {
      event.preventDefault();
      setBoundedValue(max);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActivePointer({
      id: event.pointerId,
      origin: isHorizontal ? event.clientX : event.clientY,
      value: currentValue,
      contentSize: event.currentTarget.parentElement?.clientWidth ?? 0
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    const position = isHorizontal ? event.clientX : event.clientY;
    const pixelDelta = position - activePointer.origin;
    const valueDelta = valueUnit === 'percent'
      ? activePointer.contentSize > 0 ? pixelDelta / activePointer.contentSize * 100 : 0
      : pixelDelta;
    setBoundedValue(activePointer.value + valueDelta);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setActivePointer(null);
  };

  return (
    <div
      aria-label={label}
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={currentValue}
      aria-valuetext={`${currentValue}`}
      className={`resizable-split resizable-split--${direction}`}
      data-active={activePointer ? 'true' : 'false'}
      onKeyDown={onKeyDown}
      onLostPointerCapture={() => setActivePointer(null)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      tabIndex={0}
    />
  );
}
