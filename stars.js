const cv = document.getElementById("c");
const cx = cv.getContext("2d");
cv.width = 300; cv.height = 480;

const stars = Array.from({length: 55}, () => ({
  x: Math.random() * 300,
  y: Math.random() * 480,
  r: Math.random() * 1.1 + 0.2,
  speed: Math.random() * 0.005 + 0.002,
  phase: Math.random() * Math.PI * 2,
}));

function drawStars(t) {
  cx.clearRect(0, 0, 300, 480);
  stars.forEach(s => {
    const a = 0.08 + 0.28 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
    cx.beginPath();
    cx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    cx.fillStyle = `rgba(210,200,255,${a})`;
    cx.fill();
  });
  requestAnimationFrame(drawStars);
}
requestAnimationFrame(drawStars);
