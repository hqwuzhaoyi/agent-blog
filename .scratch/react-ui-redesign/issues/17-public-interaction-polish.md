# 17: 前台交互反馈与状态细节

Status: ready-for-agent
Execution: completed

读者在首页、早咖啡、工作日志和归档中的交互需要一致、明确且及时的反馈。

参考：[Emil design engineering](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md)、[animate](https://github.com/emilkowalski/skills/blob/main/skills/animate/SKILL.md)。沿用 beUI 的 EASE_OUT 曲线，CSS 140ms 按压至 0.97、160ms 链接箭头移动 3px；hover 限精细指针，减少动效和键盘焦点即时响应。浮层继续使用已有 Motion 手势与 240ms drawer 曲线。

| Before | After | Why |
| --- | --- | --- |
| 列表播放按钮总显示播放 | 同步暂停／播放、选中背景和 aria-pressed；续播保留进度 | 让读者知道当前操作结果；卡片订阅仅播放状态，不随进度时钟重绘 |
| 章节点击无当前位置提示 | 当前章节底色、边线和 aria-current | 清楚显示播放位置，点击仍原地 seek |
| 搜索逐次占用历史、无重置 | 关键词 replace history；一键重置并聚焦输入 | 保留月份／类型回退，方便继续检索 |
| 关闭菜单切换为订阅内容 | 内容选择与打开状态分离 | 退出过程保留原面板 |
| 按钮放大悬停、较重按压与播放涟漪 | 小幅 CSS 按压，去掉播放涟漪；链接细微方向反馈 | 高频操作及时、可中断 |
| 浮动播放器和遮罩背景模糊 | 实色播放器和有色遮罩 | 减少滚动、拖动的绘制开销 |
| 手机部分控件 32–35px | 主要图标按钮／播放／章节／滑杆至少 44px | 提高点击和拖动容错 |

页面滚动、列表筛选和音频进度保持即时更新；没有新增滚动追随、整页入场或列表 stagger。

## Validation

- TypeScript 检查通过。
- 扩展现有浏览器回归：章节状态与不跳页、单音频跨页连续、暂停／续播保留时刻、关键词不增加 history、月份返回、重置焦点、手机抽屉拖动和 Escape 焦点恢复、退出内容保持、减少动效。
- 1440px 与 390px 截图检查，无横向溢出；实际鼠标按压测得 scale(0.97)，播放状态同步；手机点击区域 44px。
- 真机触感仍需用户设备体验；自动化覆盖桌面浏览器的手机视口和减少动效。


2026-10-03：按用户反馈将 Button / ButtonLink 恢复为 BeUI 的 Motion whileTap / whileHover + SPRING_PRESS，按压 0.97、精细指针悬停 1.015；移除外部 CSS 对按钮 transform 的驱动。Tabs / BottomSheet 持续采用已有 BeUI + Motion 实现。上表记录前一轮方案，按钮实现以本条修正为准。
