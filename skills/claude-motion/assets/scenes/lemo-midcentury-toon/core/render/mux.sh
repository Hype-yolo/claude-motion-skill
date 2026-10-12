#!/bin/sh
# 合成成片：mux.sh video.mp4 mix.wav out.mp4 [fps] [grain]
# 视频按目标帧率输出（定格片段自动复制帧）；grain = 颗粒强度（默认 2，0 = 不加；像素/矢量风格用 0）
# 音频两遍 loudnorm → −14 LUFS / TP −1.2（单遍会偏 0.5 LU 左右）；最后打印实测的 I / LRA / 真峰值，没达标（响度偏出 ±1 LU 或峰值高于 −1 dB）就警告
# （混音本身削波或峰值极高时，loudnorm 的动态模式两个目标都会错过，实测 −20 LUFS / +5 dBTP）
# 任何一步 ffmpeg 失败都以非 0 退出，并且不留半个文件；只有成品存在且非空才打印它的路径。
# 静音 / 极轻（低于 −70 LUFS，loudnorm 量不出来）的音频：只有"成功解码、量出来确实静音"才跳过响度归一并警告，仍然出片。
# 不是音频、没有音频流、或者文件坏了：以 1 退出，不出片。"坏"按实际解码出来的东西来判断，不是看到报错字样就算：
#   · 解码器报了错（损坏的 FLAC/MP3/M4A 常常 ffmpeg 报了错还返回 0）；
#   · 解出来的时长明显少于容器声称的（截断的 FLAC/MP3）；
#   · WAV 头里声明的音频比文件里实际有的多（写到一半被打断）。
#   `ffmpeg … -f wav -` 流式写出的 WAV 头里长度是占位值，解码完整，只是结尾会有三句解封装提示：那是好文件，照常出片（带一句说明）。
#   看不出来的一种：流式 WAV 恰好截断在采样边界上（头里没有长度可比，解码也没有错）。
# 音频比画面短：用静音补到画面长度（不会把视频截短）；音频更长：照旧截到画面长度（-shortest）。
# 色彩：默认与以往完全一致（保持 video.mjs 出的 yuvj420p 全范围 / bt470bg 标签）；LEMO_COLOR=bt709 改成标准 yuv420p 限幅 / bt709（画面色值差 ±3 以内，但会与旧片有细微色差）。
die() { echo "mux.sh: $*" >&2; exit 1; }
V="$1"; A="$2"; O="$3"; FPS="${4:-24}"; GR="${5:-2}"
[ -n "$V" ] && [ -n "$A" ] && [ -n "$O" ] || die "usage: sh core/render/mux.sh video.mp4 mix.wav out.mp4 [fps=24] [grain=2]"
[ -f "$V" ] || die "video not found: $V"
[ -f "$A" ] || die "audio not found: $A"
case "$FPS" in ''|*[!0-9.]*) die "fps must be a number, got '$FPS'";; esac
case "$GR" in ''|*[!0-9.]*) die "grain must be a number (0 = none), got '$GR'";; esac
case "${LEMO_COLOR:-}" in ''|bt709) ;; *) die "LEMO_COLOR must be bt709 or unset, got '$LEMO_COLOR'";; esac

# 检查 WAV 头声明的音频长度有没有超出文件（截断在采样边界上的 WAV，ffmpeg 自己不会报任何错）。按字节逐个读长度，不依赖机器的字节序
wav_truncated() {   # 返回 0 = 头里声明的比文件里有的多；占位长度（0 或 0xFFFFFFFF）视为"长度未知"，不算截断
  [ "$(dd if="$1" bs=1 count=4 2>/dev/null)" = RIFF ] && [ "$(dd if="$1" bs=1 skip=8 count=4 2>/dev/null)" = WAVE ] || return 1
  _size=$(wc -c < "$1" | tr -d ' '); _off=12
  while [ $((_off + 8)) -le "$_size" ]; do
    _id=$(dd if="$1" bs=1 skip=$_off count=4 2>/dev/null)
    set -- "$1" $(od -An -tu1 -j $((_off + 4)) -N4 "$1"); _len=$(($2 + $3 * 256 + $4 * 65536 + $5 * 16777216))
    if [ "$_id" = data ]; then
      [ "$_len" -eq 0 ] || [ "$_len" -eq 4294967295 ] && return 1
      [ $((_off + 8 + _len)) -gt "$_size" ] && return 0 || return 1
    fi
    _off=$((_off + 8 + _len + (_len & 1)))
  done
  return 1
}

