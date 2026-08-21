const fs = require('fs');
let html = fs.readFileSync('public/setting.html', 'utf8');

// The user said: "add in head back to miniapp bottom"
// Let's add a fixed floating button at the bottom of setting.html
const backButton = `
    <!-- Floating Back to Mini App Button -->
    <div style="position: fixed; bottom: 20px; left: 20px; right: 20px; z-index: 9999;">
        <button class="btn quantum-btn" style="width: 100%; padding: 15px; font-size: 1.1rem; border-radius: 15px; display: flex; justify-content: center; align-items: center; gap: 10px; box-shadow: 0 10px 30px rgba(0, 242, 254, 0.4);" onclick="window.location.href='/index.html'">
            <i class="fa-solid fa-arrow-left"></i> Back to Mini App
        </button>
    </div>
`;

if (!html.includes('Back to Mini App')) {
    html = html.replace('</body>', backButton + '\n</body>');
    fs.writeFileSync('public/setting.html', html);
    console.log("Patched setting.html with back button.");
} else {
    console.log("setting.html already has back button.");
}
