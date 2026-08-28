import React, { useId, useState } from "react";
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

export function BeachLogo({ variant = "light", layout = "stacked" } = {}) {
  const logoSrc = variant === "blue" ? TORNEIO360_LOGO_BLUE : TORNEIO360_LOGO;
  const horizontal = layout === "horizontal";
  const artworkId = useId().replace(/:/g, "");
  const wordMaskFilterId = `${artworkId}-word-color-mask`;
  const wordMaskId = `${artworkId}-word-mask`;
  const numberMaskFilterId = `${artworkId}-number-color-mask`;
  const numberMaskId = `${artworkId}-number-mask`;

  return (
    <div className={`beachLogo torneio360Logo ${horizontal ? "torneio360LogoHorizontal" : ""} ${variant === "blue" ? "torneio360LogoBlue" : ""}`} aria-label="Torneio 360">
      {horizontal ? (
        <svg className="torneio360HorizontalArtwork" viewBox="0 0 910 150" role="img" aria-hidden="true" preserveAspectRatio="xMinYMid meet">
          <defs>
            <filter id={wordMaskFilterId} colorInterpolationFilters="sRGB">
              <feColorMatrix
                in="SourceGraphic"
                result="wordColorMask"
                type="matrix"
                values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 6 0 -0.7"
              />
              <feComposite in="wordColorMask" in2="SourceAlpha" operator="in" />
            </filter>
            <mask id={wordMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="599" height="280" style={{ maskType: "alpha" }}>
              <image href={logoSrc} width="599" height="280" filter={`url(#${wordMaskFilterId})`} />
            </mask>
            <filter id={numberMaskFilterId} colorInterpolationFilters="sRGB">
              <feColorMatrix
                in="SourceGraphic"
                result="numberColorMask"
                type="matrix"
                values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3 2 -5 0 -0.2"
              />
              <feComposite in="numberColorMask" in2="SourceAlpha" operator="in" />
            </filter>
            <mask id={numberMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="599" height="280" style={{ maskType: "alpha" }}>
              <image href={logoSrc} width="599" height="280" filter={`url(#${numberMaskFilterId})`} />
            </mask>
          </defs>
          <svg x="0" y="10" width="575" height="124" viewBox="10 8 579 125" preserveAspectRatio="xMinYMid meet" overflow="hidden">
            <image href={logoSrc} width="599" height="280" mask={`url(#${wordMaskId})`} />
          </svg>
          <svg x="570" y="0" width="340" height="150" viewBox="245 104 354 156" preserveAspectRatio="xMinYMid meet" overflow="hidden">
            <image href={logoSrc} width="599" height="280" mask={`url(#${numberMaskId})`} />
          </svg>
        </svg>
      ) : <img src={logoSrc} alt="Torneio 360" />}
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
