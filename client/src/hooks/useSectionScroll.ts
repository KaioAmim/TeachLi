import { useEffect } from "react";

// Wheel navigation uses intermediate stops when a section is taller than the viewport.
// Touch, trackpads with small deltas, nested scrollers and keyboard scrolling stay native.
export function useSectionScroll(reduced: boolean) {
  useEffect(() => {
    if (reduced) return;
    const desktop = window.matchMedia("(min-width: 900px) and (pointer: fine)");
    let frame = 0;
    let direction = 0;
    let settlingUntil = 0;
    const stop = () => { cancelAnimationFrame(frame); frame = 0; direction = 0; };
    const maximum = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const topOf = (element: Element) => Math.min(maximum(), Math.max(0, element.getBoundingClientRect().top + scrollY - 24));

    function goTo(destination: number, complete?: () => void) {
      stop();
      const start = scrollY;
      const distance = destination - start;
      direction = Math.sign(distance);
      const duration = Math.min(1400, Math.max(850, Math.abs(distance) * 0.8));
      const started = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / duration);
        const eased = (1 - Math.cos(Math.PI * progress)) / 2;
        window.scrollTo({ top: start + distance * eased, behavior: "instant" });
        if (progress < 1) frame = requestAnimationFrame(tick);
        else { frame = 0; direction = 0; settlingUntil = performance.now() + 160; complete?.(); }
      };
      frame = requestAnimationFrame(tick);
    }

    function navigate(event: MouseEvent) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href="#acesso"], a[href="#como-funciona"]');
      const section = anchor && document.querySelector(anchor.hash);
      if (!section) return;
      event.preventDefault();
      history.pushState(null, "", anchor!.hash);
      goTo(topOf(section), () => {
        section.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      });
    }

    function wheel(event: WheelEvent) {
      if (!desktop.matches || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (event.deltaMode === 0 && Math.abs(event.deltaY) < 40) { stop(); return; }
      let target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [role=dialog], [contenteditable=true]")) return;
      while (target && target !== document.body) {
        if (/(auto|scroll)/.test(getComputedStyle(target).overflowY) && target.scrollHeight > target.clientHeight + 1) return;
        target = target.parentElement;
      }
      const sign = Math.sign(event.deltaY);
      if (!sign || (sign < 0 && scrollY <= 1) || (sign > 0 && scrollY >= maximum() - 1)) return;
      event.preventDefault();
      if (frame && sign === direction) return;
      if (performance.now() < settlingUntil) return;
      const sections = Array.from(document.querySelectorAll(".home-banner, #acesso, #como-funciona"));
      const stops = [0, maximum()];
      for (const section of sections) {
        const start = section.matches(".home-banner") ? 0 : topOf(section);
        stops.push(start);
        // Show the end of a tall section before moving on, including its controls.
        const end = Math.min(maximum(), section.getBoundingClientRect().bottom + scrollY - innerHeight + 24);
        if (end > start + 8) stops.push(end);
      }
      stops.sort((a, b) => a - b);
      const next = sign > 0 ? stops.find(y => y > scrollY + 8) : stops.reverse().find(y => y < scrollY - 8);
      if (next === undefined) return;
      const distance = next - scrollY;
      const step = Math.min(Math.abs(distance), innerHeight * 0.6);
      goTo(scrollY + sign * step);
    }

    const key = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Escape", "Tab"].includes(event.key)) stop();
    };
    document.addEventListener("click", navigate);
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", key);
    return () => {
      stop();
      document.removeEventListener("click", navigate);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", key);
    };
  }, [reduced]);
}