# 第一遍：量响度
[ -n "$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "$A" 2>/dev/null)" ] || die "no audio stream in '$A' (is it really the mixed audio file?)"
M=$(ffmpeg -hide_banner -nostats -progress pipe:2 -i "$A" -af loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json -f null - 2>&1) || die "ffmpeg cannot read the audio '$A': $(echo "$M" | tail -2)"
wav_truncated "$A" && die "the WAV file '$A' is cut off: its header promises more audio than the file contains (was the write interrupted?)"
# 解码器/解封装器的日志行都以 [name @ 0x…] 开头；里面有错误字样，除了下面那三句流式 WAV 的固定提示，都算文件坏了（响度会是 -inf，但那不是"静音"）
ERRS=$(echo "$M" | grep -E '^\[' | grep -iE 'error|invalid|corrupt|header missing|overread|truncat|incomplete')
BENIGN='Ignoring maximum wav data size|Packet corrupt \(stream = [0-9]+, dts = NOPTS\)|corrupt input packet in stream [0-9]+'
BAD=$(echo "$ERRS" | grep -vE "$BENIGN" | head -2)
[ -z "$BAD" ] || die "the audio '$A' is damaged; ffmpeg reported while decoding it:
$BAD"
# 实际解出多少秒（-progress 最后一条 out_time）对比容器声称的；容器时长是 ffmpeg 自己"从码率估的"时不可靠，不比
DEC=$(echo "$M" | grep '^out_time=' | tail -1 | cut -d= -f2 | awk '{ if ($0 ~ /^-/ || $0 !~ /:/) print 0; else { split($0, p, ":"); print p[1] * 3600 + p[2] * 60 + p[3] } }')
CONT=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$A" 2>/dev/null | head -1)
if ! echo "$M" | grep -q 'Estimating duration from bitrate' && awk -v d="${DEC:-0}" -v c="${CONT:-0}" 'BEGIN { tol = c * 0.05 > 0.15 ? c * 0.05 : 0.15; exit !(c + 0 > 0 && c - d > tol) }'; then
  die "only ${DEC:-0} s of the ${CONT} s that '$A' claims could be decoded: the file is damaged or cut off"
fi
[ -z "$ERRS" ] || echo "mux.sh: note: ffmpeg complained about the header/ending of '$A' (typical of a WAV streamed with 'ffmpeg … -f wav -', whose length is a placeholder), but all ${DEC:-0} s decoded; continuing" >&2
J=$(echo "$M" | sed -n '/{/,/}/p')
g() { echo "$J" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
NORM=1
for k in input_i input_tp input_lra input_thresh target_offset; do
  case "$(g $k)" in ''|*inf*|*nan*) NORM=0;; esac
done
if [ "$NORM" = 1 ]; then
  LN="loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true"
else
  LN="anull"
  echo "mux.sh: warning: the audio is silent or quieter than -70 LUFS, so loudness normalisation was skipped" >&2
fi

# 音频比画面短就补静音
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null | head -1; }
VD=$(dur "$V"); AD=$(dur "$A"); PAD=""
if awk -v a="$AD" -v v="$VD" 'BEGIN { exit !(a + 0 > 0 && v + 0 > 0 && a + 0 < v - 0.02) }'; then
  PAD=",apad=whole_dur=$VD"
  echo "mux.sh: note: the audio ($AD s) is shorter than the video ($VD s); padding it with silence" >&2
fi

if [ "$GR" = "0" ]; then VF="fps=$FPS"; else VF="fps=$FPS,noise=c0s=$GR:allf=t"; fi
if [ "${LEMO_COLOR:-}" = "bt709" ]; then
  VF="$VF,scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709"
  CARGS="-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709"
else
  VF="$VF,format=yuv420p"; CARGS=""
fi
# shellcheck disable=SC2086  (CARGS 要按空格拆成多个参数；默认为空)
ffmpeg -y -loglevel error -i "$V" -i "$A" \
  -filter_complex "[0:v]$VF[v];[1:a]$LN,aresample=48000$PAD[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 19 -r "$FPS" $CARGS -c:a aac -b:a 256k -movflags +faststart -shortest "$O" \
  || { rm -f "$O"; die "ffmpeg failed while writing '$O' (its message is above)"; }
[ -s "$O" ] || { rm -f "$O"; die "no output was written to '$O'"; }
echo "$O"
R=$(ffmpeg -hide_banner -nostats -i "$O" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" | head -3)
echo "$R"
if [ "$NORM" = 1 ]; then
  OI=$(echo "$R" | awk '$1 == "I:" { print $2 }'); OP=$(echo "$R" | awk '$1 == "Peak:" { print $2 }')
  awk -v i="$OI" -v p="$OP" 'BEGIN { exit !(i + 0 < -15 || i + 0 > -13 || p + 0 > -1) }' \
    && echo "mux.sh: warning: the film missed the target (-14 LUFS, true peak <= -1.2 dB): measured $OI LUFS, peak $OP dB. The mix is probably clipping or has very hot peaks: lower it and tame the peaks, then mux again" >&2
fi
exit 0
