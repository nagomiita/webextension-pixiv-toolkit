const fs = require('fs');
const path = require('path');
const https = require('https');

const TARGET_DIR = process.argv[2];

if (!TARGET_DIR) {
  console.error('Usage: node tools/backfill-pixiv-novel-tags.js <directory>');
  process.exit(1);
}

async function main() {
  const files = walkTxtFiles(TARGET_DIR);
  const result = {
    scanned: files.length,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const file of files) {
    try {
      const status = await processFile(file);
      result[status] += 1;
      console.log(`${status.toUpperCase()}: ${file}`);
    } catch (error) {
      result.failed += 1;
      console.error(`FAILED: ${file}`);
      console.error(`  ${error.message}`);
    }
  }

  console.log('');
  console.log(`Scanned: ${result.scanned}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);
}

function walkTxtFiles(dir) {
  let files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files = files.concat(walkTxtFiles(fullPath));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.txt') {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function readUtf8File(filePath) {
  const buffer = fs.readFileSync(filePath);
  const hasBom = buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf;
  const text = buffer.toString('utf8');

  return {
    hasBom,
    text: hasBom ? text.slice(1) : text,
  };
}

function writeUtf8File(filePath, text, hasBom, stat) {
  const content = hasBom ? `\uFEFF${text}` : text;
  fs.writeFileSync(filePath, content, 'utf8');
  fs.utimesSync(filePath, stat.atime, stat.mtime);
}

function detectNewline(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function getNovelId(filePath, text) {
  const firstLine = text.split(/\r?\n/, 1)[0].trim();
  const urlMatch = firstLine.match(/pixiv\.net\/novel\/show\.php\?id=(\d+)/i);

  if (urlMatch) {
    return urlMatch[1];
  }

  const fileMatch = path.basename(filePath).match(/^(\d+)_/);
  return fileMatch ? fileMatch[1] : '';
}

function findTitleLineIndex(lines) {
  let nonEmptyCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim()) {
      continue;
    }

    nonEmptyCount += 1;

    if (nonEmptyCount === 3) {
      return index;
    }
  }

  return -1;
}

function hasTagLineAfterTitle(lines, titleLineIndex) {
  for (let index = titleLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      continue;
    }

    return /^Tags:\s*/i.test(line);
  }

  return false;
}

function findInsertionIndex(lines, titleLineIndex) {
  for (let index = titleLineIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim()) {
      return index;
    }
  }

  return lines.length;
}

function extractTags(payload) {
  const body = payload && payload.body ? payload.body : {};
  const rawTags = body && body.tags && Array.isArray(body.tags.tags) ? body.tags.tags :
    (body && Array.isArray(body.tags) ? body.tags : []);

  return Array.from(new Set(rawTags.map(tag => {
    if (typeof tag === 'string') {
      return tag.trim();
    }

    if (tag && typeof tag === 'object') {
      return `${tag.tag || tag.name || ''}`.trim();
    }

    return '';
  }).filter(Boolean)));
}

function requestNovelInfo(novelId) {
  const url = `https://www.pixiv.net/ajax/novel/${novelId}`;

  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'pixiv-toolkits-backfill/1.0',
      },
    }, response => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Pixiv API returned status ${response.statusCode}`));
          return;
        }

        try {
          const payload = JSON.parse(body);

          if (payload.error) {
            reject(new Error(payload.message || `Pixiv API returned an error for novel ${novelId}`));
            return;
          }

          resolve(payload);
        } catch (error) {
          reject(new Error(`Invalid JSON response for novel ${novelId}`));
        }
      });
    });

    request.on('error', reject);
  });
}

async function processFile(filePath) {
  const stat = fs.statSync(filePath);
  const { hasBom, text } = readUtf8File(filePath);
  const novelId = getNovelId(filePath, text);

  if (!novelId) {
    throw new Error('Could not determine Pixiv novel ID.');
  }

  const newline = detectNewline(text);
  const lines = text.split(/\r?\n/);
  const titleLineIndex = findTitleLineIndex(lines);

  if (titleLineIndex < 0) {
    throw new Error('Could not find title line in file header.');
  }

  if (hasTagLineAfterTitle(lines, titleLineIndex)) {
    return 'skipped';
  }

  const payload = await requestNovelInfo(novelId);
  const tags = extractTags(payload);

  if (tags.length === 0) {
    return 'skipped';
  }

  const insertionIndex = findInsertionIndex(lines, titleLineIndex);
  const insertedLines = [];

  if (insertionIndex === titleLineIndex + 1) {
    insertedLines.push('');
  }

  insertedLines.push(`Tags: ${tags.join(', ')}`);
  insertedLines.push('');

  lines.splice(insertionIndex, 0, ...insertedLines);
  writeUtf8File(filePath, lines.join(newline), hasBom, stat);

  return 'updated';
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
