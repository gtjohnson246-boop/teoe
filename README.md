# teoe
This is a FNAF-inspired game prototype. The browser version shows a short Creepster-font intro before the teoe menu, which uses the bundled Volter Goldfish font over a low-contrast skull image.

The project includes both a desktop build and a browser version for easy hosting.

Desktop version:
- Install the C++ SFML toolchain if needed.
- Run: `python3 download_font.py`
- Build: `g++ -std=c++17 -o app main.cpp -lsfml-graphics -lsfml-window -lsfml-system`
- For a headless publish render: `./app`
- For a windowed preview: `./app --window`

Browser version:
- Serve the project locally (required for the 3D grass model's asset loading):
  `python3 -m http.server 8000`
- Then visit: `http://localhost:8000`
- The grass scene uses Three.js from a CDN, so an internet connection is needed when opening it for the first time.
- In the grass field, use WASD or the arrow keys to move, and drag to turn the camera. Grass is rendered in view-cullable patches with lightweight cutout foliage and gentle wind.
- The field opens at night facing an already-lit table lamp on a small table.

GitHub Pages:
- The site deploys from the `main` branch via the workflow in `.github/workflows/pages.yml`.
- In the repository's Settings > Pages, set the build and deployment source to GitHub Actions.
- After the workflow succeeds, the public site will be at `https://gtjohnson246-boop.github.io/teoe/`.
