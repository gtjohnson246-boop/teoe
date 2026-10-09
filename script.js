const title = document.getElementById('title');
const intro = document.getElementById('intro');
const menu = document.getElementById('menu');

let alpha = 0;
const fadeSpeed = (5 / 255) * 60;
let fadingIn = true;
let lastTime = 0;
let completedCycles = 0;

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
      completedCycles += 1;
    }
  }

  title.style.opacity = String(alpha);
  title.style.transform = `translateY(${4 - alpha * 4}px) scale(${0.98 + alpha * 0.02})`;

  if (completedCycles === 2) {
    intro.hidden = true;
    menu.hidden = false;
    return;
  }

  requestAnimationFrame(animateFrame);
}

requestAnimationFrame(animateFrame);
