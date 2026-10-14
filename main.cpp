#include <SFML/Graphics.hpp>

#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <string>
#include <vector>

namespace fs = std::filesystem;

// App states to control transition after animation finishes
enum class GameState {
    FadingText,
    StartMenu,
    Playing
};

static int runHeadless(const fs::path& fontPath);

static fs::path resolveAssetPath(const std::string& filename) {
    std::vector<fs::path> searchRoots;
    searchRoots.push_back(fs::current_path());

    std::error_code ec;
    const fs::path executablePath = fs::canonical("/proc/self/exe", ec);
    if (!ec) {
        searchRoots.push_back(executablePath.parent_path());
    }

    for (const auto& root : searchRoots) {
        const fs::path candidate = root / filename;
        if (fs::exists(candidate)) {
            return candidate;
        }
    }

    return fs::path(filename);
}

static int runWindow(const fs::path& fontPath) {
    sf::RenderWindow window(sf::VideoMode(800, 200), "Creepster Fade Animation");
    window.setFramerateLimit(60);

    sf::Font font;
    if (!font.loadFromFile(fontPath.string())) {
        std::cerr << "Error: Could not load font at " << fontPath << std::endl;
        return -1;
    }

    // --- Load Skeleton Background ---
    sf::Texture skeletonTexture;
    fs::path skeletonPath = resolveAssetPath("skeleton.png");
    if (!skeletonTexture.loadFromFile(skeletonPath.string())) {
        std::cerr << "Warning: Could not load skeleton image at " << skeletonPath << std::endl;
    }
    sf::Sprite skeletonSprite(skeletonTexture);

    // Scale background to fit 800x200 window
    sf::Vector2u textureSize = skeletonTexture.getSize();
    if (textureSize.x > 0 && textureSize.y > 0) {
        skeletonSprite.setScale(
            800.f / static_cast<float>(textureSize.x),
            200.f / static_cast<float>(textureSize.y)
        );
    }

    // --- Intro Text ---
    sf::Text text;
    text.setFont(font);
    text.setString("i am coming");
    text.setCharacterSize(28);
    text.setPosition(50, 75);

    // --- Start Menu Text ---
    sf::Text startText;
    startText.setFont(font);
    startText.setString("PRESS SPACE TO START");
    startText.setCharacterSize(32);
    startText.setFillColor(sf::Color::White);

    // Center start menu text
    sf::FloatRect textRect = startText.getLocalBounds();
    startText.setOrigin(textRect.left + textRect.width / 2.0f, textRect.top + textRect.height / 2.0f);
    startText.setPosition(sf::Vector2f(800 / 2.0f, 200 / 2.0f));

    // Animation & Control State
    int alpha = 0;
    int fadeSpeed = 5;
    int loopCount = 0;
    bool fadingIn = true;
    GameState state = GameState::FadingText;

    while (window.isOpen()) {
        sf::Event event;
        while (window.pollEvent(event)) {
            if (event.type == sf::Event::Closed) {
                window.close();
            }

            // Handle pressing Space in Start Menu state
            if (state == GameState::StartMenu && event.type == sf::Event::KeyPressed) {
                if (event.key.code == sf::Keyboard::Space) {
                    state = GameState::Playing;
                    std::cout << "Space pressed - Game Started!" << std::endl;
                }
            }
        }

        // --- Logic Updates ---
        if (state == GameState::FadingText) {
            if (fadingIn) {
                alpha += fadeSpeed;
                if (alpha >= 255) {
                    alpha = 255;
                    fadingIn = false;
                }
            } else {
                alpha -= fadeSpeed;
                if (alpha <= 0) {
                    alpha = 0;
                    fadingIn = true;
                    loopCount++;

                    // Switch state once two fade cycles complete
                    if (loopCount >= 2) {
                        state = GameState::StartMenu;
                    }
                }
            }
            text.setFillColor(sf::Color(255, 255, 255, static_cast<sf::Uint8>(alpha)));
        }

        // --- Rendering ---
        window.clear(sf::Color::Black);

        if (state == GameState::FadingText) {
            window.draw(text);
        } else if (state == GameState::StartMenu) {
            window.draw(skeletonSprite);
            window.draw(startText);
        } else if (state == GameState::Playing) {
            // Main gameplay code goes here
        }

        window.display();
    }

    return 0;
}

static int runHeadless(const fs::path& fontPath) {
    (void)fontPath;

    const fs::path scriptPath = resolveAssetPath("render_headless.py");
    if (!fs::exists(scriptPath)) {
        std::cerr << "Error: Could not find render_headless.py." << std::endl;
        return -1;
    }

    const fs::path originalPath = fs::current_path();
    const fs::path scriptDir = scriptPath.parent_path();
    const bool shouldRestorePath = !scriptDir.empty() && scriptDir != originalPath;

    if (shouldRestorePath) {
        std::error_code ec;
        fs::current_path(scriptDir, ec);
        if (ec) {
            std::cerr << "Error: Could not switch to project directory " << scriptDir << std::endl;
            return -1;
        }
    }

    const std::string command = "python3 \"" + scriptPath.string() + "\"";
    const int status = std::system(command.c_str());

    if (shouldRestorePath) {
        std::error_code ec;
        fs::current_path(originalPath, ec);
        if (ec) {
            std::cerr << "Error: Could not restore working directory to " << originalPath << std::endl;
            return -1;
        }
    }

    if (status != 0) {
        std::cerr << "Error: headless render failed." << std::endl;
        return -1;
    }

    std::cout << "Saved headless output to output.png" << std::endl;
    return 0;
}

int main(int argc, char* argv[]) {
    const fs::path fontPath = resolveAssetPath("Creepster-Regular.ttf");

    if (!fs::exists(fontPath)) {
        std::cerr << "Error: Could not find Creepster-Regular.ttf. Run python3 download_font.py first." << std::endl;
        return -1;
    }

    const bool wantWindow = argc > 1 && std::string(argv[1]) == "--window";
    if (wantWindow) {
        return runWindow(fontPath);
    }

    return runHeadless(fontPath);
}