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
- Serve the project locally (required for 3D model asset loading):
  `python3 -m http.server 8000`
- Then visit: `http://localhost:8000`
- After selecting Play, the game opens directly in the furnished living room. The abandoned building's walls use the supplied high-poly masonry wall model, with the existing door and window openings preserved. Three.js is loaded from a CDN, so an internet connection is needed when opening the game for the first time.
- You start seated on the couch and cannot move while sitting there, but you can still look around the room. A casual male character approaches, grabs you, and speaks using the bundled `audio/casual-male-voice.mp3` recording. Afterward, he raises a hunting rifle and shoots; a blood vignette signals that you are bleeding. Your vision blinks out and brings you to the tech room in a walkable abandoned brick building with a 5-by-4 grid of 20 connected 12-by-12-unit rooms, broken windows, and a weathered pitched metal roof. Press E near either tech-room exit to open its door, then explore the paired monitors, ruined kitchen, and pizzeria-style party room with the supplied dining tables, checkerboard floor, bunting, and sign. The animated shark animatronic and Diabolus Rex pursue you through the connected rooms; press M or click **Wear mask** to stay safe from their attacks for 5 seconds. After the mask comes off, it has a 30-second cooldown before it can be worn again. You can wake up in the tech room to try again.

GitHub Pages:
- The site deploys from the `main` branch via the workflow in `.github/workflows/pages.yml`.
- In the repository's Settings > Pages, set the build and deployment source to GitHub Actions.
- After the workflow succeeds, the public site will be at `https://gtjohnson246-boop.github.io/teoe/`.
