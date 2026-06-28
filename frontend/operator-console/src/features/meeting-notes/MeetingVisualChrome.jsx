import styles from "./MeetingNotesPage.module.css";

const meetingIonSpecs = [
  ["meetingIonTiny", "meetingIonBlue", "meetingIonLaneOne"],
  ["meetingIonSmall", "meetingIonRed", "meetingIonLaneTwo"],
  ["meetingIonTiny", "meetingIonGreen", "meetingIonLaneThree"],
  ["meetingIonSmall", "meetingIonGold", "meetingIonLaneFour"],
  ["meetingIonMedium", "meetingIonBlue", "meetingIonLaneFive"],
  ["meetingIonTiny", "meetingIonRed", "meetingIonLaneSix"],
];

export function MeetingIonField() {
  return (
    <div aria-hidden="true" className={styles.meetingIonField}>
      {meetingIonSpecs.map(([size, tone, lane], index) => (
        <i
          aria-hidden="true"
          className={[styles.meetingIon, styles[size], styles[tone], styles[lane]]
            .filter(Boolean)
            .join(" ")}
          data-meeting-ion=""
          key={`${lane}-${index}`}
        />
      ))}
    </div>
  );
}

/**
 * @param {{
 *   children: import("react").ReactNode,
 *   tone?: "task" | "skill" | "session",
 * }} props
 */
export function MeetingPanelIcon({ children, tone = "skill" }) {
  const toneClass = {
    task: styles.panelIconTask,
    skill: styles.panelIconSkill,
    session: styles.panelIconSession,
  }[tone];

  return (
    <span aria-hidden="true" className={`${styles.panelIcon} ${toneClass}`}>
      {children}
    </span>
  );
}
