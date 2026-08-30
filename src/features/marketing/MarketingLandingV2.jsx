import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  Check,
  ChevronRight,
  ClipboardCheck,
  Mail,
  Menu,
  MessageCircle,
  Trophy,
  UserRound,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { BeachLogo, PLATFORM_SUPPORT } from "../appShell/EntryPresentation.jsx";
import styles from "./MarketingLandingV2.module.css";

const steps = [
  {
    number: "1",
    title: "Crie seu perfil",
    description: "Cadastre seus dados esportivos e encontre torneios.",
    Icon: UserRound,
  },
  {
    number: "2",
    title: "Inscreva-se ou organize",
    description: "Participe como atleta ou crie torneios e circuitos.",
    Icon: ClipboardCheck,
  },
  {
    number: "3",
    title: "Gerencie duplas e partidas",
    description: "Confirme inscrições, pagamentos, quadras e rodadas.",
    Icon: Users,
  },
  {
    number: "4",
    title: "Publique resultados",
    description: "Atualize placares, ranking e conquistas dos atletas.",
    Icon: BarChart3,
  },
];

const plans = [
  {
    title: "Atleta",
    subtitle: "Gratuito",
    Icon: UserRound,
    items: ["Perfil esportivo", "Inscrições e convites", "Duplas, desafios e conquistas"],
    action: "Criar perfil",
    actionType: "signup",
  },
  {
    title: "Organizador",
    subtitle: "Gestão por assinatura",
    Icon: Trophy,
    items: ["Torneios e circuitos", "Inscrições e comprovantes", "Central de quadras, partidas e ranking"],
    action: "Conhecer recursos",
    actionType: "explore",
  },
];

const upcomingSports = [
  { name: "Vôlei", image: "/marketing/sport-volleyball.png" },
  { name: "Futevôlei", image: "/marketing/sport-footvolley.png" },
  { name: "Tênis", image: "/marketing/sport-tennis.png" },
  { name: "Pickleball", image: "/marketing/sport-pickleball.png" },
];

const rankingRows = [
  ["João Pedro / Lucas Lima", "1.250 pts"],
  ["Rafael Nunes / Gabriel Souza", "980 pts"],
  ["André Barros / Felipe Cunha", "870 pts"],
  ["Gustavo Melo / Matheus Prado", "760 pts"],
  ["Bruno Farias / Thiago Oliveira", "650 pts"],
];

function scrollToSection(id, { updateHash = true } = {}) {
  const section = document.getElementById(id);
  if (!section) return;

  const header = document.querySelector("header");
  const headerHeight = header?.getBoundingClientRect().height || 0;
  const sectionTop = section.getBoundingClientRect().top + window.scrollY - headerHeight;

  if (updateHash && window.location.hash !== `#${id}`) {
    window.history.replaceState(null, "", `#${id}`);
  }
  window.scrollTo({ top: Math.max(0, sectionTop), behavior: "auto" });
}

function NavLink({ section, children, onNavigate, activeSection }) {
  const active = activeSection === section;
  return (
    <a
      href={'#' + section}
      className={active ? styles.activeNavLink : undefined}
      aria-current={active ? "location" : undefined}
      onClick={(event) => {
        event.preventDefault();
        scrollToSection(section);
        onNavigate?.();
        event.currentTarget.blur();
      }}
    >
      {children}
    </a>
  );
}

function SupportLink({ id }) {
  const support = PLATFORM_SUPPORT.find((item) => item.id === id);
  if (!support) return null;
  const { Icon, label, value, href, external } = support;

  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
      <Icon aria-hidden="true" />
      <span><strong>{label}</strong><small>{value}</small></span>
      <ChevronRight aria-hidden="true" />
    </a>
  );
}

