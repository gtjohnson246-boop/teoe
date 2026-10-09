# teoe
This is a FNAF-inspired game prototype. The browser version shows a short fading title intro before the teoe menu, with original skeleton artwork in the background.

The project includes both a desktop build and a browser version for easy hosting.

Desktop version:
- Install the C++ SFML toolchain if needed.
- Run: `python3 download_font.py`
- Build: `g++ -std=c++17 -o app main.cpp -lsfml-graphics -lsfml-window -lsfml-system`
- For a headless publish render: `./app`
- For a windowed preview: `./app --window`

Browser version:
- Open `index.html` directly in a browser, or serve the project locally:
  `python3 -m http.server 8000`
- Then visit: `http://localhost:8000`

GitHub Pages:
- The site deploys from the `main` branch via the workflow in `.github/workflows/pages.yml`.
- In the repository's Settings > Pages, set the build and deployment source to GitHub Actions.
- After the workflow succeeds, the public site will be at `https://gtjohnson246-boop.github.io/teoe/`.
