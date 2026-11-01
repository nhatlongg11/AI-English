import { useReducedMotion, motion } from "motion/react";
import { Award, Sparkles, Zap } from "lucide-react";
import CountUp from "./CountUp";
export function XpReward({ xp = 10 }: { xp?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className="reward-pill"
      initial={reduced ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <Zap size={14} />+
      {reduced ? xp : <CountUp to={xp} duration={0.65} trigger="load" />} XP
    </motion.span>
  );
}
export function CompletionEmblem({
  achievement = false,
}: {
  achievement?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="result-emblem"
      initial={reduced ? false : { scale: 0.7, rotate: -15 }}
      animate={{ scale: 1, rotate: -5 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
    >
      {achievement ? <Award size={47} /> : <Sparkles size={47} />}
    </motion.div>
  );
}
