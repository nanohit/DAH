import { useEffect } from 'react';
import { particlesConfig } from '@/utils/particlesConfig';

declare global {
  interface Window {
    particlesJS: any;
  }
}

export const useParticles = (containerId = 'particles-js', config = particlesConfig) => {
  useEffect(() => {
    let isUnmounted = false;

    const initialiseParticles = () => {
      const container = document.getElementById(containerId);
      if (!container || !window.particlesJS) {
        if (!container) {
          console.debug(`Particles.js container "${containerId}" not found, skipping initialization`);
        }
        return;
      }

      window.particlesJS(containerId, config);
    };

    const handleScriptLoad = () => {
      if (!isUnmounted) {
        const scriptEl = document.querySelector('script[data-particles="true"]') as HTMLScriptElement | null;
        if (scriptEl) {
          scriptEl.dataset.loaded = 'true';
        }
        initialiseParticles();
      }
    };

    const ensureScript = () => {
      if (window.particlesJS) {
        initialiseParticles();
        return null;
      }

      let scriptEl = document.querySelector('script[data-particles="true"]') as HTMLScriptElement | null;

      if (scriptEl) {
        if (scriptEl.dataset.loaded === 'true') {
          initialiseParticles();
        } else {
          scriptEl.addEventListener('load', handleScriptLoad);
        }
        return scriptEl;
      }

      scriptEl = document.createElement('script');
      scriptEl.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js';
      scriptEl.async = true;
      scriptEl.dataset.particles = 'true';
      scriptEl.addEventListener('load', handleScriptLoad);
      document.body.appendChild(scriptEl);
      return scriptEl;
    };

    const scriptElement = ensureScript();

    return () => {
      isUnmounted = true;
      scriptElement?.removeEventListener('load', handleScriptLoad);
    };
  }, [containerId, config]);
};