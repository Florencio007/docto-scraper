const { spawn } = require('child_process');
const path = require('path');

/**
 * Appelle l'extracteur intelligent Crawl4AI (Python) pour une URL donnée.
 */
function crawlWithAI(url) {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(__dirname, 'mamba_root', 'envs', 'crawl_env', 'bin', 'python');
    const scriptPath = path.join(__dirname, 'crawl_helper.py');
    
    // On lance le script Python
    const child = spawn(pythonPath, [scriptPath, url]);
    
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Crawl4AI helper failed (code ${code}): ${stderr}`));
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse Crawl4AI output: ${err.message}\nOutput: ${stdout}`));
      }
    });
  });
}

module.exports = { crawlWithAI };
