# Replace spaces with underscores in file names
find . -depth -name "* *" -execdir rename 's/ /_/g' "{}" \;

# Replace breaks
find . -name "*.md"|while read fname; do
  awk 'BEGIN{RS="";ORS="\n\n"}1' "$fname" | sponge "$fname"
done
