import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
  Trophy,
  UserRound,
} from "lucide-react";
import "../../styles/54-public-auth-profiles.css";
import "../../styles/66-auth-experience.css";
import { NoticeModal } from "../dialogs/ConfirmationDialogs.jsx";
import { BeachLogo, Info, PlanCard, PlatformSupportLinks } from "../appShell/EntryPresentation.jsx";
import { getBrazilTodayISO } from "../../domain/dateTime.mjs";
import {
  getAuthErrorMessage,
  isEmailNotConfirmedError,
  isProfilePendingEmailConfirmation,
  isUserAlreadyRegisteredError,
  isValidBrazilianTaxId,
  isValidEmail,
  normalizeEmail,
} from "../../domain/authValidation.mjs";
import { getAuthRedirectUrl } from "../../domain/authNavigation.mjs";
import { validatePublicTextFields } from "../../domain/contentModeration.mjs";

async function resendEmailConfirmation(supabase, email) {
  return supabase.auth.resend({
    type: "signup",
    email: normalizeEmail(email),
    options: {
      emailRedirectTo: getAuthRedirectUrl("confirm"),
    },
  });
}

function AuthSignupFields({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  birthDate,
  setBirthDate,
  taxIdType,
  setTaxIdType,
  taxId,
  setTaxId,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  communityGuidelinesAccepted,
  setCommunityGuidelinesAccepted,
  privacyNoticeAccepted,
  setPrivacyNoticeAccepted,
}) {
  return (
    <div className="authSignupGrid">
      <section className="authSignupColumn" aria-labelledby="signup-personal-title">
        <div className="authColumnTitle">
          <UserRound aria-hidden="true" />
          <div>
            <strong id="signup-personal-title">Dados pessoais</strong>
            <small>Informações para identificar sua conta.</small>
          </div>
        </div>

        <div className="twoCols formTwoCols">
          <div className="authFieldBlock">
            <label htmlFor="signup-first-name">Nome</label>
            <input
              id="signup-first-name"
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Digite seu nome"
            />
          </div>

          <div className="authFieldBlock">
            <label htmlFor="signup-last-name">Sobrenome</label>
            <input
              id="signup-last-name"
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Digite seu sobrenome"
            />
          </div>
        </div>

        <div className="authFieldBlock">
          <label htmlFor="signup-birth-date">Data de nascimento</label>
          <div className="authInputShell">
            <CalendarDays aria-hidden="true" />
            <input
              id="signup-birth-date"
              className="clickableDateInput"
              type="date"
              autoComplete="bday"
              value={birthDate}
              onClick={(event) => event.currentTarget.showPicker?.()}
              onFocus={(event) => event.currentTarget.showPicker?.()}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </div>
        </div>

        <div className="authDocumentGrid">
          <div className="authFieldBlock">
            <label htmlFor="signup-document-type">Documento</label>
            <select
              id="signup-document-type"
              value={taxIdType}
              onChange={(event) => {
                setTaxIdType(event.target.value);
                setTaxId("");
              }}
            >
              <option value="cpf">CPF da pessoa</option>
              <option value="cnpj">CNPJ da organização</option>
            </select>
          </div>

          <div className="authFieldBlock">
            <label htmlFor="signup-tax-id">{taxIdType === "cnpj" ? "CNPJ" : "CPF"}</label>
            <input
              id="signup-tax-id"
              inputMode="numeric"
              autoComplete="off"
              value={taxId}
              maxLength={taxIdType === "cnpj" ? 18 : 14}
              onChange={(event) => setTaxId(event.target.value)}
              placeholder={taxIdType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
            />
          </div>
        </div>

        <small className="authSensitiveDataHint">
          Seu documento é validado com segurança e não aparece no perfil público.
        </small>
      </section>

      <section className="authSignupColumn" aria-labelledby="signup-security-title">
        <div className="authColumnTitle">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong id="signup-security-title">Segurança da conta</strong>
            <small>Dados usados para entrar e proteger seu acesso.</small>
          </div>
        </div>

        <div className="authFieldBlock">
          <label htmlFor="signup-email">E-mail</label>
          <div className="authInputShell">
            <Mail aria-hidden="true" />
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@exemplo.com"
            />
          </div>
        </div>

        <div className="authFieldBlock">
          <label htmlFor="signup-password">Senha</label>
          <div className="authInputShell">
            <LockKeyhole aria-hidden="true" />
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo de 8 caracteres"
            />
          </div>
        </div>

        <div className="authFieldBlock">
          <label htmlFor="signup-confirm-password">Repita a senha</label>
          <div className="authInputShell">
            <LockKeyhole aria-hidden="true" />
            <input
              id="signup-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Digite a senha novamente"
            />
          </div>
        </div>
      </section>

      <section className="authLegalAgreements" aria-label="Concordâncias para criar a conta">
        <div className="authLegalItem">
          <strong>Compromisso de convivência</strong>
          <small>Respeito à dignidade humana e às regras de convivência da comunidade.</small>
          <label>
            <input
              type="checkbox"
              checked={communityGuidelinesAccepted}
              onChange={(event) => setCommunityGuidelinesAccepted(event.target.checked)}
            />
            <span>Li e concordo com os Termos de uso e as Diretrizes da comunidade.</span>
          </label>
        </div>

        <div className="authLegalItem">
          <strong>Aviso de privacidade</strong>
          <small>Seus dados têm acesso restrito e são usados apenas para as finalidades da plataforma.</small>
          <label>
            <input
              type="checkbox"
              checked={privacyNoticeAccepted}
              onChange={(event) => setPrivacyNoticeAccepted(event.target.checked)}
            />
            <span>Estou ciente dos meus direitos de acesso, correção e solicitação de exclusão.</span>
          </label>
        </div>

        <p>Textos de homologação sujeitos à revisão jurídica antes do lançamento oficial.</p>
      </section>
    </div>
  );
}

export function EmailConfirmationPendingScreen({ email, onRefresh, supabase, onLogout }) {
  const [notice, setNotice] = useState(null);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = setTimeout(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    if (!email || resending || cooldown > 0) return;

    setResending(true);
    try {
      const { error } = await resendEmailConfirmation(supabase, email);

      if (error) {
        setNotice({
          type: "error",
          title: "Não foi possível reenviar",
          message: getAuthErrorMessage(error, "Tente novamente em alguns minutos."),
        });
        return;
      }

      setCooldown(60);
      setNotice({
        type: "success",
        title: "E-mail reenviado",
        message: "Abra o link recebido para confirmar seu endereço e ativar sua conta gratuita.",
      });
    } catch (error) {
      console.error(error);
      setNotice({
        type: "error",
        title: "Não foi possível reenviar",
        message: "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setResending(false);
    }
  }

  async function handleCheck() {
    if (checking) return;

    setChecking(true);
    try {
      const nextProfile = await onRefresh();

      if (!nextProfile || isProfilePendingEmailConfirmation(nextProfile)) {
        setNotice({
          type: "warning",
          title: "Confirmação ainda pendente",
          message: "Depois de abrir o link no e-mail, toque em “Já confirmei meu e-mail” novamente.",
        });
      }
    } catch (error) {
      console.error(error);
      setNotice({
        type: "error",
        title: "Não foi possível atualizar",
        message: "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="authStatusPage">
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />

      <section className="authStatusCard" aria-labelledby="email-confirmation-title">
        <div className="authStatusIcon" aria-hidden="true">✉️</div>
        <span className="authStatusEyebrow">Confirmação necessária</span>
        <h1 id="email-confirmation-title">Confirme seu e-mail</h1>
        <p>
          Enviamos um link de confirmação para <strong>{email || "seu e-mail"}</strong>. O teste Premium de {7} dias só começa depois dessa confirmação.
        </p>

        <div className="authStatusActions">
          <button type="button" onClick={handleCheck} disabled={checking}>
            {checking ? "Conferindo..." : "Já confirmei meu e-mail"}
          </button>
          <button type="button" className="secondaryBtn" onClick={handleResend} disabled={resending || cooldown > 0}>
            {resending ? "Reenviando..." : cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar confirmação"}
          </button>
        </div>

        <button type="button" className="linkBtn authStatusSignOut" onClick={onLogout}>
          Sair da conta
        </button>
      </section>
    </div>
  );
}


export default function LoginScreen({
  supabase,
  tagline = "Gestão inteligente de torneios",
  initialMode = "login",
  initialNotice = null,
  recoverySession = null,
  onRecoveryFinished,
  onRecoveryExit,
  onBack,
  embedded = false,
} = {}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [taxIdType, setTaxIdType] = useState("cpf");
  const [taxId, setTaxId] = useState("");
  const [communityGuidelinesAccepted, setCommunityGuidelinesAccepted] = useState(false);
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState(initialMode);
  const [notice, setNotice] = useState(() => {
    if (!initialNotice) return null;
    return typeof initialNotice === "string"
      ? { type: "error", title: "Link inválido ou expirado", message: initialNotice }
      : initialNotice;
  });
  const [submitting, setSubmitting] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timer = setTimeout(() => setResendCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (mode !== "resetPassword") return undefined;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("acesso")?.scrollIntoView({ behavior: "auto", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  function showNotice(type, title, message) {
    setNotice({ type, title, message });
  }

  function resetForm() {
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setTaxIdType("cpf");
    setTaxId("");
    setCommunityGuidelinesAccepted(false);
    setPrivacyNoticeAccepted(false);
    setEmail("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function changeMode(nextMode) {
    if (mode === "resetPassword" && onRecoveryExit) {
      void onRecoveryExit();
      return;
    }

    setNotice(null);
    setMode(nextMode);
  }

  async function handleResendVerification() {
    const emailToResend = normalizeEmail(pendingVerificationEmail || email);
    if (!emailToResend || resendCooldown > 0) return;

    setSubmitting(true);
    try {
      const { error } = await resendEmailConfirmation(supabase, emailToResend);

      if (error) {
        showNotice("error", "Não foi possível reenviar", getAuthErrorMessage(error, "Tente novamente em alguns minutos."));
        return;
      }

      setResendCooldown(60);
      showNotice("success", "E-mail reenviado", "Confira sua caixa de entrada e abra o link para ativar sua conta.");
    } catch (error) {
      console.error(error);
      showNotice("error", "Não foi possível reenviar", "Verifique sua conexão e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (submitting) return;

    const normalizedEmail = normalizeEmail(email);

    if (mode === "resetPassword") {
      if (!recoverySession?.access_token) {
        showNotice("error", "Link inválido ou expirado", "Peça um novo link de recuperação para trocar sua senha.");
        return;
      }

      if (!newPassword) {
        showNotice("warning", "Nova senha obrigatória", "Digite sua nova senha para continuar.");
        return;
      }

      if (newPassword.length < 8) {
        showNotice("warning", "Senha muito curta", "Use pelo menos 8 caracteres na nova senha.");
        return;
      }

      if (newPassword !== confirmPassword) {
        showNotice("warning", "Senhas diferentes", "Repita exatamente a nova senha para confirmar.");
        return;
      }
    } else {
      if (!normalizedEmail) {
        showNotice("warning", "E-mail obrigatório", "Informe seu e-mail para continuar.");
        return;
      }

      if (!isValidEmail(normalizedEmail)) {
        showNotice("warning", "E-mail inválido", "Informe um e-mail válido para continuar.");
        return;
      }

      if (mode !== "forgotPassword" && !password) {
        showNotice("warning", "Senha obrigatória", "Digite sua senha para continuar.");
        return;
      }

      if (mode === "signup") {
        if (!firstName.trim()) {
          showNotice("warning", "Nome obrigatório", "Informe seu nome para criar a conta.");
          return;
        }

        if (!lastName.trim()) {
          showNotice("warning", "Sobrenome obrigatório", "Informe seu sobrenome para criar a conta.");
          return;
        }

        const nameModeration = validatePublicTextFields({ firstName, lastName });
        if (!nameModeration.allowed) {
          showNotice("warning", "Nome não permitido", nameModeration.message);
          return;
        }

        if (!birthDate) {
          showNotice("warning", "Data de nascimento obrigatória", "Informe sua data de nascimento.");
          return;
        }

        if (birthDate > getBrazilTodayISO()) {
          showNotice("warning", "Data de nascimento inválida", "A data de nascimento não pode estar no futuro.");
          return;
        }

        if (!isValidBrazilianTaxId(taxId, taxIdType)) {
          showNotice(
            "warning",
            `${taxIdType === "cnpj" ? "CNPJ" : "CPF"} inválido`,
            `Confira os números do ${taxIdType === "cnpj" ? "CNPJ" : "CPF"} antes de continuar.`
          );
          return;
        }

        if (!communityGuidelinesAccepted) {
          showNotice("warning", "Diretrizes obrigatórias", "Confirme o compromisso com uma convivência respeitosa e sem discriminação.");
          return;
        }

        if (!privacyNoticeAccepted) {
          showNotice("warning", "Aviso de privacidade", "Leia e aceite o aviso sobre o uso dos dados necessários ao cadastro.");
          return;
        }

        if (password.length < 8) {
          showNotice("warning", "Senha muito curta", "Use uma senha com pelo menos 8 caracteres.");
          return;
        }

        if (password !== confirmPassword) {
          showNotice("warning", "Senhas diferentes", "Repita exatamente a senha para confirmar.");
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      if (mode === "forgotPassword") {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: getAuthRedirectUrl("recovery"),
        });

        if (error) {
          showNotice("error", "Não foi possível enviar", getAuthErrorMessage(error, "Tente novamente em alguns minutos."));
        } else {
          showNotice(
            "success",
            "Confira seu e-mail",
            "Se existir uma conta para esse endereço, você receberá um link para criar uma nova senha."
          );
          setMode("login");
        }
        return;
      }

      if (mode === "resetPassword") {
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData?.user) {
          showNotice("error", "Link inválido ou expirado", "Peça um novo link de recuperação para trocar sua senha.");
          return;
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
          showNotice("error", "Senha não alterada", getAuthErrorMessage(error, "Abra novamente o link recebido por e-mail e tente de novo."));
        } else {
          resetForm();
          await onRecoveryFinished?.({
            type: "success",
            title: "Senha alterada",
            message: "Sua senha foi alterada. Entre com a nova senha para continuar.",
          });
        }
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          if (isEmailNotConfirmedError(error)) {
            setPendingVerificationEmail(normalizedEmail);
            showNotice(
              "warning",
              "Confirme seu e-mail",
              "Abra o link enviado para seu e-mail antes de entrar. Se precisar, reenviamos a confirmação abaixo."
            );
          } else {
            showNotice("error", "Não foi possível entrar", "Confira o e-mail e a senha informados e tente novamente.");
          }
        }
        return;
      }

      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl("confirm"),
          data: {
            name: fullName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            birth_date: birthDate,
            // Toda conta começa como conta gratuita. Organizar eventos é uma
            // permissão de assinatura, não um tipo diferente de usuário.
            account_type: "athlete",
          },
        },
      });

      if (error) {
        console.error(error);

        if (isUserAlreadyRegisteredError(error)) {
          setFirstName("");
          setLastName("");
          setBirthDate("");
          setPassword("");
          setConfirmPassword("");
          setPendingVerificationEmail("");
          setMode("login");
          showNotice(
            "warning",
            "Este e-mail já possui uma conta",
            "Digite sua senha para entrar. Se não lembrar, clique em “Esqueci minha senha?”."
          );
          return;
        }

        showNotice("error", "Cadastro não concluído", getAuthErrorMessage(error, "Verifique os dados e tente novamente."));
        return;
      }

      const existingAccountResponse = Array.isArray(data?.user?.identities) && data.user.identities.length === 0;
      const confirmationRequired = !data?.session;

      setPendingVerificationEmail(normalizedEmail);
      resetForm();
      setMode("login");
      showNotice(
        "success",
        confirmationRequired || existingAccountResponse ? "Confira seu e-mail" : "Conta criada",
        confirmationRequired || existingAccountResponse
          ? "Se este endereço puder receber confirmações, enviamos um link. Abra-o para ativar sua conta."
          : "Sua conta e seu perfil foram criados."
      );
    } catch (error) {
      console.error(error);
      showNotice("error", "Não foi possível concluir", "Verifique sua conexão e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`landingPage unifiedLoginPage authExperiencePage${embedded ? " embeddedLoginPage" : ""}`}>
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />

      <header className="landingHeader">
        <div className="landingBrand">
          <button type="button" className="authLogoButton" onClick={onBack} aria-label="Voltar ao início">
            <img src="/marketing/torneio360-logo-clean-v1.png" alt="Torneio 360" />
          </button>
        </div>

        <nav className="landingNav">
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <a href="#modalidades">Modalidades</a>
          <a href="#contato">Contato</a>
        </nav>

        <div className="landingHeaderActions">
          <button
            type="button"
            className="secondaryBtn"
            onClick={() => {
              changeMode("login");
              setTimeout(() => {
                document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            }}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              changeMode("signup");
              setTimeout(() => {
                document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            }}
          >
            Criar conta
          </button>
        </div>

        <div className="authHeaderActions">
          {mode === "signup" ? (
            <>
              <span>Já tenho conta</span>
              <button type="button" onClick={() => changeMode("login")}>Entrar</button>
            </>
          ) : (
            <button type="button" className="authBackButton" onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              Voltar para a apresentação
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="landingTrialBanner" aria-labelledby="landing-trial-title">
          <div className="landingTrialSeal" aria-hidden="true">
            <strong>1</strong>
            <span>conta única</span>
          </div>

          <div className="landingTrialCopy">
            <span>Conta Torneio360</span>
            <h2 id="landing-trial-title">Uma conta para participar e organizar</h2>
            <p>Crie seu perfil gratuitamente. A organização de torneios e circuitos é liberada por assinatura.</p>
            <div className="landingTrialBenefits" aria-label="Benefícios do teste grátis">
              <span>Foto, capa e apresentação</span>
              <span>Galeria pessoal com até 6 fotos</span>
              <span>3 dias de gestão quando ativar a organização</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              changeMode("signup");
              document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Criar conta
          </button>
        </section>

        <section className="landingHero">
          <div className="heroContent">
            <div className="heroBadge">
              🎾 Gestão de torneios com identidade profissional
            </div>

            <h1>Sua organização com torneios, rankings e experiência profissional</h1>

            <p>
              Monte torneios de Beach Tennis com visual moderno, controle de jogos, rankings automáticos, chamada por voz e um perfil público pronto para atletas e organizadores.
            </p>

            <div className="heroActions">
              <button
                type="button"
                onClick={() => {
                  changeMode("signup");
                  document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Começar agora
              </button>

              <button
                type="button"
                className="secondaryBtn"
                onClick={() => {
                  changeMode("login");
                  document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Já tenho conta
              </button>
            </div>

            <div className="heroHighlights">
              <span>🏟️ Gestão para organizações</span>
              <span>🏆 Torneios e copas</span>
              <span>📊 Ranking em tempo real</span>
            </div>
          </div>

          <div className="heroVisual">
            <div className="sandCard">
              <div className="sandSun"></div>

              <div className="racketMark">
                <span>🎾</span>
              </div>

              <div className="mockPanel">
                <div className="mockTop">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

                <div className="mockTitle">Organização Central · Rodada 1</div>

                <div className="mockGame">
                  <strong>Quadra 1</strong>
                  <p>João + Pedro  4 x 2  Lucas + Marcos</p>
                </div>

                <div className="mockGame">
                  <strong>Quadra 2</strong>
                  <p>Ana + Carla  3 x 4  Júlia + Fernanda</p>
                </div>

                <button type="button" className="mockVoiceBtn">
                  🔊 Anunciar próximos jogos
                </button>
              </div>
            </div>
          </div>
        </section>

                <section id="como-funciona" className="landingSection">
          <div className="sectionIntro">
            <span>Como funciona</span>
            <h2>Da inscrição ao pódio, tudo em uma plataforma</h2>
            <p>
              A plataforma foi pensada para a realidade de quem organiza torneios de Beach Tennis e precisa de agilidade, clareza e apresentação profissional.
            </p>
          </div>

          <div className="stepsGrid">
            <div className="stepCard">
              <div>1</div>
              <h3>Cadastre a organização</h3>
              <p>Use sua conta para centralizar os torneios da organização, clube ou projeto esportivo.</p>
            </div>

            <div className="stepCard">
              <div>2</div>
              <h3>Escolha o formato</h3>
              <p>
                Selecione Super 6, Super 8, Super 12, modalidades mistas, Simples, Copa 18, Torneio modelo Campeonato Cearense ou Modelo Torneio 360 conforme a realidade do evento.
              </p>
            </div>

            <div className="stepCard">
              <div>3</div>
              <h3>Gere a tabela</h3>
              <p>Informe os participantes, sorteie nomes e deixe o sistema montar os jogos.</p>
            </div>

            <div className="stepCard">
              <div>4</div>
              <h3>Entregue uma experiência premium</h3>
              <p>Preencha placares, acompanhe rankings e anuncie jogos com aparência profissional.</p>
            </div>
          </div>
        </section>

        <section className="landingSection featuresSection">
          <div className="sectionIntro">
            <span>Recursos</span>
            <h2>Tudo que sua organização precisa para rodar campeonatos</h2>
          </div>

          <div className="featuresGrid">
            <div className="featureCard">
              <span>🎲</span>
              <h3>Sorteio automático</h3>
              <p>Embaralhe nomes e duplas com animação antes de gerar a tabela.</p>
            </div>

            <div className="featureCard">
              <span>📅</span>
              <h3>Tabelas automáticas</h3>
              <p>O sistema gera rodadas conforme o formato escolhido.</p>
            </div>

            <div className="featureCard">
              <span>📊</span>
              <h3>Ranking configurável</h3>
              <p>Escolha a ordem dos critérios entre vitórias, total de games e saldo de games.</p>
            </div>

            <div className="featureCard">
              <span>🔊</span>
              <h3>Chamada de jogos</h3>
              <p>Anuncie rodada, quadra e nomes dos atletas usando voz pelo navegador.</p>
            </div>

            <div className="featureCard">
              <span>💾</span>
              <h3>Salvamento automático</h3>
              <p>Os dados ficam salvos automaticamente na conta do organizador.</p>
            </div>

            <div className="featureCard">
              <span>🏆</span>
              <h3>Copa Premium</h3>
              <p>Formato de Copa com 18 duplas, grupos, chaves finais e disputa paralela.</p>
            </div>
          </div>
        </section>

        <section id="planos" className="landingSection">
          <div className="sectionIntro">
            <span>Planos</span>
            <h2>Escolha o plano ideal para seus torneios</h2>
          </div>

          <div className="plansGrid plansGridThree landingPlans">
            <PlanCard
              title="Basic"
              tag="Entrada"
              price="R$ 19,90"
              text="Para começar com torneios individuais e mistos."
              items={[
                "Super 8",
                "Super 12",
                "Super 10 mista",
                "Super 12 mista",
                "Super 16 mista",
                "Super 20 mista",
                "Gerencie apenas 1 campeonato por vez",
                "Sorteio automático",
              ]}
            />

            <PlanCard
              title="Pro"
              tag="Organizador"
              badge="Mais usado"
              price="R$ 39,90"
              text="Para organizadores que precisam de modalidades com duplas fixas."
              items={[
                "Super 6 (dupla fixa)",
                "Super 8",
                "Super 8 (dupla fixa)",
                "Super 10 (dupla fixa)",
                "Super 12 (dupla fixa)",
                "Super 12",
                "Super 10 mista",
                "Super 12 mista",
                "Super 16 mista",
                "Super 20 mista",
                "Gerencie vários campeonatos ao mesmo tempo",
              ]}
            />

            <PlanCard
              title="Premium"
              tag="Completo"
              price="R$ 59,90"
              text="Para quem quer liberar todos os formatos disponíveis."
              items={[
                "Super 6 (dupla fixa)",
                "Super 8",
                "Super 8 (dupla fixa)",
                "Super 10 (dupla fixa)",
                "Super 12 (dupla fixa)",
                "Super 12",
                "Super 10 mista",
                "Super 12 mista",
                "Super 16 mista",
                "Super 20 mista",
                "Simples (1 contra 1 por jogo)",
                "Copa - 18 duplas",
                "Torneio modelo Campeonato Cearense",
                "Gerencie vários campeonatos ao mesmo tempo",
              ]}
            />
          </div>
        </section>

        <section id="modalidades" className="landingSection">
          <div className="sectionIntro">
            <span>Modalidades</span>
            <h2>Formatos disponíveis na plataforma</h2>
            <p>Clique em “Como funciona?” para ver a explicação de cada formato.</p>
          </div>

          <div className="modalitiesGrid landingModalities">
            <Info
              title="Super 6 (dupla fixa)"
              text="Formato com 6 duplas já definidas antes do início do campeonato. Diferente das modalidades aleatórias, aqui os parceiros permanecem juntos do começo ao fim. O sistema gera automaticamente os confrontos entre as duplas, organiza a sequência de jogos e calcula a classificação geral pelos placares lançados. É indicado quando os atletas já se inscrevem em dupla e querem disputar como equipe fixa."
            />

            <Info
              title="Super 8"
              text="Formato individual com 8 participantes, ideal para torneios rápidos. Cada atleta joga com parceiros diferentes ao longo das rodadas, evitando que uma dupla fixa determine todo o resultado. O sistema monta os confrontos automaticamente, organiza as quadras, registra os placares e calcula o ranking individual. No final, vence quem tiver melhor desempenho geral conforme os critérios definidos, como vitórias, total de games e saldo de games."
            />

            <Info
              title="Super 8 (dupla fixa)"
              text="Formato com 8 duplas fixas, indicado para torneios maiores em que cada equipe permanece igual durante toda a competição. O sistema organiza os jogos entre as duplas, distribui as rodadas e registra os resultados. A classificação é por dupla, não individual. Conforme os placares são preenchidos, o ranking geral é atualizado com vitórias, total de games e saldo de games, ajudando o organizador a acompanhar quem está avançando melhor."
            />

            <Info
              title="Super 10 (dupla fixa)"
              text="Formato com 10 duplas fixas. O sorteio distribui as duplas nos números de 1 a 10 e o chaveamento numérico permanece fixo. São 9 rodadas, 5 jogos por rodada e 45 partidas no total, com cada dupla enfrentando todas as demais exatamente uma vez."
            />

            <Info
              title="Super 12 (dupla fixa)"
              text="Formato com 12 duplas fixas. O sorteio distribui as duplas nos números de 1 a 12 e o chaveamento numérico permanece fixo. São 11 rodadas, 6 jogos por rodada e 66 partidas no total, com cada dupla enfrentando todas as demais exatamente uma vez."
            />

            <Info
              title="Super 12"
              text="Formato individual com 12 participantes escolhidos livremente pelo organizador, sem separação por categoria esportiva. São 11 rodadas em 3 quadras, sem descanso: cada atleta forma dupla uma vez com cada um dos outros participantes e enfrenta cada adversário exatamente duas vezes. Todos aparecem juntos em um único ranking geral."
            />

            <Info
              title="Super 10 mista"
              text="Formato com 5 homens e 5 mulheres. São 5 rodadas, 2 jogos por rodada, e em cada rodada descansam 1 homem e 1 mulher. Todos jogam 4 partidas e descansam 1 vez. O ranking é separado masculino e feminino."
            />

            <Info
              title="Super 12 mista"
              text="Formato misto com 12 participantes: 6 homens e 6 mulheres. Primeiro, os atletas são cadastrados e sorteados. Depois, o sistema combina os participantes para formar duplas mistas em diferentes rodadas, mantendo equilíbrio entre homens e mulheres. Cada jogador participa de jogos com combinações variadas, e o desempenho é calculado individualmente. É uma boa opção para eventos sociais e competitivos com rotação de parceiros."
            />

            <Info
              title="Super 16 mista"
              text="Formato misto com 16 participantes: 8 homens e 8 mulheres. Funciona como uma versão maior do Super 12 mista, com mais atletas, mais jogos e maior movimentação de quadras. O sistema monta as duplas mistas de forma organizada, distribui as partidas e permite preencher os placares rodada por rodada. O ranking é individual, ou seja, cada atleta pontua pelo próprio desempenho, mesmo jogando com parceiros diferentes durante o torneio."
            />

            <Info
              title="Super 20 mista"
              text="Formato misto com 20 participantes: 10 homens e 10 mulheres. São 10 rodadas em 5 quadras. Cada homem forma dupla exatamente uma vez com cada mulher, e vice-versa, em uma tabela matemática fixa que reduz ao máximo a repetição de adversários. O desempenho é individual, com rankings masculino e feminino."
            />

            <Info
              title="Simples (1 contra 1 por jogo)"
              text="Formato individual para 4, 6, 8, 10, 12 ou 14 jogadores, sem formação de duplas. O organizador escolhe a quantidade e o sistema monta automaticamente todos contra todos, com cada atleta enfrentando cada adversário exatamente uma vez e sem folgas nas rodadas. Os placares alimentam um ranking geral individual por vitórias, total de games e saldo de games."
            />

            <Info
              title="Copa - 18 duplas"
              text="Formato de Copa com 18 duplas, dividido em 6 grupos de 3 duplas. Cada grupo joga sua fase classificatória, e o sistema calcula a classificação com base nos critérios definidos. Os melhores avançam para a chave principal; os 2 melhores gerais podem receber BYE, entrando em fase mais avançada. Também há disputa paralela para duplas específicas, como terceiros colocados, permitindo manter mais atletas em atividade. É um formato ideal para torneios grandes, com organização mais profissional e várias fases."
            />

            <Info
              title="Torneio modelo Campeonato Cearense"
              text="Formato para 4 a 32 duplas, com fase de grupos, Eliminatória Principal para os dois primeiros de cada grupo e Disputa Paralela para os demais. As comparações entre grupos usam percentual de vitórias, saldo médio e média de games para equilibrar grupos de tamanhos diferentes."
            />

            <Info
              title="Modelo Torneio 360"
              text="Na fase de grupos, classifica por vitórias, saldo de games, confronto direto, coeficiente e sorteio; o Total de Games fica apenas como estatística. As duplas derrotadas somente na primeira fase efetivamente jogada da Eliminatória Principal também entram na Disputa Paralela, com prioridade na montagem da nova chave."
            />
          </div>
        </section>

        <section id="contato" className="landingSection landingSupportSection">
          <div className="landingSupportShell">
            <div className="landingSupportIntro">
              <span>Atendimento</span>
              <h2>Fale diretamente com o Torneio360</h2>
              <p>Conheça os planos, regularize seu acesso ou peça ajuda pelo canal que preferir.</p>
              <div className="landingSupportHighlight">
                <MessageCircle aria-hidden="true" />
                <span><strong>Precisa falar agora?</strong> O WhatsApp é o caminho mais rápido.</span>
              </div>
            </div>

            <PlatformSupportLinks className="landingSupportContacts" />
          </div>
        </section>

        <section id="acesso" className={`landingAccessSection authExperienceSection authMode-${mode}`}>
          <div className="accessText">
            <span>{mode === "signup" ? "PERFIL GRATUITO" : "BEM-VINDO DE VOLTA"}</span>
            <h2>
              {mode === "login"
                ? "Entre e continue de onde parou."
                : mode === "signup"
                  ? "Uma conta para toda a sua jornada esportiva."
                  : mode === "forgotPassword"
                    ? "Recupere seu acesso com segurança."
                    : "Crie uma senha nova e segura."}
            </h2>
            <p>
              {mode === "login"
                ? "Acesse seu perfil, suas inscrições e os recursos liberados para sua conta."
                : mode === "signup"
                  ? "Participe gratuitamente e organize torneios quando quiser ativar uma assinatura."
                  : mode === "forgotPassword"
                    ? "Informe seu e-mail para receber o link de redefinição."
                    : "Crie uma nova senha com pelo menos 8 caracteres para voltar a acessar sua conta."}
            </p>

            <div className={mode === "signup" ? "authStoryBenefits authStoryBenefitsStack" : "authStoryBenefits"}>
              <article>
                <UserRound aria-hidden="true" />
                <div>
                  <strong>Perfil de atleta</strong>
                  {mode === "signup" ? <small>Gratuito para participar de torneios e eventos.</small> : null}
                </div>
              </article>
              <article>
                <CalendarCheck aria-hidden="true" />
                <div>
                  <strong>Inscrições e convites</strong>
                  {mode === "signup" ? <small>Receba convites e acompanhe suas inscrições.</small> : null}
                </div>
              </article>
              <article>
                <Trophy aria-hidden="true" />
                <div>
                  <strong>{mode === "signup" ? "Organização por assinatura" : "Torneios e circuitos"}</strong>
                  {mode === "signup" ? <small>Ative recursos profissionais somente quando precisar.</small> : null}
                </div>
              </article>
            </div>

            <div className="authCourtScene" aria-hidden="true">
              <span className="authCourtLine authCourtLineOne" />
              <span className="authCourtLine authCourtLineTwo" />
              <span className="authCourtLine authCourtLineThree" />
              <span className="authCourtBall"><i /></span>
            </div>
          </div>

          <div className="accessCard">
            <div className="authFormHeading">
              {mode === "signup" ? (
                <div className="authSignupSteps" aria-label="Etapas do cadastro">
                  <span className="active"><b>1</b> Dados pessoais</span>
                  <span><b>2</b> Segurança e termos</span>
                </div>
              ) : null}
              <span>{mode === "signup" ? "Cadastro" : "Acesso"}</span>
              <h1>
                {mode === "login"
                  ? "Entre na sua conta"
                  : mode === "signup"
                    ? "Crie sua conta"
                    : mode === "forgotPassword"
                      ? "Redefinir senha"
                      : "Criar nova senha"}
              </h1>
              <p>
                {mode === "login"
                  ? "Use seu e-mail e sua senha para continuar."
                  : mode === "signup"
                    ? "Uma conta para participar gratuitamente e organizar quando quiser."
                    : mode === "forgotPassword"
                      ? "Enviaremos um link seguro para o seu e-mail."
                      : "A nova senha deve ter pelo menos 8 caracteres."}
              </p>
            </div>

            <div className="accessToggle" aria-label="Escolha entre entrar ou criar uma conta">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => changeMode("login")}
                aria-pressed={mode === "login"}
              >
                Entrar
              </button>

              <button
                type="button"
                className={mode === "signup" ? "active" : ""}
                onClick={() => changeMode("signup")}
                aria-pressed={mode === "signup"}
              >
                Criar conta
              </button>
            </div>

            {mode === "signup" ? (
              <div className="accessTrialCallout" role="status">
                <span>
                  <strong>Uma conta para toda a plataforma</strong>
                  <small>Participe gratuitamente e assine somente quando quiser organizar torneios e circuitos.</small>
                </span>
              </div>
            ) : null}

            <form className={`authAccessForm authAccessForm-${mode}`} onSubmit={handleSubmit} noValidate>
              {mode === "signup" ? (
                <AuthSignupFields
                  firstName={firstName}
                  setFirstName={setFirstName}
                  lastName={lastName}
                  setLastName={setLastName}
                  birthDate={birthDate}
                  setBirthDate={setBirthDate}
                  taxIdType={taxIdType}
                  setTaxIdType={setTaxIdType}
                  taxId={taxId}
                  setTaxId={setTaxId}
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  communityGuidelinesAccepted={communityGuidelinesAccepted}
                  setCommunityGuidelinesAccepted={setCommunityGuidelinesAccepted}
                  privacyNoticeAccepted={privacyNoticeAccepted}
                  setPrivacyNoticeAccepted={setPrivacyNoticeAccepted}
                />
              ) : null}

              {mode === "legacySignup" && (
                <>
                  <div className="twoCols formTwoCols">
                    <div>
                      <label>Nome</label>
                      <input
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Seu nome"
                      />
                    </div>

                    <div>
                      <label>Sobrenome</label>
                      <input
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Seu sobrenome"
                      />
                    </div>
                  </div>

                  <label>Data de nascimento</label>
                  <input
                    className="clickableDateInput"
                    type="date"
                    autoComplete="bday"
                    value={birthDate}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    onFocus={(e) => e.currentTarget.showPicker?.()}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />

                  <div className="authDocumentGrid">
                    <div>
                      <label>Documento</label>
                      <select value={taxIdType} onChange={(event) => { setTaxIdType(event.target.value); setTaxId(""); }}>
                        <option value="cpf">CPF da pessoa</option>
                        <option value="cnpj">CNPJ da organização</option>
                      </select>
                    </div>
                    <div>
                      <label>{taxIdType === "cnpj" ? "CNPJ" : "CPF"}</label>
                      <input
                        inputMode="numeric"
                        autoComplete="off"
                        value={taxId}
                        maxLength={taxIdType === "cnpj" ? 18 : 14}
                        onChange={(event) => setTaxId(event.target.value)}
                        placeholder={taxIdType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
                      />
                    </div>
                  </div>
                  <small className="authSensitiveDataHint">O documento é validado nesta demonstração, mas ainda não é enviado nem salvo. A persistência será ligada somente a um cadastro privado e protegido.</small>
                </>
              )}

              {mode !== "resetPassword" && mode !== "signup" && (
                <div className="authFieldBlock">
                  <label htmlFor="auth-email">E-mail</label>
                  <div className="authInputShell">
                    <Mail aria-hidden="true" />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                  />
                  </div>
                </div>
              )}

              {mode === "resetPassword" ? (
                <>
                  <p className="authFormHint">
                    {recoverySession?.access_token
                      ? "A nova senha será aplicada somente à conta vinculada ao link de recuperação."
                      : "Este link não está mais válido. Volte ao login e peça um novo link de recuperação."}
                  </p>
                  <div className="authFieldBlock">
                    <label htmlFor="auth-new-password">Nova senha</label>
                    <div className="authInputShell">
                      <LockKeyhole aria-hidden="true" />
                      <input
                        id="auth-new-password"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo de 8 caracteres"
                      />
                    </div>
                  </div>

                  <div className="authFieldBlock">
                    <label htmlFor="auth-confirm-new-password">Repita a nova senha</label>
                    <div className="authInputShell">
                      <LockKeyhole aria-hidden="true" />
                      <input
                        id="auth-confirm-new-password"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Digite a nova senha novamente"
                      />
                    </div>
                  </div>
                </>
              ) : (
                mode !== "forgotPassword" && mode !== "signup" && (
                  <>
                    <div className="authFieldBlock">
                      <label htmlFor="auth-password">Senha</label>
                      <div className="authInputShell">
                        <LockKeyhole aria-hidden="true" />
                        <input
                          id="auth-password"
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Digite sua senha"
                        />
                      </div>
                    </div>

                    {mode === "signup" && (
                      <>
                        <label>Repita a senha</label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Digite a senha novamente"
                        />

                        <section className="authLegalAgreements" aria-label="Concordâncias para criar a conta">
                          <div>
                            <strong>Compromisso de convivência</strong>
                            <small>Respeito à dignidade humana. Não são permitidos discriminação, assédio, ameaças, conteúdo sexual explícito ou linguagem abusiva.</small>
                          </div>
                          <label>
                            <input type="checkbox" checked={communityGuidelinesAccepted} onChange={(event) => setCommunityGuidelinesAccepted(event.target.checked)} />
                            <span>Li e concordo com os Termos de uso e as Diretrizes da comunidade.</span>
                          </label>
                          <div>
                            <strong>Aviso de privacidade</strong>
                            <small>Os dados necessários ao cadastro devem ser usados para criar a conta, identificar participantes, proteger a plataforma e cumprir obrigações aplicáveis, com acesso restrito.</small>
                          </div>
                          <label>
                            <input type="checkbox" checked={privacyNoticeAccepted} onChange={(event) => setPrivacyNoticeAccepted(event.target.checked)} />
                            <span>Estou ciente dos meus direitos de acesso, correção e solicitação de exclusão dos dados.</span>
                          </label>
                          <p>Textos de homologação: exigem revisão jurídica e publicação das versões integrais antes do lançamento oficial.</p>
                        </section>
                      </>
                    )}
                  </>
                )
              )}

              <button
                type="submit"
                className="authSubmitButton"
                disabled={submitting || (mode === "resetPassword" && !recoverySession?.access_token)}
                aria-busy={submitting}
              >
                {submitting
                  ? "Aguarde..."
                  : mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta"
                    : mode === "forgotPassword"
                      ? "Enviar link"
                      : "Salvar nova senha"}
              </button>

              {mode === "login" && (
                <button
                  type="button"
                  className="linkBtn"
                  onClick={() => changeMode("forgotPassword")}
                >
                  Esqueci minha senha
                </button>
              )}

              {mode === "login" && pendingVerificationEmail && (
                <div className="authVerificationHint" role="status">
                  <strong>Seu e-mail ainda não foi confirmado?</strong>
                  <span>Abra o link enviado para {pendingVerificationEmail} ou peça outro abaixo.</span>
                  <button
                    type="button"
                    className="linkBtn"
                    onClick={handleResendVerification}
                    disabled={submitting || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar confirmação"}
                  </button>
                </div>
              )}

              {(mode === "forgotPassword" || mode === "resetPassword") && (
                <button
                  type="button"
                  className="linkBtn"
                  onClick={() => changeMode("login")}
                >
                  Voltar para o login
                </button>
              )}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
