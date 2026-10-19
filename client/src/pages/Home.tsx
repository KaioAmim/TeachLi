import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Link } from "wouter";
import {
  ArrowDown,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  GraduationCap,
  Check,
  Plus,
  Pause,
  Play,
  ScanLine,
  Loader2,
  Volume2,
} from "lucide-react";
import { useMotionPreference } from "@/components/MotionPreference";
import { useSectionScroll } from "@/hooks/useSectionScroll";
import { TeachLiBrand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { MICROSOFT_ROLE_DOMAINS } from "@/lib/microsoftAuth";
import { useMicrosoftSignIn } from "@/hooks/useMicrosoftSignIn";

const features = [
  {
    id: "texto",
    label: "Texto",
    title: "Suas palavras ganham voz.",
    description:
      "Digite uma mensagem e ouça a leitura em voz alta no seu dispositivo.",
    example: "Tenho uma pergunta sobre a aula.",
    caption: "Texto para voz",
    result: "Escreva. Ouça. Participe.",
    resultIcon: Volume2,
  },
  {
    id: "voz",
    label: "Voz",
    title: "A fala também pode ser lida.",
    description:
      "No modo professor, acompanhe a fala em português como texto na tela.",
    example: "Vamos retomar o conteúdo da última aula?",
    caption: "Exemplo de transcrição",
    result: "Fale e acompanhe o texto.",
    resultIcon: AudioLines,
  },
  {
    id: "gestos",
    label: "Gestos",
    title: "Um espaço para praticar.",
    description:
      "Use a câmera para reconhecer 15 letras estáticas do alfabeto manual ou treine seus próprios gestos.",
    example: "Reconhecimento pela câmera",
    caption: "Alfabeto manual",
    result: "Explore no modo aluno.",
    resultIcon: ScanLine,
  },
] as const;

function moveCardHighlight(event: PointerEvent<HTMLElement>) {
  if (
    event.pointerType !== "mouse" ||
    document.documentElement.dataset.motion === "reduced"
  )
    return;
  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  card.style.setProperty("--highlight-x", `${event.clientX - bounds.left}px`);
  card.style.setProperty("--highlight-y", `${event.clientY - bounds.top}px`);
  card.style.setProperty("--tilt-x", `${-(event.clientY - bounds.top - bounds.height / 2) / bounds.height * 1.5}deg`);
  card.style.setProperty("--tilt-y", `${(event.clientX - bounds.left - bounds.width / 2) / bounds.width * 1.5}deg`);
}

function resetCardHighlight(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.removeProperty("--highlight-x");
  event.currentTarget.style.removeProperty("--highlight-y");
  event.currentTarget.style.removeProperty("--tilt-x");
  event.currentTarget.style.removeProperty("--tilt-y");
}

function HelpTopic({
  question,
  children,
  open,
  onToggle,
}: {
  question: string;
  children: ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  return (
    <article className="help-topic" data-open={open} data-motion>
      <h3>
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={open}
          aria-controls={`${id}-answer`}
          onClick={onToggle}
        >
          {question}
          <Plus size={20} aria-hidden="true" />
        </button>
      </h3>
      <div
        id={`${id}-answer`}
        className="help-answer"
        role="region"
        aria-labelledby={`${id}-trigger`}
        aria-hidden={!open}
      >
        <div><p>{children}</p></div>
      </div>
    </article>
  );
}

export default function Home() {
  const pageRef = useRef<HTMLElement>(null);
  const { reduced, toggleMotion } = useMotionPreference();
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState(0);
  const [featureIndex, setFeatureIndex] = useState(0);
  const [featureCycle, setFeatureCycle] = useState(0);
  const [featureLeaving, setFeatureLeaving] = useState(false);
  const featureTimer = useRef<ReturnType<typeof setTimeout>>();
  useSectionScroll(reduced);

  function selectFeature(index: number) {
    clearTimeout(featureTimer.current);
    setSelectedFeature(index);
    if (reduced) {
      setFeatureIndex(index);
      setFeatureLeaving(false);
      return;
    }
    setFeatureLeaving(true);
    featureTimer.current = setTimeout(() => {
      setFeatureIndex(index);
      setFeatureCycle(cycle => cycle + 1);
      setFeatureLeaving(false);
    }, 220);
  }

  useEffect(() => () => clearTimeout(featureTimer.current), []);
  useEffect(() => {
    if (reduced) {
      clearTimeout(featureTimer.current);
      setFeatureIndex(selectedFeature);
      setFeatureLeaving(false);
    }
  }, [reduced, selectedFeature]);

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page || reduced) return;
    const elements = Array.from(page.querySelectorAll<HTMLElement>("[data-motion]"));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        element.dataset.revealed = "true";
        observer.unobserve(element);
      });
    }, { threshold: 0.08 });
    // Prepare offscreen sections before paint so they never flash before fading in.
    elements.forEach(element => {
      if (element.getBoundingClientRect().top < innerHeight * 0.94) return;
      element.dataset.revealReady = "true";
      observer.observe(element);
    });
    return () => {
      observer.disconnect();
      elements.forEach(element => { delete element.dataset.revealReady; delete element.dataset.revealed; });
    };
  }, [reduced]);
  const { pendingRole, signIn } = useMicrosoftSignIn();
  const feature = features[featureIndex];
  const ResultIcon = feature.resultIcon;

  return (
    <main ref={pageRef} id="conteudo" className="home-page" tabIndex={-1}>
      <section className="home-banner" aria-labelledby="home-title">
        <div className="home-hero container">
          <div className="hero-copy">
            <p className="institution-note">TeachLi na UniBarretos</p>
            <h1 id="home-title">
              Mais jeitos
              <br />
              de aprender.
              <br />
              Mais conexão.
            </h1>
            <p className="hero-description">
              Sua voz, suas palavras, seu jeito de se expressar. Um espaço para
              aproximar alunos e professores.
            </p>
            <a className="hero-cta" href="#acesso">
              Quero participar <ArrowDown size={19} aria-hidden="true" />
            </a>
            <p className="hero-footnote">
              Texto, voz e gestos. A conversa começa aqui.
            </p>
          </div>
          <div className="feature-stage" data-leaving={featureLeaving}>
            <span className="stage-outline" aria-hidden="true" />
            <div
              className="feature-select"
              role="group"
              aria-label="Explore os recursos do TeachLi"
            >
              {features.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selectedFeature === index}
                  aria-controls="feature-preview"
                  onClick={() => selectFeature(index)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="feature-pair">
              <div
                key={`window-${featureCycle}`}
                className="feature-window"
                id="feature-preview"
                aria-live="polite"
                aria-atomic="true"
              >
                <div key={feature.id} className="feature-content">
                  <div className="feature-topline">
                    <span>{feature.caption}</span>
                  </div>
                  <div className="conversation-art" aria-hidden="true">
                    {feature.id === "texto" ? (
                      <span className="type-art">
                        Aa
                        <span className="type-caret" />
                      </span>
                    ) : feature.id === "voz" ? (
                      <span className="voice-art">
                        {[22, 40, 68, 100, 60, 88, 44, 72, 32].map(
                          (height, i) => (
                            <i key={i} style={{ height }} />
                          )
                        )}
                      </span>
                    ) : (
                      <span className="letter-art">
                        <span>A</span>
                        <span>B</span>
                        <span>C</span>
                      </span>
                    )}
                  </div>
                  <p className="sample-message">{feature.example}</p>
                  <div className="sample-result">
                    <ResultIcon size={18} aria-hidden="true" />
                    <span>{feature.result}</span>
                  </div>
                </div>
              </div>
              <div key={`reply-${featureCycle}`} className="feature-reply" aria-live="polite">
                <div key={feature.id} className="feature-reply-content">
                  <h2>{feature.title}</h2>
                  <p>{feature.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-baseline container">
          <span>Um encontro entre educação e tecnologia.</span>
          <button type="button" className="motion-toggle" aria-pressed={!reduced}
            onClick={toggleMotion}>
            {reduced ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
            {reduced ? "Ativar animações" : "Reduzir animações"}
          </button>
        </div>
      </section>

      <section
        id="acesso"
        className="access-section"
        aria-labelledby="access-title"
      >
        <div className="container access-grid">
          <div className="access-intro" data-motion>
            <div>
              <p className="section-kicker">A plataforma é sua.</p>
              <h2 id="access-title" tabIndex={-1}>Qual é o seu espaço?</h2>
            </div>
            <p>
              Escolha seu perfil e entre com
              <br /> sua conta institucional Microsoft.
            </p>
          </div>
          <article
            className="role-card student-card" data-motion
            onPointerMove={moveCardHighlight}
            onPointerLeave={resetCardHighlight}
          >
            <div className="role-card-heading">
              <span className="role-context">Para aprender e se expressar</span>
              <span className="role-emblem" aria-hidden="true">
                <BookOpen size={34} strokeWidth={1.6} />
              </span>
            </div>
            <h3>
              Sou aluno<span aria-hidden="true">.</span>
            </h3>
            <p>
              Seu espaço para escrever, ouvir e explorar gestos no seu ritmo.
            </p>
            <ul>
              <li>
                <Check size={15} aria-hidden="true" />
                Texto com leitura em voz alta
              </li>
              <li>
                <Check size={15} aria-hidden="true" />
                Reconhecimento e treino de gestos
              </li>
            </ul>
            <Button
              className="role-button"
              disabled={pendingRole !== null}
              onClick={() => void signIn("aluno")}
            >
              {pendingRole === "aluno" ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={17} />
                  Abrindo Microsoft…
                </>
              ) : (
                <>
                  Entrar como aluno{" "}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </>
              )}
            </Button>
            <div className="role-footer">
              <p className="role-email">
                <span>Conta institucional</span>@{MICROSOFT_ROLE_DOMAINS.aluno}
              </p>
              <TeachLiBrand />
            </div>
          </article>
          <article
            className="role-card professor-card" data-motion
            onPointerMove={moveCardHighlight}
            onPointerLeave={resetCardHighlight}
          >
            <div className="role-card-heading">
              <span className="role-context">Para ensinar e compartilhar</span>
              <span className="role-emblem" aria-hidden="true">
                <GraduationCap size={36} strokeWidth={1.6} />
              </span>
            </div>
            <h3>
              Sou professor<span aria-hidden="true">.</span>
            </h3>
            <p>Mais uma forma de tornar sua fala acessível para a turma.</p>
            <ul>
              <li>
                <Check size={15} aria-hidden="true" />
                Transcrição de fala em português
              </li>
              <li>
                <Check size={15} aria-hidden="true" />
                Texto com apoio do avatar VLibras
              </li>
            </ul>
            <Button
              className="role-button"
              disabled={pendingRole !== null}
              onClick={() => void signIn("professor")}
            >
              {pendingRole === "professor" ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={17} />
                  Abrindo Microsoft…
                </>
              ) : (
                <>
                  Entrar como professor{" "}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </>
              )}
            </Button>
            <div className="role-footer">
              <p className="role-email">
                <span>Conta institucional</span>@
                {MICROSOFT_ROLE_DOMAINS.professor}
              </p>
              <TeachLiBrand />
            </div>
          </article>
        </div>
      </section>

      <section
        id="como-funciona"
        className="container guidance-section"
        aria-labelledby="guidance-title"
      >
        <div className="guidance-intro" data-motion>
          <span className="question-mark" aria-hidden="true">
            ?
          </span>
          <h2 id="guidance-title" tabIndex={-1}>Antes de começar</h2>
          <p>
            Conheça as possibilidades do TeachLi e prepare seu primeiro acesso.
          </p>
          <Link href="/aluno/treinar" className="training-link">
            Já conhece? Vá para o treino de gestos{" "}
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="help-topics">
          <HelpTopic question="O que preciso para acessar?" open={openQuestion === 0} onToggle={() => setOpenQuestion(openQuestion === 0 ? null : 0)}>
            Entre com sua conta Microsoft da UniBarretos. Alunos usam @
            {MICROSOFT_ROLE_DOMAINS.aluno}; professores usam @
            {MICROSOFT_ROLE_DOMAINS.professor}. A câmera é necessária apenas
            para reconhecer e treinar gestos. Para transcrever sua fala,
            permita o acesso ao microfone.
          </HelpTopic>
          <HelpTopic question="O TeachLi traduz Libras completa?" open={openQuestion === 1} onToggle={() => setOpenQuestion(openQuestion === 1 ? null : 1)}>
            Não. O reconhecimento é experimental e o modelo base identifica 15
            letras estáticas do alfabeto manual. O resultado depende da
            iluminação, da posição da mão e dos dados de treino. O VLibras é
            um recurso separado para apoiar a tradução de textos da página.
          </HelpTopic>
          <HelpTopic question="Posso personalizar o reconhecimento?" open={openQuestion === 2} onToggle={() => setOpenQuestion(openQuestion === 2 ? null : 2)}>
            Sim. Após entrar como aluno, acesse Treinar gestos para capturar
            amostras e criar um modelo pessoal neste navegador. Também é
            possível gravar clipes para treinar gestos com movimento.
          </HelpTopic>
        </div>
      </section>
    </main>
  );
}
