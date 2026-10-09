const title = document.getElementById('title');

let alpha = 0;
const fadeSpeed = (5 / 255) * 60;
let fadingIn = true;
let lastTime = 0;

function animateFrame(time) {
  const delta = lastTime === 0 ? 0 : (time - lastTime) / 1000;
  lastTime = time;

  if (fadingIn) {
    alpha += fadeSpeed * delta;
    if (alpha >= 1) {
      alpha = 1;
      fadingIn = false;
    }
  } else {
    alpha -= fadeSpeed * delta;
    if (alpha <= 0) {
      alpha = 0;
      fadingIn = true;
    }
  }

  title.style.opacity = String(alpha);
  title.style.transform = `translateY(${4 - alpha * 4}px) scale(${0.98 + alpha * 0.02})`;

  requestAnimationFrame(animateFrame);
}

requestAnimationFrame(animateFrame);
