import React, { useState } from "react";
import { AtSign, Mail, MessageCircle } from "lucide-react";
import {
  TORNEIO360_LOGO,
  TORNEIO360_LOGO_BLUE,
} from "../media/canvasTools.mjs";

const PLATFORM_WHATSAPP_URL = `https://wa.me/5585988739056?text=${encodeURIComponent(
  "Olá! Preciso de ajuda com o Torneio360.",
)}`;

export const PLATFORM_SUPPORT = Object.freeze([
  {
    id: "whatsapp",
    label: "WhatsApp",
    value: "85 9.8873-9056",
    href: PLATFORM_WHATSAPP_URL,
    Icon: MessageCircle,
    external: true,
  },
  {
    id: "instagram",
    label: "Instagram",
    value: "@torneio360",
    href: "https://www.instagram.com/torneio360/",
    Icon: AtSign,
    external: true,
  },
  {
    id: "email",
    label: "E-mail",
    value: "torneio360@gmail.com",
    href: "mailto:torneio360@gmail.com",
    Icon: Mail,
    external: false,
  },
]);

export function PlanCard({ title, tag, badge, price, text, items }) {
  return (
    <div className="planCard">
      {badge && <div className="planBadge">{badge}</div>}

      <div className="planTop">
        <h3>{title}</h3>
        <span>{tag}</span>
      </div>

      <div className="planPrice">
        <strong>{price}</strong>
        <small>/mês</small>
      </div>

      <p className="planDesc">{text}</p>

      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function Info({ title, text }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="modalityInfoCard">
      <div className="modalityInfoTop">
        <strong>{title}</strong>

        <button
          type="button"
          className="explainBtn"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Fechar" : "Como funciona?"}
        </button>
      </div>

      {open && (
        <div className="modalityExplainBox">
          <p>{text}</p>
        </div>
      )}
    </div>
  );
}

export function BeachLogo({ variant = "light" } = {}) {
  const logoSrc = variant === "blue" ? TORNEIO360_LOGO_BLUE : TORNEIO360_LOGO;

  return (
    <div className={`beachLogo torneio360Logo ${variant === "blue" ? "torneio360LogoBlue" : ""}`} aria-label="Torneio 360">
      <img src={logoSrc} alt="Torneio 360" />
    </div>
  );
}

export function PlatformSupportLinks({ contacts = PLATFORM_SUPPORT, className = "", whatsappHref = "" }) {
  return (
    <div className={`supportContactGrid ${className}`.trim()}>
      {contacts.map(({ id, label, value, href, Icon, external }) => {
        const contactHref = id === "whatsapp" && whatsappHref ? whatsappHref : href;

        return (
          <a
            key={id}
            className={`supportContactLink supportContactLink-${id}`}
            href={contactHref}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            aria-label={`${label}: ${value}`}
          >
            <span className="supportContactIcon"><Icon aria-hidden="true" /></span>
            <span>
              <strong>{label}</strong>
              <small>{value}</small>
            </span>
          </a>
        );
      })}
    </div>
  );
}
