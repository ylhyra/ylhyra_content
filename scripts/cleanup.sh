# Replace spaces with underscores in file names
cd ${BASH_SOURCE%/*}/../
cd not_data
find . -depth -name "* *" -execdir rename 's/ /_/g' "{}" \;
# find . -depth -name "*(*" -execdir rename 's/[()]//g' "{}" \;
# find . -depth -name "*)*" -execdir rename 's/[()]//g' "{}" \;

# # Replace more than two linebreaks
# cd not_data
# find . -name "*.md"|while read fname; do
#   awk 'BEGIN{RS="";ORS="\n\n"}1' "$fname" | sponge "$fname"
# done
