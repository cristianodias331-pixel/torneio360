from __future__ import annotations

import os
import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
PUBLIC_DIR = ROOT / "public" / "legal"
LOGO_PATH = ROOT / "public" / "marketing" / "torneio360-logo-clean-v1.png"
FONT_PATH = ROOT / "public" / "fonts" / "manrope-variable.ttf"

NAVY = colors.HexColor("#020A18")
NAVY_SOFT = colors.HexColor("#08172A")
ORANGE = colors.HexColor("#FF6410")
ORANGE_DARK = colors.HexColor("#C74600")
INK = colors.HexColor("#172235")
MUTED = colors.HexColor("#5E6B7C")
LINE = colors.HexColor("#D9E1EA")
PAPER = colors.HexColor("#F8FAFC")
WHITE = colors.white

VERSION = "1.0"
UPDATED_AT = "30 de agosto de 2026"
SUPPORT_EMAIL = "torneio360@gmail.com"


def register_fonts() -> tuple[str, str]:
    regular = "Helvetica"
    bold = "Helvetica-Bold"
    if FONT_PATH.exists():
        try:
            pdfmetrics.registerFont(TTFont("Manrope", str(FONT_PATH)))
            regular = "Manrope"
            bold = "Manrope"
        except Exception:
            pass
    return regular, bold


FONT_REGULAR, FONT_BOLD = register_fonts()


def build_styles():
    styles = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=styles["Title"],
            fontName=FONT_BOLD,
            fontSize=27,
            leading=31,
            textColor=WHITE,
            alignment=TA_LEFT,
            spaceAfter=7 * mm,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle",
            parent=styles["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=11,
            leading=17,
            textColor=colors.HexColor("#D8E2EF"),
            spaceAfter=6 * mm,
        ),
        "badge": ParagraphStyle(
            "Badge",
            parent=styles["BodyText"],
            fontName=FONT_BOLD,
            fontSize=8.5,
            leading=12,
            textColor=ORANGE,
            alignment=TA_CENTER,
        ),
        "lead": ParagraphStyle(
            "Lead",
            parent=styles["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=10.6,
            leading=16,
            textColor=INK,
            spaceAfter=5 * mm,
        ),
        "h1": ParagraphStyle(
            "SectionTitle",
            parent=styles["Heading1"],
            fontName=FONT_BOLD,
            fontSize=16,
            leading=21,
            textColor=NAVY,
            spaceBefore=6 * mm,
            spaceAfter=3 * mm,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "SubsectionTitle",
            parent=styles["Heading2"],
            fontName=FONT_BOLD,
            fontSize=11.2,
            leading=15,
            textColor=ORANGE_DARK,
            spaceBefore=3 * mm,
            spaceAfter=1.8 * mm,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "LegalBody",
            parent=styles["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=9.3,
            leading=14.2,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=2.8 * mm,
            splitLongWords=False,
        ),
        "bullet": ParagraphStyle(
            "LegalBullet",
            parent=styles["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=9.1,
            leading=13.8,
            leftIndent=5 * mm,
            firstLineIndent=-3.3 * mm,
            textColor=INK,
            spaceAfter=1.7 * mm,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=styles["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=7.8,
            leading=11.5,
            textColor=MUTED,
        ),
        "callout": ParagraphStyle(
            "Callout",
            parent=styles["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=9.2,
            leading=14,
            textColor=INK,
        ),
        "reference": ParagraphStyle(
            "Reference",
            parent=styles["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=8.3,
            leading=12.5,
            leftIndent=4 * mm,
            firstLineIndent=-3 * mm,
            textColor=INK,
            spaceAfter=1.5 * mm,
        ),
    }


STYLES = build_styles()


def footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 7 * mm, width, 7 * mm, stroke=0, fill=1)
    canvas.setFillColor(ORANGE)
    canvas.rect(0, height - 7.8 * mm, width, 0.8 * mm, stroke=0, fill=1)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFont(FONT_REGULAR, 7.2)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9.5 * mm, f"Torneio 360 | Versão {VERSION} | {UPDATED_AT}")
    canvas.drawRightString(width - 18 * mm, 9.5 * mm, f"Página {doc.page}")
    canvas.restoreState()


def document(path: Path, title: str):
    return SimpleDocTemplate(
        str(path),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=15 * mm,
        bottomMargin=20 * mm,
        title=title,
        author="Torneio 360",
        subject=f"Minuta {title} para leitura e revisão jurídica",
        creator="Torneio 360",
    )


def callout(text: str, tone: str = "orange"):
    fill = colors.HexColor("#FFF3EA") if tone == "orange" else colors.HexColor("#EAF2FA")
    border = ORANGE if tone == "orange" else colors.HexColor("#4E78A8")
    return Table(
        [[Paragraph(text, STYLES["callout"])]],
        colWidths=[170 * mm],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 0.8, border),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
            ]
        ),
    )


