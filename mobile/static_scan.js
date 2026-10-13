const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const allFiles = getAllFiles(srcDir);

// 1. Build an exports map
const exportsMap = {}; // { absolutePath: ['export1', 'export2', 'default'] }

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const exported = [];
  
  lines.forEach(line => {
    // named exports
    let match = line.match(/export\s+(?:const|let|var|function|async\s+function)\s+([a-zA-Z0-9_]+)/);
    if (match) exported.push(match[1]);
    
    // export { ... }
    match = line.match(/export\s+\{([^}]+)\}/);
    if (match) {
      match[1].split(',').forEach(part => exported.push(part.trim().split(/\s+as\s+/)[0].trim()));
    }

    // default export
    if (line.match(/export\s+default\s+/)) {
      exported.push('default');
    }
    
    // module.exports = { ... }
    match = line.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    if (match) {
      match[1].split(',').forEach(part => exported.push(part.trim().split(/\s*:\s*/)[0].trim()));
    }
  });
  
  exportsMap[file] = exported;
});

// 2. Check theme.* keys missing from theme.js
let themeKeys = [];
try {
  const themePath = path.join(srcDir, 'constants', 'theme.js');
  const themeContent = fs.readFileSync(themePath, 'utf8');
  const match = themeContent.match(/export\s+const\s+theme\s*=\s*{([\s\S]*?)}/);
  if (match) {
    // very rudimentary object key extraction
    const keyMatches = match[1].match(/([a-zA-Z0-9_]+)\s*:/g) || [];
    themeKeys = keyMatches.map(k => k.replace(':', '').trim());
  }
} catch (e) {
  console.log('Could not parse theme.js', e);
}

// 3. Scan all files
let hasError = false;
allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  let definedStyles = [];
  const styleMatch = content.match(/StyleSheet\.create\(\{\s*([\s\S]*?)\}\);/);
  if (styleMatch) {
    const keys = styleMatch[1].match(/([a-zA-Z0-9_]+)\s*:/g) || [];
    definedStyles = keys.map(k => k.replace(':', '').trim());
  }

  lines.forEach((line, index) => {
    // Check imports
    const importMatch = line.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const importedNames = importMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      const reqPath = importMatch[2];
      if (reqPath.startsWith('.')) {
        let targetFile = path.resolve(path.dirname(file), reqPath);
        if (!targetFile.endsWith('.js')) targetFile += '.js';
        
        if (exportsMap[targetFile]) {
          const avail = exportsMap[targetFile];
          importedNames.forEach(n => {
            if (!avail.includes(n)) {
               console.log(`[Import Error] ${file}:${index+1} => imported '${n}' but target does not export it.`);
               hasError = true;
            }
          });
        }
      }
    }

    // Check default imports
    const defaultImportMatch = line.match(/import\s+([a-zA-Z0-9_]+)\s+from\s+['"]([^'"]+)['"]/);
    if (defaultImportMatch && !line.includes('{')) {
      const reqPath = defaultImportMatch[2];
      if (reqPath.startsWith('.')) {
        let targetFile = path.resolve(path.dirname(file), reqPath);
        if (!targetFile.endsWith('.js')) targetFile += '.js';
        if (exportsMap[targetFile] && !exportsMap[targetFile].includes('default')) {
           // Maybe it's a folder index.js, ignore for now to avoid false positives
           if (fs.existsSync(targetFile)) {
             console.log(`[Import Error] ${file}:${index+1} => default import but target does not export default.`);
           }
        }
      }
    }

    // Check theme.*
    const themeMatches = line.match(/theme\.([a-zA-Z0-9_]+)/g);
    if (themeMatches) {
      themeMatches.forEach(t => {
        const key = t.split('.')[1];
        if (themeKeys.length > 0 && !themeKeys.includes(key)) {
          // ignore nested like theme.colors.xyz for this simple scan unless we flatten
          if (!['colors', 'spacing', 'fonts', 'borders', 'shadows'].includes(key)) {
            console.log(`[Theme Error] Undefined theme key: ${file}:${index+1} => ${t}`);
            hasError = true;
          }
        }
      });
    }

    // Check undefined styles
    const styleRefMatches = line.match(/styles\.([a-zA-Z0-9_]+)/g);
    if (styleRefMatches && styleMatch) {
      styleRefMatches.forEach(s => {
        const key = s.split('.')[1];
        if (!definedStyles.includes(key)) {
          console.log(`[Style Error] Undefined style: ${file}:${index+1} => ${s}`);
          hasError = true;
        }
      });
    }

    // Check conditional hooks
    if (line.match(/if\s*\(.*\)\s*\{\s*use[A-Z]/) || line.match(/if\s*\(.*\)\s*return.*[\s\S]*use[A-Z]/)) {
      console.log(`[Hook Error] Conditional hook: ${file}:${index+1} => ${line.trim()}`);
      hasError = true;
    }
  });
});
if (!hasError) {
  console.log('Static scan complete. No issues found.');
}
