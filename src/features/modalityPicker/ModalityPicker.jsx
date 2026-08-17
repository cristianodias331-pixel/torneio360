import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Shapes, X } from "lucide-react";
import {
  getModalityDisplayName,
  modalityPickerDescriptions,
  modalityPickerGroups,
  normalizeModalitySearch,
} from "../../domain/modalityCatalog.mjs";

export default function ModalityPicker({ value, onChange, options = [], disabled = false, legacyLabel = "" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [panelPosition, setPanelPosition] = useState({});
  const pickerRef = useRef(null);
  const panelRef = useRef(null);
  const availableTypes = useMemo(() => Array.from(new Set(options.filter(Boolean))), [options]);
  const availableSet = useMemo(() => new Set(availableTypes), [availableTypes]);
  const selectedLabel = value ? getModalityDisplayName(value) : "";
  const selectedDescription = modalityPickerDescriptions[value] || (value ? "Modalidade cadastrada neste torneio." : "Pesquise ou escolha por categoria.");
  const normalizedSearch = normalizeModalitySearch(search);

  const groupedOptions = useMemo(() => {
    const knownTypes = new Set(modalityPickerGroups.flatMap((group) => group.types));
    const groups = modalityPickerGroups.map((group) => ({
      ...group,
      items: group.types.filter((type) => availableSet.has(type)),
    }));
    const otherItems = availableTypes.filter((type) => !knownTypes.has(type));
    if (otherItems.length) groups.push({ id: "other", title: "Outras modalidades", subtitle: "Outros formatos disponíveis no seu plano.", items: otherItems });
    if (value && !availableSet.has(value)) groups.unshift({ id: "legacy", title: "Modalidade existente", subtitle: "Mantida para preservar este torneio.", items: [value] });

    return groups.map((group) => ({
      ...group,
      items: group.items.filter((type) => {
        if (!normalizedSearch) return true;
        return normalizeModalitySearch(`${getModalityDisplayName(type)} ${modalityPickerDescriptions[type] || ""} ${group.title}`).includes(normalizedSearch);
      }),
    })).filter((group) => group.items.length);
  }, [availableSet, availableTypes, normalizedSearch, value]);

  useEffect(() => {
    if (!open) return undefined;
    const updatePanelPosition = () => {
      const trigger = pickerRef.current?.querySelector(".modalityPickerTrigger");
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const topbar = pickerRef.current?.closest(".playAppShell")?.querySelector(".playTopbar");
      const topbarBottom = topbar?.getBoundingClientRect().bottom || 0;
      const safeTop = Math.max(16, topbarBottom + 8);
      const width = Math.min(720, Math.max(280, viewportWidth - 32));
      const left = Math.min(Math.max(16, rect.left), Math.max(16, viewportWidth - width - 16));
      const availableHeight = Math.max(260, viewportHeight - safeTop - 16);
      const estimatedHeight = Math.min(620, availableHeight);
      const below = rect.bottom + 8;
      const top = below + estimatedHeight <= viewportHeight - 16
        ? below
        : safeTop;
      setPanelPosition({ top, left, width, maxHeight: Math.max(260, viewportHeight - top - 16) });
    };
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    updatePanelPosition();
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  function selectModality(type) {
    onChange(type);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={pickerRef} className={`modalityPicker ${open ? "isOpen" : ""} ${disabled ? "isDisabled" : ""}`}>
      <button
        type="button"
        className="modalityPickerTrigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`modalityPickerTriggerIcon ${value ? "hasValue" : ""}`}><Shapes aria-hidden="true" /></span>
        <span className="modalityPickerTriggerText">
          <strong>{selectedLabel || "Escolha a modalidade"}</strong>
          <small>{legacyLabel && value && !availableSet.has(value) ? legacyLabel : selectedDescription}</small>
        </span>
        <ChevronDown className="modalityPickerChevron" aria-hidden="true" />
      </button>

      {open ? createPortal(
        <>
          <button type="button" className="modalityPickerBackdrop" aria-label="Fechar modalidades" onClick={() => setOpen(false)} />
          <div ref={panelRef} className="modalityPickerPanel" role="dialog" aria-modal="false" aria-label="Escolher modalidade" style={panelPosition}>
            <div className="modalityPickerPanelHeader">
              <div><strong>Escolha a modalidade</strong><span>Encontre pelo nome ou navegue pelas categorias.</span></div>
              <button type="button" className="modalityPickerClose" aria-label="Fechar" onClick={() => setOpen(false)}><X aria-hidden="true" /></button>
            </div>
            <label className="modalityPickerSearch platformUnifiedSearch">
              <Search aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: Super 8, Copa ou Simples" />
              {search ? <button type="button" aria-label="Limpar busca" onClick={() => setSearch("")}><X aria-hidden="true" /></button> : null}
            </label>
            <div className="modalityPickerGroups">
              {groupedOptions.length ? groupedOptions.map((group) => (
                <section className="modalityPickerGroup" key={group.id}>
                  <header><strong>{group.title}</strong><span>{group.subtitle}</span></header>
                  <div className="modalityPickerItems">
                    {group.items.map((type) => {
                      const selected = type === value;
                      return (
                        <button type="button" role="radio" aria-checked={selected} className={selected ? "selected" : ""} key={type} onClick={() => selectModality(type)}>
                          <span className="modalityPickerCheck" aria-hidden="true">{selected ? "✓" : ""}</span>
                          <span><strong>{getModalityDisplayName(type)}</strong><small>{modalityPickerDescriptions[type] || "Formato disponível para este torneio."}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )) : <div className="modalityPickerEmpty"><Search aria-hidden="true" /><strong>Nenhuma modalidade encontrada</strong><span>Tente pesquisar usando outro nome.</span></div>}
            </div>
          </div>
        </>,
        pickerRef.current?.closest(".playAppShell") || document.body,
      ) : null}
    </div>
  );
}
