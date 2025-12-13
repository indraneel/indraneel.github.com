#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');

const repoRoot = path.resolve(__dirname, '..');

// Find all .md files recursively in a directory
function findMdFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMdFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Convert Obsidian wiki-link images to standard markdown
function convertObsidianImages(content) {
  // Convert ![[filename.png]] to ![filename.png](filename.png)
  // Also handles ![[filename.png|alt text]] -> ![alt text](filename.png)
  return content.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, filename, altText) => {
    const alt = altText || filename;
    const encodedFilename = encodeURIComponent(filename).replace(/%20/g, '%20');
    return `![${alt}](${encodedFilename})`;
  });
}

// Convert a single markdown file to HTML
function convertFile(mdFilePath) {
  const mdContent = fs.readFileSync(mdFilePath, 'utf8');

  // Parse frontmatter
  const { data: frontmatter, content: rawContent } = matter(mdContent);

  // Convert Obsidian wiki-link images to standard markdown
  const content = convertObsidianImages(rawContent);

  const title = frontmatter.title || path.basename(mdFilePath, '.md');
  const date = frontmatter.date ? new Date(frontmatter.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';

  // Convert markdown to HTML
  const htmlContent = marked.parse(content);

  // Calculate relative path to root for assets
  const mdDir = path.dirname(path.resolve(mdFilePath));
  const relativePath = path.relative(mdDir, repoRoot);
  const tailwindPath = relativePath ? `${relativePath}/tailwind-3.4.15.css` : './tailwind-3.4.15.css';

  // Generate full HTML page
  const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>${title} | Indraneel Purohit</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="${tailwindPath}"></script>
    <script defer src="https://cloud.umami.is/script.js" data-website-id="beb3212e-74fd-4d93-aeee-f27a860f0f19"></script>
    <style>
      body {
        font-family: sans-serif;
        font-size: 12px;
      }

      .section-header {
        background-color: #1e3a8a;
        color: #fde047;
        padding: 0px 4px;
        margin-bottom: 2px;
        font-size: 13px;
      }

      h1 {
        font-size: 24px;
        margin-bottom: 4px;
      }

      body a {
        color: #1e40af;
        text-decoration: none;
        transition: color 0.2s ease;
      }

      body a:hover {
        color: #1e3a8a;
      }

      /* Post content styling */
      .post-content h2 {
        font-size: 16px;
        font-weight: bold;
        margin-top: 16px;
        margin-bottom: 8px;
      }

      .post-content h3 {
        font-size: 14px;
        font-weight: bold;
        margin-top: 12px;
        margin-bottom: 6px;
      }

      .post-content p {
        margin-bottom: 12px;
        line-height: 1.6;
      }

      .post-content ul, .post-content ol {
        margin-left: 20px;
        margin-bottom: 12px;
      }

      .post-content li {
        margin-bottom: 4px;
      }

      .post-content code {
        background-color: #f3f4f6;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 11px;
      }

      .post-content pre {
        background-color: #f3f4f6;
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
        margin-bottom: 12px;
      }

      .post-content pre code {
        background: none;
        padding: 0;
      }

      .post-content blockquote {
        border-left: 3px solid #1e3a8a;
        padding-left: 12px;
        margin-left: 0;
        color: #4b5563;
        font-style: italic;
      }

      .post-content img {
        max-width: 100%;
        height: auto;
        margin: 12px 0;
      }
    </style>
  </head>
  <body class="max-w-[8.5in] mx-auto p-3">
    <!-- Header -->
    <header class="flex flex-row justify-between items-center mb-8">
      <h1 class="font-normal"><a href="/">Indraneel Purohit</a></h1>
      <nav class="flex space-x-6">
        <a href="/#projects" class="nav-link">Projects</a>
        <a href="/posts.html" class="nav-link">Posts</a>
        <a href="/resume.html" class="nav-link">Resume</a>
      </nav>
    </header>

    <!-- Post -->
    <div class="mb-8">
      <div class="section-header">${title}</div>
      ${date ? `<div class="text-gray-500 text-xs mt-1">${date}</div>` : ''}
      <div class="mt-4 post-content">
        ${htmlContent}
      </div>
    </div>

  </body>
</html>
`;

  // Write HTML file
  const htmlFilePath = mdFilePath.replace(/\.md$/, '.html');
  fs.writeFileSync(htmlFilePath, fullHtml);

  console.log(`Converted: ${mdFilePath} -> ${htmlFilePath}`);
}

// Get metadata for all posts
function getAllPosts() {
  const postsDir = path.join(repoRoot, 'posts');
  const mdFiles = findMdFiles(postsDir);

  const posts = [];
  for (const mdFile of mdFiles) {
    const content = fs.readFileSync(mdFile, 'utf8');
    const { data: frontmatter } = matter(content);
    const htmlPath = '/' + path.relative(repoRoot, mdFile).replace(/\.md$/, '.html');

    posts.push({
      title: frontmatter.title || path.basename(mdFile, '.md'),
      date: frontmatter.date ? new Date(frontmatter.date) : null,
      url: htmlPath
    });
  }

  // Sort by date descending
  posts.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date - a.date;
  });

  return posts;
}

// Update posts.html with the list of all posts
function updatePostsIndex() {
  const postsHtmlPath = path.join(repoRoot, 'posts.html');
  if (!fs.existsSync(postsHtmlPath)) return;

  const posts = getAllPosts();

  // Generate list items
  const listItems = posts.map(post => {
    const dateStr = post.date ? post.date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : '';
    return `          <li class="mb-2"><a href="${post.url}">${post.title}</a>${dateStr ? ` <span class="text-gray-500">(${dateStr})</span>` : ''}</li>`;
  }).join('\n');

  // Read and update posts.html
  let html = fs.readFileSync(postsHtmlPath, 'utf8');
  html = html.replace(
    /<ul>[\s\S]*?<\/ul>/,
    `<ul>\n${listItems}\n        </ul>`
  );

  fs.writeFileSync(postsHtmlPath, html);
  console.log(`Updated posts.html with ${posts.length} post(s).`);
}

// Main logic
const mdFilePath = process.argv[2];

if (mdFilePath) {
  // Convert single file
  convertFile(mdFilePath);
  updatePostsIndex();
} else {
  // Find all .md files without corresponding .html
  const postsDir = path.join(repoRoot, 'posts');
  const mdFiles = findMdFiles(postsDir);

  let converted = 0;
  for (const mdFile of mdFiles) {
    const htmlFile = mdFile.replace(/\.md$/, '.html');
    const mdStat = fs.statSync(mdFile);
    const htmlExists = fs.existsSync(htmlFile);
    const htmlStat = htmlExists ? fs.statSync(htmlFile) : null;

    if (!htmlExists || mdStat.mtime > htmlStat.mtime) {
      convertFile(mdFile);
      converted++;
    }
  }

  if (converted === 0) {
    console.log('No new markdown files to convert.');
  } else {
    console.log(`Converted ${converted} file(s).`);
  }

  // Always update posts index
  updatePostsIndex();
}
