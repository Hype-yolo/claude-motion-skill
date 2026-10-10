# 配乐说明 · Five Rules for a Poster

`score.py` 可从零生成全部配乐，约 4 秒，随机种子固定为 1961：原创 Motorik 配乐，120 BPM，A 多利亚，44.5 秒，48 kHz 立体声 24-bit。旋律和低音根音都从 `../score.json` 读，和画面上的海报是同一份数据。

## 乐器
- **鼓**：`drum_kit`（MuldjordKit），用了底鼓、军鼓、闭镲、crash。motorik 节奏是底鼓 1、3、3&，军鼓 2、4，闭镲八分。镲片单独走一路，加 7.5 kHz 一阶低通。
- **贝斯**：`electric_bass`（FreePats 指弹电贝斯），弹根音低两个八度的八分音符脉冲。
- **琶音**：numpy 加法合成锯齿波，谐波数本身就起低通作用，所以没有混叠。十六分音符，和声 Am / C / D。
- **旋律**：`glockenspiel`（VCSL）移高两个八度，经 5.2 kHz 二阶低通，下面叠一层柔和的奇次谐波方波（高一个八度）。
- **fx**：红圆的正弦滑音（G5 → D5，停一拍，再到 A4），犹豫时一个 −40 音分的钟琴倚音。

## CREDITS
```
Drums: "MuldjordKit" by Lars Muldjord (drumgizmo.org), FreePats version, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
Samples (CC0): FreePats project (freepats.zenvoid.org), Versilian Community Sample Library (Versilian Studios)
```

## 自检（靠数据，没有人耳听过）
- 峰值 −1.0 dBFS，没有削波样本，没有 NaN。
- 8–20 kHz 比 2–8 kHz 低 9.3 dB。
- 分段 RMS（dBFS）：

  | 段落 | 规则四 20–24 | 出走 24–26 | 带动 26–30 | 停住 30–32 | 扫描 32–36 | 海报墙 36–40 |
  |---|---|---|---|---|---|---|
  | RMS | −18.4 | −22.8 | −18.3 | −27.4 | −19.7 | −17.2（最高） |

- 32–36 s 扫描段的起音误差：+0.0 / +0.6 / +2.4 / +3.3 / +2.1 / +2.5 / +1.6 / +2.9 ms，最后一个是红圆重音。测法是找"第一个比前 5 ms 电平高 3 倍的样本"；librosa onset 的结果也在 3 ms 以内。

## 已知问题
- 33.25（C）和 33.5（D）是相邻的短音，前一个钟琴的余音还在，所以 D 的起音能量只跳 3.6 dB。瞬态仍然清楚，但没有其它音那么"跳"。
- 24–26 s 只比前一段低 4.4 dB，因为鼓一撤，感知上的落差已经很大，riser 也要留一点存在感。混音时如果还嫌满，可以再压 fx 和琶音分轨。
- 全部是采样加合成，没有人耳确认过，钟琴移高两个八度后音色可能偏"八音盒"。