def cover(title: str, subtitle: str):
    logo = Image(str(LOGO_PATH), width=55 * mm, height=17 * mm, kind="proportional")
    badge = Table(
        [[Paragraph("MINUTA PARA LEITURA E REVISÃO JURÍDICA", STYLES["badge"])]],
        colWidths=[67 * mm],
        style=TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, ORANGE),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#142137")),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4 * mm),
            ]
        ),
    )
    panel = Table(
        [[logo], [Spacer(1, 7 * mm)], [Paragraph(title, STYLES["cover_title"])], [Paragraph(subtitle, STYLES["cover_subtitle"])], [badge]],
        colWidths=[170 * mm],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NAVY),
                ("LEFTPADDING", (0, 0), (-1, -1), 12 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12 * mm),
                ("TOPPADDING", (0, 0), (-1, 0), 11 * mm),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 11 * mm),
            ]
        ),
    )
    meta = Table(
        [
            ["Versão", VERSION, "Atualização", UPDATED_AT],
            ["Canal", SUPPORT_EMAIL, "Aplicação", "Site e plataforma Torneio 360"],
        ],
        colWidths=[20 * mm, 57 * mm, 26 * mm, 67 * mm],
        style=TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
                ("FONTSIZE", (0, 0), (-1, -1), 7.8),
                ("TEXTCOLOR", (0, 0), (-1, -1), INK),
                ("BACKGROUND", (0, 0), (0, -1), PAPER),
                ("BACKGROUND", (2, 0), (2, -1), PAPER),
                ("FONTNAME", (0, 0), (0, -1), FONT_BOLD),
                ("FONTNAME", (2, 0), (2, -1), FONT_BOLD),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ]
        ),
    )
    return [panel, Spacer(1, 7 * mm), meta, Spacer(1, 7 * mm)]


def section(story, number: int | str, title: str, paragraphs=None, bullets=None, subsections=None):
    story.append(Paragraph(f"{number}. {title}", STYLES["h1"]))
    for text in paragraphs or []:
        story.append(Paragraph(text, STYLES["body"]))
    for text in bullets or []:
        story.append(Paragraph(f"• {text}", STYLES["bullet"]))
    for subtitle, subparagraphs, subbullets in subsections or []:
        story.append(Paragraph(subtitle, STYLES["h2"]))
        for text in subparagraphs:
            story.append(Paragraph(text, STYLES["body"]))
        for text in subbullets:
            story.append(Paragraph(f"• {text}", STYLES["bullet"]))


def references(story):
    story.append(PageBreak())
    story.append(Paragraph("Referências legais e orientativas", STYLES["h1"]))
    story.append(Paragraph("As referências abaixo foram consultadas para estruturar esta minuta. A redação é própria da Torneio 360 e deverá ser revisada por profissional jurídico antes do lançamento oficial.", STYLES["body"]))
    refs = [
        ("Lei nº 13.709/2018 - Lei Geral de Proteção de Dados Pessoais (LGPD)", "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm"),
        ("Lei nº 12.965/2014 - Marco Civil da Internet", "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm"),
        ("Decreto nº 8.771/2016 - Regulamentação do Marco Civil da Internet", "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8771.htm"),
        ("Lei nº 8.078/1990 - Código de Defesa do Consumidor", "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm"),
        ("ANPD - Direitos dos Titulares", "https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares"),
        ("ANPD - Guia de segurança para agentes de tratamento de pequeno porte", "https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte"),
    ]
    for label, href in refs:
        story.append(Paragraph(f'• <link href="{href}" color="#C74600"><u>{label}</u></link>', STYLES["reference"]))


