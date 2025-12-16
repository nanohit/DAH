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
            value: 220,
            density: {
              enable: true,
              value_area: 2500 // Larger area for bigger network structures
            }
          },
          color: {
            value: "#ffffff"
          },
          shape: {
            type: "circle"
          },
          opacity: {
            value: 0.15,
            random: true,
            anim: {
              enable: true,
              speed: 0.3,
              opacity_min: 0.05,
              sync: false
            }
          },
          size: {
            value: 8.5,
            random: true,
            anim: {
              enable: true,
              speed: 0.8,
              size_min: 0.5,
              sync: false
            }
          },
          line_linked: {
            enable: true,
            distance: 200, // Much larger distance for bigger network structures
            color: "#ffffff",
            opacity: 0.2,
            width: 1
          },
          move: {
            enable: true,
            speed: 1.4,
            direction: "none",
            random: true,
            straight: false,
            out_mode: "out",
            bounce: false
          }
        },
        interactivity: {
          detect_on: "window",
          events: {
            onhover: {
              enable: true,
              mode: "grab"
            },
            onclick: {
              enable: false,
              mode: "none"
            },
            resize: true
          },
          modes: {
            grab: {
              distance: 240,
              line_linked: {
                opacity: 0.4
              }
            },
            push: {
              particles_nb: 9
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