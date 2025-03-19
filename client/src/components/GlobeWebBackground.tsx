import { useEffect, useState } from 'react';

interface GlobeWebBackgroundProps {
  className?: string;
}

export default function GlobeWebBackground({ className = '' }: GlobeWebBackgroundProps) {
  // State to control animation
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  return (
    <div 
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ 
        height: '400px',
        width: '100%',
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
        background: 'black',
        zIndex: 0
      }}
    >
      <svg 
        aria-hidden="true" 
        height="100%" 
        viewBox="-201 -1 1202 452" 
        width="100%" 
        style={{ overflow: 'visible' }}
      >
        {/* Wireframe Globe - Adjusted size and position */}
        <g data-testid="globe-wireframe" mask="url(#globe-gradient-mask)">
          <circle cx="400" cy="430" fill="none" r="420"></circle>
          
          {/* Longitude lines (vertical curved lines) */}
          <path d="M 400 850 A -420 420 0 0 0 400 10" fill="none" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></path>
          <path d="M 400 850 A -345.136 420 0 0 0 400 10" fill="none" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></path>
          <path d="M 400 850 A -247.123 420 0 0 0 400 10" fill="none" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></path>
          <path d="M 400 850 A -129.252 420 0 0 0 400 10" fill="none" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></path>
          <path d="M 400 850 A 0 420 0 0 0 400 10" fill="none" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></path>
          <path d="M 400 10 A 129.252 420 0 0 0 400 850" fill="none" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></path>
          <path d="M 400 10 A 247.123 420 0 0 0 400 850" fill="none" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></path>
          <path d="M 400 10 A 345.136 420 0 0 0 400 850" fill="none" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></path>
          <path d="M 400 10 A 420 420 0 0 0 400 850" fill="none" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></path>
          
          {/* Latitude lines (horizontal lines) - Simple straight lines from edge to edge */}
          <line x1="-20" y1="130" x2="820" y2="130" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></line>
          <line x1="-20" y1="230" x2="820" y2="230" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></line>
          <line x1="-20" y1="330" x2="820" y2="330" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></line>
          <line x1="-20" y1="430" x2="820" y2="430" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></line>
          <line x1="-20" y1="530" x2="820" y2="530" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></line>
          <line x1="-20" y1="630" x2="820" y2="630" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></line>
          <line x1="-20" y1="730" x2="820" y2="730" stroke="url(#globe-gradient)" strokeWidth="1" vectorEffect="non-scaling-stroke"></line>
        </g>
        
        {/* Gradient mask for the globe */}
        <mask id="globe-gradient-mask">
          <rect fill="url(#globe-mask-gradient)" height="100%" width="100%" x="-200" y="10"></rect>
        </mask>
        
        {/* Animated paths */}
        {/* Path 1 */}
        <g id="rd03" mask="url(#globe-gradient-mask)" opacity="1">
          {/* Base path for the connection */}
          <path 
            d="M400,130 h81.421M 506.605 230 A 129.252 420 0 0 0 481.421 130" 
            fill="none" 
            stroke="rgba(44, 140, 225, 0.2)" 
            strokeWidth="1.5" 
            vectorEffect="non-scaling-stroke"
          ></path>
          
          {/* Animated glowing line segment along the path */}
          <path 
            d="M400,130 h81.421M 506.605 230 A 129.252 420 0 0 0 481.421 130" 
            fill="none" 
            stroke="url(#rd03-gradient)" 
            strokeLinecap="round" 
            strokeWidth="2.5" 
            vectorEffect="non-scaling-stroke"
          >
          </path>
          
          {/* Hidden path for motion */}
          <path 
            id="path-rd03"
            d="M400,130 h81.421M 506.605 230 A 129.252 420 0 0 0 481.421 130" 
            fill="none" 
            stroke="none"
          ></path>
          
          <defs>
            <linearGradient 
              id="rd03-gradient" 
              x1="0%" 
              y1="0%" 
              x2="100%" 
              y2="0%"
            >
              <stop offset="0%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="40%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="47%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="49%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="50%" stopColor="rgba(44, 140, 225, 1)" />
              <stop offset="51%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="53%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="60%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="100%" stopColor="rgba(44, 140, 225, 0)" />
              <animate 
                attributeName="x1" 
                dur="4.1s" 
                values="-100%;100%" 
                repeatCount="indefinite" 
              />
              <animate 
                attributeName="x2" 
                dur="4.1s" 
                values="0%;200%" 
                repeatCount="indefinite" 
              />
            </linearGradient>
          </defs>
        </g>
        
        {/* Path 2 */}
        <g id="dldd-32" mask="url(#globe-gradient-mask)" opacity="1">
          {/* Base path for the connection */}
          <path 
            d="M 115.336 230 A -345.136 420 0 0 0 81.736 330M81.736,330 h-75.399M 6.337 330 A -420 420 0 0 0 0 430M 0 430 A -420 420 0 0 0 6.337 530" 
            fill="none" 
            stroke="rgba(44, 140, 225, 0.2)" 
            strokeWidth="1.5" 
            vectorEffect="non-scaling-stroke"
          ></path>
          
          {/* Animated glowing line segment along the path */}
          <path 
            d="M 115.336 230 A -345.136 420 0 0 0 81.736 330M81.736,330 h-75.399M 6.337 330 A -420 420 0 0 0 0 430M 0 430 A -420 420 0 0 0 6.337 530" 
            fill="none" 
            stroke="url(#dldd-32-gradient)" 
            strokeLinecap="round" 
            strokeWidth="2.5" 
            vectorEffect="non-scaling-stroke"
          >
          </path>
          
          {/* Hidden path for motion */}
          <path 
            id="path-dldd-32"
            d="M 115.336 230 A -345.136 420 0 0 0 81.736 330M81.736,330 h-75.399M 6.337 330 A -420 420 0 0 0 0 430M 0 430 A -420 420 0 0 0 6.337 530" 
            fill="none" 
            stroke="none"
          ></path>
          
          <defs>
            <linearGradient 
              id="dldd-32-gradient" 
              x1="0%" 
              y1="0%" 
              x2="100%" 
              y2="0%"
            >
              <stop offset="0%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="40%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="47%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="49%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="50%" stopColor="rgba(44, 140, 225, 1)" />
              <stop offset="51%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="53%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="60%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="100%" stopColor="rgba(44, 140, 225, 0)" />
              <animate 
                attributeName="x1" 
                dur="5.7s" 
                values="-100%;100%" 
                repeatCount="indefinite" 
              />
              <animate 
                attributeName="x2" 
                dur="5.7s" 
                values="0%;200%" 
                repeatCount="indefinite" 
              />
            </linearGradient>
          </defs>
        </g>
        
        {/* Path 3 */}
        <g id="rd11" mask="url(#globe-gradient-mask)" opacity="1">
          {/* Base path for the connection */}
          <path 
            d="M519.188,330 h108.694M 635.355 430 A 247.123 420 0 0 0 627.882 330" 
            fill="none" 
            stroke="rgba(44, 140, 225, 0.2)" 
            strokeWidth="1.5" 
            vectorEffect="non-scaling-stroke"
          ></path>
          
          {/* Animated glowing line segment along the path */}
          <path 
            d="M519.188,330 h108.694M 635.355 430 A 247.123 420 0 0 0 627.882 330" 
            fill="none" 
            stroke="url(#rd11-gradient)" 
            strokeLinecap="round" 
            strokeWidth="2.5" 
            vectorEffect="non-scaling-stroke"
          >
          </path>
          
          {/* Hidden path for motion */}
          <path 
            id="path-rd11"
            d="M519.188,330 h108.694M 635.355 430 A 247.123 420 0 0 0 627.882 330" 
            fill="none" 
            stroke="none"
          ></path>
          
          <defs>
            <linearGradient 
              id="rd11-gradient" 
              x1="0%" 
              y1="0%" 
              x2="100%" 
              y2="0%"
            >
              <stop offset="0%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="40%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="47%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="49%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="50%" stopColor="rgba(44, 140, 225, 1)" />
              <stop offset="51%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="53%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="60%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="100%" stopColor="rgba(44, 140, 225, 0)" />
              <animate 
                attributeName="x1" 
                dur="4.1s" 
                values="-100%;100%" 
                repeatCount="indefinite" 
              />
              <animate 
                attributeName="x2" 
                dur="4.1s" 
                values="0%;200%" 
                repeatCount="indefinite" 
              />
            </linearGradient>
          </defs>
        </g>
        
        {/* Path 4 */}
        <g id="lld30" mask="url(#globe-gradient-mask)" opacity="1">
          {/* Base path for the connection */}
          <path 
            d="M728.701,430 h-93.346M635.355,430 h-112.258M 519.188 530 A 129.252 420 0 0 0 523.097 430" 
            fill="none" 
            stroke="rgba(44, 140, 225, 0.2)" 
            strokeWidth="1.5" 
            vectorEffect="non-scaling-stroke"
          ></path>
          
          {/* Animated glowing line segment along the path */}
          <path 
            d="M728.701,430 h-93.346M635.355,430 h-112.258M 519.188 530 A 129.252 420 0 0 0 523.097 430" 
            fill="none" 
            stroke="url(#lld30-gradient)" 
            strokeLinecap="round" 
            strokeWidth="2.5" 
            vectorEffect="non-scaling-stroke"
          >
          </path>
          
          {/* Hidden path for motion */}
          <path 
            id="path-lld30"
            d="M728.701,430 h-93.346M635.355,430 h-112.258M 519.188 530 A 129.252 420 0 0 0 523.097 430" 
            fill="none" 
            stroke="none"
          ></path>
          
          <defs>
            <linearGradient 
              id="lld30-gradient" 
              x1="0%" 
              y1="0%" 
              x2="100%" 
              y2="0%"
            >
              <stop offset="0%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="40%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="47%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="49%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="50%" stopColor="rgba(44, 140, 225, 1)" />
              <stop offset="51%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="53%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="60%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="100%" stopColor="rgba(44, 140, 225, 0)" />
              <animate 
                attributeName="x1" 
                dur="4.9s" 
                values="-100%;100%" 
                repeatCount="indefinite" 
              />
              <animate 
                attributeName="x2" 
                dur="4.9s" 
                values="0%;200%" 
                repeatCount="indefinite" 
              />
            </linearGradient>
          </defs>
        </g>

        {/* Path 5 - Additional connection */}
        <g id="ld-10" mask="url(#globe-gradient-mask)" opacity="1">
          {/* Base path for the connection */}
          <path 
            d="M276.903,430 h-112.258M 164.645 430 A -247.123 420 0 0 0 172.118 530" 
            fill="none" 
            stroke="rgba(44, 140, 225, 0.2)" 
            strokeWidth="1.5" 
            vectorEffect="non-scaling-stroke"
          ></path>
          
          {/* Animated glowing line segment along the path */}
          <path 
            d="M276.903,430 h-112.258M 164.645 430 A -247.123 420 0 0 0 172.118 530" 
            fill="none" 
            stroke="url(#ld-10-gradient)" 
            strokeLinecap="round" 
            strokeWidth="2.5" 
            vectorEffect="non-scaling-stroke"
          >
          </path>
          
          {/* Hidden path for motion */}
          <path 
            id="path-ld-10"
            d="M276.903,430 h-112.258M 164.645 430 A -247.123 420 0 0 0 172.118 530" 
            fill="none" 
            stroke="none"
          ></path>
          
          <defs>
            <linearGradient 
              id="ld-10-gradient" 
              x1="0%" 
              y1="0%" 
              x2="100%" 
              y2="0%"
            >
              <stop offset="0%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="40%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="47%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="49%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="50%" stopColor="rgba(44, 140, 225, 1)" />
              <stop offset="51%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="53%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="60%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="100%" stopColor="rgba(44, 140, 225, 0)" />
              <animate 
                attributeName="x1" 
                dur="4.5s" 
                values="-100%;100%" 
                repeatCount="indefinite" 
              />
              <animate 
                attributeName="x2" 
                dur="4.5s" 
                values="0%;200%" 
                repeatCount="indefinite" 
              />
            </linearGradient>
          </defs>
        </g>

        {/* Path 6 - New left-side connection for wider globe */}
        <g id="left-side" mask="url(#globe-gradient-mask)" opacity="1">
          {/* Base path for the connection */}
          <path 
            d="M0,430 h-100M -100 430 A -420 420 0 0 0 -75 330" 
            fill="none" 
            stroke="rgba(44, 140, 225, 0.2)" 
            strokeWidth="1.5" 
            vectorEffect="non-scaling-stroke"
          ></path>
          
          {/* Animated glowing line segment along the path */}
          <path 
            d="M0,430 h-100M -100 430 A -420 420 0 0 0 -75 330" 
            fill="none" 
            stroke="url(#left-side-gradient)" 
            strokeLinecap="round" 
            strokeWidth="2.5" 
            vectorEffect="non-scaling-stroke"
          >
          </path>
          
          {/* Hidden path for motion */}
          <path 
            id="path-left-side"
            d="M0,430 h-100M -100 430 A -420 420 0 0 0 -75 330" 
            fill="none" 
            stroke="none"
          ></path>
          
          <defs>
            <linearGradient 
              id="left-side-gradient" 
              x1="0%" 
              y1="0%" 
              x2="100%" 
              y2="0%"
            >
              <stop offset="0%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="40%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="47%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="49%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="50%" stopColor="rgba(44, 140, 225, 1)" />
              <stop offset="51%" stopColor="rgba(44, 140, 225, 0.3)" />
              <stop offset="53%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="60%" stopColor="rgba(44, 140, 225, 0)" />
              <stop offset="100%" stopColor="rgba(44, 140, 225, 0)" />
              <animate 
                attributeName="x1" 
                dur="4.3s" 
                values="-100%;100%" 
                repeatCount="indefinite" 
              />
              <animate 
                attributeName="x2" 
                dur="4.3s" 
                values="0%;200%" 
                repeatCount="indefinite" 
              />
            </linearGradient>
          </defs>
        </g>

        {/* Nodes/Points */}
        <g data-testid="node">
          <circle className="node_node" cx="400" cy="130" fill="var(--ds-background-100)" r="16" stroke="url(#globe-gradient)" vectorEffect="non-scaling-stroke"></circle>
          <path className="node_icon" clipRule="evenodd" d="M8 1L16 15H0L8 1Z" fill="currentColor" fillRule="evenodd" transform="translate(392.5, 122) scale(0.9)"></path>
          <circle className="node_dot" cx="400" cy="130" fill="var(--ds-gray-900)" r="8"></circle>
        </g>

        <g data-testid="node">
          <circle className="node_node" cx="115.336" cy="230" fill="var(--ds-background-100)" r="16" stroke="url(#globe-gradient)" vectorEffect="non-scaling-stroke"></circle>
          <path className="node_icon" clipRule="evenodd" d="M8 1L16 15H0L8 1Z" fill="currentColor" fillRule="evenodd" transform="translate(107.836, 222) scale(0.9)"></path>
          <circle className="node_dot" cx="115.336" cy="230" fill="var(--ds-gray-900)" r="8"></circle>
        </g>

        <g data-testid="node">
          <circle className="node_node" cx="519.188" cy="330" fill="var(--ds-background-100)" r="16" stroke="url(#globe-gradient)" vectorEffect="non-scaling-stroke"></circle>
          <path className="node_icon" clipRule="evenodd" d="M8 1L16 15H0L8 1Z" fill="currentColor" fillRule="evenodd" transform="translate(511.688, 322) scale(0.9)"></path>
          <circle className="node_dot" cx="519.188" cy="330" fill="var(--ds-gray-900)" r="8"></circle>
        </g>

        <g data-testid="node">
          <circle className="node_node" cx="276.903" cy="430" fill="var(--ds-background-100)" r="16" stroke="url(#globe-gradient)" vectorEffect="non-scaling-stroke"></circle>
          <path className="node_icon" clipRule="evenodd" d="M8 1L16 15H0L8 1Z" fill="currentColor" fillRule="evenodd" transform="translate(269.403, 422) scale(0.9)"></path>
          <circle className="node_dot" cx="276.903" cy="430" fill="var(--ds-gray-900)" r="8"></circle>
        </g>

        <g data-testid="node">
          <circle className="node_node" cx="728.701" cy="430" fill="var(--ds-background-100)" r="16" stroke="url(#globe-gradient)" vectorEffect="non-scaling-stroke"></circle>
          <path className="node_icon" clipRule="evenodd" d="M8 1L16 15H0L8 1Z" fill="currentColor" fillRule="evenodd" transform="translate(721.201, 422) scale(0.9)"></path>
          <circle className="node_dot" cx="728.701" cy="430" fill="var(--ds-gray-900)" r="8"></circle>
        </g>

        {/* New node for the left side */}
        <g data-testid="node">
          <circle className="node_node" cx="-100" cy="430" fill="var(--ds-background-100)" r="16" stroke="url(#globe-gradient)" vectorEffect="non-scaling-stroke"></circle>
          <path className="node_icon" clipRule="evenodd" d="M8 1L16 15H0L8 1Z" fill="currentColor" fillRule="evenodd" transform="translate(-107.5, 422) scale(0.9)"></path>
          <circle className="node_dot" cx="-100" cy="430" fill="var(--ds-gray-900)" r="8"></circle>
        </g>

        {/* Gradients for the globe lines and mask */}
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" id="globe-gradient" x1="0" x2="0" y1="0" y2="420">
            <stop offset="0%" stopColor="#333333"></stop>
            <stop offset="100%" stopColor="#333333"></stop>
          </linearGradient>
          <linearGradient gradientTransform="rotate(90)" id="globe-mask-gradient">
            <stop offset=".7" stopColor="white" stopOpacity="1"></stop>
            <stop offset="1" stopColor="white" stopOpacity="0"></stop>
          </linearGradient>
        </defs>
        
        <style>{`
          .node_node {
            fill: #1a1a1a;
            stroke: #333333;
          }
          .node_icon {
            fill: white;
          }
          .node_dot {
            fill: #1a1a1a;
          }
        `}</style>
      </svg>
    </div>
  );
} 