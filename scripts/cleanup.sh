# Replace spaces with underscores in file names
find . -depth -name "* *" -execdir rename 's/ /_/g' "{}" \;
