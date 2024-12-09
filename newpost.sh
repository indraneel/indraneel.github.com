#!/bin/bash

# Check if post title is provided
if [ $# -eq 0 ]; then
    echo "Usage: ./post.sh \"Post Title\""
    exit 1
fi

# Get current date components
YEAR=$(date +%Y)
MONTH=$(date +%m)
DAY=$(date +%d)

# Create directory structure
DIR="posts/$YEAR/$MONTH/$DAY"
mkdir -p "$DIR"

# Generate filename from title (lowercase, replace spaces with hyphens)
FILENAME=$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' ' '-').html

# Create HTML content with replaced title
cat > "$DIR/$FILENAME" << EOL
<!DOCTYPE html>
<html>
  <head>
    <title>$1 | Indraneel Purohit</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="./tailwind-3.4.15.css"></script>
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
    </style>
  </head>
  <body class="max-w-[8.5in] mx-auto p-3">
    <!-- Header -->
    <header class="flex flex-row justify-between items-center mb-8">
      <h1 class="font-normal"><a href="/">Indraneel Purohit</h1>
      <nav class="flex space-x-6">
        <a href="/resume.html" class="nav-link">Resume</a>
      </nav>
    </header>

    <!-- $1 -->
    <div class="mb-8">
      <div class="section-header">$1</div>
      <div class="mt-4">
        <!-- Post Content -->
      </div>
    </div>

  </body>
</html>
EOL

echo "Created post at $DIR/$FILENAME"