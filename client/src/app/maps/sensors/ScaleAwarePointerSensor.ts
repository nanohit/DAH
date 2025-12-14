import { PointerSensor } from '@dnd-kit/core';
import type { PointerSensorOptions } from '@dnd-kit/core';
import type { SensorProps } from '@dnd-kit/core/dist/sensors/types';
import type { Coordinates } from '@dnd-kit/utilities';

const scaleCoordinates = (coordinates: Coordinates, scale: number): Coordinates => {
  if (scale === 1) {
    return coordinates;
  }

  return {
    x: coordinates.x / scale,
    y: coordinates.y / scale,
  };
};

const maybeScaleCoordinates = <T extends Coordinates | null | undefined>(coordinates: T, scale: number): T => {
  if (!coordinates) {
    return coordinates;
  }

  return scaleCoordinates(coordinates, scale) as T;
};

export interface ScaleAwarePointerSensorOptions extends PointerSensorOptions {
  getScale?: () => number;
}

export type ScaleAwarePointerSensorProps = SensorProps<ScaleAwarePointerSensorOptions>;

export class ScaleAwarePointerSensor extends PointerSensor {
  constructor(props: ScaleAwarePointerSensorProps) {
    const { onStart, onMove, onPending, options } = props;
    const getScale = options.getScale ?? (() => 1);

    const scaledProps: ScaleAwarePointerSensorProps = {
      ...props,
      onStart: (coordinates) => {
        onStart(scaleCoordinates(coordinates, getScale()));
      },
      onMove: (coordinates) => {
        onMove(scaleCoordinates(coordinates, getScale()));
      },
      onPending: (active, constraint, initialCoordinates, offset) => {
        onPending(
          active,
          constraint,
          maybeScaleCoordinates(initialCoordinates, getScale()),
          offset,
        );
      },
    };

    super(scaledProps);
  }
}
