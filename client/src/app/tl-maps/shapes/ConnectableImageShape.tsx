'use client';

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  TLBaseShape,
} from 'tldraw';

// Define the shape type
type ConnectableImageShape = TLBaseShape<
  'connectable-image',
  {
    w: number;
    h: number;
    url: string;
    alt: string;
  }
>;

// Shape util for connectable images
export class ConnectableImageShapeUtil extends BaseBoxShapeUtil<ConnectableImageShape> {
  static override type = 'connectable-image' as const;

  getDefaultProps(): ConnectableImageShape['props'] {
    return {
      w: 200,
      h: 200,
      url: '',
      alt: 'Image',
    };
  }

  override canBind() {
    return true;
  }

  override canEdit() {
    return false;
  }

  getGeometry(shape: ConnectableImageShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: ConnectableImageShape) {
    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '8px',
          background: '#f3f4f6',
        }}
      >
        {shape.props.url ? (
          <img
            src={shape.props.url}
            alt={shape.props.alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: '14px',
            }}
          >
            No image
          </div>
        )}
      </HTMLContainer>
    );
  }

  indicator(shape: ConnectableImageShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
