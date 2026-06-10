# -*- coding: utf-8 -*-
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path("D:/poc-ops-agent/figma-prototype")
FONT = "C:/Windows/Fonts/simhei.ttf"

C = {
    "red": "#d31145",
    "bg": "#f6f7f9",
    "text": "#333d47",
    "muted": "#6b7280",
    "border": "#e4e7ec",
    "green": "#16875a",
    "yellow": "#b7791f",
    "blue": "#227ea6",
    "white": "#ffffff",
    "dark": "#1f2933",
    "pink": "#fbe8ee",
}


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size)


def shadow_card(img, box, radius=8, fill="white", outline=None, shadow=True):
    x, y, w, h = box
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sd.rounded_rectangle((x, y + 8, x + w, y + h + 8), radius, fill=(31, 41, 51, 22))
        sh = sh.filter(ImageFilter.GaussianBlur(12))
        img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(
        (x, y, x + w, y + h),
        radius,
        fill=fill,
        outline=outline,
        width=1 if outline else 0,
    )


def text(d, xy, value, size=16, color=None, spacing=6):
    color = color or C["text"]
    x, y = xy
    f = font(size)
    for line in str(value).split("\n"):
        d.text((x, y), line, font=f, fill=color)
        y += size + spacing


def pill(d, x, y, w, h, label, bg, color="white", size=12):
    d.rounded_rectangle((x, y, x + w, y + h), h // 2, fill=bg)
    tw = d.textbbox((0, 0), label, font=font(size))[2]
    d.text((x + (w - tw) / 2, y + (h - size) / 2 - 2), label, font=font(size), fill=color)


def button(d, x, y, w, label, primary=True):
    bg = C["red"] if primary else C["white"]
    fg = C["white"] if primary else C["text"]
    outline = None if primary else C["border"]
    d.rounded_rectangle((x, y, x + w, y + 44), 8, fill=bg, outline=outline, width=1)
    d.text((x + 18, y + 11), label, font=font(14), fill=fg)


def nav(img, active):
    d = ImageDraw.Draw(img)
    shadow_card(img, (32, 24, 1376, 72), 8, C["white"], None, True)
    d.rounded_rectangle((60, 42, 98, 80), 19, fill=C["white"], outline=C["red"], width=1)
    text(d, (70, 53), "OA", 12, C["red"])
    text(d, (110, 51), "智能运维 Agent", 18, C["text"])
    x = 270
    for item in ["总览", "诊断工作台", "Skill 注册中心", "工作流事件", "审计记录"]:
        w = 118 if len(item) > 4 else 74
        if item == active:
            d.rounded_rectangle((x - 14, 39, x - 14 + w, 81), 21, fill=C["pink"])
        text(d, (x, 52), item, 14, C["red"] if item == active else C["text"])
        x += 136 if len(item) > 4 else 88
    d.rounded_rectangle((1000, 41, 1190, 79), 19, fill="#f7f8fa", outline=C["border"])
    text(d, (1020, 52), "搜索 / 命令", 14, C["muted"])
    pill(d, 1210, 43, 94, 30, "READ_ONLY", C["blue"])
    button(d, 1310, 38, 118, "启动诊断", True)


def base(active, title, subtitle):
    img = Image.new("RGBA", (1440, 1060), C["bg"])
    d = ImageDraw.Draw(img)
    nav(img, active)
    text(d, (80, 138), title, 40, C["text"])
    text(d, (80, 200), subtitle, 18, C["muted"])
    return img, d


def kpi(img, d, x, y, title, value, note, color):
    shadow_card(img, (x, y, 248, 132), 8, C["white"], None, True)
    d.rounded_rectangle((x, y, x + 5, y + 132), 3, fill=color)
    text(d, (x + 24, y + 22), title, 14, C["muted"])
    text(d, (x + 24, y + 50), value, 32, C["text"])
    text(d, (x + 24, y + 94), note, 13, C["muted"])


def skill(d, x, y, title, desc, tag, color):
    d.rounded_rectangle((x, y, x + 252, y + 170), 8, fill=C["white"], outline=C["border"])
    d.rounded_rectangle((x + 20, y + 20, x + 66, y + 66), 8, fill=color)
    text(d, (x + 82, y + 22), tag, 12, C["muted"])
    text(d, (x + 82, y + 44), "READ_ONLY", 12, C["green"])
    text(d, (x + 20, y + 88), title, 20, C["text"])
    text(d, (x + 20, y + 124), desc, 13, C["muted"])


def event(d, x, y, title, meta, color, last=False):
    d.ellipse((x, y, x + 22, y + 22), fill=color)
    if not last:
        d.line((x + 11, y + 34, x + 11, y + 70), fill="#d8dde5", width=1)
    text(d, (x + 40, y - 2), title, 16, C["text"])
    text(d, (x + 40, y + 26), meta, 12, C["muted"])


def dashboard():
    img, d = base("总览", "运维总览", "确认身份、只读边界、诊断能力和最近工作流状态。")
    pill(d, 1120, 150, 86, 30, "已登录", C["green"])
    pill(d, 1216, 150, 132, 30, "ROLE_ops-reader", C["blue"])
    for args in [
        (80, 260, "可用只读 Skill", "5", "均已签名并注册", C["red"]),
        (360, 260, "进行中工作流", "1", "事件流正在接收", C["blue"]),
        (640, 260, "近 24h 失败", "2", "可追踪详情", C["yellow"]),
        (920, 260, "策略拒绝", "7", "由服务端返回", C["dark"]),
    ]:
        kpi(img, d, *args)
    shadow_card(img, (80, 430, 500, 160), 8, C["white"], C["border"], False)
    text(d, (104, 454), "P1 只读边界", 24, C["text"])
    text(
        d,
        (104, 498),
        "当前阶段禁止生产写操作、任意脚本执行和审批绕过。\n操作台只触发已授权 READ_ONLY 诊断请求。",
        16,
        C["muted"],
    )
    button(d, 104, 542, 138, "查看安全约束", False)
    shadow_card(img, (620, 430, 620, 420), 8, C["white"], C["border"], False)
    text(d, (644, 454), "快速启动诊断", 24, C["text"])
    skill(d, 644, 508, "节点健康检查", "CPU、内存、磁盘和心跳状态。", "INFRA", C["red"])
    skill(d, 920, 508, "平台告警摘要", "聚合告警状态和最近变化。", "OBS", C["blue"])
    skill(d, 644, 708, "证书到期检查", "识别临近过期证书风险。", "SEC", C["yellow"])
    skill(d, 920, 708, "服务依赖健康", "检查关键依赖可用性。", "APP", C["green"])
    shadow_card(img, (80, 650, 500, 300), 8, C["white"], C["border"], False)
    text(d, (104, 674), "最近语义事件", 22, C["text"])
    text(d, (104, 708), "按 contractVersion 1.0 强类型事件渲染。", 13, C["muted"])
    event(d, 104, 744, "WORKFLOW_STARTED", "operatorId / sequence 1", C["blue"])
    event(d, 104, 824, "SKILL_ROUTED", "node-health-read@1.1.0", C["red"])
    event(d, 104, 904, "WORKER_ACCEPTED", "受限 Worker 已接收", C["yellow"], True)
    return img


def diagnostic():
    img, d = base("诊断工作台", "诊断工作台", "左侧填写只读诊断参数，右侧实时渲染事件流和结果摘要。")
    shadow_card(img, (80, 260, 430, 620), 8, C["white"], C["border"], False)
    text(d, (104, 284), "启动只读诊断", 24, C["text"])
    text(d, (104, 326), "请求经身份、策略、Skill 路由、工作流和受限 Worker。", 14, C["muted"])
    rows = [
        ("Skill", "node-health-read / 节点健康检查"),
        ("目标环境", "development"),
        ("节点名称", "node-a"),
        ("幂等键", "node-health:node-a:1780928897"),
    ]
    for i, (label, value) in enumerate(rows):
        y = 382 + i * 92
        text(d, (104, y), label, 13, C["muted"])
        d.rounded_rectangle((104, y + 24, 486, y + 70), 8, fill="#f8fafc", outline=C["border"])
        text(d, (120, y + 36), value, 14, C["text"])
    pill(d, 104, 724, 96, 30, "READ_ONLY", C["blue"])
    pill(d, 212, 724, 96, 30, "策略校验", C["green"])
    pill(d, 320, 724, 96, 30, "审计记录", C["red"])
    button(d, 104, 784, 132, "启动诊断", True)
    button(d, 248, 784, 88, "重置", False)
    shadow_card(img, (560, 260, 500, 520), 8, C["white"], C["border"], False)
    text(d, (584, 284), "语义事件流", 22, C["text"])
    text(d, (584, 318), "不展示模型内部推理，只展示可审计状态。", 13, C["muted"])
    event(d, 584, 374, "WORKFLOW_STARTED", "commandId、operatorId 已持久化", C["blue"])
    event(d, 584, 454, "SKILL_ROUTED", "Skill 版本和输出契约已确定", C["red"])
    event(d, 584, 534, "WORKER_ACCEPTED", "Worker 接收授权请求", C["yellow"])
    event(d, 584, 614, "WORKFLOW_COMPLETED", "诊断输出写入事件", C["green"], True)
    shadow_card(img, (1080, 260, 280, 620), 8, C["white"], C["border"], False)
    text(d, (1104, 284), "结果摘要", 24, C["text"])
    pill(d, 1104, 322, 72, 30, "健康", C["green"])
    for i, (name, value, width, color) in enumerate(
        [("CPU", "42%", 92, C["green"]), ("内存", "66%", 145, C["yellow"]), ("磁盘", "52%", 115, C["blue"])]
    ):
        y = 410 + i * 88
        text(d, (1104, y), name, 13, C["muted"])
        d.rounded_rectangle((1104, y + 24, 1324, y + 34), 5, fill="#e9edf2")
        d.rounded_rectangle((1104, y + 24, 1104 + width, y + 34), 5, fill=color)
        text(d, (1104, y + 46), value, 14, C["text"])
    text(d, (1104, 692), "原始 Payload", 18, C["text"])
    d.rounded_rectangle((1104, 720, 1324, 838), 8, fill=C["dark"])
    text(d, (1120, 744), '{\n  "nodeName": "node-a",\n  "heartbeat": "ok"\n}', 12, C["white"])
    return img


def registry():
    img, d = base(
        "Skill 注册中心",
        "Skill 注册中心",
        "查看 P1 只读诊断 Skill 的版本、风险、角色、签名和治理拦截器。",
    )
    shadow_card(img, (80, 250, 1280, 74), 8, C["white"], C["border"], False)
    chips = ["全部", "INFRASTRUCTURE", "APPLICATION", "OBSERVABILITY", "READ_ONLY", "已签名"]
    x = 104
    for i, chip in enumerate(chips):
        w = 140 if i in (1, 3) else 110
        d.rounded_rectangle(
            (x, 271, x + w, 303),
            16,
            fill=C["blue"] if i == 0 else "#f8fafc",
            outline=None if i == 0 else C["border"],
        )
        text(d, (x + 16, 277), chip, 13, C["white"] if i == 0 else C["text"])
        x += 158
    shadow_card(img, (80, 360, 1280, 520), 8, C["white"], C["border"], False)
    text(d, (104, 384), "内置 Skill", 24, C["text"])
    xs = [104, 360, 540, 705, 820, 945, 1165]
    for x, head in zip(xs, ["Skill ID", "显示名", "分类", "版本", "风险", "必要角色", "状态"]):
        text(d, (x, 438), head, 12, C["muted"])
    rows = [
        ("node-health-read", "节点健康检查", "INFRA", "1.1.0", "READ_ONLY", "ops-reader", "已签名"),
        ("application-log-summary-read", "应用日志错误摘要", "APP", "1.0.0", "READ_ONLY", "ops-reader", "已签名"),
        ("certificate-expiry-read", "证书到期检查", "INFRA", "1.0.0", "READ_ONLY", "ops-reader", "已签名"),
        ("platform-alert-summary-read", "平台告警摘要", "OBS", "1.0.0", "READ_ONLY", "ops-reader", "已签名"),
        ("service-dependency-health-read", "服务依赖健康检查", "APP", "1.0.0", "READ_ONLY", "ops-reader", "已签名"),
    ]
    for row_index, row in enumerate(rows):
        y = 500 + row_index * 74
        if row_index % 2:
            d.rounded_rectangle((96, y - 30, 1344, y + 28), 6, fill="#fafbfc")
        for x, value in zip(xs, row):
            text(d, (x, y - 10), value, 14, C["green"] if value == "READ_ONLY" else C["text"])
    shadow_card(img, (80, 910, 1280, 120), 8, C["white"], C["border"], False)
    text(d, (104, 934), "选中项详情：节点健康检查", 22, C["text"])
    text(
        d,
        (104, 978),
        "Owner: platform-observability · Executor: SHELL · Interceptors: AUTHORIZATION, AUDIT · 参数: nodeName · 输出: JSON",
        15,
        C["muted"],
    )
    return img


if __name__ == "__main__":
    for name, maker in [("dashboard", dashboard), ("diagnostic", diagnostic), ("registry", registry)]:
        path = OUT / f"ops-agent-aia-{name}.png"
        maker().convert("RGB").save(path)
        print(path)
