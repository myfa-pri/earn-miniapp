const fs = require('fs');
let code = fs.readFileSync('api/index.js', 'utf8');

const regex = /const sorted = usersArr\.sort\(\(a, b\) => \(b\.points \|\| 0\) - \(a\.points \|\| 0\)\);([\s\S]*?)const top100 = sorted\.slice\(0, 100\)\.map\(user => \(\{([\s\S]*?)\}\)\);/m;
const match = code.match(regex);

if (match) {
    let block = match[1];
    let mapBlock = match[2];
    
    const newFilter = `
    const usersArr = Object.values(usersObj).filter(x => !x.isBanned && !x.stealthMode);
    const sorted = usersArr.sort((a, b) => (b.points || 0) - (a.points || 0));
`;

    const newMap = `
        id: user.id || '',
        accountName: user.accountName || user.username || 'Anonymous',
        points: user.points || 0,
        usernameColor: user.usernameColor || null,
        titleBadge: user.titleBadge || null
`;
    
    code = code.replace(/const usersArr = Object\.values\(usersObj\)\.filter\(x => !x\.isBanned\);\n\s*const sorted = usersArr\.sort\(\(a, b\) => \(b\.points \|\| 0\) - \(a\.points \|\| 0\)\);/, newFilter);
    code = code.replace(/const top100 = sorted\.slice\(0, 100\)\.map\(user => \(\{([\s\S]*?)\}\)\);/, "const top100 = sorted.slice(0, 100).map(user => ({" + newMap + "}));");
    
    fs.writeFileSync('api/index.js', code);
    console.log("api/index.js leaderboard logic updated!");
} else {
    console.log("Could not find leaderboard logic.");
}
