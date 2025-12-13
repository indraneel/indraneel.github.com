#!/bin/bash

# Check if post title is provided
if [ $# -eq 0 ]; then
    echo "Usage: ./newpost.sh \"Post Title\""
    exit 1
fi

# Get current date components
YEAR=$(date +%Y)
MONTH=$(date +%m)
DAY=$(date +%d)
DATE_ISO=$(date +%Y-%m-%d)

# Create directory structure
DIR="posts/$YEAR/$MONTH/$DAY"
mkdir -p "$DIR"

# Generate filename from title (lowercase, replace spaces with hyphens)
FILENAME=$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' ' '-').md

# Create Markdown content with frontmatter
cat > "$DIR/$FILENAME" << EOL
---
title: "$1"
date: $DATE_ISO
---

Write your post content here...
EOL

echo "Created post at $DIR/$FILENAME"
echo "Edit in Obsidian, then run 'git add $DIR/$FILENAME && git commit' to convert to HTML"
