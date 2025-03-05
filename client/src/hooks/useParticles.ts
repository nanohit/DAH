import { useEffect } from 'react';
import { particlesConfig } from '@/utils/particlesConfig';

declare global {
  interface Window {
    particlesJS: any;
  }
}

export const useParticles = () => {
  useEffect(() => {
    const loadParticles = async () => {
      try {
        // Load particles.js from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js';
        script.async = true;
        
        script.onload = () => {
          window.particlesJS('particles-js', particlesConfig);
        };
        
        document.body.appendChild(script);
        
        return () => {
          document.body.removeChild(script);
        };
      } catch (error) {
        console.error('Error loading particles.js:', error);
      }
    };

    loadParticles();
  }, []);
}; 