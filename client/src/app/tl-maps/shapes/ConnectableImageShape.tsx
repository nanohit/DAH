'use client';

import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, TLBaseShape, VecModel } from 'tldraw';

type ConnectableImageShape = TLBaseShape<
  'connectable-image',
  {
    w: number;
    h: number;
    src: string;
  }
>;

export class ConnectableImageShapeUtil extends BaseBoxShapeUtil<ConnectableImageShape> {
  static override type = 'connectable-image' as const;

  override getDefaultProps(): ConnectableImageShape['props'] {
    return {
      w: 300,
      h: 300,
      src: '',
    };
  }

  override getGeometry(shape: ConnectableImageShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override component(shape: ConnectableImageShape) {
    const { w, h, src } = shape.props;
    return (
      <HTMLContainer id={shape.id}>
        <div
          style={{
            width: w,
            height: h,
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {src ? (
            <img src={src} alt="Canvas asset" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                background: '#f5f5f7',
                fontSize: 12,
              }}
            >
              No image
            </div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  override indicator(shape: ConnectableImageShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }

}

export type { ConnectableImageShape };

