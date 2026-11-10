from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image, ImageDraw, ImageFont
import os

OUT = "/Users/mac/Sync/project/sapbase/docs/教育智能体项目报价与实施方案_70万.docx"
DIAGRAM = "/Users/mac/Sync/project/sapbase/docs/_quote_architecture.png"

FONT_CN = "微软雅黑"
COLOR_DARK = RGBColor(0x1F, 0x3A, 0x5F)
COLOR_GRAY = RGBColor(0x59, 0x59, 0x59)
COLOR_ACCENT = RGBColor(0x1F, 0x6F, 0xB2)
HEADER_FILL = "1F3A5F"
LIGHT_FILL = "EAF2F8"
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
        cell_text(hdr.cells[i], h, bold=True, size=font_size, color=RGBColor(0xFF,0xFF,0xFF))
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
            for row in table.rows:
                row.cells[i].width = Cm(w)
    return table

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
    fldChar1 = OxmlElement("w:fldChar"); fldChar1.set(qn("w:fldCharType"), "begin")
    instrText = OxmlElement("w:instrText"); instrText.set(qn("xml:space"), "preserve"); instrText.text = "PAGE"
    fldChar2 = OxmlElement("w:fldChar"); fldChar2.set(qn("w:fldCharType"), "end")
    run._r.append(fldChar1); run._r.append(instrText); run._r.append(fldChar2)
    set_cn_font(run, size=9, color=COLOR_GRAY)

def make_diagram(path):
    W, H = 1800, 1000
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    font_path = "/System/Library/Fonts/PingFang.ttc"
    if not os.path.exists(font_path):
        font_path = "/System/Library/Fonts/STHeiti Light.ttc"
    def f(size): return ImageFont.truetype(font_path, size)
    def box(x,y,w,h,title,body,fill):
        d.rounded_rectangle([x,y,x+w,y+h], radius=18, fill=fill, outline="#1F3A5F", width=2)
        d.text((x+18,y+12), title, font=f(26), fill="#1F3A5F")
        d.multiline_text((x+18,y+55), body, font=f(20), fill="#333333", spacing=8)
    def arrow(x1,y1,x2,y2):
        d.line([x1,y1,x2,y2], fill="#1F6FB2", width=5)
        d.ellipse([x2-7,y2-7,x2+7,y2+7], fill="#1F6FB2")
    box(60,40,520,150,"用户与终端","教师 / 学生 / 管理人员\nPC / H5 / 移动端", "#EAF2F8")
    box(660,40,480,150,"接入层","CDN / WAF / SLB / Nginx\nHTTPS · WebSocket · SSE", "#D6EAF8")
    box(1240,40,500,150,"前端应用","web-portal（教师/学生）\nweb-console（管理/治理）", "#EAF2F8")
    box(60,300,520,190,"API 应用层","NestJS 模块化单体\n认证/租户/权限/业务编排\nOpenAPI · RBAC · 数据范围", "#D6EAF8")
    box(660,300,480,190,"异步与集成","PG Jobs + Worker\nRedis 唤醒 · 重试/DLQ\n外部回调 · 连接器", "#EAF2F8")
    box(1240,300,500,190,"智能体与内容","Agent Runtime · 工具契约\n模型网关 · 文档解析\n内容安全 · 生成标识", "#D6EAF8")
    box(60,590,520,170,"数据层","PostgreSQL 16（真源/RLS）\nRedis/Valkey（缓存/会话）", "#EAF2F8")
    box(660,590,480,170,"存储层","对象存储 S3/OSS/MinIO\n素材/视频/离线包/审计归档", "#D6EAF8")
    box(1240,590,500,170,"外部服务","模型 / TTS / 视频 / OCR\n内容安全 / 短信 / SSO", "#EAF2F8")
    box(60,820,1680,120,"可观测与安全","日志 · 指标 · 链路 · 审计哈希链 · checkpoint · 告警 · 备份 · 密钥管理 · 等保配合", "#F4F6F7")
    arrow(580,115,660,115); arrow(1140,115,1240,115)
    arrow(310,190,310,300); arrow(900,190,900,300); arrow(1490,190,1490,300)
    arrow(580,395,660,395); arrow(1140,395,1240,395)
    arrow(310,490,310,590); arrow(900,490,900,590); arrow(1490,490,1490,590)
    arrow(580,675,660,675); arrow(1140,675,1240,675)
    arrow(310,760,310,820); arrow(900,760,900,820); arrow(1490,760,1490,820)
    img.save(path)

