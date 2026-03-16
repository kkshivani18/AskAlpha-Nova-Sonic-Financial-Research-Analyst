import React, { useEffect, useRef } from 'react';

interface ParticleWaveProps {
  isActive: boolean;
}

export const ParticleWave: React.FC<ParticleWaveProps> = ({ isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const particles: { x: number; y: number; base_y: number; size: number; alpha: number; phase: number; waveOffset: number }[] = [];
    const numParticles = 150;
    const numWaves = 5;

    // Initialize particles for multiple layers of waves
    for (let w = 0; w < numWaves; w++) {
      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: (i / numParticles) * canvas.width,
          y: canvas.height / 2,
          base_y: canvas.height / 2,
          size: 0.8,
          alpha: 0.3 + (Math.sin(i * 0.1) * 0.2),
          phase: (i / numParticles) * Math.PI * 4,
          waveOffset: w * (Math.PI / 6)
        });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += isActive ? 0.03 : 0.005;

      particles.forEach((p, index) => {
        const waveIndex = Math.floor(index / numParticles);
        
        const amplitude = isActive ? (12 + waveIndex * 10) : 1;
        const frequency = 1.0 + waveIndex * 0.15;
        const speed = 1.5 + waveIndex * 0.2;

        p.y = p.base_y + Math.sin(time * speed + p.phase) * amplitude;
        p.y += (waveIndex - (numWaves / 2)) * (isActive ? 8 : 1);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        
        const hue = 195 + waveIndex * 10; 
        ctx.fillStyle = `hsla(${hue}, 100%, 75%, ${isActive ? p.alpha + 0.3 : p.alpha})`;
        
        ctx.shadowBlur = isActive ? 12 : 2;
        ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.8)`;
        
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={200} 
      className="w-full h-full opacity-80"
    />
  );
};
