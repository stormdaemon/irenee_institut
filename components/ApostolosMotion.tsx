"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Progressive enhancement: content remains visible without JavaScript or observers. */
export function ApostolosMotion() {
  const pathname = usePathname();
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    const animated = new Set<Animation>();
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    const targets = [...document.querySelectorAll<HTMLElement>("[data-reveal], .apostolos-course-tile, .apostolos-journal-card")];
    const scene = document.querySelector<HTMLElement>(".apostolos-sanctuary");
    const ribbon = document.querySelector<HTMLElement>(".apostolos-motion-word");
    const updateScroll = () => {
      frame = 0;
      const max = root.scrollHeight - window.innerHeight;
      root.style.setProperty("--reading-progress", String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
      if (scene) scene.style.setProperty("--scene-drift", `${Math.min(window.scrollY * 0.14, 95)}px`);
      if (ribbon) {
        const bounds = ribbon.getBoundingClientRect();
        ribbon.style.setProperty("--word-drift", `${Math.max(-70, Math.min(70, (bounds.top - innerHeight / 2) * 0.08))}px`);
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(updateScroll); };
    const configure = () => {
      observer?.disconnect();
      animated.forEach(animation => animation.cancel());
      animated.clear();
      cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener("scroll", onScroll);
      root.dataset.motion = media.matches ? "reduced" : "enabled";
      targets.forEach(target => { target.dataset.motionState = "visible"; });
      if (media.matches) {
        scene?.style.removeProperty("--scene-drift");
        ribbon?.style.removeProperty("--word-drift");
        root.style.removeProperty("--reading-progress");
        return;
      }
      if ("IntersectionObserver" in window) {
        observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const target = entry.target as HTMLElement;
            target.dataset.motionState = "visible";
            observer?.unobserve(target);
            const animation = target.animate([
              { opacity: 0.25, transform: "translateY(32px)", filter: "blur(4px)" },
              { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
            ], { duration: 800, easing: "cubic-bezier(.16,1,.3,1)", delay: Number(target.dataset.revealDelay || 0) });
            animated.add(animation);
            animation.finished.then(() => animated.delete(animation), () => animated.delete(animation));
          });
        }, { threshold: 0.08 });
        targets.forEach(target => { target.dataset.motionState = "pending"; observer!.observe(target); });
      }
      updateScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    };
    configure();
    media.addEventListener("change", configure);
    return () => {
      observer?.disconnect();
      animated.forEach(animation => animation.cancel());
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      media.removeEventListener("change", configure);
      delete root.dataset.motion;
      root.style.removeProperty("--reading-progress");
    };
  }, [pathname]);
  return <div className="apostolos-scroll-progress" aria-hidden="true" />;
}
