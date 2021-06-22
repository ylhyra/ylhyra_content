find . -maxdepth 1 -name '*.jpg' -execdir mogrify -resize 1600x1600 -quality 80 {} +
