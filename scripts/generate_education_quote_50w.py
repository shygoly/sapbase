from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image, ImageDraw, ImageFont
import os

OUT = "/Users/mac/Sync/project/sapbase/docs/教育智能体项目报价与实施方案_50万.docx"
DIAGRAM = "/Users/mac/Sync/project/sapbase/docs/_quote_architecture_50w.png"

FONT_CN = "微软雅黑"
COLOR_DARK = RGBColor(0x1F, 0x3A, 0x5F)
COLOR_GRAY = RGBColor(0x59, 0x59, 0x59)
COLOR_ACCENT = RGBColor(0x1F, 0x6F, 0xB2)
HEADER_FILL = "1F3A5F"
TOTAL_FILL = "D6EAF8"


def set_cn_font(run, size=10.5, bold=False, color=None):
    run.font.name = FONT_CN
    run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_CN)
    run.font.size = Pt(size)
    run.bold = bold
    if color is not None:
        run.font.color.rgb = color


def style_doc(doc):
    style = doc.styles["Normal"]
    style.font.name = FONT_CN
    style._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_CN)
    style.font.size = Pt(10.5)
    style.paragraph_format.line_spacing = 1.35
    style.paragraph_format.space_after = Pt(4)
    for name, size in [("Heading 1", 16), ("Heading 2", 13), ("Heading 3", 11.5)]:
        st = doc.styles[name]
        st.font.name = FONT_CN
        st._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_CN)
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = COLOR_DARK
        st.paragraph_format.space_before = Pt(12)
        st.paragraph_format.space_after = Pt(6)
        st.paragraph_format.keep_with_next = True


def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tcPr.append(shd)


def set_repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    tblHeader = OxmlElement("w:tblHeader")
    tblHeader.set(qn("w:val"), "true")
    trPr.append(tblHeader)


def no_split(row):
    trPr = row._tr.get_or_add_trPr()
    cantSplit = OxmlElement("w:cantSplit")
    trPr.append(cantSplit)


def cell_text(cell, text, bold=False, size=9.5, color=None, align=WD_ALIGN_PARAGRAPH.LEFT):
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.line_spacing = 1.0
    run = p.add_run(str(text))
    set_cn_font(run, size=size, bold=bold, color=color)


def add_table(doc, headers, rows, widths=None, header_fill=HEADER_FILL, font_size=9.5):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    hdr = table.rows[0]
    set_repeat_header(hdr)
    no_split(hdr)
    for i, h in enumerate(headers):
        cell_text(hdr.cells[i], h, bold=True, size=font_size, color=RGBColor(0xFF, 0xFF, 0xFF))
        shade(hdr.cells[i], header_fill)
    for row in rows:
        new_row = table.add_row()
        no_split(new_row)
        cells = new_row.cells
        for i, value in enumerate(row):
            cell_text(cells[i], value, size=font_size)
            if widths:
                cells[i].width = Cm(widths[i])
    if widths:
        for i, w in enumerate(widths):
            table.columns[i].width = Cm(w)
            for row in table.rows:
                row.cells[i].width = Cm(w)
    return table


def keep_table_together(table):
    for row in table.rows[:-1]:
        for cell in row.cells:
            for p in cell.paragraphs:
                p.paragraph_format.keep_with_next = True


def add_bullets(doc, items, size=10.5):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(item)
        set_cn_font(r, size=size)


def add_note(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.3)
    run = p.add_run(text)
    set_cn_font(run, size=9, color=COLOR_GRAY)
    run.italic = True


def add_page_number(paragraph):
    run = paragraph.add_run()
    fldChar1 = OxmlElement("w:fldChar")
    fldChar1.set(qn("w:fldCharType"), "begin")
    instrText = OxmlElement("w:instrText")
    instrText.set(qn("xml:space"), "preserve")
    instrText.text = "PAGE"
    fldChar2 = OxmlElement("w:fldChar")
    fldChar2.set(qn("w:fldCharType"), "end")
    run._r.append(fldChar1)
    run._r.append(instrText)
    run._r.append(fldChar2)
    set_cn_font(run, size=9, color=COLOR_GRAY)


def make_diagram(path):
    W, H = 1800, 1000
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    font_path = "/System/Library/Fonts/PingFang.ttc"
    if not os.path.exists(font_path):
        font_path = "/System/Library/Fonts/STHeiti Light.ttc"

    def f(size):
        return ImageFont.truetype(font_path, size)

    def box(x, y, w, h, title, body, fill):
        d.rounded_rectangle([x, y, x + w, y + h], radius=18, fill=fill, outline="#1F3A5F", width=2)
        d.text((x + 18, y + 12), title, font=f(26), fill="#1F3A5F")
        d.multiline_text((x + 18, y + 55), body, font=f(20), fill="#333333", spacing=8)

    def arrow(x1, y1, x2, y2):
        d.line([x1, y1, x2, y2], fill="#1F6FB2", width=5)
        d.ellipse([x2 - 7, y2 - 7, x2 + 7, y2 + 7], fill="#1F6FB2")

    box(60, 40, 520, 150, "用户与终端", "教师 / 学生 / 管理人员\nPC / H5 / 移动端", "#EAF2F8")
    box(660, 40, 480, 150, "接入层", "CDN / WAF / SLB / Nginx\nHTTPS · WebSocket · SSE", "#D6EAF8")
    box(1240, 40, 500, 150, "前端应用", "web-portal（教师/学生）\nweb-console（管理/治理）", "#EAF2F8")
    box(60, 300, 520, 190, "API 应用层", "NestJS 模块化单体\n认证/租户/权限/业务编排\nOpenAPI · RBAC · 数据范围", "#D6EAF8")
    box(660, 300, 480, 190, "异步与集成", "PG Jobs + Worker\nRedis 唤醒 · 重试/DLQ\n外部回调 · 连接器", "#EAF2F8")
    box(1240, 300, 500, 190, "智能体与内容", "Agent Runtime · 工具契约\n模型网关 · 文档解析\n内容安全 · 生成标识", "#D6EAF8")
    box(60, 590, 520, 170, "数据层", "PostgreSQL 16（真源/RLS）\nRedis/Valkey（缓存/会话）", "#EAF2F8")
    box(660, 590, 480, 170, "存储层", "对象存储 S3/OSS/MinIO\n素材/视频/离线包/审计归档", "#D6EAF8")
    box(1240, 590, 500, 170, "外部服务", "模型 / TTS / 视频 / OCR\n内容安全 / 短信 / SSO", "#EAF2F8")
    box(60, 820, 1680, 120, "可观测与安全", "日志 · 指标 · 链路 · 审计哈希链 · checkpoint · 告警 · 备份 · 密钥管理 · 等保配合", "#F4F6F7")
    arrow(580, 115, 660, 115)
    arrow(1140, 115, 1240, 115)
    arrow(310, 190, 310, 300)
    arrow(900, 190, 900, 300)
    arrow(1490, 190, 1490, 300)
    arrow(580, 395, 660, 395)
    arrow(1140, 395, 1240, 395)
    arrow(310, 490, 310, 590)
    arrow(900, 490, 900, 590)
    arrow(1490, 490, 1490, 590)
    arrow(580, 675, 660, 675)
    arrow(1140, 675, 1240, 675)
    arrow(310, 760, 310, 820)
    arrow(900, 760, 900, 820)
    arrow(1490, 760, 1490, 820)
    img.save(path)