def build_terms(path: Path):
    story = cover(
        "Termos de Uso",
        "Condições para acesso e utilização da plataforma de gestão esportiva Torneio 360.",
    )
    story.append(callout("<b>Importante:</b> este documento é uma minuta de homologação. A razão social, o CNPJ, o endereço e a qualificação completa do responsável pela plataforma devem ser preenchidos e o texto deve passar por revisão jurídica antes de ser apresentado como versão oficial."))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("Resumo em linguagem simples", STYLES["h1"]))
    for item in [
        "A conta de atleta é gratuita; recursos profissionais de organização podem depender de assinatura apresentada de forma clara antes da contratação.",
        "Cada pessoa deve informar dados verdadeiros, proteger sua senha e agir com respeito. Fraude, discriminação, assédio e manipulação de resultados não são permitidos.",
        "Organizadores respondem pelas regras, cobranças, execução e segurança dos eventos que administram; a Torneio 360 fornece a infraestrutura digital de gestão.",
        "Dados pessoais seguem o Aviso de Privacidade. O usuário pode pedir acesso, correção e, quando cabível, exclusão da conta e dos dados.",
    ]:
        story.append(Paragraph(f"• {item}", STYLES["bullet"]))

    section(story, 1, "Quem fornece a plataforma e aceitação", [
        "Estes Termos regulam o acesso ao site, aplicativos e funcionalidades identificados pela marca Torneio 360. Nesta minuta, a expressão <b>Torneio 360</b> designa o responsável pela operação da plataforma, cuja qualificação societária completa deverá ser inserida antes do lançamento oficial.",
        "Ao criar conta, marcar a caixa de concordância ou utilizar funcionalidades autenticadas, o usuário declara que leu e aceitou estes Termos e o Aviso de Privacidade. Quem não concordar não deverá concluir o cadastro nem utilizar os serviços autenticados.",
    ])
    section(story, 2, "Elegibilidade e menores de idade", [
        "A plataforma pode ser utilizada por pessoas físicas e por representantes autorizados de pessoas jurídicas. O usuário declara possuir capacidade para praticar os atos realizados em sua conta.",
        "Menores de 18 anos somente podem utilizar recursos que envolvam contratação, pagamento, divulgação de imagem ou participação em evento com a assistência ou representação de responsável legal, conforme a legislação aplicável e as regras do organizador. O tratamento de dados de crianças e adolescentes observará seu melhor interesse e as exigências específicas da LGPD.",
    ])
    section(story, 3, "Serviços disponíveis", [
        "A Torneio 360 oferece infraestrutura digital voltada à organização e participação esportiva. As funcionalidades efetivamente liberadas podem variar conforme perfil, modalidade, plano e fase do produto.",
    ], [
        "criação e manutenção de conta e perfil esportivo;",
        "criação e administração de torneios, circuitos, categorias, duplas, quadras, partidas, resultados e rankings;",
        "inscrições, convites, busca de parceiros, comprovantes, notificações e comunicação operacional;",
        "publicação de fotos, capas, conquistas e informações escolhidas pelo usuário;",
        "recursos profissionais de organização sujeitos ao plano contratado.",
    ])
    section(story, 4, "Conta, credenciais e dados corretos", [
        "A conta é pessoal e não deve ser compartilhada. O usuário é responsável por manter e-mail, senha e dados cadastrais protegidos e atualizados, bem como por comunicar imediatamente qualquer suspeita de acesso indevido.",
        "É proibido criar identidade falsa, usar documento de terceiro sem autorização, manter contas para fraude ou contornar bloqueios. A Torneio 360 poderá solicitar verificações proporcionais de identidade e segurança quando houver indício de abuso.",
    ])
    section(story, 5, "Perfis, imagens e conteúdo do usuário", [
        "O usuário permanece titular do conteúdo que envia. Ao publicar foto, texto, resultado ou outro material, concede à Torneio 360 licença não exclusiva, gratuita e limitada ao período e às finalidades necessárias para armazenar, adaptar tecnicamente, exibir e disponibilizar esse conteúdo dentro dos serviços escolhidos.",
        "O usuário declara possuir os direitos ou autorizações necessários, inclusive de imagem, e deverá respeitar privacidade, honra, propriedade intelectual e direitos de terceiros. Configurações de visibilidade devem ser observadas antes da publicação.",
    ])
    section(story, 6, "Torneios, inscrições e responsabilidades do organizador", [
        "A organização de cada evento é responsável por definir e divulgar regulamento, modalidade, categoria, critérios de elegibilidade, valores, prazos, política de cancelamento, segurança física, arbitragem e demais condições do torneio.",
        "A Torneio 360 fornece ferramentas de gestão e não substitui o organizador, a arbitragem, profissionais de saúde ou autoridades esportivas. Divergências sobre classificação, chaveamento, cobrança, reembolso ou realização do evento devem ser tratadas primeiro com a organização responsável, sem prejuízo dos direitos legais do consumidor.",
        "A prática esportiva envolve riscos próprios. Participantes devem avaliar sua condição, utilizar equipamentos adequados e seguir as regras de segurança do local e do evento.",
    ])
    section(story, 7, "Pagamentos, comprovantes e assinaturas", [
        "Quando houver cobrança de inscrição ou assinatura, preço, periodicidade, renovação, cancelamento e condições relevantes deverão ser informados antes da confirmação. A Torneio 360 não é instituição financeira e poderá utilizar prestadores de pagamento independentes, sujeitos também aos termos próprios desses prestadores.",
        "Comprovantes enviados à plataforma destinam-se à análise do usuário e da organização responsável. O envio não representa confirmação automática de pagamento. Reembolsos e cancelamentos seguem a oferta, o regulamento do evento e a legislação aplicável.",
    ])
    section(story, 8, "Conduta, integridade esportiva e moderação", [
        "Não é permitido utilizar a plataforma para atividade ilícita, fraude, manipulação de resultado, aposta irregular, assédio, ameaça, discriminação, discurso de ódio, exploração sexual, exposição indevida de dados, spam, invasão, coleta automatizada não autorizada ou violação de direitos.",
        "Conteúdos e contas podem ser limitados, removidos ou suspensos quando houver violação destes Termos, risco à comunidade, ordem de autoridade ou necessidade de proteção. Sempre que adequado, serão considerados contexto, gravidade, reincidência e possibilidade de contestação.",
    ])
    section(story, 9, "Planos, alterações e funcionalidades futuras", [
        "A conta de atleta poderá permanecer gratuita para os recursos indicados na oferta. Ferramentas de organização podem depender de assinatura. Novas modalidades ou funções exibidas como futuras não constituem promessa de data de lançamento.",
        "A Torneio 360 poderá aperfeiçoar, substituir ou descontinuar funcionalidades, buscando avisar com antecedência razoável quando a mudança afetar serviço contratado ou dados relevantes do usuário.",
    ])
    section(story, 10, "Disponibilidade e segurança", [
        "São adotadas medidas técnicas e administrativas compatíveis com o estágio e o risco do serviço, mas nenhum sistema é totalmente imune a falhas, indisponibilidade ou incidentes. Manutenções, dependências externas, caso fortuito ou força maior podem interromper temporariamente o acesso.",
        "O usuário não deve tentar obter acesso indevido, testar vulnerabilidades sem autorização, interferir na disponibilidade ou introduzir código malicioso.",
    ])
    section(story, 11, "Propriedade intelectual", [
        "Marca, identidade visual, software, banco de dados, organização de telas, textos institucionais e demais ativos da Torneio 360 são protegidos pela legislação aplicável. Estes Termos concedem apenas autorização limitada, revogável e não transferível para uso regular do serviço, sem cessão de propriedade.",
    ])
    section(story, 12, "Privacidade e proteção de dados", [
        "O tratamento de dados pessoais é descrito no Aviso de Privacidade, que integra estes Termos. O usuário deve ler o documento antes de concluir o cadastro e utilizar os canais indicados para exercer seus direitos.",
    ])
    section(story, 13, "Suspensão, cancelamento e encerramento", [
        "O usuário pode solicitar encerramento da conta. Alguns dados poderão ser mantidos quando necessários ao cumprimento de obrigação legal, exercício de direitos, prevenção a fraude ou outra hipótese autorizada pela LGPD.",
        "A Torneio 360 poderá restringir ou suspender acesso em caso de violação, risco de segurança, fraude ou inadimplência de serviço pago. Medidas definitivas deverão respeitar a legislação aplicável e, quando possível, oferecer informação e canal de contestação.",
    ])
    section(story, 14, "Responsabilidade e limites legais", [
        "Cada parte responde por seus próprios atos. Nenhuma disposição exclui responsabilidade que não possa ser afastada por lei, nem reduz direitos previstos no Código de Defesa do Consumidor.",
        "A Torneio 360 não responde por decisões autônomas de organizadores e participantes, conteúdo de terceiros, condições físicas de arenas, eventos externos ou serviços contratados diretamente de terceiros, salvo quando a responsabilidade decorrer da lei ou de conduta atribuível à própria plataforma.",
    ])
    section(story, 15, "Atualizações destes Termos", [
        "A versão e a data de atualização serão informadas no documento. Alterações relevantes serão comunicadas por meio adequado e, quando exigido, será solicitada nova concordância. A continuidade de uso não substitui consentimento quando a lei exigir manifestação específica.",
    ])
    section(story, 16, "Lei aplicável e solução de conflitos", [
        "Aplicam-se as leis da República Federativa do Brasil. As partes buscarão solução direta pelos canais de atendimento. Em relações de consumo, permanece assegurado ao consumidor o foro e os meios de proteção previstos em lei; esta minuta não impõe renúncia a direito legal.",
    ])
    section(story, 17, "Contato e identificação a completar", [
        f"Canal atualmente informado para dúvidas: <link href=\"mailto:{SUPPORT_EMAIL}\" color=\"#C74600\"><u>{SUPPORT_EMAIL}</u></link>.",
    ], [
        "Razão social do responsável pela Torneio 360: [PREENCHER ANTES DA PUBLICAÇÃO OFICIAL]",
        "CNPJ: [PREENCHER ANTES DA PUBLICAÇÃO OFICIAL]",
        "Endereço: [PREENCHER ANTES DA PUBLICAÇÃO OFICIAL]",
        "Canal jurídico e de privacidade: [CONFIRMAR OU SUBSTITUIR O E-MAIL ACIMA]",
    ])
    story.append(PageBreak())
    section(story, "A", "Diretrizes da comunidade", [
        "Estas diretrizes complementam os Termos e orientam a convivência na Torneio 360.",
    ], [
        "trate atletas, organizadores, árbitros e equipe com respeito;",
        "não pratique discriminação por raça, cor, origem, sexo, identidade, orientação, religião, deficiência, idade ou qualquer condição protegida;",
        "não publique ameaça, assédio, humilhação, conteúdo sexual explícito, dados privados ou imagem sem autorização;",
        "não manipule resultados, perfis, comprovantes, rankings ou inscrições;",
        "denuncie riscos e abusos pelo canal oficial, preservando evidências e evitando exposição pública desnecessária;",
        "respeite regulamentos esportivos, decisões de arbitragem e procedimentos de contestação do evento.",
    ])
    references(story)
    doc = document(path, "Termos de Uso - Torneio 360")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def build_privacy(path: Path):
    story = cover(
        "Aviso de Privacidade",
        "Como a Torneio 360 coleta, utiliza, compartilha, protege e elimina dados pessoais.",
    )
    story.append(callout("<b>Transparência:</b> esta é uma minuta de homologação baseada no funcionamento atual observado no código. Antes do lançamento oficial, devem ser preenchidos os dados do controlador, confirmado o inventário de fornecedores e definidos prazos formais de retenção.", tone="blue"))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("Resumo em linguagem simples", STYLES["h1"]))
    for item in [
        "Usamos dados para criar e proteger sua conta, montar seu perfil esportivo, processar inscrições e operar torneios, rankings e comunicações.",
        "A senha é administrada pelo serviço de autenticação e não fica disponível em texto para a equipe da Torneio 360.",
        "Na versão atual do cadastro, CPF ou CNPJ é validado localmente no navegador e não é enviado no pedido de criação da conta. Qualquer armazenamento futuro exigirá atualização prévia deste aviso e proteção adequada.",
        "Você pode solicitar confirmação, acesso, correção, informações, oposição e, quando aplicável, eliminação ou portabilidade dos seus dados.",
    ]:
        story.append(Paragraph(f"• {item}", STYLES["bullet"]))

    section(story, 1, "Controlador e canal de contato", [
        "O controlador é o responsável pela plataforma Torneio 360, que decide as finalidades e os meios essenciais do tratamento. A qualificação completa ainda não consta no repositório analisado e deverá ser preenchida antes da publicação oficial.",
        f"Canal provisório para privacidade e exercício de direitos: <link href=\"mailto:{SUPPORT_EMAIL}\" color=\"#C74600\"><u>{SUPPORT_EMAIL}</u></link>.",
    ], [
        "Razão social: [PREENCHER]",
        "CNPJ: [PREENCHER]",
        "Endereço: [PREENCHER]",
        "Encarregado ou canal equivalente: [PREENCHER OU CONFIRMAR O E-MAIL ACIMA]",
    ])
    section(story, 2, "A quem e a que este aviso se aplica", [
        "Este Aviso se aplica a visitantes, atletas, organizadores, colaboradores convidados e representantes de organizações que utilizem o site ou as funcionalidades da Torneio 360. Organizadores podem atuar como controladores independentes para decisões próprias do evento, como regras, cobrança, comunicação e uso de listas de participantes.",
    ])
    section(story, 3, "Dados tratados", subsections=[
        ("3.1 Conta e autenticação", ["Nome, sobrenome, data de nascimento, e-mail, identificador da conta, confirmações, sessões e eventos de segurança. A senha é tratada pelo provedor de autenticação de forma protegida e não deve ser acessível em texto pela equipe."], []),
        ("3.2 CPF ou CNPJ no cadastro atual", ["O formulário atual verifica a validade matemática do CPF ou CNPJ no próprio navegador. O código de criação da conta não inclui esse número nos metadados enviados ao serviço de autenticação. Portanto, nesta versão, o documento não deve ser persistido por esse fluxo. Se a plataforma passar a armazená-lo, será necessário definir finalidade, base legal, acesso, retenção e segurança antes da mudança."], []),
        ("3.3 Perfil esportivo e público", ["Nome de usuário, foto, capa, biografia, cidade, modalidade, categoria, mão dominante, tamanho de camiseta, dupla, conquistas e escolhas de visibilidade. Parte dessas informações pode se tornar pública conforme a função e a configuração utilizada."], []),
        ("3.4 Torneios e inscrições", ["Evento, categoria, dupla, disponibilidade, pagamentos declarados, comprovantes privados, status de inscrição, quadras, partidas, resultados, rankings, presença, fotos e notificações relacionadas."], []),
        ("3.5 Uso técnico e comunicação", ["Endereço IP, data e hora, navegador, dispositivo, registros de acesso e segurança, preferências, mensagens de suporte e dados necessários para envio de e-mails e notificações. Cookies e armazenamento local podem manter sessão, preferência e funcionamento essencial."], []),
    ])
    section(story, 4, "Como os dados são coletados", [
        "Os dados podem ser fornecidos pelo próprio usuário, por organizadores autorizados, por outros atletas em funções de dupla ou equipe, pela utilização técnica da plataforma e por prestadores integrados necessários à autenticação, hospedagem, comunicação ou pagamento.",
        "Quem inserir dados de terceiro deve possuir autorização ou outra base legal adequada e informar o titular quando necessário.",
    ])
    section(story, 5, "Finalidades e bases legais", [
        "A base legal depende da operação concreta. A Torneio 360 deverá manter registro das operações e aplicar necessidade, finalidade, adequação, transparência e segurança.",
    ], [
        "execução de contrato e procedimentos preliminares: criar conta, autenticar, processar inscrição, entregar plano e prestar suporte;",
        "cumprimento de obrigação legal ou regulatória: manter registros exigidos, responder autoridades e atender deveres fiscais ou consumeristas quando aplicáveis;",
        "legítimo interesse, após avaliação: segurança, prevenção a fraude, melhoria do serviço e comunicação operacional compatível com a expectativa do usuário;",
        "consentimento: situações em que a lei exigir escolha livre, destacada e revogável, especialmente comunicações promocionais, usos opcionais e casos envolvendo dados de crianças;",
        "exercício regular de direitos: preservação de evidências e defesa em processos judiciais, administrativos ou arbitrais;",
        "proteção da vida ou da incolumidade física, quando aplicável a situação concreta de segurança.",
    ])
    section(story, 6, "Compartilhamento e operadores", [
        "Os dados são compartilhados apenas quando necessários à finalidade informada, com controles contratuais e de acesso compatíveis.",
    ], [
        "Supabase, para autenticação, banco de dados e armazenamento conforme a configuração da plataforma;",
        "Vercel, para hospedagem, distribuição e operação do site;",
        "serviços de e-mail, notificação, monitoramento e suporte que forem efetivamente ativados;",
        "prestadores de pagamento, caso recursos financeiros sejam habilitados;",
        "organizadores, árbitros e participantes, nos limites necessários à inscrição, dupla, chave, partida e resultado;",
        "autoridades públicas ou terceiros quando houver obrigação legal, ordem válida, proteção de direitos ou prevenção de fraude;",
        "público em geral somente para dados definidos como públicos pela função ou escolha do usuário.",
    ])
    section(story, 7, "Transferência e armazenamento internacional", [
        "Fornecedores de nuvem podem processar dados fora do Brasil, conforme região contratada, infraestrutura e suboperadores. Antes do lançamento oficial, a Torneio 360 deverá confirmar as regiões utilizadas, as garantias contratuais e os mecanismos admitidos pela LGPD e pela regulamentação da ANPD, atualizando este Aviso com informação precisa.",
    ])
    section(story, 8, "Prazos de retenção e eliminação", [
        "Os dados devem ser mantidos somente pelo tempo necessário à finalidade, ao cumprimento de obrigação legal, ao exercício de direitos, à prevenção de fraude e à segurança. A conta ativa exige manutenção dos dados essenciais. Após encerramento, dados não necessários devem ser eliminados ou anonimizados, ressalvadas hipóteses legais de conservação.",
        "Antes da versão oficial, deverá ser aprovada uma tabela interna com prazos para conta, registros de acesso, suporte, comprovantes, pagamentos, conteúdo, backups e evidências de consentimento.",
    ])
    section(story, 9, "Segurança da informação", [
        "A Torneio 360 deve aplicar controles proporcionais ao risco, incluindo acesso restrito, autenticação, segregação entre dados públicos e privados, registros de atividade, atualizações, backups, resposta a incidentes e seleção responsável de fornecedores.",
        "O usuário deve utilizar senha forte, evitar compartilhamento, manter seu dispositivo protegido e comunicar suspeita de acesso indevido. Nenhum ambiente é totalmente imune; riscos residuais serão tratados de forma contínua.",
    ])
    section(story, 10, "Direitos do titular", [
        "Nos termos da LGPD, o titular pode solicitar gratuitamente, conforme aplicável:",
    ], [
        "confirmação da existência de tratamento e acesso aos dados;",
        "correção de dados incompletos, inexatos ou desatualizados;",
        "informação sobre finalidade, compartilhamentos e consequências de eventual negativa de consentimento;",
        "anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;",
        "portabilidade, observada a regulamentação e os segredos comercial e industrial;",
        "eliminação de dados tratados com consentimento, salvo hipóteses legais de conservação;",
        "revogação do consentimento e oposição a tratamento irregular;",
        "revisão de decisões tomadas unicamente com base em tratamento automatizado que afetem seus interesses;",
        "petição perante a ANPD e órgãos de defesa do consumidor, após tentativa de atendimento pelo canal do controlador quando aplicável.",
    ])
    story.append(callout("Para proteger o titular, a Torneio 360 poderá pedir informações razoáveis de autenticação antes de atender uma solicitação. A resposta observará os prazos legais e a complexidade do pedido.", tone="blue"))
    section(story, 11, "Crianças e adolescentes", [
        "O tratamento de dados de crianças e adolescentes deve observar seu melhor interesse. Quando o consentimento for a base adequada para dados de criança, deverá ser específico e destacado, dado por pelo menos um responsável legal, com esforços razoáveis de verificação. Funções de pagamento, exposição pública de imagem e contratação por menores exigem controles e autorizações compatíveis.",
    ])
    section(story, 12, "Perfis públicos, fotos e rankings", [
        "Informações exibidas em perfil, lista de participantes, chave, ranking, resultado ou galeria podem ser acessadas por outras pessoas e eventualmente copiadas fora da plataforma. A Torneio 360 deverá sinalizar a visibilidade e oferecer configurações ou meios de correção e remoção quando cabíveis.",
    ])
    section(story, 13, "Cookies e tecnologias semelhantes", [
        "Cookies ou armazenamento local essenciais podem ser usados para sessão, segurança, idioma, tema e continuidade de navegação. Ferramentas opcionais de análise, publicidade ou rastreamento somente devem ser ativadas após avaliação de finalidade, base legal e mecanismo de escolha adequado. Uma política específica deverá ser publicada se o inventário justificar.",
    ])
    section(story, 14, "Decisões automatizadas", [
        "A organização automática de chaves, rankings, validações e recomendações pode utilizar regras de sistema. Quando uma decisão for tomada unicamente por tratamento automatizado e afetar interesses do titular, será disponibilizado canal para solicitar informações e revisão, observados segredos comercial e industrial.",
    ])
    section(story, 15, "Incidentes de segurança", [
        "Suspeitas de acesso indevido ou incidente devem ser comunicadas ao canal oficial. A Torneio 360 avaliará natureza, dados afetados, riscos e medidas de contenção e, quando exigido, comunicará titulares e ANPD conforme a legislação e a regulamentação aplicáveis.",
    ])
    section(story, 16, "Atualizações deste Aviso", [
        "A versão e a data de atualização serão mantidas no documento. Mudanças relevantes de finalidade, dados, compartilhamento ou direitos serão destacadas por meio adequado e, quando necessário, dependerão de nova escolha do titular.",
    ])
    section(story, 17, "Pendências obrigatórias antes da publicação oficial", bullets=[
        "preencher razão social, CNPJ, endereço e identificação do controlador;",
        "definir encarregado ou canal formal de privacidade;",
        "aprovar inventário de dados, bases legais e tabela de retenção;",
        "confirmar lista de operadores, suboperadores, regiões e transferências internacionais;",
        "confirmar prestador de pagamento e fluxo de comprovantes;",
        "realizar revisão jurídica e de segurança;",
        "publicar procedimento de solicitação de direitos e registro de atendimento.",
    ])
    references(story)
    doc = document(path, "Aviso de Privacidade - Torneio 360")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    terms_output = OUTPUT_DIR / "termos-de-uso-torneio360.pdf"
    privacy_output = OUTPUT_DIR / "aviso-de-privacidade-torneio360.pdf"

    build_terms(terms_output)
    build_privacy(privacy_output)

    shutil.copy2(terms_output, PUBLIC_DIR / terms_output.name)
    shutil.copy2(privacy_output, PUBLIC_DIR / privacy_output.name)

    print(terms_output)
    print(privacy_output)


if __name__ == "__main__":
    main()
