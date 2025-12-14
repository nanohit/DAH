import {
  ALIGNMENT_THRESHOLD,
  CANVAS_DIMENSION,
  DEFAULT_BOOK_HEIGHT,
  DEFAULT_BOOK_WIDTH,
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_WIDTH,
  DEFAULT_LINK_HEIGHT,
  DEFAULT_LINK_WIDTH,
  DEFAULT_TEXT_HORIZONTAL_HEIGHT,
  DEFAULT_TEXT_HORIZONTAL_WIDTH,
  DEFAULT_TEXT_VERTICAL_HEIGHT,
  DEFAULT_TEXT_VERTICAL_WIDTH,
  SNAP_THRESHOLD,
} from './constants';
import { AlignmentGuide, MapElement, SnapToGridArgs } from './types';

export const getDefaultDimensions = (element: MapElement) => {
  if (element.type === 'book') {
    return { width: DEFAULT_BOOK_WIDTH, height: DEFAULT_BOOK_HEIGHT };
  }
  if (element.type === 'image') {
    return { width: DEFAULT_IMAGE_WIDTH, height: DEFAULT_IMAGE_HEIGHT };
  }
  if (element.type === 'link') {
    return { width: DEFAULT_LINK_WIDTH, height: DEFAULT_LINK_HEIGHT };
  }
  if (element.orientation === 'horizontal') {
    return { width: DEFAULT_TEXT_HORIZONTAL_WIDTH, height: DEFAULT_TEXT_HORIZONTAL_HEIGHT };
  }
  return { width: DEFAULT_TEXT_VERTICAL_WIDTH, height: DEFAULT_TEXT_VERTICAL_HEIGHT };
};

export const clampToCanvas = (value: number, size: number) => {
  return Math.max(0, Math.min(value, CANVAS_DIMENSION - size));
};

export const snapToGrid = (args: SnapToGridArgs) => {
  const { transform, active, draggingElement, elements } = args;
  if (!active || !draggingElement) return transform;

  const activeElement = elements.find((el) => el.id === active.id);
  if (!activeElement) return transform;

  const activeDefaults = getDefaultDimensions(activeElement);
  const elementWidth = activeElement.width || activeDefaults.width;
  const elementHeight = activeElement.height || activeDefaults.height;

  const currentLeft = activeElement.left + transform.x;
  const currentTop = activeElement.top + transform.y;

  let bestSnapX = transform.x;
  let bestSnapY = transform.y;
  let minDistanceX = SNAP_THRESHOLD;
  let minDistanceY = SNAP_THRESHOLD;

  elements.forEach((element) => {
    if (element.id === active.id) return;

    const targetDefaults = getDefaultDimensions(element);
    const targetWidth = element.width || targetDefaults.width;
    const targetHeight = element.height || targetDefaults.height;

    const activeCenter = currentLeft + elementWidth / 2;
    const targetCenter = element.left + targetWidth / 2;
    const centerDiff = Math.abs(activeCenter - targetCenter);
    if (centerDiff < minDistanceX) {
      minDistanceX = centerDiff;
      bestSnapX = targetCenter - (activeElement.left + elementWidth / 2);
    }

    const leftDiff = Math.abs(currentLeft - element.left);
    if (leftDiff < minDistanceX) {
      minDistanceX = leftDiff;
      bestSnapX = element.left - activeElement.left;
    }

    const rightDiff = Math.abs(currentLeft + elementWidth - (element.left + targetWidth));
    if (rightDiff < minDistanceX) {
      minDistanceX = rightDiff;
      bestSnapX = element.left + targetWidth - (activeElement.left + elementWidth);
    }

    const activeCenterY = currentTop + elementHeight / 2;
    const targetCenterY = element.top + targetHeight / 2;
    const centerDiffY = Math.abs(activeCenterY - targetCenterY);
    if (centerDiffY < minDistanceY) {
      minDistanceY = centerDiffY;
      bestSnapY = targetCenterY - (activeElement.top + elementHeight / 2);
    }

    const topDiff = Math.abs(currentTop - element.top);
    if (topDiff < minDistanceY) {
      minDistanceY = topDiff;
      bestSnapY = element.top - activeElement.top;
    }

    const bottomDiff = Math.abs(currentTop + elementHeight - (element.top + targetHeight));
    if (bottomDiff < minDistanceY) {
      minDistanceY = bottomDiff;
      bestSnapY = element.top + targetHeight - (activeElement.top + elementHeight);
    }
  });

  return {
    x: minDistanceX < SNAP_THRESHOLD ? bestSnapX : transform.x,
    y: minDistanceY < SNAP_THRESHOLD ? bestSnapY : transform.y,
  };
};

