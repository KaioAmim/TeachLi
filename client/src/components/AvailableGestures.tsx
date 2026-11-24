import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

interface AvailableGesturesProps {
  letters: string[];
  signs: string[];
  /** Linhas que explicam de onde vêm os modelos (ou que estão carregando). */
  lettersNote: string;
  signsNote: string;
  /** Chamado ao clicar num gesto; `isLetter` diferencia letras (sem espaço) de palavras e frases. */
  onSelect?: (label: string, isLetter: boolean) => void;
}

type Tab = "letras" | "palavras" | "frases";

const NONE_LABEL = "__nenhum__";

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lista compacta e pesquisável dos gestos que o sistema reconhece. */
export function AvailableGestures({ letters, signs, lettersNote, signsNote, onSelect }: AvailableGesturesProps) {
  const [tab, setTab] = useState<Tab>("palavras");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    // Nomes repetidos viram um só item; palavras têm até 2 termos, frases têm mais.
    const unique = Array.from(new Set(signs.map(s => s.trim()).filter(s => s && s !== NONE_LABEL)));
    const byName = (a: string, b: string) => a.localeCompare(b, "pt-BR");
    return {
      letras: [...letters].sort(byName),
      palavras: unique.filter(s => s.split(/\s+/).length <= 2).sort(byName),
      frases: unique.filter(s => s.split(/\s+/).length > 2).sort(byName),
    } satisfies Record<Tab, string[]>;
  }, [letters, signs]);

  const search = normalize(query.trim());
  const letterSet = useMemo(() => new Set(groups.letras), [groups.letras]);
  const visible = search
    ? (Object.keys(groups) as Tab[]).flatMap(key => groups[key].filter(item => normalize(item).includes(search)))
    : groups[tab];

  const tabs: { id: Tab; label: string }[] = [
    { id: "letras", label: "Letras" },
    { id: "palavras", label: "Palavras" },
    { id: "frases", label: "Frases" },
  ];

  return (
    <div className="gesture-browser">
      <div className="gesture-browser-top" role="tablist" aria-label="Tipos de gesto">
        {tabs.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={!search && tab === item.id}
            data-active={!search && tab === item.id}
            onClick={() => { setTab(item.id); setQuery(""); }}
          >
            {item.label} <span>{groups[item.id].length}</span>
          </button>
        ))}
      </div>

      <label className="gesture-browser-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Buscar gesto (ex.: pagar, luz)"
          aria-label="Buscar gesto disponível"
        />
        {query && (
          <button type="button" className="gesture-browser-clear" onClick={() => setQuery("")} aria-label="Limpar busca">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </label>

      <div className="gesture-browser-list" data-kind={!search && tab === "letras" ? "letters" : "words"} role="tabpanel" aria-live="polite">
        {visible.length > 0 ? (
          visible.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => onSelect?.(item, letterSet.has(item))}
              title="Clique para adicionar à mensagem"
            >
              {item}
            </button>
          ))
        ) : (
          <p>{search ? "Nenhum gesto encontrado." : tab === "letras" ? "Nenhuma letra disponível." : "Nenhum sinal disponível."}</p>
        )}
      </div>

      <p className="gesture-browser-note">
        <span className="gesture-browser-dot" aria-hidden="true" />
        {search ? `${visible.length} resultado${visible.length === 1 ? "" : "s"} em todos os grupos. ` : ""}
        {tab === "letras" && !search ? lettersNote : signsNote}
        {onSelect ? " Clique num gesto para adicioná-lo à mensagem." : ""}
      </p>
    </div>
  );
}
