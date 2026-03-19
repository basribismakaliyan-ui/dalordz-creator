import './globals.css';

export const metadata = {
  title: 'ChatGPT Creator | Account Registration Bot',
  description: 'Automated bulk ChatGPT account registration with hacker-style interface',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <canvas id="matrix-canvas"></canvas>
        <div className="scanlines"></div>
        <div className="grid-overlay"></div>
        <Particles />
        {children}
        <MatrixScript />
      </body>
    </html>
  );
}

function Particles() {
  const particles = Array.from({ length: 30 }, (_, i) => {
    const left = Math.random() * 100;
    const duration = 8 + Math.random() * 12;
    const delay = Math.random() * 10;
    const drift = (Math.random() - 0.5) * 100;
    const size = 1 + Math.random() * 2;
    return (
      <div
        key={i}
        className="particle"
        style={{
          left: `${left}%`,
          width: `${size}px`,
          height: `${size}px`,
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`,
          '--drift': `${drift}px`,
        }}
      />
    );
  });
  return <div className="particles">{particles}</div>;
}

function MatrixScript() {
  const script = `
    (function() {
      const canvas = document.getElementById('matrix-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      resize();
      window.addEventListener('resize', resize);
      
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*(){}[]|;:<>,.?/~';
      const fontSize = 14;
      let columns = Math.floor(canvas.width / fontSize);
      let drops = new Array(columns).fill(1);
      
      function draw() {
        ctx.fillStyle = 'rgba(10, 15, 10, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#00ff41';
        ctx.font = fontSize + 'px JetBrains Mono, monospace';
        
        for (let i = 0; i < drops.length; i++) {
          const text = chars[Math.floor(Math.random() * chars.length)];
          const x = i * fontSize;
          const y = drops[i] * fontSize;
          
          ctx.globalAlpha = 0.3 + Math.random() * 0.7;
          ctx.fillText(text, x, y);
          
          if (y > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i]++;
        }
        ctx.globalAlpha = 1;
      }
      
      setInterval(draw, 50);
      
      window.addEventListener('resize', function() {
        columns = Math.floor(canvas.width / fontSize);
        drops = new Array(columns).fill(1);
      });
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
