import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

import { usePokemon30I18n } from "../i18n/Pokemon30I18n";

function RevealedNumber({ value, delay, revealed }) {
  return (
    <span className={`pokemon-rule-number${revealed ? " is-revealed" : ""}`} aria-label={String(value)}>
      {String(value).split("").map((character, index) => (
        <span
          className="pokemon-rule-number__digit"
          key={`${character}-${index}`}
          aria-hidden="true"
          style={{ "--ticket-digit-delay": `${delay + index * 55}ms` }}
        >
          {character}
        </span>
      ))}
    </span>
  );
}

export function PokemonTicketRuleCard({ rule, index }) {
  const { t } = usePokemon30I18n();
  const cardRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const isInView = useInView(cardRef, { amount: 0.58 });
  const revealed = reducedMotion || isInView;
  const cardDelay = index * 90;
  const hiddenState = { opacity: 1, scale: 0.985, y: 14 };
  const visibleState = { opacity: 1, scale: 1, y: 0 };

  return (
    <motion.li
      ref={cardRef}
      initial={reducedMotion ? false : hiddenState}
      animate={revealed ? visibleState : hiddenState}
      whileHover={reducedMotion ? undefined : { y: -5 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : revealed
            ? { delay: (120 + cardDelay) / 1000, duration: 0.5, ease: [0.22, 1, 0.36, 1] }
            : { duration: 0.2, ease: [0.4, 0, 1, 1] }
      }
    >
      <span>0{index + 1}</span>
      <strong><RevealedNumber value={rule.price} delay={cardDelay + 150} revealed={revealed} /></strong>
      <em><RevealedNumber value={rule.tickets} delay={cardDelay + 250} revealed={revealed} /></em>
      <b>{t("rules.ticketUnit")}</b>
      <small>{t("rules.tierC")}</small>
    </motion.li>
  );
}
