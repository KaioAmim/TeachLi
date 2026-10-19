export function UniversityBrand() {
  return (
    <img
      className="university-logo"
      src="/brand/unibarretos.png"
      alt="UniBarretos — Centro Universitário Barretos"
      width="3005"
      height="729"
    />
  );
}

export function TeachLiBrand({ large = false }: { large?: boolean }) {
  return (
    <img
      className={large ? "teachli-logo teachli-logo-large" : "teachli-logo"}
      src="/brand/teachli.jpg"
      alt="TeachLi"
      width="1024"
      height="770"
    />
  );
}
