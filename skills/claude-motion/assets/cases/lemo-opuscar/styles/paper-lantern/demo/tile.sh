#!/bin/bash
# tile.sh out.jpg t1 t2 ... (4 列)
out=$1; shift; n=$#; args=(); for t in "$@"; do args+=(-i "t_$t.jpg"); done
cols=4; lay=""; for ((i=0;i<n;i++)); do c=$((i%cols)); r=$((i/cols)); xs="0"; for ((k=0;k<c;k++)); do xs="$xs+w0"; done; ys="0"; for ((k=0;k<r;k++)); do ys="$ys+h0"; done; lay="$lay|${xs#0+}_${ys#0+}"; done
lay=${lay#|}; lay=$(echo "$lay" | sed 's/^0+//')
ffmpeg -y -loglevel error "${args[@]}" -filter_complex "xstack=inputs=$n:layout=$lay:fill=black,scale=1920:-1" "$out" && echo "$out"
