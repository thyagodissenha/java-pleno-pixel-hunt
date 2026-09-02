import { type CSSProperties } from "react";
import Link from "next/link";
import { isDebugAllowed, triggerDebugAction } from "@/lib/debug";
import { getAdsenseBannerSlotId, getPublicAdsenseClientId } from "@/lib/adsense";
import { CHARACTERS, resolveCharacter } from "@/lib/characters";
import type { HudProps, MenuPanel } from "@/app/_hud/hud-props";
import { PixelTitlePanels } from "@/app/_hud/title-screen/PixelTitlePanels";
import { OpeningCutscene } from "@/app/_hud/cutscene/OpeningCutscene";

// WORLD/frameScreenLabel are declared locally in app/page.tsx today (it can't
// export extra names — AD-008). Duplicated here as the shared shape used only
// for presentation; both are pure and hold no engine logic.
const WORLD = { width: 960, height: 540 };
const adsenseClientId = getPublicAdsenseClientId();
const adsenseBannerSlotId = getAdsenseBannerSlotId();

function frameScreenLabel(panel: MenuPanel) {
  if (panel === "scores") return "High Scores";
  if (panel === "skins") return "Personagens e Skins";
  return "Como jogar";
}

export function ClassicHud(props: HudProps) {
  const {
    status,
    hp,
    score,
    wave,
    resetCount,
    boss,
    biome,
    upgrade,
    bossProgress,
    burstStaminaPct,
    abilityCooldownPct,
    muted,
    volume,
    gameState,
    menuPanel,
    menuIndex,
    highScores,
    selectedCharacterId,
    supportOpen,
    settingsOpen,
    theme,
    debugOpen,
    playerName,
    scoreSaved,
    scoreMessage,
    promotionCountdown,
    debugBossHealth,
    debugPowerUpCount,
    debugAbilityCooldown,
    debugPlayerPosition,
    debugPlayerEffects,
    setMuted,
    setVolume,
    setMenuIndex,
    activateMenuOption,
    setMenuPanel,
    setSelectedCharacterId,
    setSupportOpen,
    setTheme,
    closeSettingsPanel,
    setPlayerName,
    submitScore,
    startNewGame,
    resumeGame,
    returnToTitle,
    canvasRef,
    adBannerRef,
    characterPortraitRefs,
    debugFirstActionRef,
  } = props;

  const finalScreen = gameState === "over" || gameState === "won";
  const promotionScreen = gameState === "promotion";
  const menuScreen = gameState === "menu";
  const supportScreen = supportOpen;
  const settingsScreen = settingsOpen;
  const pauseScreen = gameState === "paused" && !supportScreen && !settingsScreen;
  const frameScreen =
    supportScreen || settingsScreen || finalScreen || promotionScreen || (menuScreen && menuPanel !== "home");
  const showAdBanner = gameState === "playing" && Boolean(adsenseClientId && adsenseBannerSlotId);
  const jdkPower = upgrade === "JDK 21" ? 9 : upgrade === "JDK 17" ? 6 : 3;

  return (
    <main className="game-shell">
      <div className="game-frame">
      <section className="topbar" aria-label="Painel do jogo">
        <div className="brand-panel">
          <p>Java Pleno Pixel Hunt</p>
          <h1>{status}</h1>
        </div>
        <div className="hud-card jdk-card">
          <strong>{upgrade}</strong>
          <span className="mini-bars" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, index) => (
              <i key={index} className={index < jdkPower ? "on" : undefined} />
            ))}
          </span>
        </div>
        <div className="hud-card wave-card">
          <strong>Onda {wave}</strong>
          <span>Resets {resetCount}</span>
        </div>
        <div className="hud-card score-card">
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div className="hud-card hp-card">
          <span>HP</span>
          <strong>{hp}</strong>
          <i style={{ "--hp": `${hp}%` } as CSSProperties} />
        </div>
        <div className="hud-card utility-card">
          <span className="stamina-meter">
            <strong>Rajada</strong>
            <i style={{ "--stamina": `${burstStaminaPct}%` } as CSSProperties} />
            <small>{burstStaminaPct}%</small>
          </span>
          {resolveCharacter(selectedCharacterId).specialPower && (
            <span className="stamina-meter">
              <strong>Poder</strong>
              <i style={{ "--stamina": `${abilityCooldownPct}%` } as CSSProperties} />
              <small>{abilityCooldownPct}%</small>
            </span>
          )}
        </div>
        <div className="hud-card sound-card" aria-label="Controles de som">
          <div className="sound-controls" aria-label="Controles de som">
            <button
              type="button"
              aria-pressed={muted}
              aria-label={muted ? "Ativar som" : "Mutar som"}
              onClick={() => setMuted((current) => !current)}
            >
              {muted ? "Som off" : "Som on"}
            </button>
            <label>
              <span>Volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value);
                  setVolume(nextVolume);
                  setMuted(nextVolume <= 0);
                }}
              />
            </label>
          </div>
        </div>
        {isDebugAllowed() && (
          <div className="debug-strip">
            {debugBossHealth && (
              <output aria-label="Vida do boss debug">
                {debugBossHealth.hp}/{debugBossHealth.maxHp} HP
              </output>
            )}
            {debugPowerUpCount > 0 && (
              <output aria-label="Power-ups debug">
                {debugPowerUpCount} power-up disponível
              </output>
            )}
            <output aria-label="Cooldown do poder especial debug">
              {debugAbilityCooldown.toFixed(1)}s
            </output>
            <output aria-label="Posição do jogador debug">
              {debugPlayerPosition.x}, {debugPlayerPosition.y}
            </output>
            <output aria-label="Efeitos do jogador debug">
              {debugPlayerEffects.haste.toFixed(1)}, {debugPlayerEffects.invincible.toFixed(1)}
            </output>
          </div>
        )}
      </section>

      <section className="game-stage" aria-label="Arena do jogo">
        <div className={`canvas-frame ${frameScreen ? "frame-screen-active" : ""}`}>
          <canvas ref={canvasRef} width={WORLD.width} height={WORLD.height} aria-label="Arena pixel art" />
        {menuScreen && menuPanel === "home" && (
          <div className="menu-overlay menu-overlay-full" role="dialog" aria-label="Menu inicial">
            <div className={`menu-panel ${menuPanel === "home" ? "title-menu-panel" : ""}`}>
              <div className="retro-title-screen" aria-label="Tela inicial pixel art do Java Pleno Pixel Hunt">
              <div className="retro-title-stage">
                <PixelTitlePanels />
                <OpeningCutscene />

                <div className="title-menu-actions" role="menu" aria-label="Opções do jogo (use as setas e Enter)">
                  <button
                    type="button"
                    role="menuitem"
                    aria-current={menuIndex === 0}
                    className={menuIndex === 0 ? "active" : undefined}
                    onMouseEnter={() => setMenuIndex(0)}
                    onClick={() => activateMenuOption(0)}
                  >
                    {menuIndex === 0 ? "▶ " : ""}Jogar
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    aria-current={menuIndex === 1}
                    className={menuIndex === 1 ? "active" : undefined}
                    onMouseEnter={() => setMenuIndex(1)}
                    onClick={() => activateMenuOption(1)}
                  >
                    {menuIndex === 1 ? "▶ " : ""}High Scores
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    aria-current={menuIndex === 2}
                    className={menuIndex === 2 ? "active" : undefined}
                    onMouseEnter={() => setMenuIndex(2)}
                    onClick={() => activateMenuOption(2)}
                  >
                    {menuIndex === 2 ? "▶ " : ""}Configurações
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    aria-current={menuIndex === 3}
                    className={menuIndex === 3 ? "active" : undefined}
                    onMouseEnter={() => setMenuIndex(3)}
                    onClick={() => activateMenuOption(3)}
                  >
                    {menuIndex === 3 ? "▶ " : ""}Como Jogar
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    aria-current={menuIndex === 4}
                    className={menuIndex === 4 ? "active" : undefined}
                    onMouseEnter={() => setMenuIndex(4)}
                    onClick={() => activateMenuOption(4)}
                  >
                    {menuIndex === 4 ? "▶ " : ""}Apoie o jogo
                  </button>
                </div>
              </div>
              </div>
              <p className="menu-copy">
                Sobreviva aos usuários, derrote os chefes e tente entrar no ranking global antes que alguém peça um deploy em sexta-feira.
              </p>
            </div>
          </div>
        )}
        {menuScreen && menuPanel !== "home" && (
          <dialog open className="frame-screen" aria-label={frameScreenLabel(menuPanel)}>
            <div className="menu-panel frame-panel">
              <p className="menu-kicker">Java Pleno Pixel Hunt</p>

              {menuPanel === "scores" && (
                <>
                  <h2>High Scores</h2>
                  <p className="score-mode">{scoreMessage}</p>
                  <ol className="score-list menu-score-list">
                    {highScores.length ? (
                      highScores.map((entry, index) => (
                        <li key={`${entry.createdAt}-${entry.name}`}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{entry.name}</strong>
                          <em>{entry.score}<small>Onda {entry.wave} · Resets {entry.resets ?? 0}</small></em>
                        </li>
                      ))
                    ) : (
                      <li className="empty-score">
                        <strong>NENHUM SCORE AINDA</strong>
                        <em>0</em>
                      </li>
                    )}
                  </ol>
                  <div className="menu-actions two">
                    <button type="button" onClick={startNewGame}>Jogar</button>
                    <button type="button" onClick={() => setMenuPanel("home")}>Voltar ao início</button>
                  </div>
                </>
              )}

              {menuPanel === "skins" && (
                <>
                  <h2>Personagens & Skins</h2>
                  <div role="radiogroup" aria-label="Escolha de personagem">
                    {CHARACTERS.map((character, index) => (
                      <button
                        key={character.id}
                        type="button"
                        role="radio"
                        aria-checked={character.id === selectedCharacterId}
                        className={
                          character.id === selectedCharacterId
                            ? "character-card character-card-selected"
                            : "character-card"
                        }
                        onClick={() => setSelectedCharacterId(character.id)}
                      >
                        <canvas
                          ref={(el) => {
                            characterPortraitRefs.current[index] = el;
                          }}
                          width={40}
                          height={40}
                          aria-hidden="true"
                          className="character-portrait"
                        />
                        <h3>{character.name}</h3>
                        <ul className="help-list">
                          <li><strong>Vida</strong><span>{character.maxHp}</span></li>
                          <li><strong>Velocidade</strong><span>{character.speed}</span></li>
                          <li><strong>Tamanho</strong><span>{character.size}</span></li>
                        </ul>
                        {character.specialPower ? (
                          <p>
                            <strong>{character.specialPower.name}</strong>
                            {": "}
                            {character.specialPower.description}
                            {" "}
                            (cooldown: {character.specialPower.cooldownSeconds}s)
                          </p>
                        ) : (
                          <p>Sem poder especial.</p>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="menu-actions two">
                    <button type="button" onClick={startNewGame}>Jogar</button>
                    <button type="button" onClick={() => setMenuPanel("home")}>Voltar ao início</button>
                  </div>
                </>
              )}

              {menuPanel === "help" && (
                <>
                  <h2>Como jogar</h2>
                  <ul className="help-list">
                    <li><strong>Mover</strong><span>WASD, setas ou arraste no celular.</span></li>
                    <li><strong>Atirar</strong><span>Automático no inimigo mais próximo.</span></li>
                    <li><strong>Rajada</strong><span>Espaço acelera os tiros enquanto houver estamina.</span></li>
                    <li><strong>Power-ups</strong><span>Café, Refactor, Rollback, Hotfix, Code Review e Sprint ajudam na partida.</span></li>
                    <li><strong>Final</strong><span>A promoção é uma cilada. Novo chamado mantém o score e recomeça a firma mais difícil.</span></li>
                    <li><strong>Objetivo</strong><span>Sobreviva, derrube chefes e salve seu score.</span></li>
                  </ul>
                  <div className="menu-actions two">
                    <button type="button" onClick={startNewGame}>Jogar</button>
                    <button type="button" onClick={() => setMenuPanel("home")}>Voltar ao início</button>
                  </div>
                </>
              )}
            </div>
          </dialog>
        )}
        {supportScreen && (
          <div className="frame-screen support-screen" role="dialog" aria-modal="true" aria-label="Apoie o jogo">
            <div className="menu-panel frame-panel support-panel">
              <p className="menu-kicker">Apoie o jogo</p>
              <h2>PIXEL FUND</h2>
              <p className="support-copy">
                Quer apoiar o projeto ou virar patrocinador? Fale com o dev pelo repositório no GitHub.
              </p>
              <div className="support-options" aria-label="Opções de apoio">
                <div>
                  <strong>GitHub</strong>
                  <span>Abra uma issue ou PR</span>
                </div>
                <div>
                  <strong>Feedback</strong>
                  <span>Sugestões e bugs são bem-vindos</span>
                </div>
                <div>
                  <strong>Patrocínio</strong>
                  <span>Contato direto via GitHub</span>
                </div>
              </div>
              <nav className="sponsor-links" aria-label="Links institucionais">
                <Link href="/privacidade">Privacidade</Link>
                <Link href="/sobre">Sobre</Link>
              </nav>
              <div className="menu-actions two">
                <button type="button" onClick={() => setSupportOpen(false)}>Fechar</button>
                <button type="button" onClick={returnToTitle}>Menu inicial</button>
              </div>
            </div>
          </div>
        )}
        {settingsScreen && (
          <div className="frame-screen settings-screen" role="dialog" aria-modal="true" aria-label="Configurações">
            <div className="menu-panel frame-panel settings-panel">
              <p className="menu-kicker">Configurações</p>
              <h2>OPÇÕES</h2>
              <div role="radiogroup" aria-label="Tema visual" className="theme-picker">
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === "classico"}
                  className={theme === "classico" ? "theme-option theme-option-selected" : "theme-option"}
                  onClick={() => setTheme("classico")}
                >
                  Clássico
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === "neon"}
                  className={theme === "neon" ? "theme-option theme-option-selected" : "theme-option"}
                  onClick={() => setTheme("neon")}
                >
                  Neon
                </button>
              </div>
              <div className="sound-controls" aria-label="Controles de som">
                <button
                  type="button"
                  aria-pressed={muted}
                  aria-label={muted ? "Ativar som" : "Mutar som"}
                  onClick={() => setMuted((current) => !current)}
                >
                  {muted ? "Som off" : "Som on"}
                </button>
                <label>
                  <span>Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(event) => {
                      const nextVolume = Number(event.target.value);
                      setVolume(nextVolume);
                      setMuted(nextVolume <= 0);
                    }}
                  />
                </label>
              </div>
              <div className="menu-actions two">
                <button type="button" onClick={closeSettingsPanel}>Voltar</button>
              </div>
            </div>
          </div>
        )}
        {pauseScreen && (
          <div className="pause-menu-overlay" role="dialog" aria-modal="true" aria-label="Jogo pausado">
            <div className="pause-panel">
              <p className="menu-kicker">Jogo pausado</p>
              <h2>PAUSADO</h2>
              <div className="menu-actions two">
                <button type="button" onClick={resumeGame}>Continuar</button>
                <button type="button" onClick={returnToTitle}>Sair do jogo</button>
              </div>
            </div>
          </div>
        )}
        {debugOpen && (
          <dialog
            open
            className="pause-menu-overlay"
            aria-label="Ferramentas de debug"
            onClose={() => props.setDebugOpen(false)}
          >
            <div className="pause-panel">
              <p className="menu-kicker">Developer tools</p>
              <h2>DEBUG</h2>
              <div className="menu-actions">
                <button ref={debugFirstActionRef} type="button" onClick={() => triggerDebugAction("spawn_boss")}>
                  Invocar Boss
                </button>
                <button type="button" onClick={() => triggerDebugAction("max_stamina")}>
                  Max Estamina
                </button>
                <button type="button" onClick={() => triggerDebugAction("win_game")}>
                  Testar Tela de Vitória
                </button>
                <button type="button" onClick={() => triggerDebugAction("toggle_menu")}>
                  Fechar
                </button>
              </div>
            </div>
          </dialog>
        )}
        {promotionScreen && (
          <div className="frame-screen" role="dialog" aria-modal="true" aria-label="Promoção para sênior">
            <div className="score-panel frame-panel promotion-panel">
              <p className="score-kicker">Promoção para Sênior</p>
              <h2>ERA CILADA DO RH</h2>
              <p className="promotion-copy">
                Parabéns: você aceitou o cargo, herdou o legado sem teste, ganhou acesso a mais reuniões e morreu de responsabilidade.
              </p>
              <p className="score-mode">O pleno nunca vira sênior. Ele só desbloqueia outro board.</p>
              <p className="promotion-countdown">High Scores em {promotionCountdown}</p>
            </div>
          </div>
        )}
        {finalScreen && (
          <div className="frame-screen" role="dialog" aria-modal="true" aria-label="Ranking de maiores pontuações">
            <div className="score-panel frame-panel">
              <p className="score-kicker">{gameState === "won" ? "Missão completa" : "Produção caiu"}</p>
              <h2>HIGH SCORES</h2>
              <p className="score-mode">{scoreMessage}</p>
              {!scoreSaved ? (
                <form className="score-form" onSubmit={submitScore}>
                  <label htmlFor="player-name">Digite seu nome</label>
                  <div>
                    <input
                      id="player-name"
                      maxLength={14}
                      value={playerName}
                      onChange={(event) => setPlayerName(event.target.value)}
                      placeholder="DEV ANON"
                      autoFocus
                    />
                    <button type="submit">Salvar</button>
                  </div>
                  <span>{score} pts · onda {wave} · resets {resetCount}</span>
                </form>
              ) : (
                <div className="menu-actions two">
                  <button type="button" onClick={startNewGame}>Jogar de novo</button>
                  <button type="button" onClick={returnToTitle}>Voltar ao início</button>
                </div>
              )}

              {!scoreSaved && (
                <button className="play-again secondary-action" type="button" onClick={returnToTitle}>
                  Voltar ao início
                </button>
              )}

              <ol className="score-list">
                {highScores.length ? (
                  highScores.map((entry, index) => (
                    <li key={`${entry.createdAt}-${entry.name}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{entry.name}</strong>
                      <em>{entry.score}<small>Onda {entry.wave} · Resets {entry.resets ?? 0}</small></em>
                    </li>
                  ))
                ) : (
                  <li className="empty-score">
                    <strong>NENHUM SCORE AINDA</strong>
                    <em>{score}</em>
                  </li>
                )}
              </ol>
            </div>
          </div>
        )}
        </div>
      </section>

      {showAdBanner && (
        <section className="ad-banner-slot" aria-label="Publicidade">
          <span className="ad-banner-label">Publicidade</span>
          <ins
            ref={adBannerRef}
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client={adsenseClientId}
            data-ad-slot={adsenseBannerSlotId}
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </section>
      )}

      <section className="bottombar" aria-label="Controles e alvo">
        <div className="footer-card controls-card">
          <strong>Movimento</strong>
          <span>WASD / setas</span>
        </div>
        <div className="footer-card burst-card">
          <strong>Rajada</strong>
          <span>Espaço</span>
        </div>
        <div className="footer-card boss-card">
          <div className="boss-avatar" aria-hidden="true">
            <span className="boss-hair" />
            <span className="boss-body" />
            <span className="boss-face-left" />
            <span className="boss-face-right" />
            <span className="boss-mouth" />
          </div>
          <div>
            <strong>Chefe atual</strong>
            <span>{boss}</span>
          </div>
        </div>
        <div className="footer-card biome-card">
          <strong>Fase</strong>
          <span>{biome}</span>
        </div>
        <div className="footer-card progress-card">
          <strong>Boss progress</strong>
          <span>{bossProgress}</span>
        </div>
      </section>
      </div>
    </main>
  );
}
