import { useEffect, useState } from "react";
import { normalizeMemberHandle } from "../../domain/memberProfile.mjs";
import { checkMemberHandleAvailability } from "../../services/memberProfileApi.mjs";

const IDLE_STATE = { status: "idle", message: "Seu identificador único na plataforma." };

export default function useMemberHandleAvailability({
  supabase,
  handle,
  currentHandle = "",
  enabled = true,
}) {
  const [state, setState] = useState(IDLE_STATE);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE_STATE);
      return undefined;
    }

    const normalized = normalizeMemberHandle(handle);
    if (!normalized) {
      setState(IDLE_STATE);
      return undefined;
    }
    if (!/^[a-z0-9._]{3,30}$/.test(normalized)) {
      setState({ status: "invalid", message: "Use de 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado." });
      return undefined;
    }

    let active = true;
    setState({ status: "checking", message: "Verificando disponibilidade..." });
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkMemberHandleAvailability({ supabase, handle: normalized, currentHandle });
        if (!active) return;
        setState(result.available
          ? { status: "available", message: result.source === "current" ? "Este é o seu nome de usuário atual." : "Nome de usuário disponível." }
          : { status: result.valid === false ? "invalid" : "unavailable", message: result.valid === false ? "Nome de usuário inválido." : "Este nome de usuário já está em uso." });
      } catch (error) {
        console.warn("Não foi possível verificar o nome de usuário:", error);
        if (active) setState({ status: "error", message: "Não foi possível verificar agora; a validação será repetida ao salvar." });
      }
    }, 320);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [currentHandle, enabled, handle, supabase]);

  return state;
}
