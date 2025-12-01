const baseParticlesConfig = {
  particles: {
    number: {
      value: 200,
      density: {
        enable: true,
        value_area: 1000
      }
    },
    color: {
      value: "#ffffff"
    },
    shape: {
      type: "circle"
    },
    opacity: {
      value: 0.7,
      random: true,
      anim: {
        enable: true,
        speed: 1,
        opacity_min: 0.3,
        sync: false
      }
    },
    size: {
      value: 2,
      random: true,
      anim: {
        enable: true,
        speed: 2,
        size_min: 0.3,
        sync: false
      }
    },
    line_linked: {
      enable: true,
      distance: 150,
      color: "#ffffff",
      opacity: 0.4,
      width: 1.2
    },
    move: {
      enable: true,
      speed: 1.2,
      direction: "none",
      random: true,
      straight: false,
      out_mode: "out",
      bounce: false,
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
        opacity: 1,
        speed: 2
      },
      push: {
        particles_nb: 6
      }
    }
  },
  retina_detect: true
}; 

export const particlesConfig = baseParticlesConfig;

export const heroParticlesConfig = {
  ...baseParticlesConfig,
  particles: {
    ...baseParticlesConfig.particles,
    number: {
      ...baseParticlesConfig.particles.number,
      value: 240
    },
    color: {
      value: '#c2c8d1'
    },
    size: {
      ...baseParticlesConfig.particles.size,
      value: 1.8
    },
    opacity: {
      ...baseParticlesConfig.particles.opacity,
      value: 0.55,
      opacity_min: 0.2
    },
    line_linked: {
      ...baseParticlesConfig.particles.line_linked,
      color: '#c2c8d1',
      opacity: 0.45,
      width: 0.9
    },
    move: {
      ...baseParticlesConfig.particles.move,
      speed: 0.65
    }
  }
};