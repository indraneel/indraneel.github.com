#!/bin/bash
# Convert video to compressed WebM format (VP9 + Opus)
# Usage: ./convert-video-to-webm.sh input.mov [output.webm]

if [ -z "$1" ]; then
    echo "Usage: $0 input.mov [output.webm]"
    exit 1
fi

INPUT="$1"
OUTPUT="${2:-${INPUT%.*}.webm}"

ffmpeg -i "$INPUT" \
    -c:v libvpx-vp9 -crf 40 -b:v 0 \
    -c:a libopus -b:a 64k \
    "$OUTPUT"

echo "Created: $OUTPUT"
