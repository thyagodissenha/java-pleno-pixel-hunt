import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre | Java Pleno Pixel Hunt",
  description: "Saiba mais sobre o jogo Java Pleno Pixel Hunt.",
};

export default function AboutPage() {
  return (
    <main className="legal-shell">
      <article className="legal-panel">
        <p className="legal-kicker">Sobre o projeto</p>
        <h1>Java Pleno Pixel Hunt</h1>
        <p>
          Java Pleno Pixel Hunt e um mini jogo pixel art de arena sobre um desenvolvedor Java pleno
          tentando sobreviver a usuarios, chefes, incidentes de producao e chamados que nunca acabam.
        </p>

        <h2>Como funciona</h2>
        <p>
          O jogador se move pela arena, atira automaticamente no inimigo mais proximo, coleta power-ups
          e enfrenta chefes ao avancar pelas ondas. A cada novo chamado, o jogo fica mais dificil.
        </p>

        <h2>Controles</h2>
        <ul>
          <li>Movimento: WASD, setas ou toque/arraste no celular.</li>
          <li>Rajada: Espaco, consumindo estamina.</li>
          <li>Pausa: Esc.</li>
        </ul>

        <h2>Monetizacao</h2>
        <p>
          O jogo pode exibir anuncios por meio do Google AdSense. Tambem existe um espaco de apoio
          para futuras formas de contribuicao direta e patrocinios.
        </p>

        <h2>Contato</h2>
        <p>
          Sugestoes, problemas e feedback podem ser enviados pelo repositorio do projeto no GitHub.
        </p>

        <div className="legal-actions">
          <Link href="/">Jogar agora</Link>
          <Link href="/privacidade">Privacidade</Link>
        </div>
      </article>
    </main>
  );
}