def main():
    make_diagram(DIAGRAM)
    doc = Document()
    doc.core_properties.title = "教育智能体项目报价与实施方案（一期 / 精简版）"
    doc.core_properties.author = "项目交付团队"
    doc.core_properties.subject = "教育内容生产运营、智能体应用、学习服务；报价约 50 万元"
    doc.core_properties.comments = "初步报价与技术方案，最终以合同/SOW 为准"
    style_doc(doc)
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)
    section.different_first_page_header_footer = True

    hp = section.header.paragraphs[0]
    hp.text = "教育智能体项目报价与实施方案（一期 / 精简版）"
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_cn_font(hp.runs[0], size=9, color=COLOR_GRAY)
    fp = section.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = fp.add_run("第 ")
    set_cn_font(r, size=9, color=COLOR_GRAY)
    add_page_number(fp)
    r = fp.add_run(" 页")
    set_cn_font(r, size=9, color=COLOR_GRAY)

    # Cover
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(90)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("教育智能体项目")
    set_cn_font(r, size=30, bold=True, color=COLOR_DARK)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("报价与实施方案")
    set_cn_font(r, size=30, bold=True, color=COLOR_DARK)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("（一期 / 精简版）")
    set_cn_font(r, size=16, color=COLOR_ACCENT)
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(26)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("—— 内容生产运营 · 智能体应用 · 学习服务 · 移动 H5 ——")
    set_cn_font(r, size=11, color=COLOR_GRAY)
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(110)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("报价金额：¥500,000.00（含税）")
    set_cn_font(r, size=16, bold=True, color=RGBColor(0xB0, 0x3A, 0x2E))
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("大写：伍拾万元整")
    set_cn_font(r, size=11, color=COLOR_GRAY)
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(60)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("版本：V1.0    日期：2026 年 11 月")
    set_cn_font(r, size=10.5, color=COLOR_GRAY)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("本文件仅供商务评估使用，未经书面许可不得复制、转发或披露给第三方")
    set_cn_font(r, size=8.5, color=COLOR_GRAY)
    doc.add_page_break()

    # Contents
    doc.add_heading("目录", level=1)
    for line in [
        "一、报价说明与报价表",
        "二、拟投入团队、角色分工、核心成员履历与 90 日排期",
        "三、产品能力清单、技术方案、部署架构、接口方案与验收思路",
        "四、软件著作权、信息安全资质与组件清单",
        "五、推荐服务器、存储、数据库、中间件、网络与安全配置",
        "六、报价边界、假设与商务条款",
        "附录：调研来源与说明",
    ]:
        p = doc.add_paragraph(line)
        p.paragraph_format.space_after = Pt(6)

    doc.add_paragraph()
    headers = ["文档信息", "内容"]
    rows = [
        ["文档名称", "教育智能体项目报价与实施方案（一期 / 精简版）"],
        ["版本 / 日期", "V1.0 / 2026 年 11 月"],
        ["编制单位", "项目交付团队（以合同签约主体为准）"],
        ["适用范围", "商务评估、方案沟通、合同附件；最终以双方确认的 SOW 为准"],
        ["密级", "商业秘密，未经书面许可不得复制、转发或披露"],
        ["报价总额", "¥500,000.00（含 6% 增值税）"],
    ]
    add_table(doc, headers, rows, widths=[4.0, 12.0], font_size=9)

    # 1 Quote
    doc.add_heading("一、报价说明与报价表", level=1)
    doc.add_heading("1.1 报价口径", level=2)
    add_bullets(doc, [
        "本报价为一期/精简版总价，含 6% 增值税，币种为人民币。",
        "人力投入按 90 个日历日、约 65 个工作日折算；核心团队 6 人，项目交付 217.5 人天（约 3.3 FTE），演示支持 5 人天另计。",
        "平台软件授权费 30,000 元单列，采用私有化买断方式；首年维保/升级包含在总价内，次年起运维服务费 40,000 元/年（8%，可选）。",
        "云资源、模型调用、内容安全、TTS/ASR、视频生成/转码、短信等第三方费用不含在总价内，按客户账号实付或代采。",
        "本报价覆盖一期精简版：3 类核心智能体、1 套 SSO、1 个教务/人事数据源、10 个接口、响应式移动 H5；全量 6 类智能体、复杂视频生成、完整离线 SDK、原生 App/小程序、多数据源/多 SSO 等按增补报价。",
    ])

    doc.add_heading("1.2 初步报价表", level=2)
    headers = ["模块", "人力投入", "一次性费用（元，含税）", "周期性费用（元，含税）", "说明"]
    rows = [
        ["A 教育内容生产与运营管理", "75 人天\n（约 1.15 人）", "159,000", "0", "课程/知识点、素材、内容生产、审核发布、教学任务、教师工作台"],
        ["B 教学内容生成智能应用", "40 人天\n（约 0.62 人）", "83,000", "0", "3 类核心智能体、文档解析基础、生成任务编排；模型/媒体另计"],
        ["C 学习服务智能应用", "35 人天\n（约 0.54 人）", "70,000", "0", "学习中心、移动 H5、视频、学习记录、测评、推荐、徽章、MP4 在线/缓存"],
        ["D 系统集成与数据对接", "27.5 人天\n（约 0.42 人）", "57,000", "0", "1 套 SSO、1 个数据源、10 个接口、3 轮联调；超出另计"],
        ["E 实施、部署、测试与验收", "40 人天\n（约 0.62 人）", "91,000", "0", "90 日排期、1 生产 + 1 测试、数据初始化、培训、UAT、H5 兼容测试"],
        ["A—E 小计", "217.5 人天", "460,000", "0", "—"],
        ["平台软件授权费（买断）", "—", "30,000", "首年 0；次年起 40,000/年（可选）", "私有化部署；1 生产 + 1 测试；见 1.3 授权限制"],
        ["真实产品/项目能力演示支持", "5 人天\n（团队兼任，另计）", "10,000", "0", "演示环境、账号、样例数据、设备、1 次彩排 + 1 次正式演示"],
        ["合计", "222.5 人天\n（含演示）", "500,000", "0（首年）；次年起可选 40,000/年", "含 6% 增值税；云资源/模型/第三方不含"],
    ]
    table = add_table(doc, headers, rows, widths=[3.0, 2.6, 3.0, 2.8, 5.0], font_size=7.8)
    for idx in [5, 8]:
        for c in table.rows[idx].cells:
            shade(c, TOTAL_FILL)
            for p in c.paragraphs:
                for r in p.runs:
                    r.bold = True

    doc.add_heading("1.3 平台授权与容量限制", level=2)
    add_bullets(doc, [
        "授权方式：私有化买断使用权，1 个生产环境 + 1 个测试环境；不含源代码、二次销售权、对外 SaaS 运营权。",
        "用户/并发：3,000 注册用户；80 并发在线；500 并发测评提交/日；5 并发文档解析。",
        "容量：5TB 对象存储；单文件 500MB；单次知识源 2GB；批量导入 300MB。",
        "设备/调用：不限制终端设备数量；如选离线增强包，设备绑定默认 2 台/用户（可配置）；平台 API 默认 50 万次/月，模型调用按第三方配额。",
        "部署环境：客户自有/云上单租户环境；多租户 SaaS、集团多法人、跨地域多活需另签授权与扩容。",
        "超出限制：按用户数/并发/存储/调用量阶梯扩容，或按实际资源代采；不在本报价内。",
        "质保期：验收后 12 个月，含缺陷修复、版本升级、远程支持；次年起运维服务费按合同总额 8%/年 = 40,000 元/年（可选）。",
    ])

    doc.add_heading("1.4 分项人力明细", level=2)
    headers = ["角色", "人数", "人天", "单价（元/人天）", "费用（元）", "主要投入"]
    rows = [
        ["项目经理", "1", "40", "2,000", "80,000", "计划、范围、风险、客户接口、验收、演示组织"],
        ["前端架构师", "1", "40", "2,000", "80,000", "管理端/教师端/学生端架构、关键页面、H5 适配、组件规范、性能"],
        ["后端架构师", "1", "40", "2,000", "80,000", "平台/业务后端、身份/权限/审批/资产/任务/审计、集成"],
        ["设计师", "1", "35", "2,000", "70,000", "交互/视觉、设计规范、页面稿、移动适配"],
        ["智能体架构师", "1", "37.5", "2,000", "75,000", "Agent 编排、工具契约、RAG/文档解析、模型接入、评测"],
        ["Harness 工程师", "1", "25", "3,000", "75,000", "Agent Harness/评测/工具链、CI、可观测、部署与稳定性"],
        ["演示支持（团队兼任）", "—", "5", "2,000", "10,000", "演示环境、账号、样例数据、设备、彩排/正式演示"],
        ["人力合计", "6", "222.5", "—", "470,000", "另加平台授权 30,000，总计 500,000"],
    ]
    table = add_table(doc, headers, rows, widths=[2.0, 1.4, 1.6, 2.6, 2.4, 6.6], font_size=8.5)
    keep_table_together(table)
    for c in table.rows[-1].cells:
        shade(c, TOTAL_FILL)
        for p in c.paragraphs:
            for r in p.runs:
                r.bold = True
    add_note(doc, "217.5 人天 = 6 人按 90 个日历日（约 65 个工作日）兼职投入，平均 3.35 FTE；非 6 人全职 90 天。演示 5 人天由团队兼任，按 2,000 元/人天单列 10,000 元。")

    doc.add_heading("1.5 付款与商务", level=2)
    add_bullets(doc, [
        "合同签订后 30% 预付款（150,000 元）；平台基础能力验收（M2）后 30%（150,000 元）；UAT 通过（M5）后 30%（150,000 元）；验收/移交（M6）后 10%（50,000 元）。",
        "报价有效期：自报价日起 30 个日历日；汇率/税率/云厂商价格重大变化时双方另行协商。",
        "交付周期：合同生效且客户依赖项（SSO、数据源、环境、provider 账号）就绪后 90 个日历日。",
        "质保期：验收后 12 个月；质保期后运维服务 8%/年 = 40,000 元/年（可选），不含云资源/模型/第三方费用。",
        "知识产权：定制部分使用权归客户；平台基座、通用组件、Agent Runtime、工具链等既有知识产权归厂商；源代码/二次销售/外包托管另议。",
    ])

    # 2 Team & Schedule
    doc.add_heading("二、拟投入团队、角色分工、核心成员履历与 90 日排期", level=1)
    doc.add_heading("2.1 团队清单", level=2)
    add_note(doc, "核心团队 6 人，按 90 个日历日、约 65 个工作日折算；项目交付 217.5 人天（约 3.35 FTE），演示 5 人天另计；峰值 6 人。")
    headers = ["角色", "人数", "投入（FTE）", "人天", "单价（元/人天）", "费用（元）", "主要职责/交付物"]
    rows = [
        ["项目经理", "1", "0.62", "40", "2,000", "80,000", "计划、范围、风险、客户接口、验收、演示组织"],
        ["前端架构师", "1", "0.62", "40", "2,000", "80,000", "管理端/教师端/学生端架构、关键页面、H5 适配、组件规范、性能"],
        ["后端架构师", "1", "0.62", "40", "2,000", "80,000", "平台/业务后端、身份/权限/审批/资产/任务/审计、集成"],
        ["设计师", "1", "0.54", "35", "2,000", "70,000", "交互/视觉、设计规范、页面稿、移动适配"],
        ["智能体架构师", "1", "0.58", "37.5", "2,000", "75,000", "Agent 编排、工具契约、RAG/文档解析、模型接入、评测"],
        ["Harness 工程师", "1", "0.38", "25", "3,000", "75,000", "Agent Harness/评测/工具链、CI、可观测、部署与稳定性"],
        ["合计", "6", "3.35", "217.5", "—", "460,000", "演示 5 人天另计；总人力 222.5 人天"],
    ]
    table = add_table(doc, headers, rows, widths=[3.2, 1.2, 1.6, 1.4, 2.2, 2.0, 5.0], font_size=7.8)
    keep_table_together(table)
    for c in table.rows[-1].cells:
        shade(c, TOTAL_FILL)
        for p in c.paragraphs:
            for r in p.runs:
                r.bold = True
    add_note(doc, "FTE 按 65 个工作日折算；6 人均为兼职投入，平均 3.35 FTE。演示 5 人天由团队兼任，费用 10,000 元单列。")

    doc.add_heading("2.2 角色分工（RACI）", level=2)
    headers = ["工作包", "负责（R）", "审批（A）", "协作（C）", "知会（I）"]
    rows = [
        ["项目管理与验收", "项目经理", "项目经理（内部）/客户（验收）", "全体", "客户"],
        ["总体架构与接口", "前端架构师、后端架构师", "项目经理", "智能体/Harness/设计", "客户 IT"],
        ["内容生产与运营", "后端架构师、设计师", "项目经理", "前端、智能体、客户教研", "客户"],
        ["智能体应用", "智能体架构师", "后端架构师", "Harness、前端、客户业务", "项目经理"],
        ["Harness/评测/工具链", "Harness 工程师", "智能体架构师", "后端、前端", "项目经理"],
        ["身份/SSO/权限", "后端架构师", "项目经理", "前端、客户 IT", "设计"],
        ["审批/资产/通知/审计", "后端架构师", "项目经理", "前端、设计", "客户业务"],
        ["前端/管理端/教师端/学生端", "前端架构师", "项目经理", "设计、后端", "客户"],
        ["设计/体验/规范", "设计师", "项目经理", "前端", "客户"],
        ["集成/导入导出", "后端架构师", "项目经理", "前端、客户 IT", "智能体"],
        ["测试/验收", "项目经理、Harness 工程师", "项目经理", "全体、客户", "客户"],
        ["部署/上线", "后端架构师、Harness 工程师", "项目经理", "客户运维", "全体"],
    ]
    add_table(doc, headers, rows, widths=[3.6, 3.0, 2.8, 4.2, 3.0], font_size=8.5)

    doc.add_heading("2.3 核心成员履历（脱敏）", level=2)
    add_note(doc, "以下为拟任核心岗位画像；实名简历、学历/证书、项目证明、劳动关系或劳务协议在商务确认后提供。")
    profiles = [
        ("核心成员 A｜项目经理", "12 年以上 IT 交付，6 年以上教育/政务/大型平台项目管理；PMP/Prince2 体系；负责总体计划、里程碑、风险、客户接口、验收与移交。"),
        ("核心成员 B｜前端架构师", "10 年以上前端研发，6 年以上中后台/教育产品；React/Next.js、TypeScript、组件体系、可视化、H5/移动适配；负责前端架构、关键页面与性能。"),
        ("核心成员 C｜后端架构师", "12 年以上后端研发，8 年以上平台化/多租户；NestJS/Node.js、PostgreSQL、Redis、RLS、SSO、审计链与集成；负责平台/业务后端与关键设计。"),
        ("核心成员 D｜设计师", "8 年以上 UX/UI，5 年以上教育/管理后台；交互、视觉、设计规范、移动适配与可用性；负责管理端/教师端/学生端体验。"),
        ("核心成员 E｜智能体架构师", "8 年以上 AI 应用/平台，5 年以上 LLM/Agent 工程化；Agent 编排、工具契约、RAG/文档解析、模型网关、内容安全与评测；负责 3 类核心智能体。"),
        ("核心成员 F｜Harness 工程师", "6 年以上平台/DevOps/AI 基础设施；Agent Harness、评测回归、工具链、CI/CD、可观测、压测与发布；负责工程效率与稳定性。"),
    ]
    for title, body in profiles:
        p = doc.add_paragraph()
        p.paragraph_format.keep_with_next = True
        r = p.add_run(title)
        set_cn_font(r, size=10.5, bold=True, color=COLOR_DARK)
        p = doc.add_paragraph(body)
        p.paragraph_format.left_indent = Cm(0.3)
        for r in p.runs:
            set_cn_font(r, size=9.5)

    doc.add_heading("2.4 90 日初步实施排期", level=2)
    headers = ["阶段", "时间", "目标", "主要工作", "里程碑"]
    rows = [
        ["P0 启动与冻结", "D1—D14\nW1—W2", "范围、环境、依赖就绪", "kickoff、需求澄清、架构/接口规范、环境与账号、SSO/教务/provider 确认、Blueprint 骨架、数据范围节点、CI/CD；6 人分工", "M1：D14 需求冻结/环境就绪"],
        ["P1 平台基础", "D15—D35\nW3—W5", "平台核心可用", "身份/SSO、多角色/会话、审批/工作项、资产/上传、异步任务、通知、审计链、导入导出基础；课程/知识点/班级骨架", "M2：D35 平台基础可用"],
        ["P2 业务与智能体", "D36—D56\nW6—W8", "主业务链路跑通", "内容生成、文档解析、审核发布、教学任务、学习服务、测评/判分、规则推荐、指标看板、集成连接器、AI 治理", "M3：D56 内容生产/学习服务主链路"],
        ["P3 集成与硬化", "D57—D77\nW9—W11", "联调、性能、安全", "外部系统联调、数据同步/对账、移动/H5、多设备兼容测试、播放/缓存、权限/范围负例、性能压测、安全整改、UAT 准备", "M4：D77 集成/性能/安全完成"],
        ["P4 验收与上线", "D78—D90\nW12—W13", "UAT、上线、移交", "UAT、缺陷修复、验收证据、培训、上线、运维移交、复盘", "M5：D85 UAT 通过；M6：D90 上线/移交"],
    ]
    add_table(doc, headers, rows, widths=[2.2, 2.0, 2.8, 6.6, 3.0], font_size=8.5)

    doc.add_heading("2.5 周排期与关键依赖", level=2)
    headers = ["周", "日期", "项目经理", "前端架构师", "后端架构师", "设计师", "智能体架构师", "Harness 工程师"]
    rows = [
        ["W1", "D1—D7", "kickoff、范围、计划", "前端架构、页面清单", "架构、环境、CI/CD", "需求/流程、风格", "模型/内容安全确认", "评测/工具链方案"],
        ["W2", "D8—D14", "需求冻结、M1", "设计稿评审、组件规范", "接口规范、数据范围", "关键页面/原型", "Agent 定义/工具契约", "CI/环境、评测基线"],
        ["W3", "D15—D21", "计划跟踪、SSO 协调", "登录/框架/管理端/H5", "身份/SSO、多角色", "管理端视觉", "文档解析/生成设计", "部署/监控"],
        ["W4", "D22—D28", "审批/资产协调", "课程/素材/H5 页面", "审批/工作项、资产", "教师端页面", "内容生成任务", "任务/回调可观测"],
        ["W5", "D29—D35", "M2 平台验收", "教师工作台", "通知/审计/异步", "学生端/移动", "生成状态/回调", "压测基线"],
        ["W6", "D36—D42", "主链路计划", "学习中心/测评 H5", "集成连接器、指标", "学习页面", "知识结构/解析", "集成测试"],
        ["W7", "D43—D49", "联调协调", "看板/错题", "数据同步/对账", "看板/专题", "学习服务智能体", "性能/评测"],
        ["W8", "D50—D56", "M3 主链路", "评价/徽章", "通知/审计完善", "细节/适配", "AI 治理/标识", "回归/评测报告"],
        ["W9", "D57—D63", "外部联调", "H5 适配/联调", "SSO/教务联调", "移动适配", "视频/语音联调", "联调环境"],
        ["W10", "D64—D70", "安全/权限", "播放/缓存/兼容", "权限负例、审计导出", "验收页面", "生成质量/重试", "安全/兼容测试"],
        ["W11", "D71—D77", "压测/M4", "性能优化", "性能/监控", "视觉走查", "生成性能", "压测/告警"],
        ["W12", "D78—D84", "UAT", "缺陷修复", "缺陷修复", "UAT 支持", "内容复核", "生产演练"],
        ["W13", "D85—D90", "验收/移交", "上线支持", "上线/运维移交", "培训材料", "生产验证", "监控/移交"],
    ]
    add_table(doc, headers, rows, widths=[1.0, 1.5, 2.3, 2.3, 2.3, 2.3, 2.45, 2.45], font_size=7.2)

    doc.add_heading("2.6 关键依赖与交付物", level=2)
    headers = ["依赖/交付物", "责任方", "最晚时间", "说明"]
    rows = [
        ["SSO 协议、测试账号、回调地址", "客户 IT", "D7", "1 套协议；用于 P1 身份/SSO 联调"],
        ["教务/人事数据源、只读账号、字段字典", "客户 + 数据源厂商", "D14", "1 个数据源；含白名单、限流/配额"],
        ["生产/测试环境、域名、证书、云账号", "客户运维", "D14", "1 生产 + 1 测试；影响 P0 环境就绪"],
        ["模型/内容安全/TTS/视频 provider 账号", "客户/厂商", "D14", "账号、配额、合规审核；费用客户承担"],
        ["样例课程/知识点/学生数据（脱敏）", "客户教研", "D21", "用于开发、测试、演示；禁止真实敏感数据"],
        ["iOS/Android 测试设备或云真机账号", "客户/项目组", "D35", "5—6 台主流机型；H5 兼容测试；云真机/设备费用另计"],
        ["UAT 人员、验收口径、培训名单", "客户", "D35", "业务代表、UAT 计划、培训组织"],
        ["交付物：代码/镜像、API 文档、部署/运维手册", "项目组", "M6", "含 SBOM、许可证清单、测试报告、验收证据"],
    ]
    add_table(doc, headers, rows, widths=[6.0, 3.2, 1.8, 5.6], font_size=8.2)
    add_note(doc, "以上依赖延迟按 6.3 顺延；客户未提供时，项目组可协助，但相关费用另计。")

    # 3 Capabilities & Tech
    doc.add_heading("三、产品能力清单、技术方案、部署架构、接口方案与验收思路", level=1)
    doc.add_heading("3.1 产品能力清单", level=2)
    headers = ["模块", "产品能力", "来源", "说明"]
    rows = [
        ["A 教育内容生产与运营", "课程/章节/知识点、课程状态/版本、素材上传/封面、内容生成、审核发布、教学任务、教师工作台、基础看板、身份权限、数据对接", "平台复用 + 教育垂直", "课程/知识点/班级/教学任务为 Blueprint；资产/审批/通知/审计/指标/导入导出复用平台"],
        ["B 内容生成智能应用", "3 类核心智能体（课程设计/知识点提取/脚本分镜）、文档解析基础、生成任务、调用统计、内容安全/复核", "Agent Runtime + 垂直 + 第三方", "视频生成/TTS/ASR 不自研，接 provider"],
        ["C 学习服务智能应用", "学习中心、移动 H5、视频播放、学习记录/日历、测评基础、规则推荐、徽章/评价、MP4 在线/轻量缓存、数据隔离", "教育垂直 + 平台", "默认响应式 H5；可靠离线播放需混合壳/App，另计；完整离线 SDK 后置"],
        ["D 系统集成与数据对接", "1 套 SSO、1 个教务/人事数据源、10 个接口、任务回调、同步/对账", "平台集成 + 客户系统", "客户提供协议、测试账号、只读账号、白名单"],
        ["E 实施与验收", "90 日排期、1 生产 + 1 测试、数据初始化、培训、UAT、验收证据、运维移交", "实施服务", "客户依赖延迟按变更/顺延"],
        ["演示支持", "演示环境、账号、样例课程/知识点/生成/审批/看板/学生端、设备、彩排", "实施服务", "1 次彩排 + 1 次正式"],
    ]
    add_table(doc, headers, rows, widths=[2.8, 6.8, 2.8, 4.2], font_size=8.5)
    add_note(doc, "本期为一期精简版；完整 6 类智能体、复杂视频生成、完整离线 SDK、多数据源/多 SSO 不在本期，按增补报价。")

    doc.add_heading("3.2 初步技术方案", level=2)
    add_bullets(doc, [
        "总体架构：Nx 模块化单体 + 可拆分部署单元；Next.js 15 前端、NestJS 10 API、PostgreSQL 16、Redis/Valkey、对象存储、Worker。",
        "团队组织：6 人核心团队按 3 条并行工作流组织——平台/后端（后端架构师）、前端/设计（前端架构师 + 设计师）、智能体/Harness（智能体架构师 + Harness 工程师）；项目经理统一计划、风险与验收。",
        "多租户：organizationId + PostgreSQL RLS；应用层再执行数据范围（课程/班级/组织树）。",
        "四维权限：菜单/功能（RBAC）、数据（scope）、资源（课程/班级节点）、字段（field permissions）。",
        "审批：机器检测 pass/fail/warn；warn 必须人工确认；驳回重提新 round；发布前整体 approved 闸门。",
        "异步：PG jobs + Redis 唤醒；至少一次 + 幂等；外部回调 HMAC + SSRF 防护；DLQ/重放。",
        "资产：上传会话、分片/断点续传、病毒扫描、图片/文档/视频变体、签名 URL、ready 才可下载。",
        "审计：append-only 哈希链、checkpoint 签名、归档/保留期、break-glass 留痕。",
        "内容安全：机器初审 + 人工终审 + 生成内容标识；标识在下载/离线/分享/导出/转码保留。",
        "发布：Blueprint 版本、灰度/激活/回退；发布进程与运行版本分离。",
        "范围控制：一期以 3 类智能体、1 套 SSO、1 个数据源、10 个接口为边界；超出走书面变更单。",
    ])

    doc.add_heading("3.3 部署架构", level=2)
    doc.add_picture(DIAGRAM, width=Cm(16.6))
    doc.add_paragraph().alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.paragraphs[-1]
    r = p.add_run("图 1  逻辑架构示意（默认生产形态）")
    set_cn_font(r, size=8.5, color=COLOR_GRAY)
    add_bullets(doc, [
        "默认生产：CDN/WAF → SLB/Nginx → Next.js（2 实例）+ NestJS API（2 实例）→ PostgreSQL 主备、Redis 主从/Sentinel、对象存储、Worker。",
        "网络分区：DMZ / 应用区 / 数据区 / 管理区 / 外部区；数据库仅应用区与堡垒机可达。",
        "高可用：API/Web 无状态水平扩展；PG 主备/只读副本；Redis Sentinel/Cluster；对象存储多副本；Worker 按队列拆分。",
        "发布：灰度/蓝绿；数据库迁移向前兼容；按镜像/发布版本回退。",
    ])

    doc.add_heading("3.4 接口方案", level=2)
    headers = ["接口类型", "协议/格式", "认证", "说明"]
    rows = [
        ["业务 REST", "HTTPS + JSON，OpenAPI 3", "JWT + 组织上下文 + RBAC/数据范围", "统一信封 {code,msg,data,rows,total}；固定错误码"],
        ["移动端 H5", "HTTPS + JSON，响应式 Web", "JWT + SSO", "复用业务 REST；微信内置浏览器兼容；不单独提供 App SDK"],
        ["实时通知", "WebSocket（Socket.IO）", "JWT 握手", "通知、未读、任务进度"],
        ["任务事件", "SSE / 轮询", "JWT", "afterSeq 回放、断线重连"],
        ["外部回调", "HTTPS POST JSON", "HMAC-SHA256 + timestamp", "2xx 成功；408/429/5xx 重试；禁重定向/私网"],
        ["SSO", "CAS / OAuth2 / OIDC / SAML", "协议标准", "state/nonce/PKCE/签名/时间窗；失败 fail-closed"],
        ["教务/人事", "REST/JSON、数据库只读、文件", "服务令牌/只读账号", "字段映射、增量/全量、重试、对账"],
        ["开放 API", "REST/OpenAPI", "服务令牌 + scope", "代用户调用服务端二次解析权限/范围"],
        ["导入导出", "CSV/XLSX/JSON/PDF/MD", "JWT + 权限", "异步任务、进度、错误行定位、幂等"],
    ]
    add_table(doc, headers, rows, widths=[2.4, 4.2, 3.8, 6.2], font_size=8.5)
    add_note(doc, "接口约定：本期接口不超过 10 个，清单在 D14 冻结；写接口支持 Idempotency-Key/业务幂等键；外部系统提供测试环境、测试账号、字段字典、错误码、限流/配额；联调至少 3 轮。")

    doc.add_heading("3.5 验收思路", level=2)
    headers = ["验收层", "内容", "证据"]
    rows = [
        ["需求覆盖", "需求 → 功能/接口/页面/测试用例追踪矩阵", "追踪矩阵、演示录屏"],
        ["功能验收", "课程/内容/生成/审核/教学/学习/测评/推荐/在线播放/轻量缓存/看板", "操作记录、截图、UAT 签字"],
        ["移动兼容", "iOS/Android 主流 5—6 台、微信内置浏览器、弱网/分辨率/横竖屏", "兼容测试报告、截图/录屏"],
        ["接口验收", "SSO、教务、数据同步、回调、幂等、重试、对账", "联调记录、回调日志、对账报告"],
        ["权限/隔离", "跨租户、跨班级、越权审批、数据范围、字段权限", "负例测试报告、RLS/范围证据"],
        ["性能", "80 并发看板 <5s、500 并发测评提交、5 并发解析、500MB 文件/2GB 知识源/300MB 批量", "压测报告、监控截图"],
        ["安全", "登录/权限/审计/内容安全/生成标识/漏洞扫描/等保配合", "扫描报告、整改记录、审计导出"],
        ["审计", "全场景操作、哈希链验证、归档/保留", "审计查询、验证 API、归档清单"],
        ["交付", "代码/镜像、部署手册、接口文档、运维手册、培训", "交付清单、培训签到、移交确认"],
    ]
    add_table(doc, headers, rows, widths=[2.8, 7.0, 6.8], font_size=8.5)
    add_note(doc, "验收门：M1 需求冻结、M2 平台基础、M3 主链路、M4 集成/性能/安全、M5 UAT、M6 上线移交。未过门不进入下一阶段。")

    doc.add_heading("3.6 移动端形态与多设备测试", level=2)
    add_note(doc, "一期默认交付响应式 H5，不默认开发原生 App；以下费用为参考，最终以客户选择与厂商账单为准。")
    headers = ["形态", "是否含在 50 万", "交付范围", "多设备测试", "参考费用/周期"]
    rows = [
        ["响应式 H5（推荐）", "含", "教师/学生/管理端移动浏览器、微信内置浏览器；登录/课程/学习/测评/通知/上传/播放/轻量缓存；复用 REST/SSO", "iOS/Android 主流 5—6 台，2 轮；功能/兼容/弱网/分辨率/横竖屏", "3—5 人天已含 E 模块；云真机可选 2,000—5,000 元/年"],
        ["微信小程序（可选）", "不含", "企业主体认证、类目审核、备案；复用 H5 业务接口；微信登录/分享/通知", "5—6 台真机/云真机；微信开发者工具 + 真机", "开发 +3—6 万（含 3—5 人天测试）；认证 300 元/年"],
        ["原生 App（iOS/Android，不含）", "不含", "开发者账号、隐私合规、推送、上架、离线 SDK；建议跨端框架", "10—15 台主流机型；5—8 人天；云真机/设备池", "开发 +15—25 万/端；跨端 20—30 万；测试/设备 +3—8 万"],
    ]
    add_table(doc, headers, rows, widths=[2.8, 1.8, 5.6, 3.6, 2.8], font_size=7.8)
    add_bullets(doc, [
        "一期移动端以 H5 为主：教师/学生/管理端共用一套响应式页面，不单独维护 iOS/Android 原生代码；H5 兼容测试 3—5 人天已含在 E 模块 40 人天内，不单列报价。",
        "多设备测试范围：iOS/Android 各 2—3 款主流机型（含微信内置浏览器），2 轮兼容测试；覆盖登录、课程、学习、测评、通知、上传、播放主链路。",
        "不含：客户特定老旧机型/定制 ROM/鸿蒙 NEXT 专项适配、原生 App/小程序开发、App 上架/推送/应用商店合规；如需要，按上表参考价单独立项。",
        "费用归属：云真机/第三方设备池按客户账号实付或代采；H5 基础兼容测试不另收费；原生 App/小程序不占用本期 217.5 人天。",
        "离线播放边界见 3.7：H5 默认不承诺断网播放；可靠离线需混合 App 壳/原生 App/小程序，另计。",
    ])

    doc.add_heading("3.7 离线播放边界与可选增强", level=2)
    add_note(doc, "纯 H5 可以做轻量缓存和 MP4 下载，但不能稳定承诺断网播放；可靠离线需混合 App 壳或原生 App。")
    headers = ["能力", "H5（默认，含）", "混合 App 壳（可选）", "原生 App（可选）"]
    rows = [
        ["在线播放", "支持", "支持", "支持"],
        ["页面/图片/小文件缓存", "支持（受浏览器配额）", "支持", "支持"],
        ["大 MP4 下载/断网播放", "不保证", "支持", "支持"],
        ["后台下载/断点续传", "不支持/受限", "支持", "支持"],
        ["加密存储/设备绑定", "不支持", "支持", "支持"],
        ["学习进度离线回传", "简单缓存", "支持", "支持"],
        ["增量费用", "0", "+5—10 万", "+15—25 万/端"],
    ]
    add_table(doc, headers, rows, widths=[4.2, 4.0, 4.2, 4.2], font_size=8.0)
    add_bullets(doc, [
        "H5 默认能力：在线播放、页面/图片/小体积 MP4 缓存、MP4 下载到本地（由系统播放器打开）；不承诺断网播放、后台下载、DRM、设备绑定。",
        "主要限制：iOS Safari/微信内置浏览器可能清理缓存；大文件下载/后台下载/断点续传受限；跨浏览器行为不一致。",
        "可靠离线播放：建议混合 App 壳（复用 H5 页面 + 原生下载器/播放器/加密存储），或原生 App；微信小程序可做小规模离线，但受存储/格式/审核限制。",
        "费用：混合 App 壳 +5—10 万；原生 App +15—25 万/端（跨端 20—30 万）；DRM/内容加密/大容量 CDN/设备池另计；不占用本期 217.5 人天。",
        "建议：一期若必须离线，优先混合 App 壳；若只是补充学习，H5 在线 + 轻量缓存即可，避免为离线把预算拉高。",
    ])

    # 4 Qualifications / Components
    doc.add_heading("四、软件著作权、信息安全资质与组件清单", level=1)
    doc.add_heading("4.1 软件著作权与资质", level=2)
    add_note(doc, "以下为投标/合同附件应提供项；实际证书名称、登记号、有效期以投标主体附件为准；未取得的写“无”，不虚构。")
    headers = ["类别", "证书/资质", "状态/提供方式"]
    rows = [
        ["软件著作权", "平台基座（多租户/权限/审计/任务）", "提供证书或登记受理证明"],
        ["软件著作权", "教育内容生产与运营管理平台", "本项目可协助整理登记材料；能否取得以版权中心审核为准"],
        ["软件著作权", "教育智能体应用（内容生产/学习服务）", "本项目可协助整理登记材料；能否取得以版权中心审核为准"],
        ["软件著作权", "数据集成/指标看板/资产管道（按实际产品）", "提供现有证书或登记证明"],
        ["质量体系", "ISO 9001 质量管理体系", "提供证书；无则写“无”"],
        ["信息安全", "ISO/IEC 27001", "提供证书；无则写“无”"],
        ["能力成熟度", "CMMI 3 级及以上", "提供证书；无则写“无”"],
        ["IT 服务", "ITSS 信息技术服务标准", "提供证书；无则写“无”"],
        ["等保", "等保 2.0 三级备案/测评报告（项目环境）", "上线前由客户/测评机构完成；厂商配合整改"],
        ["企业资质", "高新技术企业、软件企业、CS 信息系统建设资质", "按投标主体实际提供"],
        ["安全承诺", "保密协议、数据安全承诺、供应链安全承诺", "合同附件"],
        ["人员证明", "核心成员社保/劳务、学历、证书", "商务确认后提供"],
    ]
    add_table(doc, headers, rows, widths=[2.8, 8.0, 5.8], font_size=8.5)

    doc.add_heading("4.2 开源组件与许可证", level=2)
    add_note(doc, "版本以交付 SBOM 为准；核心代码不使用 GPL/AGPL/SSPL 类强传染组件；Grafana 为 AGPL-3.0，若使用需独立部署/法务确认或改用商业版；Redis 7.4+ 许可证变化需按部署方式确认。")
    headers = ["类别", "组件", "许可证", "用途/备注"]
    rows = [
        ["后端框架", "NestJS 10", "MIT", "API/模块/依赖注入；官方声明 MIT"],
        ["运行时", "Node.js 20 LTS", "MIT", "服务运行时"],
        ["ORM", "TypeORM 0.3", "MIT", "实体/迁移/查询"],
        ["数据库", "PostgreSQL 16", "PostgreSQL License", "真源、RLS、JSONB；官方宽松许可证"],
        ["缓存", "Valkey 8.x / Redis 7.2", "BSD 3-Clause", "建议 Valkey；完全开源"],
        ["缓存（可选）", "Redis 7.4+ / Redis 8", "RSALv2 / SSPLv1（非 OSI）", "如使用需法务确认/商业授权，不建议默认"],
        ["前端", "Next.js 15", "MIT", "Portal/Console；官方 MIT"],
        ["前端", "React 18", "MIT", "UI"],
        ["UI", "Tailwind CSS、Radix UI、shadcn/ui", "MIT", "组件/样式"],
        ["图表", "Recharts", "MIT", "看板"],
        ["图标", "Lucide", "ISC", "图标"],
        ["实时", "Socket.IO", "MIT", "WebSocket"],
        ["API 文档", "Swagger UI / OpenAPI", "Apache-2.0", "接口文档"],
        ["校验", "class-validator、Ajv", "MIT", "DTO/Schema 校验"],
        ["认证", "passport-jwt、bcrypt", "MIT", "JWT/密码哈希"],
        ["导入导出", "PapaParse", "MIT", "CSV"],
        ["构建", "Nx 24", "MIT", "Monorepo"],
        ["测试", "Jest、Supertest、Playwright", "MIT / Apache-2.0", "单测/接口/E2E"],
        ["Agent 评测", "Promptfoo", "MIT", "提示/Agent 回归评测"],
        ["Agent 追踪", "Langfuse（核心）", "MIT（核心）/ 商业（EE）", "追踪/评测；EE 功能需商业授权"],
        ["容器", "Docker Engine、Kubernetes（可选）", "Apache-2.0", "部署/编排"],
        ["监控", "OpenTelemetry、Prometheus", "Apache-2.0", "可观测"],
        ["看板（可选）", "Grafana", "AGPL-3.0（或商业授权）", "如使用需法务确认；可改用云监控"],
    ]
    add_table(doc, headers, rows, widths=[2.4, 5.2, 3.8, 5.2], font_size=8.0)

    doc.add_heading("4.3 商业 SDK、模型与第三方服务", level=2)
    headers = ["类别", "候选厂商/产品", "用途", "计费/授权", "是否包含"]
    rows = [
        ["大语言模型", "DeepSeek、通义千问、智谱 GLM、OpenAI（按合规）", "内容生成、问答、判分辅助", "按 token/调用量", "不含，按实结算"],
        ["Embedding/Rerank", "通义、智谱、OpenAI、BGE 自部署", "知识检索/推荐", "按 token 或自部署", "可选"],
        ["OCR/文档解析", "阿里云文档智能、腾讯云 OCR、百度 OCR、开源解析器", "PDF/PPT/Word 解析", "按页/调用", "可选"],
        ["内容安全", "阿里云内容安全、腾讯云天御、网易易盾", "文本/图片/视频审核", "按调用/时长", "可选"],
        ["TTS/ASR", "阿里云智能语音、腾讯云语音、讯飞", "旁白/字幕/语音", "按字符/时长", "可选"],
        ["视频生成/转码", "阿里云视频点播、腾讯云 VOD、火山引擎、第三方生成", "视频合成/转码/HLS", "按分钟/转码规格", "可选"],
        ["对象存储/CDN", "阿里云 OSS、腾讯云 COS、华为云 OBS、MinIO", "素材/视频/离线包/归档", "按存储/流量", "可选"],
        ["短信/邮件", "阿里云短信、腾讯云 SMS、SMTP", "通知/验证码", "按条", "可选"],
        ["Agent 评测/追踪", "Langfuse Cloud、LangSmith、Promptfoo Cloud", "评测、回归、追踪", "按 seat/调用", "可选"],
        ["移动兼容测试", "阿里云 EMAS、腾讯 WeTest、BrowserStack", "云真机/兼容测试", "按台次/时长/年", "可选，客户承担"],
        ["SSO/身份", "客户 CAS/OIDC/SAML、企业微信/钉钉（可选）", "统一登录", "客户提供", "不含"],
        ["模型训练/微调", "无", "不做模型训练/微调", "无", "无"],
        ["视频生成算法", "无", "不自研，接第三方", "无", "无"],
        ["内容安全模型", "无", "不自研，接第三方", "无", "无"],
    ]
    add_table(doc, headers, rows, widths=[2.6, 5.2, 4.2, 2.6, 2.0], font_size=8.0)

    doc.add_heading("4.4 许可证合规与交付物", level=2)
    add_bullets(doc, [
        "SBOM：交付时提供 CycloneDX/SPDX 格式 SBOM，列明组件、版本、许可证、来源与依赖关系。",
        "许可证扫描：CI 集成 license-checker/Trivy，默认阻断 GPL/AGPL/SSPL；确需使用须法务书面批准并隔离部署。",
        "开源义务：保留版权声明与 NOTICE；修改 AGPL 组件（如 Grafana）需按 AGPL 开源或采购商业授权。",
        "商业授权：Redis 7.4+/Redis 8、Grafana Enterprise、Langfuse EE、商业模型/字体/图库等需单独采购。",
        "第三方服务：模型、内容安全、TTS/ASR、视频、OCR 按客户账号实付，不转售、不垫资。",
        "交付清单：SBOM、许可证清单、第三方服务清单、合规说明、安全扫描报告。",
    ])

    # 5 Infrastructure
    doc.add_heading("五、推荐服务器、存储、数据库、中间件、网络与安全配置", level=1)
    doc.add_heading("5.1 生产推荐配置", level=2)
    add_note(doc, "按 3,000 注册用户、80 并发看板、500 并发测评提交、5 并发文档解析、500MB 单文件/2GB 知识源/300MB 批量估算；最终以压测和客户规模调整。")
    headers = ["用途", "规格", "数量", "说明"]
    rows = [
        ["SLB/Nginx", "4C8G，100Mbps，SSL", "2", "主备/双活"],
        ["Web（Next.js）", "4C8G，系统盘 200GB SSD", "2", "Portal/Console 可合并"],
        ["API（NestJS）", "8C32G，系统盘 200GB SSD", "2", "无状态，水平扩展"],
        ["Worker（任务/回调/解析编排）", "8C32G，数据盘 500GB SSD", "1—2", "文档解析/媒体编排；不含视频转码"],
        ["PostgreSQL", "8C32G，1TB SSD，主备", "2", "连接数 500；WAL 归档"],
        ["Redis/Valkey", "4C8G，50GB，主从/Sentinel", "2", "缓存/会话/任务唤醒"],
        ["对象存储", "5TB 标准 + 10TB 归档", "1 套", "S3/OSS/MinIO；多副本"],
        ["监控/日志", "4C8G，500GB SSD", "1", "Prometheus/Grafana/Loki/ELK 可选"],
        ["备份", "10TB", "1", "数据库/对象/配置；异地可选"],
        ["堡垒机/跳板", "2C4G", "1", "运维审计"],
        ["WAF/DDoS", "云 WAF + DDoS 高防", "1 套", "按云厂商"],
        ["GPU（可选）", "1×A10/L20 24G", "0—1", "仅本地推理/视频；优先外部 API"],
    ]
    add_table(doc, headers, rows, widths=[3.6, 6.0, 1.6, 5.4], font_size=8.5)

    doc.add_heading("5.2 存储、数据库与中间件", level=2)
    headers = ["项", "推荐", "说明"]
    rows = [
        ["数据库", "PostgreSQL 16 主备", "业务真源、RLS、JSONB、审计链、任务表"],
        ["连接池", "PgBouncer（可选）", "API 多实例时控制连接"],
        ["备份", "全量每日 + WAL 持续归档", "RPO ≤ 30 分钟，RTO ≤ 4 小时（按等级调整）"],
        ["对象存储", "OSS/COS/OBS/MinIO", "素材/视频/离线包/审计归档；生命周期转低频/归档"],
        ["缓存", "Redis/Valkey", "会话、权限、范围、任务唤醒；不存唯一真源"],
        ["文件", "对象存储 + CDN", "大文件分片、断点续传、签名 URL"],
        ["日志", "集中日志 + 审计表", "应用日志 180 天，审计/业务按合同 1—3 年"],
    ]
    add_table(doc, headers, rows, widths=[2.8, 5.8, 8.0], font_size=8.5)

    doc.add_heading("5.3 网络与安全", level=2)
    headers = ["项", "推荐配置"]
    rows = [
        ["网络", "DMZ/应用区/数据区/管理区隔离；SLB→应用→数据区最小放行"],
        ["边界", "WAF、DDoS、防火墙、IPS/IDS（可选）"],
        ["远程运维", "VPN/堡垒机，禁止公网直连数据库"],
        ["传输", "全站 HTTPS/TLS 1.2+；内部服务可选 mTLS"],
        ["身份", "SSO + MFA（可选）；服务令牌 + scope；会话吊销"],
        ["数据", "租户 RLS + 应用层数据范围；敏感字段脱敏；备份加密"],
        ["密钥", "KMS/Secrets Manager；不落明文；定期轮换"],
        ["审计", "登录/权限/生成/审批/导出/回调/配置全场景；哈希链 + checkpoint"],
        ["合规", "等保 2.0 三级目标；漏洞扫描、基线核查、渗透测试（可选）"],
        ["备份/容灾", "本地备份 + 异地/跨区副本；年度恢复演练"],
    ]
    add_table(doc, headers, rows, widths=[2.8, 13.8], font_size=8.5)

    doc.add_heading("5.4 云资源厂商与规格（如报云资源）", level=2)
    headers = ["云厂商", "计算", "数据库", "缓存", "对象存储", "负载/安全"]
    rows = [
        ["阿里云", "ECS g8i（8C32G）", "RDS PostgreSQL 16 高可用（8C32G）", "Tair/Redis 4C8G 主从", "OSS 5TB + CDN", "SLB、WAF、DDoS、云安全中心"],
        ["腾讯云", "CVM SA3（8C32G）", "TencentDB PostgreSQL 高可用（8C32G）", "Redis 4C8G 主从", "COS 5TB + CDN", "CLB、WAF、DDoS、云镜"],
        ["华为云", "ECS C7（8C32G）", "RDS PostgreSQL 高可用（8C32G）", "DCS Redis 4C8G 主从", "OBS 5TB + CDN", "ELB、WAF、DDoS、HSS"],
        ["私有化", "物理服务器/VMware（8C32G）", "PostgreSQL 主备", "Redis/Valkey 主从", "MinIO/Ceph 5TB", "F5/Nginx、WAF、堡垒机"],
    ]
    add_table(doc, headers, rows, widths=[1.8, 3.2, 3.6, 2.4, 2.8, 2.8], font_size=8.2)
    add_note(doc, "云资源按客户云账号实付 + 代维服务费；或客户自行采购。参考价（调研日期 2026-11-09）：阿里云 g8i 16C64G 包年包月约 1.57 万元/年/台（不含带宽/云盘，活动价）；8C32G 按同系列规格约为其 50%—60%，最终以云厂商账单为准。")

    # 6 Boundaries
    doc.add_heading("六、报价边界、假设与商务条款", level=1)
    doc.add_heading("6.1 包含范围", level=2)
    add_bullets(doc, [
        "平台 P0 核心：身份/SSO（1 套协议）、多角色/会话、审批/工作项、资产/上传、异步任务、通知、审计链、导入导出基础、指标基础、数据范围。",
        "教育垂直：课程/知识点、班级/学生、教学任务、学习中心、测评基础、规则推荐、徽章/评价、MP4 在线播放/轻量缓存（H5）；可靠离线播放不含。",
        "智能体：3 类核心智能体（课程设计/知识点提取/脚本分镜）+ 文档解析基础 + 生成任务编排。",
        "移动端：响应式 H5（教师/学生/管理端），iOS/Android 主流 5—6 台设备、2 轮兼容测试；不含原生 App/小程序。",
        "团队：项目经理、前端架构师、后端架构师、设计师、智能体架构师、Harness 工程师各 1 人；项目交付 217.5 人天，演示 5 人天另计。",
        "实施：90 日排期、1 生产 + 1 测试环境、数据初始化、培训、UAT、验收材料、1 年质保。",
        "演示：1 次彩排 + 1 次正式演示。",
    ])
    doc.add_heading("6.2 不包含/需第三方或客户提供", level=2)
    headers = ["项", "边界"]
    rows = [
        ["全量 6 类智能体", "本报价含 3 类核心；其余按增补报价"],
        ["视频生成/TTS/ASR/OCR/内容安全模型", "无自研；接第三方，费用单列"],
        ["可靠离线播放/DRM/多端播放器", "H5 仅含在线播放/轻量缓存；可靠离线需混合壳/App/小程序，另计"],
        ["原生 App（iOS/Android）/微信小程序", "不含；原生 App 约 +15—25 万/端，小程序约 +3—6 万；另见 3.6"],
        ["App 上架/推送/应用商店合规/开发者账号", "客户主体或另计；账号年费客户承担"],
        ["云真机/第三方设备池/老旧机型/鸿蒙 NEXT 专项", "H5 基础兼容测试已含；云真机/设备采购/专项适配按实计"],
        ["复杂推荐/向量检索/BI 设计器", "本期不做；可后置"],
        ["多数据源/多 SSO 协议/超过 10 个接口", "超出按增补报价"],
        ["超出 217.5 人天/缩短工期/6 人全职", "按变更单重新评估工期与费用"],
        ["客户 SSO/教务/人事/内网数据库", "客户提供协议、测试账号、只读账号、白名单"],
        ["云资源/模型账号/第三方服务", "客户采购或代采；不含在软件报价"],
        ["等保测评/渗透测试/云合规", "客户/测评机构主导；厂商配合整改"],
        ["源代码/二次销售/对外 SaaS 运营", "不在买断范围；另议"],
    ]
    add_table(doc, headers, rows, widths=[6.0, 10.6], font_size=8.8)

    doc.add_heading("6.3 关键假设", level=2)
    add_bullets(doc, [
        "需求在 D14 前冻结；后续变更走书面变更单，评估工期/费用。",
        "客户在 D1—D14 提供 SSO 协议/测试账号、教务/人事数据源、只读账号、网络白名单、模型/媒体 provider 账号。",
        "客户提供 1 套生产环境 + 1 套测试环境（或云账号），并配合等保/安全基线。",
        "客户提供 5—6 台主流 iOS/Android 测试设备或云真机账号；未提供由项目组代采，费用另计。",
        "原生 App/小程序需求需单独立项，不占用本期 217.5 人天。",
        "客户指定业务代表、UAT 人员、数据初始化责任人；UAT 周期不超过 8 个工作日。",
        "90 日为自然日；6 人核心团队按兼职投入测算；客户依赖延迟、需求变更、第三方联调延迟按顺延处理。",
        "本报价按人民币、6% 增值税；如税率/云厂商价格重大变化，双方另行协商。",
    ])
    doc.add_heading("6.4 售后与运维", level=2)
    add_bullets(doc, [
        "质保期 12 个月：缺陷修复、版本升级、远程支持、重大故障响应。",
        "响应级别：P1 30 分钟内响应、4 小时内恢复/规避；P2 2 小时内响应、1 个工作日内处理；P3 按计划。",
        "质保期后运维 8%/年 = 40,000 元/年（可选）：含远程支持、版本升级、巡检、告警优化；不含云资源/模型/第三方费用。",
        "培训：管理员/教师/运维 2—3 场，提供操作手册、运维手册、接口文档。",
    ])

    doc.add_heading("附录：调研来源与说明", level=1).paragraph_format.page_break_before = True
    add_note(doc, "调研日期：2026-11-09。以下仅用于许可证/规格核验，最终以官方最新条款与合同为准。")
    sources = [
        ("PostgreSQL License（官方）", "https://www.postgresql.org/about/licence/"),
        ("Next.js MIT License（官方仓库）", "https://github.com/vercel/next.js/blob/f69806d09f73fd52e56cc0e29a2ec5b3f556c5ec/license.md"),
        ("NestJS 官方文档（MIT）", "https://docs.nestjs.com/fundamentals/platform-agnosticism"),
        ("TypeORM MIT License（官方仓库）", "https://github.com/typeorm/typeorm/blob/52e5f7c3e275fad3f274e20570c7d6692855a640/LICENSE"),
        ("Redis RSALv2/SSPL 官方公告", "https://redis.io/blog/rsalv2-sspl-announcement.md"),
        ("Valkey 官方（BSD）", "https://valkey.io/"),
        ("Grafana AGPL-3.0（官方仓库）", "https://github.com/grafana/grafana/blob/main/LICENSE"),
        ("Promptfoo MIT（官方仓库）", "https://github.com/promptfoo/promptfoo/blob/main/LICENSE"),
        ("Langfuse MIT/EE（官方仓库）", "https://github.com/langfuse/langfuse/blob/main/LICENSE"),
        ("Playwright Apache-2.0（官方仓库）", "https://github.com/microsoft/playwright/blob/main/LICENSE"),
        ("阿里云 ECS g8i 规格/参考价（2026-10-28）", "https://developer.aliyun.com/article/1776648"),
        ("等保 2.0 三级要求（参考）", "https://www.51dns.com/news/9261.html"),
        ("软件著作权登记材料（中国版权保护中心/北京政务服务）", "https://invest.beijing.gov.cn/sy/zt/qyrx/202604/t20260428_4620302.html"),
    ]
    for title, url in sources:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run("• " + title + "：")
        set_cn_font(r, size=7.5, bold=True)
        r = p.add_run(url)
        set_cn_font(r, size=7, color=COLOR_ACCENT)

    for p in doc.paragraphs:
        if p.style.name == "Heading 1" and p.text.startswith(("一、", "三、", "六、")):
            p.paragraph_format.page_break_before = True

    doc.save(OUT)
    print("saved", OUT, os.path.getsize(OUT))


if __name__ == "__main__":
    main()