export const calculateAlignmentGuides = (
  elements: MapElement[],
  activeId: string,
  x: number,
  y: number,
): AlignmentGuide[] => {
  const guides: AlignmentGuide[] = [];
  const activeElement = elements.find((el) => el.id === activeId);
  if (!activeElement) return guides;

  const { width: activeWidthDefault, height: activeHeightDefault } = getDefaultDimensions(activeElement);
  const activeWidth = activeElement.width || activeWidthDefault;
  const activeHeight = activeElement.height || activeHeightDefault;

  const activeCenter = x + activeWidth / 2;
  const activeRight = x + activeWidth;
  const activeBottom = y + activeHeight;

  elements.forEach((element) => {
    if (element.id === activeId) return;
    const { width: targetWidthDefault, height: targetHeightDefault } = getDefaultDimensions(element);
    const elementWidth = element.width || targetWidthDefault;
    const elementHeight = element.height || targetHeightDefault;

    const elementCenter = element.left + elementWidth / 2;
    const elementRight = element.left + elementWidth;
    const elementBottom = element.top + elementHeight;

    if (Math.abs(activeCenter - elementCenter) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: elementCenter - activeWidth / 2, type: 'vertical' });
    }
    if (Math.abs(x - element.left) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: element.left, type: 'vertical' });
    }
    if (Math.abs(activeRight - element.left) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: element.left - activeWidth, type: 'vertical' });
    }
    if (Math.abs(x - elementRight) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: elementRight, type: 'vertical' });
    }
    if (Math.abs(activeRight - elementRight) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: elementRight - activeWidth, type: 'vertical' });
    }
    if (Math.abs(activeRight - elementCenter) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: elementCenter - activeWidth, type: 'vertical' });
    }
    if (Math.abs(x - elementCenter) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: elementCenter, type: 'vertical' });
    }

    if (Math.abs(y + activeHeight / 2 - (element.top + elementHeight / 2)) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: element.top + elementHeight / 2 - activeHeight / 2, type: 'horizontal' });
    }
    if (Math.abs(y - element.top) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: element.top, type: 'horizontal' });
    }
    if (Math.abs(activeBottom - element.top) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: element.top - activeHeight, type: 'horizontal' });
    }
    if (Math.abs(y - elementBottom) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: elementBottom, type: 'horizontal' });
    }
    if (Math.abs(activeBottom - elementBottom) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: elementBottom - activeHeight, type: 'horizontal' });
    }
    if (Math.abs(activeBottom - (element.top + elementHeight / 2)) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: element.top + elementHeight / 2 - activeHeight, type: 'horizontal' });
    }
    if (Math.abs(y - (element.top + elementHeight / 2)) < ALIGNMENT_THRESHOLD) {
      guides.push({ position: element.top + elementHeight / 2, type: 'horizontal' });
    }
  });

  return guides.filter((guide, index, self) =>
    index === self.findIndex((g) => g.position === guide.position && g.type === guide.type),
  );
};

export const calculateAngle = (x1: number, y1: number, x2: number, y2: number) => {
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
};

export const snapAngle = (angle: number) => {
  const commonAngles = [0, 45, 90, 135, 180, -135, -90, -45];
  const threshold = 10;
  let closestAngle = commonAngles[0];
  let minDiff = Math.abs(angle - commonAngles[0]);
  for (const commonAngle of commonAngles) {
    const diff = Math.abs(angle - commonAngle);
    if (diff < minDiff) {
      minDiff = diff;
      closestAngle = commonAngle;
    }
  }
  return minDiff <= threshold ? closestAngle : angle;
};

export const calculateEndpoint = (startX: number, startY: number, angle: number, distance: number) => {
  const angleRad = (angle * Math.PI) / 180;
  return {
    x: startX + distance * Math.cos(angleRad),
    y: startY + distance * Math.sin(angleRad),
  };
};

export const getViewportCenterInCanvas = (
  canvasPosition: { x: number; y: number },
  scale: number,
) => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const centerX = (viewportWidth - canvasPosition.x) / scale;
  const centerY = (viewportHeight - canvasPosition.y) / scale;
  return { x: centerX, y: centerY };
};

export const DEFAULT_ELEMENT_TEXT = 'double click or press space to edit';

export const isDefaultText = (text: string) => text === DEFAULT_ELEMENT_TEXT;

