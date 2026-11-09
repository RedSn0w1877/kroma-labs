// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { SoundPanel } from "./sound-panel";
import styles from "./soundboard.module.css";

/**
 * "hear the difference" (spec §6.3). The heading and intro are server HTML; the instrument (switch keys,
 * test keys, meter, type test) is one client island laid straight onto this section's key grid. While
 * #sound is at least 35% on screen the key router plays the selected switch for every physical key.
 */
export function Soundboard() {
  return (
    <section id="sound" aria-labelledby="sound-title" className={`ug ${styles.sound}`}>
      <h2 id="sound-title" className={`t-h2 ${styles.title}`}>
        hear the difference
      </h2>
      <p className={`t-body ${styles.intro}`}>
        A switch is the small spring-loaded part under every key. It decides how a press feels and how it sounds. Pick one
        and type: every key you press plays it, synthesized live in your browser. No recordings, nothing sent anywhere.
      </p>
      <SoundPanel />
    </section>
  );
}
