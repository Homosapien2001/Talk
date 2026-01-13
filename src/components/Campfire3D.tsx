import React from 'react';

const Campfire3D: React.FC = () => {
  return (
    <div className="campfire-wrapper">
      <div className="campfire-container">
        {/* Logs */}
        <div className="logs">
          <div className="log log-1"></div>
          <div className="log log-2"></div>
          <div className="log log-3"></div>
        </div>

        {/* Flames */}
        <div className="flames">
          <div className="flame flame-1"></div>
          <div className="flame flame-2"></div>
          <div className="flame flame-3"></div>
          <div className="flame flame-main"></div>
        </div>

        {/* Embers */}
        <div className="embers">
          <div className="ember ember-1"></div>
          <div className="ember ember-2"></div>
          <div className="ember ember-3"></div>
          <div className="ember ember-4"></div>
          <div className="ember ember-5"></div>
        </div>

        {/* Glow */}
        <div className="glow-base"></div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .campfire-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 300px;
          height: 180px;
          position: relative;
          perspective: 1000px;
        }

        .campfire-container {
          position: relative;
          width: 200px;
          height: 200px;
          transform-style: preserve-3d;
          animation: camera-sway 10s ease-in-out infinite alternate;
        }

        /* Logs */
        .logs {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%) rotateX(60deg);
          width: 100px;
          height: 100px;
          transform-style: preserve-3d;
        }

        .log {
          position: absolute;
          width: 20px;
          height: 100px;
          background: linear-gradient(90deg, #5D4037, #3E2723, #5D4037);
          border-radius: 10px;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
        }

        .log-1 { transform: translateX(40px) rotate(0deg); }
        .log-2 { transform: translateX(40px) rotate(60deg); }
        .log-3 { transform: translateX(40px) rotate(-60deg); }

        /* Flames */
        .flames {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          width: 100px;
          height: 150px;
          filter: blur(1px);
        }

        .flame {
          position: absolute;
          bottom: 0;
          border-radius: 50% 50% 20% 20%;
          background: linear-gradient(to top, orangered, orange, yellow);
          opacity: 0.9;
          transform-origin: center bottom;
        }

        .flame-main {
          left: 25%;
          width: 50%;
          height: 100%;
          animation: flicker 1s ease-in-out infinite alternate;
          z-index: 10;
        }

        .flame-1 {
          left: 10%;
          width: 30%;
          height: 70%;
          animation: flicker 1.5s ease-in-out infinite alternate-reverse;
          background: linear-gradient(to top, #D32F2F, #F57C00);
          z-index: 5;
        }

        .flame-2 {
          right: 10%;
          width: 30%;
          height: 70%;
          animation: flicker 1.2s ease-in-out infinite alternate;
          background: linear-gradient(to top, #D32F2F, #F57C00);
          z-index: 5;
        }
        
        .flame-3 {
            left: 35%;
            bottom: -10px;
            width: 30%;
            height: 50%;
            background: #D84315;
            filter: blur(5px);
            z-index: 1;
            animation: pulse-core 2s infinite;
        }

        /* Glow */
        .glow-base {
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%) rotateX(90deg);
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(255,87,34,0.4) 0%, rgba(255,87,34,0) 70%);
          animation: glow-pulse 3s infinite;
          z-index: -1;
        }
        
        /* Embers */
        .embers {
            position: absolute;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        
        .ember {
            position: absolute;
            bottom: 0;
            width: 4px;
            height: 4px;
            background: #FFD700;
            border-radius: 50%;
            box-shadow: 0 0 5px #FFD700;
            opacity: 0;
        }
        
        .ember-1 { left: 40%; animation: rise 3s ease-in infinite; animation-delay: 0.2s; }
        .ember-2 { left: 60%; animation: rise 4s ease-in infinite; animation-delay: 1.5s; }
        .ember-3 { left: 20%; animation: rise 3.5s ease-in infinite; animation-delay: 0.8s; }
        .ember-4 { left: 80%; animation: rise 2.8s ease-in infinite; animation-delay: 2.1s; }
        .ember-5 { left: 50%; animation: rise 4.5s ease-in infinite; animation-delay: 3s; }

        /* Animations */
        @keyframes flicker {
          0% { transform: scale(1) rotate(-2deg); opacity: 0.9; }
          25% { transform: scale(1.1) rotate(2deg); opacity: 0.8; }
          50% { transform: scale(0.9) rotate(-1deg); opacity: 1; }
          75% { transform: scale(1.05) rotate(1deg); opacity: 0.85; }
          100% { transform: scale(1) rotate(-2deg); opacity: 0.9; }
        }

        @keyframes camera-sway {
          0% { transform: scale(0.6) rotateY(-5deg); }
          100% { transform: scale(0.6) rotateY(5deg); }
        }

        @keyframes glow-pulse {
          0% { opacity: 0.6; transform: translateX(-50%) rotateX(90deg) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) rotateX(90deg) scale(1.1); }
          100% { opacity: 0.6; transform: translateX(-50%) rotateX(90deg) scale(1); }
        }
        
        @keyframes rise {
            0% { opacity: 1; bottom: 0; transform: translateX(0); }
            50% { opacity: 0.8; }
            100% { opacity: 0; bottom: 150px; transform: translateX(20px); }
        }
        
        @keyframes pulse-core {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 1; }
        }
      `}} />
    </div>
  );
};

export default Campfire3D;
