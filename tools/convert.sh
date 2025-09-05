#!/bin/bash
# Usage: ./convert.sh /path/to/source_folder

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <source_folder>"
    exit 1
fi

SRC="$1"
# Remove any trailing slash for clean folder names
SRC="${SRC%/}"

AVIF_DST="${SRC} Avif"
JPG_DST="${SRC} JPG"

mkdir -p "$AVIF_DST" "$JPG_DST"

# Temporarily enable nullglob so globs with no matches disappear
shopt -s nullglob

for file in "$SRC"/*.{jpg,JPG,jpeg,JPEG,png,PNG,cr2,CR2}; do
    base=$(basename "$file")
    name="${base%.*}"

    # Handle CR2 input prefix
    if [[ "$file" =~ \.[cC][rR]2$ ]]; then
        input="cr2:$file"
    else
        input="$file"
    fi

    # Get the file size in bytes, portable across Linux/macOS
    filesize=$(wc -c <"$file" | tr -d ' ')

    # Get dimensions via ImageMagick
    read -r width height < <(magick identify -format "%w %h" "$file")

    # Convert to AVIF
    avif_out="$AVIF_DST/${name}.avif"
    magick "$input" \
        -set "exif:ImageWidth"  "$width" \
        -set "exif:ImageHeight" "$height" \
        -set "xmp:ImageWidth"   "$width" \
        -set "xmp:ImageHeight"  "$height" \
        -set "exif:FileSize"    "$filesize" \
        "$avif_out" \
    && echo "✔ Converted to AVIF: $avif_out" \
    || echo "✖ Failed AVIF:  $file"

    # Convert to JPEG
    jpg_out="$JPG_DST/${name}.jpg"
    magick "$input" "$jpg_out" \
    && echo "✔ Converted to JPG:  $jpg_out" \
    || echo "✖ Failed JPG:  $file"
done

# Restore default globbing behavior
shopt -u nullglob