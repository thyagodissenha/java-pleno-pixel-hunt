import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica de Privacidade | Java Pleno Pixel Hunt",
  description: "Politica de privacidade do jogo Java Pleno Pixel Hunt.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <article className="legal-panel">
        <p className="legal-kicker">Java Pleno Pixel Hunt</p>
        <h1>Politica de Privacidade</h1>
        <p>
          Esta politica explica como o Java Pleno Pixel Hunt trata informacoes durante o uso do jogo.
          O projeto e um jogo web independente, publicado para diversao e aprendizado.
        </p>

        <h2>Dados do jogo</h2>
        <p>
          O jogo pode salvar pontuacoes enviadas pelo jogador, incluindo nome informado, score, onda
          alcancada, quantidade de resets e data do registro. Essas informacoes sao usadas para exibir
          o ranking.
        </p>

        <h2>Armazenamento local</h2>
        <p>
          O navegador pode guardar preferencias locais, como volume, mute e uma copia local do ranking
          quando a API estiver indisponivel. Esses dados ficam no proprio dispositivo do usuario.
        </p>

        <h2>Anuncios e cookies</h2>
        <p>
          O site usa Google AdSense para exibicao de anuncios. O Google pode usar cookies ou tecnologias
          semelhantes para medir desempenho, evitar fraude e personalizar anuncios conforme as escolhas
          de consentimento do usuario.
        </p>

        <h2>Terceiros</h2>
        <p>
          O site pode se comunicar com servicos da Vercel para hospedagem, Vercel Blob para ranking e
          Google AdSense para anuncios. Cada servico pode operar de acordo com suas proprias politicas.
        </p>

        <h2>Contato</h2>
        <p>
          Para duvidas sobre privacidade ou sobre o jogo, abra uma issue no repositorio do projeto no
          GitHub.
        </p>

        <div className="legal-actions">
          <Link href="/">Voltar ao jogo</Link>
          <Link href="/sobre">Sobre o jogo</Link>
        </div>
      </article>
    </main>
  );
}
