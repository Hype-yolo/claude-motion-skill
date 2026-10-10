#!/bin/bash
# sheet.sh dir prefix out cols rows start
d=$1; out=$2; start=$3; n=${4:-16}; args=(); cnt=0
for ((k=start;k<start+n;k++)); do f=$(printf "$d/f_%03d.jpg" $k); [ -f "$f" ] && { args+=(-i "$f"); cnt=$((cnt+1)); }; done
[ $cnt -eq 0 ] && exit 0
lay=""; for ((j=0;j<cnt;j++)); do c=$((j%4)); r=$((j/4)); lay="$lay|$((c*480))_$((r*270))"; done
ffmpeg -y -loglevel error "${args[@]}" -filter_complex "xstack=inputs=$cnt:layout=${lay#|}:fill=black" "$out" && echo "$out"