def main():
    make_diagram(DIAGRAM)
    doc = Document()
    doc.core_properties.title = "教育智能体项目报价与实施方案（一期）"
    doc.core_properties.author = "项目交付团队"
    doc.core_properties.subject = "教育内容生产运营、智能体应用、学习服务；报价约 70 万元"
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

    # Header/footer
    hp = section.header.paragraphs[0]
    hp.text = "教育智能体项目报价与实施方案（一期）"
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_cn_font(hp.runs[0], size=9, color=COLOR_GRAY)
    fp = section.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = fp.add_run("第 "); set_cn_font(r, size=9, color=COLOR_GRAY)
    add_page_number(fp)
    r = fp.add_run(" 页"); set_cn_font(r, size=9, color=COLOR_GRAY)

    # Cover
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(90)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("教育智能体项目"); set_cn_font(r, size=30, bold=True, color=COLOR_DARK)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("报价与实施方案"); set_cn_font(r, size=30, bold=True, color=COLOR_DARK)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("（一期 / 标准版）"); set_cn_font(r, size=16, color=COLOR_ACCENT)
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(26)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("—— 内容生产运营 · 智能体应用 · 学习服务 ——"); set_cn_font(r, size=11, color=COLOR_GRAY)
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(110)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("报价金额：¥698,000.00（含税）"); set_cn_font(r, size=16, bold=True, color=RGBColor(0xB0,0x3A,0x2E))
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("大写：陆拾玖万捌仟元整"); set_cn_font(r, size=11, color=COLOR_GRAY)
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(60)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("版本：V1.0    日期：2026 年 11 月"); set_cn_font(r, size=10.5, color=COLOR_GRAY)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("本文件仅供商务评估使用，未经书面许可不得复制、转发或披露给第三方"); set_cn_font(r, size=8.5, color=COLOR_GRAY)
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

    doc.add_heading("一、报价说明与报价表", level=1)
    doc.add_heading("1.1 报价口径", level=2)
    add_bullets(doc, [
        "本报价为一期/标准版总价，含 6% 增值税，币种为人民币。",
        "人力投入按 90 个日历日、约 65 个工作日折算；含项目管理、产品、设计、开发、AI、测试、DevOps、安全与实施培训。",
        "平台软件授权费单列，采用私有化买断方式；首年维保/升级包含在总价内，次年起运维服务费可选。",
        "云资源、模型调用、内容安全、TTS/ASR、视频生成/转码、短信等第三方费用不含在总价内，按客户账号实付或代采。",
        "本报价覆盖一期核心范围；全量 6 类智能体、复杂视频生成、完整离线 SDK、多数据源集成等按增补报价。",
    ])

    doc.add_heading("1.2 初步报价表", level=2)
    headers = ["模块", "人力投入", "一次性费用（元，含税）", "周期性费用（元，含税）", "说明"]
    rows = [
        ["A 教育内容生产与运营管理", "150 人天\n（约 2.3 人 × 65 工作日）", "258,000", "0", "课程/知识结构、素材、内容生产、审核发布、教学任务、教师工作台、基础看板；平台能力复用"],
        ["B 教学内容生成智能应用", "75 人天\n（约 1.2 人）", "150,000", "0", "3 类核心智能体 + 文档解析基础 + 生成任务编排；模型/媒体费用另计"],
        ["C 学习服务智能应用", "65 人天\n（约 1.0 人）", "110,000", "0", "学习中心、视频播放、学习记录、测评基础、规则推荐、徽章/评价、MP4 离线基础"],
        ["D 系统集成与数据对接", "35 人天\n（约 0.5 人）", "70,000", "0", "1 套 SSO 协议、1 个教务/人事数据源、10 个接口、3 轮联调；超出另计"],
        ["E 实施、部署、测试与验收", "30 人天\n（约 0.5 人）", "50,000", "0", "90 日排期、1 生产 + 1 测试环境、数据初始化、培训、UAT、验收材料"],
        ["A—E 小计", "355 人天", "638,000", "0", "—"],
        ["平台软件授权费（买断）", "—", "50,000", "首年 0；次年起 55,840/年（可选）", "私有化部署；1 生产 + 1 测试；见 1.3 授权限制"],
        ["真实产品/项目能力演示支持", "5 人天", "10,000", "0", "演示环境、账号、样例数据、设备、1 次彩排 + 1 次正式演示"],
        ["合计", "360 人天", "698,000", "0（首年）；次年起可选 55,840/年", "含 6% 增值税；云资源/模型/第三方不含"],
    ]
    table = add_table(doc, headers, rows, widths=[3.0, 2.6, 3.0, 2.8, 5.0], font_size=8.5)
    for idx in [5, 8]:
        for c in table.rows[idx].cells:
            shade(c, TOTAL_FILL)
            for p in c.paragraphs:
                for r in p.runs:
                    r.bold = True

    doc.add_heading("1.3 平台授权与容量限制", level=2)
    add_bullets(doc, [
        "授权方式：私有化买断使用权，1 个生产环境 + 1 个测试环境；不含源代码、二次销售权、对外 SaaS 运营权。",
        "用户/并发：5,000 注册用户；100 并发在线；1,000 并发测评提交/日；10 并发文档解析。",
        "容量：10TB 对象存储；单文件 1GB；单次知识源 5GB；批量导入 800MB。",
        "设备/调用：不限制终端设备数量；离线包设备绑定默认 3 台/用户（可配置）；平台 API 默认 100 万次/月，模型调用按第三方配额。",
        "部署环境：客户自有/云上单租户环境；多租户 SaaS、集团多法人、跨地域多活需另签授权与扩容。",
        "超出限制：按用户数/并发/存储/调用量阶梯扩容，或按实际资源代采；不在本报价内。",
        "质保期：验收后 12 个月，含缺陷修复、版本升级、远程支持；次年起运维服务费按合同总额 8%/年（可选）。",
    ])

    doc.add_heading("1.4 分项人力明细", level=2)
    headers = ["模块", "主要工作内容", "人天", "综合单价（元/人天）", "一次性费用（元）", "说明"]
    rows = [
        ["A", "课程/知识结构、素材、内容生产、审核发布、教学任务、教师工作台、基础看板", "150", "1,720", "258,000", "含产品/设计/前后端/测试分摊"],
        ["B", "3 类智能体、文档解析基础、生成任务编排、内容安全接入", "75", "2,000", "150,000", "含 AI/后端/前端分摊"],
        ["C", "学习中心、视频、学习记录、测评基础、规则推荐、徽章/评价、MP4 离线", "65", "1,692", "110,000", "含前后端/测试分摊"],
        ["D", "SSO、教务/人事数据源、10 个接口、3 轮联调、对账", "35", "2,000", "70,000", "超出接口/数据源另计"],
        ["E", "项目管理、环境、部署、数据初始化、培训、UAT、验收", "30", "1,667", "50,000", "含实施/DevOps/安全分摊"],
        ["演示", "演示环境、账号、样例数据、设备、彩排/正式演示", "5", "2,000", "10,000", "1 次彩排 + 1 次正式"],
        ["合计", "—", "360", "—", "648,000", "平台授权 50,000，总计 698,000"],
    ]
    add_table(doc, headers, rows, widths=[1.2, 5.6, 1.2, 2.6, 2.8, 3.0], font_size=8.5)

    doc.add_heading("1.5 付款与商务", level=2)
    add_bullets(doc, [
        "合同签订后 30% 预付款；平台基础能力验收（M2）后 30%；UAT 通过（M5）后 30%；验收/移交（M6）后 10%。",
        "报价有效期：自报价日起 30 个日历日；汇率/税率/云厂商价格重大变化时双方另行协商。",
        "交付周期：合同生效且客户依赖项（SSO、数据源、环境、provider 账号）就绪后 90 个日历日。",
        "质保期：验收后 12 个月；质保期后运维服务 8%/年（可选），不含云资源/模型/第三方费用。",
        "知识产权：定制部分使用权归客户；平台基座、通用组件、Agent Runtime、工具链等既有知识产权归厂商；源代码/二次销售/外包托管另议。",
    ])


    doc.add_heading("二、拟投入团队、角色分工、核心成员履历与 90 日排期", level=1)
    doc.add_heading("2.1 团队清单", level=2)
    add_note(doc, "按 90 个日历日、约 65 个工作日折算；平均约 5.5 FTE，峰值 8—9 人；总人力约 360 人天。")
    headers = ["角色", "人数/投入", "约人天", "主要职责", "关键交付物"]
    rows = [
        ["交付经理 / 项目经理", "0.35 FTE", "22", "范围、进度、风险、客户接口、验收", "计划、周报、风险台账、验收报告"],
        ["首席架构师 / 技术负责人", "0.20 FTE", "13", "总体架构、关键设计、技术评审", "架构方案、接口规范、评审记录"],
        ["产品经理 / 教育业务分析", "0.45 FTE", "29", "需求、流程、原型、验收口径", "需求规格、流程/原型、验收清单"],
        ["UI/UX 设计", "0.20 FTE", "13", "管理端/教师端/学生端/移动适配", "设计规范、页面稿、组件规范"],
        ["后端工程师（平台）", "1.00 FTE", "65", "身份/权限、审批、资产、任务、通知、审计、集成", "平台服务、API、迁移、单测"],
        ["后端工程师（业务/集成）", "0.80 FTE", "52", "课程/知识点、教学任务、学习记录、测评、数据同步", "教育业务服务、联调记录"],
        ["前端工程师", "1.00 FTE", "65", "管理端、教师端、学生端、H5、可视化", "页面、组件、前端测试"],
        ["AI / Agent 工程师", "0.50 FTE", "33", "内容生成、文档解析、Agent 编排、模型接入", "Agent 应用、工具链、评测记录"],
        ["测试工程师", "0.50 FTE", "33", "功能、接口、权限、性能、安全、验收", "测试计划、缺陷报告、验收证据"],
        ["DevOps / SRE", "0.15 FTE", "10", "环境、CI/CD、监控、日志、备份、发布", "环境清单、部署手册、监控看板"],
        ["安全 / 合规", "0.10 FTE", "7", "权限、隔离、审计、内容安全、等保配合", "安全清单、整改记录"],
        ["实施 / 培训", "0.28 FTE", "18", "数据初始化、培训、上线支持、移交", "培训材料、上线记录、移交清单"],
        ["合计", "约 5.5 FTE", "360", "—", "—"],
    ]
    add_table(doc, headers, rows, widths=[3.2, 2.2, 1.4, 5.6, 4.0], font_size=8.5)

    doc.add_heading("2.2 角色分工（RACI）", level=2)
    headers = ["工作包", "负责（R）", "审批（A）", "协作（C）", "知会（I）"]
    rows = [
        ["项目管理与验收", "项目经理", "交付经理", "客户项目经理", "全体"],
        ["总体架构与接口", "首席架构师", "交付经理", "前后端/AI/客户 IT", "项目经理"],
        ["内容生产与运营", "产品经理、业务后端", "项目经理", "前端、AI、客户教研", "交付经理"],
        ["智能体应用", "AI 负责人", "首席架构师", "后端、前端、客户业务", "项目经理"],
        ["身份/SSO/权限", "平台后端", "首席架构师", "客户 IT、安全", "项目经理"],
        ["审批/工作项", "平台后端", "产品经理", "前端、客户业务", "项目经理"],
        ["资产/媒体", "平台后端、AI", "首席架构师", "前端、媒体 provider", "项目经理"],
        ["异步任务/回调", "平台后端", "首席架构师", "集成、外部系统", "项目经理"],
        ["导入导出/集成", "业务后端", "首席架构师", "客户 IT、数据源厂商", "项目经理"],
        ["通知/公告", "平台后端", "产品经理", "前端、客户运营", "项目经理"],
        ["审计/安全", "平台后端、安全", "交付经理", "客户安全、运维", "项目经理"],
        ["指标/看板", "数据工程师（兼）", "产品经理", "前端、客户业务", "交付经理"],
        ["测试/验收", "测试负责人", "项目经理", "全体、客户", "交付经理"],
        ["部署/上线", "DevOps", "首席架构师", "客户运维、安全", "项目经理"],
    ]
    add_table(doc, headers, rows, widths=[3.6, 3.0, 2.6, 4.4, 2.8], font_size=8.5)

    doc.add_heading("2.3 核心成员履历（脱敏）", level=2)
    add_note(doc, "以下为拟任核心岗位画像；实名简历、学历/证书、项目证明、劳动关系或劳务协议在商务确认后提供。")
    profiles = [
        ("核心成员 A｜交付经理 / 项目经理", "15 年以上 IT 交付，8 年以上教育/政务/大型平台项目管理；PMP/Prince2 体系；负责总体计划、里程碑、风险、客户接口、验收与移交。"),
        ("核心成员 B｜首席架构师 / 技术负责人", "15 年以上架构与研发，10 年以上分布式/多租户平台；NestJS/Node.js、PostgreSQL、Redis、RLS、SSO、审计与高可用；负责总体架构与关键设计评审。"),
        ("核心成员 C｜平台后端负责人", "10 年以上后端研发，6 年以上平台化/中台；TypeScript/NestJS、TypeORM、审批/任务/资产/审计链；负责身份、审批、资产、任务、通知、审计服务。"),
        ("核心成员 D｜业务后端 / 集成负责人", "9 年以上后端与系统集成，5 年以上教育/政企数据对接；REST/JSON、数据库只读、ETL/同步、对账、重试；负责课程/教学/学习业务与外部联调。"),
        ("核心成员 E｜前端负责人", "9 年以上前端，6 年以上中后台/教育产品；React/Next.js、TypeScript、可视化、H5/移动适配；负责管理端、教师端、学生端与前端质量。"),
        ("核心成员 F｜AI / Agent 负责人", "8 年以上 AI 应用/平台，5 年以上 LLM/Agent 工程化；Agent 编排、工具调用、RAG/文档解析、模型网关、内容安全与标识；负责内容生产/学习服务智能体。"),
    ]
    for title, body in profiles:
        p = doc.add_paragraph()
        r = p.add_run(title); set_cn_font(r, size=10.5, bold=True, color=COLOR_DARK)
        p = doc.add_paragraph(body)
        p.paragraph_format.left_indent = Cm(0.3)
        for r in p.runs: set_cn_font(r, size=9.5)

    doc.add_heading("2.4 90 日初步实施排期", level=2)
    headers = ["阶段", "时间", "目标", "主要工作", "里程碑"]
    rows = [
        ["P0 启动与冻结", "D1—D14\nW1—W2", "范围、环境、依赖就绪", "kickoff、需求澄清、架构/接口规范、环境与账号、SSO/教务/媒体 provider 确认、Blueprint 骨架、数据范围节点配置、CI/CD", "M1：D14 需求冻结/环境就绪"],
        ["P1 平台基础", "D15—D35\nW3—W5", "平台核心可用", "身份/SSO、多角色/会话、审批/工作项、资产/上传、异步任务、通知、审计链、导入导出基础；课程/知识点/班级骨架", "M2：D35 平台基础可用"],
        ["P2 业务与智能体", "D36—D56\nW6—W8", "主业务链路跑通", "内容生成、文档解析、审核发布、教学任务、学习服务、测评/判分、推荐、指标看板、集成连接器、AI 治理", "M3：D56 内容生产/学习服务主链路"],
        ["P3 集成与硬化", "D57—D77\nW9—W11", "联调、性能、安全", "外部系统联调、数据同步/对账、移动/H5、离线包、权限/范围负例、性能压测、安全整改、UAT 准备", "M4：D77 集成/性能/安全完成"],
        ["P4 验收与上线", "D78—D90\nW12—W13", "UAT、上线、移交", "UAT、缺陷修复、验收证据、培训、上线、运维移交、复盘", "M5：D85 UAT 通过；M6：D90 上线/移交"],
    ]
    add_table(doc, headers, rows, widths=[2.2, 2.0, 2.8, 6.4, 3.0], font_size=8.5)

    doc.add_heading("2.5 周排期与关键依赖", level=2)
    headers = ["周", "日期", "平台/架构", "教育业务", "智能体/AI", "测试/交付"]
    rows = [
        ["W1", "D1—D7", "kickoff、架构、环境、CI/CD", "需求澄清、流程/原型", "模型/内容安全 provider 确认", "测试策略、验收口径"],
        ["W2", "D8—D14", "接口规范、数据范围、Blueprint 骨架", "课程/知识点/班级模型", "文档解析/生成任务设计", "需求冻结、M1"],
        ["W3", "D15—D21", "身份/SSO、多角色、会话", "课程管理、素材上传", "Agent 定义/工具契约", "单测/接口测试"],
        ["W4", "D22—D28", "审批/工作项、通知", "内容审核发布、教师工作台", "内容生成任务、资产回写", "权限/范围测试"],
        ["W5", "D29—D35", "审计链、异步任务、导入导出基础", "教学任务、班级学生", "生成任务状态/回调", "平台基础验收、M2"],
        ["W6", "D36—D42", "集成连接器、指标基础", "学习记录、测评", "文档解析、知识结构", "集成测试"],
        ["W7", "D43—D49", "指标看板、预警", "学习中心、错题/反馈", "学习服务智能体、推荐", "性能基线"],
        ["W8", "D50—D56", "通知/公告完善、审计查询", "课程评价、徽章", "AI 治理/内容标识/终审", "主链路 UAT、M3"],
        ["W9", "D57—D63", "外部系统联调、数据同步", "教务/身份数据对账", "视频/语音/TTS 联调", "联调测试"],
        ["W10", "D64—D70", "权限/范围负例、审计导出", "移动/H5 适配", "离线包/播放", "安全/权限测试"],
        ["W11", "D71—D77", "性能优化、监控告警", "专题页/看板下钻", "生成性能/失败重试", "压测、M4"],
        ["W12", "D78—D84", "缺陷修复、上线演练", "UAT 业务验证", "生成质量/内容安全复核", "UAT"],
        ["W13", "D85—D90", "上线、运维移交", "培训、数据初始化", "生产验证", "验收、M5/M6"],
    ]
    add_table(doc, headers, rows, widths=[1.0, 1.8, 3.6, 3.2, 3.6, 3.2], font_size=8)


    doc.add_heading("三、产品能力清单、技术方案、部署架构、接口方案与验收思路", level=1)
    doc.add_heading("3.1 产品能力清单", level=2)
    headers = ["模块", "产品能力", "来源", "说明"]
    rows = [
        ["A 教育内容生产与运营", "课程/章节/知识点、课程状态/版本、素材上传/封面、内容生成、审核发布、教学任务、教师工作台、基础看板、身份权限、数据对接", "平台复用 + 教育垂直", "课程/知识点/班级/教学任务为 Blueprint；资产/审批/通知/审计/指标/导入导出复用平台"],
        ["B 内容生成智能应用", "3 类核心智能体（课程设计/知识点提取/脚本分镜）、文档解析基础、生成任务、调用统计、内容安全/复核", "Agent Runtime + 垂直 + 第三方", "视频生成/TTS/ASR 不自研，接 provider"],
        ["C 学习服务智能应用", "学习中心、视频播放、学习记录/日历、测评基础、规则推荐、徽章/评价、MP4 离线、数据隔离", "教育垂直 + 平台", "移动 H5/小程序/App 按客户选择；完整离线 SDK 后置"],
        ["D 系统集成与数据对接", "1 套 SSO、1 个教务/人事数据源、10 个接口、任务回调、同步/对账", "平台集成 + 客户系统", "客户提供协议、测试账号、只读账号、白名单"],
        ["E 实施与验收", "90 日排期、1 生产 + 1 测试、数据初始化、培训、UAT、验收证据、运维移交", "实施服务", "客户依赖延迟按变更/顺延"],
        ["演示支持", "演示环境、账号、样例课程/知识点/生成/审批/看板/学生端、设备、彩排", "实施服务", "1 次彩排 + 1 次正式"],
    ]
    add_table(doc, headers, rows, widths=[2.8, 6.6, 2.8, 4.2], font_size=8.5)

    doc.add_heading("3.2 初步技术方案", level=2)
    add_bullets(doc, [
        "总体架构：Nx 模块化单体 + 可拆分部署单元；Next.js 15 前端、NestJS 10 API、PostgreSQL 16、Redis/Valkey、对象存储、Worker。",
        "多租户：organizationId + PostgreSQL RLS；应用层再执行数据范围（课程/班级/组织树）。",
        "四维权限：菜单/功能（RBAC）、数据（scope）、资源（课程/班级节点）、字段（field permissions）。",
        "审批：机器检测 pass/fail/warn；warn 必须人工确认；驳回重提新 round；发布前整体 approved 闸门。",
        "异步：PG jobs + Redis 唤醒；至少一次 + 幂等；外部回调 HMAC + SSRF 防护；DLQ/重放。",
        "资产：上传会话、分片/断点续传、病毒扫描、图片/文档/视频变体、签名 URL、ready 才可下载。",
        "审计：append-only 哈希链、checkpoint 签名、归档/保留期、break-glass 留痕。",
        "内容安全：机器初审 + 人工终审 + 生成内容标识；标识在下载/离线/分享/导出/转码保留。",
        "发布：Blueprint 版本、灰度/激活/回退；发布进程与运行版本分离。",
    ])

    doc.add_heading("3.3 部署架构", level=2)
    doc.add_picture(DIAGRAM, width=Cm(16.6))
    doc.add_paragraph().alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.paragraphs[-1]
    r = p.add_run("图 1  逻辑架构示意（默认生产形态）"); set_cn_font(r, size=8.5, color=COLOR_GRAY)
    add_bullets(doc, [
        "默认生产：CDN/WAF → SLB/Nginx → Next.js（2 实例）+ NestJS API（2—3 实例）→ PostgreSQL 主备、Redis 主从/Sentinel、对象存储、Worker。",
        "网络分区：DMZ / 应用区 / 数据区 / 管理区 / 外部区；数据库仅应用区与堡垒机可达。",
        "高可用：API/Web 无状态水平扩展；PG 主备/只读副本；Redis Sentinel/Cluster；对象存储多副本；Worker 按队列拆分。",
        "发布：灰度/蓝绿；数据库迁移向前兼容；按镜像/发布版本回退。",
    ])

    doc.add_heading("3.4 接口方案", level=2)
    headers = ["接口类型", "协议/格式", "认证", "说明"]
    rows = [
        ["业务 REST", "HTTPS + JSON，OpenAPI 3", "JWT + 组织上下文 + RBAC/数据范围", "统一信封 {code,msg,data,rows,total}；固定错误码"],
        ["实时通知", "WebSocket（Socket.IO）", "JWT 握手", "通知、未读、任务进度"],
        ["任务事件", "SSE / 轮询", "JWT", "afterSeq 回放、断线重连"],
        ["外部回调", "HTTPS POST JSON", "HMAC-SHA256 + timestamp", "2xx 成功；408/429/5xx 重试；禁重定向/私网"],
        ["SSO", "CAS / OAuth2 / OIDC / SAML", "协议标准", "state/nonce/PKCE/签名/时间窗；失败 fail-closed"],
        ["教务/人事", "REST/JSON、数据库只读、文件", "服务令牌/只读账号", "字段映射、增量/全量、重试、对账"],
        ["开放 API", "REST/OpenAPI", "服务令牌 + scope", "代用户调用服务端二次解析权限/范围"],
        ["导入导出", "CSV/XLSX/JSON/PDF/MD", "JWT + 权限", "异步任务、进度、错误行定位、幂等"],
    ]
    add_table(doc, headers, rows, widths=[2.4, 4.2, 3.8, 6.0], font_size=8.5)
    add_note(doc, "接口约定：写接口支持 Idempotency-Key/业务幂等键；外部系统提供测试环境、测试账号、字段字典、错误码、限流/配额；联调至少 3 轮。")

    doc.add_heading("3.5 验收思路", level=2)
    headers = ["验收层", "内容", "证据"]
    rows = [
        ["需求覆盖", "需求 → 功能/接口/页面/测试用例追踪矩阵", "追踪矩阵、演示录屏"],
        ["功能验收", "课程/内容/生成/审核/教学/学习/测评/推荐/离线/看板", "操作记录、截图、UAT 签字"],
        ["接口验收", "SSO、教务、数据同步、回调、幂等、重试、对账", "联调记录、回调日志、对账报告"],
        ["权限/隔离", "跨租户、跨班级、越权审批、数据范围、字段权限", "负例测试报告、RLS/范围证据"],
        ["性能", "100 并发看板 <5s、1000 并发测评提交、10 并发解析、1GB 文件/5GB 知识源/800MB 批量", "压测报告、监控截图"],
        ["安全", "登录/权限/审计/内容安全/生成标识/漏洞扫描/等保配合", "扫描报告、整改记录、审计导出"],
        ["审计", "全场景操作、哈希链验证、归档/保留", "审计查询、验证 API、归档清单"],
        ["交付", "代码/镜像、部署手册、接口文档、运维手册、培训", "交付清单、培训签到、移交确认"],
    ]
    add_table(doc, headers, rows, widths=[2.8, 7.0, 6.0], font_size=8.5)
    add_note(doc, "验收门：M1 需求冻结、M2 平台基础、M3 主链路、M4 集成/性能/安全、M5 UAT、M6 上线移交。未过门不进入下一阶段。")


    doc.add_heading("四、软件著作权、信息安全资质与组件清单", level=1)
    doc.add_heading("4.1 软件著作权与资质", level=2)
    add_note(doc, "以下为投标/合同附件应提供项；实际证书名称、登记号、有效期以投标主体附件为准；未取得的写“无”，不虚构。")
    headers = ["类别", "证书/资质", "状态/提供方式"]
    rows = [
        ["软件著作权", "平台基座（多租户/权限/审计/任务）", "提供证书或登记受理证明"],
        ["软件著作权", "教育内容生产与运营管理平台", "本项目可申请/登记，证书以实际为准"],
        ["软件著作权", "教育智能体应用（内容生产/学习服务）", "本项目可申请/登记，证书以实际为准"],
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
    add_table(doc, headers, rows, widths=[2.8, 8.0, 5.0], font_size=8.5)

    doc.add_heading("4.2 开源组件与许可证", level=2)
    add_note(doc, "版本以交付 SBOM 为准；核心代码不使用 GPL/AGPL/SSPL 类强传染组件；Redis 7.4+ 许可证变化需按部署方式确认。")
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
        ["API 文档", "Swagger/OpenAPI", "Apache-2.0", "接口文档"],
        ["校验", "class-validator、JSON Schema", "MIT", "DTO/Schema 校验"],
        ["认证", "passport-jwt、bcrypt", "MIT", "JWT/密码哈希"],
        ["导入导出", "PapaParse", "MIT", "CSV"],
        ["构建", "Nx 24", "MIT", "Monorepo"],
        ["测试", "Jest、Supertest", "MIT", "单测/接口测试"],
        ["容器", "Docker、Kubernetes（可选）", "Apache-2.0", "部署/编排"],
        ["监控", "OpenTelemetry/Prometheus/Grafana（可选）", "Apache-2.0", "可观测"],
    ]
    add_table(doc, headers, rows, widths=[2.4, 5.2, 3.6, 5.2], font_size=8.2)

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
        ["SSO/身份", "客户 CAS/OIDC/SAML、企业微信/钉钉（可选）", "统一登录", "客户提供", "不含"],
        ["模型训练/微调", "无", "不做模型训练/微调", "无", "无"],
        ["视频生成算法", "无", "不自研，接第三方", "无", "无"],
        ["内容安全模型", "无", "不自研，接第三方", "无", "无"],
    ]
    add_table(doc, headers, rows, widths=[2.6, 5.0, 4.0, 2.6, 2.2], font_size=8.2)


    doc.add_heading("五、推荐服务器、存储、数据库、中间件、网络与安全配置", level=1)
    doc.add_heading("5.1 生产推荐配置", level=2)
    add_note(doc, "按 500—1,000 注册用户、100 并发看板、1,000 并发测评提交、10 并发文档解析、1GB 单文件/5GB 知识源/800MB 批量估算；最终以压测和客户规模调整。")
    headers = ["用途", "规格", "数量", "说明"]
    rows = [
        ["SLB/Nginx", "4C8G，100Mbps，SSL", "2", "主备/双活"],
        ["Web（Next.js）", "8C16G，系统盘 200GB SSD", "2", "Portal/Console 可合并"],
        ["API（NestJS）", "16C64G，系统盘 200GB SSD", "2—3", "无状态，水平扩展"],
        ["Worker（任务/回调/解析编排）", "16C64G，数据盘 500GB SSD", "1—2", "文档解析/媒体编排；不含视频转码"],
        ["PostgreSQL", "16C64G，2TB SSD，主备", "2", "连接数 1,000；WAL 归档"],
        ["Redis/Valkey", "8C16G，100GB，主从/Sentinel", "2", "缓存/会话/任务唤醒"],
        ["对象存储", "10TB 标准 + 20TB 归档", "1 套", "S3/OSS/MinIO；多副本"],
        ["监控/日志", "8C16G，1TB SSD", "1", "Prometheus/Grafana/Loki/ELK 可选"],
        ["备份", "20TB", "1", "数据库/对象/配置；异地可选"],
        ["堡垒机/跳板", "4C8G", "1", "运维审计"],
        ["WAF/DDoS", "云 WAF + DDoS 高防", "1 套", "按云厂商"],
        ["GPU（可选）", "1×A10/L20 24G", "0—1", "仅本地推理/视频；优先外部 API"],
    ]
    add_table(doc, headers, rows, widths=[3.6, 5.6, 1.6, 5.6], font_size=8.5)

    doc.add_heading("5.2 存储、数据库与中间件", level=2)
    headers = ["项", "推荐", "说明"]
    rows = [
        ["数据库", "PostgreSQL 16 主备", "业务真源、RLS、JSONB、审计链、任务表"],
        ["连接池", "PgBouncer（可选）", "API 多实例时控制连接"],
        ["备份", "全量每日 + WAL 持续归档", "RPO ≤ 15 分钟，RTO ≤ 2 小时（按等级调整）"],
        ["对象存储", "OSS/COS/OBS/MinIO", "素材/视频/离线包/审计归档；生命周期转低频/归档"],
        ["缓存", "Redis/Valkey", "会话、权限、范围、任务唤醒；不存唯一真源"],
        ["文件", "对象存储 + CDN", "大文件分片、断点续传、签名 URL"],
        ["日志", "集中日志 + 审计表", "应用日志 180 天，审计/业务按合同 1—3 年"],
    ]
    add_table(doc, headers, rows, widths=[2.8, 5.8, 7.8], font_size=8.5)

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
    add_table(doc, headers, rows, widths=[2.8, 13.6], font_size=8.5)

    doc.add_heading("5.4 云资源厂商与规格（如报云资源）", level=2)
    headers = ["云厂商", "计算", "数据库", "缓存", "对象存储", "负载/安全"]
    rows = [
        ["阿里云", "ECS g8i（16C64G）", "RDS PostgreSQL 16 高可用", "Tair/Redis 集群", "OSS + CDN", "SLB、WAF、DDoS、云安全中心"],
        ["腾讯云", "CVM SA3（16C64G）", "TencentDB PostgreSQL 高可用", "Redis 集群", "COS + CDN", "CLB、WAF、DDoS、云镜"],
        ["华为云", "ECS C7（16C64G）", "RDS PostgreSQL 高可用", "DCS Redis", "OBS + CDN", "ELB、WAF、DDoS、HSS"],
        ["私有化", "物理服务器/VMware", "PostgreSQL 主备", "Redis/Valkey", "MinIO/Ceph", "F5/Nginx、WAF、堡垒机"],
    ]
    add_table(doc, headers, rows, widths=[1.8, 3.0, 3.4, 2.4, 2.8, 3.0], font_size=8.2)
    add_note(doc, "云资源按客户云账号实付 + 代维服务费；或客户自行采购。参考价（调研日期 2026-11-09）：阿里云 g8i 16C64G 包年包月约 1.57 万元/年/台（不含带宽/云盘，活动价，最终以云厂商账单为准）。")


    doc.add_heading("六、报价边界、假设与商务条款", level=1)
    doc.add_heading("6.1 包含范围", level=2)
    add_bullets(doc, [
        "平台 P0 核心：身份/SSO（1 套协议）、多角色/会话、审批/工作项、资产/上传、异步任务、通知、审计链、导入导出基础、指标基础、数据范围。",
        "教育垂直：课程/知识点、班级/学生、教学任务、学习中心、测评基础、规则推荐、徽章/评价、MP4 离线基础。",
        "智能体：3 类核心智能体（课程设计/知识点提取/脚本分镜）+ 文档解析基础 + 生成任务编排。",
        "实施：90 日排期、1 生产 + 1 测试环境、数据初始化、培训、UAT、验收材料、1 年质保。",
        "演示：1 次彩排 + 1 次正式演示。",
    ])
    doc.add_heading("6.2 不包含/需第三方或客户提供", level=2)
    headers = ["项", "边界"]
    rows = [
        ["全量 6 类智能体", "本报价含 3 类核心；其余按增补报价"],
        ["视频生成/TTS/ASR/OCR/内容安全模型", "无自研；接第三方，费用单列"],
        ["完整离线 SDK/DRM/多端播放器", "本报价含 MP4 离线基础；完整 SDK 后置"],
        ["复杂推荐/向量检索/BI 设计器", "本期不做；可后置"],
        ["多数据源/多 SSO 协议/超过 10 个接口", "超出按增补报价"],
        ["客户 SSO/教务/人事/内网数据库", "客户提供协议、测试账号、只读账号、白名单"],
        ["云资源/模型账号/第三方服务", "客户采购或代采；不含在软件报价"],
        ["等保测评/渗透测试/云合规", "客户/测评机构主导；厂商配合整改"],
        ["源代码/二次销售/对外 SaaS 运营", "不在买断范围；另议"],
    ]
    add_table(doc, headers, rows, widths=[5.6, 10.8], font_size=8.8)

    doc.add_heading("6.3 关键假设", level=2)
    add_bullets(doc, [
        "需求在 D14 前冻结；后续变更走书面变更单，评估工期/费用。",
        "客户在 D1—D14 提供 SSO 协议/测试账号、教务/人事数据源、只读账号、网络白名单、模型/媒体 provider 账号。",
        "客户提供 1 套生产环境 + 1 套测试环境（或云账号），并配合等保/安全基线。",
        "客户指定业务代表、UAT 人员、数据初始化责任人；UAT 周期不超过 8 个工作日。",
        "90 日为自然日；客户依赖延迟、需求变更、第三方联调延迟按顺延处理。",
        "本报价按人民币、6% 增值税；如税率/云厂商价格重大变化，双方另行协商。",
    ])
    doc.add_heading("6.4 售后与运维", level=2)
    add_bullets(doc, [
        "质保期 12 个月：缺陷修复、版本升级、远程支持、重大故障响应。",
        "响应级别：P1 30 分钟内响应、4 小时内恢复/规避；P2 2 小时内响应、1 个工作日内处理；P3 按计划。",
        "质保期后运维 8%/年（可选）：含远程支持、版本升级、巡检、告警优化；不含云资源/模型/第三方费用。",
        "培训：管理员/教师/运维 2—3 场，提供操作手册、运维手册、接口文档。",
    ])

    doc.add_heading("附录：调研来源与说明", level=1)
    add_note(doc, "调研日期：2026-11-09。以下仅用于许可证/规格核验，最终以官方最新条款与合同为准。")
    sources = [
        ("PostgreSQL License（官方）", "https://www.postgresql.org/about/licence/"),
        ("Next.js MIT License（官方仓库）", "https://github.com/vercel/next.js/blob/f69806d09f73fd52e56cc0e29a2ec5b3f556c5ec/license.md"),
        ("NestJS 官方文档（MIT）", "https://docs.nestjs.com/fundamentals/platform-agnosticism"),
        ("TypeORM MIT License（官方仓库）", "https://github.com/typeorm/typeorm/blob/52e5f7c3e275fad3f274e20570c7d6692855a640/LICENSE"),
        ("Redis RSALv2/SSPL 官方公告", "https://redis.io/blog/rsalv2-sspl-announcement.md"),
        ("Valkey 官方（BSD）", "https://valkey.io/"),
        ("阿里云 ECS g8i 规格/参考价（2026-10-28）", "https://developer.aliyun.com/article/1776648"),
        ("等保 2.0 三级要求（参考）", "https://www.51dns.com/news/9261.html"),
        ("软件著作权登记材料（中国版权保护中心/北京政务服务）", "https://invest.beijing.gov.cn/sy/zt/qyrx/202604/t20260428_4620302.html"),
    ]
    for title, url in sources:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run("• " + title + "："); set_cn_font(r, size=7.5, bold=True)
        r = p.add_run(url); set_cn_font(r, size=7, color=COLOR_ACCENT)

    for p in doc.paragraphs:
        if p.style.name == "Heading 1" and p.text.startswith(("一、", "三、", "五、")):
            p.paragraph_format.page_break_before = True

    doc.save(OUT)
    print("saved", OUT, os.path.getsize(OUT))

if __name__ == "__main__":
    main()