export default function MarketingLandingV2({ onLogin, onSignup, onExplore }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    document.documentElement.dataset.marketingLandingV2 = "true";
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const sectionIds = ["como-funciona", "planos", "modalidades", "contato"];
    const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    let frame = 0;

    const updateActiveSection = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (window.scrollY < 160) {
          setActiveSection("");
          return;
        }

        const current = sections.reduce((selected, section) => (
          section.getBoundingClientRect().top <= 190 ? section.id : selected
        ), sectionIds[0]);
        setActiveSection(current);
      });
    };
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    updateActiveSection();

    const alignHashSection = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!sectionIds.includes(id)) return;
      window.requestAnimationFrame(() => scrollToSection(id, { updateHash: false }));
    };
    const alignmentTimers = [80, 320].map((delay) => window.setTimeout(alignHashSection, delay));
    window.addEventListener("hashchange", alignHashSection);
    window.addEventListener("load", alignHashSection);
    alignHashSection();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("hashchange", alignHashSection);
      window.removeEventListener("load", alignHashSection);
      alignmentTimers.forEach((timer) => window.clearTimeout(timer));
      window.history.scrollRestoration = previousScrollRestoration;
      delete document.documentElement.dataset.marketingLandingV2;
    };
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  function submitContact(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = String(data.get("subject") || "Contato pelo site Torneio360").trim();
    const body = [
      "Nome: " + String(data.get("name") || "").trim(),
      "E-mail: " + String(data.get("email") || "").trim(),
      "",
      String(data.get("message") || "").trim(),
    ].join("\n");
    window.location.href = "mailto:torneio360@gmail.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button className={styles.brand} type="button" onClick={(event) => { window.scrollTo({ top: 0, behavior: "smooth" }); event.currentTarget.blur(); }} aria-label="Voltar ao início">
          <BeachLogo layout="horizontal" />
        </button>

        <nav className={styles.desktopNav} aria-label="Navegação da apresentação">
          <NavLink section="como-funciona" activeSection={activeSection}>Como funciona</NavLink>
          <NavLink section="planos" activeSection={activeSection}>Planos</NavLink>
          <NavLink section="modalidades" activeSection={activeSection}>Modalidades</NavLink>
          <NavLink section="contato" activeSection={activeSection}>Contato</NavLink>
        </nav>

        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} type="button" onClick={onLogin}>Login</button>
          <button className={styles.primaryButton} type="button" onClick={onSignup}>Criar conta</button>
        </div>

        <button className={styles.menuButton} type="button" onClick={(event) => { setMenuOpen((current) => !current); event.currentTarget.blur(); }} aria-expanded={menuOpen} aria-controls="marketing-mobile-menu" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}>
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        {menuOpen ? (
          <div className={styles.mobileMenu} id="marketing-mobile-menu">
            <nav aria-label="Navegação móvel da apresentação">
              <NavLink section="como-funciona" onNavigate={closeMenu} activeSection={activeSection}>Como funciona</NavLink>
              <NavLink section="planos" onNavigate={closeMenu} activeSection={activeSection}>Planos</NavLink>
              <NavLink section="modalidades" onNavigate={closeMenu} activeSection={activeSection}>Modalidades</NavLink>
              <NavLink section="contato" onNavigate={closeMenu} activeSection={activeSection}>Contato</NavLink>
            </nav>
            <div>
              <button className={styles.secondaryButton} type="button" onClick={onLogin}>Login</button>
              <button className={styles.primaryButton} type="button" onClick={onSignup}>Criar conta</button>
            </div>
          </div>
        ) : null}
      </header>

      <div className={styles.accountStrip}>
        <Users aria-hidden="true" />
        <span>Uma conta para participar e organizar</span>
        <i aria-hidden="true" />
        <span>Perfil gratuito</span>
        <i aria-hidden="true" />
        <span>Gestão por assinatura</span>
      </div>

      <main>
        <section className={styles.hero} aria-labelledby="marketing-hero-title">
          <img className={styles.heroAtmosphere} src="/marketing/hero-court-glow.png" alt="" aria-hidden="true" />
          <div className={styles.fireball} aria-hidden="true"><span /></div>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Gestão de Beach Tennis</span>
            <h1 id="marketing-hero-title">Da inscrição ao pódio,<br />tudo em uma plataforma.</h1>
            <p>Crie torneios e circuitos, organize participantes e quadras, acompanhe partidas e publique rankings com uma experiência profissional.</p>
            <div className={styles.heroActions}>
              <button className={styles.primaryButton} type="button" onClick={onSignup}>Começar agora</button>
              <button className={styles.secondaryButton} type="button" onClick={onLogin}>Já tenho conta</button>
            </div>
            <div className={styles.heroHighlights}>
              <span><Trophy aria-hidden="true" />Torneios e copas</span>
              <span><BarChart3 aria-hidden="true" />Ranking em tempo real</span>
              <span><Volume2 aria-hidden="true" />Chamada de jogos por voz</span>
            </div>
          </div>

          <div className={styles.heroPreview} aria-label="Exemplo visual de partida e ranking">
            <div className={styles.liveMatch}>
              <div className={styles.previewHeading}>
                <span><i /> Em jogo</span>
                <strong>Quadra 3</strong>
              </div>
              <div className={styles.scoreboard}>
                <div className={styles.team}><span className={styles.avatarPair}><b>JP</b><b>LL</b></span><small>João Pedro<br />Lucas Lima</small></div>
                <strong>4</strong><em>×</em><strong>2</strong>
                <div className={styles.team}><span className={styles.avatarPair}><b>RN</b><b>GS</b></span><small>Rafael Nunes<br />Gabriel Souza</small></div>
              </div>
            </div>
            <div className={styles.rankingPreview}>
              <div className={styles.previewHeading}><strong>Ranking</strong><button type="button" onClick={onExplore}>Ver ranking completo <ChevronRight aria-hidden="true" /></button></div>
              <ol>
                {rankingRows.map(([name, points], index) => <li key={name}><b>{index + 1}</b><span>{name}</span><strong>{points}</strong></li>)}
              </ol>
            </div>
          </div>
        </section>

        <section className={styles.section} id="como-funciona" aria-labelledby="how-title">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>Como funciona</span>
            <h2 id="how-title">Da criação do perfil ao resultado final</h2>
          </div>
          <div className={styles.steps}>
            {steps.map(({ number, title, description, Icon }, index) => (
              <article key={title}>
                <div className={styles.stepIcon}><b>{number}</b><Icon aria-hidden="true" /></div>
                <h3>{number}. {title}</h3>
                <p>{description}</p>
                {index < steps.length - 1 ? <ChevronRight className={styles.stepArrow} aria-hidden="true" /> : null}
              </article>
            ))}
          </div>
          <div className={styles.workflowPreview}>
            <div><span>Torneios</span><strong>Seus eventos organizados</strong><small><Trophy /> Inscrições abertas</small></div>
            <ArrowRight aria-hidden="true" />
            <div><span>Quadras e partidas</span><strong>Rodadas em andamento</strong><small><CalendarCheck2 /> Quadra definida</small></div>
            <ArrowRight aria-hidden="true" />
            <div><span>Ranking</span><strong>Resultados atualizados</strong><small><BarChart3 /> Classificação publicada</small></div>
          </div>
          <button className={styles.primaryButton} type="button" onClick={onSignup}>Começar agora</button>
        </section>

        <section className={styles.section} id="planos" aria-labelledby="plans-title">
          <div className={styles.sectionHeaderCentered}>
            <span className={styles.eyebrow}>Planos</span>
            <h2 id="plans-title">Planos para cada momento</h2>
            <p>Participe gratuitamente. Organize com recursos profissionais.</p>
          </div>
          <div className={styles.planGrid}>
            {plans.map(({ title, subtitle, Icon, items, action, actionType }) => (
              <article key={title}>
                <div className={styles.planTitle}><span><Icon aria-hidden="true" /></span><div><h3>{title}</h3><strong>{subtitle}</strong></div></div>
                <ul>{items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>
                <button className={styles.primaryButton} type="button" onClick={actionType === "signup" ? onSignup : onExplore}>{action}</button>
              </article>
            ))}
          </div>
          <p className={styles.planNote}><Check aria-hidden="true" /> Os detalhes da assinatura são apresentados antes da contratação.</p>
        </section>

        <section className={`${styles.section} ${styles.sportsSection}`} id="modalidades" aria-labelledby="sports-title">
          <div className={styles.sectionHeaderCentered}>
            <span className={styles.eyebrow}>Modalidades</span>
            <h2 id="sports-title">Uma plataforma para esportes de rede e areia</h2>
            <p>Começamos pelo Beach Tennis e evoluímos com foco em organização profissional.</p>
          </div>
          <div className={styles.sportsGrid}>
            <article className={styles.activeSport}>
              <img className={styles.sportImage} src="/marketing/sport-beach-tennis.png" alt="" aria-hidden="true" />
              <span className={styles.availableBadge}>Disponível</span>
              <div><h3>Beach Tennis</h3><p>Torneios <i /> Duplas <i /> Quadras <i /> Partidas <i /> Ranking</p></div>
              <button className={styles.primaryButton} type="button" onClick={onExplore}>Explorar Beach Tennis <ArrowRight aria-hidden="true" /></button>
            </article>
            <div className={styles.upcomingSports}>
              {upcomingSports.map((sport) => (
                <article key={sport.name}>
                  <img className={styles.sportImage} src={sport.image} alt="" aria-hidden="true" loading="lazy" />
                  <span>Em breve</span>
                  <h3>{sport.name}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.contactSection} id="contato" aria-labelledby="contact-title">
          <div className={styles.contactCopy}>
            <span className={styles.eyebrow}>Contato</span>
            <h2 id="contact-title">Vamos conversar?</h2>
            <p>Envie sua dúvida, sugestão ou solicitação para a equipe Torneio 360.</p>
            <form onSubmit={submitContact}>
              <label><span>Nome</span><input name="name" type="text" placeholder="Nome" required /></label>
              <label><span>E-mail</span><input name="email" type="email" placeholder="E-mail" required /></label>
              <label><span>Assunto</span><input name="subject" type="text" placeholder="Assunto" required /></label>
              <label><span>Mensagem</span><textarea name="message" placeholder="Mensagem" required /></label>
              <button className={styles.primaryButton} type="submit">Abrir e-mail para enviar</button>
              <p className={styles.contactDeliveryNote}><Mail aria-hidden="true" /> A mensagem será preparada para torneio360@gmail.com no seu aplicativo de e-mail.</p>
            </form>
          </div>
          <aside className={styles.supportPanel}>
            <h3><MessageCircle aria-hidden="true" /> Precisa de ajuda?</h3>
            <SupportLink id="whatsapp" />
            <SupportLink id="instagram" />
            <SupportLink id="email" />
            <p><Mail aria-hidden="true" /> Responderemos pelo canal informado.</p>
          </aside>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><BeachLogo layout="horizontal" /></div>
        <nav aria-label="Navegação do rodapé">
          <NavLink section="como-funciona" activeSection={activeSection}>Como funciona</NavLink>
          <NavLink section="planos" activeSection={activeSection}>Planos</NavLink>
          <NavLink section="modalidades" activeSection={activeSection}>Modalidades</NavLink>
          <NavLink section="contato" activeSection={activeSection}>Contato</NavLink>
        </nav>
        <p>© 2026 Torneio 360. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
