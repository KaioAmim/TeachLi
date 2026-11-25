import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { chooseVoice, getVoiceGender, onVoiceGenderChange, setVoiceGender, speak, type SpeakEngine, type VoiceGender } from "@/lib/voice";

const OPTIONS: { id: VoiceGender; label: string }[] = [
  { id: "feminina", label: "Voz feminina" },
  { id: "masculina", label: "Voz masculina" },
];

/** Preferência de voz da leitura em voz alta (menu Conta). */
export function VoiceSettings({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [gender, setGender] = useState<VoiceGender>(getVoiceGender);
  const [voiceName, setVoiceName] = useState("");
  const [exact, setExact] = useState(true);
  const [engine, setEngine] = useState<SpeakEngine>(null);

  useEffect(() => onVoiceGenderChange(() => setGender(getVoiceGender())), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    chooseVoice(gender).then(chosen => {
      if (cancelled) return;
      setVoiceName(chosen.voice?.name ?? "");
      setExact(chosen.exact);
    });
    return () => { cancelled = true; };
  }, [open, gender]);

  const choose = (next: VoiceGender) => {
    setGender(next);
    setVoiceGender(next);
    void sample(next);
  };

  const sample = async (value: VoiceGender) => {
    setEngine(await speak("Olá! Esta é a voz que vai ler as mensagens para você.", { gender: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Voz da leitura</DialogTitle>
          <DialogDescription>Escolha a voz usada quando o sistema lê mensagens em voz alta.</DialogDescription>
        </DialogHeader>
        <fieldset className="voice-settings">
          <legend className="sr-only">Tipo de voz</legend>
          {OPTIONS.map(option => (
            <label key={option.id} data-checked={gender === option.id}>
              <input type="radio" name="voice-gender" checked={gender === option.id} onChange={() => choose(option.id)} />
              {option.label}
            </label>
          ))}
        </fieldset>
        <p className="voice-settings-note" role="status">
          {engine === "neural" ? "Voz neural ativa: a leitura usa uma voz natural do servidor TeachLi." : engine === "navegador" ? "A voz neural não está disponível; usando a voz do navegador." : null}{" "}
          {engine === "neural" ? null : !voiceName
            ? "Este navegador não tem voz em português. A leitura em voz alta pode não funcionar."
            : exact
              ? <>Voz em uso: <strong>{voiceName}</strong>.</>
              : <>Este navegador não tem uma voz {gender} em português; usando <strong>{voiceName}</strong> com o tom ajustado. No Edge, as vozes "Natural" são as mais humanas.</>}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => void sample(gender)}>
            <Volume2 size={16} aria-hidden="true" /> Ouvir exemplo
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
