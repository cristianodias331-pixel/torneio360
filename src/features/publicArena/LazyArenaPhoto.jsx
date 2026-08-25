import React, { useEffect, useRef, useState } from "react";

export default function LazyArenaPhoto({ arena, alt, fetchPublicArenaPhoto }) {
  const arenaId = String(arena?.id || "");
  const initialSource = String(arena?.photo_url || "");
  const [source, setSource] = useState(initialSource);
  const triggerRef = useRef(null);

  useEffect(() => {
    let active = true;
    let observer = null;
    setSource(initialSource);

    if (initialSource || !arena?.has_photo || !arenaId) {
      return () => { active = false; };
    }

    const loadPhoto = async () => {
      const photoUrl = await fetchPublicArenaPhoto(arenaId);
      if (active && photoUrl) setSource(photoUrl);
    };

    if (typeof window.IntersectionObserver === "function" && triggerRef.current) {
      observer = new window.IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        void loadPhoto();
      }, { rootMargin: "240px" });
      observer.observe(triggerRef.current);
    } else {
      void loadPhoto();
    }

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [arenaId, arena?.has_photo, initialSource]);

  if (source) {
    return <img src={source} alt={alt || "Foto da arena"} loading="lazy" decoding="async" />;
  }

  const arenaName = arena?.arena_name || arena?.name || "Arena";
  return <span ref={triggerRef}>{arenaName.slice(0, 2).toUpperCase()}</span>;
}
