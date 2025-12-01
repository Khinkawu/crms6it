const fs = require('fs');
const path = require('path');

const dir = 'd:\\Antigravity\\stock-management-system\\Webapp\\public\\font';
const files = fs.readdirSync(dir);

files.forEach(file => {
    if (file.includes('๙')) {
        const newName = file.replace('๙', '9');
        fs.renameSync(path.join(dir, file), path.join(dir, newName));
        console.log(`Renamed: ${file} -> ${newName}`);
    }
});
