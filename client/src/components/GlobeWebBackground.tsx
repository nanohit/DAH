import { useEffect, useRef } from 'react';

interface GlobeWebBackgroundProps {
  className?: string;
}

export default function GlobeWebBackground({ className = '' }: GlobeWebBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure canvas is sized properly
    const resizeCanvas = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      }
    };

    // Set up the canvas
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Define the grid nodes (points where lines intersect)
    const createNodes = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const nodes = [];
      const halfWidth = width / 2;
      const gridSize = 80; // Increased grid size for better spacing
      
      // Create a half-dome grid structure with fewer nodes - more like the image
      for (let y = 0; y <= height; y += gridSize) {
        // Calculate the width of the current row based on a half-circle formula
        // This creates a dome-like structure that's wider at the center and narrower at top/bottom
        const normalizedY = y / height;
        const rowWidth = Math.sin(normalizedY * Math.PI) * width * 0.9; // 0.9 to make it slightly narrower
        
        if (rowWidth <= 0) continue;
        
        const startX = halfWidth - rowWidth / 2;
        const endX = halfWidth + rowWidth / 2;
        const columnsInThisRow = Math.ceil(rowWidth / gridSize);
        const actualSpacing = rowWidth / (columnsInThisRow > 1 ? columnsInThisRow - 1 : 1);
        
        // Add specific nodes for triangle points as in the image
        // This creates the pattern of fixed intersection points shown in the reference
        for (let i = 0; i <= columnsInThisRow; i++) {
          const x = startX + i * actualSpacing;
          
          // Make nodes appear at specific positions to match the image
          nodes.push({
            x,
            y,
            size: 3, // Slightly larger nodes
            originalX: x,
            originalY: y,
            isHighlighted: false, // For the white triangle points
            pulsePhase: Math.random() * Math.PI * 2, // Random starting phase for pulse effect
            pulseSpeed: 0.05 + Math.random() * 0.02 // Slight variation in pulse speed
          });
        }
      }

      // Add specific highlighted nodes for the triangle points as shown in the image
      const highlighedPositions = [
        { x: 0.5, y: 0.1 }, // Top
        { x: 0.15, y: 0.35 }, // Left
        { x: 0.35, y: 0.35 }, // Center Left
        { x: 0.65, y: 0.35 }, // Center Right
        { x: 0.85, y: 0.35 }, // Right
        { x: 0.5, y: 0.65 }, // Bottom
        { x: 0.2, y: 0.8 }, // Bottom Left (optional)
        { x: 0.8, y: 0.8 }, // Bottom Right (optional)
      ];
      
      const { width: canvasWidth, height: canvasHeight } = canvas.getBoundingClientRect();
      
      highlighedPositions.forEach(pos => {
        nodes.push({
          x: pos.x * canvasWidth,
          y: pos.y * canvasHeight,
          size: 5,
          originalX: pos.x * canvasWidth,
          originalY: pos.y * canvasHeight,
          isHighlighted: true,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.03
        });
      });
      
      return nodes;
    };

    const nodes = createNodes();

    // Draw the static grid
    const drawGrid = (time: number) => {
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const { width, height } = canvas.getBoundingClientRect();
      const halfWidth = width / 2;
      
      // Draw the grid lines
      // Horizontal lines (latitude)
      for (let y = 0; y <= height; y += 80) {
        const normalizedY = y / height;
        const rowWidth = Math.sin(normalizedY * Math.PI) * width * 0.9;
        
        if (rowWidth <= 0) continue;
        
        ctx.beginPath();
        ctx.strokeStyle = '#252525'; // Darker grid
        ctx.lineWidth = 1;
        ctx.moveTo(halfWidth - rowWidth / 2, y);
        ctx.lineTo(halfWidth + rowWidth / 2, y);
        ctx.stroke();
      }
      
      // Vertical lines (longitude)
      for (let angle = 0; angle <= Math.PI; angle += Math.PI / 8) {
        ctx.beginPath();
        ctx.strokeStyle = '#252525'; // Darker grid
        ctx.lineWidth = 1;
        
        // Calculate top and bottom points for this longitude line
        const topWidth = Math.sin(0 * Math.PI) * width * 0.9;
        const bottomWidth = Math.sin(1 * Math.PI) * width * 0.9;
        
        const startX = halfWidth + Math.cos(angle) * topWidth / 2;
        const startY = 0;
        
        const endX = halfWidth + Math.cos(angle - Math.PI) * bottomWidth / 2;
        const endY = height;
        
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
      
      // Draw the nodes
      nodes.forEach(node => {
        if (node.isHighlighted) {
          // Draw white highlighted nodes with pulse effect
          const pulseSize = 1 + 0.3 * Math.sin(time * node.pulseSpeed + node.pulsePhase);
          
          // Outer glow
          const gradient = ctx.createRadialGradient(
            node.x, node.y, 0,
            node.x, node.y, node.size * 3 * pulseSize
          );
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.beginPath();
          ctx.fillStyle = gradient;
          ctx.arc(node.x, node.y, node.size * 3 * pulseSize, 0, Math.PI * 2);
          ctx.fill();
          
          // Main circle
          ctx.beginPath();
          ctx.fillStyle = '#fff';
          ctx.arc(node.x, node.y, node.size * pulseSize, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Draw regular nodes (optional - can be left out for a cleaner look)
          ctx.beginPath();
          ctx.fillStyle = '#333';
          ctx.arc(node.x, node.y, node.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    };

    // Define animation paths for the blue connections
    const createPaths = () => {
      // Define the path type
      interface AnimationPath {
        points: any[];
        progress: number;
        speed: number;
        arcHeight: number;
        color: {
          h: number;
          s: number;
          l: number;
          a: number;
        };
        startNode: any;
        endNode: any;
        active: boolean;
      }
      
      const paths: AnimationPath[] = [];
      
      // Create paths between highlighted nodes to match the image
      const highlightedNodes = nodes.filter(node => node.isHighlighted);
      
      // Create specific paths that match the image
      // Each path connects two highlighted nodes with a specific style
      const pathConfigurations = [
        { startIndex: 0, endIndex: 1, arcHeight: -80, speed: 0.0015, initialProgress: 0.2 },   // Top to Left
        { startIndex: 1, endIndex: 0, arcHeight: -80, speed: 0.002, initialProgress: 0.7 },    // Left to Top
        { startIndex: 1, endIndex: 2, arcHeight: 0, speed: 0.003, initialProgress: 0.5 },      // Left to Center Left
        { startIndex: 2, endIndex: 3, arcHeight: 0, speed: 0.002, initialProgress: 0.3 },      // Center Left to Center Right
        { startIndex: 3, endIndex: 4, arcHeight: 0, speed: 0.0025, initialProgress: 0.6 },     // Center Right to Right
        { startIndex: 4, endIndex: 0, arcHeight: -80, speed: 0.0018, initialProgress: 0.1 },   // Right to Top
        { startIndex: 0, endIndex: 5, arcHeight: 0, speed: 0.002, initialProgress: 0.4 },      // Top to Bottom
        { startIndex: 5, endIndex: 6, arcHeight: 0, speed: 0.0022, initialProgress: 0.2 },     // Bottom to Bottom Left
        { startIndex: 5, endIndex: 7, arcHeight: 0, speed: 0.0019, initialProgress: 0.8 },     // Bottom to Bottom Right
      ];
      
      pathConfigurations.forEach(config => {
        if (highlightedNodes[config.startIndex] && highlightedNodes[config.endIndex]) {
          const path = {
            points: [],
            progress: config.initialProgress, // Start at specific progress
            speed: config.speed,
            arcHeight: config.arcHeight,
            color: {
              h: 210, // Blue hue
              s: 100,
              l: 60, // Slightly brighter
              a: 0.7 // More visible
            },
            startNode: highlightedNodes[config.startIndex],
            endNode: highlightedNodes[config.endIndex],
            active: true
          };
          
          paths.push(path);
        }
      });
      
      return paths;
    };

    const paths = createPaths();

    // Animation loop
    const animate = (timestamp: number) => {
      // Clear canvas and redraw grid
      const time = timestamp * 0.001; // Convert to seconds
      drawGrid(time);
      
      // Draw and update paths
      paths.forEach(path => {
        if (!path.active) return;
        
        // Update progress
        path.progress += path.speed;
        if (path.progress > 1) {
          path.progress = 0;
        }
        
        // Calculate current position along the path
        const t = path.progress;
        
        // Use a quadratic or cubic bezier curve to create curved paths
        // For a path with an arc/curve in the middle:
        const startX = path.startNode.x;
        const startY = path.startNode.y;
        const endX = path.endNode.x;
        const endY = path.endNode.y;
        
        // Control point(s) for the curve - adjust these for different curve shapes
        const controlX = (startX + endX) / 2;
        const controlY = Math.min(startY, endY) + path.arcHeight; // arcHeight affects curve height
        
        // Calculate point along quadratic bezier curve
        const currentX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
        const currentY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
        
        // Draw the path as a blue glowing line
        ctx.beginPath();
        
        // Create gradient for the moving light
        const gradient = ctx.createLinearGradient(
          currentX - 80, currentY, 
          currentX + 80, currentY
        );
        
        // Soft blue gradient
        gradient.addColorStop(0, 'rgba(0, 100, 255, 0)');
        gradient.addColorStop(0.4, 'rgba(0, 150, 255, 0.1)');
        gradient.addColorStop(0.5, `hsla(${path.color.h}, ${path.color.s}%, ${path.color.l}%, ${path.color.a})`);
        gradient.addColorStop(0.6, 'rgba(0, 150, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
        
        // Draw the path segment
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(controlX, controlY, currentX, currentY);
        ctx.strokeStyle = `hsla(${path.color.h}, ${path.color.s}%, ${path.color.l}%, 0.15)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Draw the bright moving light
        ctx.beginPath();
        ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${path.color.h}, ${path.color.s}%, ${path.color.l + 10}%, ${path.color.a})`;
        ctx.fill();
        
        // Add glow effect around the moving light
        const glowSize = 12;
        const glowGradient = ctx.createRadialGradient(
          currentX, currentY, 0,
          currentX, currentY, glowSize
        );
        glowGradient.addColorStop(0, `hsla(${path.color.h}, ${path.color.s}%, ${path.color.l + 20}%, 0.6)`);
        glowGradient.addColorStop(1, `hsla(${path.color.h}, ${path.color.s}%, ${path.color.l}%, 0)`);
        
        ctx.beginPath();
        ctx.fillStyle = glowGradient;
        ctx.arc(currentX, currentY, glowSize, 0, Math.PI * 2);
        ctx.fill();
      });
      
      requestAnimationFrame(animate);
    };

    // Start animation
    const animationId = requestAnimationFrame(animate);

    // Clean up
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className={`absolute inset-0 ${className}`}
      style={{ 
        height: '400px',
        width: '100%',
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
        background: 'black',
        zIndex: 0
      }}
    />
  );
} 