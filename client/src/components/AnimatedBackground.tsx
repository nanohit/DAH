import { useEffect } from 'react';

interface AnimatedBackgroundProps {
  id?: string;
  config?: any;
}

const BACKGROUND_ID = 'auth-particles';

export default function AnimatedBackground({ config }: AnimatedBackgroundProps) {
  useEffect(() => {
    const loadParticles = async () => {
      try {
        // Check if particles.js is already loaded and running
        const existingCanvas = document.querySelector(`#${BACKGROUND_ID} canvas`);
        if (existingCanvas) {
          return; // Animation is already running, don't reinitialize
        }

        // Check if script is already loaded
        if (window.particlesJS) {
          initParticles();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js';
        script.async = true;
        
        script.onload = () => {
          initParticles();
          // Add opacity class after particles are initialized
          const background = document.querySelector(`#${BACKGROUND_ID}`);
          if (background) {
            background.classList.add('opacity-100');
          }
        };
        
        document.body.appendChild(script);
      } catch (error) {
        console.error('Error loading particles.js:', error);
      }
    };

    const initParticles = () => {
      window.particlesJS(BACKGROUND_ID, config || {
        particles: {
          number: {
            value: 200,
            density: {
              enable: true,
              value_area: 1500 // Increased area to spread particles more
            }
          },
          color: {
            value: "#ffffff"
          },
          shape: {
            type: "circle"
          },
          opacity: {
            value: 0.0, // Further reduced to make it even more subtle
            random: true,
            anim: {
              enable: true,
              speed: 0.4,
              opacity_min: 0.0, // Further reduced
              sync: false
            }
          },
          size: {
            value: 2,
            random: true,
            anim: {
              enable: true,
              speed: 0.7,
              size_min: 0.3,
              sync: false
            }
          },
          line_linked: {
            enable: true,
            distance: 200, // Increased distance for larger network structures
            color: "#ffffff",
            opacity: 0.1, // Further reduced
            width: 1.2
          },
          move: {
            enable: true,
            speed: 0.7,
            direction: "none",
            random: true,
            straight: false,
            out_mode: "out",
            bounce: false
          }
        },
        interactivity: {
          detect_on: "canvas",
          events: {
            onhover: {
              enable: true,
              mode: "bubble"
            },
            onclick: {
              enable: true,
              mode: "push"
            },
            resize: true
          },
          modes: {
            bubble: {
              distance: 200,
              size: 4,
              duration: 2,
              opacity: 0.2, // Further reduced
              speed: 2
            },
            push: {
              particles_nb: 4
            }
          }
        },
        retina_detect: true
      });
    };

    loadParticles();

    // Ensure fade-in effect is applied every time the component is mounted
    const background = document.querySelector(`#${BACKGROUND_ID}`);
    if (background) {
      background.classList.remove('opacity-100');
      setTimeout(() => {
        background.classList.add('opacity-100');
      }, 0);
    }

    // Don't cleanup on unmount to keep animation running
    return () => {};
  }, [config]);

  return (
    <div 
      id={BACKGROUND_ID}
      className="absolute inset-0 z-0 opacity-0 transition-opacity duration-1000"
      style={{ 
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.8) 100%)', // Even darker gradient
        perspective: '1000px',
        transformStyle: 'preserve-3d'
      }}
    />
  );
} 